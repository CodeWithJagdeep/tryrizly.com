"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Assistant chat bubbles render GitHub-flavored Markdown (the agent is told
 * the web channel supports it), so revenue/metric answers can arrive as real
 * tables. Tables scroll horizontally inside the bubble rather than widening it.
 */
export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-left text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-slate-100 text-slate-700">{children}</thead>,
          th: ({ children }) => (
            <th className="border-b border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-slate-100 px-3 py-1.5 align-top">{children}</td>
          ),
          p: ({ children }) => <p className="my-1 first:mt-0 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="my-1 list-disc pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-1 list-decimal pl-5">{children}</ol>,
          li: ({ children }) => <li className="my-0.5">{children}</li>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-[#FE7F2D] underline">
              {children}
            </a>
          ),
          code: ({ children, className }) =>
            className ? (
              <code className={`${className} block overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100`}>
                {children}
              </code>
            ) : (
              <code className="rounded bg-slate-200/70 px-1 py-0.5 text-[0.85em]">{children}</code>
            ),
          pre: ({ children }) => <pre className="my-2">{children}</pre>,
          h1: ({ children }) => <p className="mt-2 mb-1 font-semibold">{children}</p>,
          h2: ({ children }) => <p className="mt-2 mb-1 font-semibold">{children}</p>,
          h3: ({ children }) => <p className="mt-2 mb-1 font-semibold">{children}</p>,
          blockquote: ({ children }) => (
            <blockquote className="my-1 border-l-2 border-slate-300 pl-3 text-slate-600">{children}</blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
