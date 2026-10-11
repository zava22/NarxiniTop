import { useCallback, useEffect, useState } from "react";
import { DEFAULT_PREFS, sanitizePrefs } from "../components/admin/themes";

const KEY = "narxtop_admin_prefs";

function read() {
  try { return sanitizePrefs(JSON.parse(localStorage.getItem(KEY) || "null")); } catch { return { ...DEFAULT_PREFS }; }
}

/* Admin panel preferences (accent, density, corners, ...) kept in this browser only. */
export default function useAdminPrefs() {
  const [prefs, setPrefs] = useState(read);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* ignore */ } }, [prefs]);
  const set = useCallback((patch) => setPrefs((p) => sanitizePrefs({ ...p, ...patch })), []);
  const reset = useCallback(() => setPrefs({ ...DEFAULT_PREFS }), []);
  return { prefs, set, reset };
}
