import { z } from 'zod';
import { router, orgProcedure, adminProcedure } from '../trpc';
import { holidays } from '../../db/schema/operational';
import { eq, and } from 'drizzle-orm';

export const calendarRouter = router({
  listHolidays: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(holidays).where(eq(holidays.organizationId, ctx.orgId));
  }),
  createHoliday: adminProcedure.input(z.object({
    name: z.string().min(1), date: z.string(), description: z.string().optional(),
    country: z.string().optional(), isRecurring: z.boolean().optional(),
  })).mutation(async ({ ctx, input }) => {
    const [h] = await ctx.db.insert(holidays).values({ ...input, organizationId: ctx.orgId, createdBy: ctx.user.id }).returning();
    return h;
  }),
  deleteHoliday: adminProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    await ctx.db.delete(holidays).where(and(eq(holidays.id, input.id), eq(holidays.organizationId, ctx.orgId)));
    return { success: true };
  }),
});
