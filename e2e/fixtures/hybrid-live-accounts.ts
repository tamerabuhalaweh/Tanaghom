export const hybridLiveEnabled =
  process.env.E2E_HYBRID_LIVE === 'true' || process.env.E2E_ACCEPTANCE === 'true';

export const hybridLiveAccounts = {
  manager: {
    email: process.env.E2E_MANAGER_EMAIL || 'brand.head@tanaghum.com',
    password: process.env.E2E_MANAGER_PASSWORD || 'password123',
    expectedRole: /department head/i,
  },
  specialist: {
    email: process.env.E2E_SPECIALIST_EMAIL || 'demand.specialist@tanaghum.com',
    password: process.env.E2E_SPECIALIST_PASSWORD || 'password123',
    expectedRole: /specialist/i,
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || 'admin@tanaghum.com',
    password: process.env.E2E_ADMIN_PASSWORD || 'password123',
    expectedRole: /admin/i,
  },
} as const;

export type HybridLiveAccount = typeof hybridLiveAccounts[keyof typeof hybridLiveAccounts];
