import { BrandLogo } from "./BrandLogo";
import { PixelArrow } from "./PixelArrow";

interface FooterColumn {
  title: string;
  links: Array<{ label: string; href: string }>;
}

const columns: FooterColumn[] = [
  {
    title: "Product",
    links: [
      { label: "Pricing", href: "/pricing" },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Log in", href: "/login" },
      { label: "Start free trial", href: "/signup" },
    ],
  },
];

function FooterLink({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      className="group/link relative inline-flex w-fit items-center gap-1 text-button-small font-brand text-text-primary"
    >
      {label}
      <span className="relative inline-block w-3.5 shrink-0 opacity-0 -translate-x-2 group-hover/link:translate-x-0 group-hover/link:opacity-100 transition-all duration-300">
        <PixelArrow className="w-full" />
      </span>
      <span className="absolute left-0 bottom-0 w-0 transition-[width] duration-300 group-hover/link:w-full h-px bg-text-primary" />
    </a>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border-primary bg-surface-brand-primary">
      {/* Main footer content */}
      <div className="section-container py-12 md:py-16">
        {/* Logo */}
        <div className="mb-10">
          <a href="/" className="inline-block">
            <BrandLogo className="w-32" />
          </a>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 gap-8 md:gap-12">
          {columns.map((column) => (
            <div key={column.title} className="flex flex-col gap-4">
              <span className="text-eyebrow-small">{column.title}</span>
              <div className="flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <FooterLink
                    key={link.label}
                    label={link.label}
                    href={link.href}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div className="mt-12 pt-6 border-t border-border-primary">
          <p className="text-body-small text-text-tertiary">
            © {new Date().getFullYear()} HeyRiz. All rights reserved.
          </p>
        </div>
      </div>

      <div className="h-px w-full bg-border-primary" />
    </footer>
  );
}
