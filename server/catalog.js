/* Catalog / store / history / ingest HTTP routes (mounted from index.js). */
import { buildSearchIndex, searchProducts } from "../shared/core/matching.js";
import { loadAdapters } from "../shared/adapters/index.js";
import { runIngest } from "./ingest.js";

export function registerCatalogRoutes(app, getDb) {
  const wrap = (fn) => async (req, res) => {
    try { await fn(req, res); } catch (e) { console.error(e); res.status(500).json({ success: false, message: "Server error" }); }
  };

  async function loadCatalog(db) {
    const [products, offers] = await Promise.all([db.collection("products").find({}).toArray(), db.collection("offers").find({}).toArray()]);
    const bySlug = new Map();
    for (const o of offers) (bySlug.get(o.slug) ?? bySlug.set(o.slug, []).get(o.slug)).push({ store: o.store, storeId: o.storeId, price: o.price, oldPrice: o.oldPrice ?? undefined, inStock: o.inStock ?? undefined, promos: o.promos ?? [], updatedAt: o.updatedAt?.toISOString?.() ?? o.updatedAt, url: o.url });
    return products.map((p) => ({ id: p.slug, slug: p.slug, name: p.name, brand: p.brand, category: p.category, unit: p.unit, image: p.image, description: p.description, prices: bySlug.get(p.slug) ?? [] })).filter((p) => p.prices.length);
  }

  let cache = null;
  const getCatalog = async () => {
    if (!cache || Date.now() - cache.at > 30000) {
      const products = await loadCatalog(getDb());
      cache = { at: Date.now(), products, index: buildSearchIndex(products) };
    }
    return cache;
  };

  app.get("/api/catalog", wrap(async (req, res) => {
    const { products } = await getCatalog();
    const limit = Math.min(Number(req.query.limit) || 1000, 2000), offset = Number(req.query.offset) || 0;
    res.json({ success: true, source: "live", generatedAt: new Date().toISOString(), total: products.length, products: products.slice(offset, offset + limit) });
  }));

  app.get("/api/search", wrap(async (req, res) => {
    const { index } = await getCatalog();
    const { query, results } = searchProducts(index, String(req.query.q ?? ""), { limit: 60 });
    res.json({ success: true, query, results: results.map((r) => ({ slug: r.product.slug, score: r.score })) });
  }));

  app.get("/api/products/:slug/history", wrap(async (req, res) => {
    const days = Math.min(Number(req.query.days) || 90, 730);
    const rows = await getDb().collection("price_history").find({ slug: req.params.slug, ts: { $gte: new Date(Date.now() - days * 86400000) } }).sort({ ts: 1 }).limit(5000).toArray();
    res.json({ success: true, history: rows.map((r) => ({ ts: r.ts.toISOString(), price: r.price, store: r.store })) });
  }));

  app.get("/api/stores", wrap(async (req, res) => {
    const q = req.query.chain ? { chain: String(req.query.chain) } : {};
    const rows = await getDb().collection("stores").find(q).limit(5000).toArray();
    res.json({ success: true, stores: rows.map((s) => ({ id: s.storeId, chain: s.chain, name: s.name, address: s.address, lat: s.lat, lng: s.lng, hours: s.hours, phone: s.phone })) });
  }));

  /* Real price drops (last 14 days, >=3%) and trending (views/cart/favorites, last 7 days). */
  app.get("/api/insights", wrap(async (req, res) => {
    const db = getDb();
    const since = new Date(Date.now() - 14 * 86400000);
    const rows = await db.collection("price_history").find({ ts: { $gte: since } }).sort({ ts: 1 }).limit(50000).toArray();
    const last = new Map();
    for (const r of rows) {
      const k = `${r.slug}|${r.store}`, cur = last.get(k) ?? { first: r, prev: null, now: null };
      if (!cur.now || cur.now.price !== r.price) cur.prev = cur.now ?? cur.first;
      cur.now = r; last.set(k, cur);
    }
    const best = new Map();
    for (const [, v] of last) {
      if (!v.prev || v.now.price >= v.prev.price) continue;
      const percent = Math.round(((v.prev.price - v.now.price) / v.prev.price) * 1000) / 10;
      if (percent < 3) continue;
      const cur = best.get(v.now.slug);
      if (!cur || percent > cur.percent) best.set(v.now.slug, { slug: v.now.slug, store: v.now.store, from: v.prev.price, to: v.now.price, percent, at: v.now.ts.toISOString() });
    }
    const w = { view: 1, cart: 3, favorite: 4 };
    const ev = await db.collection("product_events").find({ day: { $gte: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10) } }).toArray();
    const score = new Map();
    for (const e of ev) score.set(e.slug, (score.get(e.slug) ?? 0) + (w[e.type] ?? 0) * e.count);
    res.json({
      success: true,
      drops: [...best.values()].sort((a, b) => b.percent - a.percent).slice(0, 40),
      trending: [...score.entries()].filter(([, s]) => s >= 3).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([slug, s]) => ({ slug, score: s })),
    });
  }));

  const seen = new Map(); // naive per-IP throttle: 60 events / minute
  app.post("/api/events", wrap(async (req, res) => {
    const ip = req.ip, now = Date.now(), hits = (seen.get(ip) ?? []).filter((t) => now - t < 60000);
    if (hits.length >= 60) return res.status(429).end();
    seen.set(ip, [...hits, now]);
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { slug, type } = body ?? {};
    if (typeof slug !== "string" || slug.length > 120 || !["view", "cart", "favorite"].includes(type)) return res.status(400).end();
    const day = new Date().toISOString().slice(0, 10);
    await getDb().collection("product_events").updateOne({ _id: `${day}|${slug}|${type}` }, { $inc: { count: 1 }, $set: { slug, type, day } }, { upsert: true });
    res.status(204).end();
  }));

  // Protected ingestion trigger (cron / admin). Disabled when INGEST_TOKEN is unset.
  app.post("/api/ingest/:adapter", wrap(async (req, res) => {
    const token = process.env.INGEST_TOKEN;
    if (!token || req.get("x-ingest-token") !== token) return res.status(403).json({ success: false, message: "Forbidden" });
    const adapter = loadAdapters().find((a) => a.id === req.params.adapter);
    if (!adapter) return res.status(404).json({ success: false, message: "Adapter not configured" });
    const run = await runIngest(getDb(), adapter);
    cache = null;
    res.json({ success: true, run });
  }));

  return { invalidate: () => { cache = null; } };
}

export function startIngestScheduler(getDb) {
  const minutes = Number(process.env.INGEST_INTERVAL_MINUTES);
  if (!minutes) return;
  setInterval(async () => {
    for (const a of loadAdapters()) {
      try { await runIngest(getDb(), a); } catch (e) { console.error(`ingest ${a.id} failed:`, e.message); }
    }
  }, minutes * 60000);
  console.log(`✅ Ingest scheduler every ${minutes} min (${loadAdapters().map((a) => a.id).join(", ") || "no adapters configured"})`);
}
