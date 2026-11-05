export interface Variant {
  size: string; // 'Ice' | 'Hot' or other custom size
  price: number;
  stock: number;
  label?: string;
}

export type ProductVariant = Variant;

export interface Product {
  id: string;
  name: string;
  category: string;
  image: string;
  description: string;
  badge?: string;
  badgeClass?: string;
  isReady?: boolean;
  variants: Variant[];
}

export interface OrderItem {
  id?: string;
  order_id?: string;
  product_id?: string;
  product_name: string;
  variant_size: string;
  price: number;
  quantity: number;
  ratio?: string;
}

export interface Transaction {
  id: string;
  date: string;
  customer_name: string;
  total_price: number;
  status: 'pending' | 'proses' | 'selesai' | 'dibatalkan';
  metode_pembayaran: string;
  ratio_notes?: string;
  guest_id?: string;
  table_number?: string;
  cash_paid?: number;
  change_due?: number;
  items: OrderItem[];
}
