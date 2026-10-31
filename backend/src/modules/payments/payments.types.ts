export interface PaymentRecord {
  id: number;
  invoice_id: number;
  method: string;
  amount: number;
  paid_at: Date | string;
  note?: string | null;
  created_at?: Date | string;
  updated_at?: Date | string;
}

export interface InvoiceWithPaymentDetails {
  id: number;
  number: string;
  subscription_id: number | null;
  customer_id: number;
  period_start: string;
  period_end: string;
  status: string;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  due_date: string;
  amount_paid: number;
  balance: number;
  overdue: boolean;
  is_overdue: boolean;
  days_overdue?: number;
  created_at?: Date | string;
  updated_at?: Date | string;
}

export interface CreatePaymentDTO {
  invoice_id: number;
  amount: number;
  method: string;
  date?: string | Date;
  note?: string;
}

export interface InvoiceQueryFilters {
  status?: string;
  payment_status?: 'paid' | 'outstanding' | 'overdue';
  filter?: 'paid' | 'outstanding' | 'overdue';
  customer_id?: number;
  customer?: number;
  from_date?: string;
  to_date?: string;
  date_from?: string;
  date_to?: string;
  as_of_date?: string;
}
