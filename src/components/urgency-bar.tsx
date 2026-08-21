import { useEffect, useState } from "react";
import { Flame, Clock } from "lucide-react";

/**
 * شريط ندرة + إلحاح أعلى الموقع — رفيع (24px) ليفسح المجال للـHero.
 */
export function UrgencyBar() {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const update = () => {
      const now = new Date();
      const target = new Date(now);
      const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7;
      target.setDate(now.getDate() + daysUntilFriday);
      target.setHours(23, 59, 59, 0);
      const diff = target.getTime() - now.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      setTimeLeft(`${days}ي ${hours}س ${minutes}د`);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-gradient-to-l from-gold via-gold/95 to-gold text-gold-foreground">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-2 px-4 py-1 text-center text-[11px] font-bold sm:text-xs">
        <Flame className="h-3.5 w-3.5 animate-pulse" />
        <span>عرض افتتاحي — خصم 50% على أول شهرين</span>
        <span
          className="inline-flex items-center gap-1 rounded-full bg-foreground/15 px-1.5 py-0.5 text-[10px]"
          suppressHydrationWarning
        >
          <Clock className="h-2.5 w-2.5" />
          ينتهي خلال {mounted && timeLeft ? timeLeft : "قريباً"}
        </span>
      </div>
    </div>
  );
}
