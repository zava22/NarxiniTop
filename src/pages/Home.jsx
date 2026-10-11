import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

import AnimatedBrand from "../components/brand/AnimatedBrand";
import PageShell from "../components/layout/PageShell";
import GuestShowcase from "../components/home/GuestShowcase";
import CategoryNav from "../components/home/CategoryNav";
import SmartSearch from "../components/home/SmartSearch";
import ProductBrowser from "../components/products/ProductBrowser";
import Icon from "../components/ui/Icon";
import Section from "../components/ui/Section";
import { HeroStats, QuickTiles } from "../components/home/HomeSections";

import useSpotlight from "../hooks/useSpotlight";
import { useAuth } from "../context/AuthContext";
import { useCatalog } from "../context/CatalogContext";
import { useLang } from "../context/LanguageContext";
import { ALL_CATEGORIES, GUEST_BROWSING } from "../lib/constants";

const Words = ({ text, delay = 0, className = "" }) => (
  <span className={className}>
    {text.split(" ").map((w, i) => (
      <motion.span key={`${w}-${i}`} className="nt-word" initial={{ opacity: 0, y: "0.6em", filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.6, delay: delay + i * 0.08, ease: [0.22, 1, 0.36, 1] }}>
        {w}&nbsp;
      </motion.span>
    ))}
  </span>
);

export default function Home() {
  const { t } = useLang();
  const { isAuthenticated } = useAuth();
  const { products, status, error, reload } = useCatalog();
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const items = useMemo(() => (category === ALL_CATEGORIES ? products : products.filter((p) => p.category === category)), [products, category]);
  const counts = useMemo(() => {
    const c = { [ALL_CATEGORIES]: products.length };
    for (const p of products) c[p.category] = (c[p.category] ?? 0) + 1;
    return c;
  }, [products]);
  const allChains = useMemo(() => [...new Set(products.flatMap((p) => p.prices.map((o) => o.store)))], [products]);
  const chains = useMemo(() => allChains.slice(0, 4), [allChains]);
  const spot = useSpotlight();
  const showCatalog = GUEST_BROWSING || isAuthenticated;

  return (
    <PageShell>
      <section className={`nt-hero nt-glass nt-spot ${isAuthenticated ? "" : "is-guest"}`} onPointerMove={spot}>
        <div className="nt-hero-copy">
          <AnimatedBrand variant="hero" as="div" delay={0.1} />
          <motion.span className="nt-eyebrow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.5 }}>{t("p.hero.eyebrow")}</motion.span>
          <h1>
            <Words text={t("hero.title1")} delay={0.45} />
            <Words text={t("hero.title2")} delay={0.75} className="nt-grad" />
          </h1>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0, duration: 0.6 }}>{t("p.hero.sub")}</motion.p>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.15, duration: 0.6 }} className="nt-hero-actions">
            {isAuthenticated ? <SmartSearch /> : (
              <>
                <Link to="/auth?mode=signup" className="nt-btn nt-btn-primary nt-btn-lg">{t("lock.register")}<Icon name="arrowRight" size={18} /></Link>
                <Link to="/auth" className="nt-btn nt-btn-ghost nt-btn-lg">{t("lock.login")}</Link>
              </>
            )}
          </motion.div>
          {!isAuthenticated && (
            <motion.ul className="nt-hero-trust" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.35, duration: 0.6 }}>
              {["f1", "f2", "f3"].map((f) => <li key={f}><Icon name="check" size={14} strokeWidth={2.8} />{t(`guest.${f}`)}</li>)}
            </motion.ul>
          )}
          {isAuthenticated && status === "ready" && <HeroStats />}
        </div>

        {chains.length > 0 && (
          <div className="nt-hero-float" aria-hidden="true">
            <motion.div className="nt-float-panel" initial={{ opacity: 0, y: 30, rotate: 2 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: 0.5, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
              <div className="nt-float-top"><i /><i /><i /><span>NarxTop</span></div>
              {chains.map((c, i) => (
                <motion.div key={c} className="nt-float-chip" style={{ "--k": i, "--w": `${[92, 68, 80, 54][i % 4]}%` }} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.9 + i * 0.14, type: "spring", stiffness: 140, damping: 16 }}>
                  <span className="nt-float-dot"><Icon name="store" size={17} /></span>
                  <b>{c}</b>
                  <span className="nt-float-bar"><u /></span>
                </motion.div>
              ))}
              <div className="nt-float-foot"><Icon name="trendDown" size={16} /><span /></div>
            </motion.div>
          </div>
        )}
        <div className="nt-hero-orb nt-hero-orb-a" aria-hidden="true" />
        <div className="nt-hero-orb nt-hero-orb-b" aria-hidden="true" />
      </section>

      {!isAuthenticated && allChains.length > 1 && (
        <div className="nt-marquee" aria-hidden="true">
          <div className="nt-marquee-track">
            {[0, 1].map((n) => (
              <div className="nt-marquee-set" key={n}>
                {[...allChains, ...allChains].map((c, i) => <span key={`${c}-${i}`}><Icon name="store" size={16} />{c}</span>)}
              </div>
            ))}
          </div>
        </div>
      )}

      {!showCatalog && <GuestShowcase />}

      {showCatalog && (
        <>
          <QuickTiles />
          <Section title={t("p.home.all")} id="catalog" glass>
            <CategoryNav selectedCategory={category} onCategoryChange={setCategory} counts={status === "ready" ? counts : undefined} />
            <ProductBrowser items={items} loading={status === "loading"} error={status === "error" ? error : null} onRetry={reload} />
          </Section>
        </>
      )}
    </PageShell>
  );
}
