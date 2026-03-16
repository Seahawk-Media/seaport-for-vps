# Seaport: Supabase to Hono Migration — Full Design Spec

**Date:** 2026-03-16
**Goal:** Replace the entire Supabase stack with a single Hono server + plain Postgres. Make Seaport deploy like WordPress — one command, two containers, zero external dependencies.

**Vision:** Seaport is the WordPress of Org OS for VPS hosters. Businesses get a platform to document their company, build always-on AI agents with org context (like OpenClaw but multi-tenant), and centralize their internal tool portfolio to replace SaaS subscriptions over time.

---

## 1. Server Architecture

### Stack
- **Hono** — HTTP server, static file serving, WebSocket
- **Drizzle ORM** — type-safe Postgres queries, migration generation
- **Better Auth** — server-side sessions, email/password, roles, invite flows
- **tRPC** — end-to-end type-safe client-server communication
- **PostgreSQL 15** — the only external dependency

### Directory Structure
```
server/
├── index.ts              # Hono app entry, static files, WS upgrade
├── db/
│   ├── schema.ts         # Drizzle schema (all tables)
│   ├── index.ts          # Drizzle client + connection pool
│   └── seed.ts           # Default data (position_roles, review_templates, departments, teams)
├── auth/
│   └── index.ts          # Better Auth config
├── trpc/
│   ├── router.ts         # Root tRPC router (merges all sub-routers)
│   ├── context.ts        # Per-request context (session, db, org)
│   └── routes/
│       ├── setup.ts      # First-run wizard (create org + admin)
│       ├── org.ts        # Organization CRUD + branding (colors, logo)
│       ├── users.ts      # Create/delete/list users (replaces 5 Edge Functions)
│       ├── departments.ts
│       ├── teams.ts      # Teams + team_members junction
│       ├── profiles.ts
│       ├── positions.ts  # position_roles + position_changes
│       ├── agents.ts     # Agent CRUD + tool connections
│       ├── agent-chat.ts # Conversations + messages
│       ├── reviews.ts    # Performance reviews + review_templates
│       ├── promotions.ts # Promotions (appraisal tracking)
│       ├── measurables.ts
│       ├── incentives.ts # Incentives + incentive_types
│       ├── academy.ts    # Courses, course_pages, course_progress
│       ├── tools.ts      # Internal business apps
│       ├── tasks.ts      # Task management
│       ├── meetings.ts   # Meeting management
│       ├── sops.ts
│       ├── calendar.ts   # Holidays
│       ├── core-values.ts
│       ├── time-off.ts   # Time off requests, balances, time_off_types
│       ├── overtime.ts
│       ├── feedback.ts
│       ├── activity.ts   # Audit log
│       ├── analytics.ts  # Cross-table aggregation for dashboard
│       ├── ai-config.ts  # org_ai_config (BYOK provider management)
│       └── invitations.ts # Invite links (no SMTP required)
├── agents/
│   ├── runtime.ts        # Always-on agent lifecycle manager
│   ├── chat-ws.ts        # WebSocket handler for agent chat
│   ├── access.ts         # Tier-based access control (TypeScript, not PL/pgSQL)
│   ├── context.ts        # Scoped org data retrieval per agent tier
│   └── tools.ts          # Tool connection manager (API keys, MCP, CLI)
├── middleware/
│   ├── auth.ts           # Session validation
│   ├── roles.ts          # Role-based route guards
│   └── org.ts            # Org-scoped request context
├── storage/
│   └── uploads.ts        # File upload handler (org logos) — serves from Docker volume
└── ws/
    └── realtime.ts       # Pub/sub for live updates (chat, agent messages, activity)
```

### Production Docker Stack
```yaml
services:
  db:
    image: postgres:15-alpine
    restart: unless-stopped
    volumes:
      - db-data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: seaport
      POSTGRES_USER: seaport
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U seaport"]
      interval: 5s
      timeout: 5s
      retries: 5

  seaport:
    build: .
    restart: unless-stopped
    ports:
      - "${PORT:-3000}:3000"
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - uploads:/app/uploads
    environment:
      DATABASE_URL: postgresql://seaport:${DB_PASSWORD}@db:5432/seaport
      SESSION_SECRET: ${SESSION_SECRET}
      SITE_URL: ${SITE_URL}
      PORT: 3000

volumes:
  db-data:
  uploads:
```

Two containers. Hono serves the built frontend as static files — no Nginx needed. File uploads (org logos) stored in a Docker volume and served directly by Hono.

---

## 2. Database Layer (Drizzle)

### Schema Design

All existing tables carry over 1:1 with exact column names from the current database. RLS policies are removed — access control moves to tRPC middleware. PL/pgSQL functions become TypeScript. The `canvas_notes` table was already dropped and is NOT carried over.

**New tables (not in current DB):**
- `agent_tool_connections` — net-new for the tool connection feature
- Better Auth managed tables: `users` (auth), `sessions`, `accounts`, `verifications`

**Schema changes:**
- `invitations` gains a `token` column (TEXT UNIQUE) for link-based invites without SMTP
- All `auth.users` references become `users` references (Better Auth manages its own user table)
- `agent_conversations.user_id` references `users` instead of `auth.users`
- `trail_events.created_by` references `users` instead of `auth.users`
- `invitations.invited_by` references `users` instead of `auth.users`

#### Core Tables

**organizations**
- id (UUID PK), name (TEXT), slug (TEXT UNIQUE), created_by (UUID FK→users), primary_color (TEXT), accent_color (TEXT), logo_url (TEXT), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)

**profiles**
- id (UUID PK), user_id (UUID FK→users UNIQUE), organization_id (UUID FK→organizations), full_name (TEXT), email (TEXT), avatar_url (TEXT), job_title (TEXT), phone (TEXT), location (TEXT), manager_id (UUID FK→profiles), department_id (UUID FK→departments), position_id (UUID FK→position_roles), status (TEXT DEFAULT 'active'), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)

**user_roles**
- id (UUID PK), user_id (UUID FK→users), role (app_role ENUM), assigned_by (UUID FK→users), assigned_at (TIMESTAMPTZ)
- UNIQUE(user_id, role)

**role_audit_log**
- id (UUID PK), user_id (UUID), role (app_role), action (TEXT), performed_by (UUID), performed_at (TIMESTAMPTZ)

**invitations**
- id (UUID PK), organization_id (UUID FK→organizations), email (TEXT), role (app_role DEFAULT 'employee'), token (TEXT UNIQUE), invited_by (UUID FK→users), accepted (BOOLEAN DEFAULT false), accepted_at (TIMESTAMPTZ), expires_at (TIMESTAMPTZ DEFAULT now()+7d), created_at (TIMESTAMPTZ)
- UNIQUE(organization_id, email)

#### Org Structure

**departments**
- id (UUID PK), organization_id (UUID FK→organizations), name (TEXT), description (TEXT), parent_id (UUID FK→departments), head_id (UUID FK→profiles), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)

**teams**
- id (UUID PK), organization_id (UUID FK→organizations), department_id (UUID FK→departments), name (TEXT), description (TEXT), team_type (TEXT DEFAULT 'project'), team_lead_id (UUID FK→profiles), slack_channel (TEXT), components (TEXT), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)

**team_members**
- id (UUID PK), team_id (UUID FK→teams), profile_id (UUID FK→profiles), organization_id (UUID FK→organizations), role (TEXT DEFAULT 'member'), joined_at (TIMESTAMPTZ)
- UNIQUE(team_id, profile_id)

**position_roles**
- id (UUID PK), organization_id (UUID FK→organizations), title (TEXT), description (TEXT), created_at (TIMESTAMPTZ)

#### HR / Employee Management

**trail_events**
- id (UUID PK), profile_id (UUID FK→profiles), organization_id (UUID FK→organizations), event_type (TEXT), title (TEXT), description (TEXT), event_date (DATE), metadata (JSONB), created_by (UUID FK→users), created_at (TIMESTAMPTZ)

**performance_reviews**
- id (UUID PK), employee_id (UUID FK→profiles), reviewer_id (UUID FK→profiles), organization_id (UUID FK→organizations), template_id (UUID FK→review_templates), review_period_start (DATE), review_period_end (DATE), status (TEXT DEFAULT 'draft'), overall_rating (NUMERIC(3,2)), criteria_scores (JSONB), strengths (TEXT), areas_for_improvement (TEXT), goals (TEXT), employee_comments (TEXT), reviewer_comments (TEXT), submitted_at (TIMESTAMPTZ), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)

**review_templates**
- id (UUID PK), organization_id (UUID FK→organizations), name (TEXT), description (TEXT), criteria (JSONB DEFAULT '[]'), is_default (BOOLEAN DEFAULT false), created_by (UUID), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)

**promotions** (appraisal/review scheduling — NOT position changes)
- id (UUID PK), profile_id (UUID FK→profiles UNIQUE), organization_id (UUID FK→organizations), role_title (TEXT), salary_band (TEXT), next_review_date (DATE), last_review_date (DATE), notes (TEXT), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)

**position_changes** (actual position/department changes)
- id (UUID PK), profile_id (UUID FK→profiles), organization_id (UUID FK→organizations), previous_position_id (UUID FK→position_roles), new_position_id (UUID FK→position_roles), previous_department_id (UUID FK→departments), new_department_id (UUID FK→departments), effective_date (DATE), notes (TEXT), approved_by (UUID FK→users), created_at (TIMESTAMPTZ)

**overtime_entries**
- id (UUID PK), profile_id (UUID FK→profiles), organization_id (UUID FK→organizations), date (DATE), hours (NUMERIC(4,2)), description (TEXT), status (TEXT DEFAULT 'pending'), approved_by (UUID FK→users), created_at (TIMESTAMPTZ)

**time_off_requests**
- id (UUID PK), profile_id (UUID FK→profiles), organization_id (UUID FK→organizations), request_type (TEXT), start_date (DATE), end_date (DATE), total_days (NUMERIC(4,1)), reason (TEXT), status (TEXT DEFAULT 'pending'), reviewed_by (UUID FK→users), reviewed_at (TIMESTAMPTZ), created_at (TIMESTAMPTZ)

**time_off_balances**
- id (UUID PK), profile_id (UUID FK→profiles), organization_id (UUID FK→organizations), leave_type (TEXT), year (INTEGER), total_days (NUMERIC(4,1) DEFAULT 0), used_days (NUMERIC(4,1) DEFAULT 0), remaining_days (NUMERIC(4,1) GENERATED ALWAYS AS (total_days - used_days) STORED)
- UNIQUE(profile_id, leave_type, year)

**time_off_types**
- id (UUID PK), organization_id (UUID), name (TEXT), description (TEXT), default_days_per_year (NUMERIC DEFAULT 0), is_active (BOOLEAN DEFAULT true), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)

#### Operational

**measurables**
- id (UUID PK), organization_id (UUID FK→organizations), team_id (UUID FK→teams), name (TEXT), description (TEXT), target_value (NUMERIC), current_value (NUMERIC), unit (TEXT), owner_id (UUID FK→profiles), frequency (TEXT DEFAULT 'weekly'), created_by (UUID FK→profiles), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)

**incentives**
- id (UUID PK), profile_id (UUID FK→profiles), organization_id (UUID FK→organizations), incentive_type (TEXT), title (TEXT), description (TEXT), evidence_url (TEXT), points (INTEGER DEFAULT 0), status (TEXT DEFAULT 'pending'), reviewed_by (UUID FK→profiles), reviewed_at (TIMESTAMPTZ), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)

**incentive_types**
- id (UUID PK), organization_id (UUID), name (TEXT), description (TEXT), default_points (INTEGER DEFAULT 10), is_active (BOOLEAN DEFAULT true), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)

**sops**
- id (UUID PK), organization_id (UUID), department_id (UUID FK→departments), team_id (UUID FK→teams), title (TEXT), content (TEXT), category (TEXT), version (TEXT DEFAULT '1.0'), status (TEXT DEFAULT 'active'), created_by (UUID), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)

**tasks**
- id (UUID PK), organization_id (UUID), department_id (UUID FK→departments), team_id (UUID FK→teams), title (TEXT), description (TEXT), status (TEXT DEFAULT 'todo'), priority (TEXT DEFAULT 'medium'), due_date (DATE), assigned_to (UUID FK→profiles), created_by (UUID), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)

**meetings**
- id (UUID PK), organization_id (UUID), department_id (UUID FK→departments), team_id (UUID FK→teams), title (TEXT), description (TEXT), meeting_url (TEXT), recurrence (TEXT), scheduled_at (TIMESTAMPTZ), duration_minutes (INTEGER), created_by (UUID), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)

**tools**
- id (UUID PK), organization_id (UUID), department_id (UUID FK→departments), team_id (UUID FK→teams), name (TEXT), description (TEXT), url (TEXT), icon (TEXT), created_by (UUID), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)

**holidays**
- id (UUID PK), organization_id (UUID FK→organizations), name (TEXT), date (DATE), description (TEXT), country (TEXT), is_recurring (BOOLEAN DEFAULT false), created_by (UUID), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)

**core_values** — id (UUID PK), title (TEXT), description (TEXT), organization_id (UUID), created_at (TIMESTAMPTZ)

**feedback**
- id (UUID PK), organization_id (UUID), profile_id (UUID), title (TEXT), description (TEXT), status (TEXT DEFAULT 'pending'), priority (TEXT DEFAULT 'medium'), admin_notes (TEXT), target_quarter (TEXT), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)

**activity_logs**
- id (UUID PK), profile_id (UUID FK→profiles), organization_id (UUID FK→organizations), activity_type (TEXT), description (TEXT), metadata (JSONB), ip_address (TEXT), user_agent (TEXT), page_path (TEXT), created_at (TIMESTAMPTZ)

#### Learning & Development

**courses**
- id (UUID PK), organization_id (UUID), title (TEXT), description (TEXT), status (TEXT DEFAULT 'draft' CHECK ('draft','published','archived')), created_by (UUID), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)

**course_pages**
- id (UUID PK), course_id (UUID FK→courses), organization_id (UUID), title (TEXT), content (TEXT), page_order (INTEGER DEFAULT 0), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)

**course_progress**
- id (UUID PK), course_id (UUID FK→courses), profile_id (UUID), organization_id (UUID), current_page_order (INTEGER DEFAULT 0), completed_at (TIMESTAMPTZ), started_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)
- UNIQUE(course_id, profile_id)

#### Chat System

**chat_channels**
- id (UUID PK), organization_id (UUID), department_id (UUID FK→departments), team_id (UUID FK→teams), name (TEXT), description (TEXT), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)

**chat_messages**
- id (UUID PK), channel_id (UUID FK→chat_channels), sender_id (UUID FK→profiles), content (TEXT), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)

#### Agent System

**agents**
- id (UUID PK), organization_id (UUID), department_id (UUID FK→departments), team_id (UUID FK→teams), name (TEXT), description (TEXT), type (TEXT), tier (TEXT DEFAULT 'functional' CHECK ('general','departmental','functional')), system_prompt (TEXT), ai_provider (TEXT), ai_model (TEXT), config (JSONB DEFAULT '{}'), openclaw_agent_id (TEXT), tools (JSONB DEFAULT '[]'), channel_config (JSONB DEFAULT '{}'), memory_config (JSONB DEFAULT '{}'), always_on (BOOLEAN DEFAULT true), status (TEXT DEFAULT 'inactive'), created_by (UUID), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)

**agent_conversations**
- id (UUID PK), organization_id (UUID FK→organizations), agent_id (UUID FK→agents), user_id (UUID FK→users), title (TEXT), status (TEXT DEFAULT 'active' CHECK ('active','archived')), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)

**agent_messages**
- id (UUID PK), conversation_id (UUID FK→agent_conversations), role (TEXT CHECK ('user','assistant','system','tool')), content (TEXT), metadata (JSONB DEFAULT '{}'), token_count (INTEGER), created_at (TIMESTAMPTZ)

**agent_tool_connections** (NEW — not in current DB)
- id (UUID PK), agent_id (UUID FK→agents), tool_id (UUID FK→tools), connection_type (TEXT CHECK ('api_key','mcp','cli','oauth')), credentials_encrypted (TEXT), config (JSONB DEFAULT '{}'), organization_id (UUID), created_at (TIMESTAMPTZ)

**org_ai_config**
- id (UUID PK), organization_id (UUID FK→organizations), provider (TEXT), api_key_hint (TEXT), is_enabled (BOOLEAN DEFAULT false), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)
- UNIQUE(organization_id, provider)

### Migration Strategy
- Drizzle schema defined in `server/db/schema.ts`
- `drizzle-kit generate` creates SQL migration files in `drizzle/`
- `drizzle-kit migrate` runs them on server startup (or `drizzle-kit push` in dev)
- First-run detection: if `organizations` table is empty, redirect to setup wizard
- No data migration from Supabase auth.users — this is a clean-slate rebuild, no existing deployments to migrate

### Default Seed Data (on first run after setup wizard)
- 13 default position_roles (CEO, CTO, CFO, VP, Director, Manager, Senior Developer, Developer, Junior Developer, Designer, Analyst, HR Manager, Recruiter)
- 1 default review_template ("Standard Performance Review" with 13 criteria)
- 5 default departments (Engineering, Marketing, Sales, HR, Finance)
- 4 default teams (QA Team, DevOps Team, Product Team, Security Team)

### Access Control Pattern
```typescript
// Replaces ALL RLS policies with explicit middleware
const orgScoped = middleware(async ({ ctx, next }) => {
  // Every query automatically scoped to user's org
  return next({ ctx: { ...ctx, orgId: ctx.session.orgId } });
});

const requireRole = (...roles: AppRole[]) =>
  middleware(async ({ ctx, next }) => {
    if (!roles.includes(ctx.session.role)) throw new TRPCError({ code: 'FORBIDDEN' });
    return next();
  });
```

---

## 3. Authentication (Better Auth)

### Why Better Auth
- Server-side sessions stored in Postgres (not JWTs)
- httpOnly secure cookies — tokens never touch client JS
- Built-in email/password, session management, account linking
- Plugin system for roles, organizations, invitations
- No separate auth service — runs inside Hono

### Configuration
```typescript
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization, roles } from 'better-auth/plugins';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: { enabled: true },
  session: {
    cookieCache: { enabled: true, maxAge: 60 * 5 }, // 5 min cache
    expiresIn: 60 * 60 * 24 * 7, // 7 days
  },
  plugins: [
    organization(),  // multi-org support
    roles(),         // role-based access
  ],
});
```

### WordPress-Style Setup Flow
1. Server starts → checks if `organizations` table has any rows
2. If empty → serves setup wizard page (no auth required)
3. Wizard collects: org name, admin full name, admin email, admin password
4. Creates organization + admin profile + super_admin role in one transaction
5. Seeds default data (position roles, review template, departments, teams)
6. Auto-signs in the admin → redirects to dashboard
7. All subsequent visits require login

### User Management (Replaces 5 Edge Functions)
- **Create user:** Admin fills form (name, email, password, role) → tRPC `users.create` → creates auth account + profile + role. No email needed.
- **Invite user (optional):** If SMTP configured, admin can send email invite. If not, generates a URL with token the admin can copy/paste/share.
- **Delete user:** tRPC `users.delete` → removes profile, role, and auth account in transaction
- **Revoke invite:** tRPC `invitations.revoke` → marks invitation as revoked, invalidates token

### Session Flow
1. User submits email + password
2. Better Auth verifies credentials, creates session row in Postgres
3. Sets httpOnly cookie with session token
4. Every request: middleware reads cookie → looks up session → attaches user + org to context
5. Sign out: deletes session row, clears cookie
6. Admin can revoke any session instantly (kill active login)

---

## 4. tRPC Layer

### Why tRPC
- Change a server function → get a TypeScript error in the frontend immediately
- No API client generation, no OpenAPI spec, no fetch boilerplate
- React Query integration built-in (caching, optimistic updates, refetching)
- Works with Hono via `@trpc/server/adapters/fetch`

### Router Structure
```typescript
// server/trpc/router.ts
export const appRouter = createRouter({
  setup: setupRouter,
  auth: authRouter,
  org: orgRouter,
  users: usersRouter,
  invitations: invitationsRouter,
  departments: departmentsRouter,
  teams: teamsRouter,
  teamMembers: teamMembersRouter,
  profiles: profilesRouter,
  positions: positionsRouter,       // position_roles + position_changes
  agents: agentsRouter,
  agentChat: agentChatRouter,
  reviews: reviewsRouter,           // performance_reviews + review_templates
  promotions: promotionsRouter,     // appraisal scheduling
  measurables: measurablesRouter,
  incentives: incentivesRouter,     // incentives + incentive_types
  academy: academyRouter,           // courses, course_pages, course_progress
  tools: toolsRouter,
  tasks: tasksRouter,
  meetings: meetingsRouter,
  sops: sopsRouter,
  calendar: calendarRouter,         // holidays
  coreValues: coreValuesRouter,
  timeOff: timeOffRouter,           // requests, balances, time_off_types
  overtime: overtimeRouter,
  feedback: feedbackRouter,
  activity: activityRouter,
  analytics: analyticsRouter,       // cross-table aggregation for dashboards
  aiConfig: aiConfigRouter,         // org_ai_config (BYOK provider management)
});

export type AppRouter = typeof appRouter;
```

### Frontend Usage
```typescript
// src/lib/trpc.ts
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../server/trpc/router';

export const trpc = createTRPCReact<AppRouter>();

// In any component:
const { data: departments } = trpc.departments.list.useQuery();
const createDept = trpc.departments.create.useMutation();
```

Replaces every `supabase.from('departments').select('*')` call with a type-safe hook.

### Context Per Request
```typescript
// server/trpc/context.ts
export async function createContext({ req }) {
  const session = await auth.api.getSession({ headers: req.headers });
  return {
    db,
    session,       // null if not authenticated
    orgId: session?.orgId,
    userId: session?.userId,
    role: session?.role,
  };
}
```

---

## 5. Realtime (WebSocket)

### What Needs Realtime
1. **Agent chat** — messages stream in as the agent responds
2. **Team chat** — live messaging in department/team channels
3. **Activity feed** — live activity log updates on dashboard

### Implementation
Hono's built-in WebSocket adapter. Single upgrade endpoint at `/ws`.

```typescript
// server/ws/realtime.ts
// Client connects: ws://host/ws?token=<session-token>
// Server validates session, subscribes to channels
// Message format: { type: 'agent_message' | 'chat_message' | 'activity', channel: string, data: any }
```

### Agent Chat Flow
1. User opens agent chat → frontend connects to `ws://host/ws`
2. Server validates session cookie, checks `access.canAccessAgent(userId, agentId)`
3. User sends message → server stores in `agent_messages`, forwards to agent runtime
4. Agent runtime streams response tokens back via same WebSocket
5. Complete response stored in `agent_messages`

### Team Chat Flow
1. User opens channel → subscribes to `chat:${channelId}`
2. Messages broadcast to all connected users in that channel
3. Messages persisted to `chat_messages` table

Replaces Supabase Realtime's `channel().on('INSERT').subscribe()` pattern.

---

## 6. Agent Runtime

### Architecture
The agent runtime is embedded in the Hono server (not a separate service). The existing `agent-runtime/` directory is consolidated into `server/agents/`. The standalone agent-runtime Docker service is removed.

```
server/agents/
├── runtime.ts    # Agent lifecycle: load from DB, keep alive, restart on config change
├── chat-ws.ts    # WebSocket message handler for agent conversations
├── access.ts     # canAccessAgent() — TypeScript replacement for PL/pgSQL function
├── context.ts    # getAgentContext() — scoped org data based on agent tier
└── tools.ts      # Tool connection manager (API keys, MCP, CLI)
```

### Access Control (Replaces can_access_agent PL/pgSQL)
```typescript
async function canAccessAgent(userId: string, agentId: string): Promise<boolean> {
  const agent = await db.query.agents.findFirst({ where: eq(agents.id, agentId) });
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });

  if (agent.tier === 'general') return agent.organizationId === profile.organizationId;
  if (agent.tier === 'departmental') return agent.departmentId === profile.departmentId;
  if (agent.tier === 'functional') {
    // Check team_members junction table
    const membership = await db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.profileId, profile.id), eq(teamMembers.teamId, agent.teamId))
    });
    return !!membership;
  }
  return false;
}
```

### Context Retrieval (Replaces get_agent_context PL/pgSQL)
```typescript
async function getAgentContext(agentId: string): Promise<AgentContext> {
  const agent = await db.query.agents.findFirst({ where: eq(agents.id, agentId) });

  if (agent.tier === 'general') {
    // Return all org data: departments, teams, employees, measurables
  } else if (agent.tier === 'departmental') {
    // Return department-scoped data only
  } else {
    // Return team-scoped data only
  }
}
```

### Tool Connections
Agents can connect to tools via three methods:
- **API Key** — stored encrypted in `agent_tool_connections.credentials_encrypted`
- **MCP Server** — URL + auth config stored in `agent_tool_connections.config`
- **CLI** — command templates with sandboxed execution

Tool connections are scoped per agent and inherit from the org's tool catalog.

---

## 7. File Storage

### Current State
Supabase Storage with an `org-logos` bucket for organization logo uploads (used by `BrandingManagement.tsx`). Allowed types: PNG, JPEG, SVG, WebP. Max 5MB.

### Replacement
Hono serves uploaded files from a Docker volume mounted at `/app/uploads`. Simple file upload endpoint:

```typescript
// server/storage/uploads.ts
// POST /api/uploads — multipart file upload, returns URL
// GET /uploads/:filename — serves static files from volume
// Validates: file type (image/*), max size (5MB)
// Stores as: /app/uploads/org-{orgId}/{uuid}.{ext}
```

No S3, no external storage service. Just a local directory in a Docker volume — persists across container restarts, easy to back up.

---

## 8. Frontend Changes

### What Changes
- Delete `src/integrations/supabase/` entirely (client.ts, types.ts)
- Replace `supabase.from().select()` with `trpc.*.useQuery()` in every component
- Replace `supabase.auth.*` with Better Auth client calls
- Replace `supabase.channel().subscribe()` with native WebSocket
- Replace `supabase.functions.invoke()` with tRPC mutations
- Replace `supabase.rpc()` with tRPC queries

### New Client Setup
```
src/
├── lib/
│   ├── trpc.ts          # tRPC React client + provider
│   ├── auth-client.ts   # Better Auth client
│   └── ws.ts            # WebSocket client for realtime
```

### Auth Provider Rewrite
```typescript
// Current: useAuth wraps supabase.auth.onAuthStateChange
// New: useAuth wraps Better Auth's useSession hook
import { createAuthClient } from 'better-auth/react';

const authClient = createAuthClient();

function AuthProvider({ children }) {
  const { data: session, isPending } = authClient.useSession();
  // Same interface: user, session, loading, signIn, signUp, signOut
}
```

### Query Migration Pattern
Every component follows this transformation:
```typescript
// BEFORE (Supabase)
const { data } = await supabase.from('departments').select('*').eq('organization_id', orgId);

// AFTER (tRPC)
const { data } = trpc.departments.list.useQuery();
// org scoping happens server-side automatically via session context
```

### Setup Wizard (New)
New page at `/setup` — shown only when no organization exists:
1. Org name input
2. Admin name, email, password inputs
3. Submit → creates everything → auto-login → dashboard

---

## 9. Deploy Script (deploy.sh) Rewrite

### WordPress-Style Flow
```bash
./deploy.sh
# 1. "What's your domain?" → example.com
# 2. "What do you want to call your org platform?" → Acme HQ (optional, default: Seaport)
# 3. Generates DB_PASSWORD, SESSION_SECRET automatically
# 4. Writes .env
# 5. docker compose up -d
# 6. Prints: "Visit https://example.com to set up your organization"
# 7. Optional: "Want to set up SSL now? (requires certbot)" → runs certbot
```

No SMTP questions (configurable later from admin settings). No API keys. No Supabase config. Two questions, done.

### Nginx Config (generated by deploy.sh)
```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Single proxy to Hono. WebSocket upgrade headers included.

---

## 10. Environment Variables

### Required
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Secret for signing session cookies |
| `SITE_URL` | Public URL (e.g., https://example.com) |

### Optional
| Variable | Description |
|---|---|
| `PORT` | Server port (default: 3000) |
| `APP_NAME` | Display name (default: Seaport) |
| `SMTP_HOST` | SMTP server for email notifications |
| `SMTP_PORT` | SMTP port (default: 587) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `UPLOAD_MAX_SIZE` | Max upload size in bytes (default: 5242880) |

3 required vars. WordPress asks for 4 (db host, db name, db user, db pass).

---

## 11. What Gets Deleted

### Supabase Infrastructure
- `supabase/` directory (functions/, migrations/, config.toml)
- `src/integrations/supabase/` (client.ts, types.ts)
- `agent-runtime/` directory (consolidated into server/agents/)
- All Supabase-related Docker services (auth, rest, realtime, storage, imgproxy, functions, kong, studio, meta) — 9 services removed
- Agent-runtime Docker service — 1 service removed (merged into main server)
- Kong configuration generation in deploy.sh

### Replaced By
- `server/` directory (Hono + Drizzle + Better Auth + tRPC + agents + storage)
- `drizzle/` directory (generated migrations)
- `src/lib/` (trpc.ts, auth-client.ts, ws.ts)
- 2 Docker services (db + seaport)

---

## 12. Migration Checklist

### Phase 1: Server Skeleton
- [ ] Initialize server/ with Hono, Drizzle, Better Auth, tRPC
- [ ] Define full Drizzle schema from audited table list (all 30+ tables)
- [ ] Configure Better Auth with email/password + org plugin
- [ ] Set up tRPC router with all 28 sub-routers (stubs)
- [ ] File upload handler for org logos
- [ ] Dockerfile for single container (Node.js + built frontend)
- [ ] docker-compose.yml (postgres + seaport only, with uploads volume)

### Phase 2: Auth + Setup Wizard
- [ ] Setup wizard tRPC route (create org + admin + seed defaults)
- [ ] Setup wizard frontend page
- [ ] Auth provider rewrite (Better Auth client)
- [ ] Login/signup page updates
- [ ] Session middleware
- [ ] Role middleware (super_admin, admin, manager, employee)

### Phase 3: Core tRPC Routes
- [ ] Organizations CRUD (including branding: colors, logo upload)
- [ ] Departments CRUD
- [ ] Teams CRUD + team_members
- [ ] Profiles CRUD
- [ ] Position roles + position changes
- [ ] User management (create, delete — replaces Edge Functions)
- [ ] Invitations (generate link with token, accept, revoke)
- [ ] Role assignment + role_audit_log

### Phase 4: Feature Routes
- [ ] Performance reviews + review_templates
- [ ] Promotions (appraisal tracking)
- [ ] Measurables/KPIs
- [ ] Incentives + incentive_types
- [ ] Academy (courses, course_pages, course_progress)
- [ ] SOPs
- [ ] Tools (internal apps)
- [ ] Tasks
- [ ] Meetings
- [ ] Holiday calendar
- [ ] Core values
- [ ] Time off (requests, balances, time_off_types)
- [ ] Overtime
- [ ] Feedback
- [ ] Activity logs
- [ ] Analytics (cross-table aggregation)
- [ ] AI config (org_ai_config — BYOK provider management)
- [ ] Employee journey (trail_events)

### Phase 5: Agent System
- [ ] Agent CRUD routes
- [ ] Agent access control (TypeScript — replaces can_access_agent)
- [ ] Agent context retrieval (TypeScript — replaces get_agent_context)
- [ ] WebSocket chat handler
- [ ] Agent tool connections (NEW — agent_tool_connections table)
- [ ] Agent runtime lifecycle
- [ ] Consolidate agent-runtime/ into server/agents/

### Phase 6: Realtime + Chat
- [ ] WebSocket server setup on Hono
- [ ] Agent message streaming
- [ ] Team chat channels + messages
- [ ] Activity feed live updates

### Phase 7: Frontend Migration
- [ ] Set up tRPC client + provider
- [ ] Set up Better Auth client
- [ ] Set up WebSocket client
- [ ] Migrate all components from supabase.from() to tRPC hooks
- [ ] Migrate auth calls (signIn, signUp, signOut, getSession, onAuthStateChange)
- [ ] Migrate realtime subscriptions (agent_messages, chat_messages, activity_logs)
- [ ] Migrate Edge Function calls to tRPC mutations
- [ ] Migrate RPC calls to tRPC queries
- [ ] Delete src/integrations/supabase/

### Phase 8: Deploy
- [ ] Rewrite deploy.sh (2 questions, not 6)
- [ ] Rewrite Dockerfile (single container)
- [ ] Rewrite docker-compose.yml (2 services + 2 volumes)
- [ ] Update .env.example
- [ ] Delete supabase/ directory
- [ ] Delete agent-runtime/ directory
- [ ] Update README (already done)
- [ ] Test full deploy on clean VPS

---

## 13. What Stays the Same

- All React components (UI layer — restructured queries but same components)
- Tailwind CSS + shadcn/ui
- React Router routes
- All feature pages and layouts
- Employee Journey components
- Org chart visualization
- Agent chat UI components
- The database table structure (columns, relationships — just defined in Drizzle instead of SQL)
- SSO/App Launcher (uses localStorage, not database)
