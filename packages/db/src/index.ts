import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.ts';

// Use a no-op URL if DATABASE_URL isn't set so module-load (Next "collecting
// page data" phase, type generation, etc.) doesn't throw. postgres.js is
// lazy — no connection happens until the first query, by which point the
// real DATABASE_URL must be set or the query will fail with a connection
// error (which is fine and informative).
const databaseUrl = process.env.DATABASE_URL ?? 'postgres://noop@127.0.0.1:5432/noop';

if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'production') {
  console.warn('[@mushu/db] DATABASE_URL not set — using no-op connection');
}

const client = postgres(databaseUrl, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });

export type Database = typeof db;
export * from './schema/index.ts';
