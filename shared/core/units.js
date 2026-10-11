/*
 * Size / unit parsing and unit-price intelligence.
 * Base units: mass -> grams, volume -> millilitres, count -> pieces.
 */

const UNIT_TABLE = [
  // [regex of unit words, dimension, factor to base]
  [/^(kg|kgs|kilogram|kilogramm|kilo|кг|килограмм)$/, "mass", 1000],
  [/^(g|gr|gm|gram|gramm|г|гр|грамм)$/, "mass", 1],
  [/^(l|lt|ltr|litr|liter|litre|л|литр)$/, "volume", 1000],
  [/^(ml|millilitr|мл|миллилитр)$/, "volume", 1],
  [/^(dona|d|pcs|pc|piece|pieces|sht|шт|штук|дона)$/, "count", 1],
  [/^(pack|packs|upakovka|upak|уп|упаковка|pachka|пачка)$/, "pack", 1],
];

import { transliterate } from "./text.js";

function unitInfo(word) {
  const w = transliterate(word).replace(/[^a-z]/g, "");
  const raw = word.toLowerCase();
  for (const [re, dim, f] of UNIT_TABLE) if (re.test(raw) || re.test(w)) return { dim, f };
  return null;
}

/**
 * Parses "1.5L", "1500 ml", "1,5 л", "500g", "6x330ml", "10 dona", "1d".
 * Returns { base, dimension, label, multiplier } or null.
 *   base: grams | ml | pieces   (total, multipliers applied)
 */
export function parseSize(text = "") {
  const s = String(text).toLowerCase().replace(/,(?=\d)/g, ".").replace(/×/g, "x");
  // optional multiplier: 6x330ml, 6 x 0.33 l
  const re = /(?:(\d+)\s*x\s*)?(\d+(?:\.\d+)?)\s*([a-zа-яё]+)/giu;
  let m, found = null;
  while ((m = re.exec(s))) {
    const info = unitInfo(m[3]);
    if (!info) continue;
    const mult = m[1] ? Number(m[1]) : 1;
    const value = Number(m[2]);
    if (!Number.isFinite(value) || value <= 0) continue;
    found = { base: value * info.f * mult, dimension: info.dim, multiplier: mult };
    break;
  }
  if (!found) return null;
  return { ...found, label: formatSize(found) };
}

export function formatSize({ base, dimension }) {
  if (dimension === "mass") return base >= 1000 ? `${trim(base / 1000)} kg` : `${trim(base)} g`;
  if (dimension === "volume") return base >= 1000 ? `${trim(base / 1000)} L` : `${trim(base)} ml`;
  return `${trim(base)} ${dimension === "pack" ? "pack" : "pcs"}`;
}
const trim = (n) => String(Math.round(n * 1000) / 1000);

/**
 * Price per reference unit: per kg (mass), per L (volume), per piece/pack.
 * Returns null when the size is unknown (never guesses).
 */
export function unitPrice(price, size) {
  if (!size || !Number.isFinite(Number(price)) || !(size.base > 0)) return null;
  const p = Number(price);
  if (size.dimension === "mass") return { value: (p / size.base) * 1000, per: "kg", dimension: "mass" };
  if (size.dimension === "volume") return { value: (p / size.base) * 1000, per: "L", dimension: "volume" };
  return { value: p / size.base, per: size.dimension === "pack" ? "pack" : "pcs", dimension: size.dimension };
}

/** Compares offers by unit price. Items of different dimensions are not comparable. */
export function bestValue(options) {
  const usable = options.filter((o) => o.unit);
  if (!usable.length) return null;
  const dim = usable[0].unit.dimension;
  const same = usable.filter((o) => o.unit.dimension === dim);
  return same.reduce((a, b) => (b.unit.value < a.unit.value ? b : a));
}

export const formatUzs = (n) => `${Math.round(Number(n)).toLocaleString("uz-UZ")} UZS`;
