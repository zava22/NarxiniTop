import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Icon from "../ui/Icon";
import ConfirmDialog from "../ui/ConfirmDialog";
import { Skeleton } from "../ui/States";
import ImageCheck from "./ImageCheck";
import SafeImg from "./SafeImg";
import { categoryNames } from "../home/CategoryNav";
import { formatPrice } from "../../lib/constants";
import { toast } from "../../lib/toast";
import { adminApi } from "../../services/admin";
import { timeAgo } from "./format";

const PAGE = 40;
const SORTS = [["name", "Nomi (A–Z)"], ["new", "Yangi qo‘shilgan"], ["updated", "Yaqinda o‘zgargan"], ["cheap", "Arzonroq birinchi"], ["offers", "Do‘konlar soni"]];

const cheapest = (p) => Math.min(...p.offers.filter((o) => o.inStock).map((o) => o.price), Infinity);
const time = (iso) => (iso ? new Date(iso).getTime() || 0 : 0);
const SORT_FN = {
  name: (a, b) => String(a.name).localeCompare(String(b.name)),
  new: (a, b) => time(b.createdAt) - time(a.createdAt),
  updated: (a, b) => time(b.updatedAt) - time(a.updatedAt),
  cheap: (a, b) => cheapest(a) - cheapest(b),
  offers: (a, b) => b.offers.length - a.offers.length,
};

export default function ProductsPanel({ version, view, imagesOpen, onOpenImages, onCloseImages, onOpenDrawer, onChanged }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [only, setOnly] = useState(""); // "" | hidden | noimg | out
  const [sort, setSort] = useState("name");
  const [shown, setShown] = useState(PAGE);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkCat, setBulkCat] = useState("");
  const [del, setDel] = useState(null); // one product waiting for delete confirmation
  const [bulkDel, setBulkDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let off = false;
    adminApi.products().then((p) => { if (!off) { setItems(p); setError(""); } }).catch((e) => { if (!off) setError(e.message); });
    return () => { off = true; };
  }, [version, tick]);

  const stats = useMemo(() => {
    const all = items ?? [];
    return { hidden: all.filter((p) => !p.offers.length).length, noImg: all.filter((p) => !p.image).length, out: all.filter((p) => p.offers.some((o) => !o.inStock)).length };
  }, [items]);
  const cats = useMemo(() => [...new Set([...categoryNames, ...(items ?? []).map((p) => p.category).filter(Boolean)])], [items]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const rows = (items ?? []).filter((p) => (!cat || p.category === cat)
      && (!s || `${p.name} ${p.brand} ${p.category} ${p.slug}`.toLowerCase().includes(s))
      && (only === "hidden" ? !p.offers.length : only === "noimg" ? !p.image : only === "out" ? p.offers.some((o) => !o.inStock) : true));
    return rows.sort(SORT_FN[sort] ?? SORT_FN.name);
  }, [items, q, cat, only, sort]);

  const visible = list.slice(0, shown);
  const existing = useMemo(() => new Set((items ?? []).map((p) => p.slug)), [items]);
  const picked = [...selected].filter((s) => existing.has(s)); // selection never keeps ghosts of deleted rows
  const allVisibleOn = visible.length > 0 && visible.every((p) => selected.has(p.slug));

  const filter = (fn) => { fn(); setShown(PAGE); };
  const toggle = (slug) => setSelected((s) => { const n = new Set(s); if (n.has(slug)) n.delete(slug); else n.add(slug); return n; });
  const toggleVisible = () => setSelected((s) => { const n = new Set(s); for (const p of visible) { if (allVisibleOn) n.delete(p.slug); else n.add(p.slug); } return n; });

  const act = async (fn) => { setBusy(true); try { await fn(); } catch (e) { toast(e.message); } finally { setBusy(false); } };

  const remove = () => act(async () => {
    await adminApi.deleteProduct(del.slug);
    setItems((all) => (all ?? []).filter((x) => x.slug !== del.slug));
    toast(`“${del.name}” o‘chirildi`);
    setDel(null);
    onChanged();
  });

  const duplicate = (p) => act(async () => {
    const copy = await adminApi.duplicateProduct(p.slug);
    toast(`“${copy.name}” yaratildi`);
    onChanged();
    onOpenDrawer(copy); // jump straight into editing the copy
  });

  const bulk = (action, extra, okText) => act(async () => {
    const r = await adminApi.bulk(action, picked, extra);
    toast(`${r.affected} ta mahsulot — ${okText}`);
    if (action === "delete") setItems((all) => (all ?? []).filter((x) => !picked.includes(x.slug)));
    setSelected(new Set());
    setBulkDel(false);
    setBulkCat("");
    onChanged();
  });

  const importJson = () => act(async () => {
    const r = await adminApi.seed(false);
    toast(r.productsAdded ? `products.json dan ${r.productsAdded} ta yangi mahsulot qo‘shildi` : "products.json dagi hamma narsa allaqachon bazada");
    setTick((v) => v + 1);
    onChanged();
  });

  const exportCsv = () => act(async () => { toast(`${await adminApi.download("products")} yuklab olindi`); });

  const editBySlug = (slug) => { const p = (items ?? []).find((x) => x.slug === slug); if (p) onOpenDrawer(p); };

  if (error && !items) return <div className="adm-card adm-error" role="alert"><Icon name="alert" size={22} /><div><h3>Mahsulotlarni yuklab bo‘lmadi</h3><p>{error}</p></div><button type="button" className="adm-btn" onClick={() => { setError(""); setTick((v) => v + 1); }}><Icon name="refresh" size={16} />Qayta urinish</button></div>;

  const grid = view === "grid";
  return (
    <section className="adm-panel">
      <div className="adm-card adm-toolbar-card">
        <div className="adm-toolbar">
          <label className="adm-search"><Icon name="search" size={17} /><input value={q} onChange={(e) => filter(() => setQ(e.target.value))} placeholder="Mahsulot qidirish…  ( / )" aria-label="Qidirish" /></label>
          <select className="adm-select" value={cat} onChange={(e) => filter(() => setCat(e.target.value))} aria-label="Kategoriya">
            <option value="">Barcha kategoriyalar</option>
            {cats.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="adm-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Saralash">
            {SORTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
        <div className="adm-toolbar adm-toolbar-actions">
          <button type="button" className="adm-btn is-sm" onClick={importJson} disabled={busy} title="src/data/products.json dagi yetishmayotgan mahsulotlarni bazaga qo‘shadi"><Icon name="download" size={15} />products.json import</button>
          <button type="button" className="adm-btn is-sm" onClick={exportCsv} disabled={busy}><Icon name="download" size={15} />CSV eksport</button>
          <button type="button" className={`adm-btn is-sm ${imagesOpen ? "is-on" : ""}`} onClick={imagesOpen ? onCloseImages : onOpenImages}><Icon name="image" size={15} />Rasmlarni tekshirish</button>
          <button type="button" className="adm-btn is-primary" onClick={() => onOpenDrawer(null)}><Icon name="plus" size={17} />Mahsulot qo‘shish</button>
        </div>
        <div className="adm-filters">
          <p className="adm-count"><b>{items ? list.length : "…"}</b> ta mahsulot{items && list.length !== items.length && <> · jami {items.length}</>}</p>
          {stats.hidden > 0 && <button type="button" className={`adm-chip ${only === "hidden" ? "is-on" : ""}`} onClick={() => filter(() => setOnly(only === "hidden" ? "" : "hidden"))}>Narxsiz · {stats.hidden}</button>}
          {stats.noImg > 0 && <button type="button" className={`adm-chip ${only === "noimg" ? "is-on" : ""}`} onClick={() => filter(() => setOnly(only === "noimg" ? "" : "noimg"))}>Rasmsiz · {stats.noImg}</button>}
          {stats.out > 0 && <button type="button" className={`adm-chip ${only === "out" ? "is-on" : ""}`} onClick={() => filter(() => setOnly(only === "out" ? "" : "out"))}>Tugagan narxli · {stats.out}</button>}
          {(q || cat || only) && <button type="button" className="adm-chip" onClick={() => filter(() => { setQ(""); setCat(""); setOnly(""); })}>Tozalash ✕</button>}
        </div>
      </div>

      {imagesOpen && <ImageCheck onClose={onCloseImages} onChanged={onChanged} onEdit={editBySlug} />}

      <AnimatePresence>
        {picked.length > 0 && (
          <motion.div className="adm-bulk" role="region" aria-label="Tanlanganlar bilan amallar" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }} transition={{ duration: 0.2 }}>
            <b>{picked.length} ta tanlandi</b>
            <div className="adm-bulk-cat">
              <select className="adm-select" value={bulkCat} onChange={(e) => setBulkCat(e.target.value)} aria-label="Yangi kategoriya">
                <option value="">Kategoriyani o‘zgartirish…</option>
                {cats.map((c) => <option key={c}>{c}</option>)}
              </select>
              <button type="button" className="adm-btn is-sm" disabled={busy || !bulkCat} onClick={() => bulk("category", { category: bulkCat }, `kategoriya “${bulkCat}”`)}>Qo‘llash</button>
            </div>
            <button type="button" className="adm-btn is-sm" disabled={busy} onClick={() => bulk("stock", { inStock: true }, "mavjud deb belgilandi")}><Icon name="check" size={14} />Mavjud</button>
            <button type="button" className="adm-btn is-sm" disabled={busy} onClick={() => bulk("stock", { inStock: false }, "tugagan deb belgilandi")}><Icon name="x" size={14} />Tugagan</button>
            <button type="button" className="adm-btn is-sm is-danger" disabled={busy} onClick={() => setBulkDel(true)}><Icon name="trash" size={14} />O‘chirish</button>
            <button type="button" className="adm-btn is-sm is-ghost" onClick={() => setSelected(new Set())}>Bekor qilish</button>
          </motion.div>
        )}
      </AnimatePresence>

      {!items ? (
        <div className="adm-skels">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} h={78} r={18} />)}</div>
      ) : list.length === 0 ? (
        <div className="adm-card adm-empty"><Icon name="package" size={30} /><h3>{items.length ? "Hech narsa topilmadi" : "Baza hali bo‘sh"}</h3><p>{items.length ? "Qidiruv yoki filtrni o‘zgartirib ko‘ring." : "Birinchi mahsulotni qo‘shing yoki products.json dagi mahsulotlarni bazaga import qiling."}</p>{!items.length && <button type="button" className="adm-btn is-primary" onClick={importJson} disabled={busy}>products.json import</button>}</div>
      ) : (
        <>
          <label className="adm-check adm-selectall"><input type="checkbox" checked={allVisibleOn} onChange={toggleVisible} /><span>Ko‘rinayotganlarni tanlash ({visible.length})</span></label>
          <ul className={`adm-rows ${grid ? "is-grid" : ""}`}>
            <AnimatePresence initial={false}>
              {visible.map((p, i) => {
                const best = p.offers.filter((o) => o.inStock).sort((a, b) => a.price - b.price)[0];
                const sel = selected.has(p.slug);
                return (
                  <motion.li key={p.slug} className={`adm-prow ${sel ? "is-sel" : ""}`} layout="position" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.28, delay: Math.min(i, 10) * 0.02 }}>
                    <label className="adm-check adm-prow-check"><input type="checkbox" checked={sel} onChange={() => toggle(p.slug)} aria-label={`${p.name} — tanlash`} /></label>
                    <span className="adm-thumb is-lg"><SafeImg src={p.image} size={22} /></span>
                    <div className="adm-pinfo">
                      <b title={p.name}>{p.name}</b>
                      <small>{[p.category, p.unit, p.brand].filter(Boolean).join(" · ")}</small>
                      <small className="adm-faint">Yangilangan: {timeAgo(p.updatedAt)}{p.source === "admin" ? " · admin qo‘shgan" : ""}</small>
                    </div>
                    <div className="adm-poffers">
                      {p.offers.length ? p.offers.map((o) => (
                        <span key={o.store} className={`adm-offer-chip ${best && o.store === best.store && o.price === best.price ? "is-best" : ""} ${o.inStock ? "" : "is-out"}`} title={o.managed ? "" : "do‘kon API’dan"}>
                          <i>{o.store}</i><b>{formatPrice(o.price)}</b>{!o.managed && <Icon name="lock" size={11} />}
                        </span>
                      )) : <span className="adm-warn"><Icon name="alert" size={14} />Narx yo‘q — saytda ko‘rinmaydi</span>}
                    </div>
                    <div className="adm-pact">
                      <button type="button" className="adm-icon-btn" onClick={() => onOpenDrawer(p)} aria-label={`${p.name} — tahrirlash`} title="Tahrirlash"><Icon name="pencil" size={16} /></button>
                      <button type="button" className="adm-icon-btn" onClick={() => duplicate(p)} disabled={busy} aria-label={`${p.name} — nusxa olish`} title="Nusxa olish"><Icon name="copy" size={16} /></button>
                      {p.offers.length > 0 && <Link className="adm-icon-btn" to={`/product/${encodeURIComponent(p.slug)}`} aria-label={`${p.name} — saytda ochish`} title="Saytda ochish"><Icon name="external" size={16} /></Link>}
                      <button type="button" className="adm-icon-btn is-danger" onClick={() => setDel(p)} aria-label={`${p.name} — o‘chirish`} title="O‘chirish"><Icon name="trash" size={16} /></button>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
          {list.length > shown && <button type="button" className="adm-btn adm-more" onClick={() => setShown((n) => n + PAGE)}>Yana ko‘rsatish · {list.length - shown}<Icon name="chevronDown" size={16} /></button>}
        </>
      )}

      <ConfirmDialog open={Boolean(del)} danger busy={busy} title={`“${del?.name ?? ""}” o‘chirilsinmi?`} text="Mahsulot, uning narxlari va narx tarixi bazadan butunlay o‘chadi va saytdan yo‘qoladi." confirmLabel="O‘chirish" onConfirm={remove} onCancel={() => !busy && setDel(null)} />
      <ConfirmDialog open={bulkDel} danger busy={busy} title={`${picked.length} ta mahsulot o‘chirilsinmi?`} text="Tanlangan mahsulotlar, ularning narxlari va narx tarixi bazadan butunlay o‘chadi. Buni qaytarib bo‘lmaydi." confirmLabel="Hammasini o‘chirish" onConfirm={() => bulk("delete", {}, "o‘chirildi")} onCancel={() => !busy && setBulkDel(false)} />
    </section>
  );
}
