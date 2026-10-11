import test from "node:test";
import assert from "node:assert/strict";
import { createHttpAdapter, normalizeOffer, loadAdapters } from "../../adapters/index.js";

const rows = [
  { id: 7, name: "Кока Кола 1,5 л", price: "12 490", old_price: 14000, in_stock: true, store_id: "s1", updated_at: "2026-10-07T08:00:00Z" },
  { id: 8, name: "Broken", price: 0, updated_at: "2026-10-07T08:00:00Z" },
  { id: 9, name: "No time", price: 100 },
];
const fakeFetch = async (url) => ({ ok: true, json: async () => ({ items: new URL(url).searchParams.get("page") === "1" ? rows : [] }) });

test("http adapter paginates, maps and normalizes; invalid rows are rejected not repaired", async () => {
  const a = createHttpAdapter({ id: "x", chain: "Makro", baseUrl: "https://api.example/v1", apiKey: "k", fetchImpl: fakeFetch, pageSize: 3 });
  const got = [];
  for await (const page of a.fetchProducts()) got.push(...page);
  assert.equal(got.length, 3);
  const res = got.map((r) => normalizeOffer(a.mapProduct(r), "Makro", { now: Date.parse("2026-10-07T09:00:00Z") }));
  assert.equal(res[0].ok, true);
  assert.equal(res[0].offer.price, 12490);
  assert.equal(res[0].offer.oldPrice, 14000);
  assert.equal(res[0].offer.size.base, 1500);
  assert.deepEqual(res[1].errors, ["invalid-price"]);
  assert.deepEqual(res[2].errors, ["missing-timestamp"]);
});

test("adapters only load when configured", () => {
  assert.equal(loadAdapters({}).length, 0);
  const l = loadAdapters({ HAVAS_API_URL: "https://h.example", HAVAS_PRODUCT_MAP: '{"price":"cost"}' });
  assert.equal(l[0].chain, "Havas");
  assert.equal(l[0].mapProduct({ id: 1, name: "a", cost: 5 }).price, 5);
});
