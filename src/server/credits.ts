/**
 * Credits Layer (Phase 2)
 * ─────────────────────────────────────────────────────────────
 * مصدر الحقيقة الوحيد لتكلفة نقاط الفيديو في كل النظام.
 * النصوص والصور مجانية بسقوف حماية يومية، والنقاط تُستهلك للفيديو فقط.
 *
 * ⚠️ غيّر الأرقام هنا فقط — لا تكرّرها في ملفات أخرى.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { VIDEO_CREDIT_COSTS, videoCreditCost, type VideoDuration, type VideoQuality } from "@/lib/plan-catalog";

export type { VideoDuration, VideoQuality } from "@/lib/plan-catalog";

type DbClient = SupabaseClient<Database>;

// ============================================================
// تكلفة النقاط (مصدر الحقيقة)
// ============================================================
export const CREDIT_COSTS = VIDEO_CREDIT_COSTS;

export function videoCost(q: VideoQuality, duration: VideoDuration = 5): number {
  return videoCreditCost(q, duration);
}

// ============================================================
// رسائل أخطاء عربية موحَّدة (يفهمها العميل ويعرض CTA مناسب)
// ============================================================
export class InsufficientCreditsError extends Error {
  required: number;
  constructor(required: number) {
    super(`insufficient_credits: required=${required}`);
    this.name = "InsufficientCreditsError";
    this.required = required;
  }
}

export class TextQuotaExceededError extends Error {
  used: number;
  cap: number;
  constructor(used: number, cap: number) {
    super(`text_quota_exceeded: used=${used} cap=${cap}`);
    this.name = "TextQuotaExceededError";
    this.used = used;
    this.cap = cap;
  }
}

export class ImageQuotaExceededError extends Error {
  used: number;
  cap: number;
  constructor(used: number, cap: number) {
    super(`image_quota_exceeded: used=${used} cap=${cap}`);
    this.name = "ImageQuotaExceededError";
    this.used = used;
    this.cap = cap;
  }
}

// ============================================================
// Helpers يستدعيها ai-functions داخل handler واحد
// ============================================================

/**
 * يستهلك نقاط من المحفظة (plan أولاً ثم topup).
 * يُرجع `ledgerId` لاستخدامه في refund لاحقاً.
 * يرفع `InsufficientCreditsError` إذا الرصيد لا يكفي.
 */
export async function consume(
  db: DbClient,
  amount: number,
  txnType: "consume_video",
  metadata: Record<string, unknown> = {}
): Promise<{ ledgerId: string; remainingTotal: number; remainingPlan: number; remainingTopup: number }> {
  const { data, error } = await db.rpc("consume_credits", {
    _amount: amount,
    _txn_type: txnType,
    _metadata: metadata as never,
  });

  if (error) {
    if (/insufficient_credits/i.test(error.message)) {
      throw new InsufficientCreditsError(amount);
    }
    throw new Error(`فشل خصم النقاط: ${error.message}`);
  }

  const row = (data as Array<{
    ledger_id: string;
    remaining_total: number;
    remaining_plan: number;
    remaining_topup: number;
  }>)?.[0];

  if (!row) throw new Error("فشل خصم النقاط: استجابة فارغة");

  return {
    ledgerId: row.ledger_id,
    remainingTotal: row.remaining_total,
    remainingPlan: row.remaining_plan,
    remainingTopup: row.remaining_topup,
  };
}

/**
 * يرجّع نقاط استُهلكت سابقاً (عند فشل التوليد بعد الخصم).
 * idempotent: لا يعيد المبلغ مرتين.
 */
export async function refund(
  db: DbClient,
  ledgerId: string,
  reason = "generation_failed"
): Promise<string | null> {
  const { data, error } = await db.rpc("refund_credits", {
    _ledger_id: ledgerId,
    _reason: reason,
  });
  if (error) {
    if (/already_refunded/i.test(error.message)) return null;
    // لا نرفع — فشل الـrefund لا يجب أن يحجب رسالة الخطأ الأصلية للعميل
    console.error(`refund_credits failed: ${error.message}`);
    return null;
  }
  return typeof data === "string" ? data : null;
}

/**
 * يمنح المستخدم نقاط تعويضية تلقائياً عند فشل توليد الفيديو من جانب المزوّد
 * بعد استنفاد كل المزودين الاحتياطيين.
 * - آمن ضد الازدواج (idempotent عبر reference_id).
 * - لا يرفع استثناءً: فشل التعويض لا يحجب الرسالة الأصلية للمستخدم.
 */
export async function grantCompensationCredits(
  db: DbClient,
  params: {
    userId: string;
    amount: number;
    reason: string;
    referenceId?: string | null;
    referenceType?: string;
  }
): Promise<string | null> {
  const { data, error } = await db.rpc("grant_compensation_credits", {
    _user_id: params.userId,
    _amount: params.amount,
    _reason: params.reason,
    _reference_id: params.referenceId ?? undefined,
    _reference_type: params.referenceType ?? "video_job",
  });
  if (error) {
    console.error(`grant_compensation_credits failed: ${error.message}`);
    return null;
  }
  return typeof data === "string" ? data : null;
}

export async function getRefundLedgerId(db: DbClient, ledgerId: string): Promise<string | null> {
  const { data, error } = await db
    .from("credit_ledger")
    .select("refund_ledger_id")
    .eq("id", ledgerId)
    .maybeSingle();
  if (error) {
    console.error(`get refund ledger failed: ${error.message}`);
    return null;
  }
  return typeof data?.refund_ledger_id === "string" ? data.refund_ledger_id : null;
}

/**
 * يستهلك محاولة واحدة من حصة النص اليومية حسب الباقة.
 * النصوص لا تخصم نقاط — تستخدم عدّاد منفصل.
 */
export async function consumeTextQuota(db: DbClient): Promise<{ used: number; cap: number }> {
  const { data, error } = await db.rpc("consume_text_quota");
  if (error) throw new Error(`فشل التحقق من الحصة: ${error.message}`);

  const row = (data as Array<{ allowed: boolean; used: number; daily_cap: number }>)?.[0];
  if (!row) throw new Error("استجابة فارغة من الحصة");

  if (!row.allowed) throw new TextQuotaExceededError(row.used, row.daily_cap);
  return { used: row.used, cap: row.daily_cap };
}

/**
 * يستهلك محاولة واحدة من حصة الصور اليومية.
 * الصور لا تخصم نقاط فيديو — تستخدم عدّاد حماية منفصل.
 */
export async function consumeImageQuota(db: DbClient, quality: "flash" | "pro" = "flash"): Promise<{ used: number; cap: number }> {
  const { data, error } = await (db as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc("consume_image_quota", {
    _quality: quality,
  });
  if (error) throw new Error(`فشل التحقق من حصة الصور: ${error.message}`);

  const row = (data as Array<{ allowed: boolean; used: number; daily_cap: number }>)?.[0];
  if (!row) throw new Error("استجابة فارغة من حصة الصور");

  if (!row.allowed) throw new ImageQuotaExceededError(row.used, row.daily_cap);
  return { used: row.used, cap: row.daily_cap };
}

export async function releaseImageDailyQuota(db: DbClient, userId?: string): Promise<void> {
  const { error } = await (db as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ error: { message: string } | null }> }).rpc("release_image_daily_quota", { _user_id: userId });
  if (error) console.error(`release_image_daily_quota failed: ${error.message}`);
}

export async function operationalSwitchEnabled(db: DbClient, key: "video_enabled" | "video_quality_enabled" | "image_pro_enabled" | "ocr_receipt_enabled"): Promise<boolean> {
  const { data, error } = await (db as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc("operational_switch_enabled", { _key: key });
  if (error) {
    console.error(`operational_switch_enabled(${key}) failed: ${error.message}`);
    return true;
  }
  return data !== false;
}

// ============================================================
// Server Function: ملخص النقاط للواجهة (شريط الرصيد)
// ============================================================
export const getCreditsSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as { supabase: DbClient };
    const { data, error } = await supabase.rpc("get_user_credits_summary");
    if (error) throw new Error(`فشل جلب الرصيد: ${error.message}`);

    const row = (data as Array<{
      plan_credits: number;
      topup_credits: number;
      total_credits: number;
      cycle_ends_at: string | null;
      daily_text_used: number;
      daily_text_cap: number;
      daily_image_used: number;
      daily_image_cap: number;
      plan: "free" | "starter" | "growth" | "pro" | "business";
      image_pro_allowed?: boolean;
      video_fast_allowed?: boolean;
      video_quality_allowed?: boolean;
      max_video_duration_seconds?: number;
    }>)?.[0];

    if (!row) {
      return {
        planCredits: 0,
        topupCredits: 0,
        totalCredits: 0,
        cycleEndsAt: null,
        dailyTextUsed: 0,
        dailyTextCap: 10,
        dailyImageUsed: 0,
        dailyImageCap: 2,
        plan: "free" as const,
        imageProAllowed: false,
        videoFastAllowed: false,
        videoQualityAllowed: false,
        maxVideoDurationSeconds: 5,
        costs: CREDIT_COSTS,
      };
    }

    return {
      planCredits: row.plan_credits,
      topupCredits: row.topup_credits,
      totalCredits: row.total_credits,
      cycleEndsAt: row.cycle_ends_at,
      dailyTextUsed: row.daily_text_used,
      dailyTextCap: row.daily_text_cap,
      dailyImageUsed: row.daily_image_used,
      dailyImageCap: row.daily_image_cap,
      plan: row.plan,
      imageProAllowed: row.image_pro_allowed ?? false,
      videoFastAllowed: row.video_fast_allowed ?? true,
      videoQualityAllowed: row.video_quality_allowed ?? false,
      maxVideoDurationSeconds: row.max_video_duration_seconds ?? 5,
      costs: CREDIT_COSTS,
    };
  });

// ============================================================
// Server Function: قائمة باقات النقاط الإضافية (للعرض)
// ============================================================
export const listTopupPackages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as { supabase: DbClient };
    const { data, error } = await supabase
      .from("topup_packages")
      .select("id, display_name, credits, price_sar, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) throw new Error(`فشل جلب الباقات: ${error.message}`);
    return { packages: data ?? [] };
  });
