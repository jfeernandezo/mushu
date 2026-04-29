export * from './auth.ts';
export * from './domain.ts';
export * from './flows.ts';
export * from './events.ts';
export * from './notifications.ts';
export * from './permissions.ts';
export * from './billing.ts';

// Note: the table that holds connected provider accounts is named
// `instagramAccount` for historical reasons but stores BOTH Instagram and
// Threads connections (discriminated by the `channel` column). We don't add
// a generic `account` alias here because Better Auth already exports a
// `account` table from auth.ts (its OAuth provider linkage). Use
// `instagramAccount` with `channel === 'threads'` to address Threads rows.
export { instagramAccount as connectedAccount } from './domain.ts';
