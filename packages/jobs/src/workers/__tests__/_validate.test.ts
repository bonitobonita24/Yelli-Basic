import { describe, expect, it } from 'vitest';

import { assertSystemJob, assertTenantUser } from '../_validate';

/**
 * Worker payload guards (security.md Queue Safety #1/#2): EVERY worker calls
 * assertTenantUser at the top of its processor; the whole-DB backup cron uses the
 * stricter assertSystemJob. These are the centralized guard against jobs running
 * without a validated tenant/user identity — first @yelli/jobs unit tests.
 */
describe('assertTenantUser', () => {
  it('accepts a payload with non-empty tenantId + userId', () => {
    expect(() => assertTenantUser({ tenantId: 't1', userId: 'u1' })).not.toThrow();
  });

  it.each([
    ['null', null],
    ['non-object', 'nope'],
    ['missing tenantId', { userId: 'u1' }],
    ['missing userId', { tenantId: 't1' }],
    ['empty tenantId', { tenantId: '', userId: 'u1' }],
    ['empty userId', { tenantId: 't1', userId: '' }],
    ['numeric ids', { tenantId: 1, userId: 2 }],
  ])('rejects %s', (_label, payload) => {
    expect(() => assertTenantUser(payload)).toThrow(/tenantId and userId are required/);
  });
});

describe('assertSystemJob', () => {
  it('accepts the platform system identity (_pwbt / system)', () => {
    expect(() => assertSystemJob({ tenantId: '_pwbt', userId: 'system' })).not.toThrow();
  });

  it.each([
    ['a normal tenant job', { tenantId: 't1', userId: 'u1' }],
    ['wrong user', { tenantId: '_pwbt', userId: 'u1' }],
    ['wrong tenant', { tenantId: 't1', userId: 'system' }],
    ['null', null],
  ])('rejects %s', (_label, payload) => {
    expect(() => assertSystemJob(payload)).toThrow(/system job payload/);
  });
});
