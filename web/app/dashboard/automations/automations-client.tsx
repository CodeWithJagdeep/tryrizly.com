"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CreditsBadge } from "../components/CreditsBadge";
import { BoltIcon } from "../components/icons";
import {
  type AutomationFlow,
  listFlows,
  newFlowId,
  newStepId,
  saveFlow,
} from "../lib/automation-store";

function timeAgo(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function AutomationsClient() {
  const router = useRouter();
  const [flows, setFlows] = useState<AutomationFlow[]>([]);

  useEffect(() => {
    setFlows(listFlows());
  }, []);

  function createFlow() {
    const id = newFlowId();
    saveFlow({
      id,
      name: "Untitled automation",
      steps: [
        { id: newStepId(), kind: "trigger", title: "", subtitle: "", app: "" },
        { id: newStepId(), kind: "action", title: "", subtitle: "", app: "" },
      ],
      updatedAt: new Date().toISOString(),
    });
    router.push(`/dashboard/automations/${id}`);
  }

  return (
    <main className="min-h-screen bg-[#f8f8f7] text-slate-900">
      {/* Top bar — matches the chat page's sticky chrome */}
      <div className="sticky top-0 z-10 flex h-14 w-full shrink-0 items-center justify-between border-b border-transparent bg-[#f8f8f7] px-4 md:px-6">
        <div className="flex h-8 items-center rounded-lg px-2 text-base font-normal text-slate-900 md:text-lg">
          Automations
        </div>
        <CreditsBadge />
      </div>

      <div className="w-full px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[15px] text-slate-500">
            Build &ldquo;when X happens, do Y&rdquo; flows on top of your connectors.
          </p>
          <button
            type="button"
            onClick={createFlow}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-[#FE7F2D] px-5 text-sm font-normal text-white transition hover:brightness-105"
          >
            + New automation
          </button>
        </div>

        {flows.length === 0 ? (
          <button
            type="button"
            onClick={createFlow}
            className="mt-8 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center transition hover:border-[#FE7F2D]/60"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FE7F2D]/10 text-[#FE7F2D]">
              <BoltIcon className="h-5 w-5" />
            </span>
            <p className="mt-2 text-sm font-normal text-slate-700">No automations yet</p>
            <p className="max-w-xs text-sm text-slate-500">
              Build a flow visually — start with a trigger, then add the steps that follow.
            </p>
          </button>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {flows.map((flow) => (
              <Link
                key={flow.id}
                href={`/dashboard/automations/${flow.id}`}
                className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FE7F2D]/10 text-[#FE7F2D]">
                    <BoltIcon className="h-4 w-4" />
                  </span>
                  <p className="truncate text-sm font-normal text-slate-900">{flow.name || "Untitled automation"}</p>
                </div>
                <p className="text-xs text-slate-400">
                  {flow.steps.length} step{flow.steps.length !== 1 ? "s" : ""} · Edited {timeAgo(flow.updatedAt)}
                </p>
              </Link>
            ))}
          </div>
        )}

        <p className="mt-8 text-xs text-slate-400">
          Flows are saved to this browser only — running them automatically isn&apos;t wired up yet.
        </p>
      </div>
    </main>
  );
}
