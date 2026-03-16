import { router, orgProcedure } from '../trpc';
import { profiles, departments, teams, agents, tasks, performanceReviews } from '../../db/schema/index';
import { eq, count, and } from 'drizzle-orm';

export const analyticsRouter = router({
  dashboard: orgProcedure.query(async ({ ctx }) => {
    const [employeeCount] = await ctx.db.select({ count: count() }).from(profiles).where(eq(profiles.organizationId, ctx.orgId));
    const [deptCount] = await ctx.db.select({ count: count() }).from(departments).where(eq(departments.organizationId, ctx.orgId));
    const [teamCount] = await ctx.db.select({ count: count() }).from(teams).where(eq(teams.organizationId, ctx.orgId));
    const [agentCount] = await ctx.db.select({ count: count() }).from(agents).where(eq(agents.organizationId, ctx.orgId));
    const [taskCount] = await ctx.db.select({ count: count() }).from(tasks).where(eq(tasks.organizationId, ctx.orgId));
    const [pendingReviews] = await ctx.db.select({ count: count() }).from(performanceReviews)
      .where(and(eq(performanceReviews.organizationId, ctx.orgId), eq(performanceReviews.status, 'draft')));

    return {
      employees: employeeCount.count,
      departments: deptCount.count,
      teams: teamCount.count,
      agents: agentCount.count,
      tasks: taskCount.count,
      pendingReviews: pendingReviews.count,
    };
  }),
});
