import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useRouter, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Clapperboard, Crown, Download, Film, ImageUp, Loader2, Megaphone, MonitorSmartphone, RefreshCw, Sparkles, Upload, Wand2, Zap } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/dashboard-shell";
import { CampaignContextBar } from "@/components/campaign-context-bar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QuotaExceededDialog, isQuotaError } from "@/components/quota-exceeded-dialog";
import { generateVideo, listVideoJobs, refreshVideoJob } from "@/server/video-functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics/posthog";
import { useCampaignContext } from "@/hooks/useCampaignContext";
import { useCreditsSummary } from "@/hooks/use-credits-summary";
import { campaignContextSummary, campaignSmartPromptFromContext, campaignVideoDefaults, parseCampaignExecutionSearch, resolveCampaignExecutionContext, type CampaignExecutionContext } from "@/lib/campaign-smart-context";
import { videoTierDuration } from "@/lib/plan-catalog";
import { SAUDI_VIDEO_LAUNCH_PROMPT_TEMPLATES, SAUDI_VIDEO_MEDIUM_TEST_TEMPLATE_IDS, SAUDI_VIDEO_PERSONAS, SAUDI_VIDEO_PROMPT_TEMPLATES, buildSaudiVideoMediumTestSample } from "@/lib/saudi-video-test";
import personaMaleYoung from "@/assets/saudi-persona-male-young.jpg";
import personaMalePremium from "@/assets/saudi-persona-male-premium.jpg";
import personaFemaleAbaya from "@/assets/saudi-persona-female-abaya.jpg";
import personaRetailSeller from "@/assets/saudi-persona-retail-seller.jpg";

type VideoQuality = "fast" | "lite" | "quality";
type AspectRatio = "9:16" | "1:1" | "16:9";
type VideoJob = Awaited<ReturnType<typeof listVideoJobs>>["jobs"][number];
type VideoSearch = CampaignExecutionContext & {
  __lovable_token?: string;
  prompt?: string;
  campaignId?: string;
  campaignPackId?: string;
  quality?: VideoQuality;
  aspectRatio?: AspectRatio;
  selectedPersonaId?: string;
  smart?: boolean;
  source?: "medium-test";
  mediumTestSampleId?: string;
  mediumTestTemplateId?: string;
  requiresProductImage?: boolean;
};

const QUALITY = {
  fast: { label: "سريع", icon: Zap, note: "للتجربة والمحتوى اليومي بتكلفة أقل" },
  lite: { label: "إعلاني", icon: Clapperboard, note: "لقطة بيع قصيرة للسوق السعودي" },
  quality: { label: "احترافي", icon: Crown, note: "لإعلانات Pro وBusiness عالية التحويل" },
} satisfies Record<VideoQuality, { label: string; icon: typeof Zap; note: string }>;

const PERSONA_IMAGES = {
  "male-young": personaMaleYoung,
  "male-premium": personaMalePremium,
  "female-abaya": personaFemaleAbaya,
  "retail-seller": personaRetailSeller,
} as const;

const PERSONAS = SAUDI_VIDEO_PERSONAS.map((persona) => ({ ...persona, image: PERSONA_IMAGES[persona.id] }));

const ASPECTS: Array<{ value: AspectRatio; label: string; hint: string }> = [
  { value: "9:16", label: "Reels / TikTok", hint: "عمودي" },
  { value: "1:1", label: "Feed", hint: "مربع" },
  { value: "16:9", label: "YouTube", hint: "أفقي" },
];

const STATUS_LABEL: Record<string, string> = {
  pending: "بانتظار المعالجة",
  processing: "قيد المعالجة",
  completed: "مكتمل",
  failed: "فشل",
  refunded: "تم رد النقاط",
};

function absoluteAssetUrl(value: string) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const origin = typeof window !== "undefined" ? window.location.origin : "https://rifd.site";
  return new URL(value, origin).toString();
}

const MEDIUM_TEST_PRODUCT_IMAGES: Partial<Record<string, string>> = {
  "pilot-05": "/medium-test-pilot-05-restaurant-v2.jpg",
  "pilot-06": "/medium-test-pilot-06-home-decor.jpg",
  "pilot-07": "/medium-test-pilot-07-bags.jpg",
  "pilot-08": "/medium-test-pilot-08-phone-case.jpg",
  "pilot-09": "/medium-test-pilot-09-ramadan-offer.jpg",
  "pilot-10": "/medium-test-pilot-10-eid-gift.jpg",
  "pilot-11": "/medium-test-pilot-11-kids-product.jpg",
  "pilot-12": "/medium-test-pilot-12-supplements.jpg",
};

async function imageUrlToDataUrl(value: string) {
  if (!value || value.startsWith("data:")) return value;
  const response = await fetch(absoluteAssetUrl(value));
  if (!response.ok) throw new Error("تعذر تجهيز صورة المنتج للفيديو. ارفع الصورة من جديد أو استخدم رابط صورة مباشر بصيغة JPEG/PNG/WebP ثم أعد المحاولة.");
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("تعذر تجهيز صورة المنتج للفيديو. ارفع الصورة من جديد أو استخدم رابط صورة مباشر بصيغة JPEG/PNG/WebP ثم أعد المحاولة."));
    reader.readAsDataURL(blob);
  });
}

export const Route = createFileRoute("/dashboard/generate-video")({
  head: () => ({ meta: [{ title: "أنشئ فيديو قصير — رِفد" }] }),
  validateSearch: (s: Record<string, unknown>): VideoSearch => ({
    __lovable_token: typeof s.__lovable_token === "string" ? s.__lovable_token : undefined,
    ...parseCampaignExecutionSearch(s),
    quality: s.quality === "fast" || s.quality === "lite" || s.quality === "quality" ? s.quality : undefined,
    aspectRatio: s.aspectRatio === "9:16" || s.aspectRatio === "1:1" || s.aspectRatio === "16:9" ? s.aspectRatio : undefined,
    selectedPersonaId: typeof s.selectedPersonaId === "string" ? s.selectedPersonaId : undefined,
    source: s.source === "medium-test" ? "medium-test" : undefined,
    mediumTestSampleId: typeof s.mediumTestSampleId === "string" ? s.mediumTestSampleId : undefined,
    mediumTestTemplateId: typeof s.mediumTestTemplateId === "string" ? s.mediumTestTemplateId : undefined,
    requiresProductImage: s.requiresProductImage === true || s.requiresProductImage === "true" ? true : undefined,
  }),
  component: GenerateVideoPage,
});

function ImageInputCard({ label, value, uploading, disabled = false, onFile, onUrl }: { label: string; value: string; uploading: boolean; disabled?: boolean; onFile: (file?: File) => void; onUrl: (value: string) => void }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-3">
      <Label>{label}</Label>
      <div className="mt-2 flex items-center gap-2">
        <label className={cn("inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-input px-3 text-xs font-bold hover:bg-accent", (uploading || disabled) && "pointer-events-none opacity-70")}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading || disabled} onChange={(event) => { onFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
        </label>
        <input value={value} onChange={(event) => onUrl(event.target.value)} disabled={disabled} placeholder="أو رابط صورة" className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-xs disabled:opacity-60" />
      </div>
      {value && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <img src={value} alt="معاينة الصورة المرفوعة" className="h-10 w-10 rounded-md border border-border object-cover" loading="lazy" />
          <span className="inline-flex items-center gap-1"><ImageUp className="h-3.5 w-3.5" /> الصورة جاهزة للاستخدام</span>
        </div>
      )}
    </div>
  );
}

function GenerateVideoPage() {
  const router = useRouter();
  const search = useSearch({ from: "/dashboard/generate-video" });
  const campaignContext = useCampaignContext({ campaignId: search.campaignId, campaignPackId: search.campaignPackId });
  const generateVideoFn = useServerFn(generateVideo);
  const listVideoJobsFn = useServerFn(listVideoJobs);
  const refreshVideoJobFn = useServerFn(refreshVideoJob);
  const { data: credits, loading: creditsLoading, refresh: refreshCredits } = useCreditsSummary();
  const [quality, setQuality] = useState<VideoQuality>(search.quality ?? "fast");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(search.aspectRatio ?? "9:16");
  const [prompt, setPrompt] = useState(search.prompt ?? "");
  const [startingFrameUrl, setStartingFrameUrl] = useState("");
  const [speakerImageUrl, setSpeakerImageUrl] = useState("");
  const [productImageUrl, setProductImageUrl] = useState("");
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(search.selectedPersonaId && PERSONAS.some((persona) => persona.id === search.selectedPersonaId) ? search.selectedPersonaId : PERSONAS[0].id);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(SAUDI_VIDEO_LAUNCH_PROMPT_TEMPLATES[0].id);
  const [uploadingInput, setUploadingInput] = useState<"speaker" | "product" | null>(null);
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [activeJob, setActiveJob] = useState<VideoJob | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [downloadingVideo, setDownloadingVideo] = useState(false);
  const [quotaDialog, setQuotaDialog] = useState<{ open: boolean; reason?: string }>({ open: false });
  const resolvedCampaignContext = resolveCampaignExecutionContext(campaignContext.campaign, search);

  const effectiveDurationSeconds = videoTierDuration(quality);
  const isPaidPlan = credits?.plan ? credits.plan !== "free" : false;
  const watermarkRequired = credits?.plan === "free";
  const internalMediumTestMode = search.source === "medium-test";
  const mediumTestCanonicalSample = useMemo(() => {
    if (!internalMediumTestMode || !search.mediumTestSampleId) return null;
    const sampleNumber = Number(search.mediumTestSampleId.replace("pilot-", ""));
    const sampleIndex = Number.isInteger(sampleNumber) ? sampleNumber - 1 : -1;
    if (sampleIndex < 0 || sampleIndex >= SAUDI_VIDEO_MEDIUM_TEST_TEMPLATE_IDS.length) return null;
    const sample = buildSaudiVideoMediumTestSample(sampleIndex);
    if (search.mediumTestTemplateId && search.mediumTestTemplateId !== sample.templateId) return null;
    return sample;
  }, [internalMediumTestMode, search.mediumTestSampleId, search.mediumTestTemplateId]);
  const mediumTestControlsLocked = internalMediumTestMode;
  const mediumTestProductImageRequired = Boolean(mediumTestCanonicalSample?.requiresProductImage);
  const canonicalProductImageUrl = productImageUrl.trim() || (internalMediumTestMode && mediumTestCanonicalSample ? MEDIUM_TEST_PRODUCT_IMAGES[mediumTestCanonicalSample.sampleId] ?? "" : "");
  const productImageRequired = (internalMediumTestMode ? mediumTestProductImageRequired : isPaidPlan) && !canonicalProductImageUrl;
  const selectedPersona = PERSONAS.find((persona) => persona.id === selectedPersonaId) ?? PERSONAS[0];
  const selectedTemplate = SAUDI_VIDEO_LAUNCH_PROMPT_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? SAUDI_VIDEO_LAUNCH_PROMPT_TEMPLATES[0];
  const mediumTestTemplate = internalMediumTestMode ? SAUDI_VIDEO_PROMPT_TEMPLATES.find((template) => template.id === mediumTestCanonicalSample?.templateId) : null;
  const canonicalGenerationPrompt = mediumTestCanonicalSample?.finalPrompt ?? prompt;
  const canonicalGenerationQuality = mediumTestCanonicalSample?.quality ?? quality;
  const canonicalGenerationAspectRatio = mediumTestCanonicalSample?.expectedAspectRatio ?? aspectRatio;
  const canonicalGenerationDurationSeconds = mediumTestCanonicalSample?.durationSeconds ?? effectiveDurationSeconds;
  const canonicalGenerationPersonaId = mediumTestCanonicalSample?.personaId ?? selectedPersonaId;
  const canonicalGenerationPersona = PERSONAS.find((persona) => persona.id === canonicalGenerationPersonaId) ?? selectedPersona;
  const canonicalCostKey = (canonicalGenerationQuality === "quality" ? "video_quality_8s" : canonicalGenerationQuality === "lite" ? "video_lite_8s" : "video_fast") as keyof NonNullable<typeof credits>["costs"];
  const canonicalSelectedCost = credits?.costs[canonicalCostKey] ?? 0;
  const canonicalQualityAllowed = canonicalGenerationQuality === "quality" ? (credits?.videoQualityAllowed ?? true) : (credits?.videoFastAllowed ?? true);
  const canonicalDurationAllowed = canonicalGenerationDurationSeconds <= (credits?.maxVideoDurationSeconds ?? 8);
  const canonicalHasEnoughCredits = credits ? credits.totalCredits >= canonicalSelectedCost : true;
  const activeJobInProgress = activeJob?.status === "pending" || activeJob?.status === "processing";
  const activeJobsCount = jobs.filter((job) => job.status === "pending" || job.status === "processing").length;
  const reachedConcurrentLimit = activeJobsCount >= 2;
  const visibleJobs = useMemo(() => {
    if (!internalMediumTestMode) return jobs;
    if (!mediumTestCanonicalSample) return [];
    return jobs.filter((job) => {
      const metadata = (job.metadata as Record<string, unknown> | null) ?? {};
      return metadata.medium_test === true && metadata.medium_test_sample_id === mediumTestCanonicalSample.sampleId && metadata.medium_test_template_id === mediumTestCanonicalSample.templateId;
    });
  }, [jobs, internalMediumTestMode, mediumTestCanonicalSample]);
  const visibleJobInProgress = visibleJobs.some((job) => job.status === "pending" || job.status === "processing");
  const latestResult = useMemo(() => {
    const syncedActiveJob = activeJob ? visibleJobs.find((job) => job.id === activeJob.id) : null;
    return syncedActiveJob?.result_url ?? visibleJobs.find((job) => job.status === "completed" && job.result_url)?.result_url ?? visibleJobs.find((job) => job.result_url)?.result_url ?? null;
  }, [activeJob, visibleJobs]);
  const promptCount = useMemo(() => canonicalGenerationPrompt.trim().length, [canonicalGenerationPrompt]);

  const applyTemplate = () => {
    setPrompt(selectedTemplate.prompt);
    toast.success("تم تطبيق قالب برومبت سعودي مدروس");
  };

  const loadJobs = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const out = await listVideoJobsFn({ headers: { Authorization: `Bearer ${session.access_token}` } });
      const scopedJobs = internalMediumTestMode && mediumTestCanonicalSample
        ? out.jobs.filter((job) => {
            const metadata = (job.metadata as Record<string, unknown> | null) ?? {};
            return metadata.medium_test === true && metadata.medium_test_sample_id === mediumTestCanonicalSample.sampleId && metadata.medium_test_template_id === mediumTestCanonicalSample.templateId;
          })
        : internalMediumTestMode ? [] : out.jobs;
      setJobs(scopedJobs);
      const syncedActiveJob = activeJob ? scopedJobs.find((job) => job.id === activeJob.id) : null;
      setActiveJob(syncedActiveJob ?? scopedJobs.find((job) => job.status === "pending" || job.status === "processing") ?? scopedJobs.find((job) => job.status === "completed" && job.result_url) ?? scopedJobs[0] ?? null);
    } catch {
      // لا نزعج المستخدم عند فشل تحميل السجل المصغر
    }
  }, [activeJob, internalMediumTestMode, listVideoJobsFn, mediumTestCanonicalSample]);

  const generate = async () => {
    if (canonicalGenerationPrompt.trim().length < 10) {
      toast.error("اكتب وصف فيديو أوضح");
      return;
    }
    if (!canonicalHasEnoughCredits) {
      setQuotaDialog({ open: true, reason: `INSUFFICIENT_CREDITS: رصيد نقاط الفيديو لا يكفي (تحتاج ${canonicalSelectedCost} نقطة فيديو).` });
      return;
    }
    if (!canonicalQualityAllowed || !canonicalDurationAllowed) {
      setQuotaDialog({ open: true, reason: !canonicalQualityAllowed ? "VIDEO_QUALITY_NOT_ALLOWED: الجودة الاحترافية غير متاحة في باقتك الحالية." : "VIDEO_DURATION_NOT_ALLOWED: مدة الفيديو غير متاحة في باقتك الحالية." });
      return;
    }
    if (productImageRequired) {
      toast.error(mediumTestProductImageRequired ? "صورة المنتج إلزامية لهذه العينة حتى يكون اختبار الالتزام عادلاً" : "صورة المنتج مطلوبة في الباقات المدفوعة حتى يظهر المنتج بوضوح داخل الإعلان");
      return;
    }
    if (internalMediumTestMode && !mediumTestCanonicalSample) {
      toast.error("رابط عينة الاختبار الداخلي غير مطابق للمصفوفة الرسمية");
      return;
    }
    setLoading(true);
    setQuotaDialog({ open: false });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("سجّل الدخول أولاً");
      const providerProductImageUrl = internalMediumTestMode && canonicalProductImageUrl ? await imageUrlToDataUrl(canonicalProductImageUrl) : productImageUrl.trim();
      const out = await generateVideoFn({
        data: { prompt: canonicalGenerationPrompt, quality: canonicalGenerationQuality, aspectRatio: canonicalGenerationAspectRatio, durationSeconds: canonicalGenerationDurationSeconds, startingFrameUrl: internalMediumTestMode ? "" : startingFrameUrl.trim(), speakerImageUrl: internalMediumTestMode ? "" : speakerImageUrl || absoluteAssetUrl(canonicalGenerationPersona.image), productImageUrl: providerProductImageUrl, selectedPersonaId: canonicalGenerationPersonaId, selectedTemplateId: internalMediumTestMode ? "custom" : selectedTemplateId, campaignId: campaignContext.campaignId ?? search.campaignId, campaignPackId: search.campaignPackId, source: search.source, mediumTestSampleId: mediumTestCanonicalSample?.sampleId, mediumTestTemplateId: mediumTestCanonicalSample?.templateId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setActiveJob(out.job);
      setJobs((current) => [out.job, ...current.filter((job) => job.id !== out.job.id)].slice(0, 20));
      track("generation_created", { kind: "video", quality: canonicalGenerationQuality, aspect_ratio: canonicalGenerationAspectRatio, credits: out.creditsCharged, template_id: internalMediumTestMode ? mediumTestCanonicalSample?.templateId ?? "medium-test" : selectedTemplateId, source: search.source });
      toast.success(out.pending ? "تم إنشاء مهمة الفيديو — جاري المعالجة" : "الفيديو جاهز ✨");
      if (out.job.status !== "pending" && out.job.status !== "processing") void refreshCredits();
      router.invalidate();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "فشل إنشاء الفيديو";
      if (isQuotaError(msg)) {
        setQuotaDialog({ open: true, reason: msg });
      } else {
        toast.error(msg);
      }
      track("generation_failed", { kind: "video", quality: canonicalGenerationQuality, aspect_ratio: canonicalGenerationAspectRatio, template_id: internalMediumTestMode ? mediumTestCanonicalSample?.templateId ?? "medium-test" : selectedTemplateId, reason: msg.slice(0, 120) });
    } finally {
      setLoading(false);
    }
  };

  const refreshActiveJob = useCallback(async (showToast = true) => {
    if (!activeJob) return;
    try {
      const previousStatus = activeJob.status;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("سجّل الدخول أولاً");
      const out = await refreshVideoJobFn({
        data: { jobId: activeJob.id },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setActiveJob(out.job);
      setJobs((current) => current.map((job) => job.id === out.job.id ? out.job : job));
      if (out.job.status !== "processing" && out.job.status !== "pending") void refreshCredits();
      if (out.job.status === "completed" && out.job.result_url && previousStatus !== "completed") toast.success("الفيديو جاهز للمعاينة والتحميل");
      else if (showToast) toast.success(out.job.status === "processing" || out.job.status === "pending" ? "الفيديو ما زال قيد المعالجة" : "تم تحديث حالة الفيديو");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل تحديث حالة الفيديو");
    }
  }, [activeJob, refreshCredits, refreshVideoJobFn]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    if (!activeJobInProgress) return;
    const id = window.setInterval(() => void refreshActiveJob(false), 8_000);
    return () => window.clearInterval(id);
  }, [activeJobInProgress, refreshActiveJob]);

  useEffect(() => {
    setPreviewError(false);
  }, [latestResult]);

  useEffect(() => {
    if (!internalMediumTestMode) return;
    if (!mediumTestCanonicalSample) return;
    setQuality(mediumTestCanonicalSample.quality);
    setAspectRatio(mediumTestCanonicalSample.expectedAspectRatio);
    setSelectedPersonaId(mediumTestCanonicalSample.personaId);
    setPrompt(mediumTestCanonicalSample.finalPrompt);
  }, [internalMediumTestMode, mediumTestCanonicalSample]);

  useEffect(() => {
    if (internalMediumTestMode) return;
    if (search.prompt && !search.smart) return;
    if (!campaignContext.campaign && !search.smart) return;
    const context = resolveCampaignExecutionContext(campaignContext.campaign, search);
    setPrompt((search.smart ? campaignSmartPromptFromContext(context, "video", campaignContext.campaign) : campaignContext.campaign?.video_prompt ?? search.prompt ?? "").slice(0, 1800));
    if (search.smart) {
      if (context.channel?.toLowerCase().includes("tiktok") || context.channel?.includes("تيك")) setAspectRatio("9:16");
      if (campaignContext.campaign) {
        const defaults = campaignVideoDefaults(campaignContext.campaign);
        setAspectRatio(defaults.aspectRatio);
        setSelectedPersonaId(defaults.selectedPersonaId);
        setSelectedTemplateId(defaults.templateId);
      }
    }
  }, [campaignContext.campaign, internalMediumTestMode, search.prompt, search.smart]);

  useEffect(() => {
    const directUrl = resolvedCampaignContext.productImageUrl?.trim();
    if (directUrl && !productImageUrl) {
      setProductImageUrl(directUrl);
      return;
    }
    const path = resolvedCampaignContext.productImagePath;
    if (!search.smart || !path || productImageUrl) return;
    supabase.storage
      .from("campaign-product-images")
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (data?.signedUrl) setProductImageUrl(data.signedUrl);
      })
      .catch(() => undefined);
  }, [productImageUrl, resolvedCampaignContext.productImagePath, resolvedCampaignContext.productImageUrl, search.smart]);

  const downloadLatestVideo = async () => {
    if (!latestResult) return;
    setDownloadingVideo(true);
    try {
      const response = await fetch(latestResult, { mode: "cors" });
      if (!response.ok) throw new Error("download_failed");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `rifd-video-${activeJob?.id?.slice(0, 8) ?? Date.now()}.mp4`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success("بدأ تحميل الفيديو");
    } catch {
      window.open(latestResult, "_blank", "noopener,noreferrer");
      toast.message("فتحنا الفيديو في تبويب جديد؛ استخدم حفظ الملف إذا منع المتصفح التحميل المباشر.");
    } finally {
      setDownloadingVideo(false);
    }
  };

  const uploadInputImage = async (kind: "speaker" | "product", file?: File) => {
    if (!file) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("ارفع صورة بصيغة JPG أو PNG أو WebP فقط");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("حجم الصورة كبير؛ الحد الأقصى 8MB");
      return;
    }
    setUploadingInput(kind);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("سجّل الدخول أولاً");
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${session.user.id}/video-inputs/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("generated-images").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw new Error(error.message);
      const { data, error: signedError } = await supabase.storage.from("generated-images").createSignedUrl(path, 60 * 60 * 24 * 7);
      if (signedError || !data?.signedUrl) throw new Error(signedError?.message ?? "فشل تجهيز رابط الصورة");
      if (kind === "speaker") setSpeakerImageUrl(data.signedUrl);
      else setProductImageUrl(data.signedUrl);
      toast.success("تم تجهيز الصورة للفيديو");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل رفع الصورة");
    } finally {
      setUploadingInput(null);
    }
  };

  return (
    <DashboardShell>
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black text-primary">فيديوهات قصيرة للمتاجر</p>
          <h1 className="mt-1 text-2xl font-extrabold">أنشئ فيديو قصير يشرح عرضك في ثوانٍ</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">اكتب عرضك بلغة واضحة، اختر مقاس النشر، وأضف صورة المنتج عندما تكون مطلوبة حتى يخرج الإعلان قابلاً للنشر.</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-foreground/80">
            <span className="rounded-full border border-border bg-secondary/50 px-3 py-1">Reels / TikTok</span>
            <span className="rounded-full border border-border bg-secondary/50 px-3 py-1">شخصيات سعودية</span>
            <span className="rounded-full border border-border bg-secondary/50 px-3 py-1">مناسب لإعلانات العروض</span>
            {campaignContext.campaignId && <span className="rounded-full border border-gold/30 bg-gold/5 px-3 py-1 text-gold">ضمن حملة محفوظة</span>}
          </div>
          {internalMediumTestMode && <p className="mt-2 w-fit rounded-md border border-gold/30 bg-gold/5 px-2 py-1 text-xs font-bold text-gold">وضع اختبار داخلي: لن يُفتح القالب للعامة حتى يجتاز بوابة الالتزام 80%+</p>}
        </div>
        <Button asChild variant="outline" size="sm" className="w-fit gap-1">
          <Link to="/dashboard/credits"><Sparkles className="h-3.5 w-3.5" /> شحن نقاط الفيديو</Link>
        </Button>
      </div>

      <CampaignContextBar campaign={campaignContext.campaign} campaignId={campaignContext.requestedCampaignId} loading={campaignContext.loading} error={campaignContext.error} summary={campaignContextSummary(resolvedCampaignContext)} context={resolvedCampaignContext} />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-soft">
          <div className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-sm font-extrabold text-primary">{search.smart && campaignContext.campaign ? "1) جهّزنا الفيديو من اختيارات الحملة" : "1) جهّز إعلان الفيديو قبل خصم النقاط"}</div>
          <div>
            <Label>نوع الاستخدام</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(Object.keys(QUALITY) as VideoQuality[]).map((key) => {
                const option = QUALITY[key];
                const Icon = option.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { if (!mediumTestControlsLocked) setQuality(key); }}
                    disabled={mediumTestControlsLocked}
                    className={cn(
                      "rounded-lg border p-4 text-right transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                      quality === key ? "border-primary bg-primary/10" : "border-border hover:bg-secondary/70"
                    )}
                  >
                    <Icon className={cn("mb-2 h-5 w-5", key === "quality" ? "text-gold" : "text-primary")} />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-extrabold">{option.label}</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold">
                        {(credits?.costs[key === "quality" ? "video_quality_8s" : key === "lite" ? "video_lite_8s" : "video_fast"] ?? 0).toLocaleString("ar-SA")} نقطة · {key === "fast" ? "من 5ث" : "8ث"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{option.note}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_180px]">
            <div>
              <Label>المقاس</Label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {ASPECTS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => { if (!mediumTestControlsLocked) setAspectRatio(item.value); }}
                    disabled={mediumTestControlsLocked}
                    className={cn(
                      "min-h-20 rounded-lg border px-2 py-3 text-center text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                      aspectRatio === item.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary/70"
                    )}
                  >
                    <MonitorSmartphone className="mx-auto mb-1 h-4 w-4" />
                    <div className="font-bold">{item.label}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{item.hint}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>المدة</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[5, 8].map((duration) => {
                  const lockedByTier = canonicalGenerationDurationSeconds !== duration;
                  return (
                  <button
                    key={duration}
                    type="button"
                    onClick={() => undefined}
                    disabled={lockedByTier}
                    className={cn(
                      "rounded-lg border px-3 py-4 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      canonicalGenerationDurationSeconds === duration ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary/70"
                    )}
                  >
                    {duration} ث
                  </button>
                );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-secondary/20 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Label>{internalMediumTestMode ? "قالب اختبار متوسط داخلي" : "قوالب الإطلاق السعودية المعتمدة"}</Label>
                <p className="mt-1 text-xs text-muted-foreground">{internalMediumTestMode ? "تم تحميل البرومبت النهائي من لوحة الإدارة كقالب مخصص مخفي عن العامة." : "تم حصر الإطلاق على أفضل قالبين من العينات الفعلية لتقليل الهدر ورفع قابلية النشر."}</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={applyTemplate} disabled={internalMediumTestMode} className="w-fit gap-1">
                <Wand2 className="h-3.5 w-3.5" /> تطبيق القالب
              </Button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
              <select value={internalMediumTestMode ? mediumTestCanonicalSample?.templateId ?? "invalid-medium-test" : selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)} disabled={internalMediumTestMode} className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60">
                {internalMediumTestMode ? (
                  <option value={mediumTestCanonicalSample?.templateId ?? "invalid-medium-test"}>{mediumTestTemplate ? `${mediumTestTemplate.sector} — ${mediumTestTemplate.label}` : "رابط عينة غير مطابق للمصفوفة"}</option>
                ) : SAUDI_VIDEO_LAUNCH_PROMPT_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>{template.sector} — {template.label}</option>
                ))}
              </select>
              <div className="flex items-center justify-center rounded-md border border-border bg-card px-3 text-xs font-bold text-muted-foreground">{internalMediumTestMode ? "داخلي" : `مخاطرة: ${selectedTemplate.risk}`}</div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{internalMediumTestMode ? "سيُحفظ معرف العينة والقالب الأصلي داخل بيانات مهمة الفيديو للمراجعة الإدارية." : "القوالب الأخرى محجوبة مؤقتاً حتى تثبت بيانات الاستخدام الفعلية أن نتائج الإطلاق مستقرة وقابلة للنشر."}</p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <Label>اكتب عرضك للفيديو</Label>
              <span className="text-xs text-muted-foreground">{promptCount.toLocaleString("ar-SA")} / 1800</span>
            </div>
            <Textarea
              value={prompt}
              onChange={(e) => { if (!internalMediumTestMode) setPrompt(e.target.value); }}
              readOnly={internalMediumTestMode}
              maxLength={1800}
              className="mt-2 min-h-36 read-only:bg-secondary/30"
              placeholder="مثلاً: اعرض عطر فاخر كهدية أنيقة، المنتج واضح طوال المشهد، حركة كاميرا بطيئة، وانتهِ بدعوة مباشرة للطلب عبر واتساب"
            />
            {internalMediumTestMode && <p className="mt-2 rounded-lg border border-border bg-secondary/30 p-3 text-xs font-semibold text-muted-foreground">برومبت الاختبار المتوسط مقفل من لوحة الإدارة وخادم التوليد يرفض أي تعديل عليه حتى تبقى النتيجة قابلة للمقارنة.</p>}
          </div>

          <div>
            <Label>صورة افتتاحية اختيارية</Label>
            <input
              value={startingFrameUrl}
              onChange={(e) => { if (!internalMediumTestMode) setStartingFrameUrl(e.target.value); }}
              disabled={internalMediumTestMode}
              placeholder="https://..."
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
            />
            {internalMediumTestMode && <p className="mt-2 text-xs font-semibold text-muted-foreground">صورة البداية مقفلة في الاختبار المتوسط؛ مرجع الشخصية والمنتج فقط يحافظان على قابلية المقارنة.</p>}
          </div>

          <div className="space-y-3">
            <Label>شخصيات سعودية جاهزة</Label>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {PERSONAS.map((persona) => (
                <button key={persona.id} type="button" onClick={() => { if (!mediumTestControlsLocked) setSelectedPersonaId(persona.id); }} disabled={mediumTestControlsLocked} className={cn("overflow-hidden rounded-lg border text-right transition-colors disabled:cursor-not-allowed disabled:opacity-60", selectedPersonaId === persona.id ? "border-primary bg-primary/10" : "border-border hover:bg-secondary/70")}> 
                  <img src={persona.image} alt={persona.label} width={768} height={768} loading="lazy" className="aspect-square w-full object-cover" />
                  <span className="block px-2 py-2 text-xs font-bold">{persona.label}</span>
                </button>
              ))}
            </div>
            {mediumTestControlsLocked && <p className="mt-2 rounded-lg border border-border bg-secondary/30 p-3 text-xs font-semibold text-muted-foreground">إعدادات الاختبار المتوسط مقفلة من لوحة الإدارة: الجودة، المقاس، والشخصية لا تُعدّل يدوياً حتى تبقى العينة مطابقة للمصفوفة.</p>}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <ImageInputCard label="صورة الشخص المتحدث" value={internalMediumTestMode ? absoluteAssetUrl(canonicalGenerationPersona.image) : speakerImageUrl} uploading={uploadingInput === "speaker"} disabled={internalMediumTestMode} onFile={(file: File | undefined) => void uploadInputImage("speaker", file)} onUrl={setSpeakerImageUrl} />
            <ImageInputCard label={(resolvedCampaignContext.productImagePath || resolvedCampaignContext.productImageUrl) ? "صورة المنتج من بيت الحملة" : isPaidPlan || mediumTestProductImageRequired ? "صورة المنتج — مطلوبة" : "صورة المنتج"} value={productImageUrl} uploading={uploadingInput === "product"} onFile={(file: File | undefined) => void uploadInputImage("product", file)} onUrl={setProductImageUrl} />
          </div>
            {productImageRequired && <p className="text-xs font-bold text-destructive">{mediumTestProductImageRequired ? "هذه عينة اختبار متوسط تتطلب صورة منتج؛ تشغيلها بدون صورة سيجعل نتيجة الالتزام غير صالحة." : "ارفع صورة المنتج قبل إنشاء الفيديو؛ هذا يحافظ على وضوح المنتج ويقلل النتائج العامة."}</p>}

          <div className="rounded-lg border border-gold/30 bg-gold/5 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-foreground">سيتم خصم {canonicalSelectedCost.toLocaleString("ar-SA")} نقطة فيديو</span>
              <span className={cn("text-xs", canonicalHasEnoughCredits ? "text-muted-foreground" : "font-bold text-destructive")}>{canonicalHasEnoughCredits ? `المدة المعتمدة: ${canonicalGenerationDurationSeconds}ث · يتم الاسترجاع تلقائياً إذا فشل التوليد بعد الخصم` : "رصيدك الحالي لا يكفي لهذه الجودة"}</span>
            </div>
            <div className="mt-3 grid gap-2 text-xs font-bold sm:grid-cols-2">
              <span className="rounded-md border border-border bg-card px-3 py-2">رصيدك الحالي: {creditsLoading ? "..." : `${(credits?.totalCredits ?? 0).toLocaleString("ar-SA")} نقطة`}</span>
              <span className={cn("rounded-md border px-3 py-2", canonicalQualityAllowed ? "border-border bg-card text-muted-foreground" : "border-destructive/30 bg-destructive/10 text-destructive")}>{canonicalQualityAllowed ? "الجودة متاحة في باقتك" : "الجودة غير متاحة في باقتك"}</span>
              <span className={cn("rounded-md border px-3 py-2", canonicalDurationAllowed ? "border-border bg-card text-muted-foreground" : "border-destructive/30 bg-destructive/10 text-destructive")}>{canonicalDurationAllowed ? `المدة متاحة: ${canonicalGenerationDurationSeconds}ث` : "المدة غير متاحة في باقتك"}</span>
              <span className={cn("rounded-md border px-3 py-2", productImageRequired ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-border bg-card text-muted-foreground")}>{productImageRequired ? "صورة المنتج مطلوبة" : "صورة المنتج غير مطلوبة الآن"}</span>
            </div>
            <p className="mt-1 text-xs font-bold text-muted-foreground">
              {watermarkRequired ? "الباقة المجانية تضيف علامة رِفد المائية تلقائياً؛ الباقات المدفوعة بدون علامة مائية." : "باقتك الحالية تنشئ فيديوهات بدون علامة مائية من رِفد."}
            </p>
            {reachedConcurrentLimit && (
              <p className="mt-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-bold text-warning-foreground">
                لديك مهمتا فيديو قيد المعالجة الآن؛ يمكنك إنشاء فيديو جديد بعد اكتمال أو استرداد إحداهما.
              </p>
            )}
          </div>

          <Button type="button" onClick={() => void generate()} disabled={loading || reachedConcurrentLimit || visibleJobInProgress || creditsLoading} className="h-12 w-full gradient-primary font-extrabold text-primary-foreground shadow-elegant">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> جاري إرسال مهمة الفيديو...</> : reachedConcurrentLimit || visibleJobInProgress ? <><Loader2 className="h-4 w-4 animate-spin" /> انتظر اكتمال إحدى المهام</> : <><Clapperboard className="h-4 w-4" /> أنشئ فيديو جاهزاً للنشر</>}
          </Button>
        </section>

        <aside className="space-y-5">
          <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-extrabold">2) معاينة الإعلان وتحميله</h2>
              <div className="flex flex-wrap items-center gap-2">
                {activeJobInProgress && (
                  <button type="button" onClick={() => void refreshActiveJob()} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs hover:bg-accent">
                    <RefreshCw className="h-3 w-3" /> تحديث
                  </button>
                )}
                {latestResult && (
                  <>
                    <button type="button" onClick={() => void downloadLatestVideo()} disabled={downloadingVideo} className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60">
                      {downloadingVideo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} تحميل
                    </button>
                    <a href={latestResult} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs hover:bg-accent">
                      فتح
                    </a>
                  </>
                )}
              </div>
            </div>
            <div className="mt-3 flex aspect-[9/16] items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-secondary/30 text-center text-sm text-muted-foreground">
              {latestResult ? (
                <div className="relative h-full w-full">
                  <video src={latestResult} controls playsInline preload="metadata" className="h-full w-full object-cover" onError={() => setPreviewError(true)} />
                  {previewError && (
                    <div className="absolute inset-x-3 bottom-3 rounded-lg border border-border bg-card/95 p-3 text-xs font-medium text-foreground shadow-soft">
                      تعذر تشغيل المعاينة داخل الصفحة. استخدم زر فتح أو تحميل.
                    </div>
                  )}
                </div>
              ) : loading || activeJobInProgress ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : (
                <div className="px-8">
                  <Film className="mx-auto mb-3 h-8 w-8 text-primary" />
                  الفيديو سيظهر هنا بعد الإنشاء
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-extrabold">فيديوهاتك الأخيرة</h2>
              <button type="button" onClick={loadJobs} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary" aria-label="تحديث">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            {jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد فيديوهات بعد.</p>
            ) : (
              <div className="space-y-2">
                {jobs.slice(0, 6).map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => setActiveJob(job)}
                    className={cn(
                      "w-full rounded-lg border p-3 text-right text-xs transition-colors",
                      activeJob?.id === job.id ? "border-primary bg-primary/10" : "border-border hover:bg-secondary/70"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{job.quality === "quality" ? "احترافي" : job.quality === "lite" ? "إعلاني" : "سريع"}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold">{job.status === "completed" && job.result_url ? "جاهز للمعاينة" : STATUS_LABEL[job.status] ?? job.status}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-muted-foreground">{job.prompt}</p>
                  {job.error_message && <p className="mt-1 line-clamp-2 text-[10px] font-medium text-destructive">{job.error_message}</p>}
                    <p className="mt-2 text-[10px] text-muted-foreground">{new Date(job.created_at).toLocaleDateString("ar-SA")} · {job.credits_charged} نقطة</p>
                  </button>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      <QuotaExceededDialog
        open={quotaDialog.open}
        onOpenChange={(v) => setQuotaDialog((s) => ({ ...s, open: v }))}
        kind="فيديو"
        reason={quotaDialog.reason}
      />
    </DashboardShell>
  );
}

