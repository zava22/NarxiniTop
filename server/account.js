/* DELETE /api/account — permanently deletes the signed-in Supabase user.
 * Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY on the server (never in the browser).
 * Without them the endpoint answers 501 and the UI explains it is not configured. */
import { createClient } from "@supabase/supabase-js";

export function registerAccountRoutes(app) {
  app.delete("/api/account", async (req, res) => {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return res.status(501).json({ success: false, message: "Not configured" });
    const token = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ success: false, message: "Unauthorized" });
    try {
      const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await admin.auth.getUser(token); // verifies the caller's own JWT
      if (error || !data?.user) return res.status(401).json({ success: false, message: "Unauthorized" });
      const { error: delError } = await admin.auth.admin.deleteUser(data.user.id);
      if (delError) throw delError;
      res.json({ success: true });
    } catch (e) {
      console.error("account delete failed:", e.message);
      res.status(500).json({ success: false, message: "Could not delete account" });
    }
  });
}
