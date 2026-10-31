import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/axios';
import { FileText, PlayCircle, CheckCircle, XCircle, Send, Printer, X } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type InvoiceStatus = 'DRAFT' | 'CONFIRMED' | 'PAID' | 'CANCELLED';

interface InvoiceRow {
  id: number;
  number: string;
  customer_id: number;
  period_start: string;
  period_end: string;
  subtotal: number;
  tax_total: number;
  total: number;
  status: InvoiceStatus;
  due_date: string;
  amount_paid?: number;
  balance?: number;
  overdue?: boolean;
}

interface BillingResult {
  created: number;
  skipped: number;
  failed: Array<{ subscription_id: number; error: string }>;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const map: Record<InvoiceStatus, string> = {
    DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
    CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200',
    PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    CANCELLED: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${map[status] ?? ''}`}>
      {status}
    </span>
  );
}

// ─── Billing Result Modal ─────────────────────────────────────────────────────

function BillingResultModal({
  result,
  onClose,
}: {
  result: BillingResult;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Billing Run Complete</h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-emerald-50 rounded-lg">
            <p className="text-2xl font-bold text-emerald-700">{result.created}</p>
            <p className="text-xs text-emerald-600 font-medium mt-1">Created</p>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-lg">
            <p className="text-2xl font-bold text-slate-700">{result.skipped}</p>
            <p className="text-xs text-slate-500 font-medium mt-1">Skipped</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <p className="text-2xl font-bold text-red-700">{result.failed.length}</p>
            <p className="text-xs text-red-600 font-medium mt-1">Failed</p>
          </div>
        </div>
        {result.failed.length > 0 && (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {result.failed.map((f) => (
              <p key={f.subscription_id} className="text-xs text-red-600">
                Sub #{f.subscription_id}: {f.error}
              </p>
            ))}
          </div>
        )}
        <button
          onClick={onClose}
          className="w-full mt-2 px-4 py-2 bg-slate-900 text-white text-sm rounded-lg font-semibold hover:bg-slate-800"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export const InvoicesPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [billingResult, setBillingResult] = useState<BillingResult | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const queryClient = useQueryClient();

  // Build query string
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', '15');
  params.set('sort', 'id:desc');
  if (statusFilter) params.set('status', statusFilter);
  if (paymentFilter) params.set('payment_status', paymentFilter);

  const { data, isLoading } = useQuery<{ success: boolean; data: { data: InvoiceRow[]; total: number } }>({
    queryKey: ['invoices', page, statusFilter, paymentFilter],
    queryFn: async () => {
      const res = await apiClient.get(`/invoices?${params.toString()}`);
      return res.data;
    },
  });

  const invoices = data?.data?.data ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = Math.ceil(total / 15);

  // ── Billing Run ──
  const billingMutation = useMutation({
    mutationFn: () => apiClient.post('/invoices/run-billing'),
    onSuccess: (res) => {
      setBillingResult(res.data.data);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  // ── Generic invoice action ──
  function useInvoiceAction(action: string) {
    return useMutation({
      mutationFn: (id: number) => apiClient.post(`/invoices/${id}/${action}`),
      onSuccess: (_, id) => {
        setActionMsg(`Invoice #${id} ${action}ed successfully.`);
        setTimeout(() => setActionMsg(null), 3000);
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
      },
    });
  }

  const confirmMutation = useInvoiceAction('confirm');
  const cancelMutation = useInvoiceAction('cancel');
  const sendMutation = useInvoiceAction('send');

  const fmt = (n: number | undefined) =>
    n !== undefined
      ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '–';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center space-x-2">
            <FileText className="w-6 h-6 text-blue-600" />
            <span>Invoices</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review invoices, record payments, and manage billing cycles.
          </p>
        </div>
        <button
          onClick={() => billingMutation.mutate()}
          disabled={billingMutation.isPending}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <PlayCircle className="w-4 h-4" />
          <span>{billingMutation.isPending ? 'Running…' : 'Run Billing'}</span>
        </button>
      </div>

      {/* Toast */}
      {actionMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-emerald-700 text-sm">
          {actionMsg}
        </div>
      )}
      {billingMutation.isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-600 text-sm">
          Billing run failed. Please try again.
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All</option>
            {['DRAFT', 'CONFIRMED', 'PAID', 'CANCELLED'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Payment</label>
          <select
            value={paymentFilter}
            onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All</option>
            <option value="paid">Paid</option>
            <option value="outstanding">Outstanding</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading invoices…</div>
        ) : (
          <>
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                <tr>
                  <th className="px-6 py-3">Invoice</th>
                  <th className="px-6 py-3">Period</th>
                  <th className="px-6 py-3">Total</th>
                  <th className="px-6 py-3">Paid</th>
                  <th className="px-6 py-3">Balance</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Due</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 font-mono font-medium text-slate-900">
                      {inv.number}
                      {inv.overdue && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-xs bg-red-50 text-red-600 border border-red-200">
                          Overdue
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-400">
                      {inv.period_start} → {inv.period_end}
                    </td>
                    <td className="px-6 py-3 font-semibold">{fmt(inv.total)}</td>
                    <td className="px-6 py-3 text-emerald-600">{fmt(inv.amount_paid)}</td>
                    <td className="px-6 py-3 font-semibold text-red-600">{fmt(inv.balance)}</td>
                    <td className="px-6 py-3">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-400">{inv.due_date}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center space-x-1">
                        {inv.status === 'DRAFT' && (
                          <button
                            title="Confirm"
                            onClick={() => confirmMutation.mutate(inv.id)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {(inv.status === 'DRAFT' || inv.status === 'CONFIRMED') && (
                          <button
                            title="Cancel"
                            onClick={() => cancelMutation.mutate(inv.id)}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                        {inv.status !== 'CANCELLED' && (
                          <button
                            title="Send"
                            onClick={() => sendMutation.mutate(inv.id)}
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                        <a
                          href={`${apiClient.defaults.baseURL}/invoices/${inv.id}/print`}
                          target="_blank"
                          rel="noreferrer"
                          title="Print"
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                        >
                          <Printer className="w-4 h-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-400 text-sm">
                      No invoices found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Page {page} of {totalPages} ({total} total)
                </p>
                <div className="flex space-x-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Billing Result Modal */}
      {billingResult && (
        <BillingResultModal result={billingResult} onClose={() => setBillingResult(null)} />
      )}
    </div>
  );
};

export default InvoicesPage;
