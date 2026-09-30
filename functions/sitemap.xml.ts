import { listProducts } from "../src/lib/db";
import { siteUrl } from "../src/lib/http";
import type { Env } from "../src/lib/types";

// GET /sitemap.xml — gerado do banco: home + página de cada peça ativa.
export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const products = await listProducts(env.DB);
  const base = siteUrl(env.SITE_URL, request);
  const xesc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const urls = [
    `<url><loc>${xesc(base)}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
    ...products.map(
      (p) => `<url><loc>${xesc(base)}/peca/${xesc(p.id)}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`,
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
};
