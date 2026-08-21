import { createServerFn } from "@tanstack/react-start";
import { createFalClient } from "@fal-ai/client";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  consume,
  getRefundLedgerId,
  grantCompensationCredits,
  operationalSwitchEnabled,
  refund,
  videoCost,
  type VideoQuality,
  type VideoDuration,
  InsufficientCreditsError,
} from "./credits";
import { PLAN_CREDIT_POLICY, isValidVideoTierSelection } from "@/lib/plan-catalog";
import { SAUDI_VIDEO_LAUNCH_TEMPLATE_IDS, SAUDI_VIDEO_MEDIUM_TEST_TEMPLATE_IDS, buildSaudiVideoMediumTestSample, limitFalPrompt, withSaudiPromptAdherence } from "@/lib/saudi-video-test";

const MAX_PROCESSING_MINUTES = 20;
const PROCESSING_LIMIT_PER_USER = 2;
const TERMINAL_PROVIDER_STATUSES = new Set(["succeeded", "failed", "canceled"]);
const INTERNAL_VIDEO_BUCKET = "generated-videos";

const DEFAULT_ESTIMATED_COST_USD: Record<VideoQuality, number> = {
  fast: 0.2,
  lite: 0.25,
  quality: 0.45,
};

function estimatedVideoCostUsd(quality: VideoQuality, durationSeconds: VideoDuration) {
  if (!isValidVideoTierSelection(quality, durationSeconds)) throw new Error("invalid_video_tier_duration");
  return DEFAULT_ESTIMATED_COST_USD[quality];
}

type DbClient = SupabaseClient<Database>;
type VideoJobRow = Database["public"]["Tables"]["video_jobs"]["Row"];
type VideoProviderMode = "api" | "bridge" | "manual";
type ProviderStatus = "succeeded" | "processing" | "failed" | "canceled";

type VideoProviderConfig = {
  provider_key: string;
  display_name_admin: string;
  enabled: boolean;
  public_enabled: boolean;
  supported_qualities: string[];
  priority: number;
  cost_5s: number;
  cost_8s: number;
  supports_9_16: boolean;
  supports_1_1: boolean;
  supports_16_9: boolean;
  supports_starting_frame: boolean;
  mode: VideoProviderMode;
  health_status: string;
  metadata: Record<string, unknown> | null;
};

type ProviderCreateResult = {
  providerJobId: string | null;
  status: ProviderStatus;
  resultUrl: string | null;
  manualRequired?: boolean;
  estimatedCostUsd?: number | null;
  metadata?: Record<string, unknown>;
};

type ProviderRefreshResult = {
  status: ProviderStatus;
  resultUrl: string | null;
  error?: string | null;
  metadata?: Record<string, unknown>;
};

type ProviderAttempt = {
  provider: string;
  ok: boolean;
  status?: ProviderStatus | "skipped";
  mode?: VideoProviderMode;
  priority?: number;
  started_at: string;
  finished_at: string;
  latency_ms: number;
  provider_job_id?: string | null;
  manual_required?: boolean;
  error?: string;
  reason?: string;
};

type VideoInput = z.infer<typeof videoInputSchema> & { watermarkRequired?: boolean; providerImageUrl?: string };

type VideoEntitlement = {
  video_fast_allowed: boolean;
  video_quality_allowed: boolean;
  max_video_duration_seconds: number;
};

type VideoProvider = {
  key: string;
  createJob(input: VideoInput, config: VideoProviderConfig): Promise<ProviderCreateResult>;
  refreshJob(providerJobId: string, row: VideoJobRow): Promise<ProviderRefreshResult>;
};

async function getVideoEntitlement(db: DbClient): Promise<VideoEntitlement> {
  const { data, error } = await db.rpc("plan_entitlement_for_user");
  if (error) throw new Error(`فشل التحقق من صلاحيات الفيديو: ${error.message}`);
  const row = data as VideoEntitlement | null;
  return {
    video_fast_allowed: row?.video_fast_allowed ?? false,
    video_quality_allowed: row?.video_quality_allowed ?? false,
    max_video_duration_seconds: row?.max_video_duration_seconds ?? 5,
  };
}

function assertVideoEntitlement(entitlement: VideoEntitlement, input: z.infer<typeof videoInputSchema>) {
  if (!isValidVideoTierSelection(input.quality, input.durationSeconds)) throw new Error("invalid_video_tier_duration");
  if (!entitlement.video_fast_allowed) throw new Error("video_fast_not_allowed");
  if (input.quality === "quality" && !entitlement.video_quality_allowed) throw new Error("video_quality_not_allowed");
  if (input.durationSeconds > entitlement.max_video_duration_seconds) throw new Error("video_duration_not_allowed");
}

function mediumTestSampleFromInput(input: Pick<z.infer<typeof videoInputSchema>, "source" | "mediumTestSampleId">) {
  if (input.source !== "medium-test" || !input.mediumTestSampleId) return null;
  const sampleNumber = Number(input.mediumTestSampleId.replace("pilot-", ""));
  if (!Number.isInteger(sampleNumber) || sampleNumber < 1 || sampleNumber > SAUDI_VIDEO_MEDIUM_TEST_TEMPLATE_IDS.length) return null;
  return buildSaudiVideoMediumTestSample(sampleNumber - 1);
}

function assertProductImagePolicy(plan: string | null | undefined, input: z.infer<typeof videoInputSchema>) {
  if (input.source === "medium-test") {
    const sample = mediumTestSampleFromInput(input);
    if (sample?.requiresProductImage && !input.productImageUrl) throw new Error("product_image_required_for_medium_test_video");
    return;
  }
  if (PLAN_CREDIT_POLICY.paidPlansRequireProductImageForVideo && plan && plan !== "free" && !input.productImageUrl) {
    throw new Error("product_image_required_for_paid_video");
  }
}

function assertLaunchTemplatePolicy(templateId?: string, source?: "medium-test", mediumTestTemplateId?: string, mediumTestSampleId?: string, quality?: VideoQuality, durationSeconds?: VideoDuration, aspectRatio?: string, selectedPersonaId?: string, prompt?: string, startingFrameUrl?: string) {
  if (source === "medium-test") {
    if (templateId !== "custom") throw new Error("invalid_medium_test_template");
    if (!mediumTestTemplateId || !mediumTestSampleId) throw new Error("invalid_medium_test_template");
    const sampleIndex = SAUDI_VIDEO_MEDIUM_TEST_TEMPLATE_IDS.findIndex((id) => id === mediumTestTemplateId);
    const expectedSampleId = sampleIndex >= 0 ? `pilot-${String(sampleIndex + 1).padStart(2, "0")}` : null;
    if (!expectedSampleId || mediumTestSampleId !== expectedSampleId) throw new Error("invalid_medium_test_template");
    const expectedSample = buildSaudiVideoMediumTestSample(sampleIndex);
    if (quality !== expectedSample.quality || durationSeconds !== expectedSample.durationSeconds || aspectRatio !== expectedSample.expectedAspectRatio || selectedPersonaId !== expectedSample.personaId) {
      throw new Error("invalid_medium_test_template");
    }
    if (prompt?.trim() !== expectedSample.finalPrompt.trim()) {
      throw new Error("invalid_medium_test_prompt");
    }
    if (startingFrameUrl) {
      throw new Error("invalid_medium_test_reference_image");
    }
    return "custom";
  }
  if (!templateId) return "custom";
  if ((SAUDI_VIDEO_LAUNCH_TEMPLATE_IDS as readonly string[]).includes(templateId)) return templateId;
  throw new Error("video_template_not_publicly_approved");
}

class ProviderCommittedFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderCommittedFailure";
  }
}

const videoInputSchema = z.object({
  prompt: z.string().trim().min(10, "اكتب وصف فيديو أوضح").max(1800, "وصف الفيديو طويل جداً"),
  quality: z.enum(["fast", "lite", "quality"]),
  aspectRatio: z.enum(["9:16", "1:1", "16:9"]).default("9:16"),
  durationSeconds: z.union([z.literal(5), z.literal(8)]).default(5),
  startingFrameUrl: z.string().url().optional().or(z.literal("")),
  speakerImageUrl: z.string().url().optional().or(z.literal("")),
  productImageUrl: z.string().url().optional().or(z.literal("")),
  selectedPersonaId: z.string().trim().max(80).optional().or(z.literal("")),
  selectedTemplateId: z.string().trim().max(100).optional().or(z.literal("")),
  campaignId: z.string().uuid().optional(),
  campaignPackId: z.string().uuid().optional(),
  source: z.enum(["medium-test"]).optional(),
  mediumTestSampleId: z.string().trim().max(40).optional().or(z.literal("")),
  mediumTestTemplateId: z.string().trim().max(100).optional().or(z.literal("")),
});

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

function campaignMetadata(pack: Awaited<ReturnType<typeof assertCampaignPackOwner>>) {
  return pack
    ? { source: "campaign_studio", campaignId: pack.id, campaignPackId: pack.id, campaign_pack_id: pack.id, campaign_product: pack.product, campaign_goal: pack.goal, campaign_channel: pack.channel }
    : { source: "dashboard_generate_video" };
}

function videoCreditError(e: unknown): Error {
  if (e instanceof InsufficientCreditsError) {
    return new Error(`INSUFFICIENT_CREDITS: رصيد نقاط الفيديو لا يكفي (تحتاج ${e.required} نقطة فيديو). اشحن نقاط فيديو إضافية أو رقّ باقتك.`);
  }
  return e instanceof Error ? e : new Error(String(e));
}

function publicVideoError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (/file_download_error|Failed to download the file|image_url|provider_image_unreachable|provider_image_preflight|provider_image_invalid_type|provider_image_too_large|provider_image_not_cdn/i.test(msg)) {
    return new Error("تعذر تجهيز صورة المنتج للفيديو. ارفع الصورة من جديد أو استخدم رابط صورة مباشر بصيغة JPEG/PNG/WebP ثم أعد المحاولة.");
  }
  if (/video_fast_not_allowed/i.test(msg)) return new Error("VIDEO_NOT_ALLOWED: الفيديو غير متاح في باقتك الحالية. رقّ الباقة أو اشحن نقاطاً بعد التفعيل.");
  if (/video_quality_not_allowed/i.test(msg)) return new Error("VIDEO_QUALITY_NOT_ALLOWED: الجودة الاحترافية متاحة في باقات Pro وBusiness.");
  if (/video_duration_not_allowed/i.test(msg)) return new Error("VIDEO_DURATION_NOT_ALLOWED: مدة 8 ثوانٍ غير متاحة في باقتك الحالية.");
  if (/product_image_required_for_medium_test_video/i.test(msg)) return new Error("PRODUCT_IMAGE_REQUIRED: صورة المنتج إلزامية لهذه العينة الداخلية حتى يكون اختبار الالتزام عادلاً وقابلاً للاعتماد.");
  if (/product_image_required_for_paid_video/i.test(msg)) return new Error("PRODUCT_IMAGE_REQUIRED: صورة المنتج مطلوبة في الباقات المدفوعة حتى يظهر المنتج بوضوح داخل الإعلان.");
  if (/video_template_not_publicly_approved/i.test(msg)) return new Error("VIDEO_TEMPLATE_LOCKED: هذا القالب ما زال احتياطياً ولن يُفتح قبل اكتمال بيانات الاستخدام الفعلية.");
  if (/invalid_medium_test_prompt/i.test(msg)) return new Error("VIDEO_TEMPLATE_LOCKED: برومبت الاختبار الداخلي غير مطابق للمصفوفة المعتمدة.");
  if (/invalid_medium_test_reference_image/i.test(msg)) return new Error("VIDEO_TEMPLATE_LOCKED: صورة البداية غير مسموحة في الاختبار الداخلي حتى لا تغيّر العينة المعتمدة.");
  if (/invalid_medium_test_template/i.test(msg)) return new Error("VIDEO_TEMPLATE_LOCKED: معرف قالب الاختبار الداخلي غير مطابق للمصفوفة المعتمدة.");
  if (/medium_test_sample_already_processing/i.test(msg)) return new Error("هذه العينة قيد المعالجة بالفعل. انتظر اكتمالها أو حدّث الحالة قبل إعادة التشغيل.");
  if (/medium_test_sequence_violation/i.test(msg)) return new Error("VIDEO_TEMPLATE_LOCKED: لا يمكن تشغيل هذه العينة قبل إنشاء العينات السابقة من الرابط الرسمي وبلا عائق تشغيلي؛ التقييم التجاري يأتي بعد اكتمال الدفعة.");
  if (/invalid_video_tier_duration/i.test(msg)) return new Error("VIDEO_DURATION_NOT_ALLOWED: اختر سريع 5 ثوانٍ أو إعلاني/احترافي 8 ثوانٍ فقط.");
  if (/INSUFFICIENT_CREDITS|insufficient_credits/i.test(msg)) return videoCreditError(e);
  if (/too_many_processing_video_jobs/i.test(msg)) return new Error("لديك مهمتا فيديو قيد المعالجة حالياً. انتظر اكتمال إحداهما قبل إنشاء فيديو جديد.");
  if (/no_video_provider_available|إعداد مزوّد الفيديو غير مكتمل/i.test(msg)) return new Error("خدمة الفيديو غير جاهزة حالياً. جرّب لاحقاً أو تواصل مع الدعم.");
  if (/فشل مزوّد الفيديو|provider|prediction|fetch failed/i.test(msg)) return new Error("تعذر الاتصال بخدمة الفيديو حالياً. تم حفظ الحالة ورد النقاط عند الحاجة.");
  return e instanceof Error ? e : new Error("فشل تنفيذ عملية الفيديو");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
}

/**
 * يصنّف الأخطاء لتمييز أعطال المزوّد (يستحق تعويض) عن أخطاء المستخدم/المحتوى.
 * - provider_error: عطل تقني من المزوّد (5xx، fetch failed، prediction error) → يستحق تعويض
 * - timeout: تأخر تجاوز الحد الزمني → يستحق تعويض
 * - content_error: المحتوى مرفوض من المزوّد (سياسة، nsfw) → لا تعويض
 * - user_error: مدخلات خاطئة (صورة غير صالحة، quota) → لا تعويض
 * - unknown: غير مصنّف افتراضياً
 */
export type VideoErrorCategory = "provider_error" | "user_error" | "content_error" | "timeout" | "unknown";

export function categorizeVideoError(error: unknown): VideoErrorCategory {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (/timeout|timed.?out|تأخر/i.test(msg)) return "timeout";
  if (/content.?policy|nsfw|safety|moderation|rejected.?content|سياسة المحتوى/i.test(msg)) return "content_error";
  if (/provider_image_|invalid_video_tier|insufficient_credits|quota|not_allowed|too_many_processing|product_image_required|template_locked|sequence_violation|invalid_medium_test/i.test(msg)) return "user_error";
  if (/provider|prediction|fetch failed|5\d\d|network|fal_|replicate|gateway|service unavailable/i.test(msg)) return "provider_error";
  return "unknown";
}


function personaPrompt(personaId?: string) {
  return ({
    "male-young": "متحدث سعودي شاب بثوب أبيض وشماغ أبيض، أسلوب UGC طبيعي وموثوق.",
    "male-premium": "رجل سعودي أنيق بثوب رسمي وشماغ أحمر، أسلوب إعلان فاخر وواثق.",
    "female-abaya": "متحدثة سعودية بعباءة وحجاب، أسلوب راقٍ ومحتشم مناسب للتجارة الإلكترونية.",
    "retail-seller": "بائع سعودي داخل متجر حديث، أسلوب توصية منتج مباشر ودافئ.",
  } as Record<string, string>)[personaId ?? ""] ?? "";
}

function buildSaudiVideoPrompt(input: VideoInput) {
  if (input.source === "medium-test" && input.mediumTestTemplateId === "bags") {
    return limitFalPrompt([
      "Vertical 9:16 Saudi ecommerce product video for a modest accessories boutique.",
      "Use the supplied handbag product image as the exact product reference. Keep the handbag clear, realistic, central, and visible from the first two seconds.",
      "Scene: premium boutique table with warm retail lighting. A modest Saudi/Gulf presenter shows the handbag briefly, then places it neatly on the table.",
      "Motion: slow cinematic push-in and subtle product orbit, natural hands, realistic fabric/leather texture, clean commercial style.",
      "No readable text, no logos, no exaggerated claims, no distorted faces or hands. Audio is not required.",
    ].join("\n"));
  }
  const persona = personaPrompt(input.selectedPersonaId);
  const imageBrief = [
    input.speakerImageUrl ? "استخدم صورة الشخص كمرجع للشخصية المتحدثة." : persona,
    input.productImageUrl ? "اجعل صورة المنتج مرجعاً واضحاً للمنتج داخل الإعلان." : "",
  ].filter(Boolean).join(" ");
  const prompt = [
    "إعلان فيديو سعودي قصير عالي التحويل للسوق السعودي. صوت عربي سعودي واضح وطبيعي إذا كان الصوت مدعوماً. بنية الإعلان: خطاف قوي، فائدة ملموسة، لقطة منتج جذابة، دعوة إجراء مباشرة. حافظ على مظهر محتشم وواقعي وابتعد عن المبالغة غير الموثوقة.",
    imageBrief,
    input.prompt,
    input.watermarkRequired ? "أضف علامة مائية صغيرة ونظيفة بحروف لاتينية فقط: RIFD في الزاوية السفلية، بدون أي نص عربي داخل الفيديو." : "",
  ].filter(Boolean).join("\n\n");
  return limitFalPrompt(withSaudiPromptAdherence(prompt));
}

function sourceReferenceImage(input: VideoInput) {
  return input.productImageUrl || input.speakerImageUrl || input.startingFrameUrl || undefined;
}

function assertProviderImageCdn(url?: string) {
  if (!url) return;
  if (!/^https:\/\/(?:v[\da-z]+\.)?fal\.media\//i.test(url)) throw new Error("provider_image_not_cdn");
}

async function providerReachableImageUrl(url?: string) {
  if (!url) return undefined;
  const token = process.env.FAL_API_KEY;
  if (!token) throw new Error("إعداد مزوّد الفيديو غير مكتمل");
  try {
    if (/^https:\/\/(?:v[\da-z]+\.)?fal\.media\//i.test(url)) return url;
    const response = url.startsWith("data:") ? await fetch(url) : await fetch(url, { headers: { "User-Agent": "Rifd-Video-Preflight/1.0" } });
    if (!response.ok) throw new Error(`provider_image_preflight_${response.status}`);
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) throw new Error(`provider_image_invalid_type:${contentType}`);
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > 8 * 1024 * 1024) throw new Error("provider_image_too_large");
    const fal = createFalClient({ credentials: token });
    return await fal.storage.upload(new Blob([arrayBuffer], { type: contentType }), { lifecycle: { expiresIn: "7d" } });
  } catch (error) {
    throw new Error(`provider_image_unreachable:${errorMessage(error)}`);
  }
}

function mergeMetadata(current: Json | null | undefined, patch?: Record<string, unknown>) {
  return { ...((current as Record<string, unknown> | null) ?? {}), ...(patch ?? {}) } as Json;
}

function archivedVideoPath(userId: string, jobId: string) {
  return `${userId}/videos/${jobId}.mp4`;
}

async function archiveProviderVideo(params: { userId: string; jobId: string; resultUrl: string }) {
  if (!/^https?:\/\//i.test(params.resultUrl)) return { resultUrl: params.resultUrl, storagePath: null as string | null, archived: false, error: "invalid_provider_url" };
  try {
    const response = await fetch(params.resultUrl);
    if (!response.ok) throw new Error(`provider_download_${response.status}`);
    const contentType = response.headers.get("content-type") || "video/mp4";
    if (!contentType.startsWith("video/")) throw new Error(`invalid_content_type:${contentType}`);
    const arrayBuffer = await response.arrayBuffer();
    const path = archivedVideoPath(params.userId, params.jobId);
    const { error: uploadError } = await supabaseAdmin.storage.from(INTERNAL_VIDEO_BUCKET).upload(path, arrayBuffer, { contentType, upsert: true });
    if (uploadError) throw new Error(uploadError.message);
    const { data, error: signedError } = await supabaseAdmin.storage.from(INTERNAL_VIDEO_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signedError || !data?.signedUrl) throw new Error(signedError?.message ?? "signed_url_failed");
    return { resultUrl: data.signedUrl, storagePath: path, archived: true, error: null as string | null };
  } catch (error) {
    return { resultUrl: params.resultUrl, storagePath: null as string | null, archived: false, error: errorMessage(error) };
  }
}

async function signedVideoUrlFromPath(path: string | null) {
  if (!path) return null;
  const { data, error } = await supabaseAdmin.storage.from(INTERNAL_VIDEO_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

async function countProcessingJobs(userId: string) {
  const { count, error } = await supabaseAdmin
    .from("video_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "processing");
  if (error) throw new Error(`فشل التحقق من المهام النشطة: ${error.message}`);
  return count ?? 0;
}

async function assertNoActiveMediumTestSampleJob(userId: string, input: z.infer<typeof videoInputSchema>) {
  if (input.source !== "medium-test" || !input.mediumTestSampleId || !input.mediumTestTemplateId) return;
  const { count, error } = await supabaseAdmin
    .from("video_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["pending", "processing"])
    .contains("metadata", { medium_test: true, medium_test_sample_id: input.mediumTestSampleId, medium_test_template_id: input.mediumTestTemplateId });
  if (error) throw new Error(`فشل التحقق من حالة عينة الاختبار: ${error.message}`);
  if ((count ?? 0) > 0) throw new Error("medium_test_sample_already_processing");
}

async function assertMediumTestSequenceReady(userId: string, input: z.infer<typeof videoInputSchema>) {
  if (input.source !== "medium-test" || !input.mediumTestSampleId) return;
  const currentNumber = Number(input.mediumTestSampleId.replace("pilot-", ""));
  if (!Number.isInteger(currentNumber) || currentNumber <= 1) return;
  const { data, error } = await supabaseAdmin
    .from("video_jobs")
    .select("id, status, result_url, product_image_url, metadata, created_at, quality, duration_seconds, aspect_ratio, selected_persona_id")
    .eq("user_id", userId)
    .contains("metadata", { medium_test: true });
  if (error) throw new Error(`فشل التحقق من تسلسل الاختبار المتوسط: ${error.message}`);

  const latestOfficial = new Map<string, Pick<VideoJobRow, "status" | "result_url" | "product_image_url" | "metadata" | "created_at" | "quality" | "duration_seconds" | "aspect_ratio" | "selected_persona_id">>();
  const latestMismatch = new Map<string, Pick<VideoJobRow, "created_at">>();
  for (const row of (data as VideoJobRow[] | null) ?? []) {
    const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
    const sampleId = typeof metadata.medium_test_sample_id === "string" ? metadata.medium_test_sample_id : "";
    const templateId = typeof metadata.medium_test_template_id === "string" ? metadata.medium_test_template_id : "";
    const sampleNumber = Number(sampleId.replace("pilot-", ""));
    const expectedTemplateId = Number.isInteger(sampleNumber) ? SAUDI_VIDEO_MEDIUM_TEST_TEMPLATE_IDS[sampleNumber - 1] : undefined;
    if (!sampleId || !expectedTemplateId || sampleNumber >= currentNumber) continue;
    const currentMap = templateId === expectedTemplateId ? latestOfficial : latestMismatch;
    const current = currentMap.get(sampleId);
    if (!current || new Date(row.created_at).getTime() > new Date(current.created_at).getTime()) currentMap.set(sampleId, row);
  }

  for (let index = 0; index < currentNumber - 1; index += 1) {
    const sample = buildSaudiVideoMediumTestSample(index);
    const job = latestOfficial.get(sample.sampleId) ?? null;
    const mismatch = latestMismatch.get(sample.sampleId) ?? null;
    if (!job || (mismatch && new Date(mismatch.created_at).getTime() > new Date(job.created_at).getTime())) throw new Error("medium_test_sequence_violation");
    const metadata = (job.metadata as Record<string, unknown> | null) ?? {};
    const configurationMismatch = job.quality !== sample.quality || job.duration_seconds !== sample.durationSeconds || job.aspect_ratio !== sample.expectedAspectRatio || job.selected_persona_id !== sample.personaId;
    const missingRequiredProduct = sample.requiresProductImage && !job.product_image_url;
    if (["failed", "refunded", "cancelled"].includes(job.status) || configurationMismatch || missingRequiredProduct) throw new Error("medium_test_sequence_violation");
  }
}

function providerSupports(config: VideoProviderConfig, input: z.infer<typeof videoInputSchema>) {
  const supportsQuality = config.supported_qualities.includes(input.quality);
  const supportsAspect =
    (input.aspectRatio === "9:16" && config.supports_9_16) ||
    (input.aspectRatio === "1:1" && config.supports_1_1) ||
    (input.aspectRatio === "16:9" && config.supports_16_9);
  const needsReferenceImage = Boolean(input.startingFrameUrl || input.speakerImageUrl || input.productImageUrl);
  const needsTwoImages = Boolean(input.speakerImageUrl && input.productImageUrl);
  const canCollapseToPrimaryImage = config.provider_key === "fal_ai" && config.metadata?.model_family === "pixverse_v6";
  const supportsTwoImages = !needsTwoImages || canCollapseToPrimaryImage || ((config.metadata?.supports_two_images as boolean | undefined) === true);
  const supportsFrame = !needsReferenceImage || config.supports_starting_frame;
  const cost = input.durationSeconds === 8 ? config.cost_8s : config.cost_5s;
  return config.enabled && config.public_enabled && supportsQuality && supportsAspect && supportsFrame && supportsTwoImages && cost > 0;
}

function providerPriorityScore(config: VideoProviderConfig) {
  const healthPenalty = config.health_status === "unhealthy" ? 10_000 : config.health_status === "inactive" ? 20_000 : 0;
  return config.priority + healthPenalty;
}

async function loadProviderConfigs(input: z.infer<typeof videoInputSchema>) {
  const { data, error } = await (supabaseAdmin as unknown as {
    from: (table: string) => {
      select: (columns: string) => { eq: (column: string, value: unknown) => { order: (column: string, opts: { ascending: boolean }) => Promise<{ data: unknown; error: { message: string } | null }> } };
    };
  })
    .from("video_provider_configs")
    .select("provider_key, display_name_admin, enabled, public_enabled, supported_qualities, priority, cost_5s, cost_8s, supports_9_16, supports_1_1, supports_16_9, supports_starting_frame, mode, health_status, metadata")
    .eq("enabled", true)
    .order("priority", { ascending: true });

  if (error) {
    console.error(`video_provider_configs read failed: ${error.message}`);
    return [];
  }

  const rows = ((data as VideoProviderConfig[] | null) ?? [])
    .filter((config) => providerSupports(config, input))
    .sort((a, b) => providerPriorityScore(a) - providerPriorityScore(b));
  return rows;
}

async function markProviderFailure(providerKey: string, error: unknown) {
  await (supabaseAdmin as unknown as { from: (table: string) => { update: (values: Record<string, unknown>) => { eq: (column: string, value: string) => Promise<{ error: { message: string } | null }> } } })
    .from("video_provider_configs")
    .update({
      health_status: "unhealthy",
      last_error_at: new Date().toISOString(),
      last_error_message: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
    })
    .eq("provider_key", providerKey);
}

function videoDurationPayload(durationSeconds: VideoDuration) {
  return durationSeconds;
}

async function markProviderSuccess(providerKey: string) {
  await (supabaseAdmin as unknown as { from: (table: string) => { update: (values: Record<string, unknown>) => { eq: (column: string, value: string) => Promise<{ error: { message: string } | null }> } } })
    .from("video_provider_configs")
    .update({ health_status: "active", last_success_at: new Date().toISOString(), last_error_message: null })
    .eq("provider_key", providerKey);
}

const FAL_MODEL_BY_QUALITY: Record<VideoQuality, string> = {
  fast: "fal-ai/pixverse/v6/image-to-video",
  lite: "fal-ai/pixverse/v6/image-to-video",
  quality: "fal-ai/pixverse/v6/image-to-video",
};

const FAL_TEXT_TO_VIDEO_MODEL = "fal-ai/pixverse/v6/text-to-video";

const PIXVERSE_RESOLUTION_BY_QUALITY: Record<VideoQuality, string> = {
  fast: "360p",
  lite: "540p",
  quality: "720p",
};

const PIXVERSE_NEGATIVE_PROMPT = "distorted face, deformed hands, extra fingers, unreadable Arabic text, misspelled text, western clothing, immodest styling, unrealistic product, duplicated product, plain white cutout background, shaky low quality footage, exaggerated claims";

function extractFalVideoUrl(result: { video?: { url?: string }; video_url?: string; url?: string }) {
  return result.video?.url ?? result.video_url ?? result.url ?? null;
}

function normalizeFalStatus(status?: string): ProviderStatus {
  const value = (status ?? "").toUpperCase();
  if (value === "COMPLETED" || value === "SUCCEEDED" || value === "SUCCESS") return "succeeded";
  if (value === "FAILED" || value === "ERROR") return "failed";
  if (value === "CANCELED" || value === "CANCELLED") return "canceled";
  return "processing";
}

function falQueueRequestUrl(model: string, providerJobId: string, endpoint?: "status") {
  const baseModel = model.startsWith("fal-ai/pixverse/") ? "fal-ai/pixverse" : model;
  return `https://queue.fal.run/${baseModel}/requests/${providerJobId}${endpoint ? `/${endpoint}` : ""}`;
}

const falProvider: VideoProvider = {
  key: "fal_ai",
  async createJob(input) {
    const token = process.env.FAL_API_KEY;
    if (!token) throw new Error("إعداد مزوّد الفيديو غير مكتمل");
      const finalProviderPrompt = buildSaudiVideoPrompt(input);
      const providerImageUrl = input.providerImageUrl;
      const model = providerImageUrl ? FAL_MODEL_BY_QUALITY[input.quality] : FAL_TEXT_TO_VIDEO_MODEL;
      assertProviderImageCdn(providerImageUrl);
      const response = await fetch(`https://queue.fal.run/${model}`, {
      method: "POST",
      headers: { Authorization: `Key ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
          prompt: finalProviderPrompt,
        aspect_ratio: input.aspectRatio,
        duration: videoDurationPayload(input.durationSeconds),
        resolution: PIXVERSE_RESOLUTION_BY_QUALITY[input.quality],
        image_url: providerImageUrl,
        negative_prompt: PIXVERSE_NEGATIVE_PROMPT,
        generate_audio_switch: false,
        generate_multi_clip_switch: input.quality !== "fast",
        thinking_type: input.quality === "fast" ? "auto" : "enabled",
      }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`فشل مزوّد الفيديو (${response.status}): ${text.slice(0, 300)}`);
    }
    const result = await response.json() as { request_id?: string; response_url?: string; status_url?: string; video?: { url?: string }; video_url?: string; url?: string; status?: string; error?: string };
    if (result.error) throw new Error(`فشل مزوّد الفيديو: ${result.error}`);
    const resultUrl = extractFalVideoUrl(result);
    const status = resultUrl ? "succeeded" : normalizeFalStatus(result.status);
      return { providerJobId: result.request_id ?? null, status, resultUrl, estimatedCostUsd: estimatedVideoCostUsd(input.quality, input.durationSeconds), metadata: { model, resolution: PIXVERSE_RESOLUTION_BY_QUALITY[input.quality], audio_requested: false, audio_policy: "provider_audio_disabled_until_saudi_voice_pipeline", final_provider_prompt: finalProviderPrompt, prompt_adherence_required: true, provider_image_url: providerImageUrl ?? null, provider_image_source: providerImageUrl ? "provider_preflight" : "none", fal_status_url: result.status_url ?? null, fal_response_url: result.response_url ?? null, fal_result_shape: Object.keys(result) } };
  },
  async refreshJob(providerJobId, row) {
    if (row.result_url) return { status: "succeeded", resultUrl: row.result_url };
    const token = process.env.FAL_API_KEY;
    if (!token) throw new Error("إعداد مزوّد الفيديو غير مكتمل");
    const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
    const model = typeof metadata.model === "string" ? metadata.model : FAL_MODEL_BY_QUALITY[row.quality as VideoQuality];
    const statusUrl = typeof metadata.fal_status_url === "string" ? metadata.fal_status_url : falQueueRequestUrl(model, providerJobId, "status");
    const responseUrl = typeof metadata.fal_response_url === "string" ? metadata.fal_response_url : falQueueRequestUrl(model, providerJobId);
    const statusResponse = await fetch(statusUrl, { headers: { Authorization: `Key ${token}` } });
    const statusText = await statusResponse.text();
    let statusPayload: { status?: string; error?: string; logs?: unknown } = {};
    try { statusPayload = statusText ? JSON.parse(statusText) as typeof statusPayload : {}; } catch { statusPayload = { error: statusText.slice(0, 300) }; }
    if (!statusResponse.ok || statusPayload.error) throw new Error(`فشل تحديث مزوّد الفيديو (${statusResponse.status}): ${statusPayload.error ?? statusText.slice(0, 300)}`);
    const providerStatus = normalizeFalStatus(statusPayload.status);
    if (providerStatus !== "succeeded") return { status: providerStatus, resultUrl: null, error: statusPayload.error ?? null, metadata: { fal_queue_status: statusPayload.status ?? "unknown" } };

    const resultResponse = await fetch(responseUrl, { headers: { Authorization: `Key ${token}` } });
    const resultText = await resultResponse.text();
    let resultPayload: { video?: { url?: string }; video_url?: string; url?: string; error?: string } = {};
    try { resultPayload = resultText ? JSON.parse(resultText) as typeof resultPayload : {}; } catch { resultPayload = { error: resultText.slice(0, 300) }; }
    if (!resultResponse.ok || resultPayload.error) {
      return { status: "failed", resultUrl: null, error: `فشل جلب نتيجة مزوّد الفيديو (${resultResponse.status}): ${resultPayload.error ?? resultText.slice(0, 300)}`, metadata: { fal_queue_status: statusPayload.status ?? "COMPLETED" } };
    }
    const resultUrl = extractFalVideoUrl(resultPayload);
    return { status: resultUrl ? "succeeded" : "failed", resultUrl, error: resultUrl ? null : "اكتمل طلب المزود دون رابط فيديو", metadata: { fal_queue_status: statusPayload.status ?? "COMPLETED" } };
  },
};

function futureApiProvider(key: string, secretName: string): VideoProvider {
  return {
    key,
    async createJob() {
      if (!process.env[secretName]) throw new Error(`إعداد مزوّد الفيديو غير مكتمل: ${secretName}`);
      throw new Error(`provider_not_implemented:${key}`);
    },
    async refreshJob() {
      if (!process.env[secretName]) throw new Error(`إعداد مزوّد الفيديو غير مكتمل: ${secretName}`);
      throw new Error(`provider_refresh_not_implemented:${key}`);
    },
  };
}

const PROVIDERS: Record<string, VideoProvider> = {
  fal_ai: falProvider,
  runway: futureApiProvider("runway", "RUNWAY_API_KEY"),
  luma: futureApiProvider("luma", "LUMA_API_KEY"),
  kling: futureApiProvider("kling", "KLING_API_KEY"),
};

async function createProviderJob(input: VideoInput, jobId: string, preflightConfigs?: VideoProviderConfig[]) {
  const configs = preflightConfigs ?? await loadProviderConfigs(input);
  const attempts: ProviderAttempt[] = [];

  for (const config of configs) {
    const startedAt = new Date();
    const provider = PROVIDERS[config.provider_key];
    if (!provider) {
      attempts.push({
        provider: config.provider_key,
        ok: false,
        status: "skipped",
        mode: config.mode,
        priority: config.priority,
        started_at: startedAt.toISOString(),
        finished_at: new Date().toISOString(),
        latency_ms: 0,
        reason: "provider_not_implemented",
      });
      continue;
    }

    try {
      const result = await provider.createJob(input, config);
      if (result.status === "failed" || result.status === "canceled") {
        const message = "فشل مزوّد الفيديو أثناء إنشاء المهمة";
        throw result.providerJobId ? new ProviderCommittedFailure(message) : new Error(message);
      }
      if (result.status === "succeeded" && !result.resultUrl) {
        const message = "فشل مزوّد الفيديو: لم يتم إرجاع رابط الفيديو النهائي";
        throw result.providerJobId ? new ProviderCommittedFailure(message) : new Error(message);
      }
      await markProviderSuccess(config.provider_key);
      const finishedAt = new Date();
      return {
        config,
        result,
        attempts: [
          ...attempts,
          {
            provider: config.provider_key,
            ok: true,
            status: result.status,
            mode: config.mode,
            priority: config.priority,
            started_at: startedAt.toISOString(),
            finished_at: finishedAt.toISOString(),
            latency_ms: finishedAt.getTime() - startedAt.getTime(),
            provider_job_id: result.providerJobId,
            manual_required: result.manualRequired === true,
          },
        ],
      };
    } catch (error) {
      const finishedAt = new Date();
      const committed = error instanceof ProviderCommittedFailure;
      attempts.push({
        provider: config.provider_key,
        ok: false,
        status: "failed",
        mode: config.mode,
        priority: config.priority,
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        latency_ms: finishedAt.getTime() - startedAt.getTime(),
        error: errorMessage(error),
        reason: committed ? "provider_job_committed" : "pre_submit_or_create_failed",
      });
      await markProviderFailure(config.provider_key, error);
      const { data: current } = await supabaseAdmin.from("video_jobs").select("metadata").eq("id", jobId).maybeSingle();
      await supabaseAdmin.from("video_jobs").update({ metadata: mergeMetadata(current?.metadata, { provider_attempts: attempts, last_attempt_at: finishedAt.toISOString(), failover_halted: committed }) }).eq("id", jobId);
      if (committed) throw error;
    }
  }

  throw new Error("no_video_provider_available");
}

async function markProcessingJobRefunded(params: { jobId: string; refundLedgerId: string | null; errorMessage: string; errorCategory?: VideoErrorCategory; metadata?: Record<string, unknown> }) {
  const { data: currentMetadataRow } = await supabaseAdmin.from("video_jobs").select("metadata").eq("id", params.jobId).maybeSingle();
  const updatePayload: Database["public"]["Tables"]["video_jobs"]["Update"] = {
    status: "refunded",
    error_message: params.errorMessage,
    ...(params.refundLedgerId ? { refund_ledger_id: params.refundLedgerId } : {}),
    ...(params.errorCategory ? { error_category: params.errorCategory } : {}),
    metadata: mergeMetadata(currentMetadataRow?.metadata, { ...(params.metadata ?? {}), error_category: params.errorCategory ?? "unknown" }),
  };

  const { data, error } = await supabaseAdmin.from("video_jobs").update(updatePayload).eq("id", params.jobId).eq("status", "processing").select("*").maybeSingle();
  if (error) throw new Error(`فشل تحديث مهمة الفيديو: ${error.message}`);
  if (data) return data as VideoJobRow;

  const { data: current, error: readError } = await supabaseAdmin.from("video_jobs").select("*").eq("id", params.jobId).single();
  if (readError || !current) throw new Error(`فشل جلب مهمة الفيديو بعد الاسترداد: ${readError?.message ?? "غير موجودة"}`);
  return current as VideoJobRow;
}

/**
 * يمنح المستخدم 50 نقطة تعويض عند فشل التوليد بسبب عطل من المزوّد.
 * Idempotent عبر referenceId (job_id) — لا يكرّر التعويض على نفس المهمة.
 */
const PROVIDER_FAILURE_COMPENSATION_CREDITS = 50;
async function compensateUserForProviderFailure(params: { userId: string; jobId: string; category: VideoErrorCategory }) {
  if (params.category !== "provider_error" && params.category !== "timeout") return null;
  return await grantCompensationCredits(supabaseAdmin, {
    userId: params.userId,
    amount: PROVIDER_FAILURE_COMPENSATION_CREDITS,
    reason: `provider_failure_${params.category}`,
    referenceId: params.jobId,
    referenceType: "video_job",
  });
}

async function markProcessingJobCompleted(params: { jobId: string; userId: string; resultUrl: string; metadata?: Record<string, unknown> }) {
  const { data: currentMetadataRow } = await supabaseAdmin.from("video_jobs").select("metadata").eq("id", params.jobId).maybeSingle();
  const archive = await archiveProviderVideo({ userId: params.userId, jobId: params.jobId, resultUrl: params.resultUrl });
  const { data, error } = await supabaseAdmin
    .from("video_jobs")
    .update({ status: "completed", result_url: archive.resultUrl, storage_path: archive.storagePath, completed_at: new Date().toISOString(), metadata: mergeMetadata(currentMetadataRow?.metadata, { ...params.metadata, provider_result_url: params.resultUrl, internal_video_archived: archive.archived, internal_video_archive_error: archive.error }) })
    .eq("id", params.jobId)
    .eq("status", "processing")
    .select("*")
    .maybeSingle();

  if (error) throw new Error(`فشل تحديث مهمة الفيديو: ${error.message}`);
  if (data) return data as VideoJobRow;

  const { data: current, error: readError } = await supabaseAdmin.from("video_jobs").select("*").eq("id", params.jobId).single();
  if (readError || !current) throw new Error(`فشل جلب مهمة الفيديو بعد الإكمال: ${readError?.message ?? "غير موجودة"}`);
  return current as VideoJobRow;
}

export const generateVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => videoInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    const cost = videoCost(data.quality, data.durationSeconds);
    let ledgerId: string | null = null;
    let jobId: string | null = null;

    try {
      if (!(await operationalSwitchEnabled(supabase, "video_enabled"))) throw new Error("video_fast_not_allowed");
      if (data.quality === "quality" && !(await operationalSwitchEnabled(supabase, "video_quality_enabled"))) throw new Error("video_quality_not_allowed");
      const entitlement = await getVideoEntitlement(supabase);
      assertVideoEntitlement(entitlement, data);
      const { data: profile } = await supabase.from("profiles").select("plan").eq("id", userId).maybeSingle();
      assertProductImagePolicy(profile?.plan, data);
      const processingCount = await countProcessingJobs(userId);
      if (processingCount >= PROCESSING_LIMIT_PER_USER) throw new Error("too_many_processing_video_jobs");
      const campaignPack = await assertCampaignPackOwner(supabase, userId, data.campaignId, data.campaignPackId);
      const baseMetadata = campaignMetadata(campaignPack);
      const selectedTemplateId = assertLaunchTemplatePolicy(data.selectedTemplateId, data.source, data.mediumTestTemplateId, data.mediumTestSampleId, data.quality, data.durationSeconds, data.aspectRatio, data.selectedPersonaId, data.prompt, data.startingFrameUrl);
      await assertNoActiveMediumTestSampleJob(userId, data);
      await assertMediumTestSequenceReady(userId, data);
      const providerConfigs = await loadProviderConfigs(data);
      if (providerConfigs.length === 0) throw new Error("no_video_provider_available");
      const sourceImageUrl = sourceReferenceImage(data);
      const providerImageUrl = await providerReachableImageUrl(sourceImageUrl);
      const mediumTestMetadata = data.source === "medium-test"
        ? {
            source: "admin_medium_video_test",
            medium_test: true,
            medium_test_sample_id: data.mediumTestSampleId || null,
            medium_test_template_id: data.mediumTestTemplateId || null,
            medium_test_product_image_required: mediumTestSampleFromInput(data)?.requiresProductImage ?? false,
          }
        : {};
      const watermarkRequired = profile?.plan === "free";
      const productImageRequired = data.source === "medium-test" ? (mediumTestSampleFromInput(data)?.requiresProductImage ?? false) : profile?.plan !== "free";
      const providerInput = { ...data, watermarkRequired, providerImageUrl } satisfies VideoInput;

      // Free tier: حصة فيديو شهرية متجددة (1 فيديو/شهر) — تفحص قبل consume النقاط
      if (profile?.plan === "free") {
        const { data: quotaCheck, error: quotaErr } = await supabase.rpc("check_free_monthly_video_quota");
        if (quotaErr) throw new Error(`free_monthly_video_quota_check_failed: ${quotaErr.message}`);
        const row = Array.isArray(quotaCheck) ? quotaCheck[0] : quotaCheck;
        if (row && row.allowed === false) {
          const cycleEnd = row.next_reset_at ? new Date(row.next_reset_at as string).toISOString() : "";
          throw new Error(`free_monthly_video_quota_exceeded:used=${row.used ?? 1}:cap=${row.monthly_cap ?? 1}:cycle_end=${cycleEnd}`);
        }
      }

      const charge = await consume(supabase, cost, "consume_video", {
        quality: data.quality,
        aspect_ratio: data.aspectRatio,
        duration_seconds: data.durationSeconds,
        credit_scope: "video",
        ...baseMetadata,
        ...mediumTestMetadata,
      });
      ledgerId = charge.ledgerId;

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("video_jobs")
        .insert({
          user_id: userId,
          prompt: data.prompt,
          quality: data.quality,
          aspect_ratio: data.aspectRatio,
          duration_seconds: data.durationSeconds,
          starting_frame_url: data.startingFrameUrl || null,
          speaker_image_url: data.speakerImageUrl || null,
          product_image_url: data.productImageUrl || null,
          selected_persona_id: data.selectedPersonaId || null,
          credits_charged: cost,
          ledger_id: ledgerId,
          status: "processing",
          provider: "router",
          estimated_cost_usd: estimatedVideoCostUsd(data.quality, data.durationSeconds),
          metadata: { ...baseMetadata, ...mediumTestMetadata, router_version: 2, duration_aware_pricing: true, saudi_prompt_layer: true, selected_template_id: selectedTemplateId, launch_template: selectedTemplateId !== "custom", plan_credit_rollover: false, watermark_required: watermarkRequired, watermark_strategy: watermarkRequired ? "provider_prompt_overlay" : "none", product_image_required: productImageRequired, prompt_adherence_required: true, prompt_adherence_gate: "80%+", provider_image_url: providerImageUrl ?? null, provider_image_source: sourceImageUrl ? "provider_preflight" : "none", provider_audio_requested: false, audio_policy: "provider_audio_disabled_until_saudi_voice_pipeline" },
        })
        .select("*")
        .single();

      if (insertError || !inserted) throw new Error(`فشل إنشاء مهمة الفيديو: ${insertError?.message ?? "استجابة فارغة"}`);
      const job = inserted as VideoJobRow;
      jobId = job.id;

      // Free tier: تسجيل استهلاك فيديو الشهر بعد نجاح الإنشاء (idempotent على مستوى الدورة)
      if (profile?.plan === "free") {
        const { error: recordErr } = await supabase.rpc("record_free_monthly_video_usage");
        if (recordErr) {
          // لا نُفشل المهمة — نسجّل تحذيراً فقط لأن الفيديو أُنشئ والنقاط خُصمت بالفعل.
          console.warn("[video] record_free_monthly_video_usage failed", { userId, jobId, err: recordErr.message });
        }
      }

      const routed = await createProviderJob(providerInput, job.id, providerConfigs);
      const finalStatus = routed.result.resultUrl ? "completed" : "processing";
      const metadata = {
        ...(job.metadata as Record<string, unknown> | null),
        ...(routed.result.metadata ?? {}),
        provider_attempts: routed.attempts,
        provider_status: routed.result.status,
        provider_mode: routed.config.mode,
        manual_required: routed.result.manualRequired === true,
      };

      const archive = routed.result.resultUrl ? await archiveProviderVideo({ userId, jobId: job.id, resultUrl: routed.result.resultUrl }) : { resultUrl: routed.result.resultUrl, storagePath: null, archived: false, error: null };
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("video_jobs")
        .update({
          provider: routed.config.provider_key,
          provider_job_id: routed.result.providerJobId,
          result_url: archive.resultUrl,
          storage_path: archive.storagePath,
          status: finalStatus,
          completed_at: finalStatus === "completed" ? new Date().toISOString() : null,
          estimated_cost_usd: routed.result.estimatedCostUsd ?? estimatedVideoCostUsd(data.quality, data.durationSeconds),
          metadata: { ...metadata, provider_result_url: routed.result.resultUrl, internal_video_archived: archive.archived, internal_video_archive_error: archive.error } as Json,
        })
        .eq("id", job.id)
        .select("*")
        .single();

      if (updateError || !updated) throw new Error(`فشل تحديث مهمة الفيديو: ${updateError?.message ?? "استجابة فارغة"}`);

      return { job: updated as VideoJobRow, creditsCharged: cost, remainingTotal: charge.remainingTotal, pending: finalStatus === "processing" };
    } catch (e) {
      const errorCategory = categorizeVideoError(e);
      const refundLedgerId = ledgerId ? await refund(supabaseAdmin, ledgerId, "video_generation_failed") : null;
      const effectiveRefundLedgerId = refundLedgerId ?? (ledgerId ? await getRefundLedgerId(supabaseAdmin, ledgerId) : null);
      let compensationLedgerId: string | null = null;
      if (jobId) {
        compensationLedgerId = await compensateUserForProviderFailure({ userId, jobId, category: errorCategory });
        const { data: failedJob } = await supabaseAdmin.from("video_jobs").select("metadata").eq("id", jobId).maybeSingle();
        await markProcessingJobRefunded({
          jobId,
          refundLedgerId: effectiveRefundLedgerId,
          errorMessage: publicVideoError(e).message,
          errorCategory,
          metadata: {
            ...((failedJob?.metadata as Record<string, unknown> | null) ?? {}),
            failure_stage: "generate_video",
            original_error: errorMessage(e),
            refund_ledger_id: effectiveRefundLedgerId,
            compensation_ledger_id: compensationLedgerId,
            compensation_credits: compensationLedgerId ? PROVIDER_FAILURE_COMPENSATION_CREDITS : 0,
          },
        });
      }
      throw publicVideoError(e);
    }
  });

export const listVideoJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
      const { data, error } = await supabase.from("video_jobs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
    if (error) throw new Error(`فشل جلب الفيديوهات: ${error.message}`);
      const jobs = await Promise.all(((data as VideoJobRow[] | null) ?? []).map(async (job) => ({ ...job, result_url: (await signedVideoUrlFromPath(job.storage_path)) ?? job.result_url })));
    return { jobs };
  });

export const refreshVideoJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    const { data: job, error } = await supabase.from("video_jobs").select("*").eq("id", data.jobId).eq("user_id", userId).single();
    if (error || !job) throw new Error(`فشل جلب مهمة الفيديو: ${error?.message ?? "غير موجودة"}`);
    const row = job as VideoJobRow;
    if (row.status !== "processing") return { job: row };

    const createdAt = new Date(row.created_at).getTime();
    const isStale = Number.isFinite(createdAt) && Date.now() - createdAt > MAX_PROCESSING_MINUTES * 60_000;
    if (isStale) {
      const refundLedgerId = row.ledger_id ? await refund(supabaseAdmin, row.ledger_id, "video_generation_timeout") : null;
      const effectiveRefundLedgerId = refundLedgerId ?? (row.ledger_id ? await getRefundLedgerId(supabaseAdmin, row.ledger_id) : null);
      const compensationLedgerId = await compensateUserForProviderFailure({ userId, jobId: row.id, category: "timeout" });
      const updated = await markProcessingJobRefunded({
        jobId: row.id,
        refundLedgerId: effectiveRefundLedgerId,
        errorMessage: "تأخر توليد الفيديو أكثر من المتوقع، وتم رد النقاط تلقائياً مع منحك 50 نقطة تعويضاً.",
        errorCategory: "timeout",
        metadata: { compensation_ledger_id: compensationLedgerId, compensation_credits: compensationLedgerId ? PROVIDER_FAILURE_COMPENSATION_CREDITS : 0 },
      });
      return { job: updated };
    }

    if (!row.provider_job_id) return { job: row };

    const provider = PROVIDERS[row.provider];
    if (!provider) throw new Error("مزود الفيديو المستخدم في هذه المهمة لم يعد مدعوماً");
    let prediction: ProviderRefreshResult;
    try {
      prediction = await provider.refreshJob(row.provider_job_id, row);
      await markProviderSuccess(row.provider);
    } catch (e) {
      await markProviderFailure(row.provider, e);
      await supabaseAdmin
        .from("video_jobs")
        .update({ metadata: mergeMetadata(row.metadata, { last_check_error: errorMessage(e), last_checked_at: new Date().toISOString() }) })
        .eq("id", row.id);
      throw publicVideoError(e);
    }

    if (!TERMINAL_PROVIDER_STATUSES.has(prediction.status)) {
      await supabaseAdmin
        .from("video_jobs")
        .update({ metadata: mergeMetadata(row.metadata, { ...(prediction.metadata ?? {}), provider_status: prediction.status, last_checked_at: new Date().toISOString() }) })
        .eq("id", row.id);
    }

    if (prediction.status === "failed" || prediction.status === "canceled") {
      const errorCategory = categorizeVideoError(prediction.error ?? "provider_failure");
      const refundLedgerId = row.ledger_id ? await refund(supabaseAdmin, row.ledger_id, "video_generation_failed") : null;
      const effectiveRefundLedgerId = refundLedgerId ?? (row.ledger_id ? await getRefundLedgerId(supabaseAdmin, row.ledger_id) : null);
      const compensationLedgerId = await compensateUserForProviderFailure({ userId, jobId: row.id, category: errorCategory });
      const updated = await markProcessingJobRefunded({
        jobId: row.id,
        refundLedgerId: effectiveRefundLedgerId,
        errorMessage: prediction.error ?? "فشل توليد الفيديو لدى المزود",
        errorCategory,
        metadata: { compensation_ledger_id: compensationLedgerId, compensation_credits: compensationLedgerId ? PROVIDER_FAILURE_COMPENSATION_CREDITS : 0 },
      });
      return { job: updated };
    }

    if (prediction.status === "succeeded" && prediction.resultUrl) {
      const updated = await markProcessingJobCompleted({ jobId: row.id, userId, resultUrl: prediction.resultUrl, metadata: { ...(row.metadata as Record<string, unknown> | null), ...(prediction.metadata ?? {}), provider_status: prediction.status } });
      return { job: updated };
    }

    return { job: row };
  });
