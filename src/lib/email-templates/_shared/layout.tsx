import * as React from "react";
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { brand, fontFamily, spacing, SITE_NAME, SITE_URL } from "./theme";

interface EmailLayoutProps {
  preview: string;
  children: React.ReactNode;
  hideFooter?: boolean;
}

/**
 * Layout موحّد لكل قوالب البريد:
 *  - Head + خط Tajawal من Google Fonts
 *  - Header مع شعار رِفد
 *  - Body بخلفية بيضاء (متطلب deliverability)
 *  - Container max-width 600px
 *  - Footer مع روابط الموقع والدعم (يمكن إخفاؤه عبر hideFooter)
 *
 * ملاحظة: footer إلغاء الاشتراك يُضاف تلقائياً من قبل بنية Lovable Email
 * — لا تضفه هنا.
 */
export const EmailLayout: React.FC<EmailLayoutProps> = ({
  preview,
  children,
  hideFooter = false,
}) => (
  <Html lang="ar" dir="rtl">
    <Head>
      <meta name="color-scheme" content="light" />
      <meta name="supported-color-schemes" content="light" />
      <link
        href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap"
        rel="stylesheet"
      />
    </Head>
    <Preview>{preview}</Preview>
    <Body
      style={{
        backgroundColor: "#f4f6f5",
        fontFamily,
        margin: 0,
        padding: `${spacing.lg} 0`,
      }}
    >
      <Container
        style={{
          backgroundColor: brand.bg,
          maxWidth: "600px",
          margin: "0 auto",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 2px 12px rgba(26, 93, 62, 0.08)",
        }}
      >
        {/* Header */}
        <Section
          style={{
            backgroundColor: brand.primary,
            padding: `${spacing.lg} ${spacing.lg}`,
            textAlign: "center",
          }}
        >
          <Text
            style={{
              fontSize: "26px",
              fontWeight: "900",
              color: "#ffffff",
              margin: 0,
              fontFamily,
              letterSpacing: "0.5px",
            }}
          >
            {SITE_NAME}
          </Text>
          <Text
            style={{
              fontSize: "12px",
              color: brand.gold,
              margin: "4px 0 0",
              fontFamily,
              letterSpacing: "1px",
            }}
          >
            توليد محتوى متاجرك بالذكاء الاصطناعي
          </Text>
        </Section>

        {/* Content */}
        <Section style={{ padding: `${spacing.xl} ${spacing.lg}` }}>
          {children}
        </Section>

        {/* Footer */}
        {!hideFooter && (
          <Section
            style={{
              backgroundColor: brand.surface,
              padding: `${spacing.md} ${spacing.lg}`,
              textAlign: "center",
              borderTop: `1px solid ${brand.borderLight}`,
            }}
          >
            <Text
              style={{
                fontSize: "12px",
                color: brand.textMuted,
                margin: 0,
                fontFamily,
                lineHeight: "1.7",
              }}
            >
              {SITE_NAME} — منصة سعودية لتوليد محتوى المتاجر الإلكترونية
              <br />
              <a
                href={SITE_URL}
                style={{ color: brand.primary, textDecoration: "none" }}
              >
                rifd.site
              </a>
              {" · "}
              <a
                href={`${SITE_URL}/dashboard`}
                style={{ color: brand.primary, textDecoration: "none" }}
              >
                لوحة التحكم
              </a>
            </Text>
          </Section>
        )}
      </Container>
    </Body>
  </Html>
);

// Re-export common pieces for convenience
export { brand, fontFamily, spacing, SITE_NAME, SITE_URL } from "./theme";
