import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, brand, fontFamily, spacing, SITE_NAME } from "./_shared/layout";
import { PrimaryButton, InfoCard } from "./_shared/components";

interface TipProps {
  fullName?: string;
  onboardingUrl?: string;
}

const OnboardingTipEmail = ({
  fullName,
  onboardingUrl = "https://rifd.site/onboarding",
}: TipProps) => (
  <EmailLayout preview={`خطوة بسيطة لإطلاق إمكانيات ${SITE_NAME} بالكامل`}>
    <Heading style={h1}>
      {fullName ? `${fullName}، مازلت معنا؟` : "مازلت معنا؟"}
    </Heading>
    <Text style={text}>
      لاحظنا أنّك سجّلت في <strong>{SITE_NAME}</strong> قبل ٣ أيام، لكن لم تكمل بعد إعداد ملف متجرك. الإعداد يستغرق دقيقة واحدة، وبعده تصبح النتائج أدقّ وأقرب لطابع متجرك.
    </Text>
    <InfoCard variant="warning">
      <Text style={tip}>
        💡 <strong>نصيحة:</strong> كلما كان ملف متجرك أوضح (اسم المنتج، الجمهور، نبرة الكلام)، كانت نتائج التوليد أكثر احترافية.
      </Text>
    </InfoCard>
    <div style={{ textAlign: "center", margin: `${spacing.lg} 0` }}>
      <PrimaryButton href={onboardingUrl}>أكمل الإعداد الآن</PrimaryButton>
    </div>
    <Text style={muted}>
      نحن هنا لمساعدتك متى احتجت — فريق {SITE_NAME}
    </Text>
  </EmailLayout>
);

export const template = {
  component: OnboardingTipEmail,
  subject: `أكمل إعداد متجرك في ${SITE_NAME} 💡`,
  displayName: "تذكير إكمال الإعداد",
  previewData: { fullName: "محمد" },
} satisfies TemplateEntry;

const h1 = { fontSize: "24px", fontWeight: 700, color: brand.primary, margin: `0 0 ${spacing.md}`, fontFamily };
const text = { fontSize: "15px", color: brand.textBody, lineHeight: "1.8", margin: `0 0 ${spacing.md}`, fontFamily };
const tip = { fontSize: "14px", color: brand.textBody, margin: 0, lineHeight: "1.7", fontFamily };
const muted = { fontSize: "13px", color: brand.textMuted, margin: `${spacing.lg} 0 0`, lineHeight: "1.7", fontFamily };
