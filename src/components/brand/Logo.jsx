import { useId } from "react";
import { Link } from "react-router-dom";
import AnimatedBrand from "./AnimatedBrand";

/* Brand mark (vector, theme-independent) + animated wordmark. */
export function LogoMark({ size = 34 }) {
  const id = useId();
  return (
    <svg className="nt-mark" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-bg`} x1="4" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#9a6a48" />
          <stop offset="1" stopColor="#4a2d1c" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".38" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="12" fill={`url(#${id}-bg)`} />
      <rect x="1" y="1" width="38" height="19" rx="12" fill={`url(#${id}-shine)`} />
      <path d="M11 28V13l12 14V12" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M23 12h6v6" fill="none" stroke="#ff7aa8" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" transform="translate(-1 0)" />
      <rect x="1" y="1" width="38" height="38" rx="12" fill="none" stroke="#fff" strokeOpacity=".28" />
    </svg>
  );
}

export default function Logo({ to = "/", size = 34, withMark = true, variant = "nav" }) {
  return (
    <Link to={to} className="nt-logo" aria-label="NarxTop">
      {withMark && <LogoMark size={size} />}
      <AnimatedBrand variant={variant} />
    </Link>
  );
}
