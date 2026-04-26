import { sql } from 'drizzle-orm';
import { db } from './index.ts';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Run a database operation in a transaction with the tenant context set, so
 * RLS policies on tenant tables (`contact`, `conversation`, `flow`, etc.) only
 * expose rows belonging to `orgId`.
 *
 * Wrap every Server Action that touches tenant tables in `withOrgTx`. Without
 * the wrapper, the GUC stays NULL and RLS-enforced queries return zero rows —
 * fail-secure, but a confusing experience to debug.
 *
 * Uses `set_config(..., true)` so the setting is LOCAL to the transaction and
 * does not leak to other requests sharing a connection in the postgres-js pool.
 */
export async function withOrgTx<T>(
  orgId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_org_id', ${orgId}, true)`);
    return fn(tx);
  });
}

/**
 * Convenience for read-only queries when an explicit transaction is overkill —
 * still establishes the tenant scope for RLS. Internally just calls withOrgTx
 * but returns the result of a single callback.
 */
export const withOrg = withOrgTx;
