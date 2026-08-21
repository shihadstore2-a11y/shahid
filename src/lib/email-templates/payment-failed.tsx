import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, brand, fontFamily, spacing, SITE_NAME } from "./_shared/layout";
import { PrimaryButton, InfoCard } from "./_shared/components";

interface FailedProps {
  fullName?: string;
  reason?: string;
  retryUrl?: string;
  supportWhatsapp?: string;
}

const PaymentFailedEmail = ({
  fullName,
  reason = "الإيصال غير واضح أو لا يطابق المبلغ المطلوب.",
  retryUrl = "https://rifd.site/dashboard/billing",
  supportWhatsapp = "https://wa.me/966500000000",
}: FailedProps) => (
  <EmailLayout preview={`نحتاج إلى مراجعة دفعتك في ${SITE_NAME}`}>
    <Heading style={h1}>نحتاج إلى مراجعة دفعتك ⚠️</Heading>
    <Text style={text}>
      {fullName ? `مرحباً ${fullName}،` : "مرحباً،"}
    </Text>
    <Text style={text}>
      للأسف لم نتمكن من تأكيد دفعتك الأخيرة في <strong>{SITE_NAME}</strong>.
    </Text>
    <InfoCard variant="warning">
      <Text style={reasonText}>
        <strong>السبب:</strong> {reason}
      </Text>
    </InfoCard>
    <Text style={text}>
      لا تقلق — حسابك ما زال محفوظاً. يمكنك إعادة رفع إيصال محدّث عبر صفحة الفوترة، وسنعيد المراجعة خلال ساعات قليلة.
    </Text>
    <div style={{ textAlign: "center", margin: `${spacing.lg} 0` }}>
      <PrimaryButton href={retryUrl}>إعادة رفع إيصال الدفع</PrimaryButton>
    </div>
    <Text style={muted}>
      تحتاج مساعدة فورية؟ تواصل معنا عبر{" "}
      <a href={supportWhatsapp} style={{ color: brand.primary, textDecoration: "underline" }}>
        واتساب الدعم
      </a>
      .
      <br />
      فريق {SITE_NAME}
    </Text>
  </EmailLayout>
);

export const template = {
  component: PaymentFailedEmail,
  subject: `⚠️ نحتاج إلى مراجعة دفعتك في ${SITE_NAME}`,
  displayName: "فشل/رفض الدفع",
  previewData: {
    fullName: "محمد",
    reason: "الإيصال غير واضح أو لا يطابق المبلغ المطلوب.",
  },
} satisfies TemplateEntry;

const h1 = { fontSize: "24px", fontWeight: 700, color: brand.warning, margin: `0 0 ${spacing.md}`, fontFamily };
const text = { fontSize: "15px", color: brand.textBody, lineHeight: "1.8", margin: `0 0 ${spacing.md}`, fontFamily };
const reasonText = { fontSize: "14px", color: brand.textPrimary, margin: 0, lineHeight: "1.7", fontFamily };
const muted = { fontSize: "13px", color: brand.textMuted, margin: `${spacing.lg} 0 0`, lineHeight: "1.7", fontFamily };
