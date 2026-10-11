// Imports src/data/products.json into MongoDB.   npm run seed            -> adds what is missing
//                                                npm run seed -- --force -> refreshes every product in the file
import dotenv from "dotenv";
import { MongoClient, ServerApiVersion } from "mongodb";
import { seedProducts } from "../server/seed.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) { console.error("❌ Missing MONGODB_URI in .env.local"); process.exit(1); }

const client = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true } });
try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || "narxitop");
  const r = await seedProducts(db, { overwrite: process.argv.includes("--force") });
  console.log(`✅ products.json -> MongoDB "${db.databaseName}": ${r.total} in file, ${r.productsAdded} products and ${r.offersAdded} prices added`);
} catch (e) {
  console.error("❌ Seed failed:", e.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
