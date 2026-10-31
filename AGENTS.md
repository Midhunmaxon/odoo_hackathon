# AGENTS.md - Multi-Agent Development Guide for Brightloop

Welcome to the **Brightloop Subscription Management System** codebase. This project is structured as a modular monorepo designed for high-concurrency multi-agent collaboration.

---

## 1. Technology Stack

- **Backend**:
  - Runtime: Node.js (TypeScript)
  - Framework: Express 4
  - Database & ORM/Query Builder: PostgreSQL via Knex.js & `pg`
  - Validation: Zod
  - Authentication: JWT (`jsonwebtoken`) + `bcryptjs`
  - Testing: Jest + Supertest
- **Frontend**:
  - Framework: React 18 / 19 + Vite (TypeScript)
  - Styling: Tailwind CSS
  - State & Server Cache: TanStack React Query (`@tanstack/react-query`)
  - Routing: React Router (`react-router-dom`)
  - HTTP Client: Axios with interceptors
- **Infrastructure**:
  - Docker & Docker Compose for PostgreSQL (development & test instances)

---

## 2. Agent Ownership Matrix

To prevent merge conflicts and maintain single responsibility, the codebase is partitioned into three domain areas assigned to specific agent personas:

| Agent | Domain Areas | Backend Folders (`backend/src/modules/`) | Frontend Folders (`frontend/src/features/`) |
| :--- | :--- | :--- | :--- |
| **Agent A** | Authentication, User Management, Customer Portal | `auth/`, `users/` | `auth/`, `users/`, `portal/` |
| **Agent B** | Product Catalog, Subscriptions & Quotations | `catalog/`, `subscriptions/` | `catalog/`, `subscriptions/` |
| **Agent C** | Taxes & Discounts, Invoicing, Payments, Analytics | `tax-discount/`, `invoices/`, `payments/`, `reports/` | `tax-discount/`, `invoices/`, `payments/`, `reports/` |

---

## 3. Collaboration Rules & Guardrails

1. **Strict Module Boundary Isolation**:
   - Only edit files in your own assigned module directory (`backend/src/modules/<your_area>/` and `frontend/src/features/<your_area>/`).
   - Do NOT edit another agent's module files directly.

2. **Shared Files Modification Policy**:
   - Shared files include:
     - `backend/src/app.ts` (route registration)
     - `backend/src/db.ts`
     - `backend/migrations/*` (existing migrations)
     - `AGENTS.md`
     - Root build and config files (`package.json`, `docker-compose.yml`, etc.)
   - Shared files may change only via a small, isolated change/PR containing only registration boilerplate.

3. **Database Migration Rules**:
   - **NEVER modify an existing migration file** that has already been merged or executed.
   - New tables, columns, or indexes for your module must go in a **NEW migration file** prefixed with your module name:
     - Example: `backend/migrations/20261101_subscriptions_add_renewal_policy.ts`
     - Example: `backend/migrations/20261101_invoices_add_qr_code.ts`
   - All table names and column names must strictly follow `snake_case`.

4. **Task Completion Checklist**:
   - Write automated unit / integration tests covering your new endpoints or components.
   - Run tests (`npm test`) to ensure zero regressions across the codebase.
   - Provide a concise summary and walkthrough of changes after each completed task.

---

## 4. Naming Conventions

- **Database**:
  - Tables: Plural `snake_case` (e.g., `subscription_lines`, `quotation_templates`, `invoice_lines`)
  - Columns: `snake_case` (e.g., `sales_price`, `next_billing_date`, `period_start`)
  - Foreign Keys: `<singular_table>_id` (e.g., `customer_id`, `plan_id`, `invoice_id`)
  - Unique / Index Names: `idx_<table_name>_<columns>` / `uq_<table_name>_<columns>`
- **Backend (TypeScript)**:
  - Filenames: `kebab-case.ts` (e.g., `auth.middleware.ts`, `pagination.ts`, `invoice.service.ts`)
  - Classes & Interfaces: `PascalCase` (e.g., `SubscriptionService`, `CreateInvoiceDto`)
  - Functions & Variables: `camelCase` (e.g., `calculateProration`, `parsePagination`)
  - Constants & Enums: `UPPER_SNAKE_CASE` (e.g., `USER_ROLES`, `BILLING_PERIODS`)
- **Frontend (React + TypeScript)**:
  - Components: `PascalCase.tsx` (e.g., `SubscriptionCard.tsx`, `InvoiceTable.tsx`)
  - Hooks: `camelCase.ts` starting with `use` (e.g., `useSubscriptions.ts`)
  - Utilities: `camelCase.ts` (e.g., `formatCurrency.ts`)
- **API Endpoints**:
  - Resource routes: Plural `kebab-case` (e.g., `/api/subscription-plans`, `/api/tax-discounts`)
  - HTTP verbs follow REST semantics:
    - `GET /api/subscriptions` - List subscriptions
    - `POST /api/subscriptions` - Create subscription
    - `GET /api/subscriptions/:id` - Get subscription details
    - `PATCH /api/subscriptions/:id` - Partial update
    - `DELETE /api/subscriptions/:id` - Delete or soft delete

---

## 5. API Response & Error Standards

### Success Response Format (Single Resource)
```json
{
  "success": true,
  "data": {
    "id": "1",
    "number": "SUB-00101",
    "status": "ACTIVE"
  },
  "message": "Subscription retrieved successfully"
}
```

### Paginated List Response Format
Every list endpoint MUST support query parameters:
`?page=<number>&limit=<number>&sort=<field>:<asc|desc>`

And return the exact schema:
```json
{
  "data": [ ... ],
  "page": 1,
  "limit": 10,
  "total": 42
}
```

### Error Response Format
All application errors (validation errors, 400, 401, 403, 404, 500) must return a consistent JSON payload:
```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid subscription data provided",
    "details": [
      {
        "field": "customer_id",
        "message": "customer_id must be a valid ID"
      }
    ]
  }
}
```
Standard Error Codes:
- `VALIDATION_ERROR` (400)
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `CONFLICT` (409)
- `INTERNAL_SERVER_ERROR` (500)
