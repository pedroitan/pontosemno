import { getOrder, orderItems } from "../../../src/lib/db";
import { fail, json } from "../../../src/lib/http";
import type { Env } from "../../../src/lib/types";

// GET /api/orders/:id — status público do pedido (o id é um UUID, só quem comprou conhece)
export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const id = String(params.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(404, "Pedido não encontrado.");
  const o = await getOrder(env.DB, id);
  if (!o) return fail(404, "Pedido não encontrado.");
  return json({
    id: o.id,
    status: o.status,
    items: orderItems(o).map((i) => ({ name: i.name, qty: i.qty, price_cents: i.price_cents })),
    subtotal_cents: o.subtotal_cents,
    shipping_cents: o.shipping_cents,
    total_cents: o.total_cents,
    tracking_code: o.tracking_code,
    created_at: o.created_at,
  });
};
