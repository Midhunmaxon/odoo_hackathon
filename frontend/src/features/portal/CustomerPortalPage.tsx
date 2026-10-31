import React from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/axios';
import { Subscription, Invoice, PaginatedResult, User } from '../../types';
import { Globe, ShieldCheck, CreditCard, Receipt } from 'lucide-react';

export const CustomerPortalPage: React.FC = () => {
  const userJson = localStorage.getItem('brightloop_user');
  const user: User | null = userJson ? JSON.parse(userJson) : null;

  const { data: subsData } = useQuery<PaginatedResult<Subscription>>({
    queryKey: ['portal-subscriptions'],
    queryFn: async () => {
      const res = await apiClient.get('/subscriptions?page=1&limit=5&sort=id:desc');
      return res.data;
    },
  });

  const { data: invoicesData } = useQuery<PaginatedResult<Invoice>>({
    queryKey: ['portal-invoices'],
    queryFn: async () => {
      const res = await apiClient.get('/invoices?page=1&limit=5&sort=id:desc');
      return res.data;
    },
  });

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-lg">
        <div className="flex items-center space-x-3 mb-2">
          <Globe className="w-8 h-8 text-blue-200" />
          <h1 className="text-2xl font-bold">Customer Self-Service Portal</h1>
        </div>
        <p className="text-blue-100 text-sm">
          Welcome back, <strong className="text-white">{user?.name || 'Customer'}</strong> ({user?.email}). Manage your plans and billing receipts directly.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Active Subscriptions */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center space-x-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            <span>My Active Subscriptions</span>
          </h2>
          <div className="space-y-3">
            {subsData?.data.map((sub) => (
              <div key={sub.id} className="p-4 rounded-lg border border-slate-100 bg-slate-50 flex justify-between items-center">
                <div>
                  <p className="font-mono font-medium text-blue-600 text-sm">{sub.number}</p>
                  <p className="text-xs text-slate-500">Renews on {sub.next_billing_date || 'N/A'}</p>
                </div>
                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                  {sub.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Invoices */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center space-x-2">
            <Receipt className="w-5 h-5 text-indigo-600" />
            <span>Billing & Invoices</span>
          </h2>
          <div className="space-y-3">
            {invoicesData?.data.map((inv) => (
              <div key={inv.id} className="p-4 rounded-lg border border-slate-100 bg-slate-50 flex justify-between items-center">
                <div>
                  <p className="font-mono font-medium text-slate-800 text-sm">{inv.number}</p>
                  <p className="text-xs text-slate-500">Due {inv.due_date}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900 text-sm">${inv.total}</p>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    {inv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerPortalPage;
