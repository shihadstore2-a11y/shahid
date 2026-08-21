import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import {
  Upload,
  Wand2,
  Loader2,
  Download,
  X,
  Image as ImageIcon,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { editImage } from "@/server/ai-functions";
import { supabase } from "@/integrations/supabase/client";
import {
  QuotaExceededDialog,
  isQuotaError,
} from "@/components/quota-exceeded-dialog";
import { useCampaignContext } from "@/hooks/useCampaignContext";
import { CampaignContextBar } from "@/components/campaign-context-bar";
import { campaignContextSummary, campaignEditPresetFromContext, parseCampaignExecutionSearch, resolveCampaignExecutionContext, type CampaignExecutionContext } from "@/lib/campaign-smart-context";

type EditImageSearch = CampaignExecutionContext;

export const Route = createFileRoute("/dashboard/edit-image")({
  head: () => ({
    meta: [
      { title: "حسّن صورة منتجك بدل إعادة التصوير — رِفد" },
      {
        name: "description",
        content:
          "ارفع صورة المنتج وحسّنها لإعلان أو صفحة متجر: خلفية أنظف، إضاءة أوضح، ونص عربي عند الحاجة.",
      },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): EditImageSearch => ({
    ...parseCampaignExecutionSearch(s),
  }),
  component: EditImagePage,
});

const PRESETS = [
  {
    id: "remove-bg",
    label: "إزالة الخلفية",
    desc: "خلفية بيضاء نظيفة جاهزة للمتجر",
    prompt:
      "Remove the background completely and replace it with a clean pure white background. Keep the product centered, sharp, and well-lit. Professional product photography style.",
  },
  {
    id: "enhance",
    label: "تحسين الإضاءة والجودة",
    desc: "ألوان أوضح وتفاصيل أحدّ",
    prompt:
      "Enhance the lighting, sharpness, and color vibrancy of this product photo. Make it look professional and ready for an e-commerce store. Keep the original composition.",
  },
  {
    id: "luxury-bg",
    label: "خلفية فخمة",
    desc: "خلفية رخامية ذهبية راقية",
    prompt:
      "Replace the background with a luxurious marble and gold gradient backdrop. Add subtle elegant lighting. Premium product photography for high-end Saudi market.",
  },
  {
    id: "lifestyle-bg",
    label: "خلفية حياتية",
    desc: "بيئة طبيعية للمنتج",
    prompt:
      "Place this product in a natural lifestyle setting: a warm, modern Saudi home with soft daylight. Photorealistic, professional composition.",
  },
  {
    id: "add-text",
    label: "إضافة نص عربي",
    desc: "عنوان أو سعر بخط بارز",
    prompt:
      "Add a bold Arabic text overlay at the top: 'عرض خاص'. Use elegant typography that fits the product style. Position it where it doesn't cover the product.",
  },
  {
    id: "instagram-square",
    label: "بوست إنستقرام",
    desc: "إطار 1:1 جاهز للنشر",
    prompt:
      "Reframe this image into a perfect square Instagram post. Add a subtle gradient background that complements the product colors. Center the product elegantly.",
  },
];

const MAX_BYTES = 8 * 1024 * 1024; // 8MB قبل الترميز

function EditImagePage() {
  const router = useRouter();
  const navigate = useNavigate({ from: "/dashboard/edit-image" });
  const search = useSearch({ from: "/dashboard/edit-image" });
  const campaignContext = useCampaignContext({ campaignId: search.campaignId, campaignPackId: search.campaignPackId });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoLoadedPathRef = useRef<string | null>(null);
  const userPickedImageRef = useRef(false);
  const [originalDataUrl, setOriginalDataUrl] = useState<string | null>(null);
  const [originalName, setOriginalName] = useState<string>("");
  const [presetId, setPresetId] = useState<string>(PRESETS[0].id);
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [quotaDialog, setQuotaDialog] = useState<{
    open: boolean;
    reason?: string;
  }>({ open: false });
  const resolvedCampaignContext = resolveCampaignExecutionContext(campaignContext.campaign, search);

  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];

  useEffect(() => {
    if (search.smart) setPresetId(campaignEditPresetFromContext(search, campaignContext.campaign));
  }, [campaignContext.campaign, search.smart]);

  useEffect(() => {
    const productImagePath = campaignContext.campaign?.product_image_path;
    if (!productImagePath || userPickedImageRef.current || autoLoadedPathRef.current === productImagePath) return;

    let alive = true;
    autoLoadedPathRef.current = productImagePath;
    supabase.storage
      .from("campaign-product-images")
      .createSignedUrl(productImagePath, 60 * 10)
      .then(async ({ data, error }) => {
        if (error || !data?.signedUrl) throw new Error(error?.message ?? "تعذر تحميل صورة المنتج");
        const response = await fetch(data.signedUrl);
        if (!response.ok) throw new Error("تعذر تحميل صورة المنتج");
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onload = () => {
          if (!alive || userPickedImageRef.current) return;
          setOriginalDataUrl(reader.result as string);
          setOriginalName("صورة المنتج من الحملة");
          setResultUrl(null);
        };
        reader.onerror = () => { throw new Error("تعذر قراءة صورة المنتج"); };
        reader.readAsDataURL(blob);
      })
      .catch(() => {
        if (alive) toast.error("تعذر تحميل صورة المنتج تلقائياً، يمكنك رفعها يدوياً");
      });

    return () => { alive = false; };
  }, [campaignContext.campaign?.product_image_path]);

  const handleFile = (file: File | null | undefined) => {
    if (!file) return;
    userPickedImageRef.current = true;
    if (!file.type.startsWith("image/")) {
      toast.error("الملف يجب أن يكون صورة");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("حجم الصورة يجب ألا يتجاوز 8MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setOriginalDataUrl(reader.result as string);
      setOriginalName(file.name);
      setResultUrl(null);
    };
    reader.onerror = () => toast.error("فشل قراءة الصورة");
    reader.readAsDataURL(file);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files?.[0]);
  };

  const clear = () => {
    setOriginalDataUrl(null);
    setOriginalName("");
    setResultUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const go = async () => {
    if (!originalDataUrl) {
      toast.error("ارفع صورة أولاً");
      return;
    }
    const finalPrompt = preset.prompt;

    setLoading(true);
    setResultUrl(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("سجّل الدخول أولاً");

      const out = await editImage({
        data: {
          imageDataUrl: originalDataUrl,
          prompt: finalPrompt,
          templateTitle: preset.label,
          templateId: preset.id,
          campaignId: campaignContext.campaignId ?? campaignContext.requestedCampaignId,
          campaignPackId: campaignContext.campaignId || campaignContext.requestedCampaignId ? search.campaignPackId : undefined,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      setResultUrl(out.url);
      setRemaining(out.remainingDaily);
      toast.success("الصورة محسّنة وجاهزة ✨");
      router.invalidate();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "تعذر تحسين الصورة";
      if (isQuotaError(msg)) {
        setQuotaDialog({ open: true, reason: msg });
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const returnToStudio = () => {
    const id = campaignContext.campaignId ?? campaignContext.requestedCampaignId;
    if (!id) return;
    void navigate({ to: "/dashboard/campaign-studio", search: { campaignId: id, focus: "house", updatedAsset: "image" } as never });
  };

  return (
    <DashboardShell>
      <CampaignContextBar campaign={campaignContext.campaign} campaignId={campaignContext.requestedCampaignId} loading={campaignContext.loading} error={campaignContext.error} summary={campaignContextSummary(resolvedCampaignContext)} context={resolvedCampaignContext} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">حسّن صورة منتجك بدل إعادة التصوير</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ارفع صورة المنتج، اختر نوع التحسين، واحصل على نسخة أنظف جاهزة للإعلان أو صفحة المتجر.
          </p>
        </div>
        {remaining !== null && (
          <span className="rounded-full bg-gold/10 px-3 py-1 text-xs font-bold text-gold">
            استخدامك اليومي: باقي {remaining.toLocaleString("ar-SA")} صورة
          </span>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-soft space-y-4">
          <div>
            <Label>الصورة الأصلية</Label>
            {!originalDataUrl ? (
              <div
                onDrop={onDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 flex aspect-video cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-secondary/30 p-6 text-center transition-colors hover:border-primary/40 hover:bg-secondary/50"
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">اسحب صورة هنا أو اضغط للرفع</p>
                <p className="text-xs text-muted-foreground">
                  JPG / PNG / WEBP — حتى 8MB
                </p>
              </div>
            ) : (
              <div className="mt-1 relative overflow-hidden rounded-lg border border-border bg-secondary/30">
                <img
                  src={originalDataUrl}
                  alt={originalName}
                  className="h-auto max-h-72 w-full object-contain"
                />
                <button
                  onClick={clear}
                  className="absolute top-2 left-2 rounded-full bg-background/90 p-1.5 text-muted-foreground shadow-soft hover:text-foreground"
                  aria-label="حذف الصورة"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 truncate bg-gradient-to-t from-foreground/60 to-transparent p-2 text-xs text-background">
                  {originalName}
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>

          <div>
            <Label>نوع التحسين</Label>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              اختر نوع التحسين المناسب لصورة المنتج.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPresetId(p.id)}
                  className={cn(
                    "rounded-lg border p-3 text-right text-sm transition-colors",
                    presetId === p.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <div className="font-bold">{p.label}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {p.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={go}
            disabled={loading || !originalDataUrl}
            className="w-full gradient-primary text-primary-foreground shadow-elegant"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> جاري تحسين الصورة...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" /> حسّن الصورة
              </>
            )}
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">النتيجة</h3>
            <div className="flex flex-wrap items-center gap-2">
              {resultUrl && campaignContext.requestedCampaignId && (
                <Button onClick={returnToStudio} size="sm" className="h-8 gap-1 text-xs">
                  <ArrowLeft className="h-3.5 w-3.5" /> حفظ والعودة للاستوديو
                </Button>
              )}
              {resultUrl && (
                <a
                  href={resultUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs hover:bg-accent"
                >
                  <Download className="h-3 w-3" /> تحميل
                </a>
              )}
            </div>
          </div>
          <div className="mt-3 flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-secondary/30 text-sm text-muted-foreground">
            {resultUrl ? (
              <img
                src={resultUrl}
                alt="الصورة المعدّلة"
                className="h-full w-full object-contain"
              />
            ) : loading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs">قد يستغرق 15-30 ثانية</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-center">
                <ImageIcon className="h-8 w-8 opacity-40" />
                <p>الصورة المحسّنة ستظهر هنا</p>
              </div>
            )}
          </div>
          <div className="mt-3 text-center">
            <Link
              to="/dashboard/library"
              className="text-xs text-primary hover:underline"
            >
              اعرض كل أصولك في المكتبة ←
            </Link>
          </div>
        </div>
      </div>

      <QuotaExceededDialog
        open={quotaDialog.open}
        onOpenChange={(v) => setQuotaDialog((s) => ({ ...s, open: v }))}
        kind="صورة"
        reason={quotaDialog.reason}
      />
    </DashboardShell>
  );
}

