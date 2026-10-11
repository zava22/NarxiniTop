/*
 * Supermarket adapter contract.
 *
 *   partner API ──► adapter.fetch*()  (HTTP, auth, pagination)
 *               ──► mapRawProduct()   (partner fields -> RawOffer)
 *               ──► normalizeOffer()  (validation, size/brand/category)
 *               ──► matcher           (canonical product)
 *               ──► price database    (offers + history)
 *
 * To add a supermarket: create a file that calls createHttpAdapter() with
 * its endpoints and field map (or implements the Adapter interface by hand)
 * and register it in ./index.js. Nothing else in the app changes.
 *
 * Adapter interface:
 *   { id, chain, fetchProducts(ctx): AsyncIterable<raw[]>, fetchStores(ctx): AsyncIterable<raw[]>,
 *     mapProduct(raw): RawOffer|null, mapStore(raw): Store|null }
 *
 * RawOffer: { sourceId, name, price, oldPrice?, inStock?, stockQty?, storeId?,
 *             unit?, image?, category?, barcode?, promos?, updatedAt, url? }
 * Store:    { id, name, address?, lat, lng, hours?, phone? }
 */
import { describeProduct } from "../core/matching.js";
import { isValidCoord } from "../core/geo.js";

const get = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
const pick = (raw, spec) => (typeof spec === "function" ? spec(raw) : typeof spec === "string" ? get(raw, spec) : undefined);

export const DEFAULT_PRODUCT_MAP = {
  sourceId: "id", name: "name", price: "price", oldPrice: "old_price", inStock: "in_stock",
  stockQty: "stock", storeId: "store_id", unit: "unit", image: "image", category: "category",
  barcode: "barcode", promos: "promos", updatedAt: "updated_at", url: "url",
};
export const DEFAULT_STORE_MAP = { id: "id", name: "name", address: "address", lat: "lat", lng: "lng", hours: "hours", phone: "phone" };

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(String(v).replace(/\s/g, "").replace(",", ".")));
const bool = (v) => (v === undefined || v === null ? undefined : typeof v === "string" ? !["0", "false", "no", "out"].includes(v.toLowerCase()) : Boolean(v));

/** Generic JSON-over-HTTP adapter driven by configuration. */
export function createHttpAdapter({ id, chain, baseUrl, apiKey, authHeader = "Authorization", authScheme = "Bearer", productsPath = "/products", storesPath = "/stores",
  pageParam = "page", pageSizeParam = "limit", pageSize = 500, listKey = "items", productMap = {}, storeMap = {}, fetchImpl = globalThis.fetch }) {
  const pm = { ...DEFAULT_PRODUCT_MAP, ...productMap };
  const sm = { ...DEFAULT_STORE_MAP, ...storeMap };
  const headers = { Accept: "application/json", ...(apiKey ? { [authHeader]: authScheme ? `${authScheme} ${apiKey}` : apiKey } : {}) };

  async function* paged(path, signal) {
    for (let page = 1; ; page++) {
      const url = new URL(path, baseUrl.endsWith("/") ? baseUrl : baseUrl + "/");
      url.searchParams.set(pageParam, page);
      url.searchParams.set(pageSizeParam, pageSize);
      const res = await fetchImpl(url, { headers, signal });
      if (!res.ok) throw new Error(`${id}: HTTP ${res.status} for ${url.pathname}`);
      const body = await res.json();
      const rows = Array.isArray(body) ? body : get(body, listKey) ?? [];
      if (!rows.length) return;
      yield rows;
      if (rows.length < pageSize) return;
    }
  }

  return {
    id, chain,
    fetchProducts: ({ signal } = {}) => paged(productsPath, signal),
    fetchStores: ({ signal } = {}) => paged(storesPath, signal),
    mapProduct(raw) {
      const o = Object.fromEntries(Object.entries(pm).map(([k, spec]) => [k, pick(raw, spec)]));
      return {
        sourceId: o.sourceId == null ? null : String(o.sourceId), name: o.name, price: num(o.price), oldPrice: num(o.oldPrice),
        inStock: bool(o.inStock), stockQty: num(o.stockQty), storeId: o.storeId == null ? null : String(o.storeId),
        unit: o.unit, image: o.image, category: o.category, barcode: o.barcode, promos: o.promos, updatedAt: o.updatedAt, url: o.url,
      };
    },
    mapStore(raw) {
      const s = Object.fromEntries(Object.entries(sm).map(([k, spec]) => [k, pick(raw, spec)]));
      return { id: s.id == null ? null : String(s.id), name: s.name, address: s.address, lat: num(s.lat), lng: num(s.lng), hours: s.hours, phone: s.phone };
    },
  };
}

/** Validates + enriches one RawOffer. Never fills in missing prices/timestamps. */
export function normalizeOffer(raw, chain, { now = Date.now() } = {}) {
  const errors = [];
  if (!raw || !raw.sourceId) errors.push("missing-id");
  if (!raw?.name || typeof raw.name !== "string") errors.push("missing-name");
  if (!(raw?.price > 0)) errors.push("invalid-price");
  const ts = raw?.updatedAt ? Date.parse(raw.updatedAt) : NaN;
  if (!Number.isFinite(ts)) errors.push("missing-timestamp");
  else if (ts > now + 3600000) errors.push("timestamp-in-future");
  if (raw?.oldPrice != null && !(raw.oldPrice > 0)) errors.push("invalid-old-price");
  if (errors.length) return { ok: false, errors };
  const desc = describeProduct(raw.name, raw.unit);
  return {
    ok: true,
    offer: {
      sourceId: raw.sourceId, chain, storeId: raw.storeId ?? null, name: raw.name.trim(), unit: raw.unit ?? desc.size?.label ?? null,
      price: raw.price, oldPrice: raw.oldPrice && raw.oldPrice > raw.price ? raw.oldPrice : null,
      inStock: raw.inStock, stockQty: raw.stockQty ?? null, promos: validatePromos(raw.promos), image: raw.image ?? null,
      category: raw.category ?? desc.category, barcode: raw.barcode ?? null, updatedAt: new Date(ts).toISOString(), url: raw.url ?? null,
      brand: desc.brand, canonicalKey: desc.canonicalKey, size: desc.size,
    },
  };
}

export function validateStore(s) {
  return s && s.id && s.name && isValidCoord(s) ? { ok: true } : { ok: false, errors: ["missing-id/name/coordinates"] };
}

function validatePromos(promos) {
  if (!Array.isArray(promos)) return [];
  return promos.filter((p) => {
    switch (p?.type) {
      case "multibuy": return p.minQty > 1 && p.unitPrice > 0;
      case "percent": return p.minQty >= 1 && p.percent > 0 && p.percent < 100;
      case "bundle": return p.qty > 1 && p.price > 0;
      case "amount": return p.minQty >= 1 && p.off > 0;
      default: return false;
    }
  });
}
