import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../api';

export default function AcceptOnboarding() {
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await authApi.acceptOnboarding({ token, password });
      setMessage('Password set successfully. You can now sign in.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to accept onboarding token');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface)] p-6 text-[var(--color-text-primary)]">
      <div className="w-full max-w-md rounded-lg border border-black/10 bg-[var(--color-surface-card)] p-6 shadow-lg">
        <h1 className="text-2xl font-semibold tracking-tight">Set Your Password</h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Use the one-time invite or reset token provided by your platform admin.</p>
        {message && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {message}
          </div>
        )}
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">Token</span>
            <textarea value={token} onChange={event => setToken(event.target.value)} className="mt-2 min-h-24 w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm" required />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">New Password</span>
            <input type="password" value={password} onChange={event => setPassword(event.target.value)} className="mt-2 w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm" minLength={8} required />
          </label>
          <button disabled={loading || token.length < 24 || password.length < 8} className="w-full rounded-md bg-[var(--color-text-primary)] py-3 text-sm font-medium text-white disabled:opacity-50">
            {loading ? 'Saving...' : 'Set Password'}
          </button>
        </form>
        <Link to="/login" className="mt-5 inline-block text-sm font-medium text-blue-700">Back to login</Link>
      </div>
    </div>
  );
}
