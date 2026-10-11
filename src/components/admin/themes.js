/* Admin-only look & feel. The site theme (light/dark) stays in ThemeContext; these presets only recolour
 * the admin panel's accent and shape. "brown" = the site's own palette (no overrides). */

export const ACCENTS = [
  { id: "brown", label: "Jigarrang", swatch: "#8a5a3b" },
  { id: "ocean", label: "Okean", swatch: "#2f6fdc", hero: ["#0f1f3d", "#1b3a73", "#2f62c4"],
    light: { accent: "#2f6fdc", accent2: "#5b94ee", strong: "#1f4fa8", rgb: "47, 111, 220" },
    dark: { accent: "#6a9cf5", accent2: "#4a80e6", strong: "#2d5fc2", rgb: "106, 156, 245" } },
  { id: "emerald", label: "Zumrad", swatch: "#1f8f63", hero: ["#0d2a20", "#14513b", "#1f8f63"],
    light: { accent: "#1f8f63", accent2: "#3fae83", strong: "#146b49", rgb: "31, 143, 99" },
    dark: { accent: "#4cc794", accent2: "#2fa878", strong: "#1c7a56", rgb: "76, 199, 148" } },
  { id: "violet", label: "Binafsha", swatch: "#7c4ddb", hero: ["#1d1240", "#3a2380", "#6d44d1"],
    light: { accent: "#7c4ddb", accent2: "#9d78ec", strong: "#5a33b0", rgb: "124, 77, 219" },
    dark: { accent: "#a78bfa", accent2: "#8b64ee", strong: "#5f3fc4", rgb: "167, 139, 250" } },
  { id: "rose", label: "Atirgul", swatch: "#d63a6b", hero: ["#2e0f1b", "#6b1f3c", "#c23a69"],
    light: { accent: "#d63a6b", accent2: "#ec6a92", strong: "#a82350", rgb: "214, 58, 107" },
    dark: { accent: "#f37ba0", accent2: "#e0486f", strong: "#b02e57", rgb: "243, 123, 160" } },
  { id: "graphite", label: "Grafit", swatch: "#3f4a5a", hero: ["#15181e", "#2a323f", "#4a566b"],
    light: { accent: "#3f4a5a", accent2: "#667388", strong: "#2a323f", rgb: "63, 74, 90" },
    dark: { accent: "#a9b4c6", accent2: "#6b7a91", strong: "#455166", rgb: "169, 180, 198" } },
];

export const DEFAULT_PREFS = { accent: "brown", density: "comfy", corners: "round", hero: true, motion: true, thumbs: true, view: "list", sidebar: "full" };

export const CHOICES = {
  accent: ACCENTS.map((a) => a.id),
  density: ["comfy", "compact"],
  corners: ["round", "soft", "sharp"],
  view: ["list", "grid"],
  sidebar: ["full", "mini"],
};

/* Anything unknown / hand-edited in localStorage falls back to the default, so a bad value can never break the panel. */
export function sanitizePrefs(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const out = { ...DEFAULT_PREFS };
  for (const [k, list] of Object.entries(CHOICES)) if (list.includes(r[k])) out[k] = r[k];
  for (const k of ["hero", "motion", "thumbs"]) if (typeof r[k] === "boolean") out[k] = r[k];
  return out;
}

/* Inline CSS variables for the .adm root (empty object = keep the site's palette). */
export function accentStyle(id, isDark) {
  const a = ACCENTS.find((x) => x.id === id);
  if (!a?.light) return {};
  const c = isDark ? a.dark : a.light;
  return { "--accent": c.accent, "--accent-2": c.accent2, "--accent-strong": c.strong, "--accent-rgb": c.rgb, "--adm-hero-1": a.hero[0], "--adm-hero-2": a.hero[1], "--adm-hero-3": a.hero[2] };
}
