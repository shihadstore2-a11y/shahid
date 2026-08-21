/**
 * نظام الألوان والخطوط الموحّد لكل قوالب البريد.
 * **الخلفية بيضاء دائماً** (متطلب deliverability)، الأكسنت من هوية رِفد.
 */

export const brand = {
  // ألوان رِفد الأساسية
  primary: "#1a5d3e", // أخضر داكن (هوية)
  primaryGlow: "#2d8659", // أخضر فاتح (gradients)
  gold: "#c9a961", // ذهبي (accents)
  goldDark: "#a8893f",

  // محايدة
  bg: "#ffffff", // body bg — دائماً أبيض
  surface: "#f7faf8", // كروت/أقسام داخلية
  surfaceAlt: "#f0f9f4",
  border: "#d1e7dd",
  borderLight: "#e5e7eb",

  // نص
  textPrimary: "#1a2e22",
  textBody: "#374151",
  textMuted: "#6b7280",
  textSubtle: "#9ca3af",

  // حالات
  success: "#1a5d3e",
  warning: "#c9831e",
  danger: "#b91c1c",
  info: "#1d6fb8",
} as const;

export const fontFamily =
  '"Tajawal", -apple-system, BlinkMacSystemFont, "Segoe UI", Tahoma, Arial, sans-serif';

export const radius = {
  sm: "6px",
  md: "8px",
  lg: "12px",
  pill: "999px",
} as const;

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
  xxl: "48px",
} as const;

export const SITE_NAME = "رِفد";
export const SITE_URL = "https://rifd.site";
export const SUPPORT_EMAIL = "support@rifd.site";
