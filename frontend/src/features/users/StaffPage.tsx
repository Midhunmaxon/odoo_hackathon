import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/axios';
import { User, PaginatedResult } from '../../types';
import { DataTable, Column } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { FormField } from '../../components/FormField';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { PasswordRuleChecklist, evaluatePasswordRules } from '../auth/PasswordRuleChecklist';
import { UserPlus, ShieldAlert, UserCheck, UserX, Mail, Lock, User as UserIcon, X, Loader2 } from 'lucide-react';

export const StaffPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [page, setPage] = useState(1);
  const limit = 10;

  // Modal & Dialog state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const currentUserJson = localStorage.getItem('brightloop_user');
  const currentUser: User | null = currentUserJson ? JSON.parse(currentUserJson) : null;

  // 1. Fetch Staff Users
  const {
    data: staffData,
    isLoading,
    error,
    refetch,
  } = useQuery<PaginatedResult<User>>({
    queryKey: ['staff-users', page, limit],
    queryFn: async () => {
      // Use role filter: ?role=STAFF
      const res = await apiClient.get(`/users?role=STAFF&page=${page}&limit=${limit}&sort=id:desc`);
      return res.data;
    },
  });

  // 2. Create Staff Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: { name: string; email: string; password: string }) => {
      const res = await apiClient.post('/users/staff', payload);
      return res.data;
    },
    onSuccess: (data) => {
      success(`Staff account for "${data.data?.name || 'Staff'}" created successfully.`);
      setIsCreateModalOpen(false);
      setName('');
      setEmail('');
      setPassword('');
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['staff-users'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error?.message || 'Failed to create staff account.';
      setFormError(msg);
      toastError(msg);
    },
  });

  // 3. Deactivate User Mutation
  const deactivateMutation = useMutation({
    mutationFn: async (targetId: number) => {
      const res = await apiClient.patch(`/users/${targetId}/deactivate`);
      return res.data;
    },
    onSuccess: () => {
      success('Staff account deactivated successfully.');
      setDeactivateTarget(null);
      queryClient.invalidateQueries({ queryKey: ['staff-users'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error?.message || 'Failed to deactivate account.';
      toastError(msg);
      setDeactivateTarget(null);
    },
  });

  // Password rules validation for create-staff form
  const rules = evaluatePasswordRules(password);
  const isPasswordValid = rules.every((r) => r.met);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!isPasswordValid) {
      setFormError('Password does not satisfy all security requirements.');
      return;
    }

    createMutation.mutate({
      name: name.trim(),
      email: email.trim(),
      password,
    });
  };

  // Table Columns Definition
  const columns: Column<User>[] = [
    {
      key: 'id',
      header: 'ID',
      className: 'w-16 font-mono text-xs text-slate-400',
    },
    {
      key: 'name',
      header: 'Staff Member',
      render: (item) => (
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs uppercase">
            {item.name ? item.name.charAt(0) : 'S'}
          </div>
          <div>
            <p className="font-semibold text-slate-900">{item.name}</p>
            <p className="text-xs text-slate-500">{item.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (item) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <UserCheck className="w-3 h-3 mr-1" />
          {item.role}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (item) => (
        <StatusBadge
          status={item.is_active ? 'ACTIVE' : 'DEACTIVATED'}
          label={item.is_active ? 'Active' : 'Deactivated'}
        />
      ),
    },
    {
      key: 'created_at',
      header: 'Joined',
      render: (item) => (
        <span className="text-xs text-slate-500">
          {item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (item) => {
        const isSelf = currentUser && currentUser.id === item.id;
        const isAlreadyInactive = !item.is_active;

        return (
          <div className="flex items-center justify-end space-x-2">
            <button
              disabled={isSelf || isAlreadyInactive || deactivateMutation.isPending}
              onClick={() => setDeactivateTarget(item)}
              title={
                isSelf
                  ? 'Cannot deactivate own account'
                  : isAlreadyInactive
                  ? 'Account is already deactivated'
                  : 'Deactivate Staff'
              }
              className={`p-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 ${
                isSelf || isAlreadyInactive
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-rose-600 hover:bg-rose-50 border border-rose-200'
              }`}
            >
              <UserX className="w-3.5 h-3.5" />
              <span>Deactivate</span>
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2.5">
            <ShieldAlert className="w-6 h-6 text-blue-600" />
            <span>Staff Administration</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Create, monitor, and manage STAFF accounts with operational permissions across subscriptions and catalog.
          </p>
        </div>

        <button
          onClick={() => {
            setFormError(null);
            setIsCreateModalOpen(true);
          }}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 transition-all flex items-center space-x-2 self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      {/* Staff Table */}
      <DataTable
        columns={columns}
        data={staffData?.data}
        isLoading={isLoading}
        error={error}
        onRetry={() => refetch()}
        page={page}
        limit={limit}
        total={staffData?.total || 0}
        onPageChange={(p) => setPage(p)}
        emptyTitle="No Staff Accounts Found"
        emptyMessage="Click 'Add Staff Member' to provision the first staff account with operational privileges."
        emptyAction={
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow"
          >
            Create Staff Now
          </button>
        }
      />

      {/* CREATE STAFF MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
            onClick={() => !createMutation.isPending && setIsCreateModalOpen(false)}
          />

          <div className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 overflow-hidden border border-slate-100 z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Provision Staff Account</h3>
                  <p className="text-xs text-slate-500">Staff accounts will have operations & catalog access</p>
                </div>
              </div>
              <button
                disabled={createMutation.isPending}
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <FormField label="Full Name" htmlFor="staff-name" required>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="staff-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-slate-50/50"
                    placeholder="Sarah Connor"
                  />
                </div>
              </FormField>

              <FormField label="Staff Email Address" htmlFor="staff-email" required>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="staff-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-slate-50/50"
                    placeholder="staff@brightloop.com"
                  />
                </div>
              </FormField>

              <FormField label="Temporary Password" htmlFor="staff-password" required>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="staff-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-slate-50/50"
                    placeholder="Temporary password"
                  />
                </div>
                <PasswordRuleChecklist password={password} />
              </FormField>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={createMutation.isPending}
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !name || !email || !isPasswordValid}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <span>Create Staff</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DEACTIVATE DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => {
          if (deactivateTarget) {
            deactivateMutation.mutate(deactivateTarget.id);
          }
        }}
        title="Deactivate Staff Account?"
        description={
          <>
            Are you sure you want to deactivate{' '}
            <strong className="text-slate-900">{deactivateTarget?.name}</strong> (
            {deactivateTarget?.email})? This user will immediately lose access to the Brightloop
            administrative portal.
          </>
        }
        confirmText="Deactivate Account"
        isDangerous={true}
        isLoading={deactivateMutation.isPending}
      />
    </div>
  );
};

export default StaffPage;
