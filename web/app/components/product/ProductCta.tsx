import Link from "next/link";

export function ProductCta({
  title,
  detail,
  ctaLabel = "Start free trial",
  ctaHref = "/signup",
  secondaryLabel,
  secondaryHref,
}: {
  title: string;
  detail?: string;
  ctaLabel?: string;
  ctaHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}) {
  return (
    <section className="relative overflow-hidden bg-[#233D4D] px-6 py-24 text-center md:px-10 lg:px-14">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-2xl">
        <h2 className="text-3xl font-normal leading-tight tracking-tight text-white [text-wrap:balance] md:text-4xl">
          {title}
        </h2>
        {detail ? <p className="mt-5 text-sm leading-6 text-white/50 md:text-base">{detail}</p> : null}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={ctaHref}
            className="inline-flex h-12 items-center justify-center rounded-full bg-[#D9BEF4] px-8 text-base font-normal text-white transition hover:bg-[#D9BEF4]"
          >
            {ctaLabel}
          </Link>
          {secondaryLabel && secondaryHref ? (
            <Link
              href={secondaryHref}
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/20 px-8 text-base font-normal text-white transition hover:border-white hover:bg-white hover:text-[#233D4D]"
            >
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
