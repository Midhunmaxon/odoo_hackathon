import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { DashboardLayout } from './components/layout/DashboardLayout';

// Features
import { LoginPage } from './features/auth';
import { UsersPage } from './features/users';
import { CatalogPage } from './features/catalog';
import { SubscriptionsPage } from './features/subscriptions';
import { TaxDiscountPage } from './features/tax-discount';
import { InvoicesPage } from './features/invoices';
import { PaymentsPage } from './features/payments';
import { ReportsPage } from './features/reports';
import { CustomerPortalPage } from './features/portal';

// Dashboard Overview Page
const OverviewPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-900 to-blue-900 text-white rounded-2xl p-8 shadow-sm">
        <h1 className="text-3xl font-extrabold mb-2">Brightloop Subscription Engine</h1>
        <p className="text-blue-200 max-w-2xl text-sm leading-relaxed">
          Centralized recurring billing, subscription lifecycle management, tax & invoice generation, and customer portal.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/subscriptions"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow transition-colors"
          >
            Manage Subscriptions
          </Link>
          <Link
            to="/catalog"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold shadow transition-colors"
          >
            Product Catalog
          </Link>
          <Link
            to="/invoices"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold shadow transition-colors"
          >
            View Invoices
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="font-bold text-slate-800 mb-2">Agent Team A</h2>
          <p className="text-xs text-slate-500 mb-4">Auth, User Management, and Customer Portal self-service.</p>
          <div className="space-y-1 text-xs">
            <Link to="/users" className="text-blue-600 hover:underline block">• Users & RBAC</Link>
            <Link to="/portal" className="text-blue-600 hover:underline block">• Customer Portal</Link>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="font-bold text-slate-800 mb-2">Agent Team B</h2>
          <p className="text-xs text-slate-500 mb-4">Catalog, Product Variants, Plans, and Subscription Contracts.</p>
          <div className="space-y-1 text-xs">
            <Link to="/catalog" className="text-blue-600 hover:underline block">• Catalog & Plans</Link>
            <Link to="/subscriptions" className="text-blue-600 hover:underline block">• Subscriptions</Link>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="font-bold text-slate-800 mb-2">Agent Team C</h2>
          <p className="text-xs text-slate-500 mb-4">Taxes, Discounts, Recurring Invoicing, Payments & Analytics.</p>
          <div className="space-y-1 text-xs">
            <Link to="/invoices" className="text-blue-600 hover:underline block">• Invoices & Deduplication</Link>
            <Link to="/payments" className="text-blue-600 hover:underline block">• Payment Processing</Link>
            <Link to="/reports" className="text-blue-600 hover:underline block">• MRR & Analytics</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

const UnauthorizedPage: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="text-center max-w-md bg-white p-8 rounded-xl shadow border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
      <p className="text-sm text-slate-500 mb-6">You do not have the required permissions to view this resource.</p>
      <Link to="/" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
        Back to Safety
      </Link>
    </div>
  </div>
);

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* Protected Dashboard Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
              <DashboardLayout>
                <OverviewPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/subscriptions"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
              <DashboardLayout>
                <SubscriptionsPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/catalog"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
              <DashboardLayout>
                <CatalogPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/invoices"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
              <DashboardLayout>
                <InvoicesPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/payments"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
              <DashboardLayout>
                <PaymentsPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/tax-discount"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
              <DashboardLayout>
                <TaxDiscountPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <DashboardLayout>
                <UsersPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
              <DashboardLayout>
                <ReportsPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/portal"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'STAFF', 'CUSTOMER']}>
              <DashboardLayout>
                <CustomerPortalPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
