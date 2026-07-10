export function HeroGlow() {
  return (
    <>
      <div className="absolute -top-16 right-[4%] h-[340px] w-[340px] rounded-full bg-[radial-gradient(closest-side,rgba(247,182,198,0.4),transparent_70%)] blur-3xl" />
      <div className="absolute top-20 left-[2%] h-[280px] w-[280px] rounded-full bg-[radial-gradient(closest-side,rgba(255,217,206,0.45),transparent_70%)] blur-3xl" />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(32,21,28,0.07) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse 65% 55% at 50% 0%, black 35%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 65% 55% at 50% 0%, black 35%, transparent 100%)",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,#ffffff_100%)]" />
    </>
  );
}
