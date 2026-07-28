import { GmailIcon, SlackIcon, TelegramIcon } from "../ConnectorIcons";

const VOICE_BAR_HEIGHTS = [
  7, 13, 9, 17, 11, 20, 12, 24, 15, 21, 10, 16, 8, 14, 19, 26, 13, 22, 9, 17, 12, 20, 15, 10,
];

const TRANSCRIPT_TEXT = "Can you notify me when we get any mail about invoice from OpenAI";
const TRANSCRIPT_WORDS = TRANSCRIPT_TEXT.split(" ");
const MARQUEE_SECONDS = 9;

function VoiceBars() {
  return (
    <div className="flex h-8 items-center justify-center gap-1 overflow-visible" aria-hidden="true">
      {VOICE_BAR_HEIGHTS.map((height, i) => (
        <span
          key={i}
          className="w-1 rounded-full bg-[#233D4D]"
          style={{
            height,
            animation: "speed-voice-bar 1s ease-in-out infinite",
            animationDelay: `${i * 0.12}s`,
          }}
        />
      ))}
    </div>
  );
}

function LiveTranscript() {
  return (
    <div
      className="w-full max-w-sm overflow-hidden"
      style={{
        WebkitMaskImage: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
        maskImage: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
      }}
    >
      <div className="speed-marquee flex w-max whitespace-nowrap font-mono text-lg font-bold md:text-2xl">
        {[0, 1].map((copy) => (
          <span key={copy} className="flex px-4">
            {TRANSCRIPT_WORDS.map((word, i) => (
              <span
                key={i}
                className="speed-word inline-block px-1.5"
                style={{ animationDelay: `${(i / TRANSCRIPT_WORDS.length) * MARQUEE_SECONDS}s` }}
              >
                {word}
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SpeedSection() {
  return (
    <section className="relative overflow-hidden bg-black px-6 py-32 md:px-10 md:py-40 lg:px-14">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes speed-voice-bar {
              0%, 100% { transform: scaleY(0.35); }
              50% { transform: scaleY(1); }
            }
            .speed-marquee {
              animation: speed-marquee 9s linear infinite;
            }
            @keyframes speed-marquee {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            .speed-word {
              animation: speed-word-pulse ${MARQUEE_SECONDS}s linear infinite;
            }
            @keyframes speed-word-pulse {
              0%, 85%, 100% { transform: scale(1); color: rgba(255, 255, 255, 0.4); }
              50% { transform: scale(1.4); color: #ffffff; }
            }
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        aria-hidden="true"
      />

      <div className="relative mx-auto flex w-full max-w-[88rem] flex-col items-center gap-6 text-center">
        <h2 className="text-5xl font-normal leading-tight tracking-tight text-white [text-wrap:balance] md:text-7xl">
          <span className="relative inline-block font-bold text-[#D9BEF4]">
            10x faster
            <svg
              viewBox="0 0 220 20"
              preserveAspectRatio="none"
              aria-hidden="true"
              className="absolute -bottom-2 left-0 h-3 w-full text-[#D9BEF4]"
            >
              <path
                d="M2 14C36 4 74 4 110 10C146 16 184 16 218 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <br />
          <span className="text-white/80">than doing it yourself.</span>
        </h2>
        <p className="flex max-w-2xl flex-row flex-wrap items-center justify-center gap-x-1.5 text-base leading-7 text-white/90 md:text-xl">
          <span>Riz lives in</span>
          <span className="inline-flex items-center gap-1.5">
            <TelegramIcon className="h-5 w-5 md:h-6 md:w-6" />
            Telegram
          </span>
          <span>and</span>
          <span className="inline-flex items-center gap-1.5">
            <SlackIcon className="h-5 w-5 md:h-6 md:w-6" />
            Slack
          </span>
          <span>, right where you already are. No app to open, no tab to switch to, no inbox to scan, just</span>
          <span>decisions that land where you work.</span>
        </p>
        <div className="mt-14 grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="speed-card flex min-h-[460px] w-full flex-col items-center rounded-2xl border-2 border-white bg-transparent px-6 py-8 text-center">
            <h3 className="text-left text-2xl font-bold text-white">
              Use{" "}
              <span className="inline-flex items-center gap-1.5 align-middle">
                <TelegramIcon className="h-5 w-5" />
                Telegram
              </span>{" "}
              or{" "}
              <span className="inline-flex items-center gap-1.5 align-middle">
                <SlackIcon className="h-5 w-5" />
                Slack
              </span>{" "}
              when you need to, just tell it, and it{" "}
              <span className="relative inline-block">
                handles the rest
                <svg
                  viewBox="0 0 140 16"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  className="absolute -bottom-1.5 left-0 h-2.5 w-full text-[#D9BEF4]"
                >
                  <path
                    d="M2 11C24 3 48 3 70 8C92 13 116 13 138 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span>.</span>
            </h3>
            <div className="mt-auto flex flex-col items-center gap-6 pt-10">
              <LiveTranscript />
              <div className="flex justify-center rounded-full bg-[#ffffff] px-5 py-3">
                <VoiceBars />
              </div>
            </div>
          </div>
          <div className="speed-card flex min-h-[460px] w-full flex-col rounded-2xl border-2 border-white bg-transparent px-6 py-8 text-left">
            <h3 className="text-left text-2xl font-bold text-white">
              Nothing slips past Riz.{" "}
              <span className="relative inline-block">
                Your morning brief
                <svg
                  viewBox="0 0 220 16"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  className="absolute -bottom-1.5 left-0 h-2.5 w-full text-[#D9BEF4]"
                >
                  <path
                    d="M2 11C38 3 76 3 110 8C144 13 182 13 218 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </span>{" "}
              is done before you ask.
            </h3>
            <p className="mt-4 text-sm leading-6 text-white/60">
              Same triage and approvals, mirrored into your team workspace.
            </p>
            <div className="mt-auto w-full pt-10">
              <div className="morning-brief-card w-full rounded-2xl bg-[#ffffff] p-5 text-left">
                <div className="flex items-center gap-2">
                  <SlackIcon className="h-5 w-5" />
                  <TelegramIcon className="h-5 w-5" />
                  <span className="text-sm font-bold text-black">Morning brief</span>
                  <span className="ml-auto text-xs text-black/40">8:02 AM</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-black/70">
                  Good morning. You have a priority email in Gmail that needs a look, and a meeting at 11 PM with an
                  investor, I&apos;ll remind you before it starts.
                </p>
                <div className="mt-4 flex items-center gap-3 rounded-xl bg-black/5 px-3 py-2.5">
                  <GmailIcon className="h-5 w-5 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-black">Invoice #4521 overdue</p>
                    <p className="truncate text-xs text-black/50">billing@openai.com</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
