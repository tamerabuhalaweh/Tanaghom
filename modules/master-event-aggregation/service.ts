import { checkMasterAggregationPermission } from './policy';
import { validateOrThrow } from '@shared/validation';
import { MASTER_DASHBOARD_FILTER_SCHEMA } from './types';
import * as repo from './repository';
import type { MasterDashboardSummary, MasterDashboardFilters } from './types';

export async function getMasterDashboard(
  role: string,
  tenantKey: string,
  rawFilters: unknown,
): Promise<MasterDashboardSummary> {
  checkMasterAggregationPermission(role);
  const filters: MasterDashboardFilters = validateOrThrow(MASTER_DASHBOARD_FILTER_SCHEMA, rawFilters);
  return repo.getMasterDashboard(tenantKey, filters);
}
