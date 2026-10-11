/* View-model helpers shared by cards, detail page, cart and basket (pure). */
import { freshness } from "../../shared/core/priceIntel.js";
import { discountPercent, lineCost } from "../../shared/core/promotions.js";
import { unitPriceOf } from "../../shared/core/recommend.js";

export const inStockOffers = (p) => p.prices.filter((o) => o.inStock !== false);

export function summarize(product, { drops } = {}) {
  const live = inStockOffers(product);
  const sorted = [...(live.length ? live : product.prices)].sort((a, b) => a.price - b.price);
  const best = sorted[0];
  const others = sorted.slice(1).map((o) => o.price);
  const avgOthers = others.length ? others.reduce((s, x) => s + x, 0) / others.length : null;
  const spreadPct = avgOthers ? Math.round(((avgOthers - best.price) / avgOthers) * 100) : 0;
  const discount = Math.max(0, ...product.prices.map(discountPercent));
  const drop = drops?.get?.(product.slug) ?? null;
  const updatedAt = product.prices.map((o) => o.updatedAt).filter(Boolean).sort().pop() ?? null;
  return {
    offers: [...product.prices].sort((a, b) => (a.inStock === false) - (b.inStock === false) || a.price - b.price),
    best, worst: sorted[sorted.length - 1], spreadPct, discount, drop,
    available: live.length > 0, liveCount: live.length, total: product.prices.length,
    /* "cheapest" is only claimed when 2+ in-stock offers exist and at least one costs more */
    cheapestVerified: live.length > 1 && sorted[sorted.length - 1].price > best.price,
    savingVsWorst: sorted[sorted.length - 1].price - best.price,
    unit: unitPriceOf(product),
    fresh: freshness(best.updatedAt ?? updatedAt),
  };
}

/** Cost of a cart/list at each chain, honoring promos and stock. */
export function storeTotals(lines) {
  const chains = [...new Set(lines.flatMap((l) => l.product.prices.map((o) => o.store)))];
  return chains.map((chain) => {
    let total = 0, regular = 0, covered = 0;
    const missing = [];
    for (const { product, qty } of lines) {
      const o = product.prices.filter((x) => x.store === chain && x.inStock !== false).sort((a, b) => a.price - b.price)[0];
      if (!o) { missing.push(product.slug); continue; }
      const { cost } = lineCost(o, qty);
      total += cost; regular += (o.oldPrice && o.oldPrice > o.price ? o.oldPrice : o.price) * qty; covered++;
    }
    return { chain, total, regular, covered, missing, complete: missing.length === 0 };
  }).sort((a, b) => Number(b.complete) - Number(a.complete) || a.total - b.total);
}

/**
 * Cart totals for either the cheapest mix ("mix") or a single chain.
 * Only real offer data: promos via lineCost, availability via inStock.
 */
export function cartBreakdown(lines, mode = "mix") {
  const rows = [], missing = [];
  for (const line of lines) {
    const live = line.product.prices.filter((o) => o.inStock !== false && (mode === "mix" || o.store === mode));
    if (!live.length) { missing.push(line); continue; }
    let pick = null;
    for (const o of live) {
      const c = lineCost(o, line.qty);
      if (!pick || c.cost < pick.cost) pick = { offer: o, cost: c.cost, promo: c.promo };
    }
    const regular = (pick.offer.oldPrice && pick.offer.oldPrice > pick.offer.price ? pick.offer.oldPrice : pick.offer.price) * line.qty;
    rows.push({ line, offer: pick.offer, promo: pick.promo, cost: pick.cost, regular });
  }
  const total = rows.reduce((s, r) => s + r.cost, 0);
  const regular = rows.reduce((s, r) => s + r.regular, 0);
  return { rows, missing, total, regular, discount: Math.max(0, regular - total), stores: [...new Set(rows.map((r) => r.offer.store))] };
}
