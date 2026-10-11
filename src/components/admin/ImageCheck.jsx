import { useRef, useState } from "react";
import { motion } from "framer-motion";
import Icon from "../ui/Icon";
import { toast } from "../../lib/toast";
import { adminApi } from "../../services/admin";

const REASONS = { broken: "topilmadi", "not-image": "rasm emas", blocked: "ruxsat etilmagan manzil" };

/* Checks every product image address from the SERVER (so the browser console stays clean) and lets the admin
 * blank the dead ones. A product without an image shows a neutral placeholder and no longer requests the dead URL. */
export default function ImageCheck({ onClose, onChanged, onEdit }) {
  const [phase, setPhase] = useState("idle"); // idle | running | done
  const [progress, setProgress] = useState({ checked: 0, total: 0, ok: 0 });
  const [broken, setBroken] = useState([]);
  const [unreach, setUnreach] = useState([]);
  const [picked, setPicked] = useState(() => new Set());
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const stop = useRef(false);

  const run = async () => {
    stop.current = false;
    setPhase("running"); setErr(""); setBroken([]); setUnreach([]); setPicked(new Set()); setProgress({ checked: 0, total: 0, ok: 0 });
    const b = [], u = [];
    let offset = 0, checked = 0, ok = 0, total = 0;
    try {
      for (let guard = 0; guard < 80 && !stop.current; guard++) {
        const r = await adminApi.checkImages({ offset });
        total = r.total; checked += r.checked; ok += r.okCount;
        b.push(...r.broken); u.push(...r.unreachable);
        setProgress({ checked, total, ok }); setBroken([...b]); setUnreach([...u]);
        if (r.next == null) break;
        offset = r.next;
      }
      setPicked(new Set(b.map((x) => x.slug)));
    } catch (e) { setErr(e.message); }
    setPhase("done");
  };

  const toggle = (slug) => setPicked((s) => { const n = new Set(s); if (n.has(slug)) n.delete(slug); else n.add(slug); return n; });
  const allOn = broken.length > 0 && picked.size === broken.length;

  const clear = async () => {
    const slugs = [...picked];
    if (!slugs.length) return;
    setBusy(true);
    try {
      const n = await adminApi.clearImages(slugs);
      toast(`${n} ta mahsulotdan ishlamaydigan rasm manzili olib tashlandi`);
      setBroken((l) => l.filter((x) => !picked.has(x.slug)));
      setPicked(new Set());
      onChanged();
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  };

  const pct = progress.total ? Math.round((progress.checked / progress.total) * 100) : 0;

  return (
    <section className="adm-card adm-imgcheck" aria-label="Rasmlarni tekshirish">
      <header className="adm-card-head">
        <h3><Icon name="image" size={18} />Rasmlarni tekshirish</h3>
        <button type="button" className="adm-icon-btn" onClick={onClose} aria-label="Yopish"><Icon name="x" size={18} /></button>
      </header>
      <p className="adm-muted">Server har bir mahsulot rasmi manzilini tekshiradi. Ochilmaydigan manzillar brauzer konsolida <b>404</b> xatosini beradi — ularni shu yerdan tozalang.</p>

      <div className="adm-imgcheck-bar">
        {phase !== "running"
          ? <button type="button" className="adm-btn is-primary" onClick={run}><Icon name="refresh" size={16} />{phase === "idle" ? "Tekshirishni boshlash" : "Qayta tekshirish"}</button>
          : <button type="button" className="adm-btn" onClick={() => { stop.current = true; }}><Icon name="x" size={16} />To‘xtatish</button>}
        {phase !== "idle" && (
          <div className="adm-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <motion.i animate={{ width: `${pct}%` }} transition={{ duration: 0.25 }} />
            <span>{progress.checked} / {progress.total || "…"}</span>
          </div>
        )}
      </div>

      {err && <p className="adm-err" role="alert"><Icon name="alert" size={16} />{err}</p>}

      {phase === "done" && !err && (
        <p className="adm-summary">
          <span className="is-ok"><Icon name="check" size={15} />{progress.ok} ta ishlayapti</span>
          <span className={broken.length ? "is-bad" : "is-ok"}><Icon name={broken.length ? "alert" : "check"} size={15} />{broken.length} ta ishlamaydi</span>
          {unreach.length > 0 && <span className="is-warn"><Icon name="info" size={15} />{unreach.length} tasini tekshirib bo‘lmadi (tarmoq/limit)</span>}
        </p>
      )}

      {broken.length > 0 && (
        <>
          <div className="adm-imgcheck-actions">
            <label className="adm-check"><input type="checkbox" checked={allOn} onChange={() => setPicked(allOn ? new Set() : new Set(broken.map((x) => x.slug)))} /><span>Hammasini tanlash</span></label>
            <button type="button" className="adm-btn is-danger is-sm" onClick={clear} disabled={busy || !picked.size}><Icon name="trash" size={15} />{picked.size} ta manzilni olib tashlash</button>
          </div>
          <ul className="adm-broken">
            {broken.map((b) => (
              <li key={b.slug}>
                <label className="adm-check"><input type="checkbox" checked={picked.has(b.slug)} onChange={() => toggle(b.slug)} aria-label={`${b.name} tanlash`} /></label>
                <div><b>{b.name}</b><small title={b.image}>{b.image}</small></div>
                <em className="adm-badge is-bad">{b.status ? `${b.status} · ` : ""}{REASONS[b.reason] ?? b.reason}</em>
                <button type="button" className="adm-btn is-sm" onClick={() => onEdit(b.slug)}><Icon name="pencil" size={14} />Tahrirlash</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
