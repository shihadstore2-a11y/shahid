/**
 * First-Win Toast — يستمع realtime على user_badges ويعرض toast احتفالي
 * عند منح أي شارة جديدة. يُركَّب في dashboard-shell.
 */
import { useEffect } from "react";
import { Award, PartyPopper, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { track } from "@/lib/analytics/posthog";

type BadgeType = "first_text" | "first_image" | "first_video" | "active_store";

const BADGE_LABELS: Record<BadgeType, { title: string; desc: string }> = {
  first_text: {
    title: "🎉 أول نص يبيع!",
    desc: "نشرت أول نص إعلاني — هذي بداية ممتازة",
  },
  first_image: {
    title: "📸 أول صورة احترافية",
    desc: "صورة إعلان جاهزة لمتجرك — جربها على إنستجرام",
  },
  first_video: {
    title: "🎬 أول فيديو ترويجي",
    desc: "فيديو يلفت الانتباه — حان وقت إطلاق حملتك",
  },
  active_store: {
    title: "🏆 متجر نشط!",
    desc: "نص + صورة + فيديو في يوم واحد. أنت في القمة",
  },
};

export function FirstWinToast() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`user_badges_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_badges",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const badgeType = (payload.new as { badge_type?: BadgeType }).badge_type;
          if (!badgeType || !BADGE_LABELS[badgeType]) return;
          const meta = BADGE_LABELS[badgeType];
          const Icon = badgeType === "active_store" ? Trophy : badgeType === "first_video" ? PartyPopper : badgeType === "first_image" ? Sparkles : Award;
          toast.success(meta.title, {
            description: meta.desc,
            duration: 6000,
            icon: <Icon className="size-5 text-primary" />,
          });
          track("badge_earned", { badge_type: badgeType });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);

  return null;
}
