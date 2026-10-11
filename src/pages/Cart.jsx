import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import Icon from "../components/ui/Icon";
import PageShell from "../components/layout/PageShell";
import Gate from "../components/ui/Gate";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import CheapestModal from "../components/cart/CheapestModal";
import { EmptyState, ErrorState, Skeleton } from "../components/ui/States";

import { useCart } from "../context/CartContext";
import { useCatalog } from "../context/CatalogContext";
import { useLang } from "../context/LanguageContext";
import { formatPrice } from "../lib/constants";
import { cartBreakdown, storeTotals } from "../lib/product";
import useCountUp from "../hooks/useCountUp";

function Total({ value, className }) {
  const v = useCountUp(Math.round(value));
  return <span className={className}>{formatPrice(v)}</span>;
}

/* Cart: a normal scrolling page (header, product list, sticky price summary, footer). */
export default function Cart() {
  const { t, tProduct, tUnit } = useLang();
  const { items, setQty, removeItem, clear } = useCart();
  const { bySlug, status, reload } = useCatalog();
  const [mode, setMode] = useState("mix");
  const [confirm, setConfirm] = useState(false);
  const [plan, setPlan] = useState(false);
  const [off, setOff] = useState(() => new Set()); // unchecked products are left out of the calculation
  const closePlan = useCallback(() => setPlan(false), []);

  const lines = useMemo(() => items.map((i) => ({ id: i.slug, product: bySlug.get(i.slug), qty: i.qty })).filter((l) => l.product), [items, bySlug]);
  const gone = items.filter((i) => !bySlug.has(i.slug));
  const active = useMemo(() => lines.filter((l) => !off.has(l.id)), [lines, off]);

  const totals = useMemo(() => storeTotals(active), [active]);
  const selected = totals.some((s) => s.chain === mode) || mode === "mix" ? mode : "mix";
  const b = useMemo(() => cartBreakdown(active, selected), [active, selected]);
  const view = useMemo(() => cartBreakdown(lines, selected), [lines, selected]); // every row, for display
  const mixB = useMemo(() => cartBreakdown(active, "mix"), [active]);
  const complete = totals.filter((s) => s.complete);
  const worstComplete = complete.length > 1 ? Math.max(...complete.map((s) => s.total)) : null;
  const savings = worstComplete != null ? Math.max(0, worstComplete - b.total) : 0;
  const mixSavings = worstComplete != null ? Math.max(0, worstComplete - mixB.total) : 0;

  const toggle = (id) => setOff((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  /* every option on one scale: the cheapest mix first, then each store on its own */
  const ladder = [
    { key: "mix", label: t("cart.cheapestPrice"), total: mixB.total, sub: t("p.cart.storesN", { n: mixB.stores.length }), best: true },
    ...totals.map((s) => ({
      key: s.chain, label: s.chain, total: s.total, partial: !s.complete,
      sub: s.complete ? t("p.cart.allItems") : t("p.cart.someItems", { a: s.covered, b: active.length }),
      delta: s.complete ? s.total - mixB.total : 0,
    })),
  ];

  let body;
  if (status === "loading") body = <Skeleton h={300} r={20} />;
  else if (status === "error") body = <ErrorState onRetry={reload} />;
  else if (!items.length) body = <EmptyState icon="cart" title={t("cart.emptyTitle") ?? t("p.cart.empty")} text={t("p.cart.emptyText")} action={<Link to="/" className="nt-btn nt-btn-primary">{t("p.cart.browse")}</Link>} />;
  else body = (
    <div className="nc">
      <section className="nc-panel nt-glass" aria-label={t("cart.selected")}>
        <header className="nc-head">
          <h2>{t("cart.selected")}</h2>
          <span className="nc-count">{lines.length}</span>
          <button type="button" className="nc-clear" onClick={() => setConfirm(true)}><Icon name="trash" size={15} /><span>{t("cart.deleteAll")}</span></button>
        </header>

        {/* the product list lives in its own scroll box */}
        <div className="nc-body">
          {gone.length > 0 && (
            <div className="nt-warn" role="alert">
              {t("p.cart.gone", { n: gone.length })}{" "}
              <button type="button" className="nt-link" onClick={() => gone.forEach((g) => removeItem(g.slug))}>{t("p.cart.removeGone")}</button>
            </div>
          )}
          {b.missing.length > 0 && selected !== "mix" && <div className="nt-warn" role="status">{t("p.cart.missingAt", { s: selected, n: b.missing.length })}</div>}
          <ul className="nc-list">
            <AnimatePresence initial={false}>
              {lines.map((l) => {
                const row = view.rows.find((r) => r.line.id === l.id);
                const name = tProduct(l.product, "name");
                const was = row && row.regular > row.cost ? row.regular : null;
                const on = !off.has(l.id);
                return (
                  <motion.li key={l.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -24, transition: { duration: 0.18 } }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className={`nc-row ${row ? "" : "is-out"} ${on ? "" : "is-off"}`}>
                    <label className="nc-check" title={t("cart.selectItem")}>
                      <input type="checkbox" checked={on} onChange={() => toggle(l.id)} aria-label={`${t("cart.selectItem")}: ${name}`} />
                      <i aria-hidden="true"><Icon name="check" size={14} strokeWidth={3} /></i>
                    </label>
                    <Link to={`/product/${l.id}`} className="nc-img" tabIndex={-1}><img src={l.product.image} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} /></Link>
                    <div className="nc-info">
                      <Link to={`/product/${l.id}`} className="nc-name">{name}</Link>
                      <div className="nc-meta">
                        <span>{tUnit(l.product.unit)}</span>
                        {row ? (
                          <>
                            <span className="nc-chain">{row.offer.store}</span>
                            <span className="nc-unit">{formatPrice(row.offer.price)}</span>
                            {row.promo && <span className="nc-promo">{t("p.cart.promoApplied")}</span>}
                          </>
                        ) : <span className="is-warn">{t("p.unavailable")}</span>}
                      </div>
                    </div>
                    <div className="nc-qty">
                      <button type="button" onClick={() => setQty(l.id, l.qty - 1)} aria-label={t("p.cart.dec")}><Icon name="minus" size={15} strokeWidth={2.4} /></button>
                      <output key={l.qty} aria-live="polite">{l.qty}</output>
                      <button type="button" onClick={() => setQty(l.id, Math.min(99, l.qty + 1))} aria-label={t("p.cart.inc")}><Icon name="plus" size={15} strokeWidth={2.4} /></button>
                    </div>
                    <div className="nc-price">
                      <strong>{row ? formatPrice(row.cost) : "—"}</strong>
                      {was && <s>{formatPrice(was)}</s>}
                    </div>
                    <button type="button" className="nc-del" onClick={() => removeItem(l.id)} aria-label={t("p.cart.remove")} title={t("p.cart.remove")}><Icon name="trash" size={16} /></button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </div>
      </section>

      <aside className="nc-side nt-glass" aria-label={t("p.cart.compare")}>
        <h3 className="nc-side-title"><Icon name="list" size={18} />{t("p.cart.compare")}</h3>

        <div className="nc-ladder" role="radiogroup" aria-label={t("p.cart.compare")}>
          {ladder.map((o) => {
            const on = selected === o.key;
            return (
              <div key={o.key} className={`nc-opt ${on ? "is-on" : ""} ${o.best ? "is-best" : ""} ${o.partial ? "is-partial" : ""}`}>
                <button type="button" role="radio" aria-checked={on} className="nc-opt-main" onClick={() => setMode(o.key)}>
                  <span className="nc-opt-ico" aria-hidden="true"><Icon name="store" size={16} /></span>
                  <span className="nc-opt-txt">
                    <b>{o.label}</b>
                    <small className={o.partial ? "is-warn" : ""}>{o.sub}</small>
                  </span>
                  <span className="nc-opt-price">
                    <b>{formatPrice(o.total)}</b>
                    {o.delta > 0 && <small>+{formatPrice(o.delta)}</small>}
                  </span>
                  <span className="nc-opt-tick" aria-hidden="true">{on && <Icon name="check" size={13} strokeWidth={3} />}</span>
                </button>
                {o.best && (
                  <button type="button" className="nc-more" onClick={() => setPlan(true)} disabled={!mixB.rows.length}>
                    {t("cart.seeMore")}<Icon name="arrowRight" size={14} strokeWidth={2.4} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {!active.length && <p className="nt-note nc-pick" role="status">{t("cart.pickItems")}</p>}

        <div className="nc-sum">
          <dl className="nc-receipt">
            <div><dt>{t("p.cart.regular")}</dt><dd>{formatPrice(b.regular)}</dd></div>
            {b.discount > 0 && <div className="is-promo"><dt>{t("p.cart.discounts")}</dt><dd>−{formatPrice(b.discount)}</dd></div>}
            <div className="nc-grand"><dt>{t("p.cart.total")}</dt><dd><Total value={b.total} className="nc-total" /></dd></div>
          </dl>
          {savings > 0 && (
            <p className="nc-save"><Icon name="trendDown" size={18} /><span>{t("p.cart.saveVsWorst")}</span><b>{formatPrice(savings)}</b></p>
          )}
          <p className="nt-note nc-note">{t("p.cart.noTransport")}</p>
        </div>
      </aside>

      <CheapestModal open={plan && mixB.rows.length > 0} onClose={closePlan} mix={mixB} savings={mixSavings} />
      <ConfirmDialog open={confirm} danger title={t("p.cart.clearTitle")} text={t("p.cart.clearText")} confirmLabel={t("p.cart.clear")} onCancel={() => setConfirm(false)} onConfirm={() => { clear(); setOff(new Set()); setConfirm(false); }} />
    </div>
  );

  return (
    <PageShell>
      <div className="nc-page">
        <motion.header className="nc-top" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
          <h1>{t("nav.cart")}</h1>
          <p>{t("cart.subtitle")}</p>
        </motion.header>
        <Gate>{body}</Gate>
      </div>
    </PageShell>
  );
}
