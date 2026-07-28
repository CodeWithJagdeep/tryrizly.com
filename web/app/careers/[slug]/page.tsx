import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRole, roles } from "../roles";
import { ApplicationForm } from "./ApplicationForm";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export function generateStaticParams() {
  return roles.map((role) => ({ slug: role.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const role = getRole(slug);
  if (!role) return {};

  return {
    title: `${role.title} | Careers at Rizly`,
    description: role.tagline,
    alternates: { canonical: `${SITE_URL}/careers/${role.slug}` },
    openGraph: {
      title: `${role.title} | Careers at Rizly`,
      description: role.tagline,
      url: `${SITE_URL}/careers/${role.slug}`,
      type: "website",
    },
  };
}

const BackIcon = () => (
  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
    <path d="M7.82843 10.9999H20V12.9999H7.82843L13.1924 18.3638L11.7782 19.778L4 11.9999L11.7782 4.22168L13.1924 5.63589L7.82843 10.9999Z"></path>
  </svg>
);

const CategoryIcon = () => (
  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 5V2C7 1.44772 7.44772 1 8 1H16C16.5523 1 17 1.44772 17 2V5H21C21.5523 5 22 5.44772 22 6V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V6C2 5.44772 2.44772 5 3 5H7ZM4 16V19H20V16H4ZM4 14H20V7H4V14ZM9 3V5H15V3H9ZM11 11H13V13H11V11Z"></path>
  </svg>
);

const RemoteIcon = () => (
  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 20.8995L16.9497 15.9497C19.6834 13.2161 19.6834 8.78392 16.9497 6.05025C14.2161 3.31658 9.78392 3.31658 7.05025 6.05025C4.31658 8.78392 4.31658 13.2161 7.05025 15.9497L12 20.8995ZM12 23.7279L5.63604 17.364C2.12132 13.8492 2.12132 8.15076 5.63604 4.63604C9.15076 1.12132 14.8492 1.12132 18.364 4.63604C21.8787 8.15076 21.8787 13.8492 18.364 17.364L12 23.7279ZM12 13C13.1046 13 14 12.1046 14 11C14 9.89543 13.1046 9 12 9C10.8954 9 10 9.89543 10 11C10 12.1046 10.8954 13 12 13ZM12 15C9.79086 15 8 13.2091 8 11C8 8.79086 9.79086 7 12 7C14.2091 7 16 8.79086 16 11C16 13.2091 14.2091 15 12 15Z"></path>
  </svg>
);

const ClockIcon = () => (
  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM13 12H17V14H11V7H13V12Z"></path>
  </svg>
);

export default async function CareerRolePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const role = getRole(slug);
  if (!role) notFound();

  const otherRoles = roles.filter((r) => r.slug !== role.slug);

  return (
    <main className="max-w-[88rem] mx-auto px-10 pt-32 pb-40">
      <Link
        className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-widest text-gray-400 hover:text-[#D9BEF4] mb-12 transition-colors"
        href="/careers"
      >
        <BackIcon />
        Back to careers
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_520px] gap-20">
        <div>
          <div className="mb-12">
            <div className="flex gap-4 text-[12px] font-semibold uppercase tracking-[0.2em] text-[#D9BEF4] mb-4">
              <span className="flex items-center gap-1">
                <CategoryIcon />
                {role.category}
              </span>
              <span className="flex items-center gap-1">
                <RemoteIcon />
                Remote
              </span>
              <span className="flex items-center gap-1">
                <ClockIcon />
                {role.employmentType}
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-semibold uppercase tracking-normal leading-tight mb-8">{role.title}</h1>
            <p className="text-xl font-semibold text-[#D9BEF4] leading-tight mb-12">{role.tagline}</p>
          </div>

          <div className="space-y-16">
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-6">Overview</h3>
              <p className="text-lg text-gray-500 leading-relaxed">{role.overview}</p>
            </section>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-6">What you'll do</h3>
              <ul className="space-y-6">
                {role.responsibilities.map((item) => (
                  <li key={item} className="flex gap-4 items-start">
                    <div className="w-2 h-2 mt-2 bg-[#D9BEF4] shrink-0"></div>
                    <span className="text-base font-medium leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-6">Requirements</h3>
              <ul className="space-y-6">
                {role.requirements.map((item) => (
                  <li key={item} className="flex gap-4 items-start">
                    <div className="w-2 h-2 mt-2 bg-black shrink-0"></div>
                    <span className="text-base text-gray-500 leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-6">Nice to have</h3>
              <ul className="space-y-6">
                {role.niceToHaves.map((item) => (
                  <li key={item} className="flex gap-4 items-start">
                    <div className="w-2 h-2 mt-2 border-2 border-black shrink-0"></div>
                    <span className="text-base text-gray-500 leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-6">Your first 90 days</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {role.ninetyDayPlan.map((milestone) => (
                  <div key={milestone.period} className="border-2 border-black p-6 bg-[#fcfcfc] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-[#D9BEF4] mb-3 block">{milestone.period}</span>
                    <p className="text-sm text-gray-600 leading-relaxed">{milestone.goal}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-6">What you'll get</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-2 border-black divide-y-2 md:divide-y-0 md:divide-x-2 divide-black">
                <div className="p-8">
                  <h4 className="text-base font-semibold uppercase mb-3">Remote setup</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">$4,000 home-office stipend, plus $1,000 annually for refreshes.</p>
                </div>
                <div className="p-8 bg-[#D9BEF4]/5">
                  <h4 className="text-base font-semibold uppercase mb-3">Health & flow</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">Premium health, dental, and vision globally. Unlimited PTO, 3-week minimum.</p>
                </div>
                <div className="p-8">
                  <h4 className="text-base font-semibold uppercase mb-3">Growth budget</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">$5,000 a year for books, conferences, or courses.</p>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-6">Our hiring process</h3>
              <div className="space-y-4">
                {[
                  { number: "01", title: "Deep dive", description: "A 45-minute conversation with a founder about your journey and why you build." },
                  { number: "02", title: "Take-home task", description: "A real-world problem designed to take 4-6 hours. No trick questions." },
                  { number: "03", title: "Pairing session", description: "Review your task with the team. We care how you think, not just the syntax." },
                  { number: "04", title: "The offer", description: "We move fast — expect a decision within 48 hours of your final round." },
                ].map((step) => (
                  <div key={step.number} className="flex gap-6 items-start border-b border-black/10 pb-4">
                    <span className="text-lg font-semibold text-[#D9BEF4] shrink-0 w-8">{step.number}</span>
                    <div>
                      <h4 className="text-base font-semibold uppercase mb-1">{step.title}</h4>
                      <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="border-4 border-black p-10 bg-black text-white shadow-[12px_12px_0px_0px_rgba(217,190,244,1)]">
              <p className="text-xl font-medium leading-relaxed mb-4">
                "We hire builders, not order-takers. You own your features from architectural design to production monitoring."
              </p>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">— The Rizly team</span>
            </section>
          </div>
        </div>

        <div className="lg:sticky lg:top-32 h-fit">
          <ApplicationForm roleTitle={role.title} />
          <p className="mt-8 text-[11px] text-center font-medium text-gray-400 uppercase tracking-widest">
            By applying, you agree to our <span className="underline cursor-pointer">Candidate Privacy Policy</span>.
          </p>
        </div>
      </div>

      {otherRoles.length > 0 && (
        <div className="mt-32 pt-20 border-t-2 border-black/10">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-8">Other open roles</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {otherRoles.map((other) => (
              <Link
                key={other.slug}
                href={`/careers/${other.slug}`}
                className="border-2 border-black p-8 bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[10px_10px_0px_0px_rgba(217,190,244,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
              >
                <span className="text-[11px] font-semibold uppercase tracking-widest text-[#D9BEF4] mb-3 block">{other.category}</span>
                <h4 className="text-lg font-semibold uppercase mb-2">{other.title}</h4>
                <p className="text-sm text-gray-500 leading-relaxed">{other.tagline}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
