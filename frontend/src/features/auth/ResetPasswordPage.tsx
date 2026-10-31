import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import apiClient from '../../lib/axios';
import { FormField } from '../../components/FormField';
import { PasswordRuleChecklist, evaluatePasswordRules } from './PasswordRuleChecklist';
import { Lock, Key, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../components/Toast';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { success, error: toastError } = useToast();

  const [token, setToken] = useState(searchParams.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken) {
      setToken(urlToken);
    }
  }, [searchParams]);

  const rules = evaluatePasswordRules(password);
  const isPasswordValid = rules.every((r) => r.met);
  const passwordsMatch = password && confirmPassword ? password === confirmPassword : true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token.trim()) {
      const msg = 'Reset token is required.';
      setError(msg);
      toastError(msg);
      return;
    }

    if (!isPasswordValid) {
      const msg = 'Please satisfy all password security requirements.';
      setError(msg);
      toastError(msg);
      return;
    }

    if (password !== confirmPassword) {
      const msg = 'Passwords do not match.';
      setError(msg);
      toastError(msg);
      return;
    }

    setLoading(true);

    try {
      await apiClient.post('/auth/reset-password', {
        token: token.trim(),
        password,
      });

      setResetSuccess(true);
      success('Your password has been successfully reset!');
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to reset password. The token may be expired or invalid.';
      setError(msg);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 border border-slate-100">
        <Link
          to="/login"
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors mb-6 space-x-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Sign In</span>
        </Link>

        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 items-center justify-center mb-3 border border-blue-200 shadow-sm">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Set New Password</h2>
          <p className="text-xs text-slate-500 mt-1">Choose a strong, unique password for your account</p>
        </div>

        {resetSuccess ? (
          <div className="text-center space-y-4 py-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Password Updated!</h3>
            <p className="text-xs text-slate-600">
              Your password has been reset successfully. You can now log in using your new credentials.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-colors shadow"
            >
              Proceed to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                {error}
              </div>
            )}

            <FormField label="Reset Security Token" htmlFor="reset-token" required>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="reset-token"
                  type="text"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-mono bg-slate-50/50"
                  placeholder="Paste your 64-character token"
                />
              </div>
            </FormField>

            <FormField label="New Password" htmlFor="reset-password" required>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="reset-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-slate-50/50"
                  placeholder="Enter new password"
                />
              </div>
              <PasswordRuleChecklist password={password} />
            </FormField>

            <FormField
              label="Confirm New Password"
              htmlFor="reset-confirm-password"
              required
              error={!passwordsMatch ? 'Passwords do not match' : null}
            >
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="reset-confirm-password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-slate-50/50"
                  placeholder="Re-enter new password"
                />
              </div>
            </FormField>

            <button
              type="submit"
              disabled={loading || !token || !isPasswordValid || password !== confirmPassword}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md shadow-blue-500/20 transition-all text-sm disabled:opacity-50 flex items-center justify-center space-x-2 mt-4"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Resetting Password...</span>
                </>
              ) : (
                <span>Reset Password</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
