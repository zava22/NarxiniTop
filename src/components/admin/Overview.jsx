import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Icon from "../ui/Icon";
import { Skeleton } from "../ui/States";
import SafeImg from "./SafeImg";
import useCountUp from "../../hooks/useCountUp";
import { adminApi } from "../../services/admin";
import { actionInfo, avatarColor, spaced, timeAgo } from "./format";

function Stat({ icon, label, value, hint, tone = "", delay = 0, onClick }) {
  const n = useCountUp(value ?? 0, 900);
  const Tag = onClick ? motion.button : motion.article;
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} className={`adm-stat ${tone} ${onClick ? "is-click" : ""}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}>
      <span className="adm-stat-ico"><Icon name={icon} size={20} /></span>
      <div>
        <small>{label}</small>
        <strong>{spaced(n)}</strong>
        <em>{hint}</em>
      </div>
    </Tag>
  );
}

function Bars({ rows, empty }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (!rows.length) return <p className="adm-muted">{empty}</p>;
  return (
    <ul className="adm-bars">
      {rows.slice(0, 10).map((r, i) => (
        <li key={r.name}>
          <span title={r.name}>{r.name}</span>
          <div><motion.i initial={{ width: 0 }} animate={{ width: `${(r.count / max) * 100}%` }} transition={{ duration: 0.7, delay: 0.1 + i * 0.05, ease: [0.22, 1, 0.36, 1] }} /></div>
          <b>{r.count}</b>
        </li>
      ))}
    </ul>
  );
}

/* 14-day sign-up bars (pure CSS, no chart library) */
function Spark({ data }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="adm-spark-wrap">
      <div className="adm-spark" role="img" aria-label={`Oxirgi 14 kunda ${total} ta yangi foydalanuvchi`}>
        {data.map((d, i) => (
          <motion.i key={d.date} title={`${d.date}: ${d.count}`} className={d.count ? "has" : ""} initial={{ height: 4 }} animate={{ height: `${Math.max(6, (d.count / max) * 100)}%` }} transition={{ duration: 0.5, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }} />
        ))}
      </div>
      <div className="adm-spark-axis"><span>{data[0]?.date.slice(5)}</span><b>{total} ta yangi</b><span>{data.at(-1)?.date.slice(5)}</span></div>
    </div>
  );
}

export default function Overview({ version, onGo, onAction, name, hero }) {
  const [state, setState] = useState({ data: null, error: "" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let off = false;
    adminApi.stats().then((data) => !off && setState({ data, error: "" })).catch((e) => !off && setState({ data: null, error: e.message }));
    return () => { off = true; };
  }, [version, tick]);

  if (state.error) return <div className="adm-card adm-error" role="alert"><Icon name="alert" size={22} /><div><h3>Ma’lumotni yuklab bo‘lmadi</h3><p>{state.error}</p></div><button type="button" className="adm-btn" onClick={() => { setState({ data: null, error: "" }); setTick((n) => n + 1); }}><Icon name="refresh" size={16} />Qayta urinish</button></div>;
  if (!state.data) return <div className="adm-stats">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={104} r={22} />)}</div>;

  const { counts: c, categories, stores, signups, recentProducts, recentUsers, recentActivity, database } = state.data;
  return (
    <div className="adm-overview">
      {hero && (
        <motion.section className="adm-hero" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
          <div className="adm-hero-orb" aria-hidden="true" />
          <div className="adm-hero-txt">
            <span className="adm-eyebrow is-light"><Icon name="shield" size={14} />Boshqaruv paneli</span>
            <h2>Salom, {name || "admin"} 👋</h2>
            <p>Mahsulotlar, narxlar va foydalanuvchilarni shu yerdan boshqaring. Qo‘shgan har bir mahsulot darhol saytda paydo bo‘ladi.</p>
          </div>
          <div className="adm-hero-act">
            <button type="button" className="adm-btn is-light" onClick={() => onAction("add")}><Icon name="plus" size={17} />Mahsulot qo‘shish</button>
            <Link to="/" className="adm-btn is-ghost-light">Saytni ko‘rish<Icon name="arrowRight" size={16} /></Link>
          </div>
        </motion.section>
      )}

      <div className="adm-stats">
        <Stat icon="package" label="Mahsulotlar" value={c.products} hint={`${c.live} tasi saytda ko‘rinadi`} delay={0} onClick={() => onGo("products")} />
        <Stat icon="tag" label="Narxlar" value={c.offers} hint={`${stores.length} ta do‘kon`} delay={0.06} tone="is-warm" onClick={() => onGo("products")} />
        <Stat icon="user" label="Foydalanuvchilar" value={c.users} hint={`${c.newWeek} ta yangi (7 kun)`} delay={0.12} onClick={() => onGo("users")} />
        <Stat icon="trendUp" label="Bugun faol" value={c.activeToday} hint="oxirgi 24 soat" delay={0.18} tone="is-green" onClick={() => onGo("users")} />
      </div>
      <div className="adm-stats is-minor">
        <Stat icon="inbox" label="Yangi xabarlar" value={c.unread} hint={c.unread ? "javob kutmoqda" : "hammasi o‘qilgan"} delay={0.2} tone={c.unread ? "is-warm" : ""} onClick={() => onGo("messages")} />
        <Stat icon="trendDown" label="Narx o‘zgarishi" value={c.priceChanges} hint="oxirgi 7 kunda" delay={0.24} />
        <Stat icon="alert" label="Tugagan narxlar" value={c.outOfStock} hint="do‘konda mavjud emas" delay={0.28} />
        <Stat icon="image" label="Rasmsiz" value={c.noImage} hint={c.noImage ? "rasm qo‘shing" : "hammasida rasm bor"} delay={0.32} onClick={() => onGo("products")} />
      </div>

      {(c.hidden > 0 || c.noImage > 0 || c.unread > 0) && (
        <div className="adm-notes">
          {c.unread > 0 && <button type="button" onClick={() => onGo("messages")}><Icon name="inbox" size={16} />{c.unread} ta yangi xabar</button>}
          {c.hidden > 0 && <button type="button" onClick={() => onGo("products")}><Icon name="alert" size={16} />{c.hidden} ta mahsulotda narx yo‘q — saytda ko‘rinmaydi</button>}
          {c.noImage > 0 && <button type="button" onClick={() => onGo("products")}><Icon name="info" size={16} />{c.noImage} ta mahsulotda rasm yo‘q</button>}
        </div>
      )}

      <div className="adm-grid2">
        <section className="adm-card">
          <header className="adm-card-head"><h3>Yangi foydalanuvchilar</h3><span className="adm-pill">14 kun</span></header>
          <Spark data={signups} />
        </section>
        <section className="adm-card">
          <header className="adm-card-head"><h3>Tezkor amallar</h3></header>
          <div className="adm-quick">
            <button type="button" onClick={() => onAction("add")}><Icon name="plus" size={18} /><span>Mahsulot qo‘shish</span></button>
            <button type="button" onClick={() => onAction("images")}><Icon name="image" size={18} /><span>Rasmlarni tekshirish</span></button>
            <button type="button" onClick={() => onAction("export-products")}><Icon name="download" size={18} /><span>Mahsulotlar (CSV)</span></button>
            <button type="button" onClick={() => onAction("export-users")}><Icon name="download" size={18} /><span>Foydalanuvchilar (CSV)</span></button>
          </div>
        </section>
      </div>

      <div className="adm-grid2">
        <section className="adm-card">
          <header className="adm-card-head"><h3>Kategoriyalar</h3><span className="adm-pill">{categories.length}</span></header>
          <Bars rows={categories} empty="Hali mahsulot yo‘q." />
        </section>
        <section className="adm-card">
          <header className="adm-card-head"><h3>Do‘konlar bo‘yicha narxlar</h3><span className="adm-pill">{stores.length}</span></header>
          <Bars rows={stores} empty="Hali narx yo‘q." />
        </section>
      </div>

      <div className="adm-grid2">
        <section className="adm-card">
          <header className="adm-card-head"><h3>So‘nggi mahsulotlar</h3><button type="button" className="adm-link" onClick={() => onGo("products")}>Hammasi<Icon name="arrowRight" size={15} /></button></header>
          <ul className="adm-mini">
            {recentProducts.map((p) => (
              <li key={p.slug}>
                <span className="adm-thumb"><SafeImg src={p.image} size={18} /></span>
                <div><b>{p.name}</b><small>{p.category}</small></div>
                <time>{timeAgo(p.createdAt)}</time>
              </li>
            ))}
            {!recentProducts.length && <li className="adm-muted">Hali mahsulot yo‘q.</li>}
          </ul>
        </section>
        <section className="adm-card">
          <header className="adm-card-head"><h3>So‘nggi foydalanuvchilar</h3><button type="button" className="adm-link" onClick={() => onGo("users")}>Hammasi<Icon name="arrowRight" size={15} /></button></header>
          <ul className="adm-mini">
            {recentUsers.map((u) => (
              <li key={u.id}>
                <span className="adm-ava" style={{ background: avatarColor(u.email) }}><SafeImg src={u.avatar} fallback={(u.name || u.email || "?").slice(0, 1).toUpperCase()} /></span>
                <div><b>{u.name || u.email.split("@")[0]}</b><small>{u.email}</small></div>
                <time>{timeAgo(u.lastSeenAt)}</time>
              </li>
            ))}
            {!recentUsers.length && <li className="adm-muted">Hali hech kim kirmagan. Foydalanuvchilar tizimga kirganda shu yerda paydo bo‘ladi.</li>}
          </ul>
        </section>
      </div>

      <section className="adm-card">
        <header className="adm-card-head"><h3>So‘nggi amallar</h3><button type="button" className="adm-link" onClick={() => onGo("activity")}>Hammasi<Icon name="arrowRight" size={15} /></button></header>
        <ul className="adm-mini">
          {recentActivity.map((a) => {
            const [label, icon, tone] = actionInfo(a.action);
            return (
              <li key={a.id}>
                <span className={`adm-act-ico ${tone}`}><Icon name={icon} size={16} /></span>
                <div><b>{label}</b><small>{[a.detail, a.by].filter(Boolean).join(" · ")}</small></div>
                <time>{timeAgo(a.ts)}</time>
              </li>
            );
          })}
          {!recentActivity.length && <li className="adm-muted">Hali amal bajarilmagan. Mahsulot qo‘shsangiz yoki o‘zgartirsangiz, shu yerda ko‘rinadi.</li>}
        </ul>
      </section>

      <p className="adm-db"><i aria-hidden="true" />MongoDB ulangan · baza: <b>{database}</b></p>
    </div>
  );
}
