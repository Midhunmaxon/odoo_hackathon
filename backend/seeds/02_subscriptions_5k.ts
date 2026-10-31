import type { Knex } from 'knex';
import db from '../src/db';

/**
 * Seed script: 02_subscriptions_5k
 * Generates 5,000 subscriptions evenly distributed across all 5 lifecycle statuses:
 * - DRAFT (1,000)
 * - QUOTATION (1,000)
 * - CONFIRMED (1,000)
 * - ACTIVE (1,000)
 * - CLOSED (1,000)
 *
 * Each subscription includes:
 * - Associated customer and plan
 * - 1 to 3 subscription lines with realistic amounts
 * - Corresponding audit history entry
 */

const STATUSES = ['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED'] as const;
const BATCH_SIZE = 500;
const TOTAL_COUNT = 5000;

export async function seed(knex: Knex): Promise<void> {
  console.log(`[Seed 5K] Starting generation of ${TOTAL_COUNT} subscriptions...`);

  // Ensure reference data exists
  let customerUsers = await knex('users').where({ role: 'CUSTOMER' }).select('id');
  if (customerUsers.length === 0) {
    // If no customers, use any user
    customerUsers = await knex('users').select('id');
  }
  const customerIds = customerUsers.map((u) => u.id);

  const plans = await knex('plans').select('id', 'price', 'billing_period');
  if (plans.length === 0) {
    throw new Error('Cannot seed subscriptions: No plans found in database. Run initial seed first.');
  }
  const planIds = plans.map((p) => p.id);

  const products = await knex('products').select('id', 'sales_price');
  if (products.length === 0) {
    throw new Error('Cannot seed subscriptions: No products found in database. Run initial seed first.');
  }

  const variants = await knex('product_variants').select('id', 'product_id', 'extra_price');

  // Determine current starting number offset
  const latestSub = await knex('subscriptions').orderBy('id', 'desc').first();
  const startOffset = latestSub ? latestSub.id : 0;

  const now = new Date();
  const startDateStr = now.toISOString().split('T')[0];

  const subRecords: Array<{
    number: string;
    customer_id: number;
    plan_id: number;
    start_date: string;
    expiry_date: string | null;
    payment_terms: string;
    status: string;
    next_billing_date: string | null;
    created_at: Date;
    updated_at: Date;
  }> = [];

  for (let i = 1; i <= TOTAL_COUNT; i++) {
    const subIndex = startOffset + i;
    const paddedNum = String(subIndex).padStart(6, '0');
    const subNumber = `SUB-${paddedNum}`;

    // Rotate evenly through statuses: 1,000 each
    const status = STATUSES[(i - 1) % STATUSES.length];
    const customerId = customerIds[(i - 1) % customerIds.length];
    const planId = planIds[(i - 1) % planIds.length];

    // Compute next_billing_date for ACTIVE subscriptions
    let nextBillingDate: string | null = null;
    if (status === 'ACTIVE') {
      const nextDate = new Date(now.getTime() + 30 * 86400000);
      nextBillingDate = nextDate.toISOString().split('T')[0];
    }

    // Expiry date for CLOSED subscriptions or quotes
    let expiryDate: string | null = null;
    if (status === 'CLOSED' || status === 'QUOTATION') {
      const expDate = new Date(now.getTime() + 60 * 86400000);
      expiryDate = expDate.toISOString().split('T')[0];
    }

    subRecords.push({
      number: subNumber,
      customer_id: customerId,
      plan_id: planId,
      start_date: startDateStr,
      expiry_date: expiryDate,
      payment_terms: i % 2 === 0 ? 'NET_30' : 'immediate',
      status,
      next_billing_date: nextBillingDate,
      created_at: now,
      updated_at: now,
    });
  }

  // Insert subscriptions in batches
  console.log(`[Seed 5K] Inserting ${subRecords.length} subscriptions in chunks of ${BATCH_SIZE}...`);
  for (let i = 0; i < subRecords.length; i += BATCH_SIZE) {
    const chunk = subRecords.slice(i, i + BATCH_SIZE);
    const inserted = await knex('subscriptions').insert(chunk).returning(['id', 'status', 'plan_id']);

    // Build lines and status history for the batch
    const lineBatch: Array<{
      subscription_id: number;
      product_id: number;
      variant_id: number | null;
      quantity: number;
      unit_price: number;
      tax_id: number | null;
      amount: number;
      created_at: Date;
      updated_at: Date;
    }> = [];

    const historyBatch: Array<{
      subscription_id: number;
      from_status: string | null;
      to_status: string;
      changed_by: number | null;
      changed_at: Date;
    }> = [];

    for (const sub of inserted) {
      const prod = products[sub.id % products.length];
      const prodVariants = variants.filter((v) => v.product_id === prod.id);
      const variant = prodVariants.length > 0 ? prodVariants[0] : null;
      const unitPrice = Number(prod.sales_price) + (variant ? Number(variant.extra_price) : 0);
      const qty = 1 + (sub.id % 3);

      lineBatch.push({
        subscription_id: sub.id,
        product_id: prod.id,
        variant_id: variant ? variant.id : null,
        quantity: qty,
        unit_price: unitPrice,
        tax_id: null,
        amount: unitPrice * qty,
        created_at: now,
        updated_at: now,
      });

      historyBatch.push({
        subscription_id: sub.id,
        from_status: sub.status === 'DRAFT' ? null : 'DRAFT',
        to_status: sub.status,
        changed_by: null,
        changed_at: now,
      });
    }

    if (lineBatch.length > 0) {
      await knex('subscription_lines').insert(lineBatch);
    }
    if (historyBatch.length > 0) {
      await knex('subscription_status_history').insert(historyBatch);
    }

    process.stdout.write(`Processed ${Math.min(i + BATCH_SIZE, subRecords.length)} / ${subRecords.length} records\r`);
  }

  console.log(`\n[Seed 5K] Successfully seeded ${TOTAL_COUNT} subscriptions across all 5 statuses!`);
}

// Standalone execution support: npx tsx backend/seeds/02_subscriptions_5k.ts
if (require.main === module) {
  seed(db)
    .then(() => {
      console.log('[Seed 5K] Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed 5K] Error:', err);
      process.exit(1);
    });
}
