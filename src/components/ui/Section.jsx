import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Icon from "./Icon";

export default function Section({ title, subtitle, to, linkLabel, children, id, glass = false }) {
  return (
    <motion.section id={id} className={`nt-section ${glass ? "nt-section-glass nt-glass" : ""}`} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
      <header className="nt-section-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {to && <Link to={to} className="nt-link">{linkLabel} <Icon name="arrowRight" size={15} /></Link>}
      </header>
      {children}
    </motion.section>
  );
}
