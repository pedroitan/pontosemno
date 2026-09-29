export interface ProductInput {
  id: string;
  name: string;
  category: string;
  description?: string;
  details?: string[];
  images?: string[];
  price_cents?: number | null;
  stock?: number;
  featured?: boolean;
  active?: boolean;
  sort?: number;
}

const CATEGORIES = ["Bolsas", "Pochetes", "Tops", "Blusas"];

/** Valida o corpo de criação (full=true) ou edição parcial (full=false). */
export function productInput(
  b: Record<string, unknown>,
  full: boolean,
): { value: Partial<ProductInput> } | { error: string } {
  const out: Partial<ProductInput> = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k);

  if (full || has("id")) {
    const id = String(b.id ?? "").trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(id)) return { error: "Identificador: use letras minúsculas, números e hífen." };
    out.id = id;
  }
  if (full || has("name")) {
    const name = String(b.name ?? "").trim();
    if (name.length < 2 || name.length > 80) return { error: "Nome da peça inválido." };
    out.name = name;
  }
  if (full || has("category")) {
    const c = String(b.category ?? "").trim();
    if (!CATEGORIES.includes(c)) return { error: `Categoria deve ser: ${CATEGORIES.join(", ")}.` };
    out.category = c;
  }
  if (has("description")) out.description = String(b.description ?? "").trim().slice(0, 1000);
  if (has("details")) {
    if (!Array.isArray(b.details)) return { error: "Detalhes devem ser uma lista." };
    out.details = b.details.map((d) => String(d).trim()).filter(Boolean).slice(0, 12);
  }
  if (has("images")) {
    if (!Array.isArray(b.images)) return { error: "Imagens devem ser uma lista." };
    const imgs = b.images.map((d) => String(d).trim()).filter(Boolean);
    if (imgs.some((i) => !/^[a-z0-9._/-]+\.(jpe?g|png|webp|avif)$/i.test(i) || i.includes(".."))) {
      return { error: "Nome de imagem inválido." };
    }
    out.images = imgs.slice(0, 8);
  }
  if (has("price_cents")) {
    if (b.price_cents === null || b.price_cents === "") out.price_cents = null;
    else {
      const n = Number(b.price_cents);
      if (!Number.isInteger(n) || n < 100 || n > 10_000_000) return { error: "Preço inválido." };
      out.price_cents = n;
    }
  }
  if (has("stock")) {
    const n = Number(b.stock);
    if (!Number.isInteger(n) || n < 0 || n > 999) return { error: "Estoque inválido." };
    out.stock = n;
  }
  if (has("sort")) {
    const n = Number(b.sort);
    if (!Number.isInteger(n)) return { error: "Ordem inválida." };
    out.sort = n;
  }
  if (has("featured")) out.featured = Boolean(b.featured);
  if (has("active")) out.active = Boolean(b.active);
  return { value: out };
}
