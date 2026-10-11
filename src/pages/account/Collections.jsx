import { Link } from "react-router-dom";

import ProductCard from "../../components/products/ProductCard";
import { EmptyState } from "../../components/ui/States";
import { useCatalog } from "../../context/CatalogContext";
import { useLang } from "../../context/LanguageContext";
import { useUserData } from "../../context/UserDataContext";

export function Favorites() {
  const { t } = useLang();
  const { bySlug } = useCatalog();
  const { favorites, alerts, setAlertTarget } = useUserData();
  const items = favorites.map((s) => bySlug.get(s)).filter(Boolean);
  if (!items.length) return <EmptyState icon="heart" title={t("acc.favEmpty")} text={t("acc.favEmptyText")} action={<Link to="/" className="nt-btn nt-btn-primary">{t("p.cart.browse")}</Link>} />;
  return (
    <div className="nt-panel">
      <h2>{t("acc.favorites")}</h2>
      <p className="nt-sub">{t("acc.favSub")}</p>
      <div className="nt-grid">
        {items.map((p, i) => (
          <div key={p.slug} className="nt-fav-wrap">
            <ProductCard product={p} index={i} />
            <label className="nt-field-inline"><span>{t("p.alert.target")}</span>
              <input type="number" min="0" inputMode="numeric" defaultValue={alerts[p.slug]?.target ?? ""} placeholder={String(Math.min(...p.prices.map((o) => o.price)))} onBlur={(e) => setAlertTarget(p.slug, Number(e.target.value) || null)} />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
