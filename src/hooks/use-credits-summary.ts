/**
 * Hook موحَّد لجلب ملخص رصيد النقاط + الحصة اليومية.
 * يُحدّث تلقائياً كل 60 ثانية + عند طلب يدوي (refresh).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getCreditsSummary } from "@/server/credits";

export type CreditsSummary = Awaited<ReturnType<typeof getCreditsSummary>>;

const REFRESH_INTERVAL_MS = 60_000;

export function useCreditsSummary(opts: { enabled?: boolean } = {}) {
  const enabled = opts.enabled ?? true;
  const fetchSummary = useServerFn(getCreditsSummary);
  const [data, setData] = useState<CreditsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const aliveRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (aliveRef.current) {
          setData(null);
          setLoading(false);
        }
        return;
      }
      const r = await fetchSummary({
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (aliveRef.current) {
        setData(r);
        setError(null);
      }
    } catch (e) {
      if (aliveRef.current) {
        setError(e instanceof Error ? e.message : "فشل جلب الرصيد");
      }
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [fetchSummary]);

  useEffect(() => {
    aliveRef.current = true;
    if (!enabled) {
      setLoading(false);
      return () => {
        aliveRef.current = false;
      };
    }
    void refresh();
    const id = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => {
      aliveRef.current = false;
      clearInterval(id);
    };
  }, [enabled, refresh]);

  return { data, loading, error, refresh };
}
