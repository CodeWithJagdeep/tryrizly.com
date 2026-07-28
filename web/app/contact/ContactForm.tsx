"use client";

import { useState, type FormEvent } from "react";

const SendIcon = () => (
  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="18" width="18" xmlns="http://www.w3.org/2000/svg">
    <path d="M3.5 1.34558C3.58425 1.34558 3.66714 1.36687 3.74096 1.40747L22.2034 11.5618C22.4454 11.6949 22.5337 11.9989 22.4006 12.2409C22.3549 12.324 22.2865 12.3924 22.2034 12.4381L3.74096 22.5924C3.499 22.7255 3.19497 22.6372 3.06189 22.3953C3.02129 22.3214 3 22.2386 3 22.1543V1.84558C3 1.56944 3.22386 1.34558 3.5 1.34558ZM5 4.38249V10.9999H10V12.9999H5V19.6174L18.8499 11.9999L5 4.38249Z"></path>
  </svg>
);

const inputClass =
  "rounded-xl bg-[#f7f7f6] px-4 py-3 text-sm text-[#233D4D] outline-none transition placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-[#233D4D]/10";

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: formData.get("name"),
      email: formData.get("email"),
      company: formData.get("company"),
      inquiryType: formData.get("inquiryType"),
      message: formData.get("message"),
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("submit_failed");
      setStatus("success");
      form.reset();
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl bg-white p-10 text-center shadow-[0_20px_60px_-48px_rgba(32,21,28,0.4)]">
        <h3 className="mb-4 text-2xl font-normal text-[#233D4D]">Message sent</h3>
        <p className="mb-6 leading-6 text-gray-600">Thanks for reaching out. We&apos;ll get back to you shortly.</p>
        <button
          onClick={() => setStatus("idle")}
          className="text-sm text-gray-600 underline underline-offset-4 transition hover:text-[#233D4D]"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-[0_20px_60px_-48px_rgba(32,21,28,0.4)] md:p-10">
      <h3 className="mb-8 text-2xl font-normal text-[#233D4D]">Send a message</h3>
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-[0.1em] text-gray-500">Full name *</label>
            <input required name="name" type="text" className={inputClass} placeholder="Jane Doe" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-[0.1em] text-gray-500">Work email *</label>
            <input required name="email" type="email" className={inputClass} placeholder="jane@company.com" />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs uppercase tracking-[0.1em] text-gray-500">Company</label>
          <input name="company" type="text" className={inputClass} placeholder="Acme Corp" />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs uppercase tracking-[0.1em] text-gray-500">Inquiry type *</label>
          <select required name="inquiryType" defaultValue="Sales & Enterprise" className={`${inputClass} appearance-none`}>
            <option>Sales & Enterprise</option>
            <option>Technical Support</option>
            <option>Partnerships</option>
            <option>Other</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs uppercase tracking-[0.1em] text-gray-500">Message *</label>
          <textarea required name="message" rows={5} className={`${inputClass} resize-none`} placeholder="How can we help you?" />
        </div>
        {status === "error" && <p className="text-xs text-red-600">Something went wrong. Please try again.</p>}
        <button
          type="submit"
          disabled={status === "submitting"}
          className="flex w-full items-center justify-center gap-2.5 rounded-full bg-[#233D4D] py-4 text-sm font-normal text-white transition hover:bg-black disabled:pointer-events-none disabled:opacity-60"
        >
          {status === "submitting" ? "Sending..." : "Send message"}
          <SendIcon />
        </button>
        <p className="text-center text-xs text-gray-500">
          By sending this, you agree to our{" "}
          <a href="/privacy" className="text-[#233D4D] underline underline-offset-4">
            Privacy Policy
          </a>
          .
        </p>
      </form>
    </div>
  );
}
