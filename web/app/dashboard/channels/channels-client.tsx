"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SlackIcon, TelegramIcon } from "../../components/ConnectorIcons";

type OnboardingStatus = {
  onboarding?: { telegramLinked?: boolean; slackLinked?: boolean };
};

export function ChannelsClient() {
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [slackLinked, setSlackLinked] = useState(false);

  useEffect(() => {
    fetch("/api/onboarding/status")
      .then((r) => r.json())
      .then((d: OnboardingStatus) => {
        setTelegramLinked(Boolean(d.onboarding?.telegramLinked));
        setSlackLinked(Boolean(d.onboarding?.slackLinked));
      })
      .catch(() => null);
  }, []);

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="w-full px-6 py-6">
        <h1 className="text-xl font-semibold text-slate-950">Channels</h1>
        <p className="mt-1 text-sm text-slate-500">
          Talk to Rizly from Telegram or Slack instead of the web dashboard.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:max-w-md">
          <ChannelRow
            icon={<TelegramIcon className="h-6 w-6" />}
            title="Telegram"
            linked={telegramLinked}
            href="/dashboard/telegram"
          />
          <ChannelRow
            icon={<SlackIcon className="h-6 w-6" />}
            title="Slack"
            linked={slackLinked}
            href="/dashboard/slack"
          />
        </div>
      </div>
    </main>
  );
}

function ChannelRow({
  icon,
  title,
  linked,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  linked: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        <p className={`text-xs ${linked ? "text-emerald-600" : "text-slate-400"}`}>
          {linked ? "Connected" : "Not connected"}
        </p>
      </div>
      <span className="shrink-0 text-sm font-medium text-slate-500">
        {linked ? "Manage" : "Connect"}
      </span>
    </Link>
  );
}
