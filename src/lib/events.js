/* Anonymous product signals used for "Trending" (view / cart / favorite). Fire-and-forget. */
const sent = new Set();
export function trackEvent(slug, type) {
  const key = `${slug}:${type}`;
  if (sent.has(key) && type === "view") return; // one view per slug per page load
  sent.add(key);
  try {
    const body = JSON.stringify({ slug, type });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
    else fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch { /* ignore */ }
}
