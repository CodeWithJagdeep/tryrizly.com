"use client";

export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="m-0 flex min-h-screen items-center justify-center bg-white px-6 text-slate-950">
        <main className="w-full max-w-md border border-slate-200 p-8 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#D9BEF4]">
            Rizly
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            Something went wrong
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            The request could not be completed. Try it again.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="mt-6 h-10 border border-slate-950 bg-slate-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-[#D9BEF4]"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
