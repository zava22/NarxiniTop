import { useMemo } from "react";
import { Link } from "react-router-dom";
import Logo from "../brand/Logo";
import AnimatedBrand from "../brand/AnimatedBrand";
import { useLang } from "../../context/LanguageContext";
import { useCatalog } from "../../context/CatalogContext";
import { useAuth } from "../../context/AuthContext";
import Icon from "../ui/Icon";

export default function Footer() {
  const { t, tCategory } = useLang();
  const { categories, products } = useCatalog();
  const { isAuthenticated } = useAuth();
  const chains = useMemo(() => [...new Set((products ?? []).flatMap((p) => p.prices.map((o) => o.store)))], [products]);
  const rights = String(t("footer.rights") ?? "").replace(/^©\s*\d{4}\s*NarxTop\.?\s*/, "");

  return (
    <footer className="nf">
      <div className="nf-card nt-glass">
        <i className="nf-edge" aria-hidden="true" />

        <div className="nf-cta">
          <div><h3>{t("footer.ctaTitle")}</h3><p>{t("footer.ctaSub")}</p></div>
          {isAuthenticated ? (
            <div className="nf-actions">
              <Link to="/cart" className="nt-btn nt-btn-ghost nt-btn-sm"><Icon name="cart" size={16} />{t("nav.cart")}</Link>
              <Link to="/account?tab=favorites" className="nt-btn nt-btn-ghost nt-btn-sm"><Icon name="heart" size={16} />{t("acc.favorites")}</Link>
              <Link to="/stores" className="nt-btn nt-btn-primary nt-btn-sm"><Icon name="pin" size={16} />{t("nav.stores")}</Link>
            </div>
          ) : (
            <div className="nf-actions">
              <Link to="/auth" className="nt-btn nt-btn-ghost nt-btn-sm">{t("lock.login")}</Link>
              <Link to="/auth?mode=signup" className="nt-btn nt-btn-primary nt-btn-sm">{t("guest.cta")}<Icon name="arrowRight" size={16} /></Link>
            </div>
          )}
        </div>

        <div className="nf-main">
          <div className="nf-brand">
            <Logo variant="footer" />
            <p>{t("footer.desc")}</p>
            {products?.length > 0 && (
              <div className="nf-stats">
                <div className="nf-stat"><b>{products.length}</b><span>{t("footer.statProducts")}</span></div>
                {chains.length > 0 && <div className="nf-stat"><b>{chains.length}</b><span>{t("footer.statStores")}</span></div>}
              </div>
            )}
          </div>

          <nav className="nf-col" aria-label={t("footer.nav")}>
            <h4>{t("footer.nav")}</h4>
            <ul>
              <li><Link to="/">{t("nav.home")}</Link></li>
              <li><Link to="/search">{t("nav.search")}</Link></li>
              <li><Link to="/cart">{t("nav.cart")}</Link></li>
              <li><Link to="/stores">{t("nav.stores")}</Link></li>
            </ul>
          </nav>

          {categories.length > 0 && (
            <div className="nf-col">
              <h4>{t("footer.categories")}</h4>
              <ul>
                {categories.slice(0, 5).map((c) => <li key={c}><Link to={`/search?q=${encodeURIComponent(c)}`}>{tCategory(c)}</Link></li>)}
              </ul>
            </div>
          )}

          {chains.length > 0 && (
            <div className="nf-col">
              <h4>{t("footer.stores")}</h4>
              <div className="nf-pills">
                {chains.map((c) => <Link key={c} to={`/stores?chain=${encodeURIComponent(c)}`}>{c}</Link>)}
              </div>
            </div>
          )}

          <div className="nf-col">
            <h4>{t("footer.contact")}</h4>
            <Link to="/contact" className="nt-btn nt-btn-primary nt-btn-sm nf-contact"><Icon name="send" size={15} />{t("footer.contactBtn")}</Link>
          </div>
        </div>

        <div className="nf-mega" aria-hidden="true"><AnimatedBrand variant="mega" as="div" /></div>

        <div className="nf-bar">
          <p>© {new Date().getFullYear()} NarxTop. {rights}</p>
          <button type="button" className="nf-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><Icon name="arrowUp" size={15} strokeWidth={2.2} />{t("nav.top")}</button>
        </div>
      </div>
    </footer>
  );
}
