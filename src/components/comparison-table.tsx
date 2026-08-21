import { Link } from "@tanstack/react-router";
import { Check, X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLAN_BY_ID } from "@/lib/plan-catalog";

const ROWS = [
  { label: "السعر الشهري", chatgpt: "$20 (~75 ر.س)", gemini: "$20 (~75 ر.س)", rifd: `${PLAN_BY_ID.starter.monthlyPriceSar} ر.س` },
  { label: "العامية السعودية", chatgpt: false, gemini: false, rifd: true },
  { label: "ذاكرة متجر دائمة", chatgpt: false, gemini: false, rifd: true },
  { label: "مكتبة قوالب سعودية جاهزة", chatgpt: false, gemini: false, rifd: true },
  { label: "توليد صور بنص عربي", chatgpt: "محدود", gemini: "محدود", rifd: true },
  { label: "تحسين صور منتجات", chatgpt: false, gemini: false, rifd: true },
  { label: "لا يحتاج هندسة برومبتات", chatgpt: false, gemini: false, rifd: true },
  { label: "فوترة واضحة بالريال", chatgpt: false, gemini: false, rifd: true },
  { label: "دعم بالعربي", chatgpt: false, gemini: false, rifd: true },
];

function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="mx-auto h-5 w-5 text-success" />;
  if (value === false) return <X className="mx-auto h-5 w-5 text-destructive/60" />;
  return <span className="text-sm font-medium">{value}</span>;
}

export function ComparisonTable({ compact = false }: { compact?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      {/* تلميح للموبايل */}
      <div className="flex items-center justify-center gap-1.5 border-b border-border bg-secondary/50 px-3 py-1.5 text-[11px] font-medium text-muted-foreground sm:hidden">
        <ArrowLeft className="h-3 w-3 animate-pulse" />
        اسحب لرؤية المقارنة الكاملة
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-right">
          <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-right font-medium">الميزة</th>
              <th className="px-4 py-3 text-center font-medium">ChatGPT Plus</th>
              <th className="px-4 py-3 text-center font-medium">Gemini Pro</th>
              <th className="bg-primary/10 px-4 py-3 text-center font-bold text-primary">رِفد ⭐</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(compact ? ROWS.slice(0, 6) : ROWS).map((row) => (
              <tr key={row.label} className="hover:bg-secondary/30">
                <td className="px-4 py-3 text-sm font-medium">{row.label}</td>
                <td className="px-4 py-3 text-center"><Cell value={row.chatgpt} /></td>
                <td className="px-4 py-3 text-center"><Cell value={row.gemini} /></td>
                <td className="bg-primary/5 px-4 py-3 text-center"><Cell value={row.rifd} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {compact && (
        <div className="border-t border-border bg-secondary/30 p-4 text-center">
          <Button asChild variant="link" className="text-primary">
            <Link to="/vs-chatgpt">شوف المقارنة الكاملة + أمثلة حية ←</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
