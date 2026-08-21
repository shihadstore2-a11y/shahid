import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, brand, fontFamily, spacing, SITE_NAME } from "./_shared/layout";
import { PrimaryButton, InfoCard } from "./_shared/components";

interface WelcomeProps {
  fullName?: string;
  dashboardUrl?: string;
}

const WelcomeEmail = ({
  fullName,
  dashboardUrl = "https://rifd.site/dashboard",
}: WelcomeProps) => (
  <EmailLayout preview={`أهلاً بك في ${SITE_NAME} — ابدأ توليد محتوى متجرك الآن`}>
    <Heading style={h1}>
      {fullName ? `أهلاً ${fullName} 👋` : "أهلاً بك 👋"}
    </Heading>
    <Text style={text}>
      سعداء بانضمامك إلى <strong>{SITE_NAME}</strong> — منصة توليد المحتوى
      الذكي لمتاجر التجارة الإلكترونية في السعودية.
    </Text>
    <Text style={text}>إليك خطوات سريعة للبدء:</Text>
    <InfoCard variant="highlight">
      <Text style={listItem}>1️⃣ أكمل ملف متجرك (اسم، فئة، جمهور).</Text>
      <Text style={listItem}>2️⃣ جرّب أول قالب نصي وشاهد النتيجة.</Text>
      <Text style={listItem}>3️⃣ ولّد صورة منتج احترافية بضغطة واحدة.</Text>
    </InfoCard>
    <div style={{ textAlign: "center", margin: `${spacing.lg} 0` }}>
      <PrimaryButton href={dashboardUrl}>ابدأ الآن</PrimaryButton>
    </div>
    <Text style={muted}>
      إن احتجت أي مساعدة، فقط أجب على هذه الرسالة وسنردّ عليك.
      <br />
      فريق {SITE_NAME}
    </Text>
  </EmailLayout>
);

export const template = {
  component: WelcomeEmail,
  subject: `أهلاً بك في ${SITE_NAME} 🎉`,
  displayName: "ترحيب",
  previewData: { fullName: "محمد" },
} satisfies TemplateEntry;

const h1 = { fontSize: "24px", fontWeight: 700, color: brand.primary, margin: `0 0 ${spacing.md}`, fontFamily };
const text = { fontSize: "15px", color: brand.textBody, lineHeight: "1.8", margin: `0 0 ${spacing.md}`, fontFamily };
const listItem = { fontSize: "14px", color: brand.textPrimary, margin: "8px 0", lineHeight: "1.7", fontFamily };
const muted = { fontSize: "13px", color: brand.textMuted, margin: `${spacing.lg} 0 0`, lineHeight: "1.7", fontFamily };
