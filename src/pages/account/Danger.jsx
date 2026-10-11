import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useAuth } from "../../context/AuthContext";
import { useLang } from "../../context/LanguageContext";
import { useUserData } from "../../context/UserDataContext";
import { supabase } from "../../lib/supabase";
import { toast } from "../../lib/toast";

export default function Danger() {
  const { t } = useLang();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const data = useUserData();
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);

  const exportData = () => {
    const { favorites, purchases, alerts, prefs } = data;
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), email: user.email, favorites, purchases, alerts, prefs }, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "narxtop-data.json" });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const confirm = async () => {
    setBusy(true);
    try {
      if (dialog === "data") { data.resetAll(); toast(t("acc.dataDeleted")); }
      else {
        const { data: s } = await supabase.auth.getSession();
        const res = await fetch("/api/account", { method: "DELETE", headers: { Authorization: `Bearer ${s.session?.access_token}` } });
        if (res.status === 501) { toast(t("acc.deleteNA")); }
        else if (!res.ok) throw new Error("delete");
        else { await signOut().catch(() => {}); navigate("/", { replace: true }); toast(t("acc.accountDeleted")); }
      }
    } catch { toast(t("acc.actionError")); }
    finally { setBusy(false); setDialog(null); }
  };

  return (
    <div className="nt-panel">
      <h2>{t("acc.actions")}</h2>
      <ul className="nt-list">
        <li><span><b>{t("acc.export")}</b><small>{t("acc.exportSub")}</small></span><button type="button" className="nt-btn nt-btn-ghost" onClick={exportData}>{t("acc.exportBtn")}</button></li>
        <li><span><b>{t("acc.deleteData")}</b><small>{t("acc.deleteDataSub")}</small></span><button type="button" className="nt-btn nt-btn-danger" onClick={() => setDialog("data")}>{t("acc.delete")}</button></li>
        <li><span><b>{t("acc.deleteAccount")}</b><small>{t("acc.deleteAccountSub")}</small></span><button type="button" className="nt-btn nt-btn-danger" onClick={() => setDialog("account")}>{t("acc.delete")}</button></li>
      </ul>
      <ConfirmDialog open={Boolean(dialog)} busy={busy} danger title={dialog === "data" ? t("acc.deleteData") : t("acc.deleteAccount")} text={dialog === "data" ? t("acc.deleteDataText") : t("acc.deleteAccountText")} confirmLabel={t("acc.delete")} onCancel={() => setDialog(null)} onConfirm={confirm} />
    </div>
  );
}
