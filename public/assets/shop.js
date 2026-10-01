// Utilitários compartilhados: catálogo, sacola (localStorage), formatação
import { WHATSAPP, INSTAGRAM } from "./config.js";

export const brl = (cents) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Fotos enviadas pelo /admin ficam no KV sob "fotos/<key>"; o resto é arquivo em /public/img.
export const img = (file) => (file.startsWith("fotos/") ? `/${encodeURI(file)}` : `/img/${encodeURI(file)}`);

export const waLink = (text) =>
  `https://wa.me/${WHATSAPP}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
export const igLink = `https://instagram.com/${INSTAGRAM}`;
export { INSTAGRAM };

export async function fetchCatalog() {
  const res = await fetch("/api/products", { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error("catalog");
  return res.json(); // { products, shipping }
}

export const isAvailable = (p) => p.stock > 0 && p.price_cents !== null;

export function shippingFor(subtotal, rules) {
  if (!rules) return 0;
  if (rules.free_min_cents !== null && subtotal >= rules.free_min_cents) return 0;
  return rules.flat_cents;
}

// ---------- sacola ----------
const KEY = "psn_sacola_v1";
const listeners = new Set();

export function getCart() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((i) => i && typeof i.id === "string" && Number.isInteger(i.qty)) : [];
  } catch {
    return [];
  }
}
function saveCart(items) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
  listeners.forEach((fn) => fn(items));
}
export const onCartChange = (fn) => listeners.add(fn);

export function addToCart(id, qty = 1, max = 1) {
  const items = getCart();
  const found = items.find((i) => i.id === id);
  if (found) found.qty = Math.min(found.qty + qty, max);
  else items.push({ id, qty: Math.min(qty, max) });
  saveCart(items);
}
export function setQty(id, qty) {
  saveCart(getCart().map((i) => (i.id === id ? { ...i, qty } : i)).filter((i) => i.qty > 0));
}
export const removeFromCart = (id) => saveCart(getCart().filter((i) => i.id !== id));
export const clearCart = () => saveCart([]);
export const cartCount = () => getCart().reduce((s, i) => s + i.qty, 0);

// Sincroniza entre abas
window.addEventListener("storage", (e) => { if (e.key === KEY) listeners.forEach((fn) => fn(getCart())); });

/** Junta sacola + catálogo e separa o que ainda está disponível. */
export function resolveCart(products) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = getCart().map((i) => {
    const p = byId.get(i.id);
    const ok = p && isAvailable(p) && p.stock >= i.qty;
    return { ...i, product: p, ok };
  });
  const subtotal = lines.filter((l) => l.ok).reduce((s, l) => s + l.product.price_cents * l.qty, 0);
  return { lines, subtotal };
}

export function setYearAndContacts() {
  document.querySelectorAll("[data-ano]").forEach((el) => (el.textContent = new Date().getFullYear()));
  document.querySelectorAll("[data-insta]").forEach((el) => { el.href = igLink; if (!el.dataset.keep) el.textContent = "@" + INSTAGRAM; });
  document.querySelectorAll("[data-whats]").forEach((el) => (el.href = waLink()));
}
