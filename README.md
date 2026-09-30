# Ponto Sem Nó · Loja online

Loja de crochet autoral com catálogo, sacola, checkout pelo Mercado Pago (Pix, cartão e boleto), controle de estoque de peças únicas e painel administrativo.

**Stack:** Cloudflare Workers (site estático em `public/` + API em `functions/` compilada para um Worker) + D1 (banco SQLite) + Mercado Pago Checkout Pro. O site não tem build; só a API é compilada (`npm run build`).

```
public/              site (HTML, CSS, JS em módulos, fotos em /img)
  index.html         início, sobre, catálogo, sacola
  checkout.html      dados de entrega e ida ao pagamento
  pedido.html        status do pedido (volta do Mercado Pago)
  /peca/:id          página pública de cada peça (SSR em functions/peca/[id].ts)
  admin/             painel: pedidos e peças
  assets/config.js   WhatsApp e Instagram da loja  ← editar
functions/api/       rotas da API (cada arquivo = uma rota)
src/lib/             código compartilhado da API
migrations/          esquema do banco D1
seed/products.sql    catálogo inicial (9 peças, sem preço)
scripts/             mock do Mercado Pago + teste de fumaça
wrangler.toml        configuração Cloudflare  ← editar database_id e frete
```

## Rodar no computador

Requer Node 20+.

```bash
npm install
cp .dev.vars.example .dev.vars        # preencha ADMIN_TOKEN e as credenciais de TESTE do Mercado Pago
npm run db:migrate:local
npm run db:seed:local
npm run dev                            # http://localhost:8788  ·  painel em /admin
```

Para testar o fluxo completo sem internet nem conta no Mercado Pago:

```bash
# em .dev.vars:  MP_ACCESS_TOKEN=TEST-x  MP_WEBHOOK_SECRET=segredo  ADMIN_TOKEN=uma-senha-longa  MP_API_BASE=http://localhost:9999
node scripts/mock-mercadopago.mjs &
npm run dev &
ADMIN_TOKEN=uma-senha-longa MP_WEBHOOK_SECRET=segredo node scripts/smoke-test.mjs
```

O teste cobre reserva de estoque, compra simultânea da mesma peça, assinatura do webhook, pagamento aprovado e recusado, idempotência e o fluxo de envio no painel.

## Publicar na Cloudflare (Workers)

### 1. Banco de dados

```bash
npx wrangler login
npx wrangler d1 create ponto-sem-no
```

Cole o `database_id` retornado em `wrangler.toml` e rode:

```bash
npm run db:migrate:remote
npm run db:seed:remote
```

### 2. Projeto na Cloudflare

**Opção A: pelo GitHub (recomendado).** No painel Cloudflare: *Workers & Pages > Create > Import a repository*, escolha o repositório e configure:

| Campo | Valor |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |

O `npm run build` compila `functions/` em `.worker/index.js` e o deploy sobe o Worker com os assets de `public/`. A cada push na `main` o site é publicado.

**Opção B: pela linha de comando.**

```bash
npm run deploy   # build das functions + wrangler deploy
```

### 3. Secrets

No painel: *seu Worker > Settings > Variables and Secrets*, tipo **Secret**:

| Nome | Onde conseguir |
|---|---|
| `MP_ACCESS_TOKEN` | Mercado Pago > Suas integrações > sua aplicação > Credenciais de **produção** |
| `MP_WEBHOOK_SECRET` | Mercado Pago > Suas integrações > Webhooks > Assinatura secreta |
| `ADMIN_TOKEN` | Invente uma senha longa (`openssl rand -hex 24`) |

Ou pelo terminal: `npx wrangler secret put MP_ACCESS_TOKEN`.

Depois, em `wrangler.toml`, preencha `SITE_URL` com o endereço final (ex.: `https://pontosemno.com.br`) e publique de novo.

### 4. Mercado Pago

1. Crie uma aplicação em https://www.mercadopago.com.br/developers/panel/app (tipo *Pagamentos online*, produto *Checkout Pro*).
2. Em **Webhooks**, cadastre a URL `https://SEU-DOMINIO/api/webhooks/mercadopago` com o evento **Pagamentos**. Copie a assinatura secreta para `MP_WEBHOOK_SECRET`.
3. Teste com as credenciais de teste e os cartões de teste do Mercado Pago antes de trocar para produção.

### 5. Antes de abrir a loja

- [ ] Entrar em `/admin` e definir o **preço** de cada peça. Peças sem preço aparecem como "Em breve" e não podem ser compradas.
- [ ] Editar `public/assets/config.js` com o **WhatsApp** e o **Instagram** reais.
- [ ] Ajustar o **frete** em `wrangler.toml` (`SHIPPING_FLAT_CENTS`, `FREE_SHIPPING_MIN_CENTS`).
- [ ] Trocar as fotos que forem prévias geradas por IA pelas fotos reais das peças em estoque.
- [ ] Proteger `/admin` com **Cloudflare Access** (Zero Trust > Access > Applications, caminho `/admin*` e `/api/admin*`, liberar só o seu e-mail). A senha continua valendo como segunda camada.
- [ ] Fazer uma compra real de valor baixo e estornar pelo Mercado Pago.

## Como funciona o estoque

Cada peça tem um número em estoque (peças únicas = 1). Ao ir para o pagamento, a peça é **reservada** por `RESERVATION_MINUTES` (30 min). Se o pagamento não chega nesse tempo, a reserva expira e a peça volta ao catálogo. Se o pagamento aprovado chegar depois disso (acontece com Pix e boleto), o sistema tenta reservar de novo; se outra pessoa já tiver levado a peça, o pedido aparece no painel com o selo **Revisar** para você combinar com a cliente ou estornar.

## Painel `/admin`

- **Pedidos:** "A enviar" mostra os pagos. Informe o código de rastreio e mude para "Enviado". Depois, "Entregue".
- **Peças:** preço, estoque, ordem de exibição, destaque na página inicial e ativar/esconder. Cadastro de peça nova (as fotos precisam estar em `public/img`; upload pelo painel está no roteiro do `DEVIN.md`).
