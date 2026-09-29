import { fail, json, readJson } from "../../../../src/lib/http";
import type { Env } from "../../../../src/lib/types";
import { productInput } from "../../../../src/lib/product-input";

const COLUMNS: Record<string, (v: unknown) => unknown> = {
  name: (v) => v,
  category: (v) => v,
  description: (v) => v,
  details: (v) => JSON.stringify(v),
  images: (v) => JSON.stringify(v),
  price_cents: (v) => v,
  stock: (v) => v,
  featured: (v) => (v ? 1 : 0),
  active: (v) => (v ? 1 : 0),
  sort: (v) => v,
};

// PATCH /api/admin/products/:id — edita campos da peça
export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const id = String(params.id ?? "");
  const body = await readJson<Record<string, unknown>>(request);
  if (!body) return fail(400, "JSON inválido.");
  delete body.id;
  const parsed = productInput(body, false);
  if ("error" in parsed) return fail(400, parsed.error);

  const entries = Object.entries(parsed.value).filter(([k]) => k in COLUMNS);
  if (entries.length === 0) return fail(400, "Nada para atualizar.");
  const sets = entries.map(([k]) => `${k} = ?`).join(", ");
  const values = entries.map(([k, v]) => COLUMNS[k](v));

  const r = await env.DB
    .prepare(`UPDATE products SET ${sets}, updated_at = datetime('now') WHERE id = ?`)
    .bind(...values, id)
    .run();
  if (r.meta.changes === 0) return fail(404, "Peça não encontrada.");
  return json({ ok: true });
};
