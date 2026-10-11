/*
 * Price intelligence over price history.
 * history: [{ ts: ISO|ms, price: number, store?: string }]
 * All outputs say how much data they rest on; nothing is invented when
 * history is too short (functions return null / "insufficient").
 */
const DAY = 86400000;
const toMs = (t) => (typeof t === "number" ? t : Date.parse(t));

const clean = (history) =>
  history
    .map((h) => ({ ts: toMs(h.ts), price: Number(h.price), store: h.store }))
    .filter((h) => Number.isFinite(h.ts) && Number.isFinite(h.price) && h.price > 0)
    .sort((a, b) => a.ts - b.ts);

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const quantile = (sorted, q) => {
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};

export function priceStats(history, { days = 30, now = Date.now() } = {}) {
  const h = clean(history).filter((x) => x.ts >= now - days * DAY);
  if (!h.length) return null;
  const prices = h.map((x) => x.price);
  const sorted = [...prices].sort((a, b) => a - b);
  return {
    count: h.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: mean(prices),
    median: quantile(sorted, 0.5),
    p25: quantile(sorted, 0.25),
    p75: quantile(sorted, 0.75),
    first: h[0].price,
    last: h[h.length - 1].price,
  };
}

/** Least-squares slope, returned as % of mean price per week. */
export function priceTrend(history, { days = 30, now = Date.now() } = {}) {
  const h = clean(history).filter((x) => x.ts >= now - days * DAY);
  if (h.length < 4) return { direction: "unknown", slopePctPerWeek: null, points: h.length };
  const xs = h.map((p) => (p.ts - h[0].ts) / DAY), ys = h.map((p) => p.price);
  const mx = mean(xs), my = mean(ys);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  if (den === 0) return { direction: "flat", slopePctPerWeek: 0, points: h.length };
  const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / den;
  const pct = ((slope * 7) / my) * 100;
  return { direction: pct > 0.7 ? "up" : pct < -0.7 ? "down" : "flat", slopePctPerWeek: pct, points: h.length, slope, intercept: my - slope * mx, t0: h[0].ts };
}

/** Latest change vs the previous different price. */
export function detectPriceDrop(history, { minPercent = 3 } = {}) {
  const h = clean(history);
  if (h.length < 2) return null;
  const last = h[h.length - 1];
  let prev = null;
  for (let i = h.length - 2; i >= 0; i--) if (h[i].price !== last.price) { prev = h[i]; break; }
  if (!prev) return null;
  const pct = ((prev.price - last.price) / prev.price) * 100;
  if (pct < minPercent) return null;
  return { from: prev.price, to: last.price, percent: Math.round(pct * 10) / 10, at: last.ts };
}

/** Robust (median/MAD) anomaly flags. */
export function detectAnomalies(history, { z = 3.5 } = {}) {
  const h = clean(history);
  if (h.length < 8) return [];
  const sorted = h.map((x) => x.price).sort((a, b) => a - b);
  const med = quantile(sorted, 0.5);
  const mad = quantile(sorted.map((p) => Math.abs(p - med)).sort((a, b) => a - b), 0.5) || 1e-9;
  return h
    .map((p) => ({ ...p, score: (0.6745 * (p.price - med)) / mad }))
    .filter((p) => Math.abs(p.score) > z)
    .map((p) => ({ ts: p.ts, price: p.price, kind: p.score > 0 ? "spike" : "dip", score: Math.round(p.score * 10) / 10 }));
}

/**
 * Deal score 0-100.
 *   45% vs 30-day average, 35% position inside historical range,
 *   20% vs the other stores right now.
 * `confidence` (0-1) reflects how much history supports the score.
 */
export function dealScore({ current, history = [], otherPrices = [], now = Date.now() }) {
  const st = priceStats(history, { days: 30, now });
  const all = priceStats(history, { days: 365, now });
  const parts = [];
  if (st && st.avg > 0) parts.push([0.45, clamp01(0.5 + (st.avg - current) / st.avg / 0.2)]);
  if (all && all.max > all.min) parts.push([0.35, clamp01((all.max - current) / (all.max - all.min))]);
  if (otherPrices.length) {
    const avgOther = mean(otherPrices);
    parts.push([0.2, clamp01(0.5 + (avgOther - current) / avgOther / 0.2)]);
  }
  if (!parts.length) return { score: null, confidence: 0, label: "insufficient" };
  const wsum = parts.reduce((s, [w]) => s + w, 0);
  const score = Math.round((parts.reduce((s, [w, v]) => s + w * v, 0) / wsum) * 100);
  const n = st?.count ?? 0;
  const confidence = Math.min(1, n / 20) * 0.7 + (otherPrices.length ? 0.3 : 0);
  return {
    score,
    confidence: Math.round(confidence * 100) / 100,
    label: score >= 80 ? "great" : score >= 60 ? "good" : score >= 40 ? "fair" : "poor",
    stats: st && { avg30: st.avg, min30: st.min, max30: st.max, minAll: all?.min },
  };
}

/** Linear forecast with residual-based band; refuses when data is thin. */
export function forecastPrice(history, { horizonDays = 7, now = Date.now(), minPoints = 8 } = {}) {
  const h = clean(history).filter((x) => x.ts >= now - 60 * DAY);
  if (h.length < minPoints) return { status: "insufficient", points: h.length };
  const tr = priceTrend(h, { days: 60, now });
  if (tr.slope == null) return { status: "insufficient", points: h.length };
  const x = (now + horizonDays * DAY - tr.t0) / DAY;
  const predicted = tr.intercept + tr.slope * x;
  const resid = h.map((p) => p.price - (tr.intercept + tr.slope * ((p.ts - tr.t0) / DAY)));
  const sd = Math.sqrt(mean(resid.map((r) => r * r)));
  const last = h[h.length - 1].price;
  return {
    status: "ok",
    horizonDays,
    predicted: Math.max(0, Math.round(predicted)),
    low: Math.max(0, Math.round(predicted - 1.96 * sd)),
    high: Math.round(predicted + 1.96 * sd),
    changePercent: Math.round(((predicted - last) / last) * 1000) / 10,
    points: h.length,
    note: "statistical estimate, not a guarantee",
  };
}

/** Buy now / wait / neutral. */
export function buyAdvice({ current, history, now = Date.now() }) {
  const st = priceStats(history, { days: 60, now });
  const tr = priceTrend(history, { days: 30, now });
  if (!st || st.count < 5) return { advice: "unknown", reason: "insufficient-history" };
  if (current <= st.p25 && tr.direction !== "down") return { advice: "buy", reason: "low-in-range" };
  if (tr.direction === "down" && tr.slopePctPerWeek < -2) return { advice: "wait", reason: "falling" };
  if (current >= st.p75) return { advice: "wait", reason: "high-in-range" };
  return { advice: "neutral", reason: "mid-range" };
}

/** Reliability of a displayed price: freshness + history depth + store agreement. */
export function priceConfidence({ updatedAt, historyCount = 0, prices = [], now = Date.now() }) {
  const age = updatedAt ? (now - toMs(updatedAt)) / 3600000 : Infinity; // hours
  const fresh = age <= 6 ? 1 : age <= 24 ? 0.75 : age <= 72 ? 0.4 : 0.1;
  const depth = Math.min(1, historyCount / 10);
  let agree = 0.7;
  if (prices.length > 2) {
    const m = mean(prices), sd = Math.sqrt(mean(prices.map((p) => (p - m) ** 2)));
    agree = clamp01(1 - sd / m / 0.5);
  }
  const score = Math.round((fresh * 0.5 + depth * 0.25 + agree * 0.25) * 100) / 100;
  return { score, level: score >= 0.75 ? "high" : score >= 0.45 ? "medium" : "low", ageHours: Number.isFinite(age) ? age : null };
}

/** "You are overpaying" for a purchase. */
export function overpayment({ paid, qty = 1, cheapestNow }) {
  const diff = (paid - cheapestNow) * qty;
  return { overpaid: diff > 0, amount: Math.max(0, diff), percent: cheapestNow > 0 ? Math.max(0, ((paid - cheapestNow) / cheapestNow) * 100) : 0 };
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** "Updated 15 min ago" parts for i18n: { unit: "min"|"h"|"d", value } */
export function freshness(updatedAt, now = Date.now()) {
  if (!updatedAt) return null;
  const mins = Math.max(0, Math.round((now - toMs(updatedAt)) / 60000));
  if (mins < 1) return { unit: "now", value: 0, stale: false };
  if (mins < 60) return { unit: "min", value: mins, stale: false };
  if (mins < 1440) return { unit: "h", value: Math.round(mins / 60), stale: mins > 720 };
  return { unit: "d", value: Math.round(mins / 1440), stale: true };
}
