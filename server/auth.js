/* Shared Supabase token verification + admin check for the Express routes.
 * The browser sends its Supabase access token (Authorization: Bearer ...); we ask Supabase who it is.
 * Admins are the e-mails listed in ADMIN_GMAIL (or VITE_ADMIN_GMAIL from .env.local), comma separated.
 * The check happens HERE, on the server, so hiding the link in the navbar is only cosmetics. */
let verifier;
/* The Supabase SDK is loaded on first use, so this module (and the admin routes) can be imported and tested without it. */
async function getVerifier() {
  if (verifier) return verifier;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  verifier = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return verifier;
}

export const adminEmails = () =>
  String(process.env.ADMIN_GMAIL || process.env.VITE_ADMIN_GMAIL || "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

export function isAdminUser(user) {
  const email = String(user?.email ?? "").toLowerCase();
  const confirmed = Boolean(user?.email_confirmed_at || user?.confirmed_at); // an unconfirmed sign-up must never become admin
  return Boolean(email) && confirmed && adminEmails().includes(email);
}

/* -> { user } | { status, message } */
export async function verifyUser(req) {
  const client = await getVerifier();
  if (!client) return { status: 501, message: "Supabase is not configured on the server." };
  const token = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return { status: 401, message: "Unauthorized" };
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return { status: 401, message: "Unauthorized" };
  return { user: data.user };
}

export async function requireAdmin(req, res, next) {
  try {
    if (!adminEmails().length) return res.status(501).json({ success: false, message: "ADMIN_GMAIL / VITE_ADMIN_GMAIL is not set in .env.local" });
    const r = await verifyUser(req);
    if (!r.user) return res.status(r.status).json({ success: false, message: r.message });
    if (!isAdminUser(r.user)) return res.status(403).json({ success: false, message: "Forbidden" });
    req.admin = r.user;
    next();
  } catch (e) {
    console.error("admin auth failed:", e.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
}
