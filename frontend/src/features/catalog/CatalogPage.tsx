import React from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/axios';
import { Product, Plan, PaginatedResult } from '../../types';
import { Package, Tag } from 'lucide-react';

export const CatalogPage: React.FC = () => {
  const { data: productsData, isLoading: loadingProducts } = useQuery<PaginatedResult<Product>>({
    queryKey: ['catalog-products'],
    queryFn: async () => {
      const res = await apiClient.get('/catalog/products?page=1&limit=10&sort=name:asc');
      return res.data;
    },
  });

  const { data: plansData, isLoading: loadingPlans } = useQuery<PaginatedResult<Plan>>({
    queryKey: ['catalog-plans'],
    queryFn: async () => {
      const res = await apiClient.get('/catalog/plans?page=1&limit=10&sort=price:asc');
      return res.data;
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center space-x-2">
          <Package className="w-6 h-6 text-blue-600" />
          <span>Product Catalog & Subscription Plans</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage recurring subscription plans, product variants, and quotation templates.
        </p>
      </div>

      {/* Subscription Plans */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center space-x-2">
          <Tag className="w-5 h-5 text-indigo-500" />
          <span>Subscription Plans</span>
        </h2>
        {loadingPlans ? (
          <div className="p-4 text-slate-400">Loading plans...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plansData?.data.map((plan) => (
              <div
                key={plan.id}
                className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg text-slate-900">{plan.name}</h3>
                    <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-semibold">
                      {plan.billing_period}
                    </span>
                  </div>
                  <div className="text-3xl font-extrabold text-slate-900 mb-4">
                    ${plan.price}
                    <span className="text-xs font-normal text-slate-500"> / period</span>
                  </div>
                  <ul className="text-xs text-slate-600 space-y-2 mb-6">
                    <li>• Min Quantity: <strong>{plan.min_quantity}</strong></li>
                    <li>• Auto-Close: <strong>{plan.auto_close ? 'Yes' : 'No'}</strong></li>
                    <li>• Renewable: <strong>{plan.allow_renew ? 'Yes' : 'No'}</strong></li>
                  </ul>
                </div>
                <button className="w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors">
                  Assign Plan
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Products */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Products</h2>
        {loadingProducts ? (
          <div className="p-4 text-slate-400">Loading products...</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                <tr>
                  <th className="px-6 py-3">Product Name</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Sales Price</th>
                  <th className="px-6 py-3">Cost Price</th>
                  <th className="px-6 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productsData?.data.map((prod) => (
                  <tr key={prod.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{prod.name}</td>
                    <td className="px-6 py-4 capitalize text-slate-500">{prod.type}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900">${prod.sales_price}</td>
                    <td className="px-6 py-4 text-slate-500">${prod.cost_price}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">{prod.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default CatalogPage;
