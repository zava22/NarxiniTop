/* Geographic helpers. Distances are straight-line (Haversine), computed locally.
 * They rank branches; they are not driving/walking distances. */
const R = 6371.0088;
const rad = (d) => (d * Math.PI) / 180;

export function haversineKm(a, b) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const isValidCoord = (p) =>
  p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

/** stores: [{ id, chain, lat, lng, ... }]. Branches without coordinates are ignored. */
export function nearestStores(origin, stores, { chain, limit = 1 } = {}) {
  if (!isValidCoord(origin)) return [];
  return stores
    .filter((s) => isValidCoord(s) && (!chain || s.chain === chain))
    .map((s) => ({ ...s, straightKm: haversineKm(origin, s) }))
    .sort((a, b) => a.straightKm - b.straightKm)
    .slice(0, limit);
}

/** nearest branch of every chain */
export function nearestPerChain(origin, stores, perChain = 1) {
  const chains = [...new Set(stores.map((s) => s.chain))];
  const out = {};
  for (const c of chains) out[c] = nearestStores(origin, stores, { chain: c, limit: perChain });
  return out;
}

/**
 * Open/closed from partner-provided hours. Supports
 *   { open: "09:00", close: "23:00" }  |  "09:00-23:00"  |  "24/7"
 * Returns true / false, or null when unknown (never guessed).
 */
export function openStatus(hours, date = new Date()) {
  if (!hours) return null;
  let open, close;
  if (typeof hours === "string") {
    if (/24\s*\/\s*7|24h|24 soat/i.test(hours)) return true;
    const m = hours.match(/(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/);
    if (!m) return null;
    open = +m[1] * 60 + +m[2]; close = +m[3] * 60 + +m[4];
  } else if (hours.open && hours.close) {
    const [a, b] = hours.open.split(":"), [c, d] = hours.close.split(":");
    open = +a * 60 + +b; close = +c * 60 + +d;
  } else return null;
  const now = date.getHours() * 60 + date.getMinutes();
  return close > open ? now >= open && now < close : now >= open || now < close;
}

/* ------------------------------------------------------------------ *
 * Nearest-branch helpers (pure, no network). Everything here runs in the
 * browser; no maps SDK, geocoder or routing service is involved.
 * ------------------------------------------------------------------ */

/** Rough bounding box around the city of Tashkent (sanity check only). */
export const TASHKENT_BOUNDS = { minLat: 41.15, maxLat: 41.45, minLng: 69.05, maxLng: 69.50 };

export const inTashkentArea = (p) =>
  isValidCoord(p) && p.lat >= TASHKENT_BOUNDS.minLat && p.lat <= TASHKENT_BOUNDS.maxLat && p.lng >= TASHKENT_BOUNDS.minLng && p.lng <= TASHKENT_BOUNDS.maxLng;

/** Parses "41.3111, 69.2797" (also "41.3111 69.2797" or a ";" separator). Returns {lat,lng} or null. */
export function parseCoordinates(text) {
  if (typeof text !== "string") return null;
  const m = text.trim().match(/^(-?\d{1,3}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/);
  if (!m) return null;
  const p = { lat: Number(m[1].replace(",", ".")), lng: Number(m[2].replace(",", ".")) };
  return isValidCoord(p) ? p : null;
}

/**
 * Ranks branches by straight-line distance from `origin`.
 *  - branches without valid coordinates are returned separately and are NEVER ranked;
 *  - `chain` optionally restricts the result to one chain.
 * Returns { ranked: [{...branch, km}], withoutCoords: [...] }.
 */
export function rankBranches(origin, branches, { chain } = {}) {
  const pool = (branches ?? []).filter((b) => b && (!chain || b.chain === chain));
  const withoutCoords = pool.filter((b) => !isValidCoord(b));
  if (!isValidCoord(origin)) return { ranked: [], withoutCoords };
  const ranked = pool
    .filter((b) => isValidCoord(b))
    .map((b) => ({ ...b, km: haversineKm(origin, b) }))
    .sort((a, b) => a.km - b.km);
  return { ranked, withoutCoords };
}

/** Plain external link (opened by the user; nothing is fetched by the app). */
export const directionsUrl = (to) =>
  isValidCoord(to) ? `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}` : null;
