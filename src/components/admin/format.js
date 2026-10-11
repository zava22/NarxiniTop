const pad = (n) => String(n).padStart(2, "0");

export const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(+d) ? "—" : `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};

export function timeAgo(iso) {
  if (!iso) return "—";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!Number.isFinite(s)) return "—";
  if (s < 60) return "hozir";
  if (s < 3600) return `${Math.floor(s / 60)} daqiqa oldin`;
  if (s < 86400) return `${Math.floor(s / 3600)} soat oldin`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} kun oldin`;
  return fmtDate(iso);
}

/* stable colour per person, no image needed */
export function avatarColor(seed = "") {
  let h = 0;
  for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 42% 42%)`;
}

export const fmtDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(+d) ? "—" : `${fmtDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/* admin_log actions -> [label, icon, tone] */
const ACTIONS = {
  "product.create": ["Mahsulot qo‘shildi", "plus", "ok"],
  "product.update": ["Mahsulot tahrirlandi", "pencil", ""],
  "product.delete": ["Mahsulot o‘chirildi", "trash", "bad"],
  "product.duplicate": ["Mahsulot nusxalandi", "copy", ""],
  "bulk.delete": ["Ommaviy o‘chirish", "trash", "bad"],
  "bulk.category": ["Kategoriya o‘zgartirildi", "tag", ""],
  "bulk.stock": ["Mavjudlik o‘zgartirildi", "package", ""],
  "seed.import": ["products.json import", "download", "ok"],
  "seed.overwrite": ["products.json qayta yuklandi", "refresh", "warn"],
  "users.import": ["Foydalanuvchilar import qilindi", "user", "ok"],
  "images.clear": ["Rasm manzillari tozalandi", "image", "warn"],
  "message.delete": ["Xabar o‘chirildi", "inbox", "bad"],
};
export const actionInfo = (action) => ACTIONS[action] ?? [String(action ?? "Amal"), "activity", ""];

/* "Korzinka: 12 490" style short number */
export const spaced = (n) => Number(n ?? 0).toLocaleString("en-US").replace(/,/g, " ");
