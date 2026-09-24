import { z } from 'zod';

export const INSTAGRAM_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
] as const;

const tokenSchema = z.object({
  access_token: z.string().min(1),
  user_id: z
    .union([z.string().regex(/^\d+$/), z.number().int().positive().safe()])
    .transform(String),
  permissions: z.union([z.array(z.string()), z.string()]).optional(),
});

// Meta documents an envelope; some API responses return the token directly.
// Validate both before passing credentials to another request or the database.
export function parseInstagramToken(value: unknown) {
  const envelope = z.object({ data: z.tuple([tokenSchema]) }).safeParse(value);
  return envelope.success ? envelope.data.data[0] : tokenSchema.parse(value);
}

export const instagramLongTokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
});

export function hasInstagramPermissions(permissions: string | string[] | undefined): boolean {
  // Older responses omit permissions. A supplied list must grant every scope.
  if (permissions === undefined) return true;
  const granted = Array.isArray(permissions)
    ? permissions
    : permissions.split(',').map((p) => p.trim());
  return INSTAGRAM_SCOPES.every((scope) => granted.includes(scope));
}
