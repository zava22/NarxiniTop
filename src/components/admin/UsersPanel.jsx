import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Icon from "../ui/Icon";
import { Skeleton } from "../ui/States";
import SafeImg from "./SafeImg";
import { toast } from "../../lib/toast";
import { isAdminEmail } from "../../lib/admin";
import { adminApi } from "../../services/admin";
import { avatarColor, fmtDate, timeAgo } from "./format";

const SORTS = [["active", "Oxirgi faol"], ["new", "Yangi qo‘shilgan"], ["visits", "Eng faol"]];
const PROVIDERS = [["", "Hammasi"], ["google", "Google"], ["email", "Gmail / parol"]];
const stamp = (iso) => (iso ? new Date(iso).getTime() || 0 : 0);

export default function UsersPanel({ version }) {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("active");
  const [prov, setProv] = useState("");
  const [shown, setShown] = useState(100);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let off = false;
    adminApi.users().then((u) => { if (!off) { setUsers(u); setError(""); } }).catch((e) => { if (!off) setError(e.message); });
    return () => { off = true; };
  }, [tick, version]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const rows = (users ?? []).filter((u) => (!prov || (prov === "google" ? u.provider === "google" : u.provider !== "google")) && (!s || (u.email || "").includes(s) || (u.name || "").toLowerCase().includes(s)));
    const by = { active: (a, b) => stamp(b.lastSeenAt) - stamp(a.lastSeenAt), new: (a, b) => stamp(b.createdAt) - stamp(a.createdAt), visits: (a, b) => b.signIns - a.signIns };
    return [...rows].sort(by[sort]);
  }, [users, q, sort, prov]);

  const activeToday = (users ?? []).filter((u) => Date.now() - stamp(u.lastSeenAt) < 86400000).length;
  const googleCount = (users ?? []).filter((u) => u.provider === "google").length;

  const act = async (fn) => { setBusy(true); try { await fn(); } catch (e) { toast(e.message); } finally { setBusy(false); } };
  const importOld = () => act(async () => {
    const n = await adminApi.importUsers();
    toast(n ? `${n} ta foydalanuvchi Supabase’dan import qilindi` : "Yangi foydalanuvchi topilmadi");
    setTick((v) => v + 1);
  });
  const exportCsv = () => act(async () => { toast(`${await adminApi.download("users")} yuklab olindi`); });
  const copyEmails = () => act(async () => {
    await navigator.clipboard.writeText(list.map((u) => u.email).filter(Boolean).join(", "));
    toast(`${list.length} ta gmail nusxalandi`);
  });

  if (error && !users) return <div className="adm-card adm-error" role="alert"><Icon name="alert" size={22} /><div><h3>Foydalanuvchilarni yuklab bo‘lmadi</h3><p>{error}</p></div><button type="button" className="adm-btn" onClick={() => { setError(""); setTick((v) => v + 1); }}><Icon name="refresh" size={16} />Qayta urinish</button></div>;

  return (
    <section className="adm-panel">
      <div className="adm-card adm-toolbar-card">
        <div className="adm-toolbar">
          <label className="adm-search"><Icon name="search" size={17} /><input value={q} onChange={(e) => { setQ(e.target.value); setShown(100); }} placeholder="Ism yoki gmail bo‘yicha qidirish  ( / )" aria-label="Qidirish" /></label>
          <div className="adm-seg" role="radiogroup" aria-label="Saralash">
            {SORTS.map(([k, label]) => <button key={k} type="button" role="radio" aria-checked={sort === k} className={sort === k ? "is-on" : ""} onClick={() => setSort(k)}>{label}</button>)}
          </div>
        </div>
        <div className="adm-toolbar adm-toolbar-actions">
          <div className="adm-seg" role="radiogroup" aria-label="Kirish usuli">
            {PROVIDERS.map(([k, label]) => <button key={k || "all"} type="button" role="radio" aria-checked={prov === k} className={prov === k ? "is-on" : ""} onClick={() => { setProv(k); setShown(100); }}>{label}</button>)}
          </div>
          <button type="button" className="adm-btn is-sm" onClick={copyEmails} disabled={busy || !list.length}><Icon name="copy" size={15} />Gmaillarni nusxalash</button>
          <button type="button" className="adm-btn is-sm" onClick={exportCsv} disabled={busy}><Icon name="download" size={15} />CSV eksport</button>
          <button type="button" className="adm-btn is-sm" onClick={importOld} disabled={busy} title="SUPABASE_SERVICE_ROLE_KEY kerak"><Icon name="refresh" size={15} className={busy ? "nt-spin-ico" : ""} />Supabase’dan import</button>
        </div>
        <p className="adm-count"><b>{users ? list.length : "…"}</b> ta foydalanuvchi{users && <> · bugun faol: <b>{activeToday}</b> · Google: <b>{googleCount}</b></>}</p>
      </div>

      {!users ? (
        <div className="adm-skels">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={64} r={16} />)}</div>
      ) : list.length === 0 ? (
        <div className="adm-card adm-empty"><Icon name="user" size={30} /><h3>{q || prov ? "Hech narsa topilmadi" : "Hali foydalanuvchi yo‘q"}</h3><p>{q || prov ? "Boshqa so‘z yoki filtr bilan urinib ko‘ring." : "Odamlar saytga kirganda ular shu yerda paydo bo‘ladi. Avval ro‘yxatdan o‘tganlarni “Supabase’dan import” orqali olib kelishingiz mumkin."}</p></div>
      ) : (
        <>
          <div className="adm-urow adm-thead" aria-hidden="true"><span>Foydalanuvchi</span><span>Usul</span><span>Qo‘shilgan</span><span>Oxirgi faollik</span><span>Kirishlar</span></div>
          <ul className="adm-rows">
            <AnimatePresence initial={false}>
              {list.slice(0, shown).map((u, i) => (
                <motion.li key={u.id} className="adm-urow" layout="position" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, delay: Math.min(i, 10) * 0.02 }}>
                  <div className="adm-who">
                    <span className="adm-ava" style={{ background: avatarColor(u.email) }}><SafeImg src={u.avatar} fallback={(u.name || u.email || "?").slice(0, 1).toUpperCase()} /></span>
                    <div><b>{u.name || (u.email || "—").split("@")[0]}{isAdminEmail(u.email) && <em className="adm-tag">Admin</em>}</b><small>{u.email}</small></div>
                  </div>
                  <span data-label="Usul"><i className={`adm-prov is-${u.provider}`}>{u.provider === "google" ? "Google" : "Gmail / parol"}</i></span>
                  <span data-label="Qo‘shilgan">{fmtDate(u.createdAt)}</span>
                  <span data-label="Oxirgi faollik">{timeAgo(u.lastSeenAt)}</span>
                  <span data-label="Kirishlar" className="adm-num">{u.signIns}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {list.length > shown && <button type="button" className="adm-btn adm-more" onClick={() => setShown((n) => n + 100)}>Yana ko‘rsatish · {list.length - shown}<Icon name="chevronDown" size={16} /></button>}
        </>
      )}
    </section>
  );
}
