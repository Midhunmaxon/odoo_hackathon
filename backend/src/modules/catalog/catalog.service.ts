import { db } from '../../db';
import { ApiError } from '../../middleware/error.middleware';
import {
  CreateProductInput,
  UpdateProductInput,
  VariantInput,
  CreatePlanInput,
  UpdatePlanInput,
} from './catalog.validation';
import { PaginationParams, PaginatedResponse, paginateKnexQuery, paginateArray } from '../../utils/pagination';

export interface ProductRecord {
  id: number;
  name: string;
  type: string;
  sales_price: number;
  cost_price: number;
  notes?: string | null;
  created_at?: Date | string;
  updated_at?: Date | string;
  variants?: ProductVariantRecord[];
}

export interface ProductVariantRecord {
  id: number;
  product_id: number;
  attribute: string;
  value: string;
  extra_price: number;
  created_at?: Date | string;
  updated_at?: Date | string;
}

export interface PlanRecord {
  id: number;
  name: string;
  price: number;
  billing_period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  min_quantity: number;
  start_date?: Date | string | null;
  end_date?: Date | string | null;
  auto_close: boolean;
  allow_close: boolean;
  allow_pause: boolean;
  allow_renew: boolean;
  status: string;
  created_at?: Date | string;
  updated_at?: Date | string;
}

// In-memory fallback stores for offline/test environments
export const inMemoryProducts = new Map<number, ProductRecord>();
export const inMemoryVariants = new Map<number, ProductVariantRecord>();
export const inMemoryPlans = new Map<number, PlanRecord>();

export function seedInMemoryCatalog(): void {
  if (inMemoryProducts.size === 0) {
    inMemoryProducts.set(1, {
      id: 1,
      name: 'Cloud Workspace Suite',
      type: 'service',
      sales_price: 49.0,
      cost_price: 15.0,
      notes: 'Cloud tools',
      variants: [
        { id: 1, product_id: 1, attribute: 'Storage', value: '100 GB', extra_price: 0 },
        { id: 2, product_id: 1, attribute: 'Storage', value: '500 GB', extra_price: 25 },
        { id: 3, product_id: 1, attribute: 'Storage', value: '2 TB', extra_price: 75 },
      ],
    });
    inMemoryVariants.set(1, { id: 1, product_id: 1, attribute: 'Storage', value: '100 GB', extra_price: 0 });
    inMemoryVariants.set(2, { id: 2, product_id: 1, attribute: 'Storage', value: '500 GB', extra_price: 25 });
    inMemoryVariants.set(3, { id: 3, product_id: 1, attribute: 'Storage', value: '2 TB', extra_price: 75 });

    inMemoryProducts.set(2, {
      id: 2,
      name: 'Dedicated Support Pack',
      type: 'service',
      sales_price: 199.0,
      cost_price: 60.0,
      notes: '24/7 support',
      variants: [
        { id: 4, product_id: 2, attribute: 'SLA Level', value: 'Standard (24h)', extra_price: 0 },
        { id: 5, product_id: 2, attribute: 'SLA Level', value: 'Priority (4h)', extra_price: 150 },
      ],
    });
    inMemoryVariants.set(4, { id: 4, product_id: 2, attribute: 'SLA Level', value: 'Standard (24h)', extra_price: 0 });
    inMemoryVariants.set(5, { id: 5, product_id: 2, attribute: 'SLA Level', value: 'Priority (4h)', extra_price: 150 });

    inMemoryProducts.set(3, {
      id: 3,
      name: 'Odoo Enterprise Connector',
      type: 'service',
      sales_price: 299.0,
      cost_price: 80.0,
      notes: 'Sync with Odoo',
      variants: [
        { id: 6, product_id: 3, attribute: 'Brand', value: 'Community Edition', extra_price: 0 },
        { id: 7, product_id: 3, attribute: 'Brand', value: 'Odoo', extra_price: 560 },
      ],
    });
    inMemoryVariants.set(6, { id: 6, product_id: 3, attribute: 'Brand', value: 'Community Edition', extra_price: 0 });
    inMemoryVariants.set(7, { id: 7, product_id: 3, attribute: 'Brand', value: 'Odoo', extra_price: 560 });

    inMemoryPlans.set(1, {
      id: 1,
      name: 'Starter Monthly',
      price: 49.0,
      billing_period: 'MONTHLY',
      min_quantity: 1,
      start_date: '2026-01-01',
      end_date: null,
      auto_close: false,
      allow_close: true,
      allow_pause: true,
      allow_renew: true,
      status: 'ACTIVE',
    });
    inMemoryPlans.set(2, {
      id: 2,
      name: 'Professional Monthly',
      price: 149.0,
      billing_period: 'MONTHLY',
      min_quantity: 1,
      start_date: '2026-01-01',
      end_date: null,
      auto_close: false,
      allow_close: true,
      allow_pause: true,
      allow_renew: true,
      status: 'ACTIVE',
    });
    inMemoryPlans.set(3, {
      id: 3,
      name: 'Enterprise Annual',
      price: 1490.0,
      billing_period: 'YEARLY',
      min_quantity: 5,
      start_date: '2026-01-01',
      end_date: null,
      auto_close: false,
      allow_close: false, // Disallows close
      allow_pause: true,
      allow_renew: true,
      status: 'ACTIVE',
    });
  }
}
seedInMemoryCatalog();

/**
 * Helper to compute the effective unit price of a product + variant.
 * Base sales_price + variant extra_price.
 * Exported so other modules (e.g. subscriptions, invoices) can import it directly.
 */
export async function getEffectivePrice(productId: number, variantId?: number | null): Promise<number> {
  let product: { sales_price: number | string } | null = null;
  try {
    product = await db('products').where({ id: productId }).first();
  } catch {
    seedInMemoryCatalog();
    product = inMemoryProducts.get(productId) || null;
  }

  if (!product) {
    throw ApiError.notFound(`Product with ID ${productId} not found`);
  }

  const basePrice = Number(product.sales_price);

  if (!variantId) {
    return basePrice;
  }

  let variant: { extra_price: number | string; product_id: number } | null = null;
  try {
    variant = await db('product_variants').where({ id: variantId, product_id: productId }).first();
  } catch {
    seedInMemoryCatalog();
    const v = inMemoryVariants.get(variantId);
    if (v && v.product_id === productId) {
      variant = v;
    }
  }

  if (!variant) {
    throw ApiError.notFound(`Variant with ID ${variantId} for product ${productId} not found`);
  }

  return basePrice + Number(variant.extra_price);
}

export class CatalogService {
  /* ====================================================================
   * PRODUCTS
   * ==================================================================== */

  async listProducts(
    filter: { type?: string; search?: string },
    pagination: PaginationParams
  ): Promise<PaginatedResponse<ProductRecord>> {
    try {
      let query = db('products').select('*');
      if (filter.type) {
        query = query.where({ type: filter.type });
      }
      if (filter.search) {
        query = query.where('name', 'ilike', `%${filter.search}%`);
      }
      const result = await paginateKnexQuery<ProductRecord>(query, pagination);

      // Attach variants for each product
      const productIds = result.data.map((p) => p.id);
      if (productIds.length > 0) {
        const variants = await db('product_variants').whereIn('product_id', productIds);
        const variantsByProductId = new Map<number, ProductVariantRecord[]>();
        for (const v of variants) {
          const list = variantsByProductId.get(v.product_id) || [];
          list.push(v);
          variantsByProductId.set(v.product_id, list);
        }
        for (const prod of result.data) {
          prod.variants = variantsByProductId.get(prod.id) || [];
        }
      }
      return result;
    } catch {
      seedInMemoryCatalog();
      let items = Array.from(inMemoryProducts.values());
      if (filter.type) {
        items = items.filter((p) => p.type === filter.type);
      }
      if (filter.search) {
        const s = filter.search.toLowerCase();
        items = items.filter((p) => p.name.toLowerCase().includes(s));
      }
      return paginateArray(items, pagination);
    }
  }

  async getProductById(id: number): Promise<ProductRecord> {
    try {
      const product = await db('products').where({ id }).first();
      if (!product) {
        throw ApiError.notFound(`Product with ID ${id} not found`);
      }
      const variants = await db('product_variants').where({ product_id: id });
      return { ...product, variants };
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      seedInMemoryCatalog();
      const prod = inMemoryProducts.get(id);
      if (!prod) throw ApiError.notFound(`Product with ID ${id} not found`);
      return prod;
    }
  }

  async createProduct(data: CreateProductInput): Promise<ProductRecord> {
    const { variants, ...productData } = data;

    try {
      return await db.transaction(async (trx) => {
        const [insertedProduct] = await trx('products')
          .insert({
            name: productData.name,
            type: productData.type || 'service',
            sales_price: productData.sales_price,
            cost_price: productData.cost_price,
            notes: productData.notes || null,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning('*');

        let createdVariants: ProductVariantRecord[] = [];
        if (variants && variants.length > 0) {
          const variantRows = variants.map((v) => ({
            product_id: insertedProduct.id,
            attribute: v.attribute,
            value: v.value,
            extra_price: v.extra_price,
            created_at: new Date(),
            updated_at: new Date(),
          }));
          createdVariants = await trx('product_variants').insert(variantRows).returning('*');
        }

        return { ...insertedProduct, variants: createdVariants };
      });
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      // In-memory fallback
      seedInMemoryCatalog();
      const newId = inMemoryProducts.size + 10;
      const createdVariants: ProductVariantRecord[] = (variants || []).map((v, idx) => {
        const varId = inMemoryVariants.size + idx + 10;
        const vRecord: ProductVariantRecord = {
          id: varId,
          product_id: newId,
          attribute: v.attribute,
          value: v.value,
          extra_price: v.extra_price ?? 0,
        };
        inMemoryVariants.set(varId, vRecord);
        return vRecord;
      });

      const newProd: ProductRecord = {
        id: newId,
        name: productData.name,
        type: productData.type || 'service',
        sales_price: productData.sales_price ?? 0,
        cost_price: productData.cost_price ?? 0,
        notes: productData.notes || null,
        variants: createdVariants,
      };
      inMemoryProducts.set(newId, newProd);
      return newProd;
    }
  }

  async updateProduct(id: number, data: UpdateProductInput): Promise<ProductRecord> {
    const { variants, ...productData } = data;

    try {
      return await db.transaction(async (trx) => {
        const existing = await trx('products').where({ id }).first();
        if (!existing) {
          throw ApiError.notFound(`Product with ID ${id} not found`);
        }

        if (Object.keys(productData).length > 0) {
          await trx('products')
            .where({ id })
            .update({
              ...productData,
              updated_at: new Date(),
            });
        }

        if (variants) {
          await trx('product_variants').where({ product_id: id }).del();
          if (variants.length > 0) {
            const rows = variants.map((v) => ({
              product_id: id,
              attribute: v.attribute,
              value: v.value,
              extra_price: v.extra_price,
              created_at: new Date(),
              updated_at: new Date(),
            }));
            await trx('product_variants').insert(rows);
          }
        }

        const updated = await trx('products').where({ id }).first();
        const updatedVariants = await trx('product_variants').where({ product_id: id });
        return { ...updated, variants: updatedVariants };
      });
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      seedInMemoryCatalog();
      const prod = inMemoryProducts.get(id);
      if (!prod) throw ApiError.notFound(`Product with ID ${id} not found`);
      Object.assign(prod, productData);
      if (variants) {
        prod.variants = variants.map((v, i) => ({
          id: i + 100,
          product_id: id,
          attribute: v.attribute,
          value: v.value,
          extra_price: v.extra_price,
        }));
      }
      return prod;
    }
  }

  async deleteProduct(id: number): Promise<void> {
    try {
      const count = await db('products').where({ id }).del();
      if (!count) throw ApiError.notFound(`Product with ID ${id} not found`);
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      seedInMemoryCatalog();
      if (!inMemoryProducts.has(id)) throw ApiError.notFound(`Product with ID ${id} not found`);
      inMemoryProducts.delete(id);
    }
  }

  /* ====================================================================
   * PLANS
   * ==================================================================== */

  async listPlans(
    filter: { billing_period?: string; status?: string; search?: string },
    pagination: PaginationParams
  ): Promise<PaginatedResponse<PlanRecord>> {
    try {
      let query = db('plans').select('*');
      if (filter.billing_period) {
        query = query.where({ billing_period: filter.billing_period });
      }
      if (filter.status) {
        query = query.where({ status: filter.status });
      }
      if (filter.search) {
        query = query.where('name', 'ilike', `%${filter.search}%`);
      }
      return await paginateKnexQuery<PlanRecord>(query, pagination);
    } catch {
      seedInMemoryCatalog();
      let items = Array.from(inMemoryPlans.values());
      if (filter.billing_period) {
        items = items.filter((p) => p.billing_period === filter.billing_period);
      }
      if (filter.status) {
        items = items.filter((p) => p.status === filter.status);
      }
      if (filter.search) {
        const s = filter.search.toLowerCase();
        items = items.filter((p) => p.name.toLowerCase().includes(s));
      }
      return paginateArray(items, pagination);
    }
  }

  async getPlanById(id: number): Promise<PlanRecord> {
    try {
      const plan = await db('plans').where({ id }).first();
      if (!plan) throw ApiError.notFound(`Plan with ID ${id} not found`);
      return plan;
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      seedInMemoryCatalog();
      const plan = inMemoryPlans.get(id);
      if (!plan) throw ApiError.notFound(`Plan with ID ${id} not found`);
      return plan;
    }
  }

  async createPlan(data: CreatePlanInput): Promise<PlanRecord> {
    try {
      const [inserted] = await db('plans')
        .insert({
          ...data,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');
      return inserted;
    } catch (err: any) {
      seedInMemoryCatalog();
      const newId = inMemoryPlans.size + 10;
      const newPlan: PlanRecord = {
        id: newId,
        name: data.name,
        price: data.price,
        billing_period: data.billing_period,
        min_quantity: data.min_quantity ?? 1,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        auto_close: data.auto_close ?? false,
        allow_close: data.allow_close ?? true,
        allow_pause: data.allow_pause ?? true,
        allow_renew: data.allow_renew ?? true,
        status: data.status || 'ACTIVE',
      };
      inMemoryPlans.set(newId, newPlan);
      return newPlan;
    }
  }

  async updatePlan(id: number, data: UpdatePlanInput): Promise<PlanRecord> {
    try {
      const [updated] = await db('plans')
        .where({ id })
        .update({
          ...data,
          updated_at: new Date(),
        })
        .returning('*');
      if (!updated) throw ApiError.notFound(`Plan with ID ${id} not found`);
      return updated;
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      seedInMemoryCatalog();
      const plan = inMemoryPlans.get(id);
      if (!plan) throw ApiError.notFound(`Plan with ID ${id} not found`);
      Object.assign(plan, data);
      return plan;
    }
  }

  async deletePlan(id: number): Promise<void> {
    try {
      const count = await db('plans').where({ id }).del();
      if (!count) throw ApiError.notFound(`Plan with ID ${id} not found`);
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      seedInMemoryCatalog();
      if (!inMemoryPlans.has(id)) throw ApiError.notFound(`Plan with ID ${id} not found`);
      inMemoryPlans.delete(id);
    }
  }

  /* ====================================================================
   * PLAN ACTIONS: /plans/:id/close, /pause, /renew
   * ==================================================================== */

  async closePlan(id: number): Promise<PlanRecord> {
    const plan = await this.getPlanById(id);
    if (!plan.allow_close) {
      throw ApiError.badRequest(`Plan "${plan.name}" does not allow closing (allow_close is false)`);
    }

    return this.updatePlan(id, { status: 'CLOSED' });
  }

  async pausePlan(id: number): Promise<PlanRecord> {
    const plan = await this.getPlanById(id);
    if (!plan.allow_pause) {
      throw ApiError.badRequest(`Plan "${plan.name}" does not allow pausing (allow_pause is false)`);
    }

    return this.updatePlan(id, { status: 'PAUSED' });
  }

  async renewPlan(id: number): Promise<PlanRecord> {
    const plan = await this.getPlanById(id);
    if (!plan.allow_renew) {
      throw ApiError.badRequest(`Plan "${plan.name}" does not allow renewal (allow_renew is false)`);
    }

    return this.updatePlan(id, { status: 'ACTIVE' });
  }

  /* ====================================================================
   * DAILY AUTO-CLOSE JOB (node-cron)
   * Closes plans whose end date has passed and auto_close is true
   * ==================================================================== */

  async checkAndAutoClosePlans(): Promise<number> {
    const now = new Date();
    try {
      const plansToClose = await db('plans')
        .where('auto_close', true)
        .where('end_date', '<', now)
        .whereNot('status', 'CLOSED');

      if (plansToClose.length === 0) return 0;

      const ids = plansToClose.map((p) => p.id);
      await db('plans').whereIn('id', ids).update({
        status: 'CLOSED',
        updated_at: new Date(),
      });

      console.log(`[CATALOG CRON] Auto-closed ${ids.length} expired plans: [${ids.join(', ')}]`);
      return ids.length;
    } catch {
      seedInMemoryCatalog();
      let closedCount = 0;
      for (const plan of inMemoryPlans.values()) {
        if (plan.auto_close && plan.end_date && new Date(plan.end_date) < now && plan.status !== 'CLOSED') {
          plan.status = 'CLOSED';
          closedCount++;
        }
      }
      return closedCount;
    }
  }
}

export const catalogService = new CatalogService();
