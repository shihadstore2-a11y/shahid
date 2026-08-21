import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Tajawal";
import { InstantImagePreview } from "../components/InstantImagePreview";
import { Scene4OutputCard } from "../components/Scene4OutputCard";
import { COLORS } from "../theme";

const { fontFamily } = loadFont("normal", { weights: ["400", "700", "900"], subsets: ["arabic"] });

const OUTPUT_CARDS: Array<{ title: string; body: string; tone: "copy" | "image" | "reel" }> = [
  {
    title: "النسخة الرئيسية",
    body: "افتتاحية بيع واضحة + وعد مباشر + CTA متزن يليق بجمهور العطور.",
    tone: "copy",
  },
  {
    title: "3 هوكات بديلة",
    body: "بدائل سريعة لنفس الحملة بدل العودة للصفر في كل محاولة نشر.",
    tone: "copy",
  },
  {
    title: "الصورة فوراً",
    body: "معاينة بصرية أولية من نفس الوصف لتخرج زاوية الإعلان بشكل مرئي لحظياً.",
    tone: "image",
  },
  {
    title: "فكرة Reel",
    body: "افتتاحية + تسلسل لقطات + إغلاق بيعي من نفس المنطق الإعلاني.",
    tone: "reel",
  },
];

const INPUT_PROMPT = [
  "عطر نسائي بثبات واضح",
  "نبرة راقية غير مترجمة",
  "أنشئ صورة إعلان فوراً مع CTA خفيف",
];

export const Scene4Magic: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const inputIn = spring({ frame, fps, config: { damping: 14 } });
  const packIn = spring({ frame: frame - 22, fps, config: { damping: 12, stiffness: 160 } });
  const titleIn = spring({ frame: frame - 40, fps, config: { damping: 14 } });
  const badgeIn = spring({ frame: frame - 70, fps, config: { damping: 15 } });
  const drift = interpolate(frame, [70, 180], [0, -20], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        fontFamily,
        direction: "rtl",
        padding: "48px 38px 34px",
      }}
    >
      <div
        style={{
          borderRadius: 30,
          background: COLORS.white,
          border: `3px solid ${COLORS.greenGlow}40`,
          boxShadow: "0 18px 36px rgba(15,31,24,0.12)",
          padding: 30,
          opacity: inputIn,
          transform: `translateY(${interpolate(inputIn, [0, 1], [-42, 0])}px)`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 24,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 21,
                fontWeight: 700,
                color: COLORS.ink,
                opacity: 0.65,
                marginBottom: 10,
              }}
            >
              المدخل
            </div>
            <div
              style={{ fontSize: 36, fontWeight: 900, color: COLORS.greenDeep, lineHeight: 1.3 }}
            >
              متجر عطور — جمهور نسائي — نبرة راقية
            </div>
          </div>
          <div
            style={{
              borderRadius: 22,
              background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.goldGlow})`,
              color: COLORS.greenDeep,
              padding: "20px 28px",
              fontSize: 26,
              fontWeight: 900,
              boxShadow: `0 10px 28px ${COLORS.gold}66`,
              transform: `scale(${interpolate(packIn, [0, 1], [0.88, 1])})`,
              whiteSpace: "nowrap",
            }}
          >
            يولّد الحزمة ←
          </div>
        </div>
        <div
          style={{
            marginTop: 18,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          {INPUT_PROMPT.map((item) => (
            <div
              key={item}
              style={{
                borderRadius: 999,
                background: `${COLORS.green}10`,
                border: `2px solid ${COLORS.green}18`,
                color: COLORS.greenDeep,
                padding: "10px 16px",
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          textAlign: "center",
          marginTop: 28,
          opacity: titleIn,
          transform: `translateY(${interpolate(titleIn, [0, 1], [24, 0])}px)`,
        }}
      >
        <div style={{ fontSize: 48, fontWeight: 900, color: COLORS.greenDeep, lineHeight: 1.3 }}>
          ليس مجرد نص — بل بداية حملة مترابطة من نفس الطلب
        </div>
      </div>

      <div
        style={{
          marginTop: 28,
          display: "grid",
          gridTemplateColumns: "1.18fr 0.82fr",
          gap: 20,
          alignItems: "start",
          transform: `translateY(${drift}px)`,
        }}
      >
        <InstantImagePreview />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18 }}>
          {OUTPUT_CARDS.map((card, index) => (
            <Scene4OutputCard
              key={card.title}
              index={index}
              title={card.title}
              body={card.body}
              tone={card.tone}
            />
          ))}
        </div>
      </div>

      <div
        style={{
          marginTop: 28,
          display: "flex",
          justifyContent: "center",
          opacity: badgeIn,
          transform: `scale(${interpolate(badgeIn, [0, 1], [0.9, 1])})`,
        }}
      >
        <div
          style={{
            borderRadius: 999,
            background: `${COLORS.green}14`,
            color: COLORS.greenDeep,
            padding: "16px 28px",
            fontSize: 24,
            fontWeight: 800,
            border: `2px solid ${COLORS.green}24`,
          }}
        >
          مدخل واحد ← نص + صورة تُنشأ فوراً + Reel + CTA ضمن نفس منطق البيع
        </div>
      </div>
    </AbsoluteFill>
  );
};
