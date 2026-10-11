import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import Icon from "../ui/Icon";
import ProductCard from "../products/ProductCard";
import SafeImg from "./SafeImg";
import { categoryNames } from "../home/CategoryNav";
import { useCatalog } from "../../context/CatalogContext";
import { toast } from "../../lib/toast";
import { adminApi } from "../../services/admin";
import { fmtDate, spaced } from "./format";

const CHAINS = ["Korzinka", "Havas", "Makro"];
const digits = (v) => String(v ?? "").replace(/\D/g, "");

/* Product editor (right-hand drawer). `product` = null -> new product. Ctrl/Cmd+S saves, Esc closes. */
export default function ProductDrawer({ product, onClose, onSaved }) {
  const editing = Boolean(product);
  const { products: catalog } = useCatalog();
  const seq = useRef(0);
  const row = (o = {}) => ({ key: ++seq.current, store: o.store ?? "", price: o.price ? String(o.price) : "", oldPrice: o.oldPrice ? String(o.oldPrice) : "", inStock: o.inStock !== false });

  const [f, setF] = useState(() => ({ name: product?.name ?? "", brand: product?.brand ?? "", category: product?.category ?? "", unit: product?.unit ?? "", image: product?.image ?? "", description: product?.description ?? "" }));
  const [rows, setRows] = useState(() => {
    const mine = (product?.offers ?? []).filter((o) => o.managed).map(row);
    return mine.length || editing ? mine : [row({ store: CHAINS[0] })];
  });
  const locked = useMemo(() => (product?.offers ?? []).filter((o) => !o.managed), [product]);
  const [badImg, setBadImg] = useState(""); // the address that failed to load (derived check below, no effect needed)
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const first = useRef(null);
  const formRef = useRef(null);

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const setRow = (key, patch) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const used = new Set(rows.map((r) => r.store.trim().toLowerCase()));
  const suggestions = useMemo(() => [...new Set([...CHAINS, ...catalog.flatMap((p) => p.prices.map((o) => o.store))])], [catalog]);
  const categories = useMemo(() => [...new Set([...categoryNames, ...(f.category && !categoryNames.includes(f.category) ? [f.category] : [])])], [f.category]);

  useEffect(() => {
    first.current?.focus();
    const key = (e) => {
      if (e.key === "Escape" && !busy) onClose();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (!busy) formRef.current?.requestSubmit(); }
    };
    window.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [busy, onClose]);

  useEffect(() => {
    if (!product?.slug) return undefined;
    let off = false;
    adminApi.history(product.slug).then((h) => { if (!off) setHistory(h); });
    return () => { off = true; };
  }, [product?.slug]);

  const imageUrl = f.image.trim();
  const imgOk = badImg !== imageUrl;

  const prices = useMemo(
    () => [
      ...rows.filter((r) => r.store.trim() && Number(r.price) > 0).map((r) => ({ store: r.store.trim(), price: Number(r.price), oldPrice: Number(r.oldPrice) > Number(r.price) ? Number(r.oldPrice) : undefined, inStock: r.inStock })),
      ...locked.map((o) => ({ store: o.store, price: o.price, oldPrice: o.oldPrice ?? undefined, inStock: o.inStock })),
    ],
    [rows, locked]
  );
  const preview = f.name.trim().length > 1 && prices.length ? { id: "preview", slug: "preview", name: f.name.trim(), category: f.category || "Boshqa", unit: f.unit, image: imgOk ? imageUrl : "", description: f.description, prices } : null;
  const recent = useMemo(() => [...history].sort((a, b) => String(b.ts).localeCompare(String(a.ts))).slice(0, 8), [history]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (f.name.trim().length < 2) return setErr("Mahsulot nomini kiriting.");
    if (!f.category) return setErr("Kategoriyani tanlang.");
    if (!f.unit.trim()) return setErr("O‘lchov birligini kiriting (masalan 1.5 L).");
    const offers = rows.filter((r) => r.store.trim() || r.price).map((r) => ({ store: r.store.trim(), price: r.price === "" ? 0 : Number(r.price), oldPrice: r.oldPrice === "" ? undefined : Number(r.oldPrice), inStock: r.inStock }));
    const names = offers.map((o) => o.store.toLowerCase());
    if (new Set(names).size !== names.length) return setErr("Bir do‘kon ikki marta kiritilgan.");
    const bad = offers.find((o) => o.oldPrice !== undefined && o.oldPrice <= o.price);
    if (bad) return setErr(`${bad.store || "Narx"}: eski narx joriy narxdan katta bo‘lishi kerak.`);
    setBusy(true);
    try {
      const payload = { ...f, offers };
      const saved = editing ? await adminApi.updateProduct(product.slug, payload) : await adminApi.createProduct(payload);
      toast(editing ? `“${saved.name}” saqlandi` : `“${saved.name}” saytga qo‘shildi`, { confetti: !editing });
      onSaved(saved);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div className="adm-drawer-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <motion.aside className="adm-drawer" role="dialog" aria-modal="true" aria-label={editing ? "Mahsulotni tahrirlash" : "Yangi mahsulot"} initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 320, damping: 36 }}>
        <header className="adm-drawer-head">
          <div><span className="adm-eyebrow">{editing ? "Tahrirlash" : "Yangi mahsulot"}</span><h2>{editing ? product.name : "Mahsulot qo‘shish"}</h2></div>
          <button type="button" className="adm-icon-btn" onClick={onClose} disabled={busy} aria-label="Yopish"><Icon name="x" size={20} /></button>
        </header>

        <form className="adm-drawer-body" ref={formRef} onSubmit={submit} noValidate>
          <div className="adm-form">
            <div className="adm-fields">
              <label className="adm-field adm-span2"><span>Nomi *</span><input ref={first} value={f.name} onChange={set("name")} placeholder="Masalan: Sprite 1.5L" maxLength={120} /></label>
              <label className="adm-field"><span>Kategoriya *</span>
                <select value={f.category} onChange={set("category")}>
                  <option value="" disabled>Tanlang…</option>
                  {categories.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="adm-field"><span>O‘lchov *</span><input value={f.unit} onChange={set("unit")} placeholder="1.5 L, 140 g, 1 kg…" maxLength={30} /></label>
              <label className="adm-field adm-span2"><span>Brend</span><input value={f.brand} onChange={set("brand")} placeholder="Ixtiyoriy" maxLength={60} /></label>
              <div className="adm-field adm-span2">
                <label htmlFor="adm-image-url"><span>Rasm manzili (URL)</span></label>
                <input id="adm-image-url" value={f.image} onChange={set("image")} placeholder="https://…" inputMode="url" />
                {imageUrl && (
                  <div className={`adm-imgprev ${imgOk ? "" : "is-bad"}`}>
                    {imgOk
                      ? <SafeImg key={imageUrl} force src={imageUrl} alt="" loading="eager" onError={() => setBadImg(imageUrl)} fallback={<small>Rasm ochilmadi — manzilni tekshiring</small>} />
                      : <small>Rasm ochilmadi — manzilni tekshiring</small>}
                  </div>
                )}
              </div>
              <label className="adm-field adm-span2"><span>Tavsif</span><textarea rows={3} value={f.description} onChange={set("description")} placeholder="Qisqa tavsif (ixtiyoriy)" maxLength={600} /></label>
            </div>

            <section className="adm-prices">
              <div className="adm-prices-head"><h3>Do‘kon narxlari</h3><span className="adm-pill">{prices.length}</span></div>
              <datalist id="adm-stores">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>

              {rows.map((r) => (
                <div className="adm-offer" key={r.key}>
                  <input list="adm-stores" value={r.store} onChange={(e) => setRow(r.key, { store: e.target.value })} placeholder="Do‘kon" aria-label="Do‘kon" maxLength={40} />
                  <input value={r.price} onChange={(e) => setRow(r.key, { price: digits(e.target.value) })} inputMode="numeric" placeholder="Narx, UZS" aria-label="Narx" />
                  <input value={r.oldPrice} onChange={(e) => setRow(r.key, { oldPrice: digits(e.target.value) })} inputMode="numeric" placeholder="Eski narx" aria-label="Eski narx" />
                  <label className="adm-toggle" title="Do‘konda mavjud"><input type="checkbox" checked={r.inStock} onChange={(e) => setRow(r.key, { inStock: e.target.checked })} /><i /><span>Mavjud</span></label>
                  <button type="button" className="adm-icon-btn is-danger" onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))} aria-label="Narxni olib tashlash"><Icon name="trash" size={16} /></button>
                </div>
              ))}

              {locked.map((o) => (
                <div className="adm-offer is-locked" key={o.store}>
                  <b>{o.store}</b><span>{spaced(o.price)} UZS</span><em><Icon name="lock" size={13} />do‘kon API’dan avtomatik yangilanadi</em>
                </div>
              ))}

              <div className="adm-chips">
                {CHAINS.filter((c) => !used.has(c.toLowerCase())).map((c) => <button key={c} type="button" onClick={() => setRows((x) => [...x, row({ store: c })])}><Icon name="plus" size={14} />{c}</button>)}
                <button type="button" onClick={() => setRows((x) => [...x, row()])} disabled={rows.length >= 12}><Icon name="plus" size={14} />Boshqa do‘kon</button>
              </div>
              {!prices.length && <p className="adm-hint"><Icon name="info" size={15} />Kamida bitta narx qo‘shilmaguncha mahsulot saytda ko‘rinmaydi.</p>}
            </section>

            {recent.length > 0 && (
              <section className="adm-history">
                <div className="adm-prices-head"><h3>Narx tarixi</h3><span className="adm-pill">{history.length}</span></div>
                <ul>
                  {recent.map((h, i) => <li key={`${h.ts}-${h.store}-${i}`}><i>{h.store}</i><b>{spaced(h.price)} UZS</b><time>{fmtDate(h.ts)}</time></li>)}
                </ul>
              </section>
            )}
          </div>

          <aside className="adm-preview" aria-label="Saytdagi ko‘rinishi">
            <span className="adm-eyebrow">Saytdagi ko‘rinishi</span>
            {preview ? <div className="adm-preview-card nt-grid" inert><ProductCard product={preview} /></div> : <div className="adm-preview-empty"><Icon name="eye" size={26} /><p>Nom va kamida bitta narx kiriting — mahsulot kartochkasi shu yerda ko‘rinadi.</p></div>}
          </aside>

          <footer className="adm-drawer-foot">
            {err && <p className="adm-err" role="alert"><Icon name="alert" size={16} />{err}</p>}
            <span className="adm-kbd-hint"><kbd>Ctrl</kbd>+<kbd>S</kbd> saqlash</span>
            <button type="button" className="adm-btn" onClick={onClose} disabled={busy}>Bekor qilish</button>
            <button type="submit" className="adm-btn is-primary" disabled={busy}>{busy ? "Saqlanmoqda…" : editing ? "Saqlash" : "Saytga qo‘shish"}</button>
          </footer>
        </form>
      </motion.aside>
    </motion.div>
  );
}
