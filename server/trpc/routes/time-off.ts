import { z } from 'zod';
import { router, orgProcedure, adminProcedure } from '../trpc';
import { timeOffRequests, timeOffBalances, timeOffTypes } from '../../db/schema/hr';
import { eq, and } from 'drizzle-orm';

export const timeOffRouter = router({
  listRequests: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(timeOffRequests).where(eq(timeOffRequests.organizationId, ctx.orgId));
  }),
  createRequest: orgProcedure.input(z.object({
    requestType: z.string(), startDate: z.string(), endDate: z.string(),
    totalDays: z.string().optional(), reason: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const [r] = await ctx.db.insert(timeOffRequests).values({ ...input, profileId: ctx.profile.id, organizationId: ctx.orgId }).returning();
    return r;
  }),
  reviewRequest: adminProcedure.input(z.object({ id: z.string().uuid(), status: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [r] = await ctx.db.update(timeOffRequests)
        .set({ status: input.status, reviewedBy: ctx.user.id, reviewedAt: new Date() })
        .where(and(eq(timeOffRequests.id, input.id), eq(timeOffRequests.organizationId, ctx.orgId))).returning();
      return r;
    }),

  // Balances
  listBalances: orgProcedure.input(z.object({ profileId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      if (input?.profileId) {
        return ctx.db.select().from(timeOffBalances)
          .where(and(eq(timeOffBalances.profileId, input.profileId), eq(timeOffBalances.organizationId, ctx.orgId)));
      }
      return ctx.db.select().from(timeOffBalances).where(eq(timeOffBalances.organizationId, ctx.orgId));
    }),

  // Types
  listTypes: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(timeOffTypes).where(eq(timeOffTypes.organizationId, ctx.orgId));
  }),
  createType: adminProcedure.input(z.object({ name: z.string().min(1), description: z.string().optional(), defaultDaysPerYear: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [t] = await ctx.db.insert(timeOffTypes).values({ ...input, organizationId: ctx.orgId }).returning();
      return t;
    }),
});
