# Notas de ambiente (máquina do Pedro)

- **Node do sistema é v20**, mas Wrangler 4 exige ≥22. Rodar os comandos wrangler com:
  `npx -y node@22 node_modules/wrangler/bin/wrangler.js <comando>`
  (os scripts `npm run dev`, `db:migrate:*` etc. chamam `wrangler` direto e falham no Node 20)
- **`localhost:8788` pode responder outro app** (Next.js em IPv6 `::1`). Sempre usar `127.0.0.1`.
- Smoke test local:
  `BASE_URL=http://127.0.0.1:8788 MOCK_URL=http://127.0.0.1:9999 ADMIN_TOKEN=dev-admin-token-local MP_WEBHOOK_SECRET=segredo node scripts/smoke-test.mjs`
  (requer `node scripts/mock-mercadopago.mjs` e o `pages dev` rodando)
- `.dev.vars` local usa o mock: `MP_API_BASE=http://localhost:9999`, `MP_ACCESS_TOKEN=TEST-x`.

## Pendências para publicar (T1)

- Instalar Node 22 (ou nvm-windows/volta) ou manter o truque `npx node@22`.
- `npx wrangler login`, `d1 create`, colar `database_id` em `wrangler.toml`.
- Secrets no Pages: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `ADMIN_TOKEN`.
- `SITE_URL` real + webhook do MP apontando para `/api/webhooks/mercadopago`.
- Repositório ainda não é git — inicializar e conectar ao GitHub para deploy via Pages.
