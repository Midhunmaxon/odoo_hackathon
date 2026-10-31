import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../../lib/axios';
import { FormField } from '../../components/FormField';
import { Lock, Mail, Loader2 } from 'lucide-react';
import { useToast } from '../../components/Toast';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
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

      success(`Welcome back, ${user.name || user.email}!`);

      if (user.role === 'CUSTOMER') {
        navigate('/portal');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Login failed. Please check credentials.';
      setError(msg);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  const setDemoAccount = (demoEmail: string, demoRole: string) => {
    setEmail(demoEmail);
    setPassword('Password123!');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 border border-slate-100">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 items-center justify-center font-extrabold text-white text-2xl shadow-lg shadow-blue-500/30 mb-3">
            BL
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Brightloop Engine</h2>
          <p className="text-xs text-slate-500 mt-1">Sign in to your subscription management dashboard</p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Email Address" htmlFor="login-email" required>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-slate-50/50"
                placeholder="you@company.com"
              />
            </div>
          </FormField>

          <FormField label="Password" htmlFor="login-password" required>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-slate-50/50"
                placeholder="••••••••"
              />
            </div>
          </FormField>

          <div className="flex items-center justify-between text-xs pt-1">
            <Link
              to="/signup"
              className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
            >
              Need an account? Sign up
            </Link>
            <Link
              to="/forgot-password"
              className="text-slate-500 hover:text-slate-700 hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md shadow-blue-500/20 transition-all text-sm disabled:opacity-50 flex items-center justify-center space-x-2 mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        {/* Demo Fast-login Buttons */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 text-center">
            Quick-Fill Demo Credentials
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setDemoAccount('admin@brightloop.com', 'ADMIN')}
              className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold border border-purple-200 transition-colors text-center"
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => setDemoAccount('staff1@brightloop.com', 'STAFF')}
              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold border border-blue-200 transition-colors text-center"
            >
              Staff
            </button>
            <button
              type="button"
              onClick={() => setDemoAccount('customer1@brightloop.com', 'CUSTOMER')}
              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold border border-emerald-200 transition-colors text-center"
            >
              Customer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
