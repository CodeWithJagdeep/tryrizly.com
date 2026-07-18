"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { clearLocalChatData, getSessions } from "../lib/chat-store";

const TIMEZONES: { label: string; value: string }[] = [
  { label: "UTC", value: "UTC" },
  { label: "Pacific Time – Los Angeles (PT)", value: "America/Los_Angeles" },
  { label: "Mountain Time – Denver (MT)", value: "America/Denver" },
  { label: "Central Time – Chicago (CT)", value: "America/Chicago" },
  { label: "Eastern Time – New York (ET)", value: "America/New_York" },
  { label: "Atlantic Time – Halifax", value: "America/Halifax" },
  { label: "São Paulo (BRT)", value: "America/Sao_Paulo" },
  { label: "London (GMT/BST)", value: "Europe/London" },
  { label: "Paris / Berlin (CET)", value: "Europe/Paris" },
  { label: "Helsinki / Kyiv (EET)", value: "Europe/Helsinki" },
  { label: "Moscow (MSK)", value: "Europe/Moscow" },
  { label: "Dubai (GST)", value: "Asia/Dubai" },
  { label: "Karachi (PKT)", value: "Asia/Karachi" },
  { label: "Kolkata / Mumbai (IST)", value: "Asia/Kolkata" },
  { label: "Dhaka (BST)", value: "Asia/Dhaka" },
  { label: "Bangkok (ICT)", value: "Asia/Bangkok" },
  { label: "Singapore / Kuala Lumpur (SGT)", value: "Asia/Singapore" },
  { label: "Shanghai / Beijing (CST)", value: "Asia/Shanghai" },
  { label: "Seoul (KST)", value: "Asia/Seoul" },
  { label: "Tokyo (JST)", value: "Asia/Tokyo" },
  { label: "Sydney (AEST)", value: "Australia/Sydney" },
  { label: "Auckland (NZST)", value: "Pacific/Auckland" },
];

type OnboardingState = {
  source?: string;
  googleConnected: boolean;
  telegramLinked: boolean;
  completedAt?: string;
};

type BillingStatus = {
  plan?: { id: string; name: string };
  access?: { active: boolean; state: string; expiresAt: string | null };
};

type UsageBreakdownRow = {
  task: string;
  costUsd: number;
  calls: number;
};

type UsageSummary = {
  state: "ok" | "warn" | "exceeded";
  spendUsd: number;
  budgetUsd: number;
  ratio: number;
  cycleStart: string;
  breakdown: UsageBreakdownRow[];
};

type MemoryNote = {
  id: string;
  summary: string;
  source: string;
  createdAt: string;
  metadata?: { provenance?: string; confidence?: string; expiresAt?: string };
};

const SOURCE_OPTIONS = ["Twitter / X", "LinkedIn", "Friend or colleague", "Search", "Other"];
const LANGUAGE_OPTIONS = ["English", "Hindi", "Hinglish", "Spanish", "French", "German"];

const TASK_LABELS: Record<string, string> = {
  agent: "Chat & tool calls",
  extract: "Email reading",
  decide: "Decision tracking",
  draft: "Drafting replies",
  memory: "Memory notes",
  brief: "Morning brief",
  query: "Business data lookups",
  classify: "Inbox triage",
};

const SECTIONS = [
  { id: "profile", label: "Profile", icon: ProfileIcon },
  { id: "riz", label: "Riz preferences", icon: PreferencesIcon },
  { id: "billing", label: "Billing", icon: BillingIcon },
  { id: "usage", label: "Usage", icon: UsageIcon },
  { id: "memory", label: "Memory", icon: MemoryIcon },
  { id: "account", label: "Account", icon: AccountIcon },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function SettingsClient({ email, name }: { email: string; name?: string }) {
  const [activeSection, setActiveSection] = useState<SectionId>("profile");

  const [source, setSource] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [honorific, setHonorific] = useState("");
  const [signatureName, setSignatureName] = useState(name ?? "");
  const [language, setLanguage] = useState("English");

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingRiz, setSavingRiz] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [rizMessage, setRizMessage] = useState<string | null>(null);

  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [chatCount, setChatCount] = useState(0);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [billingError, setBillingError] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancellingSubscription, setCancellingSubscription] = useState(false);
  const [cancelResult, setCancelResult] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [memories, setMemories] = useState<MemoryNote[]>([]);
  const [memoryLoading, setMemoryLoading] = useState(true);
  const [memoryMessage, setMemoryMessage] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function deleteAccount() {
    if (deleteConfirmation.trim().toLowerCase() !== email.trim().toLowerCase()) {
      setDeleteError("Type your account email exactly to confirm deletion.");
      return;
    }
    setDeletingAccount(true);
    setDeleteError(null);
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation: deleteConfirmation }),
      });
      const result = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        setDeleteError(result.message ?? "Account deletion did not complete. Please retry.");
        return;
      }
      clearLocalChatData();
      window.location.assign("/");
    } finally {
      setDeletingAccount(false);
    }
  }

  useEffect(() => {
    setChatCount(getSessions().length);

    fetch("/api/preferences")
      .then((response) => response.json())
      .then((data: { timezone?: string; honorific?: string; language?: string; avatarUrl?: string }) => {
        if (data.timezone) setTimezone(data.timezone);
        else {
          try { setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone); }
          catch { setTimezone("UTC"); }
        }
        if (data.honorific) setHonorific(data.honorific);
        if (data.language) setLanguage(data.language);
        if (data.avatarUrl) setAvatarUrl(data.avatarUrl);
      })
      .catch(() => {
        try { setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone); }
        catch { setTimezone("UTC"); }
      });

    fetch("/api/onboarding/status")
      .then((response) => response.json())
      .then((data: { onboarding?: OnboardingState }) => {
        if (data.onboarding) {
          setOnboarding(data.onboarding);
          if (data.onboarding.source) setSource(data.onboarding.source);
        }
      })
      .catch(() => undefined);

    fetch("/api/billing/status")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: BillingStatus) => setBilling(data))
      .catch(() => setBillingError(true));

    fetch("/api/usage")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Failed to load usage"))))
      .then((data: UsageSummary & { message?: string }) => {
        if (data.message && data.budgetUsd === undefined) throw new Error(data.message);
        setUsage(data);
        setUsageError(null);
      })
      .catch((error: unknown) => {
        setUsageError(error instanceof Error ? error.message : "Failed to load usage");
      })
      .finally(() => setUsageLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/memory")
      .then((response) => response.json())
      .then((data: { memories?: MemoryNote[] }) => setMemories(data.memories ?? []))
      .catch(() => setMemoryMessage("Could not load memory notes."))
      .finally(() => setMemoryLoading(false));
  }, []);

  async function cancelSubscription() {
    setCancellingSubscription(true);
    setCancelResult(null);
    try {
      const response = await fetch("/api/billing/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setCancelResult(
          data.error === "subscription_not_found"
            ? "No active subscription found to cancel."
            : "Could not cancel the subscription. Try again or contact support.",
        );
        return;
      }
      setCancelResult("Subscription cancelled. You keep access until the end of the paid period.");
      const status = await fetch("/api/billing/status");
      if (status.ok) setBilling((await status.json()) as BillingStatus);
    } catch {
      setCancelResult("Could not reach the billing service. Try again.");
    } finally {
      setCancellingSubscription(false);
      setConfirmingCancel(false);
    }
  }

  async function forgetMemory(id: string) {
    const response = await fetch(`/api/memory/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) {
      setMemoryMessage("Could not forget that memory.");
      return;
    }
    setMemories((current) => current.filter((memory) => memory.id !== id));
    setMemoryMessage("Memory removed.");
  }

  async function forgetAllMemories() {
    if (!window.confirm("Forget all long-term memory notes? This cannot be undone.")) return;
    const response = await fetch("/api/memory", { method: "DELETE" });
    if (!response.ok) {
      setMemoryMessage("Could not clear memory.");
      return;
    }
    setMemories([]);
    setMemoryMessage("All long-term memory removed.");
  }

  const displayName = name || email.split("@")[0];
  const initial = displayName.charAt(0).toUpperCase();
  const accountRows = useMemo(
    () => [
      { label: "Email", value: email },
      { label: "Workspace", value: "rizly workspace" },
      { label: "Local chat sessions", value: String(chatCount) },
      { label: "Onboarding", value: onboarding?.completedAt ? formatDate(onboarding.completedAt) : "In progress" },
    ],
    [chatCount, email, onboarding],
  );

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileMessage(null);

    try {
      const [progressResponse, timezoneResponse] = await Promise.all([
        fetch("/api/onboarding/progress", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ source }),
        }),
        fetch("/api/onboarding/timezone", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ timezone }),
        }),
      ]);

      if (!progressResponse.ok || !timezoneResponse.ok) {
        setProfileMessage("Could not save profile settings.");
        return;
      }
      setProfileMessage("Profile settings saved.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAvatarUpload(file: File) {
    if (!file.type.startsWith("image/")) return;
    setAvatarUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const canvas = document.createElement("canvas");
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          const size = 200;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d")!;
          const scale = Math.max(size / img.width, size / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
          URL.revokeObjectURL(objectUrl);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        img.onerror = reject;
        img.src = objectUrl;
      });

      const res = await fetch("/api/preferences/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ avatarUrl: dataUrl }),
      });
      if (res.ok) setAvatarUrl(dataUrl);
    } catch {
      // silently ignore — keep showing existing avatar
    } finally {
      setAvatarUploading(false);
    }
  }

  async function saveRizPreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingRiz(true);
    setRizMessage(null);

    const instructions = [
      honorific.trim() ? `Call me "${honorific.trim()}".` : "",
      signatureName.trim() ? `Sign my emails as "${signatureName.trim()}".` : "",
      language.trim() ? `Use ${language.trim()} as my default language unless I ask otherwise.` : "",
    ].filter(Boolean);

    if (instructions.length === 0) {
      setRizMessage("Add at least one preference to save.");
      setSavingRiz(false);
      return;
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: instructions.join(" ") }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok || data.error) {
        setRizMessage(data.error ?? "Could not save Riz preferences.");
        return;
      }
      setRizMessage("Riz preferences saved.");
    } finally {
      setSavingRiz(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200 px-6 py-5">
        <h1 className="text-[20px] font-semibold leading-tight tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-[15px] leading-6 text-slate-400">
          Account details, Riz behavior, billing, and workspace status.
        </p>
      </header>

      <div className="grid min-h-[calc(100vh-89px)] w-full gap-0 bg-white lg:grid-cols-[260px_1fr]">
        <nav className="border-b border-slate-200 bg-white p-3 lg:border-b-0 lg:border-r">
          <p className="mb-1 px-2.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Account settings
          </p>
          <div className="grid gap-0.5">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const active = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[15px] transition-colors ${
                    active
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-slate-600" : "text-slate-400"}`} />
                  {section.label}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="bg-white px-6 py-7">
          {activeSection === "profile" && (
            <SettingsPanel
              title="Profile"
              description="Identity and timing settings used across reminders, calendar work, and onboarding."
            >
              <div className="mb-7 flex items-center gap-3 border-b border-slate-200 pb-6">
                <button
                  type="button"
                  title="Change profile picture"
                  disabled={avatarUploading}
                  onClick={() => avatarInputRef.current?.click()}
                  className="group relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#FE7F2D] text-[17px] font-semibold text-white disabled:opacity-60"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    initial
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100 group-disabled:opacity-0">
                    {avatarUploading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <CameraIcon className="h-4 w-4 text-slate-900" />
                    )}
                  </span>
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleAvatarUpload(file);
                    e.target.value = "";
                  }}
                />
                <div className="min-w-0">
                  <p className="truncate text-[17px] font-semibold leading-tight text-slate-900">{displayName}</p>
                  <p className="mt-1 truncate text-[15px] text-slate-400">{email}</p>
                </div>
              </div>

              <form onSubmit={(event) => void saveProfile(event)}>
                <div className="grid gap-0 border-t border-slate-200">
                  <ReadOnlyRow label="Display name" value={name || "Not provided"} />
                  <ReadOnlyRow label="Email address" value={email} />
                  <FieldRow label="Timezone" help="Used for reminders, calendar checks, and morning briefs.">
                    <select
                      className="h-9 w-full max-w-sm border border-slate-200 bg-white px-3 text-[15px] text-slate-900 outline-none transition focus:border-slate-300"
                      value={TIMEZONES.some((t) => t.value === timezone) ? timezone : "__custom__"}
                      onChange={(event) => {
                        if (event.target.value !== "__custom__") setTimezone(event.target.value);
                      }}
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                      ))}
                      {!TIMEZONES.some((t) => t.value === timezone) && (
                        <option value="__custom__">{timezone}</option>
                      )}
                    </select>
                  </FieldRow>
                  <FieldRow label="How you found rizly" help="Helps keep onboarding and support context accurate.">
                    <select
                      className="h-9 w-full max-w-sm border border-slate-200 bg-slate-50 px-3 text-[15px] text-slate-900 outline-none transition focus:border-slate-300"
                      onChange={(event) => setSource(event.target.value)}
                      value={source}
                    >
                      <option value="">Select a source</option>
                      {SOURCE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </FieldRow>
                </div>

                <ActionFooter
                  saving={savingProfile}
                  message={profileMessage}
                  submitLabel="Save profile"
                  savingLabel="Saving..."
                />
              </form>
            </SettingsPanel>
          )}

          {activeSection === "riz" && (
            <SettingsPanel
              title="Riz preferences"
              description="Control how Riz addresses you, signs drafts, and chooses default language."
            >
              <form onSubmit={(event) => void saveRizPreferences(event)}>
                <div className="grid gap-0 border-t border-slate-200">
                  <FieldRow label="What Riz should call you" help="Example: Jagdeep, sir, boss, or your first name.">
                    <input
                      className="h-9 w-full max-w-sm border border-slate-200 bg-slate-50 px-3 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-slate-300"
                      onChange={(event) => setHonorific(event.target.value)}
                      placeholder="Jagdeep"
                      value={honorific}
                    />
                  </FieldRow>
                  <FieldRow label="Email signature name" help="Used when Riz drafts or sends email on your behalf.">
                    <input
                      className="h-9 w-full max-w-sm border border-slate-200 bg-slate-50 px-3 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-slate-300"
                      onChange={(event) => setSignatureName(event.target.value)}
                      placeholder={displayName}
                      value={signatureName}
                    />
                  </FieldRow>
                  <FieldRow label="Default language" help="Riz can still switch language when you ask in chat.">
                    <select
                      className="h-9 w-full max-w-sm border border-slate-200 bg-slate-50 px-3 text-[15px] text-slate-900 outline-none transition focus:border-slate-300"
                      onChange={(event) => setLanguage(event.target.value)}
                      value={language}
                    >
                      {LANGUAGE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </FieldRow>
                </div>

                <ActionFooter
                  saving={savingRiz}
                  message={rizMessage}
                  submitLabel="Save Riz preferences"
                  savingLabel="Saving..."
                />
              </form>
            </SettingsPanel>
          )}

          {activeSection === "billing" && (
            <SettingsPanel
              title="Billing"
              description="Current plan, subscription state, and billing actions."
            >
              {billingError ? (
                <p className="border border-red-500/20 bg-red-500/5 px-4 py-3 text-[15px] text-red-300">
                  Could not load billing status. Try refreshing.
                </p>
              ) : (
                <>
                  <div className="grid gap-0 border-t border-slate-200">
                    <ReadOnlyRow label="Current plan" value={billing?.plan?.name ?? "Loading..."} />
                    <ReadOnlyRow label="Subscription state" value={billing?.access?.state ?? "Loading..."} />
                    <ReadOnlyRow
                      label="Access expires"
                      value={billing?.access?.expiresAt ? formatDate(billing.access.expiresAt) : "No expiry on record"}
                    />
                  </div>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <a
                      className="inline-flex h-9 items-center justify-center bg-white px-4 text-[15px] font-medium text-slate-900 transition hover:brightness-105"
                      href="/pricing"
                    >
                      View plans
                    </a>
                    <a
                      className="inline-flex h-9 items-center justify-center border border-slate-200 bg-slate-50 px-4 text-[15px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                      href="/dashboard/usage"
                    >
                      View AI usage
                    </a>
                  </div>
                  {billing?.access?.active && billing.access.state !== "cancelled" ? (
                    <div className="mt-10 border-t border-red-200 pt-7">
                      <h3 className="text-[16px] font-semibold text-red-700">Cancel subscription</h3>
                      <p className="mt-2 max-w-2xl text-[14px] leading-6 text-slate-500">
                        Stops future renewals. You keep access until the end of the current billing
                        period, and no further charges are made.
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        {confirmingCancel ? (
                          <>
                            <button
                              type="button"
                              disabled={cancellingSubscription}
                              onClick={() => void cancelSubscription()}
                              className="inline-flex h-9 items-center justify-center bg-red-700 px-4 text-[14px] font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {cancellingSubscription ? "Cancelling..." : "Yes, cancel my subscription"}
                            </button>
                            <button
                              type="button"
                              disabled={cancellingSubscription}
                              onClick={() => setConfirmingCancel(false)}
                              className="inline-flex h-9 items-center justify-center border border-slate-200 bg-slate-50 px-4 text-[14px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                            >
                              Keep subscription
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmingCancel(true)}
                            className="inline-flex h-9 items-center justify-center border border-red-200 bg-white px-4 text-[14px] font-semibold text-red-700 transition hover:bg-red-50"
                          >
                            Cancel subscription
                          </button>
                        )}
                      </div>
                      {cancelResult ? <p className="mt-3 text-[14px] text-slate-600">{cancelResult}</p> : null}
                    </div>
                  ) : cancelResult ? (
                    <p className="mt-6 text-[14px] text-slate-600">{cancelResult}</p>
                  ) : null}
                </>
              )}
            </SettingsPanel>
          )}

          {activeSection === "usage" && (
            <SettingsPanel
              title="Usage"
              description="AI spend for this billing cycle, including feature-level cost breakdown."
            >
              <UsageSettingsView usage={usage} loading={usageLoading} error={usageError} />
            </SettingsPanel>
          )}

          {activeSection === "memory" && (
            <SettingsPanel
              title="Memory"
              description="Review and remove the long-term notes Riz may use in future conversations."
            >
              <div className="border-t border-slate-200">
                {memoryLoading ? (
                  <p className="py-4 text-[15px] text-slate-400">Loading memory...</p>
                ) : memories.length === 0 ? (
                  <p className="py-4 text-[15px] text-slate-400">No long-term memory notes.</p>
                ) : (
                  memories.map((memory) => (
                    <div key={memory.id} className="grid gap-3 border-b border-slate-200 py-4 md:grid-cols-[1fr_auto] md:items-center">
                      <div className="min-w-0">
                        <p className="break-words text-[15px] text-slate-900">{memory.summary}</p>
                        <p className="mt-1 text-[13px] text-slate-400">
                          {memory.metadata?.provenance ?? memory.source} · {memory.metadata?.confidence ?? "medium"} confidence · {formatDate(memory.createdAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void forgetMemory(memory.id)}
                        className="h-9 border border-slate-200 px-3 text-[14px] font-medium text-slate-600 transition hover:border-red-200 hover:text-red-600"
                      >
                        Forget
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  disabled={memories.length === 0}
                  onClick={() => void forgetAllMemories()}
                  className="h-9 border border-red-200 px-4 text-[14px] font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Forget all memory
                </button>
                {memoryMessage && <p className="text-[14px] text-slate-500">{memoryMessage}</p>}
              </div>
            </SettingsPanel>
          )}

          {activeSection === "account" && (
            <SettingsPanel
              title="Account"
              description="Workspace readiness and browser-local session information."
            >
              <div className="grid gap-0 border-t border-slate-200">
                {accountRows.map((row) => (
                  <ReadOnlyRow key={row.label} label={row.label} value={row.value} />
                ))}
                <StatusRow label="Google Gmail + Calendar" connected={Boolean(onboarding?.googleConnected)} />
                <StatusRow label="Telegram" connected={Boolean(onboarding?.telegramLinked)} />
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <a
                  className="inline-flex h-9 items-center justify-center border border-slate-200 bg-slate-50 px-4 text-[15px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                  href="/dashboard/connectors"
                >
                  Manage connectors
                </a>
                <a
                  className="inline-flex h-9 items-center justify-center border border-slate-200 bg-slate-50 px-4 text-[15px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                  href="/dashboard/telegram"
                >
                  Manage Telegram
                </a>
              </div>

              <div className="mt-10 border-t border-red-200 pt-7">
                <h3 className="text-[16px] font-semibold text-red-700">Delete account</h3>
                <p className="mt-2 max-w-2xl text-[14px] leading-6 text-slate-500">
                  This cancels an active subscription, disconnects every integration, removes queued
                  work, and deletes your account data. Accounting records that must be retained are
                  anonymized. This cannot be undone.
                </p>
                <label className="mt-5 block max-w-md text-[14px] font-medium text-slate-700">
                  Type {email} to confirm
                  <input
                    className="mt-2 h-10 w-full border border-red-200 bg-white px-3 text-[15px] text-slate-900 outline-none focus:border-red-400"
                    value={deleteConfirmation}
                    onChange={(event) => setDeleteConfirmation(event.target.value)}
                    autoComplete="off"
                  />
                </label>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={deletingAccount || deleteConfirmation.trim().toLowerCase() !== email.trim().toLowerCase()}
                    onClick={() => void deleteAccount()}
                    className="inline-flex h-9 items-center justify-center bg-red-700 px-4 text-[14px] font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {deletingAccount ? "Deleting..." : "Permanently delete account"}
                  </button>
                  <a href="/privacy#retention-deletion" className="text-[14px] text-slate-500 underline underline-offset-2 hover:text-slate-900">
                    Retention and deletion policy
                  </a>
                </div>
                {deleteError ? <p className="mt-3 text-[14px] text-red-700">{deleteError}</p> : null}
              </div>
            </SettingsPanel>
          )}
        </div>
      </div>
    </main>
  );
}

function SettingsPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="w-full">
      <div className="mb-7">
        <h2 className="text-[18px] font-semibold leading-tight text-slate-900">{title}</h2>
        <p className="mt-1 max-w-3xl text-[15px] leading-6 text-slate-400">{description}</p>
      </div>
      {children}
    </section>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2 border-b border-slate-200 py-4 md:grid-cols-[260px_1fr]">
      <p className="text-[15px] font-medium text-slate-400">{label}</p>
      <p className="min-w-0 break-words text-[15px] text-slate-900">{value}</p>
    </div>
  );
}

function FieldRow({
  label,
  help,
  children,
}: {
  label: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-3 border-b border-slate-200 py-4 md:grid-cols-[260px_1fr]">
      <span>
        <span className="block text-[15px] font-medium text-slate-600">{label}</span>
        <span className="mt-1 block max-w-sm text-[13px] leading-5 text-slate-400">{help}</span>
      </span>
      <span>{children}</span>
    </label>
  );
}

function StatusRow({ label, connected }: { label: string; connected: boolean }) {
  return (
    <div className="grid gap-2 border-b border-slate-200 py-4 md:grid-cols-[260px_1fr]">
      <p className="text-[15px] font-medium text-slate-400">{label}</p>
      <p className={connected ? "text-[15px] text-emerald-300" : "text-[15px] text-slate-400"}>
        {connected ? "Connected" : "Not connected"}
      </p>
    </div>
  );
}

function UsageSettingsView({
  usage,
  loading,
  error,
}: {
  usage: UsageSummary | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return <p className="border-t border-slate-200 py-4 text-[15px] text-slate-400">Loading usage...</p>;
  }

  if (error) {
    return (
      <p className="border border-red-500/20 bg-red-500/5 px-4 py-3 text-[15px] text-red-300">
        {error}
      </p>
    );
  }

  if (!usage) return null;

  const unlimited = !Number.isFinite(usage.budgetUsd);
  const percent = Math.min(100, Math.round(usage.ratio * 100));
  const barColor =
    usage.state === "exceeded" ? "bg-red-500" : usage.state === "warn" ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div>
      <div className="grid gap-0 border-t border-slate-200">
        <ReadOnlyRow label="Cycle started" value={formatDate(usage.cycleStart)} />
        <ReadOnlyRow label="AI spend" value={`$${usage.spendUsd.toFixed(2)}`} />
        <ReadOnlyRow label="Budget" value={unlimited ? "No budget cap" : `$${usage.budgetUsd.toFixed(2)}`} />
        <ReadOnlyRow label="State" value={usage.state} />
      </div>

      {!unlimited ? (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between gap-4 text-[15px]">
            <span className="text-slate-400">Budget used</span>
            <span className="font-medium text-slate-900">{percent}%</span>
          </div>
          <div className="h-2 w-full bg-white/[0.08]">
            <div className={`h-full ${barColor}`} style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 max-w-3xl text-[13px] leading-5 text-slate-400">
            {usage.state === "exceeded"
              ? "Budget used up. Background features pause until the next billing cycle."
              : usage.state === "warn"
                ? "Approaching budget. Background features will pause once the budget is used."
                : "Usage is within the current plan budget."}
          </p>
        </div>
      ) : null}

      <div className="mt-8">
        <div className="mb-2 flex items-center justify-between gap-4">
          <h3 className="text-[15px] font-semibold text-slate-900">By feature</h3>
          <a className="text-[15px] font-medium text-slate-400 transition hover:text-slate-900" href="/dashboard/usage">
            Detailed usage
          </a>
        </div>
        <div className="border-t border-slate-200">
          {usage.breakdown.length === 0 ? (
            <p className="border-b border-slate-200 py-4 text-[15px] text-slate-400">
              No AI usage recorded yet this cycle.
            </p>
          ) : (
            usage.breakdown.map((row) => (
              <div
                key={row.task}
                className="grid gap-2 border-b border-slate-200 py-4 md:grid-cols-[1fr_120px_120px]"
              >
                <p className="text-[15px] font-medium text-slate-900">{TASK_LABELS[row.task] ?? row.task}</p>
                <p className="text-[15px] text-slate-400">
                  {row.calls} call{row.calls === 1 ? "" : "s"}
                </p>
                <p className="text-[15px] font-medium text-slate-900 md:text-right">${row.costUsd.toFixed(2)}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ActionFooter({
  saving,
  message,
  submitLabel,
  savingLabel,
}: {
  saving: boolean;
  message: string | null;
  submitLabel: string;
  savingLabel: string;
}) {
  const isError = message?.toLowerCase().includes("could not") || message?.toLowerCase().includes("add at least");

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <button
        className="inline-flex h-9 items-center justify-center bg-white px-4 text-[15px] font-medium text-slate-900 transition hover:brightness-105 disabled:opacity-50"
        disabled={saving}
        type="submit"
      >
        {saving ? savingLabel : submitLabel}
      </button>
      {message ? (
        <span className={`text-[15px] ${isError ? "text-red-300" : "text-emerald-300"}`}>
          {message}
        </span>
      ) : null}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

type IconProps = { className?: string };

function ProfileIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <circle cx="8" cy="5.2" r="2.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.8 13.2c.6-2.4 2.7-3.7 5.2-3.7s4.6 1.3 5.2 3.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function PreferencesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M3 4.5h10M3 8h10M3 11.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="6" cy="4.5" r="1.3" fill="currentColor" />
      <circle cx="11" cy="8" r="1.3" fill="currentColor" />
      <circle cx="7.5" cy="11.5" r="1.3" fill="currentColor" />
    </svg>
  );
}

function BillingIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <rect x="2" y="4" width="12" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2 6.7h12" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function UsageIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M3 13.5V8M7 13.5V4M11 13.5V9.5M3 13.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MemoryIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M5 3.2A2.2 2.2 0 0 1 9 2.7a2.2 2.2 0 0 1 2.7 2.8A2.3 2.3 0 0 1 12 10a2.2 2.2 0 0 1-3 2.8A2.2 2.2 0 0 1 5 12.3a2.2 2.2 0 0 1-1-4.1A2.2 2.2 0 0 1 5 3.2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8 3v10M5.2 6.2c1 .1 1.7.6 2.1 1.4M10.8 8.7c-1 .1-1.7.6-2.1 1.4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function AccountIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M8 2.2 13 4.4v3.8c0 3-2 4.9-5 5.7-3-.8-5-2.7-5-5.7V4.4l5-2.2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="m5.8 8 1.4 1.4 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CameraIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M2.5 7.5A1.5 1.5 0 0 1 4 6h.5l1-2h9l1 2H16a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5v-7Z" />
      <circle cx="10" cy="11" r="2.5" />
    </svg>
  );
}
