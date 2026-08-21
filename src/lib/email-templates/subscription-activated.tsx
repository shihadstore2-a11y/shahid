import * as React from "react";
import { Heading, Text, Link } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, brand, fontFamily, spacing, SITE_NAME } from "./_shared/layout";
import { PrimaryButton, InfoCard } from "./_shared/components";

interface SubscriptionActivatedProps {
  fullName?: string;
  planLabel?: string;
  billingCycleLabel?: string;
  activatedUntil?: string;
  invoiceUrl?: string;
  dashboardUrl?: string;
}

const SubscriptionActivatedEmail = ({
  fullName,
  planLabel = "احترافي",
  billingCycleLabel = "شهري",
  activatedUntil,
  invoiceUrl,
  dashboardUrl = "https://rifd.site/dashboard/billing",
}: SubscriptionActivatedProps) => (
  <EmailLayout preview={`تم تفعيل اشتراكك في ${SITE_NAME} بنجاح 🎉`}>
    <Heading style={h1}>
      {fullName ? `أهلاً ${fullName} 🎉` : "مرحباً بك 🎉"}
    </Heading>
    <Text style={text}>
      سعيدون بإخبارك أنّ اشتراكك في <strong>{SITE_NAME}</strong> تم تفعيله بنجاح، وأصبح حسابك جاهزاً للاستخدام الكامل.
    </Text>
    <InfoCard variant="highlight">
      <Text style={infoRow}><strong>الباقة:</strong> {planLabel}</Text>
      <Text style={infoRow}><strong>دورة الفوترة:</strong> {billingCycleLabel}</Text>
      {activatedUntil && (
        <Text style={infoRow}><strong>سارٍ حتى:</strong> {activatedUntil}</Text>
      )}
    </InfoCard>
    <div style={{ textAlign: "center", margin: `${spacing.lg} 0` }}>
      <PrimaryButton href={dashboardUrl}>افتح لوحة التحكم</PrimaryButton>
    </div>
    {invoiceUrl && (
      <Text style={text}>
        يمكنك تنزيل فاتورتك من{" "}
        <Link href={invoiceUrl} style={{ color: brand.primary, textDecoration: "underline" }}>هنا</Link>.
      </Text>
    )}
    <Text style={muted}>
      إن كان لديك أي استفسار، فقط أجب على هذه الرسالة وسنردّ عليك.
      <br />
      فريق {SITE_NAME}
    </Text>
  </EmailLayout>
);

export const template = {
  component: SubscriptionActivatedEmail,
  subject: `🎉 تم تفعيل اشتراكك في ${SITE_NAME}`,
  displayName: "تفعيل الاشتراك",
  previewData: {
    fullName: "محمد",
    planLabel: "احترافي",
    billingCycleLabel: "شهري",
    activatedUntil: "18 مايو 2026",
    invoiceUrl: "https://rifd.site/dashboard/billing",
  },
} satisfies TemplateEntry;

const h1 = { fontSize: "24px", fontWeight: 700, color: brand.primary, margin: `0 0 ${spacing.md}`, fontFamily };
const text = { fontSize: "15px", color: brand.textBody, lineHeight: "1.8", margin: `0 0 ${spacing.md}`, fontFamily };
const infoRow = { fontSize: "14px", color: brand.textPrimary, margin: "6px 0", lineHeight: "1.7", fontFamily };
const muted = { fontSize: "13px", color: brand.textMuted, margin: `${spacing.lg} 0 0`, lineHeight: "1.7", fontFamily };
