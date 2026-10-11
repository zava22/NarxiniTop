import { useEffect, useMemo, useState } from "react";
import Icon from "../ui/Icon";
import { Skeleton } from "../ui/States";
import { adminApi } from "../../services/admin";
import { actionInfo, fmtDateTime, timeAgo } from "./format";

const GROUPS = [["all", "Hammasi"], ["product", "Mahsulotlar"], ["bulk", "Ommaviy"], ["other", "Boshqa"]];
const group = (a) => (a.startsWith("product.") ? "product" : a.startsWith("bulk.") ? "bulk" : "other");

export default function ActivityPanel({ version }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [g, setG] = useState("all");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let off = false;
    adminApi.activity(200).then((r) => { if (!off) { setItems(r); setError(""); } }).catch((e) => { if (!off) setError(e.message); });
    return () => { off = true; };
  }, [tick, version]);

  const list = useMemo(() => (items ?? []).filter((a) => g === "all" || group(a.action) === g), [items, g]);

  if (error && !items) return <div className="adm-card adm-error" role="alert"><Icon name="alert" size={22} /><div><h3>Faollikni yuklab bo‘lmadi</h3><p>{error}</p></div><button type="button" className="adm-btn" onClick={() => { setError(""); setTick((v) => v + 1); }}><Icon name="refresh" size={16} />Qayta urinish</button></div>;

  return (
    <section className="adm-panel">
      <div className="adm-card adm-toolbar-card">
        <div className="adm-toolbar">
          <div className="adm-seg" role="radiogroup" aria-label="Filtr">
            {GROUPS.map(([k, label]) => <button key={k} type="button" role="radio" aria-checked={g === k} className={g === k ? "is-on" : ""} onClick={() => setG(k)}>{label}</button>)}
          </div>
          <p className="adm-count"><b>{items ? list.length : "…"}</b> ta yozuv</p>
          <button type="button" className="adm-btn is-sm" onClick={() => setTick((v) => v + 1)}><Icon name="refresh" size={15} />Yangilash</button>
        </div>
      </div>

      {!items ? (
        <div className="adm-skels">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={58} r={16} />)}</div>
      ) : list.length === 0 ? (
        <div className="adm-card adm-empty"><Icon name="activity" size={30} /><h3>Hali amal yo‘q</h3><p>Mahsulot qo‘shsangiz, tahrirlasangiz yoki o‘chirsangiz — kim, qachon va nima qilgani shu yerda saqlanadi.</p></div>
      ) : (
        <ol className="adm-timeline">
          {list.map((a) => {
            const [label, icon, tone] = actionInfo(a.action);
            return (
              <li key={a.id}>
                <span className={`adm-act-ico ${tone}`}><Icon name={icon} size={16} /></span>
                <div><b>{label}</b><small>{[a.detail, a.target && a.target !== a.detail ? a.target : "", a.by].filter(Boolean).join(" · ")}</small></div>
                <time title={fmtDateTime(a.ts)}>{timeAgo(a.ts)}</time>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
