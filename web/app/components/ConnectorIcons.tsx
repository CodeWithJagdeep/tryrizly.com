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
  return <BrandLogoImg src="/logos/calcom.svg" alt="Cal.com" className={className} />;
}

export function SlackIcon({ className = base }: IconProps) {
  return <BrandLogoImg src="/logos/slack.svg" alt="Slack" className={className} />;
}

export function NotionIcon({ className = base }: IconProps) {
  return <BrandLogoImg src="/logos/notion.svg" alt="Notion" className={className} />;
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
