export const AUTH_EVENTS = {
  USER_AUTHENTICATED: 'user.authenticated',
  USER_LOGIN_FAILED: 'user.login_failed',
  USER_SESSION_EXPIRED: 'user.session_expired',
} as const;

export interface UserAuthenticatedEvent {
  userId: string;
  email: string;
  role: string;
  timestamp: Date;
}

export interface UserLoginFailedEvent {
  email: string;
  reason: string;
  timestamp: Date;
}
