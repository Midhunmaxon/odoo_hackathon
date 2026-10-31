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

  // 1. Users: 1 Admin, 2 Staff, 5 Customers
  const insertedUsers = await knex('users')
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

  const cust1 = insertedUsers.find((u) => u.email === 'customer1@brightloop.com')?.id!;
  const cust2 = insertedUsers.find((u) => u.email === 'customer2@brightloop.com')?.id!;
  const cust3 = insertedUsers.find((u) => u.email === 'customer3@brightloop.com')?.id!;

  // 2. Taxes: 2 taxes
  const insertedTaxes = await knex('taxes')
    .insert([
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
    ])
    .returning(['id', 'name', 'rate_percent']);

  const vatTaxId = insertedTaxes[0].id;
  const gstTaxId = insertedTaxes[1].id;

  // 3. Plans: 3 plans
  const insertedPlans = await knex('plans')
    .insert([
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
    ])
    .returning(['id', 'name', 'price']);

  const starterPlanId = insertedPlans[0].id;
  const proPlanId = insertedPlans[1].id;
  const enterprisePlanId = insertedPlans[2].id;

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

  // 5. Product Variants
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
      { product_id: p3, attribute: 'Brand', value: 'Odoo', extra_price: 560.0 }
    );
  }

  const insertedVariants = await knex('product_variants').insert(variants).returning(['id', 'product_id', 'value']);

  // 6. Discounts
  await knex('discounts').insert([
    {
      name: 'Welcome Launch 10%',
      type: 'PERCENT',
      value: 10.0,
      min_purchase: 40.0,
      usage_limit: 100,
      used_count: 14,
      applies_to: 'SUBSCRIPTION',
    },
    {
      name: 'Volume Discount $50',
      type: 'FIXED',
      value: 50.0,
      min_purchase: 200.0,
      usage_limit: 50,
      used_count: 8,
      applies_to: 'SUBSCRIPTION',
    },
    {
      name: 'Early Bird Support Promo',
      type: 'PERCENT',
      value: 15.0,
      applies_to: 'PRODUCT',
      product_id: p2,
    },
  ]);

  // 7. Subscriptions
  const insertedSubs = await knex('subscriptions')
    .insert([
      {
        number: 'SUB-2026-00101',
        customer_id: cust1,
        plan_id: proPlanId,
        start_date: '2026-01-01',
        payment_terms: 'net 30',
        status: 'ACTIVE',
        last_billed_period_end: '2026-10-31',
        next_billing_date: '2026-11-01',
      },
      {
        number: 'SUB-2026-00102',
        customer_id: cust1,
        plan_id: starterPlanId,
        start_date: '2026-06-01',
        payment_terms: 'immediate',
        status: 'ACTIVE',
        last_billed_period_end: '2026-10-31',
        next_billing_date: '2026-11-01',
      },
      {
        number: 'SUB-2026-00201',
        customer_id: cust2,
        plan_id: enterprisePlanId,
        start_date: '2026-03-01',
        payment_terms: 'net 30',
        status: 'ACTIVE',
        last_billed_period_end: '2027-02-28',
        next_billing_date: '2027-03-01',
      },
      {
        number: 'SUB-2026-00301',
        customer_id: cust3,
        plan_id: proPlanId,
        start_date: '2026-04-15',
        payment_terms: 'immediate',
        status: 'ACTIVE',
        last_billed_period_end: '2026-10-14',
        next_billing_date: '2026-10-15',
      },
    ])
    .returning(['id', 'number', 'customer_id']);

  const sub1 = insertedSubs[0].id;
  const sub2 = insertedSubs[1].id;
  const sub3 = insertedSubs[2].id;
  const sub4 = insertedSubs[3].id;

  // 8. Subscription Lines
  await knex('subscription_lines').insert([
    {
      subscription_id: sub1,
      product_id: p1,
      variant_id: insertedVariants[0].id,
      quantity: 1,
      unit_price: 149.0,
      tax_id: vatTaxId,
      amount: 149.0,
    },
    {
      subscription_id: sub1,
      product_id: p2,
      variant_id: insertedVariants[3].id,
      quantity: 1,
      unit_price: 199.0,
      tax_id: vatTaxId,
      amount: 199.0,
    },
    {
      subscription_id: sub2,
      product_id: p1,
      variant_id: insertedVariants[0].id,
      quantity: 1,
      unit_price: 49.0,
      tax_id: gstTaxId,
      amount: 49.0,
    },
    {
      subscription_id: sub3,
      product_id: p3,
      variant_id: insertedVariants[7]?.id || null,
      quantity: 5,
      unit_price: 299.0,
      tax_id: vatTaxId,
      amount: 1495.0,
    },
  ]);

  // 9. Realistic Invoices (PAID, UNPAID, and OVERDUE)
  const insertedInvoices = await knex('invoices')
    .insert([
      // Invoice 1: Customer 1 - PAID
      {
        number: 'INV-2026-00101',
        subscription_id: sub1,
        customer_id: cust1,
        period_start: '2026-08-01',
        period_end: '2026-08-31',
        status: 'PAID',
        subtotal: 348.0,
        tax_total: 69.6,
        discount_total: 34.8,
        total: 382.8,
        due_date: '2026-09-15',
      },
      // Invoice 2: Customer 1 - PAID
      {
        number: 'INV-2026-00102',
        subscription_id: sub1,
        customer_id: cust1,
        period_start: '2026-09-01',
        period_end: '2026-09-30',
        status: 'PAID',
        subtotal: 348.0,
        tax_total: 69.6,
        discount_total: 0.0,
        total: 417.6,
        due_date: '2026-10-15',
      },
      // Invoice 3: Customer 1 - UNPAID / CONFIRMED (Current Period, due in future)
      {
        number: 'INV-2026-00103',
        subscription_id: sub1,
        customer_id: cust1,
        period_start: '2026-10-01',
        period_end: '2026-10-31',
        status: 'CONFIRMED',
        subtotal: 348.0,
        tax_total: 69.6,
        discount_total: 0.0,
        total: 417.6,
        due_date: '2026-11-15',
      },
      // Invoice 4: Customer 1 - OVERDUE (Ad-hoc service due 2 weeks ago, unpaid)
      {
        number: 'INV-2026-00104',
        subscription_id: sub2,
        customer_id: cust1,
        period_start: '2026-09-01',
        period_end: '2026-09-30',
        status: 'CONFIRMED',
        subtotal: 49.0,
        tax_total: 2.45,
        discount_total: 0.0,
        total: 51.45,
        due_date: '2026-10-10', // PAST DUE DATE => OVERDUE
      },
      // Invoice 5: Customer 2 - PAID Annual
      {
        number: 'INV-2026-00201',
        subscription_id: sub3,
        customer_id: cust2,
        period_start: '2026-03-01',
        period_end: '2027-02-28',
        status: 'PAID',
        subtotal: 1490.0,
        tax_total: 298.0,
        discount_total: 149.0,
        total: 1639.0,
        due_date: '2026-03-15',
      },
      // Invoice 6: Customer 3 - OVERDUE (Critical enterprise account with unpaid bill)
      {
        number: 'INV-2026-00301',
        subscription_id: sub4,
        customer_id: cust3,
        period_start: '2026-08-15',
        period_end: '2026-09-14',
        status: 'CONFIRMED',
        subtotal: 149.0,
        tax_total: 29.8,
        discount_total: 0.0,
        total: 178.8,
        due_date: '2026-09-30', // PAST DUE DATE => OVERDUE
      },
      // Invoice 7: Customer 3 - OVERDUE
      {
        number: 'INV-2026-00302',
        subscription_id: sub4,
        customer_id: cust3,
        period_start: '2026-09-15',
        period_end: '2026-10-14',
        status: 'CONFIRMED',
        subtotal: 149.0,
        tax_total: 29.8,
        discount_total: 0.0,
        total: 178.8,
        due_date: '2026-10-20', // PAST DUE DATE => OVERDUE
      },
    ])
    .returning(['id', 'number', 'status', 'total']);

  const inv1 = insertedInvoices[0].id;
  const inv2 = insertedInvoices[1].id;
  const inv3 = insertedInvoices[2].id;
  const inv4 = insertedInvoices[3].id;
  const inv5 = insertedInvoices[4].id;
  const inv6 = insertedInvoices[5].id;
  const inv7 = insertedInvoices[6].id;

  // 10. Invoice Lines
  await knex('invoice_lines').insert([
    {
      invoice_id: inv1,
      product_id: p1,
      description: 'Cloud Workspace Suite (Pro) - August 2026',
      quantity: 1,
      unit_price: 149.0,
      tax_id: vatTaxId,
      tax_amount: 29.8,
      discount_amount: 14.9,
      amount: 163.9,
    },
    {
      invoice_id: inv1,
      product_id: p2,
      description: 'Dedicated Support Pack (24/7 Coverage)',
      quantity: 1,
      unit_price: 199.0,
      tax_id: vatTaxId,
      tax_amount: 39.8,
      discount_amount: 19.9,
      amount: 218.9,
    },
    {
      invoice_id: inv2,
      product_id: p1,
      description: 'Cloud Workspace Suite (Pro) - September 2026',
      quantity: 1,
      unit_price: 149.0,
      tax_id: vatTaxId,
      tax_amount: 29.8,
      discount_amount: 0.0,
      amount: 178.8,
    },
    {
      invoice_id: inv3,
      product_id: p1,
      description: 'Cloud Workspace Suite (Pro) - October 2026 (Current)',
      quantity: 1,
      unit_price: 149.0,
      tax_id: vatTaxId,
      tax_amount: 29.8,
      discount_amount: 0.0,
      amount: 178.8,
    },
    {
      invoice_id: inv4,
      product_id: p1,
      description: 'Starter Tier Extra Storage - September 2026',
      quantity: 1,
      unit_price: 49.0,
      tax_id: gstTaxId,
      tax_amount: 2.45,
      discount_amount: 0.0,
      amount: 51.45,
    },
    {
      invoice_id: inv5,
      product_id: p3,
      description: 'Odoo Enterprise Connector - Annual Unlimited',
      quantity: 1,
      unit_price: 1490.0,
      tax_id: vatTaxId,
      tax_amount: 298.0,
      discount_amount: 149.0,
      amount: 1639.0,
    },
    {
      invoice_id: inv6,
      product_id: p1,
      description: 'Cloud Workspace Suite (Pro) - Overdue Period 1',
      quantity: 1,
      unit_price: 149.0,
      tax_id: vatTaxId,
      tax_amount: 29.8,
      discount_amount: 0.0,
      amount: 178.8,
    },
    {
      invoice_id: inv7,
      product_id: p1,
      description: 'Cloud Workspace Suite (Pro) - Overdue Period 2',
      quantity: 1,
      unit_price: 149.0,
      tax_id: vatTaxId,
      tax_amount: 29.8,
      discount_amount: 0.0,
      amount: 178.8,
    },
  ]);

  // 11. Payments for the PAID invoices
  await knex('payments').insert([
    {
      invoice_id: inv1,
      method: 'CREDIT_CARD',
      amount: 382.8,
      paid_at: new Date('2026-08-10T14:32:00Z'),
      note: 'Visa ending in 4242 (Stripe ref: ch_3P7aBC2eZvKYlo2C)',
    },
    {
      invoice_id: inv2,
      method: 'BANK_TRANSFER',
      amount: 417.6,
      paid_at: new Date('2026-09-12T09:15:00Z'),
      note: 'ACH Transfer Wire Ref #9921448',
    },
    {
      invoice_id: inv5,
      method: 'BANK_TRANSFER',
      amount: 1639.0,
      paid_at: new Date('2026-03-05T11:00:00Z'),
      note: 'Annual upfront corporate ACH wire transfer',
    },
  ]);

  console.log('✅ Realistic seed dataset inserted successfully:');
  console.log('   - 8 Users (1 Admin, 2 Staff, 5 Customers)');
  console.log('   - 2 Taxes & 3 Discounts');
  console.log('   - 3 Plans & 3 Products with Variants');
  console.log('   - 4 Active Subscriptions with lines');
  console.log('   - 7 Invoices: 3 PAID, 1 UNPAID (Current), and 3 OVERDUE');
  console.log('   - 3 Payment records');
}
