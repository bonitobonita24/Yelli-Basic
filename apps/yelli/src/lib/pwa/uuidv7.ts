/**
 * UUIDv7 generator (RFC 9562) — time-ordered, dependency-free.
 *
 * The offline mutation replay queue (PRODUCT.md §21) needs a stable, monotonic
 * idempotency key per queued mutation: the client re-sends the SAME key on
 * reconnect and the server dedupes on `(actorId, idempotencyKey)` within 24h
 * (see `src/server/idempotency.ts`). UUIDv7 is the right shape — its leading
 * 48 bits are the unix-millisecond timestamp, so keys sort in creation order
 * (FIFO replay "in order on reconnect") while the trailing bits stay random.
 *
 * Layout (128 bits):
 *   bytes 0..5   48-bit big-endian unix-ms timestamp
 *   byte  6      high nibble = version (0b0111 = 7)
 *   byte  8      high two bits = variant (0b10)
 *   remaining    cryptographically-random (crypto.getRandomValues)
 *
 * `crypto` is available both in the browser (PWA client) and in Node ≥18 (the
 * vitest node env) as the WebCrypto global — no polyfill, no dependency.
 */
export function uuidv7(timestampMs: number = Date.now()): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);

  // DataView reads return `number` (not `number | undefined`), sidestepping
  // `noUncheckedIndexedAccess` on the random bytes we mask in place.
  const view = new DataView(buf.buffer);
  const ts = Math.floor(timestampMs);

  // 48-bit timestamp split into a 32-bit high word + 16-bit low word.
  view.setUint32(0, Math.floor(ts / 0x1_0000));
  view.setUint16(4, ts % 0x1_0000);

  // version 7 in the high nibble of byte 6; variant 0b10 in the high bits of byte 8.
  view.setUint8(6, (view.getUint8(6) & 0x0f) | 0x70);
  view.setUint8(8, (view.getUint8(8) & 0x3f) | 0x80);

  const hex = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
