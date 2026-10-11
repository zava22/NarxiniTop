import test from "node:test";
import assert from "node:assert/strict";
import { csvCell, isManagedOffer, isPublicHttpUrl, probeImage, slugify, toCsv, validateBulk, validateOffers, validateProduct } from "../adminValidate.js";
import { adminEmails, isAdminUser } from "../auth.js";

test("slugify handles Uzbek apostrophes and empty input", () => {
  assert.equal(slugify("Lay's 140g"), "lays-140g");
  assert.equal(slugify("O‘rik 1kg"), "orik-1kg");
  assert.equal(slugify("   "), "");
});

test("a valid product passes and is trimmed", () => {
  const r = validateProduct({ name: "  Sprite   1.5L ", category: "Ichimliklar", unit: "1.5 L", image: "https://x.uz/a.jpg", offers: [{ store: "Korzinka", price: "12490" }, { store: "Havas", price: 13490, oldPrice: 14990 }] });
  assert.equal(r.ok, true);
  assert.equal(r.value.name, "Sprite 1.5L");
  assert.deepEqual(r.value.offers[0], { store: "Korzinka", price: 12490, inStock: true });
  assert.equal(r.value.offers[1].oldPrice, 14990);
});

test("bad input is rejected with readable errors", () => {
  assert.equal(validateProduct({ name: "a", category: "", unit: "" }).ok, false);
  assert.equal(validateProduct({ name: "Fanta", category: "X", unit: "1 L", image: "javascript:alert(1)" }).ok, false);
  assert.equal(validateOffers([{ store: "Makro", price: -5 }]).errors.length, 1);
  assert.equal(validateOffers([{ store: "Makro", price: 10 }, { store: "makro", price: 12 }]).errors.length, 1);
  assert.equal(validateOffers([{ store: "Makro", price: 100, oldPrice: 90 }]).errors.length, 1);
});

test("only seeded / admin prices are editable", () => {
  assert.equal(isManagedOffer({ adapter: "seed" }), true);
  assert.equal(isManagedOffer({ adapter: "admin" }), true);
  assert.equal(isManagedOffer({}), true);
  assert.equal(isManagedOffer({ adapter: "korzinka" }), false);
});

test("admin check: listed + confirmed e-mail only", () => {
  process.env.ADMIN_GMAIL = "Boss@Gmail.com, second@gmail.com";
  assert.deepEqual(adminEmails(), ["boss@gmail.com", "second@gmail.com"]);
  assert.equal(isAdminUser({ email: "boss@gmail.com", email_confirmed_at: "2026-01-01" }), true);
  assert.equal(isAdminUser({ email: "boss@gmail.com" }), false); // unconfirmed sign-up
  assert.equal(isAdminUser({ email: "other@gmail.com", email_confirmed_at: "2026-01-01" }), false);
  delete process.env.ADMIN_GMAIL;
  assert.equal(isAdminUser({ email: "boss@gmail.com", email_confirmed_at: "2026-01-01" }), false);
});

test("bulk payloads are validated", () => {
  assert.equal(validateBulk(null).ok, false);
  assert.equal(validateBulk({ action: "wipe", slugs: ["a"] }).ok, false);
  assert.equal(validateBulk({ action: "delete", slugs: [] }).ok, false);
  assert.equal(validateBulk({ action: "delete", slugs: [1, "", "x".repeat(121)] }).ok, false);
  assert.equal(validateBulk({ action: "delete", slugs: Array.from({ length: 501 }, (_, i) => `p${i}`) }).ok, false);
  assert.equal(validateBulk({ action: "category", slugs: ["a"], category: "  " }).ok, false);
  assert.equal(validateBulk({ action: "stock", slugs: ["a"], inStock: "no" }).ok, false);
  assert.deepEqual(validateBulk({ action: "delete", slugs: ["a", "a", "b"] }).value, { action: "delete", slugs: ["a", "b"] });
  assert.equal(validateBulk({ action: "stock", slugs: ["a"], inStock: false }).value.inStock, false);
});

test("CSV cells are quoted and cannot start a spreadsheet formula", () => {
  assert.equal(csvCell("plain"), "plain");
  assert.equal(csvCell("a,b"), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell("=HYPERLINK(\"x\")"), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell("+998901234567"), "'+998901234567");
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(new Date("2026-01-02T03:04:05Z")), "2026-01-02T03:04:05.000Z");
  const out = toCsv([{ a: 1, b: "x" }, { a: 2, b: "y,z" }], [["a", "A"], [(r) => r.b.toUpperCase(), "B"]]);
  assert.equal(out, "\ufeffA,B\r\n1,X\r\n2,\"Y,Z\"\r\n");
});

test("only public http(s) image URLs are ever fetched by the server", () => {
  for (const ok of ["https://upload.wikimedia.org/a.jpg", "http://cdn.example.uz/x.png", "https://8.8.8.8/x"]) assert.equal(isPublicHttpUrl(ok), true, ok);
  for (const bad of ["", "not a url", "ftp://x.com/a", "javascript:alert(1)", "file:///etc/passwd", "http://localhost:5000/api", "http://app.localhost/a", "http://127.0.0.1/a", "http://10.1.2.3/a", "http://192.168.0.5/a", "http://172.16.0.1/a", "http://169.254.169.254/latest", "http://100.64.0.1/a", "http://[::1]/a", "http://[fd00::1]/a", "http://user:pw@example.com/a", "http://printer.local/a"]) assert.equal(isPublicHttpUrl(bad), false, bad);
});

test("probeImage: ok / broken / not an image / unreachable / timeout", async () => {
  const mk = (status, type = "image/jpeg") => async () => ({ status, headers: { get: () => type }, body: null });
  assert.deepEqual(await probeImage("https://a.uz/x.jpg", { fetchImpl: mk(200) }), { ok: true, status: 200 });
  assert.equal((await probeImage("https://a.uz/x.jpg", { fetchImpl: mk(404) })).reason, "broken");
  assert.equal((await probeImage("https://a.uz/x.jpg", { fetchImpl: mk(200, "text/html") })).reason, "not-image");
  assert.equal((await probeImage("https://a.uz/x.jpg", { fetchImpl: mk(503) })).reason, "unreachable");
  assert.equal((await probeImage("https://a.uz/x.jpg", { fetchImpl: mk(429) })).reason, "unreachable");
  assert.equal((await probeImage("http://127.0.0.1/x.jpg", { fetchImpl: mk(200) })).reason, "blocked");
  assert.equal((await probeImage("https://a.uz/x.jpg", { fetchImpl: async () => { throw new Error("boom"); } })).reason, "unreachable");
  const hang = (url, { signal }) => new Promise((_, rej) => signal.addEventListener("abort", () => rej(new Error("aborted"))));
  assert.equal((await probeImage("https://a.uz/x.jpg", { fetchImpl: hang, timeoutMs: 20 })).reason, "unreachable");
});
