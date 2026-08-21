import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Image as ImageIcon, FileText, Sparkles, Lock } from "lucide-react";
import { MarketingLayout } from "@/components/marketing-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CATEGORIES, PROMPTS, type PromptType } from "@/lib/prompts-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "مكتبة الأوامر — 50+ قالب AI بالعامية السعودية | رِفد" },
      {
        name: "description",
        content:
          "تصفّح 50+ قالب جاهز للنصوص والصور والحملات، مع تحديثات وقوالب جديدة شهرياً للمتاجر السعودية.",
      },
      { property: "og:title", content: "مكتبة قوالب AI سعودية | رِفد" },
      {
        property: "og:description",
        content: "قوالب نصية وصور بالعامية السعودية. اختر، خصّص، ولّد بسرعة.",
      },
      { name: "twitter:title", content: "مكتبة قوالب AI سعودية | رِفد" },
      { name: "twitter:description", content: "50+ قالب جاهز للنصوص والصور والحملات بالعامية السعودية." },
    ],
    links: [{ rel: "canonical", href: "https://rifd.site/library" }],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<PromptType | "all">("all");
  const [cat, setCat] = useState<string>("all");

  const filtered = useMemo(() => {
    return PROMPTS.filter((p) => {
      if (type !== "all" && p.type !== type) return false;
      if (cat !== "all" && p.category !== cat) return false;
      if (query) {
        const q = query.toLowerCase();
        if (
          !p.title.toLowerCase().includes(q) &&
          !p.description.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [query, type, cat]);

  return (
    <MarketingLayout>
      <div className="border-b border-border bg-secondary/40">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              50+ قالب جاهز
            </div>
            <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">
              مكتبة الأوامر — كل ما يحتاجه متجرك
            </h1>
            <p className="mt-3 text-muted-foreground">
              قوالب مهندسة بالعامية السعودية لتوفير ساعات من الكتابة والتصميم، مع تطويرات شهرية مستمرة
            </p>
          </div>

          <div className="relative mx-auto mt-6 max-w-xl">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث في 50+ قالب... (مثلاً: منشور، عطر، بوستر)"
              className="pr-10"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* فلاتر */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-border bg-card p-1">
            {[
              { id: "all", label: "الكل", icon: Sparkles },
              { id: "text", label: "نصوص", icon: FileText },
              { id: "image", label: "صور", icon: ImageIcon },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setType(t.id as PromptType | "all")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  type === t.id
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCat("all")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                cat === "all"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/30"
              )}
            >
              كل التصنيفات
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  cat === c.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/30"
                )}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* البطاقات */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
            ما لقينا قوالب تطابق بحثك. جرب كلمات أخرى.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => {
              const cat = CATEGORIES.find((c) => c.id === p.category);
              return (
                <article
                  key={p.id}
                  className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-elegant"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg",
                          p.type === "image"
                            ? "bg-gold/15 text-gold"
                            : "bg-primary/10 text-primary"
                        )}
                      >
                        {p.type === "image" ? (
                          <ImageIcon className="h-4 w-4" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                      </span>
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {cat?.emoji} {cat?.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {p.badge && (
                        <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold-foreground">
                          {p.badge}
                        </span>
                      )}
                      {!p.freeTier && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                          <Lock className="h-2.5 w-2.5" />
                          <span>Pro</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="mt-3 text-base font-bold">{p.title}</h3>
                  <p className="mt-1 flex-1 text-sm text-muted-foreground">{p.description}</p>

                  <div className="mt-3 flex flex-wrap gap-1">
                    {p.variables.slice(0, 3).map((v) => (
                      <span
                        key={v}
                        className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {v}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground">⚡ {p.estimatedTime}</span>
                    <Button asChild size="sm" variant="ghost" className="h-7 text-primary">
                      <Link to="/onboarding">جرّب →</Link>
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="mt-12 rounded-2xl border border-primary/20 bg-secondary/40 p-6 text-center">
          <h3 className="text-lg font-bold">جاهز تجرّب القوالب على متجرك؟</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            خطوتان فقط لأول محتوى جاهز: منشور يبيع، صور تبيع، وفيديو يبيع
          </p>
          <Button asChild className="mt-4 gradient-primary text-primary-foreground shadow-elegant">
            <Link to="/onboarding">ابدأ الآن</Link>
          </Button>
        </div>
      </div>
    </MarketingLayout>
  );
}
