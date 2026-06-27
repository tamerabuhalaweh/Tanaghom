import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { AuthContext } from './AuthContext';
import { ApiError, authApi } from '../api';

type SessionEnvelope = {
  user?: unknown;
  agentRep?: unknown;
};

function normalizeSession(data: unknown): SessionEnvelope {
  if (data && typeof data === 'object' && 'user' in data) {
    return data as SessionEnvelope;
  }
  return { user: data, agentRep: data && typeof data === 'object' && 'agentRepId' in data ? { id: (data as Record<string, unknown>).agentRepId } : null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialToken = localStorage.getItem('token');
  const [state, setState] = useState({
    token: initialToken,
    user: null as unknown | null,
    agentRep: null as unknown | null,
    loading: Boolean(initialToken),
    error: null as string | null,
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      authApi.session(token)
        .then(data => {
          const session = normalizeSession(data);
          setState(s => ({ ...s, user: session.user, agentRep: session.agentRep, loading: false }));
        })
        .catch(() => { localStorage.removeItem('token'); setState(s => ({ ...s, token: null, loading: false })); });
    }
  }, []);

  const login = async (email: string, password: string, mfaCode?: string): Promise<boolean> => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await authApi.login(email, password, mfaCode);
      localStorage.setItem('token', data.token);
      setState({ token: data.token, user: data.user, agentRep: data.agentRep, loading: false, error: null });
      return true;
    } catch (err) {
      const message = err instanceof ApiError && err.code === 'MFA_REQUIRED'
        ? 'Authenticator code required'
        : err instanceof Error ? err.message : 'Login failed';
      setState(s => ({ ...s, loading: false, error: message }));
      return false;
    }
  };

  const logout = () => {
    const token = localStorage.getItem('token');
    if (token) void authApi.logout(token).catch(() => undefined);
    localStorage.removeItem('token');
    setState({ token: null, user: null, agentRep: null, loading: false, error: null });
  };

  return <AuthContext.Provider value={{ ...state, login, logout }}>{children}</AuthContext.Provider>;
}
