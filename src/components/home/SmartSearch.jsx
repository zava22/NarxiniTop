import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import { useCatalog } from "../../context/CatalogContext";
import { useLang } from "../../context/LanguageContext";
import { formatPrice } from "../../lib/constants";
import { parseQuery } from "../../../shared/core/matching.js";
import Icon from "../ui/Icon";

export default function SmartSearch({ autoFocus = false, initial = "" }) {
  const { t, tProduct, tUnit } = useLang();
  const { search, status } = useCatalog();
  const navigate = useNavigate();
  const [q, setQ] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef(null);
  const input = useRef(null);

  const parsed = useMemo(() => parseQuery(q), [q]);
  const results = useMemo(() => (q.trim().length >= 2 && status !== "loading" ? search(q, { limit: 6 }).results : []), [q, search, status]);

  useEffect(() => {
    const close = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  /* press "/" anywhere (outside form fields) to jump to search */
  useEffect(() => {
    const k = (e) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || document.activeElement?.isContentEditable) return;
      e.preventDefault(); input.current?.focus();
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);

  const go = (e) => {
    e?.preventDefault();
    if (active >= 0 && results[active]) navigate(`/product/${results[active].product.slug}`);
    else if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
    setOpen(false);
  };

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(results.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(-1, i - 1)); }
    else if (e.key === "Escape") setOpen(false);
  };

  const examples = [t("p.search.ex1"), t("p.search.ex2"), t("p.search.ex3")];
  const typed = q.trim().length >= 2 && status !== "loading";
  const showPanel = open && typed;
  const clear = () => { setQ(""); setActive(-1); input.current?.focus(); };

  return (
    <div className={`nt-ss ${open ? "is-open" : ""}`} ref={box}>
      <form onSubmit={go} role="search">
        <span className="nt-ss-icon" aria-hidden="true"><Icon name="search" size={19} /></span>
        <input
          ref={input} type="search" value={q} autoFocus={autoFocus} autoComplete="off" spellCheck={false}
          placeholder={t("p.search.placeholder")} aria-label={t("nav.search")}
          aria-expanded={showPanel && results.length > 0} aria-controls="nt-ss-list" aria-activedescendant={active >= 0 ? `nt-ss-opt-${active}` : undefined} role="combobox"
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)} onKeyDown={onKey}
        />
        {parsed.cheapest && <motion.span className="nt-chip" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}><Icon name="tag" size={14} /> {t("p.search.cheapest")}</motion.span>}
        {q ? (
          <button type="button" className="nt-ss-clear" onClick={clear} aria-label={t("p.search.clear")} title={t("p.search.clear")}><Icon name="x" size={15} /></button>
        ) : (
          <kbd className="nt-kbd" aria-hidden="true">/</kbd>
        )}
        <button type="submit" className="nt-btn nt-btn-primary nt-ss-go"><span>{t("nav.search")}</span><Icon name="arrowRight" size={16} className="nt-ss-go-ico" /></button>
      </form>

      <AnimatePresence>
        {showPanel && (
          <motion.div className="nt-ss-panel" initial={{ opacity: 0, y: -8, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.99 }} transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}>
            {results.length > 0 ? (
              <>
                <ul id="nt-ss-list" role="listbox" className="nt-ss-list">
                  {results.map((r, i) => {
                    const best = Math.min(...r.product.prices.map((o) => o.price));
                    return (
                      <li key={r.product.slug} id={`nt-ss-opt-${i}`} role="option" aria-selected={i === active} className={i === active ? "is-active" : ""} onMouseEnter={() => setActive(i)}>
                        <button type="button" onClick={() => { navigate(`/product/${r.product.slug}`); setOpen(false); }}>
                          <span className="nt-ss-thumb">{r.product.image ? <img src={r.product.image} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} /> : <Icon name="package" size={18} />}</span>
                          <span className="nt-ss-name">{tProduct(r.product, "name")}<small>{tUnit(r.product.unit)}</small></span>
                          <b className="nt-ss-price">{formatPrice(best)}</b>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <button type="button" className="nt-ss-all" onClick={() => { navigate(`/search?q=${encodeURIComponent(q.trim())}`); setOpen(false); }}>
                  <span>{t("p.search.all", { q: q.trim() })}</span>
                  <Icon name="arrowRight" size={15} />
                </button>
              </>
            ) : (
              <div className="nt-ss-none"><Icon name="search" size={20} /><b>{t("p.search.none", { q: q.trim() })}</b><span>{t("p.search.noneHint")}</span></div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="nt-ss-examples">
        {examples.map((ex) => (
          <button key={ex} type="button" className="nt-chip" onClick={() => { setQ(ex); setOpen(true); }}>{ex}</button>
        ))}
      </div>
    </div>
  );
}
