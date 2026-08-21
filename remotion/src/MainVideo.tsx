import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { wipe } from "@remotion/transitions/wipe";
import { fade } from "@remotion/transitions/fade";
import { PersistentBackground } from "./components/PersistentBackground";
import { Scene1Shock } from "./scenes/Scene1Shock";
import { Scene2Pain } from "./scenes/Scene2Pain";
import { Scene3LogoStamp } from "./scenes/Scene3LogoStamp";
import { Scene4Magic } from "./scenes/Scene4Magic";
import { Scene5Stats } from "./scenes/Scene5Stats";
import { Scene6CTA } from "./scenes/Scene6CTA";

/**
 * Scenes (frames):
 *  1 Shock        75   (2.5s)
 *  2 Pain         60   (2.0s)
 *  3 LogoStamp    45   (1.5s)
 *  4 Magic       200   (6.7s)
 *  5 Stats       120   (4.0s)
 *  6 CTA         200   (6.7s)
 * Sum = 700. Transitions overlap (5 × 8 = 40), final composition = 660 displayed frames.
 * To stay at 660 total, each transition reduces by its duration. Sum 660 - 40 = 620.
 * We pad CTA by +40 to keep brand on screen at end. Total displayed = 660 frames.
 */
export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <PersistentBackground />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={75}>
          <Scene1Shock />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-left" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 8 })}
        />
        <TransitionSeries.Sequence durationInFrames={60}>
          <Scene2Pain />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 8 })}
        />
        <TransitionSeries.Sequence durationInFrames={45}>
          <Scene3LogoStamp />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-right" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 8 })}
        />
        <TransitionSeries.Sequence durationInFrames={200}>
          <Scene4Magic />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-bottom" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 8 })}
        />
        <TransitionSeries.Sequence durationInFrames={120}>
          <Scene5Stats />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 8 })}
        />
        <TransitionSeries.Sequence durationInFrames={200}>
          <Scene6CTA />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
