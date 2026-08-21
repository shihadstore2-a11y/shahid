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

interface EmailChangeEmailProps {
  siteName: string;
  email: string;
  newEmail: string;
  confirmationUrl: string;
}

export const EmailChangeEmail = ({
  siteName,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="ar" dir="rtl">
    <Head>
      <meta charSet="utf-8" />
      <link
        href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap"
        rel="stylesheet"
      />
    </Head>
    <Preview>تأكيد تغيير البريد الإلكتروني — {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={brandBar}>{siteName}</div>
        <Heading style={h1}>تأكيد تغيير البريد الإلكتروني</Heading>
        <Text style={text}>
          طلبت تغيير البريد الإلكتروني لحسابك في {siteName}:
        </Text>
        <div style={changeBox}>
          <div style={changeRow}>
            <span style={changeLabel}>من:</span>{" "}
            <Link href={`mailto:${email}`} style={link}>
              {email}
            </Link>
          </div>
          <div style={changeRow}>
            <span style={changeLabel}>إلى:</span>{" "}
            <Link href={`mailto:${newEmail}`} style={link}>
              {newEmail}
            </Link>
          </div>
        </div>
        <Text style={text}>اضغط الزر أدناه لتأكيد هذا التغيير:</Text>
        <div style={{ textAlign: "center", margin: "32px 0" }}>
          <Button style={button} href={confirmationUrl}>
            تأكيد التغيير
          </Button>
        </div>
        <Text style={dangerBox}>
          ⚠️ إذا لم تطلب هذا التغيير، يرجى تأمين حسابك فوراً وتغيير كلمة
          المرور.
        </Text>
        <Text style={footer}>فريق رِفد — حسابك تحت حمايتنا</Text>
      </Container>
    </Body>
  </Html>
);

export default EmailChangeEmail;

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
const changeBox = {
  backgroundColor: brand.surface,
  border: `1px solid ${brand.border}`,
  borderRadius: "8px",
  padding: "16px 20px",
  margin: "16px 0",
};
const changeRow = {
  fontSize: "14px",
  color: brand.textBody,
  lineHeight: "2",
};
const changeLabel = {
  fontWeight: 700 as const,
  color: brand.primary,
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
const dangerBox = {
  fontSize: "14px",
  color: brand.danger,
  backgroundColor: "#fdecec",
  border: `1px solid #f5b8b8`,
  borderRadius: "8px",
  padding: "12px 16px",
  margin: "16px 0",
};
const footer = {
  fontSize: "12px",
  color: brand.textSubtle,
  margin: "32px 0 0",
  textAlign: "center" as const,
  borderTop: `1px solid ${brand.borderLight}`,
  paddingTop: "16px",
};
