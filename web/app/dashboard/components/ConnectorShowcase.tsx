import Link from "next/link";
import {
  CalendarIcon as GoogleCalendarIcon,
  GitHubIcon,
  GmailIcon,
  NotionIcon,
  SlackIcon,
  StripeIcon,
} from "../../components/ConnectorIcons";

const tiles: { label: string; desc: string; icon: (props: { className?: string }) => React.ReactElement }[] = [
  { label: "Gmail", desc: "Inbox triage & replies", icon: GmailIcon },
  { label: "Calendar", desc: "Bookings & reminders", icon: GoogleCalendarIcon },
  { label: "Slack", desc: "Team notifications", icon: SlackIcon },
  { label: "Stripe", desc: "Revenue & billing", icon: StripeIcon },
  { label: "Notion", desc: "Docs & workspaces", icon: NotionIcon },
  { label: "GitHub", desc: "Issues & pull requests", icon: GitHubIcon },
];

export function ConnectorShowcase() {
  return (
    <div className="w-full pt-8">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[15px] font-semibold text-white">Connect your tools</p>
        <Link href="/dashboard/connectors" className="text-[13px] font-medium text-[#D9BEF4] transition hover:brightness-110">
          View all
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link
              key={tile.label}
              href="/dashboard/connectors"
              className="flex items-start gap-3 rounded-xl border border-[#2d2e31] bg-[#18191b] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#D9BEF4]/60 hover:bg-[#1c1d20]"
            >
              <Icon className="h-6 w-6 shrink-0" />
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-white">{tile.label}</span>
                <span className="block truncate text-[12px] text-[#8a898f]">{tile.desc}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
