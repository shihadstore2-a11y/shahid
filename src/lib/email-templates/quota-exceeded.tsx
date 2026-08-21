import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, brand, fontFamily, spacing, SITE_NAME } from "./_shared/layout";
import { PrimaryButton, SecondaryButton, InfoCard, Stat } from "./_shared/components";

interface QuotaExceededProps {
  fullName?: string;
  kindLabel?: string;
  limit?: number;
  upgradeUrl?: string;
  resetDate?: string;
}

const QuotaExceededEmail = ({
  fullName,
  kindLabel = "النصوص",
  limit = 100,
  upgradeUrl = "https://rifd.site/pricing",
  resetDate = "بداية الشهر القادم",
}: QuotaExceededProps) => (
  <EmailLayout preview={`استنفدت حصة ${kindLabel} الشهرية في ${SITE_NAME}`}>
    <Heading style={h1}>وصلت إلى الحد الشهري 🛑</Heading>
    <Text style={text}>
      {fullName ? `مرحباً ${fullName}،` : "مرحباً،"}
    </Text>
    <Text style={text}>
      استخدمت كامل حصة <strong>{kindLabel}</strong> الشهرية ({limit}). يمكنك متابعة العمل بإحدى طريقتين:
    </Text>
    <InfoCard variant="highlight">
      <Stat label={`${kindLabel} المستخدمة`} value={`${limit}/${limit}`} highlight />
    </InfoCard>
    <Text style={text}>
      <strong>الخيار الأسرع:</strong> ترقية خطتك للحصول على حصة أكبر فوراً.
      <br />
      <strong>الخيار المجاني:</strong> الانتظار حتى <strong>{resetDate}</strong> لإعادة تعيين العدّاد.
    </Text>
    <div style={{ textAlign: "center", margin: `${spacing.lg} 0` }}>
      <PrimaryButton href={upgradeUrl}>رقّ الآن لاستئناف العمل</PrimaryButton>
    </div>
    <div style={{ textAlign: "center", margin: `${spacing.md} 0` }}>
      <SecondaryButton href="https://rifd.site/dashboard/usage">تفاصيل الاستهلاك</SecondaryButton>
    </div>
    <Text style={muted}>
      فريق {SITE_NAME}
    </Text>
  </EmailLayout>
);

export const template = {
  component: QuotaExceededEmail,
  subject: `🛑 استنفدت حصتك الشهرية في ${SITE_NAME}`,
  displayName: "تجاوز الحصة",
  previewData: { fullName: "محمد", kindLabel: "النصوص", limit: 100, resetDate: "1 مايو 2026" },
} satisfies TemplateEntry;

const h1 = { fontSize: "24px", fontWeight: 700, color: brand.danger, margin: `0 0 ${spacing.md}`, fontFamily };
const text = { fontSize: "15px", color: brand.textBody, lineHeight: "1.8", margin: `0 0 ${spacing.md}`, fontFamily };
const muted = { fontSize: "13px", color: brand.textMuted, margin: `${spacing.lg} 0 0`, lineHeight: "1.7", fontFamily };
