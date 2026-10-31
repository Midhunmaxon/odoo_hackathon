import React from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/axios';
import { Tax, Discount, PaginatedResult } from '../../types';
import { Percent, Sparkles } from 'lucide-react';

export const TaxDiscountPage: React.FC = () => {
  const { data: taxesData, isLoading: loadingTaxes } = useQuery<PaginatedResult<Tax>>({
    queryKey: ['taxes'],
    queryFn: async () => {
      const res = await apiClient.get('/tax-discount/taxes?page=1&limit=10&sort=id:asc');
      return res.data;
    },
  });

  const { data: discountsData, isLoading: loadingDiscounts } = useQuery<PaginatedResult<Discount>>({
    queryKey: ['discounts'],
    queryFn: async () => {
      const res = await apiClient.get('/tax-discount/discounts?page=1&limit=10&sort=id:asc');
      return res.data;
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center space-x-2">
          <Percent className="w-6 h-6 text-blue-600" />
          <span>Taxes & Discounts</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure jurisdictional tax rates and promotional discount incentives.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Taxes */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Tax Rates</h2>
          {loadingTaxes ? (
            <p className="text-sm text-slate-400">Loading taxes...</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {taxesData?.data.map((tax) => (
                <div key={tax.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{tax.name}</p>
                    <p className="text-xs text-slate-400">Active Rate</p>
                  </div>
                  <span className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-full">
                    {tax.rate_percent}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Discounts */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Active Discounts</span>
          </h2>
          {loadingDiscounts ? (
            <p className="text-sm text-slate-400">Loading discounts...</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {discountsData?.data.map((discount) => (
                <div key={discount.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{discount.name}</p>
                    <p className="text-xs text-slate-400">Applies to {discount.applies_to}</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                    {discount.type === 'PERCENT' ? `${discount.value}% OFF` : `$${discount.value} OFF`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaxDiscountPage;
