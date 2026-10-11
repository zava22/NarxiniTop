import { motion, useScroll, useSpring } from "framer-motion";

/* Thin brand-coloured reading progress line under the top edge. */
export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 26, restDelta: 0.001 });
  return <motion.div className="nt-progress" style={{ scaleX }} aria-hidden="true" />;
}
