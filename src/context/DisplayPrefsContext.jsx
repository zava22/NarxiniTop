import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/* Product-list appearance ("View studio"). Stored only in this browser (localStorage). */
const KEY = "narxtop_card_prefs";
export const SIZE_MIN = 170, SIZE_MAX = 340;
export const DEFAULT_DISPLAY = { density: "comfortable", size: 224, surface: "glass", showOffers: true, showUnit: true, showFresh: true };
const DENSITIES = ["comfortable", "compact", "list"];
const SURFACES = ["glass", "solid"];

function sanitize(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const size = Number(o.size);
  return {
    density: DENSITIES.includes(o.density) ? o.density : DEFAULT_DISPLAY.density,
    size: Number.isFinite(size) ? Math.min(SIZE_MAX, Math.max(SIZE_MIN, Math.round(size))) : DEFAULT_DISPLAY.size,
    surface: SURFACES.includes(o.surface) ? o.surface : DEFAULT_DISPLAY.surface,
    showOffers: typeof o.showOffers === "boolean" ? o.showOffers : DEFAULT_DISPLAY.showOffers,
    showUnit: typeof o.showUnit === "boolean" ? o.showUnit : DEFAULT_DISPLAY.showUnit,
    showFresh: typeof o.showFresh === "boolean" ? o.showFresh : DEFAULT_DISPLAY.showFresh,
  };
}
function read() {
  try { return sanitize(JSON.parse(localStorage.getItem(KEY))); } catch { return { ...DEFAULT_DISPLAY }; }
}

const Ctx = createContext(null);

export function DisplayPrefsProvider({ children }) {
  const [prefs, setPrefs] = useState(read);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* ignore */ } }, [prefs]);
  const update = useCallback((patch) => setPrefs((p) => sanitize({ ...p, ...patch })), []);
  const reset = useCallback(() => setPrefs({ ...DEFAULT_DISPLAY }), []);
  const value = useMemo(() => ({ prefs, update, reset }), [prefs, update, reset]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* props for any product grid element */
export const gridProps = (prefs) => ({ "data-density": prefs.density, "data-surface": prefs.surface, style: { "--card-size": `${prefs.size}px` } });

export function useDisplayPrefs() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDisplayPrefs must be used inside DisplayPrefsProvider");
  return c;
}
