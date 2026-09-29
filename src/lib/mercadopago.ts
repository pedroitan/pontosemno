import { hmacSha256Hex, safeEqual } from "./http";

const DEFAULT_API = "https://api.mercadopago.com";
const base = (b?: string) => (b && b.trim() ? b.trim().replace(/\/+$/, "") : DEFAULT_API);

export interface PreferenceInput {
  orderId: string;
  items: { id: string; title: string; quantity: number; unit_price_cents: number; picture_url?: string }[];
  shippingCents: number;
  payer: { name: string; email: string; phone: string };
  siteUrl: string;
  expiresAt: Date;
}

export interface Preference {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
}

function splitPhone(digits: string): { area_code: string; number: string } {
  const d = digits.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return { area_code: d.slice(0, 2), number: d.slice(2) };
}

export async function createPreference(token: string, input: PreferenceInput, apiBase?: string): Promise<Preference> {
  const https = input.siteUrl.startsWith("https://");
  const back = `${input.siteUrl}/pedido.html?id=${encodeURIComponent(input.orderId)}`;
  const [first, ...rest] = input.payer.name.trim().split(/\s+/);

  const body: Record<string, unknown> = {
    external_reference: input.orderId,
    items: input.items.map((i) => ({
      id: i.id,
      title: i.title,
      quantity: i.quantity,
      currency_id: "BRL",
      unit_price: i.unit_price_cents / 100,
      ...(i.picture_url ? { picture_url: i.picture_url } : {}),
    })),
    shipments: { cost: input.shippingCents / 100, mode: "not_specified" },
    payer: {
      name: first,
      surname: rest.join(" "),
      email: input.payer.email,
      phone: splitPhone(input.payer.phone),
    },
    back_urls: { success: back, pending: back, failure: back },
    statement_descriptor: "PONTOSEMNO",
    expires: true,
    expiration_date_from: new Date().toISOString(),
    expiration_date_to: input.expiresAt.toISOString(),
  };
  // Mercado Pago só aceita auto_return e notification_url com URLs públicas em https.
  if (https) {
    body.auto_return = "approved";
    body.notification_url = `${input.siteUrl}/api/webhooks/mercadopago`;
  }

  const res = await fetch(`${base(apiBase)}/checkout/preferences`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-idempotency-key": input.orderId,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Mercado Pago preference ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
  return (await res.json()) as Preference;
}

export interface Payment {
  id: number;
  status: string; // approved | pending | in_process | rejected | cancelled | refunded | charged_back
  status_detail?: string;
  external_reference: string | null;
  transaction_amount: number;
}

export async function getPayment(token: string, id: string, apiBase?: string): Promise<Payment> {
  const res = await fetch(`${base(apiBase)}/v1/payments/${encodeURIComponent(id)}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Mercado Pago payment ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as Payment;
}

/**
 * Valida o cabeçalho x-signature enviado pelo Mercado Pago.
 * Manifesto: "id:{data.id};request-id:{x-request-id};ts:{ts};"
 * https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
export async function verifyWebhookSignature(
  secret: string,
  signatureHeader: string | null,
  requestId: string | null,
  dataId: string,
): Promise<boolean> {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, ...v] = p.trim().split("=");
      return [k, v.join("=")];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  let manifest = `id:${id};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;
  const expected = await hmacSha256Hex(secret, manifest);
  return safeEqual(expected, v1);
}
