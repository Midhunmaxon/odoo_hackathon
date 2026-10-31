import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2 } from 'lucide-react';
import apiClient from '../../lib/axios';
import type { QuotationTemplate, QuotationTemplateLine, ProductWithVariants } from './types';
import type { PaginatedResult } from '../../types';

interface TemplateFormProps {
  initial?: Partial<QuotationTemplate>;
  onClose: () => void;
}

interface ApiValidationError {
  response?: { data?: { error?: { message?: string; details?: { field: string; message: string }[] } } };
}

export const TemplateForm: React.FC<TemplateFormProps> = ({ initial, onClose }) => {
  const qc = useQueryClient();
  const isEdit = Boolean(initial?.id);

  const [name, setName] = useState(initial?.name ?? '');
  const [validityDays, setValidityDays] = useState(String(initial?.validity_days ?? '30'));
  const [planId, setPlanId] = useState(String(initial?.plan_id ?? ''));
  const [lines, setLines] = useState<QuotationTemplateLine[]>(initial?.lines ?? []);
  const [apiError, setApiError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { data: productsData } = useQuery<PaginatedResult<ProductWithVariants>>({
    queryKey: ['catalog-products-all'],
    queryFn: async () => {
      const res = await apiClient.get('/catalog/products?page=1&limit=100&sort=name:asc');
      return res.data;
    },
  });

  const { data: plansData } = useQuery<PaginatedResult<{ id: number; name: string }>>({
    queryKey: ['catalog-plans-all'],
    queryFn: async () => {
      const res = await apiClient.get('/catalog/plans?page=1&limit=100');
      return res.data;
    },
  });

  const products = productsData?.data ?? [];

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        validity_days: Number(validityDays),
        plan_id: planId ? Number(planId) : null,
        lines: lines.map((l) => ({
          product_id: l.product_id,
          variant_id: l.variant_id || null,
          quantity: Number(l.quantity),
        })),
      };
      if (isEdit) {
        return apiClient.patch(`/subscriptions/templates/${initial!.id}`, payload);
      }
      return apiClient.post('/subscriptions/templates', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotation-templates'] });
      onClose();
    },
    onError: (err: ApiValidationError) => {
      const errData = err.response?.data?.error;
      if (errData?.details) {
        const map: Record<string, string> = {};
        errData.details.forEach((d: { field: string; message: string }) => { map[d.field] = d.message; });
        setFieldErrors(map);
      }
      setApiError(errData?.message ?? 'An error occurred');
    },
  });

  const addLine = () => {
    setLines([...lines, { product_id: products[0]?.id ?? 0, variant_id: null, quantity: 1 }]);
  };

  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));

  const updateLine = (i: number, field: keyof QuotationTemplateLine, val: number | null) => {
    setLines(lines.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  };

  const getVariants = (productId: number) =>
    products.find((p) => p.id === productId)?.variants ?? [];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">
            {isEdit ? 'Edit Quotation Template' : 'New Quotation Template'}
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

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Template Name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.name ? 'border-red-400' : 'border-slate-300'}`}
                placeholder="e.g. Standard Enterprise Starter"
              />
              {fieldErrors.name && <p className="text-xs text-red-600 mt-1">{fieldErrors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Validity Days *</label>
              <input
                type="number"
                min="1"
                value={validityDays}
                onChange={(e) => setValidityDays(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Associated Plan</label>
              <select
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— None —</option>
                {plansData?.data.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Product Lines */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Product Lines</h3>
              <button
                type="button"
                onClick={addLine}
                disabled={products.length === 0}
                className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Line</span>
              </button>
            </div>

            {lines.length === 0 && (
              <p className="text-xs text-slate-400 italic">No product lines added yet.</p>
            )}

            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex-1">
                    <select
                      value={line.product_id}
                      onChange={(e) => updateLine(i, 'product_id', Number(e.target.value))}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1">
                    <select
                      value={line.variant_id ?? ''}
                      onChange={(e) => updateLine(i, 'variant_id', e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">— No Variant —</option>
                      {getVariants(line.product_id).map((v) => (
                        <option key={v.id} value={v.id}>{v.attribute}: {v.value} (+${v.extra_price})</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-500">Qty</span>
                    <input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(e) => updateLine(i, 'quantity', Number(e.target.value))}
                      className="w-16 px-2 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
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
            {mutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateForm;
