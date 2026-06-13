'use client';

/**
 * Offline replay-queue React context (PRODUCT.md §21).
 *
 * Owns the durable `ReplayQueue` (IndexedDB) plus the reconnect-flush lifecycle:
 * when the browser fires `online`, every queued idempotent mutation is replayed
 * IN ORDER via a per-`type` executor the consuming screen registers. The screen
 * that knows how to issue `brand.update` is also the one that registers its
 * replay executor — so this provider stays decoupled from any specific router
 * (the call-engine / settings sessions wire their mutations through `enqueue` +
 * `registerExecutor`). `pendingCount` drives the offline banner's queued-count.
 *
 * Mounted once at the root (inside `Providers`) so the whole tree shares one
 * queue. Best-effort + fail-safe: with no IndexedDB the queue degrades to memory;
 * the server `(actorId, idempotencyKey)` 24h dedup remains the correctness
 * backstop regardless (`src/server/idempotency.ts`).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import {
  idbStore,
  ReplayQueue,
  type ReplayExecutor,
  type ReplayItem,
} from '@/lib/pwa/replay-queue';

interface ReplayQueueApi {
  /** Append an idempotent mutation for offline-safe replay. Returns its idempotency key. */
  enqueue: (type: string, payload: unknown) => Promise<string>;
  /** Register how to replay a given op `type`. Returns an unregister cleanup. */
  registerExecutor: (type: string, executor: ReplayExecutor) => () => void;
  /** Items currently waiting to be replayed (drives the offline banner). */
  pendingCount: number;
  /** Replay now (no-op when offline or empty). Auto-called on the `online` event. */
  flush: () => Promise<void>;
}

const ReplayQueueContext = createContext<ReplayQueueApi | null>(null);

export function ReplayQueueProvider({ children }: { children: ReactNode }) {
  const queueRef = useRef<ReplayQueue | null>(null);
  const executorsRef = useRef(new Map<string, ReplayExecutor>());
  const flushingRef = useRef(false);
  const [pendingCount, setPendingCount] = useState(0);

  const getQueue = useCallback((): ReplayQueue => {
    if (!queueRef.current) queueRef.current = new ReplayQueue(idbStore());
    return queueRef.current;
  }, []);

  const refreshCount = useCallback(async () => {
    setPendingCount(await getQueue().pendingCount());
  }, [getQueue]);

  // Dispatch a queued item to its registered executor; throw (→ queue stops &
  // retries) when no executor is registered yet, so order is never violated.
  const dispatch = useCallback<ReplayExecutor>((item: ReplayItem) => {
    const executor = executorsRef.current.get(item.type);
    if (!executor) return Promise.reject(new Error(`no replay executor for ${item.type}`));
    return executor(item);
  }, []);

  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    flushingRef.current = true;
    try {
      await getQueue().flush(dispatch);
    } finally {
      flushingRef.current = false;
      await refreshCount();
    }
  }, [getQueue, dispatch, refreshCount]);

  const enqueue = useCallback(
    async (type: string, payload: unknown): Promise<string> => {
      const item = await getQueue().enqueue(type, payload);
      await refreshCount();
      // If we're online (e.g. a transient failure, not a full offline), try to drain now.
      if (typeof navigator === 'undefined' || navigator.onLine) void flush();
      return item.id;
    },
    [getQueue, refreshCount, flush],
  );

  const registerExecutor = useCallback(
    (type: string, executor: ReplayExecutor): (() => void) => {
      executorsRef.current.set(type, executor);
      // A newly-registered executor may unblock a queued head — try to drain.
      void flush();
      return () => {
        if (executorsRef.current.get(type) === executor) executorsRef.current.delete(type);
      };
    },
    [flush],
  );

  useEffect(() => {
    void refreshCount();
    const onOnline = () => void flush();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [refreshCount, flush]);

  const api = useMemo<ReplayQueueApi>(
    () => ({ enqueue, registerExecutor, pendingCount, flush }),
    [enqueue, registerExecutor, pendingCount, flush],
  );

  return <ReplayQueueContext.Provider value={api}>{children}</ReplayQueueContext.Provider>;
}

/** Access the replay queue. Returns `null` outside the provider (the offline banner tolerates that). */
export function useReplayQueue(): ReplayQueueApi | null {
  return useContext(ReplayQueueContext);
}
