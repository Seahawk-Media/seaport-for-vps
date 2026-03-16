import { z } from 'zod';
import { router, orgProcedure, adminProcedure } from '../trpc';
import { promotions } from '../../db/schema/hr';
import { eq, and } from 'drizzle-orm';

export const promotionsRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(promotions).where(eq(promotions.organizationId, ctx.orgId));
  }),
  get: orgProcedure.input(z.object({ profileId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const [p] = await ctx.db.select().from(promotions)
      .where(and(eq(promotions.profileId, input.profileId), eq(promotions.organizationId, ctx.orgId)));
    return p;
  }),
  upsert: adminProcedure.input(z.object({
    profileId: z.string().uuid(), roleTitle: z.string().optional(), salaryBand: z.string().optional(),
    nextReviewDate: z.string().optional(), lastReviewDate: z.string().optional(), notes: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const [existing] = await ctx.db.select().from(promotions)
      .where(and(eq(promotions.profileId, input.profileId), eq(promotions.organizationId, ctx.orgId)));
    if (existing) {
      const { profileId, ...data } = input;
      const [p] = await ctx.db.update(promotions).set({ ...data, updatedAt: new Date() })
        .where(eq(promotions.id, existing.id)).returning();
      return p;
    }
    const [p] = await ctx.db.insert(promotions).values({ ...input, organizationId: ctx.orgId }).returning();
    return p;
  }),
});
