"use client";

import { useEffect, useRef, useState } from "react";
import { SlackIcon, TelegramIcon } from "../../components/ConnectorIcons";

type Tab = "telegram" | "slack";

export function ChannelConnectModal({
  open,
  initialTab,
  onClose,
}: {
  open: boolean;
  initialTab: Tab;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-[#2d2e31] bg-[#18191b] text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#2d2e31] px-5 py-4">
          <div className="flex gap-1 rounded-full bg-[#111315] p-1">
            <TabButton active={tab === "telegram"} onClick={() => setTab("telegram")}>
              <TelegramIcon className="h-4 w-4" />
              Telegram
            </TabButton>
            <TabButton active={tab === "slack"} onClick={() => setTab("slack")}>
              <SlackIcon className="h-4 w-4" />
              Slack
            </TabButton>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#aaa9ad] transition hover:bg-white/5 hover:text-white"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-6">
          {tab === "telegram" ? <TelegramPane active={open} /> : <SlackPane active={open} />}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition ${
        active ? "bg-[#2a2a2d] text-white" : "text-[#aaa9ad] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function TelegramPane({ active }: { active: boolean }) {
  const [linked, setLinked] = useState<boolean | null>(null);
  const [telegram, setTelegram] = useState<{ deepLink: string; qrCode: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const load = () =>
      fetch("/api/telegram")
        .then((r) => r.json())
        .then((d: { linked?: boolean }) => { if (!cancelled) setLinked(Boolean(d.linked)); })
        .catch(() => undefined);
    void load();
    pollRef.current = setInterval(load, 3000);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [active]);

  useEffect(() => {
    if (!active || linked !== false) return;
    fetch("/api/onboarding/telegram/token", { method: "POST" })
      .then((r) => r.json())
      .then((data: { deepLink?: string; qrCode?: string }) => {
        if (data.deepLink && data.qrCode) setTelegram({ deepLink: data.deepLink, qrCode: data.qrCode });
      })
      .catch(() => undefined);
  }, [active, linked]);

  if (linked === null) return <ChannelLoading />;
  if (linked) return <ChannelLinked label="Telegram" />;

  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-[15px] font-semibold text-white">Link Telegram</p>
      <p className="mt-1.5 text-sm leading-6 text-[#aaa9ad]">
        Scan the QR code or open Telegram to start chatting with Riz there. This closes automatically once linked.
      </p>
      {telegram ? (
        <>
          <img
            src={telegram.qrCode}
            alt="Telegram link QR code"
            className="mt-5 h-[200px] w-[200px] rounded-xl border border-[#2d2e31] bg-white p-3"
          />
          <a
            href={telegram.deepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center justify-center rounded-full bg-[#D9BEF4] px-5 py-2 text-sm font-semibold text-[#1a1a1c] transition hover:brightness-95"
          >
            Open Telegram
          </a>
        </>
      ) : (
        <ChannelLoading label="Generating secure link…" />
      )}
    </div>
  );
}

function SlackPane({ active }: { active: boolean }) {
  const [linked, setLinked] = useState<boolean | null>(null);
  const [slack, setSlack] = useState<{ installUrl: string; linkCommand: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const load = () =>
      fetch("/api/slack")
        .then((r) => r.json())
        .then((d: { linked?: boolean }) => { if (!cancelled) setLinked(Boolean(d.linked)); })
        .catch(() => undefined);
    void load();
    pollRef.current = setInterval(load, 3000);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [active]);

  useEffect(() => {
    if (!active || linked !== false) return;
    fetch("/api/onboarding/slack/token", { method: "POST" })
      .then((r) => r.json())
      .then((data: { installUrl?: string; linkCommand?: string }) => {
        if (data.installUrl && data.linkCommand) setSlack({ installUrl: data.installUrl, linkCommand: data.linkCommand });
      })
      .catch(() => undefined);
  }, [active, linked]);

  if (linked === null) return <ChannelLoading />;
  if (linked) return <ChannelLinked label="Slack" />;

  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-[15px] font-semibold text-white">Link Slack</p>
      <p className="mt-1.5 text-sm leading-6 text-[#aaa9ad]">
        Install the Rizly Slack app, then DM the bot with the command below to finish linking.
      </p>
      {slack ? (
        <>
          <a
            href={slack.installUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center justify-center rounded-full bg-[#D9BEF4] px-5 py-2 text-sm font-semibold text-[#1a1a1c] transition hover:brightness-95"
          >
            Add to Slack
          </a>
          <code className="mt-4 w-full rounded-lg border border-[#2d2e31] bg-[#111315] px-3 py-2 text-[13px] text-[#c9c8cb]">
            {slack.linkCommand}
          </code>
        </>
      ) : (
        <ChannelLoading label="Generating install link…" />
      )}
    </div>
  );
}

function ChannelLoading({ label = "Checking status…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#2d2e31] border-t-[#D9BEF4]" />
      <span className="text-sm text-[#aaa9ad]">{label}</span>
    </div>
  );
}

function ChannelLinked({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <p className="text-sm font-medium text-white">{label} is already linked</p>
      <p className="text-sm text-[#aaa9ad]">Riz will keep sending updates there.</p>
    </div>
  );
}
