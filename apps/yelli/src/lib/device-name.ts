'use client';

import { useCallback, useEffect, useState } from 'react';

import { useDeviceId } from './device-id';

/**
 * Device display-name generator + persistence (PRODUCT.md Flow 6 / Page 5).
 *
 * OWNER REFINEMENT over the spec: a fresh device no longer defaults to the literal
 * "Guest" (which made every device indistinguishable on the LAN). It now defaults to
 * a generated friendly "adjective noun" readable name (e.g. "Swift Heron") so each
 * device is distinguishable, while staying within `deviceDisplayNameSchema`
 * (z.string().trim().min(1).max(24)). The user is prompted on first launch with this
 * name pre-filled and may accept or edit it.
 *
 * Storage mirrors the existing `device-id.ts` pattern: the chosen name lives in
 * localStorage (`yelli.device-name`) — exactly as Flow 6 specifies ("saved to
 * localStorage → used in directory + incoming-call modal"). No external deps; the
 * wordlists are curated and offline.
 *
 * The generated default is DETERMINISTIC from the stable device id so it is identical
 * across reloads before the user saves (no flicker), falling back to random when the
 * device id has not yet resolved.
 */

const DEVICE_NAME_KEY = 'yelli.device-name';

/** Hard cap — must satisfy `deviceDisplayNameSchema` (max 24). Truncation guard. */
export const DEVICE_NAME_MAX_LEN = 24;

/**
 * Curated, family-friendly adjectives. Kept short so any pair fits in 24 chars
 * (longest adjective + space + longest noun below stays ≤ 24).
 */
const ADJECTIVES = [
  'Swift',
  'Calm',
  'Bright',
  'Bold',
  'Kind',
  'Quiet',
  'Brave',
  'Clever',
  'Sunny',
  'Gentle',
  'Lively',
  'Mellow',
  'Nimble',
  'Plucky',
  'Jolly',
  'Cosmic',
  'Golden',
  'Silver',
  'Royal',
  'Merry',
  'Lucky',
  'Happy',
  'Witty',
  'Noble',
] as const;

/** Curated nouns (animals + nature). Short, recognisable, no awkward pairings. */
const NOUNS = [
  'Heron',
  'River',
  'Otter',
  'Falcon',
  'Maple',
  'Comet',
  'Willow',
  'Sparrow',
  'Cedar',
  'Pebble',
  'Lark',
  'Fox',
  'Robin',
  'Brook',
  'Finch',
  'Cloud',
  'Ember',
  'Meadow',
  'Harbor',
  'Pine',
  'Wren',
  'Crane',
  'Aspen',
  'Coral',
] as const;

/**
 * A small, fast, deterministic 32-bit hash (FNV-1a) of a string. Used to map a stable
 * device id → a stable word-pair index so the default name does not change on reload.
 */
function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // >>> 0 → unsigned.
  return h >>> 0;
}

/**
 * Generate a readable "Adjective Noun" name. When `seed` is provided the result is
 * deterministic (same seed → same name); otherwise it is random. Always non-empty and
 * ≤ DEVICE_NAME_MAX_LEN (the curated wordlists guarantee the cap, but we truncate
 * defensively so the contract holds even if the lists change).
 */
export function generateReadableName(seed?: string): string {
  let adjIdx: number;
  let nounIdx: number;
  if (seed && seed.length > 0) {
    const h = hash32(seed);
    adjIdx = h % ADJECTIVES.length;
    // Use the high bits for the noun so adjective and noun are weakly correlated.
    nounIdx = Math.floor(h / ADJECTIVES.length) % NOUNS.length;
  } else {
    adjIdx = Math.floor(Math.random() * ADJECTIVES.length);
    nounIdx = Math.floor(Math.random() * NOUNS.length);
  }
  const name = `${ADJECTIVES[adjIdx]} ${NOUNS[nounIdx]}`;
  return name.length > DEVICE_NAME_MAX_LEN ? name.slice(0, DEVICE_NAME_MAX_LEN).trim() : name;
}

/** Read the persisted device name (browser-only). Returns null on the server. */
export function readStoredDeviceName(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(DEVICE_NAME_KEY);
  const trimmed = raw?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export type DeviceNameState = {
  /** The stored name, or the generated default when none is stored yet. */
  name: string | null;
  /** True once a name has been explicitly saved by the user (first-launch is done). */
  isSet: boolean;
  /** True until localStorage has been read on the client (treat as "not ready"). */
  ready: boolean;
  /** Persist a chosen name (truncates to the 24-char cap, trims, ignores empty). */
  save: (next: string) => void;
};

/**
 * Device display-name hook. Drives the first-launch prompt and the later rename
 * affordance:
 *   • `isSet === false && ready` → show the first-launch picker pre-filled with `name`
 *     (the generated readable default).
 *   • `isSet === true`           → never re-prompt; `name` is the chosen value.
 *
 * The default is derived from the resolved device id so it is stable across reloads.
 */
export function useDeviceName(): DeviceNameState {
  const deviceId = useDeviceId();
  const [stored, setStored] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setStored(readStoredDeviceName());
    setReady(true);
  }, []);

  const save = useCallback((next: string) => {
    const trimmed = next.trim().slice(0, DEVICE_NAME_MAX_LEN).trim();
    if (trimmed.length === 0) return;
    window.localStorage.setItem(DEVICE_NAME_KEY, trimmed);
    setStored(trimmed);
  }, []);

  const isSet = stored !== null;
  // Pre-filled default for the picker — deterministic from the device id when known.
  const fallback = generateReadableName(deviceId ?? undefined);
  const name = stored ?? (ready ? fallback : null);

  return { name, isSet, ready, save };
}
