import { z } from 'zod';
import { router, orgProcedure, adminProcedure } from '../trpc';
import { tasks } from '../../db/schema/operational';
import { eq, and } from 'drizzle-orm';

export const tasksRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(tasks).where(eq(tasks.organizationId, ctx.orgId));
  }),
  create: orgProcedure.input(z.object({
    title: z.string().min(1), description: z.string().optional(), priority: z.string().optional(),
    dueDate: z.string().optional(), assignedTo: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(), teamId: z.string().uuid().optional(),
  })).mutation(async ({ ctx, input }) => {
    const [t] = await ctx.db.insert(tasks).values({ ...input, organizationId: ctx.orgId, createdBy: ctx.user.id }).returning();
    return t;
  }),
  update: orgProcedure.input(z.object({
    id: z.string().uuid(), title: z.string().optional(), status: z.string().optional(), priority: z.string().optional(),
    description: z.string().optional(), dueDate: z.string().optional(), assignedTo: z.string().uuid().optional(),
  })).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    const [t] = await ctx.db.update(tasks).set({ ...data, updatedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.organizationId, ctx.orgId))).returning();
    return t;
  }),
  delete: orgProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    await ctx.db.delete(tasks).where(and(eq(tasks.id, input.id), eq(tasks.organizationId, ctx.orgId)));
    return { success: true };
  }),
});
