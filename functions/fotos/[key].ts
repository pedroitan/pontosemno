import type { Env } from "../../src/lib/types";

// GET /fotos/:key — serve fotos enviadas pelo /admin (armazenadas no KV FOTOS).
export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const key = String(params.key ?? "");
  if (!/^[a-z0-9-]+\.(jpe?g|png|webp|avif)$/.test(key)) {
    return new Response("Not found", { status: 404 });
  }
  const { value, metadata } = await env.FOTOS.getWithMetadata<{ contentType?: string }>(key, "arrayBuffer");
  if (!value) return new Response("Not found", { status: 404 });
  return new Response(value, {
    headers: {
      "content-type": metadata?.contentType ?? "image/jpeg",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
};
