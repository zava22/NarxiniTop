import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import Navbar from "../components/layout/Navbar";
import Field, { StrengthMeter } from "../components/auth/Field";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { authErrorKey, passwordStrength, withTimeout } from "../lib/authUtils";
import Icon from "../components/ui/Icon";

/* Landing page of the password-reset e-mail link (/reset-password). */
export default function ResetPassword() {
  const { t } = useLang();
  const navigate = useNavigate();
  const { user, loading, recovery, updatePassword, signOut } = useAuth();
  const [pw, setPw] = useState(""), [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState("idle"), [msg, setMsg] = useState("");
  const lock = useRef(false);
  const [waited, setWaited] = useState(false);
  const strength = passwordStrength(pw);

  useEffect(() => { const id = setTimeout(() => setWaited(true), 4000); return () => clearTimeout(id); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (!strength.ok || pw !== confirm || lock.current) return;
    lock.current = true; setStatus("submitting"); setMsg("");
    try {
      await withTimeout(updatePassword(pw));
      setStatus("success");
      await signOut().catch(() => {});
      setTimeout(() => navigate("/auth", { replace: true }), 1800);
    } catch (err) { setStatus("error"); setMsg(t(authErrorKey(err))); }
    finally { lock.current = false; }
  };

  const ready = user && (recovery || true);
  return (
    <div className="nt-shell">
      <Navbar />
      <main className="nt-auth nt-auth-single">
        <motion.section className="nt-auth-card" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
          {loading || (!ready && !waited) ? <div className="nt-state"><span className="nt-spin" /></div>
            : !ready ? (
              <div className="nt-auth-done"><div className="nt-big"><Icon name="clock" size={46} strokeWidth={1.5} /></div><h1>{t("auth.err.expired")}</h1><Link to="/auth?mode=forgot" className="nt-btn nt-btn-primary">{t("auth.sendReset")}</Link></div>
            ) : status === "success" ? (
              <div className="nt-auth-done"><motion.div className="nt-big" initial={{ scale: 0 }} animate={{ scale: 1 }}><Icon name="checkCircle" size={46} strokeWidth={1.5} /></motion.div><h1>{t("acc.pwChanged")}</h1><p>{t("auth.redirecting")}</p></div>
            ) : (
              <form onSubmit={submit} noValidate>
                <h1>{t("auth.newPasswordTitle")}</h1>
                <Field label={t("acc.newPw")} password value={pw} onChange={(e) => setPw(e.target.value)} onBlur={() => setTouched(true)} error={touched && !strength.ok ? t("auth.err.pwRules") : ""} autoComplete="new-password" />
                {pw && <StrengthMeter strength={strength} />}
                <Field label={t("acc.repeatPw")} password value={confirm} onChange={(e) => setConfirm(e.target.value)} error={touched && confirm !== pw ? t("acc.errMatch") : ""} valid={confirm && confirm === pw} autoComplete="new-password" />
                {status === "error" && <p className="nt-alert is-err" role="alert">{msg}</p>}
                <button type="submit" className="nt-btn nt-btn-primary nt-block" disabled={status === "submitting"}>{status === "submitting" ? <span className="nt-spin" /> : t("acc.changePw")}</button>
              </form>
            )}
        </motion.section>
      </main>
    </div>
  );
}
