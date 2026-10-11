/*
 * Promotion engine (per store offer).
 *
 * offer.price         regular unit price
 * offer.promos[]      any of:
 *   { type: "multibuy", minQty, unitPrice }   buy >= minQty -> every unit costs unitPrice
 *   { type: "percent",  minQty, percent }     buy >= minQty -> percent off every unit
 *   { type: "bundle",   qty, price }          qty units for `price` (remainder at regular price)
 *   { type: "amount",   minQty, off }         buy >= minQty -> `off` UZS off the line total
 */

/** Cost of exactly `qty` units under the best applicable promo. */
export function lineCost(offer, qty) {
  const unit = Number(offer.price);
  let best = { cost: unit * qty, promo: null };
  for (const promo of offer.promos ?? []) {
    const cost = applyPromo(promo, unit, qty);
    if (cost != null && cost < best.cost) best = { cost, promo };
  }
  return best;
}

function applyPromo(p, unit, qty) {
  switch (p.type) {
    case "multibuy": return qty >= p.minQty ? Number(p.unitPrice) * qty : null;
    case "percent": return qty >= p.minQty ? unit * qty * (1 - p.percent / 100) : null;
    case "bundle": {
      if (qty < p.qty) return null;
      const bundles = Math.floor(qty / p.qty);
      return bundles * Number(p.price) + (qty - bundles * p.qty) * unit;
    }
    case "amount": return qty >= p.minQty ? Math.max(0, unit * qty - Number(p.off)) : null;
    default: return null;
  }
}

/**
 * Finds the cheapest way to cover `needed` units. When overbuy is allowed,
 * buying a few extra units can be cheaper than the exact amount
 * (e.g. 3-for-X is cheaper than 2 regular units).
 */
export function bestQuantity(offer, needed, { allowOverbuy = true, maxExtra = 3 } = {}) {
  const exact = lineCost(offer, needed);
  let best = { qty: needed, cost: exact.cost, promo: exact.promo, extra: 0 };
  if (allowOverbuy) {
    for (let q = needed + 1; q <= needed + maxExtra; q++) {
      const c = lineCost(offer, q);
      if (c.cost < best.cost - 1e-9) best = { qty: q, cost: c.cost, promo: c.promo, extra: q - needed };
    }
  }
  return {
    ...best,
    regularCost: Number(offer.price) * needed,
    saving: Number(offer.price) * needed - best.cost,
  };
}

/** Effective price per *needed* unit after promotions. */
export const effectiveUnitCost = (offer, needed, opts) => bestQuantity(offer, needed, opts).cost / needed;

/** Discount % relative to the old/regular price, if known. */
export function discountPercent(offer) {
  const old = Number(offer.oldPrice);
  const cur = Number(offer.price);
  return old > cur ? Math.round(((old - cur) / old) * 100) : 0;
}
