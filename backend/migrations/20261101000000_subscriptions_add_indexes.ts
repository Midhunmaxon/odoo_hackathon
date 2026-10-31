import type { Knex } from 'knex';

/**
 * Migration: subscriptions_add_indexes
 * Optimizes list filtering, join lookups, and audit history traversal
 * across subscriptions, lines, quotation templates, and product variants.
 */
export async function up(knex: Knex): Promise<void> {
  // 1. Composite indexes on subscriptions table
  await knex.schema.alterTable('subscriptions', (table) => {
    // Composite index for customer-filtered subscriptions with status (Portal & list filter)
    table.index(['customer_id', 'status'], 'idx_subscriptions_customer_status');
    // Composite index for billing runs: active subscriptions with upcoming or overdue billing date
    table.index(['status', 'next_billing_date'], 'idx_subscriptions_status_next_billing');
    // Range query index for start_date and expiry_date filtering
    table.index(['start_date', 'expiry_date'], 'idx_subscriptions_dates');
  });

  // 2. Indexes on subscription_lines table
  await knex.schema.alterTable('subscription_lines', (table) => {
    table.index(['subscription_id'], 'idx_subscription_lines_subscription_id');
    table.index(['product_id'], 'idx_subscription_lines_product_id');
  });

  // 3. Composite index on subscription_status_history
  await knex.schema.alterTable('subscription_status_history', (table) => {
    table.index(['subscription_id', 'changed_at'], 'idx_subscription_status_history_sub_date');
  });

  // 4. Index on quotation_template_lines
  await knex.schema.alterTable('quotation_template_lines', (table) => {
    table.index(['template_id'], 'idx_quotation_template_lines_template_id');
  });

  // 5. Index on product_variants
  await knex.schema.alterTable('product_variants', (table) => {
    table.index(['product_id'], 'idx_product_variants_product_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('product_variants', (table) => {
    table.dropIndex(['product_id'], 'idx_product_variants_product_id');
  });

  await knex.schema.alterTable('quotation_template_lines', (table) => {
    table.dropIndex(['template_id'], 'idx_quotation_template_lines_template_id');
  });

  await knex.schema.alterTable('subscription_status_history', (table) => {
    table.dropIndex(['subscription_id', 'changed_at'], 'idx_subscription_status_history_sub_date');
  });

  await knex.schema.alterTable('subscription_lines', (table) => {
    table.dropIndex(['product_id'], 'idx_subscription_lines_product_id');
    table.dropIndex(['subscription_id'], 'idx_subscription_lines_subscription_id');
  });

  await knex.schema.alterTable('subscriptions', (table) => {
    table.dropIndex(['start_date', 'expiry_date'], 'idx_subscriptions_dates');
    table.dropIndex(['status', 'next_billing_date'], 'idx_subscriptions_status_next_billing');
    table.dropIndex(['customer_id', 'status'], 'idx_subscriptions_customer_status');
  });
}
