import { z } from 'zod';
import { router, adminProcedure, orgProcedure } from '../trpc';
import { agentIdentity, agentMemories } from '../../db/schema/agents';
import { eq, and, desc } from 'drizzle-orm';

export const agentIdentityRouter = router({
  // ─── SOUL.md (Identity) ───────────────────────────────────────

  getIdentity: orgProcedure
    .input(z.object({ agentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [identity] = await ctx.db
        .select()
        .from(agentIdentity)
        .where(eq(agentIdentity.agentId, input.agentId))
        .limit(1);
      return identity ?? null;
    }),

  upsertIdentity: adminProcedure
    .input(z.object({
      agentId: z.string().uuid(),
      personality: z.string().optional(),
      communicationStyle: z.string().optional(),
      values: z.string().optional(),
      guardrails: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { agentId, ...data } = input;
      const [existing] = await ctx.db
        .select()
        .from(agentIdentity)
        .where(eq(agentIdentity.agentId, agentId))
        .limit(1);

      if (existing) {
        const [updated] = await ctx.db
          .update(agentIdentity)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(agentIdentity.id, existing.id))
          .returning();
        return updated;
      }

      const [created] = await ctx.db
        .insert(agentIdentity)
        .values({ agentId, ...data })
        .returning();
      return created;
    }),

  // ─── Memory ───────────────────────────────────────────────────

  listMemories: orgProcedure
    .input(z.object({
      agentId: z.string().uuid(),
      category: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(agentMemories.agentId, input.agentId)];
      if (input.category) {
        conditions.push(eq(agentMemories.category, input.category));
      }
      return ctx.db
        .select()
        .from(agentMemories)
        .where(and(...conditions))
        .orderBy(desc(agentMemories.createdAt))
        .limit(input.limit);
    }),

  addMemory: adminProcedure
    .input(z.object({
      agentId: z.string().uuid(),
      content: z.string().min(1),
      category: z.string().default('general'),
      source: z.string().default('manual'),
    }))
    .mutation(async ({ ctx, input }) => {
      const [mem] = await ctx.db
        .insert(agentMemories)
        .values({
          agentId: input.agentId,
          organizationId: ctx.orgId,
          content: input.content,
          category: input.category,
          source: input.source,
        })
        .returning();
      return mem;
    }),

  deleteMemory: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(agentMemories)
        .where(
          and(
            eq(agentMemories.id, input.id),
            eq(agentMemories.organizationId, ctx.orgId),
          ),
        );
      return { success: true };
    }),
});
