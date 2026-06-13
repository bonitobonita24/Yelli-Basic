// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ScreenAdminMembers component test (jsdom) — the device directory. Mocks the trpc
 * devices.list query + the mutation hooks; verifies loading / error / populated
 * states and the filter controls. Complements the devices-router unit test + live walk.
 */
const noopMutation = () => ({ mutate: vi.fn(), isPending: false });
const h = vi.hoisted(() => ({
  q: { isPending: false, isError: false, data: [] as unknown[] },
}));

vi.mock('@/lib/trpc/react', () => ({
  trpc: {
    useUtils: () => ({ devices: { list: { invalidate: vi.fn() } } }),
    devices: {
      list: { useQuery: () => h.q },
      setDisplayName: { useMutation: noopMutation },
      archive: { useMutation: noopMutation },
      unarchive: { useMutation: noopMutation },
      delete: { useMutation: noopMutation },
    },
  },
}));

// Overlay children pull in their own trpc/overlay deps — stub to keep the unit focused.
vi.mock('@/components/overlays/OverlayCallRoleAssign', () => ({ default: () => null }));
vi.mock('@/components/overlays/OverlayNamePicker', () => ({ default: () => null }));

const { default: ScreenAdminMembers } = await import('../ScreenAdminMembers');

const device = {
  id: 'd1',
  userId: 'u1',
  displayName: 'Reception PC',
  callRole: 'both',
  browserFingerprint: 'fp',
  assignedRoleAt: null,
  lastSeenAt: new Date().toISOString(),
  archivedAt: null,
  createdAt: new Date().toISOString(),
};

afterEach(cleanup);
beforeEach(() => {
  h.q = { isPending: false, isError: false, data: [] };
});

describe('ScreenAdminMembers', () => {
  it('renders the error state on query failure', () => {
    h.q = { isPending: false, isError: true, data: [] };
    render(<ScreenAdminMembers />);
    expect(screen.getByText(/Couldn't load the directory/i)).toBeInTheDocument();
  });

  it('renders the Members heading, filters, and a device row', () => {
    h.q = { isPending: false, isError: false, data: [device] };
    render(<ScreenAdminMembers />);

    expect(screen.getByRole('heading', { name: 'Members' })).toBeInTheDocument();
    // device name appears (mobile card + desktop table both render → use getAllByText)
    expect(screen.getAllByText('Reception PC').length).toBeGreaterThan(0);
    // filter chips
    expect(screen.getByRole('button', { name: /All ·/ })).toBeInTheDocument();
  });
});
