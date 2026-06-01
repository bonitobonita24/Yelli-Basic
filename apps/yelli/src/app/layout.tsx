// V31.3 dual-path — phantom-ui Web Component side-effect (PATH B skeletons).
// Must be imported at the root to register the custom element before any
// client component that uses <phantom-ui> hydrates.
import "@aejkatappaja/phantom-ui";
import "@/styles/tokens.css";
import "@/styles/globals.css";

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { TRPCProvider } from "@/components/providers/TRPCProvider";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Yelli", template: "%s — Yelli" },
  description:
    "Video calling for your network — your LAN or our cloud, your call.",
  applicationName: "Yelli",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/icon-192.png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Yelli",
  },
  formatDetection: {
    telephone: false,
  },
  robots: {
    // Phase 7: flip index/follow true for public marketing routes only.
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn(inter.variable)} suppressHydrationWarning>
      <body
        className={cn(
          "min-h-dvh bg-background text-foreground antialiased",
          "font-sans",
        )}
      >
        <TRPCProvider>{children}</TRPCProvider>
        {/*
         * Toaster: top-center matches LOCKED Web Push UX (Step 8) —
         * tap-to-open notification pattern expects dismissal feedback at top.
         * richColors maps to shadcn CSS variable semantic colours via sonner.
         */}
        <Toaster
          position="top-center"
          richColors
          closeButton
          duration={4000}
        />
      </body>
    </html>
  );
}
