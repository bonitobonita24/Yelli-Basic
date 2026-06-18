// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * PeerDirectory component test (jsdom). Mocks trpc.devices.list to drive
 * UNAUTHORIZED / genuine-error / populated states.
 *
 * Key assertion: an UNAUTHORIZED error (no session) renders a friendly
 * sign-in empty-state, NOT the red role="alert" error. A non-UNAUTHORIZED
 * error still shows the red alert. Complements the devices-router unit test.
 */

const h = vi.hoisted(() => ({
  q: {
    isPending: false,
    isError: false,
    error: null as { data?: { code?: string } } | null,
    data: null as unknown[] | null,
  },
}));

vi.mock('@/lib/trpc/react', () => ({
  trpc: {
    devices: {
      list: { useQuery: () => h.q },
    },
  },
}));

// CallEngineProvider pulls in signaling + next-auth — stub to keep unit focused.
vi.mock('@/components/call/CallEngineProvider', () => ({
  useCallEngine: () => ({
    selfDeviceId: 'self-1',
    placeCall: vi.fn(),
    busy: false,
  }),
}));

const { PeerDirectory } = await import('../PeerDirectory');

afterEach(cleanup);
beforeEach(() => {
  h.q = { isPending: false, isError: false, error: null, data: null };
});

describe('PeerDirectory', () => {
  it('shows friendly sign-in empty-state (no red alert) on UNAUTHORIZED error', () => {
    h.q = {
      isPending: false,
      isError: true,
      error: { data: { code: 'UNAUTHORIZED' } },
      data: null,
    };
    render(<PeerDirectory />);
    // Friendly empty-state must be visible
    expect(screen.getByText(/Sign in to see the people you can call/i)).toBeInTheDocument();
    // The red alert must NOT be rendered
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows red error alert on a genuine (non-UNAUTHORIZED) query failure', () => {
    h.q = {
      isPending: false,
      isError: true,
      error: { data: { code: 'INTERNAL_SERVER_ERROR' } },
      data: null,
    };
    render(<PeerDirectory />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Couldn't load the directory/i)).toBeInTheDocument();
    // The friendly sign-in prompt must NOT appear
    expect(screen.queryByText(/Sign in to see the people you can call/i)).toBeNull();
  });

  it('shows red error alert when error has no code (null data)', () => {
    h.q = {
      isPending: false,
      isError: true,
      error: { data: undefined },
      data: null,
    };
    render(<PeerDirectory />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders loading skeletons while pending', () => {
    h.q = { isPending: true, isError: false, error: null, data: null };
    const { container } = render(<PeerDirectory />);
    // Three skeleton cards
    expect(container.querySelectorAll('.animate-pulse').length).toBe(3);
  });

  it('renders empty state when no peers (data empty after filtering self)', () => {
    h.q = {
      isPending: false,
      isError: false,
      error: null,
      // Only self — filtered out by selfDeviceId
      data: [
        {
          id: 'self-1',
          displayName: 'Me',
          callRole: 'both',
          lastSeenAt: null,
          archivedAt: null,
        },
      ],
    };
    render(<PeerDirectory />);
    expect(screen.getByText(/No other devices/i)).toBeInTheDocument();
  });
});
