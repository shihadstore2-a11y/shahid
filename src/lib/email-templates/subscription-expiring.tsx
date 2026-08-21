import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, brand, fontFamily, spacing, SITE_NAME } from "./_shared/layout";
import { PrimaryButton, InfoCard } from "./_shared/components";

interface SubscriptionExpiringProps {
  fullName?: string;
  planLabel?: string;
  daysRemaining?: number;
  expiresAt?: string;
  renewUrl?: string;
}

const SubscriptionExpiringEmail = ({
  fullName,
  planLabel = "احترافي",
  daysRemaining = 7,
  expiresAt,
  renewUrl = "https://rifd.site/dashboard/billing",
}: SubscriptionExpiringProps) => {
  const isUrgent = daysRemaining <= 1;
  const headline = isUrgent
    ? "اشتراكك ينتهي خلال 24 ساعة ⏰"
    : `اشتراكك ينتهي خلال ${daysRemaining} أيام`;

  return (
    <EmailLayout preview={`${headline} — جدّد الآن لمواصلة استخدام ${SITE_NAME}`}>
      <Heading style={isUrgent ? h1Urgent : h1}>{headline}</Heading>
      <Text style={text}>
        {fullName ? `مرحباً ${fullName}،` : "مرحباً،"}
      </Text>
      <Text style={text}>
        نودّ تذكيرك بأنّ اشتراكك في <strong>{SITE_NAME}</strong> (باقة <strong>{planLabel}</strong>)
        {isUrgent ? " سينتهي خلال أقل من 24 ساعة." : ` سينتهي خلال ${daysRemaining} أيام.`}
      </Text>
      {expiresAt && (
        <InfoCard variant="warning">
          <Text style={infoRow}><strong>تاريخ الانتهاء:</strong> {expiresAt}</Text>
        </InfoCard>
      )}
      <Text style={text}>
        لتجنّب أي انقطاع في الخدمة وفقدان الوصول لميزات الباقة، نوصي بتجديد اشتراكك الآن.
      </Text>
      <div style={{ textAlign: "center", margin: `${spacing.lg} 0` }}>
        <PrimaryButton href={renewUrl}>جدّد الاشتراك الآن</PrimaryButton>
      </div>
      <Text style={muted}>
        إن كنت قد جدّدت اشتراكك بالفعل، يمكنك تجاهل هذه الرسالة.
        <br />
        فريق {SITE_NAME}
      </Text>
    </EmailLayout>
  );
};

export const template = {
  component: SubscriptionExpiringEmail,
  subject: (data: Record<string, any>) => {
    const days = Number(data?.daysRemaining ?? 7);
    return days <= 1
      ? `⏰ اشتراكك في ${SITE_NAME} ينتهي خلال 24 ساعة`
      : `🔔 اشتراكك في ${SITE_NAME} ينتهي خلال ${days} أيام`;
  },
  displayName: "تذكير قرب انتهاء الاشتراك",
  previewData: {
    fullName: "محمد",
    planLabel: "احترافي",
    daysRemaining: 7,
    expiresAt: "25 أبريل 2026",
  },
} satisfies TemplateEntry;

const h1 = { fontSize: "24px", fontWeight: 700, color: brand.primary, margin: `0 0 ${spacing.md}`, fontFamily };
const h1Urgent = { fontSize: "24px", fontWeight: 700, color: brand.danger, margin: `0 0 ${spacing.md}`, fontFamily };
const text = { fontSize: "15px", color: brand.textBody, lineHeight: "1.8", margin: `0 0 ${spacing.md}`, fontFamily };
const infoRow = { fontSize: "14px", color: brand.textPrimary, margin: "6px 0", lineHeight: "1.7", fontFamily };
const muted = { fontSize: "13px", color: brand.textMuted, margin: `${spacing.lg} 0 0`, lineHeight: "1.7", fontFamily };
