import { useMemo } from "react";
import localBranches from "../data/branches.json";
import { useCatalog } from "../context/CatalogContext";

/*
 * Branch list = branches ingested through /api/stores (partner APIs) + the locally
 * maintained, source-referenced file src/data/branches.json (see BRANCHES.md).
 * Nothing is invented here: an entry without valid coordinates stays unranked.
 */
export default function useBranches() {
  const { stores, status } = useCatalog();
  return useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const b of [...stores.map((s) => ({ ...s, source: s.source ?? "api" })), ...localBranches]) {
      if (!b?.chain) continue;
      const key = `${b.chain}:${b.id ?? `${b.lat},${b.lng}`}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(b);
    }
    return { branches: list, loading: status === "loading" };
  }, [stores, status]);
}
