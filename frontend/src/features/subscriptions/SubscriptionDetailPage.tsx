import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  Calendar,
  CreditCard,
  User,
  Package,
  Layers,
  ArrowRight,
  RotateCcw,
  Pause,
  XCircle,
} from 'lucide-react';
import apiClient from '../../lib/axios';
import { SubscriptionDetail, SubscriptionStatus, ALLOWED_TRANSITIONS } from './types';
import { Plan, ProductWithVariants } from '../catalog/types';
import { PaginatedResult } from '../../types';

interface ApiErrorResponse {
  response?: {
    data?: {
      error?: {
        message?: string;
        details?: { field: string; message: string }[];
      };
    };
  };
  message?: string;
}

const STEPPER_STAGES: SubscriptionStatus[] = [
  'DRAFT',
  'QUOTATION',
  'CONFIRMED',
  'ACTIVE',
  'CLOSED',
];

export const SubscriptionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch subscription details
  const { data: sub, isLoading, error: subError } = useQuery<SubscriptionDetail>({
    queryKey: ['subscription-detail', id],
    queryFn: async () => {
      const res = await apiClient.get(`/subscriptions/${id}`);
      return res.data?.data ?? res.data;
    },
    enabled: Boolean(id),
  });

  // Reference plans & products
  const { data: plansData } = useQuery<PaginatedResult<Plan>>({
    queryKey: ['catalog-plans-all'],
    queryFn: async () => (await apiClient.get('/catalog/plans?page=1&limit=100')).data,
  });

  const { data: productsData } = useQuery<PaginatedResult<ProductWithVariants>>({
    queryKey: ['catalog-products-all'],
    queryFn: async () => (await apiClient.get('/catalog/products?page=1&limit=100')).data,
  });

  const plans = plansData?.data ?? [];
  const products = productsData?.data ?? [];
  const currentPlan = plans.find((p) => p.id === sub?.plan_id);

  // State machine transition mutation
  const transitionMutation = useMutation({
    mutationFn: async (toStatus: SubscriptionStatus) => {
      setErrorMessage(null);
      const res = await apiClient.post(`/subscriptions/${id}/transition`, {
        to_status: toStatus,
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscription-detail', id] });
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
    },
    onError: (err: ApiErrorResponse) => {
      setErrorMessage(err.response?.data?.error?.message ?? err.message ?? 'Transition failed');
    },
  });

  // Action mutations (close, pause, renew)
  const actionMutation = useMutation({
    mutationFn: async (action: 'close' | 'pause' | 'renew') => {
      setErrorMessage(null);
      const res = await apiClient.post(`/subscriptions/${id}/${action}`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscription-detail', id] });
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
    },
    onError: (err: ApiErrorResponse) => {
      setErrorMessage(err.response?.data?.error?.message ?? err.message ?? 'Action failed');
    },
  });

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-500 max-w-4xl mx-auto">
        Loading subscription details...
      </div>
    );
  }

  if (subError || !sub) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center space-y-4">
        <div className="text-red-600 font-bold text-lg">Subscription Not Found</div>
        <p className="text-sm text-slate-500">Could not retrieve subscription #{id}.</p>
        <button
          onClick={() => navigate('/subscriptions')}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm"
        >
          Return to Subscriptions
        </button>
      </div>
    );
  }

  // Stepper calculations
  const currentStatusIndex = STEPPER_STAGES.indexOf(sub.status);
  const legalNextTransitions = ALLOWED_TRANSITIONS[sub.status] || [];

  // Helper for product name lookup
  const getProductName = (prodId: number) => {
    return products.find((p) => p.id === prodId)?.name ?? `Product #${prodId}`;
  };

  const getVariantLabel = (prodId: number, varId: number | null | undefined) => {
    if (!varId) return 'Standard';
    const prod = products.find((p) => p.id === prodId);
    const v = prod?.variants?.find((item) => item.id === varId);
    if (!v) return `Variant #${varId}`;
    return `${v.attribute}: ${v.value} (+$${v.extra_price})`;
  };

  const linesTotal = (sub.lines || []).reduce((acc, l) => acc + Number(l.amount || 0), 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top back button */}
      <div>
        <button
          onClick={() => navigate('/subscriptions')}
          className="inline-flex items-center space-x-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Subscriptions</span>
        </button>
      </div>

      {/* Header with Title and Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-black font-mono text-slate-900">{sub.number}</h1>
            <span
              className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider border ${
                sub.status === 'ACTIVE'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : sub.status === 'CONFIRMED'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : sub.status === 'QUOTATION'
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : sub.status === 'CLOSED'
                  ? 'bg-slate-100 text-slate-600 border-slate-300'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {sub.status}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Contract ID: #{sub.id} • Customer #{sub.customer_id} • Plan: {currentPlan?.name ?? `#${sub.plan_id}`}
          </p>
        </div>

        {/* Legal Next Transition Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {legalNextTransitions.map((targetStatus) => {
            let label = `Transition to ${targetStatus}`;
            let btnClass = 'bg-blue-600 hover:bg-blue-700 text-white';

            if (targetStatus === 'QUOTATION') {
              label = 'Submit Quotation';
              btnClass = 'bg-purple-600 hover:bg-purple-700 text-white';
            } else if (targetStatus === 'CONFIRMED') {
              label = 'Confirm Order';
              btnClass = 'bg-indigo-600 hover:bg-indigo-700 text-white';
            } else if (targetStatus === 'ACTIVE') {
              label = 'Activate Subscription';
              btnClass = 'bg-emerald-600 hover:bg-emerald-700 text-white';
            } else if (targetStatus === 'DRAFT') {
              label = 'Revert to Draft';
              btnClass = 'bg-slate-700 hover:bg-slate-800 text-white';
            } else if (targetStatus === 'CLOSED') {
              label = 'Close Contract';
              btnClass = 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200';
            }

            return (
              <button
                key={targetStatus}
                onClick={() => transitionMutation.mutate(targetStatus)}
                disabled={transitionMutation.isPending}
                className={`px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 flex items-center space-x-1.5 ${btnClass}`}
              >
                <span>{label}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            );
          })}

          {/* Optional Plan Policy Actions */}
          {sub.status === 'ACTIVE' && currentPlan?.allow_pause && (
            <button
              onClick={() => actionMutation.mutate('pause')}
              disabled={actionMutation.isPending}
              className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause</span>
            </button>
          )}

          {sub.status !== 'ACTIVE' && currentPlan?.allow_renew && (
            <button
              onClick={() => actionMutation.mutate('renew')}
              disabled={actionMutation.isPending}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Renew</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline API Error Alert */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs text-red-600 hover:underline font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* VISUAL STATUS STEPPER (Draft → Quotation → Confirmed → Active → Closed) */}
      {/* ==================================================================== */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-6">
          Lifecycle Stepper
        </h2>

        <div className="relative">
          {/* Connector Line */}
          <div className="absolute top-5 left-0 w-full h-0.5 bg-slate-200 -z-0" />

          <div className="relative z-10 flex items-center justify-between">
            {STEPPER_STAGES.map((stage, idx) => {
              const isCurrent = sub.status === stage;
              const isPassed =
                sub.status !== 'CLOSED'
                  ? currentStatusIndex > idx
                  : stage === 'CLOSED';
              const isClosedState = stage === 'CLOSED' && sub.status === 'CLOSED';

              return (
                <div key={stage} className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-all shadow-sm ${
                      isCurrent
                        ? isClosedState
                          ? 'bg-red-600 text-white ring-4 ring-red-100'
                          : 'bg-blue-600 text-white ring-4 ring-blue-100'
                        : isPassed
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white border-2 border-slate-300 text-slate-400'
                    }`}
                  >
                    {isPassed && !isCurrent ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : isClosedState ? (
                      <XCircle className="w-5 h-5" />
                    ) : (
                      idx + 1
                    )}
                  </div>

                  <span
                    className={`mt-2 text-xs font-semibold ${
                      isCurrent
                        ? 'text-blue-600 font-bold'
                        : isPassed
                        ? 'text-slate-800'
                        : 'text-slate-400'
                    }`}
                  >
                    {stage}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Contract Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer & Plan */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
            <User className="w-4 h-4 text-blue-600" />
            <span>Account Details</span>
          </h2>

          <div className="space-y-3 text-sm">
            <div>
              <span className="text-xs text-slate-400 block">Customer</span>
              <span className="font-semibold text-slate-900">Customer #{sub.customer_id}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Associated Plan</span>
              <span className="font-semibold text-slate-900">
                {currentPlan?.name ?? `Plan #${sub.plan_id}`}
              </span>
              {currentPlan && (
                <span className="text-xs text-slate-500 block">
                  ${currentPlan.price} / {currentPlan.billing_period.toLowerCase()} (Min: {currentPlan.min_quantity})
                </span>
              )}
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Payment Terms</span>
              <span className="font-semibold text-slate-900">{sub.payment_terms}</span>
            </div>
          </div>
        </div>

        {/* Schedule & Billing */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>Billing Timeline</span>
          </h2>

          <div className="space-y-3 text-sm">
            <div>
              <span className="text-xs text-slate-400 block">Start Date</span>
              <span className="font-semibold text-slate-900">{sub.start_date}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Expiry Date</span>
              <span className="font-semibold text-slate-900">{sub.expiry_date || 'No Expiry (Perpetual)'}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Next Billing Date</span>
              <span className="font-semibold text-blue-600">{sub.next_billing_date || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Totals Summary */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5 mb-3">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>Financial Overview</span>
            </h2>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Plan Base Fee:</span>
                <span className="font-medium text-slate-900">${Number(currentPlan?.price || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Line Items Sum:</span>
                <span className="font-medium text-slate-900">${linesTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <span className="text-xs text-slate-400 block">Estimated Period Total</span>
            <span className="text-2xl font-black text-slate-900">
              ${(Number(currentPlan?.price || 0) + linesTotal).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* LINE ITEMS TABLE */}
      {/* ==================================================================== */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
            <Package className="w-4 h-4 text-blue-600" />
            <span>Contract Line Items ({sub.lines?.length || 0})</span>
          </h2>
        </div>

        {(!sub.lines || sub.lines.length === 0) ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No line items recorded for this subscription.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Product</th>
                <th className="px-6 py-3">Variant</th>
                <th className="px-6 py-3 text-center">Quantity</th>
                <th className="px-6 py-3 text-right">Unit Price</th>
                <th className="px-6 py-3 text-right">Line Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {sub.lines.map((l, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 font-medium text-slate-900">{getProductName(l.product_id)}</td>
                  <td className="px-6 py-4 text-xs text-slate-600">
                    {getVariantLabel(l.product_id, l.variant_id)}
                  </td>
                  <td className="px-6 py-4 text-center font-medium">{l.quantity}</td>
                  <td className="px-6 py-4 text-right">${Number(l.unit_price).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">${Number(l.amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ==================================================================== */}
      {/* STATUS HISTORY TABLE */}
      {/* ==================================================================== */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            <span>Audit & Transition History</span>
          </h2>
        </div>

        {(!sub.history || sub.history.length === 0) ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No status transition history recorded yet.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">From Status</th>
                <th className="px-6 py-3">To Status</th>
                <th className="px-6 py-3">Changed By</th>
                <th className="px-6 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600 text-xs">
              {sub.history.map((h) => (
                <tr key={h.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-3">
                    {h.from_status ? (
                      <span className="font-semibold text-slate-700">{h.from_status}</span>
                    ) : (
                      <span className="text-slate-400 italic">Initial Draft</span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <span className="font-bold text-blue-600">{h.to_status}</span>
                  </td>
                  <td className="px-6 py-3">
                    {h.changed_by ? `User #${h.changed_by}` : 'System / Auto'}
                  </td>
                  <td className="px-6 py-3 text-slate-500">
                    {new Date(h.changed_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default SubscriptionDetailPage;
