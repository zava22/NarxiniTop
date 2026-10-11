import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Navbar from "./Navbar";
import ScrollProgress from "./ScrollProgress";
import Footer from "./Footer";
import Icon from "../ui/Icon";
import { useLang } from "../../context/LanguageContext";

function BackToTop() {
  const { t } = useLang();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 700);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <AnimatePresence>
      {show && (
        <motion.button type="button" className="nt-totop nt-glass" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label={t("nav.top")} title={t("nav.top")}
          initial={{ opacity: 0, y: 14, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 14 }}>
          <Icon name="arrowUp" size={18} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/* Glass navbar + ambient background + animated main + glass footer; every page uses this. */
export default function PageShell({ children, wide = false, fixed = false }) {
  useEffect(() => {
    if (!fixed) return;
    document.documentElement.classList.add("nt-lock"); // page itself never scrolls; inner panels do
    return () => document.documentElement.classList.remove("nt-lock");
  }, [fixed]);
  return (
    <div className={`nt-shell ${fixed ? "is-fixed" : ""}`}>
      <div className="nt-ambient" aria-hidden="true"><i /><i /><i /></div>
      {!fixed && <ScrollProgress />}
      <Navbar />
      <motion.main className={`nt-main ${wide ? "is-wide" : ""} ${fixed ? "is-fixed" : ""}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28 }}>
        {children}
      </motion.main>
      {!fixed && <Footer />}
      {!fixed && <BackToTop />}
    </div>
  );
}
