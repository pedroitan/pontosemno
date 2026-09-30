import {
  addToCart, brl, cartCount, esc, fetchCatalog, getCart, img, isAvailable, onCartChange,
  removeFromCart, resolveCart, setYearAndContacts, shippingFor, waLink,
} from "./shop.js";

const $ = (s) => document.querySelector(s);
let PRODUCTS = [];
let SHIPPING = null;
let filtro = "Todas";

function priceLabel(p) {
  if (p.stock <= 0) return "Vendida";
  if (p.price_cents === null) return "Em breve";
  return brl(p.price_cents);
}

function card(p) {
  const sold = p.stock <= 0;
  const b = document.createElement("button");
  b.type = "button";
  b.className = "card" + (sold ? " is-sold" : "");
  b.innerHTML = `
    <div class="card-img">
      <img src="${img(p.images[0] ?? "")}" alt="${esc(p.name)}" loading="lazy">
      <span class="tag ${sold ? "vendida" : ""}">${sold ? "Vendida" : "Pronta entrega"}</span>
    </div>
    <div class="card-info"><h3>${esc(p.name)}</h3><span class="preco">${esc(priceLabel(p))}</span></div>
    <span class="meta">${esc(p.category)}</span>`;
  b.addEventListener("click", () => abrirFicha(p));
  return b;
}

function renderDestaques() {
  const el = $("#destaques");
  el.innerHTML = "";
  const list = PRODUCTS.filter((p) => p.featured && p.stock > 0).slice(0, 3);
  (list.length ? list : PRODUCTS.filter((p) => p.stock > 0).slice(0, 3)).forEach((p) => el.appendChild(card(p)));
}

function renderFiltros() {
  const cats = ["Todas", ...new Set(PRODUCTS.map((p) => p.category))];
  const el = $("#filtros");
  el.innerHTML = "";
  if (cats.length <= 2) return;
  cats.forEach((c) => {
    const n = c === "Todas" ? PRODUCTS.length : PRODUCTS.filter((p) => p.category === c).length;
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-pressed", String(c === filtro));
    b.innerHTML = `${esc(c)}<sup>${n}</sup>`;
    b.addEventListener("click", () => { filtro = c; renderFiltros(); renderGrade(); });
    el.appendChild(b);
  });
}

function renderGrade() {
  const el = $("#grade");
  el.innerHTML = "";
  const list = PRODUCTS
    .filter((p) => filtro === "Todas" || p.category === filtro)
    .sort((a, b) => (a.stock <= 0) - (b.stock <= 0));
  if (!list.length) el.innerHTML = `<p class="carregando">Novas peças chegando em breve.</p>`;
  list.forEach((p) => el.appendChild(card(p)));
}

// ---------- ficha ----------
const ficha = $("#ficha");
function abrirFicha(p) {
  $("#ficha-cat").textContent = p.category + (p.stock <= 0 ? " · Vendida" : " · Pronta entrega");
  $("#ficha-nome").textContent = p.name;
  $("#ficha-preco").textContent = priceLabel(p);
  $("#ficha-desc").textContent = p.description;
  $("#ficha-detalhes").innerHTML = p.details.map((d) => `<li>${esc(d)}</li>`).join("");

  const main = $("#ficha-img");
  const th = $("#ficha-thumbs");
  const show = (i) => {
    main.src = img(p.images[i]); main.alt = p.name;
    [...th.children].forEach((t, j) => t.setAttribute("aria-current", String(i === j)));
  };
  th.innerHTML = "";
  if (p.images.length > 1) p.images.forEach((src, i) => {
    const t = document.createElement("button");
    t.type = "button"; t.setAttribute("aria-label", `Foto ${i + 1}`);
    t.innerHTML = `<img src="${img(src)}" alt="">`;
    t.addEventListener("click", () => show(i));
    th.appendChild(t);
  });
  show(0);

  const add = $("#ficha-add");
  const inCart = getCart().find((i) => i.id === p.id);
  const nota = $("#ficha-nota");
  add.onclick = null;
  if (!isAvailable(p)) {
    add.disabled = true;
    add.textContent = p.stock <= 0 ? "Peça vendida" : "Disponível em breve";
    nota.textContent = p.stock <= 0 ? "Esta peça já encontrou dona. Veja as outras no catálogo." : "Chame a gente no WhatsApp para saber mais.";
  } else if (inCart && inCart.qty >= p.stock) {
    add.disabled = false;
    add.textContent = "Ver sacola";
    add.onclick = () => { ficha.close(); abrirSacola(); };
    nota.textContent = p.stock === 1 ? "Peça única. Já está na sua sacola." : "Você já colocou todo o estoque desta peça.";
  } else {
    add.disabled = false;
    add.textContent = "Colocar na sacola";
    add.onclick = () => { addToCart(p.id, 1, p.stock); ficha.close(); abrirSacola(); };
    nota.textContent = p.stock === 1 ? "Peça única." : `${p.stock} disponíveis.`;
  }
  $("#ficha-whats").href = waLink(`Olá! Vi a peça "${p.name}" no site da Ponto Sem Nó (${location.origin}/peca/${p.id}) e tenho uma dúvida.`);
  $("#ficha-pagina").href = `/peca/${p.id}`;
  history.replaceState(null, "", `#peca-${p.id}`);
  if (!ficha.open) ficha.showModal();
}
ficha.addEventListener("close", () => {
  if (location.hash.startsWith("#peca-")) history.replaceState(null, "", location.pathname + location.search);
});

// ---------- sacola ----------
const sacola = $("#sacola");
function abrirSacola() { renderSacola(); if (!sacola.open) sacola.showModal(); }

function renderSacola() {
  const { lines, subtotal } = resolveCart(PRODUCTS);
  const lista = $("#sacola-lista");
  const rodape = $("#sacola-rodape");
  if (!lines.length) {
    lista.innerHTML = `<div class="sacola-vazia"><p>Sua sacola está vazia.</p><a class="btn" href="#catalogo" id="ver-cat">Ver o catálogo</a></div>`;
    $("#ver-cat").addEventListener("click", () => sacola.close());
    rodape.hidden = true;
    return;
  }
  rodape.hidden = false;
  lista.innerHTML = "";
  lines.forEach((l) => {
    const p = l.product;
    const row = document.createElement("div");
    row.className = "linha-item";
    row.innerHTML = `
      ${p ? `<img src="${img(p.images[0] ?? "")}" alt="">` : `<span></span>`}
      <div>
        <h4>${esc(p ? p.name : "Peça indisponível")}</h4>
        <span class="nota">${l.qty > 1 ? `${l.qty} unidades · ` : ""}${p ? esc(p.category) : ""}</span>
        ${l.ok ? "" : `<span class="aviso">Não está mais disponível</span>`}
        <button class="btn-link" type="button">Remover</button>
      </div>
      <span class="preco">${l.ok ? brl(p.price_cents * l.qty) : "—"}</span>`;
    row.querySelector(".btn-link").addEventListener("click", () => removeFromCart(l.id));
    lista.appendChild(row);
  });
  const frete = shippingFor(subtotal, SHIPPING);
  $("#s-subtotal").textContent = brl(subtotal);
  $("#s-frete").textContent = frete === 0 ? "Grátis" : brl(frete);
  $("#s-total").textContent = brl(subtotal + frete);
  const go = $("#ir-checkout");
  const anyOk = lines.some((l) => l.ok);
  go.setAttribute("aria-disabled", String(!anyOk));
}

function atualizaContador() { $("#contador").textContent = cartCount(); }

$("#abrir-sacola").addEventListener("click", abrirSacola);
document.querySelectorAll("[data-fechar]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
document.querySelectorAll("dialog").forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));
onCartChange(() => { atualizaContador(); if (sacola.open) renderSacola(); });

// ---------- boot ----------
setYearAndContacts();
atualizaContador();
fetchCatalog()
  .then(({ products, shipping }) => {
    PRODUCTS = products;
    SHIPPING = shipping;
    renderDestaques(); renderFiltros(); renderGrade();
    const m = location.hash.match(/^#peca-(.+)$/);
    if (m) { const p = PRODUCTS.find((x) => x.id === decodeURIComponent(m[1])); if (p) abrirFicha(p); }
    if (location.hash === "#sacola") abrirSacola();
  })
  .catch(() => {
    const msg = `<p class="carregando">Não conseguimos carregar o catálogo. Atualize a página em instantes.</p>`;
    $("#grade").innerHTML = msg; $("#destaques").innerHTML = msg;
  });
