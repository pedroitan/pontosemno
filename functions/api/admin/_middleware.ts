import { fail, safeEqual } from "../../../src/lib/http";
import type { Env } from "../../../src/lib/types";

// Protege /api/admin/* com Bearer token. Recomenda-se também Cloudflare Access na frente de /admin.
export const onRequest: PagesFunction<Env> = async ({ request, env, next }) => {
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 12) return fail(503, "ADMIN_TOKEN não configurado (mínimo 12 caracteres).");
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!safeEqual(token, env.ADMIN_TOKEN)) return fail(401, "Senha incorreta.");
  return next();
};
