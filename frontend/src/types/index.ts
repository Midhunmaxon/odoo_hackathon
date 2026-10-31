export type UserRole = 'ADMIN' | 'STAFF' | 'CUSTOMER';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  created_at?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

export interface Product {
  id: number;
  name: string;
  type: string;
  sales_price: number;
  cost_price: number;
  notes?: string;
}

export interface ProductVariant {
  id: number;
  product_id: number;
  attribute: string;
  value: string;
  extra_price: number;
}

export interface Plan {
  id: number;
  name: string;
  price: number;
  billing_period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  min_quantity: number;
  start_date?: string;
  end_date?: string;
  auto_close: boolean;
  allow_close: boolean;
  allow_pause: boolean;
  allow_renew: boolean;
  status: string;
}

export interface Subscription {
  id: number;
  number: string;
  customer_id: number;
  plan_id: number;
  start_date: string;
  expiry_date?: string | null;
  payment_terms: string;
  status: 'DRAFT' | 'QUOTATION' | 'CONFIRMED' | 'ACTIVE' | 'CLOSED';
  last_billed_period_end?: string | null;
  next_billing_date?: string | null;
}

export interface Tax {
  id: number;
  name: string;
  rate_percent: number;
  active: boolean;
}

export interface Discount {
  id: number;
  name: string;
  type: 'FIXED' | 'PERCENT';
  value: number;
  min_purchase?: number | null;
  min_quantity?: number | null;
  applies_to: 'PRODUCT' | 'SUBSCRIPTION';
}

export interface Invoice {
  id: number;
  number: string;
  subscription_id?: number | null;
  customer_id: number;
  period_start: string;
  period_end: string;
  status: 'DRAFT' | 'CONFIRMED' | 'PAID' | 'CANCELLED';
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  due_date: string;
}

export interface Payment {
  id: number;
  invoice_id: number;
  method: string;
  amount: number;
  paid_at: string;
  note?: string;
}
