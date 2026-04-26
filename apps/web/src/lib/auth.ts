import { db } from '@mushu/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization } from 'better-auth/plugins';

const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';

export const auth = betterAuth({
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    // Enable self-service delete (Phase B). Requires the user's password.
    // No verification email — we don't have email infra wired up yet.
    deleteUser: { enabled: true },
  },
  plugins: [organization()],
});

export type Session = typeof auth.$Infer.Session;
