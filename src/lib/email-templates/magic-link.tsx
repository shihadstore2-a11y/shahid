import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import { brand, fontFamily } from "./_shared/theme";

interface MagicLinkEmailProps {
  siteName: string;
  confirmationUrl: string;
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="ar" dir="rtl">
    <Head>
      <meta charSet="utf-8" />
      <link
        href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap"
        rel="stylesheet"
      />
    </Head>
    <Preview>رابط الدخول السريع إلى {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={brandBar}>{siteName}</div>
        <Heading style={h1}>رابط الدخول السريع ✨</Heading>
        <Text style={text}>
          اضغط الزر أدناه للدخول إلى حسابك في {siteName} مباشرة دون الحاجة
          لكلمة مرور.
        </Text>
        <div style={{ textAlign: "center", margin: "32px 0" }}>
          <Button style={button} href={confirmationUrl}>
            دخول إلى رِفد
          </Button>
        </div>
        <Text style={warningBox}>
          ⏱ صالح لفترة قصيرة فقط — يرجى استخدامه الآن.
        </Text>
        <Text style={hint}>
          إذا لم تطلب هذا الرابط، يمكنك تجاهل هذه الرسالة بأمان.
        </Text>
        <Text style={footer}>فريق رِفد — دخول آمن وسريع</Text>
      </Container>
    </Body>
  </Html>
);

export default MagicLinkEmail;

const main = {
  backgroundColor: brand.bg,
  fontFamily,
  margin: 0,
  padding: "24px 0",
};
const container = {
  maxWidth: "560px",
  margin: "0 auto",
  padding: "32px",
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  border: `1px solid ${brand.border}`,
};
const brandBar = {
  fontSize: "20px",
  fontWeight: 700 as const,
  color: brand.primary,
  textAlign: "center" as const,
  paddingBottom: "20px",
  borderBottom: `2px solid ${brand.gold}`,
  marginBottom: "24px",
};
const h1 = {
  fontSize: "22px",
  fontWeight: 700 as const,
  color: brand.textPrimary,
  margin: "0 0 16px",
  textAlign: "right" as const,
};
const text = {
  fontSize: "15px",
  color: brand.textBody,
  lineHeight: "1.7",
  margin: "0 0 16px",
};
const button = {
  background: `linear-gradient(135deg, ${brand.primary}, ${brand.primaryGlow})`,
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 700 as const,
  borderRadius: "8px",
  padding: "14px 32px",
  textDecoration: "none",
  display: "inline-block",
};
const warningBox = {
  fontSize: "14px",
  color: brand.info,
  backgroundColor: "#e8f1fb",
  border: `1px solid #b8d4ee`,
  borderRadius: "8px",
  padding: "12px 16px",
  margin: "16px 0",
};
const hint = {
  fontSize: "13px",
  color: brand.textMuted,
  margin: "16px 0 0",
};
const footer = {
  fontSize: "12px",
  color: brand.textSubtle,
  margin: "32px 0 0",
  textAlign: "center" as const,
  borderTop: `1px solid ${brand.borderLight}`,
  paddingTop: "16px",
};
