import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { COLORS } from "../theme";

/**
 * Golden highlight that sweeps in behind text — like a marker stroke.
 * Use as inline-block wrapper around a word or short phrase.
 */
export const GoldHighlight: React.FC<{
  children: React.ReactNode;
  delay?: number;
  duration?: number;
}> = ({ children, delay = 0, duration = 18 }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame - delay, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span
        style={{
          position: "absolute",
          inset: "10% -6% 10% -6%",
          background: `linear-gradient(120deg, ${COLORS.gold}, ${COLORS.goldGlow})`,
          borderRadius: 14,
          transformOrigin: "right center",
          transform: `scaleX(${progress})`,
          zIndex: 0,
          boxShadow: `0 8px 24px ${COLORS.gold}55`,
        }}
      />
      <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
    </span>
  );
};
