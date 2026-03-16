import { z } from 'zod';
import { router, orgProcedure, adminProcedure } from '../trpc';
import { performanceReviews, reviewTemplates } from '../../db/schema/hr';
import { eq, and } from 'drizzle-orm';

export const reviewsRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(performanceReviews).where(eq(performanceReviews.organizationId, ctx.orgId));
  }),
  get: orgProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    const [r] = await ctx.db.select().from(performanceReviews)
      .where(and(eq(performanceReviews.id, input.id), eq(performanceReviews.organizationId, ctx.orgId)));
    return r;
  }),
  create: adminProcedure.input(z.object({
    employeeId: z.string().uuid(), reviewerId: z.string().uuid(), templateId: z.string().uuid().optional(),
    reviewPeriodStart: z.string().optional(), reviewPeriodEnd: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const [r] = await ctx.db.insert(performanceReviews).values({ ...input, organizationId: ctx.orgId }).returning();
    return r;
  }),
  update: orgProcedure.input(z.object({
    id: z.string().uuid(), status: z.string().optional(), overallRating: z.string().optional(),
    strengths: z.string().optional(), areasForImprovement: z.string().optional(), goals: z.string().optional(),
    employeeComments: z.string().optional(), reviewerComments: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    const [r] = await ctx.db.update(performanceReviews).set({ ...data, updatedAt: new Date() })
      .where(and(eq(performanceReviews.id, id), eq(performanceReviews.organizationId, ctx.orgId))).returning();
    return r;
  }),

  // Templates
  listTemplates: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(reviewTemplates).where(eq(reviewTemplates.organizationId, ctx.orgId));
  }),
  createTemplate: adminProcedure.input(z.object({
    name: z.string().min(1), description: z.string().optional(), criteria: z.record(z.string(), z.number()).optional(),
  })).mutation(async ({ ctx, input }) => {
    const [t] = await ctx.db.insert(reviewTemplates).values({ ...input, organizationId: ctx.orgId, createdBy: ctx.user.id }).returning();
    return t;
  }),
});
