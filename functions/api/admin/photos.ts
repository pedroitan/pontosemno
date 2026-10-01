import { fail, json, readJson } from "../../../src/lib/http";
import type { Env } from "../../../src/lib/types";

const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};
const MAX_BYTES = 8 * 1024 * 1024;

// POST /api/admin/photos — recebe o binário da imagem no corpo (o admin.js já
// redimensiona para WebP ≤1600px) e grava no KV. Responde { image: "fotos/<key>" }.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const type = request.headers.get("content-type")?.split(";")[0].trim() ?? "";
  const ext = TYPES[type];
  if (!ext) return fail(415, "Formato inválido. Envie JPEG, PNG, WebP ou AVIF.");

  const body = await request.arrayBuffer();
  if (body.byteLength === 0) return fail(400, "Arquivo vazio.");
  if (body.byteLength > MAX_BYTES) return fail(413, "Imagem maior que 8 MB.");

  const key = `${crypto.randomUUID()}.${ext}`;
  await env.FOTOS.put(key, body, { metadata: { contentType: type } });
  return json({ image: `fotos/${key}` }, 201);
};

// DELETE /api/admin/photos — corpo { image: "fotos/<key>" }
export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson<{ image?: string }>(request);
  const image = body?.image?.trim() ?? "";
  if (!/^fotos\/[a-z0-9-]+\.(jpe?g|png|webp|avif)$/.test(image)) return fail(400, "Imagem inválida.");
  await env.FOTOS.delete(image.slice("fotos/".length));
  return json({ ok: true });
};
