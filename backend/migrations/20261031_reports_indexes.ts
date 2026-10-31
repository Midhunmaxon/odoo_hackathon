import { Knex } from 'knex';

/**
 * Migration: reports performance indexes
 * Adds composite and single-column indexes to support the /reports/summary
 * aggregated queries (SUM, COUNT, GROUP BY) on invoices, payments and subscriptions.
 *
 * These are additive-only — the initial schema migration is NOT touched.
 */

export async function up(knex: Knex): Promise<void> {
  // ---------------------------------------------------------------------------
  // invoices
  // ---------------------------------------------------------------------------

  // Monthly revenue series: GROUP BY period_start month, filtered by status
  await knex.schema.alterTable('invoices', (t) => {
    t.index(['period_start', 'status'], 'idx_invoices_period_start_status');
  });

  // Overdue queries: due_date < today AND status NOT IN ('PAID','CANCELLED')
  await knex.schema.alterTable('invoices', (t) => {
    t.index(['due_date', 'status'], 'idx_invoices_due_date_status');
  });

  // Subscription-level invoice lookup (idempotency + catch-up)
  await knex.schema.alterTable('invoices', (t) => {
    t.index(['subscription_id', 'status'], 'idx_invoices_subscription_id_status');
  });

  // ---------------------------------------------------------------------------
  // payments
  // ---------------------------------------------------------------------------

  // Revenue collected filtered by paid_at date range
  await knex.schema.alterTable('payments', (t) => {
    t.index(['paid_at'], 'idx_payments_paid_at');
  });

  // JOIN payments → invoices then SUM(amount)
  await knex.schema.alterTable('payments', (t) => {
    t.index(['invoice_id', 'amount'], 'idx_payments_invoice_id_amount');
  });

  // ---------------------------------------------------------------------------
  // subscriptions
  // ---------------------------------------------------------------------------

  // Active-subscription count filtered by plan_id
  await knex.schema.alterTable('subscriptions', (t) => {
    t.index(['plan_id', 'status'], 'idx_subscriptions_plan_id_status');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('subscriptions', (t) => {
    t.dropIndex([], 'idx_subscriptions_plan_id_status');
  });
  await knex.schema.alterTable('payments', (t) => {
    t.dropIndex([], 'idx_payments_invoice_id_amount');
    t.dropIndex([], 'idx_payments_paid_at');
  });
  await knex.schema.alterTable('invoices', (t) => {
    t.dropIndex([], 'idx_invoices_subscription_id_status');
    t.dropIndex([], 'idx_invoices_due_date_status');
    t.dropIndex([], 'idx_invoices_period_start_status');
  });
}

