# Contributing to Seaport

Thank you for your interest in contributing! Here's how to get started.

## Local Development Setup

### Prerequisites
- Node.js 20+
- Docker & Docker Compose (for Postgres)

### 1. Fork & clone
```bash
git clone https://github.com/Seahawk-Media/seaport.git
cd seaport
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in DATABASE_URL, SESSION_SECRET, and SITE_URL
```

### 3. Start Postgres
```bash
docker compose up -d postgres
```

### 4. Apply database schema
```bash
npm run db:push
```

### 5. Start dev server
```bash
npm run dev
# Frontend → http://localhost:8080
# API      → http://localhost:3000
```

## Project Structure

```
seaport/
├── server/
│   ├── db/
│   │   ├── schema/          # Drizzle ORM schema (13 files, 30+ tables)
│   │   └── seed.ts          # Default positions, departments, teams
│   ├── trpc/
│   │   ├── routes/          # 28 tRPC route files
│   │   ├── trpc.ts          # Procedure definitions (public, protected, org, admin)
│   │   └── router.ts        # Root router
│   ├── auth/                # Better Auth config (email/password, sessions)
│   ├── agents/              # AI agent runtime, access control, context
│   ├── ws/                  # WebSocket pub/sub
│   └── index.ts             # Hono server entry point
├── src/
│   ├── components/          # UI components (admin, workspace, employee, etc.)
│   ├── hooks/               # React hooks (auth, org, roles)
│   ├── lib/                 # tRPC client, auth client, WebSocket client
│   └── pages/               # Route-level page components
├── Dockerfile               # Multi-stage production build
├── docker-compose.yml       # Postgres + Seaport containers
├── deploy.sh                # One-command VPS deploy wizard
└── drizzle.config.ts        # Drizzle Kit configuration
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| HTTP Server | Hono |
| Database | PostgreSQL 15 + Drizzle ORM |
| Auth | Better Auth (email/password, httpOnly sessions) |
| API | tRPC v11 (type-safe, end-to-end) |
| Frontend | React 18 + Vite + shadcn/ui + Tailwind |
| Realtime | Native WebSocket |
| Deploy | Docker Compose + deploy.sh |

## Pull Request Guidelines

1. Fork the repo and create a feature branch: `git checkout -b feat/your-feature`
2. Keep PRs focused — one feature or fix per PR
3. Make sure `npm run build` passes with no TypeScript errors
4. Add schema changes in `server/db/schema/` and generate migrations with `npm run db:generate`
5. Update `.env.example` if you add new environment variables
6. Open a PR with a clear description of what you changed and why

## Database Changes

- Schema lives in `server/db/schema/` as Drizzle TypeScript files
- Generate migrations: `npm run db:generate`
- Apply migrations: `npm run db:migrate`
- Push schema directly (dev): `npm run db:push`
- All tables are scoped by `organizationId` for multi-tenant isolation

## Reporting Issues

Please use GitHub Issues. Include:
- Your deployment type (Docker Compose / manual)
- Steps to reproduce
- Expected vs actual behavior

## Code Style

- TypeScript everywhere — no `any` unless absolutely necessary
- Component files use `.tsx`, hooks use `.ts`
- Use shadcn/ui components before writing custom UI
- Tailwind semantic tokens from `index.css` — no raw hex/rgb colors in components
- Server code uses camelCase field names (Drizzle convention)

---

Questions? Open a discussion on GitHub.
