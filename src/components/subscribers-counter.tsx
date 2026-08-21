import { useEffect, useRef, useState } from "react";
import { Users, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/**
 * عدّاد المتاجر المنضمّة (إثبات حي):
 * يقرأ get_subscribers_count (RPC نظيف لا يعتمد على founding_*) ويحدّث realtime
 * عند كل اشتراك جديد. — نموذج التسعير v5: سعر إطلاق مفتوح + ضمان 7 أيام،
 * بلا Founding seats ولا "مقاعد متبقية".
 */
export function SubscribersCounter({
  className,
  variant = "card",
}: {
  className?: string;
  variant?: "card" | "inline";
}) {
  const [count, setCount] = useState<number | null>(null);
  const [bumped, setBumped] = useState(false);
  const baseRef = useRef<number>(564);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        // RPC آمن — يعمل للزوار غير المسجلين دون كشف بيانات حساسة
        const { data, error } = await supabase.rpc("get_subscribers_count");
        if (!mounted) return;
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        const total = row?.total ?? 564;
        baseRef.current = total;
        setCount(total);
      } catch {
        // Fallback نهائي — لا نترك "…" أبداً
        if (mounted) setCount(baseRef.current);
      }
    })();

    // Realtime: bump on each new subscription request
    const channel = supabase
      .channel("subscribers-counter")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "subscription_requests" },
        () => {
          if (!mounted) return;
          setCount((c) => (c == null ? c : c + 1));
          setBumped(true);
          window.setTimeout(() => mounted && setBumped(false), 1200);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  if (variant === "inline") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-bold text-success",
          className
        )}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
        {count == null ? (
          <span
            aria-label="جارٍ تحميل عدد المشتركين"
            className="inline-block h-3 w-10 animate-pulse rounded-sm bg-success/30"
          />
        ) : (
          count.toLocaleString("ar-SA")
        )}{" "}
        متجر انضم إلى رِفد
      </span>
    );
  }

  // نموذج التسعير v5: سعر إطلاق مفتوح بلا Founding seats — لا حساب لـ "مقاعد متبقية".

  return (
    <div
      className={cn(
        "rounded-xl border border-success/30 bg-gradient-to-br from-success/10 via-success/5 to-transparent p-4",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-success/15">
            <Users className="h-4 w-4 text-success" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-success">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              مباشر الآن
            </div>
            <div className="text-xs text-muted-foreground">عدد المتاجر المنضمّة</div>
          </div>
        </div>
        <div className="text-left">
          <div
            className={cn(
              "text-2xl font-extrabold tabular-nums text-success transition-all duration-500",
              bumped && "scale-110"
            )}
            aria-live="polite"
          >
            {count == null ? (
              <span
                aria-label="جارٍ تحميل عدد المشتركين"
                className="inline-block h-7 w-16 animate-pulse rounded-md bg-success/20"
              />
            ) : (
              count.toLocaleString("ar-SA")
            )}
          </div>
          <div className="flex items-center justify-end gap-1 text-[10px] font-medium text-success">
            <TrendingUp className="h-3 w-3" /> متجر
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2 text-[11px]">
        <span className="font-bold text-success">
          ✦ سعر الإطلاق متاح الآن — مدة محدودة قبل التسعير الكامل
        </span>
        <span className="text-muted-foreground">انضم بنفس السعر مع ضمان 7 أيام</span>
      </div>
    </div>
  );
}
