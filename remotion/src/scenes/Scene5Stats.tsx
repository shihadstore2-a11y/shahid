import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Tajawal";
import { COLORS } from "../theme";

const { fontFamily } = loadFont("normal", { weights: ["400", "700", "900"], subsets: ["arabic"] });

const STATS = [
  {
    glyph: "صورة",
    value: "1",
    label: "معاينة بصرية فورية",
    note: "تظهر من نفس الوصف بدل انتظار مصمم أو إعادة شرح",
    color: COLORS.gold,
  },
  {
    glyph: "حملة",
    value: "4",
    label: "مخرجات مترابطة",
    note: "نسخة + هوكات + صورة + Reel ضمن نفس المنطق",
    color: COLORS.green,
  },
  {
    glyph: "جاهز",
    value: "1",
    label: "بداية إعلان واضحة",
    note: "أقرب للنشر من نصوص عامة متفرقة",
    color: COLORS.greenDeep,
  },
];

const StatBlock: React.FC<{ index: number; delay: number }> = ({ index, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stat = STATS[index];
  const reveal = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 150 } });

  return (
    <div
      style={{
        opacity: reveal,
        transform: `translateX(${interpolate(reveal, [0, 1], [-90, 0])}px) scale(${interpolate(reveal, [0, 1], [0.86, 1])})`,
        background: COLORS.white,
        borderRadius: 28,
        padding: "32px 38px",
        boxShadow: "0 16px 40px rgba(15,31,24,0.15)",
        border: `3px solid ${stat.color}28`,
        display: "flex",
        alignItems: "center",
        gap: 28,
      }}
    >
      <div
        style={{
          width: 112,
          height: 112,
          borderRadius: 28,
          background: `linear-gradient(135deg, ${stat.color}, ${stat.color}cc)`,
          color: COLORS.cream,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 34,
          fontWeight: 900,
          flexShrink: 0,
          boxShadow: `0 10px 24px ${stat.color}50`,
        }}
      >
        {stat.glyph}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <div style={{ fontSize: 116, fontWeight: 900, color: stat.color, lineHeight: 1 }}>
            {stat.value}
          </div>
          <div style={{ fontSize: 34, fontWeight: 800, color: COLORS.ink }}>{stat.label}</div>
        </div>
        <div
          style={{ fontSize: 26, fontWeight: 500, color: COLORS.ink, opacity: 0.78, marginTop: 10 }}
        >
          {stat.note}
        </div>
      </div>
    </div>
  );
};

export const Scene5Stats: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleIn = spring({ frame, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill
      style={{
        fontFamily,
        direction: "rtl",
        padding: "60px 54px",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontSize: 58,
          fontWeight: 900,
          color: COLORS.greenDeep,
          textAlign: "center",
          marginBottom: 38,
          opacity: titleIn,
          transform: `translateY(${interpolate(titleIn, [0, 1], [-28, 0])}px)`,
        }}
      >
        ما الذي يظهر فوراً بعد كتابة الوصف؟
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <StatBlock index={0} delay={10} />
        <StatBlock index={1} delay={28} />
        <StatBlock index={2} delay={46} />
      </div>
    </AbsoluteFill>
  );
};
