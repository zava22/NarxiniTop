import test from "node:test";
import assert from "node:assert/strict";
import express from "express";

import { buildEmail, createLimiter, mailConfig, registerContactRoutes, validateContact, accountName } from "../contact.js";

const user = { id: "u-123", email: "muhammad@gmail.com", user_metadata: { full_name: "Muhammad Saleh" } };

/* ---------- pure helpers ---------- */

test("signed-in users: name and email come from the account, not the body", () => {
  const r = validateContact({ message: "The search page is broken on my phone", name: "Evil", email: "evil@x.com" }, user);
  assert.equal(r.ok, true);
  assert.equal(r.value.name, "Muhammad Saleh");
  assert.equal(r.value.email, "muhammad@gmail.com");
});

test("accountName falls back to the e-mail prefix", () => {
  assert.equal(accountName({ email: "ali@mail.uz", user_metadata: {} }), "ali");
});

test("message length rules", () => {
  assert.equal(validateContact({ message: "short" }, user).error, "short");
  assert.equal(validateContact({ message: "x".repeat(3001) }, user).error, "long");
  assert.equal(validateContact({ message: "x".repeat(3000) }, user).ok, true);
});

test("guests need a name and a valid e-mail", () => {
  const msg = "Prices look wrong for milk in Korzinka";
  assert.equal(validateContact({ message: msg, email: "a@b.uz" }, null).error, "name");
  assert.equal(validateContact({ message: msg, name: "Ali", email: "nope" }, null).error, "email");
  assert.equal(validateContact({ message: msg, name: "Ali", email: "ali@b.uz" }, null).ok, true);
});

test("name/email cannot smuggle header line breaks", () => {
  const r = validateContact({ message: "A long enough message here", name: "Ali\r\nBcc: x@y.z", email: "ali@b.uz" }, null);
  assert.ok(!/[\r\n]/.test(r.value.name));
});

test("admin e-mail shows the user's name, e-mail, message and replies to the user", () => {
  const mail = buildEmail(
    { name: "Muhammad Saleh", email: "muhammad@gmail.com", message: "Hello <b>admin</b>", meta: { page: "/search", userAgent: "UA" }, userId: "u-123", createdAt: new Date("2026-10-10T10:00:00Z") },
    { to: "admin@gmail.com", from: "site@gmail.com" }
  );
  assert.equal(mail.to, "admin@gmail.com");
  assert.match(mail.replyTo, /muhammad@gmail.com/);
  assert.match(mail.subject, /Muhammad Saleh/);
  assert.match(mail.text, /Registered account/);
  assert.match(mail.text, /Hello <b>admin<\/b>/);
  assert.ok(mail.html.includes("Hello &lt;b&gt;admin&lt;/b&gt;"), "html body is escaped");
});

test("limiter allows `max` hits per window then blocks, then recovers", () => {
  let t = 0;
  const hit = createLimiter(2, 1000, () => t);
  assert.ok(hit("a")); assert.ok(hit("a")); assert.equal(hit("a"), false);
  assert.ok(hit("b"));
  t = 1500;
  assert.ok(hit("a"));
});

test("mailConfig needs user, password and recipient", () => {
  assert.equal(mailConfig({}), null);
  const c = mailConfig({ SMTP_USER: "me@gmail.com", SMTP_PASS: "x", CONTACT_TO: "admin@gmail.com" });
  assert.equal(c.transport.host, "smtp.gmail.com");
  assert.equal(c.transport.secure, true);
  assert.equal(c.from, "me@gmail.com");
});

/* ---------- HTTP route ---------- */

async function boot({ mail = { to: "admin@gmail.com", from: "site@gmail.com" }, sendMail, failDb = false } = {}) {
  const saved = [];
  const sent = [];
  const db = { collection: () => ({
    insertOne: async (d) => { if (failDb) throw new Error("db down"); saved.push(d); return { insertedId: saved.length }; },
    updateOne: async () => ({}),
  }) };
  const app = express();
  app.use(express.json());
  registerContactRoutes(app, () => db, {
    mail,
    verifyUser: async (tok) => (tok === "good" ? user : null),
    sendMail: sendMail || (async (m) => { sent.push(m); }),
  });
  const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  const url = `http://127.0.0.1:${server.address().port}/api/contact`;
  const post = (body, token) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  return { post, saved, sent, close: () => server.close() };
}

test("route: signed-in user -> saved + e-mailed with account identity", async () => {
  const s = await boot();
  const res = await s.post({ message: "Button 'add to cart' does nothing on iPhone", name: "ignored" }, "good");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true); assert.equal(body.emailed, true);
  assert.equal(s.saved[0].userId, "u-123");
  assert.equal(s.saved[0].name, "Muhammad Saleh");
  assert.match(s.sent[0].replyTo, /muhammad@gmail.com/);
  s.close();
});

test("route: invalid token -> 401, nothing stored", async () => {
  const s = await boot();
  const res = await s.post({ message: "A long enough message here" }, "bad");
  assert.equal(res.status, 401);
  assert.equal(s.saved.length, 0);
  s.close();
});

test("route: guest without e-mail -> 400", async () => {
  const s = await boot();
  const res = await s.post({ message: "A long enough message here", name: "Ali" });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, "email");
  s.close();
});

test("route: honeypot is silently dropped", async () => {
  const s = await boot();
  const res = await s.post({ message: "A long enough message here", name: "Bot", email: "b@b.uz", website: "http://spam" });
  assert.equal(res.status, 200);
  assert.equal(s.saved.length, 0); assert.equal(s.sent.length, 0);
  s.close();
});

test("route: mail failure still succeeds when the message was saved", async () => {
  const s = await boot({ sendMail: async () => { throw new Error("smtp down"); } });
  const res = await s.post({ message: "A long enough message here" }, "good");
  const body = await res.json();
  assert.equal(res.status, 200); assert.equal(body.emailed, false);
  assert.equal(s.saved.length, 1);
  s.close();
});

test("route: both save and mail fail -> error", async () => {
  const s = await boot({ failDb: true, sendMail: async () => { throw new Error("smtp down"); } });
  const res = await s.post({ message: "A long enough message here" }, "good");
  assert.equal(res.status, 502);
  s.close();
});

test("route: rate limit kicks in after 5 quick messages", async () => {
  const s = await boot();
  let last;
  for (let i = 0; i < 6; i++) last = await s.post({ message: `Message number ${i} with enough text` }, "good");
  assert.equal(last.status, 429);
  s.close();
});
