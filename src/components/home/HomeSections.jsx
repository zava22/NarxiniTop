import { useMemo } from "react";

import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Icon from "../ui/Icon";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useLocation } from "../../context/LocationContext";
import { useUserData } from "../../context/UserDataContext";
import { useCatalog } from "../../context/CatalogContext";
import { useLang } from "../../context/LanguageContext";
import { summarize } from "../../lib/product";
import useCountUp from "../../hooks/useCountUp";

export function HeroStats() {
  const { t } = useLang();
  const { products, stores } = useCatalog();
  const chains = new Set(products.flatMap((p) => p.prices.map((o) => o.store))).size;
  const spread = useMemo(() => {
    const v = products.filter((p) => p.prices.length > 1).map((p) => summarize(p).spreadPct);
    return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : 0;
  }, [products]);
  const a = useCountUp(products.length), b = useCountUp(chains), c = useCountUp(spread), d = useCountUp(stores.length);
  return (
    <ul className="nt-stats">
      <li><b>{a}</b><span>{t("p.stat.products")}</span></li>
      <li><b>{b}</b><span>{t("p.stat.chains")}</span></li>
      <li><b>{c}%</b><span>{t("p.stat.spread")}</span></li>
      {stores.length > 0 && <li><b>{d}</b><span>{t("p.stat.branches")}</span></li>}
    </ul>
  );
}

/* Signed-in dashboard strip: only real numbers from the user's own data. */
export function QuickTiles() {
  const { t } = useLang();
  const { displayName } = useAuth();
  const { count } = useCart();
  const { favorites, notifications } = useUserData();
  const { place, location } = useLocation();
  const tiles = [
    ["/cart", "cart", t("nav.cart"), count],
    ["/account?tab=favorites", "heart", t("acc.favorites"), favorites.length],
    ["/account?tab=notifications", "bell", t("acc.notifTitle"), notifications.length],
    ["/stores", "pin", t("nav.stores"), place?.name ?? (location ? `${location.lat.toFixed(3)}, ${location.lng.toFixed(3)}` : t("quick.noLoc"))],
  ];
  return (
    <section className="nt-quick" aria-label={t("home.hello", { n: displayName })}>
      <div className="nt-quick-hello">
        <h2>{t("home.hello", { n: displayName })}</h2>
        <p>{t("home.helloSub")}</p>
      </div>
      <ul>
        {tiles.map(([to, icon, label, value], i) => (
          <motion.li key={to} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
            <Link to={to} className="nt-glass">
              <span className="nt-quick-ico"><Icon name={icon} size={20} /></span>
              <span className="nt-quick-txt"><small>{label}</small><b>{value}</b></span>
              <Icon name="arrowRight" size={16} className="nt-quick-go" />
            </Link>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
