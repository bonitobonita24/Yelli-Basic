// Typed repository — the SWAP BOUNDARY.
// Phase 4 replaces ONLY this file's implementations with tRPC client calls.
// UI imports must come exclusively from `./index` so the contract stays single-source.

import { now } from './clock';
import { readTable, writeTable } from './storage';
import {
  TABLES,
  type AdminSession,
  type AuditLog,
  type CallEndReason,
  type CallRole,
  type CallSession,
  type Device,
  type ExportJob,
  type Invitation,
  type Tenant,
  type User,
} from './types';

const ONLINE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes — matches PRODUCT.md presence rule.

export function uuid(): string {
  if (typeof window !== 'undefined' && typeof window.crypto?.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  // Deterministic fallback for SSR — not cryptographically strong, sim-only.
  return 'sim-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
}

// ─── AuditLog (declared first; other repos depend on it) ────────────────────────
export const auditLog = {
  append(entry: Omit<AuditLog, 'id' | 'createdAt'>): AuditLog {
    const rows = readTable<AuditLog>(TABLES.auditLog);
    const row: AuditLog = { id: uuid(), createdAt: now(), ...entry };
    writeTable(TABLES.auditLog, [row, ...rows]);
    return row;
  },
  recent(tenantId: string | null, limit = 50): AuditLog[] {
    const rows = readTable<AuditLog>(TABLES.auditLog);
    return rows.filter((r) => r.tenantId === tenantId).slice(0, limit);
  },
  all(): AuditLog[] {
    return readTable<AuditLog>(TABLES.auditLog);
  },
};

// ─── Devices ────────────────────────────────────────────────────────────────────
export const devices = {
  list(tenantId: string): Device[] {
    return readTable<Device>(TABLES.devices).filter((d) => d.tenantId === tenantId);
  },
  online(tenantId: string): Device[] {
    const cutoff = new Date(now()).getTime() - ONLINE_WINDOW_MS;
    return devices.list(tenantId).filter(
      (d) => d.archivedAt === null && new Date(d.lastSeenAt).getTime() >= cutoff,
    );
  },
  byId(id: string): Device | null {
    return readTable<Device>(TABLES.devices).find((d) => d.id === id) ?? null;
  },
  create(input: {
    tenantId: string;
    displayName: string;
    browserFingerprint: string;
    userId?: string | null;
    callRole?: CallRole;
  }): Device {
    const rows = readTable<Device>(TABLES.devices);
    const t = now();
    const row: Device = {
      id: uuid(),
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      displayName: input.displayName,
      callRole: input.callRole ?? 'receiver',
      browserFingerprint: input.browserFingerprint,
      assignedRoleAt: null,
      lastSeenAt: t,
      archivedAt: null,
      createdAt: t,
    };
    writeTable(TABLES.devices, [...rows, row]);
    auditLog.append({
      tenantId: input.tenantId,
      actorUserId: input.userId ?? null,
      action: 'device.create',
      payload: { deviceId: row.id, displayName: row.displayName },
    });
    return row;
  },
  setDisplayName(id: string, displayName: string): Device {
    const rows = readTable<Device>(TABLES.devices);
    const prior = rows.find((d) => d.id === id);
    if (!prior) throw new Error(`device ${id} not found`);
    const next = rows.map((d) => (d.id === id ? { ...d, displayName } : d));
    writeTable(TABLES.devices, next);
    const updated = next.find((d) => d.id === id)!;
    if (prior.displayName.trim() === '') {
      auditLog.append({
        tenantId: updated.tenantId,
        actorUserId: updated.userId,
        action: 'device.first_join',
        payload: { deviceId: id, name: displayName },
      });
    } else {
      auditLog.append({
        tenantId: updated.tenantId,
        actorUserId: updated.userId,
        action: 'device.rename',
        payload: { deviceId: id, from: prior.displayName, to: displayName },
      });
    }
    return updated;
  },
  setRole(id: string, role: CallRole, adminUserId?: string): Device {
    const rows = readTable<Device>(TABLES.devices);
    const prior = rows.find((d) => d.id === id);
    if (!prior) throw new Error(`device ${id} not found`);
    const t = now();
    const next = rows.map((d) =>
      d.id === id ? { ...d, callRole: role, assignedRoleAt: t } : d,
    );
    writeTable(TABLES.devices, next);
    const updated = next.find((d) => d.id === id)!;
    auditLog.append({
      tenantId: updated.tenantId,
      actorUserId: adminUserId ?? null,
      action: 'device.role.assign',
      payload: { deviceId: id, from: prior.callRole, to: role },
    });
    return updated;
  },
  touch(id: string): Device | null {
    const rows = readTable<Device>(TABLES.devices);
    const next = rows.map((d) => (d.id === id ? { ...d, lastSeenAt: now() } : d));
    writeTable(TABLES.devices, next);
    return next.find((d) => d.id === id) ?? null;
  },
  archiveOne(id: string, adminUserId?: string): Device {
    const rows = readTable<Device>(TABLES.devices);
    const prior = rows.find((d) => d.id === id);
    if (!prior) throw new Error(`device ${id} not found`);
    const t = now();
    const next = rows.map((d) => (d.id === id ? { ...d, archivedAt: t } : d));
    writeTable(TABLES.devices, next);
    const updated = next.find((d) => d.id === id)!;
    auditLog.append({
      tenantId: updated.tenantId,
      actorUserId: adminUserId ?? updated.userId,
      action: 'device.archive',
      payload: { deviceId: id },
    });
    return updated;
  },
  archive(olderThanDays: number): number {
    const rows = readTable<Device>(TABLES.devices);
    const cutoff = new Date(now()).getTime() - olderThanDays * 24 * 60 * 60 * 1000;
    let count = 0;
    const t = now();
    const next = rows.map((d) => {
      if (d.archivedAt === null && new Date(d.lastSeenAt).getTime() < cutoff) {
        count += 1;
        return { ...d, archivedAt: t };
      }
      return d;
    });
    writeTable(TABLES.devices, next);
    if (count > 0) {
      auditLog.append({
        tenantId: null,
        actorUserId: null,
        action: 'device.archive.batch',
        payload: { count, olderThanDays },
      });
    }
    return count;
  },
  unarchive(id: string): Device {
    const rows = readTable<Device>(TABLES.devices);
    const next = rows.map((d) =>
      d.id === id ? { ...d, archivedAt: null, lastSeenAt: now() } : d,
    );
    writeTable(TABLES.devices, next);
    const updated = next.find((d) => d.id === id);
    if (!updated) throw new Error(`device ${id} not found`);
    auditLog.append({
      tenantId: updated.tenantId,
      actorUserId: updated.userId,
      action: 'device.unarchive',
      payload: { deviceId: id },
    });
    return updated;
  },
  remove(id: string): void {
    const rows = readTable<Device>(TABLES.devices);
    const removed = rows.find((d) => d.id === id);
    writeTable(TABLES.devices, rows.filter((d) => d.id !== id));
    if (removed) {
      auditLog.append({
        tenantId: removed.tenantId,
        actorUserId: removed.userId,
        action: 'device.delete',
        payload: { deviceId: id },
      });
    }
  },
};

// ─── Call Sessions ──────────────────────────────────────────────────────────────
export const callSessions = {
  list(tenantId: string): CallSession[] {
    return readTable<CallSession>(TABLES.callSessions).filter((c) => c.tenantId === tenantId);
  },
  byId(id: string): CallSession | null {
    return readTable<CallSession>(TABLES.callSessions).find((c) => c.id === id) ?? null;
  },
  create(callerId: string, calleeId: string): CallSession {
    const caller = devices.byId(callerId);
    const callee = devices.byId(calleeId);
    if (!caller || !callee) throw new Error('caller or callee device not found');
    if (caller.tenantId !== callee.tenantId) throw new Error('cross-tenant call rejected');
    const row: CallSession = {
      id: uuid(),
      tenantId: caller.tenantId,
      callerDeviceId: callerId,
      calleeDeviceId: calleeId,
      callerRoleAtCall: caller.callRole,
      calleeRoleAtCall: callee.callRole,
      startedAt: now(),
      connectedAt: null,
      endedAt: null,
      durationSec: null,
      endReason: null,
    };
    const rows = readTable<CallSession>(TABLES.callSessions);
    writeTable(TABLES.callSessions, [...rows, row]);
    // Calls are NOT audit-logged — they live in CallSession entity (PRODUCT.md §11).
    return row;
  },
  connect(id: string): CallSession {
    const rows = readTable<CallSession>(TABLES.callSessions);
    const next = rows.map((c) => (c.id === id ? { ...c, connectedAt: now() } : c));
    writeTable(TABLES.callSessions, next);
    const updated = next.find((c) => c.id === id);
    if (!updated) throw new Error(`session ${id} not found`);
    return updated;
  },
  end(id: string, reason: CallEndReason): CallSession {
    const rows = readTable<CallSession>(TABLES.callSessions);
    const t = now();
    const next = rows.map((c) => {
      if (c.id !== id) return c;
      const startMs = c.connectedAt
        ? new Date(c.connectedAt).getTime()
        : new Date(c.startedAt).getTime();
      const durationSec = Math.max(0, Math.round((new Date(t).getTime() - startMs) / 1000));
      return { ...c, endedAt: t, endReason: reason, durationSec };
    });
    writeTable(TABLES.callSessions, next);
    const updated = next.find((c) => c.id === id);
    if (!updated) throw new Error(`session ${id} not found`);
    // Calls are NOT audit-logged — they live in CallSession entity (PRODUCT.md §11).
    return updated;
  },
};

// ─── Users ──────────────────────────────────────────────────────────────────────
export const users = {
  list(tenantId: string): User[] {
    return readTable<User>(TABLES.users).filter((u) => u.tenantId === tenantId);
  },
  byId(id: string): User | null {
    return readTable<User>(TABLES.users).find((u) => u.id === id) ?? null;
  },
  byEmail(email: string, tenantId: string): User | null {
    const norm = email.trim().toLowerCase();
    return (
      readTable<User>(TABLES.users).find(
        (u) => u.tenantId === tenantId && u.email.toLowerCase() === norm,
      ) ?? null
    );
  },
  create(input: {
    tenantId: string;
    email: string;
    displayName: string;
    role?: User['role'];
  }): User {
    const t = now();
    const row: User = {
      id: uuid(),
      tenantId: input.tenantId,
      email: input.email.trim().toLowerCase(),
      emailVerifiedAt: null,
      displayName: input.displayName,
      role: input.role ?? 'member',
      isSuspended: false,
      createdAt: t,
      lastLoginAt: null,
    };
    const rows = readTable<User>(TABLES.users);
    writeTable(TABLES.users, [...rows, row]);
    auditLog.append({
      tenantId: input.tenantId,
      actorUserId: null,
      action: 'user.create',
      payload: { userId: row.id, email: row.email, role: row.role },
    });
    return row;
  },
  suspend(id: string, suspended: boolean): User {
    const rows = readTable<User>(TABLES.users);
    const next = rows.map((u) => (u.id === id ? { ...u, isSuspended: suspended } : u));
    writeTable(TABLES.users, next);
    const updated = next.find((u) => u.id === id);
    if (!updated) throw new Error(`user ${id} not found`);
    auditLog.append({
      tenantId: updated.tenantId,
      actorUserId: null,
      action: suspended ? 'user.suspend' : 'user.unsuspend',
      payload: { userId: id },
    });
    return updated;
  },
  remove(id: string): void {
    const rows = readTable<User>(TABLES.users);
    const removed = rows.find((u) => u.id === id);
    writeTable(TABLES.users, rows.filter((u) => u.id !== id));
    if (removed) {
      auditLog.append({
        tenantId: removed.tenantId,
        actorUserId: null,
        action: 'user.delete',
        payload: { userId: id },
      });
    }
  },
};

// ─── Tenants ────────────────────────────────────────────────────────────────────
export const tenants = {
  list(): Tenant[] {
    return readTable<Tenant>(TABLES.tenants);
  },
  byId(id: string): Tenant | null {
    return readTable<Tenant>(TABLES.tenants).find((t) => t.id === id) ?? null;
  },
  bySlug(slug: string): Tenant | null {
    return readTable<Tenant>(TABLES.tenants).find((t) => t.slug === slug) ?? null;
  },
  create(input: { slug: string; displayName: string }): Tenant {
    const row: Tenant = {
      id: uuid(),
      slug: input.slug,
      displayName: input.displayName,
      logoUrl: null,
      isSuspended: false,
      hasAdminPassphrase: false,
      createdAt: now(),
    };
    const rows = readTable<Tenant>(TABLES.tenants);
    writeTable(TABLES.tenants, [...rows, row]);
    auditLog.append({
      tenantId: row.id,
      actorUserId: null,
      action: 'tenant.create',
      payload: { slug: row.slug, displayName: row.displayName },
    });
    return row;
  },
  updateBranding(id: string, patch: { displayName?: string; logoDataUrl?: string | null }): Tenant {
    const rows = readTable<Tenant>(TABLES.tenants);
    const next = rows.map((t) => {
      if (t.id !== id) return t;
      return {
        ...t,
        ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
        ...(patch.logoDataUrl !== undefined ? { logoUrl: patch.logoDataUrl } : {}),
      };
    });
    writeTable(TABLES.tenants, next);
    const updated = next.find((t) => t.id === id);
    if (!updated) throw new Error(`tenant ${id} not found`);
    auditLog.append({
      tenantId: id,
      actorUserId: null,
      action: 'tenant.branding.update',
      payload: { ...patch },
    });
    return updated;
  },
  setAdminPassphrase(id: string, plaintext: string): Tenant {
    // Sim: stores only the boolean flag — never the plaintext or any hash.
    void plaintext;
    const rows = readTable<Tenant>(TABLES.tenants);
    const next = rows.map((t) => (t.id === id ? { ...t, hasAdminPassphrase: true } : t));
    writeTable(TABLES.tenants, next);
    const updated = next.find((t) => t.id === id);
    if (!updated) throw new Error(`tenant ${id} not found`);
    auditLog.append({
      tenantId: id,
      actorUserId: null,
      action: 'tenant.admin.passphrase.set',
      payload: {},
    });
    return updated;
  },
};

// ─── Invitations ────────────────────────────────────────────────────────────────
const INVITE_TTL_DAYS = 7;

export const invitations = {
  list(tenantId: string): Invitation[] {
    return readTable<Invitation>(TABLES.invitations).filter((i) => i.tenantId === tenantId);
  },
  byId(id: string): Invitation | null {
    return readTable<Invitation>(TABLES.invitations).find((i) => i.id === id) ?? null;
  },
  create(tenantId: string, email: string, invitedByUserId: string): Invitation {
    const t = now();
    const expiresAt = new Date(
      new Date(t).getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const row: Invitation = {
      id: uuid(),
      tenantId,
      invitedByUserId,
      email: email.trim().toLowerCase(),
      expiresAt,
      acceptedAt: null,
      createdAt: t,
    };
    const rows = readTable<Invitation>(TABLES.invitations);
    writeTable(TABLES.invitations, [...rows, row]);
    auditLog.append({
      tenantId,
      actorUserId: invitedByUserId,
      action: 'invitation.create',
      payload: { invitationId: row.id, email: row.email },
    });
    return row;
  },
  accept(id: string): Invitation {
    const rows = readTable<Invitation>(TABLES.invitations);
    const next = rows.map((i) => (i.id === id ? { ...i, acceptedAt: now() } : i));
    writeTable(TABLES.invitations, next);
    const updated = next.find((i) => i.id === id);
    if (!updated) throw new Error(`invitation ${id} not found`);
    auditLog.append({
      tenantId: updated.tenantId,
      actorUserId: null,
      action: 'invitation.accept',
      payload: { invitationId: id },
    });
    return updated;
  },
  expire(id: string): Invitation {
    const rows = readTable<Invitation>(TABLES.invitations);
    const next = rows.map((i) => (i.id === id ? { ...i, expiresAt: now() } : i));
    writeTable(TABLES.invitations, next);
    const updated = next.find((i) => i.id === id);
    if (!updated) throw new Error(`invitation ${id} not found`);
    return updated;
  },
};

// ─── Admin Session (LAN anonymous mode — Flow E) ────────────────────────────────
// SIM: real impl uses Argon2id hash on Tenant.adminPassphraseHash + HttpOnly
// `yelli_admin_session` cookie. Prototype uses plaintext compare + sim table row.
const SIM_ADMIN_PASSPHRASE = 'yelli-admin';

export const adminSession = {
  current(): AdminSession | null {
    const rows = readTable<AdminSession>(TABLES.adminSession);
    return rows[0] ?? null;
  },
  login(
    tenantId: string,
    passphrase: string,
  ): { ok: true; session: AdminSession } | { ok: false; reason: 'wrong-passphrase' } {
    if (passphrase !== SIM_ADMIN_PASSPHRASE) {
      auditLog.append({
        tenantId,
        actorUserId: null,
        action: 'lan.admin.login.fail',
        payload: {},
      });
      return { ok: false, reason: 'wrong-passphrase' };
    }
    const row: AdminSession = { tenantId, issuedAt: now() };
    writeTable(TABLES.adminSession, [row]);
    auditLog.append({
      tenantId,
      actorUserId: null,
      action: 'lan.admin.login.success',
      payload: {},
    });
    return { ok: true, session: row };
  },
  logout(): void {
    const current = adminSession.current();
    writeTable(TABLES.adminSession, []);
    if (current) {
      auditLog.append({
        tenantId: current.tenantId,
        actorUserId: null,
        action: 'lan.admin.logout',
        payload: {},
      });
    }
  },
};

// ─── Tenant Exports ─────────────────────────────────────────────────────────────
const EXPORT_TTL_MS = 24 * 60 * 60 * 1000; // 24h signed URL
const EXPORT_PROCESS_MS = 1500; // sim BullMQ processing delay

function buildExportPayload(tenantId: string): { sizeBytes: number } {
  const snapshot = {
    tenant: tenants.byId(tenantId),
    users: users.list(tenantId),
    devices: devices.list(tenantId),
    invitations: invitations.list(tenantId),
    callSessions: callSessions.list(tenantId),
    auditLog: auditLog.recent(tenantId, 10000),
  };
  return { sizeBytes: JSON.stringify(snapshot).length };
}

function isExpired(job: ExportJob): boolean {
  if (!job.expiresAt) return false;
  return new Date(job.expiresAt).getTime() <= Date.now();
}

export const tenantExports = {
  list(tenantId: string): ExportJob[] {
    const rows = readTable<ExportJob>(TABLES.tenantExports).filter((r) => r.tenantId === tenantId);
    // Compute expired status lazily on read.
    const next = rows.map((r) => (r.status === 'ready' && isExpired(r) ? { ...r, status: 'expired' as const } : r));
    return next.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  },
  byId(id: string): ExportJob | null {
    const row = readTable<ExportJob>(TABLES.tenantExports).find((r) => r.id === id);
    if (!row) return null;
    if (row.status === 'ready' && isExpired(row)) return { ...row, status: 'expired' };
    return row;
  },
  request(input: { tenantId: string; requestedByUserId: string | null }): ExportJob {
    const id = uuid();
    const row: ExportJob = {
      id,
      tenantId: input.tenantId,
      requestedByUserId: input.requestedByUserId,
      status: 'queued',
      requestedAt: now(),
      readyAt: null,
      expiresAt: null,
      signedUrl: null,
      downloadedAt: null,
      payloadBytes: null,
    };
    const rows = readTable<ExportJob>(TABLES.tenantExports);
    writeTable(TABLES.tenantExports, [...rows, row]);
    auditLog.append({
      tenantId: input.tenantId,
      actorUserId: input.requestedByUserId,
      action: 'tenant.export.requested',
      payload: { exportId: id },
    });
    // Sim BullMQ processing: flip to 'processing' immediately, 'ready' after delay.
    if (typeof window !== 'undefined') {
      window.setTimeout(() => tenantExports._markProcessing(id), 50);
      window.setTimeout(() => tenantExports._markReady(id), EXPORT_PROCESS_MS);
    }
    return row;
  },
  _markProcessing(id: string): void {
    const rows = readTable<ExportJob>(TABLES.tenantExports);
    const next = rows.map((r) => (r.id === id && r.status === 'queued' ? { ...r, status: 'processing' as const } : r));
    writeTable(TABLES.tenantExports, next);
  },
  _markReady(id: string): void {
    const rows = readTable<ExportJob>(TABLES.tenantExports);
    const target = rows.find((r) => r.id === id);
    if (!target || target.status === 'ready' || target.status === 'expired') return;
    const { sizeBytes } = buildExportPayload(target.tenantId);
    const readyAt = now();
    const expiresAt = new Date(Date.now() + EXPORT_TTL_MS).toISOString();
    const signedUrl = `https://exports.yelli-basic.powerbyte.app/sim/${id}.json?expires=${encodeURIComponent(expiresAt)}&sig=stub-${id.slice(0, 8)}`;
    const next = rows.map((r) =>
      r.id === id
        ? { ...r, status: 'ready' as const, readyAt, expiresAt, signedUrl, payloadBytes: sizeBytes }
        : r,
    );
    writeTable(TABLES.tenantExports, next);
    auditLog.append({
      tenantId: target.tenantId,
      actorUserId: target.requestedByUserId,
      action: 'tenant.export.ready',
      payload: { exportId: id, payloadBytes: sizeBytes, expiresAt },
    });
  },
  markDownloaded(id: string): ExportJob | null {
    const rows = readTable<ExportJob>(TABLES.tenantExports);
    const target = rows.find((r) => r.id === id);
    if (!target) return null;
    if (target.status !== 'ready' || isExpired(target)) return tenantExports.byId(id);
    const downloadedAt = now();
    const next = rows.map((r) => (r.id === id ? { ...r, downloadedAt } : r));
    writeTable(TABLES.tenantExports, next);
    auditLog.append({
      tenantId: target.tenantId,
      actorUserId: target.requestedByUserId,
      action: 'tenant.export.downloaded',
      payload: { exportId: id },
    });
    return next.find((r) => r.id === id) ?? null;
  },
};
