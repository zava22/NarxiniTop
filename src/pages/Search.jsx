import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import PageShell from "../components/layout/PageShell";
import SmartSearch from "../components/home/SmartSearch";
import ProductBrowser from "../components/products/ProductBrowser";
import Gate from "../components/ui/Gate";
import { useCatalog } from "../context/CatalogContext";
import { useLang } from "../context/LanguageContext";
import Icon from "../components/ui/Icon";

export default function Search() {
  const { t } = useLang();
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const { products, search, status, error, source, reload } = useCatalog();

  const { items, query } = useMemo(() => {
    if (!q.trim()) return { items: products, query: null };
    const r = search(q);
    return { items: r.results.map((x) => x.product), query: r.query };
  }, [q, products, search]);

  return (
    <PageShell>
      <h1 className="nt-h1">{q ? t("p.search.resultsFor", { q }) : t("nav.search")}</h1>
      <Gate>
        <SmartSearch key={q} initial={q} />
        {query && (
          <div className="nt-intent">
            {query.cheapest && <span className="nt-chip"><Icon name="tag" size={14} /> {t("p.search.cheapest")}</span>}
            {query.size && <span className="nt-chip"><Icon name="ruler" size={14} /> {query.size.label}</span>}
            {query.category && <span className="nt-chip"><Icon name="tag" size={14} /> {t(`cat.${query.category}`)}</span>}
          </div>
        )}
        <ProductBrowser items={items} loading={status === "loading"} error={status === "error" ? error : null} onRetry={reload} keepOrder={Boolean(q.trim())} />
      </Gate>
    </PageShell>
  );
}
