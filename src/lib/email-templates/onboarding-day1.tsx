import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, brand, fontFamily, spacing, SITE_NAME } from "./_shared/layout";
import { PrimaryButton, InfoCard } from "./_shared/components";

interface Day1Props {
  fullName?: string;
  generateUrl?: string;
}

const OnboardingDay1Email = ({
  fullName,
  generateUrl = "https://rifd.site/dashboard/generate-text",
}: Day1Props) => (
  <EmailLayout preview="أول منشور احترافي في 60 ثانية — جرّبه الآن">
    <Heading style={h1}>
      {fullName ? `${fullName}، خلّينا نبدأ 🚀` : "خلّينا نبدأ 🚀"}
    </Heading>
    <Text style={text}>
      أمس انضممت لـ <strong>{SITE_NAME}</strong>. اليوم نبسّط لك الخطوة
      الأولى: <strong>أول منشور احترافي لمتجرك في أقل من دقيقة.</strong>
    </Text>
    <InfoCard variant="highlight">
      <Text style={cardTitle}>📝 جرّب هذا القالب الجاهز:</Text>
      <Text style={quote}>
        "اكتب لي منشور إنستقرام لإطلاق منتج جديد بأسلوب جذّاب، مع 3 هاشتاقات سعودية."
      </Text>
    </InfoCard>
    <Text style={text}>
      انسخه، الصقه في رِفد، واضغط "توليد" — وستحصل على منشور كامل بنبرة متجرك خلال ثوانٍ.
    </Text>
    <div style={{ textAlign: "center", margin: `${spacing.lg} 0` }}>
      <PrimaryButton href={generateUrl}>ولّد أول منشور الآن</PrimaryButton>
    </div>
    <InfoCard variant="warning">
      <Text style={tip}>
        💡 <strong>نصيحة:</strong> كلما كان وصف منتجك دقيقاً، كانت النتيجة أفضل. أضف الفئة، السعر، والجمهور المستهدف.
      </Text>
    </InfoCard>
    <Text style={muted}>
      أي سؤال؟ ردّ على هذه الرسالة وسنساعدك.
      <br />
      فريق {SITE_NAME}
    </Text>
  </EmailLayout>
);

export const template = {
  component: OnboardingDay1Email,
  subject: "أول منشور احترافي في 60 ثانية ⚡",
  displayName: "Onboarding Day 1",
  previewData: { fullName: "محمد" },
} satisfies TemplateEntry;

const h1 = { fontSize: "24px", fontWeight: 700, color: brand.primary, margin: `0 0 ${spacing.md}`, fontFamily };
const text = { fontSize: "15px", color: brand.textBody, lineHeight: "1.8", margin: `0 0 ${spacing.md}`, fontFamily };
const cardTitle = { fontSize: "14px", color: brand.primary, fontWeight: 700, margin: `0 0 8px`, fontFamily };
const quote = { fontSize: "15px", color: brand.textPrimary, fontStyle: "italic", lineHeight: "1.7", margin: 0, fontFamily };
const tip = { fontSize: "14px", color: brand.textBody, margin: 0, lineHeight: "1.7", fontFamily };
const muted = { fontSize: "13px", color: brand.textMuted, margin: `${spacing.lg} 0 0`, lineHeight: "1.7", fontFamily };
