import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Check, CheckCircle2, ChevronDown, Clapperboard, Copy, FileText, Image as ImageIcon, Loader2, PlayCircle, Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { campaignExecutionSearch, type CampaignExecutionContext } from "@/lib/campaign-smart-context";
import { useCampaignContext } from "@/hooks/useCampaignContext";
import { generateCampaignBrief, getCampaignLiveHome, saveCampaignPack, type CampaignBrief, type CampaignLiveHome, type CampaignPack } from "@/server/campaign-packs";

type CampaignGoal = "launch" | "clearance" | "upsell" | "leads" | "competitive" | "winback";
type DbChannel = "instagram" | "snapchat" | "tiktok" | "whatsapp";
type StudioChannel = DbChannel | "email" | "all";
type CampaignSearch = {
  __lovable_token?: string;
  product?: string;
  audience?: string;
  offer?: string;
  goal?: CampaignGoal;
  channel?: DbChannel;
  campaignId?: string;
  focus?: "house";
  updatedAsset?: "text" | "image" | "video";
};
type Option = { value: string; label: string; description?: string };

const CAMPAIGN_PRODUCT_IMAGES_BUCKET = "campaign-product-images";
const CAMPAIGN_CENTER_PROGRESS = 100;

const GOALS: Array<{ value: CampaignGoal; title: string; prompt: string }> = [
  { value: "launch", title: "إطلاق منتج", prompt: "عندك منتج جديد؟" },
  { value: "clearance", title: "تصفية المخزون", prompt: "مخزونك الراكد يحتاج حركة؟" },
  { value: "upsell", title: "زيادة قيمة السلة", prompt: "تبي ترفع قيمة طلب الزبون؟" },
  { value: "leads", title: "بناء قاعدة عملاء", prompt: "تبي تجمع عملاء جدد؟" },
  { value: "competitive", title: "مواجهة المنافسين", prompt: "تبي تثبت للزبون إنك الأفضل؟" },
  { value: "winback", title: "إعادة الاستهداف", prompt: "تبي تسترجع عملاءك القدامى؟" },
];

const AUDIENCES: Option[] = [
  { value: "luxury_lovers", label: "عشاق الفخامة", description: "يبحثون عن التميز والحصرية" },
  { value: "busy_moms", label: "الأمهات العمليات", description: "يبحثون عن الحلول السريعة والسهلة" },
  { value: "tech_youth", label: "الشباب التقني", description: "مهتمون بأحدث التقنيات والعروض" },
  { value: "bargain_hunters", label: "عشاق الصفقات", description: "ينتظرون أقوى العروض وأفضل قيمة" },
  { value: "early_adopters", label: "المتبنون الأوائل", description: "أول من يجرّب منتجك الجديد" },
  { value: "gift_givers", label: "عملاء المناسبات والهدايا", description: "يدورون على هدية رايقة ومميزة" },
];

const SECTORS: Option[] = [
  { value: "perfumes", label: "عطور", description: "لغة فخامة، ثبات، وإهداء" },
  { value: "abayas", label: "عبايات وأزياء", description: "أناقة يومية ومناسبات" },
  { value: "coffee_sweets", label: "قهوة وحلويات", description: "ضيافة، مزاج، ولمّة" },
  { value: "gifts", label: "هدايا", description: "مناسبات وخيارات جاهزة" },
  { value: "electronics", label: "إلكترونيات", description: "منفعة، سرعة، وضمان" },
  { value: "personal_care", label: "عناية شخصية", description: "نتيجة ملموسة وثقة" },
  { value: "home_decor", label: "منزل وديكور", description: "راحة، ذوق، وتحسين المكان" },
  { value: "general", label: "متجر عام", description: "صياغة مرنة لأي منتج" },
];

const OFFERS: Option[] = [
  { value: "pct_30", label: "خصم 30%" },
  { value: "bogo", label: "اشترِ 2 واحصل على 1" },
  { value: "free_shipping", label: "توصيل مجاني" },
  { value: "bundle", label: "باقة حصرية" },
  { value: "gift", label: "هدية مع الطلب" },
];

const CHANNELS: Array<Option & { value: StudioChannel }> = [
  { value: "instagram", label: "انستقرام" },
  { value: "snapchat", label: "سناب شات" },
  { value: "tiktok", label: "تيك توك" },
  { value: "whatsapp", label: "واتساب" },
  { value: "email", label: "البريد الإلكتروني" },
  { value: "all", label: "كل القنوات" },
];

const OCCASIONS: Option[] = [
  { value: "ramadan", label: "رمضان" },
  { value: "eid", label: "العيد" },
  { value: "national_day", label: "اليوم الوطني" },
  { value: "back_to_school", label: "العودة للمدارس" },
  { value: "year_end", label: "نهاية السنة" },
  { value: "none", label: "بدون مناسبة" },
];

const CUSTOMER_STAGES: Option[] = [
  { value: "new", label: "عملاء جدد أول مرة يسمعون عنا" },
  { value: "considering", label: "عملاء مهتمين بس مترددين" },
  { value: "loyal", label: "عملاء أوفياء نحب نكافئهم" },
  { value: "lost", label: "عملاء فقدناهم ونبيهم يرجعون" },
];

export const Route = createFileRoute("/dashboard/campaign-studio")({
  head: () => ({ meta: [{ title: "استوديو الحملات الاستراتيجي — رِفد" }] }),
  validateSearch: (s: Record<string, unknown>): CampaignSearch => ({
    __lovable_token: typeof s.__lovable_token === "string" ? s.__lovable_token : undefined,
    product: typeof s.product === "string" ? s.product.slice(0, 500) : undefined,
    audience: typeof s.audience === "string" ? s.audience.slice(0, 500) : undefined,
    offer: typeof s.offer === "string" ? s.offer.slice(0, 500) : undefined,
    goal: GOALS.some((goal) => goal.value === s.goal) ? (s.goal as CampaignGoal) : undefined,
    channel: ["instagram", "snapchat", "tiktok", "whatsapp"].includes(String(s.channel)) ? (s.channel as DbChannel) : undefined,
    campaignId: typeof s.campaignId === "string" ? s.campaignId : undefined,
    focus: s.focus === "house" ? "house" : undefined,
    updatedAsset: ["text", "image", "video"].includes(String(s.updatedAsset)) ? (s.updatedAsset as "text" | "image" | "video") : undefined,
  }),
  component: CampaignStudioPage,
});

function CampaignStudioPage() {
  const search = useSearch({ from: "/dashboard/campaign-studio" });
  const campaignContext = useCampaignContext({ campaignId: search.campaignId });
  const savePackFn = useServerFn(saveCampaignPack);
  const generateBriefFn = useServerFn(generateCampaignBrief);
  const getLiveHomeFn = useServerFn(getCampaignLiveHome);
  const previewRef = useRef<HTMLElement | null>(null);
  const liveSnapshotRef = useRef<{ text: boolean; image: boolean; video: boolean } | null>(null);
  const [goal, setGoal] = useState<CampaignGoal | null>(search.goal ?? null);
  const [product, setProduct] = useState(search.product ?? "");
  const [sector, setSector] = useState(SECTORS[7].value);
  const [audience, setAudience] = useState(search.audience ?? AUDIENCES[0].value);
  const [offer, setOffer] = useState(search.offer ?? OFFERS[0].value);
  const [channel, setChannel] = useState<StudioChannel>(search.channel ?? "instagram");
  const [occasion, setOccasion] = useState(OCCASIONS[5].value);
  const [customerStage, setCustomerStage] = useState(CUSTOMER_STAGES[0].value);
  const [activePackId, setActivePackId] = useState<string | undefined>();
  const [productImagePath, setProductImagePath] = useState<string | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [brief, setBrief] = useState<CampaignBrief | null>(null);
  const [liveHome, setLiveHome] = useState<CampaignLiveHome | null>(null);
  const [loadingLiveHome, setLoadingLiveHome] = useState(false);
  const [highlightHouse, setHighlightHouse] = useState(false);
  const [updatedKinds, setUpdatedKinds] = useState<Array<"text" | "image" | "video">>([]);
  const [returnBanner, setReturnBanner] = useState(false);

  const selectedGoal = GOALS.find((item) => item.value === goal) ?? null;
  const sectorOption = findOption(SECTORS, sector);
  const audienceOption = findOption(AUDIENCES, audience);
  const offerOption = findOption(OFFERS, offer);
  const channelOption = findOption(CHANNELS, channel);
  const occasionOption = findOption(OCCASIONS, occasion);
  const stageOption = findOption(CUSTOMER_STAGES, customerStage);
  const dbChannel = toDbChannel(channel);
  const executionContext = useMemo<CampaignExecutionContext>(() => ({
    campaignId: activePackId,
    sector: sectorOption.label,
    audience: audienceOption.label,
    offer: offerOption.label,
    channel: channelOption.label,
    occasion: occasionOption.label,
    customerStage: stageOption.label,
    goal: goal ?? undefined,
    productName: product.trim() || undefined,
    productImagePath: productImagePath ?? undefined,
  }), [activePackId, audienceOption.label, channelOption.label, goal, occasionOption.label, offerOption.label, product, productImagePath, sectorOption.label, stageOption.label]);
  const planProgressItems = useMemo(
    () => [
      { label: "هدف الحملة", done: Boolean(goal) },
      { label: "اسم المنتج", done: product.trim().length >= 2 },
      { label: "صورة المنتج", done: Boolean(productImagePath || productImagePreview) },
      { label: "القطاع", done: Boolean(sector) },
      { label: "الجمهور", done: Boolean(audience) },
      { label: "العرض", done: Boolean(offer) },
      { label: "القناة", done: Boolean(channel) },
      { label: "مرحلة العميل", done: Boolean(customerStage) },
    ],
    [audience, channel, customerStage, goal, offer, product, productImagePath, productImagePreview, sector],
  );
  const planProgress = Math.round((planProgressItems.filter((item) => item.done).length / planProgressItems.length) * 100);

  const draftBrief = useMemo(() => {
    return [
      selectedGoal ? `الهدف: ${selectedGoal.title}` : "الهدف: لم يتم اختياره بعد",
      `المنتج: ${product.trim() || "اسم المنتج غير مكتمل"}`,
      `قطاع المتجر: ${sectorOption.label}`,
      `الجمهور: ${audienceOption.label}`,
      `العرض: ${offerOption.label}`,
      `القناة: ${channelOption.label}`,
      `المناسبة: ${occasionOption.label}`,
      `مرحلة العميل: ${stageOption.label}`,
    ].join("\n");
  }, [audienceOption.label, channelOption.label, occasionOption.label, offerOption.label, product, sectorOption.label, selectedGoal, stageOption.label]);

  useEffect(() => {
    return () => {
      if (productImagePreview?.startsWith("blob:")) URL.revokeObjectURL(productImagePreview);
    };
  }, [productImagePreview]);

  useEffect(() => {
    if (!campaignContext.campaign) return;
    const pack = campaignContext.campaign;
    setActivePackId(pack.id);
    setGoal(pack.goal);
    setProduct(pack.product);
    setAudience(pack.audience || AUDIENCES[0].value);
    setOffer(pack.offer || OFFERS[0].value);
    setChannel(pack.channel);
    setProductImagePath(pack.product_image_path);
    setBrief(briefFromPack(pack));
  }, [campaignContext.campaign]);

  const refreshLiveHome = useCallback(async (showTransition = false) => {
    if (!activePackId) {
      setLiveHome(null);
      liveSnapshotRef.current = null;
      return;
    }
    setLoadingLiveHome(true);
    try {
      const headers = await authHeaders();
      const out = await getLiveHomeFn({ data: { campaignId: activePackId }, headers });
      const next = liveSnapshot(out.liveHome);
      const prev = liveSnapshotRef.current;
      const changed: Array<"text" | "image" | "video"> = prev && showTransition
        ? (["text", "image", "video"] as const).filter((kind) => !prev[kind] && next[kind])
        : [];
      liveSnapshotRef.current = next;
      setLiveHome(out.liveHome);
      if (changed.length > 0) {
        setUpdatedKinds(changed);
        setReturnBanner(true);
        window.setTimeout(() => setUpdatedKinds([]), 3200);
        window.setTimeout(() => setReturnBanner(false), 4200);
      }
    } catch {
      setLiveHome(null);
    } finally {
      setLoadingLiveHome(false);
    }
  }, [activePackId, getLiveHomeFn]);

  useEffect(() => { void refreshLiveHome(false); }, [refreshLiveHome]);

  useEffect(() => {
    const onFocus = () => void refreshLiveHome(true);
    const onVisibility = () => { if (document.visibilityState === "visible") void refreshLiveHome(true); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshLiveHome]);

  useEffect(() => {
    if (search.focus !== "house") return;
    window.setTimeout(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    setHighlightHouse(true);
    const id = window.setTimeout(() => setHighlightHouse(false), 2600);
    return () => window.clearTimeout(id);
  }, [search.focus, activePackId]);

  useEffect(() => {
    if (!search.updatedAsset || loadingLiveHome) return;
    const snapshot = liveSnapshot(liveHome);
    if (!snapshot[search.updatedAsset]) return;
    setUpdatedKinds([search.updatedAsset]);
    setReturnBanner(true);
    const pulseId = window.setTimeout(() => setUpdatedKinds([]), 3200);
    const bannerId = window.setTimeout(() => setReturnBanner(false), 4200);
    return () => {
      window.clearTimeout(pulseId);
      window.clearTimeout(bannerId);
    };
  }, [liveHome, loadingLiveHome, search.updatedAsset]);

  const authHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("سجّل الدخول أولاً عشان تحفظ حملتك");
    return { Authorization: `Bearer ${session.access_token}` };
  };

  const saveDraft = async (imagePath = productImagePath): Promise<CampaignPack> => {
    if (!goal) throw new Error("اختر هدف الحملة أولاً");
    const headers = await authHeaders();
    const out = await savePackFn({
      data: {
        id: activePackId,
        product,
        audience: audienceOption.label,
        offer: offerOption.label,
        goal,
        channel: dbChannel,
        status: "draft",
        brief: draftBrief,
        textPrompt: "",
        imagePrompt: "",
        videoPrompt: "",
        productImagePath: imagePath,
      },
      headers,
    });
    setActivePackId(out.pack.id);
    return out.pack;
  };

  const handleImageUpload = async (file: File) => {
    if (!goal) {
      toast.error("اختر هدف الحملة قبل رفع الصورة");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("ارفع ملف صورة فقط");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("حجم الصورة كبير، خلّها أقل من 8MB");
      return;
    }

    setUploadingImage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("سجّل الدخول أولاً عشان ترفع الصورة");
      const draft = activePackId ? null : await saveDraft(null);
      const campaignId = activePackId ?? draft?.id;
      if (!campaignId) throw new Error("تعذر تجهيز مسودة الحملة");
      const webp = await fileToWebp(file);
      const previewUrl = URL.createObjectURL(webp);
      setProductImagePreview((current) => {
        if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
        return previewUrl;
      });
      const path = `${user.id}/campaigns/${campaignId}/product-image.webp`;
      const { error } = await supabase.storage.from(CAMPAIGN_PRODUCT_IMAGES_BUCKET).upload(path, webp, {
        upsert: true,
        contentType: "image/webp",
      });
      if (error) throw error;
      setProductImagePath(path);
      await saveDraft(path);
      toast.success("تم ربط صورة المنتج بالكانفاس");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر رفع صورة المنتج");
    } finally {
      setUploadingImage(false);
    }
  };

  const clearImage = async () => {
    setProductImagePath(null);
    setProductImagePreview((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return null;
    });
    if (activePackId && goal) await saveDraft(null).catch(() => undefined);
  };

  const buildCampaign = async () => {
    if (!goal) return;
    setGenerating(true);
    setBrief(null);
    previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      const headers = await authHeaders();
      const out = await generateBriefFn({
        data: {
          campaignId: activePackId,
          product,
          sector,
          sectorLabel: sectorOption.label,
          audience,
          audienceLabel: audienceOption.label,
          offer,
          offerLabel: offerOption.label,
          goal,
          channel,
          channelLabel: channelOption.label,
          occasion: occasionOption.label,
          customerStage: stageOption.label,
          productImagePath,
        },
        headers,
      });
      setBrief(out.brief);
      setActivePackId(out.pack.id);
      toast.success("جهزت خطة الحملة");
      window.setTimeout(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر بناء خطة الحملة");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <DashboardShell>
      <div className="mx-auto max-w-7xl" dir="rtl">
        <header className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">استوديو حملات استراتيجي</Badge>
            <div className="min-w-40 rounded-lg border border-border bg-card px-3 py-2 shadow-soft">
              <div className="flex items-center justify-between gap-3 text-xs font-extrabold">
                <span className="text-muted-foreground">جاهزية مركز الحملات</span>
                <span className="text-primary">{CAMPAIGN_CENTER_PROGRESS}%</span>
              </div>
              <Progress value={CAMPAIGN_CENTER_PROGRESS} className="mt-2 h-1.5" />
            </div>
          </div>
          <h1 className="mt-3 text-2xl font-extrabold leading-tight sm:text-3xl">ابنِ حملة واضحة قبل ما تبدأ التنفيذ</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
            اختر الهدف، ارفع صورة المنتج، وحدد الجمهور والعرض. رِفد يحوّلها لخطة حملة جاهزة للنص والصورة والفيديو.
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)] lg:items-start">
          <section className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-soft sm:p-5">
            <div className="border-b border-border pb-4">
              <p className="text-xs font-bold text-primary">منطقة البناء</p>
              <h2 className="mt-1 text-lg font-extrabold">ابدأ من القرار التجاري</h2>
            </div>

            <section className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold">تقدّم الخطة</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">كل ما اكتملت المدخلات، صارت الخطة أدق وأسهل للتنفيذ.</p>
                </div>
                <Badge className="bg-primary text-primary-foreground">{planProgress}%</Badge>
              </div>
              <Progress value={planProgress} className="mt-3 h-2" />
              <div className="mt-3 flex flex-wrap gap-2">
                {planProgressItems.map((item) => (
                  <Badge key={item.label} variant="outline" className={cn("border-border bg-card text-xs", item.done && "border-primary/30 bg-primary/5 text-primary")}>
                    {item.done && <Check className="h-3 w-3" />}
                    {item.label}
                  </Badge>
                ))}
              </div>
            </section>

            <div>
              <Label className="text-sm font-extrabold">هدف الحملة</Label>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {GOALS.map((item) => {
                  const selected = goal === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setGoal(item.value)}
                      className={cn(
                        "min-h-28 rounded-lg border p-3 text-right transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected ? "border-transparent bg-campaign-gold text-campaign-gold-foreground shadow-gold" : "border-border bg-background hover:bg-secondary/70",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-extrabold">{item.title}</span>
                        {selected && <Check className="h-4 w-4" />}
                      </div>
                      <p className={cn("mt-2 text-xs leading-6", selected ? "text-campaign-gold-foreground/80" : "text-muted-foreground")}>{item.prompt}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
              <div>
                <Label htmlFor="campaign-product-name" className="font-extrabold">اسم منتجك</Label>
                <Input
                  id="campaign-product-name"
                  value={product}
                  onChange={(event) => setProduct(event.target.value.slice(0, 500))}
                  className="mt-2 h-11 bg-background text-right"
                  placeholder="مثلاً: عطر شرقي فاخر 100مل"
                />
              </div>
              <ProductImageBox preview={productImagePreview} disabled={!goal || uploadingImage} uploading={uploadingImage} onUpload={handleImageUpload} onClear={clearImage} hasImage={Boolean(productImagePath || productImagePreview)} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <SmartCombobox label="قطاع متجرك" value={sector} options={SECTORS} onChange={setSector} />
              <SmartCombobox label="الجمهور المستهدف" value={audience} options={AUDIENCES} onChange={setAudience} />
              <SmartCombobox label="العرض" value={offer} options={OFFERS} onChange={setOffer} />
              <SmartCombobox label="قناة النشر" value={channel} options={CHANNELS} onChange={(value) => setChannel(value as StudioChannel)} />
              <SmartCombobox label="مناسبة الحملة" value={occasion} options={OCCASIONS} onChange={setOccasion} />
              <div className="md:col-span-2">
                <SmartCombobox label="مرحلة العميل" value={customerStage} options={CUSTOMER_STAGES} onChange={setCustomerStage} />
              </div>
            </div>

            <Button
              type="button"
              size="lg"
              onClick={() => void buildCampaign()}
              disabled={!goal || generating}
              className="h-12 w-full gap-2 text-base font-extrabold shadow-elegant"
            >
              {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              ابنِ لي خطّة الحملة
            </Button>
          </section>

          <MagicCanvas
            refEl={previewRef}
            highlight={highlightHouse}
            updatedKinds={updatedKinds}
            returnBanner={returnBanner}
            goal={selectedGoal?.title ?? "اختر هدف الحملة"}
            product={product}
            audience={audienceOption.label}
            offer={offerOption.label}
            channel={channelOption.label}
            imagePreview={productImagePreview}
            generating={generating}
            brief={brief}
            liveHome={liveHome}
            loadingLiveHome={loadingLiveHome}
            campaignId={activePackId}
            executionContext={executionContext}
          />
        </div>
      </div>
    </DashboardShell>
  );
}

function ProductImageBox({ preview, disabled, uploading, hasImage, onUpload, onClear }: { preview: string | null; disabled: boolean; uploading: boolean; hasImage: boolean; onUpload: (file: File) => Promise<void>; onClear: () => void | Promise<void> }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="campaign-product-image" className="font-extrabold">صورة المنتج</Label>
        {hasImage && <Button type="button" variant="ghost" size="sm" onClick={() => void onClear()} className="h-7 px-2 text-xs"><X className="h-3.5 w-3.5" /> إزالة</Button>}
      </div>
      <label className={cn("mt-2 flex min-h-28 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 transition-colors hover:bg-primary/10", disabled && "cursor-not-allowed opacity-60")} htmlFor="campaign-product-image">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
          {preview ? <img src={preview} alt="معاينة صورة المنتج" className="h-full w-full object-cover" /> : <ImageIcon className="h-7 w-7 text-muted-foreground" />}
        </span>
        <span className="min-w-0 text-sm">
          <span className="block font-extrabold">{uploading ? "جاري تجهيز الصورة…" : "ارفع صورة"}</span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">تتحول تلقائياً إلى WebP وتظهر هنا فوراً.</span>
        </span>
        {uploading ? <Loader2 className="me-auto h-4 w-4 animate-spin text-primary" /> : <Upload className="me-auto h-4 w-4 text-primary" />}
        <input id="campaign-product-image" type="file" accept="image/*" className="sr-only" disabled={disabled} onChange={(event) => { const file = event.target.files?.[0]; if (file) void onUpload(file); event.currentTarget.value = ""; }} />
      </label>
    </div>
  );
}

function SmartCombobox({ label, value, options, onChange }: { label: string; value: string; options: Option[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = findOption(options, value);
  return (
    <div>
      <Label className="font-extrabold">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="mt-2 h-auto min-h-12 w-full justify-between gap-3 bg-background px-3 py-2 text-right font-bold">
            <span className="min-w-0">
              <span className="block truncate">{selected.label}</span>
              {selected.description && <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">{selected.description}</span>}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(92vw,420px)] p-0" align="start">
          <Command dir="rtl">
            <CommandInput placeholder="ابحث…" className="text-right" />
            <CommandList>
              <CommandEmpty>ما لقينا خيار مطابق.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem key={option.value} value={`${option.label} ${option.description ?? ""}`} onSelect={() => { onChange(option.value); setOpen(false); }} className="items-start justify-between gap-3 text-right">
                    <span>
                      <span className="block font-bold">{option.label}</span>
                      {option.description && <span className="mt-1 block text-xs text-muted-foreground">{option.description}</span>}
                    </span>
                    {option.value === value && <Check className="mt-1 h-4 w-4 text-primary" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function MagicCanvas({ refEl, highlight, updatedKinds, returnBanner, goal, product, audience, offer, channel, imagePreview, generating, brief, liveHome, loadingLiveHome, campaignId, executionContext }: { refEl: MutableRefObject<HTMLElement | null>; highlight: boolean; updatedKinds: Array<"text" | "image" | "video">; returnBanner: boolean; goal: string; product: string; audience: string; offer: string; channel: string; imagePreview: string | null; generating: boolean; brief: CampaignBrief | null; liveHome: CampaignLiveHome | null; loadingLiveHome: boolean; campaignId?: string; executionContext: CampaignExecutionContext }) {
  return (
    <aside ref={refEl} className="space-y-4 lg:sticky lg:top-6 lg:self-start">
      <section className={cn("overflow-hidden rounded-xl border border-primary/20 bg-card shadow-soft transition-all duration-700", highlight && "ring-4 ring-primary/20 ring-offset-2 ring-offset-background")}>
        <div className="border-b border-border bg-primary/5 p-4">
          <p className="text-xs font-bold text-primary">كانفاس الحملة</p>
          <h2 className="mt-1 text-lg font-extrabold">المعاينة الحية</h2>
        </div>
        <div className="p-4">
            {returnBanner && <div className="mb-3 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs font-bold text-success">أهلاً بعودتك! تم تحديث مخرجات حملتك.</div>}
            {generating ? <CanvasSkeleton /> : brief ? <CampaignHouse brief={brief} imagePreview={imagePreview} campaignId={campaignId} liveHome={liveHome} loadingLiveHome={loadingLiveHome} updatedKinds={updatedKinds} executionContext={executionContext} /> : <InitialPreview goal={goal} product={product} audience={audience} offer={offer} channel={channel} imagePreview={imagePreview} />}
        </div>
      </section>
    </aside>
  );
}

function InitialPreview({ goal, product, audience, offer, channel, imagePreview }: { goal: string; product: string; audience: string; offer: string; channel: string; imagePreview: string | null }) {
  return (
    <article className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="relative aspect-[4/5] bg-secondary">
        {imagePreview ? <img src={imagePreview} alt="صورة المنتج في معاينة الحملة" className="h-full w-full object-cover" /> : <div className="flex h-full flex-col items-center justify-center p-6 text-center text-muted-foreground"><ImageIcon className="h-10 w-10" /><p className="mt-3 text-sm font-bold">صورة المنتج تظهر هنا</p></div>}
        <div className="absolute inset-x-0 bottom-0 bg-background/92 p-4 backdrop-blur">
          <p className="text-xs font-bold text-primary">{goal} · {channel}</p>
          <h3 className="mt-1 line-clamp-2 text-lg font-extrabold">{product.trim() || "اسم المنتج"}</h3>
        </div>
      </div>
      <div className="grid gap-2 p-4 text-sm leading-7">
        <p><span className="font-extrabold">الجمهور:</span> <span className="text-muted-foreground">{audience}</span></p>
        <p><span className="font-extrabold">العرض:</span> <span className="text-muted-foreground">{offer}</span></p>
      </div>
    </article>
  );
}

function CanvasSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="aspect-[4/5] w-full" />
      <div className="space-y-2 rounded-lg border border-border p-4">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  );
}

function CampaignHouse({ brief, imagePreview, campaignId, liveHome, loadingLiveHome, updatedKinds, executionContext }: { brief: CampaignBrief; imagePreview: string | null; campaignId?: string; liveHome: CampaignLiveHome | null; loadingLiveHome: boolean; updatedKinds: Array<"text" | "image" | "video">; executionContext: CampaignExecutionContext }) {
  return (
    <div className="space-y-4">
      <article className="overflow-hidden rounded-lg border border-border bg-background">
        {imagePreview && <img src={imagePreview} alt="صورة المنتج في بيت الحملة" className="aspect-video w-full object-cover" />}
        <div className="p-4">
          <Badge className="bg-campaign-gold text-campaign-gold-foreground">بيت الحملة</Badge>
          <h3 className="mt-3 text-xl font-extrabold">{brief.campaignName}</h3>
          <div className="mt-4 space-y-3 text-sm leading-7">
            <InfoLine label="الوعد الأساسي" value={brief.corePromise} />
            <InfoLine label="الرسالة التسويقية" value={brief.marketingMessage} />
            <InfoLine label="الخطّاف" value={brief.hook} />
            <InfoLine label="دعوة الإجراء" value={brief.cta} />
          </div>
        </div>
      </article>
      <section>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-extrabold">بيت الحملة الحي</h3>
          <CampaignCompletion liveHome={liveHome} loading={loadingLiveHome} />
        </div>
        <div className="mt-3 grid gap-3">
          <LiveOutputSlot kind="text" title="النص" prompt={brief.textPrompt} campaignId={campaignId} item={liveHome?.text ?? null} loading={loadingLiveHome} updated={updatedKinds.includes("text")} executionContext={executionContext} />
          <LiveOutputSlot kind="image" title="الصورة" prompt={brief.imagePrompt} campaignId={campaignId} item={liveHome?.image ?? null} loading={loadingLiveHome} updated={updatedKinds.includes("image")} executionContext={executionContext} />
          <LiveOutputSlot kind="video" title="الفيديو" prompt={brief.videoPrompt} campaignId={campaignId} item={liveHome?.video ?? null} loading={loadingLiveHome} updated={updatedKinds.includes("video")} executionContext={executionContext} />
        </div>
      </section>
      <NextBestAction liveHome={liveHome} campaignId={campaignId} brief={brief} executionContext={executionContext} />
      <div className="rounded-lg border border-dashed border-primary/25 bg-primary/5 p-3 text-sm font-extrabold text-primary">📊 قريبًا: تابع أداء حملاتك بعد النشر</div>
      <AbVariantsSection variants={brief.abVariants} campaignId={campaignId} executionContext={executionContext} />
      <PublishingCalendarSection days={brief.publishingCalendar} campaignId={campaignId} executionContext={executionContext} />
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return <p><span className="font-extrabold text-foreground">{label}: </span><span className="text-muted-foreground">{value}</span></p>;
}

function CampaignCompletion({ liveHome, loading }: { liveHome: CampaignLiveHome | null; loading: boolean }) {
  const done = Number(Boolean(liveHome?.text)) + Number(Boolean(liveHome?.image)) + Number(Boolean(liveHome?.video?.status === "completed" && liveHome.video.result_url));
  const percent = Math.round((done / 3) * 100);
  return <Badge variant="outline" className="bg-background text-xs">{loading ? "يتم التحديث…" : `${done}/3 · ${percent}%`}</Badge>;
}

function NextBestAction({ liveHome, campaignId, brief, executionContext }: { liveHome: CampaignLiveHome | null; campaignId?: string; brief: CampaignBrief; executionContext: CampaignExecutionContext }) {
  const hasText = Boolean(liveHome?.text);
  const hasImage = Boolean(liveHome?.image);
  const hasVideo = Boolean(liveHome?.video?.status === "completed" && liveHome.video.result_url);
  if (hasText && hasImage && hasVideo) {
    return <div className="rounded-lg border border-success/20 bg-success/10 p-3 text-sm font-bold text-success">حملتك مكتملة. راجع كل الأصول في المكتبة أو ابدأ حملة جديدة.</div>;
  }
  const action = hasImage && !hasText
    ? { text: "الآن وقد أصبحت الصورة جاهزة، اكتب نصاً يبيع يطابقها.", label: "اكتب نصاً يبيع", to: "/dashboard/generate-text" as const, prompt: brief.textPrompt }
    : hasText && !hasImage
      ? { text: "النص جاهز. صمّم صورة إعلان تكمل نفس الرسالة والعرض.", label: "صمّم صورة إعلان", to: "/dashboard/generate-image" as const, prompt: brief.imagePrompt }
      : hasText && hasImage && !hasVideo
        ? { text: "الحملة جاهزة بصرياً. حوّلها إلى فيديو قصير مناسب لريلز وتيك توك.", label: "أنشئ فيديو", to: "/dashboard/generate-video" as const, prompt: brief.videoPrompt }
        : { text: "ابدأ بأول أصل للحملة حتى يتحول البيت من خطة إلى مخرجات جاهزة.", label: "اكتب نصاً يبيع", to: "/dashboard/generate-text" as const, prompt: brief.textPrompt };
  return <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm"><p className="font-bold text-foreground">{action.text}</p><Button asChild size="sm" className="mt-3 h-8 text-xs"><Link to={action.to} search={campaignExecutionSearch({ ...executionContext, campaignId }, action.prompt) as never}>{action.label}</Link></Button></div>;
}

function LiveOutputSlot({ kind, title, prompt, campaignId, item, loading, updated, executionContext }: { kind: "text" | "image" | "video"; title: string; prompt: string; campaignId?: string; item: CampaignLiveHome["text"] | CampaignLiveHome["image"] | CampaignLiveHome["video"] | null; loading: boolean; updated?: boolean; executionContext: CampaignExecutionContext }) {
  const route = kind === "text" ? "/dashboard/generate-text" : kind === "image" ? "/dashboard/generate-image" : "/dashboard/generate-video";
  const Icon = kind === "text" ? FileText : kind === "image" ? ImageIcon : Clapperboard;
  const isVideo = kind === "video";
  const video = isVideo ? (item as CampaignLiveHome["video"] | null) : null;
  const complete = kind === "video" ? Boolean(video?.status === "completed" && video.result_url) : Boolean(item);
  const active = Boolean(video && ["pending", "processing"].includes(video.status));
  const failed = Boolean(video && ["failed", "refunded", "cancelled"].includes(video.status));
  const buttonLabel = complete ? (kind === "video" ? "مشاهدة" : "عرض/تعديل") : kind === "text" ? "اكتب نصاً يبيع" : kind === "image" ? "صمّم صورة إعلان" : "أنشئ فيديو قصير";
  const textItem = kind === "text" ? (item as CampaignLiveHome["text"] | null) : null;
  const imageItem = kind === "image" ? (item as CampaignLiveHome["image"] | null) : null;

  return (
    <article className={cn("rounded-lg border border-border bg-card p-3 transition-all duration-500", updated && "border-success/60 ring-4 ring-success/15")}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary/10 text-primary">
          {imageItem?.url ? <img src={imageItem.url} alt="صورة مصغرة من الحملة" className="h-full w-full object-cover" /> : active ? <Loader2 className="h-4 w-4 animate-spin" /> : complete ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Icon className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-extrabold">{title}</h4>
            <span className={cn("text-[11px] font-bold", complete ? "text-success" : active ? "text-warning-foreground" : failed ? "text-destructive" : "text-muted-foreground")}>{loading ? "تحميل" : complete ? "مكتمل" : active ? "قيد المعالجة" : failed ? "يحتاج إعادة" : "لم يُنفذ بعد"}</span>
          </div>
          {updated && <div className="mt-1 inline-flex rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">تم تحديث {title} بنجاح</div>}
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{textItem?.result ? textItem.result.slice(0, 100) : imageItem?.prompt || video?.prompt || "ابدأ من هذه الفتحة لإكمال الحملة."}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {video?.result_url && complete ? <Button asChild size="sm" variant="outline" className="h-8 gap-1 text-xs"><a href={video.result_url} target="_blank" rel="noreferrer"><PlayCircle className="h-3.5 w-3.5" /> {buttonLabel}</a></Button> : <Button asChild size="sm" variant={complete ? "outline" : "default"} className="h-8 text-xs"><Link to={route} search={campaignExecutionSearch({ ...executionContext, campaignId }, prompt) as never}>{buttonLabel}</Link></Button>}
          </div>
        </div>
      </div>
    </article>
  );
}

function AbVariantsSection({ variants, campaignId, executionContext }: { variants: CampaignBrief["abVariants"]; campaignId?: string; executionContext: CampaignExecutionContext }) {
  if (!variants.length) return <EmptyCampaignUpgrade label="أعد بناء الخطة لتوليد نسخ A/B جاهزة للتجربة." />;
  return <section className="rounded-lg border border-border bg-background p-4"><h3 className="font-extrabold">اختر أقوى رسالة تسويقية</h3><div className="mt-3 grid gap-3">{variants.map((v, index) => { const text = `${v.hook}\n${v.message}\n${v.cta}`; return <article key={`${v.style}-${index}`} className="rounded-lg border border-border bg-card p-3"><div className="flex items-center justify-between gap-2"><p className="font-extrabold"><span aria-hidden="true">{v.icon}</span> {v.style}</p><Button size="sm" variant="ghost" onClick={() => { void navigator.clipboard.writeText(text); toast.success("تم نسخ النسخة"); }}><Copy className="h-3.5 w-3.5" /></Button></div><p className="mt-2 text-sm font-bold leading-6">{v.hook}</p><p className="mt-1 text-xs leading-6 text-muted-foreground">{v.message}</p><Button asChild size="sm" variant="outline" className="mt-3 h-8 text-xs"><Link to="/dashboard/generate-text" search={campaignExecutionSearch({ ...executionContext, campaignId }, text) as never}>استخدمها في النص</Link></Button></article>; })}</div></section>;
}

function PublishingCalendarSection({ days, campaignId, executionContext }: { days: CampaignBrief["publishingCalendar"]; campaignId?: string; executionContext: CampaignExecutionContext }) {
  if (!days.length) return <EmptyCampaignUpgrade label="أعد بناء الخطة لتوليد تقويم نشر 7 أيام." />;
  return <section className="rounded-lg border border-border bg-background p-4"><div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /><h3 className="font-extrabold">تقويم نشر 7 أيام</h3></div><div className="mt-3 grid gap-3 sm:grid-cols-2">{days.map((day) => { const text = `${day.contentType}\n${day.message}\nالهدف: ${day.goal}`; return <article key={day.day} className="rounded-lg border border-border bg-card p-3"><div className="flex items-center justify-between gap-2"><Badge variant="outline">اليوم {day.day} · {day.label}</Badge><span className="text-[11px] font-bold text-primary">{day.channel}</span></div><p className="mt-2 text-sm font-extrabold">{day.contentType}</p><p className="mt-1 text-xs leading-6 text-muted-foreground">{day.message}</p><p className="mt-2 text-[11px] font-bold text-muted-foreground">الهدف: {day.goal}</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { void navigator.clipboard.writeText(day.message); toast.success("تم نسخ رسالة اليوم"); }}><Copy className="h-3.5 w-3.5" /> نسخ</Button><Button asChild size="sm" variant="outline" className="h-8 text-xs"><Link to="/dashboard/generate-text" search={campaignExecutionSearch({ ...executionContext, campaignId, channel: day.channel }, text) as never}>حوّلها لمحتوى</Link></Button></div></article>; })}</div></section>;
}

function EmptyCampaignUpgrade({ label }: { label: string }) {
  return <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs leading-6 text-muted-foreground">{label}</div>;
}

function briefFromPack(pack: CampaignPack): CampaignBrief {
  return {
    campaignName: pack.product || "حملة محفوظة",
    corePromise: firstBriefValue(pack.brief, "الوعد الأساسي") || pack.offer || "عرض واضح ومقنع",
    marketingMessage: firstBriefValue(pack.brief, "الرسالة التسويقية") || pack.brief || "رسالة حملة جاهزة للتنفيذ.",
    hook: firstBriefValue(pack.brief, "الخطّاف") || "ابدأ بقوة واجذب انتباه العميل من أول ثانية.",
    cta: firstBriefValue(pack.brief, "دعوة الإجراء") || "اطلب الآن",
    strategyAngle: firstBriefValue(pack.brief, "الزاوية") || pack.goal,
    textPrompt: pack.text_prompt,
    imagePrompt: pack.image_prompt,
    videoPrompt: pack.video_prompt,
    abVariants: pack.ab_variants ?? [],
    publishingCalendar: pack.publishing_calendar ?? [],
  };
}

function firstBriefValue(brief: string, label: string) {
  return brief.split("\n").find((line) => line.startsWith(`${label}:`))?.split(":").slice(1).join(":").trim() ?? "";
}

function findOption<T extends Option>(options: T[], value: string): T {
  return options.find((option) => option.value === value) ?? options[0];
}

function liveSnapshot(liveHome: CampaignLiveHome | null) {
  return {
    text: Boolean(liveHome?.text),
    image: Boolean(liveHome?.image),
    video: Boolean(liveHome?.video?.status === "completed" && liveHome.video.result_url),
  };
}

function toDbChannel(channel: StudioChannel): DbChannel {
  return ["instagram", "snapchat", "tiktok", "whatsapp"].includes(channel) ? (channel as DbChannel) : "instagram";
}

async function fileToWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const maxSize = 1600;
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذر تجهيز الصورة داخل المتصفح");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("تعذر تحويل الصورة إلى WebP"));
    }, "image/webp", 0.86);
  });
}
