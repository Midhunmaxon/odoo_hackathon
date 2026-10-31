import React from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/axios';
import { BarChart3, TrendingUp, Users, DollarSign, AlertCircle } from 'lucide-react';

interface ReportSummary {
  activeSubscriptions: number;
  monthlyRecurringRevenue: number;
  totalCustomers: number;
  unpaidInvoicesCount: number;
  unpaidInvoicesAmount: number;
}

export const ReportsPage: React.FC = () => {
  const { data, isLoading } = useQuery<{ success: boolean; data: ReportSummary }>({
    queryKey: ['reports-summary'],
    queryFn: async () => {
      const res = await apiClient.get('/reports/summary');
      return res.data;
    },
  });

  const summary = data?.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center space-x-2">
          <BarChart3 className="w-6 h-6 text-blue-600" />
          <span>Analytics & Reports</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          High-level subscription metrics, monthly recurring revenue (MRR), and aging invoices.
        </p>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-slate-500">Loading reports...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs uppercase font-semibold text-slate-400">MRR</p>
              <p className="text-2xl font-bold text-slate-900">
                ${summary?.monthlyRecurringRevenue.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs uppercase font-semibold text-slate-400">Active Subs</p>
              <p className="text-2xl font-bold text-slate-900">
                {summary?.activeSubscriptions}
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs uppercase font-semibold text-slate-400">Total Customers</p>
              <p className="text-2xl font-bold text-slate-900">
                {summary?.totalCustomers}
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs uppercase font-semibold text-slate-400">Unpaid Invoices</p>
              <p className="text-2xl font-bold text-slate-900">
                {summary?.unpaidInvoicesCount} (${summary?.unpaidInvoicesAmount})
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
