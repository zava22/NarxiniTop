import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { loadCatalog, loadStores, loadInsights } from "../services/catalog";
import { buildSearchIndex, searchProducts } from "../../shared/core/matching.js";

const CatalogContext = createContext(null);

export function CatalogProvider({ children }) {
  const [state, setState] = useState({ status: "loading", products: [], source: null, generatedAt: null, error: null });
  const [stores, setStores] = useState([]);
  const [insights, setInsights] = useState({ drops: [], trending: [] });
  const run = useRef(0);

  const reload = useCallback(() => {
    const id = ++run.current; // later call wins; earlier results are ignored
    const controller = new AbortController();
    setState((s) => ({ ...s, status: s.products.length ? "refreshing" : "loading", error: null }));
    Promise.all([loadCatalog(controller.signal), loadStores(controller.signal)])
      .then(([c, st]) => {
        if (id !== run.current) return;
        setState({ status: "ready", products: c.products, source: c.source, generatedAt: c.generatedAt, error: null });
        setStores(st);
        loadInsights(controller.signal).then((i) => id === run.current && setInsights(i)).catch(() => {});
      })
      .catch((e) => {
        if (e.name === "AbortError" || id !== run.current) return;
        setState((s) => ({ ...s, status: "error", error: e.message }));
      });
    return () => controller.abort();
  }, []);

  useEffect(() => reload(), [reload]);

  const index = useMemo(() => buildSearchIndex(state.products), [state.products]);
  const bySlug = useMemo(() => new Map(state.products.map((p) => [p.slug, p])), [state.products]);
  const categories = useMemo(() => [...new Set(state.products.map((p) => p.category))], [state.products]);
  const drops = useMemo(() => new Map(insights.drops.map((d) => [d.slug, d])), [insights.drops]);
  const search = useCallback((q, opts) => searchProducts(index, q, opts), [index]);

  const value = useMemo(() => ({ ...state, stores, insights, drops, bySlug, categories, search, reload }), [state, stores, insights, drops, bySlug, categories, search, reload]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const c = useContext(CatalogContext);
  if (!c) throw new Error("useCatalog must be used inside CatalogProvider");
  return c;
}
