import { CheckCircle2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FounderCard({ whatsappNumber }: { whatsappNumber: string }) {
  const waUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    "السلام عليكم، عندي سؤال قبل الاشتراك في رِفد"
  )}`;

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-card to-card p-5 shadow-soft">
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-xl font-extrabold text-primary-foreground shadow-elegant">
            ر
          </div>
          <span
            aria-hidden
            className="absolute -bottom-0.5 -left-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-success ring-2 ring-card"
          >
            <CheckCircle2 className="h-3 w-3 text-success-foreground" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-extrabold">المؤسس يردّ شخصياً</h3>
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">
              متاح الآن
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            ما عندنا بوت ولا فريق دعم خارجي. كل رسالة تردّها أنت كصاحب المنصة — رد سريع عبر واتساب خلال ساعات العمل.
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          واتساب مباشر — متوسط الرد أقل من 5 دقائق
        </div>
        <Button asChild size="sm" variant="outline" className="h-8 text-xs">
          <a href={waUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="ml-1 h-3.5 w-3.5" /> اسأل قبل الاشتراك
          </a>
        </Button>
      </div>
    </div>
  );
}
