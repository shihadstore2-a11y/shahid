import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Activity, AlertTriangle, ArrowUpDown, CheckCircle2, Clapperboard, ClipboardCheck, Gauge, Loader2, RefreshCw, Target, Wifi } from "lucide-react";
import { toast } from "sonner";
import { AdminGuard, adminBeforeLoad } from "@/components/admin-guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { VIDEO_QUALITY_LABELS } from "@/lib/plan-catalog";
import { FAL_VIDEO_TEST_MODELS, SAUDI_VIDEO_LAUNCH_DECISION, SAUDI_VIDEO_LAUNCH_TEMPLATE_IDS, SAUDI_VIDEO_PERSONAS, SAUDI_VIDEO_TEST_SCENARIOS } from "@/lib/saudi-video-test";
import { cn } from "@/lib/utils";
import { auditSaudiVideoMediumBatch, auditSaudiVideoPilotLibrary, buildSaudiVideoPilotMatrix, evaluateSaudiVideoPilotSample, listSaudiLaunchTemplatePerformance, listVideoProviderAttemptSummary, listVideoProviderConfigs, previewSaudiFalVideoTestPrompt, runSaudiFalVideoModelTest, testVideoProviderConnection, testVideoRouterDryRun, updateVideoProviderConfig, type AdminVideoProviderAttemptSummary, type AdminVideoProviderConfig, type AdminVideoRouterTestResult, type SaudiFalModelTestResult, type SaudiFalPromptPreview, type SaudiLaunchTemplatePerformance, type SaudiVideoMediumBatchResult, type SaudiVideoPilotAuditResult, type SaudiVideoPilotEvaluationResult, type SaudiVideoPilotMatrixResult } from "@/server/admin-video";
import personaMaleYoung from "@/assets/saudi-persona-male-young.jpg";
import personaMalePremium from "@/assets/saudi-persona-male-premium.jpg";
import personaFemaleAbaya from "@/assets/saudi-persona-female-abaya.jpg";
import personaRetailSeller from "@/assets/saudi-persona-retail-seller.jpg";
import pilotSaudiOfficeVideo from "@/assets/pilot-saudi-office-vertical-9x16.mp4.asset.json";
import pilotSaudiPerfumeVideo from "@/assets/pilot-saudi-perfume-vertical-9x16.mp4.asset.json";
import pilotSaudiAbayaVideo from "@/assets/pilot-saudi-abaya-vertical-9x16.mp4.asset.json";
import pilotSaudiCoffeeVideo from "@/assets/pilot-saudi-coffee-vertical-9x16.mp4.asset.json";
import pilotSaudiElectronicsVideo from "@/assets/pilot-saudi-electronics-vertical-9x16.mp4.asset.json";
import pilotSaudiGiftsVideo from "@/assets/pilot-saudi-gifts-vertical-9x16.mp4.asset.json";

export const Route = createFileRoute("/admin/video-providers")({
  beforeLoad: adminBeforeLoad,
  head: () => ({ meta: [{ title: "مزودو الفيديو — رِفد" }] }),
  component: () => (
    <AdminGuard loadingLabel="جاري تحميل مركز مزودي الفيديو…">
      <AdminVideoProvidersPage />
    </AdminGuard>
  ),
});

const HEALTH_LABEL: Record<string, string> = {
  active: "نشط",
  inactive: "متوقف",
  testing: "تجربة",
  manual_required: "يحتاج تدخل يدوي",
  unhealthy: "غير صحي",
};

const HEALTH_TONE: Record<string, string> = {
  active: "bg-success/15 text-success",
  inactive: "bg-muted text-muted-foreground",
  testing: "bg-primary/15 text-primary",
  manual_required: "bg-gold/15 text-gold",
  unhealthy: "bg-destructive/15 text-destructive",
};

type SaudiFalDraft = { modelId: string; personaId: string; scenarioId: string; includeProductImage: boolean; includeVoice: boolean };
type PilotEvaluationDraft = { sampleId: string; resultUrl: string; productClarity: number; sceneAdherence: number; motionAdherence: number; saudiDialect: number; negativeSafety: number; publishReadiness: number; notes: string };

const PERSONA_IMAGES: Record<string, string> = {
  "male-young": personaMaleYoung,
  "male-premium": personaMalePremium,
  "female-abaya": personaFemaleAbaya,
  "retail-seller": personaRetailSeller,
};

const PUBLIC_ASSET_ORIGIN = "https://rifd.site";

function absoluteAssetUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return new URL(value, PUBLIC_ASSET_ORIGIN).toString();
}

function fmtDate(value: string | null) {
  return value ? new Date(value).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" }) : "—";
}

function AdminVideoProvidersPage() {
  const fetchProviders = useServerFn(listVideoProviderConfigs);
  const fetchAttempts = useServerFn(listVideoProviderAttemptSummary);
  const fetchLaunchTemplatePerformance = useServerFn(listSaudiLaunchTemplatePerformance);
  const updateProvider = useServerFn(updateVideoProviderConfig);
  const testProvider = useServerFn(testVideoProviderConnection);
  const testRouter = useServerFn(testVideoRouterDryRun);
  const previewSaudiFalPrompt = useServerFn(previewSaudiFalVideoTestPrompt);
  const runSaudiFalTest = useServerFn(runSaudiFalVideoModelTest);
  const auditPilotLibrary = useServerFn(auditSaudiVideoPilotLibrary);
  const auditMediumBatch = useServerFn(auditSaudiVideoMediumBatch);
  const buildPilotMatrix = useServerFn(buildSaudiVideoPilotMatrix);
  const evaluatePilotSample = useServerFn(evaluateSaudiVideoPilotSample);
  const [providers, setProviders] = useState<AdminVideoProviderConfig[]>([]);
  const [attempts, setAttempts] = useState<AdminVideoProviderAttemptSummary[]>([]);
  const [templatePerformance, setTemplatePerformance] = useState<SaudiLaunchTemplatePerformance[]>([]);
  const [routerResults, setRouterResults] = useState<Array<AdminVideoRouterTestResult & { scenarioLabel: string }>>([]);
  const [pilotAudit, setPilotAudit] = useState<SaudiVideoPilotAuditResult | null>(null);
  const [pilotMatrix, setPilotMatrix] = useState<SaudiVideoPilotMatrixResult | null>(null);
  const [mediumBatch, setMediumBatch] = useState<SaudiVideoMediumBatchResult | null>(null);
  const [pilotEvaluation, setPilotEvaluation] = useState<SaudiVideoPilotEvaluationResult | null>(null);
  const [falPreview, setFalPreview] = useState<SaudiFalPromptPreview | null>(null);
  const [falTestResult, setFalTestResult] = useState<SaudiFalModelTestResult | null>(null);
  const [falDraft, setFalDraft] = useState<SaudiFalDraft>({ modelId: FAL_VIDEO_TEST_MODELS[0].id, personaId: SAUDI_VIDEO_PERSONAS[0].id, scenarioId: SAUDI_VIDEO_TEST_SCENARIOS[0].id, includeProductImage: true, includeVoice: true });
  const [productImageUrl, setProductImageUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [testingRouter, setTestingRouter] = useState(false);
  const [auditingPilot, setAuditingPilot] = useState(false);
  const [auditingMediumBatch, setAuditingMediumBatch] = useState(false);
  const [buildingMatrix, setBuildingMatrix] = useState(false);
  const [evaluatingPilot, setEvaluatingPilot] = useState(false);
  const [loadingFalPreview, setLoadingFalPreview] = useState(false);
  const [runningFalTest, setRunningFalTest] = useState(false);

  async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("لا توجد جلسة");
    return { Authorization: `Bearer ${session.access_token}` };
  }

  async function load() {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const [providerResult, attemptResult, templateResult] = await Promise.all([fetchProviders({ headers }), fetchAttempts({ headers }), fetchLaunchTemplatePerformance({ headers })]);
      setProviders(providerResult.providers);
      setAttempts(attemptResult.attempts);
      setTemplatePerformance(templateResult.templates);
      try {
        const mediumBatchResult = await auditMediumBatch({ data: { auditLog: false }, headers });
        setMediumBatch(mediumBatchResult);
      } catch (batchError) {
        console.warn("فشل تدقيق دفعة الفيديو الصامت دون تعطيل لوحة المزودين", batchError);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل تحميل مزودي الفيديو");
    } finally {
      setLoading(false);
    }
  }

  async function save(providerKey: string, patch: { enabled?: boolean; publicEnabled?: boolean; priority?: number; cost5s?: number; cost8s?: number }) {
    setSavingKey(providerKey);
    try {
      const headers = await authHeaders();
      const result = await updateProvider({ data: { providerKey, ...patch }, headers });
      setProviders((current) => current.map((provider) => provider.provider_key === providerKey ? result.provider : provider).sort((a, b) => a.priority - b.priority));
      toast.success("تم حفظ إعدادات المزود");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل حفظ إعدادات المزود");
    } finally {
      setSavingKey(null);
    }
  }

  async function testConnection(providerKey: string) {
    setTestingKey(providerKey);
    try {
      const headers = await authHeaders();
      const result = await testProvider({ data: { providerKey }, headers });
      setProviders((current) => current.map((provider) => provider.provider_key === providerKey ? result.provider : provider));
      toast[result.result.ok ? "success" : "error"](result.result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل اختبار اتصال المزود");
    } finally {
      setTestingKey(null);
    }
  }

  async function testRouterPath() {
    setTestingRouter(true);
    try {
      const headers = await authHeaders();
      const scenarios = [
        { label: "سريع 5ث بلا صور", quality: "fast", aspectRatio: "9:16", durationSeconds: 5, hasStartingFrame: false, imageCount: 0 },
        { label: "إعلاني 8ث بصورة منتج", quality: "lite", aspectRatio: "9:16", durationSeconds: 8, hasStartingFrame: true, imageCount: 1 },
        { label: "احترافي 8ث بشخص ومنتج", quality: "quality", aspectRatio: "9:16", durationSeconds: 8, hasStartingFrame: true, imageCount: 2 },
      ] as const;
      const results = await Promise.all(scenarios.map(async ({ label, ...scenario }) => ({ ...(await testRouter({ data: scenario, headers })), scenarioLabel: label })));
      setRouterResults(results);
      const passed = results.filter((result) => result.ok).length;
      toast[passed === results.length ? "success" : "error"](`نجح ${passed.toLocaleString("ar-SA")} من ${results.length.toLocaleString("ar-SA")} مسارات للراوتر`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل اختبار الراوتر");
    } finally {
      setTestingRouter(false);
    }
  }

  async function auditPromptLibrary() {
    setAuditingPilot(true);
    try {
      const headers = await authHeaders();
      const result = await auditPilotLibrary({ headers });
      setPilotAudit(result);
      toast[result.readyForPilot ? "success" : "error"](`جاهزية مكتبة البرومبتات: ${result.passRate.toLocaleString("ar-SA")}%`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل تدقيق مكتبة البرومبتات");
    } finally {
      setAuditingPilot(false);
    }
  }

  async function buildPilotTestMatrix() {
    setBuildingMatrix(true);
    try {
      const headers = await authHeaders();
      const result = await buildPilotMatrix({ headers });
      const refreshedBatch = await auditMediumBatch({ data: { auditLog: false }, headers });
      setPilotMatrix(result);
      setMediumBatch(refreshedBatch);
      toast.success(`تم تجهيز اختبار متوسط: ${result.totalSamples.toLocaleString("ar-SA")} عينة — العينة التالية أصبحت ظاهرة للتشغيل`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل تجهيز مصفوفة الاختبار");
    } finally {
      setBuildingMatrix(false);
    }
  }

  async function auditMediumTestBatch() {
    setAuditingMediumBatch(true);
    try {
      const headers = await authHeaders();
      const result = await auditMediumBatch({ data: { auditLog: true }, headers });
      setMediumBatch(result);
      toast[result.releaseGate === "ready_for_review" || result.releaseGate === "ready_for_expansion" ? "success" : result.releaseGate === "blocked" || result.releaseGate === "needs_iteration" ? "error" : "message"](`تنفيذ الاختبار المتوسط: ${result.executionRate.toLocaleString("ar-SA")}%`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل تدقيق دفعة الاختبار المتوسط");
    } finally {
      setAuditingMediumBatch(false);
    }
  }

  async function submitPilotEvaluation(draft: PilotEvaluationDraft) {
    setEvaluatingPilot(true);
    try {
      const headers = await authHeaders();
      const result = await evaluatePilotSample({ data: draft, headers });
      setPilotEvaluation(result);
      const refreshedBatch = await auditMediumBatch({ data: { auditLog: false }, headers });
      setMediumBatch(refreshedBatch);
      toast[result.decision === "publishable" ? "success" : "warning"](`تقييم العينة: ${result.score.toLocaleString("ar-SA")}%`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل حفظ تقييم العينة");
    } finally {
      setEvaluatingPilot(false);
    }
  }

  async function buildFalPromptPreview() {
    setLoadingFalPreview(true);
    try {
      const headers = await authHeaders();
      const result = await previewSaudiFalPrompt({ data: falDraft, headers });
      setFalPreview(result);
      toast.success("تم تجهيز برومبت الاختبار السعودي");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل تجهيز برومبت الاختبار");
    } finally {
      setLoadingFalPreview(false);
    }
  }

  async function runFalModelTest() {
    setRunningFalTest(true);
    try {
      const headers = await authHeaders();
      const result = await runSaudiFalTest({ data: { ...falDraft, personaImageUrl: absoluteAssetUrl(PERSONA_IMAGES[falDraft.personaId]), productImageUrl }, headers });
      setFalTestResult(result);
      setFalPreview(result);
      toast[result.ok ? "success" : "error"](result.ok ? "تم إرسال اختبار fal.ai الفعلي" : result.error ?? "فشل اختبار النموذج");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل اختبار fal.ai الفعلي");
    } finally {
      setRunningFalTest(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DashboardShell>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold">
            <Clapperboard className="h-6 w-6 text-primary" /> مركز مزودي الفيديو
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">تحكم داخلي بالمزودين، الأولوية، الصحة، والتفعيل دون كشف أي اسم تقني للمستخدم.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void auditPromptLibrary()} disabled={loading || auditingPilot}>
            {auditingPilot ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />} تدقيق مكتبة البرومبتات
          </Button>
          <Button variant="outline" size="sm" onClick={() => void buildPilotTestMatrix()} disabled={loading || buildingMatrix}>
            {buildingMatrix ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />} مصفوفة الاختبار
          </Button>
          <Button variant="outline" size="sm" onClick={() => void auditMediumTestBatch()} disabled={loading || auditingMediumBatch}>
            {auditingMediumBatch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />} تدقيق الدفعة
          </Button>
          <Button variant="default" size="sm" onClick={() => void testRouterPath()} disabled={loading || testingRouter}>
            {testingRouter ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />} اختبار الراوتر
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> تحديث
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/video-jobs"><Activity className="h-4 w-4" /> مهام الفيديو</Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <>
          <PilotProofPanel />
          <LaunchTemplatePerformancePanel templates={templatePerformance} />
          {pilotAudit && <PilotAuditPanel audit={pilotAudit} />}
          {pilotMatrix && <PilotMatrixPanel matrix={pilotMatrix} />}
          {mediumBatch && <MediumBatchPanel batch={mediumBatch} />}
          <PilotEvaluationPanel batch={mediumBatch} result={pilotEvaluation} saving={evaluatingPilot} onSubmit={(draft: PilotEvaluationDraft) => void submitPilotEvaluation(draft)} />
          <SaudiFalTestPanel draft={falDraft} productImageUrl={productImageUrl} preview={falPreview} testResult={falTestResult} loading={loadingFalPreview} running={runningFalTest} onDraft={setFalDraft} onProductImageUrl={setProductImageUrl} onPreview={() => void buildFalPromptPreview()} onRun={() => void runFalModelTest()} />
          {routerResults.length > 0 && <RouterResultPanel results={routerResults} />}
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            {attempts.slice(0, 3).map((attempt) => <AttemptCard key={attempt.provider} attempt={attempt} />)}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {providers.map((provider) => {
              const saving = savingKey === provider.provider_key;
              return (
                <article key={provider.provider_key} className="rounded-xl border border-border bg-card p-4 shadow-soft">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-extrabold">{provider.display_name_admin}</h2>
                      <Badge className={cn(HEALTH_TONE[provider.health_status] ?? "bg-muted")}>{HEALTH_LABEL[provider.health_status] ?? provider.health_status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{provider.provider_key} · {provider.mode === "manual" ? "جسر يدوي" : provider.mode === "bridge" ? "جسر شبه آلي" : "API"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(saving || testingKey === provider.provider_key) && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    <Button type="button" variant="outline" size="sm" onClick={() => void testConnection(provider.provider_key)} disabled={saving || testingKey === provider.provider_key}>
                      {provider.health_status === "active" ? <CheckCircle2 className="h-4 w-4" /> : <Wifi className="h-4 w-4" />} اختبار الاتصال
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <ControlRow label="تفعيل المزود" hint="يدخل ضمن الراوتر الداخلي">
                    <Switch checked={provider.enabled} disabled={saving} onCheckedChange={(checked) => void save(provider.provider_key, { enabled: checked })} />
                  </ControlRow>
                  <ControlRow label="متاح للطلبات" hint="إيقافه يمنع استخدامه للمستخدمين">
                    <Switch checked={provider.public_enabled} disabled={saving || !provider.enabled} onCheckedChange={(checked) => void save(provider.provider_key, { publicEnabled: checked })} />
                  </ControlRow>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[140px_1fr]">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground">الأولوية</label>
                    <div className="mt-1 flex items-center gap-2">
                      <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        min={1}
                        max={1000}
                        value={provider.priority}
                        disabled={saving}
                        onChange={(event) => setProviders((current) => current.map((item) => item.provider_key === provider.provider_key ? { ...item, priority: Number(event.target.value) } : item))}
                        onBlur={(event) => void save(provider.provider_key, { priority: Number(event.target.value) })}
                        className="h-9"
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs leading-6 text-muted-foreground">
                    <div className="flex flex-wrap gap-2">
                      {provider.supported_qualities.map((quality) => (
                        <Badge key={quality} variant="secondary">{quality === "quality" || quality === "fast" || quality === "lite" ? VIDEO_QUALITY_LABELS[quality] : "متوازن"}</Badge>
                      ))}
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <CostInput label="تكلفة 5ث" value={provider.cost_5s} disabled={saving} onCommit={(value) => void save(provider.provider_key, { cost5s: value })} />
                      <CostInput label="تكلفة 8ث" value={provider.cost_8s} disabled={saving} onCommit={(value) => void save(provider.provider_key, { cost8s: value })} />
                    </div>
                    <ProviderCapabilities metadata={provider.metadata} provider={provider} />
                    <p>آخر نجاح: {fmtDate(provider.last_success_at)} · آخر خطأ: {fmtDate(provider.last_error_at)}</p>
                    <LastConnectionTest metadata={provider.metadata} />
                    {provider.last_error_message && <p className="mt-1 flex items-start gap-1 text-destructive"><AlertTriangle className="mt-1 h-3.5 w-3.5" /> {provider.last_error_message}</p>}
                  </div>
                </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </DashboardShell>
  );
}

function LaunchTemplatePerformancePanel({ templates }: { templates: SaudiLaunchTemplatePerformance[] }) {
  const approvedIds = new Set(SAUDI_VIDEO_LAUNCH_TEMPLATE_IDS as readonly string[]);
  const visibleTemplates = templates.filter((template) => approvedIds.has(template.templateId));
  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-extrabold">قياس أداء قوالب الإطلاق</h2>
          <p className="mt-1 text-xs text-muted-foreground">بوابة تشغيل فعلية: لا يُفتح أي قالب احتياطي قبل عينة كافية، إكمال 80%+، فشل/استرداد منخفض، وتكلفة مستقرة.</p>
        </div>
        <Badge className={cn(visibleTemplates.every((template) => template.expansionEligible) ? "bg-success/15 text-success" : "bg-gold/15 text-gold")}>{visibleTemplates.filter((template) => template.expansionEligible).length.toLocaleString("ar-SA")}/{visibleTemplates.length.toLocaleString("ar-SA")} مؤهل للتوسع</Badge>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {visibleTemplates.length > 0 ? visibleTemplates.map((template) => (
          <div key={template.templateId} className="rounded-lg border border-border bg-secondary/30 p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>{template.templateId}</strong>
              <Badge className={cn(template.expansionEligible ? "bg-success/15 text-success" : template.minSampleReached ? "bg-warning/20 text-warning-foreground" : "bg-gold/15 text-gold")}>{template.expansionEligible ? "جاهز للتوسع" : template.minSampleReached ? "تحت المراقبة" : "جمع بيانات"}</Badge>
            </div>
            <p className="mt-2 text-muted-foreground">إجمالي: {template.total.toLocaleString("ar-SA")} · مكتمل: {template.completed.toLocaleString("ar-SA")} · قيد المعالجة: {template.processing.toLocaleString("ar-SA")} · مسترد/فشل: {(template.refunded + template.failed).toLocaleString("ar-SA")}</p>
            <p className="mt-1 text-muted-foreground">إكمال: {template.publishableRate.toLocaleString("ar-SA")}% · فشل/استرداد: {template.failureRate.toLocaleString("ar-SA")}% · متوسط التكلفة: {template.avgCostUsd === null ? "—" : `$${template.avgCostUsd}`}</p>
            <p className="mt-1 text-muted-foreground">آخر استخدام: {fmtDate(template.lastAt)}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{template.gateNotes.map((note) => <Badge key={`${template.templateId}-${note}`} variant="secondary">{note}</Badge>)}</div>
          </div>
        )) : (
          <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground md:col-span-2">لا توجد توليدات فعلية بالقالبين المعتمدين بعد. القياس جاهز وسيبدأ تلقائياً مع أول مهمة فيديو جديدة.</div>
        )}
      </div>
    </section>
  );
}

function AttemptCard({ attempt }: { attempt: AdminVideoProviderAttemptSummary }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <p className="truncate text-xs font-bold text-muted-foreground">{attempt.provider}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-2xl font-extrabold tabular-nums">{attempt.successRate}%</p>
        <Badge variant="secondary">{attempt.total.toLocaleString("ar-SA")} محاولة</Badge>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">نجاح: {attempt.success.toLocaleString("ar-SA")} · فشل: {attempt.failed.toLocaleString("ar-SA")} ({attempt.failureRate}%) · متوسط: {attempt.avgLatencyMs ? `${attempt.avgLatencyMs.toLocaleString("ar-SA")}ms` : "—"}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">آخر حالة: {attempt.lastStatus ?? "—"} · {fmtDate(attempt.lastAt)}</p>
      {attempt.topError && <p className="mt-1 line-clamp-1 text-xs text-destructive">أكثر خطأ: {attempt.topError}</p>}
    </div>
  );
}

function PilotProofPanel() {
  const proofSamples = [
    { label: "مكتب سعودي", url: pilotSaudiOfficeVideo.url, checks: ["H.264", "1088×1920", "5.04ث", "9:16"], verdict: "مرجع فني", score: 84, decision: "صالح كمرجع استقرار تقني، وليس قالب إطلاق عام." },
    { label: "عطر فاخر", url: pilotSaudiPerfumeVideo.url, checks: ["1080p", "5ث", "9:16", "هوية المنتج"], verdict: "مستبعد مؤقتاً", score: 78, decision: "أقل من بوابة 80%؛ يُعاد ضبط وضوح المنتج قبل إعادته للواجهة العامة." },
    { label: "عباية راقية", url: pilotSaudiAbayaVideo.url, checks: ["1080p", "5ث", "9:16", "أزياء محتشمة"], verdict: "احتياطي", score: 80, decision: "يجتاز الحد الأدنى، لكنه يبقى احتياطياً حتى تتكرر سلامة الحركة والقماش." },
    { label: "قهوة عربية", url: pilotSaudiCoffeeVideo.url, checks: ["1080p", "5ث", "9:16", "ضيافة سعودية", "معتمد"], verdict: "قالب إطلاق", score: 82, decision: "معتمد كقالب إطلاق ثانوي: آمن سعودياً، واضح الضيافة، وقابل للتكييف مع منتجات متعددة." },
    { label: "إلكترونيات", url: pilotSaudiElectronicsVideo.url, checks: ["1080p", "5ث", "9:16", "استخدام منتج"], verdict: "احتياطي", score: 81, decision: "صالح كمسار لاحق، لكن لا يُفتح عاماً قبل تكرار اختبار دقة المنتج وحركة اليد." },
    { label: "هدايا فاخرة", url: pilotSaudiGiftsVideo.url, checks: ["1080p", "5ث", "9:16", "مناسبات", "معتمد"], verdict: "قالب إطلاق", score: 83, decision: "معتمد كقالب إطلاق أساسي لأنه الأعلى تسويقياً والأوضح من أول ثانية." },
  ];
  const averageScore = Math.round(proofSamples.reduce((sum, sample) => sum + sample.score, 0) / proofSamples.length);
  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-extrabold">دليل عينات الفيديو العمودية</h2>
              <p className="mt-1 text-xs text-muted-foreground">تم نقل المرحلة من عينة تحقق واحدة إلى ست عينات فعلية تغطي: مكتب، عطر، عباية، قهوة، إلكترونيات، وهدايا؛ مع إبقاء الاعتماد النهائي مشروطاً بدرجات التسويق والنشر.</p>
            </div>
            <Badge className="bg-success/15 text-success">بوابة 9:16 مجتازة</Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="secondary">٦ عينات فعلية</Badge>
            <Badge variant="secondary">مسار عمودي فقط</Badge>
            <Badge variant="secondary">متوسط أولي {averageScore.toLocaleString("ar-SA")}%</Badge>
          </div>
          <p className="mt-3 text-xs leading-6 text-muted-foreground">قرار الجودة: تم إغلاق نسخة الإطلاق على {SAUDI_VIDEO_LAUNCH_TEMPLATE_IDS.length.toLocaleString("ar-SA")} قالبين فقط بحد أدنى {SAUDI_VIDEO_LAUNCH_DECISION.minimumPublishableScore.toLocaleString("ar-SA")}%؛ أي قالب أقل من ذلك يبقى داخلياً حتى إعادة الاختبار.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs"><strong>اعتمد للإطلاق</strong><p className="mt-1 text-muted-foreground">هدايا فاخرة + قهوة عربية فقط في واجهة المستخدم العامة.</p></div>
            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs"><strong>حُذف المسار القديم</strong><p className="mt-1 text-muted-foreground">لم تعد كل القوالب التجريبية ظاهرة للمستخدم قبل الاعتماد.</p></div>
            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs"><strong>الخطوة التالية</strong><p className="mt-1 text-muted-foreground">قياس أول توليدات حقيقية ثم إعادة إدخال القطاعات الاحتياطية تدريجياً.</p></div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {proofSamples.map((sample) => (
            <article key={sample.label} className="rounded-lg border border-border bg-secondary/30 p-2">
              <video src={sample.url} className="aspect-[9/16] w-full rounded-md bg-background object-cover" muted playsInline controls preload="metadata" />
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                <strong className="me-auto">{sample.label}</strong>
                <Badge variant="secondary">{sample.verdict}</Badge>
                <Badge className={cn(sample.score >= 80 ? "bg-success/15 text-success" : "bg-gold/15 text-gold")}>{sample.score.toLocaleString("ar-SA")}%</Badge>
                {sample.checks.map((check) => <Badge key={`${sample.label}-${check}`} variant="outline">{check}</Badge>)}
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{sample.decision}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PilotAuditPanel({ audit }: { audit: SaudiVideoPilotAuditResult }) {
  const topIssues = audit.findings.filter((item) => item.issues.length > 0).slice(0, 5);
  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-extrabold">تدقيق مكتبة البرومبتات السعودية</h2>
          <p className="mt-1 text-xs text-muted-foreground">فحص جودة البرومبتات قبل الاختبار العملي: الصوت، المنتج، قيود التشوهات، ومنع النص العربي المرئي.</p>
        </div>
        <Badge className={cn(audit.readyForPilot ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>{audit.passRate.toLocaleString("ar-SA")}% جاهزية</Badge>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs"><strong>{audit.passCount.toLocaleString("ar-SA")}/{audit.totalTemplates.toLocaleString("ar-SA")}</strong><p className="mt-1 text-muted-foreground">قوالب اجتازت معيار 80%</p></div>
        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs"><strong>{audit.sectorCoverage.length.toLocaleString("ar-SA")}</strong><p className="mt-1 text-muted-foreground">قطاعات مغطاة</p></div>
        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs"><strong>{Object.entries(audit.riskMix).map(([k, v]) => `${k}: ${v}`).join(" · ")}</strong><p className="mt-1 text-muted-foreground">توزيع المخاطر</p></div>
      </div>
      {topIssues.length > 0 && <div className="mt-3 space-y-2">{topIssues.map((item) => <div key={item.templateId} className="rounded-lg border border-border bg-background/60 p-3 text-xs"><strong>{item.label} — {item.score}%</strong><p className="mt-1 text-muted-foreground">{item.issues.join(" · ")}</p></div>)}</div>}
    </section>
  );
}

function PilotMatrixPanel({ matrix }: { matrix: SaudiVideoPilotMatrixResult }) {
  const qualityMix = matrix.samples.reduce<Record<string, number>>((acc, sample) => ({ ...acc, [sample.quality]: (acc[sample.quality] ?? 0) + 1 }), {});
  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-extrabold">مصفوفة الاختبار المتوسط للبرومبتات</h2>
          <p className="mt-1 text-xs text-muted-foreground">عينات داخلية لبقية البرومبتات المحجوبة: نقيس الالتزام الكامل بالمنتج والمشهد والحركة والصوت قبل فتح أي قالب عام.</p>
        </div>
        <Badge className="bg-primary/15 text-primary">{matrix.totalSamples.toLocaleString("ar-SA")} عينات · ${matrix.estimatedCostUsd}</Badge>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs"><strong>{matrix.requiredPublishableRate.toLocaleString("ar-SA")}%+</strong><p className="mt-1 text-muted-foreground">حد صلاحية النشر المطلوب</p></div>
        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs"><strong>{Object.entries(qualityMix).map(([quality, count]) => `${VIDEO_QUALITY_LABELS[quality as keyof typeof VIDEO_QUALITY_LABELS] ?? quality}: ${count}`).join(" · ")}</strong><p className="mt-1 text-muted-foreground">توزيع الجودات</p></div>
        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs"><strong>{matrix.samples.filter((sample) => sample.requiresProductImage).length.toLocaleString("ar-SA")}</strong><p className="mt-1 text-muted-foreground">عينات بصورة منتج إلزامية</p></div>
      </div>
      <p className="mt-3 rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">{matrix.readinessGate}</p>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {matrix.samples.map((sample) => (
          <div key={sample.sampleId} className="rounded-lg border border-border bg-background/60 p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>{sample.sampleId} — {sample.label}</strong>
              <Badge variant="secondary">{sample.quality} · {sample.durationSeconds}ث</Badge>
            </div>
            <p className="mt-1 text-muted-foreground">{sample.sector} · {sample.personaLabel} · {sample.expectedAspectRatio} · {sample.requiresProductImage ? "صورة منتج إلزامية" : "عينة سريعة"}</p>
            <p className="mt-2 font-semibold text-foreground">{sample.objective}</p>
            <p className="mt-1 text-muted-foreground">بوابة فنية: {sample.technicalGate.join(" · ")}</p>
            <p className="mt-1 text-muted-foreground">شرط النجاح: {sample.mustPass.join(" · ")}</p>
            <p className="mt-2 text-muted-foreground">التقييم: {sample.scorecard.join(" · ")}</p>
            <p className="mt-1 font-semibold text-foreground">{sample.promptAdherenceGate}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs" disabled>
                التشغيل من لوحة الدفعة فقط
              </Button>
              {sample.generationPayload.requiresProductImage && <Badge className="bg-gold/15 text-gold">أضف صورة منتج قبل التشغيل</Badge>}
            </div>
              <details className="mt-2 rounded-md border border-border bg-secondary/30 p-2">
                <summary className="cursor-pointer font-bold text-foreground">برومبت التنفيذ النهائي</summary>
                <Textarea readOnly dir="rtl" value={sample.finalPrompt} className="mt-2 min-h-40 text-xs leading-6" />
              </details>
          </div>
        ))}
      </div>
    </section>
  );
}

function MediumBatchPanel({ batch }: { batch: SaudiVideoMediumBatchResult }) {
  const gateLabel = batch.releaseGate === "ready_for_expansion" ? "جاهزة للتوسيع" : batch.releaseGate === "needs_iteration" ? "تحتاج تحسين" : batch.releaseGate === "ready_for_review" ? "جاهزة للتقييم" : batch.releaseGate === "blocked" ? "متوقفة للمراجعة" : batch.releaseGate === "running" ? "قيد التنفيذ" : "لم تبدأ";
  const gateTone = batch.releaseGate === "ready_for_expansion" || batch.releaseGate === "ready_for_review" ? "bg-success/15 text-success" : batch.releaseGate === "blocked" ? "bg-destructive/15 text-destructive" : "bg-gold/15 text-gold";
  const alreadyEvaluatedCount = batch.samples.filter((sample) => sample.releaseDecision).length;
  const batchReadyForEvaluation = batch.releaseGate === "ready_for_review" || batch.releaseGate === "needs_iteration" || batch.releaseGate === "ready_for_expansion";
  const evaluableCount = batchReadyForEvaluation ? batch.samples.filter((sample) => sample.status === "completed" && sample.resultUrl && !sample.issue && !sample.releaseDecision).length : 0;
  const nextRunnableSamples = batch.samples.filter((sample) => sample.status === "not_generated" || Boolean(sample.issue) || sample.releaseDecision === "reject_or_reprompt" || sample.releaseDecision === "minor_revision");
  const nextRunnableSample = nextRunnableSamples[0] ?? null;
  const nextRunnableHref = nextRunnableSample ? { source: "medium-test" as const, mediumTestSampleId: nextRunnableSample.sampleId, mediumTestTemplateId: nextRunnableSample.templateId } : null;
  const nextEvaluableSample = batchReadyForEvaluation ? batch.samples.find((sample) => sample.status === "completed" && sample.resultUrl && !sample.issue && !sample.releaseDecision) ?? null : null;
  const rerunReason = (sample: SaudiVideoMediumBatchResult["samples"][number]) => sample.issue ?? (sample.releaseDecision === "reject_or_reprompt" ? "قرار التقييم رفض العينة؛ أعد صياغة البرومبت أو بدّل المرجع ثم أعد التوليد." : sample.releaseDecision === "minor_revision" ? "العينة تحتاج تحسيناً قبل التوسيع؛ أعد توليد نسخة محسّنة ثم قيّمها من جديد." : "لم تُولد العينة بعد");
  const activeInstruction = nextEvaluableSample
    ? `قيّم الآن ${nextEvaluableSample.sampleId} — ${nextEvaluableSample.label} قبل فتح أي عينة لاحقة.`
    : nextRunnableSample
    ? `شغّل الآن ${nextRunnableSample.sampleId} — ${nextRunnableSample.label}${nextRunnableSample.requiredProductImage ? " مع صورة منتج واضحة" : ""}.`
    : batch.nextAction;
  const secondInstruction = nextRunnableSamples[1]
    ? `بعدها: ${nextRunnableSamples[1].sampleId} — ${nextRunnableSamples[1].label}`
    : nextEvaluableSample
      ? "بعد التقييم: أكمل تقييم بقية العينات، ثم اضغط تدقيق الدفعة."
      : "بعدها: لا توجد عينة تشغيل تالية قبل تحديث التدقيق.";
  const canOpenNextSample = Boolean(nextRunnableHref && batch.readinessWarnings.length === 0 && batch.processing < 2);
  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-extrabold">تدقيق تنفيذ دفعة الاختبار المتوسط</h2>
          <p className="mt-1 text-xs text-muted-foreground">مطابقة فعلية بين عينات الخطة ومهام الفيديو الموسومة داخلياً قبل أي قرار فتح تجاري للقوالب الاحتياطية.</p>
        </div>
        <Badge className={cn(gateTone)}>{gateLabel} · {batch.executionRate.toLocaleString("ar-SA")}% تنفيذ</Badge>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <MetricTile label="المخطط" value={batch.totalPlanned} />
        <MetricTile label="المولد" value={batch.generated} />
        <MetricTile label="المكتمل" value={batch.completed} />
        <MetricTile label="المقيّم" value={batch.evaluated} />
        <MetricTile label="صالح" value={batch.publishable} />
        <MetricTile label="تعديل" value={batch.needsRevision} />
        <MetricTile label="مرفوض" value={batch.rejected} />
        <MetricTile label="قيد المعالجة" value={batch.processing} />
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="متبقي للتوليد" value={batch.remainingToGenerate} />
        <MetricTile label="متبقي للتقييم" value={batch.remainingToEvaluate} />
        <MetricTile label="قابل للتقييم الآن" value={evaluableCount} />
        <MetricTile label="مقفلة بتقييم" value={alreadyEvaluatedCount} />
        <MetricTile label="عوائق تشغيلية" value={batch.operationalBlockingIssues} />
        <MetricTile label="رفض تجاري" value={batch.commercialRejectedIssues} />
      </div>
      <div className="mt-3 grid gap-2 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className={cn("rounded-lg border p-3 text-xs", batch.activeProviderHealthy ? "border-success/30 bg-success/10" : "border-destructive/30 bg-destructive/10")}>
          <p className="font-extrabold text-foreground">جاهزية المزود</p>
          <p className="mt-1 text-muted-foreground">{batch.activeProviderLabel ?? "لا يوجد مزود نشط"}</p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs">
          <p className="font-extrabold text-foreground">فحص ما قبل التشغيل</p>
          <p className="mt-1 text-muted-foreground">{batch.readinessWarnings.length === 0 ? "جاهز لتشغيل العينة التالية بشرط الالتزام بالترتيب وصورة المنتج عند إلزامها." : batch.readinessWarnings.join(" · ")}</p>
        </div>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricTile label="فشل/استرداد" value={batch.failedOrRefunded} />
        <MetricTile label="مكتمل بلا رابط" value={batch.completedWithoutResult} />
        <MetricTile label="عالقة 45د+" value={batch.staleInProgress} />
        <MetricTile label="نقص صورة منتج" value={batch.missingProductImage} />
        <MetricTile label="عدم تطابق الوسم" value={batch.metadataMismatch} />
        <MetricTile label="عدم تطابق الإعدادات" value={batch.configurationMismatch} />
      </div>
      {batch.evaluated > 0 && <p className="mt-3 rounded-lg border border-border bg-secondary/30 p-3 text-xs font-semibold text-foreground">نسبة الصلاحية التجارية: {batch.commercialValidityRate.toLocaleString("ar-SA")}% — المطلوب {batch.minimumPublishable.toLocaleString("ar-SA")} عينات صالحة على الأقل من أصل {batch.totalPlanned.toLocaleString("ar-SA")} دون فشل أو رفض.</p>}
      <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <p className="rounded-lg border border-border bg-secondary/30 p-3 text-xs font-semibold text-muted-foreground">{batch.releaseGateReason}</p>
        <p className="rounded-lg border border-border bg-secondary/30 p-3 text-xs font-semibold text-foreground">الخطوة التنفيذية: {batch.nextAction}</p>
      </div>
      <div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs font-extrabold text-primary">
        أمر التشغيل الحالي: {activeInstruction}
        {nextRunnableHref && canOpenNextSample && (
          <Button asChild size="sm" className="mt-3 h-8 w-full text-xs sm:w-auto">
            <Link to="/dashboard/generate-video" search={nextRunnableHref} target="_blank">فتح العينة المسموحة الآن</Link>
          </Button>
        )}
        {nextRunnableHref && !canOpenNextSample && <p className="mt-2 text-xs text-muted-foreground">زر التشغيل مقفل حتى تصبح جاهزية المزود سليمة ولا توجد مهام معالجة ممتلئة.</p>}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs">
          <p className="font-extrabold text-primary">١ · الآن</p>
          <p className="mt-1 text-foreground">{activeInstruction}</p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs">
          <p className="font-extrabold text-foreground">٢ · التالي</p>
          <p className="mt-1 text-muted-foreground">{secondInstruction}</p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs">
          <p className="font-extrabold text-foreground">٣ · البوابة</p>
          <p className="mt-1 text-muted-foreground">نفّذ القائمة بالترتيب، ثم قيّم العينات النظيفة فقط، ثم أعد التدقيق قبل أي فتح تجاري.</p>
        </div>
      </div>
      {nextRunnableSamples.length > 0 && (
        <div className="mt-3 rounded-lg border border-border bg-secondary/30 p-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <strong className="text-xs text-foreground">قائمة التشغيل التالية</strong>
            <span className="text-xs text-muted-foreground">{nextRunnableSamples.length.toLocaleString("ar-SA")} عينة تحتاج توليداً أو إصلاحاً أو إعادة تحسين؛ افتحها بالترتيب، ثم عد لتدقيق الدفعة.</span>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {nextRunnableSamples.map((sample, index) => (
              <div key={`run-${sample.sampleId}`} className={cn("rounded-md border border-border bg-background/70 p-2 text-xs", index === 0 && "border-primary/40 bg-primary/10") }>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">{(index + 1).toLocaleString("ar-SA")} · {sample.sampleId}</span>
                  {index === 0 && canOpenNextSample ? <Badge className="bg-primary/15 text-primary">مسموحة الآن</Badge> : index === 0 ? <Badge className="bg-destructive/15 text-destructive">فحص الجاهزية أولاً</Badge> : <Badge variant="secondary">انتظر الدور</Badge>}
                </div>
                <p className="mt-1 truncate text-muted-foreground">{sample.label}</p>
                <p className="mt-1 line-clamp-2 text-muted-foreground">سبب الإعادة: {rerunReason(sample)}</p>
                {index === 0 && canOpenNextSample ? (
                  <Button asChild size="sm" variant="outline" className="mt-2 h-8 w-full text-xs">
                    <Link to="/dashboard/generate-video" search={{ source: "medium-test", mediumTestSampleId: sample.sampleId, mediumTestTemplateId: sample.templateId }} target="_blank">
                      فتح العينة
                    </Link>
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="mt-2 h-8 w-full text-xs" disabled>{index === 0 ? "مقفلة حتى اجتياز الجاهزية" : "مقفلة حتى اكتمال السابقة"}</Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {batch.samples.map((sample) => (
          <div key={sample.sampleId} className="rounded-lg border border-border bg-background/60 p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>{sample.sampleId} — {sample.label}</strong>
              <Badge className={cn(sample.status === "completed" ? "bg-success/15 text-success" : sample.status === "not_generated" ? "bg-muted text-muted-foreground" : sample.status === "failed" || sample.status === "refunded" || sample.status === "cancelled" ? "bg-destructive/15 text-destructive" : "bg-gold/15 text-gold")}>{sample.status}</Badge>
            </div>
            <p className="mt-1 text-muted-foreground">{sample.sector} · {sample.requiredProductImage ? "صورة منتج إلزامية" : "عينة سريعة"} · {sample.creditsCharged ?? "—"} نقطة</p>
            {sample.releaseDecision && <p className="mt-2 font-bold text-foreground">قرار التقييم: {sample.releaseDecision === "publishable" ? "صالح للنشر" : sample.releaseDecision === "minor_revision" ? "يحتاج تعديل" : "مرفوض/إعادة برومبت"} · {sample.evaluationScore ?? "—"}%</p>}
            {sample.resultUrl && <a href={sample.resultUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex font-bold text-primary hover:underline">فتح النتيجة</a>}
            {sample.issue && <p className="mt-2 text-muted-foreground">{sample.issue}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function MetricTile({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs"><strong>{value.toLocaleString("ar-SA")}</strong><p className="mt-1 text-muted-foreground">{label}</p></div>;
}

function PilotEvaluationPanel({ batch, result, saving, onSubmit }: { batch: SaudiVideoMediumBatchResult | null; result: SaudiVideoPilotEvaluationResult | null; saving: boolean; onSubmit: (draft: PilotEvaluationDraft) => void }) {
  const [draft, setDraft] = useState<PilotEvaluationDraft>({ sampleId: "pilot-01", resultUrl: "", productClarity: 4, sceneAdherence: 4, motionAdherence: 4, saudiDialect: 4, negativeSafety: 4, publishReadiness: 4, notes: "" });
  const batchReadyForEvaluation = batch?.releaseGate === "ready_for_review" || batch?.releaseGate === "needs_iteration" || batch?.releaseGate === "ready_for_expansion";
  const evaluableSamples = batchReadyForEvaluation && batch ? batch.samples.filter((sample) => sample.status === "completed" && sample.resultUrl && !sample.issue && !sample.releaseDecision) : [];
  const selectedSample = evaluableSamples.find((sample) => sample.sampleId === draft.sampleId) ?? null;
  useEffect(() => {
    if (!selectedSample && evaluableSamples[0]) setDraft((current) => ({ ...current, sampleId: evaluableSamples[0].sampleId, resultUrl: evaluableSamples[0].resultUrl ?? "" }));
  }, [evaluableSamples, selectedSample]);
  const setScore = (key: keyof Pick<PilotEvaluationDraft, "productClarity" | "sceneAdherence" | "motionAdherence" | "saudiDialect" | "negativeSafety" | "publishReadiness">, value: string) => setDraft((current) => ({ ...current, [key]: Number(value) }));
  const chooseSample = (sampleId: string) => {
    const sample = evaluableSamples.find((item) => item.sampleId === sampleId);
    setDraft((current) => ({ ...current, sampleId, resultUrl: sample?.resultUrl ?? "" }));
  };
  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-extrabold">تقييم نتيجة عينة فعلية</h2>
          <p className="mt-1 text-xs text-muted-foreground">حوّل مشاهدة الفيديو إلى قرار إطلاق واضح: صالح للنشر، يحتاج تعديل بسيط، أو يعاد توليده.</p>
        </div>
        {result && <Badge className={cn(result.decision === "publishable" ? "bg-success/15 text-success" : result.decision === "minor_revision" ? "bg-warning/20 text-warning-foreground" : "bg-destructive/15 text-destructive")}><Gauge className="h-3.5 w-3.5" /> درجة تنفيذ البرومبت {result.score.toLocaleString("ar-SA")}%</Badge>}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[140px_minmax(0,1fr)]">
        <select value={draft.sampleId} onChange={(event) => chooseSample(event.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-xs font-bold text-foreground">
          {evaluableSamples.length === 0 ? <option value={draft.sampleId}>{draft.sampleId}</option> : evaluableSamples.map((sample) => <option key={sample.sampleId} value={sample.sampleId}>{sample.sampleId} — {sample.label}</option>)}
        </select>
        <Input dir="ltr" readOnly value={selectedSample?.resultUrl ?? draft.resultUrl} onChange={(event) => setDraft({ ...draft, resultUrl: event.target.value })} placeholder="يُملأ تلقائياً بعد تدقيق دفعة مكتملة" className="h-9 text-left text-xs" />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <ScoreInput label="المنتج" value={draft.productClarity} onChange={(value) => setScore("productClarity", value)} />
        <ScoreInput label="المشهد" value={draft.sceneAdherence} onChange={(value) => setScore("sceneAdherence", value)} />
        <ScoreInput label="الحركة" value={draft.motionAdherence} onChange={(value) => setScore("motionAdherence", value)} />
        <ScoreInput label="اللهجة" value={draft.saudiDialect} onChange={(value) => setScore("saudiDialect", value)} />
        <ScoreInput label="الممنوعات" value={draft.negativeSafety} onChange={(value) => setScore("negativeSafety", value)} />
        <ScoreInput label="النشر" value={draft.publishReadiness} onChange={(value) => setScore("publishReadiness", value)} />
      </div>
      {evaluableSamples.length === 0 && <p className="mt-2 rounded-lg border border-border bg-secondary/30 p-3 text-xs font-semibold text-muted-foreground">ابدأ بزر تدقيق الدفعة بعد اكتمال توليد كل العينات؛ عند جاهزية الدفعة ستظهر هنا العينات المكتملة غير المقيّمة.</p>}
      {result && <p className="mt-2 text-xs font-semibold text-muted-foreground">{result.gateReason}</p>}
      <Textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="ملاحظات مختصرة بعد مشاهدة العينة…" className="mt-3 min-h-20 text-xs" />
      <Button type="button" size="sm" onClick={() => onSubmit({ ...draft, resultUrl: selectedSample?.resultUrl ?? draft.resultUrl })} disabled={saving || (Boolean(batch) && !selectedSample)} className="mt-3 gap-1">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />} حفظ تقييم العينة
      </Button>
    </section>
  );
}

function ScoreInput({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {
  return (
    <label className="block rounded-lg border border-border bg-secondary/30 p-2 text-xs">
      <span className="font-bold text-muted-foreground">{label}</span>
      <Input type="number" min={1} max={5} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-8" />
    </label>
  );
}

function SaudiFalTestPanel({ draft, productImageUrl, preview, testResult, loading, running, onDraft, onProductImageUrl, onPreview, onRun }: { draft: SaudiFalDraft; productImageUrl: string; preview: SaudiFalPromptPreview | null; testResult: SaudiFalModelTestResult | null; loading: boolean; running: boolean; onDraft: (next: SaudiFalDraft) => void; onProductImageUrl: (value: string) => void; onPreview: () => void; onRun: () => void }) {
  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-extrabold">اختبار fal.ai بالصور الحالية</h2>
          <p className="mt-1 text-xs text-muted-foreground">يستخدم شخصيات قسم الفيديو نفسها مع برومبت سعودي واضح للحركة والصوت قبل أي اعتماد إنتاجي.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onPreview} disabled={loading || running}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />} تجهيز البرومبت</Button>
          <Button type="button" size="sm" onClick={onRun} disabled={loading || running}>{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />} اختبار فعلي</Button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <SelectBox label="النموذج" value={draft.modelId} onChange={(modelId) => onDraft({ ...draft, modelId })} options={FAL_VIDEO_TEST_MODELS.map((model) => ({ value: model.id, label: model.label }))} />
        <SelectBox label="صورة الشخصية" value={draft.personaId} onChange={(personaId) => onDraft({ ...draft, personaId })} options={SAUDI_VIDEO_PERSONAS.map((persona) => ({ value: persona.id, label: persona.label }))} />
        <SelectBox label="السيناريو السعودي" value={draft.scenarioId} onChange={(scenarioId) => onDraft({ ...draft, scenarioId })} options={SAUDI_VIDEO_TEST_SCENARIOS.map((scenario) => ({ value: scenario.id, label: scenario.label }))} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block rounded-lg border border-border bg-secondary/30 p-3">
          <span className="text-sm font-bold">رابط صورة المنتج الاختيارية</span>
          <Input value={productImageUrl} onChange={(event) => onProductImageUrl(event.target.value)} placeholder="https://..." className="mt-2 h-9 text-xs" />
        </label>
        <ControlRow label="إضافة صورة منتج" hint="لقياس التزام النموذج بالمنتج داخل الإعلان">
          <Switch checked={draft.includeProductImage} onCheckedChange={(includeProductImage) => onDraft({ ...draft, includeProductImage })} />
        </ControlRow>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <ControlRow label="طلب صوت سعودي" hint="يطبّق فقط على النماذج التي تدعم الصوت">
          <Switch checked={draft.includeVoice} onCheckedChange={(includeVoice) => onDraft({ ...draft, includeVoice })} />
        </ControlRow>
        {testResult && <div className={cn("rounded-lg border p-3 text-xs", testResult.ok ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive")}>{testResult.ok ? `الحالة: ${testResult.status} · ${testResult.latencyMs}ms · $${testResult.estimatedCostUsd ?? "—"}` : testResult.error}</div>}
      </div>
      {preview && (
        <div className="mt-4 grid gap-3 lg:grid-cols-[220px_1fr]">
          <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs leading-6">
            <p className="font-bold">التقييم: {preview.imageEvaluation.score.toLocaleString("ar-SA")}/100</p>
            <p className="mt-1 text-muted-foreground">{preview.imageEvaluation.recommendation}</p>
            <p className="mt-2 text-muted-foreground">{preview.model.label} · {preview.persona.label} · {preview.scenario.label}</p>
          </div>
          <Textarea readOnly value={preview.prompt} className="min-h-56 text-left text-xs leading-6" dir="ltr" />
        </div>
      )}
    </section>
  );
}

function SelectBox({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-xs">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function RouterResultPanel({ results }: { results: Array<AdminVideoRouterTestResult & { scenarioLabel: string }> }) {
  const allPassed = results.every((result) => result.ok);
  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-extrabold">نتيجة اختبار الراوتر</h2>
          <p className="mt-1 text-xs text-muted-foreground">مسارات آمنة: سريع/إعلاني/احترافي مع 0–2 صور، دون إنشاء فيديو أو خصم نقاط</p>
        </div>
        <Badge className={cn(allPassed ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>{allPassed ? "كل المسارات جاهزة" : "يوجد مسار يحتاج ضبط"}</Badge>
      </div>
      <div className="mt-3 space-y-3">
        {results.map((result) => (
          <div key={result.scenarioLabel} className="rounded-lg border border-border bg-secondary/30 p-3 text-xs">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="font-extrabold">{result.scenarioLabel}</span>
              <Badge className={cn(result.ok ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>{result.ok ? `المختار: ${result.selectedProvider}` : "لا يوجد مزود مؤهل"}</Badge>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {result.candidates.map((candidate) => (
                <div key={candidate.providerKey} className="rounded-md border border-border bg-background/60 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">{candidate.displayName}</span>
                    <Badge variant="secondary">#{candidate.effectivePriority === candidate.priority ? candidate.priority : `${candidate.priority}→${candidate.effectivePriority}`}</Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">{candidate.mode} · {candidate.reason}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CostInput({ label, value, disabled, onCommit }: { label: string; value: number; disabled: boolean; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const next = Number(draft);
    if (Number.isFinite(next) && next >= 0 && next !== value) onCommit(Math.round(next));
  };
  return (
    <label className="block">
      <span className="text-[10px] font-bold text-muted-foreground">{label}</span>
      <Input value={draft} type="number" min={0} max={100000} disabled={disabled} onChange={(event) => setDraft(event.target.value)} onBlur={commit} className="mt-1 h-8 text-xs" />
    </label>
  );
}

function ProviderCapabilities({ metadata, provider }: { metadata: AdminVideoProviderConfig["metadata"]; provider: AdminVideoProviderConfig }) {
  const data = (metadata as { supports_two_images?: boolean; supports_voice?: boolean } | null) ?? {};
  const caps = [
    provider.supports_starting_frame ? "صورة مرجعية" : "بدون صور",
    data.supports_two_images ? "صورتان" : "صورة واحدة",
    data.supports_voice ? "صوت" : "بدون صوت مؤكد",
    provider.supports_9_16 ? "9:16" : null,
    provider.supports_1_1 ? "1:1" : null,
    provider.supports_16_9 ? "16:9" : null,
  ].filter(Boolean);
  return <p className="mt-2">القدرات: {caps.join(" · ")}</p>;
}

function LastConnectionTest({ metadata }: { metadata: AdminVideoProviderConfig["metadata"] }) {
  const tests = (metadata as { connection_tests?: Array<{ ok?: boolean; message?: string; checkedAt?: string; latencyMs?: number }> } | null)?.connection_tests;
  const last = Array.isArray(tests) ? tests.at(-1) : null;
  if (!last) return null;
  return <p className="mt-1">آخر اختبار: {last.ok ? "ناجح" : "فشل"} · {last.latencyMs ?? 0}ms · {last.message ?? "—"}</p>;
}

function ControlRow({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 p-3">
      <div>
        <p className="text-sm font-bold">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
