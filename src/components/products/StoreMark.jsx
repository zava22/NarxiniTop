import Icon from "../ui/Icon";

/* Small store badge. If you add a logo to src/assets/stores/<chain>.png|svg|webp (lower-case chain name,
 * e.g. korzinka.png) it is used automatically; otherwise a neutral store icon is shown.
 * Logos are discovered at build time, so a missing logo never causes a failed network request. */
const files = import.meta.glob("../../assets/stores/*.{png,svg,webp,jpg}", { eager: true, query: "?url", import: "default" });
const LOGOS = Object.fromEntries(Object.entries(files).map(([path, url]) => [path.split("/").pop().replace(/\.[^.]+$/, "").toLowerCase(), url]));
const slug = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

export default function StoreMark({ chain, size = 24 }) {
  const logo = LOGOS[slug(chain)];
  return (
    <span className="pc-mark" style={{ "--s": `${size}px` }} aria-hidden="true">
      {logo ? <img src={logo} alt="" decoding="async" /> : <Icon name="store" size={Math.round(size * 0.55)} />}
    </span>
  );
}
