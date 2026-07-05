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

export function PayPalIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M7.2 21.4H3.9c-.4 0-.7-.36-.64-.76L5.98 3.4c.07-.46.46-.8.93-.8h6.7c2.24 0 3.9.52 4.8 1.55.83.93 1.1 2.06.83 3.56-.02.1-.04.2-.06.31-.75 3.85-3.3 5.18-6.57 5.18H10.9c-.47 0-.86.34-.93.8l-.9 5.7c-.06.4-.4.7-.8.7h-1.07Z" fill="#253B80"/>
      <path d="M19.3 7.7c-.02.1-.04.21-.06.32-.75 3.85-3.3 5.18-6.57 5.18h-1.71c-.47 0-.86.34-.93.8l-1.1 6.94c-.05.33.2.63.54.63h2.95c.41 0 .76-.3.82-.7l.03-.18.57-3.6.04-.2c.06-.4.41-.7.82-.7h.52c3.35 0 5.97-1.36 6.74-5.3.32-1.64.15-3.02-.7-3.98a3.3 3.3 0 0 0-.96-.72c.02.17.02.34 0 .51Z" fill="#179BD7"/>
    </svg>
  );
}

export function GitHubIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.72.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
        fill="#181717"
      />
    </svg>
  );
}

export function MpesaIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="10" fill="#43B02A"/>
      <path d="M12 34V14h4.6L24 25.2 31.4 14H36v20h-4.4V21.4L24 32.6l-7.6-11.2V34H12Z" fill="white"/>
    </svg>
  );
}
