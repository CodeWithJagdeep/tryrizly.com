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

// Desktop icon-rail collapse — separate from the mobile drawer above, and
// persisted so a reload doesn't snap the panel back open.
const COLLAPSE_KEY = "sidebar_collapsed";
let collapsed = false;
const collapseSubscribers = new Set<() => void>();

export function isSidebarCollapsed() {
  return collapsed;
}

export function setSidebarCollapsed(value: boolean) {
  if (collapsed === value) return;
  collapsed = value;
  try { localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0"); } catch { /* best-effort */ }
  collapseSubscribers.forEach((fn) => fn());
}

export function toggleSidebarCollapsed() {
  setSidebarCollapsed(!collapsed);
}

export function initSidebarCollapsed() {
  try {
    const saved = localStorage.getItem(COLLAPSE_KEY);
    if (saved !== null) collapsed = saved === "1";
  } catch { /* best-effort */ }
}

export function subscribeToSidebarCollapsed(fn: () => void) {
  collapseSubscribers.add(fn);
  return () => {
    collapseSubscribers.delete(fn);
  };
}
