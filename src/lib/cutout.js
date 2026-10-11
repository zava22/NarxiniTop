import { useEffect, useState } from "react";

/*
 * Dark-theme helper: removes a near-white photo background so the product sits directly on the
 * dark card plate. Works on a canvas in the browser, flood-filling from the image border only
 * (white inside the product is kept). If the image host does not allow canvas access (CORS) or
 * anything fails, it returns null and the card falls back to a soft vignette mask.
 */
const cache = new Map(); // src -> dataURL | null
const pending = new Map();

function process(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onerror = () => resolve(null);
    img.onload = () => {
      try {
        const max = 360, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h), px = data.data;
        const isBg = (i) => { const r = px[i], g = px[i + 1], b = px[i + 2]; return r > 232 && g > 232 && b > 232 && Math.max(r, g, b) - Math.min(r, g, b) < 18; };
        const seen = new Uint8Array(w * h), stack = [];
        const push = (x, y) => { const p = y * w + x; if (!seen[p] && isBg(p * 4)) { seen[p] = 1; stack.push(p); } };
        for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
        for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
        let removed = 0;
        while (stack.length) {
          const p = stack.pop(), x = p % w, y = (p / w) | 0;
          px[p * 4 + 3] = 0; removed++;
          if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1);
        }
        // not a plain white-background packshot (nothing or nearly everything removed): leave it alone
        if (removed < w * h * 0.08 || removed > w * h * 0.95) return resolve(null);
        // soften the cut edge (1px feather)
        for (let p = 0; p < w * h; p++) {
          if (px[p * 4 + 3] === 0) continue;
          const x = p % w, y = (p / w) | 0;
          if ((x > 0 && px[(p - 1) * 4 + 3] === 0) || (x < w - 1 && px[(p + 1) * 4 + 3] === 0) || (y > 0 && px[(p - w) * 4 + 3] === 0) || (y < h - 1 && px[(p + w) * 4 + 3] === 0)) px[p * 4 + 3] = 150;
        }
        ctx.putImageData(data, 0, 0);
        resolve(c.toDataURL("image/png"));
      } catch { resolve(null); } // tainted canvas etc.
    };
    img.src = src;
  });
}

export function useCutout(src, enabled) {
  const [url, setUrl] = useState(() => (src && cache.has(src) ? cache.get(src) : null));
  useEffect(() => {
    if (!enabled || !src) { setUrl(null); return; }
    if (cache.has(src)) { setUrl(cache.get(src)); return; }
    let alive = true;
    if (!pending.has(src)) pending.set(src, process(src).then((r) => { cache.set(src, r); pending.delete(src); return r; }));
    pending.get(src).then((r) => alive && setUrl(r));
    return () => { alive = false; };
  }, [src, enabled]);
  return url;
}
