import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import Navbar from "../components/layout/Navbar";
import Field, { StrengthMeter } from "../components/auth/Field";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { authErrorKey, passwordStrength, safeNext, validateEmail, validatePhone, withTimeout } from "../lib/authUtils";
import Icon from "../components/ui/Icon";

const EMPTY = { name: "", secondName: "", phone: "", email: "", password: "", confirm: "" };
const COOLDOWN = 60;

export default function Auth() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { isAuthenticated, loading: authLoading, signIn, signUp, signInWithGoogle, sendPasswordRecovery, resendConfirmation } = useAuth();
  const next = safeNext(params.get("next"));
  const mode = params.get("mode") === "signup" ? "signup" : params.get("mode") === "forgot" ? "forgot" : "login";

  const [f, setF] = useState(EMPTY);
  const [touched, setTouched] = useState({});
  const [status, setStatus] = useState("idle"); // idle | submitting | success | error
  const [msg, setMsg] = useState("");
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [shake, setShake] = useState(0);
  const lock = useRef(false);

  const setMode = (m) => { setParams((p) => { const n = new URLSearchParams(p); m === "login" ? n.delete("mode") : n.set("mode", m); return n; }, { replace: true }); setStatus("idle"); setMsg(""); setConfirmEmail(false); setTouched({}); };
  const upd = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const blur = (k) => () => setTouched((s) => ({ ...s, [k]: true }));

  useEffect(() => { if (isAuthenticated && status !== "success") navigate(next, { replace: true }); }, [isAuthenticated, navigate, next, status]);
  useEffect(() => { if (cooldown <= 0) return; const id = setTimeout(() => setCooldown((c) => c - 1), 1000); return () => clearTimeout(id); }, [cooldown]);

  const strength = passwordStrength(f.password);
  const errors = {
    name: mode === "signup" && !f.name.trim() ? t("acc.errName") : "",
    phone: mode === "signup" && !validatePhone(f.phone) ? t("acc.errPhone") : "",
    email: !validateEmail(f.email) ? t("auth.err.email") : "",
    password: mode === "forgot" ? "" : mode === "signup" ? (!strength.ok ? t("auth.err.pwRules") : "") : !f.password ? t("auth.err.pwRequired") : "",
    confirm: mode === "signup" && f.confirm !== f.password ? t("acc.errMatch") : "",
  };
  const show = (k) => (touched[k] ? errors[k] : "");
  const valid = (k) => touched[k] && !errors[k] && f[k] !== "";
  const hasErrors = Object.values(errors).some(Boolean);

  const run = async (fn) => {
    if (lock.current) return; // prevent duplicate submissions
    lock.current = true;
    setStatus("submitting"); setMsg("");
    try { await withTimeout(fn()); }
    catch (e) { setStatus("error"); setMsg(t(authErrorKey(e))); setShake((n) => n + 1); }
    finally { lock.current = false; }
  };

  const submit = (e) => {
    e.preventDefault();
    setTouched({ name: true, phone: true, email: true, password: true, confirm: true });
    if (hasErrors) { setShake((n) => n + 1); return; }
    const email = f.email.trim();
    if (mode === "login") return run(async () => { await signIn({ email, password: f.password }); setStatus("success"); setTimeout(() => navigate(next, { replace: true }), 700); });
    if (mode === "signup") return run(async () => {
      const data = await signUp({ name: f.name.trim(), secondName: f.secondName.trim(), phone: f.phone.trim(), email, password: f.password });
      if (data?.session) { setStatus("success"); setTimeout(() => navigate(next, { replace: true }), 700); }
      else { setStatus("success"); setConfirmEmail(true); setCooldown(COOLDOWN); }
    });
    return run(async () => { await sendPasswordRecovery(email); setStatus("success"); setMsg(t("auth.resetSent")); setCooldown(COOLDOWN); });
  };

  const google = () => run(async () => { await signInWithGoogle(next); });
  const resend = () => run(async () => { await resendConfirmation(f.email.trim()); setStatus("success"); setCooldown(COOLDOWN); });
  const busy = status === "submitting" || authLoading;

  return (
    <div className="nt-shell">
      <Navbar />
      <main className="nt-auth">
        <motion.aside className="nt-auth-side" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          <h2>{t("auth.sideTitle")}</h2>
          <p>{t("auth.sideText")}</p>
          <ul><li><Icon name="check" size={16} strokeWidth={2.4} /> {t("lock.perk1")}</li><li><Icon name="check" size={16} strokeWidth={2.4} /> {t("lock.perk2")}</li><li><Icon name="check" size={16} strokeWidth={2.4} /> {t("lock.perk3")}</li></ul>
        </motion.aside>

        <AnimatePresence mode="wait" initial={false}>
          <motion.section key={mode + confirmEmail} className="nt-auth-card" initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.28 }}>
            {confirmEmail ? (
              <div className="nt-auth-done">
                <motion.div className="nt-big" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}><Icon name="mail" size={46} strokeWidth={1.5} /></motion.div>
                <h1>{t("auth.checkEmail")}</h1>
                <p>{f.email}</p>
                <button type="button" className="nt-btn nt-btn-ghost" disabled={cooldown > 0 || busy} onClick={resend}>{cooldown > 0 ? t("auth.resendIn", { s: cooldown }) : t("auth.resend")}</button>
                {status === "error" && <p className="nt-alert is-err" role="alert">{msg}</p>}
              </div>
            ) : (
              <motion.form key={shake} animate={shake ? { x: [0, -9, 9, -5, 5, 0] } : {}} transition={{ duration: 0.4 }} onSubmit={submit} noValidate>
                <h1>{mode === "signup" ? t("auth.signupTitle") : mode === "forgot" ? t("auth.forgotTitle") : t("auth.loginTitle")}</h1>
                <p className="nt-sub">{mode === "signup" ? t("auth.signupSub") : mode === "forgot" ? t("auth.forgotSub") : t("auth.loginSub")}</p>

                {mode === "signup" && (
                  <div className="nt-two">
                    <Field label={t("auth.firstName")} placeholder={t("auth.firstNamePh")} value={f.name} onChange={upd("name")} onBlur={blur("name")} error={show("name")} valid={valid("name")} autoComplete="given-name" />
                    <Field label={t("auth.lastName")} placeholder={t("auth.lastNamePh")} value={f.secondName} onChange={upd("secondName")} onBlur={blur("secondName")} autoComplete="family-name" />
                  </div>
                )}
                {mode === "signup" && <Field label={t("auth.phone")} type="tel" placeholder="+998 90 123 45 67" value={f.phone} onChange={upd("phone")} onBlur={blur("phone")} error={show("phone")} valid={valid("phone")} autoComplete="tel" />}
                <Field label={t("auth.email")} type="email" value={f.email} onChange={upd("email")} onBlur={blur("email")} error={show("email")} valid={valid("email")} autoComplete="email" inputMode="email" />
                {mode !== "forgot" && (
                  <Field label={t("auth.password")} password placeholder={t("auth.passwordPh")} value={f.password} onChange={upd("password")} onBlur={blur("password")} error={mode === "signup" ? "" : show("password")} valid={mode === "signup" ? false : valid("password")} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
                )}
                {mode === "signup" && f.password && <StrengthMeter strength={strength} />}
                {mode === "signup" && <Field label={t("acc.repeatPw")} password value={f.confirm} onChange={upd("confirm")} onBlur={blur("confirm")} error={show("confirm")} valid={valid("confirm")} autoComplete="new-password" />}

                {mode === "login" && <button type="button" className="nt-link nt-forgot" onClick={() => setMode("forgot")}>{t("auth.forgot")}</button>}

                <AnimatePresence>
                  {status === "error" && msg && <motion.p className="nt-alert is-err" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>{msg}</motion.p>}
                  {status === "success" && <motion.p className="nt-alert is-ok" role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{msg || t("auth.signedInOk")}</motion.p>}
                </AnimatePresence>

                <motion.button type="submit" className="nt-btn nt-btn-primary nt-block" disabled={busy || (mode === "forgot" && cooldown > 0)} whileTap={{ scale: 0.97 }}>
                  {busy ? <span className="nt-spin" aria-label={t("auth.wait")} /> : mode === "signup" ? t("auth.createAccount") : mode === "forgot" ? (cooldown > 0 ? t("auth.resendIn", { s: cooldown }) : t("auth.sendReset")) : t("auth.signIn")}
                </motion.button>

                {mode !== "forgot" && (
                  <>
                    <div className="nt-or"><span>{t("auth.or")}</span></div>
                    <button type="button" className="nt-btn nt-btn-ghost nt-block nt-google" onClick={google} disabled={busy}>
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M23 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.4Z"/><path fill="#34A853" d="M12 23.5c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.400-4.700H1.800v3A11.500 11.500 0 0 0 12 23.500Z"/><path fill="#FBBC05" d="M5.600 14.200a6.900 6.900 0 0 1 0-4.400v-3H1.800a11.500 11.500 0 0 0 0 10.400l3.800-3Z"/><path fill="#EA4335" d="M12 5.400c1.700 0 3.200.6 4.400 1.700l3.300-3.300A11.500 11.500 0 0 0 1.800 6.800l3.800 3C6.500 7.400 9 5.400 12 5.400Z"/></svg>
                      {t("auth.google")}
                    </button>
                  </>
                )}

                <p className="nt-switch">
                  {mode === "login" ? <>{t("auth.noAccount")} <button type="button" className="nt-link" onClick={() => setMode("signup")}>{t("auth.createAccount")}</button></>
                    : <>{mode === "signup" ? t("auth.haveAccount") : ""} <button type="button" className="nt-link" onClick={() => setMode("login")}>{t("auth.signIn")}</button></>}
                </p>
                <Link to="/" className="nt-link nt-back"><Icon name="arrowLeft" size={15} /> {t("auth.goHome")}</Link>
              </motion.form>
            )}
          </motion.section>
        </AnimatePresence>
      </main>
    </div>
  );
}
