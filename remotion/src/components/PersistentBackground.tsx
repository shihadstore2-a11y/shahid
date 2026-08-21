import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS } from "../theme";

/**
 * Persistent atmospheric layer: living gradient + drifting gold particles.
 * Sits behind every scene for visual continuity.
 */
const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  size: 6 + ((i * 13) % 18),
  baseX: (i * 71) % 1080,
  baseY: (i * 137) % 1350,
  speed: 0.15 + (i % 7) * 0.04,
  amp: 30 + (i % 5) * 12,
  phase: i * 0.7,
}));

export const PersistentBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / 30;

  // Subtle living gradient — shifts hue position over time
  const gx = 30 + Math.sin(t * 0.2) * 8;
  const gy = 20 + Math.cos(t * 0.15) * 6;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(120% 90% at ${gx}% ${gy}%, ${COLORS.cream} 0%, ${COLORS.creamDeep} 60%, #E5DBC2 100%)`,
        overflow: "hidden",
      }}
    >
      {/* Deep green atmospheric orb */}
      <div
        style={{
          position: "absolute",
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.greenGlow}40 0%, transparent 70%)`,
          left: -250 + Math.sin(t * 0.3) * 50,
          top: -200 + Math.cos(t * 0.25) * 40,
          filter: "blur(60px)",
        }}
      />
      {/* Gold atmospheric orb */}
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.goldGlow}55 0%, transparent 70%)`,
          right: -220 + Math.cos(t * 0.4) * 60,
          bottom: -180 + Math.sin(t * 0.35) * 50,
          filter: "blur(70px)",
        }}
      />

      {/* Floating gold particles — luxe continuity */}
      {PARTICLES.map((p) => {
        const x = p.baseX + Math.sin(t * p.speed + p.phase) * p.amp;
        const y = p.baseY + Math.cos(t * p.speed * 0.8 + p.phase) * p.amp * 0.7;
        const opacity = 0.25 + (Math.sin(t * p.speed * 2 + p.phase) + 1) * 0.15;
        return (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              background: COLORS.gold,
              opacity,
              boxShadow: `0 0 ${p.size * 2}px ${COLORS.goldGlow}`,
            }}
          />
        );
      })}

      {/* Paper grain — luxe finish */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.07,
          background:
            "repeating-radial-gradient(circle at 25% 35%, #00000010 0, #00000010 1px, transparent 1px, transparent 4px)",
          mixBlendMode: "multiply",
        }}
      />
    </AbsoluteFill>
  );
};
