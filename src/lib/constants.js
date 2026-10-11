// Category value used in products.json / CategoryNav for "show everything".
export const ALL_CATEGORIES = "Barcha kategoriyalar";

export function formatPrice(price) {
  return `${Number(price).toLocaleString("uz-UZ")} UZS`;
}

export function getCheapestPrice(prices) {
  return Math.min(...prices.map((item) => Number(item.price)));
}

/* When false, guests must sign in to see products/cart (existing behaviour). */
export const GUEST_BROWSING = false;
