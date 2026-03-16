import { z } from 'zod';
import { router, orgProcedure, adminProcedure } from '../trpc';
import { incentives, incentiveTypes } from '../../db/schema/operational';
import { eq, and } from 'drizzle-orm';

export const incentivesRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(incentives).where(eq(incentives.organizationId, ctx.orgId));
  }),
  create: orgProcedure.input(z.object({
    title: z.string().min(1), description: z.string().optional(), incentiveType: z.string().optional(),
    evidenceUrl: z.string().optional(), points: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const [i] = await ctx.db.insert(incentives).values({ ...input, profileId: ctx.profile.id, organizationId: ctx.orgId }).returning();
    return i;
  }),
  review: adminProcedure.input(z.object({ id: z.string().uuid(), status: z.string() })).mutation(async ({ ctx, input }) => {
    const [i] = await ctx.db.update(incentives).set({ status: input.status, reviewedBy: ctx.profile.id, reviewedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(incentives.id, input.id), eq(incentives.organizationId, ctx.orgId))).returning();
    return i;
  }),

  // Types
  listTypes: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(incentiveTypes).where(eq(incentiveTypes.organizationId, ctx.orgId));
  }),
  createType: adminProcedure.input(z.object({ name: z.string().min(1), description: z.string().optional(), defaultPoints: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [t] = await ctx.db.insert(incentiveTypes).values({ ...input, organizationId: ctx.orgId }).returning();
      return t;
    }),
});
