// Mock mínimo da API do Mercado Pago para testes locais.
// Uso: node scripts/mock-mercadopago.mjs   (porta 9999)
// e em .dev.vars: MP_API_BASE=http://localhost:9999
import http from "node:http";

const payments = new Map(); // id -> { id, status, external_reference, transaction_amount }
const preferences = [];

const send = (res, code, data) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(data)); };
const body = (req) => new Promise((ok) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { try { ok(JSON.parse(b || "{}")); } catch { ok({}); } }); });

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "POST" && url.pathname === "/checkout/preferences") {
    const p = await body(req);
    const id = `pref-${preferences.length + 1}`;
    preferences.push({ id, ...p });
    return send(res, 201, { id, init_point: `https://mock.mercadopago/checkout/${id}`, sandbox_init_point: `https://mock.mercadopago/sandbox/${id}` });
  }
  // Rota de controle do teste: registra um pagamento com status desejado
  if (req.method === "POST" && url.pathname === "/__payments") {
    const p = await body(req);
    payments.set(String(p.id), { transaction_amount: 0, ...p });
    return send(res, 200, { ok: true });
  }
  if (req.method === "GET" && url.pathname === "/__preferences") return send(res, 200, preferences);
  const m = url.pathname.match(/^\/v1\/payments\/(.+)$/);
  if (req.method === "GET" && m) {
    const p = payments.get(decodeURIComponent(m[1]));
    return p ? send(res, 200, p) : send(res, 404, { message: "not found" });
  }
  send(res, 404, { message: "mock: rota desconhecida" });
}).listen(9999, () => console.log("mock Mercado Pago em http://localhost:9999"));
