import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ permission: vi.fn(), transaction: vi.fn() }));
vi.mock('@mushu/db', () => ({ db: {}, flow: {}, trigger: {}, withOrgTx: mocks.transaction }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: async () => ({ user: { id: 'user' }, session: { activeOrganizationId: 'org' } }),
    },
  },
}));
vi.mock('@/lib/workspace-permission', () => ({ requireWorkspacePermission: mocks.permission }));
vi.mock('@/lib/flow-templates', () => ({ getTemplate: vi.fn() }));

import {
  createFlow,
  deleteFlow,
  publishFlow,
  saveFlowDraft,
  setFlowEnabled,
} from '../../actions/flows';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.permission.mockRejectedValue(new Error('permission_denied'));
});
describe('flow mutation authorization', () => {
  it.each([
    ['flow.create', () => createFlow('test')],
    ['flow.delete', () => deleteFlow('flow')],
    ['flow.edit', () => saveFlowDraft('flow', {})],
    ['flow.publish', () => publishFlow('flow')],
    ['flow.publish', () => setFlowEnabled('flow', true)],
  ] as const)('blocks unauthorized %s before database mutations', async (permission, action) => {
    await expect(action()).rejects.toThrow('permission_denied');
    expect(mocks.permission).toHaveBeenCalledWith('user', 'org', permission);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
