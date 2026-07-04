// Tiny module-level store so the mobile bottom nav (in layout) and the
// ChatSidebar drawer can share open/close state without a context provider.
let open = false;
const subscribers = new Set<() => void>();

export function isSidebarOpen() {
  return open;
}

export function setSidebarOpen(value: boolean) {
  if (open === value) return;
  open = value;
  subscribers.forEach((fn) => fn());
}

export function toggleSidebar() {
  setSidebarOpen(!open);
}

export function subscribeToSidebar(fn: () => void) {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}
