import { checkCloseoutPermission } from './policy';
import * as repo from './repository';
import type { CloseoutReport } from './types';

export async function getCloseoutReport(role: string, tenantKey: string, eventId: string): Promise<CloseoutReport> {
  checkCloseoutPermission(role);
  return repo.generateCloseoutReport(tenantKey, eventId);
}
