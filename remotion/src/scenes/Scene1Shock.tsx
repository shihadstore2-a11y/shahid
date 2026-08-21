import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Tajawal";
import { COLORS } from "../theme";

const { fontFamily } = loadFont("normal", { weights: ["700", "900"], subsets: ["arabic"] });

/**
 * Scene 1 — SHOCK (75 frames, 2.5s)
 * "5 ساعات كل أسبوع؟" — full-screen, red, spinning clock, scale-burst.
 */
export const Scene1Shock: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Big punchy entrance
  const burst = spring({ frame, fps, config: { damping: 9, stiffness: 180 } });
  const titleScale = interpolate(burst, [0, 1], [0.4, 1]);
  // Camera zoom-in throughout the scene
  const camera = interpolate(frame, [0, 75], [1, 1.08]);
  // Clock hand spin (fast)
  const handAngle = (frame * 18) % 360;
  // Pulse the red glow
  const pulse = 1 + Math.sin(frame * 0.4) * 0.08;
  // Sub appears later
  const subIn = spring({ frame: frame - 30, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill
      style={{
        fontFamily,
        direction: "rtl",
        alignItems: "center",
        justifyContent: "center",
        padding: 60,
        transform: `scale(${camera})`,
      }}
    >
      {/* Red shock vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(80% 60% at 50% 50%, ${COLORS.red}30 0%, transparent 75%)`,
          opacity: pulse * 0.8,
        }}
      />

      <div style={{ textAlign: "center", position: "relative" }}>
        {/* Spinning clock */}
        <div
          style={{
            width: 160,
            height: 160,
            borderRadius: "50%",
            border: `8px solid ${COLORS.red}`,
            margin: "0 auto 40px",
            position: "relative",
            background: COLORS.cream,
            boxShadow: `0 0 60px ${COLORS.red}80`,
            transform: `scale(${titleScale})`,
          }}
        >
          {/* Hour hand (fast = panic) */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 6,
              height: 56,
              background: COLORS.ink,
              borderRadius: 4,
              transformOrigin: "50% 100%",
              transform: `translate(-50%, -100%) rotate(${handAngle}deg)`,
            }}
          />
          {/* Minute hand */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 4,
              height: 70,
              background: COLORS.red,
              borderRadius: 4,
              transformOrigin: "50% 100%",
              transform: `translate(-50%, -100%) rotate(${handAngle * 3}deg)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 16,
              height: 16,
              background: COLORS.red,
              borderRadius: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />
        </div>

        <div
          style={{
            fontSize: 168,
            fontWeight: 900,
            color: COLORS.red,
            lineHeight: 1,
            transform: `scale(${titleScale})`,
            textShadow: `0 8px 30px ${COLORS.red}60`,
          }}
        >
          5 ساعات كل أسبوع؟
        </div>

        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: COLORS.ink,
            marginTop: 32,
            opacity: subIn,
            transform: `translateY(${interpolate(subIn, [0, 1], [20, 0])}px)`,
          }}
        >
          تكتب محتوى متجرك كل أسبوع؟
        </div>
      </div>
    </AbsoluteFill>
  );
};
