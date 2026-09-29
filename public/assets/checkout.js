import { brl, esc, fetchCatalog, img, removeFromCart, resolveCart, shippingFor } from "./shop.js";

const $ = (s) => document.querySelector(s);
let PRODUCTS = [];
let SHIPPING = null;

function render() {
  const { lines, subtotal } = resolveCart(PRODUCTS);
  const okLines = lines.filter((l) => l.ok);
  // remove silenciosamente o que não existe mais no catálogo
  lines.filter((l) => !l.product).forEach((l) => removeFromCart(l.id));

  if (!okLines.length) { $("#vazio").hidden = false; $("#conteudo").hidden = true; return; }
  $("#vazio").hidden = true; $("#conteudo").hidden = false;

  $("#resumo-itens").innerHTML = lines.filter((l) => l.product).map((l) => `
    <div class="linha-item">
      <img src="${img(l.product.images[0] ?? "")}" alt="">
      <div><h4>${esc(l.product.name)}</h4>
        ${l.qty > 1 ? `<span class="nota">${l.qty} unidades</span>` : ""}
        ${l.ok ? "" : `<span class="aviso">Não está mais disponível e não será cobrada</span>`}
      </div>
      <span class="preco">${l.ok ? brl(l.product.price_cents * l.qty) : "—"}</span>
    </div>`).join("");
  const frete = shippingFor(subtotal, SHIPPING);
  $("#r-subtotal").textContent = brl(subtotal);
  $("#r-frete").textContent = frete === 0 ? "Grátis" : brl(frete);
  $("#r-total").textContent = brl(subtotal + frete);
}

function showError(msg) {
  const el = $("#erro");
  el.textContent = msg;
  el.hidden = false;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}

// máscara + ViaCEP
$("#cep").addEventListener("input", (e) => {
  const d = e.target.value.replace(/\D/g, "").slice(0, 8);
  e.target.value = d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  if (d.length === 8) buscaCep(d);
});
async function buscaCep(cep) {
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const j = await r.json();
    if (j.erro) return;
    if (!$("#rua").value) $("#rua").value = j.logradouro || "";
    if (!$("#bairro").value) $("#bairro").value = j.bairro || "";
    $("#cidade").value = j.localidade || $("#cidade").value;
    $("#uf").value = j.uf || $("#uf").value;
    $("#numero").focus();
  } catch { /* preenchimento manual */ }
}
$("#telefone").addEventListener("input", (e) => {
  const d = e.target.value.replace(/\D/g, "").slice(0, 11);
  e.target.value = d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
});
$("#uf").addEventListener("input", (e) => (e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, "")));

$("#form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#erro").hidden = true;
  const form = e.target;
  const missing = [...form.querySelectorAll("[required]")].find((i) => !i.value.trim());
  if (missing) { missing.focus(); return showError("Preencha todos os campos obrigatórios."); }

  const { lines } = resolveCart(PRODUCTS);
  const items = lines.filter((l) => l.ok).map((l) => ({ id: l.id, qty: l.qty }));
  const v = (id) => $(id).value.trim();
  const payload = {
    items,
    customer: { name: v("#nome"), email: v("#email"), phone: v("#telefone") },
    address: {
      cep: v("#cep"), street: v("#rua"), number: v("#numero"), complement: v("#complemento"),
      district: v("#bairro"), city: v("#cidade"), state: v("#uf"),
    },
  };

  const btn = $("#pagar");
  btn.disabled = true;
  btn.textContent = "Reservando suas peças…";
  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.checkoutUrl) {
      try { sessionStorage.setItem("psn_ultimo_pedido", data.orderId); } catch {}
      location.href = data.checkoutUrl;
      return;
    }
    if (res.status === 409 && Array.isArray(data.unavailable)) {
      const nomes = data.unavailable.map((id) => PRODUCTS.find((p) => p.id === id)?.name ?? id);
      data.unavailable.forEach(removeFromCart);
      ({ products: PRODUCTS, shipping: SHIPPING } = await fetchCatalog());
      render();
      showError(`${nomes.join(", ")} ${nomes.length > 1 ? "não estão" : "não está"} mais disponível e saiu da sua sacola. Confira o resumo e tente de novo.`);
    } else {
      showError(data.error || "Algo deu errado. Tente de novo em instantes.");
    }
  } catch {
    showError("Sem conexão. Verifique sua internet e tente de novo.");
  }
  btn.disabled = false;
  btn.textContent = "Ir para o pagamento";
});

fetchCatalog()
  .then(({ products, shipping }) => { PRODUCTS = products; SHIPPING = shipping; render(); })
  .catch(() => showError("Não conseguimos carregar sua sacola. Atualize a página."));
