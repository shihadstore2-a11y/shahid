import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Tajawal";
import { COLORS } from "../theme";

const { fontFamily } = loadFont("normal", { weights: ["900"], subsets: ["arabic"] });

/**
 * Scene 3 — LOGO STAMP (45 frames, 1.5s)
 * Big gold "رِفد" stamp slams down on cream — the brand reveal.
 */
export const Scene3LogoStamp: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Stamp slam — gentler so it stays in frame
  const slam = spring({ frame, fps, config: { damping: 11, stiffness: 180, mass: 1 } });
  const scale = interpolate(slam, [0, 1], [1.8, 1]);
  const opacity = interpolate(slam, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });
  const blur = interpolate(slam, [0, 0.5], [12, 0], { extrapolateRight: "clamp" });

  // Shockwave ring
  const ring = interpolate(frame, [10, 35], [0, 1.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ringOpacity = interpolate(frame, [10, 35], [0.7, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Underline sweep
  const underline = interpolate(frame, [18, 38], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        fontFamily,
        direction: "rtl",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Shockwave ring */}
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          border: `6px solid ${COLORS.gold}`,
          opacity: ringOpacity,
          transform: `scale(${ring})`,
        }}
      />

      <div style={{ position: "relative", textAlign: "center" }}>
        <div
          style={{
            fontSize: 320,
            fontWeight: 900,
            color: COLORS.greenDeep,
            lineHeight: 1.4,
            paddingTop: 40,
            transform: `scale(${scale})`,
            opacity,
            filter: `blur(${blur}px)`,
            textShadow: `0 20px 60px ${COLORS.greenDeep}40`,
          }}
        >
          رِفد
        </div>
        {/* Gold underline */}
        <div
          style={{
            height: 14,
            background: `linear-gradient(90deg, ${COLORS.gold}, ${COLORS.goldGlow})`,
            borderRadius: 8,
            marginTop: 12,
            transformOrigin: "right center",
            transform: `scaleX(${underline})`,
            boxShadow: `0 8px 24px ${COLORS.gold}80`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
