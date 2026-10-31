import React from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/axios';
import { StatusBadge } from '../../components/StatusBadge';
import { X, Printer, Download, Receipt, AlertCircle, Loader2, Calendar, CheckCircle2 } from 'lucide-react';

interface InvoiceDetailModalProps {
  invoiceId: number | null;
  onClose: () => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({ invoiceId, onClose }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['portal-invoice-detail', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return null;
      try {
        const res = await apiClient.get(`/users/portal/invoices/${invoiceId}`);
        return res.data?.data;
      } catch (err: any) {
        // Fallback in case route mounted directly at /portal/invoices/:id
        const res = await apiClient.get(`/portal/invoices/${invoiceId}`);
        return res.data?.data;
      }
    },
    enabled: Boolean(invoiceId),
  });

  const handlePrint = () => {
    window.print();
  };

  if (!invoiceId) return null;

  const isPaid = data?.status === 'PAID';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop (hidden during print) */}
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity print:hidden" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 overflow-hidden border border-slate-100 z-10 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 print:shadow-none print:max-w-none print:w-full print:m-0 print:p-0 print:border-none">
        {/* Top Action Bar (hidden in print) */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0 print:hidden">
          <div className="flex items-center space-x-2">
            <Receipt className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">
              Tax Invoice {data?.number ? `• ${data.number}` : ''}
            </h3>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              disabled={isLoading || !data}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-40"
              title="Print or Save as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Download PDF</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Container */}
        <div className="overflow-y-auto py-6 flex-1 space-y-6 print:overflow-visible">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-3 print:hidden">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-xs font-medium">Rendering invoice statement...</p>
            </div>
          ) : error || !data ? (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-2 text-rose-700">
              <AlertCircle className="w-6 h-6 mx-auto" />
              <p className="text-sm font-semibold">Unable to load invoice</p>
              <p className="text-xs text-slate-500">Record not found or access unauthorized.</p>
            </div>
          ) : (
            <div className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-200 print:border-none print:p-0 space-y-6">
              {/* Invoice Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-6">
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                      BL
                    </div>
                    <span className="font-extrabold text-base text-slate-900 tracking-tight">
                      Brightloop
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Cloud Subscription Billing Services</p>
                  <p className="text-xs text-slate-500">billing@brightloop.com</p>
                </div>

                <div className="text-right">
                  <span className="text-xs uppercase font-bold tracking-wider text-slate-400 block">
                    TAX INVOICE
                  </span>
                  <p className="font-mono text-base font-extrabold text-slate-900">{data.number}</p>
                  <div className="mt-2 flex justify-end">
                    <StatusBadge
                      status={data.status}
                      label={isPaid ? 'PAID IN FULL' : `UNPAID (${data.status})`}
                      size="sm"
                    />
                  </div>
                </div>
              </div>

              {/* Invoice Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Billing Period</span>
                  <p className="font-medium text-slate-800">
                    {data.period_start} — {data.period_end}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Due Date</span>
                  <p className="font-medium text-slate-800 flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                    {data.due_date}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Subscription Reference</span>
                  <p className="font-mono text-slate-800">
                    {data.subscription_id ? `#SUB-${data.subscription_id}` : 'Direct Service'}
                  </p>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-2.5">Item Description</th>
                      <th className="px-4 py-2.5 text-right">Qty</th>
                      <th className="px-4 py-2.5 text-right">Unit Price</th>
                      <th className="px-4 py-2.5 text-right">Tax</th>
                      <th className="px-4 py-2.5 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.lines && data.lines.length > 0 ? (
                      data.lines.map((line: any, idx: number) => (
                        <tr key={line.id || idx}>
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {line.description || `Service Line #${idx + 1}`}
                          </td>
                          <td className="px-4 py-3 text-right">{line.quantity}</td>
                          <td className="px-4 py-3 text-right font-mono">
                            ${Number(line.unit_price).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-500">
                            ${Number(line.tax_amount || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                            ${Number(line.amount).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          Subscription Recurring Service
                        </td>
                        <td className="px-4 py-3 text-right">1</td>
                        <td className="px-4 py-3 text-right font-mono">
                          ${Number(data.subtotal).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-500">
                          ${Number(data.tax_total || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                          ${Number(data.total).toFixed(2)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals Breakdown */}
              <div className="flex justify-end pt-2">
                <div className="w-full sm:w-64 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono">${Number(data.subtotal || 0).toFixed(2)}</span>
                  </div>
                  {Number(data.discount_total || 0) > 0 && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>Discount:</span>
                      <span className="font-mono">-${Number(data.discount_total).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>Tax Total:</span>
                    <span className="font-mono">${Number(data.tax_total || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                    <span>Total Due:</span>
                    <span className="font-mono text-blue-600">${Number(data.total || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Status Indicator */}
              {isPaid ? (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center space-x-2 text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Thank you! This invoice has been marked as fully paid and processed.
                  </span>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
                  <span>Payment status: Outstanding ({data.status}). Payment due by {data.due_date}.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer (hidden in print) */}
        <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2 shrink-0 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetailModal;
