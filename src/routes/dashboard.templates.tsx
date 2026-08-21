import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, Sparkles, Image as ImageIcon, Type, Lock, ArrowLeft, LayoutTemplate } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyStateCTA } from "@/components/empty-state-cta";
import { PROMPTS, CATEGORIES, type PromptType, type PromptCategory } from "@/lib/prompts-data";
import { cn } from "@/lib/utils";

const CATEGORY_GOALS: Partial<Record<PromptCategory, string>> = {
  launch: "ابدأ منتجاً جديداً برسالة واضحة",
  offer: "حوّل الخصم إلى سبب شراء الآن",
  season: "اربط حملتك بلحظة موسمية جاهزة",
  product: "اكتب قيمة المنتج بطريقة تقنع العميل",
  social: "حضّر منشوراً سريعاً لقنواتك اليومية",
  trust: "ابنِ ثقة العميل قبل قرار الشراء",
  video: "جهّز زاوية فيديو قصيرة قابلة للنشر",
};

const TYPE_LABEL: Record<PromptType, string> = {
  text: "نص",
  image: "صورة",
};

export const Route = createFileRoute("/dashboard/templates")({
  head: () => ({
    meta: [
      { title: "معرض القوالب — رِفد" },
      { name: "description", content: "لا تعرف من أين تبدأ؟ اختر هدفك ثم استخدم قالباً يكتب نصاً يبيع أو يصمّم صورة إعلان." },
    ],
  }),
  component: TemplatesPage,
});

function TemplatesPage() {
  const navigate = useNavigate();
  const [type, setType] = useState<"all" | PromptType>("all");
  const [category, setCategory] = useState<"all" | PromptCategory>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return PROMPTS.filter((p) => {
      if (type !== "all" && p.type !== type) return false;
      if (category !== "all" && p.category !== category) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!p.title.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [type, category, search]);

  const openTemplate = (id: string, t: PromptType) => {
    if (t === "text") {
      void navigate({ to: "/dashboard/generate-text", search: { template: id } as never });
    } else {
      void navigate({ to: "/dashboard/generate-image", search: { template: id } as never });
    }
  };

  const counts = useMemo(() => ({
    all: PROMPTS.length,
    text: PROMPTS.filter((p) => p.type === "text").length,
    image: PROMPTS.filter((p) => p.type === "image").length,
  }), []);

  return (
    <DashboardShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black text-primary">لا تعرف من أين تبدأ؟ اختر هدفك.</p>
          <h1 className="mt-1 text-2xl font-extrabold">معرض القوالب</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} من {PROMPTS.length} قالب — اختر هدفاً تجارياً ثم انتقل للأداة المناسبة
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="ابحث حسب الهدف أو المنتج..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {([
          { id: "all", label: "الكل", icon: Sparkles, count: counts.all },
          { id: "text", label: "نصوص", icon: Type, count: counts.text },
          { id: "image", label: "صور", icon: ImageIcon, count: counts.image },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setType(t.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
              type === t.id
                ? "border-primary bg-primary text-primary-foreground shadow-soft"
                : "border-border bg-card text-foreground hover:border-primary/40"
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            <span className={cn(
              "rounded-full px-1.5 text-xs",
              type === t.id ? "bg-primary-foreground/20" : "bg-secondary"
            )}>{t.count}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => setCategory("all")}
          className={cn(
            "rounded-md border px-3 py-1 text-xs",
            category === "all"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:border-primary/40"
          )}
        >
          كل الفئات
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={cn(
              "rounded-md border px-3 py-1 text-xs",
              category === c.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40"
            )}
          >
            <span className="ml-1">{c.emoji}</span>
            {c.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-10">
          <EmptyStateCTA
            icon={LayoutTemplate}
            title="لا توجد قوالب تطابق بحثك"
            description="جرّب كلمة أخرى أو غيّر الفلتر، أو ابدأ مباشرة من مركز قيادة الحملة لتوليد محتوى مخصّص لمتجرك."
            ctaLabel="ابدأ من مركز قيادة الحملة"
            ctaTo="/dashboard/campaign-studio"
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const cat = CATEGORIES.find((c) => c.id === p.category);
            return (
              <div
                key={p.id}
                className="group flex flex-col rounded-xl border border-border bg-card p-5 shadow-soft transition hover:border-primary/40 hover:shadow-elegant"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={cn(
                    "inline-flex h-9 w-9 items-center justify-center rounded-lg",
                    p.type === "text" ? "bg-primary/10 text-primary" : "bg-gold/10 text-gold"
                  )}>
                    {p.type === "text" ? <Type className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {p.badge && (
                      <Badge variant="secondary" className="text-[10px]">{p.badge}</Badge>
                    )}
                    {!p.freeTier && (
                      <Badge variant="outline" className="gap-1 border-gold/40 text-gold text-[10px]">
                        <Lock className="h-2.5 w-2.5" /> Pro
                      </Badge>
                    )}
                  </div>
                </div>

                <h3 className="mt-3 line-clamp-2 font-bold leading-snug">{p.title}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>

                <div className="mt-3 space-y-1.5 text-[11px] text-muted-foreground">
                  {cat && (
                    <p className="rounded-md bg-secondary px-2 py-1"><strong className="text-foreground">متى تستخدمه:</strong> {CATEGORY_GOALS[p.category] ?? cat.label}</p>
                  )}
                  <p className="rounded-md bg-secondary px-2 py-1"><strong className="text-foreground">ماذا يعطيك:</strong> {p.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cat && <span className="rounded-md bg-secondary px-2 py-0.5">{cat.emoji} {cat.label}</span>}
                    <span className="rounded-md bg-secondary px-2 py-0.5">النوع: {TYPE_LABEL[p.type]}</span>
                    <span className="rounded-md bg-secondary px-2 py-0.5">⏱️ {p.estimatedTime}</span>
                  </div>
                </div>

                <Button onClick={() => openTemplate(p.id, p.type)} className="mt-4 gap-2 gradient-primary text-primary-foreground" size="sm">
                  استخدم هذا القالب
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
