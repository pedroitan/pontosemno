# Notas de ambiente (máquina do Pedro)

- **Node do sistema é v20**, mas Wrangler 4 exige ≥22. Rodar os comandos wrangler com:
  `npx -y node@22 node_modules/wrangler/bin/wrangler.js <comando>`
  (os scripts `npm run dev`, `db:migrate:*` etc. chamam `wrangler` direto e falham no Node 20)
- **`localhost:8788` pode responder outro app** (Next.js em IPv6 `::1`). Sempre usar `127.0.0.1`.
- Smoke test local:
  `BASE_URL=http://127.0.0.1:8788 MOCK_URL=http://127.0.0.1:9999 ADMIN_TOKEN=dev-admin-token-local MP_WEBHOOK_SECRET=segredo node scripts/smoke-test.mjs`
  (requer `node scripts/mock-mercadopago.mjs` e o `pages dev` rodando)
- `.dev.vars` local usa o mock: `MP_API_BASE=http://localhost:9999`, `MP_ACCESS_TOKEN=TEST-x`.

## Arquitetura de deploy (29/09/2026)

O app foi migrado de Pages para **Worker** (o fluxo "Create an app"/Workers Builds do
dashboard não aceita `wrangler pages deploy` — o token da build só tem permissão de Workers).

- `wrangler.toml`: `main = ./.worker/index.js` + `[assets] directory = ./public`.
- `npm run build` compila `functions/` → `.worker/index.js` (`wrangler pages functions build`).
- `npm run dev` = `wrangler pages dev public` (segue devendo Node 22 via `npx node@22`).
- Deploy CI (dashboard): build `npm run build`, deploy `npx wrangler deploy`.
- Deploy manual: `npm run deploy`.
- Site: https://pontosemno.pedroitan.workers.dev
- D1 `ponto-sem-no` criado (id em `wrangler.toml`), migrado e com seed.
- Secret `ADMIN_TOKEN` configurado (cópia local em `.admin-token.txt`, gitignored).

## Pendências

- Secrets `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` (credenciais do Mercado Pago).
- Cadastrar webhook no painel do MP: `https://pontosemno.pedroitan.workers.dev/api/webhooks/mercadopago`.
- Definir preços das peças no `/admin`, WhatsApp/Instagram em `public/assets/config.js`, frete em `wrangler.toml`.
- Domínio próprio: atualizar `SITE_URL` e o webhook do MP.
