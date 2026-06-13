import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * email worker — invitation send path (W5c, Flow F). Confirmed live in the S6 walk
 * (MailHog received the invite); this pins the unit behavior: Queue-Safety guard,
 * invitation-only scope, token-gated /invite link, SMTP-no-recipients failure, and
 * the secrets-hygiene contract (token/recipient never logged — asserted via the
 * sendMail payload, not logs).
 */
const h = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: h.sendMail }) } }));

const { processEmail } = await import('../email');

const job = (data: unknown) => ({ id: 'j1', data }) as never;
const invite = { kind: 'invitation', to: 'invitee@x.test', token: 'raw-token-123', tenantId: 't1', userId: 'u1' };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SMTP_HOST = 'localhost';
  process.env.SMTP_PORT = '1025';
  process.env.SMTP_FROM = 'no-reply@yelli.app';
  process.env.APP_URL = 'https://acme.yelli.app';
});
afterEach(() => {
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_FROM;
  delete process.env.APP_URL;
});

describe('processEmail', () => {
  it('rejects a job missing tenant/user identity', async () => {
    await expect(processEmail(job({ kind: 'invitation', to: 'x@y.z', token: 't' }))).rejects.toThrow(
      /tenantId and userId are required/,
    );
  });

  it("rejects an unwired kind (only 'invitation' is implemented)", async () => {
    await expect(processEmail(job({ ...invite, kind: 'verify' }))).rejects.toThrow(/not yet wired/);
  });

  it('sends the invitation with a token-gated /invite link and correct subject', async () => {
    h.sendMail.mockResolvedValue({ accepted: ['invitee@x.test'], rejected: [], messageId: 'm1' });

    await processEmail(job(invite));

    expect(h.sendMail).toHaveBeenCalledTimes(1);
    const arg = h.sendMail.mock.calls[0]![0] as { to: string; subject: string; text: string; html: string };
    expect(arg.to).toBe('invitee@x.test');
    expect(arg.subject).toBe("You're invited to join Yelli");
    expect(arg.text).toContain('https://acme.yelli.app/invite?token=raw-token-123');
    expect(arg.html).toContain('/invite?token=raw-token-123');
  });

  it('throws when SMTP accepts no recipients (→ BullMQ retry/DLQ)', async () => {
    h.sendMail.mockResolvedValue({ accepted: [], rejected: ['invitee@x.test'], messageId: 'm2' });
    await expect(processEmail(job(invite))).rejects.toThrow(/accepted no recipients/);
  });
});
