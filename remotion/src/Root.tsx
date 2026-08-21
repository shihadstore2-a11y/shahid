import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";

// 22s @ 30fps = 660 frames, 1080x1350 Instagram Feed (4:5)
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="main"
      component={MainVideo}
      durationInFrames={660}
      fps={30}
      width={1080}
      height={1350}
    />
  );
};
