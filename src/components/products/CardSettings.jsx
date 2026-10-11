import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import Icon from "../ui/Icon";
import { SIZE_MAX, SIZE_MIN, useDisplayPrefs } from "../../context/DisplayPrefsContext";
import { useLang } from "../../context/LanguageContext";

const LAYOUTS = [["comfortable", "layoutGrid"], ["compact", "layoutCompact"], ["list", "layoutList"]];

const Toggle = ({ checked, onChange, label }) => (
  <label className="nt-toggle nt-toggle-sm">
    <span>{label}</span>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <i aria-hidden="true" />
  </label>
);

/* "View studio": layout, card size, surface style and which details to show. Applies live. */
export default function CardSettings() {
  const { t } = useLang();
  const { prefs, update, reset } = useDisplayPrefs();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div className="nt-cardset" ref={box}>
      <div className="nt-viewdock nt-glass" role="group" aria-label={t("card.settings")}>
        {LAYOUTS.map(([d, icon]) => (
          <button key={d} type="button" className={prefs.density === d ? "is-on" : ""} aria-pressed={prefs.density === d} onClick={() => update({ density: d })} title={t(`card.${d}`)} aria-label={t(`card.${d}`)}>
            <Icon name={icon} size={17} />
          </button>
        ))}
        <i aria-hidden="true" />
        <button type="button" className={open ? "is-on" : ""} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls={panelId} title={t("card.settings")} aria-label={t("card.settings")}>
          <Icon name="sliders" size={17} />
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div id={panelId} role="dialog" aria-label={t("card.settings")} className="nt-popover nt-glass"
            initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.16 }}>
            <div className="nt-view-preview" data-surface={prefs.surface} data-density={prefs.density} style={{ "--pv": `${Math.round(48 + ((prefs.size - SIZE_MIN) / (SIZE_MAX - SIZE_MIN)) * 52)}%` }} aria-hidden="true">
              <span /><b /><i />
            </div>
            <label className="nt-range">
              <span>{t("card.size")}</span>
              <input type="range" min={SIZE_MIN} max={SIZE_MAX} step="10" value={prefs.size} onChange={(e) => update({ size: Number(e.target.value) })} disabled={prefs.density === "list"} />
            </label>
            <fieldset>
              <legend>{t("card.surface")}</legend>
              <div className="nt-seg nt-seg-sm" role="radiogroup">
                {["glass", "solid"].map((s) => (
                  <button key={s} type="button" role="radio" aria-checked={prefs.surface === s} className={prefs.surface === s ? "is-on" : ""} onClick={() => update({ surface: s })}>{t(`card.surface.${s}`)}</button>
                ))}
              </div>
            </fieldset>
            <Toggle checked={prefs.showOffers} onChange={(v) => update({ showOffers: v })} label={t("card.showOffers")} />
            <Toggle checked={prefs.showUnit} onChange={(v) => update({ showUnit: v })} label={t("card.showUnit")} />
            <Toggle checked={prefs.showFresh} onChange={(v) => update({ showFresh: v })} label={t("card.showFresh")} />
            <button type="button" className="nt-link" onClick={reset}>{t("card.reset")}</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
