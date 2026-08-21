import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, brand, fontFamily, spacing, SITE_NAME } from "./_shared/layout";
import { PrimaryButton, InfoCard } from "./_shared/components";

interface Day0Props {
  fullName?: string;
  storeName?: string;
  generateUrl?: string;
}

const ActivationDay0Email = ({
  fullName,
  storeName,
  generateUrl = "https://rifd.site/dashboard/generate-text",
}: Day0Props) => (
  <EmailLayout preview="متجرك جاهز — أول إعلان احترافي بانتظارك">
    <Heading style={h1}>
      {fullName ? `${fullName}، متجرك جاهز ✨` : "متجرك جاهز ✨"}
    </Heading>
    <Text style={text}>
      أكملت إعداد {storeName ? <strong>{storeName}</strong> : "متجرك"} في{" "}
      <strong>{SITE_NAME}</strong>. الآن نبرة متجرك، جمهورك، وسياسات الشحن
      كلها محفوظة — بقي خطوة واحدة فقط.
    </Text>
    <InfoCard variant="highlight">
      <Text style={cardTitle}>🎯 ابدأ بأقوى أداة:</Text>
      <Text style={listItem}>اكتب نصاً يبيع — منشور كامل بنبرة متجرك في 30 ثانية.</Text>
      <Text style={listItem}>صمّم صورة إعلان — جاهزة لسناب وإنستقرام بضغطة.</Text>
      <Text style={listItem}>ولّد فيديو ترويجي — 10 ثوانٍ تعرّف بمنتجك.</Text>
    </InfoCard>
    <div style={{ textAlign: "center", margin: `${spacing.lg} 0` }}>
      <PrimaryButton href={generateUrl}>ولّد أول إعلان الآن</PrimaryButton>
    </div>
    <Text style={muted}>
      أنت الآن جاهز لتحقيق أول طلب. فريق {SITE_NAME} معك في كل خطوة.
    </Text>
  </EmailLayout>
);

export const template = {
  component: ActivationDay0Email,
  subject: "متجرك جاهز — أول إعلان احترافي بانتظارك ✨",
  displayName: "Activation Day 0",
  previewData: { fullName: "محمد", storeName: "متجر نسائم" },
} satisfies TemplateEntry;

const h1 = { fontSize: "24px", fontWeight: 700, color: brand.primary, margin: `0 0 ${spacing.md}`, fontFamily };
const text = { fontSize: "15px", color: brand.textBody, lineHeight: "1.8", margin: `0 0 ${spacing.md}`, fontFamily };
const cardTitle = { fontSize: "14px", color: brand.primary, fontWeight: 700, margin: `0 0 8px`, fontFamily };
const listItem = { fontSize: "14px", color: brand.textPrimary, margin: "6px 0", lineHeight: "1.7", fontFamily };
const muted = { fontSize: "13px", color: brand.textMuted, margin: `${spacing.lg} 0 0`, lineHeight: "1.7", fontFamily };
