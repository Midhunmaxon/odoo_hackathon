# Brightloop: 5-Minute Walkthrough & Demo Script

This step-by-step presentation script guides you through demonstrating the full end-to-end capabilities of the **Brightloop Subscription Management System** in 5 minutes.

---

## 🚀 Pre-Demo Checklist (30 seconds)

Ensure your database and dev servers are running:
```bash
# 1. Start database container
npm run docker:up

# 2. Run migrations and populate realistic seed data
npm run migrate
npm run seed

# 3. Start development servers
npm run dev
```

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000/api](http://localhost:5000/api)

---

## ⏱ Minute-by-Minute Walkthrough

### ⏱ Minute 1: Authentication & Interactive Security (0:00 - 1:00)
1. **Open Sign In page**: Navigate to `http://localhost:5173/login`.
   - Highlight the clean, branded login interface.
   - Point out the **Quick-Fill Demo Credentials** buttons (`Admin`, `Staff`, `Customer`).
2. **Customer Self-Registration**:
   - Click **"Need an account? Sign up"** (`/signup`).
   - Start typing in the password field to demonstrate the **Live Password-Rule Checklist**:
     - *Length > 8 characters*
     - *At least one uppercase letter (A-Z)*
     - *At least one lowercase letter (a-z)*
     - *At least one special character (!@#$%^&*)*
   - Note the real-time visual feedback (green checkmarks) as rules are satisfied.
3. **Password Recovery**:
   - Click **"Forgot password?"** (`/forgot-password`).
   - Show the secure anti-enumeration reset request flow and the token-based reset page (`/reset-password`).

---

### ⏱ Minute 2: Administrator & Staff Management (1:00 - 2:00)
1. **Sign In as System Admin**:
   - Return to `/login` and click **"Admin"** (`admin@brightloop.com` / `Password123!`).
   - Show the **Dashboard Overview** with status cards and domain ownership breakdowns.
2. **Staff Administration (`/staff`)**:
   - Click **"Staff Management"** in the sidebar.
   - Show the responsive `DataTable` with paginated records and `StatusBadge` chips.
   - Click **"Add Staff Member"**:
     - Fill in a new staff account name and email.
     - Live password security rules apply here as well.
     - Submit and show the instant Toast notification: *"Staff account created successfully"*.
   - Point out the **Deactivate** action with an accessible `ConfirmDialog` to prevent accidental removal.

---

### ⏱ Minute 3: Catalog, Plans & Subscription Contracts (2:00 - 3:00)
1. **Product Catalog & Plans (`/catalog`)**:
   - In the sidebar, navigate to **Catalog & Plans**.
   - Show services with dynamic variant pricing (e.g., Cloud Workspace with storage add-ons, Odoo Enterprise connector with brand options).
   - Show the billing tiers: *Starter ($49/mo)*, *Professional ($149/mo)*, and *Enterprise Annual ($1,490/yr)*.
2. **Subscriptions Management (`/subscriptions`)**:
   - Click **Subscriptions** in the sidebar.
   - View active recurring contracts with automated billing cycles, last billed dates, and next billing schedules.
   - Open a subscription detail view to examine itemized contract lines and renewal settings.

---

### ⏱ Minute 4: Invoicing, Overdue Detection & Payments (3:00 - 4:00)
1. **Invoices Engine (`/invoices`)**:
   - Click **Invoices** in the sidebar.
   - Notice the realistic seed data showcasing all three financial states:
     - 🟢 **PAID Invoices** (e.g. `INV-2026-00101`, `INV-2026-00102`)
     - 🟡 **UNPAID / Current Invoices** (e.g. `INV-2026-00103`)
     - 🔴 **OVERDUE Invoices** (e.g. `INV-2026-00104`, `INV-2026-00301` with past-due dates)
   - Explain the database deduplication constraint: `UNIQUE(subscription_id, period_start)` ensuring no period is ever double-billed.
2. **Payments Log (`/payments`)**:
   - Click **Payments** to view ACH wire and Stripe credit card settlement audit records.

---

### ⏱ Minute 5: Customer Portal Self-Service & Verification (4:00 - 5:00)
1. **Sign in as Customer**:
   - Sign out of Admin and sign in as **Customer**:
     `customer1@brightloop.com` / `Password123!`
2. **Role-Aware Sidebar**:
   - Point out that the navigation shell automatically transforms: administrative pages are completely hidden.
   - The customer sees **only** their own **"My Subscriptions"** and **"My Invoices"**.
3. **Inspect Subscriptions & Lines**:
   - Click **"View"** on `SUB-2026-00101` to open the itemized breakdown showing contract lines, unit prices, and schedule.
4. **Printable Tax Invoice Statement**:
   - Switch to **"My Invoices & Receipts"** tab.
   - Click **"Print"** on invoice `INV-2026-00101`.
   - The modal formats the statement as an official Tax Invoice receipt with full line-item tax details and total due.
   - Click **"Print / Download PDF"** to trigger the browser's native print preview (`@media print` optimized).
5. **Run the Automated Smoke Test**:
   - Open terminal and execute:
     ```bash
     ./scripts/smoke-test.sh
     ```
   - Watch all 7 end-to-end steps (Health → Signup → Login → Portal Subscriptions → Portal Invoices → Cross-Tenant Isolation → RBAC Security) pass with green checks!

---

## 🎯 Key Differentiators to Emphasize to Judges

| Feature | Implementation Highlight |
| :--- | :--- |
| **Strict Data Isolation** | Customer privacy is enforced at the PostgreSQL database query level (`WHERE customer_id = ?`), returning 404 for non-owned IDs rather than leaking existence. |
| **Defensive Architecture** | Multi-step database mutations use `db.transaction()` and Knex query builders (0 raw string concatenation). |
| **Shared Component Library** | Standardized `DataTable`, `StatusBadge`, `FormField`, `Toast`, and `ConfirmDialog` in `frontend/src/components/` enable consistent UX across all feature modules. |
| **Fault Tolerance** | Includes top-level React `ErrorBoundary`, resilient 404 route handling, and offline database fallback support. |
