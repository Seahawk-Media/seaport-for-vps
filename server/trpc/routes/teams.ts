import { z } from 'zod';
import { router, orgProcedure, adminProcedure } from '../trpc';
import { teams } from '../../db/schema/index';
import { eq, and } from 'drizzle-orm';

export const teamsRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(teams).where(eq(teams.organizationId, ctx.orgId));
  }),

  get: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [team] = await ctx.db.select().from(teams)
        .where(and(eq(teams.id, input.id), eq(teams.organizationId, ctx.orgId)));
      return team;
    }),

  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      departmentId: z.string().uuid().optional(),
      teamType: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [team] = await ctx.db.insert(teams).values({ ...input, organizationId: ctx.orgId }).returning();
      return team;
    }),

  update: adminProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().optional(), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [team] = await ctx.db.update(teams).set({ ...data, updatedAt: new Date() })
        .where(and(eq(teams.id, id), eq(teams.organizationId, ctx.orgId))).returning();
      return team;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(teams).where(and(eq(teams.id, input.id), eq(teams.organizationId, ctx.orgId)));
      return { success: true };
    }),
});
