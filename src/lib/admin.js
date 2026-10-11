import { useAuth } from "../context/AuthContext";

/* Admin e-mails come from .env.local:  VITE_ADMIN_GMAIL=you@gmail.com  (several: separate with commas).
 * This only decides whether the "Admin" link is SHOWN. The real protection is on the server:
 * every /api/admin/* route re-checks the signed-in Supabase user against the same list. */
const LIST = String(import.meta.env.VITE_ADMIN_GMAIL ?? "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

export const isAdminEmail = (email) => Boolean(email) && LIST.includes(String(email).toLowerCase());

export function useIsAdmin() {
  const { user } = useAuth();
  return isAdminEmail(user?.email);
}
