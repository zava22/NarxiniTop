/*
 * Adapter registry. Each supermarket is configured ONLY through environment
 * variables (URL, key, optional JSON field maps). Until a partner provides
 * its API the adapter is simply not enabled - nothing is faked.
 *
 *   KORZINKA_API_URL, KORZINKA_API_KEY, KORZINKA_PRODUCT_MAP, KORZINKA_STORE_MAP
 *   HAVAS_API_URL ... / MAKRO_API_URL ...
 *
 * Add another partner by adding one line to PARTNERS.
 */
import { createHttpAdapter } from "./base.js";

export const PARTNERS = [
  { id: "korzinka", chain: "Korzinka", env: "KORZINKA" },
  { id: "havas", chain: "Havas", env: "HAVAS" },
  { id: "makro", chain: "Makro", env: "MAKRO" },
];

const json = (v) => { try { return v ? JSON.parse(v) : {}; } catch { throw new Error("Invalid JSON in field map env var"); } };

export function loadAdapters(env = process.env) {
  return PARTNERS.filter((p) => env[`${p.env}_API_URL`]).map((p) =>
    createHttpAdapter({
      id: p.id, chain: p.chain, baseUrl: env[`${p.env}_API_URL`], apiKey: env[`${p.env}_API_KEY`],
      productsPath: env[`${p.env}_PRODUCTS_PATH`] || "/products", storesPath: env[`${p.env}_STORES_PATH`] || "/stores",
      listKey: env[`${p.env}_LIST_KEY`] || "items",
      productMap: json(env[`${p.env}_PRODUCT_MAP`]), storeMap: json(env[`${p.env}_STORE_MAP`]),
    })
  );
}

export { createHttpAdapter, normalizeOffer, validateStore } from "./base.js";
