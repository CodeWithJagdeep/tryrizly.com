import type { Metadata } from "next";
import { PricingClient } from "./PricingClient";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://heyriz.co";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, predictable pricing for HeyRiz. Start free, upgrade when you need more AI usage, calendar coverage, or integrations. No surprise overage charges.",
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: {
    title: "Pricing | HeyRiz",
    description:
      "Simple, predictable pricing for HeyRiz. Start free, upgrade when you need more.",
    url: `${SITE_URL}/pricing`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing | HeyRiz",
    description:
      "Simple, predictable pricing for HeyRiz. Start free, upgrade when you need more.",
  },
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
      <PricingClient />
    </>
  );
}
