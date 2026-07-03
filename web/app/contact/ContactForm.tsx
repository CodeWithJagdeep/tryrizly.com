"use client";

import { useState, type FormEvent } from "react";

const SendIcon = () => (
  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="20" width="20" xmlns="http://www.w3.org/2000/svg">
    <path d="M3.5 1.34558C3.58425 1.34558 3.66714 1.36687 3.74096 1.40747L22.2034 11.5618C22.4454 11.6949 22.5337 11.9989 22.4006 12.2409C22.3549 12.324 22.2865 12.3924 22.2034 12.4381L3.74096 22.5924C3.499 22.7255 3.19497 22.6372 3.06189 22.3953C3.02129 22.3214 3 22.2386 3 22.1543V1.84558C3 1.56944 3.22386 1.34558 3.5 1.34558ZM5 4.38249V10.9999H10V12.9999H5V19.6174L18.8499 11.9999L5 4.38249Z"></path>
  </svg>
);

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
      <div className="border-2 border-black p-10 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] bg-white text-center">
        <h3 className="text-2xl font-semibold mb-4">Message sent</h3>
        <p className="text-gray-500 leading-relaxed mb-6">Thanks for reaching out. We'll get back to you shortly.</p>
        <button
          onClick={() => setStatus("idle")}
          className="text-[13px] font-semibold underline hover:text-[#FE7F2D] transition-colors"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <div className="border-2 border-black p-10 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] bg-white">
      <h3 className="text-2xl font-semibold mb-10">Send a message</h3>
      <form className="space-y-8" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold tracking-widest text-gray-400">Full name *</label>
            <input
              required
              name="name"
              type="text"
              className="border-2 border-black px-4 py-3 text-[14px] font-medium outline-none focus:border-[#FE7F2D] transition-colors"
              placeholder="Jane Doe"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold tracking-widest text-gray-400">Work email *</label>
            <input
              required
              name="email"
              type="email"
              className="border-2 border-black px-4 py-3 text-[14px] font-medium outline-none focus:border-[#FE7F2D] transition-colors"
              placeholder="jane@company.com"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold tracking-widest text-gray-400">Company</label>
          <input
            name="company"
            type="text"
            className="border-2 border-black px-4 py-3 text-[14px] font-medium outline-none focus:border-[#FE7F2D] transition-colors"
            placeholder="Acme Corp"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold tracking-widest text-gray-400">Inquiry type *</label>
          <select
            required
            name="inquiryType"
            defaultValue="Sales & Enterprise"
            className="border-2 border-black px-4 py-3 text-[14px] font-medium outline-none focus:border-[#FE7F2D] transition-colors appearance-none bg-white"
          >
            <option>Sales & Enterprise</option>
            <option>Technical Support</option>
            <option>Partnerships</option>
            <option>Other</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold tracking-widest text-gray-400">Message *</label>
          <textarea
            required
            name="message"
            rows={5}
            className="border-2 border-black px-4 py-3 text-[14px] font-medium outline-none focus:border-[#FE7F2D] transition-colors resize-none"
            placeholder="How can we help you?"
          />
        </div>
        {status === "error" && (
          <p className="text-[12px] font-semibold text-red-600">Something went wrong. Please try again.</p>
        )}
        <button
          type="submit"
          disabled={status === "submitting"}
          className="w-full flex items-center justify-center gap-3 border-2 border-black bg-black text-white py-5 text-[15px] font-semibold tracking-widest shadow-[6px_6px_0px_0px_rgba(254,127,45,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_0px_rgba(254,127,45,1)] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all disabled:opacity-60 disabled:pointer-events-none"
        >
          {status === "submitting" ? "Sending..." : "Send message"}
          <SendIcon />
        </button>
      </form>
    </div>
  );
}
