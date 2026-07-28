const stages = [
  {
    step: "01",
    title: "Connect your accounts",
    detail:
      "Gmail and Calendar link in under a minute. Connect Stripe, Razorpay, or a database when you want it watching revenue too.",
  },
  {
    step: "02",
    title: "Riz reads, triages, and drafts",
    detail:
      "Every inbound message and meeting gets weighed against what you actually care about, quietly, in the background.",
  },
  {
    step: "03",
    title: "You approve from Telegram",
    detail:
      "Drafts and decisions land as a Telegram message you can approve, edit, or reject. Nothing sends without you.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="border-t border-black/10 bg-[#fcfcfc] px-6 py-20 md:px-10 lg:px-14">
      <div className="mx-auto max-w-[88rem]">
        <span className="mb-5 block text-[11px] font-normal uppercase tracking-[0.18em] text-gray-500">
          How it works
        </span>
        <h2 className="max-w-xl text-3xl font-normal leading-tight tracking-tight text-[#233D4D] [text-wrap:balance] md:text-5xl">
          From connected to handled, in three moves.
        </h2>

        <div className="mt-14 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
          {stages.map((stage) => (
            <div key={stage.step} className="flex flex-col gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#233D4D] font-mono text-sm text-white">
                {stage.step}
              </span>
              <div>
                <h3 className="text-lg font-normal text-[#233D4D]">{stage.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{stage.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
