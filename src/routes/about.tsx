import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Target, Heart, Award, MessageCircle, Mail } from "lucide-react";
import { MarketingLayout } from "@/components/marketing-layout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "من نحن — رِفد للتقنية" },
      {
        name: "description",
        content:
          "رِفد للتقنية — شركة سعودية تبني أدوات محتوى وتسويق ذكية للمتاجر، مع اشتراكات داخل المنتج ومسار رِفد للأعمال للحالات المؤسسية الأوسع.",
      },
      { property: "og:title", content: "من نحن — رِفد للتقنية" },
      { property: "og:description", content: "قصة رِفد ورؤيتنا لتمكين كل متجر سعودي بأدوات AI محلية." },
      { name: "twitter:title", content: "من نحن — رِفد للتقنية" },
      { name: "twitter:description", content: "قصة رِفد ورؤيتنا لتمكين كل متجر سعودي بأدوات AI محلية." },
    ],
    links: [{ rel: "canonical", href: "https://rifd.site/about" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <MarketingLayout>
      <section className="gradient-hero min-h-[28rem] py-16 sm:min-h-[24rem] sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <div className="inline-flex min-h-7 items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            صُنع في الرياض
          </div>
          <h1 className="mt-4 min-h-[9rem] text-4xl font-extrabold leading-[1.28] sm:min-h-[4.5rem] sm:text-5xl sm:leading-[1.18]">
              نحن <span className="text-gradient-primary">رِفد للتقنية</span>
          </h1>
          <p className="mt-5 min-h-[7rem] text-lg leading-8 text-muted-foreground sm:min-h-[4rem]">
            نؤمن إن كل صاحب متجر سعودي يستحق أدوات ذكاء اصطناعي مصممة بعنايته
            ولهجته — لا أدوات عالمية مترجمة بشكل ركيك.
          </p>
        </div>
      </section>

      <section className="bg-background py-16">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-2xl font-extrabold">قصتنا</h2>
          <div className="mt-4 space-y-4 text-muted-foreground leading-relaxed">
            <p>
              بدأنا رِفد لأننا لاحظنا حقيقة بسيطة: أصحاب المتاجر السعوديين يقضّون ساعات
              يحاولون يطلّعون من ChatGPT نصوص بنبرة سعودية صحيحة — والنتيجة في الغالب
              فصحى مكسّرة أو ترجمة آلية.
            </p>
            <p>
              فرحنا اشتغلنا. بنينا مكتبة قوالب مهندسة بعناية بالعامية السعودية،
              وربطناها بأقوى نماذج AI في العالم (ChatGPT و Gemini)،
              وأضفنا "ذاكرة متجر" تخلّي كل توليدة مخصصة لمتجرك بدون ما تعيد التفاصيل.
            </p>
            <p>
              نحن لسنا منافس لـChatGPT — نحن طبقة محلية ذكية فوقه، نعطيك نتائج بنبرة
              سعودية أصيلة وبسعر واضح بالريال السعودي ومسار فوترة موضح داخل المنتج.
            </p>
            <p>
              وعندما يتجاوز الاحتياج اشتراك الأداة نفسها إلى تشخيص، تنفيذ، وتأهيل فرق
              أو قنوات متعددة، لا نخلط ذلك مع الباقات الشهرية؛ بل ننقله بوضوح إلى
              <span className="font-bold text-foreground"> مسار رِفد للأعمال </span>
              كخيار مؤسسي منفصل.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {[
              { icon: Target, t: "رؤيتنا", d: "نمكّن كل متجر سعودي بأدوات AI محلية الذوق والنبرة." },
              { icon: Heart, t: "قيمنا", d: "الشفافية، السعر العادل، والاحترام لخصوصية بياناتك." },
              { icon: Award, t: "وعدنا", d: "ضمان 7 أيام استرداد كامل بدون أسئلة على أول اشتراك + دعم بالعربي + تطوير مستمر." },
            ].map((v) => (
              <div key={v.t} className="rounded-xl border border-border bg-card p-5 shadow-soft">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <v.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 font-bold">{v.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{v.d}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-primary/20 bg-secondary/40 p-6 text-center">
            <h3 className="text-lg font-bold">عندك سؤال أو اقتراح؟</h3>
            <p className="mt-2 text-sm text-muted-foreground">نحن نسمعك دائماً — اختر القناة الأنسب</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Button asChild>
                <a href="https://wa.me/966582286215" target="_blank" rel="noreferrer noopener">
                  <MessageCircle className="ml-2 h-4 w-4" />
                  واتساب الدعم
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href="mailto:hello@rifd.site">
                  <Mail className="ml-2 h-4 w-4" />
                  hello@rifd.site
                </a>
              </Button>
              <Button asChild variant="ghost">
                <Link to="/contact">صفحة التواصل الكاملة</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
