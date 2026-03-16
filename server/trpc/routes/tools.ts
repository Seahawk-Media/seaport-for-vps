import { z } from 'zod';
import { router, orgProcedure, adminProcedure } from '../trpc';
import { tools } from '../../db/schema/operational';
import { eq, and } from 'drizzle-orm';

export const toolsRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(tools).where(eq(tools.organizationId, ctx.orgId));
  }),
  create: adminProcedure.input(z.object({
    name: z.string().min(1), description: z.string().optional(), url: z.string().optional(), icon: z.string().optional(),
    departmentId: z.string().uuid().optional(), teamId: z.string().uuid().optional(),
  })).mutation(async ({ ctx, input }) => {
    const [t] = await ctx.db.insert(tools).values({ ...input, organizationId: ctx.orgId, createdBy: ctx.user.id }).returning();
    return t;
  }),
  update: adminProcedure.input(z.object({ id: z.string().uuid(), name: z.string().optional(), description: z.string().optional(), url: z.string().optional(), icon: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [t] = await ctx.db.update(tools).set({ ...data, updatedAt: new Date() }).where(and(eq(tools.id, id), eq(tools.organizationId, ctx.orgId))).returning();
      return t;
    }),
  delete: adminProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    await ctx.db.delete(tools).where(and(eq(tools.id, input.id), eq(tools.organizationId, ctx.orgId)));
    return { success: true };
  }),
});
