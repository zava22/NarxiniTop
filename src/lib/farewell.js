/* Tiny store behind the sign-out animation (see LogoutOverlay). */
let current = null;
const subs = new Set();
const emit = () => subs.forEach((fn) => fn());

export const farewell = {
  show(payload) { current = payload; emit(); },
  hide() { current = null; emit(); },
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  get() { return current; },
};
