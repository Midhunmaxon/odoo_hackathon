import React from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/axios';
import { Subscription, PaginatedResult } from '../../types';
import { CreditCard, RefreshCw } from 'lucide-react';

export const SubscriptionsPage: React.FC = () => {
  const { data, isLoading } = useQuery<PaginatedResult<Subscription>>({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const res = await apiClient.get('/subscriptions?page=1&limit=10&sort=id:desc');
      return res.data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center space-x-2">
            <CreditCard className="w-6 h-6 text-blue-600" />
            <span>Subscriptions</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track active customer contracts, renewal dates, and status lifecycles.
          </p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 shadow-sm flex items-center space-x-2">
          <RefreshCw className="w-4 h-4" />
          <span>New Subscription</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading subscriptions...</div>
        ) : (
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-3">Number</th>
                <th className="px-6 py-3">Customer ID</th>
                <th className="px-6 py-3">Plan ID</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Start Date</th>
                <th className="px-6 py-3">Next Billing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.data.map((sub) => (
                <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono font-medium text-blue-600">{sub.number}</td>
                  <td className="px-6 py-4">Customer #{sub.customer_id}</td>
                  <td className="px-6 py-4">Plan #{sub.plan_id}</td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">{sub.start_date}</td>
                  <td className="px-6 py-4 font-semibold text-slate-800">{sub.next_billing_date || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default SubscriptionsPage;
