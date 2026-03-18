import { z } from 'zod';
import { router, orgProcedure, adminProcedure } from '../trpc';
import { journeyEventTypes } from '../../db/schema/hr';
import { eq, and, asc } from 'drizzle-orm';

const DEFAULT_EVENT_TYPES = [
  { name: 'Note', slug: 'note', icon: 'FileText', color: 'gray', sortOrder: 0 },
  { name: 'Hired', slug: 'hired', icon: 'UserPlus', color: 'green', sortOrder: 1 },
  { name: 'Promotion', slug: 'promotion', icon: 'TrendingUp', color: 'blue', sortOrder: 2 },
  { name: 'Role Change', slug: 'role-change', icon: 'ArrowRightLeft', color: 'purple', sortOrder: 3 },
  { name: 'Training', slug: 'training', icon: 'GraduationCap', color: 'yellow', sortOrder: 4 },
  { name: 'Certification', slug: 'certification', icon: 'Award', color: 'amber', sortOrder: 5 },
  { name: 'Achievement', slug: 'achievement', icon: 'Trophy', color: 'orange', sortOrder: 6 },
  { name: 'Team Change', slug: 'team-change', icon: 'Users', color: 'indigo', sortOrder: 7 },
  { name: 'Feedback', slug: 'feedback', icon: 'MessageSquare', color: 'teal', sortOrder: 8 },
  { name: 'Milestone', slug: 'milestone', icon: 'Flag', color: 'pink', sortOrder: 9 },
  { name: 'Leave', slug: 'leave', icon: 'Calendar', color: 'slate', sortOrder: 10 },
];

export const journeyEventTypesRouter = router({
  /** List active journey event types for the org. Seeds defaults if none exist. */
  list: orgProcedure.query(async ({ ctx }) => {
    let types = await ctx.db
      .select()
      .from(journeyEventTypes)
      .where(eq(journeyEventTypes.organizationId, ctx.orgId))
      .orderBy(asc(journeyEventTypes.sortOrder));

    // Auto-seed default types on first access
    if (types.length === 0) {
      const values = DEFAULT_EVENT_TYPES.map((t) => ({
        ...t,
        organizationId: ctx.orgId,
        isDefault: true,
        isActive: true,
      }));
      types = await ctx.db.insert(journeyEventTypes).values(values).returning();
    }

    return types;
  }),

  /** List only active types (for the add event modal) */
  listActive: orgProcedure.query(async ({ ctx }) => {
    let types = await ctx.db
      .select()
      .from(journeyEventTypes)
      .where(
        and(
          eq(journeyEventTypes.organizationId, ctx.orgId),
          eq(journeyEventTypes.isActive, true),
        ),
      )
      .orderBy(asc(journeyEventTypes.sortOrder));

    // Auto-seed defaults if empty
    if (types.length === 0) {
      const values = DEFAULT_EVENT_TYPES.map((t) => ({
        ...t,
        organizationId: ctx.orgId,
        isDefault: true,
        isActive: true,
      }));
      types = await ctx.db.insert(journeyEventTypes).values(values).returning();
    }

    return types;
  }),

  /** Create a new journey event type (admin only) */
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
        slug: z.string().min(1).max(50),
        description: z.string().optional(),
        icon: z.string().default('FileText'),
        color: z.string().default('gray'),
        sortOrder: z.number().default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(journeyEventTypes)
        .values({ ...input, organizationId: ctx.orgId })
        .returning();
      return created;
    }),

  /** Update an event type (admin only) */
  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(50).optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      const [updated] = await ctx.db
        .update(journeyEventTypes)
        .set({ ...updates, updatedAt: new Date() })
        .where(
          and(
            eq(journeyEventTypes.id, id),
            eq(journeyEventTypes.organizationId, ctx.orgId),
          ),
        )
        .returning();
      return updated;
    }),

  /** Delete an event type (admin only) */
  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(journeyEventTypes)
        .where(
          and(
            eq(journeyEventTypes.id, input.id),
            eq(journeyEventTypes.organizationId, ctx.orgId),
          ),
        );
      return { success: true };
    }),
});
