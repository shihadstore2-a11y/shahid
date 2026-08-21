import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, brand, fontFamily, spacing, SITE_NAME } from "./_shared/layout";
import { PrimaryButton, InfoCard } from "./_shared/components";

interface Day14Props {
  fullName?: string;
  pricingUrl?: string;
}

const ActivationDay14Email = ({
  fullName,
  pricingUrl = "https://rifd.site/pricing",
}: Day14Props) => (
  <EmailLayout preview="50pt مكافأة الإطلاق تنتهي قريباً — لا تفوّتها">
    <Heading style={h1}>
      {fullName ? `${fullName}، 50pt بانتظارك 🎁` : "50pt بانتظارك 🎁"}
    </Heading>
    <Text style={text}>
      مرّ أسبوعان منذ انضمامك لـ <strong>{SITE_NAME}</strong>. مكافأة الإطلاق
      <strong> 50 نقطة فيديو </strong> ما زالت متاحة لك — تُفعَّل تلقائياً
      عند ترقيتك لأي باقة مدفوعة.
    </Text>
    <InfoCard variant="highlight">
      <Text style={cardTitle}>💎 ما الذي تحصل عليه عند الترقية اليوم:</Text>
      <Text style={listItem}>✅ 50pt إضافية لإنتاج 5 فيديوهات جودة عالية.</Text>
      <Text style={listItem}>✅ ضمان 7 أيام استرداد كامل — بلا أسئلة.</Text>
      <Text style={listItem}>✅ سعر الإطلاق ثابت لك ما دمت مشتركاً.</Text>
    </InfoCard>
    <div style={{ textAlign: "center", margin: `${spacing.lg} 0` }}>
      <PrimaryButton href={pricingUrl}>اختر باقتك واحصل على 50pt</PrimaryButton>
    </div>
    <Text style={muted}>
      هذي آخر رسالة تذكير — بعدها سعر الإطلاق قد يتغيّر للمنضمّين الجدد.
      <br />
      فريق {SITE_NAME}
    </Text>
  </EmailLayout>
);

export const template = {
  component: ActivationDay14Email,
  subject: "50pt مكافأة الإطلاق تنتهي قريباً 🎁",
  displayName: "Activation Day 14",
  previewData: { fullName: "محمد" },
} satisfies TemplateEntry;

const h1 = { fontSize: "24px", fontWeight: 700, color: brand.primary, margin: `0 0 ${spacing.md}`, fontFamily };
const text = { fontSize: "15px", color: brand.textBody, lineHeight: "1.8", margin: `0 0 ${spacing.md}`, fontFamily };
const cardTitle = { fontSize: "14px", color: brand.primary, fontWeight: 700, margin: `0 0 8px`, fontFamily };
const listItem = { fontSize: "14px", color: brand.textPrimary, margin: "6px 0", lineHeight: "1.7", fontFamily };
const muted = { fontSize: "13px", color: brand.textMuted, margin: `${spacing.lg} 0 0`, lineHeight: "1.7", fontFamily };
