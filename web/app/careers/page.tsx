import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "Careers",
  description: "Join Rizly and help build the AI operator for founders and operators.",
  alternates: { canonical: `${SITE_URL}/careers` },
  openGraph: {
    title: "Careers",
    description: "Join Rizly and help build the AI operator for founders.",
    url: `${SITE_URL}/careers`,
    type: "website",
  },
};

const whyJoin = [
  {
    title: "Async first",
    description: "We don't do status meetings. We communicate through documentation, code reviews, and Rizly's own thread history.",
    tag: "100% remote & async",
    icon: "M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM9.71002 19.6674C8.74743 17.6259 8.15732 15.3742 8.02731 13H4.06189C4.458 16.1765 6.71639 18.7747 9.71002 19.6674ZM10.0307 13C10.1811 15.4388 10.8778 17.7297 12 19.752C13.1222 17.7297 13.8189 15.4388 13.9693 13H10.0307ZM19.9381 13H15.9727C15.8427 15.3742 15.2526 17.6259 14.29 19.6674C17.2836 18.7747 19.542 16.1765 19.9381 13ZM4.06189 11H8.02731C8.15732 8.62577 8.74743 6.37407 9.71002 4.33256C6.71639 5.22533 4.458 7.8235 4.06189 11ZM10.0307 11H13.9693C13.8189 8.56122 13.1222 6.27025 12 4.24799C10.8778 6.27025 10.1811 8.56122 10.0307 11ZM14.29 4.33256C15.2526 6.37407 15.8427 8.62577 15.9727 11H19.9381C19.542 7.8235 17.2836 5.22533 14.29 4.33256Z",
  },
  {
    title: "High velocity",
    description: "We ship improvements to Rizly every single day. Your work starts helping founders within hours of merging.",
    tag: "Daily deployments",
    icon: "M13 9H21L11 24V15H4L13 0V9ZM11 11V7.22063L7.53238 13H13V17.3944L17.263 11H11Z",
  },
  {
    title: "Pure engineering",
    description: "Zero management fluff. Every person on the team is a builder, from the founders to the latest hire.",
    tag: "Flat organization",
    icon: "M3.78307 2.82598L12 1L20.2169 2.82598C20.6745 2.92766 21 3.33347 21 3.80217V13.7889C21 15.795 19.9974 17.6684 18.3282 18.7812L12 23L5.6718 18.7812C4.00261 17.6684 3 15.795 3 13.7889V3.80217C3 3.33347 3.32553 2.92766 3.78307 2.82598ZM5 4.60434V13.7889C5 15.1263 5.6684 16.3752 6.7812 17.1171L12 20.5963L17.2188 17.1171C18.3316 16.3752 19 15.1263 19 13.7889V4.60434L12 3.04879L5 4.60434ZM13 10H16L11 17V12H8L13 5V10Z",
  },
  {
    title: "Deep focus",
    description: "We protect your flow. Rizly handles the noise and manual chores so you can handle the architecture.",
    tag: "Flow-state optimized",
    icon: "M12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16ZM12 18C8.68629 18 6 15.3137 6 12C6 8.68629 8.68629 6 12 6C15.3137 6 18 8.68629 18 12C18 15.3137 15.3137 18 12 18ZM12 14C10.8954 14 10 13.1046 10 12C10 10.8954 10.8954 10 12 10C13.1046 10 14 10.8954 14 12C14 13.1046 13.1046 14 12 14Z",
  },
];

const infrastructure = [
  {
    title: "Reasoning kernels",
    description: "Low-latency reasoning pipelines that triage inbox, calendar, and revenue signals in real time.",
    icon: "M20.0833 15.1999L21.2854 15.9212C21.5221 16.0633 21.5989 16.3704 21.4569 16.6072C21.4146 16.6776 21.3557 16.7365 21.2854 16.7787L12.5144 22.0412C12.1977 22.2313 11.8021 22.2313 11.4854 22.0412L2.71451 16.7787C2.47772 16.6366 2.40093 16.3295 2.54301 16.0927C2.58523 16.0223 2.64413 15.9634 2.71451 15.9212L3.9166 15.1999L11.9999 20.0499L20.0833 15.1999ZM20.0833 10.4999L21.2854 11.2212C21.5221 11.3633 21.5989 11.6704 21.4569 11.9072C21.4146 11.9776 21.3557 12.0365 21.2854 12.0787L11.9999 17.6499L2.71451 12.0787C2.47772 11.9366 2.40093 11.6295 2.54301 11.3927C2.58523 11.3223 2.64413 11.2634 2.71451 11.2212L3.9166 10.4999L11.9999 15.3499L20.0833 10.4999ZM12.5144 1.30864L21.2854 6.5712C21.5221 6.71327 21.5989 7.0204 21.4569 7.25719C21.4146 7.32757 21.3557 7.38647 21.2854 7.42869L11.9999 12.9999L2.71451 7.42869C2.47772 7.28662 2.40093 6.97949 2.54301 6.7427C2.58523 6.67232 2.64413 6.61343 2.71451 6.5712L11.4854 1.30864C11.8021 1.11864 12.1977 1.11864 12.5144 1.30864ZM11.9999 3.33233L5.88723 6.99995L11.9999 10.6676L18.1126 6.99995L11.9999 3.33233Z",
  },
  {
    title: "Approval engine",
    description: "Every suggested action passes through a verification layer before it ever reaches your approval queue.",
    icon: "M5.32943 3.27158C6.56252 2.8332 7.9923 3.10749 8.97927 4.09446C10.1002 5.21537 10.3019 6.90741 9.5843 8.23385L20.293 18.9437L18.8788 20.3579L8.16982 9.64875C6.84325 10.3669 5.15069 10.1654 4.02952 9.04421C3.04227 8.05696 2.7681 6.62665 3.20701 5.39332L5.44373 7.63C6.02952 8.21578 6.97927 8.21578 7.56505 7.63C8.15084 7.04421 8.15084 6.09446 7.56505 5.50868L5.32943 3.27158ZM15.6968 5.15512L18.8788 3.38736L20.293 4.80157L18.5252 7.98355L16.7574 8.3371L14.6361 10.4584L13.2219 9.04421L15.3432 6.92289L15.6968 5.15512ZM8.97927 13.2868L10.3935 14.7011L5.09018 20.0044C4.69966 20.3949 4.06649 20.3949 3.67597 20.0044C3.31334 19.6417 3.28744 19.0699 3.59826 18.6774L3.67597 18.5902L8.97927 13.2868Z",
  },
  {
    title: "Realtime sync",
    description: "Gmail, Calendar, Stripe, and Telegram signals stay in sync within seconds, not minutes.",
    icon: "M9 7.53861L15 21.5386L18.6594 13H23V11H17.3406L15 16.4614L9 2.46143L5.3406 11H1V13H6.6594L9 7.53861Z",
  },
];

const manifesto = [
  {
    title: "Deep focus > meetings",
    description: "We protect founder and builder flow alike. If it can be a PR comment or a doc update, it shouldn't be a meeting.",
    icon: "M12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16ZM12 18C8.68629 18 6 15.3137 6 12C6 8.68629 8.68629 6 12 6C15.3137 6 18 8.68629 18 12C18 15.3137 15.3137 18 12 18ZM12 14C10.8954 14 10 13.1046 10 12C10 10.8954 10.8954 10 12 10C13.1046 10 14 10.8954 14 12C14 13.1046 13.1046 14 12 14Z",
  },
  {
    title: "Ownership > permission",
    description: "We hire builders, not order-takers. You own your features from architectural design to production monitoring.",
    icon: "M3.78307 2.82598L12 1L20.2169 2.82598C20.6745 2.92766 21 3.33347 21 3.80217V13.7889C21 15.795 19.9974 17.6684 18.3282 18.7812L12 23L5.6718 18.7812C4.00261 17.6684 3 15.795 3 13.7889V3.80217C3 3.33347 3.32553 2.92766 3.78307 2.82598ZM5 4.60434V13.7889C5 15.1263 5.6684 16.3752 6.7812 17.1171L12 20.5963L17.2188 17.1171C18.3316 16.3752 19 15.1263 19 13.7889V4.60434L12 3.04879L5 4.60434ZM13 10H16L11 17V12H8L13 5V10Z",
  },
  {
    title: "Shipping > perfection",
    description: "We find perfection in iteration. We ship fast, gather feedback from real founders, and improve constantly.",
    icon: "M13 9H21L11 24V15H4L13 0V9ZM11 11V7.22063L7.53238 13H13V17.3944L17.263 11H11Z",
  },
  {
    title: "Truth > ego",
    description: "We are radicals about transparency. We debate ideas, not hierarchies. The best solution always wins.",
    icon: "M5.99805 3C9.48787 3 12.3812 5.55379 12.9112 8.8945C14.0863 7.72389 15.7076 7 17.498 7H21.998V9.5C21.998 13.0899 19.0879 16 15.498 16H12.998V21H10.998V13H8.99805C5.13205 13 1.99805 9.86599 1.99805 6V3H5.99805ZM19.998 9H17.498C15.0128 9 12.998 11.0147 12.998 13.5V14H15.498C17.9833 14 19.998 11.9853 19.998 9.5V9ZM5.99805 5H3.99805V6C3.99805 8.76142 6.23662 11 8.99805 11H10.998V10C10.998 7.23858 8.75947 5 5.99805 5Z",
  },
];

const hiringSteps = [
  { number: "01", title: "Deep dive", description: "A 45-minute conversation with a founder about your journey, your obsessions, and why you build." },
  { number: "02", title: "Take-home task", description: "A real-world engineering problem designed to take 4-6 hours. No LeetCode, just architecture and code." },
  { number: "03", title: "Pairing session", description: "Review your task with the team. We care more about how you think than the final syntax." },
  { number: "04", title: "The offer", description: "We move fast. Expect a decision and a competitive offer within 48 hours of your final round." },
];

const roles = [
  {
    title: "Senior AI Engineer",
    tagline: "Build the reasoning core behind Rizly's approvals.",
    href: "/careers/senior-ai-engineer",
    category: "Core intelligence",
  },
  {
    title: "Product Designer",
    tagline: "Define the visual language of approval-first automation.",
    href: "/careers/product-designer",
    category: "UX & brand",
  },
  {
    title: "Backend Systems Architect",
    tagline: "Scale the engine to millions of inboxes and calendars.",
    href: "/careers/backend-systems-architect",
    category: "Infrastructure",
  },
  {
    title: "Security Researcher",
    tagline: "Make Rizly the safest AI operator a founder can trust.",
    href: "/careers/security-researcher",
    category: "Security",
  },
];

const RemoteIcon = () => (
  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM9.71002 19.6674C8.74743 17.6259 8.15732 15.3742 8.02731 13H4.06189C4.458 16.1765 6.71639 18.7747 9.71002 19.6674ZM10.0307 13C10.1811 15.4388 10.8778 17.7297 12 19.752C13.1222 17.7297 13.8189 15.4388 13.9693 13H10.0307ZM19.9381 13H15.9727C15.8427 15.3742 15.2526 17.6259 14.29 19.6674C17.2836 18.7747 19.542 16.1765 19.9381 13ZM4.06189 11H8.02731C8.15732 8.62577 8.74743 6.37407 9.71002 4.33256C6.71639 5.22533 4.458 7.8235 4.06189 11ZM10.0307 11H13.9693C13.8189 8.56122 13.1222 6.27025 12 4.24799C10.8778 6.27025 10.1811 8.56122 10.0307 11ZM14.29 4.33256C15.2526 6.37407 15.8427 8.62577 15.9727 11H19.9381C19.542 7.8235 17.2836 5.22533 14.29 4.33256Z"></path>
  </svg>
);

const CategoryIcon = () => (
  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 11C14.7614 11 17 13.2386 17 16V22H15V16C15 14.4023 13.7511 13.0963 12.1763 13.0051L12 13C10.4023 13 9.09634 14.2489 9.00509 15.8237L9 16V22H7V16C7 13.2386 9.23858 11 12 11ZM5.5 14C5.77885 14 6.05009 14.0326 6.3101 14.0942C6.14202 14.594 6.03873 15.122 6.00896 15.6693L6 16L6.0007 16.0856C5.88757 16.0456 5.76821 16.0187 5.64446 16.0069L5.5 16C4.7203 16 4.07955 16.5949 4.00687 17.3555L4 17.5V22H2V17.5C2 15.567 3.567 14 5.5 14ZM18.5 14C20.433 14 22 15.567 22 17.5V22H20V17.5C20 16.7203 19.4051 16.0796 18.6445 16.0069L18.5 16C18.3248 16 18.1566 16.03 18.0003 16.0852L18 16C18 15.3343 17.8916 14.694 17.6915 14.0956C17.9499 14.0326 18.2211 14 18.5 14ZM5.5 8C6.88071 8 8 9.11929 8 10.5C8 11.8807 6.88071 13 5.5 13C4.11929 13 3 11.8807 3 10.5C3 9.11929 4.11929 8 5.5 8ZM18.5 8C19.8807 8 21 9.11929 21 10.5C21 11.8807 19.8807 13 18.5 13C17.1193 13 16 11.8807 16 10.5C16 9.11929 17.1193 8 18.5 8ZM5.5 10C5.22386 10 5 10.2239 5 10.5C5 10.7761 5.22386 11 5.5 11C5.77614 11 6 10.7761 6 10.5C6 10.2239 5.77614 10 5.5 10ZM18.5 10C18.2239 10 18 10.2239 18 10.5C18 10.7761 18.2239 11 18.5 11C18.7761 11 19 10.7761 19 10.5C19 10.2239 18.7761 10 18.5 10ZM12 2C14.2091 2 16 3.79086 16 6C16 8.20914 14.2091 10 12 10C9.79086 10 8 8.20914 8 6C8 3.79086 9.79086 2 12 2ZM12 4C10.8954 4 10 4.89543 10 6C10 7.10457 10.8954 8 12 8C13.1046 8 14 7.10457 14 6C14 4.89543 13.1046 4 12 4Z"></path>
  </svg>
);

const ArrowIcon = ({ size = 32 }: { size?: number }) => (
  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height={size} width={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z"></path>
  </svg>
);

export default function CareersPage() {
  return (
    <main>
      {/* Hero */}
      <section className="pt-40 pb-32 px-10 text-center relative border-b-2 border-black/10 bg-white overflow-hidden">
        <div className="absolute inset-0 pointer-events-none -z-10 opacity-[0.05]" style={{ backgroundImage: "radial-gradient(rgb(0, 0, 0) 1px, transparent 1px)", backgroundSize: "40px 40px" }}></div>
        <div className="max-w-6xl mx-auto">
          <span className="inline-block px-4 py-1.5 border-2 border-black bg-black text-white text-[11px] font-semibold uppercase tracking-[0.3em] mb-12">Recruitment v1.0 / Project Rizly</span>
          <h1 className="text-5xl md:text-6xl font-semibold uppercase tracking-normal leading-tight mb-12">
            Help us build <br />
            <span className="text-[#FE7F2D]">the future of work</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-4xl mx-auto mb-16 leading-relaxed">
            We're at the very beginning of a decade-long mission at Rizly. We're looking for obsessive builders who want to help Rizly evolve into the founder's most trusted AI operator.
          </p>
          <div className="flex justify-center gap-6">
            <a
              className="border-2 border-black bg-black text-white px-10 py-5 text-[14px] font-semibold uppercase tracking-widest shadow-[6px_6px_0px_0px_rgba(254,127,45,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
              href="#roles"
            >
              View open roles
            </a>
          </div>
        </div>
      </section>

      {/* Why join us */}
      <section className="px-10 md:px-14 py-40 border-b-2 border-black/10 bg-[#fcfcfc]">
        <div className="max-w-7xl mx-auto">
          <div className="mb-24">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-6 block">Section 01 / The hook</span>
            <h2 className="text-4xl md:text-6xl font-semibold uppercase tracking-normal leading-tight mb-6">Why join us?</h2>
            <p className="text-lg text-gray-400 leading-relaxed max-w-2xl">
              We're building more than a product at Rizly; we're building a new way of working — one that prioritizes approvals over meetings.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {whyJoin.map((item) => (
              <div key={item.title} className="p-10 border-2 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(254,127,45,1)] transition-all group">
                <div className="w-16 h-16 border-2 border-black flex items-center justify-center mb-8 group-hover:bg-[#FE7F2D] group-hover:text-white transition-all">
                  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="32" width="32" xmlns="http://www.w3.org/2000/svg">
                    <path d={item.icon}></path>
                  </svg>
                </div>
                <h3 className="text-xl font-semibold uppercase mb-4">{item.title}</h3>
                <p className="text-gray-500 leading-relaxed mb-8">{item.description}</p>
                <div className="pt-6 border-t border-black/5">
                  <span className="text-[11px] font-semibold uppercase text-[#FE7F2D] tracking-widest">{item.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="px-10 md:px-14 py-40 border-b-2 border-black/10 bg-white">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-32 items-center">
          <div className="order-2 lg:order-1">
            <div className="border-4 border-black p-12 bg-[#FE7F2D]/5 shadow-[16px_16px_0px_0px_rgba(0,0,0,1)]">
              <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="text-[#FE7F2D] mb-8" height="60" width="60" xmlns="http://www.w3.org/2000/svg">
                <path d="M24 12L18.3431 17.6569L16.9289 16.2426L21.1716 12L16.9289 7.75736L18.3431 6.34315L24 12ZM2.82843 12L7.07107 16.2426L5.65685 17.6569L0 12L5.65685 6.34315L7.07107 7.75736L2.82843 12ZM9.78845 21H7.66009L14.2116 3H16.3399L9.78845 21Z"></path>
              </svg>
              <h3 className="text-2xl font-semibold uppercase mb-6">Building the operator</h3>
              <p className="text-lg text-gray-500 leading-relaxed mb-8">
                Most AI tools today are just sophisticated autocompletes. We're building Rizly to be a teammate — one that understands your priorities, waits for your approval, and acts only when you say go.
              </p>
              <div className="flex gap-4">
                <div className="px-3 py-1 bg-black text-white text-[10px] font-semibold uppercase">Phase 01: Triage</div>
                <div className="px-3 py-1 border-2 border-black text-[10px] font-semibold uppercase">Phase 02: Autonomy</div>
              </div>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-6 block">Section 02 / The mission</span>
            <h2 className="text-4xl md:text-6xl font-semibold uppercase tracking-normal mb-12 leading-tight">
              We're just <br />
              <span className="text-[#FE7F2D]">getting started</span>
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-12">
              Join at the ground floor at Rizly. You won't just be maintaining systems; you'll be defining the rules of AI-human collaboration for the next decade.
            </p>
          </div>
        </div>
      </section>

      {/* Culture */}
      <section className="px-10 md:px-14 py-40 border-b-2 border-black/10 bg-[#fcfcfc]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-32 items-center">
            <div>
              <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-6 block">Section 03 / Culture</span>
              <h2 className="text-4xl md:text-5xl font-semibold uppercase tracking-normal leading-tight mb-12">
                Small team <br />
                <span className="text-[#FE7F2D]">big impact</span>
              </h2>
              <p className="text-lg text-gray-500 leading-relaxed mb-12">
                We are a lean, focused group of builders. We don't believe in massive hierarchies or bloated teams. We believe in a handful of obsessive engineers doing the work of thirty.
              </p>
              <div className="space-y-6">
                {[
                  { title: "Radical focus", body: "With a small team, there's nowhere to hide. Every line of code you write has a massive impact on Rizly's evolution." },
                  { title: "Deep work blocks", body: "We encourage 4-hour uninterrupted blocks. Rizly handles the routine so you can stay in flow." },
                  { title: "Direct collaboration", body: "No middle managers. You work directly with the founders to define the future of approval-first automation." },
                ].map((item) => (
                  <div key={item.title} className="flex gap-4">
                    <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="text-[#FE7F2D] shrink-0 mt-1" height="20" width="20" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 12C4 7.58172 7.58172 4 12 4C16.4183 4 20 7.58172 20 12C20 16.4183 16.4183 20 12 20C7.58172 20 4 16.4183 4 12ZM12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM17.4571 9.45711L16.0429 8.04289L11 13.0858L8.20711 10.2929L6.79289 11.7071L11 15.9142L17.4571 9.45711Z"></path>
                    </svg>
                    <div>
                      <h4 className="text-base font-semibold uppercase tracking-normal leading-none mb-2">{item.title}</h4>
                      <p className="text-sm text-gray-400 leading-relaxed">{item.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="border-4 border-black p-10 bg-white shadow-[16px_16px_0px_0px_rgba(254,127,45,1)]">
                <h3 className="text-2xl font-semibold uppercase mb-8">Current team</h3>
                <div className="space-y-4">
                  {["AI & automation", "Product & UX", "Infrastructure"].map((role) => (
                    <div key={role} className="flex justify-between items-center border-b border-black/5 pb-2">
                      <span className="text-[12px] font-semibold uppercase tracking-widest">{role}</span>
                      <span className="text-[10px] font-semibold text-[#FE7F2D] uppercase">1 builder</span>
                    </div>
                  ))}
                </div>
                <p className="mt-10 text-[11px] text-gray-400 font-semibold uppercase tracking-[0.2em] text-center italic">
                  "3 builders. 1 mission. Total focus."
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Infrastructure */}
      <section className="px-10 md:px-14 py-40 border-b-2 border-black/10 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="mb-24">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-6 block">Section 04 / Infrastructure</span>
            <h2 className="text-4xl md:text-6xl font-semibold uppercase tracking-normal leading-tight mb-6">
              Built for <br />
              <span className="text-[#FE7F2D]">reliability</span>
            </h2>
            <p className="text-lg text-gray-400 leading-relaxed max-w-2xl">
              We don't just use AI; we build the infrastructure that makes it reliable at scale.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {infrastructure.map((item) => (
              <div key={item.title} className="p-10 border-2 border-black bg-[#fcfcfc] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="text-[#FE7F2D] mb-6" height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                  <path d={item.icon}></path>
                </svg>
                <h4 className="text-xl font-semibold uppercase mb-4 tracking-normal leading-tight">{item.title}</h4>
                <p className="text-sm text-gray-500 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Manifesto */}
      <section className="px-10 md:px-14 py-40 border-b-2 border-black/10 bg-black text-white">
        <div className="max-w-7xl mx-auto">
          <div className="mb-24 text-center">
            <h2 className="text-4xl md:text-6xl font-semibold uppercase tracking-normal leading-tight mb-6">
              The engineering <br />
              <span className="text-[#FE7F2D]">manifesto</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-20">
            {manifesto.map((item) => (
              <div key={item.title} className="flex gap-10 items-start group">
                <div className="w-20 h-20 border-2 border-white/20 flex items-center justify-center shrink-0 group-hover:bg-[#FE7F2D] group-hover:border-[#FE7F2D] transition-all">
                  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="text-white" height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                    <path d={item.icon}></path>
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-semibold uppercase mb-4 tracking-normal leading-tight">{item.title}</h3>
                  <p className="text-lg text-white/40 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How we hire */}
      <section className="px-10 md:px-14 py-40 border-b-2 border-black/10 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="mb-24">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-6 block">Section 05 / Process</span>
            <h2 className="text-4xl md:text-6xl font-semibold uppercase tracking-normal leading-tight mb-6">How we hire</h2>
            <p className="text-lg text-gray-400 leading-relaxed">Our process is designed to be fast, fair, and focused on your craft.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {hiringSteps.map((step) => (
              <div key={step.number} className="relative p-10 border-2 border-black bg-white group hover:bg-black hover:text-white transition-all">
                <span className="absolute -top-6 left-6 px-4 py-2 bg-[#FE7F2D] text-white text-[12px] font-semibold uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  {step.number}
                </span>
                <h4 className="text-xl font-semibold uppercase mb-4 mt-4 tracking-normal leading-tight">{step.title}</h4>
                <p className="text-[14px] text-gray-500 leading-relaxed group-hover:text-white/60">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Support */}
      <section className="px-10 md:px-14 py-40 border-b-2 border-black/10 bg-[#fcfcfc]">
        <div className="max-w-7xl mx-auto">
          <div className="mb-24">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-6 block">Section 06 / Support</span>
            <h2 className="text-4xl md:text-6xl font-semibold uppercase tracking-normal leading-tight mb-6">
              Built to <br /> support you
            </h2>
            <p className="text-lg text-gray-400 leading-relaxed">Everything you need to do your best work from anywhere in the world.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-4 border-black divide-y-4 md:divide-y-0 md:divide-x-4 divide-black shadow-[20px_20px_0px_0px_rgba(0,0,0,1)] bg-white">
            <div className="p-12">
              <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="text-[#FE7F2D] mb-8" height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 13V5H6V13C6 14.1046 6.89543 15 8 15H14C15.1046 15 16 14.1046 16 13ZM5 3H20C21.1046 3 22 3.89543 22 5V8C22 9.10457 21.1046 10 20 10H18V13C18 15.2091 16.2091 17 14 17H8C5.79086 17 4 15.2091 4 13V4C4 3.44772 4.44772 3 5 3ZM18 5V8H20V5H18ZM2 19H20V21H2V19Z"></path>
              </svg>
              <h4 className="text-xl font-semibold uppercase mb-4 tracking-normal leading-tight">Remote setup</h4>
              <p className="text-sm text-gray-500 leading-relaxed">Work from anywhere. We provide a $4,000 initial home-office stipend and $1,000 annually for refreshes.</p>
            </div>
            <div className="p-12 bg-[#FE7F2D]/5">
              <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="text-[#FE7F2D] mb-8" height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 7.53861L15 21.5386L18.6594 13H23V11H17.3406L15 16.4614L9 2.46143L5.3406 11H1V13H6.6594L9 7.53861Z"></path>
              </svg>
              <h4 className="text-xl font-semibold uppercase mb-4 tracking-normal leading-tight">Health & flow</h4>
              <p className="text-sm text-gray-500 leading-relaxed">Premium health, dental, and vision insurance globally. Unlimited PTO with a 3-week mandatory minimum.</p>
            </div>
            <div className="p-12">
              <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="text-[#FE7F2D] mb-8" height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                <path d="M9.97308 18H11V13H13V18H14.0269C14.1589 16.7984 14.7721 15.8065 15.7676 14.7226C15.8797 14.6006 16.5988 13.8564 16.6841 13.7501C17.5318 12.6931 18 11.385 18 10C18 6.68629 15.3137 4 12 4C8.68629 4 6 6.68629 6 10C6 11.3843 6.46774 12.6917 7.31462 13.7484C7.40004 13.855 8.12081 14.6012 8.23154 14.7218C9.22766 15.8064 9.84103 16.7984 9.97308 18ZM10 20V21H14V20H10ZM5.75395 14.9992C4.65645 13.6297 4 11.8915 4 10C4 5.58172 7.58172 2 12 2C16.4183 2 20 5.58172 20 10C20 11.8925 19.3428 13.6315 18.2443 15.0014C17.624 15.7748 16 17 16 18.5V21C16 22.1046 15.1046 23 14 23H10C8.89543 23 8 22.1046 8 21V18.5C8 17 6.37458 15.7736 5.75395 14.9992Z"></path>
              </svg>
              <h4 className="text-xl font-semibold uppercase mb-4 tracking-normal leading-tight">Growth budget</h4>
              <p className="text-sm text-gray-500 leading-relaxed">$5,000 annual budget for books, conferences, or specialized courses to keep your edge sharp.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Open roles */}
      <section id="roles" className="px-10 md:px-14 py-40 border-b-2 border-black/10 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="mb-20 text-center">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">Section 07 / Opportunity</span>
            <h2 className="text-4xl md:text-6xl font-semibold uppercase tracking-normal leading-tight">
              Join the <br /> foundation
            </h2>
            <p className="text-lg text-gray-400 uppercase tracking-widest mt-6">We are hiring for our core engineering team.</p>
          </div>
          <div className="space-y-6">
            {roles.map((role) => (
              <a
                key={role.title}
                href={role.href}
                className="group border-2 border-black p-10 bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(254,127,45,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all flex flex-col md:flex-row justify-between items-center gap-6 cursor-pointer"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-2xl font-semibold uppercase tracking-normal leading-tight">{role.title}</h4>
                  </div>
                  <p className="text-[13px] text-gray-400 leading-relaxed mb-4">{role.tagline}</p>
                  <div className="flex gap-6 text-[12px] font-semibold uppercase tracking-widest text-gray-400">
                    <span className="flex items-center gap-2">
                      <RemoteIcon />
                      Remote
                    </span>
                    <span className="flex items-center gap-2 text-[#FE7F2D]">
                      <CategoryIcon />
                      {role.category}
                    </span>
                  </div>
                </div>
                <div className="w-16 h-16 border-2 border-black flex items-center justify-center group-hover:bg-[#FE7F2D] group-hover:text-white transition-all shrink-0">
                  <ArrowIcon />
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-40 px-10 text-center bg-[#fcfcfc]">
        <h2 className="text-4xl md:text-7xl font-semibold uppercase tracking-normal leading-tight mb-12">
          Don't just <br />
          <span className="text-[#FE7F2D]">automate tasks</span> <br />
          Build a partner
        </h2>
        <a
          href="#roles"
          className="inline-flex items-center gap-3 border-2 border-black bg-black px-16 py-8 text-[18px] font-semibold text-white transition-all shadow-[10px_10px_0px_0px_rgba(254,127,45,1)] hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[16px_16px_0px_0px_rgba(254,127,45,1)] active:translate-x-0 active:translate-y-0 active:shadow-none"
        >
          Join the mission
          <ArrowIcon />
        </a>
      </section>
    </main>
  );
}
