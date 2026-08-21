import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, brand, fontFamily, spacing, SITE_NAME } from "./_shared/layout";
import { InfoCard } from "./_shared/components";

interface ContactConfirmationProps {
  fullName?: string;
  subject?: string;
  message?: string;
}

const ContactConfirmationEmail = ({
  fullName,
  subject,
  message,
}: ContactConfirmationProps) => (
  <EmailLayout preview={`استلمنا رسالتك في ${SITE_NAME} — سنرد قريباً`}>
    <Heading style={h1}>
      {fullName ? `شكراً ${fullName} 🙏` : "شكراً لتواصلك 🙏"}
    </Heading>
    <Text style={text}>
      استلمنا رسالتك بنجاح. يردّ فريق <strong>{SITE_NAME}</strong> عادةً
      خلال 4 ساعات عمل (السبت–الخميس 9 ص – 12 ص بتوقيت الرياض).
    </Text>
    {(subject || message) && (
      <InfoCard variant="default">
        {subject && (
          <Text style={listItem}>
            <strong>الموضوع: </strong>
            {subject}
          </Text>
        )}
        {message && (
          <Text style={{ ...listItem, whiteSpace: "pre-wrap" }}>
            <strong>رسالتك: </strong>
            {message}
          </Text>
        )}
      </InfoCard>
    )}
    <Text style={muted}>
      للاستعجال يمكنك مراسلتنا واتساب على{" "}
      <a href="https://wa.me/966582286215" style={{ color: brand.primary }}>
        +966 58 228 6215
      </a>
      .
      <br />
      فريق {SITE_NAME}
    </Text>
  </EmailLayout>
);

export const template = {
  component: ContactConfirmationEmail,
  subject: `استلمنا رسالتك — ${SITE_NAME}`,
  displayName: "تأكيد استلام رسالة تواصل",
  previewData: {
    fullName: "محمد",
    subject: "استفسار عن باقة الأعمال",
    message: "أرغب بمعرفة المزيد عن خصائص باقة الأعمال السنوية.",
  },
} satisfies TemplateEntry;

const h1 = { fontSize: "24px", fontWeight: 700, color: brand.primary, margin: `0 0 ${spacing.md}`, fontFamily };
const text = { fontSize: "15px", color: brand.textBody, lineHeight: "1.8", margin: `0 0 ${spacing.md}`, fontFamily };
const listItem = { fontSize: "14px", color: brand.textPrimary, margin: "8px 0", lineHeight: "1.7", fontFamily };
const muted = { fontSize: "13px", color: brand.textMuted, margin: `${spacing.lg} 0 0`, lineHeight: "1.7", fontFamily };
