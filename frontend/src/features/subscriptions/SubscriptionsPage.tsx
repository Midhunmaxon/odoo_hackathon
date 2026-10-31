import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../lib/axios';
import { Subscription, PaginatedResult } from '../../types';
import { Plan } from '../catalog/types';
import { CreditCard, Plus, Search, ChevronRight, Filter } from 'lucide-react';

const STATUS_TABS = ['ALL', 'DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED'] as const;

export const SubscriptionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedStatus, setSelectedStatus] = useState<typeof STATUS_TABS[number]>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Fetch plans to map plan names
  const { data: plansData } = useQuery<PaginatedResult<Plan>>({
    queryKey: ['catalog-plans-all'],
    queryFn: async () => (await apiClient.get('/catalog/plans?page=1&limit=100')).data,
  });

  const plansMap = new Map((plansData?.data ?? []).map((p) => [p.id, p.name]));

  // Fetch subscriptions with pagination and status filter
  const { data, isLoading } = useQuery<PaginatedResult<Subscription>>({
    queryKey: ['subscriptions', selectedStatus, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sort: 'id:desc',
      });
      if (selectedStatus !== 'ALL') {
        params.set('status', selectedStatus);
      }
      const res = await apiClient.get(`/subscriptions?${params.toString()}`);
      return res.data;
    },
  });

  // Client-side search filtering by number or customer ID
  const filteredData = (data?.data ?? []).filter((sub) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      sub.number.toLowerCase().includes(query) ||
      String(sub.customer_id).includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center space-x-2">
            <CreditCard className="w-6 h-6 text-blue-600" />
            <span>Subscriptions</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track customer recurring contracts, status progression, and billing cycles.
          </p>
        </div>
        <button
          onClick={() => navigate('/subscriptions/new')}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg shadow-sm flex items-center space-x-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Subscription</span>
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        {STATUS_TABS.map((tab) => {
          const isActive = selectedStatus === tab;
          return (
            <button
              key={tab}
              onClick={() => {
                setSelectedStatus(tab);
                setPage(1);
              }}
              className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by SUB number or customer ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading subscriptions...</div>
        ) : filteredData.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            No subscriptions found matching the selected filter.
          </div>
        ) : (
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-3">Number</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Plan</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Start Date</th>
                <th className="px-6 py-3">Next Billing</th>
                <th className="px-6 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.map((sub) => {
                const planName = plansMap.get(sub.plan_id) ?? `Plan #${sub.plan_id}`;
                return (
                  <tr
                    key={sub.id}
                    onClick={() => navigate(`/subscriptions/${sub.id}`)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 font-mono font-bold text-blue-600">{sub.number}</td>
                    <td className="px-6 py-4 text-slate-900 font-medium">Customer #{sub.customer_id}</td>
                    <td className="px-6 py-4">
                      <span className="text-xs bg-slate-100 px-2 py-0.5 rounded font-medium text-slate-700">
                        {planName}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          sub.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : sub.status === 'CONFIRMED'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : sub.status === 'QUOTATION'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : sub.status === 'CLOSED'
                            ? 'bg-slate-100 text-slate-600 border-slate-300'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs">{sub.start_date}</td>
                    <td className="px-6 py-4 font-semibold text-slate-800 text-xs">
                      {sub.next_billing_date || '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/subscriptions/${sub.id}`);
                        }}
                        className="p-1 text-slate-400 hover:text-blue-600 rounded"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination Controls */}
        {data && data.total > limit && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50 text-xs">
            <span className="text-slate-500">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, data.total)} of {data.total}
            </span>
            <div className="space-x-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={page * limit >= data.total}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionsPage;
