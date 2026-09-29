import { getOrder, orderItems, restoreStock } from "../../../../src/lib/db";
import { fail, json, readJson } from "../../../../src/lib/http";
import type { Env } from "../../../../src/lib/types";

// Transições permitidas pelo painel
const ALLOWED: Record<string, string[]> = {
  pending: ["cancelled"],
  paid: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  expired: [],
  cancelled: [],
};

// PATCH /api/admin/orders/:id — { status?, tracking_code?, needs_review? }
export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const id = String(params.id ?? "");
  const body = await readJson<{ status?: string; tracking_code?: string; needs_review?: boolean; restock?: boolean }>(request);
  if (!body) return fail(400, "JSON inválido.");
  const order = await getOrder(env.DB, id);
  if (!order) return fail(404, "Pedido não encontrado.");

  if (typeof body.tracking_code === "string") {
    await env.DB
      .prepare("UPDATE orders SET tracking_code = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(body.tracking_code.trim().slice(0, 60) || null, id)
      .run();
  }
  if (typeof body.needs_review === "boolean") {
    await env.DB.prepare("UPDATE orders SET needs_review = ? WHERE id = ?").bind(body.needs_review ? 1 : 0, id).run();
  }
  if (body.status && body.status !== order.status) {
    if (!(ALLOWED[order.status] ?? []).includes(body.status)) {
      return fail(400, `Não é possível mudar de "${order.status}" para "${body.status}".`);
    }
    const r = await env.DB
      .prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ? AND status = ?")
      .bind(body.status, id, order.status)
      .run();
    // Cancelar um pedido pendente devolve as peças. Cancelar um pago só devolve se restock=true.
    if (r.meta.changes === 1 && body.status === "cancelled" && (order.status === "pending" || body.restock)) {
      await restoreStock(env.DB, orderItems(order));
    }
  }
  return json({ ok: true });
};
