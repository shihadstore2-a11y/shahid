/**
 * Receipt OCR via Lovable AI Gateway (Gemini 2.5 Flash — vision)
 *
 * يستخرج: المبلغ، التاريخ، IBAN/الحساب المستلم من صورة/PDF إيصال تحويل بنكي.
 * لا يرفض الإيصال — فقط ينبّه الأدمن في `admin_notes` إذا اختلف المبلغ
 * عن سعر الخطة.
 */

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type ReceiptInsights = {
  ok: boolean;
  amount: number | null;
  currency: string | null;
  date: string | null;
  iban: string | null;
  bank_name: string | null;
  raw: string | null;
  error?: string;
};

const SYSTEM_PROMPT = `أنت مساعد مالي يستخرج بيانات من إيصالات تحويل بنكي سعودي.
أعد فقط JSON بالحقول التالية بدون أي شرح:
{ "amount": number|null, "currency": "SAR"|null, "date": "YYYY-MM-DD"|null, "iban": string|null, "bank_name": string|null }
- المبلغ بالريال السعودي إن أمكن
- إذا لم يكن واضحاً، استخدم null
- IBAN يبدأ بـ SA ويتكوّن من 24 حرفاً`;

export async function extractReceiptInsights(
  fileUrl: string,
  mimeType: string
): Promise<ReceiptInsights> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      amount: null,
      currency: null,
      date: null,
      iban: null,
      bank_name: null,
      raw: null,
      error: "LOVABLE_API_KEY not configured",
    };
  }

  // Lovable AI يدعم vision عبر image_url مع data URL أو URL مباشر
  const userContent = mimeType.startsWith("image/")
    ? [
        { type: "text", text: "استخرج بيانات هذا الإيصال:" },
        { type: "image_url", image_url: { url: fileUrl } },
      ]
    : [
        {
          type: "text",
          text: `استخرج بيانات هذا الإيصال (${mimeType}). الرابط: ${fileUrl}`,
        },
      ];

  try {
    const response = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return {
        ok: false,
        amount: null,
        currency: null,
        date: null,
        iban: null,
        bank_name: null,
        raw: null,
        error: `AI gateway ${response.status}: ${errText.slice(0, 200)}`,
      };
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) {
      return {
        ok: false,
        amount: null,
        currency: null,
        date: null,
        iban: null,
        bank_name: null,
        raw: null,
        error: "empty AI response",
      };
    }

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        ok: false,
        amount: null,
        currency: null,
        date: null,
        iban: null,
        bank_name: null,
        raw,
        error: "invalid JSON from AI",
      };
    }

    return {
      ok: true,
      amount:
        typeof parsed.amount === "number"
          ? parsed.amount
          : parsed.amount && !isNaN(Number(parsed.amount))
            ? Number(parsed.amount)
            : null,
      currency: typeof parsed.currency === "string" ? parsed.currency : null,
      date: typeof parsed.date === "string" ? parsed.date : null,
      iban: typeof parsed.iban === "string" ? parsed.iban : null,
      bank_name: typeof parsed.bank_name === "string" ? parsed.bank_name : null,
      raw,
    };
  } catch (error) {
    return {
      ok: false,
      amount: null,
      currency: null,
      date: null,
      iban: null,
      bank_name: null,
      raw: null,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
}

/**
 * يُكوّن ملاحظة عربية للأدمن تلخّص نتيجة OCR
 * + flag إن كان المبلغ مختلفاً عن السعر المتوقّع.
 */
export function buildOcrAdminNote(
  insights: ReceiptInsights,
  expectedAmount: number
): string {
  const ts = new Date().toISOString();
  if (!insights.ok) {
    return `[OCR ${ts}] ⚠️ فشل استخراج بيانات الإيصال — ${insights.error ?? "خطأ غير معروف"}`;
  }
  const lines: string[] = [`[OCR ${ts}] 🔍 نتائج فحص الإيصال:`];
  lines.push(`• المبلغ المستخرج: ${insights.amount ?? "—"} ${insights.currency ?? ""}`);
  lines.push(`• المبلغ المتوقّع: ${expectedAmount} ر.س`);
  if (insights.date) lines.push(`• التاريخ: ${insights.date}`);
  if (insights.iban) lines.push(`• IBAN: ${insights.iban}`);
  if (insights.bank_name) lines.push(`• البنك: ${insights.bank_name}`);

  if (insights.amount !== null) {
    const diff = Math.abs(insights.amount - expectedAmount);
    if (diff > 0.5) {
      lines.push(
        `• ⚠️ تنبيه: المبلغ مختلف عن المتوقّع بـ ${diff.toFixed(2)} ر.س — راجع يدوياً`
      );
    } else {
      lines.push(`• ✅ المبلغ مطابق`);
    }
  } else {
    lines.push(`• ⚠️ تنبيه: تعذّر قراءة المبلغ — راجع الإيصال يدوياً`);
  }
  return lines.join("\n");
}
