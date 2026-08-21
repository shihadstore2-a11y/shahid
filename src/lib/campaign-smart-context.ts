import type { CampaignPack } from "@/server/campaign-packs";

export type CampaignExecutionContext = {
  campaignId?: string;
  campaignPackId?: string;
  prompt?: string;
  smart?: boolean;
  sector?: string;
  audience?: string;
  offer?: string;
  channel?: string;
  occasion?: string;
  customerStage?: string;
  goal?: CampaignPack["goal"] | string;
  productName?: string;
  productImagePath?: string;
  productImageUrl?: string;
};

const executionKeys = ["campaignId", "campaignPackId", "prompt", "sector", "audience", "offer", "channel", "occasion", "customerStage", "goal", "productName", "productImagePath", "productImageUrl"] as const;

const goalLabel: Record<CampaignPack["goal"], string> = {
  launch: "إطلاق منتج",
  clearance: "تصفية المخزون",
  upsell: "زيادة قيمة السلة",
  leads: "بناء قاعدة عملاء",
  competitive: "مواجهة المنافسين",
  winback: "إعادة الاستهداف",
};

export function campaignSmartPromptFromContext(context: CampaignExecutionContext, kind: "text" | "image" | "video", campaign?: CampaignPack | null) {
  const goal = context.goal ? goalLabel[context.goal as CampaignPack["goal"]] ?? context.goal : campaign?.goal ? goalLabel[campaign.goal] : "";
  const base = buildCampaignContextLines(context, campaign, goal).join("\n");

  const imageNote = hasCampaignProductImage(context, campaign) ? "صورة المنتج مرفقة كمرجع بصري؛ حافظ على نفس المنتج ولا تفترض مواصفات غير ظاهرة." : "";

  if (kind === "text") return [base, imageNote, context.prompt || campaign?.text_prompt, textDirection(context), "اكتب نصاً يبيع بصياغة سعودية واضحة: هوك، فائدة، عرض، ودعوة إجراء مباشرة."].filter(Boolean).join("\n\n");
  if (kind === "image") return [base, imageNote, context.prompt || campaign?.image_prompt, imageDirection(context), "صمّم صورة إعلان للمنتج: المنتج واضح، مساحة للنص العربي، العرض ظاهر بدون مبالغة، ومناسبة للقناة المختارة."].filter(Boolean).join("\n\n");
  return [base, imageNote, context.prompt || campaign?.video_prompt, videoDirection(context), "حوّلها إلى فيديو قصير: أول ثانيتين تشد الانتباه، المنتج واضح، حركة بسيطة، ونهاية بدعوة إجراء."].filter(Boolean).join("\n\n");
}

export function resolveCampaignExecutionContext(campaign?: CampaignPack | null, search: CampaignExecutionContext = {}): CampaignExecutionContext {
  return {
    ...search,
    campaignId: search.campaignId ?? campaign?.id,
    productName: search.productName ?? campaign?.product,
    audience: search.audience ?? campaign?.audience,
    offer: search.offer ?? campaign?.offer,
    channel: search.channel ?? campaign?.channel,
    goal: search.goal ?? campaign?.goal,
    productImagePath: search.productImagePath ?? campaign?.product_image_path ?? undefined,
    productImageUrl: search.productImageUrl,
  };
}

export function parseCampaignExecutionSearch(s: Record<string, unknown>): CampaignExecutionContext {
  const out: CampaignExecutionContext = { smart: s.smart === true || s.smart === "true" ? true : undefined };
  for (const key of executionKeys) {
    const value = s[key];
    if (typeof value === "string" && value.trim()) out[key] = value.slice(0, key === "prompt" ? 5000 : key === "productImagePath" || key === "productImageUrl" ? 2000 : 500) as never;
  }
  return out;
}

export function campaignExecutionSearch(context: CampaignExecutionContext, prompt?: string): CampaignExecutionContext {
  return Object.fromEntries(Object.entries({ ...context, prompt: prompt ?? context.prompt, smart: true }).filter(([, value]) => value !== undefined && value !== "")) as CampaignExecutionContext;
}

export function hasCampaignExecutionContext(context: CampaignExecutionContext) {
  return Boolean(context.campaignId || context.campaignPackId || context.productName || context.audience || context.offer || context.channel || context.goal || context.sector || context.occasion || context.customerStage || context.productImagePath || context.productImageUrl);
}

export function hasCampaignProductImage(context: CampaignExecutionContext, campaign?: CampaignPack | null) {
  return Boolean(context.productImagePath || context.productImageUrl || campaign?.product_image_path);
}

export function campaignContextSummary(context: CampaignExecutionContext) {
  if (!hasCampaignExecutionContext(context)) return "";
  return [
    context.productName ? `📢 حملة: ${context.productName}` : "📢 حملة محفوظة",
    context.goal ? `🎯 ${goalLabel[context.goal as CampaignPack["goal"]] ?? context.goal}` : "",
    context.audience ? `👥 ${context.audience}` : "",
    context.offer ? `🏷️ ${context.offer}` : "",
  ].filter(Boolean).join(" | ");
}

export function campaignTextTemplate(campaign: CampaignPack) {
  if (campaign.channel === "snapchat") return "snap-ad-copy";
  if (campaign.channel === "tiktok") return "tiktok-ad-script";
  if (campaign.channel === "whatsapp") return "whatsapp-reply";
  if (campaign.goal === "launch") return "ig-post-launch";
  return "meta-ad-copy";
}

export function campaignImageTemplate(campaign: CampaignPack) {
  if (campaign.goal === "launch") return "img-ig-story-launch";
  if (campaign.channel === "instagram") return "img-meta-ad";
  return "img-white-friday";
}

export function campaignVideoDefaults(campaign: CampaignPack) {
  return {
    aspectRatio: campaign.channel === "whatsapp" ? "1:1" as const : "9:16" as const,
    selectedPersonaId: campaign.audience.includes("الفخامة") ? "male-premium" : campaign.audience.includes("الأمهات") ? "female-abaya" : "male-young",
    templateId: campaign.product.includes("عطر") ? "perfume-premium-hook" : campaign.product.includes("قهوة") ? "coffee-hospitality" : campaign.product.includes("عباية") ? "abaya-launch" : "electronics-benefit",
  };
}

export function campaignEditPresetFromContext(context: CampaignExecutionContext, campaign?: CampaignPack | null) {
  const resolved = resolveCampaignExecutionContext(campaign, context);
  if (resolved.goal === "launch" || resolved.audience?.includes("الفخامة")) return "luxury-bg";
  if (resolved.goal === "clearance") return "add-text";
  if (resolved.channel?.includes("انستقرام") || resolved.channel?.includes("سناب") || resolved.channel === "instagram" || resolved.channel === "snapchat") return "instagram-square";
  return "enhance";
}

function buildCampaignContextLines(context: CampaignExecutionContext, campaign: CampaignPack | null | undefined, goal: string) {
  return [
    `المنتج: ${context.productName ?? campaign?.product ?? "غير محدد"}`,
    context.sector ? `قطاع المتجر: ${context.sector}` : "",
    goal ? `هدف الحملة: ${goal}` : "",
    context.audience ? `الجمهور: ${context.audience}` : "",
    context.offer ? `العرض: ${context.offer}` : "",
    context.channel ? `القناة: ${context.channel}` : "",
    context.occasion ? `المناسبة: ${context.occasion}` : "",
    context.customerStage ? `مرحلة العميل: ${context.customerStage}` : "",
    campaign?.brief ? `ملخص الحملة:\n${campaign.brief}` : "",
  ].filter(Boolean);
}

function textDirection(context: CampaignExecutionContext) {
  const lines = [];
  if (context.audience?.includes("الفخامة")) lines.push("اكتب بأسلوب فاخر وانتقائي بدون مبالغة.");
  if (context.occasion?.includes("رمضان")) lines.push("اجعل الصياغة مناسبة لروح رمضان والهدية والكرم.");
  if (context.customerStage?.includes("جدد")) lines.push("عرّف بالقيمة بسرعة واطلب إجراء بسيطاً.");
  return lines.join(" ");
}

function imageDirection(context: CampaignExecutionContext) {
  if (context.goal === "clearance") return "استخدم إحساس عرض نهاية الموسم: السعر/العرض واضح والمنتج بطل الصورة.";
  if (context.audience?.includes("الفخامة")) return "اتجاه بصري فاخر: خامات راقية، إضاءة ناعمة، ومساحة عربية نظيفة للنص.";
  return "اجعل الأسلوب مناسباً للقناة والجمهور مع أولوية وضوح المنتج.";
}

function videoDirection(context: CampaignExecutionContext) {
  if (context.channel?.toLowerCase().includes("tiktok")) return "فيديو عمودي 9:16، إيقاع سريع، حركة أول ثانية، وموسيقى ترند خفيفة مناسبة للإعلان.";
  if (context.channel?.includes("واتساب") || context.channel?.toLowerCase().includes("whatsapp")) return "فيديو قصير مباشر يمكن إرساله في واتساب: عرض واضح وCTA سريع.";
  return "اختر أسلوب فيديو قصير مناسب للقناة، بإيقاع إعلاني واضح وموسيقى خفيفة.";
}