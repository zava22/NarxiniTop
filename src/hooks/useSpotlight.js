import { useCallback, useRef } from "react";

/* Pointer-follow glow: sets --mx/--my (px) on the element; CSS draws the light. Skipped for touch / reduced motion. */
export default function useSpotlight() {
  const raf = useRef(0);
  return useCallback((e) => {
    if (e.pointerType === "touch") return;
    const el = e.currentTarget;
    const { clientX, clientY } = e;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${clientX - r.left}px`);
      el.style.setProperty("--my", `${clientY - r.top}px`);
    });
  }, []);
}
