import type { Job } from 'bullmq';
import nodemailer, { type Transporter } from 'nodemailer';
import { assertTenantUser, log } from './_validate';
import { QUEUE_NAMES, type EmailJobData } from '../queues';

/**
 * email worker — transactional invitation email send path (W5c, PROTOTYPE.md Flow F).
 *
 * Renders the invitation template and delivers it over the configured SMTP transport
 * (Cloud = platform SMTP; LAN account mode = customer-configured SMTP). The raw token
 * is single-use + time-limited (Auth Defaults #2/#3) and travels ONLY in the accept
 * link — it is NEVER persisted (only its SHA-256 hash on Invitation.tokenHash) and is
 * NEVER logged.
 *
 * Audit policy (W5c brief, device-archive precedent): structured-JSON completion /
 * failure logs ONLY — NO AuditLog row, NO AUDIT_ACTIONS vocab change. The
 * `invitation.create` domain audit row is already written by the invitations router at
 * enqueue time; this worker is delivery infrastructure, not a new auditable event.
 *
 * `verify` / `reset` kinds have no producer yet (only `enqueueInvitationEmail` fires
 * jobs) — they fail fast into the failed set (DLQ) rather than fabricating their copy,
 * mirroring the S3-stub "surface the gap" posture (Brain q-80-S2-01).
 */

/** Lazy SMTP transporter singleton, built from env (secrets read from env only — security.md). */
let transporter: Transporter | null = null;

function getTransport(): Transporter {
  if (transporter) return transporter;

  const host = process.env['SMTP_HOST'];
  const portRaw = process.env['SMTP_PORT'];
  if (!host || !portRaw) {
    throw new Error('SMTP_HOST and SMTP_PORT must be set to send email.');
  }
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid SMTP_PORT: ${portRaw}`);
  }

  // Auth ONLY when both a user and a password are present. Dev runs against MailHog
  // (no auth); staging/prod supply SMTP_USER + SMTP_PASS (schema key — falls back to
  // the legacy SMTP_PASSWORD name for compatibility with older env files).
  const user = process.env['SMTP_USER'];
  const pass = process.env['SMTP_PASS'] ?? process.env['SMTP_PASSWORD'];
  const auth = user && pass ? { user, pass } : undefined;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // implicit TLS on 465; STARTTLS/plaintext otherwise (MailHog: plaintext)
    ...(auth ? { auth } : {}),
  });
  return transporter;
}

/** The app's public origin, used to build the token-gated accept link. */
function appOrigin(): string {
  const origin = process.env['APP_URL'] ?? process.env['NEXTAUTH_URL'];
  if (!origin) {
    throw new Error('APP_URL or NEXTAUTH_URL must be set to build invitation accept links.');
  }
  return origin.replace(/\/+$/, '');
}

interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

/** Render the invitation email. `acceptUrl` is the LOCKED `/invite?token=…` route (PRODUCT.md). */
function renderInvitation(acceptUrl: string): RenderedEmail {
  const subject = "You're invited to join Yelli";
  const text = [
    "You've been invited to join an organization on Yelli.",
    '',
    'Accept your invitation and set your password:',
    acceptUrl,
    '',
    "This link expires in 7 days. If you weren't expecting this, you can safely ignore this email.",
  ].join('\n');
  // Transactional email bodies require literal inline styles (CSS variables / Tailwind
  // tokens do not apply in email clients) — ui-rules Rule 3 governs app components, not
  // email markup. Brand teal (#1a3a3a) matches the app chrome.
  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0a0a0a;">',
    '<h1 style="font-size:20px;margin:0 0 16px;">You\'re invited to join Yelli</h1>',
    '<p style="font-size:15px;line-height:1.5;margin:0 0 24px;">',
    "You've been invited to join an organization on Yelli. Accept your invitation and set your password to get started.",
    '</p>',
    `<p style="margin:0 0 24px;"><a href="${acceptUrl}" style="display:inline-block;background:#1a3a3a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px;font-weight:600;">Accept invitation</a></p>`,
    '<p style="font-size:13px;line-height:1.5;color:#6a6a6a;margin:0;">',
    "This link expires in 7 days. If you weren't expecting this, you can safely ignore this email.",
    '</p>',
    '</div>',
  ].join('');
  return { subject, text, html };
}

export async function processEmail(job: Job<EmailJobData>): Promise<void> {
  assertTenantUser(job.data);
  const { kind, to, token, tenantId } = job.data;

  // Scope (W5c): only the invitation send path. verify / reset have no producer yet.
  if (kind !== 'invitation') {
    throw new Error(`email kind '${kind}' is not yet wired (only 'invitation' is implemented).`);
  }

  const from = process.env['SMTP_FROM'];
  if (!from) {
    throw new Error('SMTP_FROM must be set to send email.');
  }

  const acceptUrl = `${appOrigin()}/invite?token=${encodeURIComponent(token)}`;
  const { subject, text, html } = renderInvitation(acceptUrl);

  try {
    const info = await getTransport().sendMail({ from, to, subject, text, html });
    if (info.accepted.length === 0) {
      // SMTP accepted no recipients — treat as a failure so BullMQ retries / DLQs.
      throw new Error('SMTP accepted no recipients.');
    }
    // Completion log: counts + messageId only — NEVER the token or recipient address.
    log('info', 'invitation email sent', {
      queue: QUEUE_NAMES.email,
      jobId: job.id,
      tenantId,
      kind,
      messageId: info.messageId,
      accepted: info.accepted.length,
      rejected: info.rejected.length,
    });
  } catch (err) {
    // Failure log: error message only — never the token or recipient PII.
    log('error', 'invitation email send failed', {
      queue: QUEUE_NAMES.email,
      jobId: job.id,
      tenantId,
      kind,
      error: (err as Error).message,
    });
    throw err; // BullMQ retry (attempts: 3, exponential backoff) → failed set (DLQ).
  }
}
