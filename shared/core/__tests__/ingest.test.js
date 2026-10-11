import test from "node:test";
import assert from "node:assert/strict";
import { runIngest } from "../../../server/ingest.js";
import { createHttpAdapter } from "../../adapters/index.js";

/* Minimal in-memory stand-in for the MongoDB driver surface used by runIngest. */
function fakeDb() {
  const cols = new Map();
  const match = (doc, q) => Object.entries(q).every(([k, v]) => (v && typeof v === "object" && "$gte" in v ? doc[k] >= v.$gte : doc[k] === v));
  const col = (name) => {
    if (!cols.has(name)) cols.set(name, []);
    const rows = cols.get(name);
    const cursor = (list) => ({ sort: (s) => { const [[k, d]] = Object.entries(s); return cursor([...list].sort((a, b) => (a[k] > b[k] ? 1 : -1) * d)); }, limit: (n) => cursor(list.slice(0, n)), next: async () => list[0] ?? null, toArray: async () => list });
    const upsert = (filter, update) => {
      let doc = rows.find((r) => match(r, filter));
      if (!doc) { doc = { ...filter }; rows.push(doc); }
      Object.assign(doc, update.$set ?? {});
    };
    return {
      rows, createIndex: async () => {}, find: (q = {}) => cursor(rows.filter((r) => match(r, q))), findOne: async (q) => rows.find((r) => match(r, q)) ?? null,
      insertOne: async (d) => { rows.push({ ...d }); }, updateOne: async (f, u) => upsert(f, u),
      bulkWrite: async (ops) => ops.forEach((o) => upsert(o.updateOne.filter, o.updateOne.update)),
    };
  };
  return { collection: col };
}

const mk = (rows, stores = []) => createHttpAdapter({
  id: "t", chain: "Korzinka", baseUrl: "https://x.test", pageSize: 100,
  fetchImpl: async (url) => ({ ok: true, json: async () => ({ items: new URL(url).pathname.endsWith("stores") ? (new URL(url).searchParams.get("page") === "1" ? stores : []) : (new URL(url).searchParams.get("page") === "1" ? rows : []) }) }),
});

test("ingest: creates canonical product, merges variants across chains, tracks history, rejects bad rows", async () => {
  const db = fakeDb();
  const ago = (h) => new Date(Date.now() - h * 3600000).toISOString();
  const t0 = ago(30);
  const kor = mk([
    { id: "k1", name: "Coca-Cola 1.5L", price: 12490, old_price: 14000, in_stock: true, updated_at: t0 },
    { id: "k2", name: "Bad", price: -5, updated_at: t0 },
  ], [{ id: "s1", name: "Korzinka Chilonzor", lat: 41.28, lng: 69.2 }, { id: "s2", name: "no coords" }]);
  const r1 = await runIngest(db, kor, { log: { warn() {} } });
  assert.equal(r1.created, 1); assert.equal(r1.rejected, 1); assert.equal(r1.stores, 1);
  assert.equal(db.collection("products").rows.length, 1);

  // other chain, different spelling / script -> must attach to the SAME product
  const hav = createHttpAdapter({ id: "h", chain: "Havas", baseUrl: "https://y.test", pageSize: 100, fetchImpl: async (u) => ({ ok: true, json: async () => ({ items: new URL(u).pathname.endsWith("stores") ? [] : new URL(u).searchParams.get("page") === "1" ? [{ id: "h9", name: "Кока Кола 1500 мл", price: 13200, updated_at: ago(20) }] : [] }) }) });
  const r2 = await runIngest(db, hav, { log: { warn() {} } });
  assert.equal(r2.created, 0); assert.equal(r2.matched, 1);
  assert.equal(db.collection("products").rows.length, 1);
  assert.equal(db.collection("offers").rows.length, 2);

  // price change -> new history point; same payload again -> nothing new (stale/unchanged)
  const kor2 = mk([{ id: "k1", name: "Coca-Cola 1.5L", price: 11900, updated_at: ago(10) }]);
  const before = db.collection("price_history").rows.length;
  await runIngest(db, kor2, { log: { warn() {} } });
  assert.equal(db.collection("price_history").rows.length, before + 1);
  const r4 = await runIngest(db, kor2, { log: { warn() {} } });
  assert.equal(db.collection("price_history").rows.length, before + 1);
  assert.equal(r4.historyPoints, 0);
});
