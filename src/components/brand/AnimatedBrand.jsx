import { motion, useReducedMotion } from "framer-motion";

/*
 * Animated "NarxTop" wordmark. Letters rise in one by one, "Top" carries a flowing
 * brown-to-pink gradient. variant: "nav" | "hero" | "footer". Readable text is exposed
 * once through aria-label; the letters are decorative.
 */
const LETTERS = [..."Narx"].map((c) => ({ c, top: false })).concat([..."Top"].map((c) => ({ c, top: true })));

export default function AnimatedBrand({ variant = "nav", as: Tag = "span", delay = 0 }) {
  const reduce = useReducedMotion();
  return (
    <Tag className={`nt-ab nt-ab-${variant}`} aria-label="NarxTop" role="img">
      {LETTERS.map((l, i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          className={`nt-ab-l ${l.top ? "is-top" : "is-narx"}`}
          style={{ "--i": i }}
          initial={reduce ? false : { opacity: 0, y: "0.55em", filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: delay + i * 0.055 }}
        >
          {l.c}
        </motion.span>
      ))}
    </Tag>
  );
}
