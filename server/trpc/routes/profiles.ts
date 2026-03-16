import { z } from 'zod';
import { router, orgProcedure, protectedProcedure } from '../trpc';
import { profiles } from '../../db/schema/index';
import { eq, and } from 'drizzle-orm';

export const profilesRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(profiles).where(eq(profiles.organizationId, ctx.orgId));
  }),

  get: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [profile] = await ctx.db.select().from(profiles)
        .where(and(eq(profiles.id, input.id), eq(profiles.organizationId, ctx.orgId)));
      return profile;
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.profile) return null;
    return ctx.profile;
  }),

  update: protectedProcedure
    .input(z.object({
      fullName: z.string().optional(),
      phone: z.string().optional(),
      location: z.string().optional(),
      avatarUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.profile) throw new Error('No profile found');
      const [updated] = await ctx.db.update(profiles)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(profiles.id, ctx.profile.id)).returning();
      return updated;
    }),
});
