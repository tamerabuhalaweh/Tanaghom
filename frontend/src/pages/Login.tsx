import { useState } from 'react';
import { useAuth } from '../contexts/useAuth';

export default function Login() {
  const { login, loading, error } = useAuth();
  const [email, setEmail] = useState('demand.specialist@tanaghum.com');
  const [password, setPassword] = useState('password123');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold mb-2">Tanaghum Platform</h1>
        <p className="text-gray-500 mb-6">Demo Login — Controlled Pilot Mode</p>

        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-6 text-sm text-yellow-800">
          <strong>Demo Users:</strong>
          <div className="mt-1">demand.specialist@tanaghum.com — Content Specialist</div>
          <div>brand.head@tanaghum.com — Department Head (Approver)</div>
          <div>admin@tanaghum.com — Admin</div>
          <div className="mt-1 text-yellow-600">Password: password123</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="mt-6 text-xs text-gray-400 text-center">
          External execution blocked • M5 disabled • Mock providers only
        </div>
      </div>
    </div>
  );
}
