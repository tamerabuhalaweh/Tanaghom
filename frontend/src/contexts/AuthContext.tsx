import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '../api';

interface AuthState {
  token: string | null;
  user: unknown | null;
  agentRep: unknown | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: localStorage.getItem('token'),
    user: null,
    agentRep: null,
    loading: true,
    error: null,
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

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
