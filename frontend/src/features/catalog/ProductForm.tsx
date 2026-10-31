import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2 } from 'lucide-react';
import apiClient from '../../lib/axios';
import type { ProductVariant } from './types';

interface ProductFormProps {
  initial?: {
    id?: number;
    name: string;
    type: string;
    sales_price: number;
    cost_price: number;
    notes?: string;
    variants?: ProductVariant[];
  };
  onClose: () => void;
}

interface ApiValidationError {
  response?: { data?: { error?: { message?: string; details?: { field: string; message: string }[] } } };
  message?: string;
}

export const ProductForm: React.FC<ProductFormProps> = ({ initial, onClose }) => {
  const qc = useQueryClient();
  const isEdit = Boolean(initial?.id);

  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState(initial?.type ?? 'service');
  const [salesPrice, setSalesPrice] = useState(String(initial?.sales_price ?? ''));
  const [costPrice, setCostPrice] = useState(String(initial?.cost_price ?? ''));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [variants, setVariants] = useState<ProductVariant[]>(initial?.variants ?? []);
  const [apiError, setApiError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        type,
        sales_price: Number(salesPrice),
        cost_price: Number(costPrice),
        notes: notes || undefined,
        variants: variants.map((v) => ({
          attribute: v.attribute,
          value: v.value,
          extra_price: Number(v.extra_price),
          ...(v.id ? { id: v.id } : {}),
        })),
      };
      if (isEdit) {
        return apiClient.patch(`/catalog/products/${initial!.id}`, payload);
      }
      return apiClient.post('/catalog/products', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog-products'] });
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

  const addVariant = () => {
    setVariants([...variants, { attribute: '', value: '', extra_price: 0 }]);
  };

  const removeVariant = (i: number) => {
    setVariants(variants.filter((_, idx) => idx !== i));
  };

  const updateVariant = (i: number, field: keyof ProductVariant, val: string | number) => {
    setVariants(variants.map((v, idx) => idx === i ? { ...v, [field]: val } : v));
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">
            {isEdit ? 'Edit Product' : 'New Product'}
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Product Name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.name ? 'border-red-400' : 'border-slate-300'}`}
                placeholder="e.g. Cloud Workspace Suite"
              />
              {fieldErrors.name && <p className="text-xs text-red-600 mt-1">{fieldErrors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="service">Service</option>
                <option value="product">Product</option>
                <option value="subscription">Subscription</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sales Price ($) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={salesPrice}
                onChange={(e) => setSalesPrice(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.sales_price ? 'border-red-400' : 'border-slate-300'}`}
              />
              {fieldErrors.sales_price && <p className="text-xs text-red-600 mt-1">{fieldErrors.sales_price}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cost Price ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Variants Editor */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Variants</h3>
              <button
                type="button"
                onClick={addVariant}
                className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Variant</span>
              </button>
            </div>

            {variants.length === 0 && (
              <p className="text-xs text-slate-400 italic">No variants. Click "Add Variant" to add attributes like Brand, Color, Size.</p>
            )}

            <div className="space-y-2">
              {variants.map((v, i) => (
                <div key={i} className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <input
                    value={v.attribute}
                    onChange={(e) => updateVariant(i, 'attribute', e.target.value)}
                    placeholder="Attribute (e.g. Brand)"
                    className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    value={v.value}
                    onChange={(e) => updateVariant(i, 'value', e.target.value)}
                    placeholder="Value (e.g. Odoo)"
                    className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="flex items-center">
                    <span className="text-xs text-slate-500 mr-1">+$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={v.extra_price}
                      onChange={(e) => updateVariant(i, 'extra_price', Number(e.target.value))}
                      placeholder="0"
                      className="w-20 px-2 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeVariant(i)}
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
            {mutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Product'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductForm;
