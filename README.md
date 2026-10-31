# Brightloop - Subscription Management System

[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![React](https://img.shields.io/badge/React-18-cyan.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8.svg)](https://tailwindcss.com/)

**Brightloop** is an enterprise-grade Subscription Management and Recurring Billing monorepo designed for high concurrency, reliable invoicing, and collaborative multi-agent workflows.

---

## 🏗 Repository Structure

```
odoo_hackathon/
├── AGENTS.md               # Multi-agent domain boundaries, conventions & rules
├── docker-compose.yml      # PostgreSQL container services (dev + test)
├── .env.example            # Root environment template
├── package.json            # Monorepo orchestration scripts
├── README.md               # Setup and development guide
├── backend/                # Express + TypeScript + Knex + PostgreSQL
│   ├── knexfile.ts         # Knex database configuration (dev, test, prod)
│   ├── jest.config.ts      # Jest test configuration
│   ├── migrations/         # All schema migrations (snake_case columns & indexes)
│   ├── seeds/              # Database seeds (admin, staff, customers, products, plans, taxes)
│   └── src/
│       ├── app.ts          # Express application setup
│       ├── server.ts       # HTTP server entrypoint
│       ├── db.ts           # Knex shared database instance
│       ├── config/env.ts   # Zod-validated environment config
│       ├── middleware/     # Error, JWT auth, Role guards, Zod validators
│       ├── utils/          # Pagination & response formatters
│       ├── modules/        # Modular domain routers (auth, users, catalog, subscriptions, etc.)
│       └── tests/          # Jest & Supertest integration tests
└── frontend/               # React + Vite + TypeScript + Tailwind CSS
    ├── src/
    │   ├── lib/axios.ts    # Axios client with JWT interceptors
    │   ├── components/     # ProtectedRoute, RoleGuard, DashboardLayout
    │   ├── features/       # Feature modules matching domain areas
    │   └── types/          # Domain TypeScript interfaces
```

---

## ⚡ Quick Start & Setup

### 1. Prerequisites
- **Node.js** (v20+ recommended, tested on v24)
- **npm** (v10+)
- **Docker & Docker Compose** (for running PostgreSQL)

### 2. Configure Environment Files
Copy the example environment files for both root and backend:
```bash
# In the repository root
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 3. Start PostgreSQL with Docker
Start the PostgreSQL container:
```bash
docker compose up -d
# or: npm run docker:up
```
This spins up PostgreSQL on port `5432` with database `brightloop_db` and a test database on port `5433`.

### 4. Install Dependencies
Install dependencies across both backend and frontend workspaces:
```bash
npm install
```

### 5. Run Database Migrations & Seeds
Run the Knex migrations to create all 14 tables, foreign keys, unique constraints, and indexes:
```bash
npm run migrate
```
Seed the database with pre-configured users, products, variants, plans, and taxes:
```bash
npm run seed
```

Seed Data Created:
- **1 Admin**: `admin@brightloop.com` (password: `Password123!`)
- **2 Staff**: `staff1@brightloop.com`, `staff2@brightloop.com` (password: `Password123!`)
- **5 Customers**: `customer1@brightloop.com` through `customer5@brightloop.com` (password: `Password123!`)
- **3 Products with Variants**: Cloud Workspace Suite, Dedicated Support Pack, Odoo Enterprise Connector
- **3 Plans**: Starter Monthly ($49), Professional Monthly ($149), Enterprise Annual ($1,490)
- **2 Taxes**: Standard VAT (20%), Reduced Rate GST (5%)

---

## 💻 Running the Application

You can run both backend and frontend concurrently from the root directory or individually:

### Run Both Concurrently:
```bash
npm run dev
```

### Or Run Individually:
- **Backend API** (`http://localhost:5000`):
  ```bash
  npm run dev:backend
  # or: cd backend && npm run dev
  ```
- **Frontend App** (`http://localhost:5173`):
  ```bash
  npm run dev:frontend
  # or: cd frontend && npm run dev
  ```

---

## 🧪 Testing

Run automated tests (Jest + Supertest) verifying endpoints, role-based guards, and paginated responses:
```bash
npm test
# or: cd backend && npm test
```

---

## 🗄 Database Schema Highlights

- **`invoices` billing deduplication constraint**:
  ```sql
  UNIQUE(subscription_id, period_start)
  ```
  Guarantees that a customer subscription is never billed twice for the same billing cycle.
- **Indexes**:
  - `status` on `plans`, `subscriptions`, and `invoices`
  - `customer_id` on `subscriptions` and `invoices`
  - `due_date` on `invoices`
  - `next_billing_date` on `subscriptions`
  - `period_start` on `invoices`
  - `is_active` and `role` on `users`

---

## 👥 Multi-Agent Collaboration

Please read [AGENTS.md](./AGENTS.md) before making modifications.
- **Agent A**: `auth`, `users`, `portal`
- **Agent B**: `catalog`, `subscriptions`
- **Agent C**: `tax-discount`, `invoices`, `payments`, `reports`

**Rules:**
1. Only edit files in your own module.
2. Shared files (`app.ts`, `db.ts`, `AGENTS.md`, existing migrations) require a small PR.
3. New migrations must go in a **NEW** migration file prefixed with your module name.
4. Always write tests and provide a summary after each task.