"use client";

import { useEffect, useState } from "react";
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  CalendarIcon,
  DiscordIcon,
  GmailIcon,
  NotionIcon,
  SlackIcon,
  StripeIcon,
  TelegramIcon,
} from "../ConnectorIcons";

const modes = ["Proactive", "Automations", "Priority inbox"] as const;
const AUTOPLAY_MS = 8000;

const modeHeadlines: Record<(typeof modes)[number], string> = {
  Proactive: "Rizly, the operator that thinks ahead",
  Automations: "Automations that build themselves",
  "Priority inbox": "Your inbox, sorted and ready to act on",
};

// Mirrors CATEGORY_COLORS in app/dashboard/emails/emails-client.tsx — same
// palette as the real dashboard so this demo doesn't invent its own scheme.
const emails = [
  { sender: "Oxymon", subject: "Meeting confirmation", category: "Meeting request", color: "bg-blue-50 text-blue-700 border-blue-200", due: "9:30 AM", urgent: true },
  { sender: "Aster Labs", subject: "Renewal proposal", category: "Investor update", color: "bg-violet-50 text-violet-700 border-violet-200", due: "Today", urgent: true },
  { sender: "Stripe", subject: "Failed payment · invoice 4471", category: "Payment due", color: "bg-red-50 text-red-700 border-red-200", due: "Today", urgent: false },
  { sender: "Lena Harper", subject: "Q1 forecast review", category: "Follow up needed", color: "bg-amber-50 text-amber-700 border-amber-200", due: "Tomorrow", urgent: false },
  { sender: "People Ops", subject: "Onboarding · Alex R.", category: "General", color: "bg-slate-100 text-slate-600 border-slate-300", due: "Jun 2", urgent: false },
];

export function HeroOperatorCanvas() {
  const [activeMode, setActiveMode] = useState<(typeof modes)[number]>("Proactive");
  const [builtSteps, setBuiltSteps] = useState(1);

  useEffect(() => {
    if (activeMode !== "Automations") {
      setBuiltSteps(1);
      return;
    }
    setBuiltSteps(1);
    const timers = [2, 3, 4].map((step, index) =>
      window.setTimeout(() => setBuiltSteps(step), (index + 1) * 900),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [activeMode]);

  // Autoplay, like the reference carousel: each tab's progress bar fills over
  // AUTOPLAY_MS, then advances to the next tab. Clicking a tab (which changes
  // activeMode) restarts this effect and the bar for the newly-selected tab.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const index = modes.indexOf(activeMode);
      setActiveMode(modes[(index + 1) % modes.length]);
    }, AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [activeMode]);

  return (
    <div className="relative">
      <div className="mb-0 overflow-x-auto" role="tablist" aria-label="Product preview" style={{ scrollbarWidth: "none" }}>
        <div className="flex w-fit overflow-hidden rounded-none border border-b-0 border-black/70">
          {modes.map((mode, i) => {
            const selected = activeMode === mode;
            return (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveMode(mode)}
                className={`relative -ml-px overflow-hidden border border-[#233D4D]/10 bg-white px-4 py-4 text-left outline-none transition-colors duration-200 first:ml-0 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FE7F2D] ${
                  selected ? "z-10 text-black" : "text-black/50 hover:text-black/75"
                }`}
              >
                <span className="flex items-baseline gap-2 sm:hidden">
                  <span className="font-mono text-xs text-[#FE7F2D]">{String(i + 1).padStart(2, "0")}</span>
                  <span className="truncate text-base font-normal">
                    {mode === "Automations" ? "Automate" : mode === "Priority inbox" ? "Inbox" : mode}
                  </span>
                </span>
                <span className="hidden items-baseline gap-2 sm:flex">
                  <span className="shrink-0 font-mono text-xs text-[#FE7F2D]">{String(i + 1).padStart(2, "0")}</span>
                  <span className="block whitespace-nowrap text-base sm:text-lg">{modeHeadlines[mode]}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-[652px] overflow-hidden rounded-none border border-black/70 bg-gradient-to-br from-black via-[#233D4D] to-[#D9BEF4]/30 p-16">
        <div className="hero-preview-light min-h-[620px] overflow-hidden rounded-md bg-white shadow-[0_42px_110px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.9)]">
          {activeMode === "Proactive" && <ProactiveWorkspace />}
          {activeMode === "Automations" && <AutomationWorkspace builtSteps={builtSteps} />}
          {activeMode === "Priority inbox" && <PriorityWorkspace />}
        </div>
      </div>
    </div>
  );
}

function ProactiveWorkspace() {
  return (
    <section className="relative min-h-[620px] overflow-hidden">
      <div className="absolute inset-x-0 bottom-10 top-0 opacity-45 [background-image:radial-gradient(rgba(22,24,21,0.18)_0.7px,transparent_0.7px)] [background-size:18px_18px]" />

      <div className="relative hidden h-[530px] md:block">
        <ReactFlow
          nodes={proactiveNodes}
          edges={proactiveEdges}
          nodeTypes={proactiveNodeTypes}
          fitView
          fitViewOptions={{ padding: 0.12, minZoom: 0.72, maxZoom: 1 }}
          minZoom={0.72}
          maxZoom={1}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          proOptions={{ hideAttribution: true }}
          aria-label="Rizly proactive meeting importance workflow"
        >
          <Background color="rgba(22,24,21,0.14)" gap={18} size={1} />
        </ReactFlow>
      </div>

      <div className="relative flex flex-col items-center px-4 py-7 md:hidden">
        <div className="w-full max-w-lg">
          <FlowNode eyebrow="Trigger" title="Meeting starts soon" detail="Oxymon · in 5 minutes" icon={<CalendarIcon className="h-5 w-5" />} active />
        </div>
        <VerticalConnector active />
        <div className="w-full max-w-lg">
          <FlowNode eyebrow="Rizly AI" title="Analyze importance" detail="Context · urgency · people" icon={<PixelRiz />} active />
        </div>
        <VerticalConnector active />
        <div className="rounded-xl border border-[#D9BEF4]/65 bg-[#171512] px-6 py-3 text-center">
          <p className="font-mono text-[8px] uppercase tracking-[0.13em] text-[#D9BEF4]">Decision</p>
          <p className="mt-1 text-sm text-[#ece9e2]">Is this important?</p>
        </div>
        <VerticalConnector active />
        <p className="mb-2 font-mono text-[8px] uppercase tracking-[0.12em] text-[#233D4D]">Yes · notify in parallel</p>
        <div className="grid w-full max-w-lg grid-cols-2 gap-2">
          <FlowNode eyebrow="Slack" title="Send DM" detail="Instantly" icon={<SlackIcon className="h-5 w-5" />} success />
          <FlowNode eyebrow="Telegram" title="Send DM" detail="Instantly" icon={<TelegramIcon className="h-5 w-5" />} success />
        </div>
        <div className="mt-3 w-full max-w-lg rounded-xl border border-white/10 bg-[#101210] px-4 py-3 text-center">
          <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-white/25">No · quiet path</p>
          <p className="mt-1 text-xs text-white/55">Don&apos;t disturb my boss · haha</p>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex h-10 items-center justify-center border-t border-white/8 bg-[#0b0d0c]/95 px-4 text-center font-mono text-[8px] uppercase tracking-[0.13em] text-white/25">
        Rizly checks context before sending anything · quiet by default
      </div>
    </section>
  );
}

type ProactiveNodeData = {
  eyebrow: string;
  title: string;
  detail: string;
  icon: "calendar" | "rizly" | "decision" | "slack" | "telegram" | "quiet";
  tone: "accent" | "green" | "muted";
};

type ProactiveNode = Node<ProactiveNodeData, "proactive">;

const proactiveNodes: ProactiveNode[] = [
  {
    id: "meeting",
    type: "proactive",
    position: { x: 0, y: 170 },
    data: { eyebrow: "Trigger", title: "Meeting starts soon", detail: "Oxymon · in 5 minutes", icon: "calendar", tone: "accent" },
  },
  {
    id: "rizly",
    type: "proactive",
    position: { x: 270, y: 170 },
    data: { eyebrow: "Rizly AI", title: "Analyze importance", detail: "Context · urgency · people", icon: "rizly", tone: "accent" },
  },
  {
    id: "decision",
    type: "proactive",
    position: { x: 540, y: 170 },
    data: { eyebrow: "Decision", title: "Is this important?", detail: "Route by urgency", icon: "decision", tone: "accent" },
  },
  {
    id: "slack",
    type: "proactive",
    position: { x: 835, y: 70 },
    data: { eyebrow: "Yes · direct message", title: "Notify in Slack", detail: "Private DM · instantly", icon: "slack", tone: "green" },
  },
  {
    id: "telegram",
    type: "proactive",
    position: { x: 835, y: 270 },
    data: { eyebrow: "Yes · direct message", title: "Send Telegram DM", detail: "Private chat · instantly", icon: "telegram", tone: "green" },
  },
  {
    id: "quiet",
    type: "proactive",
    position: { x: 540, y: 365 },
    data: { eyebrow: "No · quiet path", title: "Don’t disturb my boss", detail: "No notification sent · haha", icon: "quiet", tone: "muted" },
  },
];

const proactiveEdges: Edge[] = [
  { id: "meeting-rizly", source: "meeting", target: "rizly", type: "smoothstep", animated: true, style: { stroke: "#D9BEF4", strokeWidth: 1.5 } },
  { id: "rizly-decision", source: "rizly", target: "decision", type: "smoothstep", animated: true, style: { stroke: "#D9BEF4", strokeWidth: 1.5 } },
  { id: "decision-slack", source: "decision", sourceHandle: "yes", target: "slack", type: "smoothstep", animated: true, label: "YES", labelStyle: { fill: "#233D4D", fontSize: 9 }, labelBgStyle: { fill: "#EAECF0" }, style: { stroke: "#233D4D", strokeWidth: 1.5 } },
  { id: "decision-telegram", source: "decision", sourceHandle: "yes", target: "telegram", type: "smoothstep", animated: true, style: { stroke: "#233D4D", strokeWidth: 1.5 } },
  { id: "decision-quiet", source: "decision", sourceHandle: "no", target: "quiet", targetHandle: "top", type: "smoothstep", label: "NO", labelStyle: { fill: "rgba(22,24,21,0.48)", fontSize: 9 }, labelBgStyle: { fill: "#EAECF0" }, style: { stroke: "rgba(22,24,21,0.24)", strokeWidth: 1.25 } },
];

const proactiveNodeTypes = { proactive: ProactiveCanvasNode };

function ProactiveCanvasNode({ id, data }: NodeProps<ProactiveNode>) {
  const success = data.tone === "green";
  const muted = data.tone === "muted";
  const Icon = data.icon === "calendar" ? CalendarIcon : data.icon === "slack" ? SlackIcon : data.icon === "telegram" ? TelegramIcon : null;

  return (
    <div className={`relative w-[210px] rounded-xl border bg-[#141614] p-3 shadow-[0_16px_38px_rgba(0,0,0,0.25)] ${
      success ? "border-[#233D4D]/55" : muted ? "border-white/12" : "border-[#D9BEF4]/55"
    }`}>
      {id !== "meeting" && id !== "quiet" && (
        <Handle
          type="target"
          position={Position.Left}
          className={`!h-2 !w-2 !border-2 !border-[#0a0c0b] ${success ? "!bg-[#233D4D]" : "!bg-[#D9BEF4]"}`}
        />
      )}
      {(id === "meeting" || id === "rizly" || id === "decision") && (
        <Handle
          id="yes"
          type="source"
          position={Position.Right}
          className={`!h-2 !w-2 !border-2 !border-[#0a0c0b] ${id === "decision" ? "!bg-[#233D4D]" : "!bg-[#D9BEF4]"}`}
        />
      )}
      {data.icon === "decision" && (
        <Handle id="no" type="source" position={Position.Bottom} className="!h-2 !w-2 !border-2 !border-[#0a0c0b] !bg-white/35" />
      )}
      {data.icon === "quiet" && (
        <Handle id="top" type="target" position={Position.Top} className="!h-2 !w-2 !border-2 !border-[#0a0c0b] !bg-white/35" />
      )}
      <span className={`absolute left-0 top-3 h-[calc(100%-1.5rem)] w-0.5 rounded-full ${
        success ? "bg-[#233D4D]" : muted ? "bg-white/20" : "bg-[#D9BEF4]"
      }`} />
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/25">
          {Icon ? <Icon className="h-5 w-5" /> : data.icon === "rizly" ? <PixelRiz /> : data.icon === "decision" ? "?" : "—"}
        </span>
        <span className="min-w-0">
          <span className={`block font-mono text-[8px] uppercase tracking-[0.13em] ${
            success ? "text-[#233D4D]" : muted ? "text-white/30" : "text-[#D9BEF4]"
          }`}>{data.eyebrow}</span>
          <span className="mt-1 block truncate text-xs text-[#e4e1da]">{data.title}</span>
          <span className="mt-1 block truncate text-[9px] text-white/30">{data.detail}</span>
        </span>
      </div>
    </div>
  );
}

function FlowNode({
  eyebrow,
  title,
  detail,
  icon,
  active = false,
  success = false,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  icon: React.ReactNode;
  active?: boolean;
  success?: boolean;
}) {
  return (
    <article
      className={`relative overflow-hidden rounded-xl border bg-[#141614] p-3 shadow-[0_12px_32px_rgba(0,0,0,0.16)] ${
        success ? "border-[#233D4D]/50" : active ? "border-[#D9BEF4]/55" : "border-white/14"
      }`}
    >
      <span className={`absolute left-0 top-0 h-full w-0.5 ${success ? "bg-[#233D4D]" : "bg-[#D9BEF4]"}`} />
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/25">{icon}</span>
        <span className="min-w-0">
          <span className={`block font-mono text-[8px] uppercase tracking-[0.13em] ${success ? "text-[#233D4D]" : "text-[#D9BEF4]"}`}>
            {eyebrow}
          </span>
          <span className="mt-1 block truncate text-xs font-medium text-[#e4e1da]">{title}</span>
          <span className="mt-1 block truncate text-[9px] text-white/30">{detail}</span>
        </span>
      </div>
      {(active || success) && (
        <span className={`absolute right-2 top-2 h-1.5 w-1.5 animate-pulse ${success ? "bg-[#233D4D]" : "bg-[#D9BEF4]"}`} />
      )}
    </article>
  );
}

function VerticalConnector({ active = false }: { active?: boolean }) {
  return <span className={`h-5 w-px ${active ? "bg-[#D9BEF4]/55" : "bg-white/12"}`} />;
}

function AutomationWorkspace({ builtSteps }: { builtSteps: number }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerView, setPickerView] = useState<"apps" | "events">("apps");
  const [selectedApp, setSelectedApp] = useState("Schedule");
  const [selectedStep, setSelectedStep] = useState<number | null>(0);
  const steps = [
    { app: "Schedule", title: "Every weekday at 8:30 AM", detail: "Runs Monday through Friday in your timezone", icon: <CalendarIcon className="h-[18px] w-[18px]" /> },
    { app: "Gmail", title: "Find unread priority emails", detail: "Collect starred and important messages from the last 24 hours", icon: <GmailIcon className="h-[18px] w-[18px]" /> },
    { app: "Rizly AI", title: "Build my daily priority briefing", detail: "Rank urgent work, summarize context and suggest next actions", icon: <PixelRiz /> },
    { app: "Slack + Telegram", title: "Send the briefing privately", detail: "Deliver one concise briefing to both direct messages", icon: <SlackIcon className="h-[18px] w-[18px]" /> },
  ];

  return (
    <section className="flex min-h-[620px] flex-col overflow-hidden bg-[#EAECF0] text-slate-900">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="text-[13px] text-slate-400">Automations</span>
            <span className="text-slate-300">/</span>
            <span className="truncate text-[14px] font-medium text-slate-900">Daily priority briefing</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-[11px] text-slate-400 md:block">Saved</span>
            <button
              type="button"
              onClick={() => {
                setPickerView("apps");
                setPickerOpen(true);
              }}
              className="hidden rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-600 sm:block"
            >
              + Add step
            </button>
            <button type="button" className="hidden rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-600 sm:block">
              Test
            </button>
            <button type="button" className="hero-preview-accent-button rounded-md bg-[#D9BEF4] px-3 py-1.5 text-[11px] text-[#233D4D] shadow-sm">
              Publish
            </button>
          </div>
        </header>

        <div className="flex h-8 shrink-0 items-center justify-between border-b border-slate-200 bg-[#EAECF0] px-4 text-[10px] text-slate-400">
          <span>Draft · Last edited just now</span>
          <span className="text-[#233D4D]">{builtSteps}/4 configured</span>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(#d8d5ce_1.1px,transparent_1.1px)] [background-size:20px_20px]" />

          <div className="relative flex h-[540px] w-full flex-col items-center px-5 py-7 sm:pr-[390px]">
          {steps.map((step, index) => {
            const visible = index < builtSteps;
            return (
              <div key={step.title} className="contents">
                {index > 0 && (
                  <span className={`relative h-5 w-px bg-slate-300 transition-opacity ${visible ? "opacity-100" : "opacity-0"}`}>
                    <span className="absolute left-1/2 top-1/2 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded bg-[#EAECF0] text-[12px] text-slate-400">+</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedStep(index)}
                  className={`w-full max-w-[340px] rounded-[10px] border-2 bg-white px-4 pb-3 pt-2.5 text-left shadow-sm transition-[opacity,transform,border-color] duration-500 ${
                    visible
                      ? `translate-y-0 opacity-100 ${selectedStep === index ? "border-[#D9BEF4]" : "border-slate-200 hover:border-slate-300"}`
                      : "pointer-events-none translate-y-4 border-slate-100 opacity-0"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      {step.icon}
                      <span className="text-[11px] font-medium text-slate-700">{step.app}</span>
                    </span>
                    <span className="text-sm text-slate-300">•••</span>
                  </div>
                  <p className="mt-2 text-[13px] text-slate-900">
                    <span className="font-medium">{index + 1}. </span>{step.title}
                  </p>
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-[9px] text-slate-400">{step.detail}</p>
                    {index === 3 && visible && (
                      <span className="flex gap-1">
                        {[TelegramIcon, SlackIcon, DiscordIcon].map((Icon, iconIndex) => (
                          <span key={iconIndex} className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 bg-white">
                            <Icon className="h-3 w-3" />
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
            <span className={`mt-5 text-[10px] text-[#233D4D] transition-opacity ${builtSteps === 4 ? "opacity-100" : "opacity-0"}`}>
              Workflow ready to test
            </span>
          </div>

          {selectedStep !== null && (
            <aside className="absolute bottom-3 right-3 top-3 z-20 flex w-[min(370px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(44,42,38,0.2)]">
              <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-100 px-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EAECF0]">
                    {steps[selectedStep].icon}
                  </span>
                  <span className="truncate text-[13px] font-medium text-slate-900">
                    {selectedStep + 1}. {steps[selectedStep].title}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStep(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close step settings"
                >
                  ×
                </button>
              </div>

              <div className="flex shrink-0 gap-6 border-b border-slate-100 px-4">
                <button type="button" className="-mb-px border-b-2 border-[#D9BEF4] py-3 text-[12px] font-medium text-slate-900">
                  Setup
                </button>
                <button type="button" className="py-3 text-[12px] text-slate-400">
                  Runs
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <label className="block text-[10px] font-medium text-slate-500">
                  App <span className="text-[#D9BEF4]">*</span>
                </label>
                <div className="mt-1.5 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <span className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAECF0]">
                      {steps[selectedStep].icon}
                    </span>
                    <span className="text-[12px] font-medium text-slate-900">{steps[selectedStep].app}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPickerView("apps");
                      setPickerOpen(true);
                    }}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] text-slate-600 hover:bg-slate-50"
                  >
                    Change
                  </button>
                </div>

                <label className="mt-4 block text-[10px] font-medium text-slate-500">
                  Event <span className="text-[#D9BEF4]">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedApp(steps[selectedStep].app);
                    setPickerView("events");
                    setPickerOpen(true);
                  }}
                  className="mt-1.5 flex h-10 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-left text-[11px] text-slate-800 hover:border-slate-300"
                >
                  <span>{steps[selectedStep].title}</span>
                  <span className="text-slate-400">⌄</span>
                </button>

                <label className="mt-4 block text-[10px] font-medium text-slate-500">Connected account</label>
                <div className="mt-1.5 flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
                  <span className="flex items-center gap-2 text-[11px] text-slate-700">
                    <span className="h-2 w-2 rounded-full bg-[#233D4D]" />
                    workspace@rizly.ai
                  </span>
                  <span className="text-[9px] text-slate-400">Connected</span>
                </div>

                <label className="mt-4 block text-[10px] font-medium text-slate-500">Step details</label>
                <div className="mt-1.5 rounded-lg border border-slate-200 bg-[#EAECF0] px-3 py-3 text-[10px] leading-4 text-slate-500">
                  {steps[selectedStep].detail}
                </div>
              </div>

              <div className="shrink-0 border-t border-slate-100 bg-slate-50/70 p-3">
                <button
                  type="button"
                  onClick={() => setSelectedStep(null)}
                  className="hero-preview-accent-button h-10 w-full rounded-lg bg-[#D9BEF4] text-[12px] font-medium text-[#233D4D] shadow-sm"
                >
                  Continue
                </button>
              </div>
            </aside>
          )}

          {pickerOpen && (
            <AutomationPickerDialog
              view={pickerView}
              selectedApp={selectedApp}
              onBack={() => setPickerView("apps")}
              onClose={() => setPickerOpen(false)}
              onSelectApp={(app) => {
                setSelectedApp(app);
                setPickerView("events");
              }}
              onSelectEvent={() => setPickerOpen(false)}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function AutomationPickerDialog({
  view,
  selectedApp,
  onBack,
  onClose,
  onSelectApp,
  onSelectEvent,
}: {
  view: "apps" | "events";
  selectedApp: string;
  onBack: () => void;
  onClose: () => void;
  onSelectApp: (app: string) => void;
  onSelectEvent: () => void;
}) {
  const apps = [
    { name: "Gmail", category: "Communication", Icon: GmailIcon },
    { name: "Slack", category: "Communication", Icon: SlackIcon },
    { name: "Telegram", category: "Communication", Icon: TelegramIcon },
    { name: "Discord", category: "Communication", Icon: DiscordIcon },
    { name: "Notion", category: "Productivity", Icon: NotionIcon },
    { name: "Stripe", category: "Finance", Icon: StripeIcon },
  ];
  const events =
    selectedApp === "Gmail"
      ? [
          ["New email received", "Runs when a new message reaches the inbox"],
          ["New labeled email", "Runs when a label is applied"],
          ["Send an email", "Sends a prepared email from your account"],
          ["Create a draft", "Creates a draft for review"],
        ]
      : [
          [`New ${selectedApp} message`, "Runs when a new message is received"],
          [`Send ${selectedApp} message`, "Sends a message to a channel or person"],
          ["Message contains keyword", "Continues when selected words appear"],
        ];

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#343630]/20 p-3 backdrop-blur-[1.5px]">
      <section className="flex max-h-[470px] w-full max-w-[660px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_28px_80px_rgba(40,38,34,0.24)]">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <div className="flex items-center gap-2.5">
            {view === "events" && (
              <button type="button" onClick={onBack} className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100" aria-label="Back to apps">
                ←
              </button>
            )}
            <div>
              <p className="text-[14px] font-medium text-slate-900">{view === "apps" ? "Choose an app" : `Choose a ${selectedApp} event`}</p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                {view === "apps" ? "Select what this automation should connect to." : "Choose what should happen at this step."}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close picker">
            ×
          </button>
        </header>

        <div className="shrink-0 border-b border-slate-100 p-2.5">
          <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-slate-400" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
            <input
              aria-label={view === "apps" ? "Search apps" : "Search events"}
              placeholder={view === "apps" ? "Search apps" : "Search events"}
              className="w-full bg-transparent text-[12px] text-slate-800 outline-none placeholder:text-slate-400"
            />
          </label>
        </div>

        {view === "apps" ? (
          <div className="flex min-h-0 flex-1">
            <nav className="hidden w-40 shrink-0 border-r border-slate-100 bg-[#EAECF0] p-2 sm:block">
              {[
                ["All apps", "18"],
                ["Communication", "7"],
                ["Productivity", "5"],
                ["Finance", "3"],
                ["AI & logic", "3"],
              ].map(([label, count], index) => (
                <button
                  key={label}
                  type="button"
                  className={`mb-0.5 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[11px] ${
                    index === 0 ? "bg-[#D9BEF4]/10 text-[#233D4D]" : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  <span>{label}</span>
                  <span className="text-[9px] text-slate-400">{count}</span>
                </button>
              ))}
            </nav>
            <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
              <p className="mb-2 text-[9px] uppercase tracking-[0.12em] text-slate-400">Popular apps</p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {apps.map(({ name, category, Icon }) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => onSelectApp(name)}
                    className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition hover:border-slate-200 hover:bg-[#EAECF0]"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-100 bg-white shadow-sm">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-[12px] font-medium text-slate-800">{name}</span>
                      <span className="block text-[9px] text-slate-400">{category}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
            {events.map(([name, description], index) => (
              <button
                key={name}
                type="button"
                onClick={onSelectEvent}
                className="flex w-full items-start gap-3 rounded-lg border border-transparent px-3 py-3 text-left transition hover:border-slate-200 hover:bg-[#EAECF0]"
              >
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[9px] ${
                  index === 0 ? "border-[#D9BEF4] bg-[#D9BEF4]/10 text-[#233D4D]" : "border-slate-200 text-slate-400"
                }`}>
                  {index + 1}
                </span>
                <span>
                  <span className="block text-[12px] font-medium text-slate-800">{name}</span>
                  <span className="mt-0.5 block text-[10px] text-slate-400">{description}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PriorityWorkspace() {
  return (
    <section className="min-h-[620px] bg-white">
      <div className="hidden border-b border-slate-200 bg-white text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 sm:grid sm:grid-cols-[1.4fr_2fr_1fr_.8fr]">
        <span className="px-4 py-3">Sender</span>
        <span className="px-4 py-3">Subject</span>
        <span className="px-4 py-3">Category</span>
        <span className="px-4 py-3 text-right">Due</span>
      </div>
      {emails.map((email) => {
        const initials = email.sender.charAt(0).toUpperCase();
        return (
          <div
            key={email.subject}
            className="grid grid-cols-1 gap-2 border-t border-slate-200 bg-white px-4 py-4 transition hover:bg-slate-50 sm:grid-cols-[1.4fr_2fr_1fr_.8fr] sm:items-center sm:gap-0 sm:px-0"
          >
            <div className="flex items-center gap-3 sm:px-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[13px] font-semibold text-slate-600">
                {initials}
              </span>
              <p className="truncate text-sm font-semibold text-slate-900">{email.sender}</p>
            </div>
            <p className="truncate text-sm text-slate-700 sm:px-4">{email.subject}</p>
            <div className="sm:px-4">
              <span className={`inline-block border px-2 py-0.5 text-[10px] font-semibold ${email.color}`}>
                {email.category}
              </span>
            </div>
            <p className="text-left text-[11px] text-slate-500 sm:px-4 sm:text-right">{email.due}</p>
          </div>
        );
      })}

      <div className="grid grid-cols-3 border-t border-slate-200">
        {[
          ["43", "noise sorted"],
          ["7", "drafts prepared"],
          ["5", "need your decision"],
        ].map(([value, label]) => (
          <div key={label} className="border-r border-slate-200 px-4 py-5 last:border-r-0">
            <p className="text-xl font-semibold text-slate-900">{value}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-slate-500">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PixelRiz() {
  return (
    <span className="grid h-6 w-6 shrink-0 grid-cols-3 gap-px rounded-md border border-[#D9BEF4]/25 p-1" aria-hidden="true">
      {Array.from({ length: 9 }).map((_, index) => (
        <span key={index} className={index % 2 === 0 ? "bg-[#D9BEF4]" : "bg-transparent"} />
      ))}
    </span>
  );
}
