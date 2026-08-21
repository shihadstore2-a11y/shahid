import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Tajawal";
import { COLORS } from "../theme";

const { fontFamily } = loadFont("normal", { weights: ["400", "700", "900"], subsets: ["arabic"] });

/**
 * Scene 2 — PAIN (60 frames, 2s)
 * Stack of fake ChatGPT posts falling, each rejected with red X.
 */
const FAKE_POSTS = [
  "اكتشفي فخامة ما لها مثيل مع عرضنا الجديد ✨",
  "اطلب الآن قبل نفاد الكمية واستفد من أفضل سعر",
  "منتجات مميزة تناسب جميع الأذواق وبجودة عالية",
  "نص عام يقدر ينحط على أي متجر بدون فرق واضح",
  "لا زاوية بيع، لا هوية، ولا سبب شراء حقيقي",
];

const PostCard: React.FC<{ index: number; text: string }> = ({ index, text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delay = 4 + index * 6;

  const dropIn = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 140 } });
  const fall = interpolate(frame - delay - 20, [0, 30], [0, 800], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rotate = interpolate(frame - delay - 20, [0, 30], [0, index % 2 ? 25 : -25], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fade = interpolate(frame - delay - 25, [0, 15], [1, 0.3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const xShown = spring({ frame: frame - delay - 12, fps, config: { damping: 9, stiffness: 200 } });

  return (
    <div
      style={{
        background: COLORS.white,
        borderRadius: 20,
        padding: "24px 28px",
        boxShadow: "0 12px 30px rgba(15,31,24,0.15)",
        border: `2px solid ${COLORS.red}30`,
        opacity: dropIn * fade,
        transform: `translateY(${interpolate(dropIn, [0, 1], [-60, 0]) + fall}px) rotate(${rotate}deg) scale(${interpolate(dropIn, [0, 1], [0.85, 1])})`,
        position: "relative",
        marginBottom: 18,
      }}
    >
      <div
        style={{ fontSize: 26, fontWeight: 400, color: COLORS.ink, opacity: 0.85, lineHeight: 1.5 }}
      >
        {text}
      </div>
      {/* Red X stamp */}
      <div
        style={{
          position: "absolute",
          top: -22,
          left: -22,
          width: 76,
          height: 76,
          borderRadius: "50%",
          background: COLORS.red,
          color: COLORS.white,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 50,
          fontWeight: 900,
          transform: `scale(${xShown}) rotate(-15deg)`,
          boxShadow: `0 6px 20px ${COLORS.red}80`,
        }}
      >
        ✕
      </div>
    </div>
  );
};

export const Scene2Pain: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleIn = spring({ frame, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill
      style={{
        fontFamily,
        direction: "rtl",
        padding: "70px 60px",
      }}
    >
      <div
        style={{
          fontSize: 64,
          fontWeight: 900,
          color: COLORS.ink,
          textAlign: "center",
          marginBottom: 30,
          opacity: titleIn,
          transform: `translateY(${interpolate(titleIn, [0, 1], [-30, 0])}px)`,
        }}
      >
        وتطلع النتيجة عامة؟
      </div>

      <div style={{ position: "relative" }}>
        {FAKE_POSTS.map((text, i) => (
          <PostCard key={i} index={i} text={text} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
