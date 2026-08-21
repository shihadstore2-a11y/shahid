import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import { brand, fontFamily } from "./_shared/theme";

interface ReauthenticationEmailProps {
  token: string;
}

export const ReauthenticationEmail = ({
  token,
}: ReauthenticationEmailProps) => (
  <Html lang="ar" dir="rtl">
    <Head>
      <meta charSet="utf-8" />
      <link
        href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap"
        rel="stylesheet"
      />
    </Head>
    <Preview>رمز التحقق من رِفد</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={brandBar}>رِفد</div>
        <Heading style={h1}>تأكيد هويتك</Heading>
        <Text style={text}>
          استخدم الرمز أدناه لتأكيد هويتك ومتابعة العملية:
        </Text>
        <div style={codeBox}>
          <span style={codeStyle}>{token}</span>
        </div>
        <Text style={warningBox}>
          ⏱ هذا الرمز صالح لفترة قصيرة فقط — استخدمه فوراً.
        </Text>
        <Text style={hint}>
          إذا لم تطلب هذا الرمز، يمكنك تجاهل هذه الرسالة بأمان ولن يحدث أي
          تغيير على حسابك.
        </Text>
        <Text style={footer}>فريق رِفد — أمان حسابك أولويتنا</Text>
      </Container>
    </Body>
  </Html>
);

export default ReauthenticationEmail;

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
const codeBox = {
  backgroundColor: brand.surface,
  border: `2px dashed ${brand.gold}`,
  borderRadius: "12px",
  padding: "24px",
  margin: "24px 0",
  textAlign: "center" as const,
};
const codeStyle = {
  fontFamily: "Courier, monospace",
  fontSize: "32px",
  fontWeight: 700 as const,
  color: brand.primary,
  letterSpacing: "8px",
};
const warningBox = {
  fontSize: "14px",
  color: brand.warning,
  backgroundColor: "#fff8e6",
  border: `1px solid #f3d98b`,
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
