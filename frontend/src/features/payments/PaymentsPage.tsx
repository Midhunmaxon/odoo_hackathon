import React from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/axios';
import { Payment, PaginatedResult } from '../../types';
import { Receipt } from 'lucide-react';

export const PaymentsPage: React.FC = () => {
  const { data, isLoading } = useQuery<PaginatedResult<Payment>>({
    queryKey: ['payments'],
    queryFn: async () => {
      const res = await apiClient.get('/payments?page=1&limit=10&sort=id:desc');
      return res.data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center space-x-2">
          <Receipt className="w-6 h-6 text-blue-600" />
          <span>Payments</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Monitor processed payments, payment gateways, and settlement history.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading payments...</div>
        ) : (
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-3">Payment ID</th>
                <th className="px-6 py-3">Invoice ID</th>
                <th className="px-6 py-3">Method</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.data.map((pmt) => (
                <tr key={pmt.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono font-medium text-slate-900">#{pmt.id}</td>
                  <td className="px-6 py-4">Invoice #{pmt.invoice_id}</td>
                  <td className="px-6 py-4 font-semibold text-xs text-slate-700">{pmt.method}</td>
                  <td className="px-6 py-4 font-bold text-emerald-600">${pmt.amount}</td>
                  <td className="px-6 py-4 text-xs text-slate-500">{new Date(pmt.paid_at).toLocaleString()}</td>
                  <td className="px-6 py-4 text-xs text-slate-400">{pmt.note || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default PaymentsPage;
