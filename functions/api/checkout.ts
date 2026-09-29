import { releaseExpiredOrders, reserveStock, restoreStock, toProduct } from "../../src/lib/db";
import { fail, intEnv, json, readJson, siteUrl } from "../../src/lib/http";
import { createPreference } from "../../src/lib/mercadopago";
import { shippingFor, shippingRules } from "../../src/lib/shipping";
import type { Env, OrderItem, ProductRow } from "../../src/lib/types";

interface CheckoutBody {
  items?: { id?: unknown; qty?: unknown }[];
  customer?: { name?: unknown; email?: unknown; phone?: unknown };
  address?: {
    cep?: unknown; street?: unknown; number?: unknown; complement?: unknown;
    district?: unknown; city?: unknown; state?: unknown;
  };
}

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const UFS = new Set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "));

// POST /api/checkout — valida sacola, reserva estoque, cria pedido e preferência no Mercado Pago
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson<CheckoutBody>(request);
  if (!body) return fail(400, "Não foi possível ler o pedido.");

  // --- sacola ---
  const merged = new Map<string, number>();
  for (const raw of body.items ?? []) {
    const id = str(raw?.id, 80);
    const qty = Number(raw?.qty);
    if (!id || !Number.isInteger(qty) || qty < 1 || qty > 10) return fail(400, "Item inválido na sacola.");
    merged.set(id, (merged.get(id) ?? 0) + qty);
  }
  if (merged.size === 0) return fail(400, "Sua sacola está vazia.");
  if (merged.size > 20) return fail(400, "Muitos itens na sacola.");

  // --- cliente ---
  const customer = {
    name: str(body.customer?.name, 120),
    email: str(body.customer?.email, 160).toLowerCase(),
    phone: str(body.customer?.phone, 30).replace(/\D/g, ""),
  };
  const address = {
    cep: str(body.address?.cep, 12).replace(/\D/g, ""),
    street: str(body.address?.street, 160),
    number: str(body.address?.number, 20),
    complement: str(body.address?.complement, 80),
    district: str(body.address?.district, 80),
    city: str(body.address?.city, 80),
    state: str(body.address?.state, 2).toUpperCase(),
  };
  const errors: string[] = [];
  if (customer.name.split(/\s+/).length < 2) errors.push("Informe nome e sobrenome.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) errors.push("E-mail inválido.");
  if (customer.phone.length < 10 || customer.phone.length > 13) errors.push("Telefone inválido.");
  if (address.cep.length !== 8) errors.push("CEP inválido.");
  if (!address.street || !address.number || !address.district || !address.city) errors.push("Endereço incompleto.");
  if (!UFS.has(address.state)) errors.push("Estado (UF) inválido.");
  if (errors.length) return fail(400, errors.join(" "), { fields: errors });

  if (!env.MP_ACCESS_TOKEN) return fail(503, "Pagamento ainda não configurado.");

  await releaseExpiredOrders(env.DB);

  // --- produtos ---
  const ids = [...merged.keys()];
  const { results } = await env.DB
    .prepare(`SELECT * FROM products WHERE id IN (${ids.map(() => "?").join(",")})`)
    .bind(...ids)
    .all<ProductRow>();
  const byId = new Map(results.map((r) => [r.id, toProduct(r)]));

  const unavailable: string[] = [];
  const items: OrderItem[] = [];
  for (const [id, qty] of merged) {
    const p = byId.get(id);
    if (!p || !p.active || p.price_cents === null || p.stock < qty) {
      unavailable.push(id);
      continue;
    }
    items.push({ id, name: p.name, qty, price_cents: p.price_cents });
  }
  if (unavailable.length) {
    return fail(409, "Algumas peças não estão mais disponíveis.", { unavailable });
  }

  // --- reserva ---
  const failed = await reserveStock(env.DB, items);
  if (failed.length) return fail(409, "Algumas peças acabaram de ser reservadas por outra pessoa.", { unavailable: failed });

  const subtotal = items.reduce((s, i) => s + i.price_cents * i.qty, 0);
  const shipping = shippingFor(subtotal, shippingRules(env));
  const total = subtotal + shipping;
  const minutes = intEnv(env.RESERVATION_MINUTES, 30) ?? 30;
  const expiresAt = new Date(Date.now() + minutes * 60_000);
  const orderId = crypto.randomUUID();
  const base = siteUrl(env.SITE_URL, request);

  await env.DB
    .prepare(
      `INSERT INTO orders (id, status, items, subtotal_cents, shipping_cents, total_cents, customer, address, expires_at)
       VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(orderId, JSON.stringify(items), subtotal, shipping, total, JSON.stringify(customer), JSON.stringify(address), expiresAt.getTime())
    .run();

  try {
    const pref = await createPreference(env.MP_ACCESS_TOKEN, {
      orderId,
      items: items.map((i) => ({
        id: i.id,
        title: i.name,
        quantity: i.qty,
        unit_price_cents: i.price_cents,
        picture_url: byId.get(i.id)?.images[0] ? `${base}/img/${byId.get(i.id)!.images[0]}` : undefined,
      })),
      shippingCents: shipping,
      payer: customer,
      siteUrl: base,
      expiresAt,
    }, env.MP_API_BASE);
    await env.DB
      .prepare("UPDATE orders SET mp_preference_id = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(pref.id, orderId)
      .run();
    const sandbox = env.MP_ACCESS_TOKEN.startsWith("TEST-");
    return json({ orderId, checkoutUrl: sandbox && pref.sandbox_init_point ? pref.sandbox_init_point : pref.init_point });
  } catch (err) {
    console.error("checkout: falha ao criar preferência", err);
    const r = await env.DB
      .prepare("UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ? AND status = 'pending'")
      .bind(orderId)
      .run();
    if (r.meta.changes === 1) await restoreStock(env.DB, items);
    return fail(502, "Não conseguimos abrir o pagamento agora. Tente de novo em instantes.");
  }
};
