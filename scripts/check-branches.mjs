// Validates src/data/branches.json: required fields, unique ids, sane coordinates when present.
import fs from "fs";
import { isValidCoord } from "../shared/core/geo.js";

const file = new URL("../src/data/branches.json", import.meta.url);
const list = JSON.parse(fs.readFileSync(file, "utf8"));
const errors = [];
if (!Array.isArray(list)) errors.push("branches.json must be an array");
const ids = new Set();
for (const [i, b] of (Array.isArray(list) ? list : []).entries()) {
  const at = `#${i} (${b?.id ?? "no id"})`;
  for (const k of ["id", "chain", "name", "address", "source", "verifiedAt"]) if (!b?.[k]) errors.push(`${at}: missing "${k}"`);
  if (ids.has(b?.id)) errors.push(`${at}: duplicate id`);
  ids.add(b?.id);
  // coordinates are optional (address-only branches are listed by district), but must be real when present
  if ((b?.lat != null || b?.lng != null) && !(isValidCoord(b) && b.lat > 37 && b.lat < 46 && b.lng > 55 && b.lng < 74)) errors.push(`${at}: lat/lng invalid or outside Uzbekistan`);
  if (b?.source && !/^https?:\/\//.test(b.source)) errors.push(`${at}: source must be an http(s) URL`);
}
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`branches.json OK (${list.length} branches)`);
