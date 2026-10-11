// Crawls https://havasfood.uz/ru/markets/ (all pages), resolves every maps.app.goo.gl link to
// coordinates and merges the result into src/data/branches.json.
// Run on a machine with internet access:  node scripts/import-havas.mjs
// NOT executed by the author (no network in the build sandbox): review the output with
// `npm run check:branches` and spot-check a few entries against the Havas site.
import fs from "fs";
import { districtKey } from "../shared/core/districts.js";

const FILE = new URL("../src/data/branches.json", import.meta.url);
const BASE = "https://havasfood.uz/ru/markets/";
const today = new Date().toISOString().slice(0, 10);
const get = async (url, opt) => { const r = await fetch(url, { ...opt, headers: { "user-agent": "NarxTopBranchImporter/1.0" } }); if (!r.ok) throw new Error(`${url}: ${r.status}`); return r; };
const text = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#8217;|&rsquo;/g, "’").replace(/\s+/g, " ");

async function page(n) {
  const html = await (await get(n === 1 ? BASE : `${BASE}page/${n}/`)).text();
  const plain = text(html);
  const out = [];
  for (const m of plain.matchAll(/\b(H\d{2,4})\s+(.+?)\s+Адрес:\s*(https:\/\/maps\.app\.goo\.gl\/[A-Za-z0-9]+)(?:\s+Режим работы:\s*(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}))?/g))
    out.push({ code: m[1], address: m[2].trim(), link: m[3], hours: m[4]?.replace(/\s/g, "") });
  const last = Math.max(1, ...[...html.matchAll(/\/markets\/page\/(\d+)\//g)].map((x) => Number(x[1])));
  return { out, last };
}
async function coords(link) {
  const r = await get(link, { redirect: "follow" });
  const u = decodeURIComponent(r.url);
  const m = u.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ?? u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}

const existing = JSON.parse(fs.readFileSync(FILE, "utf8"));
const byId = new Map(existing.map((b) => [b.id, b]));
const first = await page(1);
const rows = [...first.out];
for (let n = 2; n <= first.last; n++) { rows.push(...(await page(n)).out); await new Promise((r) => setTimeout(r, 400)); }
console.log(`found ${rows.length} Havas stores on ${first.last} pages`);

for (const r of rows) {
  const id = `havas-${r.code.toLowerCase()}`;
  const prev = byId.get(id) ?? {};
  let c = prev.lat != null ? { lat: prev.lat, lng: prev.lng } : null;
  if (!c) { try { c = await coords(r.link); } catch (e) { console.warn("no coords for", r.code, e.message); } await new Promise((x) => setTimeout(x, 300)); }
  byId.set(id, { ...prev, id, chain: "Havas", name: r.code, address: r.address, district: districtKey(r.address) ?? prev.district, ...(c ?? {}), hours: r.hours ?? prev.hours, phone: "+998712059595", source: BASE, verifiedAt: today });
}
fs.writeFileSync(FILE, JSON.stringify([...byId.values()], null, 2) + "\n");
console.log(`wrote ${byId.size} branches`);
