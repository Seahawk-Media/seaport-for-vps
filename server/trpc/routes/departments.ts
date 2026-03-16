import { z } from 'zod';
import { router, orgProcedure, adminProcedure } from '../trpc';
import { departments } from '../../db/schema/index';
import { eq, and } from 'drizzle-orm';

export const departmentsRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(departments).where(eq(departments.organizationId, ctx.orgId));
  }),

  get: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [dept] = await ctx.db.select().from(departments)
        .where(and(eq(departments.id, input.id), eq(departments.organizationId, ctx.orgId)));
      return dept;
    }),

  create: adminProcedure
    .input(z.object({ name: z.string().min(1), description: z.string().optional(), parentId: z.string().uuid().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [dept] = await ctx.db.insert(departments).values({ ...input, organizationId: ctx.orgId }).returning();
      return dept;
    }),

  update: adminProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().optional(), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [dept] = await ctx.db.update(departments).set({ ...data, updatedAt: new Date() })
        .where(and(eq(departments.id, id), eq(departments.organizationId, ctx.orgId))).returning();
      return dept;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(departments).where(and(eq(departments.id, input.id), eq(departments.organizationId, ctx.orgId)));
      return { success: true };
    }),
});
