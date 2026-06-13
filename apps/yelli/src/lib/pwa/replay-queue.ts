/**
 * Offline mutation replay queue — IDB-backed, dependency-free (PRODUCT.md §21).
 *
 * Flaky-network UX (flow #21): when a device is offline, idempotent mutations
 * (settings save, branding save, …) are NOT dropped — they are appended to a
 * durable per-browser queue with a stable UUIDv7 idempotency key and replayed
 * IN ORDER on reconnect. The server dedupes each replay on
 * `(actorId, idempotencyKey)` within 24h (`src/server/idempotency.ts`), so an
 * at-least-once replay is effectively-once. Persistence across a full tab close
 * is why the queue lives in IndexedDB, not memory (flow #21: "tab fully closed
 * during offline → on relaunch … replay runs").
 *
 * Non-idempotent ops (`call.invite`) are NEVER queued — they require a live WS
 * and the call surface surfaces "Reconnect to call" instead. Enforcement is at
 * the call-site (only idempotent mutations call `enqueue`), not here.
 *
 * This module is the storage + ordering PRIMITIVE; the React provider
 * (`components/pwa/replay-queue-provider.tsx`) owns the reconnect-flush lifecycle
 * and the per-`type` executor registry. The core is split from React so its FIFO
 * + dedup-on-replay semantics are unit-testable against an in-memory store with
 * no DOM (vitest node env).
 */

import { uuidv7 } from './uuidv7';

/** A single queued mutation. `id` doubles as the server idempotency key. */
export interface ReplayItem {
  /** UUIDv7 — time-ordered; also the `(actorId, idempotencyKey)` dedup key. */
  readonly id: string;
  /** Op discriminator the executor registry routes on (e.g. `brand.update`). */
  readonly type: string;
  /** Serializable tRPC input. Opaque to the queue; the executor interprets it. */
  readonly payload: unknown;
  /** Monotonic enqueue stamp (≈ epoch-ms) — the FIFO sort key (ties broken by `id`). */
  readonly queuedAt: number;
}

/**
 * Replays one item. MUST throw to signal "not replayed" — the queue then stops
 * (preserving order) and retries from the same head on the next reconnect.
 */
export type ReplayExecutor = (item: ReplayItem) => Promise<void>;

/** Durable backing store. Two impls: `idbStore` (prod) and `memoryStore` (test). */
export interface ReplayStore {
  add(item: ReplayItem): Promise<void>;
  /** All items in FIFO order (by `queuedAt`, ties by `id`). */
  all(): Promise<ReplayItem[]>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Strictly-increasing enqueue clock. `Date.now()` can repeat within a millisecond,
 * and a UUIDv7's intra-ms ordering is random — so each item is stamped with a
 * monotonic value to guarantee FIFO replay order even for same-ms bursts. Seeded
 * from wall-clock time so it stays ≈ epoch-ms and survives reloads (a later launch
 * always exceeds any value an earlier one persisted).
 */
let lastSeq = 0;
function monotonicNow(): number {
  const now = Date.now();
  lastSeq = now > lastSeq ? now : lastSeq + 1;
  return lastSeq;
}

const byFifo = (a: ReplayItem, b: ReplayItem): number =>
  a.queuedAt - b.queuedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Queue logic over a pluggable store. */
export class ReplayQueue {
  constructor(private readonly store: ReplayStore) {}

  /** Append a mutation; returns the stored item (its `id` is the idempotency key). */
  async enqueue(type: string, payload: unknown): Promise<ReplayItem> {
    const item: ReplayItem = { id: uuidv7(), type, payload, queuedAt: monotonicNow() };
    await this.store.add(item);
    return item;
  }

  async pendingCount(): Promise<number> {
    return (await this.store.all()).length;
  }

  async list(): Promise<ReplayItem[]> {
    return this.store.all();
  }

  /**
   * Replay queued items in FIFO order. Stops at the first executor throw so
   * ordering is never violated (the failed head is retried next reconnect).
   * @returns how many drained and how many remain.
   */
  async flush(executor: ReplayExecutor): Promise<{ flushed: number; remaining: number }> {
    const items = await this.store.all();
    let flushed = 0;
    for (const item of items) {
      try {
        await executor(item);
      } catch {
        break; // keep this item + the rest; retry in order next reconnect.
      }
      await this.store.remove(item.id);
      flushed += 1;
    }
    const remaining = (await this.store.all()).length;
    return { flushed, remaining };
  }
}

/** In-memory store — for unit tests and SSR/no-IndexedDB fallback. */
export function memoryStore(): ReplayStore {
  const items = new Map<string, ReplayItem>();
  return {
    add: (item) => {
      items.set(item.id, item);
      return Promise.resolve();
    },
    all: () => Promise.resolve([...items.values()].sort(byFifo)),
    remove: (id) => {
      items.delete(id);
      return Promise.resolve();
    },
    clear: () => {
      items.clear();
      return Promise.resolve();
    },
  };
}

const DB_NAME = 'yelli-pwa';
const STORE_NAME = 'replay-queue';

/**
 * IndexedDB-backed store (production). Survives reloads and full tab close so a
 * queue built while offline replays on the next launch (flow #21). Falls back to
 * an in-memory store where IndexedDB is unavailable (SSR / private-mode quirks)
 * so callers never crash — durability degrades, correctness does not (the server
 * idempotency + DB constraints remain the backstop).
 */
export function idbStore(): ReplayStore {
  if (typeof indexedDB === 'undefined') return memoryStore();

  const open = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'));
    });

  const tx = async <T>(
    mode: IDBTransactionMode,
    run: (s: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const store = db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
      const req = run(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('indexedDB request failed'));
    });
  };

  return {
    add: async (item) => {
      await tx('readwrite', (s) => s.put(item));
    },
    all: async () => {
      // IndexedDB getAll is typed `any[]`; we only ever store ReplayItem.
      const rows = (await tx('readonly', (s) => s.getAll())) as ReplayItem[];
      return rows.sort(byFifo);
    },
    remove: async (id) => {
      await tx('readwrite', (s) => s.delete(id));
    },
    clear: async () => {
      await tx('readwrite', (s) => s.clear());
    },
  };
}
