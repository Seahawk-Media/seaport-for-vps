import { z } from 'zod';
import { router, orgProcedure } from '../trpc';
import { activityLogs } from '../../db/schema/operational';
import { eq, desc } from 'drizzle-orm';

export const activityRouter = router({
  list: orgProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.select().from(activityLogs)
        .where(eq(activityLogs.organizationId, ctx.orgId))
        .orderBy(desc(activityLogs.createdAt))
        .limit(input?.limit ?? 50);
    }),

  create: orgProcedure
    .input(z.object({
      activityType: z.string(), description: z.string(),
      metadata: z.record(z.string(), z.unknown()).optional(), pagePath: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [log] = await ctx.db.insert(activityLogs)
        .values({ ...input, profileId: ctx.profile.id, organizationId: ctx.orgId }).returning();
      return log;
    }),
});
