import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../theme";

export const InstantImagePreview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const shellIn = spring({ frame, fps, config: { damping: 16, stiffness: 160 } });
  const progress = interpolate(frame, [18, 64], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const artIn = spring({ frame: frame - 52, fps, config: { damping: 14, stiffness: 170 } });
  const glow = 0.92 + Math.sin(frame * 0.14) * 0.08;
  const shimmer = interpolate(frame, [0, 56], [0.85, 0.2], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        borderRadius: 34,
        background: COLORS.white,
        border: `3px solid ${COLORS.gold}26`,
        boxShadow: "0 22px 48px rgba(15,31,24,0.14)",
        padding: 22,
        minHeight: 520,
        opacity: shellIn,
        transform: `translateY(${interpolate(shellIn, [0, 1], [36, 0])}px) scale(${interpolate(shellIn, [0, 1], [0.92, 1])})`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          {[COLORS.red, COLORS.gold, COLORS.greenGlow].map((color) => (
            <div
              key={color}
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: color,
              }}
            />
          ))}
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.greenDeep }}>
          تجربة الصورة الفورية
        </div>
      </div>

      <div
        style={{
          borderRadius: 26,
          background: `linear-gradient(160deg, ${COLORS.cream} 0%, ${COLORS.creamDeep} 54%, #ead9b3 100%)`,
          border: `2px solid ${COLORS.gold}22`,
          overflow: "hidden",
          position: "relative",
          aspectRatio: "4 / 5",
        }}
      >
        <AbsoluteFill>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(circle at 70% 25%, ${COLORS.goldGlow}66 0%, transparent 38%), radial-gradient(circle at 20% 80%, ${COLORS.greenGlow}22 0%, transparent 42%)`,
              opacity: glow,
            }}
          />

          <div
            style={{
              position: "absolute",
              top: 26,
              right: 24,
              display: "inline-flex",
              padding: "10px 16px",
              borderRadius: 999,
              background: `${COLORS.greenDeep}E8`,
              color: COLORS.cream,
              fontSize: 16,
              fontWeight: 800,
            }}
          >
            عطر ثابت • إطلاق جديد
          </div>

          <div
            style={{
              position: "absolute",
              inset: "118px 30px 118px",
              borderRadius: 26,
              background: `linear-gradient(180deg, ${COLORS.white} 0%, #f7f1e5 100%)`,
              border: `2px solid ${COLORS.gold}20`,
              boxShadow: "0 16px 32px rgba(15,31,24,0.10)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(110deg, transparent 0%, rgba(255,255,255,${shimmer}) 36%, transparent 62%)`,
                transform: `translateX(${interpolate(frame, [0, 56], [180, -220], { extrapolateRight: "clamp" })}px)`,
                opacity: 1 - artIn * 0.88,
              }}
            />

            <div
              style={{
                position: "absolute",
                right: 48,
                top: 72,
                width: 150,
                height: 230,
                borderRadius: "34px 34px 26px 26px",
                background: `linear-gradient(180deg, ${COLORS.greenDeep} 0%, ${COLORS.green} 55%, ${COLORS.greenGlow} 100%)`,
                boxShadow: `0 22px 42px ${COLORS.greenDeep}3d`,
                opacity: artIn,
                transform: `translateY(${interpolate(artIn, [0, 1], [36, 0])}px) scale(${interpolate(artIn, [0, 1], [0.84, 1])})`,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -28,
                  left: 42,
                  width: 66,
                  height: 48,
                  borderRadius: 16,
                  background: `linear-gradient(180deg, ${COLORS.goldGlow}, ${COLORS.gold})`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 18,
                  borderRadius: 24,
                  border: `2px solid ${COLORS.goldGlow}55`,
                }}
              />
            </div>

            <div
              style={{
                position: "absolute",
                left: 34,
                top: 84,
                width: 214,
                opacity: artIn,
                transform: `translateY(${interpolate(artIn, [0, 1], [26, 0])}px)`,
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.green, marginBottom: 10 }}>
                الصورة تُبنى من نفس الوصف
              </div>
              <div
                style={{ fontSize: 40, fontWeight: 900, color: COLORS.greenDeep, lineHeight: 1.2 }}
              >
                ثبات يبان من أول لقطة
              </div>
              <div
                style={{
                  fontSize: 19,
                  fontWeight: 500,
                  color: COLORS.ink,
                  opacity: 0.78,
                  marginTop: 12,
                  lineHeight: 1.5,
                }}
              >
                تكوين بصري أنيق + عرض واضح + زاوية بيع قابلة للنشر.
              </div>
            </div>

            <div
              style={{
                position: "absolute",
                left: 34,
                bottom: 30,
                display: "inline-flex",
                padding: "12px 18px",
                borderRadius: 999,
                background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.goldGlow})`,
                color: COLORS.greenDeep,
                fontSize: 18,
                fontWeight: 900,
                opacity: artIn,
                transform: `scale(${interpolate(artIn, [0, 1], [0.88, 1])})`,
                boxShadow: `0 14px 30px ${COLORS.gold}55`,
              }}
            >
              جاهزة كبداية إعلان
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              right: 24,
              left: 24,
              bottom: 26,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.greenDeep }}>
                {progress < 1 ? "يبني الصورة والنسخة معاً" : "اكتملت المعاينة الأولى"}
              </div>
              <div style={{ fontSize: 16, fontWeight: 900, color: COLORS.green }}>
                {Math.round(progress * 100)}%
              </div>
            </div>
            <div
              style={{
                height: 12,
                borderRadius: 999,
                background: `${COLORS.green}12`,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progress * 100}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: `linear-gradient(90deg, ${COLORS.greenGlow}, ${COLORS.goldGlow})`,
                  boxShadow: `0 0 24px ${COLORS.goldGlow}`,
                }}
              />
            </div>
          </div>
        </AbsoluteFill>
      </div>
    </div>
  );
};
