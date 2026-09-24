import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ members: [] as { id: string }[], permission: vi.fn() }));
vi.mock('@mushu/db', () => ({
  member: { id: 'id', userId: 'userId', organizationId: 'organizationId' },
  dbAdmin: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => mocks.members }) }) }),
  },
}));
vi.mock('@/lib/permissions', () => ({
  requirePermission: mocks.permission,
  PermissionDeniedError: class extends Error {},
}));

import { requireWorkspacePermission } from '../workspace-permission';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.members = [];
});
describe('workspace permissions', () => {
  it('rejects a user without membership before checking privileges', async () => {
    await expect(requireWorkspacePermission('user', 'org', 'flow.delete')).rejects.toThrow();
    expect(mocks.permission).not.toHaveBeenCalled();
  });
  it('checks the resolved member and requested permission', async () => {
    mocks.members = [{ id: 'member' }];
    await requireWorkspacePermission('user', 'org', 'flow.publish');
    expect(mocks.permission).toHaveBeenCalledWith('member', 'flow.publish');
  });
  it('propagates denial for a member with insufficient privileges', async () => {
    mocks.members = [{ id: 'viewer' }];
    mocks.permission.mockRejectedValueOnce(new Error('denied'));
    await expect(requireWorkspacePermission('user', 'org', 'flow.edit')).rejects.toThrow('denied');
  });
});
