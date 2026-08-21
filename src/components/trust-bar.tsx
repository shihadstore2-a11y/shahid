import { ShieldCheck, BadgeCheck, Lock, Sparkles } from "lucide-react";

export function TrustBar() {
  return (
    <div className="border-b border-border/60 bg-secondary/40">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <BadgeCheck className="h-3.5 w-3.5 text-primary" />
          سجل تجاري سعودي
        </span>
        <span className="hidden h-3 w-px bg-border sm:block" />
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          ضمان 7 أيام استرداد كامل
        </span>
        <span className="hidden h-3 w-px bg-border sm:block" />
        <span className="flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-primary" />
          دفع عبر تحويل موثّق
        </span>
        <span className="hidden h-3 w-px bg-border sm:block" />
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-gold" />
          مدعوم بـChatGPT و Gemini
        </span>
      </div>
    </div>
  );
}
