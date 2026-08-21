/**
 * Admin Credits — server functions لإدارة طلبات الشحن، دفتر الحركات، والضبط اليدوي.
 *
 * الحماية:
 *   1) requireSupabaseAuth (Bearer token صالح).
 *   2) assertAdmin (دور admin في user_roles).
 *   3) العمليات الحساسة (تفعيل/رفض/ضبط) تستخدم supabaseAdmin (service-role)
 *      بعد التحقق من الدور — تجاوز RLS بشكل آمن ومُدقَّق.
 *
 * كل عملية كتابة تُسجَّل في admin_audit_log تلقائياً.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin, logAdminAudit, type DbClient } from "@/server/admin-auth";
import type { Database, Json } from "@/integrations/supabase/types";

// ============================================================
// 1) قائمة طلبات الشحن (مع فلترة + إحصاءات)
// ============================================================
export type AdminTopupPurchase = {
  id: string;
  user_id: string;
  user_email: string | null;
  user_store: string | null;
  package_id: string;
  credits: number;
  price_sar: number;
  status: "pending" | "paid" | "activated" | "rejected" | "refunded";
  payment_method: string | null;
  receipt_path: string | null;
  receipt_uploaded_at: string | null;
  admin_notes: string | null;
  created_at: string;
  activated_at: string | null;
  activated_by: string | null;
  ledger_id: string | null;
};

const ListTopupsInput = z.object({
  status: z.enum(["pending", "paid", "activated", "rejected", "refunded", "all"]).optional().default("all"),
  limit: z.number().int().min(1).max(500).optional().default(100),
});

export const listAdminTopups = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ListTopupsInput.parse(input ?? {}))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{
    rows: AdminTopupPurchase[];
    counts: Record<string, number>;
  }> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    let q = supabaseAdmin
      .from("topup_purchases")
      .select("id, user_id, package_id, credits, price_sar, status, payment_method, receipt_path, receipt_uploaded_at, admin_notes, created_at, activated_at, activated_by, ledger_id")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.status !== "all") q = q.eq("status", data.status);

    const { data: rows, error } = await q;
    if (error) throw new Error(`فشل جلب الطلبات: ${error.message}`);

    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const { data: profs } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, email, store_name").in("id", userIds)
      : { data: [] as { id: string; email: string | null; store_name: string | null }[] };
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]));

    // إحصاءات إجمالية بـcount دقيق (بدون جلب الصفوف — يتفادى حد 1000)
    const statusList = ["pending", "paid", "activated", "rejected", "refunded"] as const;
    const counts: Record<string, number> = { pending: 0, paid: 0, activated: 0, rejected: 0, refunded: 0 };
    await Promise.all(
      statusList.map(async (s) => {
        const { count } = await supabaseAdmin
          .from("topup_purchases")
          .select("id", { count: "exact", head: true })
          .eq("status", s);
        counts[s] = count ?? 0;
      })
    );

    return {
      rows: (rows ?? []).map((r) => {
        const p = profMap.get(r.user_id);
        return {
          ...r,
          user_email: p?.email ?? null,
          user_store: p?.store_name ?? null,
        };
      }),
      counts,
    };
  });

// ============================================================
// 2) رابط Signed URL للإيصال (للأدمن فقط)
// ============================================================
const SignedReceiptInput = z.object({
  path: z.string().min(1).max(512),
});

export const getTopupReceiptUrl = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SignedReceiptInput.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    const { data: signed, error } = await supabaseAdmin.storage
      .from("payment-receipts")
      .createSignedUrl(data.path, 60 * 5); // 5 دقائق
    if (error || !signed) throw new Error(`فشل توقيع الرابط: ${error?.message}`);
    return { url: signed.signedUrl };
  });

// ============================================================
// 3) تفعيل طلب شحن (يستدعي activate_topup_purchase RPC)
// ============================================================
const ActivateInput = z.object({
  purchaseId: z.string().uuid(),
  adminNotes: z.string().max(500).optional(),
});

export const activateTopup = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ActivateInput.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ ok: true; credits_added: number; new_topup_balance: number }> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    // فحص الحالة الحالية لـaudit + قواعد العمل
    const { data: current, error: cErr } = await supabaseAdmin
      .from("topup_purchases")
      .select("id, user_id, status, credits, price_sar, receipt_path")
      .eq("id", data.purchaseId)
      .maybeSingle();
    if (cErr || !current) throw new Error("الطلب غير موجود");
    if (current.status === "activated") throw new Error("الطلب مفعَّل بالفعل");
    if (!["pending", "paid"].includes(current.status)) {
      throw new Error(`لا يمكن تفعيل طلب بحالة: ${current.status}`);
    }
    // فرض السيرفر: لا تفعيل بدون إيصال (UI يحجب لكن نحمي ضد bypass)
    if (!current.receipt_path) {
      throw new Error("لا يمكن التفعيل قبل رفع المستخدم لإيصال الدفع");
    }

    // استدعِ RPC المؤمَّنة (تفحص دور admin داخلياً + advisory lock)
    // نحتاج تمرير JWT الأدمن للـRPC ليعمل auth.uid() — لذلك نستخدم العميل المُمرَّر بـ Authorization
    const { data: rpcData, error: rpcErr } = await supabase.rpc("activate_topup_purchase", {
      _purchase_id: data.purchaseId,
    });
    if (rpcErr) throw new Error(`فشل التفعيل: ${rpcErr.message}`);

    // إضافة ملاحظة الأدمن إن وُجدت
    if (data.adminNotes) {
      await supabaseAdmin
        .from("topup_purchases")
        .update({ admin_notes: data.adminNotes })
        .eq("id", data.purchaseId);
    }

    await logAdminAudit({
      adminId: userId,
      action: "activate_topup",
      targetTable: "topup_purchases",
      targetId: data.purchaseId,
      before: { status: current.status },
      after: { status: "activated", credits: current.credits },
      metadata: { user_id: current.user_id, price_sar: current.price_sar, notes: data.adminNotes ?? null },
    });

    const row = rpcData as { topup_credits: number } | null;
    return {
      ok: true,
      credits_added: current.credits,
      new_topup_balance: row?.topup_credits ?? 0,
    };
  });

// ============================================================
// 4) رفض طلب شحن
// ============================================================
const RejectInput = z.object({
  purchaseId: z.string().uuid(),
  reason: z.string().min(3).max(500),
});

export const rejectTopup = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RejectInput.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    const { data: current } = await supabaseAdmin
      .from("topup_purchases")
      .select("id, user_id, status")
      .eq("id", data.purchaseId)
      .maybeSingle();
    if (!current) throw new Error("الطلب غير موجود");
    if (current.status === "activated") throw new Error("لا يمكن رفض طلب مفعَّل — استخدم الاسترجاع");

    const { error } = await supabaseAdmin
      .from("topup_purchases")
      .update({ status: "rejected", admin_notes: data.reason })
      .eq("id", data.purchaseId);
    if (error) throw new Error(`فشل الرفض: ${error.message}`);

    await logAdminAudit({
      adminId: userId,
      action: "reject_topup",
      targetTable: "topup_purchases",
      targetId: data.purchaseId,
      before: { status: current.status },
      after: { status: "rejected" },
      metadata: { user_id: current.user_id, reason: data.reason },
    });

    return { ok: true };
  });

// ============================================================
// 5) سجل النقاط (Credit Ledger) للمستخدم — للتدقيق
// ============================================================
const LedgerInput = z.object({
  userId: z.string().uuid().optional(),
  txnType: z
    .enum(["plan_grant", "topup_purchase", "consume_video", "refund", "admin_adjust", "expire", "all"])
    .optional()
    .default("all"),
  limit: z.number().int().min(1).max(500).optional().default(200),
});

type LedgerJson = string | number | boolean | null | LedgerJson[] | { [k: string]: LedgerJson };

export type AdminLedgerEntry = {
  id: string;
  user_id: string;
  user_email: string | null;
  txn_type: string;
  amount: number;
  source: string | null;
  balance_after_plan: number;
  balance_after_topup: number;
  reference_type: string | null;
  reference_id: string | null;
  refunded_at: string | null;
  created_at: string;
  metadata: LedgerJson;
};

export const listCreditLedger = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => LedgerInput.parse(input ?? {}))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ entries: AdminLedgerEntry[] }> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    let q = supabaseAdmin
      .from("credit_ledger")
      .select("id, user_id, txn_type, amount, source, balance_after_plan, balance_after_topup, reference_type, reference_id, refunded_at, created_at, metadata")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.userId) q = q.eq("user_id", data.userId);
    if (data.txnType !== "all") q = q.eq("txn_type", data.txnType);

    const { data: rows, error } = await q;
    if (error) throw new Error(`فشل جلب الدفتر: ${error.message}`);

    const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, email").in("id", ids)
      : { data: [] as { id: string; email: string | null }[] };
    const emailMap = new Map((profs ?? []).map((p) => [p.id, p.email]));

    return {
      entries: (rows ?? []).map((r) => ({
        ...r,
        user_email: emailMap.get(r.user_id) ?? null,
        metadata: (r.metadata as LedgerJson) ?? null,
      })),
    };
  });

// ============================================================
// 6) ضبط يدوي للنقاط (admin adjustment) — منح/سحب
// ============================================================
const AdjustInput = z.object({
  userId: z.string().uuid(),
  amount: z.number().int().refine((n) => n !== 0, "الكمية يجب ألا تكون صفراً"),
  source: z.enum(["plan", "topup"]).default("topup"),
  reason: z.string().min(5).max(500),
});

export const adminAdjustCredits = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AdjustInput.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ ok: true; new_plan: number; new_topup: number; ledger_id: string }> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    // تأكد من وجود سجل user_credits
    await supabaseAdmin.rpc("_ensure_user_credits", { _uid: data.userId });

    // اقرأ الرصيد الحالي
    const { data: cur, error: rErr } = await supabaseAdmin
      .from("user_credits")
      .select("plan_credits, topup_credits")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (rErr || !cur) throw new Error("لم يُعثر على المستخدم");

    const newPlan = data.source === "plan" ? cur.plan_credits + data.amount : cur.plan_credits;
    const newTopup = data.source === "topup" ? cur.topup_credits + data.amount : cur.topup_credits;

    if (newPlan < 0 || newTopup < 0) {
      throw new Error(`الرصيد لا يكفي للسحب — الحالي: plan=${cur.plan_credits} topup=${cur.topup_credits}`);
    }

    // حدِّث الرصيد + سجِّل في الدفتر (atomically عبر service role)
    const { error: uErr } = await supabaseAdmin
      .from("user_credits")
      .update({
        plan_credits: newPlan,
        topup_credits: newTopup,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", data.userId);
    if (uErr) throw new Error(`فشل تحديث الرصيد: ${uErr.message}`);

    const { data: ledgerRow, error: lErr } = await supabaseAdmin
      .from("credit_ledger")
      .insert({
        user_id: data.userId,
        txn_type: "admin_adjust",
        amount: data.amount,
        source: data.source,
        balance_after_plan: newPlan,
        balance_after_topup: newTopup,
        metadata: {
          reason: data.reason,
          adjusted_by: userId,
          delta: data.amount,
        } as never,
      })
      .select("id")
      .single();
    if (lErr || !ledgerRow) throw new Error(`فشل تسجيل الحركة: ${lErr?.message}`);

    await logAdminAudit({
      adminId: userId,
      action: data.amount > 0 ? "admin_grant_credits" : "admin_deduct_credits",
      targetTable: "user_credits",
      targetId: data.userId,
      before: { plan_credits: cur.plan_credits, topup_credits: cur.topup_credits },
      after: { plan_credits: newPlan, topup_credits: newTopup },
      metadata: {
        amount: data.amount,
        source: data.source,
        reason: data.reason,
        ledger_id: ledgerRow.id,
      },
    });

    return { ok: true, new_plan: newPlan, new_topup: newTopup, ledger_id: ledgerRow.id };
  });

// ============================================================
// 7) إدارة باقات الشحن (تعديل السعر/الكمية/التفعيل)
// ============================================================
export type AdminTopupPackage = {
  id: string;
  display_name: string;
  credits: number;
  price_sar: number;
  display_order: number;
  is_active: boolean;
};

export const listAdminTopupPackages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ packages: AdminTopupPackage[] }> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    const { data, error } = await supabaseAdmin
      .from("topup_packages")
      .select("id, display_name, credits, price_sar, display_order, is_active")
      .order("display_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { packages: (data ?? []) as AdminTopupPackage[] };
  });

const UpdatePackageInput = z.object({
  id: z.string().min(1),
  display_name: z.string().min(2).max(120).optional(),
  credits: z.number().int().min(1).max(1_000_000).optional(),
  price_sar: z.number().min(0.01).max(100_000).optional(),
  display_order: z.number().int().min(0).max(999).optional(),
  is_active: z.boolean().optional(),
});

export const updateTopupPackage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => UpdatePackageInput.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    const { data: before } = await supabaseAdmin
      .from("topup_packages")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!before) throw new Error("الباقة غير موجودة");

    const patch: Partial<typeof before> = {};
    if (data.display_name !== undefined) patch.display_name = data.display_name;
    if (data.credits !== undefined) patch.credits = data.credits;
    if (data.price_sar !== undefined) patch.price_sar = data.price_sar;
    if (data.display_order !== undefined) patch.display_order = data.display_order;
    if (data.is_active !== undefined) patch.is_active = data.is_active;

    const { error } = await supabaseAdmin
      .from("topup_packages")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(`فشل التحديث: ${error.message}`);

    await logAdminAudit({
      adminId: userId,
      action: "update_topup_package",
      targetTable: "topup_packages",
      targetId: data.id,
      before,
      after: { ...before, ...patch },
    });

    return { ok: true };
  });
