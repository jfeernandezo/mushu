export const ASSIGNABLE_ROLES = ['admin', 'editor', 'viewer'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];
