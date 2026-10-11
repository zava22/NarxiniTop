import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import { useCatalog } from "./CatalogContext";

/*
 * Favorites, purchase history, alerts, notifications, preferences.
 * Local-first (localStorage per user) + background sync to Supabase `user_state`
 * (see supabase/schema.sql). If the table is missing the app keeps working
 * locally and `sync` reports "local".
 */
const Ctx = createContext(null);
const KEYS = ["favorites", "purchases", "alerts", "notifications", "prefs"];

export const DEFAULT_PREFS = {
  notifyDrops: true,
  strategy: "cheapest",
  weights: { cost: 0.5, stores: 0.2, time: 0.3 },
};
const EMPTY = { favorites: [], purchases: [], alerts: {}, notifications: [], prefs: DEFAULT_PREFS };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
const cheapestOf = (p) => Math.min(...p.prices.filter((o) => o.inStock !== false).map((o) => o.price));

function readLocal(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key));
    return raw ? { data: { ...EMPTY, ...raw.data, prefs: { ...DEFAULT_PREFS, ...raw.data?.prefs } }, stamps: raw.stamps ?? {} } : null;
  } catch { return null; }
}

export function UserDataProvider({ children }) {
  const { user } = useAuth();
  const { products, status } = useCatalog();
  const storageKey = `narxtop_ud_${user?.id ?? "guest"}`;
  const [state, setState] = useState({ data: EMPTY, stamps: {} });
  const [loadedKey, setLoadedKey] = useState(null);
  const [sync, setSync] = useState("local"); // local | syncing | synced | error
  const dirty = useRef(new Set());

  /* load + merge remote */
  useEffect(() => {
    let cancelled = false;
    const local = readLocal(storageKey) ?? { data: EMPTY, stamps: {} };
    setState(local);
    setLoadedKey(storageKey);
    dirty.current = new Set();
    if (!user) { setSync("local"); return; }
    setSync("syncing");
    supabase.from("user_state").select("key,value,updated_at").then(({ data: rows, error }) => {
      if (cancelled) return;
      if (error) { setSync(error.code === "42P01" || error.code === "PGRST205" ? "local" : "error"); return; }
      setState((cur) => {
        const data = { ...cur.data }, stamps = { ...cur.stamps };
        for (const r of rows ?? []) {
          const remote = Date.parse(r.updated_at);
          if (KEYS.includes(r.key) && remote > (stamps[r.key] ?? 0)) { data[r.key] = r.value; stamps[r.key] = remote; }
        }
        for (const k of KEYS) if ((stamps[k] ?? 0) > Math.max(0, ...((rows ?? []).filter((r) => r.key === k).map((r) => Date.parse(r.updated_at))), 0)) dirty.current.add(k);
        return { data, stamps };
      });
      setSync("synced");
    });
    return () => { cancelled = true; };
  }, [storageKey, user]);

  /* persist + debounce remote */
  useEffect(() => {
    if (loadedKey !== storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* ignore */ }
    if (!user || !dirty.current.size) return;
    const t = setTimeout(async () => {
      const keys = [...dirty.current];
      dirty.current = new Set();
      setSync("syncing");
      const rows = keys.map((k) => ({ user_id: user.id, key: k, value: state.data[k], updated_at: new Date(state.stamps[k] ?? Date.now()).toISOString() }));
      const { error } = await supabase.from("user_state").upsert(rows);
      if (error) { keys.forEach((k) => dirty.current.add(k)); setSync(error.code === "42P01" || error.code === "PGRST205" ? "local" : "error"); }
      else setSync("synced");
    }, 900);
    return () => clearTimeout(t);
  }, [state, storageKey, loadedKey, user]);

  const update = useCallback((key, fn) => {
    dirty.current.add(key);
    setState((s) => ({ data: { ...s.data, [key]: fn(s.data[key]) }, stamps: { ...s.stamps, [key]: Date.now() } }));
  }, []);

  /* ---------------- favorites ---------------- */
  const isFavorite = useCallback((slug) => state.data.favorites.includes(slug), [state.data.favorites]);
  const toggleFavorite = useCallback((product) => {
    const slug = product.slug;
    update("favorites", (f) => (f.includes(slug) ? f.filter((s) => s !== slug) : [...f, slug]));
    update("alerts", (a) => {
      if (a[slug]) { const { [slug]: _gone, ...rest } = a; return rest; }
      return { ...a, [slug]: { baseline: cheapestOf(product), target: null, since: Date.now() } };
    });
  }, [update]);
  const setAlertTarget = useCallback((slug, target) => update("alerts", (a) => ({ ...a, [slug]: { ...(a[slug] ?? { since: Date.now() }), target: target || null } })), [update]);

  /* ---------------- purchases / prefs / notifications ---------------- */
  const setPref = useCallback((patch) => update("prefs", (p) => ({ ...p, ...patch })), [update]);
  const dismissNotification = useCallback((id) => update("notifications", (n) => n.filter((x) => x.id !== id)), [update]);
  const clearNotifications = useCallback(() => update("notifications", () => []), [update]);
  const resetAll = useCallback(() => { KEYS.forEach((k) => update(k, () => EMPTY[k])); }, [update]);

  /* ---------------- price-drop alerts (in-app) ---------------- */
  useEffect(() => {
    if (status !== "ready" || loadedKey !== storageKey) return;
    const { alerts, prefs } = state.data;
    const found = [];
    const next = { ...alerts };
    if (prefs.notifyDrops) {
      for (const [slug, a] of Object.entries(alerts)) {
        const p = products.find((x) => x.slug === slug);
        if (!p) continue;
        const now = cheapestOf(p);
        const hit = (a.target && now <= a.target) || (now <= a.baseline * 0.97 && now < a.baseline);
        if (hit) { found.push({ id: uid(), kind: "drop", slug, from: a.baseline, to: now, ts: Date.now() }); next[slug] = { ...a, baseline: now }; }
        else if (now > a.baseline) next[slug] = { ...a, baseline: now };
      }
    }
    if (found.length) {
      if (JSON.stringify(next) !== JSON.stringify(alerts)) update("alerts", () => next);
      update("notifications", (n) => [...found, ...n].slice(0, 50));
    } else if (JSON.stringify(next) !== JSON.stringify(alerts)) update("alerts", () => next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, products, loadedKey]);

  const value = useMemo(() => ({
    ...state.data, sync, isFavorite, toggleFavorite, setAlertTarget, setPref, dismissNotification, clearNotifications, resetAll,
  }), [state.data, sync, isFavorite, toggleFavorite, setAlertTarget, setPref, dismissNotification, clearNotifications, resetAll]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUserData() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useUserData must be used inside UserDataProvider");
  return c;
}
