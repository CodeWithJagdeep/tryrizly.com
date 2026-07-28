import { CalendarIcon, GmailIcon, SlackIcon } from "../ConnectorIcons";

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill="currentColor" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

type NodeKind = "trigger" | "condition" | "action";

const nodes: Array<{
  kind: NodeKind;
  label: string;
  title: string;
  detail: string;
  icon: React.ReactNode;
}> = [
  {
    kind: "trigger",
    label: "Trigger",
    title: "New email matching search",
    detail: "Gmail · subject contains \"invoice\"",
    icon: <GmailIcon className="h-4 w-4" />,
  },
  {
    kind: "condition",
    label: "Condition",
    title: "Amount is greater than $500",
    detail: "if / else branch",
    icon: <BoltIcon />,
  },
  {
    kind: "action",
    label: "Action",
    title: "Notify finance channel",
    detail: "Slack · #finance",
    icon: <SlackIcon className="h-4 w-4" />,
  },
  {
    kind: "action",
    label: "Action",
    title: "Hold a review slot",
    detail: "Calendar · 15 min, today",
    icon: <CalendarIcon className="h-4 w-4" />,
  },
];

const kindStyles: Record<NodeKind, string> = {
  trigger: "border-[#9CC59F]/40 text-[#4F7A55]",
  condition: "border-[#D9BEF4]/50 text-[#8C5DB5]",
  action: "border-black/10 text-black/50",
};

function FlowNode({ node, index }: { node: (typeof nodes)[number]; index: number }) {
  return (
    <div className="flow-node relative flex items-center gap-3 rounded-[1.1rem] border border-black/[0.06] bg-white p-3.5 shadow-[0_10px_28px_rgba(42,35,29,.06)]" style={{ animationDelay: `${index * 140}ms` }}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#F1EFEA] text-[#171717]">{node.icon}</span>
      <div className="min-w-0 flex-1">
        <span className={`inline-block rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] ${kindStyles[node.kind]}`}>
          {node.label}
        </span>
        <span className="mt-1 block truncate text-[12px] font-semibold text-black">{node.title}</span>
        <span className="mt-0.5 block truncate text-[10px] text-black/40">{node.detail}</span>
      </div>
    </div>
  );
}

function FlowBuilderCanvas() {
  return (
    <div className="flow-shell relative w-full overflow-hidden rounded-[2rem] bg-[#F1EFEA] p-4 shadow-[0_40px_120px_rgba(0,0,0,.5)] sm:p-6">
      <div className="flex items-center justify-between px-1 py-1">
        <div className="flex items-center gap-3">
          <span className="grid h-6 w-6 place-items-center rounded-[8px] bg-[#171717] text-[#D9BEF4]">
            <BoltIcon />
          </span>
          <span className="text-xs tracking-[-0.01em] text-black/60">Invoice review automation</span>
        </div>
        <span className="rounded-full bg-[#171717] px-3 py-1 text-[10px] font-semibold text-white">Draft</span>
      </div>

      <div className="relative mt-4 rounded-[1.55rem] border border-black/[0.07] bg-white/40 p-4 md:p-5">
        <div className="flow-canvas-grid pointer-events-none absolute inset-0 rounded-[1.55rem] opacity-40" aria-hidden="true" />
        <div className="relative flex flex-col gap-2.5">
          {nodes.map((node, index) => (
            <div key={node.title} className="flex flex-col items-stretch gap-2.5">
              <FlowNode node={node} index={index} />
              {index < nodes.length - 1 && (
                <div className="flex items-center gap-2 pl-4">
                  <span className="h-5 w-px bg-black/15" aria-hidden="true" />
                </div>
              )}
            </div>
          ))}
          <button
            type="button"
            className="mt-1 flex items-center gap-2 self-start rounded-full border border-dashed border-black/20 px-3 py-1.5 text-[10px] font-semibold text-black/45"
          >
            <PlusIcon /> Add a step
          </button>
        </div>
      </div>
    </div>
  );
}

export function FlowBuilderSection() {
  return (
    <section className="relative overflow-hidden bg-[#090909] px-6 py-14 md:px-10 md:py-20 lg:px-14">
      <style>{`
        @keyframes flow-node-in { from { transform: translateY(10px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        .flow-node { animation: flow-node-in .45s cubic-bezier(.2,.8,.2,1) both }
        .flow-canvas-grid { background-image: linear-gradient(rgba(23,23,23,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(23,23,23,.045) 1px, transparent 1px); background-size: 20px 20px }
        @media (prefers-reduced-motion: reduce) { .flow-node { animation: none !important } }
      `}</style>
      <div className="pointer-events-none absolute -left-32 top-24 h-80 w-80 rounded-full bg-[#D9BEF4]/10 blur-[110px]" aria-hidden="true" />
      <div className="relative mx-auto grid w-full max-w-[88rem] items-center gap-10 md:grid-cols-2 md:gap-14">
        <div className="order-2 md:order-1">
          <FlowBuilderCanvas />
        </div>
        <div className="order-1 flex flex-col items-start text-left md:order-2">
          <div className="mb-5 inline-flex items-center rounded-full border border-[#D9BEF4]/40 px-3 py-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#D9BEF4]">Flow builder</span>
          </div>
          <h2 className="max-w-lg text-3xl font-medium leading-[1.08] tracking-[-0.04em] text-white [text-wrap:balance] md:text-5xl">
            Or build it yourself, <span className="text-[#D9BEF4]">step by step.</span>
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-white/55 md:text-lg">
            Prefer full control? Drag together triggers, conditions, and actions in the flow builder&mdash;no code, no waiting on Rizly to guess what you meant.
          </p>
        </div>
      </div>
    </section>
  );
}
