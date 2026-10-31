import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/axios';
import { Subscription, Invoice, PaginatedResult, User } from '../../types';
import { DataTable, Column } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { SubscriptionDetailModal } from './SubscriptionDetailModal';
import { InvoiceDetailModal } from './InvoiceDetailModal';
import {
  Globe,
  CreditCard,
  Receipt,
  Eye,
  Printer,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';

export const CustomerPortalPage: React.FC = () => {
  const userJson = localStorage.getItem('brightloop_user');
  const user: User | null = userJson ? JSON.parse(userJson) : null;

  // Active Tab: 'subscriptions' | 'invoices'
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'invoices'>('subscriptions');

  // Pagination states
  const [subPage, setSubPage] = useState(1);
  const [invPage, setInvPage] = useState(1);
  const limit = 10;

  // Modals
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null);
  const [selectedInvId, setSelectedInvId] = useState<number | null>(null);

  // 1. Fetch Subscriptions (Customer-isolated in DB query)
  const {
    data: subsData,
    isLoading: isSubsLoading,
    error: subsError,
    refetch: refetchSubs,
  } = useQuery<PaginatedResult<Subscription>>({
    queryKey: ['portal-subscriptions', subPage, limit],
    queryFn: async () => {
      try {
        const res = await apiClient.get(
          `/users/portal/subscriptions?page=${subPage}&limit=${limit}&sort=id:desc`
        );
        return res.data;
      } catch (err: any) {
        // Fallback to /portal/subscriptions if mounted directly
        const res = await apiClient.get(
          `/portal/subscriptions?page=${subPage}&limit=${limit}&sort=id:desc`
        );
        return res.data;
      }
    },
  });

  // 2. Fetch Invoices (Customer-isolated in DB query)
  const {
    data: invsData,
    isLoading: isInvsLoading,
    error: invsError,
    refetch: refetchInvs,
  } = useQuery<PaginatedResult<Invoice>>({
    queryKey: ['portal-invoices', invPage, limit],
    queryFn: async () => {
      try {
        const res = await apiClient.get(
          `/users/portal/invoices?page=${invPage}&limit=${limit}&sort=id:desc`
        );
        return res.data;
      } catch (err: any) {
        // Fallback to /portal/invoices if mounted directly
        const res = await apiClient.get(
          `/portal/invoices?page=${invPage}&limit=${limit}&sort=id:desc`
        );
        return res.data;
      }
    },
  });

  // Subscriptions Table Columns
  const subColumns: Column<Subscription>[] = [
    {
      key: 'number',
      header: 'Subscription #',
      render: (item) => (
        <div className="flex items-center space-x-2">
          <CreditCard className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="font-mono font-bold text-slate-900">{item.number}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'start_date',
      header: 'Start Date',
      render: (item) => (
        <span className="text-xs text-slate-600 flex items-center">
          <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
          {item.start_date || '—'}
        </span>
      ),
    },
    {
      key: 'next_billing_date',
      header: 'Next Billing Date',
      render: (item) => (
        <span className="text-xs font-medium text-blue-600 flex items-center">
          <Clock className="w-3.5 h-3.5 mr-1 text-blue-400" />
          {item.next_billing_date || 'Not scheduled'}
        </span>
      ),
    },
    {
      key: 'payment_terms',
      header: 'Terms',
      render: (item) => (
        <span className="text-xs text-slate-500 capitalize">{item.payment_terms || 'Immediate'}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Details',
      align: 'right',
      render: (item) => (
        <button
          onClick={() => setSelectedSubId(item.id)}
          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors ml-auto"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>View</span>
        </button>
      ),
    },
  ];

  // Invoices Table Columns
  const invColumns: Column<Invoice>[] = [
    {
      key: 'number',
      header: 'Invoice #',
      render: (item) => (
        <div className="flex items-center space-x-2">
          <Receipt className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="font-mono font-bold text-slate-900">{item.number}</span>
        </div>
      ),
    },
    {
      key: 'period',
      header: 'Billing Period',
      render: (item) => (
        <span className="text-xs text-slate-600">
          {item.period_start} → {item.period_end}
        </span>
      ),
    },
    {
      key: 'due_date',
      header: 'Due Date',
      render: (item) => <span className="text-xs text-slate-600">{item.due_date}</span>,
    },
    {
      key: 'status',
      header: 'Payment Status',
      render: (item) => {
        const isPaid = item.status === 'PAID';
        return (
          <StatusBadge
            status={item.status}
            label={isPaid ? 'PAID' : `UNPAID (${item.status})`}
          />
        );
      },
    },
    {
      key: 'total',
      header: 'Amount',
      align: 'right',
      render: (item) => (
        <span className="font-mono font-extrabold text-slate-900 text-sm">
          ${Number(item.total).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (item) => (
        <div className="flex items-center justify-end space-x-1.5">
          <button
            onClick={() => setSelectedInvId(item.id)}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center space-x-1 transition-colors"
            title="View invoice details"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View</span>
          </button>
          <button
            onClick={() => setSelectedInvId(item.id)}
            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors"
            title="Print or Download as PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      ),
    },
  ];

  // Quick statistics calculation
  const totalSubs = subsData?.total || 0;
  const activeSubs =
    subsData?.data?.filter((s) => s.status === 'ACTIVE' || s.status === 'CONFIRMED').length || 0;
  const totalInvoices = invsData?.total || 0;
  const unpaidInvoices = invsData?.data?.filter((i) => i.status !== 'PAID').length || 0;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center space-x-2 text-blue-200 text-xs font-semibold uppercase tracking-wider mb-2">
            <Globe className="w-4 h-4" />
            <span>Customer Portal</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">
            Welcome back, {user?.name || 'Valued Customer'}
          </h1>
          <p className="text-blue-100 text-sm max-w-xl leading-relaxed">
            Manage your recurring subscription plans, inspect billing cycles, review itemized invoices,
            and download official payment receipts.
          </p>
        </div>

        {/* Ambient background blur decoration */}
        <div className="absolute right-0 bottom-0 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl pointer-events-none -mr-20 -mb-20" />
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Active Subscriptions
            </p>
            <p className="text-2xl font-extrabold text-slate-900 mt-0.5">
              {activeSubs}{' '}
              <span className="text-xs font-normal text-slate-500">/ {totalSubs} total</span>
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Billing Statements
            </p>
            <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{totalInvoices}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Outstanding Invoices
            </p>
            <p className="text-2xl font-extrabold text-slate-900 mt-0.5">
              {unpaidInvoices === 0 ? (
                <span className="text-emerald-600 text-lg font-bold">All Settled</span>
              ) : (
                <span className="text-amber-600">{unpaidInvoices} due</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Segmented Tab Navigation */}
      <div className="space-y-4">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`pb-3 px-6 text-sm font-bold flex items-center space-x-2 border-b-2 transition-all ${
              activeTab === 'subscriptions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>My Subscriptions</span>
            {totalSubs > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
                {totalSubs}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('invoices')}
            className={`pb-3 px-6 text-sm font-bold flex items-center space-x-2 border-b-2 transition-all ${
              activeTab === 'invoices'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>My Invoices & Receipts</span>
            {totalInvoices > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
                {totalInvoices}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Subscriptions View */}
        {activeTab === 'subscriptions' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <DataTable
              columns={subColumns}
              data={subsData?.data}
              isLoading={isSubsLoading}
              error={subsError}
              onRetry={() => refetchSubs()}
              page={subPage}
              limit={limit}
              total={subsData?.total || 0}
              onPageChange={(p) => setSubPage(p)}
              emptyTitle="No Active Subscriptions Found"
              emptyMessage="You do not currently have any active recurring contracts. Subscribe through our catalog or contact support."
            />
          </div>
        )}

        {/* Tab 2: Invoices View */}
        {activeTab === 'invoices' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <DataTable
              columns={invColumns}
              data={invsData?.data}
              isLoading={isInvsLoading}
              error={invsError}
              onRetry={() => refetchInvs()}
              page={invPage}
              limit={limit}
              total={invsData?.total || 0}
              onPageChange={(p) => setInvPage(p)}
              emptyTitle="No Invoices Issued Yet"
              emptyMessage="When recurring periods close or subscriptions renew, your official billing receipts will appear here."
            />
          </div>
        )}
      </div>

      {/* Subscription Detail Modal */}
      <SubscriptionDetailModal
        subscriptionId={selectedSubId}
        onClose={() => setSelectedSubId(null)}
      />

      {/* Invoice Detail Modal with Print/Download */}
      <InvoiceDetailModal invoiceId={selectedInvId} onClose={() => setSelectedInvId(null)} />
    </div>
  );
};

export default CustomerPortalPage;
