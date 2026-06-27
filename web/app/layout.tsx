import type { Metadata } from "next";
import { Outfit, Instrument_Serif, Geist_Mono, Rethink_Sans, Inter_Tight, Geist, Noto_Serif, JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "./components/AppShell";

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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://heyriz.co";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "HeyRiz - Proactive AI Operator for Founders",
    template: "%s | HeyRiz",
  },
  description:
    "HeyRiz is a proactive AI operator that lives in Telegram, monitors your inbox, calendar, and business tools, and triggers actions with your consent. Built for founders who need less noise and more clarity.",
  keywords: [
    "AI assistant for founders",
    "proactive AI operator",
    "Telegram AI bot",
    "email triage automation",
    "startup productivity tool",
    "AI inbox management",
    "founder automation",
    "calendar AI",
  ],
  authors: [{ name: "Jagdeep Singh", url: SITE_URL }],
  creator: "HeyRiz",
  publisher: "HeyRiz",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "HeyRiz",
    title: "HeyRiz - Proactive AI Operator for Founders",
    description:
      "HeyRiz monitors your inbox, calendar, and tools inside Telegram. It only speaks up when it matters.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "HeyRiz - Proactive AI Operator for Founders",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "HeyRiz - Proactive AI Operator for Founders",
    description:
      "HeyRiz monitors your inbox, calendar, and tools inside Telegram. It only speaks up when it matters.",
    images: ["/opengraph-image"],
    creator: "@heyriz",
  },
  alternates: {
    canonical: SITE_URL,
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${instrumentSerif.variable} ${geistMono.variable} ${rethinkSans.variable} ${interTight.variable} ${geistSans.variable} ${notoSerif.variable} ${jetBrainsMono.variable} ${neueHaas.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-white text-text-primary">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
