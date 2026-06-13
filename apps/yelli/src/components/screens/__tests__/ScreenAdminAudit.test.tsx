// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ScreenAdminAudit component test (jsdom). Mocks the trpc infinite-query to drive
 * loading / error / populated states and verifies the §11-derived filter chips +
 * a rendered row. Complements the audit-router unit test + the live S6 walk.
 */
const h = vi.hoisted(() => ({
  q: {
    isPending: false,
    isError: false,
    data: { pages: [] as Array<{ items: unknown[]; nextCursor: string | null }> },
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
  },
}));

vi.mock('@/lib/trpc/react', () => ({
  trpc: { audit: { list: { useInfiniteQuery: () => h.q } } },
}));

const { default: ScreenAdminAudit } = await import('../ScreenAdminAudit');

afterEach(cleanup);
beforeEach(() => {
  h.q = {
    isPending: false,
    isError: false,
    data: { pages: [] },
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
  };
});

describe('ScreenAdminAudit', () => {
  it('renders error state on query failure', () => {
    h.q = { ...h.q, isError: true };
    render(<ScreenAdminAudit />);
    expect(screen.getByText(/Couldn't load the audit log/i)).toBeInTheDocument();
  });

  it('renders the §11 namespace filter chips and an audit row', () => {
    h.q = {
      ...h.q,
      data: {
        pages: [
          {
            items: [
              {
                id: 'a1',
                action: 'tenant.branding.update',
                actorUserId: null,
                payload: {},
                createdAt: new Date().toISOString(),
              },
            ],
            nextCursor: null,
          },
        ],
      },
    };
    render(<ScreenAdminAudit />);

    expect(screen.getByRole('heading', { name: 'Audit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'tenant.*' })).toBeInTheDocument();
    expect(screen.getByText('tenant.branding.update')).toBeInTheDocument();
    // null actor renders as "System"
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('shows the empty state when no rows match', () => {
    render(<ScreenAdminAudit />);
    expect(screen.getByText(/No audit entries match/i)).toBeInTheDocument();
  });
});
