// Local-only persistence for automation flows built with the React Flow
// canvas. There is no backend automations engine yet — saving here just
// keeps the flow around across visits; nothing is executed.
//
// A flow is a linear list of steps: the first step is always the trigger,
// everything after it is an action, run top-to-bottom (Zapier-style).

export type AutomationStepKind = "trigger" | "action";

export type AutomationStep = {
  id: string;
  kind: AutomationStepKind;
  title: string;
  subtitle: string;
  app: string;
};

export type AutomationFlow = {
  id: string;
  name: string;
  steps: AutomationStep[];
  updatedAt: string;
};

const STORAGE_KEY = "rizly-automation-flows";

export function listFlows(): AutomationFlow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AutomationFlow[];
    return Array.isArray(parsed)
      ? [...parsed]
          .filter((f) => Array.isArray(f.steps))
          .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      : [];
  } catch {
    return [];
  }
}

export function getFlow(id: string): AutomationFlow | null {
  return listFlows().find((f) => f.id === id) ?? null;
}

export function saveFlow(flow: AutomationFlow) {
  if (typeof window === "undefined") return;
  const flows = listFlows().filter((f) => f.id !== flow.id);
  flows.push(flow);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(flows));
}

export function deleteFlow(id: string) {
  if (typeof window === "undefined") return;
  const flows = listFlows().filter((f) => f.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(flows));
}

export function newFlowId(): string {
  return `flow_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function newStepId(): string {
  return `step_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
