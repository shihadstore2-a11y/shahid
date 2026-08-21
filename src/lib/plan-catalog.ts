export type PlanId = "free" | "starter" | "growth" | "pro" | "business";
export type PaidPlanId = Exclude<PlanId, "free">;

export const VIDEO_CREDIT_COSTS = {
  video_fast: 150,
  video_lite: 500,
  video_lite_8s: 500,
  video_quality: 800,
  video_quality_8s: 800,
} as const;

export const PLAN_CREDIT_POLICY = {
  monthlyCycleDays: 30,
  planCreditsRollover: false,
  paidPlansRequireProductImageForVideo: true,
  freePlanWatermark: true,
  paidPlansWatermark: false,
} as const;

export type VideoQuality = "fast" | "lite" | "quality";
export type VideoDuration = 5 | 8;

export function videoTierDuration(quality: VideoQuality): VideoDuration {
  return quality === "fast" ? 5 : 8;
}

export function isValidVideoTierSelection(quality: VideoQuality, duration: VideoDuration) {
  return videoTierDuration(quality) === duration;
}

export function videoCreditCost(quality: VideoQuality, duration: VideoDuration = 5) {
  if (!isValidVideoTierSelection(quality, duration)) throw new Error("invalid_video_tier_duration");
  if (quality === "lite") return duration === 8 ? VIDEO_CREDIT_COSTS.video_lite_8s : VIDEO_CREDIT_COSTS.video_lite;
  if (quality === "quality") return duration === 8 ? VIDEO_CREDIT_COSTS.video_quality_8s : VIDEO_CREDIT_COSTS.video_quality;
  return VIDEO_CREDIT_COSTS.video_fast;
}

export const VIDEO_QUALITY_LABELS: Record<VideoQuality, string> = {
  fast: "سريع",
  lite: "إعلاني",
  quality: "احترافي",
};

export type PlanCatalogEntry = {
  id: PlanId;
  name: string;
  tier: "free" | "entry" | "popular" | "premium" | "scale";
  monthlyPriceSar: number;
  yearlyPriceSar: number;
  monthlyCredits: number;
  dailyTextCap: number;
  dailyImageCap: number;
  imageProAllowed: boolean;
  videoFastAllowed: boolean;
  videoQualityAllowed: boolean;
  maxVideoDurationSeconds: VideoDuration;
  tagline: string;
  badge?: string;
  /** للـ Free فقط: حصة شهرية متجددة بدلاً من اليومية */
  monthlyTrialQuota?: { text: number; image: number; video: number };
  /** شارة "سعر الإطلاق" تظهر على المدفوعة */
  launchBadge?: boolean;
};

/** نص شارة سعر الإطلاق — مصدر واحد للحقيقة */
export const LAUNCH_BADGE_LABEL = "سعر الإطلاق";

/** نص شارة الضمان — مصدر واحد للحقيقة */
export const REFUND_GUARANTEE_LABEL = "ضمان 7 أيام استرداد كامل";

/** خصم سنوي ثابت 20% (Toggle) */
export const ANNUAL_DISCOUNT_PCT = 20;

export const PLAN_CATALOG = [
  {
    id: "free",
    name: "Free",
    tier: "free",
    monthlyPriceSar: 0,
    yearlyPriceSar: 0,
    monthlyCredits: 150,
    // Free لا يستخدم العدّاد اليومي — يستخدم monthlyTrialQuota أدناه فقط
    dailyTextCap: 5,
    dailyImageCap: 3,
    imageProAllowed: false,
    videoFastAllowed: true,
    videoQualityAllowed: false,
    maxVideoDurationSeconds: 5,
    tagline: "تجربة شهرية متجددة: 5 نصوص + 3 صور + فيديو سريع واحد",
    monthlyTrialQuota: { text: 5, image: 3, video: 1 },
  },
  {
    id: "starter",
    name: "Starter",
    tier: "entry",
    monthlyPriceSar: 149,
    yearlyPriceSar: 1490,
    monthlyCredits: 2000,
    dailyTextCap: 100,
    dailyImageCap: 30,
    imageProAllowed: false,
    videoFastAllowed: true,
    videoQualityAllowed: false,
    maxVideoDurationSeconds: 8,
    tagline: "لبداية فيديو سريع منتظمة بلا تكلفة احترافية",
    launchBadge: true,
  },
  {
    id: "growth",
    name: "Growth",
    tier: "popular",
    monthlyPriceSar: 249,
    yearlyPriceSar: 2490,
    monthlyCredits: 6000,
    dailyTextCap: 250,
    dailyImageCap: 50,
    imageProAllowed: true,
    videoFastAllowed: true,
    videoQualityAllowed: false,
    maxVideoDurationSeconds: 8,
    tagline: "الأفضل لمعظم المتاجر النشطة",
    badge: "الأكثر توازناً",
    launchBadge: true,
  },
  {
    id: "pro",
    name: "Pro",
    tier: "premium",
    monthlyPriceSar: 399,
    yearlyPriceSar: 3990,
    monthlyCredits: 14000,
    dailyTextCap: 600,
    dailyImageCap: 100,
    imageProAllowed: true,
    videoFastAllowed: true,
    videoQualityAllowed: true,
    maxVideoDurationSeconds: 8,
    tagline: "للمتجر الذي يعتمد الفيديو كقناة نمو",
    badge: "أفضل هامش تشغيل",
    launchBadge: true,
  },
  {
    id: "business",
    name: "Business",
    tier: "scale",
    monthlyPriceSar: 999,
    yearlyPriceSar: 9990,
    monthlyCredits: 40000,
    dailyTextCap: 1000,
    dailyImageCap: 150,
    imageProAllowed: true,
    videoFastAllowed: true,
    videoQualityAllowed: true,
    maxVideoDurationSeconds: 8,
    tagline: "للفرق والوكالات الخفيفة متعددة الحملات",
    badge: "للتوسع",
    launchBadge: true,
  },
] as const satisfies readonly PlanCatalogEntry[];

export const PLAN_BY_ID = Object.fromEntries(PLAN_CATALOG.map((plan) => [plan.id, plan])) as Record<PlanId, PlanCatalogEntry>;
export const PAID_PLANS = PLAN_CATALOG.filter((plan) => plan.id !== "free") as PlanCatalogEntry[];

export function formatPlanNumber(value: number) {
  return value.toLocaleString("ar-SA");
}

export function estimateVideoCount(credits: number, quality: VideoQuality, duration: VideoDuration = 5) {
  const cost = videoCreditCost(quality, duration);
  return cost > 0 ? Math.floor(credits / cost) : 0;
}