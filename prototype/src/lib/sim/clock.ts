// Simulated clock — supports advancing time for deterministic edge cases
// (e.g. "device offline 91 days" → archive flow without waiting).

const OFFSET_KEY = 'yelli:sim:clockOffsetMs';

const isBrowser = (): boolean => typeof window !== 'undefined';

function offsetMs(): number {
  if (!isBrowser()) return 0;
  try {
    const raw = window.localStorage.getItem(OFFSET_KEY);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** Current simulated time as ISO 8601 string. */
export function now(): string {
  return new Date(Date.now() + offsetMs()).toISOString();
}

/** Move simulated clock forward (or backward) by N milliseconds. */
export function advance(ms: number): void {
  if (!isBrowser()) return;
  const next = offsetMs() + ms;
  window.localStorage.setItem(OFFSET_KEY, String(next));
}

/** Reset simulated clock back to real wall-clock time. */
export function reset(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(OFFSET_KEY);
}

/** Read-only accessor for debug UIs. */
export function currentOffsetMs(): number {
  return offsetMs();
}
