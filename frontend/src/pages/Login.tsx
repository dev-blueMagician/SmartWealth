/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../auth/AuthContext';
import { toApiError, type ApiError } from '../services/apiError';
import { ErrorPopup } from '../components/ErrorPopup';

export function LoginPage() {
  const { auth, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const redirectTo =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/internal';

  useEffect(() => {
    if (auth) {
      navigate(redirectTo, { replace: true });
    }
  }, [auth, navigate, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(username.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4">
      <ErrorPopup error={error} onClose={() => setError(null)} />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-indigo-950/40"
      >
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white">Nexus WM</h1>
          <p className="text-sm text-slate-400">Staff portal — sign in to continue</p>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Username</span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              required
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-8 text-center text-xs text-slate-500">
          Client companion demo (no staff login):{' '}
          <Link to="/mobile" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Open mobile preview
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
