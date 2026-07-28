export function Testimonial({ quote, author }: { quote: string; author: string }) {
  return (
    <section className="border-t border-black/10 bg-white px-6 py-20 md:px-10 lg:px-14">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xl font-normal leading-relaxed text-[#233D4D] [text-wrap:balance] md:text-2xl">
          &ldquo;{quote}&rdquo;
        </p>
        <span className="mt-6 block text-[11px] font-normal uppercase tracking-[0.18em] text-gray-500">{author}</span>
      </div>
    </section>
  );
}
