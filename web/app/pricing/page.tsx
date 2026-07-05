import type { Metadata } from "next";
import { PricingClient } from "./PricingClient";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Transparent AI automation pricing for professionals. Start your 10-day free trial. Simple plans with no hidden fees.",
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: {
    title: "Pricing",
    description:
      "Transparent AI automation pricing. Start free, upgrade when you're ready.",
    url: `${SITE_URL}/pricing`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing",
    description:
      "Transparent AI automation pricing for professionals and teams.",
  },
};

// Mirrors apps/billing/src/plans.ts — keep prices in sync.
const productSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Rizly",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, Telegram",
  url: SITE_URL,
  offers: [
    { "@type": "Offer", name: "Starter", price: "20", priceCurrency: "USD" },
    { "@type": "Offer", name: "Pro", price: "49", priceCurrency: "USD" },
    { "@type": "Offer", name: "Business", price: "100", priceCurrency: "USD" },
  ],
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Pricing", item: `${SITE_URL}/pricing` },
  ],
};

export default function PricingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <PricingClient />
    </>
  );
}
