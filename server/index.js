import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ServerApiVersion } from "mongodb";

import { registerCatalogRoutes, startIngestScheduler } from "./catalog.js";
import { ensureIndexes } from "./ingest.js";
import { registerAccountRoutes } from "./account.js";
import { registerAvatarRoutes } from "./avatar.js";
import { registerContactRoutes } from "./contact.js";
import { registerAdminRoutes, ensureAdminIndexes } from "./admin.js";
import { seedIfEmpty } from "./seed.js";
import { ADMIN_API_VERSION } from "../shared/adminVersion.js";

import {
  translations,
  LANGUAGES,
} from "../shared/translations.js";

dotenv.config({ path: ".env.local" });
dotenv.config(); // also allow a plain .env

const app = express();

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "narxitop";

if (!MONGODB_URI) {
  console.error("❌ Missing MONGODB_URI in .env.local");
  process.exit(1);
}

app.use(
  cors({
    origin: [
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-ingest-token"],
  })
);

app.use(express.json({ limit: "1mb" })); // profile photos arrive as small base64 JPEGs
app.use(express.text({ type: "text/plain" }));

const client = new MongoClient(MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;

/* ------------------------------------------------------------------ */
/* Seed: copy every text from shared/translations.js into MongoDB.     */
/* Existing keys are overwritten, keys you added by hand are kept.     */
/* ------------------------------------------------------------------ */
async function seedTranslations() {
  const collection = db.collection("translations");

  for (const lang of LANGUAGES) {
    const set = { lang, updatedAt: new Date() };

    for (const [key, value] of Object.entries(translations[lang])) {
      // Mongo field names cannot contain "." — store keys with "|" instead.
      set[`messages.${key.replaceAll(".", "|")}`] = value;
    }

    await collection.updateOne(
      { _id: lang },
      { $set: set },
      { upsert: true }
    );
  }

  console.log(`✅ Translations seeded (${LANGUAGES.join(", ")})`);
}

/* ------------------------------ Routes ----------------------------- */

const catalog = registerCatalogRoutes(app, () => db);
registerAccountRoutes(app);
registerAvatarRoutes(app, () => db);
registerContactRoutes(app, () => db);
registerAdminRoutes(app, () => db, { invalidate: catalog.invalidate });

app.get("/api/health", async (req, res) => {
  try {
    if (!db) {
      return res
        .status(503)
        .json({ success: false, message: "Database is not connected.", adminApi: ADMIN_API_VERSION });
    }

    await db.command({ ping: 1 });

    res.json({
      success: true,
      message: "NarxTop API and MongoDB are connected.",
      database: MONGODB_DB_NAME,
      adminApi: ADMIN_API_VERSION, // the admin panel compares this to detect a server that was not restarted
    });
  } catch (error) {
    console.error("Health check error:", error);
    res
      .status(500)
      .json({ success: false, message: "MongoDB connection check failed." });
  }
});

app.get("/api/translations", (req, res) => {
  res.json({ success: true, languages: LANGUAGES });
});

app.get("/api/translations/:lang", async (req, res) => {
  const { lang } = req.params;

  if (!LANGUAGES.includes(lang)) {
    return res
      .status(404)
      .json({ success: false, message: "Unsupported language." });
  }

  try {
    const doc = await db
      .collection("translations")
      .findOne({ _id: lang });

    // Convert "nav|home" back to "nav.home"
    const messages = {};
    for (const [key, value] of Object.entries(doc?.messages || {})) {
      messages[key.replaceAll("|", ".")] = value;
    }

    res.json({ success: true, lang, messages });
  } catch (error) {
    console.error("Translations error:", error);
    res
      .status(500)
      .json({ success: false, message: "Could not load translations." });
  }
});

/* ------------------------- Fallbacks (JSON) ------------------------ */

// Unknown /api paths answer with JSON (never Express's HTML page), so the admin panel can tell
// "this server is older than the panel — restart it" apart from a real "not found".
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    code: "api_not_found",
    message: `API yo‘li topilmadi: ${req.method} ${req.originalUrl}`,
  });
});

// Malformed / oversized request bodies and any uncaught route error.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "So‘rov formati noto‘g‘ri (JSON)." });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ success: false, message: "So‘rov juda katta." });
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: "Server error" });
});

/* ------------------------------ Start ------------------------------ */

async function startServer() {
  try {
    await client.connect();
    db = client.db(MONGODB_DB_NAME);
    await db.command({ ping: 1 });

    console.log("✅ Connected to MongoDB");
    console.log(`✅ Database: ${MONGODB_DB_NAME}`);

    await seedTranslations();
    await ensureIndexes(db);
    await ensureAdminIndexes(db);
    await seedIfEmpty(db);
    startIngestScheduler(() => db);

    app.listen(PORT, () => {
      console.log(`✅ API server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Server startup failed:");
    console.error(error.message);
    process.exit(1);
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await client.close();
    process.exit(0);
  });
}

startServer();
