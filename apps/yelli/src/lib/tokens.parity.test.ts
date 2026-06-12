import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { tokens } from './tokens';

/**
 * Drift guard for the LOCKED Clay design tokens (DECISIONS_LOG "Design Tokens").
 * `src/styles/tokens.css` is the single source of truth; `tokens.ts` is a
 * hand-maintained TS mirror. This test parses the CSS `:root` block and asserts
 * it matches the TS object exactly, so the two can never silently diverge.
 */

const CSS_PATH = fileURLToPath(new URL('../styles/tokens.css', import.meta.url));

/** Parse the `:root { ... }` custom-property declarations from tokens.css. */
function parseRootTokens(css: string): Record<string, string> {
  const rootMatch = css.match(/:root\s*\{([^}]*)\}/);
  if (!rootMatch || rootMatch[1] === undefined) {
    throw new Error('tokens.css: no :root { } block found');
  }
  const out: Record<string, string> = {};
  for (const rawLine of rootMatch[1].split('\n')) {
    const decl = rawLine.match(/^\s*(--[\w-]+)\s*:\s*(.+?);\s*$/);
    if (decl && decl[1] && decl[2]) {
      out[decl[1]] = decl[2].trim();
    }
  }
  return out;
}

describe('Clay design token parity (tokens.css ↔ tokens.ts)', () => {
  const cssTokens = parseRootTokens(readFileSync(CSS_PATH, 'utf8'));

  it('parses a non-empty :root block', () => {
    expect(Object.keys(cssTokens).length).toBeGreaterThan(0);
  });

  it('the TS mirror matches the CSS source exactly', () => {
    // Sorted-key comparison: catches added, removed, or changed tokens in either file.
    const sort = (obj: Record<string, string>) =>
      Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
    expect(sort({ ...tokens })).toEqual(sort(cssTokens));
  });
});
