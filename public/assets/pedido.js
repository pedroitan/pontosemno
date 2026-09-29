import { brl, clearCart, esc, waLink } from "./shop.js";

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const id = params.get("id") || params.get("external_reference") || "";
let tentativas = 0;

const TEXTOS = {
  paid: ["Pago", "pago", "Pagamento <em>confirmado!</em>", "Obrigada por escolher a Ponto Sem Nó. Sua peça já está sendo embalada com carinho. Você recebe o código de rastreio assim que ela for postada."],
  shipped: ["Enviado", "pago", "Seu pedido está <em>a caminho.</em>", "Acompanhe a entrega pelo código de rastreio abaixo."],
  delivered: ["Entregue", "pago", "Pedido <em>entregue.</em>", "Esperamos que você ame sua peça. Marque a gente no Instagram!"],
  pending: ["Aguardando", "", "Aguardando o <em>pagamento.</em>", "Se você pagou com Pix ou boleto, a confirmação pode levar alguns minutos. Esta página atualiza sozinha."],
  expired: ["Expirado", "falhou", "A reserva <em>expirou.</em>", "O tempo para pagamento acabou e as peças voltaram para o catálogo. Se ainda estiverem disponíveis, é só fazer um novo pedido."],
  cancelled: ["Não concluído", "falhou", "O pagamento <em>não foi concluído.</em>", "Nenhuma cobrança foi feita. As peças voltaram para o catálogo; você pode tentar de novo."],
};

function render(o) {
  const [selo, cls, titulo, texto] = TEXTOS[o.status] ?? TEXTOS.pending;
  $("#selo").textContent = selo;
  $("#selo").className = "selo " + cls;
  $("#titulo").innerHTML = titulo;
  $("#texto").textContent = texto + (o.tracking_code ? ` Rastreio: ${o.tracking_code}` : "");
  $("#codigo").textContent = o.id.slice(0, 8).toUpperCase();
  $("#itens").innerHTML = o.items.map((i) => `
    <div class="linha-item" style="grid-template-columns:1fr auto">
      <div><h4>${esc(i.name)}</h4>${i.qty > 1 ? `<span class="nota">${i.qty} unidades</span>` : ""}</div>
      <span class="preco">${brl(i.price_cents * i.qty)}</span>
    </div>`).join("");
  $("#totais").hidden = false;
  $("#p-subtotal").textContent = brl(o.subtotal_cents);
  $("#p-frete").textContent = o.shipping_cents === 0 ? "Grátis" : brl(o.shipping_cents);
  $("#p-total").textContent = brl(o.total_cents);

  const acoes = $("#acoes");
  const duvida = `<a class="btn" href="${waLink(`Olá! Tenho uma dúvida sobre o pedido ${o.id.slice(0, 8).toUpperCase()}.`)}" target="_blank" rel="noopener">Falar no WhatsApp</a>`;
  acoes.innerHTML = ["paid", "shipped", "delivered"].includes(o.status)
    ? `<a class="btn btn-solid" href="/#catalogo">Ver mais peças</a>${duvida}`
    : `<a class="btn btn-solid" href="/#catalogo">Voltar ao catálogo</a>${duvida}`;

  if (o.status === "paid") clearCart();
}

async function carregar() {
  if (!id) {
    $("#titulo").innerHTML = "Pedido <em>não encontrado.</em>";
    $("#texto").textContent = "Confira o link recebido ou fale com a gente pelo WhatsApp.";
    $("#selo").hidden = true;
    return;
  }
  try {
    const r = await fetch(`/api/orders/${encodeURIComponent(id)}`);
    if (r.status === 404) {
      $("#titulo").innerHTML = "Pedido <em>não encontrado.</em>";
      $("#texto").textContent = "Confira o link recebido ou fale com a gente pelo WhatsApp.";
      return;
    }
    const o = await r.json();
    render(o);
    // Webhook pode chegar alguns segundos depois do redirecionamento
    if (o.status === "pending" && tentativas++ < 40) setTimeout(carregar, tentativas < 10 ? 3000 : 10000);
  } catch {
    if (tentativas++ < 40) setTimeout(carregar, 5000);
  }
}
carregar();
