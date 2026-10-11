import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { LogoMark } from "../brand/Logo";
import { farewell } from "../../lib/farewell";
import { useLang } from "../../context/LanguageContext";

/* Full-screen goodbye shown while signing out: blurred backdrop, avatar, progress bar, drifting dots. */
export default function LogoutOverlay() {
  const { t } = useLang();
  const f = useSyncExternalStore(farewell.subscribe, farewell.get, () => null);
  return (
    <AnimatePresence>
      {f && (
        <motion.div className="nt-bye" role="status" aria-live="polite" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.5, delay: 0.1 } }} transition={{ duration: 0.3 }}>
          <div className="nt-bye-dots" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ "--i": i }} />)}</div>
          <motion.div className="nt-bye-card" initial={{ opacity: 0, y: 30, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -24, scale: 0.96 }} transition={{ type: "spring", stiffness: 240, damping: 22 }}>
            <div className="nt-bye-ring">
              {f.avatar
                ? <img src={f.avatar} alt="" referrerPolicy="no-referrer" />
                : <span className="nt-bye-initial">{(f.name || "?").slice(0, 1).toUpperCase()}</span>}
              <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" /></svg>
            </div>
            <h2>{t("auth.bye", { name: f.name })}</h2>
            <p>{t("auth.byeSub")}</p>
            <div className="nt-bye-bar" aria-hidden="true"><i /></div>
            <span className="nt-bye-mark" aria-hidden="true"><LogoMark size={28} /></span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
