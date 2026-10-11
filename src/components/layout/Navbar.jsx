import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation as useRoute } from "react-router-dom";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";

import Avatar from "../ui/Avatar";
import Icon from "../ui/Icon";
import Logo from "../brand/Logo";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useLang } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useUserData } from "../../context/UserDataContext";
import { useLocation as useGeo } from "../../context/LocationContext";
import useLogout from "../../hooks/useLogout";
import { useIsAdmin } from "../../lib/admin";

const LINKS = [["/", "nav.home", "package"], ["/search", "nav.search", "search"], ["/stores", "nav.stores", "pin"]];

export default function Navbar() {
  const { t, lang, setLang, languages } = useLang();
  const { isDark, toggleTheme } = useTheme();
  const { isAuthenticated, displayName } = useAuth();
  const isAdmin = useIsAdmin();
  const { count } = useCart();
  const { notifications } = useUserData();
  const { pathname } = useRoute();
  const { location: geo, place, permission, requestDevice } = useGeo();
  const [menu, setMenu] = useState(false);
  const [drop, setDrop] = useState(false);
  const box = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => { setMenu(false); setDrop(false); }, [pathname]);
  useEffect(() => {
    const close = (e) => box.current && !box.current.contains(e.target) && setDrop(false);
    const esc = (e) => { if (e.key === "Escape") { setDrop(false); setMenu(false); } };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, []);

  const signOutWithFx = useLogout();
  const logout = () => { setDrop(false); signOutWithFx(); };

  return (
    <header className={`nt-nav ${scrolled ? "is-scrolled" : ""}`}>
      <div className="nt-nav-in">
        <Logo />

        <LayoutGroup id="nav">
          <nav className={`nt-nav-links ${menu ? "is-open" : ""}`} aria-label="main">
            {LINKS.map(([to, key, icon]) => (
              <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => (isActive ? "is-active" : "")}>
                {({ isActive }) => (
                  <>
                    <Icon name={icon} size={17} className="nt-nav-ico" />
                    <span>{t(key)}</span>
                    {isActive && <motion.i layoutId="nav-pill" className="nt-nav-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} aria-hidden="true" />}
                  </>
                )}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink to="/admin" className={({ isActive }) => `nt-nav-admin ${isActive ? "is-active" : ""}`}>
                {({ isActive }) => (
                  <>
                    <Icon name="shield" size={17} className="nt-nav-ico" />
                    <span>Admin</span>
                    {isActive && <motion.i layoutId="nav-pill" className="nt-nav-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} aria-hidden="true" />}
                  </>
                )}
              </NavLink>
            )}
            {/* Phone-only extras (hidden on desktop by CSS): the language switch is not in the top bar on phones. */}
            <div className="nt-nav-extra">
              <NavLink to="/about" className={({ isActive }) => (isActive ? "is-active" : "")}>
                <Icon name="info" size={17} className="nt-nav-ico" />
                <span>{t("nav.about")}</span>
              </NavLink>
              <NavLink to="/contact" className={({ isActive }) => (isActive ? "is-active" : "")}>
                <Icon name="mail" size={17} className="nt-nav-ico" />
                <span>{t("footer.contactBtn")}</span>
              </NavLink>
              <div className="nt-nav-lang">
                <span>{t("acc.language")}</span>
                <div className="nt-seg nt-seg-sm" role="radiogroup" aria-label={t("acc.language")}>
                  {languages.map((l) => <button key={l} type="button" role="radio" aria-checked={lang === l} className={lang === l ? "is-on" : ""} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
                </div>
              </div>
            </div>
          </nav>
        </LayoutGroup>

        <Link to="/stores" className={`nt-locchip ${geo ? "is-set" : ""}`} onClick={() => { if (!geo && permission !== "pending") requestDevice(); }} title={t("route.title")}>
          <Icon name={permission === "pending" ? "refresh" : "pin"} size={15} className={permission === "pending" ? "nt-spin-ico" : ""} />
          <span>{geo ? place?.name ?? `${geo.lat.toFixed(3)}, ${geo.lng.toFixed(3)}` : permission === "pending" ? t("loc.locating") : t("loc.nav")}</span>
        </Link>
        <div className="nt-nav-actions">
          <div className="nt-seg nt-seg-sm" role="radiogroup" aria-label={t("acc.language")}>
            {languages.map((l) => <button key={l} type="button" role="radio" aria-checked={lang === l} className={lang === l ? "is-on" : ""} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
          </div>
          <button type="button" className="nt-icon-btn nt-theme-btn" onClick={toggleTheme} aria-label={t("nav.theme")} title={t("nav.theme")} aria-pressed={isDark}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={isDark ? "moon" : "sun"} style={{ display: "grid" }} initial={{ rotate: -70, opacity: 0, scale: 0.6 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: 70, opacity: 0, scale: 0.6 }} transition={{ duration: 0.18 }}>
                <Icon name={isDark ? "sun" : "moon"} size={19} />
              </motion.span>
            </AnimatePresence>
          </button>
          <Link to="/cart" data-cart-target className="nt-icon-btn nt-cart-btn" aria-label={`${t("nav.cart")}${count ? ` (${count})` : ""}`} title={t("nav.cart")}>
            <Icon name="cart" size={19} />
            <AnimatePresence>{count > 0 && <motion.em key={count} initial={{ scale: 0.4, y: 4 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0 }}>{count}</motion.em>}</AnimatePresence>
          </Link>

          {isAuthenticated ? (
            <div className="nt-user" ref={box}>
              <button type="button" className="nt-user-btn" onClick={() => setDrop((v) => !v)} aria-expanded={drop} aria-haspopup="menu">
                <Avatar size={32} /><span>{displayName}</span>{notifications.length > 0 && <em>{notifications.length}</em>}
              </button>
              <AnimatePresence>
                {drop && (
                  <motion.div className="nt-drop nt-glass" role="menu" initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.14 }}>
                    {isAdmin && <Link role="menuitem" to="/admin"><Icon name="shield" size={16} />Admin</Link>}
                    <Link role="menuitem" to="/account"><Icon name="user" size={16} />{t("acc.tab.profile")}</Link>
                    <Link role="menuitem" to="/account?tab=favorites"><Icon name="heart" size={16} />{t("acc.favorites")}</Link>
                    <Link role="menuitem" to="/account?tab=notifications"><Icon name="bell" size={16} />{t("acc.notifTitle")}{notifications.length > 0 && <em>{notifications.length}</em>}</Link>
                    <Link role="menuitem" to="/about"><Icon name="info" size={16} />{t("nav.about")}</Link>
                    <Link role="menuitem" to="/contact"><Icon name="mail" size={16} />{t("footer.contactBtn")}</Link>
                    <button role="menuitem" type="button" onClick={logout}><Icon name="logout" size={16} />{t("nav.logout")}</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <>
              <Link to="/auth?mode=signup" className="nt-btn nt-btn-ghost nt-btn-sm nt-nav-reg">{t("lock.register")}</Link>
              <Link to={`/auth${pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : ""}`} className="nt-btn nt-btn-primary nt-btn-sm nt-nav-login">{t("nav.login")}</Link>
            </>
          )}
          <button type="button" className="nt-icon-btn nt-burger" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-label={menu ? t("nav.close") : t("nav.menu")}>
            <Icon name={menu ? "x" : "menu"} size={19} />
          </button>
        </div>
      </div>
    </header>
  );
}
