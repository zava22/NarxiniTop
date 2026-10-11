import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Icon from "../../components/ui/Icon";
import { EmptyState } from "../../components/ui/States";
import { useLang } from "../../context/LanguageContext";
import { useCatalog } from "../../context/CatalogContext";
import { useUserData } from "../../context/UserDataContext";
import { formatPrice } from "../../lib/constants";

export default function Notifications() {
  const { t } = useLang();
  const { bySlug } = useCatalog();
  const { notifications, dismissNotification, clearNotifications } = useUserData();
  if (!notifications.length) return <EmptyState icon="bell" title={t("acc.notifEmpty")} text={t("acc.notifEmptyText")} />;
  return (
    <div className="nt-panel">
      <div className="nt-row between"><h2>{t("acc.notifTitle")}</h2><button type="button" className="nt-btn nt-btn-ghost" onClick={clearNotifications}>{t("acc.clearAll")}</button></div>
      <ul className="nt-list">
        <AnimatePresence initial={false}>
          {notifications.map((n) => (
            <motion.li key={n.id} layout initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}>
              <span className="nt-notif"><Icon name="trendDown" size={16} /> <Link to={`/product/${n.slug}`}>{bySlug.get(n.slug)?.name ?? n.slug}</Link>: {formatPrice(n.from)} → <b>{formatPrice(n.to)}</b></span>
              <button type="button" className="nt-x" onClick={() => dismissNotification(n.id)} aria-label={t("acc.dismiss")}><Icon name="x" size={16} /></button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
