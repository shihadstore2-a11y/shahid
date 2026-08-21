import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, logAdminAudit, type DbClient } from "@/server/admin-auth";
import type { Database, Json } from "@/integrations/supabase/types";
import { isValidVideoTierSelection } from "@/lib/plan-catalog";
import { FAL_VIDEO_TEST_MODELS, SAUDI_VIDEO_LAUNCH_DECISION, SAUDI_VIDEO_LAUNCH_TEMPLATE_IDS, SAUDI_VIDEO_MEDIUM_TEST_PLAN, SAUDI_VIDEO_MEDIUM_TEST_TEMPLATE_IDS, SAUDI_VIDEO_PERSONAS, SAUDI_VIDEO_PROMPT_TEMPLATES, SAUDI_VIDEO_TEST_SCENARIOS, buildSaudiFalTestPrompt, buildSaudiVideoMediumTestSample, evaluateSaudiVideoImage } from "@/lib/saudi-video-test";

const ListAdminVideoJobsInput = z.object({
  status: z.enum(["all", "pending", "processing", "completed", "failed", "refunded"]).default("all"),
  limit: z.number().int().min(1).max(300).default(100),
});

const VIDEO_CDN_FIX_VERIFIED_AT = "2026-04-27T12:50:00.000Z";

const ProviderUpdateInput = z.object({
  providerKey: z.string().min(2).max(80),
  enabled: z.boolean().optional(),
  publicEnabled: z.boolean().optional(),
  priority: z.number().int().min(1).max(1000).optional(),
  cost5s: z.number().int().min(0).max(100000).optional(),
  cost8s: z.number().int().min(0).max(100000).optional(),
});

const TestProviderInput = z.object({
  providerKey: z.string().min(2).max(80),
});

const SaudiFalPromptPreviewInput = z.object({
  modelId: z.string().min(3).max(180).default("fal-ai/pixverse/v6/image-to-video"),
  personaId: z.enum(["male-young", "male-premium", "female-abaya", "retail-seller"]).default("male-young"),
  scenarioId: z.enum(["perfume", "abaya", "arabic-coffee", "electronics"]).default("perfume"),
  includeProductImage: z.boolean().default(true),
  includeVoice: z.boolean().default(true),
});

const SaudiFalModelTestInput = SaudiFalPromptPreviewInput.extend({
  personaImageUrl: z.string().url().max(2000),
  productImageUrl: z.string().url().max(2000).optional().or(z.literal("")),
});

const TestVideoRouterInput = z.object({
  quality: z.enum(["fast", "lite", "quality"]).default("fast"),
  aspectRatio: z.enum(["9:16", "1:1", "16:9"]).default("9:16"),
  durationSeconds: z.union([z.literal(5), z.literal(8)]).default(5),
  hasStartingFrame: z.boolean().default(false),
  imageCount: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(0),
});

const EvaluatePilotSampleInput = z.object({
  sampleId: z.enum(SAUDI_VIDEO_MEDIUM_TEST_TEMPLATE_IDS.map((_, index) => `pilot-${String(index + 1).padStart(2, "0")}`) as [string, ...string[]]),
  resultUrl: z.string().trim().url().max(2000).optional().or(z.literal("")),
  productClarity: z.number().int().min(1).max(5),
  sceneAdherence: z.number().int().min(1).max(5),
  motionAdherence: z.number().int().min(1).max(5),
  saudiDialect: z.number().int().min(1).max(5),
  negativeSafety: z.number().int().min(1).max(5),
  publishReadiness: z.number().int().min(1).max(5),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

const AuditMediumBatchInput = z.object({
  auditLog: z.boolean().default(true),
});


async function getSupabaseAdmin() {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin;
}

type VideoJobStatus = Database["public"]["Enums"]["video_job_status"];
type VideoJobRow = Database["public"]["Tables"]["video_jobs"]["Row"];
type MediumAuditJob = Pick<VideoJobRow, "id" | "status" | "result_url" | "credits_charged" | "estimated_cost_usd" | "product_image_url" | "error_message" | "metadata" | "created_at" | "quality" | "duration_seconds" | "aspect_ratio" | "selected_persona_id">;
type MediumAuditProvider = Pick<Database["public"]["Tables"]["video_provider_configs"]["Row"], "provider_key" | "display_name_admin" | "enabled" | "public_enabled" | "health_status" | "priority">;

export type AdminVideoJob = {
  id: string;
  user_id: string;
  user_email: string | null;
  user_store: string | null;
  prompt: string;
  quality: "fast" | "lite" | "quality";
  aspect_ratio: string;
  duration_seconds: number;
  status: VideoJobStatus;
  provider: string;
  provider_job_id: string | null;
  result_url: string | null;
  storage_path: string | null;
  error_message: string | null;
  credits_charged: number;
  estimated_cost_usd: number | null;
  ledger_id: string | null;
  refund_ledger_id: string | null;
  metadata: Json | null;
  created_at: string;
  completed_at: string | null;
};

export type AdminVideoStats = {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  refunded: number;
  failed: number;
  creditsCharged: number;
  estimatedCostUsd: number;
  softLaunch: {
    targetSize: number;
    sampleSize: number;
    progressPercent: number;
    planCompletionPercent: number;
    remainingToBeta: number;
    planPercentPerOperation: number;
    nextBatchTarget: number;
    nextBatchProgressPercent: number;
    nextBatchExpectedPlanPercent: number;
    nextBatchReady: boolean;
    rolloutStartedAt: string | null;
    completed: number;
    refunded: number;
    failedUnrefunded: number;
    active: number;
    archived: number;
    missingArchive: number;
    legacyFallback: number;
    ledgerMatched: number;
    ledgerMismatched: number;
    campaignLinked: number;
    readyForBeta: boolean;
    blockers: string[];
    checkedAt: string;
  };
};

type ProviderAttempt = {
  provider?: string;
  ok?: boolean;
  status?: string;
  latency_ms?: number;
  finished_at?: string;
  error?: string;
  reason?: string;
};

export type AdminVideoProviderConfig = {
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
  supports_two_images?: boolean;
  supports_voice?: boolean;
  mode: "api" | "bridge" | "manual";
  health_status: "active" | "inactive" | "testing" | "manual_required" | "unhealthy";
  last_success_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
  metadata: Json;
  updated_at: string;
};

export type AdminVideoProviderAttemptSummary = {
  provider: string;
  total: number;
  success: number;
  failed: number;
  successRate: number;
  failureRate: number;
  avgLatencyMs: number | null;
  topError: string | null;
  lastStatus: string | null;
  lastAt: string | null;
};

export type SaudiLaunchTemplatePerformance = {
  templateId: string;
  total: number;
  completed: number;
  processing: number;
  refunded: number;
  failed: number;
  publishableRate: number;
  failureRate: number;
  avgCostUsd: number | null;
  minSampleReached: boolean;
  expansionEligible: boolean;
  decision: "collecting" | "watch" | "eligible";
  gateNotes: string[];
  lastAt: string | null;
};

const LAUNCH_TEMPLATE_MIN_SAMPLE_SIZE = 20;
const LAUNCH_TEMPLATE_MAX_FAILURE_RATE = 12;
const LAUNCH_TEMPLATE_MAX_AVG_COST_USD = 0.5;

export type AdminVideoProviderTestResult = {
  providerKey: string;
  ok: boolean;
  status: "active" | "manual_required" | "unhealthy";
  latencyMs: number;
  message: string;
  checkedAt: string;
};

export type SaudiFalPromptPreview = {
  prompt: string;
  model: typeof FAL_VIDEO_TEST_MODELS[number];
  persona: typeof SAUDI_VIDEO_PERSONAS[number];
  scenario: typeof SAUDI_VIDEO_TEST_SCENARIOS[number];
  imageEvaluation: { score: number; recommendation: string };
};

export type SaudiFalModelTestResult = SaudiFalPromptPreview & {
  ok: boolean;
  status: "submitted" | "completed" | "failed";
  requestId: string | null;
  resultUrl: string | null;
  latencyMs: number;
  estimatedCostUsd: number | null;
  error: string | null;
  checkedAt: string;
};

export type AdminVideoRouterTestResult = {
  ok: boolean;
  selectedProvider: string | null;
  checkedAt: string;
  candidates: Array<{ providerKey: string; displayName: string; priority: number; effectivePriority: number; mode: string; eligible: boolean; reason: string }>;
};

export type SaudiVideoPilotAuditResult = {
  checkedAt: string;
  totalTemplates: number;
  passCount: number;
  passRate: number;
  readyForPilot: boolean;
  sectorCoverage: string[];
  riskMix: Record<string, number>;
  findings: Array<{ templateId: string; label: string; sector: string; risk: string; score: number; issues: string[]; recommendation: string }>;
};

export type SaudiVideoPilotMatrixResult = {
  checkedAt: string;
  testLevel: "medium" | "full";
  totalSamples: number;
  estimatedCostUsd: number;
  requiredPublishableRate: number;
  readinessGate: string;
  samples: Array<{
    sampleId: string;
    templateId: string;
    label: string;
    sector: string;
    personaId: string;
    personaLabel: string;
    quality: "fast" | "lite" | "quality";
    durationSeconds: 5 | 8;
    expectedAspectRatio: "9:16" | "1:1" | "16:9";
    requiresProductImage: boolean;
    objective: string;
    technicalGate: string[];
    mustPass: string[];
    scorecard: string[];
    promptAdherenceGate: string;
      finalPrompt: string;
      generationPayload: {
        prompt: string;
        quality: "fast" | "lite" | "quality";
        aspectRatio: "9:16" | "1:1" | "16:9";
        durationSeconds: 5 | 8;
        selectedPersonaId: string;
        selectedTemplateId: "custom";
        requiresProductImage: boolean;
      };
  }>;
};

export type SaudiVideoPilotEvaluationResult = {
  sampleId: string;
  resultUrl?: string;
  productClarity: number;
  sceneAdherence: number;
  motionAdherence: number;
  saudiDialect: number;
  negativeSafety: number;
  publishReadiness: number;
  notes?: string;
  score: number;
  decision: "publishable" | "minor_revision" | "reject_or_reprompt";
  gateReason: string;
  evaluatedAt: string;
};

export type SaudiVideoMediumBatchResult = {
  checkedAt: string;
  totalPlanned: number;
  generated: number;
  completed: number;
  evaluated: number;
  publishable: number;
  needsRevision: number;
  rejected: number;
  minimumPublishable: number;
  commercialValidityRate: number;
  processing: number;
  failedOrRefunded: number;
  completedWithoutResult: number;
  staleInProgress: number;
  missingProductImage: number;
  metadataMismatch: number;
  configurationMismatch: number;
  remainingToGenerate: number;
  remainingToEvaluate: number;
  operationalBlockingIssues: number;
  commercialRejectedIssues: number;
  blockingIssues: number;
  estimatedCostUsd: number;
  activeProviderLabel: string | null;
  activeProviderHealthy: boolean;
  readinessWarnings: string[];
  executionRate: number;
  completionRate: number;
  releaseGate: "not_started" | "running" | "ready_for_review" | "needs_iteration" | "ready_for_expansion" | "blocked";
  releaseGateReason: string;
  nextAction: string;
  samples: Array<{
    sampleId: string;
    templateId: string;
    label: string;
    sector: string;
    requiredProductImage: boolean;
    jobId: string | null;
    status: VideoJobStatus | "not_generated";
    resultUrl: string | null;
    creditsCharged: number | null;
    estimatedCostUsd: number | null;
    evaluationScore: number | null;
    releaseDecision: "publishable" | "minor_revision" | "reject_or_reprompt" | null;
    createdAt: string | null;
    issue: string | null;
  }>;
};

function toAdminVideoJob(row: VideoJobRow, profile?: { email: string | null; store_name: string | null } | null): AdminVideoJob {
  return {
    ...row,
    quality: row.quality as "fast" | "lite" | "quality",
    estimated_cost_usd: row.estimated_cost_usd === null ? null : Number(row.estimated_cost_usd),
    user_email: profile?.email ?? null,
    user_store: profile?.store_name ?? null,
  };
}

async function signInternalVideoUrl(path: string | null, fallback: string | null) {
  if (!path) return fallback;
  const { data, error } = await (await getSupabaseAdmin()).storage.from("generated-videos").createSignedUrl(path, 60 * 60 * 24 * 7);
  return error || !data?.signedUrl ? fallback : data.signedUrl;
}

async function assertPilotBatchReadyForEvaluation(admin: Awaited<ReturnType<typeof getSupabaseAdmin>>) {
  const { data, error } = await admin
    .from("video_jobs")
    .select("id, status, result_url, product_image_url, metadata, created_at, quality, duration_seconds, aspect_ratio, selected_persona_id")
    .contains("metadata", { medium_test: true });
  if (error) throw new Error(`فشل التحقق من جاهزية دفعة الاختبار المتوسط للتقييم: ${error.message}`);

  const latestOfficial = new Map<string, MediumAuditJob>();
  const latestMismatch = new Map<string, Pick<VideoJobRow, "created_at">>();
  for (const row of (data as MediumAuditJob[] | null) ?? []) {
    const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
    const sampleId = typeof metadata.medium_test_sample_id === "string" ? metadata.medium_test_sample_id : "";
    const templateId = typeof metadata.medium_test_template_id === "string" ? metadata.medium_test_template_id : "";
    const currentNumber = Number(sampleId.replace("pilot-", ""));
    const expectedTemplateId = Number.isInteger(currentNumber) ? SAUDI_VIDEO_MEDIUM_TEST_TEMPLATE_IDS[currentNumber - 1] : undefined;
    if (!sampleId || !expectedTemplateId) continue;
    const targetMap = templateId === expectedTemplateId ? latestOfficial : latestMismatch;
    const current = targetMap.get(sampleId);
    if (!current || new Date(row.created_at).getTime() > new Date(current.created_at).getTime()) targetMap.set(sampleId, row);
  }

  for (let index = 0; index < SAUDI_VIDEO_MEDIUM_TEST_TEMPLATE_IDS.length; index += 1) {
    const sample = buildSaudiVideoMediumTestSample(index);
    const job = latestOfficial.get(sample.sampleId) ?? null;
    const mismatch = latestMismatch.get(sample.sampleId) ?? null;
    const configurationMismatch = Boolean(job && (job.quality !== sample.quality || job.duration_seconds !== sample.durationSeconds || job.aspect_ratio !== sample.expectedAspectRatio || job.selected_persona_id !== sample.personaId));
    const newerMismatch = Boolean(mismatch && (!job || new Date(mismatch.created_at).getTime() > new Date(job.created_at).getTime()));
    if (!job || newerMismatch || job.status !== "completed" || !job.result_url || configurationMismatch || (sample.requiresProductImage && !job.product_image_url)) {
      throw new Error("لا يبدأ التقييم التجاري قبل اكتمال كل عينات الاختبار المتوسط من الرابط الرسمي وبلا عوائق تشغيلية.");
    }
  }
}

function isManualBridgeJob(row: VideoJobRow): boolean {
  const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
  return metadata.manual_required === true;
}

function appendProviderAttempt(metadata: Json | null, attempt: ProviderAttempt) {
  const base = (metadata as Record<string, unknown> | null) ?? {};
  const attempts = Array.isArray(base.provider_attempts) ? base.provider_attempts : [];
  return {
    ...base,
    provider_attempts: [...attempts, { ...attempt, finished_at: new Date().toISOString() }],
    last_attempt_at: new Date().toISOString(),
  } as Json;
}

function appendConnectionTest(metadata: Json | null, result: AdminVideoProviderTestResult) {
  const base = (metadata as Record<string, unknown> | null) ?? {};
  const tests = Array.isArray(base.connection_tests) ? base.connection_tests.slice(-9) : [];
  return { ...base, connection_tests: [...tests, result], last_connection_test_at: result.checkedAt } as Json;
}

function providerEligibleForInput(provider: AdminVideoProviderConfig, input: z.infer<typeof TestVideoRouterInput>) {
  if (!isValidVideoTierSelection(input.quality, input.durationSeconds)) return { eligible: false, reason: "تركيبة الجودة/المدة غير معتمدة" };
  if (!provider.enabled) return { eligible: false, reason: "متوقف داخلياً" };
  if (!provider.public_enabled) return { eligible: false, reason: "غير متاح للطلبات" };
  if (!provider.supported_qualities.includes(input.quality)) return { eligible: false, reason: "الجودة غير مدعومة" };
  if (input.aspectRatio === "9:16" && !provider.supports_9_16) return { eligible: false, reason: "مقاس 9:16 غير مدعوم" };
  if (input.aspectRatio === "1:1" && !provider.supports_1_1) return { eligible: false, reason: "مقاس 1:1 غير مدعوم" };
  if (input.aspectRatio === "16:9" && !provider.supports_16_9) return { eligible: false, reason: "مقاس 16:9 غير مدعوم" };
  if (input.hasStartingFrame && !provider.supports_starting_frame) return { eligible: false, reason: "صورة البداية غير مدعومة" };
  if (input.imageCount > 0 && !provider.supports_starting_frame) return { eligible: false, reason: "مراجع الصور غير مدعومة" };
  const metadata = (provider.metadata as { supports_two_images?: boolean; model_family?: string } | null) ?? {};
  const pixverseCanCollapseReferences = provider.provider_key === "fal_ai" && metadata.model_family === "pixverse_v6";
  if (input.imageCount > 1 && !pixverseCanCollapseReferences && metadata.supports_two_images !== true) return { eligible: false, reason: "صورتان غير مدعومتين" };
  const cost = input.durationSeconds === 8 ? provider.cost_8s : provider.cost_5s;
  if (cost <= 0) return { eligible: false, reason: "تكلفة المدة غير مضبوطة" };
  return { eligible: true, reason: provider.health_status === "unhealthy" ? "مؤهل لكن مؤخر بسبب حالة غير صحية" : "جاهز للراوتر" };
}

function providerPriorityScore(provider: AdminVideoProviderConfig) {
  const healthPenalty = provider.health_status === "unhealthy" ? 10_000 : provider.health_status === "inactive" ? 20_000 : 0;
  return provider.priority + healthPenalty;
}

function providerSecretName(providerKey: string) {
  return ({
    fal_ai: "FAL_API_KEY",
    runway: "RUNWAY_API_KEY",
    luma: "LUMA_API_KEY",
    kling: "KLING_API_KEY",
  } as Record<string, string | undefined>)[providerKey];
}

function videoLedgerMatches(row: VideoJobRow): boolean {
  if (row.status === "completed") return Boolean(row.ledger_id) && !row.refund_ledger_id;
  if (row.status === "refunded") return Boolean(row.ledger_id && row.refund_ledger_id);
  if (row.status === "failed") return !row.ledger_id || Boolean(row.refund_ledger_id);
  return true;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
}

function extractFalVideoUrl(result: { video?: { url?: string }; video_url?: string; url?: string }) {
  return result.video?.url ?? result.video_url ?? result.url ?? null;
}

async function pollFalQueueResult(token: string, statusUrl?: string, responseUrl?: string) {
  if (!statusUrl || !responseUrl) return { status: "submitted" as const, resultUrl: null as string | null, error: null as string | null };
  for (let attempt = 0; attempt < 18; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 8_000));
    const statusResponse = await fetch(statusUrl, { headers: { Authorization: `Key ${token}` } });
    const statusText = await statusResponse.text();
    let statusPayload: { status?: string; error?: string } = {};
    try { statusPayload = statusText ? JSON.parse(statusText) as typeof statusPayload : {}; } catch { statusPayload = { error: statusText.slice(0, 500) }; }
    if (!statusResponse.ok || statusPayload.error) return { status: "failed" as const, resultUrl: null, error: statusPayload.error ?? `fal.ai status ${statusResponse.status}` };
    const status = (statusPayload.status ?? "").toUpperCase();
    if (["FAILED", "ERROR", "CANCELED", "CANCELLED"].includes(status)) return { status: "failed" as const, resultUrl: null, error: statusPayload.error ?? status };
    if (!["COMPLETED", "SUCCEEDED", "SUCCESS"].includes(status)) continue;

    const resultResponse = await fetch(responseUrl, { headers: { Authorization: `Key ${token}` } });
    const resultText = await resultResponse.text();
    let resultPayload: { video?: { url?: string }; video_url?: string; url?: string; error?: string } = {};
    try { resultPayload = resultText ? JSON.parse(resultText) as typeof resultPayload : {}; } catch { resultPayload = { error: resultText.slice(0, 500) }; }
    if (!resultResponse.ok || resultPayload.error) return { status: "failed" as const, resultUrl: null, error: resultPayload.error ?? `fal.ai result ${resultResponse.status}: ${resultText.slice(0, 300)}` };
    const resultUrl = extractFalVideoUrl(resultPayload);
    return resultUrl ? { status: "completed" as const, resultUrl, error: null } : { status: "failed" as const, resultUrl: null, error: "اكتمل الطلب دون رابط فيديو" };
  }
  return { status: "submitted" as const, resultUrl: null, error: null };
}

async function probeFalToken(token: string) {
  const response = await fetch("https://queue.fal.run/fal-ai/pixverse/v6/text-to-video/requests/__rifd_healthcheck__/status", {
    headers: { Authorization: `Key ${token}` },
  });
  if (response.status === 404) return { ok: true, message: "مفتاح fal.ai صالح؛ فحص الطلب الوهمي عاد 404 كما هو متوقع." };
  if (response.status === 401 || response.status === 403) return { ok: false, message: "مفتاح fal.ai مرفوض من المزود." };
  return { ok: response.ok, message: response.ok ? "مفتاح fal.ai صالح." : `تعذر تأكيد مفتاح fal.ai: ${response.status}` };
}

async function refundVideoCreditsOnce(ledgerId: string | null) {
  if (!ledgerId) return { refundId: null as string | null, newlyRefunded: false };
  const { data: refundId, error } = await (await getSupabaseAdmin()).rpc("refund_credits", { _ledger_id: ledgerId, _reason: "manual_video_refund" });
  if (!error) return { refundId: refundId as string, newlyRefunded: true };
  if (!/already_refunded/i.test(error.message)) throw new Error(`فشل رد النقاط: ${error.message}`);

  const { data: ledger } = await (await getSupabaseAdmin()).from("credit_ledger").select("refund_ledger_id").eq("id", ledgerId).maybeSingle();
  return { refundId: ledger?.refund_ledger_id ?? null, newlyRefunded: false };
}

export const listAdminVideoJobs = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ListAdminVideoJobsInput.parse(input ?? {}))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ rows: AdminVideoJob[]; stats: AdminVideoStats }> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);
    const admin = await getSupabaseAdmin();

    let q = admin
      .from("video_jobs")
      .select("id, user_id, prompt, quality, aspect_ratio, duration_seconds, status, provider, provider_job_id, result_url, storage_path, error_message, credits_charged, estimated_cost_usd, ledger_id, refund_ledger_id, metadata, created_at, completed_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.status !== "all") q = q.eq("status", data.status);

    const { data: rows, error } = await q;
    if (error) throw new Error(`فشل جلب مهام الفيديو: ${error.message}`);

    const statsRows = ((rows ?? []) as VideoJobRow[]);
    const userIds = Array.from(new Set(statsRows.map((r) => r.user_id)));
    const { data: profs } = userIds.length
      ? await admin.from("profiles").select("id, email, store_name").in("id", userIds)
      : { data: [] as { id: string; email: string | null; store_name: string | null }[] };
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]));

    const statusList = ["pending", "processing", "completed", "refunded", "failed"] as const;
    const counts: Record<string, number> = { pending: 0, processing: 0, completed: 0, refunded: 0, failed: 0 };
    await Promise.all(
      statusList.map(async (status) => {
        const { count } = await admin.from("video_jobs").select("id", { count: "exact", head: true }).eq("status", status);
        counts[status] = count ?? 0;
      })
    );

    const { count: totalCount } = await admin.from("video_jobs").select("id", { count: "exact", head: true });
    const archiveRolloutStartedAt = VIDEO_CDN_FIX_VERIFIED_AT;
    let softLaunchQuery = admin
      .from("video_jobs")
      .select("id, status, storage_path, result_url, ledger_id, refund_ledger_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    softLaunchQuery = softLaunchQuery.gte("created_at", archiveRolloutStartedAt);

    const { data: softLaunchRows, error: softLaunchError } = await softLaunchQuery;
    if (softLaunchError) throw new Error(`فشل جلب عينة Soft Launch: ${softLaunchError.message}`);

    const softRows = ((softLaunchRows ?? []) as VideoJobRow[]);
    const softTargetSize = 10;
    const softProgressPercent = Math.min(100, Math.round((softRows.length / softTargetSize) * 100));
    const softPlanCompletionPercent = Math.min(100, 90 + Math.round(softProgressPercent / 10));
    const softRemainingToBeta = Math.max(0, softTargetSize - softRows.length);
    const softPlanPercentPerOperation = Math.max(1, Math.round((100 - 90) / softTargetSize));
    const softNextBatchTarget = Math.min(3, softRemainingToBeta);
    const softNextBatchProgressPercent = softNextBatchTarget === 0 ? 100 : 0;
    const softNextBatchExpectedPlanPercent = Math.min(100, softPlanCompletionPercent + softNextBatchTarget * softPlanPercentPerOperation);
    const softCompleted = softRows.filter((r) => r.status === "completed").length;
    const softRefunded = softRows.filter((r) => r.status === "refunded").length;
    const softFailedUnrefunded = softRows.filter((r) => r.status === "failed" && Boolean(r.ledger_id) && !r.refund_ledger_id).length;
    const softActive = softRows.filter((r) => r.status === "pending" || r.status === "processing").length;
    const softArchived = softRows.filter((r) => r.status === "completed" && Boolean(r.storage_path)).length;
    const softMissingArchive = softRows.filter((r) => r.status === "completed" && !r.storage_path && Object.prototype.hasOwnProperty.call((r.metadata as Record<string, unknown> | null) ?? {}, "internal_video_archived")).length;
    const softLegacyFallback = softRows.filter((r) => r.status === "completed" && !r.storage_path && !Object.prototype.hasOwnProperty.call((r.metadata as Record<string, unknown> | null) ?? {}, "internal_video_archived")).length;
    const softLedgerMatched = softRows.filter(videoLedgerMatches).length;
    const softCampaignLinked = softRows.filter((r) => Boolean((r.metadata as { campaign_pack_id?: string } | null)?.campaign_pack_id)).length;
    const softBlockers = [
      softActive > 0 ? "توجد مهام فيديو نشطة ضمن آخر 10 عمليات" : null,
      softRefunded > 0 ? "توجد عمليات فيديو مسترجعة ضمن عينة Soft Launch" : null,
      softMissingArchive > 0 ? "توجد فيديوهات مكتملة ضمن العينة بلا storage_path داخلي" : null,
      softFailedUnrefunded > 0 ? "توجد مهام فاشلة ضمن العينة لديها خصم بلا استرداد" : null,
      softLedgerMatched !== softRows.length ? "توجد عمليات ضمن العينة لا تطابق قاعدة ledger/refund" : null,
    ].filter(Boolean) as string[];
    const softNextBatchReady = softRemainingToBeta > 0 && softBlockers.length === 0;
    const stats: AdminVideoStats = {
      total: totalCount ?? statsRows.length,
      pending: counts.pending,
      processing: counts.processing,
      completed: counts.completed,
      refunded: counts.refunded,
      failed: counts.failed,
      creditsCharged: statsRows.reduce((sum, r) => sum + (r.credits_charged ?? 0), 0),
      estimatedCostUsd: statsRows.reduce((sum, r) => sum + Number(r.estimated_cost_usd ?? 0), 0),
      softLaunch: {
        targetSize: softTargetSize,
        sampleSize: softRows.length,
        progressPercent: softProgressPercent,
        planCompletionPercent: softPlanCompletionPercent,
        remainingToBeta: softRemainingToBeta,
        planPercentPerOperation: softPlanPercentPerOperation,
        nextBatchTarget: softNextBatchTarget,
        nextBatchProgressPercent: softNextBatchProgressPercent,
        nextBatchExpectedPlanPercent: softNextBatchExpectedPlanPercent,
        nextBatchReady: softNextBatchReady,
        rolloutStartedAt: archiveRolloutStartedAt,
        completed: softCompleted,
        refunded: softRefunded,
        failedUnrefunded: softFailedUnrefunded,
        active: softActive,
        archived: softArchived,
        missingArchive: softMissingArchive,
        legacyFallback: softLegacyFallback,
        ledgerMatched: softLedgerMatched,
        ledgerMismatched: softRows.length - softLedgerMatched,
        campaignLinked: softCampaignLinked,
        readyForBeta: softRows.length >= 10 && softBlockers.length === 0,
        blockers: softBlockers,
        checkedAt: new Date().toISOString(),
      },
    };

    const mappedRows = await Promise.all(statsRows.map(async (r) => toAdminVideoJob({ ...r, result_url: await signInternalVideoUrl(r.storage_path, r.result_url) }, profMap.get(r.user_id))));

    return {
      stats,
      rows: mappedRows,
    };
  });

export const listVideoProviderConfigs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ providers: AdminVideoProviderConfig[] }> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    const { data, error } = await (await getSupabaseAdmin() as unknown as {
      from: (table: string) => { select: (columns: string) => { order: (column: string, opts: { ascending: boolean }) => Promise<{ data: unknown; error: { message: string } | null }> } };
    })
      .from("video_provider_configs")
      .select("provider_key, display_name_admin, enabled, public_enabled, supported_qualities, priority, cost_5s, cost_8s, supports_9_16, supports_1_1, supports_16_9, supports_starting_frame, mode, health_status, last_success_at, last_error_at, last_error_message, metadata, updated_at")
      .order("priority", { ascending: true });

    if (error) throw new Error(`فشل جلب إعدادات مزودي الفيديو: ${error.message}`);
    return { providers: (data as AdminVideoProviderConfig[] | null) ?? [] };
  });

export const listVideoProviderAttemptSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ attempts: AdminVideoProviderAttemptSummary[] }> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    const { data, error } = await (await getSupabaseAdmin())
      .from("video_jobs")
      .select("provider, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(`فشل جلب سجل محاولات المزودين: ${error.message}`);

    const byProvider = new Map<string, { total: number; success: number; failed: number; latency: number[]; errors: Map<string, number>; lastStatus: string | null; lastAt: string | null }>();
    for (const row of data ?? []) {
      const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
      const attempts: ProviderAttempt[] = Array.isArray(metadata.provider_attempts) ? metadata.provider_attempts as ProviderAttempt[] : [{ provider: row.provider, ok: undefined, status: String(metadata.provider_status ?? "unknown"), finished_at: row.created_at }];
      for (const attempt of attempts) {
        const key = attempt.provider || row.provider || "unknown";
        const current = byProvider.get(key) ?? { total: 0, success: 0, failed: 0, latency: [], errors: new Map<string, number>(), lastStatus: null, lastAt: null };
        current.total += 1;
        if (attempt.ok === true) current.success += 1;
        if (attempt.ok === false) current.failed += 1;
        if (attempt.ok === false && attempt.error) current.errors.set(attempt.error, (current.errors.get(attempt.error) ?? 0) + 1);
        if (typeof attempt.latency_ms === "number" && Number.isFinite(attempt.latency_ms)) current.latency.push(attempt.latency_ms);
        const finishedAt = attempt.finished_at ?? row.created_at;
        if (!current.lastAt || new Date(finishedAt).getTime() > new Date(current.lastAt).getTime()) {
          current.lastAt = finishedAt;
          current.lastStatus = attempt.status ?? null;
        }
        byProvider.set(key, current);
      }
    }

    return {
      attempts: Array.from(byProvider.entries()).map(([provider, item]) => {
        const topError = Array.from(item.errors.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
        return {
          provider,
          total: item.total,
          success: item.success,
          failed: item.failed,
          successRate: item.total ? Math.round((item.success / item.total) * 100) : 0,
          failureRate: item.total ? Math.round((item.failed / item.total) * 100) : 0,
          avgLatencyMs: item.latency.length ? Math.round(item.latency.reduce((sum, value) => sum + value, 0) / item.latency.length) : null,
          topError,
          lastStatus: item.lastStatus,
          lastAt: item.lastAt,
        };
      }).sort((a, b) => b.total - a.total),
    };
  });

export const listSaudiLaunchTemplatePerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ templates: SaudiLaunchTemplatePerformance[] }> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);
    const { data, error } = await (await getSupabaseAdmin())
      .from("video_jobs")
      .select("status, estimated_cost_usd, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(`فشل جلب أداء قوالب الإطلاق: ${error.message}`);

    const byTemplate = new Map<string, { total: number; completed: number; processing: number; refunded: number; failed: number; costs: number[]; lastAt: string | null }>();
    for (const row of data ?? []) {
      const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
      const templateId = typeof metadata.selected_template_id === "string" ? metadata.selected_template_id : "custom";
      if (templateId === "custom") continue;
      const current = byTemplate.get(templateId) ?? { total: 0, completed: 0, processing: 0, refunded: 0, failed: 0, costs: [], lastAt: null };
      current.total += 1;
      if (row.status === "completed") current.completed += 1;
      if (row.status === "processing") current.processing += 1;
      if (row.status === "refunded") current.refunded += 1;
      if (row.status === "failed") current.failed += 1;
      if (row.estimated_cost_usd !== null && Number.isFinite(Number(row.estimated_cost_usd))) current.costs.push(Number(row.estimated_cost_usd));
      if (!current.lastAt || new Date(row.created_at).getTime() > new Date(current.lastAt).getTime()) current.lastAt = row.created_at;
      byTemplate.set(templateId, current);
    }

    for (const templateId of SAUDI_VIDEO_LAUNCH_TEMPLATE_IDS) {
      if (!byTemplate.has(templateId)) byTemplate.set(templateId, { total: 0, completed: 0, processing: 0, refunded: 0, failed: 0, costs: [], lastAt: null });
    }

    return {
      templates: Array.from(byTemplate.entries()).map(([templateId, item]) => {
        const publishableRate = item.total ? Math.round((item.completed / item.total) * 100) : 0;
        const failureRate = item.total ? Math.round(((item.failed + item.refunded) / item.total) * 100) : 0;
        const avgCostUsd = item.costs.length ? Number((item.costs.reduce((sum, cost) => sum + cost, 0) / item.costs.length).toFixed(3)) : null;
        const gateNotes = [
          item.total >= LAUNCH_TEMPLATE_MIN_SAMPLE_SIZE ? "حجم العينة كافٍ" : `نحتاج ${Math.max(LAUNCH_TEMPLATE_MIN_SAMPLE_SIZE - item.total, 0).toLocaleString("ar-SA")} توليدات إضافية`,
          publishableRate >= SAUDI_VIDEO_LAUNCH_DECISION.minimumPublishableScore ? "نسبة الإكمال ضمن البوابة" : "نسبة الإكمال أقل من بوابة 80%",
          failureRate <= LAUNCH_TEMPLATE_MAX_FAILURE_RATE ? "الفشل/الاسترداد تحت السيطرة" : "الفشل أو الاسترداد مرتفع",
          avgCostUsd === null || avgCostUsd <= LAUNCH_TEMPLATE_MAX_AVG_COST_USD ? "التكلفة مستقرة" : "متوسط التكلفة أعلى من الحد التشغيلي",
        ];
        const minSampleReached = item.total >= LAUNCH_TEMPLATE_MIN_SAMPLE_SIZE;
        const expansionEligible = minSampleReached && publishableRate >= SAUDI_VIDEO_LAUNCH_DECISION.minimumPublishableScore && failureRate <= LAUNCH_TEMPLATE_MAX_FAILURE_RATE && (avgCostUsd === null || avgCostUsd <= LAUNCH_TEMPLATE_MAX_AVG_COST_USD);
        return { templateId, total: item.total, completed: item.completed, processing: item.processing, refunded: item.refunded, failed: item.failed, publishableRate, failureRate, avgCostUsd, minSampleReached, expansionEligible, decision: expansionEligible ? "eligible" : minSampleReached ? "watch" : "collecting", gateNotes, lastAt: item.lastAt } satisfies SaudiLaunchTemplatePerformance;
      }).sort((a, b) => Number(b.expansionEligible) - Number(a.expansionEligible) || b.total - a.total || b.publishableRate - a.publishableRate),
    };
  });

export const updateVideoProviderConfig = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ProviderUpdateInput.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ provider: AdminVideoProviderConfig }> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    const patch: Record<string, unknown> = {};
    if (typeof data.enabled === "boolean") patch.enabled = data.enabled;
    if (typeof data.publicEnabled === "boolean") patch.public_enabled = data.publicEnabled;
    if (typeof data.priority === "number") patch.priority = data.priority;
    if (typeof data.cost5s === "number") patch.cost_5s = data.cost5s;
    if (typeof data.cost8s === "number") patch.cost_8s = data.cost8s;
    if (Object.keys(patch).length === 0) throw new Error("لا توجد تغييرات للحفظ");

    const { data: updated, error } = await (await getSupabaseAdmin() as unknown as {
      from: (table: string) => { update: (values: Record<string, unknown>) => { eq: (column: string, value: string) => { select: (columns: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> } } } };
    })
      .from("video_provider_configs")
      .update(patch)
      .eq("provider_key", data.providerKey)
      .select("provider_key, display_name_admin, enabled, public_enabled, supported_qualities, priority, cost_5s, cost_8s, supports_9_16, supports_1_1, supports_16_9, supports_starting_frame, mode, health_status, last_success_at, last_error_at, last_error_message, metadata, updated_at")
      .single();

    if (error || !updated) throw new Error(`فشل حفظ إعدادات المزود: ${error?.message ?? "استجابة فارغة"}`);
    await logAdminAudit({
      adminId: userId,
      action: "update_video_provider_config",
      targetTable: "video_provider_configs",
      targetId: data.providerKey,
      after: patch as Json,
    });
    return { provider: updated as AdminVideoProviderConfig };
  });

export const testVideoProviderConnection = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TestProviderInput.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ provider: AdminVideoProviderConfig; result: AdminVideoProviderTestResult }> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    const { data: current, error: readError } = await (await getSupabaseAdmin() as unknown as {
      from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> } } };
    })
      .from("video_provider_configs")
      .select("provider_key, display_name_admin, enabled, public_enabled, supported_qualities, priority, cost_5s, cost_8s, supports_9_16, supports_1_1, supports_16_9, supports_starting_frame, mode, health_status, last_success_at, last_error_at, last_error_message, metadata, updated_at")
      .eq("provider_key", data.providerKey)
      .single();
    if (readError || !current) throw new Error(`فشل جلب المزود: ${readError?.message ?? "غير موجود"}`);

    const provider = current as AdminVideoProviderConfig;
    const startedAt = Date.now();
    const checkedAt = new Date().toISOString();
    let result: AdminVideoProviderTestResult;

    if (!provider.enabled) {
      result = { providerKey: provider.provider_key, ok: false, status: "unhealthy", latencyMs: Date.now() - startedAt, message: "المزود متوقف داخلياً", checkedAt };
    } else if (provider.mode === "manual" || provider.mode === "bridge") {
      result = { providerKey: provider.provider_key, ok: true, status: "manual_required", latencyMs: Date.now() - startedAt, message: "الجسر اليدوي جاهز ويحتاج تنفيذ بشري عند الطلب", checkedAt };
    } else if (providerSecretName(provider.provider_key)) {
      const secretName = providerSecretName(provider.provider_key)!;
      const tokenReady = Boolean(process.env[secretName]);
      const implemented = provider.provider_key === "fal_ai";
      const liveProbe = tokenReady && implemented ? await probeFalToken(process.env[secretName]!) : null;
      result = {
        providerKey: provider.provider_key,
        ok: Boolean(tokenReady && implemented && liveProbe?.ok),
        status: tokenReady && implemented && liveProbe?.ok ? "active" : "unhealthy",
        latencyMs: Date.now() - startedAt,
        message: !tokenReady ? `مفتاح ${secretName} غير متوفر` : implemented ? liveProbe?.message ?? "تعذر فحص مفتاح المزود" : "المفتاح موجود لكن موصل التنفيذ لم يُفعّل بعد",
        checkedAt,
      };
    } else {
      result = { providerKey: provider.provider_key, ok: false, status: "unhealthy", latencyMs: Date.now() - startedAt, message: "المزود غير موصول براوتر التنفيذ بعد", checkedAt };
    }

    const patch = {
      health_status: result.status,
      last_success_at: result.ok ? result.checkedAt : provider.last_success_at,
      last_error_at: result.ok ? null : result.checkedAt,
      last_error_message: result.ok ? null : result.message,
      metadata: appendConnectionTest(provider.metadata, result),
    };

    const { data: updated, error } = await (await getSupabaseAdmin() as unknown as {
      from: (table: string) => { update: (values: Record<string, unknown>) => { eq: (column: string, value: string) => { select: (columns: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> } } } };
    })
      .from("video_provider_configs")
      .update(patch)
      .eq("provider_key", provider.provider_key)
      .select("provider_key, display_name_admin, enabled, public_enabled, supported_qualities, priority, cost_5s, cost_8s, supports_9_16, supports_1_1, supports_16_9, supports_starting_frame, mode, health_status, last_success_at, last_error_at, last_error_message, metadata, updated_at")
      .single();
    if (error || !updated) throw new Error(`فشل حفظ نتيجة الاختبار: ${error?.message ?? "استجابة فارغة"}`);

    await logAdminAudit({ adminId: userId, action: "test_video_provider_connection", targetTable: "video_provider_configs", targetId: provider.provider_key, after: result as unknown as Json });
    return { provider: updated as AdminVideoProviderConfig, result };
  });

export const previewSaudiFalVideoTestPrompt = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SaudiFalPromptPreviewInput.parse(input ?? {}))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<SaudiFalPromptPreview> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    const model = FAL_VIDEO_TEST_MODELS.find((item) => item.id === data.modelId) ?? FAL_VIDEO_TEST_MODELS[0];
    const persona = SAUDI_VIDEO_PERSONAS.find((item) => item.id === data.personaId) ?? SAUDI_VIDEO_PERSONAS[0];
    const scenario = SAUDI_VIDEO_TEST_SCENARIOS.find((item) => item.id === data.scenarioId) ?? SAUDI_VIDEO_TEST_SCENARIOS[0];
    const prompt = buildSaudiFalTestPrompt({ personaBrief: persona.brief, scenarioId: scenario.id, includeProductImage: data.includeProductImage, includeVoice: data.includeVoice && model.supportsVoice });
    const imageEvaluation = evaluateSaudiVideoImage({ hasProductImage: data.includeProductImage, personaLabel: persona.label });

    return { prompt, model, persona, scenario, imageEvaluation };
  });

export const runSaudiFalVideoModelTest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SaudiFalModelTestInput.parse(input ?? {}))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<SaudiFalModelTestResult> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);
    const token = process.env.FAL_API_KEY;
    if (!token) throw new Error("مفتاح fal.ai غير متوفر في الأسرار");

    const model = FAL_VIDEO_TEST_MODELS.find((item) => item.id === data.modelId) ?? FAL_VIDEO_TEST_MODELS[0];
    const persona = SAUDI_VIDEO_PERSONAS.find((item) => item.id === data.personaId) ?? SAUDI_VIDEO_PERSONAS[0];
    const scenario = SAUDI_VIDEO_TEST_SCENARIOS.find((item) => item.id === data.scenarioId) ?? SAUDI_VIDEO_TEST_SCENARIOS[0];
    const includeProductImage = Boolean(data.includeProductImage && data.productImageUrl && model.supportsProductImage);
    const prompt = buildSaudiFalTestPrompt({ personaBrief: persona.brief, scenarioId: scenario.id, includeProductImage, includeVoice: data.includeVoice && model.supportsVoice });
    const imageEvaluation = evaluateSaudiVideoImage({ hasProductImage: includeProductImage, personaLabel: persona.label });
    const startedAt = Date.now();
    const checkedAt = new Date().toISOString();

    try {
      const response = await fetch(`https://queue.fal.run/${model.id}`, {
        method: "POST",
        headers: { Authorization: `Key ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          aspect_ratio: "9:16",
          duration: 5,
          resolution: "540p",
          image_url: includeProductImage ? data.productImageUrl : data.personaImageUrl,
          negative_prompt: "distorted face, deformed hands, unreadable Arabic text, white cutout background, unrealistic product",
          generate_audio_switch: model.supportsVoice,
          generate_multi_clip_switch: true,
          thinking_type: "enabled",
        }),
      });
      const text = await response.text();
      let result: { request_id?: string; response_url?: string; status_url?: string; video?: { url?: string }; video_url?: string; url?: string; error?: string } = {};
      try { result = text ? JSON.parse(text) as typeof result : {}; } catch { result = { error: text.slice(0, 500) }; }
      if (!response.ok || result.error) throw new Error(result.error || `fal.ai ${response.status}: ${text.slice(0, 500)}`);
      const immediateUrl = extractFalVideoUrl(result);
      const polled = immediateUrl ? { status: "completed" as const, resultUrl: immediateUrl, error: null } : await pollFalQueueResult(token, result.status_url, result.response_url);
      const out = { ok: polled.status !== "failed", status: polled.status, requestId: result.request_id ?? null, resultUrl: polled.resultUrl, latencyMs: Date.now() - startedAt, estimatedCostUsd: model.estimatedUsd, error: polled.error, checkedAt, prompt, model, persona, scenario, imageEvaluation } satisfies SaudiFalModelTestResult;
      await logAdminAudit({ adminId: userId, action: "run_saudi_fal_video_model_test", targetTable: "video_provider_configs", targetId: model.id, after: out as unknown as Json });
      return out;
    } catch (error) {
      const out = { ok: false, status: "failed", requestId: null, resultUrl: null, latencyMs: Date.now() - startedAt, estimatedCostUsd: model.estimatedUsd, error: errorMessage(error), checkedAt, prompt, model, persona, scenario, imageEvaluation } satisfies SaudiFalModelTestResult;
      await logAdminAudit({ adminId: userId, action: "run_saudi_fal_video_model_test_failed", targetTable: "video_provider_configs", targetId: model.id, after: out as unknown as Json });
      return out;
    }
  });

export const testVideoRouterDryRun = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TestVideoRouterInput.parse(input ?? {}))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<AdminVideoRouterTestResult> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    const { data: rows, error } = await (await getSupabaseAdmin() as unknown as {
      from: (table: string) => { select: (columns: string) => { order: (column: string, opts: { ascending: boolean }) => Promise<{ data: unknown; error: { message: string } | null }> } };
    })
      .from("video_provider_configs")
      .select("provider_key, display_name_admin, enabled, public_enabled, supported_qualities, priority, cost_5s, cost_8s, supports_9_16, supports_1_1, supports_16_9, supports_starting_frame, mode, health_status, last_success_at, last_error_at, last_error_message, metadata, updated_at")
      .order("priority", { ascending: true });
    if (error) throw new Error(`فشل اختبار الراوتر: ${error.message}`);

    const providers = ((rows as AdminVideoProviderConfig[] | null) ?? []).sort((a, b) => providerPriorityScore(a) - providerPriorityScore(b));
    const candidates = providers.map((provider) => {
      const readiness = providerEligibleForInput(provider, data);
      return { providerKey: provider.provider_key, displayName: provider.display_name_admin, priority: provider.priority, effectivePriority: providerPriorityScore(provider), mode: provider.mode, eligible: readiness.eligible, reason: readiness.reason };
    });
    const selected = candidates.find((candidate) => candidate.eligible) ?? null;
    const result = { ok: Boolean(selected), selectedProvider: selected?.providerKey ?? null, checkedAt: new Date().toISOString(), candidates };

    await logAdminAudit({ adminId: userId, action: "test_video_router_dry_run", targetTable: "video_provider_configs", targetId: selected?.providerKey ?? "none", after: result as unknown as Json });
    return result;
  });

export const auditSaudiVideoPilotLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SaudiVideoPilotAuditResult> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    const findings = SAUDI_VIDEO_PROMPT_TEMPLATES.map((template) => {
      const issues: string[] = [];
      const prompt = template.prompt;
      if (!/الصوت:/.test(prompt)) issues.push("لا يحتوي تعليمات صوت واضحة");
      if (!/تجنب:/.test(prompt)) issues.push("لا يحتوي قيود منع التشوهات");
      if (!/النصوص العربية المرئية/.test(prompt)) issues.push("لا يمنع النص العربي المرئي بوضوح");
      if (!/المنتج/.test(prompt)) issues.push("تركيز المنتج غير كافٍ");
      if (prompt.length < 280) issues.push("البرومبت قصير وقد يعطي نتيجة عامة");
      const score = Math.max(0, 100 - issues.length * 14 - (template.risk === "عالٍ" ? 8 : template.risk === "متوسط" ? 3 : 0));
      return {
        templateId: template.id,
        label: template.label,
        sector: template.sector,
        risk: template.risk,
        score,
        issues,
        recommendation: issues.length === 0 ? "جاهز للاختبار العملي" : "راجعه قبل اعتماده ضمن عينات الإطلاق",
      };
    });
    const passCount = findings.filter((item) => item.score >= 80).length;
    const result: SaudiVideoPilotAuditResult = {
      checkedAt: new Date().toISOString(),
      totalTemplates: findings.length,
      passCount,
      passRate: Math.round((passCount / Math.max(findings.length, 1)) * 100),
      readyForPilot: passCount >= 24,
      sectorCoverage: Array.from(new Set(findings.map((item) => item.sector))).sort((a, b) => a.localeCompare(b, "ar")),
      riskMix: findings.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.risk]: (acc[item.risk] ?? 0) + 1 }), {}),
      findings,
    };

    await logAdminAudit({ adminId: userId, action: "audit_saudi_video_pilot_library", targetTable: "video_provider_configs", targetId: "saudi_prompt_library", after: result as unknown as Json });
    return result;
  });

export const buildSaudiVideoPilotMatrix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SaudiVideoPilotMatrixResult> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    const samples = SAUDI_VIDEO_MEDIUM_TEST_TEMPLATE_IDS.map((_, index) => buildSaudiVideoMediumTestSample(index));
    const result: SaudiVideoPilotMatrixResult = {
      checkedAt: new Date().toISOString(),
      testLevel: "medium",
      totalSamples: samples.length,
      estimatedCostUsd: Number(samples.reduce((sum, sample) => sum + (sample.quality === "quality" ? 0.45 : sample.quality === "lite" ? 0.25 : 0.2), 0).toFixed(2)),
      requiredPublishableRate: 80,
      readinessGate: `اختبار متوسط ${SAUDI_VIDEO_MEDIUM_TEST_PLAN.sampleRange} عينة بتكلفة تقريبية ${SAUDI_VIDEO_MEDIUM_TEST_PLAN.estimatedCostUsd}$: لا نفتح القوالب الاحتياطية إلا بعد قياس تنفيذ البرومبت بدقة؛ ${SAUDI_VIDEO_MEDIUM_TEST_PLAN.decisionGate}`,
      samples,
    };

    await logAdminAudit({ adminId: userId, action: "build_saudi_video_pilot_matrix", targetTable: "video_provider_configs", targetId: "saudi_pilot_matrix", after: result as unknown as Json });
    return result;
  });

export const auditSaudiVideoMediumBatch = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AuditMediumBatchInput.parse(input ?? {}))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<SaudiVideoMediumBatchResult> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);
    const staleInProgressCutoffMs = Date.now() - 45 * 60 * 1000;

    const { data: rows, error } = await (await getSupabaseAdmin() as unknown as {
      from: (table: string) => { select: (columns: string) => { contains: (column: string, value: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> } };
    })
      .from("video_jobs")
      .select("id, status, result_url, credits_charged, estimated_cost_usd, product_image_url, error_message, metadata, created_at, quality, duration_seconds, aspect_ratio, selected_persona_id")
      .contains("metadata", { medium_test: true });
    if (error) throw new Error(`فشل تدقيق دفعة الاختبار المتوسط: ${error.message}`);

    const { data: providerRows, error: providerError } = await (await getSupabaseAdmin() as unknown as {
      from: (table: string) => { select: (columns: string) => { order: (column: string, options?: { ascending?: boolean }) => Promise<{ data: unknown; error: { message: string } | null }> } };
    })
      .from("video_provider_configs")
      .select("provider_key, display_name_admin, enabled, public_enabled, health_status, priority")
      .order("priority", { ascending: true });
    if (providerError) throw new Error(`فشل تدقيق جاهزية مزود الفيديو: ${providerError.message}`);
    const activeProvider = ((providerRows as MediumAuditProvider[] | null) ?? []).find((provider) => provider.enabled && provider.public_enabled) ?? null;
    const activeProviderHealthy = Boolean(activeProvider && activeProvider.health_status === "active");

    const jobsBySample = new Map<string, MediumAuditJob>();
    const mismatchedJobsBySample = new Map<string, Pick<VideoJobRow, "id" | "created_at">>();
    for (const row of (rows as MediumAuditJob[] | null) ?? []) {
      const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
      const sampleId = typeof metadata.medium_test_sample_id === "string" ? metadata.medium_test_sample_id : "";
      const templateId = typeof metadata.medium_test_template_id === "string" ? metadata.medium_test_template_id : "";
      const sampleNumber = Number(sampleId.replace("pilot-", ""));
      const expectedTemplateId = Number.isInteger(sampleNumber) ? SAUDI_VIDEO_MEDIUM_TEST_TEMPLATE_IDS[sampleNumber - 1] : undefined;
      if (!sampleId || !expectedTemplateId) continue;
      if (templateId !== expectedTemplateId) {
        const currentMismatch = mismatchedJobsBySample.get(sampleId);
        if (!currentMismatch || new Date(row.created_at).getTime() > new Date(currentMismatch.created_at).getTime()) mismatchedJobsBySample.set(sampleId, row);
        continue;
      }
      const current = jobsBySample.get(sampleId);
      if (!current || new Date(row.created_at).getTime() > new Date(current.created_at).getTime()) jobsBySample.set(sampleId, row);
    }

    const samples = SAUDI_VIDEO_MEDIUM_TEST_TEMPLATE_IDS.map((templateId, index) => {
      const plannedSample = buildSaudiVideoMediumTestSample(index);
      const { quality, durationSeconds, sampleId, expectedAspectRatio } = plannedSample;
      const expectedPersonaId = plannedSample.personaId;
      const job = jobsBySample.get(sampleId) ?? null;
      const mismatchedJob = mismatchedJobsBySample.get(sampleId) ?? null;
      const newerMetadataMismatch = Boolean(mismatchedJob && (!job || new Date(mismatchedJob.created_at).getTime() > new Date(job.created_at).getTime()));
      const metadata = (job?.metadata as Record<string, unknown> | null) ?? {};
      const evaluation = (metadata.medium_test_evaluation as { score?: unknown } | null) ?? null;
      const releaseDecision: "publishable" | "minor_revision" | "reject_or_reprompt" | null = metadata.medium_test_release_decision === "publishable" || metadata.medium_test_release_decision === "minor_revision" || metadata.medium_test_release_decision === "reject_or_reprompt" ? metadata.medium_test_release_decision : null;
      const requiredProductImage = plannedSample.requiresProductImage;
      const missingProductImage = Boolean(job && requiredProductImage && !job.product_image_url);
      const configurationMismatch = Boolean(job && (job.quality !== quality || job.duration_seconds !== durationSeconds || job.aspect_ratio !== expectedAspectRatio || job.selected_persona_id !== expectedPersonaId));
      const staleInProgress = Boolean(job && (job.status === "pending" || job.status === "processing") && new Date(job.created_at).getTime() < staleInProgressCutoffMs);
      const status: VideoJobStatus | "not_generated" = job?.status ?? "not_generated";
      return {
        sampleId,
        templateId: plannedSample.templateId,
        label: plannedSample.label,
        sector: plannedSample.sector,
        personaId: plannedSample.personaId,
        requiredProductImage,
        jobId: job?.id ?? null,
        status,
        resultUrl: job?.result_url ?? null,
        creditsCharged: job?.credits_charged ?? null,
        estimatedCostUsd: job?.estimated_cost_usd === null || job?.estimated_cost_usd === undefined ? null : Number(job.estimated_cost_usd),
        evaluationScore: typeof evaluation?.score === "number" ? evaluation.score : null,
        releaseDecision,
        createdAt: job?.created_at ?? null,
        issue: newerMetadataMismatch
          ? "آخر مهمة موسومة لهذه العينة لا تطابق قالب المصفوفة الرسمي"
          : !job
          ? "لم تُولد العينة بعد"
          : configurationMismatch
            ? "إعدادات التوليد لا تطابق مصفوفة الاختبار الرسمية"
            : job.status === "completed" && !job.result_url
              ? "العينة مكتملة بلا رابط نتيجة وتحتاج إعادة توليد أو إصلاح الربط"
            : staleInProgress
              ? "العينة عالقة قيد المعالجة لأكثر من 45 دقيقة وتحتاج فحص المزود أو إعادة التشغيل"
            : missingProductImage
              ? "صورة المنتج الإلزامية غير مرفقة"
              : job.status === "failed" || job.status === "refunded" || job.status === "cancelled"
                ? job.error_message ?? "العينة فشلت أو أُلغيت/استُردت وتحتاج إعادة توليد"
                : job.error_message,
      };
    });
    const generated = samples.filter((sample) => sample.jobId).length;
    const completed = samples.filter((sample) => sample.status === "completed" && sample.resultUrl).length;
    const processing = samples.filter((sample) => sample.status === "processing" || sample.status === "pending").length;
    const failedOrRefunded = samples.filter((sample) => sample.status === "failed" || sample.status === "refunded" || sample.status === "cancelled").length;
    const completedWithoutResult = samples.filter((sample) => sample.issue === "العينة مكتملة بلا رابط نتيجة وتحتاج إعادة توليد أو إصلاح الربط").length;
    const staleInProgress = samples.filter((sample) => sample.issue === "العينة عالقة قيد المعالجة لأكثر من 45 دقيقة وتحتاج فحص المزود أو إعادة التشغيل").length;
    const missingProductImage = samples.filter((sample) => sample.issue === "صورة المنتج الإلزامية غير مرفقة").length;
    const metadataMismatch = samples.filter((sample) => sample.issue === "آخر مهمة موسومة لهذه العينة لا تطابق قالب المصفوفة الرسمي").length;
    const configurationMismatch = samples.filter((sample) => sample.issue === "إعدادات التوليد لا تطابق مصفوفة الاختبار الرسمية").length;
    const remainingToGenerate = samples.length - generated;
    const executionRate = Math.round((generated / Math.max(samples.length, 1)) * 100);
    const completionRate = Math.round((completed / Math.max(samples.length, 1)) * 100);
    const evaluated = samples.filter((sample) => sample.releaseDecision).length;
    const publishable = samples.filter((sample) => sample.releaseDecision === "publishable").length;
    const needsRevision = samples.filter((sample) => sample.releaseDecision === "minor_revision").length;
    const rejected = samples.filter((sample) => sample.releaseDecision === "reject_or_reprompt").length;
    const cleanCompletedSamples = samples.filter((sample) => sample.status === "completed" && sample.resultUrl && !sample.issue);
    const remainingToEvaluate = cleanCompletedSamples.filter((sample) => !sample.releaseDecision).length;
    const operationalBlockingIssues = missingProductImage + failedOrRefunded + completedWithoutResult + staleInProgress + metadataMismatch + configurationMismatch;
    const commercialRejectedIssues = rejected + needsRevision;
    const blockingIssues = operationalBlockingIssues + commercialRejectedIssues;
    const minimumPublishable = Math.ceil(samples.length * 0.8);
    const commercialValidityRate = Math.round((publishable / Math.max(samples.length, 1)) * 100);
    const releaseGate: SaudiVideoMediumBatchResult["releaseGate"] = operationalBlockingIssues > 0 ? "blocked" : commercialRejectedIssues > 0 ? "needs_iteration" : generated === 0 ? "not_started" : evaluated === samples.length && publishable >= minimumPublishable ? "ready_for_expansion" : evaluated === samples.length ? "needs_iteration" : completed === samples.length ? "ready_for_review" : "running";
    const releaseGateReason = releaseGate === "not_started"
      ? "لم تُسجّل أي مهمة موسومة للاختبار المتوسط بعد؛ لا يوجد دليل عملي يسمح بقرار تجاري."
      : releaseGate === "blocked"
        ? "الدفعة متوقفة تشغيلياً بسبب فشل/استرداد أو اكتمال بلا رابط أو مهمة عالقة أو نقص صورة منتج أو عدم تطابق الوسم/الإعدادات مع المصفوفة؛ أصلح العينة قبل احتساب القرار التجاري."
        : releaseGate === "ready_for_expansion"
          ? "اكتمل تقييم الدفعة وحققت بوابة 80%+؛ القوالب الصالحة جاهزة لاختبار تكرار أوسع قبل الفتح العام."
        : releaseGate === "needs_iteration"
          ? evaluated < samples.length ? "ظهرت عينة تحتاج تحسيناً أو إعادة برومبت قبل اكتمال التقييم؛ لا توسع قبل إعادة توليدها ثم إكمال تقييم بقية العينات." : "اكتمل التقييم لكن نسبة القوالب الصالحة أقل من بوابة 80%؛ يلزم ضبط البرومبتات قبل أي توسع."
        : releaseGate === "ready_for_review"
          ? "كل العينات المخططة اكتملت ولديها نتائج؛ انتقل الآن إلى تقييم كل فيديو ببوابة 80%+."
          : "الدفعة بدأت لكنها لم تكتمل؛ أكمل توليد العينات الناقصة أو حدّث المهام قيد المعالجة.";
    const nextAction = releaseGate === "not_started"
      ? "افتح مصفوفة الاختبار، ولّد العينات بالترتيب من pilot-01 إلى pilot-12، وارفع صورة منتج لكل عينة موسومة كإلزامية."
      : releaseGate === "blocked"
        ? "أصلح العينات المتوقفة أولاً: أعد توليد ما فشل أو علق أكثر من 45 دقيقة، وأصلح النتائج المكتملة بلا رابط، وأرفق صورة منتج واضحة، وأعد توليد أي عينة لا تطابق مصفوفتها الرسمية قبل التقييم."
        : releaseGate === "ready_for_expansion"
          ? "انقل العينات القابلة للنشر فقط إلى اختبار 5 عينات إضافية لكل قالب، واترك القوالب ذات التعديل أو الرفض مخفية."
        : releaseGate === "needs_iteration"
          ? evaluated < samples.length ? "أعد توليد العينات ذات قرار التحسين/الرفض أولاً، ثم أكمل تقييم العينات النظيفة المتبقية قبل أي قرار توسع." : "ابدأ بإعادة صياغة عينات التعديل، ثم أعد توليدها كدفعة مصغرة قبل تكرار اختبار التوسيع."
        : releaseGate === "ready_for_review"
          ? "قيّم كل عينة عبر نموذج التقييم: المنتج، المشهد، الحركة، اللهجة، الممنوعات، وقابلية النشر؛ لا تعتمد إلا 80%+."
          : "تابع توليد العينات غير المكتملة ثم اضغط تدقيق الدفعة حتى تتحول الحالة إلى جاهزة للتقييم.";
    const readinessWarnings = [
      !activeProvider ? "لا يوجد مزود فيديو مفعّل ومتاح للعامة قبل تشغيل الدفعة." : null,
      activeProvider && !activeProviderHealthy ? `المزود النشط (${activeProvider.display_name_admin}) حالته ${activeProvider.health_status} وليست active.` : null,
      processing >= 2 ? "يوجد حد معالجة ممتلئ تقريباً؛ لا تبدأ عينات جديدة قبل اكتمال مهمة جارية." : null,
    ].filter(Boolean) as string[];
    const result: SaudiVideoMediumBatchResult = { checkedAt: new Date().toISOString(), totalPlanned: samples.length, generated, completed, evaluated, publishable, needsRevision, rejected, minimumPublishable, commercialValidityRate, processing, failedOrRefunded, completedWithoutResult, staleInProgress, missingProductImage, metadataMismatch, configurationMismatch, remainingToGenerate, remainingToEvaluate, operationalBlockingIssues, commercialRejectedIssues, blockingIssues, estimatedCostUsd: Number(samples.reduce((sum, sample) => sum + (sample.estimatedCostUsd ?? 0), 0).toFixed(2)), activeProviderLabel: activeProvider?.display_name_admin ?? null, activeProviderHealthy, readinessWarnings, executionRate, completionRate, releaseGate, releaseGateReason, nextAction, samples };

    if (data.auditLog) await logAdminAudit({ adminId: userId, action: "audit_saudi_video_medium_batch", targetTable: "video_jobs", targetId: "saudi_medium_batch", after: result as unknown as Json });
    return result;
  });

export const evaluateSaudiVideoPilotSample = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EvaluatePilotSampleInput.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<SaudiVideoPilotEvaluationResult> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);
    const admin = await getSupabaseAdmin();
    const sampleNumber = Number(data.sampleId.replace("pilot-", ""));
    const expectedSample = buildSaudiVideoMediumTestSample(sampleNumber - 1);
    const expectedTemplateId = expectedSample.templateId;
    await assertPilotBatchReadyForEvaluation(admin);
    const { data: latestSampleJobs, error: latestSampleError } = await admin
      .from("video_jobs")
      .select("id, status, result_url, product_image_url, metadata, created_at, quality, duration_seconds, aspect_ratio, selected_persona_id")
      .contains("metadata", { medium_test: true, medium_test_sample_id: data.sampleId })
      .order("created_at", { ascending: false })
      .limit(1);
    if (latestSampleError) throw new Error(`فشل التحقق من آخر مهمة للعينة قبل التقييم: ${latestSampleError.message}`);
    const latestSampleJob = latestSampleJobs?.[0] as Pick<VideoJobRow, "id" | "status" | "result_url" | "product_image_url" | "metadata" | "created_at" | "quality" | "duration_seconds" | "aspect_ratio" | "selected_persona_id"> | undefined;
    const latestSampleMetadata = (latestSampleJob?.metadata as Record<string, unknown> | null) ?? {};
    if (latestSampleJob && latestSampleMetadata.medium_test_template_id !== expectedTemplateId) {
      throw new Error("لا يمكن تقييم العينة لأن آخر مهمة موسومة لها لا تطابق قالب المصفوفة الرسمي؛ أعد فتح العينة من لوحة الإدارة وشغّلها من الرابط الرسمي.");
    }
    const { data: jobs, error: jobsError } = await admin
      .from("video_jobs")
      .select("id, status, result_url, product_image_url, metadata, created_at, quality, duration_seconds, aspect_ratio, selected_persona_id")
      .contains("metadata", { medium_test: true, medium_test_sample_id: data.sampleId, medium_test_template_id: expectedTemplateId })
      .order("created_at", { ascending: false })
      .limit(1);
    if (jobsError) throw new Error(`فشل تحميل مهمة العينة الرسمية قبل التقييم: ${jobsError.message}`);
    const job = jobs?.[0] as Pick<VideoJobRow, "id" | "status" | "result_url" | "product_image_url" | "metadata" | "created_at" | "quality" | "duration_seconds" | "aspect_ratio" | "selected_persona_id"> | undefined;
    if (!job) throw new Error("لا يمكن تقييم عينة لم تُولد بعد ضمن مصفوفة الاختبار المتوسط الرسمية.");
    if (job.status !== "completed" || !job.result_url) throw new Error("لا يمكن تقييم العينة قبل اكتمال الفيديو ووجود رابط نتيجة صالح.");
    if (job.quality !== expectedSample.quality || job.duration_seconds !== expectedSample.durationSeconds || job.aspect_ratio !== expectedSample.expectedAspectRatio || job.selected_persona_id !== expectedSample.personaId) throw new Error("لا يمكن تقييم عينة لا تطابق جودة/مدة/مقاس/شخصية مصفوفة الاختبار الرسمية.");
    if (expectedSample.requiresProductImage && !job.product_image_url) throw new Error("لا يمكن تقييم عينة إعلانية/احترافية دون صورة منتج فعلية.");
    if (data.resultUrl && data.resultUrl !== job.result_url) throw new Error("رابط النتيجة لا يطابق آخر فيديو رسمي لهذه العينة.");
    const metadata = (job.metadata as Record<string, unknown> | null) ?? {};
    if (metadata.medium_test_release_decision || metadata.medium_test_evaluation) throw new Error("هذه العينة تم تقييمها بالفعل؛ أعد توليدها كمهمة جديدة إذا أردت قراراً تجارياً مختلفاً.");
    const weights = { productClarity: 25, sceneAdherence: 20, motionAdherence: 15, saudiDialect: 15, negativeSafety: 15, publishReadiness: 10 } as const;
    const weightedScore =
      data.productClarity * weights.productClarity +
      data.sceneAdherence * weights.sceneAdherence +
      data.motionAdherence * weights.motionAdherence +
      data.saudiDialect * weights.saudiDialect +
      data.negativeSafety * weights.negativeSafety +
      data.publishReadiness * weights.publishReadiness;
    const score = Math.round(weightedScore / 5);
    const hardFail = data.productClarity <= 2 || data.saudiDialect <= 2 || data.negativeSafety <= 2;
    const decision = hardFail ? "reject_or_reprompt" : score >= 80 ? "publishable" : score >= 65 ? "minor_revision" : "reject_or_reprompt";
    const gateReason = hardFail ? "رفض مؤقت: تجاهل المنتج أو الصوت أو ظهرت مخالفة/تشوه قوي." : score >= 80 ? "جاهز لتكرار أوسع ضمن بوابة 80%+." : score >= 65 ? "يحتاج ضبط برومبت قبل أي فتح عام." : "يبقى مخفياً ويعاد توليده بعد إعادة صياغة كبيرة.";
    const result = { ...data, resultUrl: data.resultUrl || undefined, notes: data.notes || undefined, score, decision, gateReason, evaluatedAt: new Date().toISOString() } satisfies SaudiVideoPilotEvaluationResult;
    const canonicalResult = { ...result, resultUrl: job.result_url } satisfies SaudiVideoPilotEvaluationResult;
    const { error: updateError } = await admin
      .from("video_jobs")
      .update({ metadata: { ...metadata, medium_test_evaluation: canonicalResult, medium_test_release_decision: decision, medium_test_evaluated_at: canonicalResult.evaluatedAt } as Json })
      .eq("id", job.id);
    if (updateError) throw new Error(`فشل حفظ تقييم العينة داخل مهمة الفيديو: ${updateError.message}`);
    await logAdminAudit({ adminId: userId, action: "evaluate_saudi_video_pilot_sample", targetTable: "video_jobs", targetId: job.id, after: canonicalResult as unknown as Json });
    return canonicalResult;
  });
