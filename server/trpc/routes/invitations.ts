import { z } from 'zod';
import { router, adminProcedure, publicProcedure } from '../trpc';
import { invitations } from '../../db/schema/index';
import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'crypto';

export const invitationsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(invitations)
      .where(eq(invitations.organizationId, ctx.orgId));
  }),

  create: adminProcedure
    .input(z.object({
      email: z.string().email(),
      role: z.enum(['admin', 'manager', 'employee']).default('employee'),
    }))
    .mutation(async ({ ctx, input }) => {
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const [invite] = await ctx.db
        .insert(invitations)
        .values({
          organizationId: ctx.orgId,
          email: input.email,
          role: input.role,
          token,
          invitedBy: ctx.user.id,
          expiresAt,
        })
        .returning();

      return { ...invite, inviteUrl: `${process.env.SITE_URL}/invite/${token}` };
    }),

  revoke: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(invitations)
        .where(and(eq(invitations.id, input.id), eq(invitations.organizationId, ctx.orgId)));
      return { success: true };
    }),

  verify: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const [invite] = await ctx.db
        .select()
        .from(invitations)
        .where(and(eq(invitations.token, input.token), eq(invitations.accepted, false)))
        .limit(1);

      if (!invite || (invite.expiresAt && new Date(invite.expiresAt) < new Date())) {
        return { valid: false, invite: null };
      }
      return { valid: true, invite };
    }),
});
