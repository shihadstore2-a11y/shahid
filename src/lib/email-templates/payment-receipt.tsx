import * as React from "react";
import { Heading, Text, Link } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, brand, fontFamily, spacing, SITE_NAME } from "./_shared/layout";
import { PrimaryButton, InfoCard } from "./_shared/components";

interface ReceiptProps {
  fullName?: string;
  invoiceNumber?: string;
  planLabel?: string;
  billingCycleLabel?: string;
  amount?: string;
  paidAt?: string;
  invoiceUrl?: string;
}

const PaymentReceiptEmail = ({
  fullName,
  invoiceNumber = "INV-000000",
  planLabel = "احترافي",
  billingCycleLabel = "سنوي",
  amount = "0 ريال",
  paidAt = "",
  invoiceUrl = "https://rifd.site/dashboard/billing",
}: ReceiptProps) => (
  <EmailLayout preview={`إيصال دفع رقم ${invoiceNumber} من ${SITE_NAME}`}>
    <Heading style={h1}>إيصال الدفع 🧾</Heading>
    <Text style={text}>
      {fullName ? `مرحباً ${fullName}،` : "مرحباً،"}
    </Text>
    <Text style={text}>
      شكراً لاشتراكك في <strong>{SITE_NAME}</strong>. تم استلام الدفع بنجاح. هذا إيصالك الرسمي للاحتفاظ به.
    </Text>
    <InfoCard variant="highlight">
      <Text style={row}><strong>رقم الفاتورة:</strong> {invoiceNumber}</Text>
      <Text style={row}><strong>الباقة:</strong> {planLabel}</Text>
      <Text style={row}><strong>دورة الفوترة:</strong> {billingCycleLabel}</Text>
      <Text style={row}><strong>المبلغ المدفوع:</strong> {amount}</Text>
      {paidAt && <Text style={row}><strong>تاريخ الدفع:</strong> {paidAt}</Text>}
    </InfoCard>
    <div style={{ textAlign: "center", margin: `${spacing.lg} 0` }}>
      <PrimaryButton href={invoiceUrl}>عرض/تنزيل الفاتورة</PrimaryButton>
    </div>
    <Text style={muted}>
      احتفظ بهذا الإيصال لأغراض المحاسبة. لأي استفسار حول الفاتورة، تواصل معنا عبر الرد على هذه الرسالة.
      <br />
      فريق {SITE_NAME}
    </Text>
  </EmailLayout>
);

export const template = {
  component: PaymentReceiptEmail,
  subject: (data: Record<string, any>) =>
    `إيصال دفع ${SITE_NAME} — ${data?.invoiceNumber ?? ""}`.trim(),
  displayName: "إيصال دفع",
  previewData: {
    fullName: "محمد",
    invoiceNumber: "INV-2026-0042",
    planLabel: "احترافي",
    billingCycleLabel: "سنوي",
    amount: "899 ريال",
    paidAt: "21 أبريل 2026",
  },
} satisfies TemplateEntry;

const h1 = { fontSize: "24px", fontWeight: 700, color: brand.primary, margin: `0 0 ${spacing.md}`, fontFamily };
const text = { fontSize: "15px", color: brand.textBody, lineHeight: "1.8", margin: `0 0 ${spacing.md}`, fontFamily };
const row = { fontSize: "14px", color: brand.textPrimary, margin: "6px 0", lineHeight: "1.7", fontFamily };
const muted = { fontSize: "13px", color: brand.textMuted, margin: `${spacing.lg} 0 0`, lineHeight: "1.7", fontFamily };
