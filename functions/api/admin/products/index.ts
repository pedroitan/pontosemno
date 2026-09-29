import { listProducts } from "../../../../src/lib/db";
import { fail, json, readJson } from "../../../../src/lib/http";
import type { Env } from "../../../../src/lib/types";
import { productInput, type ProductInput } from "../../../../src/lib/product-input";

// GET /api/admin/products — todas as peças, inclusive inativas
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  return json({ products: await listProducts(env.DB, true) });
};

// POST /api/admin/products — cria peça
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson<Record<string, unknown>>(request);
  if (!body) return fail(400, "JSON inválido.");
  const parsed = productInput(body, true);
  if ("error" in parsed) return fail(400, parsed.error);
  const p = parsed.value as ProductInput;
  const exists = await env.DB.prepare("SELECT 1 FROM products WHERE id = ?").bind(p.id).first();
  if (exists) return fail(409, "Já existe uma peça com esse identificador.");
  await env.DB
    .prepare(
      `INSERT INTO products (id, name, category, description, details, images, price_cents, stock, featured, active, sort)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      p.id, p.name, p.category, p.description ?? "", JSON.stringify(p.details ?? []), JSON.stringify(p.images ?? []),
      p.price_cents ?? null, p.stock ?? 1, p.featured ? 1 : 0, p.active === false ? 0 : 1, p.sort ?? 0,
    )
    .run();
  return json({ ok: true, id: p.id }, 201);
};
