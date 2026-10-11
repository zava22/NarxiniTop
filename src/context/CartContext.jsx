import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "./AuthContext";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const storageKey = `narxtop_cart_${user?.id ?? "guest"}`;

  const [items, setItems] = useState([]);
  const [loadedKey, setLoadedKey] = useState(null);

  // Load the cart that belongs to the current user.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
      setItems(Array.isArray(saved) ? saved : []);
    } catch {
      setItems([]);
    }
    setLoadedKey(storageKey);
  }, [storageKey]);

  // Save on every change (only after the correct cart was loaded).
  useEffect(() => {
    if (loadedKey !== storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items, storageKey, loadedKey]);

  const addItem = useCallback((slug, n = 1) => {
    setItems((current) => {
      const existing = current.find((item) => item.slug === slug);
      if (existing) {
        return current.map((item) =>
          item.slug === slug ? { ...item, qty: Math.min(99, item.qty + n) } : item
        );
      }
      return [...current, { slug, qty: Math.min(99, n) }];
    });
  }, []);

  const setQty = useCallback((slug, qty) => {
    setItems((current) =>
      qty <= 0
        ? current.filter((item) => item.slug !== slug)
        : current.map((item) =>
            item.slug === slug ? { ...item, qty } : item
          )
    );
  }, []);

  const removeItem = useCallback(
    (slug) =>
      setItems((current) => current.filter((item) => item.slug !== slug)),
    []
  );

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({
      items,
      count: items.reduce((sum, item) => sum + item.qty, 0),
      addItem,
      setQty,
      removeItem,
      clear,
    }),
    [items, addItem, setQty, removeItem, clear]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }

  return context;
}
