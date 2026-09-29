import { orderItems, releaseExpiredOrders } from "../../../../src/lib/db";
import { json } from "../../../../src/lib/http";
import type { Env, OrderRow } from "../../../../src/lib/types";

const STATUSES = ["pending", "paid", "expired", "cancelled", "shipped", "delivered"];

// GET /api/admin/orders?status=paid — últimos 200 pedidos
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  await releaseExpiredOrders(env.DB);
  const status = new URL(request.url).searchParams.get("status");
  const stmt =
    status && STATUSES.includes(status)
      ? env.DB.prepare("SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT 200").bind(status)
      : env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 200");
  const { results } = await stmt.all<OrderRow>();
  return json({
    orders: results.map((o) => ({
      ...o,
      items: orderItems(o),
      customer: JSON.parse(o.customer),
      address: JSON.parse(o.address),
      needs_review: o.needs_review === 1,
    })),
  });
};
