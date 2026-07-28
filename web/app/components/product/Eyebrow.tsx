export function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <span
      className={`mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-normal uppercase tracking-[0.18em] ${
        light ? "bg-white/10 text-white/60" : "bg-[#f7f7f6] text-gray-500"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#D9BEF4]" />
      {children}
    </span>
  );
}
