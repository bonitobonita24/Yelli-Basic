// Low-level localStorage wrapper. SSR-safe — every function no-ops when window is undefined.
// Cross-tab updates fire via native 'storage' event; same-tab updates use a custom CustomEvent.

const STORAGE_KEY_PREFIX = 'yelli:sim:';
const CHANGE_EVENT = 'yelli:sim:change';

const isBrowser = (): boolean => typeof window !== 'undefined';

const keyFor = (table: string): string => `${STORAGE_KEY_PREFIX}${table}`;

export function readTable<T>(table: string): T[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(keyFor(table));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function writeTable<T>(table: string, rows: T[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(keyFor(table), JSON.stringify(rows));
    emitChange(table);
  } catch {
    // Quota or serialization error — swallow in sim, surface in real backend.
  }
}

export function emitChange(table: string): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { table } }));
}

/**
 * Subscribe to a table's changes. Returns an unsubscribe function.
 * Listens to BOTH cross-tab 'storage' events and same-tab CustomEvent so any
 * tab that writes triggers re-render in every tab including the writer.
 */
export function subscribe(table: string, cb: () => void): () => void {
  if (!isBrowser()) return () => undefined;
  const onStorage = (e: StorageEvent): void => {
    if (e.key === keyFor(table)) cb();
  };
  const onCustom = (e: Event): void => {
    const detail = (e as CustomEvent<{ table: string }>).detail;
    if (detail?.table === table) cb();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(CHANGE_EVENT, onCustom);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CHANGE_EVENT, onCustom);
  };
}

/** Wipes every yelli:sim:* key. Debug-reset only. */
export function clearAll(): void {
  if (!isBrowser()) return;
  const toRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(STORAGE_KEY_PREFIX)) toRemove.push(k);
  }
  toRemove.forEach((k) => window.localStorage.removeItem(k));
  // Broadcast a wildcard reset.
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { table: '*' } }));
}

export const STORAGE_INTERNAL = { STORAGE_KEY_PREFIX, CHANGE_EVENT, keyFor };
