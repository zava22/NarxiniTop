// Tiny event-based toast helper. <Toaster /> listens for these events.
export function toast(message, options = {}) {
  window.dispatchEvent(
    new CustomEvent("narxtop:toast", {
      detail: { message, ...options },
    })
  );
}
