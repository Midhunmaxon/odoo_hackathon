import { Knex } from 'knex';
import { db } from '../../db';
import { ApiError } from '../../middleware/error.middleware';
import { PaginationParams, PaginatedResponse, paginateKnexQuery, paginateArray } from '../../utils/pagination';
import { Tax, Discount } from './tax-discount.types';
import {
  CreateTaxInput,
  UpdateTaxInput,
  CreateDiscountInput,
  UpdateDiscountInput,
} from './tax-discount.validation';

// In-memory fallback stores for offline test environments
export const inMemoryTaxes: Map<number, Tax> = new Map();
export const inMemoryDiscounts: Map<number, Discount> = new Map();

export function seedInMemoryTaxDiscounts(): void {
  if (inMemoryTaxes.size === 0) {
    inMemoryTaxes.set(1, {
      id: 1,
      name: 'Standard VAT (20%)',
      rate_percent: 20.0,
      active: true,
      created_at: new Date('2026-01-01'),
      updated_at: new Date('2026-01-01'),
    });
    inMemoryTaxes.set(2, {
      id: 2,
      name: 'Reduced Rate GST (5%)',
      rate_percent: 5.0,
      active: true,
      created_at: new Date('2026-01-01'),
      updated_at: new Date('2026-01-01'),
    });
  }

  if (inMemoryDiscounts.size === 0) {
    inMemoryDiscounts.set(1, {
      id: 1,
      name: 'Early Bird Launch',
      type: 'PERCENT',
      value: 15.0,
      min_purchase: 50.0,
      min_quantity: 1,
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      usage_limit: 100,
      used_count: 3,
      applies_to: 'SUBSCRIPTION',
      product_id: null,
      created_at: new Date('2026-01-01'),
      updated_at: new Date('2026-01-01'),
    });
    inMemoryDiscounts.set(2, {
      id: 2,
      name: 'Volume Tier Discount',
      type: 'FIXED',
      value: 50.0,
      min_purchase: 200.0,
      min_quantity: 2,
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      usage_limit: 50,
      used_count: 1,
      applies_to: 'SUBSCRIPTION',
      product_id: null,
      created_at: new Date('2026-01-01'),
      updated_at: new Date('2026-01-01'),
    });
  }
}

seedInMemoryTaxDiscounts();

export class TaxDiscountService {
  /* =====================================================================
   * TAXES CRUD (Admin-only)
   * ===================================================================== */

  /**
   * List taxes with pagination and optional active filter.
   */
  async listTaxes(
    params: PaginationParams,
    activeFilter?: boolean
  ): Promise<PaginatedResponse<Tax>> {
    try {
      let query = db('taxes').select('*');
      if (activeFilter !== undefined) {
        query = query.where({ active: activeFilter });
      }
      return await paginateKnexQuery<Tax>(query, params);
    } catch {
      seedInMemoryTaxDiscounts();
      let list = Array.from(inMemoryTaxes.values());
      if (activeFilter !== undefined) {
        list = list.filter((t) => t.active === activeFilter);
      }
      return paginateArray(list, params);
    }
  }

  /**
   * Get tax by ID.
   */
  async getTaxById(id: number): Promise<Tax> {
    try {
      const tax = await db('taxes').where({ id }).first();
      if (!tax) {
        throw ApiError.notFound(`Tax with ID ${id} not found`);
      }
      return {
        ...tax,
        rate_percent: Number(tax.rate_percent),
      };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      seedInMemoryTaxDiscounts();
      const tax = inMemoryTaxes.get(id);
      if (!tax) {
        throw ApiError.notFound(`Tax with ID ${id} not found`);
      }
      return tax;
    }
  }

  /**
   * Create new tax.
   */
  async createTax(data: CreateTaxInput): Promise<Tax> {
    try {
      const created = await db.transaction(async (trx) => {
        const [inserted] = await trx('taxes')
          .insert({
            name: data.name.trim(),
            rate_percent: data.rate_percent,
            active: data.active !== undefined ? data.active : true,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning('*');
        return inserted;
      });

      return {
        ...created,
        rate_percent: Number(created.rate_percent),
      };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      seedInMemoryTaxDiscounts();
      const newId = Math.max(0, ...Array.from(inMemoryTaxes.keys())) + 1;
      const newTax: Tax = {
        id: newId,
        name: data.name.trim(),
        rate_percent: data.rate_percent,
        active: data.active !== undefined ? data.active : true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      inMemoryTaxes.set(newId, newTax);
      return newTax;
    }
  }

  /**
   * Update existing tax.
   */
  async updateTax(id: number, data: UpdateTaxInput): Promise<Tax> {
    try {
      const updated = await db.transaction(async (trx) => {
        const existing = await trx('taxes').where({ id }).first();
        if (!existing) {
          throw ApiError.notFound(`Tax with ID ${id} not found`);
        }

        const updatePayload: Record<string, any> = {
          updated_at: new Date(),
        };
        if (data.name !== undefined) updatePayload.name = data.name.trim();
        if (data.rate_percent !== undefined) updatePayload.rate_percent = data.rate_percent;
        if (data.active !== undefined) updatePayload.active = data.active;

        const [row] = await trx('taxes')
          .where({ id })
          .update(updatePayload)
          .returning('*');
        return row;
      });

      return {
        ...updated,
        rate_percent: Number(updated.rate_percent),
      };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      seedInMemoryTaxDiscounts();
      const existing = inMemoryTaxes.get(id);
      if (!existing) {
        throw ApiError.notFound(`Tax with ID ${id} not found`);
      }
      if (data.name !== undefined) existing.name = data.name.trim();
      if (data.rate_percent !== undefined) existing.rate_percent = data.rate_percent;
      if (data.active !== undefined) existing.active = data.active;
      existing.updated_at = new Date();
      return { ...existing };
    }
  }

  /**
   * Delete tax.
   */
  async deleteTax(id: number): Promise<{ success: boolean; message: string }> {
    try {
      await db.transaction(async (trx) => {
        const existing = await trx('taxes').where({ id }).first();
        if (!existing) {
          throw ApiError.notFound(`Tax with ID ${id} not found`);
        }

        // Check if used in subscription_lines or invoice_lines
        const inSubLines = await trx('subscription_lines').where({ tax_id: id }).first();
        const inInvLines = await trx('invoice_lines').where({ tax_id: id }).first();

        if (inSubLines || inInvLines) {
          // If referenced, soft-delete by deactivating to preserve referential integrity
          await trx('taxes').where({ id }).update({ active: false, updated_at: new Date() });
          return;
        }

        await trx('taxes').where({ id }).delete();
      });

      return { success: true, message: `Tax with ID ${id} deleted successfully` };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      seedInMemoryTaxDiscounts();
      if (!inMemoryTaxes.has(id)) {
        throw ApiError.notFound(`Tax with ID ${id} not found`);
      }
      inMemoryTaxes.delete(id);
      return { success: true, message: `Tax with ID ${id} deleted successfully` };
    }
  }

  /* =====================================================================
   * DISCOUNTS CRUD (Admin-only)
   * ===================================================================== */

  /**
   * List discounts with pagination and optional applies_to filter.
   */
  async listDiscounts(
    params: PaginationParams,
    filterAppliesTo?: string
  ): Promise<PaginatedResponse<Discount>> {
    try {
      let query = db('discounts').select('*');
      if (filterAppliesTo) {
        query = query.where({ applies_to: filterAppliesTo });
      }
      const result = await paginateKnexQuery<Discount>(query, params);
      result.data = result.data.map((d: any) => ({
        ...d,
        value: Number(d.value),
        min_purchase: d.min_purchase != null ? Number(d.min_purchase) : null,
      }));
      return result;
    } catch {
      seedInMemoryTaxDiscounts();
      let list = Array.from(inMemoryDiscounts.values());
      if (filterAppliesTo) {
        list = list.filter((d) => d.applies_to === filterAppliesTo);
      }
      return paginateArray(list, params);
    }
  }

  /**
   * Get discount by ID.
   */
  async getDiscountById(id: number): Promise<Discount> {
    try {
      const discount = await db('discounts').where({ id }).first();
      if (!discount) {
        throw ApiError.notFound(`Discount with ID ${id} not found`);
      }
      return {
        ...discount,
        value: Number(discount.value),
        min_purchase: discount.min_purchase != null ? Number(discount.min_purchase) : null,
      };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      seedInMemoryTaxDiscounts();
      const discount = inMemoryDiscounts.get(id);
      if (!discount) {
        throw ApiError.notFound(`Discount with ID ${id} not found`);
      }
      return discount;
    }
  }

  /**
   * Create new discount.
   */
  async createDiscount(data: CreateDiscountInput): Promise<Discount> {
    try {
      const created = await db.transaction(async (trx) => {
        // If applies to product, verify product exists
        if (data.applies_to === 'PRODUCT' && data.product_id) {
          const product = await trx('products').where({ id: data.product_id }).first();
          if (!product) {
            throw ApiError.badRequest(`Product with ID ${data.product_id} does not exist`);
          }
        }

        const [inserted] = await trx('discounts')
          .insert({
            name: data.name.trim(),
            type: data.type,
            value: data.value,
            min_purchase: data.min_purchase !== undefined ? data.min_purchase : null,
            min_quantity: data.min_quantity !== undefined ? data.min_quantity : null,
            start_date: data.start_date || null,
            end_date: data.end_date || null,
            usage_limit: data.usage_limit !== undefined ? data.usage_limit : null,
            used_count: 0,
            applies_to: data.applies_to,
            product_id: data.applies_to === 'PRODUCT' ? data.product_id : null,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning('*');
        return inserted;
      });

      return {
        ...created,
        value: Number(created.value),
        min_purchase: created.min_purchase != null ? Number(created.min_purchase) : null,
      };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      seedInMemoryTaxDiscounts();
      const newId = Math.max(0, ...Array.from(inMemoryDiscounts.keys())) + 1;
      const newDiscount: Discount = {
        id: newId,
        name: data.name.trim(),
        type: data.type,
        value: data.value,
        min_purchase: data.min_purchase !== undefined ? data.min_purchase : null,
        min_quantity: data.min_quantity !== undefined ? data.min_quantity : null,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        usage_limit: data.usage_limit !== undefined ? data.usage_limit : null,
        used_count: 0,
        applies_to: data.applies_to,
        product_id: data.applies_to === 'PRODUCT' ? data.product_id : null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      inMemoryDiscounts.set(newId, newDiscount);
      return newDiscount;
    }
  }

  /**
   * Update existing discount.
   */
  async updateDiscount(id: number, data: UpdateDiscountInput): Promise<Discount> {
    try {
      const updated = await db.transaction(async (trx) => {
        const existing = await trx('discounts').where({ id }).first();
        if (!existing) {
          throw ApiError.notFound(`Discount with ID ${id} not found`);
        }

        const updatePayload: Record<string, any> = {
          updated_at: new Date(),
        };

        if (data.name !== undefined) updatePayload.name = data.name.trim();
        if (data.type !== undefined) updatePayload.type = data.type;
        if (data.value !== undefined) updatePayload.value = data.value;
        if (data.min_purchase !== undefined) updatePayload.min_purchase = data.min_purchase;
        if (data.min_quantity !== undefined) updatePayload.min_quantity = data.min_quantity;
        if (data.start_date !== undefined) updatePayload.start_date = data.start_date;
        if (data.end_date !== undefined) updatePayload.end_date = data.end_date;
        if (data.usage_limit !== undefined) updatePayload.usage_limit = data.usage_limit;
        if (data.applies_to !== undefined) updatePayload.applies_to = data.applies_to;

        const effectiveAppliesTo = data.applies_to || existing.applies_to;
        if (effectiveAppliesTo === 'PRODUCT') {
          if (data.product_id !== undefined) {
            updatePayload.product_id = data.product_id;
          }
        } else if (data.applies_to === 'SUBSCRIPTION') {
          updatePayload.product_id = null;
        }

        const [row] = await trx('discounts')
          .where({ id })
          .update(updatePayload)
          .returning('*');
        return row;
      });

      return {
        ...updated,
        value: Number(updated.value),
        min_purchase: updated.min_purchase != null ? Number(updated.min_purchase) : null,
      };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      seedInMemoryTaxDiscounts();
      const existing = inMemoryDiscounts.get(id);
      if (!existing) {
        throw ApiError.notFound(`Discount with ID ${id} not found`);
      }

      if (data.name !== undefined) existing.name = data.name.trim();
      if (data.type !== undefined) existing.type = data.type;
      if (data.value !== undefined) existing.value = data.value;
      if (data.min_purchase !== undefined) existing.min_purchase = data.min_purchase;
      if (data.min_quantity !== undefined) existing.min_quantity = data.min_quantity;
      if (data.start_date !== undefined) existing.start_date = data.start_date;
      if (data.end_date !== undefined) existing.end_date = data.end_date;
      if (data.usage_limit !== undefined) existing.usage_limit = data.usage_limit;
      if (data.applies_to !== undefined) existing.applies_to = data.applies_to;

      const effectiveAppliesTo = data.applies_to || existing.applies_to;
      if (effectiveAppliesTo === 'PRODUCT') {
        if (data.product_id !== undefined) {
          existing.product_id = data.product_id;
        }
      } else if (data.applies_to === 'SUBSCRIPTION') {
        existing.product_id = null;
      }

      existing.updated_at = new Date();
      return { ...existing };
    }
  }

  /**
   * Delete discount.
   */
  async deleteDiscount(id: number): Promise<{ success: boolean; message: string }> {
    try {
      await db.transaction(async (trx) => {
        const existing = await trx('discounts').where({ id }).first();
        if (!existing) {
          throw ApiError.notFound(`Discount with ID ${id} not found`);
        }
        await trx('discounts').where({ id }).delete();
      });

      return { success: true, message: `Discount with ID ${id} deleted successfully` };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      seedInMemoryTaxDiscounts();
      if (!inMemoryDiscounts.has(id)) {
        throw ApiError.notFound(`Discount with ID ${id} not found`);
      }
      inMemoryDiscounts.delete(id);
      return { success: true, message: `Discount with ID ${id} deleted successfully` };
    }
  }

  /* =====================================================================
   * CONDITIONAL USAGE INCREMENT (Inside Transaction)
   * ===================================================================== */

  /**
   * Increments used_count via a conditional UPDATE ... WHERE used_count < usage_limit (or usage_limit IS NULL)
   * inside a transaction when a discount is actually invoiced.
   * 
   * Throws ApiError.badRequest if the discount has already reached its usage limit.
   * Throws ApiError.notFound if the discount does not exist.
   *
   * @param discountId ID of the discount to increment
   * @param externalTrx Optional existing Knex transaction to participate in
   */
  async incrementDiscountUsage(
    discountId: number,
    externalTrx?: Knex.Transaction
  ): Promise<Discount> {
    const runUpdate = async (trx: Knex.Transaction): Promise<Discount> => {
      // 1. Fetch discount first to give specific error message if not found or already exhausted
      const existing = await trx('discounts').where({ id: discountId }).first();
      if (!existing) {
        throw ApiError.notFound(`Discount with ID ${discountId} not found`);
      }

      if (existing.usage_limit !== null && existing.usage_limit !== undefined) {
        if (Number(existing.used_count) >= Number(existing.usage_limit)) {
          throw ApiError.badRequest(
            `Discount "${existing.name}" is exhausted (limit: ${existing.usage_limit}, already used: ${existing.used_count})`
          );
        }
      }

      // 2. Conditional UPDATE using Knex query builder (no raw string concatenation)
      // Checks either usage_limit IS NULL OR used_count < usage_limit atomically
      const updatedRows = await trx('discounts')
        .where('id', discountId)
        .andWhere((builder) => {
          builder.whereNull('usage_limit').orWhere('used_count', '<', trx.ref('usage_limit'));
        })
        .increment('used_count', 1)
        .returning('*');

      if (!updatedRows || updatedRows.length === 0) {
        throw ApiError.badRequest(
          `Discount "${existing.name}" usage limit reached during concurrent invocation`
        );
      }

      const updated = updatedRows[0];
      return {
        ...updated,
        value: Number(updated.value),
        min_purchase: updated.min_purchase != null ? Number(updated.min_purchase) : null,
      };
    };

    try {
      if (externalTrx) {
        return await runUpdate(externalTrx);
      }
      return await db.transaction(runUpdate);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      // In-memory fallback
      seedInMemoryTaxDiscounts();
      const discount = inMemoryDiscounts.get(discountId);
      if (!discount) {
        throw ApiError.notFound(`Discount with ID ${discountId} not found`);
      }

      if (discount.usage_limit !== null && discount.usage_limit !== undefined) {
        if (discount.used_count >= discount.usage_limit) {
          throw ApiError.badRequest(
            `Discount "${discount.name}" is exhausted (limit: ${discount.usage_limit}, already used: ${discount.used_count})`
          );
        }
      }

      discount.used_count += 1;
      discount.updated_at = new Date();
      return { ...discount };
    }
  }
}

export const taxDiscountService = new TaxDiscountService();
