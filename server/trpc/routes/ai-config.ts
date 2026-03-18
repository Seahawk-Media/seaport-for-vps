import { z } from 'zod';
import { router, adminProcedure, orgProcedure } from '../trpc';
import { orgAiConfig } from '../../db/schema/agents';
import { eq, and } from 'drizzle-orm';
import { encrypt } from '../../lib/crypto';

export const aiConfigRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(orgAiConfig).where(eq(orgAiConfig.organizationId, ctx.orgId));
  }),

  upsert: adminProcedure
    .input(z.object({
      provider: z.string().min(1),
      apiKey: z.string().optional(),
      apiKeyHint: z.string().optional(),
      isEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select().from(orgAiConfig)
        .where(and(eq(orgAiConfig.organizationId, ctx.orgId), eq(orgAiConfig.provider, input.provider)));

      const apiKeyEncrypted = input.apiKey ? encrypt(input.apiKey) : undefined;
      const apiKeyHint = input.apiKey ? input.apiKey.slice(-4) : input.apiKeyHint;

      if (existing) {
        const [c] = await ctx.db.update(orgAiConfig)
          .set({
            ...(apiKeyEncrypted ? { apiKeyEncrypted } : {}),
            apiKeyHint,
            isEnabled: input.isEnabled,
            updatedAt: new Date(),
          })
          .where(eq(orgAiConfig.id, existing.id)).returning();
        return c;
      }

      const [c] = await ctx.db.insert(orgAiConfig)
        .values({
          organizationId: ctx.orgId,
          provider: input.provider,
          apiKeyEncrypted: apiKeyEncrypted ?? null,
          apiKeyHint: apiKeyHint ?? null,
          isEnabled: input.isEnabled ?? false,
        }).returning();
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
