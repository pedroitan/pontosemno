import { brl, esc, img } from "./shop.js";

const $ = (s) => document.querySelector(s);
const KEY = "psn_admin_token";
let token = "";
try { token = sessionStorage.getItem(KEY) || ""; } catch {}
let filtroStatus = "paid";

const STATUS_PT = { pending: "Aguardando", paid: "Pago", shipped: "Enviado", delivered: "Entregue", expired: "Expirado", cancelled: "Cancelado" };
const NEXT = { pending: ["cancelled"], paid: ["shipped", "cancelled"], shipped: ["delivered"], delivered: [], expired: [], cancelled: [] };

async function api(path, opts = {}) {
  const r = await fetch(path, {
    ...opts,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) { logout(); throw new Error(data.error || "Senha incorreta."); }
  if (!r.ok) throw new Error(data.error || `Erro ${r.status}`);
  return data;
}

function aviso(msg, ok = true) {
  const el = $("#aviso");
  el.className = "msg " + (ok ? "ok" : "erro");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => (el.hidden = true), 4000);
}

const toCents = (v) => {
  const s = String(v).trim().replace(/\s|R\$/g, "");
  if (!s) return null;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};
const fromCents = (c) => (c === null ? "" : (c / 100).toFixed(2).replace(".", ","));

// ---------- login ----------
function logout() {
  token = "";
  try { sessionStorage.removeItem(KEY); } catch {}
  $("#painel").hidden = true; $("#login").hidden = false; $("#sair").hidden = true;
}
async function entrar() {
  try {
    await api("/api/admin/products");
    try { sessionStorage.setItem(KEY, token); } catch {}
    $("#login").hidden = true; $("#painel").hidden = false; $("#sair").hidden = false;
    carregarPedidos(); carregarPecas();
  } catch (e) {
    $("#login-erro").textContent = e.message; $("#login-erro").hidden = false;
  }
}
$("#login").addEventListener("submit", (e) => { e.preventDefault(); token = $("#token").value.trim(); entrar(); });
$("#sair").addEventListener("click", logout);

// ---------- abas ----------
document.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll("[data-tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
  $("#tab-pedidos").hidden = b.dataset.tab !== "pedidos";
  $("#tab-pecas").hidden = b.dataset.tab !== "pecas";
}));

// ---------- pedidos ----------
function renderFiltroPedidos() {
  const el = $("#filtro-pedidos");
  el.innerHTML = "";
  [["paid", "A enviar"], ["shipped", "Enviados"], ["pending", "Aguardando"], ["", "Todos"]].forEach(([s, label]) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = label;
    b.setAttribute("aria-pressed", String(s === filtroStatus));
    b.addEventListener("click", () => { filtroStatus = s; renderFiltroPedidos(); carregarPedidos(); });
    el.appendChild(b);
  });
}

async function carregarPedidos() {
  renderFiltroPedidos();
  const tbody = $("#lista-pedidos");
  tbody.innerHTML = `<tr><td colspan="8" class="nota">Carregando…</td></tr>`;
  try {
    const { orders } = await api(`/api/admin/orders${filtroStatus ? `?status=${filtroStatus}` : ""}`);
    if (!orders.length) { tbody.innerHTML = `<tr><td colspan="8" class="nota">Nenhum pedido aqui.</td></tr>`; return; }
    tbody.innerHTML = "";
    orders.forEach((o) => {
      const a = o.address, c = o.customer;
      const tr = document.createElement("tr");
      const opts = NEXT[o.status].map((s) => `<option value="${s}">${STATUS_PT[s]}</option>`).join("");
      tr.innerHTML = `
        <td><b>${esc(o.id.slice(0, 8).toUpperCase())}</b></td>
        <td>${esc(new Date(o.created_at.replace(" ", "T") + "Z").toLocaleString("pt-BR"))}</td>
        <td><b>${esc(c.name)}</b><div class="endereco">${esc(c.email)} · ${esc(c.phone)}<br>${esc(a.street)}, ${esc(a.number)}${a.complement ? " – " + esc(a.complement) : ""}<br>${esc(a.district)} · ${esc(a.city)}/${esc(a.state)} · CEP ${esc(a.cep)}</div></td>
        <td>${o.items.map((i) => `${esc(i.name)}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join("<br>")}</td>
        <td class="preco">${brl(o.total_cents)}</td>
        <td><span class="pill ${o.status}">${STATUS_PT[o.status]}</span>${o.needs_review ? ` <span class="pill review" title="Pago depois da reserva expirar sem estoque, ou estornado">Revisar</span>` : ""}</td>
        <td><input type="text" class="rastreio" value="${esc(o.tracking_code ?? "")}" placeholder="Código" style="width:130px"></td>
        <td>${opts ? `<select class="novo-status"><option value="">Mudar para…</option>${opts}</select>` : ""} <button class="btn mini salvar" type="button">Salvar</button></td>`;
      tr.querySelector(".salvar").addEventListener("click", async () => {
        const body = { tracking_code: tr.querySelector(".rastreio").value };
        const ns = tr.querySelector(".novo-status")?.value;
        if (ns) body.status = ns;
        if (ns === "shipped" && !body.tracking_code.trim()) return aviso("Informe o código de rastreio antes de marcar como enviado.", false);
        try { await api(`/api/admin/orders/${o.id}`, { method: "PATCH", body: JSON.stringify(body) }); aviso("Pedido atualizado."); carregarPedidos(); carregarPecas(); }
        catch (e) { aviso(e.message, false); }
      });
      tbody.appendChild(tr);
    });
  } catch (e) { tbody.innerHTML = `<tr><td colspan="8" class="nota">${esc(e.message)}</td></tr>`; }
}

// ---------- peças ----------
async function carregarPecas() {
  const tbody = $("#lista-pecas");
  try {
    const { products } = await api("/api/admin/products");
    tbody.innerHTML = "";
    products.forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><img src="${img(p.images[0] ?? "")}" alt=""></td>
        <td><b>${esc(p.name)}</b><div class="nota">${esc(p.category)} · /#peca-${esc(p.id)}</div></td>
        <td><input type="text" class="preco-in" inputmode="decimal" value="${fromCents(p.price_cents)}" placeholder="sem preço"></td>
        <td><input type="number" class="estoque-in" min="0" value="${p.stock}"></td>
        <td><input type="number" class="ordem-in" value="${p.sort}"></td>
        <td><input type="checkbox" class="dest-in" ${p.featured ? "checked" : ""} aria-label="Destaque"></td>
        <td><input type="checkbox" class="ativa-in" ${p.active ? "checked" : ""} aria-label="Ativa"></td>
        <td><button class="btn mini" type="button">Salvar</button></td>`;
      tr.querySelector("button").addEventListener("click", async () => {
        const cents = toCents(tr.querySelector(".preco-in").value);
        if (Number.isNaN(cents)) return aviso("Preço inválido. Use o formato 189,90.", false);
        const body = {
          price_cents: cents,
          stock: Number(tr.querySelector(".estoque-in").value),
          sort: Number(tr.querySelector(".ordem-in").value),
          featured: tr.querySelector(".dest-in").checked,
          active: tr.querySelector(".ativa-in").checked,
        };
        try { await api(`/api/admin/products/${p.id}`, { method: "PATCH", body: JSON.stringify(body) }); aviso(`${p.name} salva.`); }
        catch (e) { aviso(e.message, false); }
      });
      tbody.appendChild(tr);
    });
  } catch (e) { tbody.innerHTML = `<tr><td colspan="8" class="nota">${esc(e.message)}</td></tr>`; }
}

$("#n-nome").addEventListener("input", (e) => {
  const idEl = $("#n-id");
  if (idEl.dataset.touched) return;
  idEl.value = e.target.value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
});
$("#n-id").addEventListener("input", (e) => (e.target.dataset.touched = "1"));

$("#nova").addEventListener("submit", async (e) => {
  e.preventDefault();
  const lines = (id) => $(id).value.split("\n").map((s) => s.trim()).filter(Boolean);
  const cents = toCents($("#n-preco").value);
  if (Number.isNaN(cents)) return aviso("Preço inválido. Use o formato 189,90.", false);
  const body = {
    id: $("#n-id").value.trim(), name: $("#n-nome").value.trim(), category: $("#n-cat").value,
    description: $("#n-desc").value.trim(), details: lines("#n-det"), images: lines("#n-img"),
    price_cents: cents, stock: Number($("#n-estoque").value), featured: false, active: true, sort: 100,
  };
  try { await api("/api/admin/products", { method: "POST", body: JSON.stringify(body) }); aviso(`${body.name} cadastrada.`); e.target.reset(); delete $("#n-id").dataset.touched; carregarPecas(); }
  catch (err) { aviso(err.message, false); }
});

if (token) entrar();
