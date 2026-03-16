import { z } from 'zod';
import { router, orgProcedure, adminProcedure } from '../trpc';
import { courses, coursePages, courseProgress } from '../../db/schema/learning';
import { eq, and } from 'drizzle-orm';

export const academyRouter = router({
  listCourses: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(courses).where(eq(courses.organizationId, ctx.orgId));
  }),
  getCourse: orgProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    const [c] = await ctx.db.select().from(courses).where(and(eq(courses.id, input.id), eq(courses.organizationId, ctx.orgId)));
    return c;
  }),
  createCourse: adminProcedure.input(z.object({ title: z.string().min(1), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [c] = await ctx.db.insert(courses).values({ ...input, organizationId: ctx.orgId, createdBy: ctx.user.id }).returning();
      return c;
    }),
  updateCourse: adminProcedure.input(z.object({ id: z.string().uuid(), title: z.string().optional(), description: z.string().optional(), status: z.enum(['draft', 'published', 'archived']).optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [c] = await ctx.db.update(courses).set({ ...data, updatedAt: new Date() }).where(and(eq(courses.id, id), eq(courses.organizationId, ctx.orgId))).returning();
      return c;
    }),

  // Pages
  listPages: orgProcedure.input(z.object({ courseId: z.string().uuid() })).query(async ({ ctx, input }) => {
    return ctx.db.select().from(coursePages).where(eq(coursePages.courseId, input.courseId));
  }),
  createPage: adminProcedure.input(z.object({ courseId: z.string().uuid(), title: z.string(), content: z.string().optional(), pageOrder: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [p] = await ctx.db.insert(coursePages).values({ ...input, organizationId: ctx.orgId }).returning();
      return p;
    }),

  // Progress
  getProgress: orgProcedure.input(z.object({ courseId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const [p] = await ctx.db.select().from(courseProgress)
      .where(and(eq(courseProgress.courseId, input.courseId), eq(courseProgress.profileId, ctx.profile.id)));
    return p;
  }),
  updateProgress: orgProcedure.input(z.object({ courseId: z.string().uuid(), currentPageOrder: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select().from(courseProgress)
        .where(and(eq(courseProgress.courseId, input.courseId), eq(courseProgress.profileId, ctx.profile.id)));
      if (existing) {
        const [p] = await ctx.db.update(courseProgress).set({ currentPageOrder: input.currentPageOrder, updatedAt: new Date() })
          .where(eq(courseProgress.id, existing.id)).returning();
        return p;
      }
      const [p] = await ctx.db.insert(courseProgress).values({
        courseId: input.courseId, profileId: ctx.profile.id, organizationId: ctx.orgId,
        currentPageOrder: input.currentPageOrder, startedAt: new Date(),
      }).returning();
      return p;
    }),
});
