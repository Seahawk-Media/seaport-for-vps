# Seaport — Open Source Org OS

> The WordPress of organization software. One command. Two containers. Full org OS with AI agents built in.

Seaport gives every business a self-hosted platform to document their company, deploy always-on AI agents with real org context, and centralize their internal tools — replacing scattered SaaS subscriptions with one system they own.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

---

## For VPS Hosters

Seaport is built to be preinstalled on VPS plans and sold as a value-add — just like WordPress, but for business operations. Your customers get a complete org platform out of the box. No configuration, no onboarding friction, no external dependencies.

**Why hosters love it:**
- **Zero friction** — `./deploy.sh` asks 2 questions (domain + app name), generates all secrets, starts 2 containers. Done.
- **Tiny footprint** — Runs on a $10/mo VPS (2GB RAM). Just Postgres + one Node.js server.
- **White-label ready** — Set `APP_NAME` to anything. Your brand, your platform.
- **No external services** — No Redis, no S3, no SMTP required, no cloud APIs. Everything runs on the box.
- **Upsell path** — Customers start with org docs, then add agents (need bigger VPS), then add tools (need more storage). Natural upgrade path.

### Why Seaport over OpenClaw for Teams

OpenClaw is a great single-user agent runtime. But if you're deploying for **teams and organizations**, there's no comparison:

| | Seaport | OpenClaw |
|---|---|---|
| **Deploy** | 2 containers (app + Postgres) | 5+ services (gateway, plugins, channels, Redis, DB) |
| **Setup** | `./deploy.sh` → 2 questions → done | Manual multi-service Docker orchestration |
| **Auth** | Server-side sessions, httpOnly cookies, 4-tier roles | JSON file profiles, env var credentials |
| **Multi-tenant** | Org hierarchy — departments, functions, roles, permissions | Single-user CLI tool |
| **Agent scoping** | Three-tier (org → dept → function) with enforced access control | Flat — every agent sees everything |
| **Agent Identity** | SOUL.md-style identity (personality, values, guardrails) + persistent memory | SOUL.md (file-based, single-user) |
| **Credentials** | AES-256-GCM encrypted in Postgres, scoped per agent/tool | Plaintext env vars and JSON files |
| **VPS footprint** | ~512MB RAM for full org OS | ~1GB+ RAM for agent runtime alone |
| **What you get** | Full org OS + agents + tools + journeys + KPIs + academy | Agent runtime only — BYOB (bring your own business layer) |

**OpenClaw gives you agents. Seaport gives you an entire organization — with agents built into every layer.** Businesses don't want to wire up an agent runtime. They want to open a browser and run their company.

---

## Features

- 🏢 **Org Structure** — Departments, functions, people, and roles in a structured hierarchy
- 🗺️ **Org Chart** — Visual organization chart with drag-and-drop
- 💡 **Core Values** — Define and display company values across the platform
- 📚 **Academy** — Internal training courses with page-by-page progress tracking
- 🤖 **AI Agents** — Three-tier agent system (General, Departmental, Functional) with:
  - SOUL.md-style identity editor (personality, communication style, values, guardrails)
  - Persistent agent memory across conversations
  - Multi-provider support (Anthropic, OpenAI, Google Gemini) with encrypted BYOK
  - OpenClaw-style detail page with tabbed sidebar (Overview, Identity, Chat, Memory, Tools, Skills)
  - Real-time chat via WebSocket
  - 5-layer context assembly: identity → instructions → org context → memory → guidelines
- 👤 **Employee Journeys** — Full employee timeline from hire to present
- 🎯 **Measurables & KPIs** — Track team and org-wide metrics with owner accountability
- ✅ **Tasks** — Assign and track work across departments and functions
- 📆 **Meetings** — Schedule and manage recurring meetings with URLs
- 🔧 **Internal Business Apps** — Centralize all your tools in one launcher your team can actually find
- 📋 **SOPs** — Standard operating procedures with version control
- 💡 **Feedback** — Employee suggestions and feature requests with admin triage

---

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Hono (TypeScript) — single server for API, auth, WebSocket, and static files
- **Database**: PostgreSQL with Drizzle ORM (type-safe, zero overhead)
- **Auth**: Better Auth — server-side sessions, email/password, role-based access, invite flows
- **AI**: Multi-provider (Anthropic, OpenAI, Google Gemini) with encrypted API key storage
- **Realtime**: WebSocket (built into Hono) — agent chat, live updates
- **Deployment**: Docker Compose — just Postgres + Seaport server. That's it.

---

## Architecture

```
┌──────────────────────────────────────────────┐
│              Your VPS                         │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │         Seaport Server (Hono)           │  │
│  │                                         │  │
│  │  ┌───────────┐  ┌───────────────────┐   │  │
│  │  │ tRPC API  │  │ Better Auth       │   │  │
│  │  │ (routes)  │  │ (sessions/roles)  │   │  │
│  │  └───────────┘  └───────────────────┘   │  │
│  │  ┌───────────┐  ┌───────────────────┐   │  │
│  │  │ WebSocket │  │ Agent Runtime     │   │  │
│  │  │ (realtime)│  │ (LLM execution)   │   │  │
│  │  └───────────┘  └───────────────────┘   │  │
│  │  ┌───────────────────────────────────┐  │  │
│  │  │ Drizzle ORM                       │  │  │
│  │  └──────────────┬────────────────────┘  │  │
│  └─────────────────┼───────────────────────┘  │
│                    │                          │
│  ┌─────────────────┼───────────────────────┐  │
│  │           PostgreSQL 15                 │  │
│  │  ┌──────────┐ ┌────────┐ ┌──────────┐  │  │
│  │  │ agents   │ │ orgs   │ │ sessions │  │  │
│  │  │ identity │ │ depts  │ │ users    │  │  │
│  │  │ memories │ │ funcs  │ │ roles    │  │  │
│  │  └──────────┘ └────────┘ └──────────┘  │  │
│  └─────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

**2 containers. That's it.** No API gateway, no separate auth service, no edge functions runtime, no Redis. Just your app and Postgres.

### Three-Tier Agent Model

| Tier | Scope | Example |
|------|-------|---------|
| **General** | Entire org — reads all departments, teams, employees | CEO assistant, company-wide Q&A bot |
| **Departmental** | One department — reads its teams, employees, KPIs | Engineering lead, Sales ops agent |
| **Functional** | One function/team — reads only its members and metrics | Sprint planner, QA automation agent |

Access control is enforced at the API layer via middleware — users can only interact with agents scoped to their department or function.

### Agent Context Assembly (5 Layers)

Every agent call assembles context like OpenClaw's SOUL.md, but adapted for multi-tenant orgs:

1. **Identity** — SOUL.md-style personality, communication style, values, guardrails
2. **Instructions** — System prompt (what to do)
3. **Org Context** — Departments, teams, KPIs scoped to the agent's tier
4. **Memory** — Persistent facts learned across conversations
5. **Guidelines** — Behavioral rules (professional, accurate, scoped)

---

## Self-Hosting Guide

### One-Command Deploy (Recommended)

The fastest way to get Seaport running on a VPS.

**Prerequisites:** Ubuntu 22.04+, Docker, a domain pointed at your server.

```bash
git clone https://github.com/Seahawk-Media/seaport.git
cd seaport
chmod +x deploy.sh
./deploy.sh
```

The wizard asks 2 questions (domain + app name), then:
- Generates all secrets automatically
- Writes an Nginx reverse proxy config (if Nginx is installed)
- Builds and starts Postgres + Seaport server
- Optionally sets up free SSL with Let's Encrypt
- No SMTP, no API keys, no cloud accounts needed

> **Tip:** Install Nginx before running deploy.sh for automatic reverse proxy setup:
> ```bash
> sudo apt install nginx
> ```

---

### Manual Setup

#### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- A domain (for production)

#### 1. Clone the repo

```bash
git clone https://github.com/Seahawk-Media/seaport.git
cd seaport
```

#### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgresql://seaport:your-password@localhost:5432/seaport
SESSION_SECRET=your-random-secret
SITE_URL=https://your-domain.com
APP_NAME=Seaport   # Optional: rename for white-labeling
```

#### 3. Start the stack

```bash
docker compose up -d --build
```

That's it. Visit your domain — you'll see a WordPress-style setup wizard. Create your org name, admin account, and you're in. No email verification, no SMTP needed.

#### Development mode

```bash
npm install
npm run dev
```

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ | Secret for signing session cookies (auto-generated by deploy.sh) |
| `BETTER_AUTH_SECRET` | ✅ | Secret for Better Auth (auto-generated by deploy.sh) |
| `SITE_URL` | ✅ | Your app's public URL |
| `APP_NAME` | ❌ | App name displayed in the UI (default: Seaport) |
| `PORT` | ❌ | Server port (default: 3000) |

**3 required variables.** And `deploy.sh` generates all of them automatically.

---

## Project Structure

```
seaport/
├── src/
│   ├── components/        # UI components
│   │   ├── admin/         # Admin panel, AI models, user management
│   │   ├── agents/        # Agent chat UI
│   │   ├── auth/          # Login & signup pages
│   │   ├── employee-journey/ # Employee journey/timeline
│   │   ├── navigation/    # Sidebar and nav components
│   │   ├── org-chart/     # Org chart visualization
│   │   ├── workspace/     # Department/function workspaces
│   │   └── ui/            # shadcn/ui base components
│   ├── hooks/             # React hooks (auth, org, roles, useAgentChat)
│   └── pages/             # Route-level page components
├── server/                # Hono backend
│   ├── index.ts           # Server entry point
│   ├── trpc/routes/       # tRPC routes (type-safe API)
│   ├── db/schema/         # Drizzle schema (30+ tables)
│   ├── auth/              # Better Auth config
│   ├── agents/            # Agent runtime (context, access, tools, LLM execution)
│   ├── lib/               # Utilities (encryption)
│   ├── ws/                # WebSocket realtime
│   ├── storage/           # File upload handler
│   └── middleware/         # Rate limiting
├── docker-compose.yml     # Postgres + Seaport server
├── Dockerfile
├── deploy.sh              # One-command deployment wizard
├── .env.example
└── LICENSE
```

---

## Contributing

Contributions are welcome! Please open an issue or pull request.

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feat/your-feature`
5. Open a Pull Request

---

## License

[MIT](./LICENSE) — free to use, fork, and self-host.
