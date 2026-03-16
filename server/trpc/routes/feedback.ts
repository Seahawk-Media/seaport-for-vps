import { z } from 'zod';
import { router, orgProcedure, adminProcedure } from '../trpc';
import { feedback } from '../../db/schema/operational';
import { eq, and } from 'drizzle-orm';

export const feedbackRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(feedback).where(eq(feedback.organizationId, ctx.orgId));
  }),
  create: orgProcedure.input(z.object({
    title: z.string().min(1), description: z.string().optional(), priority: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const [f] = await ctx.db.insert(feedback).values({ ...input, profileId: ctx.profile.id, organizationId: ctx.orgId }).returning();
    return f;
  }),
  update: adminProcedure.input(z.object({
    id: z.string().uuid(), status: z.string().optional(), adminNotes: z.string().optional(), targetQuarter: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    const [f] = await ctx.db.update(feedback).set({ ...data, updatedAt: new Date() })
      .where(and(eq(feedback.id, id), eq(feedback.organizationId, ctx.orgId))).returning();
    return f;
  }),
});
