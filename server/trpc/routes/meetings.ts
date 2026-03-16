import { z } from 'zod';
import { router, orgProcedure, adminProcedure } from '../trpc';
import { meetings } from '../../db/schema/operational';
import { eq, and } from 'drizzle-orm';

export const meetingsRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(meetings).where(eq(meetings.organizationId, ctx.orgId));
  }),
  create: orgProcedure.input(z.object({
    title: z.string().min(1), description: z.string().optional(), meetingUrl: z.string().optional(),
    recurrence: z.string().optional(), scheduledAt: z.string().optional(), durationMinutes: z.number().optional(),
    departmentId: z.string().uuid().optional(), teamId: z.string().uuid().optional(),
  })).mutation(async ({ ctx, input }) => {
    const [m] = await ctx.db.insert(meetings).values({ ...input, organizationId: ctx.orgId, createdBy: ctx.user.id }).returning();
    return m;
  }),
  update: orgProcedure.input(z.object({
    id: z.string().uuid(), title: z.string().optional(), description: z.string().optional(),
    scheduledAt: z.string().optional(), durationMinutes: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    const [m] = await ctx.db.update(meetings).set({ ...data, updatedAt: new Date() })
      .where(and(eq(meetings.id, id), eq(meetings.organizationId, ctx.orgId))).returning();
    return m;
  }),
  delete: orgProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    await ctx.db.delete(meetings).where(and(eq(meetings.id, input.id), eq(meetings.organizationId, ctx.orgId)));
    return { success: true };
  }),
});
