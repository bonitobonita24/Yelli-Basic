// Idempotent seeding. Checks a per-mode flag so re-running is a no-op.

import { devices, tenants, users } from './repo';
import { readTable, writeTable } from './storage';
import { TABLES, type PrototypeMode } from './types';

const SEED_FLAG_TABLE = 'seedFlags';

type SeedFlag = { mode: string };

function modeKey(mode: PrototypeMode): string {
  if (mode.edition === 'lan') return mode.lanAccountMode ? 'lan-account' : 'lan-anon';
  return 'cloud';
}

function alreadySeeded(mode: PrototypeMode): boolean {
  const flags = readTable<SeedFlag>(SEED_FLAG_TABLE);
  return flags.some((f) => f.mode === modeKey(mode));
}

function markSeeded(mode: PrototypeMode): void {
  const flags = readTable<SeedFlag>(SEED_FLAG_TABLE);
  writeTable(SEED_FLAG_TABLE, [...flags, { mode: modeKey(mode) }]);
}

export function seedDefaults(mode: PrototypeMode): void {
  if (typeof window === 'undefined') return;
  if (alreadySeeded(mode)) return;

  if (mode.edition === 'lan' && !mode.lanAccountMode) {
    const tenant = tenants.create({ slug: 'default', displayName: 'Yelli LAN' });
    devices.create({
      tenantId: tenant.id,
      displayName: 'Alex (Reception)',
      browserFingerprint: 'fp-lan-alex',
      callRole: 'receiver',
    });
    devices.create({
      tenantId: tenant.id,
      displayName: 'Sam (Workshop)',
      browserFingerprint: 'fp-lan-sam',
      callRole: 'both',
    });
    devices.create({
      tenantId: tenant.id,
      displayName: 'Jordan (Office)',
      browserFingerprint: 'fp-lan-jordan',
      callRole: 'caller',
    });
  } else if (mode.edition === 'lan' && mode.lanAccountMode) {
    const tenant = tenants.create({ slug: 'default', displayName: 'Yelli LAN' });
    const admin = users.create({
      tenantId: tenant.id,
      email: 'admin@yelli.local',
      displayName: 'LAN Admin',
      role: 'admin',
    });
    const m1 = users.create({
      tenantId: tenant.id,
      email: 'sam@yelli.local',
      displayName: 'Sam',
      role: 'member',
    });
    const m2 = users.create({
      tenantId: tenant.id,
      email: 'jordan@yelli.local',
      displayName: 'Jordan',
      role: 'member',
    });
    devices.create({
      tenantId: tenant.id,
      userId: admin.id,
      displayName: 'Alex (Reception)',
      browserFingerprint: 'fp-lana-alex',
      callRole: 'receiver',
    });
    devices.create({
      tenantId: tenant.id,
      userId: m1.id,
      displayName: 'Sam (Workshop)',
      browserFingerprint: 'fp-lana-sam',
      callRole: 'both',
    });
    devices.create({
      tenantId: tenant.id,
      userId: m2.id,
      displayName: 'Jordan (Office)',
      browserFingerprint: 'fp-lana-jordan',
      callRole: 'caller',
    });
  } else {
    const tenant = tenants.create({ slug: 'demo', displayName: 'Demo Co' });
    const admin = users.create({
      tenantId: tenant.id,
      email: 'admin@demo.test',
      displayName: 'Cloud Admin',
      role: 'admin',
    });
    const m1 = users.create({
      tenantId: tenant.id,
      email: 'sam@demo.test',
      displayName: 'Sam',
      role: 'member',
    });
    const m2 = users.create({
      tenantId: tenant.id,
      email: 'jordan@demo.test',
      displayName: 'Jordan',
      role: 'member',
    });
    devices.create({
      tenantId: tenant.id,
      userId: admin.id,
      displayName: 'Reception Desk',
      browserFingerprint: 'fp-cloud-recv',
      callRole: 'receiver',
    });
    devices.create({
      tenantId: tenant.id,
      userId: m1.id,
      displayName: "Sam's Laptop",
      browserFingerprint: 'fp-cloud-sam',
      callRole: 'both',
    });
    devices.create({
      tenantId: tenant.id,
      userId: m2.id,
      displayName: "Jordan's Phone",
      browserFingerprint: 'fp-cloud-jordan',
      callRole: 'caller',
    });
  }

  markSeeded(mode);
}

/** Force-reseed for debug — clears the flag for the mode but does NOT wipe data. */
export function forgetSeedFlag(mode: PrototypeMode): void {
  const flags = readTable<SeedFlag>(SEED_FLAG_TABLE);
  writeTable(
    SEED_FLAG_TABLE,
    flags.filter((f) => f.mode !== modeKey(mode)),
  );
}

void TABLES; // keep import — types.ts is the source of truth for table names
