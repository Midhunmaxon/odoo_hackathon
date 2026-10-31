import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../lib/axios';
import { FormField } from '../../components/FormField';
import { Mail, ArrowLeft, CheckCircle2, Loader2, KeyRound } from 'lucide-react';
import { useToast } from '../../components/Toast';

export const ForgotPasswordPage: React.FC = () => {
  const { success, error: toastError } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await apiClient.post('/auth/forgot-password', { email: email.trim() });
      setSubmitted(true);
      success('Password reset instructions generated.');
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Something went wrong. Please try again.';
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
          <div className="inline-flex w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 items-center justify-center mb-3 border border-amber-200 shadow-sm">
            <KeyRound className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Forgot Password?</h2>
          <p className="text-xs text-slate-500 mt-1">
            Enter your registered email and we'll send you a password reset link.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs flex items-start space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-emerald-900">Reset Link Dispatched</p>
                <p className="leading-relaxed">
                  If <strong>{email}</strong> is registered in our system, a password reset link has been issued.
                  Please check your inbox or click below to enter the reset token.
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col space-y-2">
              <Link
                to="/reset-password"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-center text-xs transition-colors shadow"
              >
                Enter Reset Token
              </Link>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="w-full py-2 text-slate-500 hover:text-slate-800 text-xs font-medium text-center"
              >
                Send to a different email
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                {error}
              </div>
            )}

            <FormField label="Registered Email Address" htmlFor="forgot-email" required>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="forgot-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-slate-50/50"
                  placeholder="admin@brightloop.com"
                />
              </div>
            </FormField>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md shadow-blue-500/20 transition-all text-sm disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending Link...</span>
                </>
              ) : (
                <span>Send Reset Link</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
