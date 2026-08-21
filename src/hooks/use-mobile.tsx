import * as React from "react";

const MOBILE_BREAKPOINT = 768;

function getIsMobileViewport() {
  if (typeof window === "undefined") return false;
  const narrowViewport = window.innerWidth < MOBILE_BREAKPOINT;
  const realDeviceWidth = Math.min(window.screen.width, window.screen.height);
  const isTouchPhone = navigator.maxTouchPoints > 0 && realDeviceWidth < MOBILE_BREAKPOINT;
  return narrowViewport || isTouchPhone;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(getIsMobileViewport);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(getIsMobileViewport());
    };
    mql.addEventListener("change", onChange);
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    setIsMobile(getIsMobileViewport());
    return () => {
      mql.removeEventListener("change", onChange);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
  }, []);

  return !!isMobile;
}
