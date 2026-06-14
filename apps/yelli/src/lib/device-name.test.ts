import { describe, expect, it } from 'vitest';

import { DEVICE_NAME_MAX_LEN, generateReadableName } from './device-name';

/**
 * Readable device-name generator (PRODUCT.md Flow 6 owner refinement — friendly
 * "Adjective Noun" defaults instead of the literal "Guest"). Pure-function tests; the
 * localStorage `useDeviceName` hook is exercised by the component tests.
 */
describe('generateReadableName', () => {
  it('produces a two-word "Adjective Noun" readable name', () => {
    const name = generateReadableName('seed-1');
    expect(name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });

  it('never returns the literal "Guest"', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateReadableName(`seed-${i}`)).not.toBe('Guest');
      expect(generateReadableName()).not.toBe('Guest');
    }
  });

  it('always stays within the 24-char display-name cap and is non-empty', () => {
    for (let i = 0; i < 500; i += 1) {
      const seeded = generateReadableName(`device-${i}`);
      const random = generateReadableName();
      for (const n of [seeded, random]) {
        expect(n.trim().length).toBeGreaterThan(0);
        expect(n.length).toBeLessThanOrEqual(DEVICE_NAME_MAX_LEN);
      }
    }
  });

  it('is deterministic for a given seed (stable across reloads)', () => {
    expect(generateReadableName('stable-device-id')).toBe(generateReadableName('stable-device-id'));
  });

  it('produces variety across different device ids', () => {
    const names = new Set<string>();
    for (let i = 0; i < 100; i += 1) names.add(generateReadableName(`id-${i}`));
    // 24×24 = 576 combinations; 100 distinct seeds should yield many distinct names.
    expect(names.size).toBeGreaterThan(20);
  });
});
