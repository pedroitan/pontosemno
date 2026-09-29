import type { OrderItem, OrderRow, Product, ProductRow } from "./types";

function parseList(value: string): string[] {
  try {
    const v = JSON.parse(value);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    details: parseList(row.details),
    images: parseList(row.images),
    price_cents: row.price_cents,
    stock: row.stock,
    featured: row.featured === 1,
    active: row.active === 1,
    sort: row.sort,
  };
}

export async function listProducts(db: D1Database, includeInactive = false): Promise<Product[]> {
  const sql = includeInactive
    ? "SELECT * FROM products ORDER BY sort, name"
    : "SELECT * FROM products WHERE active = 1 ORDER BY sort, name";
  const { results } = await db.prepare(sql).all<ProductRow>();
  return results.map(toProduct);
}

/**
 * Tenta reservar (baixar estoque) de todos os itens. Cada UPDATE só altera a linha
 * se houver estoque suficiente, então duas compras simultâneas da mesma peça única
 * não passam juntas. Se algum item falhar, devolve o que já foi baixado.
 * Retorna a lista de ids que não puderam ser reservados (vazia = sucesso).
 */
export async function reserveStock(db: D1Database, items: { id: string; qty: number }[]): Promise<string[]> {
  const done: { id: string; qty: number }[] = [];
  const failed: string[] = [];
  for (const it of items) {
    const r = await db
      .prepare(
        "UPDATE products SET stock = stock - ?1, updated_at = datetime('now') WHERE id = ?2 AND active = 1 AND stock >= ?1",
      )
      .bind(it.qty, it.id)
      .run();
    if (r.meta.changes === 1) done.push(it);
    else failed.push(it.id);
  }
  if (failed.length > 0 && done.length > 0) await restoreStock(db, done);
  return failed;
}

export async function restoreStock(db: D1Database, items: { id: string; qty: number }[]): Promise<void> {
  if (items.length === 0) return;
  await db.batch(
    items.map((it) =>
      db
        .prepare("UPDATE products SET stock = stock + ?1, updated_at = datetime('now') WHERE id = ?2")
        .bind(it.qty, it.id),
    ),
  );
}

export function orderItems(row: Pick<OrderRow, "items">): OrderItem[] {
  try {
    return JSON.parse(row.items) as OrderItem[];
  } catch {
    return [];
  }
}

/** Expira pedidos pendentes cuja reserva venceu e devolve as peças ao estoque. */
export async function releaseExpiredOrders(db: D1Database, now = Date.now()): Promise<number> {
  const { results } = await db
    .prepare("SELECT id, items FROM orders WHERE status = 'pending' AND expires_at < ? LIMIT 50")
    .bind(now)
    .all<Pick<OrderRow, "id" | "items">>();
  let released = 0;
  for (const o of results) {
    const r = await db
      .prepare("UPDATE orders SET status = 'expired', updated_at = datetime('now') WHERE id = ? AND status = 'pending'")
      .bind(o.id)
      .run();
    if (r.meta.changes === 1) {
      await restoreStock(db, orderItems(o));
      released++;
    }
  }
  return released;
}

export async function getOrder(db: D1Database, id: string): Promise<OrderRow | null> {
  return db.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<OrderRow>();
}
