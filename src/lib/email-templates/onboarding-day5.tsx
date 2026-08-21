import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, brand, fontFamily, spacing, SITE_NAME } from "./_shared/layout";
import { PrimaryButton, InfoCard } from "./_shared/components";

interface Day5Props {
  fullName?: string;
  dashboardUrl?: string;
}

const OnboardingDay5Email = ({
  fullName,
  dashboardUrl = "https://rifd.site/dashboard",
}: Day5Props) => (
  <EmailLayout preview={`كيف وفّر متجر "بيت الذوق" 18 ساعة شهرياً مع ${SITE_NAME}`}>
    <Heading style={h1}>
      {fullName ? `${fullName}، شف هذي القصة 👇` : "قصة قد تلهمك 👇"}
    </Heading>
    <Text style={text}>
      <strong>أم خالد</strong> — صاحبة متجر "بيت الذوق" للعبايات في الرياض — كانت تقضي <strong>3 ساعات يومياً</strong> في كتابة محتوى إنستقرام وتيك توك لـ 12 منتج جديد كل أسبوع.
    </Text>
    <InfoCard>
      <Text style={problemTitle}>😩 قبل {SITE_NAME}:</Text>
      <Text style={problemText}>
        • منشورات متشابهة وممّلة<br />
        • تأخّر في إطلاق المنتجات<br />
        • إرهاق وتسويق غير منتظم
      </Text>
    </InfoCard>
    <InfoCard variant="highlight">
      <Text style={solutionTitle}>✨ بعد {SITE_NAME}:</Text>
      <Text style={solutionText}>
        • <strong>18 ساعة موفّرة شهرياً</strong><br />
        • محتوى يومي بنبرة متجرها الخاصة<br />
        • زيادة <strong>34%</strong> في تفاعل الإنستقرام خلال شهر
      </Text>
    </InfoCard>
    <Text style={quote}>
      "صرت أطلق منتج جديد كل يومين بدل أسبوع. رِفد فهم نبرتي بسرعة عجيبة."
      <br />
      <span style={quoteAuthor}>— أم خالد، بيت الذوق</span>
    </Text>
    <div style={{ textAlign: "center", margin: `${spacing.lg} 0` }}>
      <PrimaryButton href={dashboardUrl}>ابدأ قصتك الآن</PrimaryButton>
    </div>
    <Text style={muted}>
      نريد أن نسمع قصتك أيضاً — ردّ على هذه الرسالة وأخبرنا.
      <br />
      فريق {SITE_NAME}
    </Text>
  </EmailLayout>
);

export const template = {
  component: OnboardingDay5Email,
  subject: "كيف وفّرت أم خالد 18 ساعة شهرياً 📈",
  displayName: "Onboarding Day 5 - Social Proof",
  previewData: { fullName: "محمد" },
} satisfies TemplateEntry;

const h1 = { fontSize: "24px", fontWeight: 700, color: brand.primary, margin: `0 0 ${spacing.md}`, fontFamily };
const text = { fontSize: "15px", color: brand.textBody, lineHeight: "1.8", margin: `0 0 ${spacing.md}`, fontFamily };
const problemTitle = { fontSize: "14px", color: brand.danger, fontWeight: 700, margin: `0 0 8px`, fontFamily };
const problemText = { fontSize: "14px", color: brand.textBody, lineHeight: "1.7", margin: 0, fontFamily };
const solutionTitle = { fontSize: "14px", color: brand.primary, fontWeight: 700, margin: `0 0 8px`, fontFamily };
const solutionText = { fontSize: "14px", color: brand.textPrimary, lineHeight: "1.7", margin: 0, fontFamily };
const quote = { fontSize: "15px", color: brand.textPrimary, fontStyle: "italic", lineHeight: "1.8", borderRight: `3px solid ${brand.primary}`, paddingRight: spacing.md, margin: `${spacing.lg} 0`, fontFamily };
const quoteAuthor = { fontSize: "13px", color: brand.textMuted, fontStyle: "normal", fontWeight: 700, fontFamily };
const muted = { fontSize: "13px", color: brand.textMuted, margin: `${spacing.lg} 0 0`, lineHeight: "1.7", fontFamily };
