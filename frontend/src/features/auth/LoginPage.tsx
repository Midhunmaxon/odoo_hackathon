import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../lib/axios';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@brightloop.com');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiClient.post('/auth/login', { email, password });
      const { token, user } = res.data.data;
      localStorage.setItem('brightloop_token', token);
      localStorage.setItem('brightloop_user', JSON.stringify(user));

      if (user.role === 'CUSTOMER') {
        navigate('/portal');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-xl bg-blue-600 items-center justify-center font-bold text-white text-xl shadow-lg mb-3">
            BL
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Welcome to Brightloop</h2>
          <p className="text-sm text-slate-500 mt-1">Subscription & Recurring Billing Management</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="admin@brightloop.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow transition-colors text-sm disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-100 text-xs text-slate-500 space-y-1">
          <p className="font-semibold text-slate-700">Pre-seeded Demo Accounts:</p>
          <p>• Admin: <code className="text-blue-600">admin@brightloop.com</code> / <code className="text-slate-600">Password123!</code></p>
          <p>• Staff: <code className="text-blue-600">staff1@brightloop.com</code> / <code className="text-slate-600">Password123!</code></p>
          <p>• Customer: <code className="text-blue-600">customer1@brightloop.com</code> / <code className="text-slate-600">Password123!</code></p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
