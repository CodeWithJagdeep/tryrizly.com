type IconProps = { className?: string };

const base = "size-full";

/** Official brand mark, served from /public/logos (sourced from Wikimedia Commons). */
function BrandLogoImg({ src, alt, className }: { src: string; alt: string; className: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- arbitrary-aspect-ratio SVG, not a fixed-size asset next/image expects
  return <img src={src} alt={alt} className={`${className} object-contain`} />;
}

export function GoogleIcon({ className = base }: IconProps) {
  return <BrandLogoImg src="/logos/google.svg" alt="Google" className={className} />;
}

export function CalendarIcon({ className = base }: IconProps) {
  return <BrandLogoImg src="/logos/google-calendar.svg" alt="Google Calendar" className={className} />;
}

export function GmailIcon({ className = base }: IconProps) {
  return <BrandLogoImg src="/logos/gmail.svg" alt="Gmail" className={className} />;
}

export function RazorpayIcon({ className = base }: IconProps) {
  return <BrandLogoImg src="/logos/razorpay.svg" alt="Razorpay" className={className} />;
}

export function StripeIcon({ className = base }: IconProps) {
  return <BrandLogoImg src="/logos/stripe.svg" alt="Stripe" className={className} />;
}

export function PostgresIcon({ className = base }: IconProps) {
  return <BrandLogoImg src="/logos/postgresql.svg" alt="PostgreSQL" className={className} />;
}

export function MongoDbIcon({ className = base }: IconProps) {
  return <BrandLogoImg src="/logos/mongodb.svg" alt="MongoDB" className={className} />;
}

export function CustomApiIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="5" fill="#1F1F1F" />
      <path d="M7 8L4 12L7 16" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 8L20 12L17 16" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 17L13.5 7" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function TelegramIcon({ className = base }: IconProps) {
  return <BrandLogoImg src="/logos/telegram.svg" alt="Telegram" className={className} />;
}

export function CalComIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="10" fill="#111827"/>
      <path d="M14 24c0-5.523 4.477-10 10-10s10 4.477 10 10-4.477 10-10 10S14 29.523 14 24Z" stroke="white" strokeWidth="2.5"/>
      <path d="M24 19v5l3 3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M35 13l2 2" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <path d="M11 13l-2 2" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

export function SlackIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 54 54" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M19.7 33.7c0 2.8-2.3 5.1-5.1 5.1s-5.1-2.3-5.1-5.1 2.3-5.1 5.1-5.1h5.1v5.1Z" fill="#E01E5A"/>
      <path d="M22.3 33.7c0-2.8 2.3-5.1 5.1-5.1s5.1 2.3 5.1 5.1v12.8c0 2.8-2.3 5.1-5.1 5.1s-5.1-2.3-5.1-5.1V33.7Z" fill="#E01E5A"/>
      <path d="M27.4 19.7c-2.8 0-5.1-2.3-5.1-5.1s2.3-5.1 5.1-5.1 5.1 2.3 5.1 5.1v5.1H27.4Z" fill="#36C5F0"/>
      <path d="M27.4 22.3c2.8 0 5.1 2.3 5.1 5.1s-2.3 5.1-5.1 5.1H14.6c-2.8 0-5.1-2.3-5.1-5.1s2.3-5.1 5.1-5.1h12.8Z" fill="#36C5F0"/>
      <path d="M41.4 27.4c0 2.8-2.3 5.1-5.1 5.1s-5.1-2.3-5.1-5.1V22.3h5.1c2.8 0 5.1 2.3 5.1 5.1Z" fill="#2EB67D"/>
      <path d="M38.8 27.4c0-2.8 2.3-5.1 5.1-5.1s5.1 2.3 5.1 5.1-2.3 5.1-5.1 5.1h-5.1V27.4Z" fill="#2EB67D"/>
      <path d="M36.3 41.4c2.8 0 5.1 2.3 5.1 5.1s-2.3 5.1-5.1 5.1-5.1-2.3-5.1-5.1v-5.1h5.1Z" fill="#ECB22E"/>
      <path d="M36.3 38.8c-2.8 0-5.1-2.3-5.1-5.1s2.3-5.1 5.1-5.1h12.8c2.8 0 5.1 2.3 5.1 5.1s-2.3 5.1-5.1 5.1H36.3Z" fill="#ECB22E"/>
    </svg>
  );
}

export function NotionIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="18" fill="#191919"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M18.6 20.8c2 2.6 2.8 2.6 6.6 2.4l36-.34c.77 0 .77-.97 0-1.25L57 19.5c-1.13-.4-2.47-.68-5.08-.44L18.6 20.8Zm7.4 5.5v40.5c0 2.2 1.1 3 3.3 2.8l39.5-2.26c2.2-.12 2.7-1.5 2.7-3.14V23.8c0-1.88-.74-2.85-2.47-2.7L28.7 23.54c-1.85.12-2.7 1.05-2.7 2.76Zm34.7-9.5c.4.58.23 1.24-.48 1.27l-3.1.22v31.7c-2.6 1.4-5 2.1-6.9 2.1-3.1 0-3.9-1.05-6.3-4.2L32.6 30.7v18l3.95.9s0 2.08-2.9 2.08L25.4 52c-.4-.58-.2-1.46.32-1.6l2.18-.64V26.6l-3.04-.25c-.4-.58-.2-1.44.62-1.6l8.5-.6 11.5 17.6V26.3l-3.35-.4c-.4-.72-.2-1.8.9-1.9l9.1-.58 1.9.86Z" fill="white"/>
    </svg>
  );
}
