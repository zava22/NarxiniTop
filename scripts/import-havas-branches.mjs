/**
 * Import every currently published HAVAS branch from the official store locator.
 *
 * Usage: npm run import:havas
 *
 * The importer uses Node's built-in fetch APIs. It preserves other chains, keeps existing
 * coordinates, and tries to resolve each official Google Maps short link for new coordinates.
 * It never invents coordinates: a location stays unranked if its map link does not expose them.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, "..");
const BRANCH_FILE = path.join(PROJECT_ROOT, "src", "data", "branches.json");
const BASE_URL = "https://havasfood.uz/en/markets/";
const OFFICIAL_SOURCE = "https://havasfood.uz/ru/markets/";
const PHONE_FALLBACK = "+998712059595";
const HOURS_FALLBACK = "08:00-22:00";
const MAX_CONCURRENCY = 4;

function decodeHtml(value = "") {
  return String(value)
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;|&#x0*27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([\da-f]{1,6});/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function stripTags(value = "") {
  return decodeHtml(String(value).replace(/<[^>]*>/g, " "))
    .replace(/[\u200b\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlToMarkedText(input) {
  // Keep hrefs beside their link text so that official directions links can be saved.
  let html = input
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ");

  html = html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi, (_all, attrs, inner) => {
    const href = attrs.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2];
    const label = stripTags(inner);
    return ` ${label} ${href ? ` [LINK_URL:${decodeHtml(href)}] ` : ""} `;
  });

  html = html
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/section|\/article|\/tr|\/td|\/ul|\/ol)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeHtml(html).replace(/[\u200b\uFEFF]/g, "").replace(/\r/g, "");
}

async function fetchPage(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: {
          "user-agent": "NarxTop-Havas-Branch-Importer/1.0 (official public store locator import)",
          "accept-language": "en-US,en;q=0.9,uz;q=0.8,ru;q=0.7",
          accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(25000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      const html = await response.text();
      if (!/H\s*\d{1,3}/i.test(html)) throw new Error(`No Havas branch codes found in ${url}`);
      return html;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
    }
  }
  throw lastError;
}

function isUzbekistanPoint(point) {
  return point && Number.isFinite(point.lat) && Number.isFinite(point.lng)
    && point.lat > 37 && point.lat < 46 && point.lng > 55 && point.lng < 74;
}

function extractCoordinates(input = "") {
  const text = decodeHtml(String(input)).replace(/\\u0026/g, "&");
  const patterns = [
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/i,
    /!2d(-?\d{1,3}\.\d+)!3d(-?\d{1,3}\.\d+)/i,
    /@(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/i,
    /(?:center|destination|query|q)=(-?\d{1,3}(?:\.\d+)?)[,%2C+ ]+(-?\d{1,3}(?:\.\d+)?)/i,
    /["'](?:lat|latitude)["']\s*:\s*(-?\d{1,3}\.\d+)[\s\S]{0,120}?["'](?:lng|lon|longitude)["']\s*:\s*(-?\d{1,3}\.\d+)/i,
    /["'](?:lng|lon|longitude)["']\s*:\s*(-?\d{1,3}\.\d+)[\s\S]{0,120}?["'](?:lat|latitude)["']\s*:\s*(-?\d{1,3}\.\d+)/i,
  ];
  for (const [index, pattern] of patterns.entries()) {
    const match = text.match(pattern);
    if (!match) continue;
    const point = index === 1 ? { lat: Number(match[2]), lng: Number(match[1]) }
      : index === 5 ? { lat: Number(match[2]), lng: Number(match[1]) }
        : { lat: Number(match[1]), lng: Number(match[2]) };
    if (isUzbekistanPoint(point)) return point;
  }
  return null;
}

async function resolveMapCoordinates(mapUrl) {
  if (!mapUrl || !/^https?:\/\//i.test(mapUrl)) return null;
  const response = await fetch(mapUrl, {
    redirect: "follow",
    headers: {
      "user-agent": "NarxTop-Havas-Branch-Importer/1.1 (resolving official public map links)",
      "accept-language": "uz,en;q=0.9,ru;q=0.8",
      accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(18000),
  });
  const finalUrl = response.url || mapUrl;
  let point = extractCoordinates(finalUrl);
  if (point) return point;
  const body = await response.text().catch(() => "");
  point = extractCoordinates(body);
  if (point) return point;
  // Some map shorteners return an HTML page with an explicit redirect.
  const redirectTarget = body.match(/(?:window\.location(?:\.href)?\s*=|content\s*=\s*["'][^;]*?url=)["']?(https?:[^"'\s<>]+)/i)?.[1];
  return redirectTarget ? extractCoordinates(decodeHtml(redirectTarget)) : null;
}

function getPageCount(html) {
  const matches = [...html.matchAll(/(?:\/markets\/page\/|[?&](?:paged|page)=)(\d+)/gi)]
    .map((match) => Number(match[1]))
    .filter((n) => Number.isInteger(n) && n > 0);
  return Math.max(1, ...matches);
}

function cleanAddress(value, code) {
  return stripTags(value)
    .replace(new RegExp(`^\\s*(?:Image\\s*:\\s*)?${code}\\b`, "i"), "")
    .replace(/\b(?:Address|Working Hours|Working hours|Tel|Phone)\s*:.*/i, "")
    .replace(/\[LINK_URL:[^\]]+\]/gi, "")
    .replace(/\b(?:Show on the map|Show on map)\b.*$/i, "")
    .replace(/\s+\bAddress\b\s*:?$/i, "")
    .replace(/[|•]+$/g, "")
    .trim();
}

function parseBranches(html, pageUrl) {
  const text = htmlToMarkedText(html);
  const lower = text.toLowerCase();
  const headingAt = lower.indexOf("store addresses") >= 0
    ? lower.indexOf("store addresses")
    : lower.indexOf("store address") >= 0
      ? lower.indexOf("store address")
      : lower.indexOf("our stores");
  if (headingAt < 0) throw new Error(`Could not find the store-list section on ${pageUrl}`);
  const footerAt = (() => {
    const options = [lower.indexOf("do you have any questions", headingAt), lower.indexOf("yuqoriga", headingAt)]
      .filter((n) => n >= 0);
    return options.length ? Math.min(...options) : text.length;
  })();
  const listing = text.slice(headingAt, footerAt);
  const codeRegex = /\bH\s*(\d{1,3})\b/gi;
  const matches = [...listing.matchAll(codeRegex)];
  const best = new Map();

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const codeNum = String(Number(match[1]));
    const code = `H${codeNum}`;
    const start = match.index + match[0].length;
    const nextStart = matches[i + 1]?.index ?? Math.min(listing.length, start + 1400);
    const chunk = listing.slice(start, nextStart);

    // Official page label precedes the maps link; the actual street address is the text before it.
    const preMeta = chunk.split(/\b(?:Address|Working Hours|Working hours|Tel|Phone)\s*:/i)[0];
    const address = cleanAddress(preMeta, code);
    const mapUrl = chunk.match(/\[LINK_URL:(https?:\/\/[^\]\s]+)\]/i)?.[1]
      ?? chunk.match(/https?:\/\/maps\.(?:app\.)?goo\.gl\/[^\s\]]+/i)?.[0]
      ?? null;
    const hours = chunk.match(/\bWorking Hours\s*:\s*(\d{1,2}:\d{2}\s*[-–—]\s*\d{1,2}:\d{2}|24\s*\/\s*7)/i)?.[1]?.replace(/\s+/g, "")
      ?? chunk.match(/\bIsh tartibi\s*:\s*(\d{1,2}:\d{2}\s*[-–—]\s*\d{1,2}:\d{2})/i)?.[1]?.replace(/\s+/g, "")
      ?? null;
    const phone = chunk.match(/(?:\bTel\s*:|\bPhone\s*:|\bTel\s*:?)\s*(\+?\d[\d\s()-]{7,})/i)?.[1]?.replace(/[\s()-]/g, "") ?? null;

    // Image alt text can repeat a branch code without its address. Prefer the fullest card.
    const score = (address.length > 5 ? address.length : 0) + (mapUrl ? 1000 : 0) + (hours ? 100 : 0) + (phone ? 20 : 0);
    if (address.length < 5 && !mapUrl) continue;
    const current = best.get(code);
    if (!current || score > current.score) {
      best.set(code, { code, address: address || current?.address || code, mapsUrl: mapUrl || current?.mapsUrl || null, hours: hours || current?.hours || null, phone: phone || current?.phone || null, score });
    }
  }
  return [...best.values()].map(({ score: _score, ...branch }) => branch);
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }));
  return results;
}

const firstHtml = await fetchPage(BASE_URL);
const pageCount = getPageCount(firstHtml);
console.log(`Official HAVAS store locator: ${pageCount} pages detected.`);
const pageUrls = Array.from({ length: pageCount }, (_, i) => i === 0 ? BASE_URL : new URL(`page/${i + 1}/`, BASE_URL).toString());
const pages = await mapLimit(pageUrls, MAX_CONCURRENCY, async (url, index) => {
  const html = index === 0 ? firstHtml : await fetchPage(url);
  const branches = parseBranches(html, url);
  if (branches.length === 0) throw new Error(`No branch records parsed from page ${index + 1}: ${url}`);
  console.log(`Page ${index + 1}/${pageCount}: ${branches.length} branch-code records`);
  return branches;
});

const scraped = new Map();
for (const page of pages) {
  for (const branch of page) {
    const id = `havas-${branch.code.toLowerCase()}`;
    const previous = scraped.get(id);
    const score = (branch.address?.length ?? 0) + (branch.mapsUrl ? 1000 : 0) + (branch.hours ? 100 : 0);
    const oldScore = previous ? (previous.address?.length ?? 0) + (previous.mapsUrl ? 1000 : 0) + (previous.hours ? 100 : 0) : -1;
    if (!previous || score > oldScore) scraped.set(id, { ...branch, id });
  }
}

if (scraped.size < 100) {
  throw new Error(`Safety check stopped the import: only ${scraped.size} unique Havas branches were parsed. Existing data was not changed.`);
}

const current = JSON.parse(await fs.readFile(BRANCH_FILE, "utf8"));
if (!Array.isArray(current)) throw new Error("src/data/branches.json is not a JSON array");
const existingHavas = new Map(current.filter((b) => b?.chain === "Havas").map((b) => [b.id, b]));
const today = new Date().toISOString().slice(0, 10);
let coordinateResolved = 0;
const imported = await mapLimit([...scraped.values()], MAX_CONCURRENCY, async (branch) => {
  const previous = existingHavas.get(branch.id) ?? {};
  let point = (isUzbekistanPoint({ lat: Number(previous.lat), lng: Number(previous.lng) })
    ? { lat: Number(previous.lat), lng: Number(previous.lng) }
    : null);
  if (!point && branch.mapsUrl) {
    try {
      point = await resolveMapCoordinates(branch.mapsUrl);
      if (point) coordinateResolved += 1;
    } catch (error) {
      console.warn(`Could not resolve map coordinates for ${branch.code}: ${error.message}`);
    }
  }
  const next = {
    ...previous,
    id: branch.id,
    chain: "Havas",
    name: branch.code,
    address: branch.address || previous.address || branch.code,
    hours: branch.hours || previous.hours || HOURS_FALLBACK,
    phone: branch.phone || previous.phone || PHONE_FALLBACK,
    source: OFFICIAL_SOURCE,
    verifiedAt: today,
  };
  if (branch.mapsUrl) next.mapsUrl = branch.mapsUrl;
  if (point) {
    next.lat = point.lat;
    next.lng = point.lng;
    next.coordinateSource = previous.coordinateSource || (previous.lat != null && previous.lng != null ? "existing" : "official-map-link");
  }
  if (previous.district) next.district = previous.district;
  return next;
});

const nonHavas = current.filter((b) => b?.chain !== "Havas");
const output = [...nonHavas, ...imported].sort((a, b) => {
  const chain = String(a.chain).localeCompare(String(b.chain));
  if (chain) return chain;
  const numA = Number(String(a.name).match(/\d+/)?.[0] ?? 0);
  const numB = Number(String(b.name).match(/\d+/)?.[0] ?? 0);
  return numB - numA || String(a.id).localeCompare(String(b.id));
});

await fs.writeFile(BRANCH_FILE, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`\nImported ${imported.length} unique HAVAS branches into src/data/branches.json.`);
console.log(`Resolved ${coordinateResolved} branch coordinate sets from official map links during this run.`);
console.log(`Preserved ${nonHavas.length} branches from other supermarket chains.`);
console.log("Any branch whose official map link did not expose coordinates remains listed and is marked as lacking coordinates; no locations were guessed.");
