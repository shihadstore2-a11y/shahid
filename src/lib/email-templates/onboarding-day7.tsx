import * as React from "react";
import { Heading, Text, Section } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, brand, fontFamily, spacing, SITE_NAME } from "./_shared/layout";
import { PrimaryButton, InfoCard } from "./_shared/components";

interface Day7Props {
  fullName?: string;
  pricingUrl?: string;
}

const OnboardingDay7Email = ({
  fullName,
  pricingUrl = "https://rifd.site/pricing",
}: Day7Props) => (
  <EmailLayout preview="عرض خاص لك: خصم 20% على خطة Pro لمدة 48 ساعة فقط">
    <Heading style={h1}>
      {fullName ? `${fullName}، عرض خاص لك 🎁` : "عرض خاص لك 🎁"}
    </Heading>
    <Text style={text}>
      مضى أسبوع على انضمامك إلى <strong>{SITE_NAME}</strong>. نتمنى أن تكون قد جرّبت توليد منشورات وصور لمتجرك.
    </Text>
    <Section style={offerBox}>
      <Text style={offerLabel}>عرض لمدة 48 ساعة فقط</Text>
      <Text style={offerHeading}>
        خصم <span style={discount}>20%</span> على خطة Pro
      </Text>
      <Text style={offerSubtext}>
        سقف يومي أعلى للنصوص والصور + نقاط فيديو أكبر للحملات
      </Text>
    </Section>
    <InfoCard variant="highlight">
      <Text style={featureItem}>✅ حتى 600 نص يومياً ضمن سقف حماية عادل</Text>
      <Text style={featureItem}>✅ حتى 100 صورة يومياً تشمل Pro</Text>
      <Text style={featureItem}>✅ 11,000 نقطة فيديو شهرياً</Text>
      <Text style={featureItem}>✅ فيديو سريع واحترافي حتى 8 ثوانٍ حسب النقاط</Text>
      <Text style={featureItem}>✅ قوالب موسمية مناسبة للسوق السعودي</Text>
    </InfoCard>
    <div style={{ textAlign: "center", margin: `${spacing.lg} 0` }}>
      <PrimaryButton href={pricingUrl}>احصل على الخصم الآن</PrimaryButton>
    </div>
    <InfoCard variant="warning">
      <Text style={urgency}>
        ⏰ <strong>ينتهي العرض خلال 48 ساعة</strong> — استخدم الكود{" "}
        <strong style={code}>WELCOME20</strong> عند طلب الاشتراك.
      </Text>
    </InfoCard>
    <Text style={muted}>
      مستمر في الخطة المجانية؟ لا مشكلة — استفد من السقوف اليومية التجريبية، وعند الحاجة للفيديو يمكنك الترقية أو شحن نقاط إضافية.
      <br />
      فريق {SITE_NAME}
    </Text>
  </EmailLayout>
);

export const template = {
  component: OnboardingDay7Email,
  subject: "🎁 خصم 20% على Pro — 48 ساعة فقط",
  displayName: "Onboarding Day 7 - Upgrade",
  previewData: { fullName: "محمد" },
} satisfies TemplateEntry;

const h1 = { fontSize: "24px", fontWeight: 700, color: brand.primary, margin: `0 0 ${spacing.md}`, fontFamily };
const text = { fontSize: "15px", color: brand.textBody, lineHeight: "1.8", margin: `0 0 ${spacing.md}`, fontFamily };
const offerBox = { background: `linear-gradient(135deg, ${brand.primary} 0%, #0f3d28 100%)`, borderRadius: "14px", padding: `${spacing.lg} ${spacing.md}`, margin: `${spacing.lg} 0`, textAlign: "center" as const };
const offerLabel = { fontSize: "12px", color: brand.gold, fontWeight: 700, letterSpacing: "1.5px", margin: "0 0 8px", textTransform: "uppercase" as const, fontFamily };
const offerHeading = { fontSize: "26px", color: "#ffffff", fontWeight: 700, margin: "0 0 8px", fontFamily };
const discount = { fontSize: "34px", color: brand.gold, fontFamily };
const offerSubtext = { fontSize: "14px", color: "#d1fae5", margin: 0, fontFamily };
const featureItem = { fontSize: "14px", color: brand.textPrimary, margin: "8px 0", lineHeight: "1.7", fontFamily };
const urgency = { fontSize: "14px", color: brand.warning, margin: 0, textAlign: "center" as const, fontFamily };
const code = { backgroundColor: "#fef3c7", padding: "2px 8px", borderRadius: "4px", fontFamily: "monospace", color: "#78350f" };
const muted = { fontSize: "13px", color: brand.textMuted, margin: `${spacing.lg} 0 0`, lineHeight: "1.7", fontFamily };
