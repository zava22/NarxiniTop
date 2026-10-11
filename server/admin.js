/* Admin API (everything under /api/admin is server-side admin-only) + user sync.
 *
 *   POST   /api/users/sync                   any signed-in user -> upsert into MongoDB `users`
 *   GET    /api/admin/me                     -> { admin, email, version, database }
 *   GET    /api/admin/stats                  dashboard numbers
 *   GET    /api/admin/products               every product with its prices
 *   POST   /api/admin/products               add a product (+ prices)
 *   PUT    /api/admin/products/:slug         edit a product (+ prices)
 *   DELETE /api/admin/products/:slug         remove a product, its prices and history
 *   POST   /api/admin/products/:slug/duplicate   copy a product (editable prices only)
 *   POST   /api/admin/products/bulk          { action: delete | category | stock, slugs, category?, inStock? }
 *   POST   /api/admin/images/check           probe product image URLs ({ slugs?, offset? })
 *   POST   /api/admin/images/clear           blank the image of the given products ({ slugs })
 *   GET    /api/admin/users                  everyone who signed in
 *   POST   /api/admin/users/import           backfill from Supabase (needs SUPABASE_SERVICE_ROLE_KEY)
 *   GET    /api/admin/messages               contact-form messages
 *   PUT    /api/admin/messages/:id           { read: true|false }
 *   POST   /api/admin/messages/read-all      mark everything as read
 *   DELETE /api/admin/messages/:id           delete a message
 *   GET    /api/admin/activity               admin action log
 *   GET    /api/admin/export/:what           CSV download: products | users | messages
 *   POST   /api/admin/seed                   import products.json (adds missing; {overwrite:true} refreshes)
 *
 * Anything that changes products is read by /api/catalog, so it shows up on the public site (the 30 s cache is cleared). */
import { describeProduct } from "../shared/core/matching.js";
import { ADMIN_API_VERSION } from "../shared/adminVersion.js";
import { requireAdmin as defaultRequireAdmin, verifyUser as defaultVerifyUser } from "./auth.js";
import { isManagedOffer, probeImage, slugify, toCsv, validateBulk, validateProduct } from "./adminValidate.js";
import { seedIfEmpty, seedProducts } from "./seed.js";

const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); } catch (e) { console.error(e); if (!res.headersSent) res.status(500).json({ success: false, message: `Server xatosi: ${e.message}` }); }
};
const iso = (d) => (d instanceof Date ? d.toISOString() : d ?? null);
const today = () => new Date().toISOString().slice(0, 10);

const userRow = (u) => ({ id: u._id, email: u.email ?? "", name: u.name ?? "", avatar: u.avatar ?? null, provider: u.provider ?? "email", createdAt: iso(u.createdAt), lastSeenAt: iso(u.lastSeenAt), signIns: u.signIns ?? 0 });

const messageRow = (m) => ({
  id: String(m._id), name: m.name ?? "", email: m.email ?? "", message: m.message ?? "",
  page: m.meta?.page ?? "", lang: m.meta?.lang ?? "", viewport: m.meta?.viewport ?? "", userAgent: m.meta?.userAgent ?? "",
  userId: m.userId ?? null, emailStatus: m.emailStatus ?? "", read: m.read === true, createdAt: iso(m.createdAt),
});

const activityRow = (a) => ({ id: String(a._id), ts: iso(a.ts), by: a.by ?? "", action: a.action, target: a.target ?? null, detail: a.detail ?? null });

function productView(p, offers) {
  return {
    slug: p.slug, name: p.name, brand: p.brand ?? "", category: p.category ?? "", unit: p.unit ?? "", image: p.image ?? "", description: p.description ?? "",
    source: p.source ?? "ingest", createdAt: iso(p.createdAt), updatedAt: iso(p.updatedAt ?? p.createdAt),
    offers: offers.map((o) => ({ store: o.store, price: o.price, oldPrice: o.oldPrice ?? null, inStock: o.inStock !== false, managed: isManagedOffer(o), updatedAt: iso(o.updatedAt) })).sort((a, b) => a.price - b.price),
  };
}

export async function ensureAdminIndexes(db) {
  await db.collection("users").createIndex({ lastSeenAt: -1 });
  await db.collection("users").createIndex({ email: 1 });
  await db.collection("admin_log").createIndex({ ts: -1 });
  await db.collection("contact_messages").createIndex({ createdAt: -1 });
}

/* Audit trail: who changed what. A logging failure must never break the action itself. */
async function logAction(db, admin, action, target = null, detail = null) {
  try {
    await db.collection("admin_log").insertOne({ ts: new Date(), by: String(admin?.email ?? ""), action, target, ...(detail ? { detail } : {}) });
  } catch (e) { console.warn("admin log failed:", e.message); }
}

async function uniqueSlug(col, name) {
  const base = slugify(name) || `product-${Date.now().toString(36)}`;
  let slug = base, i = 2;
  while (await col.findOne({ _id: slug }, { projection: { _id: 1 } })) slug = `${base}-${i++}`;
  return slug;
}

/* Writes the editable prices of one product; leaves prices ingested from supermarket APIs untouched. */
async function applyOffers(db, slug, wanted) {
  const offers = db.collection("offers"), history = db.collection("price_history");
  const existing = await offers.find({ slug }).toArray();
  const mine = existing.filter(isManagedOffer);
  const keep = new Set(wanted.map((o) => o.store.toLowerCase()));
  const drop = mine.filter((o) => !keep.has(String(o.store).toLowerCase())).map((o) => o._id);
  if (drop.length) await offers.deleteMany({ _id: { $in: drop } });
  const now = new Date();
  for (const o of wanted) {
    const prev = mine.find((e) => String(e.store).toLowerCase() === o.store.toLowerCase());
    const _id = prev?._id ?? `${slug}|${o.store}|*`;
    await offers.updateOne({ _id }, { $set: { slug, store: o.store, price: o.price, oldPrice: o.oldPrice ?? null, inStock: o.inStock, promos: prev?.promos ?? [], adapter: "admin", updatedAt: now } }, { upsert: true });
    if (!prev || prev.price !== o.price) await history.insertOne({ slug, store: o.store, price: o.price, ts: now });
  }
}

async function removeProducts(db, slugs) {
  await Promise.all([
    db.collection("products").deleteMany({ _id: { $in: slugs } }),
    db.collection("offers").deleteMany({ slug: { $in: slugs } }),
    db.collection("price_history").deleteMany({ slug: { $in: slugs } }),
  ]);
}

/* Pulls everybody who ever registered in Supabase into MongoDB (needs SUPABASE_SERVICE_ROLE_KEY). */
async function importSupabaseUsers(db) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { const e = new Error("SUPABASE_SERVICE_ROLE_KEY server .env.local da yo‘q."); e.status = 501; throw e; }
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  let imported = 0;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const list = data?.users ?? [];
    for (const u of list) {
      const meta = u.user_metadata ?? {};
      const r = await db.collection("users").updateOne({ _id: u.id }, { $setOnInsert: { email: String(u.email ?? "").toLowerCase(), name: meta.full_name || meta.name || "", avatar: meta.avatar_url || meta.picture || null, provider: u.app_metadata?.provider ?? "email", createdAt: u.created_at ? new Date(u.created_at) : new Date(), lastSeenAt: u.last_sign_in_at ? new Date(u.last_sign_in_at) : new Date(u.created_at ?? Date.now()), signIns: 0 } }, { upsert: true });
      if (r.upsertedCount) imported++;
    }
    if (list.length < 1000) break;
  }
  return imported;
}

/* Runs `worker` over `items` with at most `limit` in flight. */
async function pool(items, limit, worker) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await worker(items[i], i); }
  }));
  return out;
}

const IMAGE_CHECK_BATCH = 120;

/**
 * @param deps optional overrides (used by tests): { invalidate, requireAdmin, verifyUser, fetchImpl }
 */
export function registerAdminRoutes(app, getDb, deps = {}) {
  const db = () => getDb();
  const invalidate = deps.invalidate ?? (() => {});
  const requireAdmin = deps.requireAdmin ?? defaultRequireAdmin;
  const verifyUser = deps.verifyUser ?? defaultVerifyUser;
  const admin = [requireAdmin];

  /* ---- every signed-in user is remembered in MongoDB ---- */
  app.post("/api/users/sync", wrap(async (req, res) => {
    const r = await verifyUser(req);
    if (!r.user) return res.status(r.status).json({ success: false, message: r.message });
    const u = r.user, meta = u.user_metadata ?? {};
    const now = new Date();
    await db().collection("users").updateOne(
      { _id: u.id },
      {
        $set: { email: String(u.email ?? "").toLowerCase(), name: meta.full_name || meta.name || "", avatar: meta.avatar_url || meta.picture || null, provider: u.app_metadata?.provider ?? "email", lastSeenAt: now },
        $setOnInsert: { createdAt: u.created_at ? new Date(u.created_at) : now },
        $inc: { signIns: 1 },
      },
      { upsert: true }
    );
    res.json({ success: true });
  }));

  app.get("/api/admin/me", ...admin, (req, res) => res.json({ success: true, admin: true, email: req.admin.email, version: ADMIN_API_VERSION, database: process.env.MONGODB_DB_NAME || "narxitop" }));

  /* ------------------------------ stats ------------------------------ */
  app.get("/api/admin/stats", ...admin, wrap(async (req, res) => {
    const d = db(), day = new Date(Date.now() - 86400000), week = new Date(Date.now() - 7 * 86400000), fortnight = new Date(Date.now() - 14 * 86400000);
    const [products, offers, users, activeToday, newWeek, withOffers, noImage, cats, stores, recentProducts, recentUsers, unread, outOfStock, priceChanges, signupRows, recentActivity] = await Promise.all([
      d.collection("products").countDocuments({}),
      d.collection("offers").countDocuments({}),
      d.collection("users").countDocuments({}),
      d.collection("users").countDocuments({ lastSeenAt: { $gte: day } }),
      d.collection("users").countDocuments({ createdAt: { $gte: week } }),
      d.collection("offers").aggregate([{ $group: { _id: "$slug" } }]).toArray(), // (distinct is not allowed by the Stable API strict mode)
      d.collection("products").countDocuments({ $or: [{ image: "" }, { image: null }, { image: { $exists: false } }] }),
      d.collection("products").aggregate([{ $group: { _id: "$category", n: { $sum: 1 } } }, { $sort: { n: -1 } }]).toArray(),
      d.collection("offers").aggregate([{ $group: { _id: "$store", n: { $sum: 1 } } }, { $sort: { n: -1 } }]).toArray(),
      d.collection("products").find({}).sort({ createdAt: -1 }).limit(6).toArray(),
      d.collection("users").find({}).sort({ lastSeenAt: -1 }).limit(6).toArray(),
      d.collection("contact_messages").countDocuments({ read: { $ne: true } }),
      d.collection("offers").countDocuments({ inStock: false }),
      d.collection("price_history").countDocuments({ ts: { $gte: week } }),
      d.collection("users").find({ createdAt: { $gte: fortnight } }).limit(5000).toArray(),
      d.collection("admin_log").find({}).sort({ ts: -1 }).limit(6).toArray(),
    ]);
    const liveSlugs = new Set(withOffers.map((x) => x._id));
    const buckets = new Map();
    for (let i = 13; i >= 0; i--) buckets.set(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10), 0);
    for (const u of signupRows) { const k = iso(u.createdAt)?.slice(0, 10); if (buckets.has(k)) buckets.set(k, buckets.get(k) + 1); }
    res.json({
      success: true,
      counts: { products, offers, users, activeToday, newWeek, live: liveSlugs.size, hidden: Math.max(0, products - liveSlugs.size), noImage, unread, outOfStock, priceChanges },
      categories: cats.map((c) => ({ name: c._id ?? "—", count: c.n })),
      stores: stores.map((s) => ({ name: s._id ?? "—", count: s.n })),
      signups: [...buckets].map(([date, count]) => ({ date, count })),
      recentProducts: recentProducts.map((p) => ({ slug: p.slug, name: p.name, image: p.image ?? "", category: p.category ?? "", createdAt: iso(p.createdAt) })),
      recentUsers: recentUsers.map(userRow),
      recentActivity: recentActivity.map(activityRow),
      database: process.env.MONGODB_DB_NAME || "narxitop",
    });
  }));

  /* ---------------------------- products ---------------------------- */
  app.get("/api/admin/products", ...admin, wrap(async (req, res) => {
    await seedIfEmpty(db());
    const [products, offers] = await Promise.all([db().collection("products").find({}).limit(5000).toArray(), db().collection("offers").find({}).limit(50000).toArray()]);
    const by = new Map();
    for (const o of offers) (by.get(o.slug) ?? by.set(o.slug, []).get(o.slug)).push(o);
    res.json({ success: true, products: products.map((p) => productView(p, by.get(p.slug) ?? [])).sort((a, b) => String(a.name).localeCompare(String(b.name))) });
  }));

  app.post("/api/admin/products", ...admin, wrap(async (req, res) => {
    const v = validateProduct(req.body);
    if (!v.ok) return res.status(400).json({ success: false, message: v.errors[0], errors: v.errors });
    const col = db().collection("products");
    const slug = await uniqueSlug(col, v.value.name);
    const d = describeProduct(v.value.name, v.value.unit);
    const now = new Date();
    await col.insertOne({ _id: slug, slug, name: v.value.name, brand: v.value.brand || d.brand || null, category: v.value.category, unit: v.value.unit, size: d.size ?? null, canonicalKey: d.canonicalKey, image: v.value.image, description: v.value.description, source: "admin", createdBy: req.admin.email, createdAt: now, updatedAt: now });
    await applyOffers(db(), slug, v.value.offers);
    await logAction(db(), req.admin, "product.create", slug, v.value.name);
    invalidate();
    const offers = await db().collection("offers").find({ slug }).toArray();
    res.status(201).json({ success: true, product: productView(await col.findOne({ _id: slug }), offers) });
  }));

  /* bulk + duplicate are registered BEFORE the ":slug" routes so "bulk" is never taken for a slug */
  app.post("/api/admin/products/bulk", ...admin, wrap(async (req, res) => {
    const v = validateBulk(req.body);
    if (!v.ok) return res.status(400).json({ success: false, message: v.error });
    const { action, slugs, category, inStock } = v.value;
    const found = (await db().collection("products").find({ _id: { $in: slugs } }).toArray()).map((p) => p._id);
    if (!found.length) return res.status(404).json({ success: false, message: "Tanlangan mahsulotlar topilmadi." });
    const now = new Date();
    if (action === "delete") {
      await removeProducts(db(), found);
    } else if (action === "category") {
      await db().collection("products").updateMany({ _id: { $in: found } }, { $set: { category, updatedAt: now, updatedBy: req.admin.email } });
    } else {
      const mine = (await db().collection("offers").find({ slug: { $in: found } }).toArray()).filter(isManagedOffer).map((o) => o._id);
      if (mine.length) await db().collection("offers").updateMany({ _id: { $in: mine } }, { $set: { inStock, updatedAt: now } });
      await db().collection("products").updateMany({ _id: { $in: found } }, { $set: { updatedAt: now, updatedBy: req.admin.email } });
    }
    await logAction(db(), req.admin, `bulk.${action}`, null, `${found.length} ta mahsulot${action === "category" ? ` → ${category}` : action === "stock" ? ` → ${inStock ? "mavjud" : "tugagan"}` : ""}`);
    invalidate();
    res.json({ success: true, affected: found.length, missing: slugs.length - found.length });
  }));

  app.post("/api/admin/products/:slug/duplicate", ...admin, wrap(async (req, res) => {
    const from = String(req.params.slug);
    const col = db().collection("products");
    const cur = await col.findOne({ _id: from });
    if (!cur) return res.status(404).json({ success: false, message: "Mahsulot topilmadi." });
    const name = `${cur.name} (nusxa)`.slice(0, 120);
    const slug = await uniqueSlug(col, name);
    const now = new Date();
    const rest = { ...cur };
    for (const k of ["_id", "slug", "createdAt", "updatedAt", "createdBy", "updatedBy"]) delete rest[k];
    await col.insertOne({ ...rest, _id: slug, slug, name, source: "admin", createdBy: req.admin.email, createdAt: now, updatedAt: now });
    const copied = (await db().collection("offers").find({ slug: from }).toArray()).filter(isManagedOffer)
      .map((o) => ({ store: o.store, price: o.price, oldPrice: o.oldPrice ?? undefined, inStock: o.inStock !== false }));
    await applyOffers(db(), slug, copied);
    await logAction(db(), req.admin, "product.duplicate", slug, `${cur.name} dan nusxa`);
    invalidate();
    const offers = await db().collection("offers").find({ slug }).toArray();
    res.status(201).json({ success: true, product: productView(await col.findOne({ _id: slug }), offers) });
  }));

  app.put("/api/admin/products/:slug", ...admin, wrap(async (req, res) => {
    const slug = String(req.params.slug);
    const col = db().collection("products");
    const cur = await col.findOne({ _id: slug });
    if (!cur) return res.status(404).json({ success: false, message: "Mahsulot topilmadi." });
    const v = validateProduct(req.body);
    if (!v.ok) return res.status(400).json({ success: false, message: v.errors[0], errors: v.errors });
    const d = describeProduct(v.value.name, v.value.unit);
    await col.updateOne({ _id: slug }, { $set: { name: v.value.name, brand: v.value.brand || d.brand || null, category: v.value.category, unit: v.value.unit, size: d.size ?? null, canonicalKey: d.canonicalKey, image: v.value.image, description: v.value.description, updatedAt: new Date(), updatedBy: req.admin.email } });
    await applyOffers(db(), slug, v.value.offers);
    await logAction(db(), req.admin, "product.update", slug, v.value.name);
    invalidate();
    const offers = await db().collection("offers").find({ slug }).toArray();
    res.json({ success: true, product: productView(await col.findOne({ _id: slug }), offers) });
  }));

  app.delete("/api/admin/products/:slug", ...admin, wrap(async (req, res) => {
    const slug = String(req.params.slug);
    const cur = await db().collection("products").findOne({ _id: slug });
    if (!cur) return res.status(404).json({ success: false, message: "Mahsulot topilmadi." });
    await removeProducts(db(), [slug]);
    await logAction(db(), req.admin, "product.delete", slug, cur.name);
    invalidate();
    res.json({ success: true });
  }));

  app.post("/api/admin/seed", ...admin, wrap(async (req, res) => {
    const overwrite = req.body?.overwrite === true;
    const result = await seedProducts(db(), { overwrite });
    await logAction(db(), req.admin, overwrite ? "seed.overwrite" : "seed.import", null, `${result.productsAdded} ta mahsulot, ${result.offersAdded} ta narx`);
    invalidate();
    res.json({ success: true, result });
  }));

  /* ------------------------------ images ------------------------------ */
  app.post("/api/admin/images/check", ...admin, wrap(async (req, res) => {
    const only = Array.isArray(req.body?.slugs) ? new Set(req.body.slugs.filter((s) => typeof s === "string")) : null;
    const offset = Math.max(0, Math.floor(Number(req.body?.offset) || 0));
    const all = (await db().collection("products").find({}).limit(5000).toArray())
      .filter((p) => typeof p.image === "string" && /^https?:\/\//i.test(p.image) && (!only || only.has(p.slug)))
      .sort((a, b) => String(a.slug).localeCompare(String(b.slug)));
    const batch = all.slice(offset, offset + IMAGE_CHECK_BATCH);
    const results = await pool(batch, 8, async (p) => ({ p, r: await probeImage(p.image, { fetchImpl: deps.fetchImpl }) }));
    const row = ({ p, r }) => ({ slug: p.slug, name: p.name, image: p.image, status: r.status, reason: r.reason ?? "" });
    res.json({
      success: true, total: all.length, checked: batch.length, next: offset + batch.length < all.length ? offset + batch.length : null,
      okCount: results.filter(({ r }) => r.ok).length,
      broken: results.filter(({ r }) => !r.ok && ["broken", "not-image", "blocked"].includes(r.reason)).map(row),
      unreachable: results.filter(({ r }) => !r.ok && r.reason === "unreachable").map(row),
    });
  }));

  app.post("/api/admin/images/clear", ...admin, wrap(async (req, res) => {
    const slugs = Array.isArray(req.body?.slugs) ? [...new Set(req.body.slugs.filter((s) => typeof s === "string" && s))].slice(0, 500) : [];
    if (!slugs.length) return res.status(400).json({ success: false, message: "Hech narsa tanlanmagan." });
    const r = await db().collection("products").updateMany({ _id: { $in: slugs } }, { $set: { image: "", updatedAt: new Date(), updatedBy: req.admin.email } });
    const cleared = r.modifiedCount ?? slugs.length;
    await logAction(db(), req.admin, "images.clear", null, `${cleared} ta rasm manzili olib tashlandi`);
    invalidate();
    res.json({ success: true, cleared });
  }));

  /* ------------------------------ users ------------------------------ */
  app.get("/api/admin/users", ...admin, wrap(async (req, res) => {
    const col = db().collection("users"), me = req.admin, meta = me.user_metadata ?? {};
    await col.updateOne({ _id: me.id }, { $set: { email: String(me.email ?? "").toLowerCase(), name: meta.full_name || meta.name || "", avatar: meta.avatar_url || meta.picture || null, provider: me.app_metadata?.provider ?? "email", lastSeenAt: new Date() }, $setOnInsert: { createdAt: me.created_at ? new Date(me.created_at) : new Date(), signIns: 1 } }, { upsert: true });
    if ((await col.countDocuments({})) <= 1) { try { await importSupabaseUsers(db()); } catch (e) { console.warn("auto user import skipped:", e.message); } }
    const rows = await col.find({}).sort({ lastSeenAt: -1 }).limit(5000).toArray();
    res.json({ success: true, users: rows.map(userRow) });
  }));

  app.post("/api/admin/users/import", ...admin, async (req, res) => {
    try {
      const imported = await importSupabaseUsers(db());
      await logAction(db(), req.admin, "users.import", null, `${imported} ta yangi foydalanuvchi`);
      res.json({ success: true, imported });
    } catch (e) {
      console.error("users import failed:", e.message);
      res.status(e.status || 500).json({ success: false, message: e.message });
    }
  });

  /* ----------------------------- messages ----------------------------- */
  const loadMessages = () => db().collection("contact_messages").find({}).sort({ createdAt: -1 }).limit(2000).toArray();
  /* ids are matched as strings against the stored _id (an ObjectId), so no ObjectId import is needed here */
  const findMessage = async (id) => (await loadMessages()).find((m) => String(m._id) === String(id));

  app.get("/api/admin/messages", ...admin, wrap(async (req, res) => {
    res.json({ success: true, messages: (await loadMessages()).map(messageRow) });
  }));

  app.post("/api/admin/messages/read-all", ...admin, wrap(async (req, res) => {
    const r = await db().collection("contact_messages").updateMany({ read: { $ne: true } }, { $set: { read: true } });
    res.json({ success: true, updated: r.modifiedCount ?? 0 });
  }));

  app.put("/api/admin/messages/:id", ...admin, wrap(async (req, res) => {
    if (typeof req.body?.read !== "boolean") return res.status(400).json({ success: false, message: "read: true yoki false bo‘lishi kerak." });
    const m = await findMessage(req.params.id);
    if (!m) return res.status(404).json({ success: false, message: "Xabar topilmadi." });
    await db().collection("contact_messages").updateOne({ _id: m._id }, { $set: { read: req.body.read } });
    res.json({ success: true });
  }));

  app.delete("/api/admin/messages/:id", ...admin, wrap(async (req, res) => {
    const m = await findMessage(req.params.id);
    if (!m) return res.status(404).json({ success: false, message: "Xabar topilmadi." });
    await db().collection("contact_messages").deleteOne({ _id: m._id });
    await logAction(db(), req.admin, "message.delete", String(m._id), m.email ?? null);
    res.json({ success: true });
  }));

  /* ----------------------------- activity ----------------------------- */
  app.get("/api/admin/activity", ...admin, wrap(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const rows = await db().collection("admin_log").find({}).sort({ ts: -1 }).limit(limit).toArray();
    res.json({ success: true, items: rows.map(activityRow) });
  }));

  /* ------------------------------ export ------------------------------ */
  app.get("/api/admin/export/:what", ...admin, wrap(async (req, res) => {
    const what = String(req.params.what);
    let csv;
    if (what === "products") {
      const [products, offers] = await Promise.all([db().collection("products").find({}).limit(5000).toArray(), db().collection("offers").find({}).limit(50000).toArray()]);
      const by = new Map();
      for (const o of offers) (by.get(o.slug) ?? by.set(o.slug, []).get(o.slug)).push(o);
      const rows = products.map((p) => productView(p, by.get(p.slug) ?? [])).sort((a, b) => String(a.name).localeCompare(String(b.name)));
      csv = toCsv(rows, [
        ["slug", "slug"], ["name", "Nomi"], ["brand", "Brend"], ["category", "Kategoriya"], ["unit", "O‘lchov"],
        [(r) => r.offers.map((o) => `${o.store}: ${o.price}${o.inStock ? "" : " (tugagan)"}`).join("; "), "Narxlar (UZS)"],
        [(r) => r.offers.find((o) => o.inStock)?.price ?? "", "Eng arzon (UZS)"],
        ["image", "Rasm"], ["description", "Tavsif"], ["updatedAt", "Yangilangan"],
      ]);
    } else if (what === "users") {
      const rows = (await db().collection("users").find({}).sort({ lastSeenAt: -1 }).limit(5000).toArray()).map(userRow);
      csv = toCsv(rows, [["id", "ID"], ["email", "Gmail"], ["name", "Ism"], ["provider", "Usul"], ["createdAt", "Qo‘shilgan"], ["lastSeenAt", "Oxirgi faollik"], ["signIns", "Kirishlar"]]);
    } else if (what === "messages") {
      const rows = (await loadMessages()).map(messageRow);
      csv = toCsv(rows, [["createdAt", "Sana"], ["name", "Ism"], ["email", "Gmail"], ["message", "Xabar"], ["page", "Sahifa"], ["lang", "Til"], ["read", "O‘qilgan"], ["emailStatus", "Email holati"]]);
    } else {
      return res.status(404).json({ success: false, message: "Noma’lum eksport turi." });
    }
    res.set("Content-Type", "text/csv; charset=utf-8");
    res.set("Content-Disposition", `attachment; filename="narxtop-${what}-${today()}.csv"`);
    res.set("Cache-Control", "no-store");
    res.send(csv);
  }));
}
