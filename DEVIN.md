# Guia para o Devin · Ponto Sem Nó

Leia este arquivo inteiro antes de mexer no código. O `README.md` explica como rodar e publicar.

## Prompt inicial (colar na primeira sessão do Devin)

> Este repositório é a loja online da Ponto Sem Nó, marca de crochet autoral. Leia `DEVIN.md` e `README.md`. Primeiro, rode o projeto localmente, execute `scripts/smoke-test.mjs` contra o mock do Mercado Pago e confirme que todos os testes passam. Depois, execute a tarefa **T1 (Publicação inicial)** da seção "Roteiro". Pare e me peça as credenciais quando precisar de `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `ADMIN_TOKEN` e do acesso à conta Cloudflare. Não invente preços, textos de política ou dados da empresa: pergunte.

## Contexto do negócio

- Marca: **Ponto Sem Nó**. Crochet feito à mão: bolsas, pochetes, tops e blusas.
- Vende **apenas peças em estoque**, sem encomendas. Muitas peças são únicas (estoque 1).
- Canais: Instagram e este site. Público amplo; tom **elegante e inspirador**, boho/artesanal, "feito à mão com amor".
- Todo o texto do site é em **português do Brasil**, tratando a cliente no feminino quando for preciso escolher ("Você será levada ao pagamento").

## Identidade visual (não mude sem pedido)

- Fontes: **Cormorant Garamond** (títulos, itálico em destaques) + **Jost** 300/400/500 (corpo e rótulos em caixa alta com espaçamento).
- Cores (tokens em `public/assets/styles.css`): creme `#F5EFE4`, areia `#E8D9C0`, linho `#EFE5D3`, caramelo `#C49A6C`, terracota `#A85C3A` (ação principal), ferrugem `#7B3F22`, cacau `#3B2012` (texto).
- Botões em pílula, cantos retos nos cards, fotos com proporção 4:5, bastante respiro.
- Sem emojis na interface. Sem gradientes. Tema único claro.

## Arquitetura

```
Navegador ──> public/*.html + assets/*.js (ES modules, sem build)
                 │  fetch /api/*
                 ▼
functions/api/** compiladas p/ .worker ──> D1 (products, orders)
                 │
                 └──> Mercado Pago Checkout Pro (preferência) ──> webhook /api/webhooks/mercadopago
```

| Rota | Arquivo | Função |
|---|---|---|
| `GET /api/products` | `functions/api/products.ts` | Catálogo ativo + regras de frete. Libera reservas vencidas. |
| `POST /api/checkout` | `functions/api/checkout.ts` | Valida sacola e endereço, reserva estoque, cria pedido e preferência MP. |
| `GET /api/orders/:id` | `functions/api/orders/[id].ts` | Status público do pedido (id é UUID). |
| `POST /api/webhooks/mercadopago` | `functions/api/webhooks/mercadopago.ts` | Valida `x-signature`, consulta o pagamento, atualiza pedido e estoque. |
| `/api/admin/*` | `functions/api/admin/**` | Protegido por `_middleware.ts` (Bearer `ADMIN_TOKEN`). |

Estados do pedido: `pending → paid → shipped → delivered`; `pending → expired | cancelled`. Transições do painel ficam em `functions/api/admin/orders/[id].ts`.

## Regras que não podem quebrar

1. **Preço e estoque vêm sempre do banco.** O navegador manda só `{id, qty}`. Nunca aceite preço do cliente.
2. **Reserva atômica.** `reserveStock` usa `UPDATE ... WHERE stock >= qty` e confere `meta.changes`. Duas pessoas não podem comprar a mesma peça única. Se mudar isso, mantenha o teste 3 do smoke test passando.
3. **Webhook idempotente.** O Mercado Pago reenvia notificações. Toda mudança de status usa `WHERE status = <estado anterior>` e só mexe no estoque se a linha mudou.
4. **Assinatura do webhook** é obrigatória em produção (`MP_WEBHOOK_SECRET`).
5. **Valores em centavos** (inteiros) em todo o backend e banco. Converter para reais só na borda (MP e interface).
6. **Sem dados pessoais em logs.** Não logue e-mail, telefone, endereço nem tokens.
7. **Escapar HTML** de qualquer dado do banco antes de usar `innerHTML` (use `esc()` de `assets/shop.js`).
8. **Build só para a API.** `public/` segue sem build. As functions são compiladas com `npm run build` antes do `wrangler deploy` (necessário no modelo Workers; Pages Functions não rodam mais direto).

## Comandos

```bash
npm run dev                 # site + API em http://localhost:8788
npm run typecheck           # TypeScript das Functions
npm run db:migrate:local    # aplica migrations no D1 local
npm run db:seed:local       # recarrega o catálogo inicial
node scripts/mock-mercadopago.mjs          # mock da API do MP na porta 9999
node scripts/smoke-test.mjs                # teste de fumaça (ver README)
```

Mudanças no banco: crie `migrations/000N_descricao.sql`; nunca edite uma migration já aplicada.

## Roteiro

Tarefas em ordem de prioridade. Cada uma deve terminar com `npm run typecheck` e o smoke test passando, e com o README atualizado se mudar algo de configuração.

### T1 · Publicação inicial
- Criar D1 remoto, aplicar migrations e seed, conectar o repositório via Workers Builds (build `npm run build`, deploy `npx wrangler deploy`).
- Cadastrar secrets, preencher `SITE_URL`, configurar webhook no Mercado Pago.
- Fazer uma compra com credenciais de teste do MP no ambiente publicado e confirmar pedido "pago" no `/admin`.
- **Pronto quando:** compra de teste ponta a ponta funciona no domínio `*.pages.dev`.

### T2 · Proteção do painel com Cloudflare Access
- Aplicação Access cobrindo `/admin*` e `/api/admin*`, liberando só os e-mails indicados pela dona.
- Opcional: no `_middleware.ts`, aceitar também o cabeçalho `Cf-Access-Jwt-Assertion` validado.

### T3 · Frete real (Melhor Envio)
- Substituir o frete fixo (`src/lib/shipping.ts`) por cotação por CEP (PAC e SEDEX) via API do Melhor Envio.
- Peso e dimensões por peça: nova migration com `weight_g`, `length_cm`, `width_cm`, `height_cm`; campos no painel.
- O checkout mostra as opções de frete e o servidor recalcula o valor escolhido antes de criar a preferência.
- **Pronto quando:** o valor do frete no Mercado Pago é sempre calculado no servidor.

### T4 · E-mails transacionais
- Com Resend (ou MailChannels), enviar: pedido confirmado (ao virar `paid`) e pedido enviado (com rastreio).
- Aviso para a dona a cada pedido pago.
- Templates em HTML simples seguindo a identidade visual.

### T5 · Fotos pelo painel (R2)
- Bucket R2 `ponto-sem-no-fotos`, upload no painel com redimensionamento no navegador (máx. 1600px, JPEG ~80%).
- Servir por `/img/*` ou domínio próprio do R2; manter compatibilidade com as fotos atuais em `public/img`.
- Editar lista e ordem de fotos de cada peça.

### T6 · Página própria por peça e compartilhamento
- Rota `/peca/:id` renderizada por Function com `<title>`, `og:image` e `og:description` da peça, para links do Instagram e WhatsApp mostrarem a foto certa.
- `sitemap.xml` gerado a partir do banco.

### T7 · Páginas institucionais
- Trocas e devoluções, prazo de envio, privacidade (LGPD). **Pedir o conteúdo à dona;** não redigir política por conta própria.
- Links no rodapé e no checkout.

### T8 · Qualidade contínua
- GitHub Actions rodando `typecheck` e o smoke test (com mock) em cada pull request.
- Cloudflare Web Analytics no site.

## Pendências que dependem da dona

- Preços de cada peça, WhatsApp e @ do Instagram reais.
- Regras de frete (valor fixo, frete grátis, retirada em mãos?).
- Conta Mercado Pago (CPF ou CNPJ) e domínio próprio.
- Fotos reais das peças. Algumas fotos atuais (Margarida Cru, Margarida Noir, Grafite) parecem prévias geradas por IA; confirmar antes de vender.
- Textos de trocas, devoluções e privacidade.
