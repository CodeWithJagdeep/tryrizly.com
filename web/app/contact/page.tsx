import type { Metadata } from "next";
import { ContactForm } from "./ContactForm";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "Contact Us | Rizly",
  description: "Get in touch with the Rizly team.",
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    title: "Contact Us | Rizly",
    description: "Get in touch with the Rizly team.",
    url: `${SITE_URL}/contact`,
    type: "website",
  },
};

const EmailIcon = () => (
  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="24" width="24" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3H21C21.5523 3 22 3.44772 22 4V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3ZM20 7.23792L12.0718 14.338L4 7.21594V19H20V7.23792ZM4.51146 5L12.0619 11.662L19.501 5H4.51146Z"></path>
  </svg>
);

const ChatIcon = () => (
  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="24" width="24" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 8.99374C2 5.68349 4.67654 3 8.00066 3H15.9993C19.3134 3 22 5.69478 22 8.99374V21H8.00066C4.68659 21 2 18.3052 2 15.0063V8.99374ZM20 19V8.99374C20 6.79539 18.2049 5 15.9993 5H8.00066C5.78458 5 4 6.78458 4 8.99374V15.0063C4 17.2046 5.79512 19 8.00066 19H20ZM14 11H16V13H14V11ZM8 11H10V13H8V11Z"></path>
  </svg>
);

const GlobeIcon = () => (
  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="24" width="24" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.23509 6.45329C4.85101 7.89148 4 9.84636 4 12C4 16.4183 7.58172 20 12 20C13.0808 20 14.1116 19.7857 15.0521 19.3972C15.1671 18.6467 14.9148 17.9266 14.8116 17.6746C14.582 17.115 13.8241 16.1582 12.5589 14.8308C12.2212 14.4758 12.2429 14.2035 12.3636 13.3943L12.3775 13.3029C12.4595 12.7486 12.5971 12.4209 14.4622 12.1248C15.4097 11.9746 15.6589 12.3533 16.0043 12.8777C16.0425 12.9358 16.0807 12.9928 16.1198 13.0499C16.4479 13.5297 16.691 13.6394 17.0582 13.8064C17.2227 13.881 17.428 13.9751 17.7031 14.1314C18.3551 14.504 18.3551 14.9247 18.3551 15.8472V15.9518C18.3551 16.3434 18.3168 16.6872 18.2566 16.9859C19.3478 15.6185 20 13.8854 20 12C20 8.70089 18.003 5.8682 15.1519 4.64482C14.5987 5.01813 13.8398 5.54726 13.575 5.91C13.4396 6.09538 13.2482 7.04166 12.6257 7.11976C12.4626 7.14023 12.2438 7.12589 12.012 7.11097C11.3905 7.07058 10.5402 7.01606 10.268 7.75495C10.0952 8.2232 10.0648 9.49445 10.6239 10.1543C10.7134 10.2597 10.7307 10.4547 10.6699 10.6735C10.59 10.9608 10.4286 11.1356 10.3783 11.1717C10.2819 11.1163 10.0896 10.8931 9.95938 10.7412C9.64554 10.3765 9.25405 9.92233 8.74797 9.78176C8.56395 9.73083 8.36166 9.68867 8.16548 9.64736C7.6164 9.53227 6.99443 9.40134 6.84992 9.09302C6.74442 8.8672 6.74488 8.55621 6.74529 8.22764C6.74529 7.8112 6.74529 7.34029 6.54129 6.88256C6.46246 6.70541 6.35689 6.56446 6.23509 6.45329ZM12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22Z"></path>
  </svg>
);

const contactChannels = [
  {
    icon: <EmailIcon />,
    label: "Email us",
    value: "hello@getrizly.com",
    href: "mailto:hello@getrizly.com",
    note: "Response time: < 24 hours",
  },
  {
    icon: <ChatIcon />,
    label: "Live chat",
    value: "Dashboard widget",
    note: "Available for all logged-in users",
  },
  {
    icon: <GlobeIcon />,
    label: "Remote first",
    value: "Global team",
    note: "Working across multiple timezones",
  },
];

export default function ContactPage() {
  return (
    <main>
      {/* Hero */}
      <section className="pt-32 pb-24 px-10 text-center relative border-b-2 border-black/10 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none -z-10 opacity-[0.03]"
          style={{ backgroundImage: "radial-gradient(rgb(0, 0, 0) 1px, transparent 1px)", backgroundSize: "32px 32px" }}
        ></div>
        <div className="max-w-4xl mx-auto">
          <span className="inline-block px-3 py-1 border-2 border-[#FE7F2D] text-[#FE7F2D] text-[12px] font-semibold uppercase tracking-[0.2em] mb-8">
            Get in touch
          </span>
          <h1 className="text-4xl md:text-6xl font-semibold uppercase tracking-normal leading-tight mb-10">
            Talk to a <br />
            <span className="text-[#FE7F2D]">human</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-6 leading-relaxed">
            Whether you're looking for an enterprise demo or technical support, the team behind Rizly is here to help.
          </p>
        </div>
      </section>

      {/* Form + info */}
      <section className="px-10 md:px-14 py-32 border-b-2 border-black/10 bg-white">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-24">
          <ContactForm />

          <div className="space-y-12">
            <div>
              <h3 className="text-2xl font-semibold mb-10">Connect directly</h3>
              <div className="space-y-8">
                {contactChannels.map((channel) => (
                  <div key={channel.label} className="flex gap-6 items-start group">
                    <div className="w-14 h-14 border-2 border-black bg-white flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group-hover:bg-[#FE7F2D] group-hover:text-white group-hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all shrink-0">
                      {channel.icon}
                    </div>
                    <div>
                      <span className="block text-[11px] font-semibold tracking-widest text-gray-400 mb-1">{channel.label}</span>
                      {channel.href ? (
                        <a href={channel.href} className="block text-lg font-semibold leading-none mb-1 hover:text-[#FE7F2D] transition-colors">
                          {channel.value}
                        </a>
                      ) : (
                        <span className="block text-lg font-semibold leading-none mb-1">{channel.value}</span>
                      )}
                      <span className="block text-[13px] font-medium text-[#FE7F2D] tracking-tight">{channel.note}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-10 border-2 border-black bg-[#FE7F2D]/5">
              <h4 className="text-lg font-semibold mb-4">Enterprise inquiries</h4>
              <p className="text-gray-500 leading-relaxed mb-6">
                Need a custom demo, security questionnaire, or SOC2 report? Our team is ready to assist.
              </p>
              <a href="mailto:sales@getrizly.com" className="text-[13px] font-semibold underline hover:text-[#FE7F2D] transition-colors">
                Book a meeting
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
