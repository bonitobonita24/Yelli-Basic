import type { Metadata } from 'next';
import Link from 'next/link';

import { ComplianceFooter } from '@/components/shell/ComplianceFooter';

export const metadata: Metadata = {
  title: 'Privacy Policy — Yelli',
  description:
    'How Yelli collects, uses, and protects your personal data under the Philippine Data Privacy Act (RA 10173).',
};

/**
 * Public privacy policy page — PH Data Privacy Act (RA 10173) aligned.
 * Server component (no auth required — publicly accessible).
 *
 * Retention facts sourced from docs/PRODUCT.md §Data Entities:
 *   AuditLog    — 7 years  (RA 10173 §21 + SEC/BIR records-retention)
 *   CallSession — 1 year   (operational log, proportionality principle)
 *   User accounts — indefinite while active; soft-delete 7-day grace then hard delete
 *   Devices — indefinite while active; auto-archived after 90 days offline
 *
 * DSR statutory window: 15 calendar days (NPC Advisory Opinion 2016-49 / IRR Rule XI §47).
 */
export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Skip-to-main link for keyboard / screen-reader users (WCAG 2.4.1) */}
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        Skip to main content
      </a>

      {/* Simple public nav header */}
      <header className="border-b border-border bg-card px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            href="/"
            className="min-h-11 min-w-11 inline-flex items-center gap-2 rounded-md text-lg font-semibold text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Yelli home"
          >
            Yelli
          </Link>
          <Link
            href="/login"
            className="min-h-11 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-14">
        {/* Page heading */}
        <div className="mb-10">
          <p className="mb-2 text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Legal
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-3 text-muted-foreground">
            Last updated: <time dateTime="2026-06-20">20 June 2026</time>
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            This policy describes how <strong>Powerbyte IT Solutions</strong> (&ldquo;we&rdquo;,
            &ldquo;us&rdquo;, &ldquo;our&rdquo;) collects, uses, stores, and protects your personal
            data when you use <strong>Yelli</strong>, our dual-mode (LAN + Cloud) peer-to-peer
            calling platform. It is prepared in compliance with the{' '}
            <strong>Philippine Data Privacy Act of 2012 (Republic Act No. 10173)</strong> and its
            Implementing Rules and Regulations.
          </p>
        </div>

        <div className="space-y-10">
          {/* 1. Data We Collect */}
          <section aria-labelledby="section-data-collected">
            <h2
              id="section-data-collected"
              className="mb-4 text-xl font-semibold text-foreground"
            >
              1. Personal Data We Collect
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              We collect only what is necessary for Yelli to function:
            </p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th
                      scope="col"
                      className="px-4 py-3 text-left font-semibold text-foreground"
                    >
                      Data type
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left font-semibold text-foreground"
                    >
                      Examples
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left font-semibold text-foreground"
                    >
                      Purpose
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr className="bg-background">
                    <td className="px-4 py-3 font-medium text-foreground">Account info</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      Email address, display name
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      Authentication, member directory
                    </td>
                  </tr>
                  <tr className="bg-card">
                    <td className="px-4 py-3 font-medium text-foreground">Device info</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      Device name, call role (Caller/Receiver/Both), last-seen timestamp
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      LAN/Cloud directory, call routing
                    </td>
                  </tr>
                  <tr className="bg-background">
                    <td className="px-4 py-3 font-medium text-foreground">
                      Call metadata
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      Caller device ID, callee device ID, call duration, end reason
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      Call history, billing, operational analytics
                    </td>
                  </tr>
                  <tr className="bg-card">
                    <td className="px-4 py-3 font-medium text-foreground">Audit events</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      Admin actions (invite, suspend, role change), actor + timestamp
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      Security audit trail, regulatory compliance
                    </td>
                  </tr>
                  <tr className="bg-background">
                    <td className="px-4 py-3 font-medium text-foreground">
                      Consent records
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      Consent type, version, granted/withdrawn date
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      Legal basis documentation under RA 10173
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              We do <strong>not</strong> record the audio or video content of calls. Call streams
              travel peer-to-peer via WebRTC and are not stored on our servers.
            </p>
          </section>

          {/* 2. Lawful Basis */}
          <section aria-labelledby="section-lawful-basis">
            <h2
              id="section-lawful-basis"
              className="mb-4 text-xl font-semibold text-foreground"
            >
              2. Lawful Basis for Processing
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">
              We process your personal data on one or more of the following lawful criteria under RA
              10173 §12 and §13:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground" role="list">
              <li className="flex gap-2">
                <span className="mt-0.5 shrink-0 text-foreground" aria-hidden="true">
                  ▸
                </span>
                <span>
                  <strong className="text-foreground">Consent</strong> — you provide your email and
                  display name when creating an account or joining an organisation.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 shrink-0 text-foreground" aria-hidden="true">
                  ▸
                </span>
                <span>
                  <strong className="text-foreground">Contractual necessity</strong> — processing is
                  required to fulfil the Yelli service you subscribed to (call routing, member
                  directory).
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 shrink-0 text-foreground" aria-hidden="true">
                  ▸
                </span>
                <span>
                  <strong className="text-foreground">Legitimate interests</strong> — security
                  monitoring, fraud prevention, and operational analytics.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 shrink-0 text-foreground" aria-hidden="true">
                  ▸
                </span>
                <span>
                  <strong className="text-foreground">Legal obligation</strong> — audit-log
                  retention as required by RA 10173 §21, SEC and BIR records-retention rules.
                </span>
              </li>
            </ul>
          </section>

          {/* 3. Data Retention */}
          <section aria-labelledby="section-retention">
            <h2 id="section-retention" className="mb-4 text-xl font-semibold text-foreground">
              3. How Long We Keep Your Data
            </h2>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th
                      scope="col"
                      className="px-4 py-3 text-left font-semibold text-foreground"
                    >
                      Data category
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left font-semibold text-foreground"
                    >
                      Retention period
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left font-semibold text-foreground"
                    >
                      Reason
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr className="bg-background">
                    <td className="px-4 py-3 font-medium text-foreground">Audit log entries</td>
                    <td className="px-4 py-3 text-muted-foreground">7 years</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      RA 10173 §21 + SEC/BIR records-retention rules
                    </td>
                  </tr>
                  <tr className="bg-card">
                    <td className="px-4 py-3 font-medium text-foreground">
                      Call session metadata
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">1 year</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      Operational log; proportionality principle
                    </td>
                  </tr>
                  <tr className="bg-background">
                    <td className="px-4 py-3 font-medium text-foreground">User accounts</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      Indefinite while active; 7-day grace period after deletion request, then
                      hard-deleted
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      Service continuity; accidental-delete recovery
                    </td>
                  </tr>
                  <tr className="bg-card">
                    <td className="px-4 py-3 font-medium text-foreground">Device records</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      Indefinite while active; auto-archived after 90 days offline
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">Directory accuracy</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              When you exercise your right to erasure (Right to be Forgotten), your account is
              immediately suspended and flagged for deletion. Legally-retained rows (AuditLog,
              CallSession) are <em>not</em> purged — this is required by law. The 7-day grace
              period allows accidental-delete recovery before permanent removal.
            </p>
          </section>

          {/* 4. Your Rights */}
          <section aria-labelledby="section-rights">
            <h2 id="section-rights" className="mb-4 text-xl font-semibold text-foreground">
              4. Your Rights as a Data Subject (RA 10173 §16)
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Under the Philippine Data Privacy Act, you have the following rights. We will respond
              within <strong>15 calendar days</strong> of a verified request (NPC Advisory Opinion
              2016-49 / IRR Rule XI §47).
            </p>
            <div className="space-y-3">
              {[
                {
                  right: 'Right to be Informed (§16(b))',
                  description:
                    'You have the right to know what personal data we collect, why we collect it, and how it is used. This policy fulfils that obligation.',
                },
                {
                  right: 'Right of Access (§16(c))',
                  description:
                    'You may request a copy of all personal data we hold about you. Use the "Download my data" button in your account Settings → Data & Privacy.',
                },
                {
                  right: 'Right to Rectification (§16(d))',
                  description:
                    'You may correct inaccurate or incomplete personal data at any time from Settings → Data & Privacy → Edit profile.',
                },
                {
                  right: 'Right to Erasure / Blocking (§16(e))',
                  description:
                    'You may request deletion of your account. Your account will be suspended immediately and hard-deleted after the 7-day grace period. Legally-retained records (AuditLog 7yr, CallSession 1yr) are exempt as required by law.',
                },
                {
                  right: 'Right to Data Portability (§16(f))',
                  description:
                    'You may download a machine-readable JSON export of your personal data from Settings → Data & Privacy → Download my data.',
                },
                {
                  right: 'Right to Object (§16(h))',
                  description:
                    'You may object to the processing of your personal data where we rely on legitimate interests as the lawful basis. Contact our DPO (details below).',
                },
              ].map(({ right, description }) => (
                <div
                  key={right}
                  className="rounded-lg border border-border bg-card px-4 py-4"
                >
                  <p className="font-semibold text-foreground">{right}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 5. DSR Self-Service */}
          <section
            aria-labelledby="section-exercise-rights"
            className="rounded-xl border border-border bg-card p-6"
          >
            <h2
              id="section-exercise-rights"
              className="mb-2 text-xl font-semibold text-foreground"
            >
              5. How to Exercise Your Rights
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Signed-in users can exercise most rights directly from the app without contacting us:
            </p>
            <Link
              href="/settings"
              className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Go to Settings → Data &amp; Privacy
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              If you are not able to access the self-service portal, or wish to object to processing
              or file a complaint, contact our Data Protection Officer:
            </p>
            <address className="mt-3 not-italic">
              <p className="text-sm font-medium text-foreground">Data Protection Officer</p>
              <p className="text-sm text-muted-foreground">Powerbyte IT Solutions</p>
              <p className="text-sm text-muted-foreground">Lipa City, Batangas, Philippines</p>
              <a
                href="mailto:bonitobonita24@gmail.com"
                className="mt-1 inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                bonitobonita24@gmail.com
              </a>
            </address>
          </section>

          {/* 6. Data Sharing */}
          <section aria-labelledby="section-sharing">
            <h2 id="section-sharing" className="mb-4 text-xl font-semibold text-foreground">
              6. Data Sharing and Third Parties
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">
              We do not sell your personal data. We share data only as follows:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground" role="list">
              <li className="flex gap-2">
                <span className="mt-0.5 shrink-0 text-foreground" aria-hidden="true">▸</span>
                <span>
                  <strong className="text-foreground">Hosting provider</strong> — servers hosted on
                  Hostinger VPS (Philippines/Asia region). Data at rest encrypted via storage-level
                  encryption.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 shrink-0 text-foreground" aria-hidden="true">▸</span>
                <span>
                  <strong className="text-foreground">Object storage (exports only)</strong> —
                  tenant data exports are temporarily stored in S3-compatible object storage
                  (Cloudflare R2) for up to 24 hours, then deleted.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 shrink-0 text-foreground" aria-hidden="true">▸</span>
                <span>
                  <strong className="text-foreground">Legal requirement</strong> — we may disclose
                  data when required by Philippine law, court order, or a lawful request from a
                  government authority.
                </span>
              </li>
            </ul>
          </section>

          {/* 7. Security */}
          <section aria-labelledby="section-security">
            <h2 id="section-security" className="mb-4 text-xl font-semibold text-foreground">
              7. Security Measures
            </h2>
            <p className="text-sm text-muted-foreground">
              Yelli employs a layered security model (L1–L6): HTTPS-only transport (TLS 1.3),
              bcrypt-hashed passwords, row-level tenant isolation on every database query, session
              invalidation on security-sensitive changes, and an append-only audit log. Call media
              never transits our servers — WebRTC streams are peer-to-peer and end-to-end encrypted
              by the browser.
            </p>
          </section>

          {/* 8. Contact / Changes */}
          <section aria-labelledby="section-contact">
            <h2 id="section-contact" className="mb-4 text-xl font-semibold text-foreground">
              8. Changes to This Policy and Contact
            </h2>
            <p className="text-sm text-muted-foreground">
              We may update this policy from time to time. Material changes will be communicated via
              an in-app notice or email. Continued use of Yelli after the effective date constitutes
              acceptance of the updated policy. If you have questions, contact our DPO at{' '}
              <a
                href="mailto:bonitobonita24@gmail.com"
                className="text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                bonitobonita24@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      <ComplianceFooter />
    </div>
  );
}
