import fs from "fs"; import path from "path";
import { translations } from "../shared/translations.js";
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : /\.(jsx?|mjs)$/.test(e.name) ? [path.join(d, e.name)] : []);
const keys = new Set(), dyn = new Set();
for (const f of walk(new URL("../src", import.meta.url).pathname)) {
  const s = fs.readFileSync(f, "utf8");
  for (const m of s.matchAll(/\bt\(\s*"([A-Za-z0-9_.\-]+)"/g)) keys.add(m[1]);
  for (const m of s.matchAll(/\bt\(\s*`([A-Za-z0-9_.\-]+)\$\{/g)) dyn.add(m[1]);
  for (const m of s.matchAll(/\bt\(\s*(?:[a-z]+\s*\?\s*)?"([A-Za-z0-9_.\-]+)"\s*:\s*"([A-Za-z0-9_.\-]+)"/g)) { keys.add(m[1]); keys.add(m[2]); }
  for (const m of s.matchAll(/"((?:p|sb|pi|rec|an|acc|loc|route|auth|cart)\.[A-Za-z0-9_.\-]+)"/g)) keys.add(m[1]);
}
const missing = {};
for (const lang of ["uz", "ru"]) missing[lang] = [...keys].filter((k) => !(k in translations[lang])).sort();
console.log("static keys:", keys.size, "dyn prefixes:", [...dyn].join(" "));
console.log("missing uz:", missing.uz.length, "ru:", missing.ru.length);
console.log(missing.uz.join("\n"));
