import { useRef, useState } from "react";
import useLogout from "../../hooks/useLogout";

import Field, { StrengthMeter } from "../../components/auth/Field";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useAuth } from "../../context/AuthContext";
import { useLang } from "../../context/LanguageContext";
import { supabase } from "../../lib/supabase";
import { authErrorKey, passwordStrength, withTimeout } from "../../lib/authUtils";
import { toast } from "../../lib/toast";
import Icon from "../../components/ui/Icon";

export default function Security() {
  const { t } = useLang();
  const { user, updatePassword } = useAuth();
  const logout = useLogout();
  const [pw, setPw] = useState(""), [confirm, setConfirm] = useState(""), [touched, setTouched] = useState(false);
  const [status, setStatus] = useState("idle"), [msg, setMsg] = useState("");
  const [dialog, setDialog] = useState(null); // "others" | "unlink:<id>"
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const s = passwordStrength(pw);
  const identities = user.identities ?? [];
  const providers = identities.map((i) => i.provider);
  const hasPassword = providers.includes("email");

  const change = async (e) => {
    e.preventDefault(); setTouched(true);
    if (!s.ok || pw !== confirm || lock.current) return;
    lock.current = true; setStatus("saving"); setMsg("");
    try { await withTimeout(updatePassword(pw)); setStatus("saved"); setPw(""); setConfirm(""); setTouched(false); toast(t("acc.pwChanged")); }
    catch (err) { setStatus("error"); setMsg(t(authErrorKey(err))); }
    finally { lock.current = false; }
  };

  const link = async () => {
    const { error } = await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo: `${window.location.origin}/account?tab=security` } });
    if (error) toast(t("acc.linkError"));
  };

  const confirmAction = async () => {
    setBusy(true);
    try {
      if (dialog === "others") { const { error } = await supabase.auth.signOut({ scope: "others" }); if (error) throw error; toast(t("acc.othersDone")); }
      else { const id = identities.find((i) => i.identity_id === dialog.split(":")[1]); const { error } = await supabase.auth.unlinkIdentity(id); if (error) throw error; toast(t("acc.unlinked")); }
    } catch { toast(t("acc.actionError")); }
    finally { setBusy(false); setDialog(null); }
  };

  return (
    <div className="nt-panel">
      <h2>{t("acc.secTitle")}</h2>
      <p className="nt-sub">{t("acc.secSub")}</p>

      <form onSubmit={change} noValidate>
        <Field label={t("acc.newPw")} password value={pw} onChange={(e) => setPw(e.target.value)} onBlur={() => setTouched(true)} error={touched && !s.ok ? t("auth.err.pwRules") : ""} autoComplete="new-password" />
        {pw && <StrengthMeter strength={s} />}
        <Field label={t("acc.repeatPw")} password value={confirm} onChange={(e) => setConfirm(e.target.value)} error={touched && confirm !== pw ? t("acc.errMatch") : ""} valid={confirm && confirm === pw} autoComplete="new-password" />
        {status === "error" && <p className="nt-alert is-err" role="alert">{msg}</p>}
        <button type="submit" className="nt-btn nt-btn-primary" disabled={status === "saving"}>{status === "saving" ? <span className="nt-spin" /> : status === "saved" ? <><Icon name="check" size={16} strokeWidth={2.4} /> {t("acc.pwChanged")}</> : t("acc.changePw")}</button>
      </form>

      <h3 className="nt-h3">{t("acc.connected")}</h3>
      <ul className="nt-list">
        <li><span className="nt-method"><Icon name="mail" size={16} /> {t("acc.method.email")}</span><b className={hasPassword ? "is-open" : ""}>{hasPassword ? t("acc.connectedOn") : t("acc.notSet")}</b></li>
        <li>
          <span className="nt-method"><b className="nt-g" aria-hidden="true">G</b> {t("acc.method.google")}</span>
          {providers.includes("google")
            ? <button type="button" className="nt-btn nt-btn-ghost" disabled={identities.length < 2} title={identities.length < 2 ? t("acc.lastMethod") : ""} onClick={() => setDialog(`unlink:${identities.find((i) => i.provider === "google").identity_id}`)}>{t("acc.disconnect")}</button>
            : <button type="button" className="nt-btn nt-btn-ghost" onClick={link}>{t("acc.connect")}</button>}
        </li>
      </ul>

      <h3 className="nt-h3">{t("acc.sessionTitle")}</h3>
      <p className="nt-sub">{t("acc.sessionSub")}</p>
      <div className="nt-row">
        <button type="button" className="nt-btn nt-btn-ghost" onClick={() => setDialog("others")}>{t("acc.signOutOthers")}</button>
        <button type="button" className="nt-btn nt-btn-danger" onClick={logout}>{t("nav.logout")}</button>
      </div>

      <ConfirmDialog open={Boolean(dialog)} busy={busy} title={dialog === "others" ? t("acc.signOutOthers") : t("acc.disconnect")} text={dialog === "others" ? t("acc.signOutOthersText") : t("acc.disconnectText")} confirmLabel={t("p.confirm")} danger onCancel={() => setDialog(null)} onConfirm={confirmAction} />
    </div>
  );
}
