/* Fly-to-cart: clones the product image and animates it to the navbar cart button (data-cart-target). */
export function flyToCart(imgEl) {
  const target = document.querySelector("[data-cart-target]");
  if (!imgEl || !target || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { bump(target); return; }
  const a = imgEl.getBoundingClientRect(), b = target.getBoundingClientRect();
  if (!a.width || !b.width) { bump(target); return; }
  const ghost = imgEl.cloneNode(false);
  Object.assign(ghost.style, { position: "fixed", left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`, zIndex: 9999, pointerEvents: "none", borderRadius: "16px", objectFit: "contain", mixBlendMode: "normal", boxShadow: "0 12px 30px rgba(0,0,0,.35)", background: "rgba(255,255,255,.9)" });
  document.body.appendChild(ghost);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const anim = ghost.animate(
    [
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 70}px) scale(.55)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(.1)`, opacity: 0.2 },
    ],
    { duration: 720, easing: "cubic-bezier(.5,.05,.25,1)" }
  );
  anim.onfinish = anim.oncancel = () => { ghost.remove(); bump(target); };
}

function bump(el) {
  if (!el) return;
  el.classList.remove("nt-bump");
  void el.offsetWidth; // restart the CSS animation
  el.classList.add("nt-bump");
  setTimeout(() => el.classList.remove("nt-bump"), 600);
}
