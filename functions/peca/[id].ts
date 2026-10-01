import { releaseExpiredOrders, toProduct } from "../../src/lib/db";
import { siteUrl } from "../../src/lib/http";
import type { Env, Product, ProductRow } from "../../src/lib/types";

// GET /peca/:id — página pública da peça, renderizada no servidor
// (title, og:image e JSON-LD Product por peça, para buscadores e previews de link).

const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const safeJson = (o: unknown): string => JSON.stringify(o).replace(/</g, "\\u003c");

const brl = (cents: number): string =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const img = (file: string): string => (file.startsWith("fotos/") ? `/${encodeURI(file)}` : `/img/${encodeURI(file)}`);

function head(p: Product, base: string): string {
  const url = `${base}/peca/${p.id}`;
  const ogImage = p.images.length ? `${base}${img(p.images[0])}` : `${base}/img/square.jpg`;
  const desc = p.description || `${p.name} · ${p.category} · crochet autoral feito à mão.`;
  const title = `${p.name} · Ponto Sem Nó`;

  const offers =
    p.price_cents !== null
      ? `"offers":{"@type":"Offer","url":"${url}","priceCurrency":"BRL","price":"${(p.price_cents / 100).toFixed(2)}","availability":"https://schema.org/${p.stock > 0 ? "InStock" : "OutOfStock"}","itemCondition":"https://schema.org/NewCondition"},`
      : "";

  const jsonLd = `{"@context":"https://schema.org","@type":"Product","name":${safeJson(p.name)},"image":${safeJson(
    p.images.map((i) => base + img(i)),
  )},"description":${safeJson(desc)},"category":${safeJson(p.category)},"brand":{"@type":"Brand","name":"Ponto Sem Nó"},${offers}"url":"${url}"}`;

  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${ogImage}">
<meta property="og:type" content="product">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="Ponto Sem Nó">
<meta property="og:locale" content="pt_BR">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F5EFE4">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/styles.css">
<script type="application/ld+json">${jsonLd}</script>
<script type="module" src="/assets/peca.js"></script>`;
}

function page(p: Product, base: string): string {
  const vendida = p.stock <= 0;
  const semPreco = p.price_cents === null;
  const status = vendida ? "Vendida" : semPreco ? "Em breve" : "Pronta entrega";

  const thumbs =
    p.images.length > 1
      ? `<div class="thumbs">${p.images
          .map(
            (src, i) =>
              `<button type="button" aria-label="Foto ${i + 1}" aria-current="${i === 0}"><img src="${img(src)}" alt="" loading="lazy"></button>`,
          )
          .join("")}</div>`
      : "";

  const acao = vendida
    ? `<button class="btn btn-solid" type="button" disabled>Peça vendida</button>
       <span class="nota">Esta peça já encontrou dona. Veja as outras no catálogo.</span>`
    : semPreco
      ? `<a class="btn" id="whats" href="#" target="_blank" rel="noopener">Perguntar no WhatsApp</a>
         <span class="nota">Disponível em breve — chame a gente para saber mais.</span>`
      : `<button class="btn btn-solid" id="comprar" type="button">Comprar esta peça</button>
         <a class="btn" id="whats" href="#" target="_blank" rel="noopener">Tirar dúvidas no WhatsApp</a>
         <span class="nota">${p.stock === 1 ? "Peça única." : `${p.stock} disponíveis.`} Reservamos enquanto você paga.</span>`;

  const detalhes = p.details.length
    ? `<ul class="detalhes">${p.details.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>`
    : "";

  return `<!doctype html>
<html lang="pt-BR">
<head>
${head(p, base)}
</head>
<body>

<nav class="nav" aria-label="Principal">
  <div class="wrap">
    <a class="logo" href="/">Ponto <em>Sem Nó</em></a>
    <div class="nav-links">
      <ul><li><a href="/#catalogo">Catálogo</a></li></ul>
      <a class="btn-sacola" href="/#sacola">Sacola <b id="contador">0</b></a>
    </div>
  </div>
</nav>

<main class="pagina">
  <div class="wrap">
    <div class="peca ficha-grid">
      <div class="ficha-galeria">
        <img id="foto" src="${img(p.images[0] ?? "square.jpg")}" alt="${esc(p.name)}" fetchpriority="high">
        ${thumbs}
      </div>
      <div class="ficha-info">
        <span class="eyebrow">${esc(p.category)} · ${status}</span>
        <h1 id="nome">${esc(p.name)}</h1>
        <span class="preco">${p.price_cents !== null ? esc(brl(p.price_cents)) : ""}</span>
        <p>${esc(p.description)}</p>
        ${detalhes}
        <div class="ficha-acoes">${acao}</div>
      </div>
    </div>
  </div>
</main>

<footer class="rodape">
  <div class="wrap">
    <div>
      <a class="logo" href="/">Ponto <em>Sem Nó</em></a>
      <p>Crochet autoral feito à mão com amor. Peças de pronta entrega.</p>
    </div>
    <div>
      <h4>Navegue</h4>
      <ul><li><a href="/">Início</a></li><li><a href="/#sobre">Sobre</a></li><li><a href="/#catalogo">Catálogo</a></li></ul>
    </div>
    <div>
      <h4>Fale com a gente</h4>
      <ul>
        <li><a data-insta href="#" target="_blank" rel="noopener">Instagram</a></li>
        <li><a data-whats href="#" target="_blank" rel="noopener">WhatsApp</a></li>
      </ul>
    </div>
    <div class="copy">© <span data-ano></span> Ponto Sem Nó · Todos os direitos reservados</div>
  </div>
</footer>

<script type="application/json" id="dados-peca">${safeJson({ id: p.id, name: p.name, stock: p.stock, price_cents: p.price_cents, url: `${base}/peca/${p.id}` })}</script>

</body>
</html>`;
}

function notFound(base: string): Response {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Peça não encontrada · Ponto Sem Nó</title><meta name="robots" content="noindex"><link rel="stylesheet" href="/assets/styles.css"></head><body><main class="pagina"><div class="wrap"><h1>Peça não encontrada</h1><p>Esta peça pode ter saído do catálogo.</p><p><a class="btn" href="${base}/#catalogo">Ver o catálogo</a></p></div></main></body></html>`;
  return new Response(html, { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
}

export const onRequestGet: PagesFunction<Env> = async ({ env, params, request }) => {
  const id = String(params.id);
  await releaseExpiredOrders(env.DB);
  const row = await env.DB
    .prepare("SELECT * FROM products WHERE id = ? AND active = 1")
    .bind(id)
    .first<ProductRow>();
  const base = siteUrl(env.SITE_URL, request);
  if (!row) return notFound(base);
  return new Response(page(toProduct(row), base), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
};
