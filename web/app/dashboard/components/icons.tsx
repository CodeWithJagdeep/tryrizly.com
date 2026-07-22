type IconProps = { className?: string };

const base = "h-4 w-4";

export function PlusIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <path d="M8 2.5v11M2.5 8h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13 13l-2.6-2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function NotesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <rect x="2.5" y="3" width="11" height="10.5" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 6h11M5.5 1.7v2.6M10.5 1.7v2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function RoutineIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <path
        d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v3h-3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LayersIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <path d="M8 2l5.5 3-5.5 3-5.5-3L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M2.5 8.3L8 11.3l5.5-3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M2.5 11.3L8 14.3l5.5-3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

export function SlidersIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <path d="M3 4.5h10M3 8h10M3 11.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="6" cy="4.5" r="1.3" fill="currentColor" />
      <circle cx="11" cy="8" r="1.3" fill="currentColor" />
      <circle cx="7.5" cy="11.5" r="1.3" fill="currentColor" />
    </svg>
  );
}

export function BoltIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <path d="M8.8 1.5L3.5 9h3.4l-1 5.5L12.5 7H9l1.8-5.5H8.8z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

export function WandIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <path d="M2.5 13.5l7-7M9.5 6l-1.7-1.7M13.5 2.5l-1 1M13.5 5.5l-1-1M2.5 5.5l1-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function MicIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <rect x="6" y="2" width="4" height="7" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4 8a4 4 0 0 0 8 0M8 12v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowUpIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? "h-4 w-4 text-white"} aria-hidden="true">
      <path d="M8 12.5V3.5M4 7l4-4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LibraryIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 5v3l2 1.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChatIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <path
        d="M2.5 4.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H7l-3 2.5v-2.5H4.5a2 2 0 0 1-2-2v-5z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GearIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 1.8v1.6M8 12.6v1.6M14.2 8h-1.6M3.4 8H1.8M12.2 3.8l-1.1 1.1M4.9 11.1l-1.1 1.1M12.2 12.2l-1.1-1.1M4.9 4.9 3.8 3.8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LogoutIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <path
        d="M6.2 1.8H3.4a1.6 1.6 0 0 0-1.6 1.6v9.2a1.6 1.6 0 0 0 1.6 1.6h2.8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.4 11.2l3.2-3.2-3.2-3.2M13.4 8H6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CheckCircleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 8.2l1.8 1.8 3.2-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <rect x="2.5" y="3" width="11" height="10.5" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 6h11M5.5 1.7v2.6M10.5 1.7v2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <rect x="5" y="8" width="2" height="2" fill="currentColor" />
    </svg>
  );
}

export function VideoIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <rect x="1.8" y="4" width="8.4" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.2 7.2l3.2-2v5.6l-3.2-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 5v3.2l2.2 1.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GaugeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <path d="M2 12a6 6 0 1 1 12 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M8 12 10.5 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="12" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function PlugIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <path d="M6 2v3.5M10 2v3.5M4.5 5.5h7v2a3.5 3.5 0 0 1-3.5 3.5 3.5 3.5 0 0 1-3.5-3.5v-2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8 11v3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function UsersIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <path d="M10.5 10.5c1.5.5 2.5 1.5 2.5 2.5H3c0-1 1-2 2.5-2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="6" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10.5 7.5c.8-.3 1.5-1 1.5-2a2 2 0 0 0-2-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M12.5 10.5c1 .3 1.5 1 1.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function MailIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 5.5l6.5 4 6.5-4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

export function PanelToggleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <rect x="1.8" y="2.8" width="12.4" height="10.4" rx="1.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6 2.8v10.4" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function BellIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden="true">
      <path d="M8 2a4 4 0 0 0-4 4v2.5L2.5 10.5h11L12 8.5V6a4 4 0 0 0-4-4Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M6.5 12a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
