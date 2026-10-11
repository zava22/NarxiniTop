import { memo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import Icon from "../ui/Icon";
import StoreMark from "./StoreMark";
import { categoryIcon } from "../home/CategoryNav";
import { useCart } from "../../context/CartContext";
import { useLang } from "../../context/LanguageContext";
import { useUserData } from "../../context/UserDataContext";
import { useCatalog } from "../../context/CatalogContext";
import { useDisplayPrefs } from "../../context/DisplayPrefsContext";
import { useTheme } from "../../context/ThemeContext";
import { useCutout } from "../../lib/cutout";
import { flyToCart } from "../../lib/fly";
import { formatPrice } from "../../lib/constants";
import { summarize } from "../../lib/product";
import { toast } from "../../lib/toast";
import { trackEvent } from "../../lib/events";

/* Neutral, theme-friendly placeholder used when an image is missing or fails to load. */
const FALLBACK = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect x="110" y="120" width="180" height="160" rx="26" fill="none" stroke="#9a6a48" stroke-opacity=".45" stroke-width="10"/><path d="M110 170h180" stroke="#9a6a48" stroke-opacity=".45" stroke-width="10"/><circle cx="200" cy="225" r="14" fill="#e8527f" fill-opacity=".55"/></svg>`
);

export function Freshness({ fresh, className = "" }) {
  const { t } = useLang();
  if (!fresh) return null;
  const text = fresh.unit === "now" ? t("p.updated.now") : t(`p.updated.${fresh.unit}`, { n: fresh.value });
  return <span className={`nt-fresh ${fresh.stale ? "is-stale" : ""} ${className}`}>{text}</span>;
}

export function UnitPrice({ unit }) {
  const { t } = useLang();
  if (!unit) return null;
  return <span className="nt-unitprice">≈ {Math.round(unit.value).toLocaleString("uz-UZ")} UZS / {t(`p.per.${unit.per}`)}</span>;
}

function Heart({ active, onClick, label }) {
  return (
    <motion.button type="button" className={`pc-heart ${active ? "is-on" : ""}`} onClick={onClick} whileTap={{ scale: 0.82 }} aria-pressed={active} aria-label={label} title={label}>
      <motion.span animate={active ? { scale: [1, 1.3, 1] } : { scale: 1 }} transition={{ duration: 0.32 }} style={{ display: "grid" }}>
        <Icon name="heart" size={19} />
      </motion.span>
    </motion.button>
  );
}

function ProductCard({ product, index = 0 }) {
  const { t, tProduct, tUnit, tCategory } = useLang();
  const { items, addItem, setQty } = useCart();
  const { isDark } = useTheme();
  const { isFavorite, toggleFavorite } = useUserData();
  const { drops } = useCatalog();
  const { prefs } = useDisplayPrefs();
  const [imgOk, setImgOk] = useState(true);
  const imgRef = useRef(null);
  const cut = useCutout(product.image, isDark);
  const qty = items.find((i) => i.slug === product.slug)?.qty ?? 0;

  const s = summarize(product, { drops });
  const fav = isFavorite(product.slug);
  const name = tProduct(product, "name");
  const compact = prefs.density === "compact";
  const rows = prefs.showOffers ? s.offers.slice(0, compact ? 2 : 3) : [s.best];
  const hidden = prefs.showOffers ? s.total - rows.length : 0;
  const catIcon = categoryIcon(product.category);
  const partial = !s.available || s.liveCount < s.total;

  const add = (e) => {
    e.preventDefault();
    if (!s.available) return;
    flyToCart(imgRef.current);
    addItem(product.slug);
    trackEvent(product.slug, "cart");
    if (qty === 0) toast(t("p.added", { name }));
  };
  const step = (d) => (e) => { e.preventDefault(); setQty(product.slug, Math.min(99, qty + d)); };

  return (
    <motion.article
      className={`pc ${s.available ? "" : "is-unavailable"} ${s.cheapestVerified ? "has-cheapest" : ""}`}
      data-density={prefs.density}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.38, delay: Math.min(index, 8) * 0.035, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
    >
      <Heart active={fav} label={fav ? t("p.fav.remove") : t("p.fav.add")} onClick={(e) => { e.preventDefault(); toggleFavorite(product); if (!fav) trackEvent(product.slug, "favorite"); }} />

      <div className="pc-badges">
        {s.discount > 0 && <span className="nt-badge b-disc">−{s.discount}%</span>}
        {s.drop && <span className="nt-badge b-drop"><Icon name="trendDown" size={12} strokeWidth={2.4} />{s.drop.percent}%</span>}
      </div>

      <Link to={`/product/${product.slug}`} className="pc-link" onClick={() => trackEvent(product.slug, "view")}>
        <div className="pc-img">
          <motion.img
            ref={imgRef}
            className={cut ? "is-cut" : ""}
            src={imgOk && product.image ? (cut ?? product.image) : FALLBACK}
            alt={name}
            loading="lazy"
            decoding="async"
            onError={() => setImgOk(false)}
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 240, damping: 22 }}
          />
          {!s.available && <span className="pc-unavail">{t("p.unavailable")}</span>}
        </div>
        <h3 className="pc-title" title={name}>{name}</h3>
        <div className="pc-meta">
          <span className="pc-cat">{catIcon && <i aria-hidden="true">{catIcon}</i>}{product.category ? tCategory(product.category) : tUnit(product.unit)}</span>
        </div>
        <span className="pc-see">{t("p.seePrices")}<Icon name="arrowRight" size={14} strokeWidth={2.4} /></span>
      </Link>

      <ul className="pc-offers">
        {rows.map((o, i) => {
          const isBest = s.cheapestVerified && o.inStock !== false && o.price === s.best.price;
          const out = o.inStock === false;
          return (
            <li key={`${o.store}-${o.storeId ?? i}`} className={`${isBest ? "is-best" : ""} ${out ? "is-out" : ""}`}>
              <StoreMark chain={o.store} />
              <span className="pc-store">{o.store}</span>
              <span className="pc-price">
                {isBest && o.oldPrice > o.price && <del>{formatPrice(o.oldPrice)}</del>}
                {out ? t("p.outOfStock") : formatPrice(o.price)}
              </span>
            </li>
          );
        })}
        {hidden > 0 && <li className="pc-more">{t("p.moreStores", { n: hidden })}</li>}
      </ul>

      {((prefs.showFresh && s.fresh) || partial) && (
        <div className="pc-note">
          {/* the "≈ 6,900 UZS / kg" line was removed from cards on purpose; only the refresh time stays */}
          {prefs.showFresh && <Freshness fresh={s.fresh} />}
          {partial && <span className="nt-avail">{s.available ? t("p.inStockAt", { n: s.liveCount, m: s.total }) : t("p.unavailable")}</span>}
        </div>
      )}

      <div className="pc-foot">
        <AnimatePresence mode="wait" initial={false}>
          {qty > 0 ? (
            <motion.div key="step" className="pc-step" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.16 }} role="group" aria-label={name}>
              <button type="button" onClick={step(-1)} aria-label={t("p.cart.dec")}><Icon name={qty === 1 ? "trash" : "minus"} size={16} strokeWidth={2.4} /></button>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.output key={qty} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.14 }}>{qty}</motion.output>
              </AnimatePresence>
              <button type="button" onClick={add} aria-label={t("p.cart.inc")} disabled={qty >= 99}><Icon name="plus" size={16} strokeWidth={2.4} /></button>
            </motion.div>
          ) : (
            <motion.button key="add" type="button" className="pc-add" onClick={add} disabled={!s.available} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} whileTap={{ scale: 0.96 }} aria-label={`${t("p.add")}: ${name}`}>
              <Icon name="cart" size={17} />{t("p.add")}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

export default memo(ProductCard);
