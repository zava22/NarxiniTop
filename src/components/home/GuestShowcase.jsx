import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

import Icon from "../ui/Icon";
import useSpotlight from "../../hooks/useSpotlight";
import { useCatalog } from "../../context/CatalogContext";
import { useLang } from "../../context/LanguageContext";

const STEPS = [["search", "s1"], ["chart", "s2"], ["cart", "s3"], ["pin", "s4"]];
const rise = (i) => ({ initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-60px" }, transition: { duration: 0.55, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] } });

/*
 * Second banner for visitors. Only true statements: what the app does, real catalogue items
 * (name/photo/number of store offers) with their prices deliberately hidden until sign-up.
 * Without catalogue data it still renders the steps and the call to action.
 */
export default function GuestShowcase() {
  const { t, tProduct } = useLang();
  const { products } = useCatalog();
  const spot = useSpotlight();
  const teasers = useMemo(() => [...products].sort((a, b) => b.prices.length - a.prices.length).slice(0, 3), [products]);

  return (
    <section className="nt-show nt-glass nt-spot" aria-labelledby="nt-show-title" onPointerMove={spot}>
      <div className="nt-show-top">
        <motion.span className="nt-eyebrow" {...rise(0)}>{t("guest.kicker")}</motion.span>
        <motion.h2 id="nt-show-title" {...rise(1)}>{t("guest.show.title")}</motion.h2>
        <motion.p {...rise(2)}>{t("guest.show.sub")}</motion.p>
      </div>

      <ol className="nt-steps">
        {STEPS.map(([icon, k], i) => (
          <motion.li key={k} {...rise(i)}>
            <span className="nt-step-n">{i + 1}</span>
            <span className="nt-step-ico"><Icon name={icon} size={22} /></span>
            <b>{t(`guest.${k}.t`)}</b>
            <small>{t(`guest.${k}.d`)}</small>
          </motion.li>
        ))}
      </ol>

      {teasers.length > 0 && (
        <div className="nt-teasers" aria-label={t("guest.teaserNote")}>
          {teasers.map((p, i) => (
            <motion.article key={p.slug} className="nt-teaser" {...rise(i)}>
              <div className="nt-teaser-img">{p.image && <img src={p.image} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />}</div>
              <b>{tProduct(p, "name")}</b>
              <span className="nt-teaser-n">{t("guest.teaserN", { n: p.prices.length })}</span>
              <div className="nt-teaser-lock"><span aria-hidden="true" /><Icon name="lock" size={15} />{t("guest.locked")}</div>
            </motion.article>
          ))}
        </div>
      )}
      {teasers.length > 0 && <p className="nt-note nt-show-note">{t("guest.teaserNote")}</p>}

      <motion.div className="nt-show-cta" {...rise(3)}>
        <ul className="nt-show-feats">{["f1", "f2", "f3"].map((f) => <li key={f}><Icon name="check" size={15} strokeWidth={2.4} />{t(`guest.${f}`)}</li>)}</ul>
        <div className="nt-show-btns">
          <Link to="/auth?mode=signup" className="nt-btn nt-btn-primary nt-btn-lg">{t("guest.cta")}<Icon name="arrowRight" size={18} /></Link>
          <Link to="/auth" className="nt-btn nt-btn-ghost nt-btn-lg">{t("guest.have")}</Link>
        </div>
      </motion.div>
    </section>
  );
}
