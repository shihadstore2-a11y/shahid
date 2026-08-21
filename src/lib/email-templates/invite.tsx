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

interface InviteEmailProps {
  siteName: string;
  siteUrl: string;
  confirmationUrl: string;
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="ar" dir="rtl">
    <Head>
      <meta charSet="utf-8" />
      <link
        href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap"
        rel="stylesheet"
      />
    </Head>
    <Preview>دعوة للانضمام إلى {siteName} 🎉</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={brandBar}>{siteName}</div>
        <Heading style={h1}>تمت دعوتك للانضمام 🎉</Heading>
        <Text style={text}>
          تم دعوتك للانضمام إلى{" "}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>{" "}
          — منصة عربية ذكية لإنشاء محتوى تسويقي احترافي. اضغط الزر أدناه لقبول
          الدعوة وإنشاء حسابك الآن.
        </Text>
        <div style={{ textAlign: "center", margin: "32px 0" }}>
          <Button style={button} href={confirmationUrl}>
            قبول الدعوة
          </Button>
        </div>
        <Text style={hint}>
          إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذه الرسالة بأمان.
        </Text>
        <Text style={footer}>فريق رِفد — أهلاً بك معنا</Text>
      </Container>
    </Body>
  </Html>
);

export default InviteEmail;

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
