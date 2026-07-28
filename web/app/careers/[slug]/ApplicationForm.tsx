"use client";

import { useState, type FormEvent } from "react";

const UploadIcon = () => (
  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="group-hover:text-[#D9BEF4] transition-colors" height="28" width="28" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 12.5858L16.2426 16.8284L14.8284 18.2426L13 16.415V22H11V16.413L9.17157 18.2426L7.75736 16.8284L12 12.5858ZM12 2C15.5934 2 18.5544 4.70761 18.9541 8.19395C21.2858 8.83154 23 10.9656 23 13.5C23 16.3688 20.8036 18.7246 18.0006 18.9776L18.0009 16.9644C19.6966 16.7214 21 15.2629 21 13.5C21 11.567 19.433 10 17.5 10C17.2912 10 17.0867 10.0183 16.8887 10.054C16.9616 9.7142 17 9.36158 17 9C17 6.23858 14.7614 4 12 4C9.23858 4 7 6.23858 7 9C7 9.36158 7.03838 9.7142 7.11205 10.0533C6.91331 10.0183 6.70879 10 6.5 10C4.567 10 3 11.567 3 13.5C3 15.2003 4.21241 16.6174 5.81986 16.934L6.00005 16.9646L6.00039 18.9776C3.19696 18.7252 1 16.3692 1 13.5C1 10.9656 2.71424 8.83154 5.04648 8.19411C5.44561 4.70761 8.40661 2 12 2Z"></path>
  </svg>
);

const SendIcon = () => (
  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="20" width="20" xmlns="http://www.w3.org/2000/svg">
    <path d="M3.5 1.34558C3.58425 1.34558 3.66714 1.36687 3.74096 1.40747L22.2034 11.5618C22.4454 11.6949 22.5337 11.9989 22.4006 12.2409C22.3549 12.324 22.2865 12.3924 22.2034 12.4381L3.74096 22.5924C3.499 22.7255 3.19497 22.6372 3.06189 22.3953C3.02129 22.3214 3 22.2386 3 22.1543V1.84558C3 1.56944 3.22386 1.34558 3.5 1.34558ZM5 4.38249V10.9999H10V12.9999H5V19.6174L18.8499 11.9999L5 4.38249Z"></path>
  </svg>
);

export function ApplicationForm({ roleTitle }: { roleTitle: string }) {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [resumeName, setResumeName] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");

    const formData = new FormData(event.currentTarget);
    formData.set("role", roleTitle);

    try {
      const response = await fetch("/api/careers/apply", { method: "POST", body: formData });
      if (!response.ok) throw new Error("submit_failed");
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="border-4 border-black p-10 bg-white shadow-[12px_12px_0px_0px_rgba(217,190,244,1)] text-center">
        <h3 className="text-xl font-semibold uppercase mb-4">Application received</h3>
        <p className="text-sm text-gray-500 leading-relaxed">
          Thanks for applying to {roleTitle}. We'll be in touch if there's a fit.
        </p>
      </div>
    );
  }

  return (
    <div className="border-4 border-black p-10 bg-white shadow-[12px_12px_0px_0px_rgba(217,190,244,1)]">
      <h3 className="text-xl font-semibold uppercase mb-8">Apply for this role</h3>
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Full name *</label>
          <input
            required
            className="w-full border-2 border-black px-4 py-3 text-[14px] font-medium outline-none focus:border-[#D9BEF4] transition-colors"
            placeholder="Jane Doe"
            type="text"
            name="name"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Email address *</label>
          <input
            required
            className="w-full border-2 border-black px-4 py-3 text-[14px] font-medium outline-none focus:border-[#D9BEF4] transition-colors"
            placeholder="jane@gmail.com"
            type="email"
            name="email"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Phone number</label>
          <input
            className="w-full border-2 border-black px-4 py-3 text-[14px] font-medium outline-none focus:border-[#D9BEF4] transition-colors"
            placeholder="+1 234 567 890"
            type="tel"
            name="phone"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Resume / CV (PDF, max 5MB)</label>
          <label className="relative flex flex-col items-center justify-center gap-2 border-2 border-dashed border-black p-6 cursor-pointer hover:bg-gray-50 transition-colors group">
            <UploadIcon />
            <span className="text-[11px] font-semibold uppercase tracking-widest">
              {resumeName ?? "Upload PDF"}
            </span>
            <input
              accept="application/pdf"
              className="hidden"
              type="file"
              name="resume"
              onChange={(event) => setResumeName(event.target.files?.[0]?.name ?? null)}
            />
          </label>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Cover note (optional)</label>
          <textarea
            name="coverNote"
            rows={3}
            className="w-full border-2 border-black px-4 py-3 text-[13px] font-medium outline-none focus:border-[#D9BEF4] transition-colors resize-none"
            placeholder="Anything you want us to know..."
          />
        </div>
        {status === "error" && (
          <p className="text-[12px] font-semibold uppercase text-red-600">Something went wrong. Please try again.</p>
        )}
        <button
          type="submit"
          disabled={status === "submitting"}
          className="w-full flex items-center justify-center gap-3 border-2 border-black bg-black text-white py-5 text-[15px] font-semibold uppercase tracking-widest shadow-[6px_6px_0px_0px_rgba(217,190,244,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_0px_rgba(217,190,244,1)] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all disabled:opacity-60 disabled:pointer-events-none"
        >
          {status === "submitting" ? "Submitting..." : "Submit application"}
          <SendIcon />
        </button>
      </form>
    </div>
  );
}
