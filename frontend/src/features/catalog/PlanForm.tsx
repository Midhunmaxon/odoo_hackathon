import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Play, Pause, RotateCcw, XCircle } from 'lucide-react';
import apiClient from '../../lib/axios';
import type { Plan } from './types';

interface PlanFormProps {
  initial?: Partial<Plan>;
  onClose: () => void;
}

interface ApiValidationError {
  response?: { data?: { error?: { message?: string; details?: { field: string; message: string }[] } } };
  message?: string;
}

const BILLING_PERIODS = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;

export const PlanForm: React.FC<PlanFormProps> = ({ initial, onClose }) => {
  const qc = useQueryClient();
  const isEdit = Boolean(initial?.id);

  const [name, setName] = useState(initial?.name ?? '');
  const [price, setPrice] = useState(String(initial?.price ?? ''));
  const [billingPeriod, setBillingPeriod] = useState<typeof BILLING_PERIODS[number]>(
    initial?.billing_period ?? 'MONTHLY'
  );
  const [minQuantity, setMinQuantity] = useState(String(initial?.min_quantity ?? '1'));
  const [startDate, setStartDate] = useState(initial?.start_date ?? '');
  const [endDate, setEndDate] = useState(initial?.end_date ?? '');
  const [autoClose, setAutoClose] = useState(initial?.auto_close ?? false);
  const [allowClose, setAllowClose] = useState(initial?.allow_close ?? true);
  const [allowPause, setAllowPause] = useState(initial?.allow_pause ?? true);
  const [allowRenew, setAllowRenew] = useState(initial?.allow_renew ?? true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        price: Number(price),
        billing_period: billingPeriod,
        min_quantity: Number(minQuantity),
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        auto_close: autoClose,
        allow_close: allowClose,
        allow_pause: allowPause,
        allow_renew: allowRenew,
        status: initial?.status ?? 'ACTIVE',
      };
      if (isEdit) {
        return apiClient.patch(`/catalog/plans/${initial!.id}`, payload);
      }
      return apiClient.post('/catalog/plans', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog-plans'] });
      onClose();
    },
    onError: (err: ApiValidationError) => {
      const errData = err.response?.data?.error;
      if (errData?.details) {
        const map: Record<string, string> = {};
        errData.details.forEach((d) => { map[d.field] = d.message; });
        setFieldErrors(map);
      }
      setApiError(errData?.message ?? 'An error occurred');
    },
  });

  const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-slate-50 cursor-pointer">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
          checked ? 'bg-blue-600' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  );

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">
            {isEdit ? 'Edit Plan' : 'New Subscription Plan'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {apiError && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {apiError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Plan Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.name ? 'border-red-400' : 'border-slate-300'}`}
              placeholder="e.g. Starter Monthly"
            />
            {fieldErrors.name && <p className="text-xs text-red-600 mt-1">{fieldErrors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Price ($) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.price ? 'border-red-400' : 'border-slate-300'}`}
              />
              {fieldErrors.price && <p className="text-xs text-red-600 mt-1">{fieldErrors.price}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Billing Period *</label>
              <select
                value={billingPeriod}
                onChange={(e) => setBillingPeriod(e.target.value as typeof BILLING_PERIODS[number])}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {BILLING_PERIODS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Min Quantity *</label>
              <input
                type="number"
                min="1"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.min_quantity ? 'border-red-400' : 'border-slate-300'}`}
              />
              {fieldErrors.min_quantity && <p className="text-xs text-red-600 mt-1">{fieldErrors.min_quantity}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.end_date ? 'border-red-400' : 'border-slate-300'}`}
              />
              {fieldErrors.end_date && <p className="text-xs text-red-600 mt-1">{fieldErrors.end_date}</p>}
            </div>
          </div>

          {/* Flag Toggles */}
          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
            <div className="px-4 py-2 bg-slate-50">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Plan Flags</p>
            </div>
            <Toggle label="Auto-Close when end date passes" checked={autoClose} onChange={setAutoClose} />
            <Toggle label="Allow Close" checked={allowClose} onChange={setAllowClose} />
            <Toggle label="Allow Pause" checked={allowPause} onChange={setAllowPause} />
            <Toggle label="Allow Renew" checked={allowRenew} onChange={setAllowRenew} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Plan'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface PlanActionsProps {
  plan: Plan;
}

export const PlanActions: React.FC<PlanActionsProps> = ({ plan }) => {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const actionMutation = useMutation({
    mutationFn: async (action: 'close' | 'pause' | 'renew') => {
      return apiClient.post(`/plans/${plan.id}/${action}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog-plans'] });
      setError(null);
    },
    onError: (err: ApiValidationError) => {
      setError(err.response?.data?.error?.message ?? 'Action failed');
    },
  });

  return (
    <div className="flex items-center gap-1.5">
      {error && <span className="text-xs text-red-600 mr-1">{error}</span>}
      {plan.allow_renew && plan.status !== 'ACTIVE' && (
        <button
          onClick={() => actionMutation.mutate('renew')}
          disabled={actionMutation.isPending}
          title="Renew Plan"
          className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors disabled:opacity-50"
        >
          <RotateCcw className="w-3 h-3" />
          Renew
        </button>
      )}
      {plan.allow_pause && plan.status === 'ACTIVE' && (
        <button
          onClick={() => actionMutation.mutate('pause')}
          disabled={actionMutation.isPending}
          title="Pause Plan"
          className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100 transition-colors disabled:opacity-50"
        >
          <Pause className="w-3 h-3" />
          Pause
        </button>
      )}
      {plan.allow_close && plan.status !== 'CLOSED' && (
        <button
          onClick={() => actionMutation.mutate('close')}
          disabled={actionMutation.isPending}
          title="Close Plan"
          className="flex items-center gap-1 px-2 py-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 transition-colors disabled:opacity-50"
        >
          <XCircle className="w-3 h-3" />
          Close
        </button>
      )}
    </div>
  );
};

export default PlanForm;
