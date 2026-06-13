import { describe, expect, it } from 'vitest';

import { memoryStore, ReplayQueue, type ReplayItem } from './replay-queue';

/**
 * Verifies the offline-replay FIFO + stop-on-failure semantics (PRODUCT.md §21:
 * "replayed in order on reconnect"). Runs against the in-memory store so the core
 * logic is exercised with no IndexedDB / DOM (vitest node env).
 */
describe('ReplayQueue', () => {
  it('assigns a UUIDv7 id and preserves enqueue order', async () => {
    const q = new ReplayQueue(memoryStore());
    await q.enqueue('brand.update', { displayName: 'A' });
    await q.enqueue('settings.save', { theme: 'dark' });

    const items = await q.list();
    expect(items.map((i) => i.type)).toEqual(['brand.update', 'settings.save']);
    expect(items[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await q.pendingCount()).toBe(2);
  });

  it('drains every item in order when the executor succeeds', async () => {
    const q = new ReplayQueue(memoryStore());
    await q.enqueue('a', 1);
    await q.enqueue('b', 2);

    const seen: string[] = [];
    const res = await q.flush((item) => {
      seen.push(item.type);
      return Promise.resolve();
    });

    expect(seen).toEqual(['a', 'b']);
    expect(res).toEqual({ flushed: 2, remaining: 0 });
    expect(await q.pendingCount()).toBe(0);
  });

  it('stops at the first failure and keeps the rest in order', async () => {
    const q = new ReplayQueue(memoryStore());
    await q.enqueue('ok', 1);
    await q.enqueue('boom', 2);
    await q.enqueue('after', 3);

    const attempted: string[] = [];
    const res = await q.flush((item: ReplayItem) => {
      attempted.push(item.type);
      return item.type === 'boom' ? Promise.reject(new Error('offline')) : Promise.resolve();
    });

    // 'ok' drained; stopped at 'boom'; 'after' never attempted.
    expect(attempted).toEqual(['ok', 'boom']);
    expect(res).toEqual({ flushed: 1, remaining: 2 });
    expect((await q.list()).map((i) => i.type)).toEqual(['boom', 'after']);
  });

  it('replays the same head on the next flush (effectively-once on the server)', async () => {
    const q = new ReplayQueue(memoryStore());
    await q.enqueue('boom', 1);

    let calls = 0;
    const failing = () => {
      calls += 1;
      return Promise.reject(new Error('offline'));
    };
    await q.flush(failing);
    await q.flush(failing);

    expect(calls).toBe(2); // retried, never dropped
    expect(await q.pendingCount()).toBe(1);

    const drained = await q.flush(() => Promise.resolve());
    expect(drained).toEqual({ flushed: 1, remaining: 0 });
  });
});
