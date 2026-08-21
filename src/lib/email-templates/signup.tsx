import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";
import { brand, fontFamily } from "./_shared/theme";

interface SignupEmailProps {
  siteName: string;
  siteUrl: string;
  recipient: string;
  confirmationUrl: string;
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="ar" dir="rtl">
    <Head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap"
        rel="stylesheet"
      />
    </Head>
    <Preview>أكمل تفعيل حسابك في رِفد ✓</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={brandBar}>{siteName}</div>
        <Heading style={h1}>تأكيد البريد الإلكتروني</Heading>
        <Text style={text}>
          أهلاً بك في{" "}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>{" "}
          — منصّتك لإنشاء محتوى تسويقي احترافي بالذكاء الاصطناعي.
        </Text>
        <Text style={text}>
          لإكمال تفعيل حسابك ({recipient})، اضغط الزر أدناه:
        </Text>
        <div style={{ textAlign: "center", margin: "32px 0" }}>
          <Button style={button} href={confirmationUrl}>
            تفعيل الحساب
          </Button>
        </div>
        <Text style={hint}>
          إذا لم تنشئ هذا الحساب، يمكنك تجاهل هذه الرسالة بأمان.
        </Text>
        <Text style={footer}>
          فريق رِفد — رفيقك الذكي للمحتوى التسويقي
        </Text>
      </Container>
    </Body>
  </Html>
);

export default SignupEmail;

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
const link = { color: brand.primary, textDecoration: "underline" };
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
const hint = {
  fontSize: "13px",
  color: brand.textMuted,
  margin: "24px 0 0",
};
const footer = {
  fontSize: "12px",
  color: brand.textSubtle,
  margin: "32px 0 0",
  textAlign: "center" as const,
  borderTop: `1px solid ${brand.borderLight}`,
  paddingTop: "16px",
};
