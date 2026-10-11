import { motion } from "framer-motion";
import { useLang } from "../../context/LanguageContext";
import Icon from "./Icon";

export function Skeleton({ h = 16, w = "100%", r = 8, className = "" }) {
  return <span className={`nt-skel ${className}`} style={{ height: h, width: w, borderRadius: r }} aria-hidden="true" />;
}

export function CardSkeleton() {
  return (
    <div className="pc pc-skel" aria-hidden="true">
      <Skeleton h={190} r={18} />
      <Skeleton h={16} w="75%" />
      <Skeleton h={12} w="40%" />
      <Skeleton h={38} r={12} />
      <Skeleton h={38} r={12} />
      <Skeleton h={42} r={999} />
    </div>
  );
}

export function GridSkeleton({ n = 8 }) {
  return <div className="nt-grid">{Array.from({ length: n }, (_, i) => <CardSkeleton key={i} />)}</div>;
}

export function EmptyState({ icon = "cart", title, text, action }) {
  return (
    <motion.div className="nt-state" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="nt-state-icon" aria-hidden="true"><Icon name={icon} size={30} strokeWidth={1.6} /></div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </motion.div>
  );
}

export function ErrorState({ onRetry, text }) {
  const { t } = useLang();
  return (
    <EmptyState
      icon="alert"
      title={t("p.error.title")}
      text={text ?? t("p.error.text")}
      action={onRetry && <button type="button" className="nt-btn nt-btn-primary" onClick={onRetry}>{t("p.retry")}</button>}
    />
  );
}
