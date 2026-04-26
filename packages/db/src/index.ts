import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.ts';

// Use a no-op URL if DATABASE_URL isn't set so module-load (Next "collecting
// page data" phase, type generation, etc.) doesn't throw. postgres.js is
// lazy — no connection happens until the first query, by which point the
// real DATABASE_URL must be set or the query will fail with a connection
// error (which is fine and informative).
const databaseUrl = process.env.DATABASE_URL ?? 'postgres://noop@127.0.0.1:5432/noop';

// `db` is the user-facing client. In production it should connect with a role
// that does NOT have BYPASSRLS so the policies in 0002_rls_tenant_isolation.sql
// actually constrain queries (see SELF_HOSTING.md for the role split).
//
// `dbAdmin` is for trusted server-side code that needs to operate across orgs:
// the webhook ingest endpoint (resolves which IG account a Meta event is for),
// the worker (processes jobs that name their own org), and migrations. It
// should connect with a role that has BYPASSRLS. If ADMIN_DATABASE_URL is not
// set we fall back to DATABASE_URL — fine for local dev where the same
// superuser runs everything.
const adminDatabaseUrl = process.env.ADMIN_DATABASE_URL ?? databaseUrl;

if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'production') {
  console.warn('[@mushu/db] DATABASE_URL not set — using no-op connection');
}

const client = postgres(databaseUrl, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

const adminClient = postgres(adminDatabaseUrl, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
export const dbAdmin = drizzle(adminClient, { schema });

export type Database = typeof db;
export * from './schema/index.ts';
export * from './with-org.ts';
