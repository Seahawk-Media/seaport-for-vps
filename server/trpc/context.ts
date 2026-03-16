import type { Context as HonoContext } from 'hono';
import { auth } from '../auth/index';
import { db } from '../db/index';
import { eq } from 'drizzle-orm';
import { profiles, userRoles } from '../db/schema/index';

export async function createContext(c: HonoContext) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  let profile = null;
  let orgId: string | null = null;
  let role: string | null = null;

  if (session?.user) {
    const [p] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, session.user.id))
      .limit(1);

    if (p) {
      profile = p;
      orgId = p.organizationId;
    }

    const [r] = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.userId, session.user.id))
      .limit(1);

    if (r) {
      role = r.role;
    }
  }

  return {
    db,
    session: session?.session ?? null,
    user: session?.user ?? null,
    profile,
    orgId,
    role,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
