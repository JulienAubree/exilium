import { router } from '../../trpc/router.js';
import type { DashboardService } from './dashboard.service.js';
import type { createAdminProcedure } from '../../trpc/router.js';

export function createDashboardRouter(
  dashboardService: DashboardService,
  adminProcedure: ReturnType<typeof createAdminProcedure>,
) {
  return router({
    stats: adminProcedure.query(async () => dashboardService.getStats()),
    recentErrors: adminProcedure.query(async () => dashboardService.getRecentErrors()),
  });
}
