import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure } from '../trpc';
import { organizations, userRoles, invitations } from '../../db/schema/index';
import { profiles } from '../../db/schema/profiles';
import { auth } from '../../auth/index';
import { seedDefaults } from '../../db/seed';
import { eq, count } from 'drizzle-orm';

export const setupRouter = router({
  // Check if setup has been completed (any org exists)
  status: publicProcedure.query(async ({ ctx }) => {
    const [result] = await ctx.db.select({ count: count() }).from(organizations);
    return { needsSetup: result.count === 0 };
  }),

  // First-run setup: create org + admin + seed defaults
  complete: publicProcedure
    .input(
      z.object({
        orgName: z.string().min(1).max(100),
        adminName: z.string().min(1).max(100),
        adminEmail: z.string().email(),
        adminPassword: z.string().min(8),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        // Prevent re-setup (checked inside transaction to avoid race condition)
        const [existing] = await tx.select({ count: count() }).from(organizations);
        if (existing.count > 0) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Organization already exists' });
        }

        // Create the admin user via Better Auth
        const signUpResult = await auth.api.signUpEmail({
          body: {
            name: input.adminName,
            email: input.adminEmail,
            password: input.adminPassword,
          },
        });

        if (!signUpResult?.user) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create admin account' });
        }

        const userId = signUpResult.user.id;

        // Create slug from org name
        const slug = input.orgName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        // Create organization
        const [org] = await tx
          .insert(organizations)
          .values({
            name: input.orgName,
            slug,
            createdBy: userId,
          })
          .returning();

        // Create profile
        await tx.insert(profiles).values({
          userId,
          organizationId: org.id,
          fullName: input.adminName,
          email: input.adminEmail,
        });

        // Assign super_admin role
        await tx.insert(userRoles).values({
          userId,
          role: 'super_admin',
          assignedBy: userId,
        });

        // Seed default data
        await seedDefaults(org.id);

        return { success: true, orgId: org.id, orgSlug: org.slug };
      });
    }),
});
