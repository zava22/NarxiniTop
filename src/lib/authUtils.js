/* Pure auth helpers (validation, strength, error mapping, safe redirects). */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const COMMON = ["password", "12345678", "qwerty", "11111111", "parol123", "iloveyou", "123456789", "qwertyui", "admin123", "narxtop"];

export function validateEmail(v) { return EMAIL_RE.test(String(v).trim()); }
export function validatePhone(v) {
  if (!v) return true; // optional
  const d = String(v).replace(/\D/g, "");
  return d.length >= 9 && d.length <= 13;
}

/** 0..4 + the three visible rules */
export function passwordStrength(pw = "") {
  const rules = { len: pw.length >= 8, case: /[a-zа-я]/i.test(pw) && /[A-ZА-Я]/.test(pw) && /[a-zа-я]/.test(pw), num: /\d/.test(pw) };
  let score = 0;
  if (rules.len) score++;
  if (rules.case) score++;
  if (rules.num) score++;
  if (pw.length >= 12 || /[^A-Za-z0-9А-Яа-я]/.test(pw)) score++;
  if (COMMON.some((c) => pw.toLowerCase().includes(c)) || /^(.)\1+$/.test(pw) || /(012|123|234|345|456|567|678|789|abc|qwe)/i.test(pw)) score = Math.min(score, 1);
  if (pw.length < 6) score = Math.min(score, 1);
  if (!pw) score = 0;
  return { score, rules, ok: rules.len && rules.case && rules.num };
}

/** Only same-origin relative paths; blocks open redirects like //evil.com or /\evil.com */
export function safeNext(next, fallback = "/") {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /^\/(auth|reset-password)/.test(next)) return fallback;
  return next;
}

/** Supabase/network error -> i18n key. */
export function authErrorKey(e) {
  const msg = String(e?.message ?? e ?? "").toLowerCase();
  const code = String(e?.code ?? "").toLowerCase();
  if (e?.name === "TimeoutError" || msg === "timeout") return "auth.err.timeout";
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "auth.err.network";
  if (e?.name === "AuthRetryableFetchError" || msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("network request failed")) return "auth.err.network";
  if (msg.includes("invalid login") || code === "invalid_credentials") return "auth.err.invalid";
  if (msg.includes("not confirmed") || code === "email_not_confirmed") return "auth.err.notConfirmed";
  if (msg.includes("already registered") || code === "user_already_exists") return "auth.err.exists";
  if (msg.includes("password should") || code === "weak_password") return "auth.err.weak";
  if (e?.status === 429 || msg.includes("rate limit") || code.includes("rate_limit")) return "auth.err.rate";
  if (msg.includes("same password") || code === "same_password") return "auth.err.samePassword";
  if (msg.includes("expired") || msg.includes("invalid") && msg.includes("token")) return "auth.err.expired";
  return "auth.err.generic";
}

/** Rejects with a TimeoutError if the promise takes longer than `ms`. */
export function withTimeout(promise, ms = 15000) {
  let id;
  const timer = new Promise((_, reject) => { id = setTimeout(() => reject(Object.assign(new Error("timeout"), { name: "TimeoutError" })), ms); });
  return Promise.race([promise, timer]).finally(() => clearTimeout(id));
}
