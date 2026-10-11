import { useEffect, useRef, useState } from "react";

/* Smoothly animates a number from its previous value to `target`. */
export default function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(target);
  const from = useRef(target);

  useEffect(() => {
    const start = performance.now();
    const begin = from.current;
    let frame;

    const step = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = begin + (target - begin) * eased;
      setValue(current);
      from.current = current;
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return Math.round(value);
}
