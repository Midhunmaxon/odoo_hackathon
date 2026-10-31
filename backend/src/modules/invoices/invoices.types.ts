export type InvoiceStatus = 'DRAFT' | 'CONFIRMED' | 'PAID' | 'CANCELLED';

export interface Invoice {
  id: number;
  number: string;
  subscription_id: number | null;
  customer_id: number;
  period_start: string;
  period_end: string;
  status: InvoiceStatus;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  due_date: string;
  created_at?: Date | string;
  updated_at?: Date | string;
}

export interface InvoiceLine {
  id: number;
  invoice_id: number;
  product_id: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_id: number | null;
  tax_amount: number;
  discount_amount: number;
  amount: number;
  created_at?: Date | string;
  updated_at?: Date | string;
}

export interface Payment {
  id: number;
  invoice_id: number;
  method: string; // e.g. CREDIT_CARD, BANK_TRANSFER, CASH
  amount: number;
  paid_at?: Date | string;
  note?: string | null;
  created_at?: Date | string;
  updated_at?: Date | string;
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
  created_at?: Date | string;
  updated_at?: Date | string;
}

export interface SubscriptionLine {
  id: number;
  subscription_id: number;
  product_id: number;
  variant_id?: number | null;
  quantity: number;
  unit_price: number;
  tax_id?: number | null;
  amount: number;
  created_at?: Date | string;
  updated_at?: Date | string;
}

export interface Plan {
  id: number;
  name: string;
  price: number;
  billing_period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  min_quantity: number;
  auto_close: boolean;
  allow_close: boolean;
  allow_pause: boolean;
  allow_renew: boolean;
  status: string;
}

export interface GenerateInvoiceResult {
  alreadyBilled: boolean;
  invoice?: Invoice;
  skippedPeriod?: string;
}

export interface RunBillingResult {
  created: number;
  skipped: number;
  failed: Array<{ subscription_id: number; error: string }>;
}

