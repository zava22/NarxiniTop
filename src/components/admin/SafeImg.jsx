import { useContext, useState } from "react";
import Icon from "../ui/Icon";
import { ThumbsContext } from "./thumbsContext";

/* Addresses that already failed to load in this tab: never requested again (no repeated 404s in the console). */
const dead = new Set();

/* <img> that falls back to an icon (or any node) instead of a broken-image box.
 * `force` loads even when the admin turned thumbnails off (used by the editor's preview). */
export default function SafeImg({ src, alt = "", className = "", icon = "package", size = 20, fallback = null, force = false, onError, ...rest }) {
  const allowed = useContext(ThumbsContext);
  const [failed, setFailed] = useState("");
  const url = typeof src === "string" ? src.trim() : "";
  if (!url || (!allowed && !force) || failed === url || dead.has(url)) return fallback ?? <Icon name={icon} size={size} />;
  return (
    <img
      className={className} src={url} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer"
      {...rest}
      onError={(e) => { dead.add(url); setFailed(url); onError?.(e); }}
    />
  );
}
