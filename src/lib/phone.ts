/**
 * Saudi phone number helpers.
 *
 * Storage standard (matches existing data): E.164 without "+" → "9665XXXXXXXX"
 *
 * Accepts on input: "0512345678", "512345678", "+966512345678",
 * "00966512345678", "966512345678" — with/without spaces, dashes, parentheses.
 *
 * Rejects: anything that doesn't normalize to a 12-digit string starting with
 * "9665" (i.e. Saudi mobile that begins with 5).
 */

/**
 * Normalize any accepted Saudi phone format to "9665XXXXXXXX".
 * Returns null if input cannot be normalized to a valid Saudi mobile.
 */
export function normalizeSaudiPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  // Keep digits and a leading +
  const cleaned = input.replace(/[^0-9+]/g, "");
  let digits = cleaned.replace(/^\+/, "");

  // 00966XXXXXXXXX → 966XXXXXXXXX
  if (digits.startsWith("00")) digits = digits.slice(2);

  // 0XXXXXXXXX (local) → strip leading 0 then prepend 966
  if (digits.startsWith("0") && digits.length === 10) {
    digits = "966" + digits.slice(1);
  } else if (digits.startsWith("5") && digits.length === 9) {
    // Bare 9-digit mobile starting with 5
    digits = "966" + digits;
  }

  // Must end up as exactly 12 digits starting with 9665
  if (/^9665\d{8}$/.test(digits)) return digits;
  return null;
}

/**
 * Strict validation: returns true only if input represents a valid Saudi mobile.
 */
export function validateSaudiPhone(input: string | null | undefined): boolean {
  return normalizeSaudiPhone(input) !== null;
}

/**
 * Pretty display: "+966 5X XXX XXXX". Falls back to original input
 * if it cannot be normalized (so legacy DB values still render).
 */
export function formatSaudiPhoneDisplay(input: string | null | undefined): string {
  if (!input) return "";
  const n = normalizeSaudiPhone(input);
  if (!n) return input;
  // 966 5X XXX XXXX
  return `+${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 8)} ${n.slice(8)}`;
}

/** Standard error message used across all forms. */
export const SAUDI_PHONE_ERROR =
  "أدخل رقم جوال سعودي صحيح يبدأ بـ 5 (مثال: 0512345678)";

/** Standard placeholder used across all inputs. */
export const SAUDI_PHONE_PLACEHOLDER = "0512345678";
