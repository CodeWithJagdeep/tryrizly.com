import type { Metadata } from "next";
import Image from "next/image";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "Brand Kit",
  description: "Download Rizly brand assets and explore our visual guidelines.",
  alternates: { canonical: `${SITE_URL}/brand-kit` },
  openGraph: {
    title: "Brand Kit",
    description: "Rizly brand assets and visual guidelines.",
    url: `${SITE_URL}/brand-kit`,
    type: "website",
  },
};

const logos = [
  { name: "Logo Black", src: "/rizly_white.png", bg: "bg-white" },
  { name: "Logo White", src: "/rizly.png", bg: "bg-black" },
  { name: "Icon / Mark", src: "/rizly_white.png", bg: "bg-gray-50" },
];

const colors = [
  { name: "Rizly Orange", hex: "#D9BEF4", description: "Our primary energy. Used for actions, highlights, and status." },
  { name: "Off White", hex: "#fcfcfc", description: "The canvas. Provides a clean, professional space for content." },
  { name: "Absolute Black", hex: "#000000", description: "Structure and weight. Used for borders, text, and shadows." },
  { name: "Dark Blue", hex: "#233D4D", description: "Secondary accent for headers and supporting sections." },
];

const DownloadIcon = () => (
  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="20" width="20" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 10H18L12 16L6 10H11V3H13V10ZM4 19H20V12H22V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V12H4V19Z"></path>
  </svg>
);

const CopyIcon = () => (
  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="18" width="18" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.9998 6V3C6.9998 2.44772 7.44752 2 7.9998 2H19.9998C20.5521 2 20.9998 2.44772 20.9998 3V17C20.9998 17.5523 20.5521 18 19.9998 18H16.9998V20.9991C16.9998 21.5519 16.5499 22 15.993 22H4.00666C3.45059 22 3 21.5554 3 20.9991L3.0026 7.00087C3.0027 6.44811 3.45264 6 4.00942 6H6.9998ZM5.00242 8L5.00019 20H14.9998V8H5.00242ZM8.9998 6H16.9998V16H18.9998V4H8.9998V6Z"></path>
  </svg>
);

export default function BrandKitPage() {
  return (
    <main className="w-full">
      {/* Hero */}
      <section className="pt-32 pb-24 px-10 text-center relative border-b-2 border-black/10 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none -z-10 opacity-[0.03]"
          style={{ backgroundImage: "radial-gradient(rgb(0, 0, 0) 1px, transparent 1px)", backgroundSize: "32px 32px" }}
        ></div>
        <div className="max-w-4xl mx-auto">
          <span className="inline-block px-3 py-1 border-2 border-[#D9BEF4] text-[#D9BEF4] text-[12px] font-semibold uppercase tracking-[0.2em] mb-8">
            Brand identity
          </span>
          <h1 className="text-4xl md:text-6xl font-semibold uppercase tracking-normal leading-tight mb-10">
            Visual <br />
            <span className="text-[#D9BEF4]">guidelines</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-6 leading-relaxed">
            Download assets and explore the design language that defines Rizly, the AI operator built for founders.
          </p>
        </div>
      </section>

      {/* Logos */}
      <section className="px-10 md:px-14 py-32 border-b-2 border-black/10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
            <div>
              <span className="text-[#D9BEF4] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">Section 01</span>
              <h2 className="text-3xl md:text-5xl font-semibold uppercase tracking-normal">Official logos</h2>
            </div>
            <a
              href="/api/brand-kit"
              download="rizly-brand-kit.zip"
              className="flex items-center gap-3 border-2 border-black bg-black text-white px-10 py-5 text-[14px] font-semibold uppercase tracking-widest shadow-[8px_8px_0px_0px_rgba(217,190,244,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[10px_10px_0px_0px_rgba(217,190,244,1)] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all"
            >
              <DownloadIcon />
              Download all assets
            </a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {logos.map((logo) => (
              <div
                key={logo.name}
                className="border-2 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden flex flex-col group hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all"
              >
                <div className={`h-64 flex items-center justify-center p-12 border-b-2 border-black ${logo.bg}`}>
                  <Image
                    src={logo.src}
                    alt={logo.name}
                    width={240}
                    height={60}
                    className="object-contain transition-transform group-hover:scale-105"
                  />
                </div>
                <div className="p-6 flex justify-between items-center bg-gray-50">
                  <div>
                    <h4 className="text-[14px] font-semibold uppercase">{logo.name}</h4>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">PNG</span>
                  </div>
                  <a
                    href={logo.src}
                    download
                    className="w-12 h-12 border-2 border-black bg-white flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[6px_6px_0px_0px_rgba(217,190,244,1)] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all"
                  >
                    <DownloadIcon />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Colors */}
      <section className="px-10 md:px-14 py-32 border-b-2 border-black/10 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <span className="text-[#D9BEF4] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">Section 02</span>
            <h2 className="text-3xl md:text-5xl font-semibold uppercase tracking-normal">Color palette</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {colors.map((color) => (
              <div
                key={color.hex}
                className="border-2 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-8 group transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[10px_10px_0px_0px_rgba(217,190,244,1)]"
              >
                <div
                  className="w-full h-32 border-2 border-black mb-6 shadow-inner transition-transform group-hover:scale-[1.02]"
                  style={{ backgroundColor: color.hex }}
                ></div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-xl font-semibold uppercase">{color.name}</h4>
                  <button className="w-10 h-10 border-2 border-black bg-white flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(217,190,244,1)] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all">
                    <CopyIcon />
                  </button>
                </div>
                <p className="text-sm font-semibold text-[#D9BEF4] mb-4 uppercase tracking-widest">{color.hex}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{color.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Typography */}
      <section className="px-10 md:px-14 py-32 border-b-2 border-black/10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div>
            <span className="text-[#D9BEF4] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">Section 03</span>
            <h2 className="text-3xl md:text-5xl font-semibold uppercase tracking-normal mb-8">Typography</h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-12">
              We use the system font stack for clarity and speed. No special typefaces — just clean, readable text built for founders scanning fast.
            </p>
            <div className="space-y-6">
              <div className="border-b-2 border-black pb-4">
                <span className="text-sm font-semibold uppercase text-gray-400">Headlines</span>
                <p className="text-3xl font-semibold uppercase">System UI Semibold</p>
              </div>
              <div className="border-b-2 border-black pb-4">
                <span className="text-sm font-semibold uppercase text-gray-400">Body text</span>
                <p className="text-lg font-normal">System UI Regular</p>
              </div>
              <div className="border-b-2 border-black pb-4">
                <span className="text-sm font-semibold uppercase text-gray-400">Labels / status</span>
                <p className="text-base font-semibold uppercase tracking-widest">System UI Semibold, small caps</p>
              </div>
            </div>
          </div>
          <div className="border-2 border-black p-12 bg-white shadow-[12px_12px_0px_0px_rgba(217,190,244,1)]">
            <p className="text-[100px] font-semibold leading-none">Aa</p>
            <p className="text-xl font-semibold mt-4">ABCDEFGHIJKLM <br /> NOPQRSTUVWXYZ</p>
            <p className="text-xl font-normal mt-2">abcdefghijklm <br /> nopqrstuvwxyz</p>
            <p className="text-xl font-semibold mt-4">0123456789!@#$%</p>
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="px-10 md:px-14 py-40 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-semibold uppercase tracking-normal mb-12">Our design philosophy</h2>
          <p className="text-xl text-gray-500 leading-relaxed mb-16">
            Rizly's design is built on three pillars: <br />
            <span className="text-black font-medium">Clarity over decoration</span>, <br />
            <span className="text-black font-medium">Confidence without noise</span>, and <br />
            <span className="text-[#D9BEF4] font-medium">Approval-first trust</span>.
          </p>
          <div className="w-32 h-2 bg-black mx-auto"></div>
        </div>
      </section>
    </main>
  );
}
