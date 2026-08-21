import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../theme";

type OutputTone = "image" | "copy" | "reel";

const TONE_META: Record<OutputTone, { label: string; tint: string; text: string }> = {
  image: { label: "مخرج بصري", tint: `${COLORS.gold}20`, text: COLORS.gold },
  copy: { label: "مخرج نصي", tint: `${COLORS.greenGlow}18`, text: COLORS.greenDeep },
  reel: { label: "مخرج حملة", tint: `${COLORS.green}12`, text: COLORS.green },
};

export const Scene4OutputCard: React.FC<{
  body: string;
  index: number;
  title: string;
  tone: OutputTone;
}> = ({ body, index, title, tone }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delay = 66 + index * 9;
  const reveal = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 180 } });
  const meta = TONE_META[tone];

  return (
    <div
      style={{
        minHeight: 220,
        borderRadius: 24,
        background: COLORS.white,
        border: `2px solid ${meta.text}2a`,
        boxShadow: "0 16px 30px rgba(15,31,24,0.12)",
        padding: 20,
        opacity: reveal,
        transform: `translateY(${interpolate(reveal, [0, 1], [38, 0])}px) scale(${interpolate(reveal, [0, 1], [0.86, 1])})`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div>
        <div
          style={{
            display: "inline-flex",
            padding: "8px 12px",
            borderRadius: 999,
            background: meta.tint,
            color: meta.text,
            fontSize: 17,
            fontWeight: 900,
          }}
        >
          {meta.label}
        </div>
        <div
          style={{
            fontSize: 27,
            fontWeight: 900,
            color: COLORS.ink,
            marginTop: 16,
            lineHeight: 1.25,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 19,
            fontWeight: 500,
            color: COLORS.ink,
            opacity: 0.82,
            marginTop: 12,
            lineHeight: 1.55,
          }}
        >
          {body}
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          padding: "11px 14px",
          borderRadius: 18,
          background: `${COLORS.creamDeep}`,
          color: COLORS.greenDeep,
          fontSize: 17,
          fontWeight: 800,
        }}
      >
        من نفس منطق البيع
      </div>
    </div>
  );
};
