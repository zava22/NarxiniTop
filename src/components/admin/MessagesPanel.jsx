import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Icon from "../ui/Icon";
import ConfirmDialog from "../ui/ConfirmDialog";
import { Skeleton } from "../ui/States";
import { toast } from "../../lib/toast";
import { adminApi } from "../../services/admin";
import { avatarColor, fmtDateTime, timeAgo } from "./format";

const MAIL = { sent: ["Email yuborilgan", "ok"], failed: ["Email yuborilmadi", "bad"], pending: ["Email kutilmoqda", "warn"], not_configured: ["Email sozlanmagan", ""] };

export default function MessagesPanel({ onUnread }) {
  const [msgs, setMsgs] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all"); // all | unread
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let off = false;
    adminApi.messages().then((m) => { if (!off) { setMsgs(m); setError(""); onUnread(m.filter((x) => !x.read).length); } }).catch((e) => { if (!off) setError(e.message); });
    return () => { off = true; };
  }, [tick, onUnread]);

  const unread = (msgs ?? []).filter((m) => !m.read).length;
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (msgs ?? []).filter((m) => (filter === "all" || !m.read) && (!s || `${m.name} ${m.email} ${m.message}`.toLowerCase().includes(s)));
  }, [msgs, filter, q]);

  const patch = (next) => { setMsgs(next); onUnread(next.filter((x) => !x.read).length); };
  const act = async (fn) => { setBusy(true); try { await fn(); } catch (e) { toast(e.message); } finally { setBusy(false); } };

  const setRead = (m, read) => act(async () => { await adminApi.setMessageRead(m.id, read); patch(msgs.map((x) => (x.id === m.id ? { ...x, read } : x))); });
  const toggleOpen = (m) => { const next = open === m.id ? null : m.id; setOpen(next); if (next && !m.read) setRead(m, true); };
  const readAll = () => act(async () => { const n = await adminApi.readAllMessages(); patch(msgs.map((x) => ({ ...x, read: true }))); toast(n ? `${n} ta xabar o‘qilgan deb belgilandi` : "Yangi xabar yo‘q"); });
  const remove = () => act(async () => { await adminApi.deleteMessage(del.id); patch(msgs.filter((x) => x.id !== del.id)); toast("Xabar o‘chirildi"); setDel(null); });
  const exportCsv = () => act(async () => { toast(`${await adminApi.download("messages")} yuklab olindi`); });

  const reply = (m) => `mailto:${m.email}?subject=${encodeURIComponent("NarxTop: javob")}&body=${encodeURIComponent(`Salom, ${m.name}!\n\n\n\n— Sizning xabaringiz:\n> ${m.message.replace(/\n/g, "\n> ")}`)}`;

  if (error && !msgs) return <div className="adm-card adm-error" role="alert"><Icon name="alert" size={22} /><div><h3>Xabarlarni yuklab bo‘lmadi</h3><p>{error}</p></div><button type="button" className="adm-btn" onClick={() => { setError(""); setTick((v) => v + 1); }}><Icon name="refresh" size={16} />Qayta urinish</button></div>;

  return (
    <section className="adm-panel">
      <div className="adm-card adm-toolbar-card">
        <div className="adm-toolbar">
          <label className="adm-search"><Icon name="search" size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism, gmail yoki matn bo‘yicha qidirish" aria-label="Qidirish" /></label>
          <div className="adm-seg" role="radiogroup" aria-label="Filtr">
            <button type="button" role="radio" aria-checked={filter === "all"} className={filter === "all" ? "is-on" : ""} onClick={() => setFilter("all")}>Hammasi</button>
            <button type="button" role="radio" aria-checked={filter === "unread"} className={filter === "unread" ? "is-on" : ""} onClick={() => setFilter("unread")}>O‘qilmagan · {unread}</button>
          </div>
        </div>
        <div className="adm-toolbar adm-toolbar-actions">
          <p className="adm-count"><b>{msgs ? list.length : "…"}</b> ta xabar</p>
          <button type="button" className="adm-btn is-sm" onClick={readAll} disabled={busy || !unread}><Icon name="check" size={15} />Hammasini o‘qilgan qilish</button>
          <button type="button" className="adm-btn is-sm" onClick={exportCsv} disabled={busy}><Icon name="download" size={15} />CSV eksport</button>
          <button type="button" className="adm-btn is-sm" onClick={() => setTick((v) => v + 1)} disabled={busy}><Icon name="refresh" size={15} />Yangilash</button>
        </div>
      </div>

      {!msgs ? (
        <div className="adm-skels">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={84} r={18} />)}</div>
      ) : list.length === 0 ? (
        <div className="adm-card adm-empty"><Icon name="inbox" size={30} /><h3>{msgs.length ? "Hech narsa topilmadi" : "Hali xabar yo‘q"}</h3><p>{msgs.length ? "Filtr yoki qidiruvni o‘zgartirib ko‘ring." : "Foydalanuvchilar “Aloqa” sahifasidan yozganda xabarlar shu yerda paydo bo‘ladi."}</p></div>
      ) : (
        <ul className="adm-rows">
          <AnimatePresence initial={false}>
            {list.map((m) => {
              const isOpen = open === m.id;
              const [mailLabel, mailTone] = MAIL[m.emailStatus] ?? [m.emailStatus || "—", ""];
              return (
                <motion.li key={m.id} className={`adm-msg ${m.read ? "" : "is-new"} ${isOpen ? "is-open" : ""}`} layout="position" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                  <button type="button" className="adm-msg-head" onClick={() => toggleOpen(m)} aria-expanded={isOpen}>
                    <span className="adm-ava" style={{ background: avatarColor(m.email) }}>{(m.name || m.email || "?").slice(0, 1).toUpperCase()}</span>
                    <div className="adm-msg-main"><b>{m.name || m.email}{!m.read && <em className="adm-dot" aria-label="o‘qilmagan" />}</b><small>{m.email}</small><p>{m.message}</p></div>
                    <time title={fmtDateTime(m.createdAt)}>{timeAgo(m.createdAt)}</time>
                    <Icon name="chevronDown" size={18} className="adm-msg-chev" />
                  </button>
                  {isOpen && (
                    <div className="adm-msg-body">
                      <p className="adm-msg-text">{m.message}</p>
                      <dl className="adm-msg-meta">
                        <div><dt>Yuborilgan</dt><dd>{fmtDateTime(m.createdAt)}</dd></div>
                        {m.page && <div><dt>Sahifa</dt><dd>{m.page}</dd></div>}
                        {m.lang && <div><dt>Til</dt><dd>{m.lang}</dd></div>}
                        {m.viewport && <div><dt>Ekran</dt><dd>{m.viewport}</dd></div>}
                        {m.userAgent && <div className="is-wide"><dt>Brauzer</dt><dd>{m.userAgent}</dd></div>}
                        <div><dt>Email</dt><dd><i className={`adm-badge ${mailTone ? `is-${mailTone}` : ""}`}>{mailLabel}</i></dd></div>
                        <div><dt>Akkaunt</dt><dd>{m.userId ? "ro‘yxatdan o‘tgan" : "mehmon"}</dd></div>
                      </dl>
                      <div className="adm-msg-act">
                        <a className="adm-btn is-primary is-sm" href={reply(m)}><Icon name="reply" size={15} />Javob yozish</a>
                        <button type="button" className="adm-btn is-sm" disabled={busy} onClick={() => setRead(m, !m.read)}>{m.read ? "O‘qilmagan qilish" : "O‘qilgan qilish"}</button>
                        <button type="button" className="adm-btn is-sm is-danger" disabled={busy} onClick={() => setDel(m)}><Icon name="trash" size={15} />O‘chirish</button>
                      </div>
                    </div>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      <ConfirmDialog open={Boolean(del)} danger busy={busy} title="Xabar o‘chirilsinmi?" text={del ? `${del.name} (${del.email}) yozgan xabar bazadan butunlay o‘chadi.` : ""} confirmLabel="O‘chirish" onConfirm={remove} onCancel={() => !busy && setDel(null)} />
    </section>
  );
}
