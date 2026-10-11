/* Fly-to-cart + "added" button morph (replaces toast popups). */
export function flyToCart(button, imageSrc, label) {
  if (button) {
    button.setAttribute("data-added-label", label || "✓");
    button.classList.add("btn-added");
    clearTimeout(button._addedTimer);
    button._addedTimer = setTimeout(() => button.classList.remove("btn-added"), 1500);
  }
  const target = document.querySelector(".navbar-cart");
  if (!button || !target || !button.animate) return;

  const a = button.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const dot = document.createElement(imageSrc ? "img" : "div");
  if (imageSrc) dot.src = imageSrc;
  dot.className = "fly-dot";
  dot.style.left = `${a.left + a.width / 2 - 22}px`;
  dot.style.top = `${a.top + a.height / 2 - 22}px`;
  document.body.appendChild(dot);

  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const anim = dot.animate(
    [
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 90}px) scale(.8)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px,${dy}px) scale(.15)`, opacity: 0.2 },
    ],
    { duration: 800, easing: "cubic-bezier(.5,0,.3,1)" }
  );
  anim.onfinish = () => {
    dot.remove();
    target.classList.remove("cart-bump");
    void target.offsetWidth;
    target.classList.add("cart-bump");
  };
}

/* Fade-out navigation between pages. */
export function installPageTransitions() {
  const root = document.documentElement;
  window.addEventListener("pageshow", () => root.classList.remove("page-leaving"));
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.("a[href]");
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
    const url = new URL(a.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname && url.search === window.location.search) return;
    e.preventDefault();
    root.classList.add("page-leaving");
    setTimeout(() => window.location.assign(url.href), 260);
  });
}

/* 3D tilt + spotlight on cards (event delegation, no per-card state). */
export function installTilt() {
  const sel = ".product-card, .similar-product-card, .cart-item, .acc-stat";
  let raf = 0;
  document.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    const card = e.target.closest?.(sel);
    if (!card) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      card.style.setProperty("--mx", `${x * 100}%`);
      card.style.setProperty("--my", `${y * 100}%`);
      card.style.setProperty("--ry", `${(x - 0.5) * 7}deg`);
      card.style.setProperty("--rx", `${(0.5 - y) * 7}deg`);
      card.classList.add("tilting");
    });
  });
  document.addEventListener("pointerout", (e) => {
    const card = e.target.closest?.(sel);
    if (card && !card.contains(e.relatedTarget)) {
      card.classList.remove("tilting");
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    }
  });
}
