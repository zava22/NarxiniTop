import { useMemo } from "react";
import { Link } from "react-router-dom";

import Icon from "../ui/Icon";
import useBranches from "../../hooks/useBranches";
import { useLang } from "../../context/LanguageContext";
import { useLocation } from "../../context/LocationContext";
import { directionsUrl, isValidCoord, rankBranches } from "../../../shared/core/geo.js";
import { districtKey } from "../../../shared/core/districts.js";

const mapsSearch = (b) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.chain} ${b.address ?? b.name ?? ""}`)}`;

/*
 * "Where do I buy it?" button for one chain (e.g. the store that is cheapest in the cart).
 * 1) branch with coordinates + known location  -> nearest branch, distance, external directions link
 * 2) branch without coordinates in the user's district -> that branch (address only, no distance)
 * 3) no location yet -> button that asks for it
 * 4) otherwise -> link to the branch list of that chain
 * Everything is computed locally from branch data; nothing is estimated.
 */
export default function NearestBranch({ chain, compact = false }) {
  const { t } = useLang();
  const { location, place, permission, requestDevice } = useLocation();
  const { branches } = useBranches();
  const mine = useMemo(() => branches.filter((b) => b.chain === chain), [branches, chain]);
  const near = useMemo(() => rankBranches(location, mine).ranked[0] ?? null, [location, mine]);
  const inDistrict = useMemo(
    () => (place?.district ? mine.find((b) => !isValidCoord(b) && (b.district ?? districtKey(b.address)) === place.district) ?? null : null),
    [mine, place]
  );

  const all = <Link to={`/stores?chain=${encodeURIComponent(chain)}`} className="nt-link">{t("near.all", { c: chain })}</Link>;
  const cls = `nt-near ${compact ? "is-compact" : ""}`;

  if (near) {
    const km = near.km.toFixed(near.km < 10 ? 1 : 0);
    return (
      <div className={cls}>
        <a className="nt-btn nt-btn-primary nt-btn-sm" href={directionsUrl(near)} target="_blank" rel="noopener noreferrer">
          <Icon name="navigation" size={15} />{t("near.go", { c: chain, d: km })}
        </a>
        {!compact && near.address && <small>{near.address}</small>}
        {all}
      </div>
    );
  }
  if (inDistrict) {
    return (
      <div className={cls}>
        <a className="nt-btn nt-btn-primary nt-btn-sm" href={mapsSearch(inDistrict)} target="_blank" rel="noopener noreferrer">
          <Icon name="pin" size={15} />{t("near.district", { c: chain })}
        </a>
        {!compact && inDistrict.address && <small>{inDistrict.address}</small>}
        {all}
      </div>
    );
  }
  if (!location && permission !== "denied" && permission !== "unavailable") {
    return (
      <div className={cls}>
        <button type="button" className="nt-btn nt-btn-ghost nt-btn-sm" onClick={requestDevice} disabled={permission === "pending"}>
          <Icon name="locate" size={15} />{permission === "pending" ? t("loc.locating") : t("near.locate", { c: chain })}
        </button>
        {all}
      </div>
    );
  }
  return <div className={cls}><Link to={`/stores?chain=${encodeURIComponent(chain)}`} className="nt-btn nt-btn-ghost nt-btn-sm"><Icon name="pin" size={15} />{t("near.all", { c: chain })}</Link></div>;
}
