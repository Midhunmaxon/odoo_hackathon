import React from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/axios';
import { Invoice, PaginatedResult } from '../../types';
import { FileText } from 'lucide-react';

export const InvoicesPage: React.FC = () => {
  const { data, isLoading } = useQuery<PaginatedResult<Invoice>>({
    queryKey: ['invoices'],
    queryFn: async () => {
      const res = await apiClient.get('/invoices?page=1&limit=10&sort=id:desc');
      return res.data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center space-x-2">
          <FileText className="w-6 h-6 text-blue-600" />
          <span>Invoices</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Review recurring invoices, line items, and payment reconciliation states.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading invoices...</div>
        ) : (
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-3">Invoice Number</th>
                <th className="px-6 py-3">Period</th>
                <th className="px-6 py-3">Subtotal</th>
                <th className="px-6 py-3">Tax</th>
                <th className="px-6 py-3">Total</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.data.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono font-medium text-slate-900">{inv.number}</td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {inv.period_start} → {inv.period_end}
                  </td>
                  <td className="px-6 py-4">${inv.subtotal}</td>
                  <td className="px-6 py-4">${inv.tax_total}</td>
                  <td className="px-6 py-4 font-bold text-slate-900">${inv.total}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        inv.status === 'PAID'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : inv.status === 'CONFIRMED'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">{inv.due_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default InvoicesPage;
