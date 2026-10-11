import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import PageShell from "../components/layout/PageShell";
import LocationControl from "../components/smart/LocationControl";
import MapPicker from "../components/smart/MapPicker";
import Icon from "../components/ui/Icon";
import { EmptyState, Skeleton } from "../components/ui/States";

import useBranches from "../hooks/useBranches";
import { useLang } from "../context/LanguageContext";
import { useLocation } from "../context/LocationContext";
import { directionsUrl, isValidCoord, openStatus, rankBranches } from "../../shared/core/geo.js";
import { DISTRICTS, districtKey } from "../../shared/core/districts.js";

const FAR_KM = 60;
const NEAR_MAX = 4;

// Keep these three in the order the previous/next arrows should follow.
const MAIN_CHAINS = [
  { name: "Havas", short: "H", subtitle: "HAVAS supermarketlari", color: "havas", url: "https://havasfood.uz/ru/markets/" },
  { name: "Korzinka", short: "K", subtitle: "Korzinka supermarketlari", color: "korzinka", url: "https://korzinka.uz/stores" },
  { name: "Makro", short: "M", subtitle: "Makro supermarketlari", color: "makro", url: "https://makromarket.uz/contacts" },
];

function canonicalChain(value = "") {
  const text = String(value ?? "").trim();
  const lower = text.toLocaleLowerCase();
  if (lower.includes("havas")) return "Havas";
  if (lower.includes("korzinka")) return "Korzinka";
  if (lower.includes("makro")) return "Makro";
  return text || "Boshqa do‘konlar";
}

function sourceHost(value) {
  try { return new URL(value).hostname.replace(/^www\./, ""); } catch { return "manba"; }
}

function mapsLink(branch) {
  // Prefer an official branch-specific map link, then coordinates, then an address search.
  return branch.mapsUrl || directionsUrl(branch) || (branch.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${branch.chain} ${branch.name ?? ""} ${branch.address}`)}`
    : null);
}

function Row({ b, i, km, nearest, t }) {
  const open = openStatus(b.hours);
  const link = mapsLink(b);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ delay: Math.min(i, 8) * 0.015, duration: 0.18 }}
      className={nearest ? "is-nearest" : ""}
    >
      <div className="nt-branch-main">
        <div className="nt-branch-title">
          <b>{b.chain}</b>
          {b.name && b.name !== b.chain && <span>{b.name}</span>}
          {nearest && <span className="nt-badge b-cheap"><Icon name="pin" size={12} strokeWidth={2.4} />{t("route.closest")}</span>}
          {!isValidCoord(b) && <span className="nt-badge b-muted">{t("route.noCoordsTag")}</span>}
        </div>
        {b.address && <small>{b.address}</small>}
        <div className="nt-branch-meta">
          {open !== null && <span className={open ? "is-open" : "is-closed"}><Icon name="clock" size={14} /> {open ? t("route.open") : t("route.closed")}</span>}
          {typeof b.hours === "string" && <span>{b.hours}</span>}
          {b.phone && <a className="nt-link" href={`tel:${b.phone}`}>{b.phone}</a>}
          {b.source && /^https?:\/\//.test(b.source) && <a href={b.source} target="_blank" rel="noopener noreferrer" className="nt-link">{t("route.source", { s: sourceHost(b.source) })}</a>}
        </div>
      </div>
      <div className="nt-branch-side">
        {km != null && <strong>{t("route.km", { d: km.toFixed(km < 10 ? 1 : 0) })}</strong>}
        {link && <a href={link} target="_blank" rel="noopener noreferrer" className="nt-btn nt-btn-ghost nt-btn-sm"><Icon name="navigation" size={15} />{t("route.directions")}</a>}
      </div>
    </motion.li>
  );
}

function sortBranches(items, kmById = new Map()) {
  return [...items].sort((a, b) => {
    const ak = kmById.get(`${a.chain}:${a.id}`);
    const bk = kmById.get(`${b.chain}:${b.id}`);
    if (ak != null || bk != null) return (ak ?? Infinity) - (bk ?? Infinity);
    const aCode = Number(String(a.name ?? "").match(/\d+/)?.[0] ?? 0);
    const bCode = Number(String(b.name ?? "").match(/\d+/)?.[0] ?? 0);
    if (aCode && bCode && aCode !== bCode) return bCode - aCode;
    return String(a.address ?? a.name ?? "").localeCompare(String(b.address ?? b.name ?? ""), "uz");
  });
}

/**
 * Three-chain nearest carousel. The arrow slots stay the same size at both ends;
 * the previous arrow is hidden on Havas and the next arrow is hidden on the last chain.
 */
function NearestByChain({ chains, branches, location, t }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const index = Math.min(activeIndex, Math.max(0, chains.length - 1));
  const active = chains[index] ?? MAIN_CHAINS[0].name;
  const chainBranches = useMemo(() => branches.filter((b) => b.chain === active), [branches, active]);
  const ranked = useMemo(() => rankBranches(location, branches, { chain: active }).ranked, [location, branches, active]);
  const noCoords = chainBranches.length > 0 && ranked.length === 0;
  const rows = ranked.length
    ? ranked.slice(0, NEAR_MAX).map((b) => ({ ...b, displayKm: b.km }))
    : sortBranches(chainBranches).slice(0, NEAR_MAX).map((b) => ({ ...b, displayKm: null }));
  const meta = MAIN_CHAINS.find((item) => item.name === active) ?? { url: null };
  const go = (nextIndex) => setActiveIndex(Math.max(0, Math.min(chains.length - 1, nextIndex)));

  if (!chains.length) return null;

  return (
    <section className="nn" aria-label={t("route.nearestTitle")}>
      <div className="nn-head">
        {index > 0 ? (
          <button type="button" className="nn-arrow" onClick={() => go(index - 1)} aria-label={t("near.prev")}><Icon name="arrowLeft" size={20} strokeWidth={2.4} /></button>
        ) : <span className="nn-arrow nn-arrow-placeholder" aria-hidden="true" />}
        <div className="nn-title" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={active} className="nn-title-inner" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.16 }}>
              <b>{active}</b>
              <small>{ranked.length ? t("near.chainTitle", { c: active, n: Math.min(ranked.length, NEAR_MAX) }) : noCoords ? t("near.chainNoCoordsData", { c: active, n: chainBranches.length }) : t("near.chainNone", { c: active })}</small>
              {meta.url && <a className="nn-official-link" href={meta.url} target="_blank" rel="noopener noreferrer">{t("route.officialDirectory")} <Icon name="arrowRight" size={13} /></a>}
            </motion.div>
          </AnimatePresence>
        </div>
        {index < chains.length - 1 ? (
          <button type="button" className="nn-arrow" onClick={() => go(index + 1)} aria-label={t("near.next")}><Icon name="arrowRight" size={20} strokeWidth={2.4} /></button>
        ) : <span className="nn-arrow nn-arrow-placeholder" aria-hidden="true" />}
      </div>
      <div className="nn-dots" role="tablist" aria-label={t("route.supermarkets")}>
        {chains.map((name, i) => <button key={name} type="button" role="tab" aria-selected={i === index} className={i === index ? "is-on" : ""} onClick={() => go(i)}>{name}</button>)}
      </div>
      <p className={`nn-no-coords-note ${noCoords ? "" : "is-empty"}`}>{noCoords ? t("near.addressOnly") : " "}</p>
      <div className="nn-list-slot">
        {rows.length ? (
          <ul className="nt-branches">
            <AnimatePresence initial={false}>
              {rows.map((b, i) => <Row key={`${active}-${b.id}`} b={b} i={i} km={b.displayKm} nearest={Boolean(location && b.displayKm != null && i === 0)} t={t} />)}
            </AnimatePresence>
          </ul>
        ) : (
          <div className="nn-chain-empty"><Icon name="pin" size={20} /><span>{t("near.chainNone", { c: active })}</span></div>
        )}
      </div>
    </section>
  );
}

export default function Stores() {
  const { t } = useLang();
  const [params] = useSearchParams();
  const { location, place } = useLocation();
  const { branches: rawBranches, loading } = useBranches();
  const [q, setQ] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const requestedChain = canonicalChain(params.get("chain") ?? "");
  const [expandedChains, setExpandedChains] = useState(() => MAIN_CHAINS.some((c) => c.name === requestedChain) ? [requestedChain] : []);

  // Normalize partner API naming variations without changing the saved source records.
  const branches = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const item of rawBranches) {
      if (!item?.chain) continue;
      const branch = { ...item, chain: canonicalChain(item.chain) };
      const key = `${branch.chain}:${branch.id ?? `${branch.lat},${branch.lng}:${branch.address}`}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(branch);
    }
    return result;
  }, [rawBranches]);

  const chains = useMemo(() => {
    const known = MAIN_CHAINS.map((item) => item.name);
    const extras = [...new Set(branches.map((b) => b.chain))].filter((name) => !known.includes(name)).sort((a, b) => a.localeCompare(b, "uz"));
    return [...known, ...extras];
  }, [branches]);
  const chainMeta = useMemo(() => new Map(MAIN_CHAINS.map((item) => [item.name, item])), []);
  const overallResult = useMemo(() => rankBranches(location, branches), [location, branches]);
  const overall = overallResult.ranked;
  const kmById = useMemo(() => new Map(overall.map((b) => [`${b.chain}:${b.id}`, b.km])), [overall]);
  const myDistrict = place?.district ?? null;
  const inDistrict = useMemo(() => (myDistrict
    ? branches.filter((b) => !isValidCoord(b) && (b.district ?? districtKey(b.address)) === myDistrict)
    : []), [branches, myDistrict]);

  const needle = q.trim().toLocaleLowerCase();
  const grouped = useMemo(() => {
    const groups = new Map(chains.map((name) => [name, []]));
    for (const branch of branches) {
      const key = canonicalChain(branch.chain);
      if (!groups.has(key)) groups.set(key, []);
      const searchText = `${branch.chain} ${branch.name ?? ""} ${branch.address ?? ""} ${branch.district ?? ""}`.toLocaleLowerCase();
      if (!needle || searchText.includes(needle)) groups.get(key).push(branch);
    }
    for (const [key, value] of groups) groups.set(key, sortBranches(value, kmById));
    return groups;
  }, [branches, chains, needle, kmById]);
  const shownCount = useMemo(() => [...grouped.values()].reduce((sum, list) => sum + list.length, 0), [grouped]);

  const toggleChain = (name) => setExpandedChains((current) => current.includes(name)
    ? current.filter((chainName) => chainName !== name)
    : [...current, name]);
  const openAll = () => setExpandedChains(chains);
  const closeAll = () => setExpandedChains([]);

  if (loading) {
    return <PageShell><h1 className="nt-h1">{t("route.pageTitle")}</h1><p className="nt-sub">{t("route.directoryPageSub")}</p><LocationControl /><Skeleton h={150} r={20} /></PageShell>;
  }

  return (
    <PageShell>
      <header className="nt-store-directory-hero">
        <div className="nt-store-directory-icon"><Icon name="store" size={23} /></div>
        <div className="nt-store-directory-copy">
          <p className="nt-eyebrow">NARXTOP · {t("route.directoryEyebrow")}</p>
          <h1 className="nt-h1">{t("route.pageTitle")}</h1>
          <p className="nt-sub">{t("route.directoryPageSub")}</p>
        </div>
        <div className="nt-store-total"><strong>{branches.length}</strong><span>{t("route.totalBranch")}</span></div>
      </header>
      <LocationControl />

      {location && place && <p className="nt-youare"><Icon name="pin" size={17} /> {t("route.you", { p: place.name })}</p>}
      {!location && (
        <div className="nn-pick nt-glass">
          <span className="nn-pick-ico"><Icon name="pin" size={24} /></span>
          <div><h2>{t("near.pick.title")}</h2><p>{t("near.pick.sub")}</p></div>
          <button type="button" className="nt-btn nt-btn-primary" onClick={() => setMapOpen(true)}><Icon name="locate" size={18} />{t("loc.pickMap")}</button>
        </div>
      )}

      {location && overall.length > 0 && overall[0].km > FAR_KM && <p className="nt-warn" role="status">{t("route.far", { d: overall[0].km.toFixed(0) })}</p>}
      {location && branches.length > 0 && (
        <>
          <h2 className="nt-h2"><Icon name="navigation" size={19} />{t("route.nearestTitle")}</h2>
          <NearestByChain chains={MAIN_CHAINS.map((item) => item.name)} branches={branches} location={location} t={t} />
          <p className="nt-note">{t("route.straightNote")}</p>
        </>
      )}

      {location && overall.length === 0 && branches.length > 0 && <p className="nt-warn" role="status">{t("route.noneNear")}</p>}
      {inDistrict.length > 0 && (
        <section>
          <h2 className="nt-h2">{t("route.inDistrict", { d: DISTRICTS[myDistrict] ?? "" })}</h2>
          <ul className="nt-branches"><AnimatePresence initial={false}>{inDistrict.map((b, i) => <Row key={`${b.chain}-${b.id}`} b={b} i={i} km={null} t={t} />)}</AnimatePresence></ul>
        </section>
      )}

      {!branches.length && <EmptyState icon="store" title={t("route.noStores")} text={t("route.noStoresText")} />}

      <section className="nt-chain-directory" aria-labelledby="nt-chain-directory-title">
        <div className="nt-chain-directory-head">
          <div>
            <p className="nt-eyebrow">{t("route.directoryEyebrow")}</p>
            <h2 id="nt-chain-directory-title" className="nt-h2">{t("route.directoryTitle")}</h2>
            <p className="nt-note">{t("route.directoryHint")}</p>
          </div>
          <div className="nt-chain-directory-actions">
            <button type="button" onClick={openAll}>{t("route.expandAll")}</button>
            <button type="button" onClick={closeAll}>{t("route.collapseAll")}</button>
          </div>
        </div>
        <label className="nt-branch-search-wrap">
          <Icon name="search" size={18} />
          <input className="nt-branch-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("route.searchAll")} aria-label={t("route.searchAll")} />
          {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search"><Icon name="x" size={17} /></button>}
        </label>
        <div className="nt-chain-countline" role="status">{t("route.count", { n: shownCount })}{q ? ` · ${t("route.searchCount", { q })}` : ""}</div>

        <div className="nt-chain-accordion-list">
          {chains.map((name) => {
            const meta = chainMeta.get(name) ?? { name, short: name.slice(0, 1).toLocaleUpperCase(), subtitle: `${name} filiallari`, color: "other", url: null };
            const list = grouped.get(name) ?? [];
            const open = expandedChains.includes(name);
            const panelId = `nt-branches-${name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
            return (
              <section key={name} className={`nt-chain-accordion ${open ? "is-open" : ""}`} data-chain={meta.color}>
                <button type="button" className="nt-chain-accordion-trigger" aria-expanded={open} aria-controls={panelId} onClick={() => toggleChain(name)}>
                  <span className="nt-chain-avatar" aria-hidden="true">{meta.short}</span>
                  <span className="nt-chain-labels"><strong>{name}</strong><small>{meta.subtitle}</small></span>
                  <span className="nt-chain-count">{list.length} <small>{t("route.totalBranch")}</small></span>
                  <span className="nt-chain-arrow"><Icon name="chevronDown" size={19} /></span>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div id={panelId} className="nt-chain-accordion-panel" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: "easeInOut" }}>
                      {list.length > 0 ? (
                        <ul className="nt-branches nt-chain-branches">
                          <AnimatePresence initial={false}>{list.map((b, i) => <Row key={`${b.chain}-${b.id}`} b={b} i={i} km={kmById.get(`${b.chain}:${b.id}`) ?? null} t={t} />)}</AnimatePresence>
                        </ul>
                      ) : (
                        <div className="nt-chain-empty"><Icon name="pin" size={22} /><div><strong>{t("route.emptyGroupTitle")}</strong><p>{t("route.emptyGroupText")}</p>{meta.url && <a href={meta.url} target="_blank" rel="noopener noreferrer">{t("route.officialDirectory")} <Icon name="arrowRight" size={14} /></a>}</div></div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            );
          })}
        </div>
        {shownCount === 0 && <p className="nt-note">{t("route.noMatch")}</p>}
      </section>
      {mapOpen && <MapPicker onClose={() => setMapOpen(false)} />}
    </PageShell>
  );
}
