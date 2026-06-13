// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ScreenAdminInvitations component test (jsdom). Mocks the trpc invitations query +
 * create/revoke/resend mutations; verifies the invite form, empty state, and a
 * pending-invite row with its actions. Complements the invitations-router unit test
 * + the live MailHog walk.
 */
const noopMutation = () => ({ mutate: vi.fn(), isPending: false });
const h = vi.hoisted(() => ({ q: { isPending: false, isError: false, data: [] as unknown[] } }));

vi.mock('@/lib/trpc/react', () => ({
  trpc: {
    useUtils: () => ({ invitations: { list: { invalidate: vi.fn() } } }),
    invitations: {
      list: { useQuery: () => h.q },
      create: { useMutation: noopMutation },
      revoke: { useMutation: noopMutation },
      resend: { useMutation: noopMutation },
    },
  },
}));

const { default: ScreenAdminInvitations } = await import('../ScreenAdminInvitations');

afterEach(cleanup);
beforeEach(() => {
  h.q = { isPending: false, isError: false, data: [] };
});

describe('ScreenAdminInvitations', () => {
  it('renders the invite form + empty state with no invitations', () => {
    render(<ScreenAdminInvitations />);
    expect(screen.getByRole('heading', { name: 'Invitations' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send invite/i })).toBeInTheDocument();
    expect(screen.getByText(/No invitations yet/i)).toBeInTheDocument();
  });

  it('renders a pending invite with Resend + Revoke actions', () => {
    h.q = {
      isPending: false,
      isError: false,
      data: [
        {
          id: 'inv1',
          email: 'invitee@x.test',
          invitedByUserId: 'u1',
          expiresAt: new Date(Date.now() + 7 * 864e5).toISOString(),
          acceptedAt: null,
          createdAt: new Date().toISOString(),
        },
      ],
    };
    render(<ScreenAdminInvitations />);

    expect(screen.getByText('invitee@x.test')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Revoke/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resend/i })).toBeInTheDocument();
  });
});
