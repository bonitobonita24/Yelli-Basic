import { describe, expect, it } from 'vitest';

import { uuidv7 } from './uuidv7';

/**
 * Guards the offline-replay idempotency-key generator (PRODUCT.md §21): keys must
 * be RFC-9562 v7 (so the server `(actorId, idempotencyKey)` dedup is well-formed)
 * AND time-ordered (so FIFO replay sorts by creation time).
 */
describe('uuidv7', () => {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  it('produces a canonical UUID string', () => {
    expect(uuidv7()).toMatch(UUID_RE);
  });

  it('sets version 7 and the RFC-4122 variant', () => {
    const id = uuidv7();
    // Version nibble = 1st char of the 3rd group; variant = 1st char of the 4th group (8/9/a/b).
    expect(id[14]).toBe('7');
    expect(['8', '9', 'a', 'b']).toContain(id[19]);
  });

  it('encodes the supplied timestamp in the leading 48 bits', () => {
    const ms = 0x0123456789ab;
    const id = uuidv7(ms);
    const hexTs = id.replace(/-/g, '').slice(0, 12);
    expect(hexTs).toBe('0123456789ab');
  });

  it('sorts lexicographically in timestamp order', () => {
    const early = uuidv7(1_000);
    const late = uuidv7(2_000);
    expect(early < late).toBe(true);
  });

  it('is unique across many draws at the same instant', () => {
    const now = 1_700_000_000_000;
    const ids = new Set(Array.from({ length: 1_000 }, () => uuidv7(now)));
    expect(ids.size).toBe(1_000);
  });
});
