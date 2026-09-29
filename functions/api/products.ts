import { listProducts, releaseExpiredOrders } from "../../src/lib/db";
import { json } from "../../src/lib/http";
import { shippingRules } from "../../src/lib/shipping";
import type { Env } from "../../src/lib/types";

// GET /api/products — catálogo público + regras de frete
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  await releaseExpiredOrders(env.DB);
  const products = await listProducts(env.DB);
  return json({ products, shipping: shippingRules(env) });
};
