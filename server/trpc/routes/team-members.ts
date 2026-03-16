import { z } from 'zod';
import { router, orgProcedure, adminProcedure } from '../trpc';
import { teamMembers } from '../../db/schema/index';
import { eq, and } from 'drizzle-orm';

export const teamMembersRouter = router({
  list: orgProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.select().from(teamMembers)
        .where(and(eq(teamMembers.teamId, input.teamId), eq(teamMembers.organizationId, ctx.orgId)));
    }),

  add: adminProcedure
    .input(z.object({ teamId: z.string().uuid(), profileId: z.string().uuid(), role: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [member] = await ctx.db.insert(teamMembers)
        .values({ ...input, organizationId: ctx.orgId }).returning();
      return member;
    }),

  remove: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(teamMembers)
        .where(and(eq(teamMembers.id, input.id), eq(teamMembers.organizationId, ctx.orgId)));
      return { success: true };
    }),
});
