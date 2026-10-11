/*
 * Canonical product identity + search.
 *
 * canonicalKey: brand + variant tokens + normalized size
 *   "Coca Cola 1.5L" == "Coca-Cola 1500 ml" == "Кока Кола 1,5 л"
 */
import { extractBrand, tokenize, conceptOf, tokenSimilarity, recognizeCategory, normalizeText } from "./text.js";
import { parseSize } from "./units.js";

const NOISE = new Set(["the", "va", "i", "dona", "pcs", "l", "ml", "g", "kg", "gr", "lt"]);

/** Removes size words/numbers so only the product identity tokens remain. */
function identityTokens(rest) {
  return rest
    .split(" ")
    .filter((t) => t && !/^\d+(\.\d+)?$/.test(t) && !NOISE.has(t) && !/^\d+(\.\d+)?(kg|g|gr|l|ml|d|dona)$/.test(t));
}

export function describeProduct(name, unitHint = "") {
  const size = parseSize(name) || parseSize(unitHint);
  const { brand, rest } = extractBrand(stripSize(name));
  const tokens = identityTokens(rest).map(conceptOf).sort();
  const key = [brand ? brand.toLowerCase() : "", ...tokens, size ? `${size.dimension}:${Math.round(size.base * 1000) / 1000}` : "nosize"]
    .filter(Boolean)
    .join("|");
  return { brand, tokens, size, canonicalKey: key, category: recognizeCategory(name) };
}

function stripSize(name) {
  return String(name).replace(/(\d+\s*x\s*)?\d+(?:[.,]\d+)?\s*(kg|kgs|g|gr|gm|l|lt|ml|dona|d|pcs|шт|кг|гр|г|мл|л)\b\.?/giu, " ");
}

/**
 * Decides whether a raw offer belongs to an existing canonical product.
 * Returns { match, confidence, reason }; ambiguous cases are reported so
 * ingestion can queue them for review instead of silently merging.
 */
export function matchProduct(candidate, catalog, { threshold = 0.82 } = {}) {
  const c = candidate.canonicalKey ? candidate : { ...candidate, ...describeProduct(candidate.name, candidate.unit) };
  let best = null, second = 0;
  for (const p of catalog) {
    const d = p._desc ?? (p._desc = describeProduct(p.name, p.unit));
    if (d.canonicalKey === c.canonicalKey) return { match: p, confidence: 1, reason: "exact-key" };
    if (!sameSize(d.size, c.size)) continue;
    if ((d.brand || c.brand) && d.brand !== c.brand) continue;
    const score = setSimilarity(d.tokens, c.tokens);
    if (!best || score > best.score) { second = best?.score ?? 0; best = { p, score }; }
    else if (score > second) second = score;
  }
  if (best && best.score >= threshold && best.score - second > 0.05)
    return { match: best.p, confidence: best.score, reason: "fuzzy" };
  if (best && best.score >= 0.6) return { match: null, confidence: best.score, reason: "ambiguous", candidate: best.p };
  return { match: null, confidence: 0, reason: "new-product" };
}

const sameSize = (a, b) =>
  !a || !b ? !a && !b : a.dimension === b.dimension && Math.abs(a.base - b.base) < 1e-6;

function setSimilarity(a, b) {
  if (!a.length && !b.length) return 1;
  if (!a.length || !b.length) return 0;
  let total = 0;
  for (const t of a) total += Math.max(0, ...b.map((u) => tokenSimilarity(t, u)));
  return total / Math.max(a.length, b.length);
}

/* ------------------------------ Search ------------------------------ */
const CHEAP_WORDS = new Set(["cheapest", "cheap", "arzon", "eng", "deshevo", "deshevyy", "deshevyi", "dishevo", "low", "lowest", "самый", "дешево", "дешевый", "арзон"].map((w) => tokenize(w)[0]));
const DROP_WORDS = new Set(["for", "the", "eng", "самый", "samyy", "samyi", "in", "the"].map((w) => tokenize(w)[0]));

/** Natural query -> { terms, size, cheapest, category } */
export function parseQuery(q = "") {
  const size = parseSize(q);
  const toks = tokenize(stripSize(q));
  const cheapest = toks.some((t) => CHEAP_WORDS.has(t));
  const terms = toks.filter((t) => !CHEAP_WORDS.has(t) && !DROP_WORDS.has(t) && !/^\d+(\.\d+)?$/.test(t) && t.length > 0);
  return { terms, size, cheapest, category: recognizeCategory(q), raw: q };
}

/** Builds a reusable index; call once per catalog change. */
export function buildSearchIndex(products) {
  return products.map((p) => {
    const d = describeProduct(p.name, p.unit);
    const text = [p.name, p.brand, p.category, p.description].filter(Boolean).join(" ");
    const tokens = [...new Set(tokenize(text))];
    return { product: p, desc: d, tokens, concepts: new Set(tokens.map(conceptOf)), nameTokens: tokenize(p.name) };
  });
}

/** Ranked fuzzy search with typo tolerance, synonyms and unit filter. */
export function searchProducts(index, query, { limit = 50 } = {}) {
  const q = typeof query === "string" ? parseQuery(query) : query;
  if (!q.terms.length && !q.size && !q.category) return { query: q, results: [] };
  const results = [];
  for (const row of index) {
    let score = 0, matched = 0;
    for (const term of q.terms) {
      const concept = conceptOf(term);
      let best = row.concepts.has(concept) ? 0.95 : 0;
      if (!best) for (const tok of row.nameTokens) best = Math.max(best, tokenSimilarity(term, tok));
      if (!best) for (const tok of row.tokens) best = Math.max(best, tokenSimilarity(term, tok) * 0.8);
      if (best > 0) matched++;
      score += best;
    }
    if (q.terms.length && matched < Math.ceil(q.terms.length / 2)) continue;
    if (!q.terms.length && q.category && row.desc.category !== q.category && row.product.category !== q.category) continue;
    let s = q.terms.length ? score / q.terms.length : 0.5;
    if (q.size) {
      if (row.desc.size && row.desc.size.dimension === q.size.dimension && Math.abs(row.desc.size.base - q.size.base) < 1e-6) s += 0.25;
      else if (q.terms.length) s -= 0.2;
    }
    if (s > 0.3) results.push({ product: row.product, score: s });
  }
  results.sort((a, b) => b.score - a.score);
  let out = results.slice(0, limit);
  if (q.cheapest) {
    const cheapestOf = (p) => Math.min(...p.prices.map((x) => Number(x.price)));
    out = [...out].sort((a, b) => (Math.abs(b.score - a.score) > 0.35 ? b.score - a.score : cheapestOf(a.product) - cheapestOf(b.product)));
  }
  return { query: q, results: out };
}

export { normalizeText };
