import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { Context } from './context';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

// Authenticated procedure — requires valid session
const isAuthed = middleware(async ({ ctx, next }) => {
  if (!ctx.user || !ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      session: ctx.session,
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);

// Org-scoped procedure — requires auth + org membership
const isOrgMember = middleware(async ({ ctx, next }) => {
  if (!ctx.user || !ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  if (!ctx.orgId || !ctx.profile) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'No organization membership' });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      session: ctx.session,
      profile: ctx.profile,
      orgId: ctx.orgId,
      role: ctx.role!,
    },
  });
});

export const orgProcedure = t.procedure.use(isOrgMember);

// Admin procedure — requires admin or super_admin role
const isAdmin = middleware(async ({ ctx, next }) => {
  if (!ctx.user || !ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  if (!ctx.role || !['super_admin', 'admin'].includes(ctx.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      session: ctx.session,
      profile: ctx.profile!,
      orgId: ctx.orgId!,
      role: ctx.role,
    },
  });
});

export const adminProcedure = t.procedure.use(isAdmin);
