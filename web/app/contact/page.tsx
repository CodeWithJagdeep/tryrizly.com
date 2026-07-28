import type { Metadata } from "next";
import { Eyebrow } from "../components/product/Eyebrow";
import { HeroGlow } from "../components/product/HeroGlow";
import { ContactForm } from "./ContactForm";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with the Rizly team.",
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    title: "Contact Us",
    description: "Get in touch with the Rizly team.",
    url: `${SITE_URL}/contact`,
    type: "website",
  },
};

const EmailIcon = () => (
  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="20" width="20" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3H21C21.5523 3 22 3.44772 22 4V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3ZM20 7.23792L12.0718 14.338L4 7.21594V19H20V7.23792ZM4.51146 5L12.0619 11.662L19.501 5H4.51146Z"></path>
  </svg>
);

const ChatIcon = () => (
  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="20" width="20" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 8.99374C2 5.68349 4.67654 3 8.00066 3H15.9993C19.3134 3 22 5.69478 22 8.99374V21H8.00066C4.68659 21 2 18.3052 2 15.0063V8.99374ZM20 19V8.99374C20 6.79539 18.2049 5 15.9993 5H8.00066C5.78458 5 4 6.78458 4 8.99374V15.0063C4 17.2046 5.79512 19 8.00066 19H20ZM14 11H16V13H14V11ZM8 11H10V13H8V11Z"></path>
  </svg>
);

const GlobeIcon = () => (
  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="20" width="20" xmlns="http://www.w3.org/2000/svg">
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
    <main className="bg-white text-black">
      <section className="relative overflow-hidden border-b border-black/10 bg-white">
        <HeroGlow />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-6 pb-16 pt-28 text-center md:px-10">
          <Eyebrow>Get in touch</Eyebrow>
          <h1 className="max-w-2xl text-4xl font-normal leading-[1.08] tracking-tight text-[#233D4D] [text-wrap:balance] md:text-5xl">
            Talk to a <span className="text-[#D9BEF4]">human</span>
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-6 text-gray-600 md:text-base">
            Whether you&apos;re looking for an enterprise demo or technical support, the team behind Rizly is here to
            help.
          </p>
        </div>
      </section>

      {/* Form + info */}
      <section className="border-t border-black/10 bg-[#fcfcfc] px-6 py-20 md:px-10 lg:px-14">
        <div className="mx-auto grid max-w-[88rem] grid-cols-1 gap-14 lg:grid-cols-2">
          <ContactForm />

          <div className="space-y-10">
            <div>
              <h3 className="mb-8 text-2xl font-normal text-[#233D4D]">Connect directly</h3>
              <div className="space-y-6">
                {contactChannels.map((channel) => (
                  <div key={channel.label} className="flex items-start gap-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-[#233D4D] shadow-[0_10px_30px_-20px_rgba(32,21,28,0.4)]">
                      {channel.icon}
                    </div>
                    <div>
                      <span className="mb-1 block text-xs uppercase tracking-[0.1em] text-gray-500">{channel.label}</span>
                      {channel.href ? (
                        <a href={channel.href} className="mb-1 block text-lg font-normal text-[#233D4D] transition hover:text-[#D9BEF4]">
                          {channel.value}
                        </a>
                      ) : (
                        <span className="mb-1 block text-lg font-normal text-[#233D4D]">{channel.value}</span>
                      )}
                      <span className="block text-xs text-[#D9BEF4]">{channel.note}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-8 shadow-[0_20px_60px_-48px_rgba(32,21,28,0.4)]">
              <h4 className="mb-3 text-lg font-normal text-[#233D4D]">Enterprise inquiries</h4>
              <p className="mb-5 text-sm leading-6 text-gray-600">
                Need a custom demo or help with a security questionnaire? Our team is ready to assist.
              </p>
              <a href="mailto:sales@getrizly.com" className="text-sm text-[#233D4D] underline underline-offset-4 transition hover:text-[#D9BEF4]">
                Book a meeting
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
