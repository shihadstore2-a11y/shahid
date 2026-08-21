import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, brand, fontFamily, spacing, SITE_NAME } from "./_shared/layout";
import { PrimaryButton, SecondaryButton, InfoCard, Stat } from "./_shared/components";

interface QuotaWarnProps {
  fullName?: string;
  kindLabel?: string;
  used?: number;
  limit?: number;
  upgradeUrl?: string;
  dashboardUrl?: string;
}

const QuotaWarning80Email = ({
  fullName,
  kindLabel = "النصوص",
  used = 80,
  limit = 100,
  upgradeUrl = "https://rifd.site/pricing",
  dashboardUrl = "https://rifd.site/dashboard/usage",
}: QuotaWarnProps) => {
  const pct = Math.round((used / Math.max(limit, 1)) * 100);
  return (
    <EmailLayout preview={`استخدمت ${pct}% من حصة ${kindLabel} هذا الشهر`}>
      <Heading style={h1}>اقتربت من نهاية حصتك ⚡</Heading>
      <Text style={text}>
        {fullName ? `مرحباً ${fullName}،` : "مرحباً،"}
      </Text>
      <Text style={text}>
        وصلت إلى <strong>{pct}%</strong> من حصة <strong>{kindLabel}</strong> الشهرية في <strong>{SITE_NAME}</strong>.
      </Text>
      <InfoCard variant="warning">
        <Stat label={`من أصل ${limit} ${kindLabel}`} value={`${used}`} highlight />
      </InfoCard>
      <Text style={text}>
        لتجنّب التوقف عند الحاجة، يمكنك ترقية باقتك الآن والاستفادة من حصة أكبر بدون انتظار بداية الشهر القادم.
      </Text>
      <div style={{ textAlign: "center", margin: `${spacing.lg} 0` }}>
        <PrimaryButton href={upgradeUrl}>رقّ خطتك الآن</PrimaryButton>
      </div>
      <div style={{ textAlign: "center", margin: `${spacing.md} 0` }}>
        <SecondaryButton href={dashboardUrl}>عرض استهلاكي</SecondaryButton>
      </div>
      <Text style={muted}>
        فريق {SITE_NAME}
      </Text>
    </EmailLayout>
  );
};

export const template = {
  component: QuotaWarning80Email,
  subject: (data: Record<string, any>) =>
    `⚡ اقتربت من نهاية حصتك في ${SITE_NAME} (${data?.used ?? 80}/${data?.limit ?? 100})`,
  displayName: "تحذير حصة 80%",
  previewData: { fullName: "محمد", kindLabel: "النصوص", used: 80, limit: 100 },
} satisfies TemplateEntry;

const h1 = { fontSize: "24px", fontWeight: 700, color: brand.warning, margin: `0 0 ${spacing.md}`, fontFamily };
const text = { fontSize: "15px", color: brand.textBody, lineHeight: "1.8", margin: `0 0 ${spacing.md}`, fontFamily };
const muted = { fontSize: "13px", color: brand.textMuted, margin: `${spacing.lg} 0 0`, lineHeight: "1.7", fontFamily };
