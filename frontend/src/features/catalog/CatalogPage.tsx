import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/axios';
import { PaginatedResult } from '../../types';
import { ProductWithVariants, Plan, QuotationTemplate } from './types';
import { ProductForm } from './ProductForm';
import { PlanForm, PlanActions } from './PlanForm';
import { TemplateForm } from './TemplateForm';
import {
  Package,
  Layers,
  FileText,
  Plus,
  Edit2,
  Trash2,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
} from 'lucide-react';

export const CatalogPage: React.FC = () => {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'products' | 'plans' | 'templates'>('products');

  // Search & pagination state
  const [productSearch, setProductSearch] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [planSearch, setPlanSearch] = useState('');
  const [planPage, setPlanPage] = useState(1);
  const [templatePage, setTemplatePage] = useState(1);

  // Modal states
  const [editingProduct, setEditingProduct] = useState<ProductWithVariants | null | undefined>(undefined);
  const [editingPlan, setEditingPlan] = useState<Plan | null | undefined>(undefined);
  const [editingTemplate, setEditingTemplate] = useState<QuotationTemplate | null | undefined>(undefined);

  // Queries
  const { data: productsData, isLoading: loadingProducts } = useQuery<PaginatedResult<ProductWithVariants>>({
    queryKey: ['catalog-products', productPage, productSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(productPage),
        limit: '10',
        sort: 'name:asc',
      });
      if (productSearch) params.set('search', productSearch);
      const res = await apiClient.get(`/catalog/products?${params.toString()}`);
      return res.data;
    },
  });

  const { data: plansData, isLoading: loadingPlans } = useQuery<PaginatedResult<Plan>>({
    queryKey: ['catalog-plans', planPage, planSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(planPage),
        limit: '10',
        sort: 'price:asc',
      });
      if (planSearch) params.set('search', planSearch);
      const res = await apiClient.get(`/catalog/plans?${params.toString()}`);
      return res.data;
    },
  });

  const { data: templatesData, isLoading: loadingTemplates } = useQuery<PaginatedResult<QuotationTemplate>>({
    queryKey: ['quotation-templates', templatePage],
    queryFn: async () => {
      const res = await apiClient.get(`/subscriptions/templates?page=${templatePage}&limit=10&sort=id:desc`);
      return res.data;
    },
  });

  // Delete mutations
  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => apiClient.delete(`/catalog/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalog-products'] }),
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (id: number) => apiClient.delete(`/catalog/plans/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalog-plans'] }),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => apiClient.delete(`/subscriptions/templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotation-templates'] }),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center space-x-2">
            <Package className="w-6 h-6 text-blue-600" />
            <span>Product Catalog & Plans</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage products, variants, recurring subscription plans, and reusable quotation templates.
          </p>
        </div>

        {/* Action Button based on active tab */}
        {activeTab === 'products' && (
          <button
            onClick={() => setEditingProduct(null)}
            className="px-4 py-2 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 shadow-sm flex items-center space-x-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Product</span>
          </button>
        )}
        {activeTab === 'plans' && (
          <button
            onClick={() => setEditingPlan(null)}
            className="px-4 py-2 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 shadow-sm flex items-center space-x-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Plan</span>
          </button>
        )}
        {activeTab === 'templates' && (
          <button
            onClick={() => setEditingTemplate(null)}
            className="px-4 py-2 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 shadow-sm flex items-center space-x-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Template</span>
          </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center space-x-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'products'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Products & Variants</span>
          {productsData?.total !== undefined && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
              {productsData.total}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('plans')}
          className={`flex items-center space-x-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'plans'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Subscription Plans</span>
          {plansData?.total !== undefined && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
              {plansData.total}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('templates')}
          className={`flex items-center space-x-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'templates'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Quotation Templates</span>
          {templatesData?.total !== undefined && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
              {templatesData.total}
            </span>
          )}
        </button>
      </div>

      {/* ==================================================================== */}
      {/* PRODUCTS TAB */}
      {/* ==================================================================== */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  setProductPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {loadingProducts ? (
              <div className="p-8 text-center text-slate-500">Loading products...</div>
            ) : productsData?.data.length === 0 ? (
              <div className="p-8 text-center text-slate-400">No products found.</div>
            ) : (
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Product Name</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Sales Price</th>
                    <th className="px-6 py-3">Cost Price</th>
                    <th className="px-6 py-3">Variants</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productsData?.data.map((prod) => (
                    <tr key={prod.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{prod.name}</div>
                        {prod.notes && <div className="text-xs text-slate-400 mt-0.5">{prod.notes}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="capitalize px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700">
                          {prod.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900">${Number(prod.sales_price).toFixed(2)}</td>
                      <td className="px-6 py-4 text-slate-500">${Number(prod.cost_price || 0).toFixed(2)}</td>
                      <td className="px-6 py-4">
                        {prod.variants && prod.variants.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {prod.variants.map((v, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-200"
                              >
                                {v.attribute}: {v.value} {Number(v.extra_price) > 0 ? `(+${v.extra_price})` : ''}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">None</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => setEditingProduct(prod)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded"
                            title="Edit Product"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete product "${prod.name}"?`)) {
                                deleteProductMutation.mutate(prod.id);
                              }
                            }}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Delete Product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Pagination */}
            {productsData && productsData.total > 10 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50 text-xs">
                <span className="text-slate-500">
                  Showing {(productPage - 1) * 10 + 1} to {Math.min(productPage * 10, productsData.total)} of{' '}
                  {productsData.total}
                </span>
                <div className="space-x-2">
                  <button
                    disabled={productPage === 1}
                    onClick={() => setProductPage((p) => p - 1)}
                    className="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    disabled={productPage * 10 >= productsData.total}
                    onClick={() => setProductPage((p) => p + 1)}
                    className="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PLANS TAB */}
      {/* ==================================================================== */}
      {activeTab === 'plans' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search plans..."
                value={planSearch}
                onChange={(e) => {
                  setPlanSearch(e.target.value);
                  setPlanPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loadingPlans ? (
              <div className="col-span-full p-8 text-center text-slate-400">Loading plans...</div>
            ) : plansData?.data.length === 0 ? (
              <div className="col-span-full p-8 text-center text-slate-400">No plans found.</div>
            ) : (
              plansData?.data.map((plan) => (
                <div
                  key={plan.id}
                  className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-lg text-slate-900">{plan.name}</h3>
                        <span className="text-xs text-slate-400">ID: #{plan.id}</span>
                      </div>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                          plan.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : plan.status === 'PAUSED'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-600 border-slate-300'
                        }`}
                      >
                        {plan.status}
                      </span>
                    </div>

                    <div className="text-3xl font-extrabold text-slate-900 mb-4">
                      ${Number(plan.price).toFixed(2)}
                      <span className="text-xs font-normal text-slate-500"> / {plan.billing_period.toLowerCase()}</span>
                    </div>

                    <div className="space-y-2 text-xs text-slate-600 mb-4">
                      <div className="flex justify-between">
                        <span>Min Quantity:</span>
                        <span className="font-medium">{plan.min_quantity}</span>
                      </div>
                      {plan.start_date && (
                        <div className="flex justify-between">
                          <span>Start Date:</span>
                          <span className="font-medium">{plan.start_date}</span>
                        </div>
                      )}
                      {plan.end_date && (
                        <div className="flex justify-between">
                          <span>End Date:</span>
                          <span className="font-medium">{plan.end_date}</span>
                        </div>
                      )}
                    </div>

                    {/* Flag Indicators */}
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-1 mb-4">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Policy Flags
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Auto Close:</span>
                        {plan.auto_close ? (
                          <span className="inline-flex items-center text-emerald-600"><CheckCircle className="w-3 h-3 mr-1" /> Yes</span>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Allow Close:</span>
                        {plan.allow_close ? (
                          <span className="text-emerald-600 font-medium">Yes</span>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Allow Pause:</span>
                        {plan.allow_pause ? (
                          <span className="text-emerald-600 font-medium">Yes</span>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Allow Renew:</span>
                        {plan.allow_renew ? (
                          <span className="text-emerald-600 font-medium">Yes</span>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Plan Actions & Edit */}
                  <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                    <PlanActions plan={plan} />

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingPlan(plan)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded"
                        title="Edit Plan"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete plan "${plan.name}"?`)) {
                            deletePlanMutation.mutate(plan.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete Plan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* QUOTATION TEMPLATES TAB */}
      {/* ==================================================================== */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {loadingTemplates ? (
              <div className="p-8 text-center text-slate-500">Loading quotation templates...</div>
            ) : templatesData?.data.length === 0 ? (
              <div className="p-8 text-center text-slate-400">No quotation templates configured yet.</div>
            ) : (
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Template Name</th>
                    <th className="px-6 py-3">Validity</th>
                    <th className="px-6 py-3">Plan</th>
                    <th className="px-6 py-3">Configured Lines</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {templatesData?.data.map((tmpl) => (
                    <tr key={tmpl.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">{tmpl.name}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center text-xs text-slate-600">
                          <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          {tmpl.validity_days} days
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {tmpl.plan_id ? (
                          <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-medium">
                            Plan #{tmpl.plan_id}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">None</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 rounded text-slate-700">
                          {tmpl.lines?.length || 0} line items
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => setEditingTemplate(tmpl)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded"
                            title="Edit Template"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete template "${tmpl.name}"?`)) {
                                deleteTemplateMutation.mutate(tmpl.id);
                              }
                            }}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Delete Template"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Modal Renderers */}
      {editingProduct !== undefined && (
        <ProductForm
          initial={editingProduct || undefined}
          onClose={() => setEditingProduct(undefined)}
        />
      )}

      {editingPlan !== undefined && (
        <PlanForm
          initial={editingPlan || undefined}
          onClose={() => setEditingPlan(undefined)}
        />
      )}

      {editingTemplate !== undefined && (
        <TemplateForm
          initial={editingTemplate || undefined}
          onClose={() => setEditingTemplate(undefined)}
        />
      )}
    </div>
  );
};

export default CatalogPage;
