import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { AuthContext } from './AuthContext';
import { authApi } from '../api';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({
    token: localStorage.getItem('token'),
    user: null as unknown | null,
    agentRep: null as unknown | null,
    loading: true,
    error: null as string | null,
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      authApi.session(token)
        .then(data => setState(s => ({ ...s, user: data.user, agentRep: data.agentRep, loading: false })))
        .catch(() => { localStorage.removeItem('token'); setState(s => ({ ...s, token: null, loading: false })); });
    } else {
      setState(s => ({ ...s, loading: false }));
    }
  }, []);

  const login = async (email: string, password: string) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await authApi.login(email, password);
      localStorage.setItem('token', data.token);
      setState({ token: data.token, user: data.user, agentRep: data.agentRep, loading: false, error: null });
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: err instanceof Error ? err.message : 'Login failed' }));
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setState({ token: null, user: null, agentRep: null, loading: false, error: null });
  };

  return <AuthContext.Provider value={{ ...state, login, logout }}>{children}</AuthContext.Provider>;
}
