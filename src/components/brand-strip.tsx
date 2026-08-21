import { ShoppingBag, Store, ShoppingCart, MessageCircle, Instagram, ShieldCheck } from "lucide-react";

/**
 * شريط "متوافق مع" — أيقونات منصات + شارة قانونية آمنة (بدون شعارات الأطراف الثالثة).
 * مصمَّم ليبني الثقة فوراً بعد الـHero.
 */
export function BrandStrip() {
  const platforms = [
    { icon: Store, label: "سلة" },
    { icon: ShoppingCart, label: "زد" },
    { icon: ShoppingBag, label: "شوبيفاي" },
    { icon: MessageCircle, label: "واتساب بزنس" },
    { icon: Instagram, label: "إنستجرام" },
  ];

  return (
    <section
      aria-label="منصات متوافقة"
      className="border-y border-border/60 bg-secondary/40 backdrop-blur-sm"
    >
      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-7">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-[11px] font-extrabold text-success">
            <ShieldCheck className="h-3.5 w-3.5" />
            متوافق مع منصاتك
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {platforms.map((p) => (
              <span
                key={p.label}
                className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground/85 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary hover:shadow-elegant"
              >
                <p.icon className="h-3.5 w-3.5 text-primary transition-transform group-hover:scale-110" />
                {p.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
