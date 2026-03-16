import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db/index';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 min cache
    },
    expiresIn: 60 * 60 * 24 * 7, // 7 days
  },
  trustedOrigins: process.env.SITE_URL ? [process.env.SITE_URL] : [],
});
