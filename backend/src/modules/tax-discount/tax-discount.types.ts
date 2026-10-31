export type DiscountType = 'FIXED' | 'PERCENT';
export type DiscountAppliesTo = 'PRODUCT' | 'SUBSCRIPTION';

export interface Tax {
  id: number;
  name: string;
  rate_percent: number;
  active: boolean;
  created_at?: Date | string;
  updated_at?: Date | string;
}

export interface Discount {
  id: number;
  name: string;
  type: DiscountType;
  value: number;
  min_purchase?: number | null;
  min_quantity?: number | null;
  start_date?: string | Date | null;
  end_date?: string | Date | null;
  usage_limit?: number | null;
  used_count: number;
  applies_to: DiscountAppliesTo;
  product_id?: number | null;
  created_at?: Date | string;
  updated_at?: Date | string;
}

export interface InvoiceLineInput {
  id?: number | string;
  product_id?: number | null;
  description?: string;
  quantity: number;
  unit_price: number;
  tax_id?: number | null;
}

export interface CalculatedLineTotal {
  lineId?: number | string;
  productId?: number | null;
  description?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxRatePercent: number;
  taxAmount: number;
  total: number;
  // snake_case aliases for compatibility with DB schemas
  discount_amount?: number;
  tax_amount?: number;
  unit_price?: number;
  product_id?: number | null;
}

export interface CalculatedInvoiceTotals {
  lines: CalculatedLineTotal[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  // snake_case aliases for direct DB insertion into invoices table
  discount_total: number;
  tax_total: number;
}
