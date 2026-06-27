"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Reveal } from "../components/Reveal";
import { BlogPost } from "./data";
import { BlogCover } from "../components/BlogCover";

const categories = ["All", "Company", "Product", "Guides"];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
} as const;

const cardVariants = {
  hidden: { opacity: 0, y: 25 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
    },
  },
} as const;

export function BlogClient({ posts }: { posts: BlogPost[] }) {
  const [activeCategory, setActiveCategory] = useState("All");

  // Sort posts to find the latest one for the Featured section (first item in data is latest)
  const featuredPost = posts[0];
  const otherPosts = posts.slice(1);

  // Filter logic
  const filteredOtherPosts = otherPosts.filter(
    (post) => activeCategory === "All" || post.category === activeCategory
  );

  const showFeatured = activeCategory === "All" || featuredPost.category === activeCategory;

  return (
    <div className="flex flex-1 flex-col relative overflow-hidden bg-slate-50/20 pb-24">
      {/* Background visual accents */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_60%,transparent_100%)] opacity-70" />
      <div className="absolute top-[-10%] right-[10%] -z-10 h-[500px] w-[500px] rounded-full bg-blue-400/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[5%] -z-10 h-[600px] w-[600px] rounded-full bg-teal-300/5 blur-[130px] pointer-events-none" />

      {/* Hero header */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-24 pb-12 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center md:text-left">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-500">
              The HeyRiz Journal
            </span>
            <h1 className="font-neue-haas mt-3 text-4xl leading-[1.05] font-normal tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
              Notes on building a proactive AI operator.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate-500 md:text-lg max-w-xl">
              Insights, guides, and technical deep-dives from the team behind the next generation of background automation.
            </p>
          </div>
        </Reveal>

        {/* Category Filters */}
        <div className="mt-12 border-b border-slate-200/80 pb-5">
          <Reveal delay={0.1}>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const isActive = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className="relative px-4 py-2 text-xs font-semibold rounded-full uppercase tracking-wider transition-colors duration-200 focus:outline-none"
                  >
                    <span className={isActive ? "text-white z-10 relative" : "text-slate-500 hover:text-slate-800 relative z-10"}>
                      {cat}
                    </span>
                    {isActive && (
                      <motion.div
                        layoutId="active-blog-category"
                        className="absolute inset-0 rounded-full bg-slate-900"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Main Articles Container */}
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Featured Post Card */}
        {showFeatured && activeCategory === "All" && (
          <div className="mb-12">
            <Reveal delay={0.15}>
              <Link href={`/blog/${featuredPost.slug}`} className="group block">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 rounded-3xl border border-slate-200/90 bg-white p-6 md:p-8 transition-all duration-300 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50 relative overflow-hidden">
                  
                  {/* Visual Pattern side */}
                  <div className="md:col-span-6 rounded-2xl overflow-hidden border border-slate-200/50">
                    <BlogCover
                      category={featuredPost.category}
                      title={featuredPost.title}
                      slug={featuredPost.slug}
                      aspectRatio="hero"
                    />
                  </div>

                  {/* Metadata side */}
                  <div className="md:col-span-6 flex flex-col justify-center py-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-600 border border-blue-100">
                        {featuredPost.category}
                      </span>
                      <span className="text-xs font-medium text-slate-400">
                        {featuredPost.readTime}
                      </span>
                    </div>

                    <h2 className="mt-4 font-neue-haas text-2xl font-bold tracking-tight text-slate-900 md:text-3xl group-hover:text-blue-600 transition-colors duration-200">
                      {featuredPost.title}
                    </h2>

                    <p className="mt-4 text-base leading-relaxed text-slate-500">
                      {featuredPost.excerpt}
                    </p>

                    <div className="mt-8 pt-6 border-t border-slate-100 flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-blue-500/10 text-blue-600 border border-blue-100 flex items-center justify-center font-bold text-sm">
                        {featuredPost.authorAvatar}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{featuredPost.authorName}</div>
                        <div className="text-xs text-slate-400 font-medium">{featuredPost.authorRole}</div>
                      </div>
                      <div className="ml-auto text-xs font-medium text-slate-400">
                        {featuredPost.date}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </Reveal>
          </div>
        )}

        {/* Secondary Posts Grid */}
        <AnimatePresence mode="popLayout">
          <motion.div
            layout
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6"
          >
            {filteredOtherPosts.map((post) => (
              <motion.div
                layout
                key={post.slug}
                variants={cardVariants}
                className="flex"
              >
                <Link href={`/blog/${post.slug}`} className="group flex w-full">
                  <div className="flex flex-col w-full rounded-2xl border border-slate-200/90 bg-white p-6 transition-all duration-300 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-100/80 relative overflow-hidden">
                    
                    {/* Header Pattern */}
                    <div className="w-full rounded-xl overflow-hidden mb-5 border border-slate-200/50">
                      <BlogCover
                        category={post.category}
                        title={post.title}
                        slug={post.slug}
                        aspectRatio="card"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700 border border-teal-100">
                        {post.category}
                      </span>
                      <span className="text-xs font-medium text-slate-400">
                        {post.readTime}
                      </span>
                    </div>

                    <h3 className="mt-3 text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors duration-200 line-clamp-2">
                      {post.title}
                    </h3>

                    <p className="mt-3 text-sm leading-relaxed text-slate-500 flex-grow line-clamp-3">
                      {post.excerpt}
                    </p>

                    <div className="mt-6 pt-5 border-t border-slate-100 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-teal-500/10 text-teal-700 border border-teal-100 flex items-center justify-center font-bold text-xs">
                        {post.authorAvatar}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-800">{post.authorName}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{post.authorRole}</div>
                      </div>
                      <div className="ml-auto text-xs font-medium text-slate-400">
                        {post.date}
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </section>
    </div>
  );
}
