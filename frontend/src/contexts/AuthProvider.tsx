import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { AuthContext } from './AuthContext';
import { ApiError, authApi } from '../api';

type SessionEnvelope = {
  user?: unknown;
  agentRep?: unknown;
  mfaEnrollmentRequired?: boolean;
};

function normalizeSession(data: unknown): SessionEnvelope {
  if (data && typeof data === 'object' && 'user' in data) {
    return data as SessionEnvelope;
  }
  const record = data && typeof data === 'object' ? data as Record<string, unknown> : null;
  return {
    user: data,
    agentRep: record && 'agentRepId' in record ? { id: record.agentRepId } : null,
    mfaEnrollmentRequired: record?.mfaEnrollmentRequired === true,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialToken = localStorage.getItem('token');
  const [state, setState] = useState({
    token: initialToken,
    user: null as unknown | null,
    agentRep: null as unknown | null,
    loading: Boolean(initialToken),
    error: null as string | null,
    mfaEnrollmentRequired: false,
    mfaChallengeRequired: false,
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      authApi.session(token)
        .then(data => {
          const session = normalizeSession(data);
          setState(s => ({
            ...s,
            user: session.user,
            agentRep: session.agentRep,
            loading: false,
            mfaEnrollmentRequired: session.mfaEnrollmentRequired === true,
          }));
        })
        .catch(() => { localStorage.removeItem('token'); setState(s => ({ ...s, token: null, loading: false })); });
    }
  }, []);

  const login = async (email: string, password: string, mfaCode?: string): Promise<boolean> => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await authApi.login(email, password, mfaCode);
      localStorage.setItem('token', data.token);
      setState({
        token: data.token,
        user: data.user,
        agentRep: data.agentRep,
        loading: false,
        error: null,
        mfaEnrollmentRequired: data.mfaEnrollmentRequired === true,
        mfaChallengeRequired: false,
      });
      return true;
    } catch (err) {
      const requiresMfa = err instanceof ApiError && err.code === 'MFA_REQUIRED';
      const message = requiresMfa
        ? 'Authenticator or recovery code required'
        : err instanceof Error ? err.message : 'Login failed';
      setState(s => ({
        ...s,
        loading: false,
        error: message,
        mfaChallengeRequired: requiresMfa || s.mfaChallengeRequired,
      }));
      return false;
    }
  };

  const logout = () => {
    const token = localStorage.getItem('token');
    if (token) void authApi.logout(token).catch(() => undefined);
    localStorage.removeItem('token');
    setState({
      token: null,
      user: null,
      agentRep: null,
      loading: false,
      error: null,
      mfaEnrollmentRequired: false,
      mfaChallengeRequired: false,
    });
  };

  const completeMfaEnrollment = (replacementToken: string) => {
    localStorage.setItem('token', replacementToken);
    setState(s => ({
      ...s,
      token: replacementToken,
      mfaEnrollmentRequired: false,
      mfaChallengeRequired: false,
      error: null,
    }));
  };

  return <AuthContext.Provider value={{ ...state, login, logout, completeMfaEnrollment }}>{children}</AuthContext.Provider>;
}
