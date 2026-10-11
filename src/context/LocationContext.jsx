import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { districtKey } from "../../shared/core/districts.js";

/*
 * User location. Kept in memory + sessionStorage (cleared when the tab closes);
 * a point picked on the map is also saved in localStorage (lat/lng only) until the user clears it.
 * The app asks the browser for the device position once per session on start; the browser
 * decides whether to prompt, and a denial is respected (manual entry stays available).
 * Distances to branches are computed locally. The only network call is an OPTIONAL
 * OpenStreetMap (Nominatim) reverse lookup that turns the coordinates into a readable place
 * name; if it fails, coordinates are shown instead.
 * permission: unknown | prompt | granted | denied | unavailable | pending | timeout
 */
const LocationContext = createContext(null);
const KEY = "narxtop_loc_session";
const ASKED = "narxtop_loc_asked";
const PLACE = "narxtop_place_cache";

const SAVED = "narxtop_loc_saved"; // point picked on the map: kept between visits (localStorage)

const read = (k) => { try { return JSON.parse(sessionStorage.getItem(k)) ?? null; } catch { return null; } };
const readSaved = () => {
  try {
    const v = JSON.parse(localStorage.getItem(SAVED));
    return v && Number.isFinite(v.lat) && Number.isFinite(v.lng) ? v : null;
  } catch { return null; }
};

async function lookupPlace(lat, lng, signal) {
  const id = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cache = read(PLACE);
  if (cache?.id === id) return cache.place;
  const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&addressdetails=1&accept-language=uz,ru,en&lat=${lat}&lon=${lng}`, { signal });
  if (!r.ok) throw new Error(`geocoder ${r.status}`);
  const a = (await r.json()).address ?? {};
  const parts = [...new Set([a.neighbourhood ?? a.suburb ?? a.quarter, a.city_district ?? a.borough ?? a.county, a.city ?? a.town ?? a.village ?? a.state].filter(Boolean))];
  const place = parts.length ? { name: parts.join(", "), district: districtKey(Object.values(a).join(" ")) } : null;
  try { sessionStorage.setItem(PLACE, JSON.stringify({ id, place })); } catch { /* ignore */ }
  return place;
}

export function LocationProvider({ children }) {
  const [location, setLocation] = useState(() => read(KEY) ?? readSaved());
  const [permission, setPermission] = useState(() => (navigator.geolocation ? "unknown" : "unavailable"));
  const [place, setPlace] = useState(null); // { name, district } | null
  const busy = useRef(false);

  useEffect(() => {
    if (!navigator.permissions?.query) return;
    let status;
    navigator.permissions.query({ name: "geolocation" }).then((s) => {
      status = s;
      const sync = () => setPermission((p) => (p === "pending" ? p : s.state === "granted" ? "granted" : s.state === "denied" ? "denied" : "prompt"));
      sync();
      s.onchange = sync;
    }).catch(() => {});
    return () => { if (status) status.onchange = null; };
  }, []);

  const save = (loc) => {
    setLocation(loc);
    try { loc ? sessionStorage.setItem(KEY, JSON.stringify(loc)) : sessionStorage.removeItem(KEY); } catch { /* ignore */ }
    // a point chosen on the map (latitude + longitude) is remembered; clearing removes it
    try {
      if (!loc) localStorage.removeItem(SAVED);
      else if (loc.source === "map") localStorage.setItem(SAVED, JSON.stringify({ lat: loc.lat, lng: loc.lng, source: "map", label: loc.label }));
    } catch { /* ignore */ }
  };

  const requestDevice = useCallback(() => {
    if (!navigator.geolocation) { setPermission("unavailable"); return; }
    if (busy.current) return;
    busy.current = true;
    setPermission("pending");
    navigator.geolocation.getCurrentPosition(
      (pos) => { busy.current = false; setPermission("granted"); save({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, source: "device" }); },
      (err) => { busy.current = false; setPermission(err.code === 1 ? "denied" : err.code === 3 ? "timeout" : "unavailable"); },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
    );
  }, []);

  // ask once per session, right after the app opens
  useEffect(() => {
    if (location || !navigator.geolocation) return;
    let asked = false;
    try { asked = sessionStorage.getItem(ASKED) === "1"; sessionStorage.setItem(ASKED, "1"); } catch { /* ignore */ }
    if (!asked) requestDevice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // human-readable place name for the current point
  useEffect(() => {
    if (!location) { setPlace(null); return; }
    const ctl = new AbortController();
    lookupPlace(location.lat, location.lng, ctl.signal).then(setPlace).catch(() => setPlace(null));
    return () => ctl.abort();
  }, [location]);

  const setManual = useCallback((lat, lng, label) => save({ lat, lng, source: "manual", label }), []);
  const clear = useCallback(() => save(null), []);

  const value = useMemo(() => ({ location, place, permission, requestDevice, setManual, clear }), [location, place, permission, requestDevice, setManual, clear]);
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const c = useContext(LocationContext);
  if (!c) throw new Error("useLocation must be used inside LocationProvider");
  return c;
}
