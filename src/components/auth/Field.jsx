import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLang } from "../../context/LanguageContext";
import Icon from "../ui/Icon";

/* Animated input: status icon, inline error, optional show/hide for passwords. */
export default function Field({ label, error, valid, type = "text", password = false, hint, children, ...props }) {
  const { t } = useLang();
  const id = useId();
  const [show, setShow] = useState(false);
  const state = error ? "is-error" : valid ? "is-valid" : "";
  return (
    <div className={`nt-field ${state}`}>
      <label htmlFor={id}>{label}</label>
      <div className="nt-input">
        <input id={id} type={password && show ? "text" : type} aria-invalid={Boolean(error)} aria-describedby={`${id}-m`} {...props} />
        {password && <button type="button" className="nt-eye" onClick={() => setShow((v) => !v)} aria-label={show ? t("acc.hide") : t("acc.show")} aria-pressed={show}><Icon name={show ? "eyeOff" : "eye"} size={18} /></button>}
        <AnimatePresence>{valid && !error && <motion.span className="nt-ok" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Icon name="check" size={16} strokeWidth={2.6} /></motion.span>}</AnimatePresence>
      </div>
      <div id={`${id}-m`} className="nt-msg">
        <AnimatePresence mode="wait" initial={false}>
          {error ? <motion.span key="e" className="is-err" initial={{ opacity: 0, y: -4, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, height: 0 }} role="alert">{error}</motion.span>
            : hint ? <motion.span key="h" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{hint}</motion.span> : null}
        </AnimatePresence>
      </div>
      {children}
    </div>
  );
}

export function StrengthMeter({ strength }) {
  const { t } = useLang();
  const { score, rules } = strength;
  return (
    <div className="nt-strength" aria-live="polite">
      <div className="nt-bars">{[1, 2, 3, 4].map((i) => <motion.i key={i} className={score >= i ? `on s${score}` : ""} layout animate={{ scaleY: score >= i ? 1 : 0.6 }} />)}</div>
      <span>{t(`acc.strength${score}`)}</span>
      <ul>
        <li className={rules.len ? "ok" : ""}><Icon name={rules.len ? "check" : "minus"} size={13} strokeWidth={2.4} /> {t("acc.rule8")}</li>
        <li className={rules.case ? "ok" : ""}><Icon name={rules.case ? "check" : "minus"} size={13} strokeWidth={2.4} /> {t("acc.ruleCase")}</li>
        <li className={rules.num ? "ok" : ""}><Icon name={rules.num ? "check" : "minus"} size={13} strokeWidth={2.4} /> {t("acc.ruleNum")}</li>
      </ul>
    </div>
  );
}
