type IconProps = { className?: string };

const base = "size-full";

/** Official brand mark, served from /public/logos (sourced from Wikimedia Commons). */
function BrandLogoImg({ src, alt, className }: { src: string; alt: string; className: string }) {
  return <img src={src} alt="" aria-hidden="true" title={alt} className={`${className} object-contain`} />;
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

export function GoogleDriveIcon({ className = base }: IconProps) {
  return <BrandLogoImg src="/logos/google-drive.svg" alt="Google Drive" className={className} />;
}

export function GoogleSheetsIcon({ className = base }: IconProps) {
  return <BrandLogoImg src="/logos/google-sheets.svg" alt="Google Sheets" className={className} />;
}

export function GoogleDocsIcon({ className = base }: IconProps) {
  return <BrandLogoImg src="/logos/google-docs.svg" alt="Google Docs" className={className} />;
}

export function GoogleFormsIcon({ className = base }: IconProps) {
  return <BrandLogoImg src="/logos/google-forms.svg" alt="Google Forms" className={className} />;
}

export function GoogleMeetIcon({ className = base }: IconProps) {
  return <BrandLogoImg src="/logos/google-meet.svg" alt="Google Meet" className={className} />;
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

export function DiscordIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="5" fill="#5865F2" />
      <path
        d="M17.2 7.2a13 13 0 0 0-3-.9l-.15.3c1 .24 1.94.6 2.8 1.1a10.6 10.6 0 0 0-9.7 0 8.8 8.8 0 0 1 2.83-1.1l-.15-.3a13 13 0 0 0-3.03.9C5.1 9.5 4.4 12.9 4.7 16.2a13.1 13.1 0 0 0 3.98 2.02c.32-.44.6-.9.84-1.4a8.5 8.5 0 0 1-1.34-.65c.11-.08.22-.17.33-.25a9.3 9.3 0 0 0 7.98 0c.11.08.22.17.33.25-.42.25-.87.47-1.34.65.24.5.52.96.84 1.4A13.1 13.1 0 0 0 20.3 16.2c.34-3.8-.6-7.17-3.1-9Zm-7.15 7.2c-.72 0-1.3-.66-1.3-1.47 0-.81.57-1.47 1.3-1.47.72 0 1.31.67 1.3 1.47 0 .81-.58 1.47-1.3 1.47Zm4.9 0c-.72 0-1.3-.66-1.3-1.47 0-.81.57-1.47 1.3-1.47.72 0 1.3.67 1.3 1.47 0 .81-.58 1.47-1.3 1.47Z"
        fill="white"
      />
    </svg>
  );
}

// Brand marks below fetched via the Brandfetch API and vendored locally as
// static files (same convention as the Google/Slack/etc logos above) — see
// web/public/logos. No runtime dependency on Brandfetch or any API key.
export function JiraIcon({ className = base }: IconProps) {
  return <BrandLogoImg src="/logos/jira.png" alt="Jira" className={className} />;
}

export function PagerDutyIcon({ className = base }: IconProps) {
  return <BrandLogoImg src="/logos/pagerduty.svg" alt="PagerDuty" className={className} />;
}

export function TrelloIcon({ className = base }: IconProps) {
  return <BrandLogoImg src="/logos/trello.svg" alt="Trello" className={className} />;
}

export function AirtableIcon({ className = base }: IconProps) {
  return <BrandLogoImg src="/logos/airtable.svg" alt="Airtable" className={className} />;
}

export function TwilioIcon({ className = base }: IconProps) {
  return <BrandLogoImg src="/logos/twilio.svg" alt="Twilio" className={className} />;
}

/** Simple letter-badge placeholders (no vendored brand asset yet) for the newest push-webhook connectors — swap for a real /logos/*.svg when one is added, same as the providers above. */
function MonogramIcon({ letter, bg, fg = "#fff", className = base }: { letter: string; bg: string; fg?: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="5" fill={bg} />
      <text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="700" fontFamily="system-ui, sans-serif" fill={fg}>
        {letter}
      </text>
    </svg>
  );
}

export function ShopifyIcon({ className = base }: IconProps) {
  return <MonogramIcon letter="S" bg="#95BF47" className={className} />;
}

export function CalendlyIcon({ className = base }: IconProps) {
  return <MonogramIcon letter="C" bg="#006BFF" className={className} />;
}

export function TypeformIcon({ className = base }: IconProps) {
  return <MonogramIcon letter="T" bg="#262627" className={className} />;
}

export function GumroadIcon({ className = base }: IconProps) {
  return <MonogramIcon letter="G" bg="#FF90E8" fg="#000" className={className} />;
}

export function LemonSqueezyIcon({ className = base }: IconProps) {
  return <MonogramIcon letter="L" bg="#FFC233" fg="#000" className={className} />;
}

export function DropboxIcon({ className = base }: IconProps) {
  return <MonogramIcon letter="D" bg="#0061FF" className={className} />;
}

export function FigmaIcon({ className = base }: IconProps) {
  return <MonogramIcon letter="F" bg="#1E1E1E" className={className} />;
}

export function UptimeRobotIcon({ className = base }: IconProps) {
  return <MonogramIcon letter="U" bg="#7BDCB5" fg="#000" className={className} />;
}

export function QuickBooksIcon({ className = base }: IconProps) {
  return <MonogramIcon letter="Q" bg="#2CA01C" className={className} />;
}

export function XeroIcon({ className = base }: IconProps) {
  return <MonogramIcon letter="X" bg="#13B5EA" className={className} />;
}

export function WiseIcon({ className = base }: IconProps) {
  return <MonogramIcon letter="W" bg="#9FE870" fg="#000" className={className} />;
}

export function BambooHrIcon({ className = base }: IconProps) {
  return <MonogramIcon letter="B" bg="#98C93C" fg="#000" className={className} />;
}

export function DeelIcon({ className = base }: IconProps) {
  return <MonogramIcon letter="D" bg="#0B0B0B" className={className} />;
}

export function BoxIcon({ className = base }: IconProps) {
  return <MonogramIcon letter="B" bg="#0061D5" className={className} />;
}

export function StatuspageIcon({ className = base }: IconProps) {
  return <MonogramIcon letter="S" bg="#7C3AED" className={className} />;
}

export function BetterStackIcon({ className = base }: IconProps) {
  return <MonogramIcon letter="B" bg="#000000" className={className} />;
}
