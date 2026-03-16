import { z } from 'zod';
import { router, orgProcedure, adminProcedure } from '../trpc';
import { organizations } from '../../db/schema/index';
import { eq } from 'drizzle-orm';

export const orgRouter = router({
  get: orgProcedure.query(async ({ ctx }) => {
    const [org] = await ctx.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, ctx.orgId))
      .limit(1);
    return org;
  }),

  update: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).optional(),
        primaryColor: z.string().optional(),
        accentColor: z.string().optional(),
        logoUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(organizations)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(organizations.id, ctx.orgId))
        .returning();
      return updated;
    }),
});
