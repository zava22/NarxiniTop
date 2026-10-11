import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

import Icon from "../ui/Icon";
import NearestBranch from "../smart/NearestBranch";
import { useLang } from "../../context/LanguageContext";
import { formatPrice } from "../../lib/constants";

/*
 * Popup behind "Eng arzon narx → Batafsil".
 * One column per store; each column lists exactly the cart items that are cheapest there,
 * so the shopper knows what to buy where. `mix` is cartBreakdown(lines, "mix").
 */
export default function CheapestModal({ open, onClose, mix, savings = 0 }) {
  const { t, tProduct, tUnit } = useLang();
  const closeBtn = useRef(null);

  const groups = useMemo(() => {
    const byStore = new Map();
    for (const r of mix.rows) {
      if (!byStore.has(r.offer.store)) byStore.set(r.offer.store, []);
      byStore.get(r.offer.store).push(r);
    }
    return [...byStore]
      .map(([chain, rows]) => ({
        chain,
        rows,
        total: rows.reduce((s, r) => s + r.cost, 0),
        qty: rows.reduce((s, r) => s + r.line.qty, 0),
      }))
      .sort((a, b) => b.rows.length - a.rows.length || a.chain.localeCompare(b.chain));
  }, [mix]);

  useEffect(() => {
    if (!open) return;
    closeBtn.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="nt-modal-bg cm-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div role="dialog" aria-modal="true" aria-labelledby="cm-title" className="cm nt-glass" initial={{ opacity: 0, scale: 0.95, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }} transition={{ type: "spring", stiffness: 320, damping: 30 }}>
            <header className="cm-head">
              <div>
                <h3 id="cm-title">{t("cart.planTitle")}</h3>
                <p>{t("cart.planSub")}</p>
              </div>
              <button ref={closeBtn} type="button" className="cm-x" onClick={onClose} aria-label={t("nav.close")} title={t("nav.close")}><Icon name="x" size={18} /></button>
            </header>

            <div className="cm-cols">
              {groups.map((g) => (
                <section key={g.chain} className="cm-col" aria-label={g.chain}>
                  <header className="cm-col-head">
                    <span className="cm-store"><Icon name="store" size={16} />{g.chain}</span>
                    <span className="cm-sub">
                      <small>{t("cart.items", { n: g.qty })}</small>
                      <b>{formatPrice(g.total)}</b>
                    </span>
                  </header>
                  <ul className="cm-list">
                    {g.rows.map((r) => (
                      <li key={r.line.id} className="cm-item">
                        <span className="cm-thumb"><img src={r.line.product.image} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} /></span>
                        <span className="cm-name">
                          <b>{tProduct(r.line.product, "name")}</b>
                          <small>{tUnit(r.line.product.unit)} · {t("cart.planEach", { q: r.line.qty, p: formatPrice(r.offer.price) })}</small>
                        </span>
                        <span className="cm-cost">{formatPrice(r.cost)}</span>
                      </li>
                    ))}
                  </ul>
                  <footer className="cm-col-foot"><NearestBranch chain={g.chain} compact /></footer>
                </section>
              ))}
            </div>

            {mix.missing.length > 0 && <p className="cm-missing" role="status"><Icon name="alert" size={16} />{t("cart.planMissing", { n: mix.missing.length })}</p>}

            <footer className="cm-foot">
              <div className="cm-total"><span>{t("p.cart.total")}</span><b>{formatPrice(mix.total)}</b></div>
              {savings > 0 && <p className="cm-save"><Icon name="trendDown" size={16} />{t("p.cart.saveVsWorst")}<b>{formatPrice(savings)}</b></p>}
              <p className="cm-note">{t("p.cart.noTransport")}</p>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
