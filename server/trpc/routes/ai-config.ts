import { z } from 'zod';
import { router, adminProcedure, orgProcedure } from '../trpc';
import { orgAiConfig } from '../../db/schema/agents';
import { eq, and } from 'drizzle-orm';

export const aiConfigRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(orgAiConfig).where(eq(orgAiConfig.organizationId, ctx.orgId));
  }),

  upsert: adminProcedure
    .input(z.object({
      provider: z.string().min(1),
      apiKeyHint: z.string().optional(),
      isEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select().from(orgAiConfig)
        .where(and(eq(orgAiConfig.organizationId, ctx.orgId), eq(orgAiConfig.provider, input.provider)));

      if (existing) {
        const [c] = await ctx.db.update(orgAiConfig)
          .set({ apiKeyHint: input.apiKeyHint, isEnabled: input.isEnabled, updatedAt: new Date() })
          .where(eq(orgAiConfig.id, existing.id)).returning();
        return c;
      }

      const [c] = await ctx.db.insert(orgAiConfig)
        .values({ ...input, organizationId: ctx.orgId }).returning();
      return c;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(orgAiConfig)
        .where(and(eq(orgAiConfig.id, input.id), eq(orgAiConfig.organizationId, ctx.orgId)));
      return { success: true };
    }),
});
