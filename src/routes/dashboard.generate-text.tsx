import { useEffect, useState } from "react";
import { createFileRoute, Link, useRouter, useSearch } from "@tanstack/react-router";
import { Wand2, Copy, Check, Loader2, Star, LayoutGrid, Megaphone, Image as ImageIcon, Clapperboard, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { TEXT_PROMPTS } from "@/lib/prompts-data";
import { getSuggestionsFor } from "@/lib/prompt-suggestions";
import { generateText } from "@/server/ai-functions";
import { supabase } from "@/integrations/supabase/client";
import { QuotaExceededDialog, isQuotaError } from "@/components/quota-exceeded-dialog";
import { CampaignContextBar } from "@/components/campaign-context-bar";
import { useAuth } from "@/hooks/use-auth";
import { useCampaignContext } from "@/hooks/useCampaignContext";
import { getMemorySignals, getSmartPromptSuggestions } from "@/lib/memory-insights";
import { campaignContextSummary, campaignExecutionSearch, campaignSmartPromptFromContext, campaignTextTemplate, parseCampaignExecutionSearch, resolveCampaignExecutionContext, type CampaignExecutionContext } from "@/lib/campaign-smart-context";
import { track } from "@/lib/analytics/posthog";

type TextSearch = CampaignExecutionContext & { __lovable_token?: string; template?: string };

export const Route = createFileRoute("/dashboard/generate-text")({
  head: () => ({ meta: [{ title: "اكتب نصاً يبيع — رِفد" }] }),
  validateSearch: (s: Record<string, unknown>): TextSearch => ({
    __lovable_token: typeof s.__lovable_token === "string" ? s.__lovable_token : undefined,
    template: typeof s.template === "string" ? s.template : undefined,
    ...parseCampaignExecutionSearch(s),
  }),
  component: GenerateTextPage,
});

function GenerateTextPage() {
  const { profile } = useAuth();
  const search = useSearch({ from: "/dashboard/generate-text" });
  const campaignContext = useCampaignContext({ campaignId: search.campaignId, campaignPackId: search.campaignPackId });
  const initial = search.template && TEXT_PROMPTS.some((p) => p.id === search.template)
    ? search.template
    : TEXT_PROMPTS[0].id;
  const [templateId, setTemplateId] = useState(initial);
  const [topic, setTopic] = useState(search.prompt ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [quotaDialog, setQuotaDialog] = useState<{ open: boolean; reason?: string }>({ open: false });
  const router = useRouter();

  const template = TEXT_PROMPTS.find((p) => p.id === templateId) ?? TEXT_PROMPTS[0];
  const smartSuggestions = getSmartPromptSuggestions(profile, "text");
  const memorySignals = getMemorySignals(profile).slice(0, 4);

  const resolvedCampaignContext = resolveCampaignExecutionContext(campaignContext.campaign, search);

  useEffect(() => {
    if (!campaignContext.campaign && !search.smart) return;
    if (search.prompt && !search.smart) return;
    const context = resolveCampaignExecutionContext(campaignContext.campaign, search);
    setTopic((search.smart ? campaignSmartPromptFromContext(context, "text", campaignContext.campaign) : campaignContext.campaign?.text_prompt ?? search.prompt ?? "").slice(0, 2000));
    if (search.smart && campaignContext.campaign) setTemplateId(campaignTextTemplate(campaignContext.campaign));
  }, [campaignContext.campaign, search.prompt, search.smart]);

  const generate = async () => {
    if (!topic.trim()) {
      toast.error("اكتب الموضوع/التفاصيل أولاً");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("سجّل الدخول أولاً");

      const out = await generateText({
        data: { prompt: topic, templateTitle: template.title, templateId: template.id, campaignId: campaignContext.campaignId ?? search.campaignId, campaignPackId: search.campaignPackId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setResult(out.result);
      setRemaining(out.remainingDaily);
      track("generation_created", { kind: "text", template: template.id });
      toast.success("تم التوليد ✨");
      router.invalidate();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "خطأ في التوليد";
      if (isQuotaError(msg)) {
        setQuotaDialog({ open: true, reason: msg });
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <DashboardShell>
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black text-primary">اكتب نصاً يبيع</p>
          <h1 className="mt-1 text-2xl font-extrabold">حوّل موجز الحملة إلى كلام يدفع للشراء</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">اختر قالباً، أضف تفاصيل العرض، واستلم نصاً واضحاً للمتجر أو الإعلان أو واتساب.</p>
          {campaignContext.campaignId && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-bold text-primary">
              <Megaphone className="h-3.5 w-3.5" /> هذا النص جزء من حملة محفوظة
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-foreground/80">
            <span className="rounded-full border border-border bg-secondary/50 px-3 py-1">هوك + وصف + CTA</span>
            <span className="rounded-full border border-border bg-secondary/50 px-3 py-1">عامية سعودية</span>
            <span className="rounded-full border border-border bg-secondary/50 px-3 py-1">قابل للنسخ فوراً</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1">
            <Link to="/dashboard/templates"><LayoutGrid className="h-3.5 w-3.5" /> كل القوالب</Link>
          </Button>
          {remaining !== null && (
            <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">
              استخدامك اليومي: باقي {remaining} نص
            </span>
          )}
        </div>
      </div>

      <CampaignContextBar campaign={campaignContext.campaign} campaignId={campaignContext.requestedCampaignId} loading={campaignContext.loading} error={campaignContext.error} summary={campaignContextSummary(resolvedCampaignContext)} context={resolvedCampaignContext} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
              <div className="mb-4 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-sm font-extrabold text-primary">{search.smart && campaignContext.campaign ? "1) جهّزنا النص من اختيارات الحملة" : "1) اختر القالب واكتب تفاصيل البيع"}</div>
          <div className="space-y-4">
            <div>
              <Label>اختر قالباً</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEXT_PROMPTS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.badge && <Star className="ml-1 inline h-3 w-3 text-gold" />}
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">{template.description}</p>
            </div>
            <div>
              <Label htmlFor="topic">تفاصيل المنتج أو الحملة</Label>
              <Textarea
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="مثلاً: عطر شرقي فاخر بسعر 199 ر.س، مناسب كهدية، مع توصيل سريع داخل السعودية"
                className="mt-1 min-h-32"
                maxLength={2000}
              />
              <p className="mt-1 text-xs text-muted-foreground">{topic.length}/2000</p>
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">اقتراحات سريعة:</p>
                <div className="flex flex-wrap gap-1.5">
                  {getSuggestionsFor(templateId).map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setTopic(s)}
                      className="rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-[11px] text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              {smartSuggestions.length > 0 && (
                <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-xs font-bold text-primary">اقتراحات مبنية على ذاكرة متجرك</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {smartSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setTopic(suggestion)}
                        className="rounded-full border border-primary/20 bg-background px-2.5 py-1 text-[11px] text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Button onClick={generate} disabled={loading} className="h-12 w-full gradient-primary font-extrabold text-primary-foreground shadow-elegant">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> جاري تجهيز النص...</> : <><Wand2 className="h-4 w-4" /> اكتب النص الآن</>}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">2) النص الجاهز للبيع</h3>
            {result && (
              <button
                onClick={copy}
                className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs"
              >
                {copied ? <><Check className="h-3 w-3 text-success" /> تم</> : <><Copy className="h-3 w-3" /> نسخ</>}
              </button>
            )}
          </div>
          {result ? (
            <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-border bg-secondary/40 p-4 text-right font-sans text-sm leading-relaxed">{result}</pre>
          ) : (
            <div className="mt-3 flex h-48 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              اكتب تفاصيل المنتج واضغط زر الكتابة — النص سيظهر هنا جاهزاً للنسخ.
            </div>
          )}
          {memorySignals.length > 0 && (
            <div className="mt-4 rounded-xl border border-border bg-secondary/30 p-4">
              <p className="text-xs font-bold text-muted-foreground">ما الذي يفترض أن ينعكس من الذاكرة هنا؟</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {memorySignals.map((signal) => (
                  <span key={signal} className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-bold text-foreground/85">
                    {signal}
                  </span>
                ))}
              </div>
            </div>
          )}
          {result && (
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <Button asChild variant="outline" size="sm" className="gap-1">
                <Link to="/dashboard/generate-image" search={campaignExecutionSearch({ ...resolvedCampaignContext, campaignId: campaignContext.campaignId ?? search.campaignId, campaignPackId: search.campaignPackId }, result) as never}>
                  <ImageIcon className="h-3.5 w-3.5" /> صمّم صورة لهذا النص
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="gap-1">
                <Link to="/dashboard/generate-video" search={campaignExecutionSearch({ ...resolvedCampaignContext, campaignId: campaignContext.campaignId ?? search.campaignId, campaignPackId: search.campaignPackId }, result) as never}>
                  <Clapperboard className="h-3.5 w-3.5" /> أنشئ فيديو من النص
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="gap-1">
                <Link to={campaignContext.campaignId ? "/dashboard/campaign-studio" : "/dashboard/library"} search={campaignContext.campaignId ? { campaignId: campaignContext.campaignId, focus: "house", updatedAsset: "text" } as never : undefined}>
                  {campaignContext.campaignId ? <Megaphone className="h-3.5 w-3.5" /> : <ArrowLeft className="h-3.5 w-3.5" />}
                  {campaignContext.campaignId ? "العودة للاستوديو" : "افتح المكتبة"}
                </Link>
              </Button>
            </div>
          )}
          <div className="mt-3 text-center">
            <Link to="/dashboard/library" className="text-xs text-primary hover:underline">
              عرض كل المحتوى في المكتبة ←
            </Link>
          </div>
        </div>
      </div>

      <QuotaExceededDialog
        open={quotaDialog.open}
        onOpenChange={(v) => setQuotaDialog((s) => ({ ...s, open: v }))}
        kind="نص"
        reason={quotaDialog.reason}
      />
    </DashboardShell>
  );
}

