import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/axios';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  AlertCircle,
  CreditCard,
  Bell,
  X,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MonthlyRevenueDatum {
  month: string;
  revenue: number;
}

interface SummaryReport {
  activeSubscriptions: number;
  revenueCollected: number;
  outstandingAmount: number;
  overdueCount: number;
  overdueAmount: number;
  monthlyRevenueSeries: MonthlyRevenueDatum[];
  totalCustomers: number;
  unpaidInvoicesCount: number;
  unpaidInvoicesAmount: number;
}

interface OverdueInvoice {
  id: number;
  number: string;
  customer_id: number;
  total: number;
  balance: number;
  due_date: string;
  days_overdue: number;
  status: string;
}

interface Payment {
  id: number;
  invoice_id: number;
  method: string;
  amount: number;
  paid_at: string;
  note?: string;
}

interface Filters {
  date_from: string;
  date_to: string;
  plan_id: string;
  customer_id: string;
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-xs uppercase font-semibold text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Record Payment Modal ─────────────────────────────────────────────────────

function RecordPaymentModal({
  invoiceId,
  balance,
  onClose,
}: {
  invoiceId: number;
  balance: number;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState('CASH');
  const [note, setNote] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (payload: object) => apiClient.post('/payments', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overdue-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['reports-summary'] });
      queryClient.invalidateQueries({ queryKey: ['recent-payments'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Record Payment</h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
          </button>
        </div>
        <p className="text-sm text-slate-500">Invoice #{invoiceId} — Balance: ${balance}</p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Amount</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {['CASH', 'CREDIT_CARD', 'BANK_TRANSFER', 'UPI', 'OTHER'].map((m) => (
                <option key={m} value={m}>
                  {m.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {mutation.isError && (
          <p className="text-sm text-red-600">
            {(mutation.error as any)?.response?.data?.error?.message ?? 'Payment failed.'}
          </p>
        )}

        <div className="flex justify-end space-x-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                invoice_id: invoiceId,
                amount: parseFloat(amount),
                method,
                note: note || undefined,
              })
            }
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving…' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export const ReportsPage: React.FC = () => {
  const [filters, setFilters] = useState<Filters>({
    date_from: '',
    date_to: '',
    plan_id: '',
    customer_id: '',
  });
  const [paymentTarget, setPaymentTarget] = useState<{
    invoiceId: number;
    balance: number;
  } | null>(null);
  const [reminderMsg, setReminderMsg] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Build query string from filters
  const filterParams = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== ''),
  );
  const filterKey = JSON.stringify(filterParams);

  const { data: summaryData, isLoading: summaryLoading } = useQuery<{
    success: boolean;
    data: SummaryReport;
  }>({
    queryKey: ['reports-summary', filterKey],
    queryFn: async () => {
      const res = await apiClient.get('/reports/summary', { params: filterParams });
      return res.data;
    },
  });

  const { data: overdueData, isLoading: overdueLoading } = useQuery<{
    success: boolean;
    data: OverdueInvoice[];
  }>({
    queryKey: ['overdue-invoices'],
    queryFn: async () => {
      const res = await apiClient.get('/invoices/overdue');
      return res.data;
    },
  });

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery<{
    success: boolean;
    data: { data: Payment[] };
  }>({
    queryKey: ['recent-payments'],
    queryFn: async () => {
      const res = await apiClient.get('/payments?page=1&limit=10&sort=id:desc');
      return res.data;
    },
  });

  const sendReminderMutation = useMutation({
    mutationFn: (invoiceId: number) => apiClient.post(`/invoices/${invoiceId}/send`),
    onSuccess: (_, invoiceId) => {
      setReminderMsg(`Reminder sent for invoice #${invoiceId}`);
      setTimeout(() => setReminderMsg(null), 3000);
    },
  });

  const summary = summaryData?.data;
  const overdueInvoices = overdueData?.data ?? [];
  const recentPayments = paymentsData?.data?.data ?? [];

  function handleFilterChange(field: keyof Filters, value: string) {
    setFilters((prev) => ({ ...prev, [field]: value }));
    queryClient.invalidateQueries({ queryKey: ['reports-summary'] });
  }

  const fmt = (n: number | undefined) =>
    n !== undefined ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '–';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center space-x-2">
          <BarChart3 className="w-6 h-6 text-blue-600" />
          <span>Finance Dashboard</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Revenue metrics, overdue tracking, and recent payment activity.
        </p>
      </div>

      {/* Toast */}
      {reminderMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-emerald-700 text-sm">
          {reminderMsg}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3">
        {[
          { label: 'From', field: 'date_from' as keyof Filters, type: 'date' },
          { label: 'To', field: 'date_to' as keyof Filters, type: 'date' },
          { label: 'Plan ID', field: 'plan_id' as keyof Filters, type: 'number' },
          { label: 'Customer ID', field: 'customer_id' as keyof Filters, type: 'number' },
        ].map(({ label, field, type }) => (
          <div key={field} className="flex flex-col">
            <label className="text-xs font-medium text-slate-500 mb-1">{label}</label>
            <input
              type={type}
              value={filters[field]}
              onChange={(e) => handleFilterChange(field, e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
      </div>

      {/* KPI Cards */}
      {summaryLoading ? (
        <div className="p-8 text-center text-slate-500">Loading summary…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <KpiCard
            icon={TrendingUp}
            label="Active Subscriptions"
            value={summary?.activeSubscriptions ?? '–'}
            color="bg-blue-50 text-blue-600"
          />
          <KpiCard
            icon={DollarSign}
            label="Revenue Collected"
            value={fmt(summary?.revenueCollected)}
            color="bg-emerald-50 text-emerald-600"
          />
          <KpiCard
            icon={CreditCard}
            label="Outstanding"
            value={fmt(summary?.outstandingAmount)}
            color="bg-indigo-50 text-indigo-600"
          />
          <KpiCard
            icon={AlertCircle}
            label="Overdue"
            value={fmt(summary?.overdueAmount)}
            sub={`${summary?.overdueCount ?? 0} invoices`}
            color="bg-red-50 text-red-600"
          />
          <KpiCard
            icon={Users}
            label="Total Customers"
            value={summary?.totalCustomers ?? '–'}
            color="bg-amber-50 text-amber-600"
          />
        </div>
      )}

      {/* Revenue Chart */}
      {!summaryLoading && summary && summary.monthlyRevenueSeries.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Monthly Revenue</h2>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart
              data={summary.monthlyRevenueSeries}
              margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, 'Revenue']} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Overdue Invoices */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Overdue Invoices</h2>
          <span className="text-xs text-red-600 font-medium">
            {overdueInvoices.length} overdue
          </span>
        </div>
        {overdueLoading ? (
          <div className="p-6 text-center text-slate-500 text-sm">Loading…</div>
        ) : overdueInvoices.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">No overdue invoices 🎉</div>
        ) : (
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-3">Invoice</th>
                <th className="px-6 py-3">Total</th>
                <th className="px-6 py-3">Balance</th>
                <th className="px-6 py-3">Due Date</th>
                <th className="px-6 py-3">Days Overdue</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {overdueInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-mono font-medium text-slate-900">{inv.number}</td>
                  <td className="px-6 py-3">{fmt(inv.total)}</td>
                  <td className="px-6 py-3 font-semibold text-red-600">{fmt(inv.balance)}</td>
                  <td className="px-6 py-3 text-xs text-slate-500">{inv.due_date}</td>
                  <td className="px-6 py-3">
                    <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-semibold border border-red-200">
                      {inv.days_overdue}d
                    </span>
                  </td>
                  <td className="px-6 py-3 flex items-center space-x-2">
                    <button
                      onClick={() => setPaymentTarget({ invoiceId: inv.id, balance: inv.balance })}
                      className="flex items-center space-x-1 text-xs px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Pay</span>
                    </button>
                    <button
                      onClick={() => sendReminderMutation.mutate(inv.id)}
                      className="flex items-center space-x-1 text-xs px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>Remind</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent Payments */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Recent Payments</h2>
        </div>
        {paymentsLoading ? (
          <div className="p-6 text-center text-slate-500 text-sm">Loading…</div>
        ) : recentPayments.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">No payments yet.</div>
        ) : (
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-3">Invoice #</th>
                <th className="px-6 py-3">Method</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentPayments.map((pmt) => (
                <tr key={pmt.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-mono">#{pmt.invoice_id}</td>
                  <td className="px-6 py-3 text-xs font-semibold text-slate-700">{pmt.method}</td>
                  <td className="px-6 py-3 font-bold text-emerald-600">{fmt(pmt.amount)}</td>
                  <td className="px-6 py-3 text-xs text-slate-500">
                    {new Date(pmt.paid_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3 text-xs text-slate-400">{pmt.note || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Record Payment Modal */}
      {paymentTarget && (
        <RecordPaymentModal
          invoiceId={paymentTarget.invoiceId}
          balance={paymentTarget.balance}
          onClose={() => setPaymentTarget(null)}
        />
      )}
    </div>
  );
};

export default ReportsPage;
