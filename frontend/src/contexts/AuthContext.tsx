import { createContext } from 'react';

interface AuthState {
  token: string | null;
  user: unknown | null;
  agentRep: unknown | null;
  loading: boolean;
  error: string | null;
  mfaEnrollmentRequired: boolean;
  mfaChallengeRequired: boolean;
}

export interface AuthContextType extends AuthState {
  login: (email: string, password: string, mfaCode?: string) => Promise<boolean>;
  logout: () => void;
  completeMfaEnrollment: (replacementToken: string) => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);
