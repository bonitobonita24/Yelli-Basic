import { describe, expect, it } from 'vitest';

import { presentSignalSchema, signalMessageSchema } from '@yelli/shared';

// W2c three-way calling — the `present` signal announces a presenter's
// screen-share stream. It rides the SAME routing envelope as offer/answer/ice/
// hangup (to/sessionId/kind) with the {state, streamId} payload carried opaquely
// in `data`; presentSignalSchema validates that inner payload.

const envelope = (data: unknown) => ({
  type: 'signal' as const,
  to: 'devB',
  sessionId: 's1',
  kind: 'present' as const,
  data,
});

describe('present signal — envelope (signalMessageSchema)', () => {
  it('parses a `present` frame on the same envelope as other kinds', () => {
    const result = signalMessageSchema.safeParse(envelope({ state: 'start', streamId: 'stream-1' }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe('present');
    }
  });
});

describe('present signal — payload (presentSignalSchema)', () => {
  it('parses a valid start payload', () => {
    const result = presentSignalSchema.safeParse({ state: 'start', streamId: 'stream-1' });
    expect(result.success).toBe(true);
  });

  it('parses a valid stop payload', () => {
    const result = presentSignalSchema.safeParse({ state: 'stop', streamId: 'stream-1' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid state', () => {
    const result = presentSignalSchema.safeParse({ state: 'pause', streamId: 'stream-1' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty streamId', () => {
    const result = presentSignalSchema.safeParse({ state: 'start', streamId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing streamId', () => {
    const result = presentSignalSchema.safeParse({ state: 'start' });
    expect(result.success).toBe(false);
  });
});
