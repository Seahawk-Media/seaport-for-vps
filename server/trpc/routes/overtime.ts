import { z } from 'zod';
import { router, orgProcedure, adminProcedure } from '../trpc';
import { overtimeEntries } from '../../db/schema/hr';
import { eq, and } from 'drizzle-orm';

export const overtimeRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(overtimeEntries).where(eq(overtimeEntries.organizationId, ctx.orgId));
  }),
  create: orgProcedure.input(z.object({
    date: z.string(), hours: z.string(), description: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const [e] = await ctx.db.insert(overtimeEntries).values({ ...input, profileId: ctx.profile.id, organizationId: ctx.orgId }).returning();
    return e;
  }),
  review: adminProcedure.input(z.object({ id: z.string().uuid(), status: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [e] = await ctx.db.update(overtimeEntries).set({ status: input.status, approvedBy: ctx.user.id })
        .where(and(eq(overtimeEntries.id, input.id), eq(overtimeEntries.organizationId, ctx.orgId))).returning();
      return e;
    }),
});
