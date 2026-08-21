/**
 * Badges List — يعرض شارات المستخدم في صفحة الإعدادات.
 * يقرأ عبر RPC get_user_badges (لا يحتاج صلاحيات إضافية).
 */
import { useEffect, useState } from "react";
import { Award, Loader2, PartyPopper, Sparkles, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type BadgeType = "first_text" | "first_image" | "first_video" | "active_store";

const BADGE_META: Record<BadgeType, { label: string; desc: string; Icon: typeof Award; color: string }> = {
  first_text: { label: "أول نص يبيع", desc: "أوّل توليد نص إعلاني", Icon: Award, color: "text-blue-500" },
  first_image: { label: "أول صورة احترافية", desc: "أوّل صورة إعلانية", Icon: Sparkles, color: "text-purple-500" },
  first_video: { label: "أول فيديو ترويجي", desc: "أوّل فيديو ناجح", Icon: PartyPopper, color: "text-amber-500" },
  active_store: { label: "متجر نشط", desc: "نص + صورة + فيديو في 24 ساعة", Icon: Trophy, color: "text-primary" },
};

const ALL_BADGES: BadgeType[] = ["first_text", "first_image", "first_video", "active_store"];

type Row = { badge_type: BadgeType; awarded_at: string };

export function BadgesList() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as unknown as {
        rpc: (n: string) => Promise<{ data: Row[] | null }>;
      }).rpc("get_user_badges");
      if (!cancelled) setRows(data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">شاراتك</CardTitle>
      </CardHeader>
      <CardContent>
        {rows === null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            جاري التحميل…
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ALL_BADGES.map((b) => {
              const earned = rows.find((r) => r.badge_type === b);
              const meta = BADGE_META[b];
              const Icon = meta.Icon;
              return (
                <div
                  key={b}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition",
                    earned
                      ? "border-primary/30 bg-primary/5"
                      : "border-dashed border-border bg-muted/30 opacity-60"
                  )}
                >
                  <Icon className={cn("size-7", earned ? meta.color : "text-muted-foreground")} />
                  <div className="text-xs font-semibold leading-tight">{meta.label}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">{meta.desc}</div>
                  {earned && (
                    <div className="text-[10px] text-primary">
                      {new Date(earned.awarded_at).toLocaleDateString("ar-SA")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
