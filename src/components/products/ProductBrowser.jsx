import { useMemo } from "react";
import { LayoutGroup, motion } from "framer-motion";

import ProductCard from "./ProductCard";
import CardSettings from "./CardSettings";
import { EmptyState, ErrorState, GridSkeleton } from "../ui/States";
import { useCatalog } from "../../context/CatalogContext";
import { useLang } from "../../context/LanguageContext";
import { gridProps, useDisplayPrefs } from "../../context/DisplayPrefsContext";
import { summarize } from "../../lib/product";

/* Product grid with a slim bar (result count + "View studio"). Default order: lowest price first. */
export default function ProductBrowser({ items, loading, error, onRetry, showSort = true, keepOrder = false }) {
  const { t } = useLang();
  const { drops } = useCatalog();
  const { prefs } = useDisplayPrefs();

  const list = useMemo(() => {
    if (keepOrder) return items ?? [];
    const price = new Map((items ?? []).map((p) => [p.slug, summarize(p, { drops }).best.price]));
    return [...(items ?? [])].sort((a, b) => price.get(a.slug) - price.get(b.slug));
  }, [items, keepOrder, drops]);

  if (error) return <ErrorState onRetry={onRetry} />;
  if (loading) return <GridSkeleton />;

  return (
    <div>
      {showSort && list.length > 0 && (
        <div className="nt-viewbar">
          <span className="nt-count" role="status">{t("p.results", { n: list.length })}</span>
          <CardSettings />
        </div>
      )}
      {list.length === 0 ? (
        <EmptyState icon="search" title={t("p.empty.title")} text={t("p.empty.text")} />
      ) : (
        <LayoutGroup>
          <motion.div layout className="nt-grid" {...gridProps(prefs)}>
            {list.map((p, i) => <ProductCard key={p.slug} product={p} index={i} />)}
          </motion.div>
        </LayoutGroup>
      )}
    </div>
  );
}
