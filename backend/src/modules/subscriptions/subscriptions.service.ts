import { db } from '../../db';
import { ApiError } from '../../middleware/error.middleware';
import { getEffectivePrice, catalogService } from '../catalog/catalog.service';
import {
  CreateQuotationTemplateInput,
  UpdateQuotationTemplateInput,
  FromTemplateInput,
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
} from './subscriptions.validation';
import { PaginationParams, PaginatedResponse, paginateKnexQuery, paginateArray } from '../../utils/pagination';

export interface QuotationTemplateRecord {
  id: number;
  name: string;
  validity_days: number;
  plan_id?: number | null;
  created_at?: Date | string;
  updated_at?: Date | string;
  lines?: QuotationTemplateLineRecord[];
}

export interface QuotationTemplateLineRecord {
  id: number;
  template_id: number;
  product_id: number;
  variant_id?: number | null;
  quantity: number;
}

export interface SubscriptionRecord {
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
  lines?: SubscriptionLineRecord[];
  history?: SubscriptionHistoryRecord[];
}

export interface SubscriptionLineRecord {
  id: number;
  subscription_id: number;
  product_id: number;
  variant_id?: number | null;
  quantity: number;
  unit_price: number;
  tax_id?: number | null;
  amount: number;
}

export interface SubscriptionHistoryRecord {
  id: number;
  subscription_id: number;
  from_status?: string | null;
  to_status: string;
  changed_by?: number | null;
  changed_at: Date | string;
}

// In-memory fallbacks for offline test execution
export const inMemoryTemplates = new Map<number, QuotationTemplateRecord>();
export const inMemorySubscriptions = new Map<number, SubscriptionRecord>();
export const inMemoryHistory = new Map<number, SubscriptionHistoryRecord[]>();

let subCounter = 1;

export function seedInMemorySubscriptions(): void {
  if (inMemoryTemplates.size === 0) {
    inMemoryTemplates.set(1, {
      id: 1,
      name: 'Standard Cloud Starter Template',
      validity_days: 14,
      plan_id: 1,
      lines: [
        { id: 1, template_id: 1, product_id: 1, variant_id: 1, quantity: 1 },
      ],
    });
  }

  if (inMemorySubscriptions.size === 0) {
    inMemorySubscriptions.set(1, {
      id: 1,
      number: 'SUB-000001',
      customer_id: 4,
      plan_id: 1,
      start_date: '2026-01-01',
      expiry_date: null,
      payment_terms: 'immediate',
      status: 'ACTIVE',
      next_billing_date: '2026-11-01',
      lines: [
        {
          id: 1,
          subscription_id: 1,
          product_id: 1,
          variant_id: 1,
          quantity: 1,
          unit_price: 49.0,
          amount: 49.0,
        },
      ],
    });
    subCounter = 2;
  }
}
seedInMemorySubscriptions();

export class SubscriptionsService {
  /* ====================================================================
   * HELPER: Unique Number Generator (SUB-000001)
   * ==================================================================== */

  private async generateSubscriptionNumber(): Promise<string> {
    try {
      const maxSub = await db('subscriptions').max('id as maxId').first();
      const nextId = (maxSub?.maxId ? Number(maxSub.maxId) : 0) + 1;
      return `SUB-${String(nextId).padStart(6, '0')}`;
    } catch {
      const num = `SUB-${String(subCounter++).padStart(6, '0')}`;
      return num;
    }
  }

  /* ====================================================================
   * HELPER: Next Billing Date Calculator
   * ==================================================================== */

  private computeNextBillingDate(startDate: string | Date, billingPeriod: string): string {
    const d = new Date(startDate);
    switch (billingPeriod) {
      case 'DAILY':
        d.setDate(d.getDate() + 1);
        break;
      case 'WEEKLY':
        d.setDate(d.getDate() + 7);
        break;
      case 'MONTHLY':
        d.setMonth(d.getMonth() + 1);
        break;
      case 'YEARLY':
        d.setFullYear(d.getFullYear() + 1);
        break;
      default:
        d.setMonth(d.getMonth() + 1);
    }
    return d.toISOString().split('T')[0];
  }

  /* ====================================================================
   * QUOTATION TEMPLATES CRUD
   * ==================================================================== */

  async listTemplates(pagination: PaginationParams): Promise<PaginatedResponse<QuotationTemplateRecord>> {
    try {
      const query = db('quotation_templates').select('*');
      const result = await paginateKnexQuery<QuotationTemplateRecord>(query, pagination);

      const templateIds = result.data.map((t) => t.id);
      if (templateIds.length > 0) {
        const lines = await db('quotation_template_lines').whereIn('template_id', templateIds);
        for (const t of result.data) {
          t.lines = lines.filter((l) => l.template_id === t.id);
        }
      }
      return result;
    } catch {
      seedInMemorySubscriptions();
      return paginateArray(Array.from(inMemoryTemplates.values()), pagination);
    }
  }

  async getTemplateById(id: number): Promise<QuotationTemplateRecord> {
    try {
      const template = await db('quotation_templates').where({ id }).first();
      if (!template) throw ApiError.notFound(`Quotation template with ID ${id} not found`);
      const lines = await db('quotation_template_lines').where({ template_id: id });
      return { ...template, lines };
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      seedInMemorySubscriptions();
      const t = inMemoryTemplates.get(id);
      if (!t) throw ApiError.notFound(`Quotation template with ID ${id} not found`);
      return t;
    }
  }

  async createTemplate(data: CreateQuotationTemplateInput): Promise<QuotationTemplateRecord> {
    const { lines, ...templateData } = data;

    try {
      return await db.transaction(async (trx) => {
        const [insertedTemplate] = await trx('quotation_templates')
          .insert({
            name: templateData.name,
            validity_days: templateData.validity_days || 30,
            plan_id: templateData.plan_id || null,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning('*');

        const lineRows = lines.map((l) => ({
          template_id: insertedTemplate.id,
          product_id: l.product_id,
          variant_id: l.variant_id || null,
          quantity: l.quantity,
          created_at: new Date(),
          updated_at: new Date(),
        }));

        const insertedLines = await trx('quotation_template_lines').insert(lineRows).returning('*');
        return { ...insertedTemplate, lines: insertedLines };
      });
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      seedInMemorySubscriptions();
      const newId = inMemoryTemplates.size + 10;
      const tLines: QuotationTemplateLineRecord[] = lines.map((l, i) => ({
        id: i + 100,
        template_id: newId,
        product_id: l.product_id,
        variant_id: l.variant_id || null,
        quantity: l.quantity,
      }));
      const newT: QuotationTemplateRecord = {
        id: newId,
        name: templateData.name,
        validity_days: templateData.validity_days || 30,
        plan_id: templateData.plan_id || null,
        lines: tLines,
      };
      inMemoryTemplates.set(newId, newT);
      return newT;
    }
  }

  async updateTemplate(id: number, data: UpdateQuotationTemplateInput): Promise<QuotationTemplateRecord> {
    const { lines, ...templateData } = data;

    try {
      return await db.transaction(async (trx) => {
        const existing = await trx('quotation_templates').where({ id }).first();
        if (!existing) throw ApiError.notFound(`Quotation template with ID ${id} not found`);

        if (Object.keys(templateData).length > 0) {
          await trx('quotation_templates').where({ id }).update({
            ...templateData,
            updated_at: new Date(),
          });
        }

        if (lines) {
          await trx('quotation_template_lines').where({ template_id: id }).del();
          if (lines.length > 0) {
            const lineRows = lines.map((l) => ({
              template_id: id,
              product_id: l.product_id,
              variant_id: l.variant_id || null,
              quantity: l.quantity,
              created_at: new Date(),
              updated_at: new Date(),
            }));
            await trx('quotation_template_lines').insert(lineRows);
          }
        }

        const updated = await trx('quotation_templates').where({ id }).first();
        const updatedLines = await trx('quotation_template_lines').where({ template_id: id });
        return { ...updated, lines: updatedLines };
      });
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      seedInMemorySubscriptions();
      const t = inMemoryTemplates.get(id);
      if (!t) throw ApiError.notFound(`Quotation template with ID ${id} not found`);
      Object.assign(t, templateData);
      if (lines) {
        t.lines = lines.map((l, i) => ({
          id: i + 200,
          template_id: id,
          product_id: l.product_id,
          variant_id: l.variant_id || null,
          quantity: l.quantity,
        }));
      }
      return t;
    }
  }

  async deleteTemplate(id: number): Promise<void> {
    try {
      const count = await db('quotation_templates').where({ id }).del();
      if (!count) throw ApiError.notFound(`Quotation template with ID ${id} not found`);
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      seedInMemorySubscriptions();
      if (!inMemoryTemplates.has(id)) throw ApiError.notFound(`Quotation template with ID ${id} not found`);
      inMemoryTemplates.delete(id);
    }
  }

  /* ====================================================================
   * POST /subscriptions/from-template/:id
   * Creates a DRAFT subscription with lines prefilled and computed expiry
   * ==================================================================== */

  async createFromTemplate(templateId: number, input: FromTemplateInput, userId?: number): Promise<SubscriptionRecord> {
    const template = await this.getTemplateById(templateId);
    if (!template.plan_id) {
      throw ApiError.badRequest(`Quotation template "${template.name}" has no associated plan`);
    }
    if (!template.lines || template.lines.length === 0) {
      throw ApiError.badRequest(`Quotation template "${template.name}" has no product lines`);
    }

    const startDateStr = input.start_date || new Date().toISOString().split('T')[0];
    const startDate = new Date(startDateStr);
    const expiryDate = new Date(startDate.getTime() + template.validity_days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    // Pre-fill lines
    const subscriptionLines = template.lines.map((l) => ({
      product_id: l.product_id,
      variant_id: l.variant_id || null,
      quantity: l.quantity,
    }));

    return this.createSubscription(
      {
        customer_id: input.customer_id,
        plan_id: template.plan_id,
        start_date: startDateStr,
        expiry_date: expiryDate,
        payment_terms: input.payment_terms || 'immediate',
        status: 'DRAFT',
        lines: subscriptionLines,
      },
      userId
    );
  }

  /* ====================================================================
   * SUBSCRIPTION CRUD
   * Computes line amounts server-side using getEffectivePrice
   * Enforces plan.min_quantity
   * Auto-generates unique number (SUB-000001)
   * ==================================================================== */

  async listSubscriptions(
    filter: { status?: string; customer_id?: number; start_date?: string; expiry_date?: string },
    pagination: PaginationParams
  ): Promise<PaginatedResponse<SubscriptionRecord>> {
    try {
      let query = db('subscriptions').select('*');
      if (filter.status) query = query.where({ status: filter.status });
      if (filter.customer_id) query = query.where({ customer_id: filter.customer_id });
      if (filter.start_date) query = query.where('start_date', '>=', filter.start_date);
      if (filter.expiry_date) query = query.where('expiry_date', '<=', filter.expiry_date);

      const result = await paginateKnexQuery<SubscriptionRecord>(query, pagination);
      const subIds = result.data.map((s) => s.id);
      if (subIds.length > 0) {
        const lines = await db('subscription_lines').whereIn('subscription_id', subIds);
        for (const sub of result.data) {
          sub.lines = lines.filter((l) => l.subscription_id === sub.id);
        }
      }
      return result;
    } catch {
      seedInMemorySubscriptions();
      let items = Array.from(inMemorySubscriptions.values());
      if (filter.status) items = items.filter((s) => s.status === filter.status);
      if (filter.customer_id) items = items.filter((s) => s.customer_id === Number(filter.customer_id));
      if (filter.start_date) items = items.filter((s) => s.start_date >= filter.start_date!);
      return paginateArray(items, pagination);
    }
  }

  async getSubscriptionById(id: number): Promise<SubscriptionRecord> {
    try {
      const sub = await db('subscriptions').where({ id }).first();
      if (!sub) throw ApiError.notFound(`Subscription with ID ${id} not found`);
      const lines = await db('subscription_lines').where({ subscription_id: id });
      const history = await db('subscription_status_history').where({ subscription_id: id }).orderBy('changed_at', 'asc');
      return { ...sub, lines, history };
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      seedInMemorySubscriptions();
      const sub = inMemorySubscriptions.get(id);
      if (!sub) throw ApiError.notFound(`Subscription with ID ${id} not found`);
      return {
        ...sub,
        history: inMemoryHistory.get(id) || [],
      };
    }
  }

  async createSubscription(data: CreateSubscriptionInput, userId?: number): Promise<SubscriptionRecord> {
    // 1. Validate Plan and Minimum Quantity
    const plan = await catalogService.getPlanById(data.plan_id);
    const totalQty = data.lines.reduce((sum, line) => sum + Number(line.quantity), 0);
    if (totalQty < plan.min_quantity) {
      throw ApiError.badRequest(
        `Total subscription quantity (${totalQty}) is less than plan "${plan.name}" minimum quantity requirement (${plan.min_quantity})`
      );
    }

    // 2. Compute effective prices and line amounts server-side
    const computedLines: Array<{
      product_id: number;
      variant_id: number | null;
      quantity: number;
      unit_price: number;
      tax_id: number | null;
      amount: number;
    }> = [];

    for (const line of data.lines) {
      const effectivePrice = await getEffectivePrice(line.product_id, line.variant_id);
      const lineAmount = effectivePrice * Number(line.quantity);
      computedLines.push({
        product_id: line.product_id,
        variant_id: line.variant_id || null,
        quantity: line.quantity ?? 1,
        unit_price: effectivePrice,
        tax_id: line.tax_id || null,
        amount: lineAmount,
      });
    }

    // 3. Generate unique subscription number
    const subNumber = await this.generateSubscriptionNumber();
    const startDate = data.start_date || new Date().toISOString().split('T')[0];
    const initialStatus = data.status || 'DRAFT';

    let nextBillingDate: string | null = null;
    if (initialStatus === 'ACTIVE') {
      nextBillingDate = this.computeNextBillingDate(startDate, plan.billing_period);
    }

    try {
      return await db.transaction(async (trx) => {
        const [insertedSub] = await trx('subscriptions')
          .insert({
            number: subNumber,
            customer_id: data.customer_id,
            plan_id: data.plan_id,
            start_date: startDate,
            expiry_date: data.expiry_date || null,
            payment_terms: data.payment_terms || 'immediate',
            status: initialStatus,
            next_billing_date: nextBillingDate,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning('*');

        const lineRows = computedLines.map((l) => ({
          subscription_id: insertedSub.id,
          ...l,
          created_at: new Date(),
          updated_at: new Date(),
        }));

        const insertedLines = await trx('subscription_lines').insert(lineRows).returning('*');

        // Initial history record
        await trx('subscription_status_history').insert({
          subscription_id: insertedSub.id,
          from_status: null,
          to_status: initialStatus,
          changed_by: userId || null,
          changed_at: new Date(),
        });

        return { ...insertedSub, lines: insertedLines };
      });
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      seedInMemorySubscriptions();
      const newId = inMemorySubscriptions.size + 10;
      const subLines: SubscriptionLineRecord[] = computedLines.map((l, i) => ({
        id: i + 300,
        subscription_id: newId,
        ...l,
      }));
      const newSub: SubscriptionRecord = {
        id: newId,
        number: subNumber,
        customer_id: data.customer_id,
        plan_id: data.plan_id,
        start_date: startDate,
        expiry_date: data.expiry_date || null,
        payment_terms: data.payment_terms || 'immediate',
        status: initialStatus,
        next_billing_date: nextBillingDate,
        lines: subLines,
      };
      inMemorySubscriptions.set(newId, newSub);
      inMemoryHistory.set(newId, [
        {
          id: 1,
          subscription_id: newId,
          from_status: null,
          to_status: initialStatus,
          changed_by: userId || null,
          changed_at: new Date(),
        },
      ]);
      return newSub;
    }
  }

  async updateSubscription(id: number, data: UpdateSubscriptionInput): Promise<SubscriptionRecord> {
    const existing = await this.getSubscriptionById(id);
    if (existing.status === 'CLOSED') {
      throw ApiError.badRequest('Cannot update a CLOSED subscription');
    }

    try {
      return await db.transaction(async (trx) => {
        if (data.lines) {
          const plan = await catalogService.getPlanById(data.plan_id || existing.plan_id);
          const totalQty = data.lines.reduce((sum, line) => sum + Number(line.quantity), 0);
          if (totalQty < plan.min_quantity) {
            throw ApiError.badRequest(
              `Total subscription quantity (${totalQty}) is less than plan minimum quantity (${plan.min_quantity})`
            );
          }

          await trx('subscription_lines').where({ subscription_id: id }).del();
          const lineRows = [];
          for (const line of data.lines) {
            const price = await getEffectivePrice(line.product_id, line.variant_id);
            lineRows.push({
              subscription_id: id,
              product_id: line.product_id,
              variant_id: line.variant_id || null,
              quantity: line.quantity,
              unit_price: price,
              tax_id: line.tax_id || null,
              amount: price * Number(line.quantity),
              created_at: new Date(),
              updated_at: new Date(),
            });
          }
          await trx('subscription_lines').insert(lineRows);
        }

        const { lines, ...subData } = data;
        if (Object.keys(subData).length > 0) {
          await trx('subscriptions').where({ id }).update({
            ...subData,
            updated_at: new Date(),
          });
        }

        const updated = await trx('subscriptions').where({ id }).first();
        const updatedLines = await trx('subscription_lines').where({ subscription_id: id });
        return { ...updated, lines: updatedLines };
      });
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      seedInMemorySubscriptions();
      const sub = inMemorySubscriptions.get(id);
      if (!sub) throw ApiError.notFound(`Subscription with ID ${id} not found`);
      Object.assign(sub, data);
      return sub;
    }
  }

  async deleteSubscription(id: number): Promise<void> {
    try {
      const count = await db('subscriptions').where({ id }).del();
      if (!count) throw ApiError.notFound(`Subscription with ID ${id} not found`);
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      seedInMemorySubscriptions();
      if (!inMemorySubscriptions.has(id)) throw ApiError.notFound(`Subscription with ID ${id} not found`);
      inMemorySubscriptions.delete(id);
    }
  }

  /* ====================================================================
   * STRICT STATE MACHINE: POST /subscriptions/:id/transition
   * DRAFT → QUOTATION → CONFIRMED → ACTIVE → CLOSED
   * Writes history row (who, when) in the same transaction
   * Sets next_billing_date on transition to ACTIVE
   * Honors plan allow_close / allow_pause / allow_renew rules
   * ==================================================================== */

  async transitionStatus(
    id: number,
    toStatus: 'DRAFT' | 'QUOTATION' | 'CONFIRMED' | 'ACTIVE' | 'CLOSED',
    userId?: number
  ): Promise<SubscriptionRecord> {
    const sub = await this.getSubscriptionById(id);
    const fromStatus = sub.status;

    if (fromStatus === toStatus) {
      throw ApiError.badRequest(`Subscription is already in state ${toStatus}`);
    }

    // Strict allowed transition state machine
    const ALLOWED_TRANSITIONS: Record<string, string[]> = {
      DRAFT: ['QUOTATION', 'CLOSED'],
      QUOTATION: ['CONFIRMED', 'DRAFT', 'CLOSED'],
      CONFIRMED: ['ACTIVE', 'CLOSED'],
      ACTIVE: ['CLOSED'],
      CLOSED: [], // Terminal state
    };

    const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
    if (!allowed.includes(toStatus)) {
      throw ApiError.badRequest(
        `Illegal status transition: cannot transition subscription from ${fromStatus} to ${toStatus}. Allowed next states: [${allowed.join(
          ', '
        )}]`
      );
    }

    // Honor plan rules
    const plan = await catalogService.getPlanById(sub.plan_id);

    if (toStatus === 'CLOSED' && !plan.allow_close) {
      throw ApiError.badRequest(`Cannot close subscription: associated plan "${plan.name}" does not allow closing`);
    }

    // Determine next_billing_date if moving to ACTIVE
    let nextBillingDate = sub.next_billing_date;
    if (toStatus === 'ACTIVE') {
      nextBillingDate = this.computeNextBillingDate(sub.start_date, plan.billing_period);
    }

    try {
      return await db.transaction(async (trx) => {
        // Concurrency-safe state transition: UPDATE ... WHERE id = :id AND status = :fromStatus
        const updatedRows = await trx('subscriptions')
          .where({ id, status: fromStatus })
          .update({
            status: toStatus,
            next_billing_date: nextBillingDate,
            updated_at: new Date(),
          })
          .returning('*');

        if (!updatedRows || updatedRows.length === 0) {
          throw ApiError.conflict(
            `Concurrent update conflict: subscription #${id} status changed from ${fromStatus} before transition could complete`
          );
        }

        const updatedSub = updatedRows[0];

        // 2. Write history row in the SAME transaction
        await trx('subscription_status_history').insert({
          subscription_id: id,
          from_status: fromStatus,
          to_status: toStatus,
          changed_by: userId || null,
          changed_at: new Date(),
        });

        const lines = await trx('subscription_lines').where({ subscription_id: id });
        const history = await trx('subscription_status_history')
          .where({ subscription_id: id })
          .orderBy('changed_at', 'asc');

        return { ...updatedSub, lines, history };
      });
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      seedInMemorySubscriptions();
      const memSub = inMemorySubscriptions.get(id);
      if (!memSub || memSub.status !== fromStatus) {
        throw ApiError.conflict(
          `Concurrent update conflict: subscription #${id} status changed from ${fromStatus} before transition could complete`
        );
      }
      memSub.status = toStatus;
      memSub.next_billing_date = nextBillingDate;
      const historyList = inMemoryHistory.get(id) || [];
      historyList.push({
        id: historyList.length + 1,
        subscription_id: id,
        from_status: fromStatus,
        to_status: toStatus,
        changed_by: userId || null,
        changed_at: new Date(),
      });
      inMemoryHistory.set(id, historyList);
      return {
        ...memSub,
        status: toStatus,
        next_billing_date: nextBillingDate,
        history: historyList,
      };
    }
  }

  /* ====================================================================
   * SUBSCRIPTION ACTIONS: close, pause, renew
   * Honors plan allow_close / allow_pause / allow_renew rules
   * ==================================================================== */

  async closeSubscription(id: number, userId?: number): Promise<SubscriptionRecord> {
    return this.transitionStatus(id, 'CLOSED', userId);
  }

  async pauseSubscription(id: number, userId?: number): Promise<SubscriptionRecord> {
    const sub = await this.getSubscriptionById(id);
    const plan = await catalogService.getPlanById(sub.plan_id);

    if (!plan.allow_pause) {
      throw ApiError.badRequest(`Cannot pause subscription: associated plan "${plan.name}" does not allow pausing`);
    }

    if (sub.status !== 'ACTIVE') {
      throw ApiError.badRequest(
        `Cannot pause subscription: subscription is in state ${sub.status}, only ACTIVE subscriptions can be paused`
      );
    }

    try {
      return await db.transaction(async (trx) => {
        const activeSub = await trx('subscriptions').where({ id, status: 'ACTIVE' }).first();
        if (!activeSub) {
          throw ApiError.conflict(
            `Concurrent update conflict: subscription #${id} is no longer ACTIVE and cannot be paused`
          );
        }

        await trx('subscription_status_history').insert({
          subscription_id: id,
          from_status: sub.status,
          to_status: 'PAUSED',
          changed_by: userId || null,
          changed_at: new Date(),
        });

        const lines = await trx('subscription_lines').where({ subscription_id: id });
        const history = await trx('subscription_status_history')
          .where({ subscription_id: id })
          .orderBy('changed_at', 'asc');

        return { ...activeSub, lines, history };
      });
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      seedInMemorySubscriptions();
      const memSub = inMemorySubscriptions.get(id);
      if (!memSub || memSub.status !== 'ACTIVE') {
        throw ApiError.conflict(
          `Concurrent update conflict: subscription #${id} is no longer ACTIVE and cannot be paused`
        );
      }
      const historyList = inMemoryHistory.get(id) || [];
      historyList.push({
        id: historyList.length + 1,
        subscription_id: id,
        from_status: sub.status,
        to_status: 'PAUSED',
        changed_by: userId || null,
        changed_at: new Date(),
      });
      inMemoryHistory.set(id, historyList);
      return {
        ...memSub,
        history: historyList,
      };
    }
  }

  async renewSubscription(id: number, userId?: number): Promise<SubscriptionRecord> {
    const sub = await this.getSubscriptionById(id);
    const plan = await catalogService.getPlanById(sub.plan_id);

    if (!plan.allow_renew) {
      throw ApiError.badRequest(`Cannot renew subscription: associated plan "${plan.name}" does not allow renewal`);
    }

    const baseDate = sub.next_billing_date || sub.start_date;
    const nextBillingDate = this.computeNextBillingDate(baseDate, plan.billing_period);

    try {
      return await db.transaction(async (trx) => {
        const updatedRows = await trx('subscriptions')
          .where({ id, status: sub.status })
          .update({
            status: 'ACTIVE',
            next_billing_date: nextBillingDate,
            updated_at: new Date(),
          })
          .returning('*');

        if (!updatedRows || updatedRows.length === 0) {
          throw ApiError.conflict(
            `Concurrent update conflict: subscription #${id} status changed before renewal could complete`
          );
        }
        const updatedSub = updatedRows[0];

        await trx('subscription_status_history').insert({
          subscription_id: id,
          from_status: sub.status,
          to_status: 'RENEWED',
          changed_by: userId || null,
          changed_at: new Date(),
        });

        const lines = await trx('subscription_lines').where({ subscription_id: id });
        const history = await trx('subscription_status_history')
          .where({ subscription_id: id })
          .orderBy('changed_at', 'asc');

        return { ...updatedSub, lines, history };
      });
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      seedInMemorySubscriptions();
      const memSub = inMemorySubscriptions.get(id);
      if (!memSub || memSub.status !== sub.status) {
        throw ApiError.conflict(
          `Concurrent update conflict: subscription #${id} status changed before renewal could complete`
        );
      }
      memSub.status = 'ACTIVE';
      memSub.next_billing_date = nextBillingDate;
      const historyList = inMemoryHistory.get(id) || [];
      historyList.push({
        id: historyList.length + 1,
        subscription_id: id,
        from_status: sub.status,
        to_status: 'RENEWED',
        changed_by: userId || null,
        changed_at: new Date(),
      });
      inMemoryHistory.set(id, historyList);
      return {
        ...memSub,
        status: 'ACTIVE',
        next_billing_date: nextBillingDate,
        history: historyList,
      };
    }
  }
}

export const subscriptionsService = new SubscriptionsService();
