/**
 * Fill missing branch coordinates from official map short links; optionally use
 * OpenStreetMap Nominatim as a conservative address-only fallback.
 *
 * Usage:
 *   npm run geocode:branches
 *   npm run geocode:branches -- --nominatim
 *
 * Only points inside Uzbekistan are accepted. Address-only geocoding requires a
 * street-level match; ambiguous/weak results stay blank rather than being guessed.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, "..");
const BRANCH_FILE = path.join(PROJECT_ROOT, "src", "data", "branches.json");
const WITH_NOMINATIM = process.argv.includes("--nominatim");
const today = new Date().toISOString().slice(0, 10);
const USER_AGENT = "NarxTop-BranchCoordinateEnricher/1.0 (public supermarket branch directory)";

function decode(value = "") {
  return String(value)
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([\da-f]{1,6});/gi, (_, x) => String.fromCodePoint(parseInt(x, 16)))
    .replace(/&#(\d+);/g, (_, x) => String.fromCodePoint(Number(x)));
}
function norm(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase().replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function valid(point) {
  return point && Number.isFinite(point.lat) && Number.isFinite(point.lng)
    && point.lat > 37 && point.lat < 46 && point.lng > 55 && point.lng < 74;
}
function pointFrom(text) {
  const s = decode(String(text)).replace(/\\u0026/g, "&");
  const patterns = [
    { re: /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/i },
    { re: /!2d(-?\d{1,3}\.\d+)!3d(-?\d{1,3}\.\d+)/i, swap: true },
    { re: /@(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/i },
    { re: /(?:center|destination|query|q)=(-?\d{1,3}(?:\.\d+)?)[,%2C+ ]+(-?\d{1,3}(?:\.\d+)?)/i },
    { re: /["'](?:lat|latitude)["']\s*:\s*(-?\d{1,3}\.\d+)[\s\S]{0,120}?["'](?:lng|lon|longitude)["']\s*:\s*(-?\d{1,3}\.\d+)/i },
    { re: /["'](?:lng|lon|longitude)["']\s*:\s*(-?\d{1,3}\.\d+)[\s\S]{0,120}?["'](?:lat|latitude)["']\s*:\s*(-?\d{1,3}\.\d+)/i, swap: true },
  ];
  for (const { re, swap = false } of patterns) {
    const match = s.match(re);
    if (!match) continue;
    const point = swap ? { lat: Number(match[2]), lng: Number(match[1]) } : { lat: Number(match[1]), lng: Number(match[2]) };
    if (valid(point)) return point;
  }
  return null;
}
async function get(url, timeout = 18000) {
  return fetch(url, {
    redirect: "follow",
    headers: { "user-agent": USER_AGENT, "accept-language": "uz,en;q=0.9,ru;q=0.8", accept: "text/html,application/json;q=0.9,*/*;q=0.8" },
    signal: AbortSignal.timeout(timeout),
  });
}
async function resolveMap(url) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const response = await get(url);
  let p = pointFrom(response.url || url);
  if (p) return p;
  const body = await response.text().catch(() => "");
  p = pointFrom(body);
  if (p) return p;
  const redirect = body.match(/(?:window\.location(?:\.href)?\s*=|content\s*=\s*["'][^;]*?url=)["']?(https?:[^"'\s<>]+)/i)?.[1];
  return redirect ? pointFrom(decode(redirect)) : null;
}
function candidateScore(branch, result) {
  const addr = norm(`${branch.name ?? ""} ${branch.address ?? ""}`);
  const found = norm(`${result.name ?? ""} ${result.display_name ?? ""}`);
  const generic = new Set(["havas", "korzinka", "makro", "uzbekistan", "uzbekiston", "toshkent", "tashkent", "tumani", "district", "street", "kochasi", "kuchasi", "uy", "house", "the", "market"]);
  const tokens = [...new Set(addr.split(" ").filter((t) => t.length >= 4 && !generic.has(t)))];
  if (tokens.length < 2) return 0;
  const matches = tokens.filter((token) => found.includes(token));
  return matches.length / tokens.length;
}
async function geocodeAddress(branch) {
  const query = `${branch.name ?? branch.chain} ${branch.address ?? ""}, Uzbekistan`.trim();
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=uz&q=${encodeURIComponent(query)}`;
  const response = await get(url, 20000);
  if (!response.ok) throw new Error(`Nominatim HTTP ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) return null;
  const candidates = rows.map((row) => ({
    row,
    point: { lat: Number(row.lat), lng: Number(row.lon) },
    score: candidateScore(branch, row),
    isShop: /shop|supermarket|convenience|grocery|market/i.test(`${row.class} ${row.type}`),
  })).filter((x) => valid(x.point) && (x.score >= 0.60 || (x.isShop && x.score >= 0.30)));
  candidates.sort((a, b) => b.score - a.score || Number(b.isShop) - Number(a.isShop));
  if (!candidates.length) return null;
  return { ...candidates[0].point, score: candidates[0].score, displayName: candidates[0].row.display_name };
}

const data = JSON.parse(await fs.readFile(BRANCH_FILE, "utf8"));
if (!Array.isArray(data)) throw new Error("src/data/branches.json must be a JSON array");
const missing = data.filter((b) => !valid({ lat: Number(b.lat), lng: Number(b.lng) }));
let mapFound = 0;
let addressFound = 0;
let failures = 0;
console.log(`Branch records: ${data.length}; missing coordinates: ${missing.length}.`);

// Resolve official map short links in small batches to avoid hammering map providers.
for (let i = 0; i < missing.length; i += 1) {
  const branch = missing[i];
  if (!branch.mapsUrl) continue;
  try {
    const p = await resolveMap(branch.mapsUrl);
    if (p) {
      branch.lat = p.lat;
      branch.lng = p.lng;
      branch.coordinateSource = "official-map-link";
      branch.coordinateVerifiedAt = today;
      mapFound += 1;
    }
  } catch (error) {
    failures += 1;
    console.warn(`Map link unresolved for ${branch.chain} ${branch.name}: ${error.message}`);
  }
  if (i > 0 && i % 20 === 0) console.log(`Checked ${i}/${missing.length} branches...`);
}

if (WITH_NOMINATIM) {
  const unresolved = data.filter((b) => !valid({ lat: Number(b.lat), lng: Number(b.lng) }) && b.address);
  console.log(`Trying cautious OpenStreetMap address matching for ${unresolved.length} remaining branches (about 1 request/second).`);
  for (let i = 0; i < unresolved.length; i += 1) {
    const branch = unresolved[i];
    try {
      const p = await geocodeAddress(branch);
      if (p) {
        branch.lat = p.lat;
        branch.lng = p.lng;
        branch.coordinateSource = "openstreetmap-address-match";
        branch.coordinateVerifiedAt = today;
        addressFound += 1;
      }
    } catch (error) {
      failures += 1;
      console.warn(`Address not geocoded for ${branch.chain} ${branch.name}: ${error.message}`);
    }
    if (i < unresolved.length - 1) await new Promise((resolve) => setTimeout(resolve, 1100));
    if ((i + 1) % 20 === 0) console.log(`Address geocoding: ${i + 1}/${unresolved.length}...`);
  }
}

await fs.writeFile(BRANCH_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");
const stillMissing = data.filter((b) => !valid({ lat: Number(b.lat), lng: Number(b.lng) }));
console.log(`Done. Coordinates found via official map links: ${mapFound}; via address matching: ${addressFound}.`);
console.log(`Still missing coordinates: ${stillMissing.length}; transient errors: ${failures}.`);
console.log("No coordinates were guessed. Remaining branches stay in the directory and can still link to their maps/address.");
