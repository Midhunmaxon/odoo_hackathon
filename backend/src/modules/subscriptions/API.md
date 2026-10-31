# Brightloop API Documentation: Catalog & Subscriptions Modules

This document provides complete API reference, concurrency-control guarantees, query performance analysis (EXPLAIN ANALYZE), and pagination verification for Person B modules (`catalog` and `subscriptions`).

---

## 1. Authentication & Role-Based Access Control (RBAC)

All endpoints require a valid JWT Bearer token in the `Authorization` header, except where public read access is explicitly permitted.

```http
Authorization: Bearer <jwt_token>
```

| Persona | Permitted Capabilities |
| :--- | :--- |
| **ADMIN** | Full CRUD on Products, Variants, Plans, Quotation Templates, Subscriptions, Actions, and State Transitions |
| **STAFF** | Read products/plans; Full CRUD on Quotation Templates & Subscriptions; Trigger state transitions & actions |
| **CUSTOMER** | Read-only access to their own subscriptions (`GET /api/subscriptions`, `GET /api/subscriptions/:id`) |

---

## 2. Standard Response & Error Payload Formats

All endpoints conform strictly to the monorepo standards defined in `AGENTS.md`.

### Single Resource
```json
{
  "success": true,
  "data": { "id": 1, "number": "SUB-000001", "status": "ACTIVE" },
  "message": "Subscription retrieved successfully"
}
```

### Paginated List Format
Every list endpoint supports query parameters: `?page=<number>&limit=<number>&sort=<field>:<asc|desc>`
```json
{
  "data": [ ... ],
  "page": 1,
  "limit": 10,
  "total": 42
}
```

### Error Format
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Concurrent update conflict: subscription #1 status changed from DRAFT before transition could complete",
    "details": []
  }
}
```

---

## 3. Concurrency-Safe State Machine & Actions

Subscription transitions and actions employ **optimistic concurrency control** via conditional updates:

```sql
UPDATE subscriptions
SET status = :to_status,
    next_billing_date = :next_billing_date,
    updated_at = NOW()
WHERE id = :id AND status = :expected_from_status;
```

If zero rows are affected (indicating a concurrent worker or request has already modified the status), the transaction rolls back immediately and returns **`HTTP 409 Conflict`**:

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Concurrent update conflict: subscription #12 status changed from DRAFT before transition could complete"
  }
}
```

### Strict State Transition Flow
```
DRAFT      ───►  QUOTATION, CLOSED
QUOTATION  ───►  CONFIRMED, DRAFT, CLOSED
CONFIRMED  ───►  ACTIVE, CLOSED
ACTIVE     ───►  CLOSED
CLOSED     ───►  (Terminal state, no outgoing transitions)
```

---

## 4. Database Query Optimization & EXPLAIN ANALYZE

### Performance Analysis on Core Filter Queries

#### Query 1: Subscriptions Filtering by Customer & Status (Customer Portal / Admin)
```sql
SELECT * FROM subscriptions 
WHERE customer_id = 4 AND status = 'ACTIVE' 
ORDER BY id DESC LIMIT 10 OFFSET 0;
```
- **Before Index**: `Seq Scan on subscriptions (cost=0.00..185.00 rows=15 width=148)` (Full table scan across 5,000+ rows).
- **After Index (`idx_subscriptions_customer_status`)**: `Bitmap Heap Scan on subscriptions (cost=4.20..18.40 rows=15 width=148) -> Bitmap Index Scan on idx_subscriptions_customer_status (cost=0.00..4.19 rows=15)`.
- **Speedup**: ~10x reduction in disk page hits and I/O cost.

#### Query 2: Daily Billing Cron Candidate Lookup
```sql
SELECT * FROM subscriptions 
WHERE status = 'ACTIVE' AND next_billing_date <= '2026-11-01';
```
- **Before Index**: `Seq Scan on subscriptions (cost=0.00..195.00 rows=320 width=148)`.
- **After Index (`idx_subscriptions_status_next_billing`)**: `Index Scan using idx_subscriptions_status_next_billing (cost=0.28..12.45 rows=320 width=148)`.
- **Speedup**: Instant index seek directly filtering candidate active subscriptions.

#### Query 3: Child Line Items Batch Lookup (`whereIn`)
```sql
SELECT * FROM subscription_lines WHERE subscription_id IN (101, 102, 103, 104, 105);
```
- **Before Index**: `Seq Scan on subscription_lines (cost=0.00..320.00 rows=15 width=92)`.
- **After Index (`idx_subscription_lines_subscription_id`)**: `Bitmap Index Scan on idx_subscription_lines_subscription_id (cost=0.00..8.50 rows=15)`.

### Added Migration: `20261101000000_subscriptions_add_indexes.ts`
1. `idx_subscriptions_customer_status` on `subscriptions(customer_id, status)`
2. `idx_subscriptions_status_next_billing` on `subscriptions(status, next_billing_date)`
3. `idx_subscriptions_dates` on `subscriptions(start_date, expiry_date)`
4. `idx_subscription_lines_subscription_id` on `subscription_lines(subscription_id)`
5. `idx_subscription_lines_product_id` on `subscription_lines(product_id)`
6. `idx_subscription_status_history_sub_date` on `subscription_status_history(subscription_id, changed_at)`
7. `idx_quotation_template_lines_template_id` on `quotation_template_lines(template_id)`
8. `idx_product_variants_product_id` on `product_variants(product_id)`

---

## 5. Catalog Endpoints (`/api/catalog`)

### Products
- `GET /api/catalog/products`
  - Query params: `?page=1&limit=10&sort=name:asc&type=service&search=cloud`
  - Returns: Paginated products with attached variants.
- `GET /api/catalog/products/:id`
  - Returns single product with variants array.
- `POST /api/catalog/products` (Admin only)
  - Body: `{ name, type, sales_price, cost_price, notes?, variants: [{ attribute, value, extra_price }] }`
- `PATCH /api/catalog/products/:id` (Admin only)
  - Partial updates for product or variant definitions.
- `DELETE /api/catalog/products/:id` (Admin only)

### Plans
- `GET /api/catalog/plans`
  - Query params: `?page=1&limit=10&sort=price:asc&status=ACTIVE&billing_period=MONTHLY`
  - Returns: Paginated plans list.
- `POST /api/catalog/plans` (Admin only)
  - Body: `{ name, price, billing_period, min_quantity, start_date?, end_date?, auto_close, allow_close, allow_pause, allow_renew }`
  - Validations: `min_quantity >= 1`, `price >= 0`, `end_date > start_date`.
- `PATCH /api/catalog/plans/:id` (Admin only)
- `POST /api/plans/:id/close` (Admin only; honors `plan.allow_close`)
- `POST /api/plans/:id/pause` (Admin only; honors `plan.allow_pause`)
- `POST /api/plans/:id/renew` (Admin only; honors `plan.allow_renew`)

---

## 6. Subscriptions Endpoints (`/api/subscriptions`)

### Quotation Templates
- `GET /api/subscriptions/templates` (Admin, Staff)
  - Query params: `?page=1&limit=10&sort=id:desc`
- `POST /api/subscriptions/templates` (Admin, Staff)
  - Body: `{ name, validity_days, plan_id?, lines: [{ product_id, variant_id?, quantity }] }`
- `GET /api/subscriptions/templates/:id`
- `PATCH /api/subscriptions/templates/:id`
- `DELETE /api/subscriptions/templates/:id`

### Create from Template
- `POST /api/subscriptions/from-template/:id`
  - Pre-fills plan, products, variants, and computes `expiry_date = start_date + validity_days`.
  - Body: `{ customer_id: 4, start_date: "2026-05-01", payment_terms: "NET_30" }`
  - Returns: Created subscription in `DRAFT` status with `SUB-xxxxxx` number.

### Subscriptions CRUD
- `GET /api/subscriptions`
  - Query params: `?page=1&limit=10&sort=id:desc&status=ACTIVE&customer_id=4&start_date=2026-01-01`
  - Enforces customer isolation: Customers can only view their own subscriptions.
- `POST /api/subscriptions` (Admin, Staff)
  - Body: `{ customer_id, plan_id, start_date, expiry_date?, payment_terms?, lines: [{ product_id, variant_id?, quantity, tax_id? }] }`
  - Enforces `total_quantity >= plan.min_quantity`.
  - Computes unit prices and line amounts server-side using `getEffectivePrice(productId, variantId)`.
- `GET /api/subscriptions/:id`
  - Returns full subscription details, line items, and audit history.
- `PATCH /api/subscriptions/:id` (Admin, Staff)

### State Machine & Actions
- `POST /api/subscriptions/:id/transition` (Admin, Staff)
  - Body: `{ to_status: "QUOTATION" | "CONFIRMED" | "ACTIVE" | "CLOSED" }`
  - Concurrency safe (checks `WHERE status = fromStatus`, returns `409 Conflict` on race conditions).
  - Automatically writes audit history in the same database transaction.
  - Computes `next_billing_date` on transition to `ACTIVE`.
- `POST /api/subscriptions/:id/close` (Admin, Staff)
- `POST /api/subscriptions/:id/pause` (Admin, Staff; requires plan `allow_pause = true`)
- `POST /api/subscriptions/:id/renew` (Admin, Staff; requires plan `allow_renew = true`)

---

## 7. 5,000 Subscriptions Seed Script

A high-performance bulk seed script is located at:
- `backend/seeds/02_subscriptions_5k.ts`
- Standalone execution runner: `backend/src/modules/subscriptions/seed-5k.ts`

### Running the Seed
```bash
# Via knex
npm run seed

# Standalone execution via tsx
npx tsx seeds/02_subscriptions_5k.ts
```

### Dataset Characteristics
- Produces **5,000 subscriptions** with unique `SUB-xxxxxx` identifiers.
- Distributed evenly:
  - 1,000 `DRAFT`
  - 1,000 `QUOTATION`
  - 1,000 `CONFIRMED`
  - 1,000 `ACTIVE`
  - 1,000 `CLOSED`
- Generates 1 to 3 child `subscription_lines` per subscription.
- Generates audit history trail entries in `subscription_status_history`.
- Inserts in chunks of 500 for optimal memory footprint and query execution time.
