// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSignaling } from '../useSignaling';

/**
 * useSignaling sender test — focuses on the NEW `sendPresent` sender added for
 * three-way screen sharing (spec §3 `present` kind). Drives a fake WebSocket so
 * the hook reaches the `open` state, then asserts that `sendPresent` serialises a
 * `signal` frame with `kind: 'present'` exactly like the existing typed senders.
 */

type Listener = (ev: unknown) => void;

class FakeWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static last: FakeWebSocket | null = null;
  readyState = FakeWebSocket.OPEN;
  url: string;
  sent: string[] = [];
  private listeners: Record<string, Listener[]> = {};
  constructor(url: string) {
    this.url = url;
    FakeWebSocket.last = this;
  }
  addEventListener(type: string, cb: Listener): void {
    (this.listeners[type] ??= []).push(cb);
  }
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
  }
  emit(type: string, ev: unknown): void {
    for (const cb of this.listeners[type] ?? []) cb(ev);
  }
}

beforeEach(() => {
  // @ts-expect-error — install fake on the jsdom global
  globalThis.WebSocket = FakeWebSocket;
  FakeWebSocket.last = null;
});
afterEach(() => {
  vi.restoreAllMocks();
});

async function openSocket() {
  const result = renderHook(() =>
    useSignaling({
      deviceId: 'dev-1',
      getToken: async () => 'tok',
      enabled: true,
      url: 'ws://test/ws',
    }),
  );
  // Let the async dial() resolve and create the socket.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  const ws = FakeWebSocket.last!;
  await act(async () => {
    ws.emit('open', {});
    await Promise.resolve();
  });
  // Server accepts the hello → ready transitions status to 'open'.
  await act(async () => {
    ws.emit('message', { data: JSON.stringify({ type: 'ready', deviceId: 'dev-1', role: 'user' }) });
    await Promise.resolve();
  });
  return { result, ws };
}

describe('useSignaling.sendPresent', () => {
  it('exposes sendPresent and sends a present-kind signal frame when open', async () => {
    const { result, ws } = await openSocket();
    expect(typeof result.result.current.sendPresent).toBe('function');

    let ok = false;
    act(() => {
      ok = result.result.current.sendPresent({
        to: 'peer-2',
        sessionId: 'sess-1',
        data: { state: 'start', streamId: 'screen-1' },
      });
    });
    expect(ok).toBe(true);

    const presentFrame = ws.sent
      .map((s) => JSON.parse(s))
      .find((m) => m.type === 'signal' && m.kind === 'present');
    expect(presentFrame).toBeTruthy();
    expect(presentFrame.to).toBe('peer-2');
    expect(presentFrame.sessionId).toBe('sess-1');
    expect(presentFrame.data).toEqual({ state: 'start', streamId: 'screen-1' });
  });
});
