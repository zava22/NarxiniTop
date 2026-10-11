import { useLang } from "../../context/LanguageContext";
import { ALL_CATEGORIES } from "../../lib/constants";

import "./CategoryNav.css";

const categories = [
  {
    name: ALL_CATEGORIES,
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <rect x="14" y="14" width="6" height="6" rx="1" />
      </svg>
    ),
  },
  {
    name: "Sneklar",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M7 7.5c0-1.4 1.1-2.5 2.5-2.5h5C15.9 5 17 6.1 17 7.5v1c0 1-.4 1.9-1.1 2.6L14 13v3.5c0 1.4-1.1 2.5-2.5 2.5h-1C9.1 19 8 17.9 8 16.5V13l-1.9-1.9C5.4 10.4 5 9.5 5 8.5v-1Z" />
        <path d="M10 8h4M9 10.5h6" />
      </svg>
    ),
  },
  {
    name: "Ichimliklar",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M9 4h6l-.7 14.2A2 2 0 0 1 12.3 20h-.6a2 2 0 0 1-2-1.8L9 4Z" />
        <path d="M9.4 8h5.2M10 12h4M10 3h4" />
      </svg>
    ),
  },
  {
    name: "Mevalar",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M12 8.5c-3.2-2.7-7.5-.4-7.5 4.2 0 4.6 2.7 7.3 5.7 7.3 1 0 1.5-.4 1.8-.4s.8.4 1.8.4c3 0 5.7-2.7 5.7-7.3 0-4.6-4.3-6.9-7.5-4.2Z" />
        <path d="M12 7c-.2-2 1-3.5 3-4M12 7c-1.8-1.4-3.9-1.4-5.2-.2" />
      </svg>
    ),
  },
  {
    name: "Sabzavotlar",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M7 14c2.3-1.3 6.7-1.3 9 0 1.2.7 1.7 2.3 1 3.5-1 1.8-4.1 3-6.5 3S5 19.3 4 17.5c-.7-1.2-.2-2.8 1-3.5Z" />
        <path d="M8 13.5c0-2.4 1.7-4.2 4-5M11.5 8.5c.2-2 1.7-3.5 3.7-3.5M13.5 8c1.8-1.1 3.5-.7 4.5.3" />
      </svg>
    ),
  },
  {
    name: "Shirinliklar",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="m8 7 4 1 4-1 2 4-2 4-4 1-4-1-2-4 2-4Z" />
        <path d="m6 5-2-1M18 5l2-1M6 19l-2 1M18 19l2 1" />
        <path d="M9 11h6M10 14h4" />
      </svg>
    ),
  },
  {
    name: "Non mahsulotlari",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M5 10.5h14v7.2a2.3 2.3 0 0 1-2.3 2.3H7.3A2.3 2.3 0 0 1 5 17.7v-7.2Z" />
        <path d="M5 10.5c.2-2.5 2.2-4.5 5-4.5 1.1 0 2 .4 2 1.4 0-1 .9-1.4 2-1.4 2.8 0 4.8 2 5 4.5" />
      </svg>
    ),
  },
  {
    name: "Go'sht",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M8.5 4.5c1.8-.8 3.3.4 4.5 1.6l5.2 5.2c1.8 1.8 1.8 4.6.1 6.3-1.7 1.7-4.5 1.7-6.3-.1l-5.2-5.2C5.6 11.1 4.4 9.6 5.2 7.8c.6-1.4 1.9-2.6 3.3-3.3Z" />
        <circle cx="15.8" cy="15.1" r="1.4" />
      </svg>
    ),
  },
  {
    name: "Sut mahsulotlari",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M8 5h8v14H8z" />
        <path d="M9.5 3.5h5M9 7h6M10 11h4" />
      </svg>
    ),
  },
  {
    name: "Uy-ro'zg'or",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="m4 10 8-6 8 6v9H4v-9Z" />
        <path d="M9.5 19v-5h5v5M3 10l9-7 9 7" />
      </svg>
    ),
  },
  {
    name: "Shaxsiy gigiyena",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M8 11.5c0-1.1.9-2 2-2h5.5c1.4 0 2.5 1.1 2.5 2.5V17c0 2-1.6 3.5-3.5 3.5h-3c-2 0-3.5-1.6-3.5-3.5v-5.5Z" />
        <path d="M8.5 10V6.5c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5V10M11.5 10V5.5c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5V10" />
      </svg>
    ),
  },
  {
    name: "Boshqa",
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="5" y="5" width="14" height="14" rx="2" />
        <path d="M8 9h8M8 13h8M8 17h5" />
      </svg>
    ),
  },
];

/* icon of a category (used by product cards) */
export const categoryNames = categories.map((c) => c.name);
export const categoryIcon = (name) => categories.find((c) => c.name === name)?.icon ?? null;

export default function CategoryNav({
  selectedCategory,
  onCategoryChange,
  counts,
}) {
  const { t, tCategory } = useLang();

  /* every category is shown at once (wrapping, no hidden horizontal scroll) */
  return (
    <nav className="category-section" aria-label={t("p.home.all")}>
      <div className="category-container">
        <div className="category-list">
          {categories.map((category) => {
            const isActive = selectedCategory === category.name;
            const count = counts?.[category.name];

            return (
              <button
                key={category.name}
                type="button"
                aria-pressed={isActive}
                className={`category-button ${isActive ? "category-button-active" : ""} ${count === 0 ? "is-empty" : ""}`}
                onClick={() => onCategoryChange(category.name)}
              >
                <span className="category-icon">{category.icon}</span>
                <span className="category-label">{tCategory(category.name)}</span>
                {count != null && <span className="category-count">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
