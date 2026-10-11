import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import Field from "../../components/auth/Field";
import Avatar from "../../components/ui/Avatar";
import { useAuth } from "../../context/AuthContext";
import { useLang } from "../../context/LanguageContext";
import { validatePhone, withTimeout } from "../../lib/authUtils";
import { toast } from "../../lib/toast";
import Icon from "../../components/ui/Icon";

const COLORS = ["#e11d48", "#ff4d6d", "#f472b6", "#a78bfa", "#60a5fa", "#34d399", "#fbbf24", "#fb923c"];

const formatPhone = (raw) => {
  const d = raw.replace(/\D/g, "").replace(/^998/, "").slice(0, 9);
  const p = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return d ? `+998 ${p.join(" ")}` : "";
};

const toDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

/* Downscale to 256px JPEG before upload (privacy + bandwidth). */
function resize(file, size = 256) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(img.width, img.height), c = document.createElement("canvas");
      c.width = c.height = size;
      c.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("resize"))), "image/jpeg", 0.88);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("image")); };
    img.src = url;
  });
}

export default function Profile() {
  const { t } = useLang();
  const { user, updateProfile, avatar, saveAvatar, removeAvatar: deleteAvatar } = useAuth();
  const m = user.user_metadata ?? {};
  const initial = useMemo(() => ({ name: m.name ?? m.full_name?.split(" ")[0] ?? "", second_name: m.second_name ?? "", phone: m.phone ?? "", avatar_color: m.avatar_color ?? COLORS[0] }), [m]);
  const [form, setForm] = useState(initial);
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | saving | saved | error
  const [avatarBusy, setAvatarBusy] = useState(false);
  const file = useRef(null);
  const lock = useRef(false);

  const dirty = Object.keys(initial).some((k) => (form[k] ?? "") !== (initial[k] ?? ""));
  const errors = { name: !form.name.trim() ? t("acc.errName") : "", phone: !validatePhone(form.phone) ? t("acc.errPhone") : "" };

  const save = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (errors.name || errors.phone || lock.current) return;
    lock.current = true; setStatus("saving");
    try { await withTimeout(updateProfile({ name: form.name.trim(), second_name: form.second_name.trim(), phone: form.phone.trim(), avatar_color: form.avatar_color })); setStatus("saved"); toast(t("acc.saved")); setTimeout(() => setStatus("idle"), 2500); }
    catch { setStatus("error"); }
    finally { lock.current = false; }
  };

  /* The photo is stored in MongoDB (server/avatar.js), so it is there again after every sign-in. */
  const upload = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/") || f.size > 8 * 1024 * 1024) return toast(t("acc.avatarBad"));
    setAvatarBusy(true);
    try {
      const dataUrl = await toDataUrl(await resize(f));
      await saveAvatar(dataUrl);
      toast(t("acc.avatarSaved"));
    } catch { toast(t("acc.avatarError")); }
    finally { setAvatarBusy(false); }
  };
  const removeAvatar = async () => {
    setAvatarBusy(true);
    try {
      await deleteAvatar();
      if (m.avatar_url) await updateProfile({ avatar_url: null }); // e.g. a Google picture
      toast(t("acc.avatarRemoved"));
    } catch { toast(t("acc.avatarError")); } finally { setAvatarBusy(false); }
  };

  return (
    <form className="nt-panel" onSubmit={save} noValidate>
      <h2>{t("acc.profileTitle")}</h2>
      <p className="nt-sub">{t("acc.profileSub")}</p>

      <div className="nt-avatar-row">
        <button type="button" className="nt-avatar-pick" onClick={() => file.current?.click()} disabled={avatarBusy} aria-label={t("acc.avatarUpload")}>
          <Avatar size={96} />
          <span className="nt-avatar-cam" aria-hidden="true">{avatarBusy ? <span className="nt-spin" /> : <Icon name="plus" size={18} strokeWidth={2.6} />}</span>
        </button>
        <div>
          <div className="nt-row">
            <button type="button" className="nt-btn nt-btn-ghost" disabled={avatarBusy} onClick={() => file.current?.click()}>{avatarBusy ? "…" : t("acc.avatarUpload")}</button>
            {(avatar || m.avatar_url) && <button type="button" className="nt-btn nt-btn-ghost" disabled={avatarBusy} onClick={removeAvatar}>{t("acc.avatarRemove")}</button>}
          </div>
          <input ref={file} type="file" accept="image/*" hidden onChange={upload} />
          <div className="nt-swatches" role="radiogroup" aria-label={t("acc.color")}>
            {COLORS.map((c) => <button key={c} type="button" role="radio" aria-checked={form.avatar_color === c} className={form.avatar_color === c ? "is-on" : ""} style={{ background: c }} aria-label={c} onClick={() => setForm((f) => ({ ...f, avatar_color: c }))} />)}
          </div>
        </div>
      </div>

      <div className="nt-two">
        <Field label={t("acc.name")} value={form.name} error={touched ? errors.name : ""} valid={touched && !errors.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoComplete="given-name" />
        <Field label={t("acc.secondName")} value={form.second_name} onChange={(e) => setForm((f) => ({ ...f, second_name: e.target.value }))} autoComplete="family-name" />
      </div>
      <Field label={t("acc.phone")} type="tel" value={form.phone} error={touched ? errors.phone : ""} onChange={(e) => setForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))} autoComplete="tel" />
      <Field label={t("auth.email")} value={user.email ?? ""} readOnly disabled hint={user.email_confirmed_at ? t("acc.verified") : t("acc.unverified")} />

      <AnimatePresence>
        {status === "error" && <motion.p className="nt-alert is-err" role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{t("acc.saveError")}</motion.p>}
      </AnimatePresence>
      <div className="nt-row">
        <button type="submit" className="nt-btn nt-btn-primary" disabled={!dirty || status === "saving"}>{status === "saving" ? <span className="nt-spin" /> : status === "saved" ? <><Icon name="check" size={16} strokeWidth={2.4} /> {t("acc.saved")}</> : t("acc.save")}</button>
        {dirty && <button type="button" className="nt-btn nt-btn-ghost" onClick={() => { setForm(initial); setTouched(false); }}>{t("acc.reset")}</button>}
        {dirty && <span className="nt-note">{t("acc.unsaved")}</span>}
      </div>
    </form>
  );
}
