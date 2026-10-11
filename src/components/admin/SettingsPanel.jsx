import { useEffect, useState } from "react";
import Icon from "../ui/Icon";
import ConfirmDialog from "../ui/ConfirmDialog";
import { toast } from "../../lib/toast";
import { adminApi } from "../../services/admin";
import { ACCENTS } from "./themes";

const SHORTCUTS = [["N", "Yangi mahsulot"], ["/", "Qidiruvga o‘tish"], ["1 – 6", "Bo‘limlar orasida o‘tish"], ["Ctrl + S", "Muharrirda saqlash"], ["Esc", "Oynani yopish"]];

function Seg({ label, value, options, onChange }) {
  return (
    <div className="adm-set-row">
      <span>{label}</span>
      <div className="adm-seg" role="radiogroup" aria-label={label}>
        {options.map(([k, text]) => <button key={k} type="button" role="radio" aria-checked={value === k} className={value === k ? "is-on" : ""} onClick={() => onChange(k)}>{text}</button>)}
      </div>
    </div>
  );
}

function Switch({ label, hint, checked, onChange }) {
  return (
    <label className="adm-set-row adm-set-switch">
      <span>{label}{hint && <small>{hint}</small>}</span>
      <span className="adm-toggle"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><i /></span>
    </label>
  );
}

export default function SettingsPanel({ prefs, set, reset, isDark, toggleTheme, health, recheck, onChanged }) {
  const [me, setMe] = useState(null);
  const [busy, setBusy] = useState(false);
  const [force, setForce] = useState(false);

  useEffect(() => {
    let off = false;
    adminApi.me().then((r) => { if (!off) setMe(r); }).catch(() => { if (!off) setMe(null); });
    return () => { off = true; };
  }, []);

  const act = async (fn) => { setBusy(true); try { await fn(); } catch (e) { toast(e.message); } finally { setBusy(false); } };
  const seed = (overwrite) => act(async () => {
    const r = await adminApi.seed(overwrite);
    toast(overwrite ? `${r.total} ta mahsulot products.json dan qayta yuklandi` : r.productsAdded ? `${r.productsAdded} ta yangi mahsulot qo‘shildi` : "products.json dagi hamma narsa allaqachon bazada");
    setForce(false);
    onChanged();
  });
  const importUsers = () => act(async () => { const n = await adminApi.importUsers(); toast(n ? `${n} ta foydalanuvchi import qilindi` : "Yangi foydalanuvchi topilmadi"); onChanged(); });
  const exp = (what) => act(async () => { toast(`${await adminApi.download(what)} yuklab olindi`); });

  const stateText = { ok: "Ishlayapti", checking: "Tekshirilmoqda…", stale: "Eski versiya — qayta ishga tushiring", offline: "Server o‘chiq", db: "MongoDB ulanmagan" }[health.state];

  return (
    <div className="adm-settings">
      <section className="adm-card">
        <header className="adm-card-head"><h3><Icon name="palette" size={18} />Ko‘rinish</h3></header>
        <div className="adm-set-list">
          <Seg label="Sayt mavzusi" value={isDark ? "dark" : "light"} options={[["light", "Yorug‘"], ["dark", "Qorong‘i"]]} onChange={(k) => { if ((k === "dark") !== isDark) toggleTheme(); }} />
          <div className="adm-set-row is-stack">
            <span>Aksent rang</span>
            <div className="adm-swatches" role="radiogroup" aria-label="Aksent rang">
              {ACCENTS.map((a) => (
                <button key={a.id} type="button" role="radio" aria-checked={prefs.accent === a.id} className={prefs.accent === a.id ? "is-on" : ""} onClick={() => set({ accent: a.id })} title={a.label}>
                  <i style={{ background: a.swatch }} />{a.label}
                </button>
              ))}
            </div>
          </div>
          <Seg label="Burchaklar" value={prefs.corners} options={[["round", "Yumaloq"], ["soft", "Yumshoq"], ["sharp", "To‘g‘ri"]]} onChange={(k) => set({ corners: k })} />
          <Seg label="Zichlik" value={prefs.density} options={[["comfy", "Keng"], ["compact", "Ixcham"]]} onChange={(k) => set({ density: k })} />
          <Seg label="Mahsulotlar ko‘rinishi" value={prefs.view} options={[["list", "Ro‘yxat"], ["grid", "Kartochkalar"]]} onChange={(k) => set({ view: k })} />
          <Seg label="Yon panel" value={prefs.sidebar} options={[["full", "To‘liq"], ["mini", "Ixcham"]]} onChange={(k) => set({ sidebar: k })} />
          <Switch label="Xush kelibsiz bannerini ko‘rsatish" checked={prefs.hero} onChange={(v) => set({ hero: v })} />
          <Switch label="Animatsiyalar" hint="O‘chirsangiz panel tezroq va tinchroq ishlaydi" checked={prefs.motion} onChange={(v) => set({ motion: v })} />
          <Switch label="Ro‘yxatlarda mahsulot rasmlarini yuklash" hint="O‘chirsangiz tashqi rasmlar so‘ralmaydi (konsolda 404 chiqmaydi)" checked={prefs.thumbs} onChange={(v) => set({ thumbs: v })} />
        </div>
        <button type="button" className="adm-btn is-sm adm-set-reset" onClick={() => { reset(); toast("Sozlamalar asl holiga qaytarildi"); }}><Icon name="refresh" size={15} />Asl holiga qaytarish</button>
      </section>

      <section className="adm-card">
        <header className="adm-card-head"><h3><Icon name="database" size={18} />Ma’lumotlar</h3></header>
        <div className="adm-tools">
          <button type="button" className="adm-btn" disabled={busy} onClick={() => seed(false)}><Icon name="download" size={16} />products.json — yetishmayotganlarini qo‘shish</button>
          <button type="button" className="adm-btn is-danger" disabled={busy} onClick={() => setForce(true)}><Icon name="refresh" size={16} />products.json — hammasini qayta yuklash</button>
          <button type="button" className="adm-btn" disabled={busy} onClick={importUsers}><Icon name="user" size={16} />Foydalanuvchilarni Supabase’dan import</button>
          <button type="button" className="adm-btn" disabled={busy} onClick={() => exp("products")}><Icon name="download" size={16} />Mahsulotlar CSV</button>
          <button type="button" className="adm-btn" disabled={busy} onClick={() => exp("users")}><Icon name="download" size={16} />Foydalanuvchilar CSV</button>
          <button type="button" className="adm-btn" disabled={busy} onClick={() => exp("messages")}><Icon name="download" size={16} />Xabarlar CSV</button>
        </div>
      </section>

      <section className="adm-card">
        <header className="adm-card-head"><h3><Icon name="server" size={18} />Tizim</h3><button type="button" className="adm-link" onClick={recheck}>Tekshirish<Icon name="refresh" size={14} /></button></header>
        <dl className="adm-sys">
          <div><dt>Server</dt><dd><i className={`adm-led is-${health.state}`} />{stateText}</dd></div>
          <div><dt>Baza</dt><dd>{me?.database || health.database || "—"}</dd></div>
          <div><dt>Admin API</dt><dd>v{me?.version ?? health.version ?? "?"}</dd></div>
          <div><dt>Kirgan admin</dt><dd>{me?.email ?? "—"}</dd></div>
        </dl>
      </section>

      <section className="adm-card">
        <header className="adm-card-head"><h3><Icon name="keyboard" size={18} />Tezkor tugmalar</h3></header>
        <ul className="adm-keys">{SHORTCUTS.map(([k, t]) => <li key={k}><kbd>{k}</kbd><span>{t}</span></li>)}</ul>
      </section>

      <ConfirmDialog open={force} danger busy={busy} title="Hammasi qayta yuklansinmi?" text="products.json dagi har bir mahsulot va narx bazaga qayta yoziladi. Shu mahsulotlar uchun admin panelda qilgan tahrirlaringiz yo‘qoladi." confirmLabel="Qayta yuklash" onConfirm={() => seed(true)} onCancel={() => !busy && setForce(false)} />
    </div>
  );
}
