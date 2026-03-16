import { z } from 'zod';
import { router, orgProcedure, adminProcedure } from '../trpc';
import { sops } from '../../db/schema/operational';
import { eq, and } from 'drizzle-orm';

export const sopsRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(sops).where(eq(sops.organizationId, ctx.orgId));
  }),
  create: adminProcedure.input(z.object({
    title: z.string().min(1), content: z.string().optional(), category: z.string().optional(),
    departmentId: z.string().uuid().optional(), teamId: z.string().uuid().optional(),
  })).mutation(async ({ ctx, input }) => {
    const [s] = await ctx.db.insert(sops).values({ ...input, organizationId: ctx.orgId, createdBy: ctx.user.id }).returning();
    return s;
  }),
  update: adminProcedure.input(z.object({
    id: z.string().uuid(), title: z.string().optional(), content: z.string().optional(),
    category: z.string().optional(), status: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    const [s] = await ctx.db.update(sops).set({ ...data, updatedAt: new Date() })
      .where(and(eq(sops.id, id), eq(sops.organizationId, ctx.orgId))).returning();
    return s;
  }),
  delete: adminProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    await ctx.db.delete(sops).where(and(eq(sops.id, input.id), eq(sops.organizationId, ctx.orgId)));
    return { success: true };
  }),
});
