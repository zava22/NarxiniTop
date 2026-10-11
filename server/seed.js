/* Imports src/data/products.json into MongoDB (products + offers + first price-history point).
 * Default: only adds what is missing, so edits made in the admin panel are never overwritten.
 * overwrite=true refreshes every product/offer found in the file. */
import fs from "node:fs";
import { describeProduct } from "../shared/core/matching.js";

const FILE = new URL("../src/data/products.json", import.meta.url);

export function readProductsFile() {
  const list = JSON.parse(fs.readFileSync(FILE, "utf8"));
  return Array.isArray(list) ? list : [];
}

export async function seedProducts(db, { overwrite = false } = {}) {
  const products = db.collection("products"), offers = db.collection("offers"), history = db.collection("price_history");
  const res = { total: 0, productsAdded: 0, offersAdded: 0 };
  const now = new Date();

  for (const item of readProductsFile()) {
    if (!item?.slug || !item?.name) continue;
    res.total++;
    const d = describeProduct(item.name, item.unit ?? "");
    const doc = { slug: item.slug, name: item.name, brand: d.brand ?? null, category: item.category ?? "Boshqa", unit: item.unit ?? "", size: d.size ?? null, canonicalKey: d.canonicalKey, image: item.image ?? "", description: item.description ?? "", source: "seed" };

    const r = overwrite
      ? await products.updateOne({ _id: item.slug }, { $set: { ...doc, updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true })
      : await products.updateOne({ _id: item.slug }, { $setOnInsert: { ...doc, createdAt: now } }, { upsert: true });
    if (r.upsertedCount) res.productsAdded++;

    for (const p of item.prices ?? []) {
      if (!p?.store || !(Number(p.price) > 0)) continue;
      const odoc = { slug: item.slug, store: p.store, price: Number(p.price), oldPrice: p.oldPrice ? Number(p.oldPrice) : null, inStock: p.inStock ?? null, promos: [], adapter: "seed" };
      const id = `${item.slug}|${p.store}|*`;
      const o = overwrite
        ? await offers.updateOne({ _id: id }, { $set: { ...odoc, updatedAt: now } }, { upsert: true })
        : await offers.updateOne({ _id: id }, { $setOnInsert: { ...odoc, updatedAt: now } }, { upsert: true });
      if (o.upsertedCount) {
        res.offersAdded++;
        const has = await history.findOne({ slug: item.slug, store: p.store });
        if (!has) await history.insertOne({ slug: item.slug, store: p.store, price: odoc.price, ts: now });
      }
    }
  }
  return res;
}

/* On the very first start (empty products collection) fill the catalog from products.json. */
export async function seedIfEmpty(db, log = console) {
  if (process.env.SEED_ON_EMPTY === "false") return null;
  if (await db.collection("products").findOne({})) return null;
  const r = await seedProducts(db);
  log.log(`✅ products.json imported into MongoDB (${r.productsAdded} products, ${r.offersAdded} prices)`);
  return r;
}
