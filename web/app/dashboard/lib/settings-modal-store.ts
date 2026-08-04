// Tiny module-level store so anything in the dashboard (sidebar popover,
// future shortcuts) can open the Settings dialog without a context provider,
// mirroring the pattern in sidebar-store.ts.
let open = false;
let section: string | undefined;
const subscribers = new Set<() => void>();

export function isSettingsModalOpen() {
  return open;
}

export function getSettingsModalSection() {
  return section;
}

export function openSettingsModal(initialSection?: string) {
  open = true;
  section = initialSection;
  subscribers.forEach((fn) => fn());
}

export function closeSettingsModal() {
  if (!open) return;
  open = false;
  subscribers.forEach((fn) => fn());
}

export function subscribeToSettingsModal(fn: () => void) {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}
