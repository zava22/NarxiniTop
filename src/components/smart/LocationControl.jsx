import { useState } from "react";

import Icon from "../ui/Icon";
import MapPicker from "./MapPicker";
import { useLang } from "../../context/LanguageContext";
import { useLocation } from "../../context/LocationContext";
import { inTashkentArea, parseCoordinates } from "../../../shared/core/geo.js";

/* Voluntary device location, or a manual point. Explains every permission state; nothing leaves the browser. */
export default function LocationControl({ compact = false }) {
  const { t } = useLang();
  const { location, permission, requestDevice, setManual, clear } = useLocation();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const msg = { denied: "loc.denied", unavailable: "loc.unavailable", timeout: "loc.timeout" }[permission];

  const apply = (e) => {
    e.preventDefault();
    const p = parseCoordinates(text);
    if (!p) return setError(t("loc.badCoords"));
    setError("");
    setManual(p.lat, p.lng, "coords");
    setText("");
  };

  const accuracy = location?.source === "device" && Number.isFinite(location.accuracy) ? Math.round(location.accuracy) : null;

  return (
    <div className={`nt-loc nt-glass ${compact ? "is-compact" : ""}`}>
      <div className="nt-loc-row">
        <button type="button" className="nt-btn nt-btn-ghost" onClick={requestDevice} disabled={permission === "pending" || permission === "unavailable"}>
          {permission === "pending" ? <span className="nt-spin" aria-hidden="true" /> : <Icon name="locate" size={18} />}
          {permission === "pending" ? t("loc.locating") : t("loc.useMine")}
        </button>
        <button type="button" className="nt-btn nt-btn-primary" onClick={() => setMapOpen(true)}>
          <Icon name="pin" size={17} />{t("loc.pickMap")}
        </button>
        <button type="button" className="nt-btn nt-btn-ghost" onClick={() => { setError(""); setManual(41.2995, 69.2401, "center"); }}>
          <Icon name="pin" size={17} />{t("loc.center")}
        </button>
        {location && <button type="button" className="nt-btn nt-btn-ghost" onClick={clear}><Icon name="x" size={16} />{t("loc.clear")}</button>}
      </div>

      <form className="nt-loc-manual" onSubmit={apply} noValidate>
        <label htmlFor="nt-coords">{t("loc.manualLabel")}</label>
        <div className="nt-row">
          <input id="nt-coords" inputMode="decimal" autoComplete="off" value={text} placeholder={t("loc.manualPh")} aria-invalid={Boolean(error)} onChange={(e) => { setText(e.target.value); setError(""); }} />
          <button type="submit" className="nt-btn nt-btn-ghost" disabled={!text.trim()}>{t("loc.apply")}</button>
        </div>
      </form>

      {error && <p className="nt-warn" role="alert">{error}</p>}
      {location && (
        <p className="nt-note">
          {location.source === "device" ? t("loc.setDevice") : t("loc.setManual", { c: `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` })}{" "}
          {accuracy != null && t("loc.accuracy", { m: accuracy })} {t("loc.privacy")}
        </p>
      )}
      {location?.label === "center" && <p className="nt-note">{t("loc.centerNote")}</p>}
      {accuracy != null && accuracy > 1500 && <p className="nt-warn" role="status">{t("loc.lowAccuracy", { m: accuracy })}</p>}
      {location && !inTashkentArea(location) && <p className="nt-warn" role="status">{t("loc.outside")}</p>}
      {msg && <p className="nt-warn" role="alert">{t(msg)}</p>}
      {!location && !msg && <p className="nt-note">{t("loc.hint")}</p>}
      {mapOpen && <MapPicker onClose={() => setMapOpen(false)} />}
    </div>
  );
}
