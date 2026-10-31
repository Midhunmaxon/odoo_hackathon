import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Users table
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('email').notNullable().unique();
    table.string('password_hash').notNullable();
    table.string('name').notNullable();
    table.enum('role', ['ADMIN', 'STAFF', 'CUSTOMER']).notNullable().defaultTo('CUSTOMER');
    table.boolean('is_active').notNullable().defaultTo(true);
    table.string('reset_token_hash').nullable();
    table.timestamp('reset_expires').nullable();
    table.timestamps(true, true);

    table.index(['role'], 'idx_users_role');
    table.index(['is_active'], 'idx_users_is_active');
  });

  // 2. Products table
  await knex.schema.createTable('products', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('type').notNullable().defaultTo('service');
    table.decimal('sales_price', 12, 2).notNullable().defaultTo(0);
    table.decimal('cost_price', 12, 2).notNullable().defaultTo(0);
    table.text('notes').nullable();
    table.timestamps(true, true);
  });

  // 3. Product Variants table
  await knex.schema.createTable('product_variants', (table) => {
    table.increments('id').primary();
    table
      .integer('product_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('products')
      .onDelete('CASCADE');
    table.string('attribute').notNullable(); // e.g. "Brand"
    table.string('value').notNullable();     // e.g. "Odoo"
    table.decimal('extra_price', 12, 2).notNullable().defaultTo(0); // e.g. +560
    table.timestamps(true, true);

    table.index(['product_id'], 'idx_product_variants_product_id');
  });

  // 4. Plans table
  await knex.schema.createTable('plans', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.decimal('price', 12, 2).notNullable();
    table.enum('billing_period', ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).notNullable();
    table.integer('min_quantity').notNullable().defaultTo(1);
    table.date('start_date').nullable();
    table.date('end_date').nullable();
    table.boolean('auto_close').notNullable().defaultTo(false);
    table.boolean('allow_close').notNullable().defaultTo(true);
    table.boolean('allow_pause').notNullable().defaultTo(true);
    table.boolean('allow_renew').notNullable().defaultTo(true);
    table.string('status').notNullable().defaultTo('ACTIVE');
    table.timestamps(true, true);

    table.index(['status'], 'idx_plans_status');
  });

  // 5. Quotation Templates table
  await knex.schema.createTable('quotation_templates', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.integer('validity_days').notNullable().defaultTo(30);
    table
      .integer('plan_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('plans')
      .onDelete('SET NULL');
    table.timestamps(true, true);
  });

  // 6. Quotation Template Lines table
  await knex.schema.createTable('quotation_template_lines', (table) => {
    table.increments('id').primary();
    table
      .integer('template_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('quotation_templates')
      .onDelete('CASCADE');
    table
      .integer('product_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('products')
      .onDelete('RESTRICT');
    table
      .integer('variant_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('product_variants')
      .onDelete('SET NULL');
    table.decimal('quantity', 12, 2).notNullable().defaultTo(1);
    table.timestamps(true, true);
  });

  // 7. Taxes table
  await knex.schema.createTable('taxes', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.decimal('rate_percent', 5, 2).notNullable();
    table.boolean('active').notNullable().defaultTo(true);
    table.timestamps(true, true);
  });

  // 8. Discounts table
  await knex.schema.createTable('discounts', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.enum('type', ['FIXED', 'PERCENT']).notNullable();
    table.decimal('value', 12, 2).notNullable();
    table.decimal('min_purchase', 12, 2).nullable();
    table.integer('min_quantity').nullable();
    table.date('start_date').nullable();
    table.date('end_date').nullable();
    table.integer('usage_limit').nullable();
    table.integer('used_count').notNullable().defaultTo(0);
    table.enum('applies_to', ['PRODUCT', 'SUBSCRIPTION']).notNullable();
    table
      .integer('product_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('products')
      .onDelete('CASCADE');
    table.timestamps(true, true);
  });

  // 9. Subscriptions table
  await knex.schema.createTable('subscriptions', (table) => {
    table.increments('id').primary();
    table.string('number').notNullable().unique();
    table
      .integer('customer_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    table
      .integer('plan_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('plans')
      .onDelete('RESTRICT');
    table.date('start_date').notNullable();
    table.date('expiry_date').nullable();
    table.string('payment_terms').notNullable().defaultTo('immediate');
    table
      .enum('status', ['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED'])
      .notNullable()
      .defaultTo('DRAFT');
    table.date('last_billed_period_end').nullable();
    table.date('next_billing_date').nullable();
    table.timestamps(true, true);

    // Required indexes
    table.index(['status'], 'idx_subscriptions_status');
    table.index(['customer_id'], 'idx_subscriptions_customer_id');
    table.index(['next_billing_date'], 'idx_subscriptions_next_billing_date');
  });

  // 10. Subscription Lines table
  await knex.schema.createTable('subscription_lines', (table) => {
    table.increments('id').primary();
    table
      .integer('subscription_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('subscriptions')
      .onDelete('CASCADE');
    table
      .integer('product_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('products')
      .onDelete('RESTRICT');
    table
      .integer('variant_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('product_variants')
      .onDelete('SET NULL');
    table.decimal('quantity', 12, 2).notNullable().defaultTo(1);
    table.decimal('unit_price', 12, 2).notNullable();
    table
      .integer('tax_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('taxes')
      .onDelete('SET NULL');
    table.decimal('amount', 12, 2).notNullable();
    table.timestamps(true, true);
  });

  // 11. Subscription Status History table
  await knex.schema.createTable('subscription_status_history', (table) => {
    table.increments('id').primary();
    table
      .integer('subscription_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('subscriptions')
      .onDelete('CASCADE');
    table.string('from_status').nullable();
    table.string('to_status').notNullable();
    table
      .integer('changed_by')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.timestamp('changed_at').notNullable().defaultTo(knex.fn.now());
  });

  // 12. Invoices table
  await knex.schema.createTable('invoices', (table) => {
    table.increments('id').primary();
    table.string('number').notNullable().unique();
    table
      .integer('subscription_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('subscriptions')
      .onDelete('SET NULL');
    table
      .integer('customer_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    table.date('period_start').notNullable();
    table.date('period_end').notNullable();
    table
      .enum('status', ['DRAFT', 'CONFIRMED', 'PAID', 'CANCELLED'])
      .notNullable()
      .defaultTo('DRAFT');
    table.decimal('subtotal', 12, 2).notNullable().defaultTo(0);
    table.decimal('tax_total', 12, 2).notNullable().defaultTo(0);
    table.decimal('discount_total', 12, 2).notNullable().defaultTo(0);
    table.decimal('total', 12, 2).notNullable().defaultTo(0);
    table.date('due_date').notNullable();
    table.timestamps(true, true);

    // UNIQUE constraint so nothing is billed twice for the same subscription period
    table.unique(['subscription_id', 'period_start'], 'uq_invoices_subscription_period_start');

    // Required indexes
    table.index(['status'], 'idx_invoices_status');
    table.index(['customer_id'], 'idx_invoices_customer_id');
    table.index(['due_date'], 'idx_invoices_due_date');
    table.index(['period_start'], 'idx_invoices_period_start');
  });

  // 13. Invoice Lines table
  await knex.schema.createTable('invoice_lines', (table) => {
    table.increments('id').primary();
    table
      .integer('invoice_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('invoices')
      .onDelete('CASCADE');
    table
      .integer('product_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('products')
      .onDelete('SET NULL');
    table.string('description').notNullable();
    table.decimal('quantity', 12, 2).notNullable().defaultTo(1);
    table.decimal('unit_price', 12, 2).notNullable();
    table
      .integer('tax_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('taxes')
      .onDelete('SET NULL');
    table.decimal('tax_amount', 12, 2).notNullable().defaultTo(0);
    table.decimal('discount_amount', 12, 2).notNullable().defaultTo(0);
    table.decimal('amount', 12, 2).notNullable();
    table.timestamps(true, true);
  });

  // 14. Payments table
  await knex.schema.createTable('payments', (table) => {
    table.increments('id').primary();
    table
      .integer('invoice_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('invoices')
      .onDelete('CASCADE');
    table.string('method').notNullable(); // e.g. CREDIT_CARD, BANK_TRANSFER, CASH
    table.decimal('amount', 12, 2).notNullable();
    table.timestamp('paid_at').notNullable().defaultTo(knex.fn.now());
    table.text('note').nullable();
    table.timestamps(true, true);

    table.index(['invoice_id'], 'idx_payments_invoice_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('payments');
  await knex.schema.dropTableIfExists('invoice_lines');
  await knex.schema.dropTableIfExists('invoices');
  await knex.schema.dropTableIfExists('subscription_status_history');
  await knex.schema.dropTableIfExists('subscription_lines');
  await knex.schema.dropTableIfExists('subscriptions');
  await knex.schema.dropTableIfExists('discounts');
  await knex.schema.dropTableIfExists('taxes');
  await knex.schema.dropTableIfExists('quotation_template_lines');
  await knex.schema.dropTableIfExists('quotation_templates');
  await knex.schema.dropTableIfExists('plans');
  await knex.schema.dropTableIfExists('product_variants');
  await knex.schema.dropTableIfExists('products');
  await knex.schema.dropTableIfExists('users');
}
