import { z } from 'zod';
import { router, orgProcedure, adminProcedure } from '../trpc';
import { coreValues } from '../../db/schema/operational';
import { eq, and } from 'drizzle-orm';

export const coreValuesRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(coreValues).where(eq(coreValues.organizationId, ctx.orgId));
  }),
  create: adminProcedure.input(z.object({ title: z.string().min(1), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [v] = await ctx.db.insert(coreValues).values({ ...input, organizationId: ctx.orgId }).returning();
      return v;
    }),
  delete: adminProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    await ctx.db.delete(coreValues).where(
      and(eq(coreValues.id, input.id), eq(coreValues.organizationId, ctx.orgId))
    );
    return { success: true };
  }),
});
