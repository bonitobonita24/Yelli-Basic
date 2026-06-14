// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ScreenDeviceSettings (jsdom) — the device-user's OWN name surface (PRODUCT.md
 * `/settings` · Flow 6 "editable later"). Verifies the stored name renders and that
 * the rename path persists to localStorage AND mirrors to the server via
 * `trpc.devices.setDisplayName` when this browser owns a matching device row.
 */
const h = vi.hoisted(() => ({
  selfDeviceId: 'dev-uuid-1',
  mutateAsync: vi.fn(async () => ({})),
  ownedRows: [{ id: 'dev-uuid-1', displayName: 'Old Name' }] as Array<{ id: string; displayName: string }>,
}));

vi.mock('@/components/call/CallEngineProvider', () => ({
  useCallEngine: () => ({ selfDeviceId: h.selfDeviceId, placeCall: vi.fn(), busy: false }),
}));

vi.mock('@/lib/trpc/react', () => ({
  trpc: {
    useUtils: () => ({
      devices: { list: { fetch: vi.fn(async () => h.ownedRows), invalidate: vi.fn() } },
    }),
    devices: { setDisplayName: { useMutation: () => ({ mutateAsync: h.mutateAsync }) } },
  },
}));

// Stub the overlay to a button that immediately confirms a fixed new name.
vi.mock('@/components/overlays/OverlayNamePicker', () => ({
  default: (props: { onSave: (name: string) => void }) => (
    <button type="button" data-testid="confirm-rename" onClick={() => props.onSave('New Name')}>
      confirm
    </button>
  ),
}));

const { ScreenDeviceSettings } = await import('../ScreenDeviceSettings');

afterEach(cleanup);
beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem('yelli.device-name', 'Old Name');
  h.mutateAsync.mockClear();
});

describe('ScreenDeviceSettings', () => {
  it('renders the current stored display name', async () => {
    render(<ScreenDeviceSettings />);
    expect(await screen.findByText('Old Name')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  });

  it('rename persists to localStorage and mirrors to setDisplayName for the owned row', async () => {
    render(<ScreenDeviceSettings />);
    // Open the editor, then confirm via the stubbed overlay.
    fireEvent.click(await screen.findByRole('button', { name: /Change display name/i }));
    fireEvent.click(screen.getByTestId('confirm-rename'));

    await waitFor(() => {
      expect(window.localStorage.getItem('yelli.device-name')).toBe('New Name');
    });
    await waitFor(() => {
      expect(h.mutateAsync).toHaveBeenCalledWith({ id: 'dev-uuid-1', displayName: 'New Name' });
    });
  });

  it('rename still persists locally when there is no owned device row', async () => {
    h.ownedRows = [];
    render(<ScreenDeviceSettings />);
    fireEvent.click(await screen.findByRole('button', { name: /Change display name/i }));
    fireEvent.click(screen.getByTestId('confirm-rename'));

    await waitFor(() => {
      expect(window.localStorage.getItem('yelli.device-name')).toBe('New Name');
    });
    expect(h.mutateAsync).not.toHaveBeenCalled();
    h.ownedRows = [{ id: 'dev-uuid-1', displayName: 'Old Name' }];
  });
});
