// Extended catalog types used by catalog feature pages

export interface ProductVariant {
  id?: number;
  product_id?: number;
  attribute: string;
  value: string;
  extra_price: number;
}

export interface ProductWithVariants {
  id: number;
  name: string;
  type: string;
  sales_price: number;
  cost_price: number;
  notes?: string;
  variants?: ProductVariant[];
  created_at?: string;
  updated_at?: string;
}

export interface Plan {
  id: number;
  name: string;
  price: number;
  billing_period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  min_quantity: number;
  start_date?: string | null;
  end_date?: string | null;
  auto_close: boolean;
  allow_close: boolean;
  allow_pause: boolean;
  allow_renew: boolean;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface QuotationTemplateLine {
  id?: number;
  template_id?: number;
  product_id: number;
  variant_id?: number | null;
  quantity: number;
}

export interface QuotationTemplate {
  id: number;
  name: string;
  validity_days: number;
  plan_id?: number | null;
  lines?: QuotationTemplateLine[];
  created_at?: string;
  updated_at?: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
  };
}
