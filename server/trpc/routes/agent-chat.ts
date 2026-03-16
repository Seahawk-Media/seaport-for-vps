import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, orgProcedure } from '../trpc';
import { agentConversations, agentMessages } from '../../db/schema/agents';
import { eq, and, desc } from 'drizzle-orm';

export const agentChatRouter = router({
  listConversations: orgProcedure
    .input(z.object({ agentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.select().from(agentConversations)
        .where(and(
          eq(agentConversations.agentId, input.agentId),
          eq(agentConversations.userId, ctx.user.id),
        ))
        .orderBy(desc(agentConversations.updatedAt));
    }),

  getMessages: orgProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const conversation = await ctx.db.select().from(agentConversations)
        .where(and(
          eq(agentConversations.id, input.conversationId),
          eq(agentConversations.userId, ctx.user.id),
        ))
        .limit(1);
      if (!conversation.length) throw new TRPCError({ code: 'NOT_FOUND' });

      return ctx.db.select().from(agentMessages)
        .where(eq(agentMessages.conversationId, input.conversationId))
        .orderBy(agentMessages.createdAt);
    }),

  createConversation: orgProcedure
    .input(z.object({ agentId: z.string().uuid(), title: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [conv] = await ctx.db.insert(agentConversations)
        .values({
          agentId: input.agentId,
          userId: ctx.user.id,
          organizationId: ctx.orgId,
          title: input.title ?? 'New conversation',
        }).returning();
      return conv;
    }),

  sendMessage: orgProcedure
    .input(z.object({ conversationId: z.string().uuid(), content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const conversation = await ctx.db.select().from(agentConversations)
        .where(and(
          eq(agentConversations.id, input.conversationId),
          eq(agentConversations.userId, ctx.user.id),
        ))
        .limit(1);
      if (!conversation.length) throw new TRPCError({ code: 'NOT_FOUND' });

      const [msg] = await ctx.db.insert(agentMessages)
        .values({
          conversationId: input.conversationId,
          role: 'user',
          content: input.content,
        }).returning();
      // Agent response will come via WebSocket
      return msg;
    }),
});
