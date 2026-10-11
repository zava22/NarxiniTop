import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";

import Icon from "../ui/Icon";
import { useLang } from "../../context/LanguageContext";
import { useLocation } from "../../context/LocationContext";
import { isValidCoord } from "../../../shared/core/geo.js";

const CENTER = { lat: 41.2995, lng: 69.2401 }; // Tashkent
const fmt = (p) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;

/*
 * Full-screen map to pick the user's location. Uses Leaflet + OpenStreetMap tiles (no API key needed).
 * Click the map or drag the pin; "Confirm" stores latitude + longitude through LocationContext
 * (source "map", remembered between visits). Nothing is sent anywhere.
 */
export default function MapPicker({ onClose }) {
  const { t } = useLang();
  const { location, setManual } = useLocation();
  const box = useRef(null);
  const api = useRef(null); // { map, marker }
  const [point, setPoint] = useState(() => (isValidCoord(location) ? { lat: location.lat, lng: location.lng } : CENTER));
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [gps, setGps] = useState("idle"); // idle | busy | fail

  useEffect(() => {
    let cancelled = false;
    let map = null;
    (async () => {
      try {
        const [{ default: L }] = await Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]);
        if (cancelled || !box.current) return;
        map = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([point.lat, point.lng], isValidCoord(location) ? 15 : 12);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(map);
        const icon = L.divIcon({ className: "mp-pin", html: "<span></span>", iconSize: [36, 46], iconAnchor: [18, 44] });
        const marker = L.marker([point.lat, point.lng], { icon, draggable: true, autoPan: true }).addTo(map);
        const move = (ll) => setPoint({ lat: ll.lat, lng: ll.lng });
        marker.on("dragend", () => move(marker.getLatLng()));
        map.on("click", (e) => { marker.setLatLng(e.latlng); move(e.latlng); });
        api.current = { map, marker };
        setStatus("ready");
        setTimeout(() => map && map.invalidateSize(), 60);
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => { cancelled = true; api.current = null; if (map) map.remove(); };
    // the map is created once; later point changes come from clicks/drags
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = prev; };
  }, [onClose]);

  const useMine = () => {
    if (!navigator.geolocation) { setGps("fail"); return; }
    setGps("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGps("idle");
        setPoint(p);
        if (api.current) { api.current.marker.setLatLng([p.lat, p.lng]); api.current.map.setView([p.lat, p.lng], 16); }
      },
      () => setGps("fail"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  };

  const confirm = () => { setManual(point.lat, point.lng, "map"); onClose(); };

  return createPortal(
    <div className="mp-back" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div className="mp nt-glass" role="dialog" aria-modal="true" aria-label={t("map.title")} initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.22 }}>
        <header className="mp-head">
          <div>
            <h2>{t("map.title")}</h2>
            <p>{t("map.sub")}</p>
          </div>
          <button type="button" className="nt-icon-btn" onClick={onClose} aria-label={t("map.close")}><Icon name="x" size={18} /></button>
        </header>

        <div className="mp-map-wrap">
          <div ref={box} className="mp-map" />
          {status === "loading" && <div className="mp-state"><span className="nt-spin" aria-hidden="true" />{t("map.loading")}</div>}
          {status === "error" && <div className="mp-state is-error"><Icon name="alert" size={20} />{t("map.loadFail")}</div>}
          <button type="button" className="mp-mine nt-btn nt-btn-ghost nt-btn-sm" onClick={useMine} disabled={gps === "busy" || status !== "ready"}>
            {gps === "busy" ? <span className="nt-spin" aria-hidden="true" /> : <Icon name="locate" size={16} />}{t("map.mine")}
          </button>
        </div>

        {gps === "fail" && <p className="nt-warn" role="alert">{t("map.gpsFail")}</p>}

        <footer className="mp-foot">
          <span className="mp-coords"><Icon name="pin" size={16} />{t("map.coords", { c: fmt(point) })}</span>
          <div className="mp-actions">
            <button type="button" className="nt-btn nt-btn-ghost" onClick={onClose}>{t("map.cancel")}</button>
            <button type="button" className="nt-btn nt-btn-primary" onClick={confirm} disabled={status !== "ready"}><Icon name="check" size={17} strokeWidth={2.6} />{t("map.confirm")}</button>
          </div>
        </footer>
      </motion.div>
    </div>,
    document.body
  );
}
