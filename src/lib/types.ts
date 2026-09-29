export interface Env {
  DB: D1Database;
  MP_ACCESS_TOKEN: string;
  MP_WEBHOOK_SECRET?: string;
  ADMIN_TOKEN: string;
  SITE_URL?: string;
  SHIPPING_FLAT_CENTS?: string;
  FREE_SHIPPING_MIN_CENTS?: string;
  RESERVATION_MINUTES?: string;
  /** Só para testes locais: aponta para um mock da API do Mercado Pago. */
  MP_API_BASE?: string;
}

export interface ProductRow {
  id: string;
  name: string;
  category: string;
  description: string;
  details: string;
  images: string;
  price_cents: number | null;
  stock: number;
  featured: number;
  active: number;
  sort: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  details: string[];
  images: string[];
  price_cents: number | null;
  stock: number;
  featured: boolean;
  active: boolean;
  sort: number;
}

export interface OrderItem {
  id: string;
  name: string;
  qty: number;
  price_cents: number;
}

export type OrderStatus = "pending" | "paid" | "expired" | "cancelled" | "shipped" | "delivered";

export interface OrderRow {
  id: string;
  status: OrderStatus;
  items: string;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  customer: string;
  address: string;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  mp_status: string | null;
  tracking_code: string | null;
  needs_review: number;
  expires_at: number;
  created_at: string;
  updated_at: string;
}
