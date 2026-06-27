import Link from "next/link";
import { posts } from "../../blog/data";
import { Reveal } from "../Reveal";

export function BlogTeaser() {
  const latest = posts.slice(0, 3);

  return (
    <section className="bg-[#f8fafc] py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-neue-haas max-w-lg text-3xl font-normal tracking-tight text-[#0f172a] md:text-4xl">
              Notes on building a proactive operator.
            </h2>
            <Link href="/blog" className="text-sm font-medium text-[#3784ff] hover:text-[#2c72e5]">
              Read the blog
            </Link>
          </div>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {latest.map((post, index) => (
            <Reveal key={post.slug} delay={index * 0.06}>
              <Link
                href={`/blog/${post.slug}`}
                className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-6 transition hover:border-[#3784ff]/30"
              >
                <p className="text-xs font-medium text-slate-400">{formatDate(post.date)}</p>
                <h3 className="mt-3 text-lg font-semibold text-slate-950">{post.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#475569]">{post.excerpt}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
