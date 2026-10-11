/*
 * Ingestion pipeline: adapter -> normalization -> canonical product -> price DB.
 * Writes: products, offers, price_history, stores, match_review, ingest_runs.
 */
import { normalizeOffer, validateStore } from "../shared/adapters/index.js";
import { matchProduct } from "../shared/core/matching.js";

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const HISTORY_MIN_GAP_MS = 6 * 3600000;

export async function ensureIndexes(db) {
  await db.collection("offers").createIndex({ slug: 1 });
  await db.collection("price_history").createIndex({ slug: 1, store: 1, ts: -1 });
  await db.collection("products").createIndex({ canonicalKey: 1 });
  await db.collection("stores").createIndex({ chain: 1 });
}

export async function runIngest(db, adapter, { signal, log = console } = {}) {
  const started = new Date();
  const stats = { adapter: adapter.id, products: 0, matched: 0, created: 0, review: 0, rejected: 0, stores: 0, historyPoints: 0 };
  const rejections = {};
  const products = db.collection("products"), offers = db.collection("offers"), history = db.collection("price_history");

  const catalog = await products.find({}).toArray();
  const byKey = new Map(catalog.map((p) => [p.canonicalKey, p]));

  // Stores
  try {
    for await (const rows of adapter.fetchStores({ signal })) {
      const ops = [];
      for (const raw of rows) {
        const s = adapter.mapStore(raw);
        if (!validateStore(s).ok) continue;
        ops.push({ updateOne: { filter: { _id: `${adapter.chain}:${s.id}` }, update: { $set: { chain: adapter.chain, storeId: s.id, name: s.name, address: s.address ?? null, lat: s.lat, lng: s.lng, hours: s.hours ?? null, phone: s.phone ?? null, adapter: adapter.id, updatedAt: new Date() } }, upsert: true } });
      }
      if (ops.length) { await db.collection("stores").bulkWrite(ops); stats.stores += ops.length; }
    }
  } catch (e) { log.warn?.(`[${adapter.id}] stores skipped: ${e.message}`); }

  for await (const rows of adapter.fetchProducts({ signal })) {
    for (const raw of rows) {
      stats.products++;
      const n = normalizeOffer(adapter.mapProduct(raw), adapter.chain);
      if (!n.ok) { stats.rejected++; for (const e of n.errors) rejections[e] = (rejections[e] ?? 0) + 1; continue; }
      const o = n.offer;

      let product = byKey.get(o.canonicalKey);
      if (!product) {
        const m = matchProduct(o, catalog);
        if (m.match) { product = m.match; stats.matched++; }
        else if (m.reason === "ambiguous") {
          stats.review++;
          await db.collection("match_review").updateOne({ _id: `${adapter.id}:${o.sourceId}` }, { $set: { offer: o, candidate: m.candidate?.slug, confidence: m.confidence, createdAt: new Date() } }, { upsert: true });
          continue;
        }
      } else stats.matched++;

      if (!product) {
        let slug = slugify(o.name), i = 2;
        while (catalog.some((p) => p.slug === slug)) slug = `${slugify(o.name)}-${i++}`;
        product = { _id: slug, slug, name: o.name, brand: o.brand, category: o.category, unit: o.unit, size: o.size, canonicalKey: o.canonicalKey, image: o.image, description: "", createdAt: new Date() };
        await products.insertOne(product);
        catalog.push(product); byKey.set(product.canonicalKey, product); stats.created++;
      } else if (!product.image && o.image) {
        await products.updateOne({ _id: product._id }, { $set: { image: o.image } });
        product.image = o.image;
      }

      const id = `${product.slug}|${adapter.chain}|${o.storeId ?? "*"}`;
      const prev = await offers.findOne({ _id: id });
      if (prev && prev.updatedAt >= new Date(o.updatedAt)) continue; // stale payload
      await offers.updateOne({ _id: id }, { $set: { slug: product.slug, store: adapter.chain, storeId: o.storeId, sourceId: o.sourceId, price: o.price, oldPrice: o.oldPrice, inStock: o.inStock ?? null, stockQty: o.stockQty, promos: o.promos, url: o.url, adapter: adapter.id, updatedAt: new Date(o.updatedAt) } }, { upsert: true });

      const last = await history.find({ slug: product.slug, store: adapter.chain }).sort({ ts: -1 }).limit(1).next();
      if (!last || last.price !== o.price || new Date(o.updatedAt) - last.ts > HISTORY_MIN_GAP_MS) {
        await history.insertOne({ slug: product.slug, store: adapter.chain, price: o.price, ts: new Date(o.updatedAt) });
        stats.historyPoints++;
      }
    }
  }
  const run = { ...stats, rejections, startedAt: started, finishedAt: new Date() };
  await db.collection("ingest_runs").insertOne(run);
  return run;
}
