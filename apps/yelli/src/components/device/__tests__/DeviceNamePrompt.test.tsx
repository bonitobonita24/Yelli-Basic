// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * DeviceNamePrompt (jsdom) — first-launch display-name prompt (PRODUCT.md Flow 6 /
 * Page 5, owner readable-default refinement). Verifies the picker shows pre-filled with
 * a generated READABLE name (never "Guest") on an unnamed device, and is hidden once a
 * name is stored. The real `useDeviceName` hook runs against jsdom localStorage; the
 * OverlayNamePicker is stubbed to surface its `initialName`/`seedValue` props.
 */
const h = vi.hoisted(() => ({ selfDeviceId: 'dev-uuid-1' }));

vi.mock('@/components/call/CallEngineProvider', () => ({
  useCallEngine: () => ({ selfDeviceId: h.selfDeviceId, placeCall: vi.fn(), busy: false }),
}));

vi.mock('@/lib/trpc/react', () => ({
  trpc: {
    useUtils: () => ({
      devices: { list: { fetch: vi.fn(async () => []), invalidate: vi.fn() } },
    }),
    devices: { setDisplayName: { useMutation: () => ({ mutateAsync: vi.fn() }) } },
  },
}));

// Stub the overlay to a probe that exposes the props the prompt passes in.
vi.mock('@/components/overlays/OverlayNamePicker', () => ({
  default: (props: { initialName: string; seedValue?: string }) => (
    <div data-testid="picker" data-initial={props.initialName} data-seed={props.seedValue ?? ''}>
      picker
    </div>
  ),
}));

const { DeviceNamePrompt } = await import('../DeviceNamePrompt');

afterEach(cleanup);
beforeEach(() => window.localStorage.clear());

describe('DeviceNamePrompt', () => {
  it('shows the picker pre-filled with a readable name (not "Guest") when unset', async () => {
    render(<DeviceNamePrompt />);
    const picker = await screen.findByTestId('picker');
    const seed = picker.getAttribute('data-seed') ?? '';
    // First-join mode → empty initialName baseline; seed carries the generated default.
    expect(picker.getAttribute('data-initial')).toBe('');
    expect(seed).not.toBe('');
    expect(seed).not.toBe('Guest');
    expect(seed).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });

  it('renders nothing once a device name is already stored', () => {
    window.localStorage.setItem('yelli.device-name', 'Maria Reyes');
    const { container } = render(<DeviceNamePrompt />);
    expect(screen.queryByTestId('picker')).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });
});
