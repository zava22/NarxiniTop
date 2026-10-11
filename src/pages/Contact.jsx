import { useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import PageShell from "../components/layout/PageShell";
import Icon from "../components/ui/Icon";
import Avatar from "../components/ui/Avatar";
import Field from "../components/auth/Field";

import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { toast } from "../lib/toast";
import { validateEmail } from "../lib/authUtils";

const SUPPORT_EMAIL = "info@narxtop.uz";
const MIN = 10;
const MAX = 3000;

const WHEN = [
  ["bug", "bug"],
  ["price", "tag"],
  ["account", "user"],
  ["idea", "lightbulb"],
];
const TIPS = [1, 2, 3, 4, 5];
const FAQ = [1, 2, 3, 4];

/* The full name of the signed-in account (Google / sign-up metadata), for display only.
 * The server re-reads it from the verified token, so this is never trusted for delivery. */
function fullName(user, fallback) {
  const m = user?.user_metadata || {};
  return m.full_name || m.name || [m.given_name, m.family_name].filter(Boolean).join(" ") || fallback;
}

function errText(code, t) {
  switch (code) {
    case "rate": return t("contact.err.rate");
    case "network": return t("contact.err.network");
    case "auth": return t("contact.err.session");
    default: return t("contact.err.send");
  }
}

export default function Contact() {
  const { t } = useLang();
  const { user, session, isAuthenticated, displayName, loading } = useAuth();
  const msgId = useId();
  const area = useRef(null);

  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot, must stay empty
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState(null);

  const accountEmail = user?.email ?? "";
  const accountName = fullName(user, displayName);
  const len = message.trim().length;

  const errors = useMemo(() => {
    const e = {};
    if (len < MIN) e.message = t("contact.err.short", { n: MIN });
    else if (len > MAX) e.message = t("contact.err.long", { max: MAX });
    if (!isAuthenticated) {
      if (!name.trim()) e.name = t("contact.err.name");
      if (!validateEmail(email)) e.email = t("contact.err.email");
    }
    return e;
  }, [len, name, email, isAuthenticated, t]);

  const submit = async (ev) => {
    ev.preventDefault();
    setTouched(true);
    setError("");
    if (Object.keys(errors).length) {
      if (errors.message) area.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({
          message: message.trim(),
          // Signed-in users send ONLY the message: identity comes from their account on the server.
          ...(isAuthenticated ? {} : { name: name.trim(), email: email.trim() }),
          website,
          meta: {
            page: document.referrer && new URL(document.referrer).origin === window.location.origin ? new URL(document.referrer).pathname : "",
            lang: document.documentElement.lang || "",
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            userAgent: navigator.userAgent,
          },
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        setError(res.status === 501 ? t("contact.err.config", { email: SUPPORT_EMAIL }) : errText(body.code || (res.status === 429 ? "rate" : ""), t));
        return;
      }
      setSentTo(body.email || accountEmail || email.trim());
      setMessage("");
      setTouched(false);
      toast(t("contact.ok.toast"), { confetti: true });
    } catch {
      setError(errText(navigator.onLine === false ? "network" : "", t));
    } finally {
      setBusy(false);
    }
  };

  const again = () => { setSentTo(null); setTimeout(() => area.current?.focus(), 50); };

  return (
    <PageShell>
      <div className="ct">
        {/* ------------------------------ hero ------------------------------ */}
        <section className="ct-hero nt-glass">
          <i className="nt-hero-orb nt-hero-orb-a" aria-hidden="true" />
          <i className="nt-hero-orb nt-hero-orb-b" aria-hidden="true" />
          <span className="nt-eyebrow">{t("contact.eyebrow")}</span>
          <h1>{t("contact.title")}</h1>
          <p>{t("contact.sub")}</p>
          <ul className="ct-chips" aria-hidden="true">
            <li><Icon name="bug" size={15} />{t("contact.chip.bug")}</li>
            <li><Icon name="lightbulb" size={15} />{t("contact.chip.idea")}</li>
            <li><Icon name="info" size={15} />{t("contact.chip.help")}</li>
          </ul>
        </section>

        <div className="ct-grid">
          {/* ------------------------------ form ------------------------------ */}
          <section className="ct-form nt-glass" aria-labelledby={`${msgId}-h`}>
            <AnimatePresence mode="wait" initial={false}>
              {sentTo ? (
                <motion.div key="ok" className="ct-done" role="status" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                  <span className="ct-done-ico"><Icon name="checkCircle" size={34} /></span>
                  <h2>{t("contact.ok.title")}</h2>
                  <p>{t("contact.ok.sub", { email: sentTo })}</p>
                  <div className="ct-done-actions">
                    <button type="button" className="nt-btn nt-btn-primary" onClick={again}><Icon name="send" size={17} />{t("contact.ok.again")}</button>
                    <Link to="/" className="nt-btn nt-btn-ghost">{t("contact.ok.home")}</Link>
                  </div>
                </motion.div>
              ) : (
                <motion.form key="form" onSubmit={submit} noValidate initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <h2 id={`${msgId}-h`}>{t("contact.form.title")}</h2>
                  <p className="ct-lead">{t("contact.form.sub")}</p>

                  {/* who is writing */}
                  {isAuthenticated ? (
                    <div className="ct-as" aria-live="polite">
                      <Avatar size={42} />
                      <div>
                        <small>{t("contact.form.sentAs")}</small>
                        <b>{accountName}</b>
                        <span>{accountEmail}</span>
                      </div>
                      <em>{t("contact.form.sentAsHint")}</em>
                    </div>
                  ) : !loading && (
                    <div className="ct-guest">
                      <p className="ct-guest-note"><Icon name="info" size={16} />{t("contact.form.guestNote")}</p>
                      <div className="nt-two">
                        <Field label={t("contact.form.name")} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} error={touched ? errors.name : ""} valid={Boolean(name.trim())} />
                        <Field label={t("contact.form.email")} type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} error={touched ? errors.email : ""} valid={validateEmail(email)} />
                      </div>
                      <Link to="/auth?next=/contact" className="nt-link ct-guest-login">{t("contact.form.guestLogin")}<Icon name="arrowRight" size={15} /></Link>
                    </div>
                  )}

                  {/* honeypot (hidden from people and screen readers) */}
                  <div className="ct-hp" aria-hidden="true">
                    <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
                  </div>

                  {/* the big message box */}
                  <div className={`ct-box ${touched && errors.message ? "is-error" : ""}`}>
                    <label htmlFor={msgId}>{t("contact.form.label")}</label>
                    <textarea
                      id={msgId}
                      ref={area}
                      rows={10}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={t("contact.form.placeholder")}
                      maxLength={MAX + 200}
                      aria-invalid={Boolean(touched && errors.message)}
                      aria-describedby={`${msgId}-m`}
                    />
                    <div id={`${msgId}-m`} className="ct-meta">
                      <span className="ct-err" role="alert">{touched && errors.message ? errors.message : ""}</span>
                      <span className={`ct-count ${len > MAX ? "is-over" : ""}`}>{t("contact.form.count", { n: len, max: MAX })}</span>
                    </div>
                  </div>

                  {error && <div className="ct-fail" role="alert"><Icon name="alert" size={17} />{error}</div>}

                  <div className="ct-submit">
                    <p><Icon name="shield" size={15} />{t("contact.form.auto")}</p>
                    <button type="submit" className="nt-btn nt-btn-primary ct-send" disabled={busy}>
                      {busy ? <><span className="nt-spin" aria-hidden="true" />{t("contact.form.sending")}</> : <><Icon name="send" size={17} />{t("contact.form.send")}</>}
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </section>

          {/* ------------------------------ side ------------------------------ */}
          <aside className="ct-side">
            <section className="ct-card nt-glass">
              <h3><Icon name="lightbulb" size={18} />{t("contact.tips.title")}</h3>
              <ol className="ct-tips">
                {TIPS.map((n) => <li key={n}>{t(`contact.tips.${n}`)}</li>)}
              </ol>
            </section>

            <section className="ct-card nt-glass">
              <h3><Icon name="mail" size={18} />{t("contact.info.title")}</h3>
              <dl className="ct-info">
                <div><dt>{t("contact.info.email")}</dt><dd><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></dd></div>
                <div><dt>{t("contact.info.reply")}</dt><dd>{t("contact.info.replyV")}</dd></div>
                <div><dt>{t("contact.info.lang")}</dt><dd>{t("contact.info.langV")}</dd></div>
                <div><dt>{t("contact.info.privacy")}</dt><dd>{t("contact.info.privacyV")}</dd></div>
              </dl>
            </section>
          </aside>
        </div>

        {/* ------------------------- when to write -------------------------- */}
        <section className="ct-when" aria-labelledby={`${msgId}-w`}>
          <div className="ct-head">
            <h2 id={`${msgId}-w`}>{t("contact.when.title")}</h2>
            <p>{t("contact.when.sub")}</p>
          </div>
          <ul>
            {WHEN.map(([key, icon]) => (
              <li key={key} className="nt-glass">
                <span className="ct-ico"><Icon name={icon} size={22} /></span>
                <h3>{t(`contact.when.${key}.t`)}</h3>
                <p>{t(`contact.when.${key}.d`)}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* -------------------------------- faq ----------------------------- */}
        <section className="ct-faq" aria-label={t("contact.faq.title")}>
          <div className="ct-head"><h2>{t("contact.faq.title")}</h2></div>
          <div className="ct-faq-list nt-glass">
            {FAQ.map((n) => (
              <details key={n}>
                <summary>{t(`contact.faq.${n}.q`)}<Icon name="chevronDown" size={18} /></summary>
                <p>{t(`contact.faq.${n}.a`)}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
