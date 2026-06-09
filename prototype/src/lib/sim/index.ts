// Barrel export — the only import surface the prototype UI is allowed to use.
// Phase 4 swap: replace these exports with tRPC client wrappers of identical shape.

export * from './types';
export { adminSession, auditLog, callSessions, devices, invitations, tenants, users, uuid } from './repo';
export { seedDefaults, forgetSeedFlag } from './seed';
export { advance, currentOffsetMs, now, reset } from './clock';
export { clearAll, emitChange, readTable, subscribe, writeTable } from './storage';
