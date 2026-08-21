import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Tajawal";
import { COLORS } from "../theme";

const { fontFamily } = loadFont("normal", { weights: ["400", "700", "900"], subsets: ["arabic"] });

export const Scene6CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const brandIn = spring({ frame, fps, config: { damping: 14 } });
  const subIn = spring({ frame: frame - 16, fps, config: { damping: 13, stiffness: 140 } });
  const urlIn = spring({ frame: frame - 34, fps, config: { damping: 12, stiffness: 130 } });
  const chipsIn = spring({ frame: frame - 56, fps, config: { damping: 16 } });
  const pulse = 1 + Math.sin(frame * 0.18) * 0.025;
  const parallax = interpolate(frame, [0, 200], [0, -18]);
  const proofIn = spring({ frame: frame - 82, fps, config: { damping: 15, stiffness: 150 } });

  return (
    <AbsoluteFill
      style={{
        fontFamily,
        direction: "rtl",
        alignItems: "center",
        justifyContent: "center",
        padding: 60,
      }}
    >
      <div style={{ textAlign: "center", transform: `translateY(${parallax}px)` }}>
        <div
          style={{
            fontSize: 60,
            fontWeight: 700,
            color: COLORS.ink,
            opacity: brandIn,
            transform: `translateY(${interpolate(brandIn, [0, 1], [26, 0])}px)`,
          }}
        >
          اكتب وصفاً واضحاً
        </div>

        <div
          style={{
            fontSize: 172,
            fontWeight: 900,
            color: COLORS.greenDeep,
            margin: "18px 0 20px",
            letterSpacing: 0,
            lineHeight: 1.3,
            paddingTop: 26,
            opacity: brandIn,
            transform: `scale(${interpolate(brandIn, [0, 1], [0.64, 1])})`,
            textShadow: `0 16px 50px ${COLORS.greenDeep}40`,
          }}
        >
          وخذ صورةً ومعها بداية حملة جاهزة
        </div>

        <div
          style={{
            fontSize: 40,
            fontWeight: 700,
            color: COLORS.ink,
            opacity: subIn,
            transform: `translateY(${interpolate(subIn, [0, 1], [20, 0])}px)`,
            lineHeight: 1.5,
          }}
        >
          الصورة تظهر أولاً، ثم تتبعها النسخة والـ Reel وCTA بنفس منطق البيع
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            padding: "16px 24px",
            borderRadius: 999,
            background: COLORS.white,
            border: `2px solid ${COLORS.gold}30`,
            marginTop: 26,
            opacity: proofIn,
            transform: `translateY(${interpolate(proofIn, [0, 1], [18, 0])}px)`,
            boxShadow: "0 12px 28px rgba(15,31,24,0.08)",
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: COLORS.goldGlow,
              boxShadow: `0 0 22px ${COLORS.goldGlow}`,
            }}
          />
          <div style={{ fontSize: 26, fontWeight: 800, color: COLORS.greenDeep }}>
            تجربة مجانية تبدأ من أول صورة وأول زاوية بيع
          </div>
        </div>

        <div
          style={{
            display: "inline-block",
            background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.goldGlow})`,
            color: COLORS.greenDeep,
            padding: "30px 68px",
            borderRadius: 100,
            fontSize: 78,
            fontWeight: 900,
            opacity: urlIn,
            marginTop: 48,
            transform: `scale(${pulse * interpolate(urlIn, [0, 1], [0.74, 1])})`,
            boxShadow: `0 24px 60px ${COLORS.gold}70, 0 0 80px ${COLORS.goldGlow}50`,
            direction: "ltr",
            letterSpacing: 0,
          }}
        >
          www.rifd.site
        </div>

        <div
          style={{
            marginTop: 36,
            display: "flex",
            justifyContent: "center",
            gap: 18,
            flexWrap: "wrap",
            opacity: chipsIn,
          }}
        >
          {["✓ 5 توليدات أولية مجانية", "✓ بدون بطاقة ائتمان", "✓ مناسب لمتجرك السعودي"].map(
            (chip) => (
              <div
                key={chip}
                style={{
                  background: COLORS.white,
                  color: COLORS.green,
                  padding: "16px 28px",
                  borderRadius: 100,
                  fontSize: 28,
                  fontWeight: 700,
                  border: `2px solid ${COLORS.green}30`,
                  boxShadow: "0 8px 20px rgba(15,31,24,0.08)",
                }}
              >
                {chip}
              </div>
            ),
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
