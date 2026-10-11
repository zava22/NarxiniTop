/*
 * Catalog service: the ONLY place the UI learns about products/prices.
 *   live    -> /api/catalog (data ingested from supermarket adapters)
 *   fixture -> bundled src/data/products.json, ONLY when VITE_ALLOW_FIXTURE=true
 *              (defaults to true in dev). The UI shows a "demo data" banner.
 */
const ALLOW_FIXTURE = (import.meta.env.VITE_ALLOW_FIXTURE ?? String(import.meta.env.DEV)) === "true";

const clean = (p) => ({
  ...p,
  id: p.id ?? p.slug,
  prices: (p.prices ?? [])
    .map((o) => ({ ...o, price: Number(o.price), oldPrice: o.oldPrice ? Number(o.oldPrice) : undefined }))
    .filter((o) => o.price > 0),
});

async function fetchLive(signal) {
  const all = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`/api/catalog?limit=1000&offset=${offset}`, { signal });
    if (!res.ok) throw new Error(`catalog ${res.status}`);
    const body = await res.json();
    all.push(...body.products);
    if (all.length >= body.total || !body.products.length) return { products: all, generatedAt: body.generatedAt };
  }
}

export async function loadCatalog(signal) {
  try {
    const live = await fetchLive(signal);
    if (live.products.length) return { source: "live", generatedAt: live.generatedAt, products: live.products.map(clean) };
  } catch (e) {
    if (e.name === "AbortError") throw e;
    if (!ALLOW_FIXTURE) throw e;
  }
  if (!ALLOW_FIXTURE) throw new Error("catalog-empty");
  const { default: fixture } = await import("../data/products.json");
  return { source: "fixture", generatedAt: null, products: fixture.map(clean) };
}

/* Branch list from the ingested partner APIs. The site keeps working without it
 * (src/data/branches.json is merged in by useBranches), so any failure resolves to []. */
export async function loadStores(signal) {
  try {
    const res = await fetch("/api/stores", { signal });
    if (!res.ok) return [];
    const body = await res.json();
    return Array.isArray(body.stores) ? body.stores : [];
  } catch (e) {
    if (e.name === "AbortError") throw e;
    return [];
  }
}

/* Real price drops and trending products (server/catalog.js -> /api/insights). */
export async function loadInsights(signal) {
  const res = await fetch("/api/insights", { signal });
  if (!res.ok) throw new Error(`insights ${res.status}`);
  const body = await res.json();
  return { drops: body.drops ?? [], trending: body.trending ?? [] };
}
