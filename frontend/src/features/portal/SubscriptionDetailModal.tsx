import React from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/axios';
import { StatusBadge } from '../../components/StatusBadge';
import { X, Calendar, CreditCard, Shield, Clock, FileText, Loader2, AlertCircle } from 'lucide-react';

interface SubscriptionDetailModalProps {
  subscriptionId: number | null;
  onClose: () => void;
}

export const SubscriptionDetailModal: React.FC<SubscriptionDetailModalProps> = ({
  subscriptionId,
  onClose,
}) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['portal-subscription-detail', subscriptionId],
    queryFn: async () => {
      if (!subscriptionId) return null;
      try {
        const res = await apiClient.get(`/users/portal/subscriptions/${subscriptionId}`);
        return res.data?.data;
      } catch (err: any) {
        // Fallback in case route mounted directly at /portal/subscriptions/:id
        const res = await apiClient.get(`/portal/subscriptions/${subscriptionId}`);
        return res.data?.data;
      }
    },
    enabled: Boolean(subscriptionId),
  });

  if (!subscriptionId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 overflow-hidden border border-slate-100 z-10 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-slate-900">
                  {data?.number || `Subscription #${subscriptionId}`}
                </h3>
                {data?.status && <StatusBadge status={data.status} />}
              </div>
              <p className="text-xs text-slate-500">Subscription contract overview and line items</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto py-6 space-y-6 flex-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-xs font-medium">Fetching subscription details...</p>
            </div>
          ) : error || !data ? (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-2 text-rose-700">
              <AlertCircle className="w-6 h-6 mx-auto" />
              <p className="text-sm font-semibold">Unable to display subscription</p>
              <p className="text-xs text-slate-500">
                You may not have permission to view this record, or it has been removed.
              </p>
            </div>
          ) : (
            <>
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">Contract ID</span>
                  <span className="font-mono font-bold text-slate-800">#{data.id}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">Start Date</span>
                  <span className="font-medium text-slate-800 flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                    {data.start_date || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">Next Billing Date</span>
                  <span className="font-semibold text-blue-600 flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1 text-blue-500" />
                    {data.next_billing_date || 'Not Scheduled'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">Payment Terms</span>
                  <span className="font-medium text-slate-800 capitalize">
                    {data.payment_terms || 'Immediate'}
                  </span>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center space-x-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Subscription Line Items</span>
                </h4>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-2.5">Item / Product</th>
                        <th className="px-4 py-2.5 text-right">Quantity</th>
                        <th className="px-4 py-2.5 text-right">Unit Price</th>
                        <th className="px-4 py-2.5 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.lines && data.lines.length > 0 ? (
                        data.lines.map((line: any, idx: number) => (
                          <tr key={line.id || idx}>
                            <td className="px-4 py-3 font-medium text-slate-900">
                              Product #{line.product_id}
                              {line.variant_id && (
                                <span className="text-slate-400 ml-1 font-normal">
                                  (Variant #{line.variant_id})
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">{line.quantity}</td>
                            <td className="px-4 py-3 text-right font-mono">
                              ${Number(line.unit_price).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                              ${Number(line.amount).toFixed(2)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                            Included in primary subscription plan tier.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Security & Isolation Note */}
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-[11px] text-blue-700 flex items-center space-x-2">
                <Shield className="w-4 h-4 text-blue-500 shrink-0" />
                <span>
                  This subscription is strictly bound to your customer profile. Billing statements
                  and renewals are automatically delivered per your payment schedule.
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Close Overview
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionDetailModal;
