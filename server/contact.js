/*
 * "Contact us" messages.
 *
 *   POST /api/contact   body { message, name?, email?, website?, meta? }
 *
 *  - Signed-in users: the browser sends only the message + their Supabase access token
 *    (Authorization: Bearer ...). The token is verified with Supabase and the NAME and EMAIL
 *    come from the verified account, never from the request body, so nobody can send a
 *    message "as" somebody else.
 *  - Guests (no token): must provide name + email so we can reply.
 *
 * Every message is (1) saved in MongoDB (collection "contact_messages") so nothing is lost,
 * then (2) e-mailed to the admin with Reply-To set to the sender, so pressing "Reply" in Gmail
 * answers the user directly. See SETUP.md ("Contact form e-mail") for the .env values.
 */
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

export const LIMITS = { minMessage: 10, maxMessage: 3000, maxName: 80, maxEmail: 254 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ------------------------------- helpers ------------------------------- */

const oneLine = (v, max) => String(v ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max);
const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Name shown to the admin for a Supabase user (full name if the account has one). */
export function accountName(user) {
  const m = user?.user_metadata || {};
  return oneLine(m.full_name || m.name || [m.given_name, m.family_name].filter(Boolean).join(" ") || user?.email?.split("@")[0] || "", LIMITS.maxName);
}

/** Validates the request body. Returns { ok, error, value }. `account` is the verified user or null. */
export function validateContact(body, account) {
  const message = String(body?.message ?? "").replace(/\r\n/g, "\n").trim();
  if (message.length < LIMITS.minMessage) return { ok: false, error: "short" };
  if (message.length > LIMITS.maxMessage) return { ok: false, error: "long" };

  let name, email;
  if (account) {
    name = accountName(account);
    email = oneLine(account.email, LIMITS.maxEmail);
  } else {
    name = oneLine(body?.name, LIMITS.maxName);
    email = oneLine(body?.email, LIMITS.maxEmail);
    if (!name) return { ok: false, error: "name" };
  }
  if (!EMAIL_RE.test(email)) return { ok: false, error: "email" };

  const meta = body?.meta && typeof body.meta === "object" ? body.meta : {};
  return {
    ok: true,
    value: {
      message,
      name: name || email.split("@")[0],
      email,
      meta: {
        page: oneLine(meta.page, 300),
        lang: oneLine(meta.lang, 12),
        viewport: oneLine(meta.viewport, 24),
        userAgent: oneLine(meta.userAgent, 300),
      },
    },
  };
}

/** Builds the e-mail the admin receives. */
export function buildEmail({ name, email, message, meta, userId, createdAt }, { to, from }) {
  const status = userId ? "Registered account" : "Guest (no account)";
  const lines = [
    `From:     ${name} <${email}>`,
    `Account:  ${status}${userId ? ` (id ${userId})` : ""}`,
    `Sent at:  ${createdAt.toISOString()}`,
    meta.page && `Page:     ${meta.page}`,
    meta.lang && `Language: ${meta.lang}`,
    meta.viewport && `Screen:   ${meta.viewport}`,
    meta.userAgent && `Browser:  ${meta.userAgent}`,
  ].filter(Boolean);

  const text = `${lines.join("\n")}\n\n--- Message ---\n${message}\n\nPress "Reply" to answer ${name} directly.`;

  const row = (k, v) => `<tr><td style="padding:3px 14px 3px 0;color:#7a6657">${k}</td><td style="padding:3px 0">${v}</td></tr>`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#2a1d14;max-width:640px">
  <h2 style="margin:0 0 12px;font-size:18px">New message from NarxTop contact form</h2>
  <table style="border-collapse:collapse;font-size:14px;margin-bottom:16px">
    ${row("Name", `<b>${escapeHtml(name)}</b>`)}
    ${row("Email", `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`)}
    ${row("Account", userId ? `Registered account <span style="color:#7a6657">(id ${escapeHtml(userId)})</span>` : "Guest (no account)")}
    ${row("Sent at", escapeHtml(createdAt.toISOString()))}
    ${meta.page ? row("Page", escapeHtml(meta.page)) : ""}
    ${meta.lang ? row("Language", escapeHtml(meta.lang)) : ""}
    ${meta.viewport ? row("Screen", escapeHtml(meta.viewport)) : ""}
    ${meta.userAgent ? row("Browser", escapeHtml(meta.userAgent)) : ""}
  </table>
  <div style="white-space:pre-wrap;line-height:1.55;padding:14px 16px;background:#f4ece5;border-radius:12px;border:1px solid #e9ddd2">${escapeHtml(message)}</div>
  <p style="color:#7a6657;font-size:13px;margin-top:14px">Press <b>Reply</b> to answer ${escapeHtml(name)} directly.</p>
</div>`;

  return {
    from: `"NarxTop Contact" <${from}>`,
    to,
    replyTo: `"${name.replace(/["\\]/g, "")}" <${email}>`,
    subject: `[NarxTop] ${userId ? "Message" : "Guest message"} from ${name} (${email})`,
    text,
    html,
  };
}

/** Small in-memory limiter: at most `max` hits per `windowMs` for a key. */
export function createLimiter(max, windowMs, now = () => Date.now()) {
  const hits = new Map();
  return (key) => {
    const t = now();
    const recent = (hits.get(key) || []).filter((x) => t - x < windowMs);
    if (recent.length >= max) { hits.set(key, recent); return false; }
    recent.push(t);
    hits.set(key, recent);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((x) => t - x < windowMs)) hits.delete(k);
    return true;
  };
}

/* --------------------------- mail / supabase --------------------------- */

export function mailConfig(env = process.env) {
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASS;
  const to = env.CONTACT_TO || env.CONTACT_TO_EMAIL;
  if (!user || !pass || !to) return null;
  const port = Number(env.SMTP_PORT) || 465;
  return {
    to,
    from: env.CONTACT_FROM || user,
    transport: { host: env.SMTP_HOST || "smtp.gmail.com", port, secure: env.SMTP_SECURE ? env.SMTP_SECURE !== "false" : port === 465, auth: { user, pass } },
  };
}

let verifier;
function getVerifier() {
  if (verifier) return verifier;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  verifier = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return verifier;
}

async function verifyToken(token) {
  const client = getVerifier();
  if (!client) return null;
  const { data, error } = await client.auth.getUser(token);
  return error || !data?.user ? null : data.user;
}

/* -------------------------------- routes -------------------------------- */

/**
 * @param deps optional overrides for tests: { verifyUser(token), sendMail(message), mail, now }
 */
export function registerContactRoutes(app, getDb, deps = {}) {
  const mail = "mail" in deps ? deps.mail : mailConfig();
  const verifyUser = deps.verifyUser || verifyToken;
  let transporter;
  const sendMail = deps.sendMail || ((message) => (transporter ??= nodemailer.createTransport(mail.transport)).sendMail(message));
  const now = deps.now || (() => new Date());

  const perSender = createLimiter(5, 10 * 60 * 1000); // 5 messages / 10 min per account or IP
  const perIp = createLimiter(20, 60 * 60 * 1000); // 20 messages / hour per IP

  if (!mail) console.warn("⚠️  Contact form: SMTP_USER / SMTP_PASS / CONTACT_TO are not set — messages are saved in MongoDB but NOT e-mailed (see SETUP.md).");
  else console.log(`✅ Contact form e-mails go to ${mail.to}`);

  app.post("/api/contact", async (req, res) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};

      // Signed-in? Then identity comes from the verified token only.
      let account = null;
      const token = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
      if (token) {
        account = await verifyUser(token);
        if (!account) return res.status(401).json({ success: false, code: "auth", message: "Session expired. Please sign in again." });
      }

      const ip = req.ip || req.socket?.remoteAddress || "unknown";
      if (!perIp(ip) || !perSender(account?.id || ip)) {
        return res.status(429).json({ success: false, code: "rate", message: "Too many messages. Please wait a little." });
      }

      // Honeypot: real people never fill the hidden "website" field. Pretend success to bots.
      if (body.website) return res.json({ success: true });

      const checked = validateContact(body, account);
      if (!checked.ok) return res.status(400).json({ success: false, code: checked.error, message: "Invalid message." });

      const doc = { ...checked.value, userId: account?.id ?? null, ip, createdAt: now(), emailStatus: mail ? "pending" : "not_configured" };

      // 1) save first, so the message survives a mail outage
      let saved = false;
      let insertedId = null;
      try {
        const r = await getDb().collection("contact_messages").insertOne({ ...doc });
        saved = true;
        insertedId = r.insertedId;
      } catch (e) {
        console.error("contact save failed:", e.message);
      }

      // 2) e-mail the admin (Reply-To = the user)
      let emailed = false;
      if (mail) {
        try {
          await sendMail(buildEmail(doc, mail));
          emailed = true;
        } catch (e) {
          console.error("contact e-mail failed:", e.message);
        }
        if (saved) {
          getDb().collection("contact_messages").updateOne({ _id: insertedId }, { $set: { emailStatus: emailed ? "sent" : "failed" } }).catch(() => {});
        }
      }

      if (!saved && !emailed) {
        return res.status(mail ? 502 : 500).json({ success: false, code: "send", message: "Could not send your message." });
      }
      res.json({ success: true, emailed, email: doc.email });
    } catch (e) {
      console.error("contact failed:", e.message);
      res.status(500).json({ success: false, code: "send", message: "Could not send your message." });
    }
  });
}
