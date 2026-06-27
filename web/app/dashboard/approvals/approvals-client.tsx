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
    <main className="min-h-screen bg-[#1a1a19] text-[#f2f1ec]">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-5 py-8 sm:px-8">
        <header className="flex flex-col gap-3 border-b border-[#2e2e2c] pb-6">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#6b6b63]">
            heyriz
          </p>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#f2f1ec] sm:text-3xl">Approvals</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#a8a399]">
              Actions HeyRiz wants to run on your behalf — sending an email, moving a
              meeting — and is waiting on your yes or no.
            </p>
          </div>
        </header>

        {loadError ? (
          <p className="rounded-lg border border-[#5c2626] bg-[#241616] px-4 py-3 text-sm text-[#f87171]">
            {loadError}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-[#a8a399]">Loading…</p>
        ) : approvals.length === 0 ? (
          <p className="rounded-xl border border-[#2e2e2c] bg-[#1f1f1e] px-5 py-8 text-center text-sm text-[#a8a399]">
            Nothing waiting on you right now.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#2e2e2c] bg-[#1f1f1e]">
            <div className="divide-y divide-[#2e2e2c]">
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
    <article className="grid gap-4 px-5 py-5 transition hover:bg-[#232321]/60 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#242422] px-2.5 py-1 text-xs font-medium text-[#a8a399]">
            {approval.tool}
          </span>
          <span className="text-xs text-[#6b6b63]">#{approval.id}</span>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#f2f1ec]">
          {approval.preview}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <button
          className="h-10 rounded-lg border border-[#2e2e2c] px-4 text-sm font-medium text-[#a8a399] transition hover:bg-[#242422] hover:text-[#f2f1ec] disabled:opacity-50"
          disabled={deciding}
          onClick={onReject}
          type="button"
        >
          No
        </button>
        <button
          className="h-10 rounded-lg bg-[#2563eb] px-4 text-sm font-medium text-white transition hover:bg-[#1d4ed8] disabled:opacity-50"
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
