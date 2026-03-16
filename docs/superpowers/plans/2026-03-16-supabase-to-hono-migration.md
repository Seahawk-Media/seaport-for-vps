# Supabase to Hono Migration — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Supabase's 11-service Docker stack with a single Hono server + Postgres, making Seaport deploy like WordPress on any VPS.

**Architecture:** Single Hono server handles HTTP (tRPC), auth (Better Auth), WebSocket (realtime/agent chat), static files (built frontend), and file uploads. Drizzle ORM for type-safe Postgres access. tRPC for end-to-end type safety with React Query on the frontend. Better Auth for server-side sessions with httpOnly cookies.

**Tech Stack:** Hono, Drizzle ORM, Better Auth, tRPC v11, PostgreSQL 15, React 18, Vite, Vitest

**Spec:** `docs/superpowers/specs/2026-03-16-supabase-to-hono-migration-design.md`
**Supabase audit:** 70 files import Supabase, 85+ `.from()` calls, 5 Edge Functions, 3 RPCs, 8 auth methods, 2 realtime subscriptions (useAgentChat.ts, ChatTab.tsx), 1 storage usage (BrandingManagement.tsx).

---

## Chunk 1: Server Skeleton + Database Schema

Sets up the Hono server, Drizzle schema for all 37 tables, Better Auth, tRPC router skeleton, and Docker config. After this chunk, the server starts, connects to Postgres, runs migrations, and serves a health check.

### Task 1: Initialize server package

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`

- [ ] **Step 1: Create server/package.json**

```json
{
  "name": "seaport-server",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch server/index.ts",
    "build": "tsup server/index.ts --format esm --outDir dist",
    "start": "node dist/index.js",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "hono": "^4.7.0",
    "@hono/node-server": "^1.14.0",
    "@hono/node-ws": "^1.1.0",
    "drizzle-orm": "^0.38.0",
    "postgres": "^3.4.5",
    "@trpc/server": "^11.0.0",
    "better-auth": "^1.2.0",
    "zod": "^3.24.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.30.0",
    "tsx": "^4.19.0",
    "tsup": "^8.3.0",
    "vitest": "^3.0.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create server/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "rootDir": ".",
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "paths": {
      "@server/*": ["./server/*"]
    }
  },
  "include": ["server/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Install dependencies**

Run: `cd /Users/ryanjames/Code/seaport && npm install hono @hono/node-server @hono/node-ws drizzle-orm postgres @trpc/server better-auth zod dotenv concurrently`
Run: `npm install -D drizzle-kit tsx tsup vitest @types/node`

- [ ] **Step 4: Update root package.json scripts**

Add dev script for running Vite + Hono concurrently:
```json
"dev": "concurrently \"vite\" \"tsx watch server/index.ts\"",
"dev:server": "tsx watch server/index.ts",
```

- [ ] **Step 5: Add Vite proxy config**

Modify `vite.config.ts` to proxy `/trpc`, `/api`, and `/ws` to the Hono server during development:
```typescript
server: {
  port: 8080,
  proxy: {
    '/trpc': 'http://localhost:3000',
    '/api': 'http://localhost:3000',
    '/ws': { target: 'ws://localhost:3000', ws: true },
  },
},
```

- [ ] **Step 6: Commit**

```bash
git add server/package.json server/tsconfig.json package.json package-lock.json
git commit -m "chore: initialize server package with Hono, Drizzle, Better Auth, tRPC deps"
```

---

### Task 2: Drizzle schema — Core tables (organizations, profiles, auth)

**Files:**
- Create: `server/db/schema/enums.ts`
- Create: `server/db/schema/core.ts`
- Create: `server/db/schema/index.ts`

- [ ] **Step 1: Create enum definitions**

Create `server/db/schema/enums.ts`:

```typescript
import { pgEnum } from 'drizzle-orm/pg-core';

export const appRoleEnum = pgEnum('app_role', [
  'super_admin',
  'admin',
  'manager',
  'employee',
]);
```

- [ ] **Step 2: Create core tables schema**

Create `server/db/schema/core.ts` with: `organizations`, `profiles`, `userRoles`, `roleAuditLog`, `invitations`

All columns must match the audit in the spec exactly. Key points:
- `organizations` has `primary_color`, `accent_color`, `logo_url`, `created_by`, `updated_at`
- `profiles` has `user_id` (FK to Better Auth `user` table), `position_id`, `location`, `status`
- `invitations` gains a new `token` column (TEXT UNIQUE) for link-based invites
- Use `uuid` for all IDs with `.defaultRandom()`
- Use `timestamp('created_at', { withTimezone: true }).defaultNow()`
- Better Auth manages its own `user`, `session`, `account`, `verification` tables — do NOT define those in Drizzle

- [ ] **Step 3: Create barrel export**

Create `server/db/schema/index.ts`:
```typescript
export * from './enums';
export * from './core';
```

- [ ] **Step 4: Commit**

```bash
git add server/db/schema/
git commit -m "feat: add Drizzle schema for core tables (organizations, profiles, user_roles, invitations)"
```

---

### Task 3: Drizzle schema — Org structure tables

**Files:**
- Create: `server/db/schema/org-structure.ts`
- Modify: `server/db/schema/index.ts`

- [ ] **Step 1: Create org structure schema**

Create `server/db/schema/org-structure.ts` with: `departments`, `teams`, `teamMembers`, `positionRoles`

Key points:
- `teams` has `team_type`, `team_lead_id`, `slack_channel`, `components`
- `teamMembers` has UNIQUE(team_id, profile_id)
- All tables have `organization_id` FK

- [ ] **Step 2: Add export to barrel**

- [ ] **Step 3: Commit**

```bash
git add server/db/schema/
git commit -m "feat: add Drizzle schema for org structure (departments, teams, team_members, position_roles)"
```

---

### Task 4: Drizzle schema — HR/employee tables

**Files:**
- Create: `server/db/schema/hr.ts`
- Modify: `server/db/schema/index.ts`

- [ ] **Step 1: Create HR schema**

Create `server/db/schema/hr.ts` with: `trailEvents`, `performanceReviews`, `reviewTemplates`, `promotions`, `positionChanges`, `overtimeEntries`, `timeOffRequests`, `timeOffBalances`, `timeOffTypes`

Key points:
- `promotions` is appraisal tracking (profile_id UNIQUE, role_title, salary_band, next_review_date, last_review_date, notes)
- `positionChanges` is actual position changes (previous/new position_id, previous/new department_id)
- `timeOffBalances.remaining_days` is a GENERATED column: `(total_days - used_days) STORED`
- `performanceReviews` has `template_id` FK to `reviewTemplates`
- `reviewTemplates.criteria` is JSONB DEFAULT '[]'

- [ ] **Step 2: Add export to barrel**

- [ ] **Step 3: Commit**

```bash
git add server/db/schema/
git commit -m "feat: add Drizzle schema for HR tables (reviews, promotions, time_off, overtime)"
```

---

### Task 5: Drizzle schema — Operational tables

**Files:**
- Create: `server/db/schema/operational.ts`
- Modify: `server/db/schema/index.ts`

- [ ] **Step 1: Create operational schema**

Create `server/db/schema/operational.ts` with: `measurables`, `incentives`, `incentiveTypes`, `sops`, `tasks`, `meetings`, `tools`, `holidays`, `coreValues`, `feedback`, `activityLogs`

Key points:
- `activityLogs` uses `profile_id` (not user_id), `activity_type` (not action), has `description`, `user_agent`, `page_path` — no entity_type/entity_id
- `incentives` uses `profile_id`, `incentive_type`, `title`, `points`, `evidence_url`, `reviewed_by`, `reviewed_at`
- `tools`, `meetings`, `sops`, `tasks` all have `department_id` and `team_id` FKs
- `holidays` has `country` (TEXT NULL) and `is_recurring` (BOOLEAN)

- [ ] **Step 2: Add export to barrel**

- [ ] **Step 3: Commit**

```bash
git add server/db/schema/
git commit -m "feat: add Drizzle schema for operational tables (measurables, incentives, tasks, tools, etc.)"
```

---

### Task 6: Drizzle schema — Learning, chat, and agent tables

**Files:**
- Create: `server/db/schema/learning.ts`
- Create: `server/db/schema/chat.ts`
- Create: `server/db/schema/agents.ts`
- Modify: `server/db/schema/index.ts`

- [ ] **Step 1: Create learning schema**

Create `server/db/schema/learning.ts` with: `courses`, `coursePages`, `courseProgress`

Key points:
- Table names are `courses` (not academy_courses), `course_pages`, `course_progress`
- `courses.status` has CHECK ('draft','published','archived')
- `courseProgress` has UNIQUE(course_id, profile_id)

- [ ] **Step 2: Create chat schema**

Create `server/db/schema/chat.ts` with: `chatChannels`, `chatMessages`

Key points:
- `chatMessages.sender_id` FK to profiles (not user_id)
- No `type` column on `chatChannels` — uses department_id/team_id FKs to determine scope

- [ ] **Step 3: Create agents schema**

Create `server/db/schema/agents.ts` with: `agents`, `agentConversations`, `agentMessages`, `agentToolConnections`, `orgAiConfig`

Key points:
- `agents` has `config` (JSONB), `status`, `tier` with CHECK, `type`, `ai_provider`, `ai_model`
- `agentToolConnections` is NET NEW — not in current DB
- `orgAiConfig` has UNIQUE(organization_id, provider)
- `agentConversations.user_id` references Better Auth's user table

- [ ] **Step 4: Add exports to barrel**

- [ ] **Step 5: Commit**

```bash
git add server/db/schema/
git commit -m "feat: add Drizzle schema for learning, chat, and agent tables"
```

---

### Task 7: Drizzle database client and config

**Files:**
- Create: `server/db/index.ts`
- Create: `drizzle.config.ts`

- [ ] **Step 1: Create database client**

Create `server/db/index.ts`:

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
export const db = drizzle(client, { schema });
export type Database = typeof db;
```

- [ ] **Step 2: Create Drizzle config**

Create `drizzle.config.ts`:

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './server/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add server/db/index.ts drizzle.config.ts
git commit -m "feat: add Drizzle database client and config"
```

---

### Task 8: Better Auth configuration

**Files:**
- Create: `server/auth/index.ts`

- [ ] **Step 1: Create Better Auth config**

Create `server/auth/index.ts`:

```typescript
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: { enabled: true },
  session: {
    cookieCache: { enabled: true, maxAge: 60 * 5 },
    expiresIn: 60 * 60 * 24 * 7, // 7 days
  },
  trustedOrigins: [process.env.SITE_URL || 'http://localhost:8080'],
});
```

Note: Better Auth creates its own tables (`user`, `session`, `account`, `verification`) when migrations are run. Check Better Auth docs for the latest adapter API — it may be `drizzleAdapter` or `drizzle()` depending on version.

- [ ] **Step 2: Commit**

```bash
git add server/auth/
git commit -m "feat: configure Better Auth with Drizzle adapter and email/password"
```

---

### Task 9: tRPC router skeleton

**Files:**
- Create: `server/trpc/init.ts`
- Create: `server/trpc/context.ts`
- Create: `server/trpc/router.ts`
- Create: `server/trpc/routes/setup.ts` (stub)

- [ ] **Step 1: Create tRPC initialization**

Create `server/trpc/init.ts`:

```typescript
import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

// Middleware: requires authenticated session
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx: { ...ctx, session: ctx.session } });
});

export const protectedProcedure = t.procedure.use(isAuthed);

// Middleware: requires specific role
export const requireRole = (...roles: string[]) =>
  t.middleware(({ ctx, next }) => {
    if (!ctx.session) throw new TRPCError({ code: 'UNAUTHORIZED' });
    if (!roles.includes(ctx.session.role))
      throw new TRPCError({ code: 'FORBIDDEN' });
    return next({ ctx: { ...ctx, session: ctx.session } });
  });
```

- [ ] **Step 2: Create context factory**

Create `server/trpc/context.ts`:

```typescript
import type { Context as HonoContext } from 'hono';
import { auth } from '../auth';
import { db } from '../db';

export async function createContext(c: HonoContext) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  return {
    db,
    session: session ? {
      userId: session.user.id,
      orgId: session.user.orgId, // populated after org setup
      role: session.user.role,
    } : null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
```

Note: The exact session shape depends on Better Auth's plugin configuration. Check docs for how organization and role data are attached to the session. You may need to query `profiles` and `user_roles` to populate `orgId` and `role` in the context.

- [ ] **Step 3: Create root router with setup stub**

Create `server/trpc/routes/setup.ts`:

```typescript
import { z } from 'zod';
import { publicProcedure, router } from '../init';

export const setupRouter = router({
  check: publicProcedure.query(async ({ ctx }) => {
    // Check if any organization exists
    const result = await ctx.db.query.organizations.findFirst();
    return { needsSetup: !result };
  }),
});
```

Create `server/trpc/router.ts`:

```typescript
import { router } from './init';
import { setupRouter } from './routes/setup';

export const appRouter = router({
  setup: setupRouter,
  // All other routers will be added as we implement them
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 4: Commit**

```bash
git add server/trpc/
git commit -m "feat: add tRPC router skeleton with auth middleware and setup check"
```

---

### Task 10: Hono server entry point

**Files:**
- Create: `server/index.ts`

- [ ] **Step 1: Create Hono server**

Create `server/index.ts`:

```typescript
import 'dotenv/config';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { trpcServer } from '@hono/trpc-server'; // or use fetch adapter
import { auth } from './auth';
import { appRouter } from './trpc/router';
import { createContext } from './trpc/context';

const app = new Hono();

// CORS for dev
app.use('/*', cors({
  origin: process.env.SITE_URL || 'http://localhost:8080',
  credentials: true,
}));

// Health check
app.get('/healthz', (c) => c.json({ status: 'ok' }));

// Better Auth handles its own routes (/api/auth/*)
app.on(['GET', 'POST'], '/api/auth/**', (c) => auth.handler(c.req.raw));

// tRPC
app.use('/trpc/*', trpcServer({
  router: appRouter,
  createContext: ({ req }) => createContext(req), // adapt to Hono context
}));

// Start
const port = Number(process.env.PORT) || 3000;
serve({ fetch: app.fetch, port }, () => {
  console.log(`Seaport server running on http://localhost:${port}`);
});
```

Note: The tRPC-to-Hono integration may use `@trpc/server/adapters/fetch` instead of `@hono/trpc-server`. Check which package is current. The fetch adapter pattern:

```typescript
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

app.use('/trpc/*', async (c) => {
  return fetchRequestHandler({
    endpoint: '/trpc',
    req: c.req.raw,
    router: appRouter,
    createContext: () => createContext(c),
  });
});
```

- [ ] **Step 2: Verify server starts**

Run: `cd /Users/ryanjames/Code/seaport && npx tsx server/index.ts`

Expected: Server starts (will fail to connect to DB but should not crash on import errors). Kill it after verifying it boots.

- [ ] **Step 3: Commit**

```bash
git add server/index.ts
git commit -m "feat: add Hono server entry with Better Auth, tRPC, and health check"
```

---

### Task 11: Docker configuration

**Files:**
- Create: `Dockerfile` (rewrite)
- Modify: `docker-compose.yml` (rewrite)

- [ ] **Step 1: Create Dockerfile**

```dockerfile
FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Build frontend
FROM deps AS frontend-build
COPY . .
RUN npm run build

# Build server
FROM deps AS server-build
COPY . .
RUN npx tsup server/index.ts --format esm --outDir dist

# Production
FROM base AS production
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=server-build /app/dist ./dist
COPY --from=frontend-build /app/dist/client ./dist/client
COPY --from=deps /app/package.json ./
COPY drizzle ./drizzle

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

Note: The Vite build output directory may be `dist` not `dist/client` — check `vite.config.ts` to confirm. Adjust the COPY path accordingly. The server needs to serve these static files via Hono's `serveStatic` middleware.

- [ ] **Step 2: Rewrite docker-compose.yml**

Replace entire file with the 2-service stack from the spec (postgres + seaport + volumes for db-data and uploads).

- [ ] **Step 3: Commit**

```bash
git add Dockerfile docker-compose.yml
git commit -m "feat: rewrite Docker config for 2-container stack (Postgres + Seaport)"
```

---

### Task 12: Seed data

**Files:**
- Create: `server/db/seed.ts`

- [ ] **Step 1: Create seed file**

Create `server/db/seed.ts` with functions to insert:
- 13 default position_roles (CEO, CTO, CFO, VP, Director, Manager, Senior Developer, Developer, Junior Developer, Designer, Analyst, HR Manager, Recruiter)
- 1 default review_template ("Standard Performance Review" with 13 criteria from the current migration)
- 5 default departments (Engineering, Marketing, Sales, HR, Finance)
- 4 default teams (QA Team, DevOps Team, Product Team, Security Team)

Export a `seed(orgId: string)` function that inserts all defaults scoped to the given organization.

- [ ] **Step 2: Commit**

```bash
git add server/db/seed.ts
git commit -m "feat: add seed data (position roles, review template, departments, teams)"
```

---

## Chunk 2: Auth + Setup Wizard + Core Routes

After this chunk, the setup wizard works, users can log in/out, and core CRUD (orgs, departments, teams, profiles) is functional via tRPC.

### Task 13: Setup wizard tRPC route

**Files:**
- Modify: `server/trpc/routes/setup.ts`

- [ ] **Step 1: Implement setup.create mutation**

Add `create` mutation to `setupRouter` that:
1. Validates no org exists yet (throw if one does)
2. Creates Better Auth user (email + password)
3. Creates organization row
4. Creates profile row linked to user
5. Creates user_roles row (super_admin)
6. Runs seed(orgId) for default data
7. All in a transaction
8. Returns success

Input schema:
```typescript
z.object({
  orgName: z.string().min(1).max(100),
  fullName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
})
```

- [ ] **Step 2: Write test for setup route**

Create `server/trpc/routes/__tests__/setup.test.ts`:
- Test that `check` returns `needsSetup: true` when no orgs exist
- Test that `create` creates org + profile + role
- Test that `create` fails if org already exists

Note: These tests will need a test database. Set up a test helper that creates a fresh DB connection and runs migrations. Use Vitest.

- [ ] **Step 3: Run tests**

Run: `npx vitest run server/trpc/routes/__tests__/setup.test.ts`

- [ ] **Step 4: Commit**

```bash
git add server/trpc/routes/setup.ts server/trpc/routes/__tests__/
git commit -m "feat: implement setup wizard tRPC route with org + admin creation"
```

---

### Task 14: Auth tRPC route

**Files:**
- Create: `server/trpc/routes/auth.ts`
- Modify: `server/trpc/router.ts`

- [ ] **Step 1: Create auth router**

Create `server/trpc/routes/auth.ts`:

```typescript
import { publicProcedure, protectedProcedure, router } from '../init';

export const authRouter = router({
  // Get current session info (profile, role, org)
  me: protectedProcedure.query(async ({ ctx }) => {
    const profile = await ctx.db.query.profiles.findFirst({
      where: eq(profiles.userId, ctx.session.userId),
      with: { organization: true },
    });
    const roles = await ctx.db.query.userRoles.findMany({
      where: eq(userRoles.userId, ctx.session.userId),
    });
    return { profile, roles };
  }),
});
```

Note: Login/signup/signout are handled by Better Auth directly at `/api/auth/*` — tRPC does not need to wrap those. The `me` query gives the frontend everything it needs after authentication.

- [ ] **Step 2: Add to root router**

- [ ] **Step 3: Commit**

```bash
git add server/trpc/routes/auth.ts server/trpc/router.ts
git commit -m "feat: add auth tRPC route for session info"
```

---

### Task 15: Organizations CRUD route

**Files:**
- Create: `server/trpc/routes/org.ts`
- Modify: `server/trpc/router.ts`

- [ ] **Step 1: Create org router**

Implement: `get` (current org), `update` (name, slug, colors, logo_url — admin+ only)

All queries scoped to `ctx.session.orgId`. Use `requireRole('super_admin', 'admin')` for mutations.

- [ ] **Step 2: Add to root router**

- [ ] **Step 3: Commit**

```bash
git add server/trpc/routes/org.ts server/trpc/router.ts
git commit -m "feat: add organization CRUD tRPC route"
```

---

### Task 16: Departments CRUD route

**Files:**
- Create: `server/trpc/routes/departments.ts`
- Modify: `server/trpc/router.ts`

- [ ] **Step 1: Create departments router**

Implement: `list`, `getById`, `create`, `update`, `delete`

All scoped to org. `list` should include `head:profiles(id, full_name, avatar_url)` relation. Create/update/delete require admin+.

Current frontend usage (from audit):
- `DepartmentPage.tsx` — `select('*').eq('id', id).single()` with head profile
- `FunctionsPage.tsx` — `select('id, name').order('name')`
- `DepartmentManagement.tsx` — full CRUD with head assignment

- [ ] **Step 2: Add to root router**

- [ ] **Step 3: Commit**

```bash
git add server/trpc/routes/departments.ts server/trpc/router.ts
git commit -m "feat: add departments CRUD tRPC route"
```

---

### Task 17: Teams + Team Members CRUD routes

**Files:**
- Create: `server/trpc/routes/teams.ts`
- Create: `server/trpc/routes/team-members.ts`
- Modify: `server/trpc/router.ts`

- [ ] **Step 1: Create teams router**

Implement: `list` (with department filter), `getById` (with lead profile), `create`, `update`, `delete`

Current frontend usage:
- `FunctionsPage.tsx` — `select('*, team_lead:profiles!teams_team_lead_id_fkey(id, full_name, avatar_url)').order('name')`
- `TeamManagement.tsx` — full CRUD
- Workspace tabs — filtered by department_id

- [ ] **Step 2: Create team-members router**

Implement: `listByTeam`, `listByProfile`, `add`, `remove`, `updateRole`

Current usage:
- `TeamsGridTab.tsx` — count members per team
- `TasksTab.tsx` — get profile_ids for team
- `UserManagementSettings.tsx` — manage team assignments

- [ ] **Step 3: Add to root router**

- [ ] **Step 4: Commit**

```bash
git add server/trpc/routes/teams.ts server/trpc/routes/team-members.ts server/trpc/router.ts
git commit -m "feat: add teams and team members CRUD tRPC routes"
```

---

### Task 18: Profiles CRUD route

**Files:**
- Create: `server/trpc/routes/profiles.ts`
- Modify: `server/trpc/router.ts`

- [ ] **Step 1: Create profiles router**

Implement: `me`, `getById`, `list` (with department/team filters), `update`, `listForDirectory`

Current frontend usage:
- `useRole.tsx` — `select('*').eq('user_id', user.id)`
- `useOrganization.tsx` — `select('organization_id').eq('user_id', user.id)`
- `UserManagementSettings.tsx` — complex select with relations (department, position_role, team_memberships)
- `EmployeeDirectoryTable.tsx` — list with search, filters
- Org chart components — profiles with department and manager relations
- `useScopedData.ts` — profile-based scoping

Key: The `list` query should support filtering by department_id, team_id, and role. Include relations: department(name), positionRole(title), manager(full_name).

- [ ] **Step 2: Add to root router**

- [ ] **Step 3: Commit**

```bash
git add server/trpc/routes/profiles.ts server/trpc/router.ts
git commit -m "feat: add profiles CRUD tRPC route with relation loading"
```

---

### Task 19: User management routes (replaces 5 Edge Functions)

**Files:**
- Create: `server/trpc/routes/users.ts`
- Modify: `server/trpc/router.ts`

- [ ] **Step 1: Create users router**

This replaces ALL 5 Supabase Edge Functions. Implement:

**`create`** (replaces `create-user` Edge Function):
1. Create Better Auth user with email + password
2. Create profile row (org_id, full_name, email, etc.)
3. Create user_roles row
4. All in transaction, rollback on failure

**`delete`** (replaces `delete-user` Edge Function):
1. Prevent self-deletion
2. Delete user_roles
3. Delete profile
4. Delete Better Auth user
5. All in transaction

**`invite`** (replaces `invite-user` Edge Function):
1. Generate unique token (crypto.randomUUID)
2. Create invitation row with token
3. If SMTP configured, send email with invite link
4. Return invite link URL (for copy/paste if no SMTP)

**`revokeInvite`** (replaces `revoke-invite` Edge Function):
1. Mark invitation as accepted (revoked)
2. If user was created but has no profile, delete auth user

**`cleanupInvites`** (replaces `cleanup-invites` Edge Function):
1. Delete expired unaccepted invitations
2. Find orphaned auth users (no profile) and delete them

**`assignRole`** (replaces `assign_user_role` RPC):
1. Validate caller has admin+ permission
2. Upsert user_roles row with target_user_id and target_role
3. Log to role_audit_log

All mutations require admin+ role.

**Pattern note for admin components:** Many admin components currently call `supabase.auth.getUser()` to get the current user ID. After migration, they should use the tRPC context session data via `trpc.auth.me.useQuery()` instead.

- [ ] **Step 2: Add to root router**

- [ ] **Step 3: Commit**

```bash
git add server/trpc/routes/users.ts server/trpc/router.ts
git commit -m "feat: add user management routes (replaces 5 Edge Functions)"
```

---

### Task 20: Invitations + Role assignment routes

**Files:**
- Create: `server/trpc/routes/invitations.ts`
- Modify: `server/trpc/router.ts`

- [ ] **Step 1: Create invitations router**

Implement:
- `listPending` — get pending invitations for the org
- `accept` — replaces `accept_invitation` RPC: validates token/expiry, creates profile if needed, assigns role, marks accepted
- `getByToken` — public procedure for the accept-invite page to show invitation details

The `accept` procedure is PUBLIC (no auth required — the user might not have an account yet). It should:
1. Look up invitation by token
2. Validate not expired, not already accepted
3. Create Better Auth user if no account exists for that email
4. Create profile with org assignment
5. Create user_roles
6. Mark invitation accepted
7. Sign the user in (create session)

- [ ] **Step 2: Add to root router**

- [ ] **Step 3: Commit**

```bash
git add server/trpc/routes/invitations.ts server/trpc/router.ts
git commit -m "feat: add invitation acceptance and role assignment routes"
```

---

## Chunk 3: Feature Routes

After this chunk, all 30+ database tables are accessible via tRPC. Each route follows the same pattern: list, getById, create, update, delete — scoped to org.

### Task 21: Performance reviews + review templates

**Files:**
- Create: `server/trpc/routes/reviews.ts`
- Modify: `server/trpc/router.ts`

- [ ] **Step 1: Create reviews router**

Implement for `performanceReviews`: `list` (filter by employee/reviewer/status), `getById`, `create`, `update`, `submit` (changes status + sets submitted_at)

Implement for `reviewTemplates`: `list`, `getById`, `create`, `update`, `delete`

Current usage:
- `PerformanceReviewModal.tsx` — full CRUD with template loading
- `ReviewCriteriaForm.tsx` — template criteria management

When a review is submitted (status → 'completed'), create a `trail_events` entry (replaces the `create_trail_event_for_performance_review` trigger). Do this in application code, not a DB trigger.

- [ ] **Step 2: Commit**

```bash
git add server/trpc/routes/reviews.ts server/trpc/router.ts
git commit -m "feat: add performance reviews and review templates routes"
```

---

### Task 22: Promotions + position changes + position roles

**Files:**
- Create: `server/trpc/routes/positions.ts`
- Create: `server/trpc/routes/promotions.ts`
- Modify: `server/trpc/router.ts`

- [ ] **Step 1: Create positions router**

`positionRoles`: `list`, `create`, `update`, `delete`
`positionChanges`: `list` (by profile), `create`, `getByProfile`

- [ ] **Step 2: Create promotions router**

`promotions` (appraisal tracking): `getByProfile`, `upsert` (update or create — profile_id is UNIQUE), `list`

- [ ] **Step 3: Commit**

```bash
git add server/trpc/routes/positions.ts server/trpc/routes/promotions.ts server/trpc/router.ts
git commit -m "feat: add position roles, position changes, and promotions routes"
```

---

### Task 23: Measurables

**Files:**
- Create: `server/trpc/routes/measurables.ts`
- Modify: `server/trpc/router.ts`

- [ ] **Step 1: Create measurables router**

Implement: `list` (filter by team_id, owner_id), `getById`, `create`, `update`, `delete`

Include owner profile relation in list query.

- [ ] **Step 2: Commit**

```bash
git add server/trpc/routes/measurables.ts server/trpc/router.ts
git commit -m "feat: add measurables/KPI routes"
```

---

### Task 24: Incentives + incentive types

**Files:**
- Create: `server/trpc/routes/incentives.ts`
- Modify: `server/trpc/router.ts`

- [ ] **Step 1: Create incentives router**

`incentives`: `list` (filter by profile, status), `create` (submit), `review` (approve/reject — sets reviewed_by, reviewed_at, status)
`incentiveTypes`: `list`, `create`, `update`, `toggleActive`

- [ ] **Step 2: Commit**

```bash
git add server/trpc/routes/incentives.ts server/trpc/router.ts
git commit -m "feat: add incentives and incentive types routes"
```

---

### Task 25: Academy (courses, pages, progress)

**Files:**
- Create: `server/trpc/routes/academy.ts`
- Modify: `server/trpc/router.ts`

- [ ] **Step 1: Create academy router**

`courses`: `list`, `getById` (with pages), `create`, `update`, `publish`, `archive`, `delete`
`coursePages`: `list` (by course, ordered by page_order), `create`, `update`, `delete`, `reorder`
`courseProgress`: `get` (by course + profile), `update` (advance page), `complete`

- [ ] **Step 2: Commit**

```bash
git add server/trpc/routes/academy.ts server/trpc/router.ts
git commit -m "feat: add academy routes (courses, pages, progress)"
```

---

### Task 26: Remaining feature routes (batch)

**Files:**
- Create: `server/trpc/routes/sops.ts`
- Create: `server/trpc/routes/tasks.ts`
- Create: `server/trpc/routes/meetings.ts`
- Create: `server/trpc/routes/tools.ts`
- Create: `server/trpc/routes/calendar.ts`
- Create: `server/trpc/routes/core-values.ts`
- Create: `server/trpc/routes/time-off.ts`
- Create: `server/trpc/routes/overtime.ts`
- Create: `server/trpc/routes/feedback.ts`
- Create: `server/trpc/routes/activity.ts`
- Create: `server/trpc/routes/analytics.ts`
- Create: `server/trpc/routes/ai-config.ts`
- Modify: `server/trpc/router.ts`

All follow the standard CRUD pattern. Key notes per route:

- [ ] **Step 1: SOPs** — CRUD with department_id/team_id filter, category filter, version tracking

- [ ] **Step 2: Tasks** — CRUD with status/priority/assigned_to filters, due_date handling. Frontend uses `MyTasksView.tsx` (personal) and `TasksTab.tsx` (team scope).

- [ ] **Step 3: Meetings** — CRUD with department_id/team_id filter, scheduled_at ordering

- [ ] **Step 4: Tools** — CRUD with department_id/team_id filter

- [ ] **Step 5: Calendar (holidays)** — CRUD. Note: table is `holidays` not `holiday_calendar`. Has `country` filter and `is_recurring` flag.

- [ ] **Step 6: Core values** — Simple CRUD, org-scoped

- [ ] **Step 7: Time off** — Three sub-resources:
  - `timeOffRequests`: list (by profile, status), create, review (approve/reject)
  - `timeOffBalances`: list (by profile, year), update
  - `timeOffTypes`: list, create, update, toggleActive

- [ ] **Step 8: Overtime** — `list` (by profile, status), `create`, `review` (approve/reject)

- [ ] **Step 9: Feedback** — `list` (filter by status, priority), `create`, `update` (admin_notes, target_quarter, status)

- [ ] **Step 10: Activity** — `list` (paginated, filter by activity_type, date range), `log` (create entry). Frontend: `ActivityLogViewer.tsx` and `useActivityLogger.ts`.

- [ ] **Step 11: Analytics** — Read-only aggregation queries:
  - `dashboard`: counts of departments, teams, employees, pending reviews, active agents
  - `incentiveStats`: total points, top earners, by type
  - `timeOffStats`: utilization by type
  - `performanceStats`: rating distribution, completion rates

- [ ] **Step 12: AI Config** — `list` (by org), `upsert` (provider + api_key_hint + is_enabled). UNIQUE(org_id, provider).

- [ ] **Step 13: Add all to root router**

Update `server/trpc/router.ts` to import and mount all 12 routers.

- [ ] **Step 14: Commit**

```bash
git add server/trpc/routes/ server/trpc/router.ts
git commit -m "feat: add remaining feature routes (sops, tasks, meetings, tools, calendar, etc.)"
```

---

### Task 27: Employee journey route

**Files:**
- Create: `server/trpc/routes/journey.ts`
- Modify: `server/trpc/router.ts`

- [ ] **Step 1: Create journey router**

`trailEvents`: `list` (by profile, ordered by event_date desc), `create`, `update`, `delete`

This maps to the `trail_events` table (DB name kept as-is). Frontend: `EmployeeJourney.tsx`, `JourneyView.tsx`, `AddEventModal.tsx`.

- [ ] **Step 2: Commit**

```bash
git add server/trpc/routes/journey.ts server/trpc/router.ts
git commit -m "feat: add employee journey route (trail_events)"
```

---

## Chunk 4: Agent System

### Task 28: Agent CRUD route

**Files:**
- Create: `server/trpc/routes/agents.ts`
- Modify: `server/trpc/router.ts`

- [ ] **Step 1: Create agents router**

Implement: `list` (filter by tier, department_id, team_id, status), `getById` (with team relation), `create`, `update`, `delete`, `updateStatus`

Current frontend usage (`AgentsTab.tsx`):
- `select('*, team:teams(id, name, department_id)')` — need team relation on list
- Insert with tier, department_id, team_id, system_prompt, ai_provider, ai_model, config
- Update status (activate/deactivate)

Also add `listAiProviders` query that reads from `orgAiConfig` — needed by AgentsTab to show which AI providers are configured.

- [ ] **Step 2: Commit**

```bash
git add server/trpc/routes/agents.ts server/trpc/router.ts
git commit -m "feat: add agent CRUD route with tier filtering and AI provider listing"
```

---

### Task 29: Agent access control + context (TypeScript)

**Files:**
- Create: `server/agents/access.ts`
- Create: `server/agents/context.ts`

- [ ] **Step 1: Create access control**

Create `server/agents/access.ts`:

```typescript
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { agents, profiles, teamMembers } from '../db/schema';

export async function canAccessAgent(userId: string, agentId: string): Promise<boolean> {
  const agent = await db.query.agents.findFirst({ where: eq(agents.id, agentId) });
  if (!agent) return false;

  const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  if (!profile) return false;
  if (agent.organizationId !== profile.organizationId) return false;

  if (agent.tier === 'general') return true;
  if (agent.tier === 'departmental') return agent.departmentId === profile.departmentId;
  if (agent.tier === 'functional') {
    if (!agent.teamId) return false;
    const membership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.profileId, profile.id),
        eq(teamMembers.teamId, agent.teamId),
      ),
    });
    return !!membership;
  }
  return false;
}
```

- [ ] **Step 2: Create context retrieval**

Create `server/agents/context.ts` with `getAgentContext(agentId)` that returns scoped org data based on tier (full org for general, department-scoped for departmental, team-scoped for functional).

- [ ] **Step 3: Commit**

```bash
git add server/agents/
git commit -m "feat: add agent access control and context retrieval (TypeScript)"
```

---

### Task 30: Agent chat route + WebSocket

**Files:**
- Create: `server/trpc/routes/agent-chat.ts`
- Create: `server/ws/agent-chat.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Create agent-chat tRPC route**

Implement:
- `conversations.list` (by agent or by user)
- `conversations.create` (start new conversation with agent)
- `conversations.archive`
- `messages.list` (by conversation, paginated)

- [ ] **Step 2: Create WebSocket handler**

Create `server/ws/agent-chat.ts`:

```typescript
// Handles ws:// connections for agent chat
// 1. Validate session from cookie/token
// 2. Validate agent access via canAccessAgent()
// 3. Store user message to agent_messages
// 4. Forward to agent runtime (TODO: OpenClaw integration)
// 5. Stream response tokens back
// 6. Store complete response to agent_messages
```

For now, echo messages back (same as current agent-runtime bridge). OpenClaw integration is deferred.

- [ ] **Step 3: Mount WebSocket in Hono**

Add WebSocket upgrade handler to `server/index.ts` at `/ws/agent-chat`.

- [ ] **Step 4: Commit**

```bash
git add server/trpc/routes/agent-chat.ts server/ws/agent-chat.ts server/index.ts
git commit -m "feat: add agent chat route and WebSocket handler"
```

---

### Task 31: Agent tool connections route

**Files:**
- Create: `server/trpc/routes/agent-tools.ts`
- Create: `server/agents/tools.ts`
- Modify: `server/trpc/router.ts`

- [ ] **Step 1: Create agent-tools tRPC route**

Implement:
- `list` (by agent_id) — returns connections WITHOUT decrypted credentials
- `connect` — creates agent_tool_connection (api_key/mcp/cli/oauth)
- `disconnect` — removes connection
- `update` — update connection config/credentials

Credentials should be encrypted at rest. Use Node.js `crypto` with a key derived from `SESSION_SECRET`:
```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
// AES-256-GCM encryption for credentials_encrypted column
```

- [ ] **Step 2: Create tool connection manager**

Create `server/agents/tools.ts` — `getToolsForAgent(agentId)` that loads decrypted tool connections for use by the agent runtime.

- [ ] **Step 3: Commit**

```bash
git add server/trpc/routes/agent-tools.ts server/agents/tools.ts server/trpc/router.ts
git commit -m "feat: add agent tool connections with encrypted credential storage"
```

---

## Chunk 5: Chat System + Realtime

### Task 32: Team chat routes

**Files:**
- Create: `server/trpc/routes/chat.ts`
- Modify: `server/trpc/router.ts`

- [ ] **Step 1: Create chat router**

Implement:
- `channels.list` (by department_id or team_id)
- `channels.create`
- `channels.getById`
- `messages.list` (by channel, paginated, with sender profile)
- `messages.send`

Current usage (`ChatTab.tsx`): Select channels by dept/team, send/receive messages with sender profiles.

- [ ] **Step 2: Commit**

```bash
git add server/trpc/routes/chat.ts server/trpc/router.ts
git commit -m "feat: add team chat routes (channels + messages)"
```

---

### Task 33: WebSocket realtime server

**Files:**
- Create: `server/ws/realtime.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Create realtime WebSocket handler**

Create `server/ws/realtime.ts`:

```typescript
// Pub/sub system for live updates
// Client connects to ws://host/ws with session cookie
// Client subscribes to channels: chat:{channelId}, agent:{conversationId}, activity
// Server broadcasts on message insert/update

// Message format:
// { type: 'subscribe', channel: 'chat:uuid' }
// { type: 'message', channel: 'chat:uuid', data: { ... } }
```

Use a simple in-memory Map<channel, Set<WebSocket>> for subscriptions. No Redis needed for single-server deployment.

- [ ] **Step 2: Mount at /ws in Hono**

Add upgrade handler to `server/index.ts`.

- [ ] **Step 3: Wire chat.messages.send to broadcast**

When a chat message is sent via tRPC, also broadcast it to all WebSocket subscribers on that channel.

- [ ] **Step 4: Commit**

```bash
git add server/ws/realtime.ts server/index.ts server/trpc/routes/chat.ts
git commit -m "feat: add WebSocket realtime pub/sub for chat and agent messages"
```

---

## Chunk 6: File Storage + Static Serving

File uploads must be available BEFORE the frontend migration because BrandingManagement.tsx uses `supabase.storage` for logo uploads.

### Task 34: File upload endpoint

**Files:**
- Create: `server/storage/uploads.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Create upload handler**

Create `server/storage/uploads.ts`:
- POST `/api/uploads` — accepts multipart form data, validates file type (image/*) and size (5MB), stores to `/app/uploads/org-{orgId}/{uuid}.{ext}`, returns URL
- GET `/uploads/*` — serves static files from uploads directory

- [ ] **Step 2: Mount in Hono**

Add upload routes and static file serving to `server/index.ts`.

- [ ] **Step 3: Add static frontend serving**

Add `serveStatic` middleware to serve the built Vite frontend from `dist/client/` (or wherever Vite outputs).

- [ ] **Step 4: Commit**

```bash
git add server/storage/ server/index.ts
git commit -m "feat: add file upload endpoint and static file serving"
```

---

## Chunk 7: Frontend Migration

This is the largest chunk — 70 files need updating. The pattern is mechanical: replace `supabase.from()` with `trpc.*.useQuery/useMutation`, replace auth calls with Better Auth client, replace types with Drizzle-inferred types.

**Type migration pattern:** Replace `Database['public']['Tables']['departments']['Row']` with Drizzle-inferred types. Export types from the schema: `export type Department = typeof departments.$inferSelect`. Frontend imports these via tRPC's type inference — `trpc.departments.list.useQuery()` automatically infers the return type.

### Task 35: Frontend tRPC + Better Auth client setup

**Files:**
- Create: `src/lib/trpc.ts`
- Create: `src/lib/auth-client.ts`
- Create: `src/lib/ws.ts`
- Modify: `src/App.tsx` (wrap with tRPC provider)

- [ ] **Step 1: Create tRPC client**

Create `src/lib/trpc.ts`:

```typescript
import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../server/trpc/router';

export const trpc = createTRPCReact<AppRouter>();

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: '/trpc',
        fetch(url, options) {
          return fetch(url, { ...options, credentials: 'include' });
        },
      }),
    ],
  });
}
```

Install: `npm install @trpc/client @trpc/react-query @tanstack/react-query`

- [ ] **Step 2: Create Better Auth client**

Create `src/lib/auth-client.ts`:

```typescript
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: window.location.origin,
});
```

- [ ] **Step 3: Create WebSocket client**

Create `src/lib/ws.ts`:

```typescript
export function createWSClient(onMessage: (data: any) => void) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
  ws.onmessage = (event) => onMessage(JSON.parse(event.data));
  return ws;
}
```

- [ ] **Step 4: Wrap App.tsx with providers**

Add `QueryClientProvider` and `trpc.Provider` to `App.tsx`. Keep existing `AuthProvider` for now — it will be rewritten in the next task.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ src/App.tsx package.json package-lock.json
git commit -m "feat: add tRPC, Better Auth, and WebSocket client setup"
```

---

### Task 36: Rewrite AuthProvider

**Files:**
- Modify: `src/hooks/useAuth.tsx`

- [ ] **Step 1: Rewrite useAuth hook**

Replace Supabase auth with Better Auth:

Current auth methods used:
- `supabase.auth.onAuthStateChange()` → `authClient.useSession()` hook
- `supabase.auth.getSession()` → `authClient.getSession()`
- `supabase.auth.signUp()` → `authClient.signUp.email()`
- `supabase.auth.signInWithPassword()` → `authClient.signIn.email()`
- `supabase.auth.signOut()` → `authClient.signOut()`

Maintain the same exported interface (`useAuth` hook returns `{ user, session, loading, signIn, signUp, signOut }`).

- [ ] **Step 2: Verify login flow works**

Start dev server and test login/signup manually.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAuth.tsx
git commit -m "feat: rewrite AuthProvider with Better Auth (replace Supabase auth)"
```

---

### Task 37: Rewrite useOrganization and useRole hooks

**Files:**
- Modify: `src/hooks/useOrganization.tsx`
- Modify: `src/hooks/useRole.tsx`
- Modify: `src/hooks/useScopedData.ts`
- Modify: `src/hooks/useActivityLogger.ts`

- [ ] **Step 1: Rewrite useOrganization**

Replace `supabase.from('profiles').select('organization_id')` and `supabase.from('organizations').select('*')` with `trpc.auth.me.useQuery()` — the `me` query returns profile + organization in one call.

- [ ] **Step 2: Rewrite useRole**

Replace `supabase.from('user_roles').select('*')` with data from `trpc.auth.me.useQuery()` which includes roles.

Replace `supabase.rpc('assign_user_role')` with `trpc.users.assignRole.useMutation()`.

- [ ] **Step 3: Rewrite useScopedData**

Replace all Supabase queries with tRPC calls. This hook determines which profiles the user can see based on their role.

- [ ] **Step 4: Rewrite useActivityLogger**

Replace `supabase.from('activity_logs').insert()` with `trpc.activity.log.useMutation()`.

Replace `supabase.from('profiles').select('id').eq('user_id', user.id)` with data from the auth context.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/
git commit -m "feat: rewrite org, role, scoped data, and activity hooks with tRPC"
```

---

### Task 38: Migrate auth pages

**Files:**
- Modify: `src/components/auth/AuthPage.tsx` (or equivalent login/signup page)
- Modify: `src/pages/AcceptInvitePage.tsx`
- Modify: `src/components/org/OrganizationSetup.tsx`
- Modify: `src/components/org/InvitationAcceptance.tsx`

- [ ] **Step 1: Migrate AuthPage**

Replace Supabase auth calls with Better Auth client calls. Use `authClient.signIn.email()` and `authClient.signUp.email()`.

- [ ] **Step 2: Migrate AcceptInvitePage**

This is the most complex auth page. Current flow:
1. Get session → signOut → setSession with invite tokens → updateUser password

New flow:
1. Read invitation by token via `trpc.invitations.getByToken.useQuery()`
2. Show form (password if new user)
3. Submit via `trpc.invitations.accept.useMutation()`
4. Auto-login via response

- [ ] **Step 3: Migrate OrganizationSetup**

Replace `supabase.rpc('create_organization_and_profile')` with `trpc.setup.create.useMutation()`.

- [ ] **Step 4: Migrate InvitationAcceptance**

Replace `supabase.rpc('accept_invitation')` with `trpc.invitations.accept.useMutation()`.

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/ src/pages/AcceptInvitePage.tsx src/components/org/
git commit -m "feat: migrate auth pages to Better Auth + tRPC"
```

---

### Task 39: Migrate admin components

**Files:**
- Modify: `src/components/admin/UserManagementSettings.tsx`
- Modify: `src/components/admin/CreateUser.tsx`
- Modify: `src/components/admin/InviteUser.tsx`
- Modify: `src/components/admin/DepartmentManagement.tsx`
- Modify: `src/components/admin/TeamManagement.tsx`
- Modify: `src/components/admin/AIModelsManagement.tsx`
- Modify: `src/components/admin/ActivityLogViewer.tsx`
- Modify: `src/components/admin/TimeOffTypesManagement.tsx`
- Modify: `src/components/admin/BountyTypesManagement.tsx`
- Modify: `src/components/admin/BrandingManagement.tsx`

- [ ] **Step 1: UserManagementSettings**

Replace `supabase.functions.invoke('delete-user')` with `trpc.users.delete.useMutation()`.
Replace `supabase.functions.invoke('revoke-invite')` with `trpc.users.revokeInvite.useMutation()`.
Replace profile/role queries with `trpc.profiles.list.useQuery()`.

- [ ] **Step 2: CreateUser**

Replace `supabase.functions.invoke('create-user')` with `trpc.users.create.useMutation()`.

- [ ] **Step 3: InviteUser**

Replace `supabase.functions.invoke('invite-user')` with `trpc.users.invite.useMutation()`.

- [ ] **Step 4: DepartmentManagement**

Replace `supabase.from('departments')` CRUD with `trpc.departments.*`.

- [ ] **Step 5: TeamManagement**

Replace `supabase.from('teams')` CRUD with `trpc.teams.*`.

- [ ] **Step 6: AIModelsManagement**

Replace `supabase.from('org_ai_config')` with `trpc.aiConfig.*`.

- [ ] **Step 7: ActivityLogViewer**

Replace `supabase.from('activity_logs')` with `trpc.activity.list.useQuery()`.

- [ ] **Step 8: TimeOffTypesManagement**

Replace with `trpc.timeOff.types.*`.

- [ ] **Step 9: BountyTypesManagement**

Replace with `trpc.incentives.types.*`.

- [ ] **Step 10: BrandingManagement**

Replace org branding queries with `trpc.org.update.useMutation()`. File upload (logo) uses the new `/api/uploads` endpoint instead of Supabase Storage.

- [ ] **Step 11: Commit**

```bash
git add src/components/admin/
git commit -m "feat: migrate all admin components to tRPC"
```

---

### Task 40: Migrate workspace tabs

**Files:**
- Modify: `src/components/workspace/tabs/AgentsTab.tsx`
- Modify: `src/components/workspace/tabs/MeasurablesTab.tsx`
- Modify: `src/components/workspace/tabs/SOPsTab.tsx`
- Modify: `src/components/workspace/tabs/ToolsTab.tsx`
- Modify: `src/components/workspace/tabs/MeetingsTab.tsx`
- Modify: `src/components/workspace/tabs/TasksTab.tsx`
- Modify: `src/components/workspace/tabs/ChatTab.tsx`
- Modify: `src/components/workspace/tabs/TeamsGridTab.tsx`

- [ ] **Step 1: AgentsTab** — Replace `supabase.from('agents')` with `trpc.agents.*`. Replace `supabase.from('org_ai_config')` with `trpc.agents.listAiProviders.useQuery()`.

- [ ] **Step 2: MeasurablesTab** — Replace with `trpc.measurables.*`

- [ ] **Step 3: SOPsTab** — Replace with `trpc.sops.*`

- [ ] **Step 4: ToolsTab** — Replace with `trpc.tools.*`

- [ ] **Step 5: MeetingsTab** — Replace with `trpc.meetings.*`

- [ ] **Step 6: TasksTab** — Replace with `trpc.tasks.*`

- [ ] **Step 7: ChatTab** — Replace with `trpc.chat.*` + WebSocket subscription for live messages

- [ ] **Step 8: TeamsGridTab** — Replace team member count queries with `trpc.teamMembers.listByTeam.useQuery()`

- [ ] **Step 9: Commit**

```bash
git add src/components/workspace/
git commit -m "feat: migrate all workspace tabs to tRPC"
```

---

### Task 41: Migrate remaining pages

**Files:**
- Modify: `src/pages/DepartmentPage.tsx`
- Modify: `src/pages/DepartmentsPage.tsx` (14 Supabase refs — complex cross-table counts)
- Modify: `src/pages/TeamPage.tsx`
- Modify: `src/pages/FunctionsPage.tsx`
- Modify: `src/pages/EmployeeJourneyPage.tsx`
- Modify: `src/pages/Index.tsx`
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/pages/TasksPage.tsx`
- Modify: `src/pages/AnalyticsPage.tsx` (7 refs — multi-table aggregation → `trpc.analytics.*`)
- Modify: `src/pages/AgentChatPage.tsx` (5 refs — creates conversations)
- Modify: `src/pages/manage/BountiesPage.tsx` (8 refs)
- Modify: `src/pages/manage/AppraisalsPage.tsx` (7 refs)
- Modify: `src/pages/manage/ReportsPage.tsx` (3 refs)
- Modify: `src/pages/me/AppraisalPage.tsx`
- Modify: `src/pages/me/BountiesPage.tsx`
- Modify: `src/pages/me/PerformancePage.tsx`

- [ ] **Step 1: Migrate DepartmentsPage** — Complex file with 14+ queries including cross-table counts (tools by dept, meetings by dept). Use `trpc.departments.list` + `trpc.analytics.dashboard` or add a `departments.withStats` query.

- [ ] **Step 2: Migrate AnalyticsPage** — Multi-table aggregation. Map to `trpc.analytics.*` queries.

- [ ] **Step 3: Migrate AgentChatPage** — Replace with `trpc.agentChat.*` and WebSocket client.

- [ ] **Step 4: Migrate manage/ pages** — BountiesPage, AppraisalsPage, ReportsPage → corresponding tRPC routes.

- [ ] **Step 5: Migrate me/ pages** — AppraisalPage, BountiesPage, PerformancePage → tRPC with user-scoped queries.

- [ ] **Step 6: Migrate remaining pages** — DepartmentPage, TeamPage, FunctionsPage, Dashboard, TasksPage, Index, EmployeeJourneyPage.

- [ ] **Step 7: Commit**

```bash
git add src/pages/
git commit -m "feat: migrate all page components to tRPC"
```

---

### Task 42: Migrate remaining components

**Files:**
- Modify: `src/components/employee-journey/EmployeeJourney.tsx`
- Modify: `src/components/employee-journey/JourneyView.tsx`
- Modify: `src/components/employee-journey/AddEventModal.tsx`
- Modify: `src/components/employee-journey/EmployeeSidebar.tsx`
- Modify: `src/components/org-chart/EnhancedOrgChart.tsx`
- Modify: `src/components/org-chart/OrgChart.tsx`
- Modify: `src/components/incentives/IncentiveSubmissionForm.tsx`
- Modify: `src/components/calendar/HolidayCalendar.tsx`
- Modify: `src/components/layout/DashboardLayout.tsx`
- Modify: `src/components/dashboard/DashboardContent.tsx`
- Modify: `src/components/navigation/AppSidebar.tsx`
- Modify: `src/components/navigation/UserProfileDropdown.tsx`
- Modify: `src/components/tasks/MyTasksView.tsx`
- Modify: `src/components/settings/UserSettings.tsx`
- Modify: `src/components/admin/AdminPanel.tsx`
- Modify: `src/components/admin/OrganizationManagement.tsx`
- Modify: `src/components/admin/PositionManagement.tsx`
- Modify: `src/components/admin/EmployeeDirectoryTable.tsx` (11 refs)
- Modify: `src/components/performance/ManagerPerformanceReviewDashboard.tsx`
- Modify: `src/components/academy/AcademyDashboard.tsx`
- Modify: `src/components/academy/CourseEditor.tsx`
- Modify: `src/components/academy/CourseViewer.tsx`
- Modify: `src/components/department/DepartmentDashboard.tsx`
- Modify: `src/components/department/DepartmentWorkspace.tsx`
- Modify: `src/components/function/FunctionGeneralInfo.tsx`
- Modify: `src/hooks/useAgentChat.ts` (uses Supabase Realtime — migrate to WebSocket)

- [ ] **Step 1: Migrate employee journey components** — Replace `supabase.from('trail_events')` with `trpc.journey.*`

- [ ] **Step 2: Migrate org chart components** — Replace profile/department/team queries with tRPC

- [ ] **Step 3: Migrate department + function components** — DepartmentDashboard, DepartmentWorkspace, FunctionGeneralInfo

- [ ] **Step 4: Migrate academy components** — AcademyDashboard, CourseEditor, CourseViewer → `trpc.academy.*`

- [ ] **Step 5: Migrate performance components** — ManagerPerformanceReviewDashboard → `trpc.reviews.*`

- [ ] **Step 6: Migrate admin components missed in Task 38** — AdminPanel, OrganizationManagement, PositionManagement, EmployeeDirectoryTable

- [ ] **Step 7: Migrate incentive + calendar components**

- [ ] **Step 8: Migrate layout/nav components** — DashboardLayout, DashboardContent, AppSidebar, UserProfileDropdown

- [ ] **Step 9: Migrate useAgentChat hook** — Replace `supabase.channel().subscribe()` with WebSocket client from `src/lib/ws.ts`. Replace `supabase.auth.getSession()` with Better Auth session.

- [ ] **Step 10: Migrate tasks + settings** — MyTasksView, UserSettings (replace `resetPasswordForEmail()` with Better Auth password reset — if no SMTP, disable the button)

- [ ] **Step 11: Commit**

```bash
git add src/components/ src/hooks/
git commit -m "feat: migrate all remaining components and hooks to tRPC"
```

---

### Task 43: Delete Supabase integration + types

**Files:**
- Delete: `src/integrations/supabase/client.ts`
- Delete: `src/integrations/supabase/types.ts`
- Delete: `src/integrations/supabase/` (entire directory)

- [ ] **Step 1: Delete Supabase client and types**

```bash
rm -rf src/integrations/supabase/
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: Build succeeds with zero references to `@supabase/supabase-js` or `src/integrations/supabase/`.

- [ ] **Step 3: Search for any remaining Supabase references**

```bash
grep -r "supabase" src/ --include="*.ts" --include="*.tsx" -l
```

Expected: No files found. If any remain, fix them.

- [ ] **Step 4: Remove Supabase dependency**

```bash
npm uninstall @supabase/supabase-js
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: remove Supabase integration entirely — fully migrated to tRPC + Better Auth"
```

---

## Chunk 8: Deploy + Cleanup

### Task 44: Rewrite deploy.sh

**Files:**
- Modify: `deploy.sh`

- [ ] **Step 1: Rewrite deploy script**

WordPress-style flow:
1. Ask domain
2. Ask app name (optional, default: Seaport)
3. Generate DB_PASSWORD and SESSION_SECRET with `openssl rand -base64 32`
4. Write `.env` with DATABASE_URL, SESSION_SECRET, SITE_URL, APP_NAME
5. `docker compose up -d --build`
6. Print: "Visit https://{domain} to set up your organization"
7. Ask about SSL → run certbot if yes

Remove all Supabase-related config generation (Kong, JWT, anon key, service role key, Studio).

- [ ] **Step 2: Commit**

```bash
git add deploy.sh
git commit -m "feat: rewrite deploy.sh for 2-question WordPress-style setup"
```

---

### Task 45: Update .env.example

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Rewrite .env.example**

```env
# Required (auto-generated by deploy.sh)
DATABASE_URL=postgresql://seaport:changeme@db:5432/seaport
SESSION_SECRET=changeme
SITE_URL=https://your-domain.com

# Optional
APP_NAME=Seaport
PORT=3000

# Optional: Email (for invite emails and notifications)
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=you@example.com
# SMTP_PASS=your-smtp-password
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: update .env.example for new stack (3 required vars)"
```

---

### Task 46: Delete Supabase infrastructure

**Files:**
- Delete: `supabase/` directory (functions/, migrations/, config.toml)
- Delete: `agent-runtime/` directory (consolidated into server/agents/)
- Modify: `.gitignore`

- [ ] **Step 1: Delete Supabase directory**

```bash
rm -rf supabase/
rm -rf agent-runtime/
```

- [ ] **Step 2: Update .gitignore**

Remove Supabase and agent-runtime entries. Add:
```
drizzle/
dist/
server/dist/
uploads/
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove Supabase and agent-runtime directories (fully replaced)"
```

---

### Task 47: Setup wizard frontend page

**Files:**
- Create: `src/pages/SetupPage.tsx`
- Modify: `src/App.tsx` (add route)

- [ ] **Step 1: Create SetupPage**

WordPress-style setup page:
- Org name input
- Admin full name, email, password inputs
- Submit calls `trpc.setup.create.useMutation()`
- On success, auto-login and redirect to dashboard

The page should only be accessible when `trpc.setup.check.useQuery()` returns `needsSetup: true`. Otherwise redirect to login.

- [ ] **Step 2: Add route to App.tsx**

Add `/setup` route that renders `SetupPage`. The root `/` route should check `setup.check` and redirect to `/setup` if needed.

- [ ] **Step 3: Commit**

```bash
git add src/pages/SetupPage.tsx src/App.tsx
git commit -m "feat: add WordPress-style setup wizard page"
```

---

### Task 48: Final build verification

- [ ] **Step 1: Run frontend build**

Run: `npm run build`
Expected: Clean build, zero errors.

- [ ] **Step 2: Run server build**

Run: `npx tsup server/index.ts --format esm --outDir dist`
Expected: Clean build.

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: Zero type errors.

- [ ] **Step 4: Search for orphaned Supabase references**

```bash
grep -r "supabase" . --include="*.ts" --include="*.tsx" --include="*.json" -l | grep -v node_modules | grep -v ".git"
```

Expected: Only `docs/` files (spec, plan) and possibly this plan file. Zero source code references.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore: final cleanup — verify clean build with zero Supabase references"
```

---

### Task 49: Update package.json scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update scripts**

```json
{
  "scripts": {
    "dev": "concurrently \"vite\" \"tsx watch server/index.ts\"",
    "build": "vite build && tsup server/index.ts --format esm --outDir dist",
    "start": "node dist/index.js",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "preview": "vite preview"
  }
}
```

Install: `npm install -D concurrently`

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: update package.json scripts for Hono + Vite dev/build"
```

---

## Summary

| Chunk | Tasks | What it delivers |
|-------|-------|-----------------|
| 1: Server Skeleton | 1-12 | Hono server starts, Drizzle schema for all 37 tables, Better Auth, tRPC skeleton, Docker config, Vite proxy |
| 2: Auth + Core Routes | 13-20 | Setup wizard, login, user management (replaces 5 Edge Functions + 3 RPCs), departments, teams, profiles |
| 3: Feature Routes | 21-27 | All remaining tables accessible via tRPC (reviews, incentives, academy, tasks, etc.) |
| 4: Agent System | 28-31 | Agent CRUD, tier-based access control, WebSocket chat, tool connections |
| 5: Chat + Realtime | 32-33 | Team chat, WebSocket pub/sub for live updates |
| 6: File Storage | 34 | Upload endpoint for org logos, static frontend serving (needed before frontend migration) |
| 7: Frontend Migration | 35-42 | All 70 files migrated from Supabase to tRPC + Better Auth, Supabase deleted |
| 8: Deploy + Cleanup | 43-49 | Setup wizard page, deploy.sh rewrite, final verification |

**Total: 49 tasks across 8 chunks.**

After completion: Seaport runs in 2 Docker containers with 3 env vars. WordPress for orgs.
