/**
 * Server functions for AI generation (Phase 2 — quota-aware)
 * ─────────────────────────────────────────────────────────────
 * - generateText: نص — يستهلك حصة يومية فقط (consume_text_quota)
 * - generateImage / editImage: يستهلك حصة صور يومية فقط، بدون خصم نقاط
 *
 * IMPORTANT: نُبقي bump_usage و usage_logs للتوافق مع لوحة الإدارة وتقارير الكلفة.
 * الحصص اليومية هي مصدر الحقيقة للنصوص والصور — usage_logs للقياس فقط.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { chatComplete, AIError } from "./lovable-ai";
import { estimateTextCost, estimateImageCost } from "./cost";
import { buildTextSystemPrompt, buildImagePrompt, type StoreContext } from "./prompts";
import { currentRiyadhMonth } from "@/lib/usage-month";
import {
  consumeImageQuota,
  consumeTextQuota,
  operationalSwitchEnabled,
  releaseImageDailyQuota,
  InsufficientCreditsError,
  ImageQuotaExceededError,
  TextQuotaExceededError,
} from "./credits";

type DbClient = SupabaseClient<Database>;
type CampaignMeta = { campaignId?: string; campaignPackId?: string };

function currentMonth(): string {
  return currentRiyadhMonth();
}

async function loadProfile(db: DbClient, userId: string) {
  const { data: profile } = await db
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return profile;
}

async function assertCampaignPackOwner(db: DbClient, userId: string, campaignId?: string, campaignPackId?: string) {
  const id = campaignId ?? campaignPackId;
  if (!id) return null;
  const { data, error } = await db
    .from("campaign_packs")
    .select("id, product, goal, channel")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) throw new Error("حزمة الحملة غير موجودة أو لا تملك صلاحية استخدامها");
  return data;
}

function campaignMetadata(pack: Awaited<ReturnType<typeof assertCampaignPackOwner>>): CampaignMeta & Record<string, unknown> {
  return pack
    ? { campaignId: pack.id, campaignPackId: pack.id, campaign_pack_id: pack.id, campaign_product: pack.product, campaign_goal: pack.goal, campaign_channel: pack.channel }
    : {};
}

async function bumpUsage(
  db: DbClient,
  month: string,
  kind: "text" | "image"
) {
  // للقياس فقط (لوحة الإدارة + تقارير) — لا يحجب الاستهلاك
  const { error } = await db.rpc("bump_usage", { _month: month, _kind: kind });
  if (error) console.warn(`bump_usage failed (non-blocking): ${error.message}`);
}

/**
 * مُترجم أخطاء النقاط لرسائل عربية صديقة للمستخدم.
 * يحافظ على رمز معروف في بداية الرسالة ليلتقطه العميل ويعرض CTA الترقية/الشحن.
 */
function creditError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (/image_pro_not_allowed/i.test(msg)) {
    return new Error("IMAGE_PRO_NOT_ALLOWED: صور Pro متاحة في باقات Growth وما فوق. استخدم Flash أو رقّ الباقة.");
  }
  if (e instanceof InsufficientCreditsError) {
    return new Error(
      `INSUFFICIENT_CREDITS: رصيد نقاط الفيديو لا يكفي (تحتاج ${e.required} نقطة فيديو). اشحن نقاط فيديو إضافية أو رقّ باقتك.`
    );
  }
  if (e instanceof TextQuotaExceededError) {
    return new Error(
      `TEXT_QUOTA_EXCEEDED: وصلت حدّ ${e.cap} نص يومياً (${e.used}/${e.cap}). يتجدّد العداد بعد منتصف الليل بتوقيت الرياض.`
    );
  }
  if (e instanceof ImageQuotaExceededError) {
    return new Error(
      `IMAGE_QUOTA_EXCEEDED: وصلت حدّ ${e.cap} صورة يومياً (${e.used}/${e.cap}). يتجدّد العداد بعد منتصف الليل بتوقيت الرياض.`
    );
  }
  return e instanceof Error ? e : new Error(String(e));
}

// ============================================================
// generateText — حصة يومية (200/يوم) بدون نقاط
// ============================================================
export const generateText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { prompt: string; templateTitle: string; templateId: string; campaignId?: string; campaignPackId?: string }) => {
      if (!input.prompt?.trim()) throw new Error("الموضوع مطلوب");
      if (input.prompt.length > 2000) throw new Error("الموضوع طويل جداً");
      if (input.campaignId && !/^[0-9a-f-]{36}$/i.test(input.campaignId)) throw new Error("معرّف الحملة غير صحيح");
      if (input.campaignPackId && !/^[0-9a-f-]{36}$/i.test(input.campaignPackId)) throw new Error("معرّف الحملة غير صحيح");
      return input;
    }
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };

    // 1) حجز الحصة اليومية (يرفع TextQuotaExceededError عند التجاوز)
    let quota: { used: number; cap: number };
    try {
      quota = await consumeTextQuota(supabase);
    } catch (e) {
      throw creditError(e);
    }

    const profile = await loadProfile(supabase, userId);
    const campaignPack = await assertCampaignPackOwner(supabase, userId, data.campaignId, data.campaignPackId);
    const ctx: StoreContext = profile ?? {};
    const system = buildTextSystemPrompt(ctx, data.templateTitle);

    let result: string;
    let aiUsage = {
      prompt_tokens: null as number | null,
      completion_tokens: null as number | null,
      total_tokens: null as number | null,
    };
    const modelName = "google/gemini-2.5-flash";
    try {
      const out = await chatComplete({
        model: modelName,
        messages: [
          { role: "system", content: system },
          { role: "user", content: data.prompt },
        ],
        temperature: 0.85,
      });
      result = out.text.trim();
      aiUsage = out.usage;
      if (!result) throw new Error("لم يتم توليد محتوى");
    } catch (e) {
      // ملاحظة: لا نرد الحصة (السقف اليومي ليس نقاطاً قابلة للاسترداد)
      if (e instanceof AIError) throw new Error(e.message);
      throw e;
    }

    const cost = estimateTextCost(modelName, aiUsage);

    const { error: insErr } = await supabase.rpc("record_generation", {
      _type: "text",
      _prompt: data.prompt,
      _result: result,
      _template: data.templateId ?? undefined,
      _model_used: modelName,
      _prompt_tokens: aiUsage.prompt_tokens ?? undefined,
      _completion_tokens: aiUsage.completion_tokens ?? undefined,
      _total_tokens: aiUsage.total_tokens ?? undefined,
      _estimated_cost_usd: cost,
      _metadata: { template_title: data.templateTitle, source: campaignPack ? "campaign_studio" : "generate_text", ...campaignMetadata(campaignPack) },
    });
    if (insErr) throw new Error(`فشل حفظ التوليدة: ${insErr.message}`);

    await bumpUsage(supabase, currentMonth(), "text");

    return {
      result,
      remainingDaily: quota.cap - quota.used,
      dailyUsed: quota.used,
      dailyCap: quota.cap,
    };
  });

// ============================================================
// generateImage — حصة صور يومية بدون نقاط
// ============================================================
export const generateImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      prompt: string;
      templateTitle: string;
      templateId: string;
      quality: "flash" | "pro";
      campaignId?: string;
      campaignPackId?: string;
      referenceImageUrl?: string;
    }) => {
      if (!input.prompt?.trim()) throw new Error("وصف الصورة مطلوب");
      if (input.prompt.length > 1500) throw new Error("الوصف طويل جداً");
      if (!["flash", "pro"].includes(input.quality)) throw new Error("جودة غير صحيحة");
      if (input.campaignId && !/^[0-9a-f-]{36}$/i.test(input.campaignId)) throw new Error("معرّف الحملة غير صحيح");
      if (input.campaignPackId && !/^[0-9a-f-]{36}$/i.test(input.campaignPackId)) throw new Error("معرّف الحملة غير صحيح");
      if (input.referenceImageUrl && !/^https?:\/\//i.test(input.referenceImageUrl)) throw new Error("رابط صورة المنتج غير صحيح");
      return input;
    }
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };

    let quota: { used: number; cap: number };
    let quotaConsumed = false;
    try {
      if (data.quality === "pro" && !(await operationalSwitchEnabled(supabase, "image_pro_enabled"))) {
        throw new Error("image_pro_not_allowed");
      }
      quota = await consumeImageQuota(supabase, data.quality);
      quotaConsumed = true;
    } catch (e) {
      throw creditError(e);
    }

    try {
      const profile = await loadProfile(supabase, userId);
      const campaignPack = await assertCampaignPackOwner(supabase, userId, data.campaignId, data.campaignPackId);
      const ctx: StoreContext = profile ?? {};
      const fullPrompt = [
        buildImagePrompt(ctx, data.prompt, data.templateTitle),
        data.referenceImageUrl ? "استخدم صورة المنتج المرفقة كمرجع بصري إلزامي: حافظ على هوية المنتج وشكله وألوانه وشعاراته وتفاصيله، وصمّم الإعلان حول نفس المنتج بدون استبداله أو اختراع منتج آخر." : "",
      ].filter(Boolean).join("\n\n");

      const model =
        data.quality === "pro"
          ? "google/gemini-3-pro-image-preview"
          : "google/gemini-3.1-flash-image-preview";

      let imageDataUrl: string;
      try {
        const out = await chatComplete({
          model,
          messages: [{ role: "user", content: data.referenceImageUrl ? [{ type: "text", text: fullPrompt }, { type: "image_url", image_url: { url: data.referenceImageUrl } }] : fullPrompt }],
          modalities: ["image", "text"],
        });
        imageDataUrl = out.images[0];
        if (!imageDataUrl) throw new Error("لم يتم توليد صورة");
      } catch (e) {
        if (e instanceof AIError) {
          if (e.code === "rate_limited") await releaseImageDailyQuota(supabase, userId);
          throw new Error(e.message);
        }
        throw e;
      }

      const match = imageDataUrl.match(/^data:(image\/[a-z0-9+]+);base64,(.+)$/i);
      if (!match) throw new Error("صيغة الصورة غير مدعومة");
      const mime = match[1];
      const ext = mime.split("/")[1].replace("+xml", "");
      const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
      const filename = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("generated-images")
        .upload(filename, bytes, { contentType: mime, upsert: false });
      if (upErr) throw new Error(`فشل حفظ الصورة: ${upErr.message}`);

      const { data: signed, error: signErr } = await supabase.storage
        .from("generated-images")
        .createSignedUrl(filename, 60 * 60 * 24 * 365);
      if (signErr || !signed?.signedUrl) {
        await supabase.storage.from("generated-images").remove([filename]).catch(() => {});
        throw new Error(`فشل إنشاء رابط الصورة: ${signErr?.message ?? "unknown"}`);
      }
      const publicUrl = signed.signedUrl;
      const usdCost = estimateImageCost(model);

      const { error: insErr } = await supabase.rpc("record_generation", {
        _type: "image",
        _prompt: data.prompt,
        _result: publicUrl,
        _template: data.templateId ?? null,
        _model_used: model,
        _estimated_cost_usd: usdCost,
        _metadata: {
          template_title: data.templateTitle,
          source: campaignPack ? "campaign_studio" : "generate_image",
          quality: data.quality,
          storage_path: filename,
          reference_image_url: data.referenceImageUrl ?? null,
          credits_charged: 0,
          billing_scope: "daily_image_quota",
          ...campaignMetadata(campaignPack),
        },
      });
      if (insErr) {
        // فشل التسجيل بعد توليد الصورة → احذف الملف ورُدّ النقاط (المعالج الخارجي يلتقط الخطأ ويعمل refund)
        await supabase.storage.from("generated-images").remove([filename]).catch(() => {});
        throw new Error(`فشل حفظ الصورة: ${insErr.message}`);
      }

      await bumpUsage(supabase, currentMonth(), "image");

      return {
        url: publicUrl,
        creditsCharged: 0,
        remainingDaily: quota.cap - quota.used,
        dailyUsed: quota.used,
        dailyCap: quota.cap,
      };
    } catch (e) {
      if (quotaConsumed) await releaseImageDailyQuota(supabase, userId);
      throw e;
    }
  });

// ============================================================
// editImage — حصة صور يومية بدون نقاط
// ============================================================
export const editImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      imageDataUrl: string;
      prompt: string;
      templateTitle: string;
      templateId: string;
      campaignId?: string;
      campaignPackId?: string;
    }) => {
      if (!input.imageDataUrl?.startsWith("data:image/")) {
        throw new Error("صيغة الصورة غير صحيحة");
      }
      if (input.imageDataUrl.length > 14_000_000) {
        throw new Error("حجم الصورة كبير جداً (الحد الأقصى ~10MB)");
      }
      if (!input.prompt?.trim()) throw new Error("اكتب وصف التعديل");
      if (input.prompt.length > 1500) throw new Error("الوصف طويل جداً");
      if (input.campaignId && !/^[0-9a-f-]{36}$/i.test(input.campaignId)) throw new Error("معرّف الحملة غير صحيح");
      if (input.campaignPackId && !/^[0-9a-f-]{36}$/i.test(input.campaignPackId)) throw new Error("معرّف الحملة غير صحيح");
      return input;
    }
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };

    let quota: { used: number; cap: number };
    try {
      quota = await consumeImageQuota(supabase, "flash");
    } catch (e) {
      throw creditError(e);
    }

    try {
      const profile = await loadProfile(supabase, userId);
      const campaignPack = await assertCampaignPackOwner(supabase, userId, data.campaignId, data.campaignPackId);
      const ctx: StoreContext = profile ?? {};
      const brandHint = ctx.brand_color
        ? ` Use brand accent color ${ctx.brand_color} where appropriate.`
        : "";
      const fullPrompt = [
        data.prompt,
        "Edit the provided product photo with strict commercial product-photography quality.",
        "Preserve the exact product identity: do not change its shape, material, buttons, logos, labels, colors, proportions, or important details.",
        "Keep the product sharp, realistic, and clearly visible. Do not add random objects, fake packaging, extra products, people, hands, or distracting decorations.",
        "If the request is a white background, use a clean pure white e-commerce background with natural shadow only.",
        "If the request is a luxury or lifestyle background, make it photorealistic, tasteful, and suitable for a Saudi e-commerce store without exaggeration.",
        "If Arabic text is requested, use short clear Arabic text, place it away from the product, and keep it readable without covering the item.",
        "Final image must look ready for an ad or product page, with clean composition, balanced lighting, and no visual artifacts.",
        brandHint.trim(),
      ].filter(Boolean).join(" ");
      const model = "google/gemini-3.1-flash-image-preview";

      let editedDataUrl: string;
      try {
        const out = await chatComplete({
          model,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: fullPrompt },
                { type: "image_url", image_url: { url: data.imageDataUrl } },
              ],
            },
          ],
          modalities: ["image", "text"],
        });
        editedDataUrl = out.images[0];
        if (!editedDataUrl) throw new Error("لم يتم توليد صورة معدّلة");
      } catch (e) {
        if (e instanceof AIError) {
          if (e.code === "rate_limited") await releaseImageDailyQuota(supabase, userId);
          throw new Error(e.message);
        }
        throw e;
      }

      const match = editedDataUrl.match(/^data:(image\/[a-z0-9+]+);base64,(.+)$/i);
      if (!match) throw new Error("صيغة الصورة الناتجة غير مدعومة");
      const mime = match[1];
      const ext = mime.split("/")[1].replace("+xml", "");
      const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
      const filename = `${userId}/edited-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("generated-images")
        .upload(filename, bytes, { contentType: mime, upsert: false });
      if (upErr) throw new Error(`فشل حفظ الصورة: ${upErr.message}`);

      const { data: signed, error: signErr } = await supabase.storage
        .from("generated-images")
        .createSignedUrl(filename, 60 * 60 * 24 * 365);
      if (signErr || !signed?.signedUrl) {
        await supabase.storage.from("generated-images").remove([filename]).catch(() => {});
        throw new Error(`فشل إنشاء رابط الصورة: ${signErr?.message ?? "unknown"}`);
      }
      const publicUrl = signed.signedUrl;
      const editCost = estimateImageCost(model);

      const { error: insErr } = await supabase.rpc("record_generation", {
        _type: "image_enhance",
        _prompt: data.prompt,
        _result: publicUrl,
        _template: data.templateId ?? null,
        _model_used: model,
        _estimated_cost_usd: editCost,
        _metadata: {
          template_title: data.templateTitle,
          source: campaignPack ? "campaign_studio_edit_image" : "edit_image",
          storage_path: filename,
          credits_charged: 0,
          billing_scope: "daily_image_quota",
          ...campaignMetadata(campaignPack),
        },
      });
      if (insErr) {
        await supabase.storage.from("generated-images").remove([filename]).catch(() => {});
        throw new Error(`فشل حفظ الصورة: ${insErr.message}`);
      }

      await bumpUsage(supabase, currentMonth(), "image");

      return {
        url: publicUrl,
        creditsCharged: 0,
        remainingDaily: quota.cap - quota.used,
        dailyUsed: quota.used,
        dailyCap: quota.cap,
      };
    } catch (e) {
      throw e;
    }
  });

// ============================================================
// getUserMonthlyCost — تقرير شهري (للأدمن/الفواتير) — لم يتغير
// ============================================================
export const getUserMonthlyCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { month?: string }) => input ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    const month = data.month ?? currentMonth();
    const [year, mon] = month.split("-").map((n) => parseInt(n, 10));
    if (!year || !mon) throw new Error("صيغة الشهر غير صحيحة (YYYY-MM)");
    const startUtc = new Date(Date.UTC(year, mon - 1, 1, -3, 0, 0));
    const endUtc = new Date(Date.UTC(year, mon, 1, -3, 0, 0));

    const { data: rows, error } = await supabase
      .from("generations")
      .select("type, total_tokens, estimated_cost_usd")
      .eq("user_id", userId)
      .gte("created_at", startUtc.toISOString())
      .lt("created_at", endUtc.toISOString());

    if (error) throw new Error(`تعذّر جلب تقرير الكلفة: ${error.message}`);

    const acc = {
      month,
      total_tokens: 0,
      total_cost_usd: 0,
      by_type: {} as Record<string, { count: number; tokens: number; cost: number }>,
    };
    for (const r of rows ?? []) {
      acc.total_tokens += r.total_tokens ?? 0;
      acc.total_cost_usd += Number(r.estimated_cost_usd ?? 0);
      const t = r.type as string;
      acc.by_type[t] ??= { count: 0, tokens: 0, cost: 0 };
      acc.by_type[t].count += 1;
      acc.by_type[t].tokens += r.total_tokens ?? 0;
      acc.by_type[t].cost += Number(r.estimated_cost_usd ?? 0);
    }
    acc.total_cost_usd = Math.round(acc.total_cost_usd * 1_000_000) / 1_000_000;
    return acc;
  });
