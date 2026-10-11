import test from "node:test";
import assert from "node:assert/strict";
import { createFakeApp, createFakeDb, FakeObjectId } from "./helpers/fakes.js";
import { registerAdminRoutes } from "../admin.js";
import { ADMIN_API_VERSION } from "../../shared/adminVersion.js";

const ADMIN = { id: "admin-1", email: "boss@gmail.com", user_metadata: { full_name: "Boss" }, app_metadata: { provider: "google" }, created_at: "2026-01-01T00:00:00Z" };
const AUTH = { authorization: "Bearer admin" };

/* fake auth: "Bearer admin" is the admin, "Bearer user" is a normal signed-in user */
const requireAdmin = (req, res, next) => {
  const t = req.get("authorization");
  if (!t) return res.status(401).json({ success: false, message: "Unauthorized" });
  if (t !== "Bearer admin") return res.status(403).json({ success: false, message: "Forbidden" });
  req.admin = ADMIN; next();
};
const verifyUser = async (req) => (req.get("authorization") === "Bearer user" ? { user: { id: "u-9", email: "Ali@Mail.uz", user_metadata: { name: "Ali" }, app_metadata: {} } } : { status: 401, message: "Unauthorized" });

function setup(extra = {}) {
  const app = createFakeApp(), db = createFakeDb();
  let invalidated = 0;
  registerAdminRoutes(app, () => db, { invalidate: () => invalidated++, requireAdmin, verifyUser, ...extra });
  return { app, db, api: (m, u, body, headers = AUTH) => app.call(m, u, { body, headers }), invalidated: () => invalidated };
}
const product = (o = {}) => ({ name: "Sprite 1.5L", category: "Ichimliklar", unit: "1.5 L", offers: [{ store: "Korzinka", price: 12490 }, { store: "Havas", price: 13490, oldPrice: 14990 }], ...o });

test("every admin route is protected; /api/admin/me reports the API version", async () => {
  const { api } = setup();
  assert.equal((await api("GET", "/api/admin/stats", undefined, {})).status, 401);
  assert.equal((await api("GET", "/api/admin/products", undefined, { authorization: "Bearer user" })).status, 403);
  assert.equal((await api("POST", "/api/admin/products/bulk", {}, { authorization: "Bearer user" })).status, 403);
  assert.equal((await api("GET", "/api/admin/export/users", undefined, {})).status, 401);
  const me = await api("GET", "/api/admin/me");
  assert.equal(me.body.email, "boss@gmail.com");
  assert.equal(me.body.version, ADMIN_API_VERSION);
});

test("first products request imports products.json; create / edit / delete round-trip and are logged", async () => {
  const { api, db, invalidated } = setup();
  const list = await api("GET", "/api/admin/products");
  assert.equal(list.status, 200);
  assert.ok(list.body.products.length >= 20, "seeded from products.json");
  assert.ok(list.body.products.every((p) => p.offers.length > 0));

  assert.equal((await api("POST", "/api/admin/products", { name: "x" })).status, 400);

  const a = await api("POST", "/api/admin/products", product());
  assert.equal(a.status, 201);
  assert.equal(a.body.product.slug, "sprite-1-5l");
  assert.equal(a.body.product.offers.length, 2);
  const b = await api("POST", "/api/admin/products", product());
  assert.equal(b.body.product.slug, "sprite-1-5l-2", "slug stays unique");

  const put = await api("PUT", "/api/admin/products/sprite-1-5l", product({ name: "Sprite 2L", unit: "2 L", offers: [{ store: "Makro", price: 15000, inStock: false }] }));
  assert.equal(put.status, 200);
  assert.deepEqual(put.body.product.offers.map((o) => [o.store, o.price, o.inStock]), [["Makro", 15000, false]]);
  assert.equal((await api("PUT", "/api/admin/products/nope", product())).status, 404);

  assert.equal((await api("DELETE", "/api/admin/products/sprite-1-5l")).status, 200);
  assert.equal((await api("DELETE", "/api/admin/products/sprite-1-5l")).status, 404);
  assert.equal(await db.collection("offers").countDocuments({ slug: "sprite-1-5l" }), 0);
  assert.equal(await db.collection("price_history").countDocuments({ slug: "sprite-1-5l" }), 0);

  const log = await api("GET", "/api/admin/activity");
  assert.deepEqual(log.body.items.map((i) => i.action), ["product.delete", "product.update", "product.create", "product.create"]);
  assert.ok(invalidated() >= 4, "public catalog cache is cleared after every change");
});

test("prices ingested from supermarket APIs are never touched by edits", async () => {
  const { api, db } = setup();
  await api("POST", "/api/admin/products", product());
  await db.collection("offers").insertOne({ _id: "sprite-1-5l|Korzinka|s1", slug: "sprite-1-5l", store: "Korzinka", price: 11111, adapter: "korzinka", updatedAt: new Date() });
  const put = await api("PUT", "/api/admin/products/sprite-1-5l", product({ offers: [{ store: "Havas", price: 20000 }] }));
  const stores = put.body.product.offers.map((o) => `${o.store}:${o.price}:${o.managed}`).sort();
  assert.deepEqual(stores, ["Havas:20000:true", "Korzinka:11111:false"]);
});

test("duplicate copies the product and its editable prices only", async () => {
  const { api, db } = setup();
  await api("POST", "/api/admin/products", product());
  await db.collection("offers").insertOne({ _id: "x|ing", slug: "sprite-1-5l", store: "Makro", price: 9999, adapter: "makro", updatedAt: new Date() });
  const r = await api("POST", "/api/admin/products/sprite-1-5l/duplicate");
  assert.equal(r.status, 201);
  assert.equal(r.body.product.name, "Sprite 1.5L (nusxa)");
  assert.notEqual(r.body.product.slug, "sprite-1-5l");
  assert.deepEqual(r.body.product.offers.map((o) => o.store).sort(), ["Havas", "Korzinka"]);
  assert.equal((await api("POST", "/api/admin/products/missing/duplicate")).status, 404);
});

test("bulk: validation, category, stock, delete", async () => {
  const { api, db } = setup();
  await api("POST", "/api/admin/products", product({ name: "Fanta 1L" }));
  await api("POST", "/api/admin/products", product({ name: "Pepsi 1L" }));
  const slugs = ["fanta-1l", "pepsi-1l", "ghost"];

  assert.equal((await api("POST", "/api/admin/products/bulk", { action: "explode", slugs })).status, 400);
  assert.equal((await api("POST", "/api/admin/products/bulk", { action: "delete", slugs: [] })).status, 400);
  assert.equal((await api("POST", "/api/admin/products/bulk", { action: "category", slugs })).status, 400);
  assert.equal((await api("POST", "/api/admin/products/bulk", { action: "stock", slugs })).status, 400);
  assert.equal((await api("POST", "/api/admin/products/bulk", { action: "delete", slugs: ["ghost"] })).status, 404);

  const cat = await api("POST", "/api/admin/products/bulk", { action: "category", slugs, category: "Sneklar" });
  assert.deepEqual([cat.body.affected, cat.body.missing], [2, 1]);
  assert.equal((await db.collection("products").findOne({ _id: "fanta-1l" })).category, "Sneklar");

  await api("POST", "/api/admin/products/bulk", { action: "stock", slugs: ["fanta-1l"], inStock: false });
  assert.ok((await db.collection("offers").find({ slug: "fanta-1l" }).toArray()).every((o) => o.inStock === false));
  assert.ok((await db.collection("offers").find({ slug: "pepsi-1l" }).toArray()).every((o) => o.inStock !== false));

  const del = await api("POST", "/api/admin/products/bulk", { action: "delete", slugs });
  assert.equal(del.body.affected, 2);
  assert.equal(await db.collection("offers").countDocuments({ slug: "fanta-1l" }), 0);
});

test("image check separates working, broken and unreachable URLs; clear removes only what was asked", async () => {
  const answers = {
    "https://img.test/ok.jpg": { status: 200, type: "image/jpeg" },
    "https://img.test/gone.jpg": { status: 404, type: "text/html" },
    "https://img.test/page.jpg": { status: 200, type: "text/html" },
    "https://img.test/nohead.jpg": { status: 405, getStatus: 200, type: "image/png" },
    "https://img.test/limited.jpg": { status: 429, type: "text/plain" },
  };
  const calls = [];
  const fetchImpl = async (url, { method }) => {
    calls.push(`${method} ${url}`);
    if (url.includes("down")) throw new Error("ECONNREFUSED");
    const a = answers[url]; const status = method === "GET" && a.getStatus ? a.getStatus : a.status;
    return { status, headers: { get: () => a.type }, body: { cancel() {} } };
  };
  const { api, db } = setup({ fetchImpl });
  for (const [slug, image] of [["ok", "https://img.test/ok.jpg"], ["gone", "https://img.test/gone.jpg"], ["page", "https://img.test/page.jpg"], ["nohead", "https://img.test/nohead.jpg"], ["limited", "https://img.test/limited.jpg"], ["down", "https://img.test/down.jpg"], ["local", "http://127.0.0.1/a.jpg"], ["empty", ""], ["rel", "/images/a.jpg"]]) {
    await db.collection("products").insertOne({ _id: slug, slug, name: slug, image, category: "X" });
  }
  const r = await api("POST", "/api/admin/images/check", {});
  assert.equal(r.status, 200);
  assert.equal(r.body.total, 7, "only absolute http(s) images are probed");
  assert.deepEqual(r.body.broken.map((b) => b.slug).sort(), ["gone", "local", "page"]);
  assert.deepEqual(r.body.unreachable.map((b) => b.slug).sort(), ["down", "limited"]);
  assert.equal(r.body.okCount, 2);
  assert.equal(r.body.next, null);
  assert.ok(calls.includes("GET https://img.test/nohead.jpg"), "falls back to GET when HEAD is refused");
  assert.ok(!calls.some((c) => c.includes("127.0.0.1")), "private addresses are never requested");

  assert.equal((await api("POST", "/api/admin/images/clear", { slugs: [] })).status, 400);
  const cleared = await api("POST", "/api/admin/images/clear", { slugs: ["gone", "page"] });
  assert.equal(cleared.body.cleared, 2);
  assert.equal((await db.collection("products").findOne({ _id: "gone" })).image, "");
  assert.equal((await db.collection("products").findOne({ _id: "ok" })).image, "https://img.test/ok.jpg");
});

test("contact messages: list, read/unread, read-all, delete", async () => {
  const { api, db } = setup();
  const col = db.collection("contact_messages");
  const mk = (n, extra = {}) => col.insertOne({ _id: new FakeObjectId(n), name: `N${n}`, email: `n${n}@mail.uz`, message: `Salom ${n}`, meta: { page: "/cart", lang: "uz" }, createdAt: new Date(Date.now() - n * 1000), emailStatus: "sent", ...extra });
  await mk(1); await mk(2); await mk(3, { read: true });

  const list = await api("GET", "/api/admin/messages");
  assert.deepEqual(list.body.messages.map((m) => m.name), ["N1", "N2", "N3"], "newest first");
  assert.deepEqual(list.body.messages.map((m) => m.read), [false, false, true]);
  assert.equal(list.body.messages[0].page, "/cart");

  const id = list.body.messages[0].id;
  assert.equal((await api("PUT", `/api/admin/messages/${id}`, { read: "yes" })).status, 400);
  assert.equal((await api("PUT", `/api/admin/messages/${id}`, { read: true })).status, 200);
  assert.equal((await api("PUT", "/api/admin/messages/nope", { read: true })).status, 404);
  assert.equal((await api("GET", "/api/admin/stats")).body.counts.unread, 1);

  assert.equal((await api("POST", "/api/admin/messages/read-all")).body.updated, 1);
  assert.equal((await api("GET", "/api/admin/stats")).body.counts.unread, 0);

  assert.equal((await api("DELETE", `/api/admin/messages/${id}`)).status, 200);
  assert.equal((await api("DELETE", `/api/admin/messages/${id}`)).status, 404);
  assert.equal((await api("GET", "/api/admin/messages")).body.messages.length, 2);
});

test("users: sync from a signed-in account, list, and stats signups series", async () => {
  const { api } = setup();
  assert.equal((await api("POST", "/api/users/sync", undefined, {})).status, 401);
  assert.equal((await api("POST", "/api/users/sync", undefined, { authorization: "Bearer user" })).status, 200);
  assert.equal((await api("POST", "/api/users/sync", undefined, { authorization: "Bearer user" })).status, 200);
  const users = await api("GET", "/api/admin/users");
  assert.equal(users.status, 200);
  const ali = users.body.users.find((u) => u.id === "u-9");
  assert.equal(ali.email, "ali@mail.uz");
  assert.equal(ali.signIns, 2);
  assert.ok(users.body.users.some((u) => u.id === "admin-1"), "the admin is remembered too");
  assert.equal((await api("POST", "/api/admin/users/import", {})).status, 501, "needs SUPABASE_SERVICE_ROLE_KEY");

  const stats = (await api("GET", "/api/admin/stats")).body;
  assert.equal(stats.signups.length, 14);
  assert.equal(stats.counts.users, 2);
});

test("stats aggregate products, stores and out-of-stock prices", async () => {
  const { api } = setup();
  await api("GET", "/api/admin/products"); // seeds
  await api("POST", "/api/admin/products", product({ name: "Tugagan 1L", offers: [{ store: "Havas", price: 5000, inStock: false }] }));
  const { body } = await api("GET", "/api/admin/stats");
  assert.ok(body.counts.products >= 24);
  assert.equal(body.counts.outOfStock, 1);
  assert.ok(body.categories.length >= 2 && body.stores.length >= 1);
  assert.ok(body.recentActivity.length >= 1);
});

test("CSV export: BOM, quoting, formula guard, unknown type", async () => {
  const { api } = setup();
  await api("POST", "/api/admin/products", product({ name: "=SUM(A1) \"Cola\", 1L", brand: "" }));
  const r = await api("GET", "/api/admin/export/products");
  assert.equal(r.status, 200);
  assert.match(r.headers["content-type"], /text\/csv/);
  assert.match(r.headers["content-disposition"], /narxtop-products-\d{4}-\d{2}-\d{2}\.csv/);
  assert.ok(r.text.startsWith("\ufeffslug,Nomi"));
  assert.match(r.text, /"'=SUM\(A1\) ""Cola"", 1L"/, "formula-looking names are neutralised and quotes escaped");
  assert.match(r.text, /Korzinka: 12490; Havas: 13490/);
  assert.equal((await api("GET", "/api/admin/export/users")).status, 200);
  assert.equal((await api("GET", "/api/admin/export/messages")).status, 200);
  assert.equal((await api("GET", "/api/admin/export/secrets")).status, 404);
});

test("seed import endpoint reports what it added and is logged", async () => {
  const { api } = setup();
  const r = await api("POST", "/api/admin/seed", { overwrite: false });
  assert.equal(r.status, 200);
  assert.ok(r.body.result.productsAdded >= 20);
  const again = await api("POST", "/api/admin/seed", {});
  assert.equal(again.body.result.productsAdded, 0, "second import adds nothing");
  assert.equal((await api("GET", "/api/admin/activity?limit=1")).body.items.length, 1);
});
