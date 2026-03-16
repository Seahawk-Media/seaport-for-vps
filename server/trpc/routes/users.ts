import { z } from 'zod';
import { router, adminProcedure } from '../trpc';
import { profiles, userRoles } from '../../db/schema/index';
import { users } from '../../db/schema/auth';
import { auth } from '../../auth/index';
import { eq, and } from 'drizzle-orm';

export const usersRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(profiles)
      .where(eq(profiles.organizationId, ctx.orgId));
  }),

  create: adminProcedure
    .input(
      z.object({
        fullName: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(8),
        role: z.enum(['admin', 'manager', 'employee']),
        jobTitle: z.string().optional(),
        departmentId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const signUpResult = await auth.api.signUpEmail({
        body: {
          name: input.fullName,
          email: input.email,
          password: input.password,
        },
      });

      if (!signUpResult?.user) {
        throw new Error('Failed to create user account');
      }

      const userId = signUpResult.user.id;

      const [profile] = await ctx.db
        .insert(profiles)
        .values({
          userId,
          organizationId: ctx.orgId,
          fullName: input.fullName,
          email: input.email,
          jobTitle: input.jobTitle,
          departmentId: input.departmentId,
        })
        .returning();

      await ctx.db.insert(userRoles).values({
        userId,
        role: input.role,
        assignedBy: ctx.user.id,
      });

      return profile;
    }),

  delete: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Delete profile, role, then auth account
      await ctx.db.delete(profiles).where(
        and(eq(profiles.userId, input.userId), eq(profiles.organizationId, ctx.orgId))
      );
      await ctx.db.delete(userRoles).where(eq(userRoles.userId, input.userId));
      await ctx.db.delete(users).where(eq(users.id, input.userId));
      return { success: true };
    }),
});
