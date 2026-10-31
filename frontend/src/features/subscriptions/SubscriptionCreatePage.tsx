import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Sparkles, Check, AlertCircle } from 'lucide-react';
import apiClient from '../../lib/axios';
import { PaginatedResult } from '../../types';
import { ProductWithVariants, Plan, QuotationTemplate } from '../catalog/types';
import { CreateSubscriptionInput, CreateSubscriptionLineInput } from './types';

interface UserItem {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface TaxItem {
  id: number;
  name: string;
  rate_percent: number;
}

interface ApiValidationError {
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

export const SubscriptionCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Mode: manual or from template
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [customerId, setCustomerId] = useState<string>('');
  const [planId, setPlanId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [paymentTerms, setPaymentTerms] = useState<string>('NET_30');

  interface LineItemState {
    product_id: number;
    variant_id: number | null;
    quantity: number;
    unit_price: number;
    tax_id: number | null;
  }

  const [lines, setLines] = useState<LineItemState[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Fetch reference data
  const { data: plansData } = useQuery<PaginatedResult<Plan>>({
    queryKey: ['catalog-plans-all'],
    queryFn: async () => (await apiClient.get('/catalog/plans?page=1&limit=100')).data,
  });

  const { data: productsData } = useQuery<PaginatedResult<ProductWithVariants>>({
    queryKey: ['catalog-products-all'],
    queryFn: async () => (await apiClient.get('/catalog/products?page=1&limit=100')).data,
  });

  const { data: templatesData } = useQuery<PaginatedResult<QuotationTemplate>>({
    queryKey: ['quotation-templates-all'],
    queryFn: async () => (await apiClient.get('/subscriptions/templates?page=1&limit=100')).data,
  });

  const { data: usersData } = useQuery<PaginatedResult<UserItem>>({
    queryKey: ['users-list-sub'],
    queryFn: async () => {
      try {
        return (await apiClient.get('/users?page=1&limit=100')).data;
      } catch {
        return { data: [], page: 1, limit: 100, total: 0 };
      }
    },
  });

  const { data: taxesData } = useQuery<PaginatedResult<TaxItem>>({
    queryKey: ['taxes-list-sub'],
    queryFn: async () => {
      try {
        return (await apiClient.get('/tax-discount/taxes?page=1&limit=100')).data;
      } catch {
        return { data: [], page: 1, limit: 100, total: 0 };
      }
    },
  });

  const products = productsData?.data ?? [];
  const plans = plansData?.data ?? [];
  const templates = templatesData?.data ?? [];
  const customers = (usersData?.data ?? []).filter((u) => u.role === 'CUSTOMER' || true);

  // Helper to compute unit price for a product + variant
  const computeUnitPrice = (productId: number, variantId: number | null): number => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return 0;
    let base = Number(prod.sales_price || 0);
    if (variantId && prod.variants) {
      const v = prod.variants.find((item) => item.id === variantId);
      if (v) base += Number(v.extra_price || 0);
    }
    return base;
  };

  // When a template is chosen, populate the form lines and plan
  const handleTemplateSelect = (templateIdStr: string) => {
    setSelectedTemplateId(templateIdStr);
    if (!templateIdStr) return;

    const tmpl = templates.find((t) => t.id === Number(templateIdStr));
    if (!tmpl) return;

    if (tmpl.plan_id) {
      setPlanId(String(tmpl.plan_id));
    }

    if (tmpl.validity_days) {
      const start = new Date(startDate || Date.now());
      const exp = new Date(start.getTime() + tmpl.validity_days * 86400000);
      setExpiryDate(exp.toISOString().split('T')[0]);
    }

    if (tmpl.lines && tmpl.lines.length > 0) {
      const newLines: LineItemState[] = tmpl.lines.map((l) => ({
        product_id: l.product_id,
        variant_id: l.variant_id ?? null,
        quantity: l.quantity,
        unit_price: computeUnitPrice(l.product_id, l.variant_id ?? null),
        tax_id: null,
      }));
      setLines(newLines);
    }
  };

  // Line item handlers
  const addLine = () => {
    if (products.length === 0) return;
    const firstProd = products[0];
    const initialPrice = computeUnitPrice(firstProd.id, null);
    setLines([
      ...lines,
      {
        product_id: firstProd.id,
        variant_id: null,
        quantity: 1,
        unit_price: initialPrice,
        tax_id: null,
      },
    ]);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLineProduct = (index: number, newProductId: number) => {
    const newPrice = computeUnitPrice(newProductId, null);
    setLines(
      lines.map((l, i) =>
        i === index
          ? {
              ...l,
              product_id: newProductId,
              variant_id: null,
              unit_price: newPrice,
            }
          : l
      )
    );
  };

  const updateLineVariant = (index: number, newVariantId: number | null) => {
    const line = lines[index];
    const newPrice = computeUnitPrice(line.product_id, newVariantId);
    setLines(
      lines.map((l, i) =>
        i === index ? { ...l, variant_id: newVariantId, unit_price: newPrice } : l
      )
    );
  };

  const updateLineQuantity = (index: number, qty: number) => {
    setLines(lines.map((l, i) => (i === index ? { ...l, quantity: qty } : l)));
  };

  const updateLineTax = (index: number, taxId: number | null) => {
    setLines(lines.map((l, i) => (i === index ? { ...l, tax_id: taxId } : l)));
  };

  // Live totals calculation
  const selectedPlan = plans.find((p) => p.id === Number(planId));
  const planPrice = Number(selectedPlan?.price || 0);
  const linesSubtotal = lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0);
  const totalAmount = planPrice + linesSubtotal;

  // Submit mutations
  const createMutation = useMutation({
    mutationFn: async () => {
      setApiError(null);
      setFieldErrors({});

      const payload: CreateSubscriptionInput = {
        customer_id: Number(customerId),
        plan_id: Number(planId),
        start_date: startDate,
        expiry_date: expiryDate || undefined,
        payment_terms: paymentTerms,
        lines: lines.map((l) => ({
          product_id: l.product_id,
          variant_id: l.variant_id ?? null,
          quantity: Number(l.quantity),
          tax_id: l.tax_id ?? null,
        })),
      };

      const res = await apiClient.post('/subscriptions', payload);
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
      const newId = data?.data?.id;
      if (newId) {
        navigate(`/subscriptions/${newId}`);
      } else {
        navigate('/subscriptions');
      }
    },
    onError: (err: ApiValidationError) => {
      const errData = err.response?.data?.error;
      if (errData?.details) {
        const map: Record<string, string> = {};
        errData.details.forEach((d) => {
          map[d.field] = d.message;
        });
        setFieldErrors(map);
      }
      setApiError(errData?.message ?? 'Failed to create subscription');
    },
  });

  // Direct "Start From Template" mutation
  const fromTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      setApiError(null);
      setFieldErrors({});
      const payload = {
        customer_id: Number(customerId),
        start_date: startDate,
        payment_terms: paymentTerms,
      };
      const res = await apiClient.post(`/subscriptions/from-template/${templateId}`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
      const newId = data?.data?.id;
      if (newId) {
        navigate(`/subscriptions/${newId}`);
      } else {
        navigate('/subscriptions');
      }
    },
    onError: (err: ApiValidationError) => {
      const errData = err.response?.data?.error;
      if (errData?.details) {
        const map: Record<string, string> = {};
        errData.details.forEach((d) => {
          map[d.field] = d.message;
        });
        setFieldErrors(map);
      }
      setApiError(errData?.message ?? 'Failed to create subscription from template');
    },
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/subscriptions')}
          className="flex items-center space-x-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Subscriptions</span>
        </button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">New Subscription Contract</h1>
          <p className="text-sm text-slate-500 mt-1">
            Create a recurring subscription manually or start pre-populated from an existing quotation template.
          </p>
        </div>
      </div>

      {/* Global Error Banner */}
      {apiError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{apiError}</p>
            {fieldErrors && Object.keys(fieldErrors).length > 0 && (
              <ul className="mt-1 list-disc list-inside text-xs space-y-0.5">
                {Object.entries(fieldErrors).map(([f, m]) => (
                  <li key={f}>
                    <span className="font-medium capitalize">{f.replace('_', ' ')}:</span> {m}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Start from Template Card */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Start from Quotation Template</h2>
              <p className="text-xs text-slate-600">
                Prefill plan, products, and compute validity expiry with one click.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedTemplateId}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              className="px-3 py-2 bg-white border border-blue-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select Template —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.validity_days} days)
                </option>
              ))}
            </select>

            {selectedTemplateId && (
              <button
                type="button"
                onClick={() => {
                  if (!customerId) {
                    setFieldErrors({ customer_id: 'Please select a customer first' });
                    setApiError('Customer is required before generating from template');
                    return;
                  }
                  fromTemplateMutation.mutate(Number(selectedTemplateId));
                }}
                disabled={fromTemplateMutation.isPending}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 flex items-center space-x-1"
              >
                <span>Instant Draft</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Form Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
        <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">Contract Information</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Customer */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              Customer *
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
                fieldErrors.customer_id ? 'border-red-400' : 'border-slate-300'
              }`}
            >
              <option value="">— Select Customer —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.id} - {c.name} ({c.email})
                </option>
              ))}
              {/* Fallback option if no customer list */}
              {customers.length === 0 && (
                <>
                  <option value="1">Customer #1</option>
                  <option value="2">Customer #2</option>
                </>
              )}
            </select>
            {fieldErrors.customer_id && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.customer_id}</p>
            )}
          </div>

          {/* Subscription Plan */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              Subscription Plan *
            </label>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
                fieldErrors.plan_id ? 'border-red-400' : 'border-slate-300'
              }`}
            >
              <option value="">— Select Plan —</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — ${p.price}/{p.billing_period.toLowerCase()} (Min: {p.min_quantity})
                </option>
              ))}
            </select>
            {fieldErrors.plan_id && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.plan_id}</p>
            )}
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              Start Date *
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                fieldErrors.start_date ? 'border-red-400' : 'border-slate-300'
              }`}
            />
            {fieldErrors.start_date && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.start_date}</p>
            )}
          </div>

          {/* Expiry Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              Expiry Date
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                fieldErrors.expiry_date ? 'border-red-400' : 'border-slate-300'
              }`}
            />
            {fieldErrors.expiry_date && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.expiry_date}</p>
            )}
          </div>

          {/* Payment Terms */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              Payment Terms
            </label>
            <select
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="IMMEDIATE">Immediate</option>
              <option value="NET_15">Net 15 Days</option>
              <option value="NET_30">Net 30 Days</option>
              <option value="NET_60">Net 60 Days</option>
            </select>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* LINE ITEMS EDITOR WITH LIVE TOTALS */}
        {/* ==================================================================== */}
        <div className="pt-4 border-t border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Line Items</h3>
              <p className="text-xs text-slate-500">
                Products and variants attached to this contract. Unit prices update automatically based on variant extras.
              </p>
            </div>
            <button
              type="button"
              onClick={addLine}
              disabled={products.length === 0}
              className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-semibold rounded-lg transition-colors disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Product Line</span>
            </button>
          </div>

          {fieldErrors.lines && (
            <p className="text-xs text-red-600">{fieldErrors.lines}</p>
          )}

          {lines.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
              No line items added yet. Click "Add Product Line" or select a Quotation Template above.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Variant</th>
                    <th className="px-4 py-3 w-28">Quantity</th>
                    <th className="px-4 py-3 w-32">Unit Price</th>
                    <th className="px-4 py-3 w-32">Tax</th>
                    <th className="px-4 py-3 w-32 text-right">Amount</th>
                    <th className="px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {lines.map((line, i) => {
                    const currentProd = products.find((p) => p.id === line.product_id);
                    const variants = currentProd?.variants ?? [];
                    const lineAmount = line.unit_price * line.quantity;

                    return (
                      <tr key={i} className="hover:bg-slate-50/60">
                        {/* Product Dropdown */}
                        <td className="px-4 py-3">
                          <select
                            value={line.product_id}
                            onChange={(e) => updateLineProduct(i, Number(e.target.value))}
                            className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (${Number(p.sales_price).toFixed(2)})
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Variant Dropdown */}
                        <td className="px-4 py-3">
                          <select
                            value={line.variant_id ?? ''}
                            onChange={(e) =>
                              updateLineVariant(i, e.target.value ? Number(e.target.value) : null)
                            }
                            className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">— Standard (None) —</option>
                            {variants.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.attribute}: {v.value} (+${v.extra_price})
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Quantity */}
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={(e) => updateLineQuantity(i, Math.max(1, Number(e.target.value)))}
                            className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>

                        {/* Computed Unit Price */}
                        <td className="px-4 py-3 font-medium text-slate-900">
                          ${line.unit_price.toFixed(2)}
                        </td>

                        {/* Tax Option */}
                        <td className="px-4 py-3">
                          <select
                            value={line.tax_id ?? ''}
                            onChange={(e) =>
                              updateLineTax(i, e.target.value ? Number(e.target.value) : null)
                            }
                            className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">0% (None)</option>
                            {taxesData?.data.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({t.rate_percent}%)
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Amount */}
                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                          ${lineAmount.toFixed(2)}
                        </td>

                        {/* Remove */}
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(i)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Live Totals Bar */}
              <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
                <div className="w-72 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Plan Base Price:</span>
                    <span className="font-semibold text-slate-800">${planPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Line Items Subtotal:</span>
                    <span className="font-semibold text-slate-800">${linesSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-2">
                    <span>Recurring Total:</span>
                    <span className="text-blue-600">${totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={() => navigate('/subscriptions')}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || lines.length === 0}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center space-x-1.5"
          >
            <Check className="w-4 h-4" />
            <span>{createMutation.isPending ? 'Creating...' : 'Create Subscription'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionCreatePage;
