import { z } from 'zod';
import { router, orgProcedure, adminProcedure } from '../trpc';
import { agents } from '../../db/schema/agents';
import { eq, and } from 'drizzle-orm';

export const agentsRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(agents).where(eq(agents.organizationId, ctx.orgId));
  }),

  get: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [agent] = await ctx.db.select().from(agents)
        .where(and(eq(agents.id, input.id), eq(agents.organizationId, ctx.orgId)));
      return agent;
    }),

  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      type: z.string().optional(),
      tier: z.enum(['general', 'departmental', 'functional']).default('functional'),
      departmentId: z.string().uuid().optional(),
      teamId: z.string().uuid().optional(),
      systemPrompt: z.string().optional(),
      aiProvider: z.string().optional(),
      aiModel: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [agent] = await ctx.db.insert(agents)
        .values({ ...input, organizationId: ctx.orgId, createdBy: ctx.user.id }).returning();
      return agent;
    }),

  update: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().optional(),
      description: z.string().optional(),
      systemPrompt: z.string().optional(),
      aiProvider: z.string().optional(),
      aiModel: z.string().optional(),
      status: z.string().optional(),
      alwaysOn: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [agent] = await ctx.db.update(agents).set({ ...data, updatedAt: new Date() })
        .where(and(eq(agents.id, id), eq(agents.organizationId, ctx.orgId))).returning();
      return agent;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(agents).where(and(eq(agents.id, input.id), eq(agents.organizationId, ctx.orgId)));
      return { success: true };
    }),
});
