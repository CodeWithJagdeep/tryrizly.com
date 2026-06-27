import type { Metadata } from "next";
import { BlogClient } from "./BlogClient";
import { posts } from "./data";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://heyriz.co";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Notes, guides, and technical updates from the HeyRiz team on building a proactive AI operator for founders.",
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    title: "Blog | HeyRiz",
    description:
      "Notes, guides, and technical updates on building a proactive AI operator for founders.",
    url: `${SITE_URL}/blog`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog | HeyRiz",
    description:
      "Notes, guides, and technical updates on building a proactive AI operator for founders.",
  },
};

const blogListSchema = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: "HeyRiz Blog",
  url: `${SITE_URL}/blog`,
  description: "Notes, guides, and technical updates from the HeyRiz team.",
  blogPost: posts.map((post) => ({
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    url: `${SITE_URL}/blog/${post.slug}`,
    author: { "@type": "Person", name: post.authorName },
  })),
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
  ],
};

export default function BlogPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogListSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <BlogClient posts={posts} />
    </>
  );
}
