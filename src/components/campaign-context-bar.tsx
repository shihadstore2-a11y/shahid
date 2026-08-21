import { Link } from "@tanstack/react-router";
import { ArrowLeft, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CampaignPack } from "@/server/campaign-packs";
import { hasCampaignExecutionContext, type CampaignExecutionContext } from "@/lib/campaign-smart-context";

export function CampaignContextBar({ campaign, campaignId, loading, error, summary, context }: { campaign: CampaignPack | null; campaignId?: string; loading: boolean; error: string | null; summary?: string; context?: CampaignExecutionContext }) {
  if (!campaignId && !hasCampaignExecutionContext(context ?? {})) return null;
  const hasProductImage = Boolean(context?.productImagePath || context?.productImageUrl || campaign?.product_image_path);
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between" dir="rtl">
      <div className="min-w-0 text-sm">
        <p className="font-extrabold text-primary">{loading ? "جاري تحميل سياق الحملة…" : summary || (campaign ? `مرتبطة بحملة: ${campaign.product || "حملة محفوظة"}` : "الأداة تعمل بدون سياق حملة")}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs leading-5 text-muted-foreground">
          <span>{campaign ? `${campaign.goal} · ${campaign.channel}` : error ?? "تم تجهيز الأداة من اختيارات استوديو الحملة."}</span>
          {hasProductImage && <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-background px-2 py-0.5 font-bold text-primary"><ImageIcon className="h-3 w-3" /> صورة المنتج مرفقة</span>}
        </div>
      </div>
      {campaignId && (
        <Button asChild variant="outline" size="sm" className="shrink-0 gap-1">
          <Link to="/dashboard/campaign-studio" search={{ campaignId } as never}><ArrowLeft className="h-3.5 w-3.5" /> العودة للاستوديو</Link>
        </Button>
      )}
    </div>
  );
}
