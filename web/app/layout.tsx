import type { Metadata } from "next";
import { Outfit, Instrument_Serif, Geist_Mono, Rethink_Sans, Inter_Tight, Geist, Noto_Serif, JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "./components/AppShell";
import { Analytics } from "./components/Analytics";
import { requireSession } from "./api/onboarding/_lib/require-user";

export const dynamic = 'force-dynamic';

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  display: "swap",
  weight: ["400"],
  style: ["normal", "italic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const rethinkSans = Rethink_Sans({
  variable: "--font-rethink-sans",
  subsets: ["latin"],
  display: "swap",
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  display: "swap",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const notoSerif = Noto_Serif({
  variable: "--font-noto-serif",
  subsets: ["latin"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jet-brains",
  subsets: ["latin"],
  display: "swap",
});

const neueHaas = Inter({
  variable: "--font-neue-haas",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Rizly | Telegram AI Assistant for Email, Calendar & Revenue",
    template: "%s | Rizly",
  },
  description:
    "Rizly is a Telegram-first AI operator. It triages Gmail, briefs your calendar, watches Stripe and your databases, then asks for approval before anything sends.",
  keywords: [
    "AI personal assistant",
    "AI daily assistant",
    "Telegram AI bot",
    "email triage automation",
    "productivity tool",
    "AI inbox management",
    "AI reminders",
    "calendar AI",
  ],
  authors: [{ name: "Jagdeep Singh", url: SITE_URL }],
  creator: "Rizly",
  publisher: "Rizly",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Rizly",
    title: "Rizly | Telegram AI Assistant for Email, Calendar & Revenue",
    description:
      "A Telegram-first AI operator that triages Gmail, briefs your calendar, and asks before anything sensitive runs.",
    // og:image comes from the app/opengraph-image.tsx file convention.
  },
  twitter: {
    card: "summary_large_image",
    title: "Rizly | Telegram AI Assistant for Email, Calendar & Revenue",
    description:
      "A Telegram-first AI operator that triages Gmail, briefs your calendar, and asks before anything sensitive runs.",
    creator: "@rizly",
  },
  // No root-level alternates.canonical: it cascades to child pages that don't
  // set their own, wrongly declaring the homepage as their canonical URL.
  // The homepage canonical lives in app/page.tsx.
  // Icons come from the app/ file conventions: favicon.ico, icon.png, apple-icon.png.
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolved once here (not per-page) so every marketing page — home,
  // pricing, faq, etc. — can render the signed-in header state without each
  // one re-checking the session cookie itself. Null (not logged in) is the
  // common case for public pages and is cheap to compute either way.
  const session = await requireSession().catch(() => null);

  return (
    <html
      lang="en"
      className={`${outfit.variable} ${instrumentSerif.variable} ${geistMono.variable} ${rethinkSans.variable} ${interTight.variable} ${geistSans.variable} ${notoSerif.variable} ${jetBrainsMono.variable} ${neueHaas.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-white text-text-primary">
        <AppShell session={session}>{children}</AppShell>
        <Analytics />
      </body>
    </html>
  );
}
