"use client";

import { Suspense, useEffect, useState } from "react";
import { SettingsClient } from "../settings/settings-client";
import {
  closeSettingsModal,
  getSettingsModalSection,
  isSettingsModalOpen,
  subscribeToSettingsModal,
} from "../lib/settings-modal-store";

type Session = { email: string; name?: string; userId: string };

export function SettingsModal({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string | undefined>(undefined);

  useEffect(() => {
    const sync = () => {
      setOpen(isSettingsModalOpen());
      setSection(getSettingsModalSection());
    };
    sync();
    return subscribeToSettingsModal(sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeSettingsModal();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex bg-black/55 p-0 backdrop-blur-[6px] sm:items-center sm:justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      onClick={() => closeSettingsModal()}
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-[0_28px_80px_-20px_rgba(0,0,0,0.5)] sm:h-[min(88vh,780px)] sm:max-w-[960px] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Suspense fallback={null}>
          <SettingsClient
            email={session.email}
            name={session.name}
            initialSection={section}
            onClose={() => closeSettingsModal()}
          />
        </Suspense>
      </div>
    </div>
  );
}
