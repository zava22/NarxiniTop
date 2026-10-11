import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { farewell } from "../lib/farewell";
import { toast } from "../lib/toast";

/* Sign out with the goodbye animation (kept on screen ~1.6 s so it can be seen). */
export default function useLogout() {
  const { signOut, displayName, avatar, user } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  return useCallback(async () => {
    const m = user?.user_metadata ?? {};
    farewell.show({ name: displayName, avatar: avatar || m.avatar_url || m.picture || null });
    try {
      await Promise.all([signOut(), new Promise((r) => setTimeout(r, 1600))]);
      navigate("/", { replace: true });
    } catch { toast(t("acc.actionError")); }
    finally { setTimeout(() => farewell.hide(), 150); }
  }, [signOut, displayName, avatar, user, navigate, t]);
}
