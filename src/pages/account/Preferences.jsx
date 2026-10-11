import { useLang } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useUserData } from "../../context/UserDataContext";

const Toggle = ({ checked, onChange, label, sub, disabled }) => (
  <label className={`nt-toggle ${disabled ? "is-disabled" : ""}`}>
    <span><b>{label}</b>{sub && <small>{sub}</small>}</span>
    <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    <i aria-hidden="true" />
  </label>
);

export default function Preferences() {
  const { t, lang, setLang, languages } = useLang();
  const { theme, toggleTheme } = useTheme();
  const { prefs, setPref, sync } = useUserData();
  return (
    <div className="nt-panel">
      <h2>{t("acc.prefTitle")}</h2>
      <p className="nt-sub">{t("acc.prefSub")}</p>

      <h3 className="nt-h3">{t("acc.language")}</h3>
      <div className="nt-seg" role="radiogroup">{languages.map((l) => <button key={l} role="radio" aria-checked={lang === l} className={lang === l ? "is-on" : ""} onClick={() => setLang(l)}>{l === "uz" ? "O‘zbekcha" : "Русский"}</button>)}</div>

      <h3 className="nt-h3">{t("acc.theme")}</h3>
      <div className="nt-seg" role="radiogroup">{["light", "dark"].map((m) => <button key={m} role="radio" aria-checked={theme === m} className={theme === m ? "is-on" : ""} onClick={() => theme !== m && toggleTheme()}>{t(`acc.${m}`)}</button>)}</div>

      <h3 className="nt-h3">{t("acc.notifications")}</h3>
      <Toggle checked={prefs.notifyDrops} onChange={(v) => setPref({ notifyDrops: v })} label={t("acc.notifyDrops")} sub={t("acc.notifyDropsSub")} />
      <Toggle checked={false} disabled onChange={() => {}} label={t("acc.notifyEmail")} sub={t("acc.notifyEmailSub")} />

      <p className="nt-note">{t(`acc.sync.${sync}`)}</p>
    </div>
  );
}
