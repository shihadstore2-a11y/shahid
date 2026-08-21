import * as React from "react";
import { Button as REButton, Section, Text } from "@react-email/components";
import { brand, radius, spacing, fontFamily } from "./theme";

/**
 * مكوّنات قابلة لإعادة الاستخدام عبر كل قوالب البريد.
 * كلها inline styles — متطلب لتوافق Outlook/Gmail.
 */

export const PrimaryButton: React.FC<{
  href: string;
  children: React.ReactNode;
}> = ({ href, children }) => (
  <REButton
    href={href}
    style={{
      backgroundColor: brand.primary,
      color: "#ffffff",
      padding: "14px 32px",
      borderRadius: radius.md,
      textDecoration: "none",
      fontSize: "15px",
      fontWeight: "bold",
      display: "inline-block",
      fontFamily,
    }}
  >
    {children}
  </REButton>
);

export const SecondaryButton: React.FC<{
  href: string;
  children: React.ReactNode;
}> = ({ href, children }) => (
  <REButton
    href={href}
    style={{
      backgroundColor: "transparent",
      color: brand.primary,
      padding: "12px 28px",
      borderRadius: radius.md,
      textDecoration: "none",
      fontSize: "14px",
      fontWeight: "600",
      display: "inline-block",
      border: `1.5px solid ${brand.primary}`,
      fontFamily,
    }}
  >
    {children}
  </REButton>
);

export const InfoCard: React.FC<{
  children: React.ReactNode;
  variant?: "default" | "highlight" | "warning";
}> = ({ children, variant = "default" }) => {
  const styles = {
    default: { bg: brand.surface, border: brand.borderLight },
    highlight: { bg: brand.surfaceAlt, border: brand.border },
    warning: { bg: "#fffbeb", border: "#fcd34d" },
  };
  const s = styles[variant];
  return (
    <Section
      style={{
        backgroundColor: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: radius.lg,
        padding: spacing.md,
        margin: `${spacing.md} 0`,
      }}
    >
      {children}
    </Section>
  );
};

export const Divider: React.FC = () => (
  <hr
    style={{
      border: "none",
      borderTop: `1px solid ${brand.borderLight}`,
      margin: `${spacing.lg} 0`,
    }}
  />
);

export const Stat: React.FC<{
  label: string;
  value: string;
  highlight?: boolean;
}> = ({ label, value, highlight = false }) => (
  <Section
    style={{ textAlign: "center", margin: `${spacing.md} 0` }}
  >
    <Text
      style={{
        fontSize: "32px",
        fontWeight: "bold",
        color: highlight ? brand.gold : brand.primary,
        margin: 0,
        fontFamily,
        lineHeight: "1.2",
      }}
    >
      {value}
    </Text>
    <Text
      style={{
        fontSize: "13px",
        color: brand.textMuted,
        margin: "4px 0 0",
        fontFamily,
      }}
    >
      {label}
    </Text>
  </Section>
);
