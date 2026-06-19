import Link from 'next/link';

/**
 * ComplianceFooter — Honest-badge compliance footer (V32.9 Rule 33).
 *
 * HONEST-BADGE POLICY (do not remove this comment):
 *   Design-claims: truthful statements about our intent/process — shown by default.
 *   Cert-badges:   real third-party certifications (ISO 27001, SOC 2, PCI-DSS, etc.) —
 *                  OFF by default via `showCertBadges={false}` because Yelli currently
 *                  holds NONE of these. Only set showCertBadges=true when Powerbyte has
 *                  obtained and can prove the relevant certification. Displaying cert logos
 *                  without the actual cert is deceptive and may violate NPC Advisory
 *                  Opinion 2018-031 on misleading privacy representations.
 *
 * Clay semantic tokens only — zero raw hex (ui-rules Rule 3).
 * Touch targets ≥44px on all interactive elements (PRODUCT.md §9 + WCAG 2.5.5).
 */

export interface ComplianceFooterProps {
  /**
   * Tenant or product display name shown in the copyright line.
   * Falls back to "Yelli" if not provided.
   */
  productName?: string;

  /**
   * Whether to render third-party certification badges (ISO 27001, SOC 2, etc.).
   * DEFAULT: false — Yelli holds no such certs. Only set true after obtaining real certs.
   * See HONEST-BADGE POLICY comment above.
   */
  showCertBadges?: boolean;
}

export function ComplianceFooter({
  productName = 'Yelli',
  showCertBadges = false,
}: ComplianceFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      role="contentinfo"
      aria-label="Compliance and legal information"
      className="border-t border-border bg-card"
    >
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        {/* Design-claims row — always shown; truthful statements about our practices */}
        <div className="flex flex-wrap items-center gap-3">
          {/* WCAG design-claim badge */}
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground"
            title="We target WCAG 2.2 Level AA accessibility in our design and development process"
          >
            <span aria-hidden="true">♿</span>
            WCAG 2.2 AA-targeted
          </span>

          {/* PH DPA design-claim badge */}
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground"
            title="Designed in alignment with the Philippine Data Privacy Act (RA 10173)"
          >
            <span aria-hidden="true">🔒</span>
            PH Data Privacy Act aligned
          </span>
        </div>

        {/*
         * CERT BADGES BLOCK — disabled by default (showCertBadges=false).
         * Only render when the prop is true AND Powerbyte has obtained the cert.
         * See HONEST-BADGE POLICY above.
         */}
        {showCertBadges && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {/* Placeholder: add real cert badge images here once certs are obtained.
                Example structure (do NOT publish without the actual certification):
                <img src="/certs/iso27001.svg" alt="ISO 27001 certified" width={80} height={32} />
            */}
            <p className="text-xs text-muted-foreground">
              [Certification badges — populate after obtaining certs]
            </p>
          </div>
        )}

        {/* Links row */}
        <nav
          aria-label="Compliance links"
          className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2"
        >
          <Link
            href="/privacy"
            className="min-h-11 inline-flex items-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-sm"
          >
            Privacy Policy
          </Link>
          <a
            href="mailto:bonitobonita24@gmail.com"
            className="min-h-11 inline-flex items-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-sm"
          >
            DPO Contact
          </a>
          <Link
            href="/settings"
            className="min-h-11 inline-flex items-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-sm"
          >
            Data &amp; Privacy Settings
          </Link>
        </nav>

        {/* Copyright */}
        <p className="mt-4 text-xs text-muted-foreground">
          &copy; {year} Powerbyte IT Solutions. {productName} is a product of Powerbyte IT
          Solutions, Lipa City, Batangas, Philippines.
        </p>
      </div>
    </footer>
  );
}
