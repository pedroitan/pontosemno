import { intEnv } from "./http";
import type { Env } from "./types";

export interface ShippingRules {
  flat_cents: number;
  free_min_cents: number | null;
}

export function shippingRules(env: Env): ShippingRules {
  return {
    flat_cents: intEnv(env.SHIPPING_FLAT_CENTS, 0) ?? 0,
    free_min_cents: intEnv(env.FREE_SHIPPING_MIN_CENTS, null),
  };
}

/** Frete fixo com frete grátis opcional. Substituir por cotação real (Melhor Envio) — ver DEVIN.md. */
export function shippingFor(subtotalCents: number, rules: ShippingRules): number {
  if (rules.free_min_cents !== null && subtotalCents >= rules.free_min_cents) return 0;
  return rules.flat_cents;
}
