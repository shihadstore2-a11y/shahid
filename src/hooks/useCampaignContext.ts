import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getCampaignContext, type CampaignPack } from "@/server/campaign-packs";

type CampaignContextInput = {
  campaignId?: string;
  campaignPackId?: string;
};

const uuidPattern = /^[0-9a-f-]{36}$/i;

export function useCampaignContext(input: CampaignContextInput) {
  const getContextFn = useServerFn(getCampaignContext);
  const requestedId = input.campaignId ?? input.campaignPackId;
  const validId = requestedId && uuidPattern.test(requestedId) ? requestedId : undefined;
  const [campaign, setCampaign] = useState<CampaignPack | null>(null);
  const [loading, setLoading] = useState(Boolean(validId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!validId) {
      setCampaign(null);
      setLoading(false);
      setError(requestedId ? "تعذر تحميل سياق الحملة، يمكنك استخدام الأداة بشكل عادي." : null);
      return;
    }

    setLoading(true);
    setError(null);
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!session) throw new Error("سجّل الدخول لربط الأداة بالحملة");
        return getContextFn({
          data: { campaignId: input.campaignId, campaignPackId: input.campaignPackId },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      })
      .then((out) => {
        if (!alive) return;
        setCampaign(out.campaign);
        setError(out.campaign ? null : "تعذر تحميل سياق الحملة، يمكنك استخدام الأداة بشكل عادي.");
      })
      .catch((e) => {
        if (!alive) return;
        setCampaign(null);
        setError(e instanceof Error ? e.message : "تعذر تحميل سياق الحملة، يمكنك استخدام الأداة بشكل عادي.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => { alive = false; };
  }, [getContextFn, input.campaignId, input.campaignPackId, requestedId, validId]);

  return useMemo(() => ({
    campaign,
    campaignId: campaign?.id,
    requestedCampaignId: validId,
    loading,
    error,
    isCampaignMode: Boolean(validId),
    returnToStudioSearch: campaign?.id ? { campaignId: campaign.id } : undefined,
  }), [campaign, error, loading, validId]);
}
