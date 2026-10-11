import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "framer-motion";

import PageShell from "../components/layout/PageShell";
import Icon from "../components/ui/Icon";
import { Skeleton } from "../components/ui/States";
import Overview from "../components/admin/Overview";
import ProductsPanel from "../components/admin/ProductsPanel";
import ProductDrawer from "../components/admin/ProductDrawer";
import UsersPanel from "../components/admin/UsersPanel";
import MessagesPanel from "../components/admin/MessagesPanel";
import ActivityPanel from "../components/admin/ActivityPanel";
import SettingsPanel from "../components/admin/SettingsPanel";
import { ThumbsContext } from "../components/admin/thumbsContext";
import { accentStyle } from "../components/admin/themes";
import { useAuth } from "../context/AuthContext";
import { useCatalog } from "../context/CatalogContext";
import { useTheme } from "../context/ThemeContext";
import useAdminPrefs from "../hooks/useAdminPrefs";
import useServerHealth from "../hooks/useServerHealth";
import { useIsAdmin } from "../lib/admin";
import { toast } from "../lib/toast";
import { adminApi } from "../services/admin";

const NAV = [
  ["overview", "Boshqaruv", "chart", "Umumiy ko‘rinish va tezkor amallar"],
  ["products", "Mahsulotlar", "package", "Mahsulotlar va do‘kon narxlarini boshqarish"],
  ["users", "Foydalanuvchilar", "user", "Saytga kirgan odamlar"],
  ["messages", "Xabarlar", "inbox", "“Aloqa” sahifasidan kelgan xabarlar"],
  ["activity", "Faollik", "activity", "Admin panelda bajarilgan amallar tarixi"],
  ["settings", "Sozlamalar", "settings", "Ko‘rinish, ma’lumotlar va tizim"],
];
const TAB_KEYS = NAV.map(([k]) => k);

function ServerBanner({ health, onRecheck }) {
  return (
    <div className="adm-banner" role="alert">
      <Icon name={health.state === "stale" ? "refresh" : "alert"} size={20} />
      <div>
        <b>{health.state === "stale" ? "Server qayta ishga tushirilishi kerak" : health.state === "db" ? "Baza ulanmagan" : "Server bilan aloqa yo‘q"}</b>
        <p>{health.message}</p>
      </div>
      <button type="button" className="adm-btn is-sm" onClick={onRecheck}><Icon name="refresh" size={15} />Qayta tekshirish</button>
    </div>
  );
}

function AdminApp({ name }) {
  const [params, setParams] = useSearchParams();
  const tab = TAB_KEYS.includes(params.get("tab")) ? params.get("tab") : "overview";
  const { prefs, set, reset } = useAdminPrefs();
  const { isDark, toggleTheme } = useTheme();
  const { health, recheck } = useServerHealth();
  const { reload } = useCatalog();

  const [version, setVersion] = useState(0);
  const [drawer, setDrawer] = useState(null); // { product } | null
  const [imagesOpen, setImagesOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const go = useCallback((k) => setParams(k === "overview" ? {} : { tab: k }, { replace: true }), [setParams]);
  const changed = useCallback(() => { setVersion((v) => v + 1); reload(); }, [reload]); // refresh panels + the public catalog
  const openDrawer = useCallback((product = null) => setDrawer({ product }), []);
  const closeDrawer = useCallback(() => setDrawer(null), []);
  const saved = useCallback(() => { setDrawer(null); changed(); }, [changed]);

  useEffect(() => {
    let off = false;
    adminApi.stats().then((s) => { if (!off) setUnread(s.counts.unread); }).catch(() => {});
    return () => { off = true; };
  }, [version]);

  const act = useCallback(async (what) => {
    try {
      if (what === "add") openDrawer(null);
      else if (what === "images") { go("products"); setImagesOpen(true); }
      else if (what.startsWith("export-")) toast(`${await adminApi.download(what.slice(7))} yuklab olindi`);
    } catch (e) { toast(e.message); }
  }, [go, openDrawer]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target;
      if (el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (document.querySelector(".adm-drawer, .nt-modal-bg")) return;
      if (e.key === "/") { const i = document.querySelector(".adm-main .adm-search input"); if (i) { e.preventDefault(); i.focus(); } }
      else if (e.key === "n" || e.key === "N") { e.preventDefault(); openDrawer(null); }
      else if (/^[1-6]$/.test(e.key)) go(TAB_KEYS[Number(e.key) - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, openDrawer]);

  const [, title, , subtitle] = NAV.find(([k]) => k === tab);
  const led = { ok: "Server ishlayapti", checking: "Tekshirilmoqda…", stale: "Server eski versiyada", offline: "Server o‘chiq", db: "Baza ulanmagan" }[health.state];

  return (
    <MotionConfig reducedMotion={prefs.motion ? "user" : "always"}>
      <ThumbsContext.Provider value={prefs.thumbs}>
        <div className="adm" data-density={prefs.density} data-corners={prefs.corners} data-motion={prefs.motion ? "on" : "off"} data-side={prefs.sidebar} style={accentStyle(prefs.accent, isDark)}>
          <aside className="adm-side">
            <div className="adm-brand">
              <span className="adm-brand-ico"><Icon name="shield" size={20} /></span>
              <div><b>NarxTop</b><small>Admin panel</small></div>
            </div>

            <LayoutGroup id="admin-nav">
              <nav className="adm-nav" role="tablist" aria-orientation="vertical" aria-label="Admin bo‘limlari">
                {NAV.map(([k, label, icon]) => (
                  <button key={k} type="button" role="tab" aria-selected={tab === k} title={label} className={tab === k ? "is-on" : ""} onClick={() => go(k)}>
                    {tab === k && <motion.i layoutId="adm-nav-pill" className="adm-nav-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} aria-hidden="true" />}
                    <Icon name={icon} size={18} /><span>{label}</span>
                    {k === "messages" && unread > 0 && <em className="adm-nav-badge" aria-label={`${unread} ta yangi`}>{unread > 99 ? "99+" : unread}</em>}
                  </button>
                ))}
              </nav>
            </LayoutGroup>

            <div className="adm-side-foot">
              <button type="button" className={`adm-status is-${health.state}`} onClick={recheck} title="Qayta tekshirish"><i className="adm-led" /><span>{led}</span></button>
              <div className="adm-side-actions">
                <button type="button" className="adm-icon-btn" onClick={toggleTheme} aria-label="Mavzuni almashtirish" title="Yorug‘ / qorong‘i"><Icon name={isDark ? "sun" : "moon"} size={17} /></button>
                <button type="button" className="adm-icon-btn adm-side-collapse" onClick={() => set({ sidebar: prefs.sidebar === "mini" ? "full" : "mini" })} aria-label="Yon panelni kichraytirish" title="Yon panel"><Icon name="panelLeft" size={17} /></button>
                <Link to="/" className="adm-icon-btn" aria-label="Saytni ko‘rish" title="Saytni ko‘rish"><Icon name="external" size={17} /></Link>
              </div>
            </div>
          </aside>

          <div className="adm-main">
            {(health.state === "stale" || health.state === "offline" || health.state === "db") && <ServerBanner health={health} onRecheck={recheck} />}

            <header className="adm-top">
              <div><h1>{title}</h1><p>{subtitle}</p></div>
              <div className="adm-top-act">
                <button type="button" className="adm-btn is-primary" onClick={() => openDrawer(null)}><Icon name="plus" size={17} />Mahsulot qo‘shish</button>
              </div>
            </header>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={tab} role="tabpanel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
                {tab === "overview" && <Overview version={version} onGo={go} onAction={act} name={name} hero={prefs.hero} />}
                {tab === "products" && <ProductsPanel version={version} view={prefs.view} imagesOpen={imagesOpen} onOpenImages={() => setImagesOpen(true)} onCloseImages={() => setImagesOpen(false)} onOpenDrawer={openDrawer} onChanged={changed} />}
                {tab === "users" && <UsersPanel version={version} />}
                {tab === "messages" && <MessagesPanel onUnread={setUnread} />}
                {tab === "activity" && <ActivityPanel version={version} />}
                {tab === "settings" && <SettingsPanel prefs={prefs} set={set} reset={reset} isDark={isDark} toggleTheme={toggleTheme} health={health} recheck={recheck} onChanged={changed} />}
              </motion.div>
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {drawer && <ProductDrawer key={drawer.product?.slug ?? "new"} product={drawer.product} onClose={closeDrawer} onSaved={saved} />}
          </AnimatePresence>
        </div>
      </ThumbsContext.Provider>
    </MotionConfig>
  );
}

/* Only the Gmail(s) in VITE_ADMIN_GMAIL get in. Everyone else is sent home (the server re-checks every call). */
export default function Admin() {
  const { isAuthenticated, loading, displayName } = useAuth();
  const isAdmin = useIsAdmin();
  if (loading) return <PageShell wide><Skeleton h={260} r={28} /></PageShell>;
  if (!isAuthenticated) return <Navigate to="/auth?next=%2Fadmin" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <PageShell wide><AdminApp name={displayName} /></PageShell>;
}
