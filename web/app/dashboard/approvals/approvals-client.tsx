"use client";

import { useEffect, useState } from "react";

type PendingApproval = {
  id: string;
  tool: string;
  preview: string;
  label: string;
  createdAt: string;
};

export function ApprovalsClient() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  async function load() {
    try {
      const response = await fetch("/api/approvals");
      if (!response.ok) throw new Error("Failed to load approvals");
      const data = (await response.json()) as { approvals?: PendingApproval[]; error?: string };
      if (data.error) throw new Error(data.error);
      setApprovals(data.approvals ?? []);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load approvals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function decide(id: string, decision: "approve" | "reject") {
    setDecidingId(id);
    try {
      const response = await fetch("/api/approvals/decide", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });
      if (!response.ok) throw new Error("Failed to update approval");
      await load();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to update approval");
    } finally {
      setDecidingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-5 py-8 sm:px-8">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-6">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
            rizly
          </p>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Approvals</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Actions rizly wants to run on your behalf — sending an email, moving a
              meeting — and is waiting on your yes or no.
            </p>
          </div>
        </header>

        {loadError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-500">
            {loadError}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : approvals.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-400">
            Nothing waiting on you right now.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="divide-y divide-slate-200">
              {approvals.map((approval) => (
                <ApprovalRow
                  approval={approval}
                  deciding={decidingId === approval.id}
                  key={approval.id}
                  onApprove={() => void decide(approval.id, "approve")}
                  onReject={() => void decide(approval.id, "reject")}
                />
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function ApprovalRow({
  approval,
  deciding,
  onApprove,
  onReject,
}: {
  approval: PendingApproval;
  deciding: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <article className="grid gap-4 px-5 py-5 transition hover:bg-white/60 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-400">
            {approval.tool}
          </span>
          <span className="text-xs text-slate-500">#{approval.id}</span>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-900">
          {approval.preview}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <button
          className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-400 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
          disabled={deciding}
          onClick={onReject}
          type="button"
        >
          No
        </button>
        <button
          className="h-10 rounded-lg bg-[#FE7F2D] px-4 text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-50"
          disabled={deciding}
          onClick={onApprove}
          type="button"
        >
          {deciding ? "Working…" : "Yes"}
        </button>
      </div>
    </article>
  );
}
