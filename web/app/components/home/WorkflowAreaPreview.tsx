import Image from "next/image";
import Link from "next/link";
import { CalendarIcon, GmailIcon } from "../../components/ConnectorIcons";
import { ChatIcon, UsersIcon, VideoIcon } from "../../dashboard/components/icons";

const areas = [
  {
    label: "Chat",
    Icon: ChatIcon,
    title: "Ask once. Rizly brings the context.",
    description:
      "Use chat to summarize threads, draft replies, prepare decisions, and review approvals without jumping between tools.",
    detail:
      "It becomes the place where your work context comes together: inbox notes, meeting history, people, and pending actions all stay close to the conversation.",
    cta: "Start with chat",
    screenshot: null,
  },
  {
    label: "Emails",
    Icon: GmailIcon,
    title: "Your inbox sorted before you open it.",
    description:
      "Rizly categorizes Gmail, pulls out what matters, drafts replies, schedules sends, and waits for approval before anything goes out.",
    detail:
      "Instead of scanning every thread yourself, you get the important messages framed clearly with the next best response already prepared.",
    cta: "Automate inbox work",
    screenshot: { src: "/images/emails.png", width: 1588, height: 779 },
  },
  {
    label: "People",
    Icon: UsersIcon,
    title: "Contacts turn into useful memory.",
    description:
      "People and companies from email become searchable context, so relationships stay visible without manually maintaining a CRM.",
    detail:
      "Rizly keeps track of who matters, where they appeared, and how they connect to your ongoing work so follow-ups feel less manual.",
    cta: "Map your contacts",
    screenshot: { src: "/images/people.png", width: 1586, height: 833 },
  },
  {
    label: "Calendar",
    Icon: CalendarIcon,
    title: "Meetings arrive with the brief already built.",
    description:
      "Rizly reads calendar context, checks timing, and turns useful meeting data into one readable view before the day gets busy.",
    detail:
      "You can walk into meetings with the relevant schedule, context, and conflicts already surfaced instead of rebuilding the picture each morning.",
    cta: "Brief my calendar",
    screenshot: { src: "/images/calendar.png", width: 1575, height: 839 },
  },
  {
    label: "Meetings",
    Icon: VideoIcon,
    title: "Every meeting in one clean timeline.",
    description:
      "Google Calendar and Cal.com events are merged, deduped, and organized so upcoming and past meeting context is easy to scan.",
    detail:
      "That gives you one reliable place to understand what happened, what is next, and which conversations need a follow-up.",
    cta: "Organize meetings",
    screenshot: { src: "/images/meetings.png", width: 1583, height: 833 },
  },
];

export function WorkflowAreaPreview() {
  return (
    <div className="space-y-16 md:space-y-20">
      {areas.map((area, index) => {
        const Icon = area.Icon;
        const flip = index % 2 === 1;

        return (
          <section
            key={area.label}
            className="grid min-h-[560px] grid-cols-1 items-stretch gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:gap-12"
          >
            <div className={`flex min-h-[260px] flex-col justify-center ${flip ? "lg:order-2" : ""}`}>
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#f7f7f6] text-black">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-xs font-normal uppercase tracking-[0.16em] text-gray-500">{area.label}</span>
              <h3 className="mt-4 max-w-xl text-3xl font-normal leading-tight tracking-tight text-[#20151c] md:text-4xl">
                {area.title}
              </h3>
              <p className="mt-5 max-w-xl text-base leading-7 text-gray-600 md:text-lg">{area.description}</p>
              <p className="mt-4 max-w-xl text-base leading-7 text-gray-600 md:text-lg">{area.detail}</p>
              <Link
                href="/signup"
                className="mt-8 inline-flex h-12 w-fit items-center justify-center rounded-full bg-[#20151c] px-6 text-base font-normal text-white transition hover:bg-black"
              >
                {area.cta}
              </Link>
            </div>

            <div className={`flex min-h-[360px] self-center ${flip ? "lg:order-1" : ""}`}>
              <ScreenshotSlot screenshot={area.screenshot} alt={area.title} />
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ScreenshotSlot({
  screenshot,
  alt,
}: {
  screenshot: { src: string; width: number; height: number } | null;
  alt: string;
}) {
  return (
    <div className="flex w-full rounded-[2rem] bg-[linear-gradient(135deg,#fff7f3_0%,#ffd9ce_42%,#f7b6c6_100%)] p-8 shadow-[0_42px_110px_-86px_rgba(244,114,98,0.56)] md:p-10">
      <div
        className="relative min-h-[320px] w-full overflow-hidden rounded-2xl bg-white"
        style={screenshot ? { aspectRatio: `${screenshot.width} / ${screenshot.height}` } : undefined}
      >
        {screenshot ? (
          <Image
            src={screenshot.src}
            alt={alt}
            fill
            quality={100}
            className="object-cover object-left-top"
            sizes="(min-width: 1280px) 700px, (min-width: 1024px) 55vw, 100vw"
          />
        ) : (
          <div className="flex min-h-[320px] w-full items-center justify-center p-8">
            <p className="text-sm font-normal text-slate-400">Add dashboard screenshot here</p>
          </div>
        )}
      </div>
    </div>
  );
}
