import { z } from 'zod';
import { router, orgProcedure, adminProcedure } from '../trpc';
import { positionRoles, positionChanges } from '../../db/schema/index';
import { eq, and } from 'drizzle-orm';

export const positionsRouter = router({
  listRoles: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(positionRoles).where(eq(positionRoles.organizationId, ctx.orgId));
  }),

  createRole: adminProcedure
    .input(z.object({ title: z.string().min(1), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [role] = await ctx.db.insert(positionRoles).values({ ...input, organizationId: ctx.orgId }).returning();
      return role;
    }),

  listChanges: orgProcedure
    .input(z.object({ profileId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      if (input?.profileId) {
        return ctx.db.select().from(positionChanges)
          .where(and(eq(positionChanges.profileId, input.profileId), eq(positionChanges.organizationId, ctx.orgId)));
      }
      return ctx.db.select().from(positionChanges).where(eq(positionChanges.organizationId, ctx.orgId));
    }),

  createChange: adminProcedure
    .input(z.object({
      profileId: z.string().uuid(),
      previousPositionId: z.string().uuid().optional(),
      newPositionId: z.string().uuid().optional(),
      previousDepartmentId: z.string().uuid().optional(),
      newDepartmentId: z.string().uuid().optional(),
      effectiveDate: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [change] = await ctx.db.insert(positionChanges)
        .values({ ...input, organizationId: ctx.orgId, approvedBy: ctx.user.id }).returning();
      return change;
    }),
});
