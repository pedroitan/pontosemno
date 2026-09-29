import { getOrder, orderItems, reserveStock, restoreStock } from "../../../src/lib/db";
import { fail, json, readJson } from "../../../src/lib/http";
import { getPayment, verifyWebhookSignature } from "../../../src/lib/mercadopago";
import type { Env } from "../../../src/lib/types";

// POST /api/webhooks/mercadopago — notificações de pagamento
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const body = (await readJson<{ type?: string; action?: string; data?: { id?: string | number } }>(request)) ?? {};
  const type = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? body.type ?? "";
  const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? String(body.data?.id ?? "");

  if (type !== "payment" || !dataId) return json({ ignored: true });

  if (env.MP_WEBHOOK_SECRET) {
    const ok = await verifyWebhookSignature(
      env.MP_WEBHOOK_SECRET,
      request.headers.get("x-signature"),
      request.headers.get("x-request-id"),
      dataId,
    );
    if (!ok) return fail(401, "assinatura inválida");
  }

  let payment;
  try {
    payment = await getPayment(env.MP_ACCESS_TOKEN, dataId, env.MP_API_BASE);
  } catch (err) {
    console.error("webhook: falha ao consultar pagamento", err);
    return fail(502, "falha ao consultar pagamento"); // Mercado Pago reenvia
  }

  const orderId = payment.external_reference;
  if (!orderId) return json({ ignored: true });
  const order = await getOrder(env.DB, orderId);
  if (!order) return json({ ignored: true });

  const db = env.DB;
  const setPayment = (status: string) =>
    db
      .prepare("UPDATE orders SET mp_payment_id = ?, mp_status = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(String(payment.id), status, orderId)
      .run();

  await setPayment(payment.status);

  if (payment.status === "approved") {
    // Caminho normal: reserva ainda válida.
    const r = await db
      .prepare("UPDATE orders SET status = 'paid', updated_at = datetime('now') WHERE id = ? AND status = 'pending'")
      .bind(orderId)
      .run();
    if (r.meta.changes === 0) {
      // Pagou depois que a reserva expirou (comum com Pix/boleto): tenta reservar de novo.
      const late = await db
        .prepare("UPDATE orders SET status = 'paid', updated_at = datetime('now') WHERE id = ? AND status IN ('expired','cancelled')")
        .bind(orderId)
        .run();
      if (late.meta.changes === 1) {
        const failed = await reserveStock(db, orderItems(order));
        if (failed.length) {
          await db.prepare("UPDATE orders SET needs_review = 1 WHERE id = ?").bind(orderId).run();
        }
      }
    }
  } else if (["rejected", "cancelled"].includes(payment.status)) {
    const r = await db
      .prepare("UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ? AND status = 'pending'")
      .bind(orderId)
      .run();
    if (r.meta.changes === 1) await restoreStock(db, orderItems(order));
  } else if (["refunded", "charged_back"].includes(payment.status)) {
    // Estorno de pedido já pago: não mexe no estoque automaticamente, só sinaliza.
    await db.prepare("UPDATE orders SET needs_review = 1 WHERE id = ?").bind(orderId).run();
  }
  // pending / in_process: só registra o mp_status.

  return json({ ok: true });
};
