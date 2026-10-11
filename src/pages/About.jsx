import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

import PageShell from "../components/layout/PageShell";
import Icon from "../components/ui/Icon";
import useCountUp from "../hooks/useCountUp";
import { useCatalog } from "../context/CatalogContext";
import { useLang } from "../context/LanguageContext";
import { summarize } from "../lib/product";

const WHAT = [[1, "tag"], [2, "cart"], [3, "clock"], [4, "pin"]];
const HOW = [[1, "database"], [2, "link"], [3, "search"], [4, "checkCircle"]];
const WHY = [[1, "shield"], [2, "sparkles"], [3, "lock"]];

const rise = (i = 0) => ({
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] },
});

function Head({ eyebrow, title, sub }) {
  return (
    <motion.header className="ab-head" {...rise()}>
      {eyebrow && <span className="nt-eyebrow">{eyebrow}</span>}
      <h2>{title}</h2>
      {sub && <p>{sub}</p>}
    </motion.header>
  );
}

export default function About() {
  const { t } = useLang();
  const { products } = useCatalog();
  const chains = useMemo(() => [...new Set(products.flatMap((p) => p.prices.map((o) => o.store)))], [products]);
  const spread = useMemo(() => {
    const v = products.filter((p) => p.prices.length > 1).map((p) => summarize(p).spreadPct);
    return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : 0;
  }, [products]);
  const nProducts = useCountUp(products.length);
  const nChains = useCountUp(chains.length);
  const nSpread = useCountUp(spread);

  return (
    <PageShell>
      <div className="ab">
        {/* ------------------------------ hero banner ------------------------------ */}
        <section className="ab-hero">
          <i className="nt-hero-orb nt-hero-orb-a" aria-hidden="true" />
          <i className="nt-hero-orb nt-hero-orb-b" aria-hidden="true" />
          <div className="ab-hero-copy">
            <motion.span className="nt-eyebrow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>{t("about.eyebrow")}</motion.span>
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.55 }}>
              {t("about.title1")} <em>{t("about.title2")}</em>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.55 }}>{t("about.sub")}</motion.p>
            <motion.div className="ab-hero-btns" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.55 }}>
              <Link to="/search" className="nt-btn nt-btn-primary nt-btn-lg"><Icon name="search" size={18} />{t("about.cta.search")}</Link>
              <Link to="/contact" className="nt-btn nt-btn-ghost nt-btn-lg"><Icon name="mail" size={18} />{t("about.cta.contact")}</Link>
            </motion.div>
          </div>
          {chains.length > 0 && (
            <div className="ab-panel" aria-hidden="true">
              <div className="ab-panel-top"><i /><i /><i /><span>NARXTOP</span></div>
              {chains.slice(0, 3).map((c, i) => (
                <div key={c} className={`ab-row ${i === 1 ? "is-best" : ""}`}>
                  <span className="ab-row-ico"><Icon name="store" size={16} /></span>
                  <b>{c}</b>
                  <span className="ab-bar"><u style={{ width: `${[92, 64, 80][i]}%` }} /></span>
                  {i === 1 && <em>{t("about.panel.best")}</em>}
                </div>
              ))}
            </div>
          )}
          <ul className="ab-stats">
            <li><b>{nProducts}</b><span>{t("about.stat.products")}</span></li>
            <li><b>{nChains}</b><span>{t("about.stat.chains")}</span></li>
            <li><b>{nSpread}%</b><span>{t("about.stat.spread")}</span></li>
            <li><b>0 UZS</b><span>{t("about.stat.free")}</span></li>
          </ul>
        </section>

        {/* ------------------------------ what it does ------------------------------ */}
        <section className="ab-sec">
          <Head eyebrow={t("about.what.eyebrow")} title={t("about.what.title")} sub={t("about.what.sub")} />
          <div className="ab-cards">
            {WHAT.map(([n, icon], i) => (
              <motion.article key={n} className="ab-card" {...rise(i)}>
                <span className="ab-ico"><Icon name={icon} size={22} /></span>
                <h3>{t(`about.what.${n}.t`)}</h3>
                <p>{t(`about.what.${n}.d`)}</p>
              </motion.article>
            ))}
          </div>
        </section>

        {/* ------------------------------ how it works ------------------------------ */}
        <section className="ab-sec">
          <Head eyebrow={t("about.how.eyebrow")} title={t("about.how.title")} />
          <ol className="ab-steps">
            {HOW.map(([n, icon], i) => (
              <motion.li key={n} className="ab-step" {...rise(i)}>
                <span className="ab-num">{n}</span>
                <span className="ab-step-ico"><Icon name={icon} size={20} /></span>
                <h3>{t(`about.how.${n}.t`)}</h3>
                <p>{t(`about.how.${n}.d`)}</p>
              </motion.li>
            ))}
          </ol>
        </section>

        {/* ------------------------------ mission banner ------------------------------ */}
        <motion.section className="ab-mission" {...rise()}>
          <i className="nt-hero-orb nt-hero-orb-a" aria-hidden="true" />
          <Icon name="sparkles" size={28} />
          <h2>{t("about.mission.t")}</h2>
          <p>{t("about.mission.d")}</p>
        </motion.section>

        {/* ------------------------------ principles ------------------------------ */}
        <section className="ab-sec">
          <Head eyebrow={t("about.why.eyebrow")} title={t("about.why.title")} />
          <div className="ab-cards ab-cards-3">
            {WHY.map(([n, icon], i) => (
              <motion.article key={n} className="ab-card" {...rise(i)}>
                <span className="ab-ico"><Icon name={icon} size={22} /></span>
                <h3>{t(`about.why.${n}.t`)}</h3>
                <p>{t(`about.why.${n}.d`)}</p>
              </motion.article>
            ))}
          </div>
        </section>

        {/* ------------------------------ stores ------------------------------ */}
        {chains.length > 0 && (
          <motion.section className="ab-stores" {...rise()}>
            <div>
              <h2>{t("about.stores.title")}</h2>
              <p>{t("about.stores.sub")}</p>
            </div>
            <ul>
              {chains.map((c) => <li key={c}><Link to={`/stores?chain=${encodeURIComponent(c)}`}><Icon name="store" size={16} />{c}</Link></li>)}
            </ul>
          </motion.section>
        )}

        {/* ------------------------------ contact CTA ------------------------------ */}
        <motion.section className="ab-cta" {...rise()}>
          <div>
            <h2>{t("about.cta.title")}</h2>
            <p>{t("about.cta.sub")}</p>
          </div>
          <Link to="/contact" className="nt-btn nt-btn-primary nt-btn-lg"><Icon name="send" size={18} />{t("about.cta.contact")}</Link>
        </motion.section>
      </div>
    </PageShell>
  );
}
