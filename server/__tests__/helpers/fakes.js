/* Tiny in-memory stand-ins for Express and MongoDB, just rich enough to run the admin routes in tests
 * (no network, no dependencies). They implement only what server/admin.js and server/seed.js use. */

/* ------------------------------ fake Express ------------------------------ */
export function createFakeApp() {
  const routes = [];
  const add = (method) => (path, ...handlers) => {
    const keys = [];
    const re = new RegExp(`^${path.replace(/:([A-Za-z]+)/g, (_, k) => (keys.push(k), "([^/]+)"))}$`);
    routes.push({ method, re, keys, handlers });
  };
  const app = { get: add("GET"), post: add("POST"), put: add("PUT"), delete: add("DELETE") };

  app.call = async (method, url, { body, headers = {} } = {}) => {
    const [pathname, qs = ""] = url.split("?");
    const route = routes.find((r) => r.method === method && r.re.test(pathname));
    const out = { status: 200, body: undefined, headers: {}, text: undefined };
    if (!route) return { ...out, status: 404, body: { success: false, code: "api_not_found" } };
    const m = route.re.exec(pathname);
    const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    const req = {
      method, params: Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])),
      query: Object.fromEntries(new URLSearchParams(qs)), body, get: (h) => lower[h.toLowerCase()],
    };
    let done = false;
    const res = {
      headersSent: false,
      status(c) { out.status = c; return this; },
      set(k, v) { out.headers[k.toLowerCase()] = v; return this; },
      json(b) { out.body = b; done = true; this.headersSent = true; return this; },
      send(t) { out.text = t; done = true; this.headersSent = true; return this; },
      end() { done = true; this.headersSent = true; return this; },
    };
    for (const h of route.handlers) {
      let advanced = false;
      await h(req, res, () => { advanced = true; });
      if (done || !advanced) break;
    }
    return out;
  };
  return app;
}

/* ------------------------------ fake MongoDB ------------------------------ */
const eq = (a, b) => (a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : String(a) === String(b) && typeof a === typeof b || a === b);
const val = (d, k) => d?.[k];

function matches(doc, filter = {}) {
  return Object.entries(filter).every(([k, cond]) => {
    if (k === "$or") return cond.some((f) => matches(doc, f));
    const v = val(doc, k);
    if (cond && typeof cond === "object" && !(cond instanceof Date) && !Array.isArray(cond) && Object.keys(cond).some((x) => x.startsWith("$"))) {
      return Object.entries(cond).every(([op, arg]) => {
        if (op === "$in") return arg.some((x) => eq(v, x));
        if (op === "$gte") return v != null && +v >= +arg;
        if (op === "$ne") return !eq(v, arg);
        if (op === "$exists") return (v !== undefined) === arg;
        throw new Error(`fake db: unsupported operator ${op}`);
      });
    }
    if (cond === null) return v == null;
    return eq(v, cond);
  });
}

function applyUpdate(doc, update, inserting) {
  for (const [op, fields] of Object.entries(update)) {
    if (op === "$set") Object.assign(doc, fields);
    else if (op === "$setOnInsert") { if (inserting) Object.assign(doc, fields); }
    else if (op === "$inc") for (const [k, n] of Object.entries(fields)) doc[k] = (doc[k] ?? 0) + n;
    else throw new Error(`fake db: unsupported update ${op}`);
  }
}

export class FakeObjectId { constructor(n) { this.n = n; } toString() { return `64b0c0ffee00000000${String(this.n).padStart(6, "0")}`; } }

/* structuredClone would strip the FakeObjectId prototype (its toString), so clone by hand like a driver would. */
function clone(v) {
  if (v instanceof Date) return new Date(v.getTime());
  if (v instanceof FakeObjectId) return v;
  if (Array.isArray(v)) return v.map(clone);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)]));
  return v;
}

class Cursor {
  constructor(rows) { this.rows = rows; }
  sort(spec) {
    const [[k, dir]] = Object.entries(spec);
    this.rows = [...this.rows].sort((a, b) => ((+new Date(a[k]) || a[k]) > (+new Date(b[k]) || b[k]) ? 1 : -1) * dir);
    return this;
  }
  limit(n) { this.rows = this.rows.slice(0, n); return this; }
  async toArray() { return this.rows.map((r) => clone(r)); }
}

class Collection {
  constructor() { this.docs = []; this.seq = 0; }
  async createIndex() {}
  find(filter) { return new Cursor(this.docs.filter((d) => matches(d, filter))); }
  async findOne(filter) { const d = this.docs.find((x) => matches(x, filter)); return d ? clone(d) : null; }
  async insertOne(doc) { const d = clone(doc); if (d._id === undefined) d._id = new FakeObjectId(++this.seq); this.docs.push(d); return { insertedId: d._id }; }
  async updateOne(filter, update, { upsert = false } = {}) {
    const d = this.docs.find((x) => matches(x, filter));
    if (d) { applyUpdate(d, update, false); return { upsertedCount: 0, modifiedCount: 1 }; }
    if (!upsert) return { upsertedCount: 0, modifiedCount: 0 };
    const n = {}; for (const [k, v] of Object.entries(filter)) if (!k.startsWith("$") && (typeof v !== "object" || v === null)) n[k] = v;
    applyUpdate(n, update, true); this.docs.push(n); return { upsertedCount: 1, modifiedCount: 0 };
  }
  async updateMany(filter, update) {
    const hit = this.docs.filter((x) => matches(x, filter)); hit.forEach((d) => applyUpdate(d, update, false));
    return { modifiedCount: hit.length };
  }
  async deleteOne(filter) { const i = this.docs.findIndex((x) => matches(x, filter)); if (i >= 0) this.docs.splice(i, 1); return { deletedCount: i >= 0 ? 1 : 0 }; }
  async deleteMany(filter) { const keep = this.docs.filter((x) => !matches(x, filter)); const n = this.docs.length - keep.length; this.docs = keep; return { deletedCount: n }; }
  async countDocuments(filter) { return this.docs.filter((d) => matches(d, filter)).length; }
  aggregate(pipeline) {
    const group = pipeline.find((s) => s.$group)?.$group;
    const by = new Map();
    for (const d of this.docs) {
      const key = group._id ? d[group._id.slice(1)] : null;
      const cur = by.get(key) ?? { _id: key, ...(group.n ? { n: 0 } : {}) };
      if (group.n) cur.n += 1;
      by.set(key, cur);
    }
    let rows = [...by.values()];
    const sort = pipeline.find((s) => s.$sort)?.$sort;
    if (sort) { const [[k, dir]] = Object.entries(sort); rows.sort((a, b) => (a[k] - b[k]) * dir); }
    return { toArray: async () => rows };
  }
}

export function createFakeDb() {
  const cols = new Map();
  return { collection: (n) => cols.get(n) ?? cols.set(n, new Collection()).get(n), _cols: cols };
}
