# Contributing to Seaport

Thank you for your interest in contributing! Here's how to get started.

## Local Development Setup

### Prerequisites
- Node.js 18+
- A Supabase project (free tier works) — [supabase.com](https://supabase.com)

### 1. Fork & clone
```bash
git clone https://github.com/your-org/seaport.git
cd seaport
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in your Supabase project URL, anon key, and project ID
```

### 3. Apply database migrations
```bash
supabase link --project-ref your-project-id
supabase db push
```

### 4. Start dev server
```bash
npm run dev
# → http://localhost:8080
```

## Project Structure

```
seaport/
├── src/
│   ├── components/        # UI components (admin, auth, employee-journey, workspace, etc.)
│   ├── hooks/             # React hooks (auth, org, roles, scoped data)
│   ├── pages/             # Route-level page components
│   └── integrations/
│       └── supabase/      # Auto-generated Supabase client & types
├── supabase/
│   ├── functions/         # Edge functions (Deno)
│   └── migrations/        # Database migration files (in order)
├── docker/                # Nginx + Kong configs for self-hosting
├── docker-compose.yml     # Full self-hosted stack
└── deploy.sh              # One-command deploy wizard
```

## Pull Request Guidelines

1. Fork the repo and create a feature branch: `git checkout -b feat/your-feature`
2. Keep PRs focused — one feature or fix per PR
3. Make sure `npm run build` passes with no TypeScript errors
4. Add migrations in `supabase/migrations/` if your feature needs DB changes
5. Update `README.md` or `.env.example` if you add new environment variables
6. Open a PR with a clear description of what you changed and why

## Database Changes

- All DB changes go in `supabase/migrations/` as timestamped SQL files
- Use Row-Level Security (RLS) on all new tables — this is non-negotiable for multi-tenant security
- Test migrations with `supabase db reset` locally before submitting

## Reporting Issues

Please use GitHub Issues. Include:
- Your deployment type (self-hosted Supabase / VPS Docker)
- Steps to reproduce
- Expected vs actual behavior

## Code Style

- TypeScript everywhere — no `any` unless absolutely necessary
- Component files use `.tsx`, hooks use `.ts`
- Use shadcn/ui components before writing custom UI
- Tailwind semantic tokens from `index.css` — no raw hex/rgb colors in components

---

Questions? Open a discussion on GitHub.
