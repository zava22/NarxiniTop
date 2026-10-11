/*
 * Recommendations: similarity, cheaper alternatives, better value,
 * bought-together (market basket), personalization.
 */
import { describeProduct } from "./matching.js";
import { conceptOf } from "./text.js";
import { unitPrice } from "./units.js";

const cheapest = (p) => Math.min(...p.prices.map((x) => Number(x.price)));

function features(p) {
  const d = p._desc ?? (p._desc = describeProduct(p.name, p.unit));
  return { d, concepts: new Set(d.tokens.map(conceptOf)) };
}

const jaccard = (a, b) => {
  if (!a.size && !b.size) return 0;
  let i = 0;
  for (const x of a) if (b.has(x)) i++;
  return i / (a.size + b.size - i);
};

export function similarity(a, b) {
  if (a.slug === b.slug) return 0;
  const fa = features(a), fb = features(b);
  let s = 0.45 * jaccard(fa.concepts, fb.concepts);
  if (a.category === b.category) s += 0.25;
  if (fa.d.brand && fa.d.brand === fb.d.brand) s += 0.15;
  if (fa.d.size && fb.d.size && fa.d.size.dimension === fb.d.size.dimension) {
    const r = Math.min(fa.d.size.base, fb.d.size.base) / Math.max(fa.d.size.base, fb.d.size.base);
    s += 0.15 * r;
  }
  return s;
}

export function similarProducts(product, catalog, limit = 6) {
  return catalog
    .map((p) => ({ product: p, score: similarity(product, p) }))
    .filter((x) => x.score > 0.25)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function unitPriceOf(p) {
  const size = (p._desc ?? (p._desc = describeProduct(p.name, p.unit))).size;
  return unitPrice(cheapest(p), size);
}

/** Same kind of product, lower unit price (or checkout price when sizes unknown). */
export function cheaperAlternatives(product, catalog, limit = 4) {
  const base = unitPriceOf(product);
  return similarProducts(product, catalog, 20)
    .map(({ product: p, score }) => {
      const up = unitPriceOf(p);
      const comparable = base && up && base.dimension === up.dimension;
      const saving = comparable ? (base.value - up.value) / base.value : (cheapest(product) - cheapest(p)) / cheapest(product);
      return { product: p, score, unit: up, saving, comparable };
    })
    .filter((x) => x.saving > 0.03)
    .sort((a, b) => b.saving - a.saving)
    .slice(0, limit);
}

/** Better value = lower price per kg/L/piece within the same category. */
export function betterValue(product, catalog, limit = 4) {
  const base = unitPriceOf(product);
  if (!base) return [];
  return catalog
    .filter((p) => p.slug !== product.slug && p.category === product.category)
    .map((p) => ({ product: p, unit: unitPriceOf(p) }))
    .filter((x) => x.unit && x.unit.dimension === base.dimension && x.unit.value < base.value * 0.97)
    .map((x) => ({ ...x, saving: (base.value - x.unit.value) / base.value }))
    .sort((a, b) => b.saving - a.saving)
    .slice(0, limit);
}

/**
 * Market-basket association from baskets: [[slug, slug, ...], ...]
 * returns { support, confidence, lift } for pairs containing `slug`.
 * Only real baskets are used; with no data the result is empty.
 */
export function boughtTogether(slug, baskets, { minSupport = 2, limit = 6 } = {}) {
  const n = baskets.length;
  if (!n) return [];
  const count = new Map(), pair = new Map();
  let withSlug = 0;
  for (const b of baskets) {
    const set = new Set(b);
    for (const x of set) count.set(x, (count.get(x) ?? 0) + 1);
    if (!set.has(slug)) continue;
    withSlug++;
    for (const x of set) if (x !== slug) pair.set(x, (pair.get(x) ?? 0) + 1);
  }
  return [...pair.entries()]
    .filter(([, c]) => c >= minSupport)
    .map(([other, c]) => ({
      slug: other, support: c,
      confidence: c / withSlug,
      lift: (c / withSlug) / (count.get(other) / n),
    }))
    .sort((a, b) => b.lift * b.confidence - a.lift * a.confidence)
    .slice(0, limit);
}
