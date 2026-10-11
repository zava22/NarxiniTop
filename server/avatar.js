/*
 * Profile photos in MongoDB.
 *   GET    /api/avatar   -> { success, avatar: "data:image/jpeg;base64,..." | null }
 *   PUT    /api/avatar   body { image: "data:image/...;base64,..." }  (saves / replaces)
 *   DELETE /api/avatar   removes the photo
 *
 * The caller is identified by their Supabase access token (Authorization: Bearer ...).
 * The token is verified with Supabase, and the Mongo document _id is the verified user id,
 * so a user can only ever read or write their own photo.
 * The browser downsizes the photo to 256x256 JPEG before sending (see Profile.jsx);
 * the server still validates type and size.
 */
import { createClient } from "@supabase/supabase-js";
import { Binary } from "mongodb";

const MAX_BYTES = 400 * 1024; // decoded image size limit
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

let verifier;
function getVerifier() {
  if (verifier) return verifier;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  verifier = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return verifier;
}

async function authenticate(req, res) {
  const client = getVerifier();
  if (!client) {
    res.status(501).json({ success: false, message: "Supabase is not configured on the server." });
    return null;
  }
  const token = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return null;
  }
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return null;
  }
  return data.user.id;
}

export function registerAvatarRoutes(app, getDb) {
  const col = () => getDb().collection("avatars");

  app.get("/api/avatar", async (req, res) => {
    try {
      const userId = await authenticate(req, res);
      if (!userId) return;
      const doc = await col().findOne({ _id: userId });
      if (!doc) return res.json({ success: true, avatar: null });
      const buf = Buffer.from(doc.data.buffer);
      res.set("Cache-Control", "private, no-store");
      res.json({
        success: true,
        avatar: `data:${doc.contentType};base64,${buf.toString("base64")}`,
        updatedAt: doc.updatedAt,
      });
    } catch (e) {
      console.error("avatar get failed:", e.message);
      res.status(500).json({ success: false, message: "Could not load photo." });
    }
  });

  app.put("/api/avatar", async (req, res) => {
    try {
      const userId = await authenticate(req, res);
      if (!userId) return;
      const m = DATA_URL.exec(String(req.body?.image ?? ""));
      if (!m) return res.status(400).json({ success: false, message: "Send a JPEG, PNG or WebP image." });
      const buf = Buffer.from(m[2], "base64");
      if (!buf.length || buf.length > MAX_BYTES) {
        return res.status(413).json({ success: false, message: "Image is too large." });
      }
      const updatedAt = new Date();
      await col().updateOne(
        { _id: userId },
        { $set: { contentType: m[1], data: new Binary(buf), size: buf.length, updatedAt } },
        { upsert: true }
      );
      res.json({ success: true, updatedAt });
    } catch (e) {
      console.error("avatar save failed:", e.message);
      res.status(500).json({ success: false, message: "Could not save photo." });
    }
  });

  app.delete("/api/avatar", async (req, res) => {
    try {
      const userId = await authenticate(req, res);
      if (!userId) return;
      await col().deleteOne({ _id: userId });
      res.json({ success: true });
    } catch (e) {
      console.error("avatar delete failed:", e.message);
      res.status(500).json({ success: false, message: "Could not remove photo." });
    }
  });
}
