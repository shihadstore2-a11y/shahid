/**
 * تقدير تكلفة التوليد بالدولار حسب الموديل المستخدم.
 * الأرقام تقديرية ومبنية على أسعار Lovable AI Gateway المُعلنة وقت الكتابة.
 * تُستخدم لأغراض القياس الداخلي فقط — ليست فاتورة فعلية.
 */
import type { AIUsage } from "./lovable-ai";

// Gemini Flash text: $0.075/1M input, $0.30/1M output (تقريبي)
// Gemini Pro text: $1.25/1M input, $5.00/1M output (تقريبي)
const TEXT_PRICING: Record<string, { in: number; out: number }> = {
  "google/gemini-2.5-flash": { in: 0.075, out: 0.3 },
  "google/gemini-2.5-flash-lite": { in: 0.04, out: 0.15 },
  "google/gemini-2.5-pro": { in: 1.25, out: 5.0 },
};

// تكلفة ثابتة لكل صورة مولّدة
const IMAGE_PRICING: Record<string, number> = {
  "google/gemini-3.1-flash-image-preview": 0.04,
  "google/gemini-3-pro-image-preview": 0.1,
};

export function estimateTextCost(model: string, usage: AIUsage): number {
  const p = TEXT_PRICING[model];
  if (!p) return 0;
  const inTok = usage.prompt_tokens ?? 0;
  const outTok = usage.completion_tokens ?? 0;
  return (inTok * p.in + outTok * p.out) / 1_000_000;
}

export function estimateImageCost(model: string): number {
  return IMAGE_PRICING[model] ?? 0.04;
}
