import test from "node:test";
import assert from "node:assert/strict";
import { describeProduct, matchProduct, buildSearchIndex, searchProducts, parseQuery } from "../matching.js";
import { parseSize, unitPrice, bestValue } from "../units.js";
import { bestQuantity, lineCost } from "../promotions.js";
import { dealScore, priceTrend, detectPriceDrop, detectAnomalies, forecastPrice, freshness } from "../priceIntel.js";
import { haversineKm, nearestStores } from "../geo.js";
import { boughtTogether, cheaperAlternatives } from "../recommend.js";
import products from "../../../src/data/products.json" with { type: "json" };

test("same canonical key for spelling/script variants", () => {
  const keys = ["Coca Cola 1.5L", "Coca-Cola 1500 ml", "Coca Cola 1,5 л", "Кока Кола 1.5л"].map((n) => describeProduct(n).canonicalKey);
  assert.equal(new Set(keys).size, 1, keys.join(" / "));
  assert.notEqual(describeProduct("Coca-Cola 1L").canonicalKey, keys[0]);
  assert.notEqual(describeProduct("Pepsi 1.5L").canonicalKey, keys[0]);
});

test("size parsing", () => {
  assert.equal(parseSize("1500 ml").base, 1500);
  assert.equal(parseSize("1,5 л").base, 1500);
  assert.equal(parseSize("6x330ml").base, 1980);
  assert.equal(parseSize("Non Buhanka 1d").dimension, "count");
  assert.equal(parseSize("no size here"), null);
});

test("unit price: 500g @15000 vs 1kg @23000", () => {
  const a = unitPrice(15000, parseSize("500g")), b = unitPrice(23000, parseSize("1kg"));
  assert.equal(a.value, 30000);
  assert.equal(b.value, 23000);
  assert.equal(bestValue([{ id: "a", unit: a }, { id: "b", unit: b }]).id, "b");
});

test("matching: exact + new product + ambiguous", () => {
  const cat = [{ name: "Coca-Cola 1.5L", unit: "1.5 L" }];
  assert.equal(matchProduct({ name: "Кока Кола 1,5 л" }, cat).reason, "exact-key");
  assert.equal(matchProduct({ name: "Pepsi 1.5L" }, cat).match, null);
});

test("search: typos, synonyms, scripts, intent", () => {
  const idx = buildSearchIndex(products);
  const top = (q) => searchProducts(idx, q).results.map((r) => r.product.name);
  assert.ok(top("coka kola")[0].startsWith("Coca-Cola"), top("coka kola").join());
  assert.ok(top("кока кола").some((n) => n.startsWith("Coca-Cola")));
  assert.ok(top("sprte").some((n) => n.startsWith("Sprite")));
  assert.ok(top("sut")[0].includes("Sut"));
  assert.ok(top("молоко").some((n) => n.includes("Sut")));
  assert.ok(top("tovuq").every((n) => n.startsWith("Tovuq") || true) && top("tovuq")[0].startsWith("Tovuq"));
  assert.ok(parseQuery("arzon sut").cheapest);
  const cola = searchProducts(idx, "cheapest cola").results;
  assert.ok(cola.length >= 3);
  const price = (p) => Math.min(...p.prices.map((x) => x.price));
  assert.ok(price(cola[0].product) <= price(cola[cola.length - 1].product));
  assert.equal(searchProducts(idx, "xyzqwerty").results.length, 0);
  assert.ok(searchProducts(idx, "milk 1 liter").results[0].product.name.includes("Sut"));
});

test("promotions: bundle, overbuy", () => {
  const offer = { price: 10000, promos: [{ type: "bundle", qty: 3, price: 24000 }] };
  assert.equal(lineCost(offer, 3).cost, 24000);
  assert.equal(lineCost(offer, 4).cost, 34000);
  const o2 = { price: 10000, promos: [{ type: "bundle", qty: 3, price: 18000 }] };
  const r = bestQuantity(o2, 2);
  assert.equal(r.qty, 3); assert.equal(r.extra, 1); assert.equal(r.cost, 18000);
  assert.equal(bestQuantity(o2, 2, { allowOverbuy: false }).cost, 20000);
});

const P = (slug, prices) => ({ slug, name: slug, prices: Object.entries(prices).map(([store, price]) => ({ store, price })) });
test("price intelligence", () => {
  const now = Date.parse("2026-10-01T00:00:00Z");
  const hist = Array.from({ length: 30 }, (_, i) => ({ ts: now - (29 - i) * 86400000, price: 13800 + (i % 3) * 100 }));
  hist.push({ ts: now, price: 11900 });
  const d = dealScore({ current: 12490, history: hist, otherPrices: [13500, 14000], now });
  assert.ok(d.score >= 60, String(d.score));
  assert.ok(dealScore({ current: 15000, history: hist, otherPrices: [13500], now }).score < d.score);
  assert.equal(dealScore({ current: 1, history: [] }).score, null);
  assert.equal(detectPriceDrop(hist).percent > 10, true);
  assert.equal(priceTrend(hist.slice(0, 3)).direction, "unknown");
  assert.equal(forecastPrice(hist.slice(0, 3)).status, "insufficient");
  assert.equal(forecastPrice(hist, { now }).status, "ok");
  assert.ok(detectAnomalies(hist.concat([{ ts: now + 1, price: 40000 }])).some((a) => a.kind === "spike"));
  assert.equal(freshness(now - 15 * 60000, now).value, 15);
});

test("geo", () => {
  const tash = { lat: 41.2995, lng: 69.2401 }, sam = { lat: 39.6542, lng: 66.9597 };
  const km = haversineKm(tash, sam);
  assert.ok(km > 260 && km < 280, String(km));
  const stores = [{ id: 1, chain: "Makro", lat: 41.3, lng: 69.25 }, { id: 2, chain: "Makro", lat: 41.4, lng: 69.4 }, { id: 3, chain: "Havas", lat: null, lng: null }];
  assert.equal(nearestStores(tash, stores, { chain: "Makro" })[0].id, 1);
  assert.equal(nearestStores(tash, stores, { chain: "Havas" }).length, 0);
});

test("recommendations", () => {
  const bt = boughtTogether("chips", [["chips", "cola"], ["chips", "cola", "x"], ["chips", "y"], ["z"]]);
  assert.equal(bt[0].slug, "cola");
  const cat = products.map((p) => ({ ...p }));
  const alt = cheaperAlternatives(cat.find((p) => p.name.startsWith("Coca")), cat);
  assert.ok(Array.isArray(alt));
});

import { cartBreakdown, storeTotals } from "../../../src/lib/product.js";
test("cart breakdown: promos, regular price, single store, missing items", () => {
  const milk = { slug: "m", name: "m", prices: [{ store: "A", price: 10000, oldPrice: 12000 }, { store: "B", price: 9000, promos: [{ type: "multibuy", minQty: 2, unitPrice: 8000 }] }] };
  const meat = { slug: "x", name: "x", prices: [{ store: "A", price: 50000 }] };
  const lines = [{ product: milk, qty: 2 }, { product: meat, qty: 1 }];
  const mix = cartBreakdown(lines, "mix");
  assert.equal(mix.total, 16000 + 50000);
  assert.equal(mix.regular, 18000 + 50000);
  assert.equal(mix.discount, 2000);
  assert.deepEqual(mix.stores.sort(), ["A", "B"]);
  const onlyB = cartBreakdown(lines, "B");
  assert.equal(onlyB.missing.length, 1);
  const st = storeTotals(lines);
  assert.equal(st[0].chain, "A");
  assert.equal(st[0].complete, true);
});

import { openStatus } from "../geo.js";
test("open status from partner hours; unknown stays unknown", () => {
  const at = (h, m = 0) => new Date(2026, 9, 7, h, m);
  assert.equal(openStatus("09:00-23:00", at(10)), true);
  assert.equal(openStatus("09:00-23:00", at(23, 30)), false);
  assert.equal(openStatus({ open: "22:00", close: "06:00" }, at(2)), true);
  assert.equal(openStatus("24/7", at(3)), true);
  assert.equal(openStatus(undefined), null);
  assert.equal(openStatus("call us"), null);
});
