// Teste de fumaça do fluxo completo contra `wrangler pages dev` + mock do Mercado Pago.
// Pré-requisitos: banco local migrado e com seed; .dev.vars com MP_API_BASE=http://localhost:9999,
// MP_WEBHOOK_SECRET e ADMIN_TOKEN; `node scripts/mock-mercadopago.mjs` e `npm run dev` rodando.
// Uso: ADMIN_TOKEN=... MP_WEBHOOK_SECRET=... node scripts/smoke-test.mjs
import crypto from "node:crypto";

const BASE = process.env.BASE_URL ?? "http://localhost:8788";
const MOCK = process.env.MOCK_URL ?? "http://localhost:9999";
const ADMIN = process.env.ADMIN_TOKEN;
const SECRET = process.env.MP_WEBHOOK_SECRET;
if (!ADMIN || !SECRET) { console.error("Defina ADMIN_TOKEN e MP_WEBHOOK_SECRET"); process.exit(1); }

let failures = 0;
const check = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) failures++; };
const j = (r) => r.json().catch(() => ({}));
const admin = (path, init = {}) => fetch(BASE + path, { ...init, headers: { "content-type": "application/json", authorization: `Bearer ${ADMIN}` } });
const stockOf = async (id) => (await j(await fetch(`${BASE}/api/products`))).products.find((p) => p.id === id)?.stock;

const customer = { name: "Maria Teste", email: "maria@example.com", phone: "(71) 99999-1234" };
const address = { cep: "40000-000", street: "Rua A", number: "10", district: "Centro", city: "Salvador", state: "BA" };
const checkout = (items) => fetch(`${BASE}/api/checkout`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items, customer, address }) });

async function webhook(paymentId, { sign = true } = {}) {
  const ts = String(Math.floor(Date.now() / 1000));
  const reqId = crypto.randomUUID();
  const v1 = crypto.createHmac("sha256", SECRET).update(`id:${paymentId};request-id:${reqId};ts:${ts};`).digest("hex");
  return fetch(`${BASE}/api/webhooks/mercadopago?data.id=${paymentId}&type=payment`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": reqId, "x-signature": `ts=${ts},v1=${sign ? v1 : "0".repeat(64)}` },
    body: JSON.stringify({ type: "payment", data: { id: paymentId } }),
  });
}
const setPayment = (p) => fetch(`${MOCK}/__payments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p) });

// 0. preparar peças de teste
const P1 = "smoke-a", P2 = "smoke-b";
for (const id of [P1, P2]) {
  await admin("/api/admin/products", { method: "POST", body: JSON.stringify({ id, name: `Teste ${id}`, category: "Bolsas", price_cents: 10000, stock: 1, images: ["square.jpg"] }) });
  await admin(`/api/admin/products/${id}`, { method: "PATCH", body: JSON.stringify({ stock: 1, price_cents: 10000, active: true }) });
}

// 1. admin exige senha
check((await fetch(`${BASE}/api/admin/orders`)).status === 401, "admin sem senha retorna 401");

// 2. checkout reserva estoque
let r = await checkout([{ id: P1, qty: 1 }]);
let d = await j(r);
check(r.status === 200 && d.checkoutUrl?.includes("sandbox"), "checkout cria preferência (sandbox com token TEST-)");
check((await stockOf(P1)) === 0, "peça fica reservada (estoque 0)");
const order1 = d.orderId;

// 3. segunda pessoa não consegue comprar a mesma peça única
r = await checkout([{ id: P1, qty: 1 }]);
check(r.status === 409, "peça reservada não pode ser comprada de novo (409)");

// 4. webhook com assinatura inválida
await setPayment({ id: "9001", status: "approved", external_reference: order1 });
check((await webhook("9001", { sign: false })).status === 401, "webhook com assinatura inválida é recusado");

// 5. webhook aprovado marca pago
check((await webhook("9001")).status === 200, "webhook válido aceito");
d = await j(await fetch(`${BASE}/api/orders/${order1}`));
check(d.status === "paid", "pedido fica como pago");
check((await stockOf(P1)) === 0, "peça vendida continua com estoque 0");

// 6. pagamento recusado devolve estoque
r = await checkout([{ id: P2, qty: 1 }]);
const order2 = (await j(r)).orderId;
await setPayment({ id: "9002", status: "rejected", external_reference: order2 });
await webhook("9002");
d = await j(await fetch(`${BASE}/api/orders/${order2}`));
check(d.status === "cancelled", "pagamento recusado cancela o pedido");
check((await stockOf(P2)) === 1, "estoque volta após recusa");

// 7. reenvio do webhook aprovado é idempotente
await webhook("9001");
check((await stockOf(P1)) === 0, "webhook repetido não altera estoque");

// 8. fluxo de envio no admin
r = await admin(`/api/admin/orders/${order1}`, { method: "PATCH", body: JSON.stringify({ status: "shipped", tracking_code: "BR123" }) });
d = await j(await fetch(`${BASE}/api/orders/${order1}`));
check(r.ok && d.status === "shipped" && d.tracking_code === "BR123", "admin marca pedido como enviado com rastreio");
r = await admin(`/api/admin/orders/${order1}`, { method: "PATCH", body: JSON.stringify({ status: "pending" }) });
check(r.status === 400, "transição de status inválida é recusada");

// limpeza: desativa peças de teste
for (const id of [P1, P2]) await admin(`/api/admin/products/${id}`, { method: "PATCH", body: JSON.stringify({ active: false }) });

console.log(failures ? `\n${failures} falha(s)` : "\nTudo certo.");
process.exit(failures ? 1 : 0);
