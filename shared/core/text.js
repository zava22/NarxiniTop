/*
 * Text normalization shared by the browser (search) and the server
 * (supermarket ingestion). Pure functions, no dependencies.
 *
 * Goal: "Coca Cola", "Coca-Cola", "Кока Кола", "koka kola" -> same key.
 */

const CYR = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya",
  // Uzbek Cyrillic
  ў: "o", қ: "q", ғ: "g", ҳ: "h",
};

/** Cyrillic -> Latin (Russian + Uzbek Cyrillic). Other characters pass through. */
export function transliterate(input = "") {
  let out = "";
  for (const ch of String(input).toLowerCase()) out += CYR[ch] ?? ch;
  return out;
}

/** Strip diacritics, Uzbek apostrophes (o', g', oʻ, o‘ ...) and punctuation. */
function basicClean(s) {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ʻʼ’‘`´']/g, "")
    .replace(/,(?=\d)/g, ".") // decimal comma 1,5 -> 1.5
    .replace(/[^a-z0-9.\s]/g, " ")
    .replace(/(?<!\d)\.|\.(?!\d)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Phonetic fold so spelling variants collapse:
 * c->k (c->s before e/i/y), q->k, w->v, ph->f, x->ks, double letters -> single.
 */
export function phoneticFold(word) {
  return word
    .replace(/ch/g, "§")
    .replace(/sh/g, "¶")
    .replace(/c(?=[eiy])/g, "s")
    .replace(/ck/g, "k")
    .replace(/c/g, "k")
    .replace(/q/g, "k")
    .replace(/w/g, "v")
    .replace(/ph/g, "f")
    .replace(/x/g, "ks")
    .replace(/ts/g, "s")
    .replace(/([a-z])\1+/g, "$1")
    .replace(/§/g, "ch")
    .replace(/¶/g, "sh");
}

/** Lower-case, Latin, cleaned (keeps digits and decimal points). */
export function normalizeText(input = "") {
  return basicClean(transliterate(input));
}

/** Tokens after phonetic folding. */
export function tokenize(input = "") {
  return normalizeText(input)
    .split(" ")
    .filter(Boolean)
    .map(phoneticFold);
}

/* ------------------------------ Brands ------------------------------ */
// canonical brand -> aliases (any script / spelling). Keys are folded below.
export const BRAND_ALIASES = {
  "Coca-Cola": ["coca cola", "coca-cola", "кока кола", "кока-кола", "koka kola", "cocacola", "coke"],
  Pepsi: ["pepsi", "пепси", "pepsi cola"],
  Fanta: ["fanta", "фанта"],
  Sprite: ["sprite", "спрайт"],
  "Lay's": ["lays", "lay s", "лейс", "лэйс", "лэйз", "leys"],
  Bliss: ["bliss", "блисс"],
  "Tic-Tac": ["tic tac", "tictac", "тик так", "тик-так"],
  "Alpen Gold": ["alpen gold", "альпен голд"],
  Ermak: ["ermak", "ермак"],
  Flint: ["flint", "флинт"],
  Purenmilk: ["purenmilk", "пуренмилк"],
  Nestle: ["nestle", "нестле"],
  Dena: ["dena", "дена"],
  Lactel: ["lactel", "лактель"],
};

const foldKey = (s) => tokenize(s).join(" ");
const BRAND_INDEX = Object.entries(BRAND_ALIASES).flatMap(([brand, aliases]) =>
  [brand, ...aliases].map((alias) => [foldKey(alias), brand])
);

/** Finds a known brand inside a product name; returns {brand, rest}. */
export function extractBrand(name = "") {
  const folded = ` ${foldKey(name)} `;
  let best = null;
  for (const [key, brand] of BRAND_INDEX) {
    if (!key) continue;
    if (folded.includes(` ${key} `) && (!best || key.length > best.key.length)) best = { key, brand };
  }
  if (!best) return { brand: null, rest: foldKey(name) };
  return { brand: best.brand, rest: folded.replace(` ${best.key} `, " ").trim() };
}

/* ---------------------------- Synonyms ------------------------------ */
// concept -> words in uz / ru / en (any script). Used for search & category.
export const SYNONYMS = {
  milk: ["sut", "moloko", "milk", "молоко", "сут"],
  cola: ["cola", "kola", "кола", "gazlangan", "soda"],
  bread: ["non", "xleb", "hleb", "bread", "хлеб", "нон", "buhanka", "буханка"],
  egg: ["tuxum", "yaytso", "yaitsa", "egg", "яйцо", "яйца", "туxум"],
  water: ["suv", "voda", "water", "вода", "сув"],
  juice: ["sharbat", "sok", "juice", "сок", "шарбат"],
  chicken: ["tovuq", "kurica", "chicken", "курица", "куриный", "товук"],
  beef: ["mol", "govyadina", "beef", "говядина", "qiyma", "farsh", "фарш"],
  potato: ["kartoshka", "kartofel", "potato", "картошка", "картофель"],
  onion: ["piyoz", "luk", "onion", "лук", "пиёз"],
  banana: ["banan", "banana", "банан"],
  sugar: ["shakar", "sakhar", "sahar", "sugar", "сахар", "шакар"],
  oil: ["yog", "maslo", "oil", "масло", "ёг"],
  rice: ["guruch", "ris", "rice", "рис", "гуруч"],
  tea: ["choy", "chay", "tea", "чай", "чой"],
  chips: ["chips", "chipsi", "чипсы", "чипсi", "snek", "snack"],
  chocolate: ["shokolad", "chocolate", "шоколад"],
  cheese: ["pishloq", "qurt", "syr", "cheese", "сыр", "пишлок"],
};

const SYN_INDEX = new Map();
for (const [concept, words] of Object.entries(SYNONYMS))
  for (const w of [concept, ...words]) SYN_INDEX.set(foldKey(w), concept);

/** token -> concept (or itself) */
export function conceptOf(token) {
  return SYN_INDEX.get(token) ?? token;
}

/* ------------------- Category keywords (existing set) --------------- */
const CATEGORY_CONCEPTS = {
  Ichimliklar: ["cola", "water", "juice", "milk_drink"],
  Sneklar: ["chips"],
  "Sut mahsulotlari": ["milk", "cheese"],
  "Non mahsulotlari": ["bread"],
  "Go'sht": ["chicken", "beef"],
  Sabzavotlar: ["potato", "onion"],
  Mevalar: ["banana"],
  Shirinliklar: ["chocolate", "sugar"],
};

export function recognizeCategory(text) {
  const concepts = new Set(tokenize(text).map(conceptOf));
  let best = null;
  for (const [cat, list] of Object.entries(CATEGORY_CONCEPTS)) {
    const hits = list.filter((c) => concepts.has(c)).length;
    if (hits && (!best || hits > best.hits)) best = { cat, hits };
  }
  return best?.cat ?? null;
}

/* ------------------------------ Fuzzy ------------------------------- */

/** Damerau-Levenshtein (optimal string alignment) with early exit. */
export function editDistance(a, b, max = Infinity) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length, n = b.length;
  let prev2 = null, prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[n];
}

/** Allowed typos grows with word length. */
export const typoBudget = (len) => (len <= 3 ? 0 : len <= 6 ? 1 : 2);

/** 1 = identical tokens, 0 = nothing alike. Tolerates typos & prefixes. */
export function tokenSimilarity(a, b) {
  if (a === b) return 1;
  if (a.length >= 3 && (b.startsWith(a) || a.startsWith(b))) return 0.9;
  const budget = typoBudget(Math.min(a.length, b.length));
  const d = editDistance(a, b, budget);
  if (d <= budget) return 0.85 - d * 0.1;
  return 0;
}
