"use client";

import Link from "next/link";
import { motion, useScroll, useSpring } from "framer-motion";
import { Reveal } from "../../components/Reveal";
import { BlogPost } from "../data";
import { BlogCover } from "../../components/BlogCover";

export function BlogPostClient({ post, allPosts }: { post: BlogPost; allPosts: BlogPost[] }) {
  // Reading Scroll Progress indicator logic
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 150,
    damping: 25,
    restDelta: 0.001,
  });

  // Calculate related articles (exclude the current post, show max 2)
  const relatedPosts = allPosts.filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <div className="flex flex-1 flex-col relative overflow-hidden bg-slate-50/20 pb-24">
      {/* Scroll Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-500 to-indigo-600 origin-left z-50 shadow-sm"
        style={{ scaleX }}
      />

      {/* Background visual accents */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_60%,transparent_100%)] opacity-60" />
      <div className="absolute top-[-5%] left-[20%] -z-10 h-[400px] w-[400px] rounded-full bg-blue-400/5 blur-[100px] pointer-events-none" />

      {/* Main Container */}
      <article className="mx-auto w-full max-w-3xl px-4 pt-28 pb-16 sm:px-6 lg:px-8 relative">
        {/* Back Link */}
        <Reveal>
          <div className="mb-10">
            <Link
              href="/blog"
              className="group inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-800 transition-colors duration-200"
            >
              <span className="transition-transform duration-200 group-hover:-translate-x-1.5 text-sm leading-none">
                ←
              </span>
              Back to blog
            </Link>
          </div>
        </Reveal>

        {/* Post Metadata Header */}
        <Reveal delay={0.05}>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-600 border border-blue-100">
              {post.category}
            </span>
            <span className="text-xs font-medium text-slate-400">
              {post.readTime}
            </span>
          </div>

          <h1 className="font-neue-haas mt-4 mb-8 text-3xl leading-[1.1] font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            {post.title}
          </h1>

          {/* Author Header */}
          <div className="flex items-center gap-3 pb-8 border-b border-slate-200/80 mb-10">
            <div className="h-10 w-10 rounded-full bg-blue-500/10 text-blue-600 border border-blue-100 flex items-center justify-center font-bold text-sm">
              {post.authorAvatar}
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800">{post.authorName}</div>
              <div className="text-xs text-slate-400 font-medium">{post.authorRole}</div>
            </div>
            <div className="ml-auto text-xs font-semibold uppercase tracking-wider text-slate-400">
              Published {post.date}
            </div>
          </div>
        </Reveal>

        {/* Cover Banner */}
        <Reveal delay={0.08}>
          <div className="w-full rounded-2xl overflow-hidden mb-10 border border-slate-200/50 shadow-sm">
            <BlogCover
              category={post.category}
              title={post.title}
              slug={post.slug}
              aspectRatio="hero"
            />
          </div>
        </Reveal>

        {/* Article Body */}
        <Reveal delay={0.1}>
          <div className="space-y-6 text-base md:text-lg leading-relaxed text-slate-600 font-normal">
            {post.content.split("\n\n").map((paragraph, index) => (
              <p key={index} className="first-of-type:text-slate-800 first-of-type:font-medium">
                {paragraph}
              </p>
            ))}
          </div>
        </Reveal>

        {/* Author Signature Block */}
        <Reveal delay={0.15}>
          <div className="mt-16 rounded-3xl border border-slate-200/80 bg-white p-6 md:p-8 flex flex-col md:flex-row gap-5 items-center relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 h-32 w-32 rounded-full bg-blue-500/5 blur-2xl pointer-events-none" />
            <div className="h-14 w-14 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
              {post.authorAvatar}
            </div>
            <div className="text-center md:text-left flex-grow">
              <h4 className="text-base font-bold text-slate-900">Written by {post.authorName}</h4>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">{post.authorRole}</p>
              <p className="mt-2 text-xs md:text-sm text-slate-500 leading-normal">
                Jagdeep designs proactive workflows and system models for rizly. Catch him writing about background AI scheduling and calendar security guards.
              </p>
            </div>
            <Link
              href="/signup"
              className="mt-4 md:mt-0 px-4 py-2 border border-slate-200 text-xs font-semibold text-slate-700 rounded-full hover:bg-slate-50 transition-colors shrink-0"
            >
              Follow updates
            </Link>
          </div>
        </Reveal>
      </article>

      {/* Related Reads Section */}
      {relatedPosts.length > 0 && (
        <section className="bg-slate-50/50 border-t border-slate-200/80 py-20 relative">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <h3 className="text-xl font-bold text-slate-900 mb-8 text-center md:text-left">
                Keep reading
              </h3>
            </Reveal>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {relatedPosts.map((rPost, index) => (
                <Reveal key={rPost.slug} delay={index * 0.08}>
                  <Link href={`/blog/${rPost.slug}`} className="group block h-full">
                    <div className="flex flex-col h-full rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-300 hover:border-slate-300 hover:shadow-md">
                      <div className="w-full rounded-xl overflow-hidden mb-4 border border-slate-200/50">
                        <BlogCover
                          category={rPost.category}
                          title={rPost.title}
                          slug={rPost.slug}
                          aspectRatio="card"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600 border border-blue-100">
                          {rPost.category}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase">
                          {rPost.readTime}
                        </span>
                      </div>
                      <h4 className="mt-3 text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors duration-200 line-clamp-2">
                        {rPost.title}
                      </h4>
                      <p className="mt-2 text-xs leading-normal text-slate-500 flex-grow line-clamp-2">
                        {rPost.excerpt}
                      </p>
                      <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">
                        {rPost.date}
                      </div>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
