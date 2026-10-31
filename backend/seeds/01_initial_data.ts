import type { Knex } from 'knex';
import bcrypt from 'bcryptjs';

export async function seed(knex: Knex): Promise<void> {
  // Clear existing entries in reverse dependency order
  await knex('payments').del();
  await knex('invoice_lines').del();
  await knex('invoices').del();
  await knex('subscription_status_history').del();
  await knex('subscription_lines').del();
  await knex('subscriptions').del();
  await knex('quotation_template_lines').del();
  await knex('quotation_templates').del();
  await knex('discounts').del();
  await knex('product_variants').del();
  await knex('products').del();
  await knex('plans').del();
  await knex('taxes').del();
  await knex('users').del();

  const defaultPasswordHash = bcrypt.hashSync('Password123!', 10);

  // 1. Users: 1 admin, 2 staff, 5 customers
  const users = await knex('users')
    .insert([
      {
        email: 'admin@brightloop.com',
        password_hash: defaultPasswordHash,
        name: 'System Admin',
        role: 'ADMIN',
        is_active: true,
      },
      {
        email: 'staff1@brightloop.com',
        password_hash: defaultPasswordHash,
        name: 'Sarah Connor (Staff)',
        role: 'STAFF',
        is_active: true,
      },
      {
        email: 'staff2@brightloop.com',
        password_hash: defaultPasswordHash,
        name: 'James Miller (Staff)',
        role: 'STAFF',
        is_active: true,
      },
      {
        email: 'customer1@brightloop.com',
        password_hash: defaultPasswordHash,
        name: 'Acme Corp (Alice Johnson)',
        role: 'CUSTOMER',
        is_active: true,
      },
      {
        email: 'customer2@brightloop.com',
        password_hash: defaultPasswordHash,
        name: 'TechFlow Inc (Bob Smith)',
        role: 'CUSTOMER',
        is_active: true,
      },
      {
        email: 'customer3@brightloop.com',
        password_hash: defaultPasswordHash,
        name: 'Starlight Media (Carol Davis)',
        role: 'CUSTOMER',
        is_active: true,
      },
      {
        email: 'customer4@brightloop.com',
        password_hash: defaultPasswordHash,
        name: 'Nexus Logistics (David Brown)',
        role: 'CUSTOMER',
        is_active: true,
      },
      {
        email: 'customer5@brightloop.com',
        password_hash: defaultPasswordHash,
        name: 'Vertex Dynamics (Eva Wilson)',
        role: 'CUSTOMER',
        is_active: true,
      },
    ])
    .returning(['id', 'email', 'role']);

  // 2. Taxes: 2 taxes
  await knex('taxes').insert([
    {
      name: 'Standard VAT (20%)',
      rate_percent: 20.0,
      active: true,
    },
    {
      name: 'Reduced Rate GST (5%)',
      rate_percent: 5.0,
      active: true,
    },
  ]);

  // 3. Plans: 3 plans
  await knex('plans').insert([
    {
      name: 'Starter Monthly',
      price: 49.0,
      billing_period: 'MONTHLY',
      min_quantity: 1,
      start_date: new Date('2026-01-01'),
      auto_close: false,
      allow_close: true,
      allow_pause: true,
      allow_renew: true,
      status: 'ACTIVE',
    },
    {
      name: 'Professional Monthly',
      price: 149.0,
      billing_period: 'MONTHLY',
      min_quantity: 1,
      start_date: new Date('2026-01-01'),
      auto_close: false,
      allow_close: true,
      allow_pause: true,
      allow_renew: true,
      status: 'ACTIVE',
    },
    {
      name: 'Enterprise Annual',
      price: 1490.0,
      billing_period: 'YEARLY',
      min_quantity: 5,
      start_date: new Date('2026-01-01'),
      auto_close: false,
      allow_close: false,
      allow_pause: true,
      allow_renew: true,
      status: 'ACTIVE',
    },
  ]);

  // 4. Products: 3 products
  const products = await knex('products')
    .insert([
      {
        name: 'Cloud Workspace Suite',
        type: 'service',
        sales_price: 49.0,
        cost_price: 15.0,
        notes: 'Secure cloud collaboration and workspace tools.',
      },
      {
        name: 'Dedicated Support Pack',
        type: 'service',
        sales_price: 199.0,
        cost_price: 60.0,
        notes: '24/7 dedicated engineering support coverage.',
      },
      {
        name: 'Odoo Enterprise Connector',
        type: 'service',
        sales_price: 299.0,
        cost_price: 80.0,
        notes: 'Two-way synchronization for ERP accounts, products, and subscriptions.',
      },
    ])
    .returning(['id', 'name']);

  // 5. Product Variants for the 3 products
  const p1 = products.find((p) => p.name === 'Cloud Workspace Suite')?.id;
  const p2 = products.find((p) => p.name === 'Dedicated Support Pack')?.id;
  const p3 = products.find((p) => p.name === 'Odoo Enterprise Connector')?.id;

  const variants = [];
  if (p1) {
    variants.push(
      { product_id: p1, attribute: 'Storage', value: '100 GB', extra_price: 0.0 },
      { product_id: p1, attribute: 'Storage', value: '500 GB', extra_price: 25.0 },
      { product_id: p1, attribute: 'Storage', value: '2 TB', extra_price: 75.0 }
    );
  }
  if (p2) {
    variants.push(
      { product_id: p2, attribute: 'SLA Level', value: 'Standard (24h)', extra_price: 0.0 },
      { product_id: p2, attribute: 'SLA Level', value: 'Priority (4h)', extra_price: 150.0 },
      { product_id: p2, attribute: 'SLA Level', value: 'Mission Critical (1h)', extra_price: 350.0 }
    );
  }
  if (p3) {
    variants.push(
      { product_id: p3, attribute: 'Brand', value: 'Community Edition', extra_price: 0.0 },
      { product_id: p3, attribute: 'Brand', value: 'Odoo', extra_price: 560.0 } // Matches prompt example "Brand=Odoo, +560"
    );
  }

  if (variants.length > 0) {
    await knex('product_variants').insert(variants);
  }

  console.log('✅ Seed data successfully inserted (1 admin, 2 staff, 5 customers, 3 products + variants, 3 plans, 2 taxes).');
}
