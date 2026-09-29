-- Ponto Sem Nó — esquema inicial

CREATE TABLE products (
  id           TEXT PRIMARY KEY,               -- slug, ex: "bolsa-argila"
  name         TEXT NOT NULL,
  category     TEXT NOT NULL,                  -- "Bolsas", "Pochetes", "Tops", "Blusas"
  description  TEXT NOT NULL DEFAULT '',
  details      TEXT NOT NULL DEFAULT '[]',     -- JSON: lista de strings
  images       TEXT NOT NULL DEFAULT '[]',     -- JSON: caminhos relativos a /img
  price_cents  INTEGER,                        -- NULL = sem preço, não pode ser comprada
  stock        INTEGER NOT NULL DEFAULT 1 CHECK (stock >= 0),
  featured     INTEGER NOT NULL DEFAULT 0,
  active       INTEGER NOT NULL DEFAULT 1,
  sort         INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- status: pending -> paid -> shipped -> delivered
--         pending -> expired | cancelled
CREATE TABLE orders (
  id               TEXT PRIMARY KEY,           -- UUID, também é o external_reference no Mercado Pago
  status           TEXT NOT NULL,
  items            TEXT NOT NULL,              -- JSON: [{id,name,qty,price_cents}]
  subtotal_cents   INTEGER NOT NULL,
  shipping_cents   INTEGER NOT NULL,
  total_cents      INTEGER NOT NULL,
  customer         TEXT NOT NULL,              -- JSON: {name,email,phone}
  address          TEXT NOT NULL,              -- JSON: {cep,street,number,complement,district,city,state}
  mp_preference_id TEXT,
  mp_payment_id    TEXT,
  mp_status        TEXT,
  tracking_code    TEXT,
  needs_review     INTEGER NOT NULL DEFAULT 0, -- 1 = pago após a reserva expirar e sem estoque
  expires_at       INTEGER NOT NULL,           -- epoch ms do fim da reserva
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_orders_status_expires ON orders (status, expires_at);
CREATE INDEX idx_products_active_sort ON products (active, sort);
