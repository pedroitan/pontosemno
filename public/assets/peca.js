// Página de peça (/peca/:id): galeria, comprar e contatos.
// Os dados da peça vêm embutidos no HTML (#dados-peca), sem depender da API.
import { addToCart, cartCount, setYearAndContacts, waLink } from "./shop.js";

const $ = (s) => document.querySelector(s);

const dados = JSON.parse(document.getElementById("dados-peca").textContent);

// galeria
const foto = $("#foto");
document.querySelectorAll(".thumbs button").forEach((b) => {
  b.addEventListener("click", () => {
    foto.src = b.querySelector("img").src;
    document.querySelectorAll(".thumbs button").forEach((t) => t.setAttribute("aria-current", String(t === b)));
  });
});

// comprar: coloca na sacola e vai direto ao checkout
const comprar = $("#comprar");
if (comprar) {
  comprar.addEventListener("click", () => {
    addToCart(dados.id, 1, dados.stock);
    location.href = "/checkout.html";
  });
}

// whatsapp com o link da peça
const whats = $("#whats");
if (whats) whats.href = waLink(`Olá! Vi a peça "${dados.name}" no site da Ponto Sem Nó (${dados.url}) e tenho uma dúvida.`);

// contador da sacola no menu
const contador = $("#contador");
if (contador) contador.textContent = cartCount();

setYearAndContacts();
