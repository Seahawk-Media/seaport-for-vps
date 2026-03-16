import { z } from 'zod';
import { router, orgProcedure, adminProcedure } from '../trpc';
import { measurables } from '../../db/schema/operational';
import { eq, and } from 'drizzle-orm';

export const measurablesRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(measurables).where(eq(measurables.organizationId, ctx.orgId));
  }),
  create: adminProcedure.input(z.object({
    name: z.string().min(1), description: z.string().optional(), targetValue: z.string().optional(),
    unit: z.string().optional(), ownerId: z.string().uuid().optional(), teamId: z.string().uuid().optional(),
    frequency: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const [m] = await ctx.db.insert(measurables).values({ ...input, organizationId: ctx.orgId, createdBy: ctx.profile.id }).returning();
    return m;
  }),
  update: orgProcedure.input(z.object({
    id: z.string().uuid(), currentValue: z.string().optional(), targetValue: z.string().optional(), name: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    const [m] = await ctx.db.update(measurables).set({ ...data, updatedAt: new Date() })
      .where(and(eq(measurables.id, id), eq(measurables.organizationId, ctx.orgId))).returning();
    return m;
  }),
  delete: adminProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    await ctx.db.delete(measurables).where(and(eq(measurables.id, input.id), eq(measurables.organizationId, ctx.orgId)));
    return { success: true };
  }),
});
