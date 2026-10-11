import { useAuth } from "../../context/AuthContext";

/* Profile photo (saved in MongoDB), else the Google/OAuth picture, else coloured initials. */
export default function Avatar({ size = 36, className = "" }) {
  const { user, displayName, avatar } = useAuth();
  const m = user?.user_metadata ?? {};
  const src = avatar || m.avatar_url || m.picture || null;
  const style = { width: size, height: size, fontSize: size * 0.42, background: m.avatar_color || "var(--accent)" };
  if (src) return <img className={`nt-avatar ${className}`} style={style} src={src} alt="" referrerPolicy="no-referrer" />;
  return <span className={`nt-avatar ${className}`} style={style} aria-hidden="true">{(displayName || user?.email || "?").slice(0, 1).toUpperCase()}</span>;
}
