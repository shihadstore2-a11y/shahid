import { ShieldCheck, Clock, FileText, Lock, Headphones, Award } from "lucide-react";
import { cn } from "@/lib/utils";

const BADGES = [
  {
    icon: Clock,
    title: "تأكيد طلب فوري",
    desc: "تفعيل خلال 24 ساعة",
    color: "text-success",
  },
  {
    icon: ShieldCheck,
    title: "ضمان 7 أيام استرداد كامل",
    desc: "بدون أسئلة على أول اشتراك",
    color: "text-primary",
  },
  {
    icon: FileText,
    title: "فوترة واضحة",
    desc: "تفاصيل الدفع داخل المنتج",
    color: "text-gold",
  },
  {
    icon: Lock,
    title: "بياناتك محمية",
    desc: "جلسات مؤمنة وسياسات وصول",
    color: "text-info",
  },
  {
    icon: Headphones,
    title: "دعم بالعربي",
    desc: "واتساب مباشر",
    color: "text-success",
  },
  {
    icon: Award,
    title: "خصوصية واضحة",
    desc: "سياسات وصول وحماية بيانات",
    color: "text-gold",
  },
] as const;

export function TrustBadges({
  variant = "grid",
  items = 6,
  className,
}: {
  variant?: "grid" | "row";
  items?: 3 | 4 | 6;
  className?: string;
}) {
  const list = BADGES.slice(0, items);

  if (variant === "row") {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-xs text-muted-foreground",
          className
        )}
      >
        {list.map((b) => (
          <span key={b.title} className="flex items-center gap-1.5">
            <b.icon className={cn("h-3.5 w-3.5", b.color)} />
            <span className="font-medium">{b.title}</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-3 sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {list.map((b) => (
        <div
          key={b.title}
          className="flex items-start gap-3 rounded-xl border border-border bg-card/50 p-3 backdrop-blur"
        >
          <div className={cn("rounded-lg bg-secondary/60 p-2", b.color)}>
            <b.icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold">{b.title}</div>
            <div className="text-xs text-muted-foreground">{b.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
