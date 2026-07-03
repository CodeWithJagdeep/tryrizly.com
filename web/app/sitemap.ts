import type { MetadataRoute } from "next";
import { posts } from "./blog/data";
import { roles } from "./careers/roles";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

function page(
  path: string,
  priority: number,
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "monthly",
): MetadataRoute.Sitemap[number] {
  return {
    url: `${BASE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    page("", 1.0, "weekly"),
    page("/features", 0.9, "weekly"),
    page("/pricing", 0.9, "monthly"),
    page("/agent", 0.9, "weekly"),
    page("/product/ai-operator", 0.85, "weekly"),
    page("/product/email-triage", 0.85, "weekly"),
    page("/product/approvals", 0.85, "weekly"),
    page("/solutions/founders", 0.8, "weekly"),
    page("/solutions/revenue-teams", 0.8, "weekly"),
    page("/solutions/busy-operators", 0.8, "weekly"),
    page("/integrations", 0.8, "weekly"),
    page("/about", 0.7, "monthly"),
    page("/blog", 0.8, "weekly"),
    page("/careers", 0.7, "weekly"),
    page("/changelog", 0.6, "weekly"),
    page("/trust", 0.7, "monthly"),
    page("/security-guide", 0.6, "monthly"),
    page("/security-policy", 0.5, "monthly"),
    page("/faq", 0.6, "monthly"),
    page("/contact", 0.6, "monthly"),
    page("/community", 0.5, "monthly"),
    page("/brand-kit", 0.4, "monthly"),
    page("/privacy", 0.3, "yearly"),
    page("/terms", 0.3, "yearly"),
  ];

  const blogPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const careerPages: MetadataRoute.Sitemap = roles.map((role) => ({
    url: `${BASE_URL}/careers/${role.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticPages, ...blogPages, ...careerPages];
}
