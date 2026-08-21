/**
 * Consent Tracking — Server Functions (PDPL)
 * ─────────────────────────────────────────────────────────────
 * كل تسجيل/سحب موافقة يمر عبر السيرفر فقط، والنصوص القانونية
 * تُبنى على السيرفر من ثوابت داخلية لمنع تلاعب العميل بالنص.
 */

import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// أنواع الموافقات (تطابق ENUMs في قاعدة البيانات)
// ============================================================
export const CONSENT_TYPES = [
  "marketing_email",
  "marketing_whatsapp",
  "marketing_telegram",
  "product_updates",
] as const;

export type ConsentType = (typeof CONSENT_TYPES)[number];

export const CONSENT_SOURCES = [
  "onboarding",
  "settings",
  "subscription_form",
  "telegram_bot",
  "whatsapp_form",
  "admin_action",
  "api",
] as const;

export type ConsentSource = (typeof CONSENT_SOURCES)[number];

// ============================================================
// نصوص الموافقات — مصدر الحقيقة الوحيد (قانوني)
// ============================================================
export const CONSENT_VERSION = "v1";

export const CONSENT_TEXTS: Record<ConsentType, string> = {
  marketing_email:
    "أوافق على تلقي رسائل بريد إلكتروني تسويقية من رِفد تتضمن نصائح، عروض، وميزات جديدة. يمكنني إلغاء الاشتراك في أي وقت من الإعدادات.",
  marketing_whatsapp:
    "أوافق على تلقي رسائل واتساب من رِفد تتضمن تذكيرات الاشتراك والعروض الحصرية. لن نشارك رقمي مع أي طرف ثالث.",
  marketing_telegram:
    "أوافق على تلقي رسائل تيليجرام من رِفد عبر بوت @RifdBot الرسمي. يمكنني إلغاء الاشتراك بكتابة /unsubscribe.",
  product_updates:
    "أوافق على تلقي إشعارات عن تحديثات المنتج وميزات جديدة عبر البريد الإلكتروني.",
};

// ============================================================
// نوع حالة الموافقة لكل نوع
// ============================================================
export interface ConsentStatusItem {
  given: boolean;
  last_updated: string | null;
  source: ConsentSource | null;
  version: string | null;
}

export type ConsentStatusMap = Record<ConsentType, ConsentStatusItem>;

const DEFAULT_STATUS: ConsentStatusItem = {
  given: false,
  last_updated: null,
  source: null,
  version: null,
};

// ============================================================
// Zod schemas
// ============================================================
const consentTypeSchema = z.enum(CONSENT_TYPES);
const consentSourceSchema = z.enum(CONSENT_SOURCES);

const recordConsentSchema = z.object({
  consent_type: consentTypeSchema,
  consent_given: z.boolean(),
  source: consentSourceSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const withdrawConsentSchema = z.object({
  consent_type: consentTypeSchema,
  reason: z.string().trim().max(500).optional(),
});

// ============================================================
// 1) recordConsent — تسجيل موافقة جديدة (أو تجديدها)
// ============================================================
export const recordConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => recordConsentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const userAgent = getRequestHeader("user-agent")?.slice(0, 500);
    const consentText = CONSENT_TEXTS[data.consent_type];

    const { data: rpcData, error } = await supabase.rpc("record_consent", {
      _consent_type: data.consent_type,
      _consent_given: data.consent_given,
      _consent_text: consentText,
      _consent_version: CONSENT_VERSION,
      _source: data.source,
      _user_agent: userAgent,
      _metadata: (data.metadata ?? {}) as never,
    });

    if (error) {
      console.error("[consent] recordConsent failed", error.message);
      throw new Error("تعذّر حفظ موافقتك، حاول لاحقاً");
    }

    return { id: rpcData as string };
  });

// ============================================================
// 2) withdrawConsent — سحب موافقة (يُدرج سجل سحب بدون تعديل القديم)
// ============================================================
export const withdrawConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => withdrawConsentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: rpcData, error } = await supabase.rpc("withdraw_consent", {
      _consent_type: data.consent_type,
      _reason: data.reason,
    });

    if (error) {
      console.error("[consent] withdrawConsent failed", error.message);
      throw new Error("تعذّر سحب الموافقة، حاول لاحقاً");
    }

    return { id: rpcData as string };
  });

// ============================================================
// 3) getUserConsentStatus — جلب آخر حالة لكل نوع
// ============================================================
export const getUserConsentStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConsentStatusMap> => {
    const { supabase } = context;

    const { data, error } = await supabase.rpc("get_user_consent_status", {
      _consent_type: undefined,
    });

    if (error) {
      console.error("[consent] getUserConsentStatus failed", error.message);
      throw new Error("تعذّر تحميل تفضيلاتك، حاول لاحقاً");
    }

    const map: ConsentStatusMap = {
      marketing_email: { ...DEFAULT_STATUS },
      marketing_whatsapp: { ...DEFAULT_STATUS },
      marketing_telegram: { ...DEFAULT_STATUS },
      product_updates: { ...DEFAULT_STATUS },
    };

    const rows = (data ?? []) as Array<{
      consent_type: ConsentType;
      consent_given: boolean;
      last_updated: string | null;
      source: ConsentSource | null;
      consent_version: string | null;
    }>;

    for (const row of rows) {
      if (CONSENT_TYPES.includes(row.consent_type)) {
        map[row.consent_type] = {
          given: row.consent_given,
          last_updated: row.last_updated,
          source: row.source,
          version: row.consent_version,
        };
      }
    }

    return map;
  });
