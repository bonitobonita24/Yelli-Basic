// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ScreenTenantSettings component test (jsdom) — first React screen component test.
 * Mocks the trpc client to drive the three states: loading (skeletons, no form),
 * error, and the populated org-settings form with the IMMUTABLE slug rendered
 * read-only. Complements the live S6 walk + the brand-router unit test.
 */
const h = vi.hoisted(() => ({
  query: { isPending: false, isError: false, data: undefined as unknown },
  mutate: vi.fn(),
}));

vi.mock('@/lib/trpc/react', () => ({
  trpc: {
    useUtils: () => ({ tenants: { get: { invalidate: vi.fn() } } }),
    tenants: { get: { useQuery: () => h.query } },
    brand: { update: { useMutation: () => ({ mutate: h.mutate, isPending: false, isError: false }) } },
  },
}));

const { default: ScreenTenantSettings } = await import('../ScreenTenantSettings');

afterEach(cleanup);
beforeEach(() => {
  h.query = { isPending: false, isError: false, data: undefined };
});

describe('ScreenTenantSettings', () => {
  it('shows the loading state (no form) while the tenant query is pending', () => {
    h.query = { isPending: true, isError: false, data: undefined };
    render(<ScreenTenantSettings />);
    expect(screen.queryByRole('heading', { name: 'Org settings' })).toBeNull();
  });

  it('shows an error message when the tenant query fails', () => {
    h.query = { isPending: false, isError: true, data: undefined };
    render(<ScreenTenantSettings />);
    expect(screen.getByText(/Couldn't load organization settings/i)).toBeInTheDocument();
  });

  it('renders the org-settings form with an editable name and a read-only slug', () => {
    h.query = { isPending: false, isError: false, data: { slug: 'acme', displayName: 'Acme Clinic' } };
    render(<ScreenTenantSettings />);

    expect(screen.getByRole('heading', { name: 'Org settings' })).toBeInTheDocument();
    // Display name is editable + pre-filled.
    expect(screen.getByDisplayValue('Acme Clinic')).toBeInTheDocument();
    // Slug is rendered read-only/disabled with the immutability helper.
    const slug = screen.getByDisplayValue('acme');
    expect(slug).toBeDisabled();
    expect(screen.getByText('.yelli.app')).toBeInTheDocument();
    expect(screen.getByText(/Your address is permanent/i)).toBeInTheDocument();
    // Save is disabled until the form is dirty.
    expect(screen.getByRole('button', { name: /Save changes/i })).toBeDisabled();
  });
});
