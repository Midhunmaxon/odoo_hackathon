// Extended subscription types

export type SubscriptionStatus = 'DRAFT' | 'QUOTATION' | 'CONFIRMED' | 'ACTIVE' | 'CLOSED';

export interface SubscriptionLine {
  id?: number;
  subscription_id?: number;
  product_id: number;
  variant_id?: number | null;
  quantity: number;
  unit_price: number;
  tax_id?: number | null;
  amount: number;
}

export interface StatusHistoryEntry {
  id: number;
  subscription_id: number;
  from_status: string | null;
  to_status: string;
  changed_by: number | null;
  changed_at: string;
}

export interface SubscriptionDetail {
  id: number;
  number: string;
  customer_id: number;
  plan_id: number;
  start_date: string;
  expiry_date?: string | null;
  payment_terms: string;
  status: SubscriptionStatus;
  last_billed_period_end?: string | null;
  next_billing_date?: string | null;
  lines?: SubscriptionLine[];
  history?: StatusHistoryEntry[];
  created_at?: string;
  updated_at?: string;
}

export interface CreateSubscriptionLineInput {
  product_id: number;
  variant_id?: number | null;
  quantity: number;
  tax_id?: number | null;
}

export interface CreateSubscriptionInput {
  customer_id: number;
  plan_id: number;
  start_date: string;
  expiry_date?: string;
  payment_terms?: string;
  lines: CreateSubscriptionLineInput[];
}

export interface FromTemplateInput {
  customer_id: number;
  start_date: string;
  payment_terms?: string;
}

// Allowed state machine transitions
export const ALLOWED_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  DRAFT: ['QUOTATION', 'CLOSED'],
  QUOTATION: ['CONFIRMED', 'DRAFT', 'CLOSED'],
  CONFIRMED: ['ACTIVE', 'CLOSED'],
  ACTIVE: ['CLOSED'],
  CLOSED: [],
};
