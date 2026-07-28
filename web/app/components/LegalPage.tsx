import type { ReactNode } from "react";

export type LegalSection = {
  id: string;
  title: string;
  body: ReactNode;
};

/**
 * Shared layout for legal documents (terms, privacy). Light theme, numbered
 * sections, sticky in-page table of contents on desktop.
 */
export function LegalPage({
  eyebrow = "Legal",
  title,
  updated,
  intro,
  sections,
}: {
  eyebrow?: string;
  title: string;
  updated: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <div className="flex flex-1 flex-col bg-white text-slate-900">
      <section className="border-b border-slate-200 py-20 md:py-28">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-[#D9BEF4]">{eyebrow}</p>
          <h1 className="mt-4 font-neue-haas text-4xl font-normal tracking-tight text-slate-950 md:text-5xl">
            {title}
          </h1>
          <p className="mt-4 text-sm text-slate-400">Last updated: {updated}</p>
          <div className="mt-6 max-w-3xl text-base leading-relaxed text-slate-500">{intro}</div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[240px_minmax(0,1fr)]">
            <nav aria-label="Table of contents" className="hidden lg:block">
              <div className="sticky top-24">
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  On this page
                </p>
                <ol className="mt-4 space-y-2.5 border-l border-slate-200">
                  {sections.map((section, index) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        className="-ml-px block border-l border-transparent pl-4 text-[13px] leading-5 text-slate-500 transition hover:border-[#D9BEF4] hover:text-slate-900"
                      >
                        <span className="mr-1.5 tabular-nums text-slate-300">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {section.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            </nav>

            <div className="max-w-3xl">
              {sections.map((section, index) => (
                <article
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-24 border-t border-slate-200 py-10 first:border-t-0 first:pt-0"
                >
                  <h2 className="font-neue-haas text-xl font-normal tracking-tight text-slate-950 md:text-2xl">
                    <span className="mr-3 tabular-nums text-[#D9BEF4]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {section.title}
                  </h2>
                  <div className="legal-body mt-5 space-y-4 text-[15px] leading-7 text-slate-600 [&_a]:font-medium [&_a]:text-slate-900 [&_a]:underline [&_a]:decoration-slate-300 [&_a]:underline-offset-2 [&_a:hover]:text-[#D9BEF4] [&_a:hover]:decoration-[#D9BEF4] [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-slate-900 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
                    {section.body}
                  </div>
                </article>
              ))}

              <div className="mt-4 border border-slate-200 bg-slate-50 p-6">
                <p className="text-sm leading-6 text-slate-600">
                  Questions about this document? Reach us at{" "}
                  <a
                    href="mailto:hello@getrizly.com"
                    className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 hover:text-[#D9BEF4] hover:decoration-[#D9BEF4]"
                  >
                    hello@getrizly.com
                  </a>{" "}
                  — we answer every message.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
