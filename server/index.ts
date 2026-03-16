import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { createNodeWebSocket } from '@hono/node-ws';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from './trpc/router';
import { createContext } from './trpc/context';
import { auth } from './auth/index';
import { uploadsApp } from './storage/uploads';
import { addClient, removeClient, subscribe, authenticateClient, getClient } from './ws/realtime';
import { db } from './db/index';
import { sessions } from './db/schema/auth';
import { profiles } from './db/schema/profiles';
import { eq, and, gt } from 'drizzle-orm';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync } from 'fs';
import { join } from 'path';
import { rateLimit } from './middleware/rate-limit';

const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// Security headers middleware
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '0');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
});

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: process.env.SITE_URL || 'http://localhost:8080',
  credentials: true,
}));

// Rate limit auth endpoints: 10 attempts per 15 minutes per IP
app.use('/api/auth/*', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many login attempts. Please try again later.' }));

// Rate limit uploads: 20 per minute per IP
app.use('/api/uploads', rateLimit({ windowMs: 60 * 1000, max: 20, message: 'Upload rate limit exceeded.' }));

// Better Auth handler
app.on(['GET', 'POST'], '/api/auth/**', async (c) => {
  return auth.handler(c.req.raw);
});

// tRPC handler
app.use('/trpc/*', async (c) => {
  return fetchRequestHandler({
    endpoint: '/trpc',
    req: c.req.raw,
    router: appRouter,
    createContext: () => createContext(c),
  });
});

// File uploads
app.route('/', uploadsApp);

/**
 * Validate a session token from cookies and return the userId and orgId.
 * Returns null if session is invalid or expired.
 */
async function validateSessionFromCookie(cookieHeader: string | undefined): Promise<{ userId: string; orgId: string | null } | null> {
  if (!cookieHeader) return null;

  // Better Auth stores session token in a cookie named "better-auth.session_token"
  const cookies = cookieHeader.split(';').reduce<Record<string, string>>((acc, cookie) => {
    const [key, ...vals] = cookie.trim().split('=');
    if (key) acc[key.trim()] = vals.join('=').trim();
    return acc;
  }, {});

  const sessionToken = cookies['better-auth.session_token'] || cookies['__Secure-better-auth.session_token'];
  if (!sessionToken) return null;

  // Look up session in database by token, check not expired
  const [session] = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(
      and(
        eq(sessions.token, sessionToken),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!session) return null;

  // Look up org membership
  const [profile] = await db
    .select({ organizationId: profiles.organizationId })
    .from(profiles)
    .where(eq(profiles.userId, session.userId))
    .limit(1);

  return {
    userId: session.userId,
    orgId: profile?.organizationId ?? null,
  };
}

// WebSocket endpoint
app.get('/ws', upgradeWebSocket((c) => {
  // Extract cookies from the upgrade request headers
  const cookieHeader = c.req.raw.headers.get('cookie') ?? undefined;

  return {
    async onOpen(evt, ws) {
      addClient(ws as any);

      // Authenticate from the session cookie sent during the upgrade handshake
      const sessionInfo = await validateSessionFromCookie(cookieHeader);
      if (!sessionInfo) {
        // No valid session — reject the connection
        try {
          (ws as any).send(JSON.stringify({ type: 'error', message: 'Authentication required' }));
          (ws as any).close(4001, 'Authentication required');
        } catch {
          // Already closed
        }
        removeClient(ws as any);
        return;
      }

      authenticateClient(ws as any, sessionInfo.userId, sessionInfo.orgId);
      try {
        (ws as any).send(JSON.stringify({ type: 'authenticated', userId: sessionInfo.userId }));
      } catch {
        // Client already disconnected
      }
    },
    onMessage(evt, ws) {
      try {
        const client = getClient(ws as any);
        if (!client?.authenticated) {
          (ws as any).send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
          return;
        }

        const data = JSON.parse(evt.data as string);
        if (data.type === 'subscribe' && typeof data.channel === 'string') {
          subscribe(ws as any, data.channel);
        }
      } catch {
        // Invalid message
      }
    },
    onClose(evt, ws) {
      removeClient(ws as any);
    },
  };
}));

// Serve built frontend in production
const distPath = join(process.cwd(), 'dist');
if (existsSync(distPath)) {
  app.use('/*', serveStatic({ root: './dist' }));
  // SPA fallback — serve index.html for all non-file routes
  app.get('*', serveStatic({ root: './dist', path: 'index.html' }));
}

const port = parseInt(process.env.PORT || '3000', 10);

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Seaport server running on http://localhost:${info.port}`);
});

injectWebSocket(server);
