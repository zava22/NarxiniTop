import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLang } from "../../context/LanguageContext";

/* Accessible confirmation modal for sensitive / destructive actions. */
export default function ConfirmDialog({ open, title, text, confirmLabel, danger = false, busy = false, onConfirm, onCancel }) {
  const { t } = useLang();
  const btn = useRef(null);
  useEffect(() => {
    if (!open) return;
    btn.current?.focus();
    const esc = (e) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, busy, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="nt-modal-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
          <motion.div role="alertdialog" aria-modal="true" aria-labelledby="nt-cd-title" className="nt-modal" initial={{ opacity: 0, scale: 0.92, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ type: "spring", stiffness: 340, damping: 28 }}>
            <h3 id="nt-cd-title">{title}</h3>
            {text && <p>{text}</p>}
            <div className="nt-modal-actions">
              <button type="button" className="nt-btn nt-btn-ghost" onClick={onCancel} disabled={busy}>{t("p.cancel")}</button>
              <button ref={btn} type="button" className={`nt-btn ${danger ? "nt-btn-danger" : "nt-btn-primary"}`} onClick={onConfirm} disabled={busy}>{busy ? "…" : confirmLabel}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
