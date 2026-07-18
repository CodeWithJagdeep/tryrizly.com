"use client";

import { motion } from "framer-motion";

type CoverProps = {
  category: string;
  title: string;
  slug: string;
  className?: string;
  aspectRatio?: "hero" | "card";
};

export function BlogCover({ category, className = "", aspectRatio = "card" }: CoverProps) {
  // Height setting based on layout
  const heightClass = aspectRatio === "hero" ? "h-64 md:h-full min-h-[300px]" : "h-40";

  // Category specific render
  const renderGraphic = () => {
    switch (category) {
      case "Company":
        return (
          // Node Network Connector Flow illustration
          <svg className="w-full h-full opacity-85" viewBox="0 0 400 200" fill="none">
            {/* Dotted Connection Grid */}
            <defs>
              <pattern id="dot-grid" width="16" height="16" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="#334155" opacity="0.3" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dot-grid)" />

            {/* Glowing lines */}
            <path d="M 80,100 L 200,100 M 200,100 L 320,100 M 200,100 L 200,40 M 200,100 L 200,160" stroke="#1e293b" strokeWidth="2" />
            
            {/* Active flow animations */}
            <motion.path
              d="M 80,100 H 200"
              stroke="url(#blue-gradient)"
              strokeWidth="2"
              strokeDasharray="6, 6"
              animate={{ strokeDashoffset: [0, -12] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            />
            <motion.path
              d="M 200,100 H 320"
              stroke="url(#teal-gradient)"
              strokeWidth="2"
              strokeDasharray="6, 6"
              animate={{ strokeDashoffset: [0, -12] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            />

            {/* Node Hubs */}
            {/* Left Node: Workspace Source */}
            <circle cx="80" cy="100" r="16" fill="#1e293b" stroke="#334155" strokeWidth="2" />
            <circle cx="80" cy="100" r="6" fill="#3b82f6" />
            
            {/* Top Node: Calendar */}
            <circle cx="200" cy="40" r="16" fill="#1e293b" stroke="#334155" strokeWidth="2" />
            <rect x="194" y="34" width="12" height="12" rx="2" fill="#14b8a6" />

            {/* Bottom Node: Email */}
            <circle cx="200" cy="160" r="16" fill="#1e293b" stroke="#334155" strokeWidth="2" />
            <path d="M 193,155 H 207 V 165 H 193 Z M 193,155 L 200,161 L 207,155" stroke="#a855f7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

            {/* Center Node: Riz Operator */}
            <circle cx="200" cy="100" r="24" fill="#0f172a" stroke="#2563eb" strokeWidth="2.5" />
            <circle cx="200" cy="100" r="12" fill="#2563eb" fillOpacity="0.2" />
            <circle cx="200" cy="100" r="5" fill="#3b82f6" />

            {/* Right Node: Telegram Client */}
            <circle cx="320" cy="100" r="16" fill="#1e293b" stroke="#334155" strokeWidth="2" />
            <path d="M 314,103 L 328,95 L 324,107 L 319,103 Z" fill="#38bdf8" />
            
            {/* Gradients */}
            <defs>
              <linearGradient id="blue-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
              <linearGradient id="teal-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#14b8a6" />
                <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        );
      case "Product":
        return (
          // Calendar Grid & Buffer Slots Layout Illustration
          <svg className="w-full h-full opacity-85" viewBox="0 0 400 200" fill="none">
            {/* Calendar grid lines */}
            <path d="M 20,40 H 380 M 20,80 H 380 M 20,120 H 380 M 20,160 H 380" stroke="#1e293b" strokeWidth="1" strokeDasharray="4, 4" />
            <path d="M 120,20 V 180 M 260,20 V 180" stroke="#1e293b" strokeWidth="1" />

            {/* Time markers */}
            <text x="24" y="32" fill="#475569" fontSize="9" fontWeight="bold" fontFamily="monospace">09:00 AM</text>
            <text x="24" y="72" fill="#475569" fontSize="9" fontWeight="bold" fontFamily="monospace">10:30 AM</text>
            <text x="24" y="112" fill="#475569" fontSize="9" fontWeight="bold" fontFamily="monospace">01:00 PM</text>

            {/* Booked slot */}
            <rect x="130" y="30" width="240" height="34" rx="6" fill="#3b82f6" fillOpacity="0.1" stroke="#3b82f6" strokeWidth="1.5" />
            <text x="140" y="50" fill="#93c5fd" fontSize="10" fontWeight="bold" fontFamily="sans-serif">Product Sprint Review</text>
            
            {/* Dynamic buffer slot added by Riz */}
            <rect x="130" y="70" width="240" height="34" rx="6" fill="#14b8a6" fillOpacity="0.08" stroke="#14b8a6" strokeWidth="1.5" strokeDasharray="3, 3" />
            <text x="140" y="90" fill="#2dd4bf" fontSize="10" fontWeight="bold" fontFamily="sans-serif">🛡️ Buffer Guard (Riz)</text>

            {/* Meeting slot */}
            <rect x="130" y="110" width="240" height="34" rx="6" fill="#8b5cf6" fillOpacity="0.1" stroke="#8b5cf6" strokeWidth="1.5" />
            <text x="140" y="130" fill="#c084fc" fontSize="10" fontWeight="bold" fontFamily="sans-serif">Stripe API Sync</text>
          </svg>
        );
      case "Guides":
        return (
          // Webhook Triage and Action Buttons mockups
          <svg className="w-full h-full opacity-85" viewBox="0 0 400 200" fill="none">
            {/* Inbox Card Mock */}
            <rect x="40" y="30" width="320" height="140" rx="12" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
            <rect x="40" y="30" width="320" height="32" rx="12" fill="#1e293b" />
            
            {/* Sender */}
            <circle cx="60" cy="46" r="6" fill="#ef4444" />
            <text x="74" y="50" fill="#94a3b8" fontSize="10" fontFamily="monospace">stripe_webhook_detector</text>
            <text x="320" y="50" fill="#475569" fontSize="9" fontFamily="monospace">LIVE</text>

            {/* Content lines */}
            <text x="56" y="84" fill="#f8fafc" fontSize="11" fontWeight="bold" fontFamily="sans-serif">Subscription payment failed: customer_892</text>
            <text x="56" y="104" fill="#64748b" fontSize="10" fontFamily="sans-serif">Draft response scheduled in Gmail via Co-founder account</text>

            {/* Action buttons */}
            <rect x="56" y="126" width="90" height="26" rx="13" fill="#10b981" />
            <text x="76" y="142" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="sans-serif">Approve Draft</text>
            <circle cx="66" cy="139" r="3" fill="#ffffff" />

            <rect x="156" y="126" width="90" height="26" rx="13" fill="#3b4f6b" fillOpacity="0.4" stroke="#475569" strokeWidth="1" />
            <text x="176" y="142" fill="#cbd5e1" fontSize="9" fontWeight="bold" fontFamily="sans-serif">Ignore Alert</text>
            <path d="M164,139 L168,139" stroke="#cbd5e1" strokeWidth="1.5" />
          </svg>
        );
      default:
        return (
          // Default fallbacks: Grid lines and ambient glow blob
          <svg className="w-full h-full opacity-80" viewBox="0 0 400 200" fill="none">
            <defs>
              <pattern id="card-dot-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="3" cy="3" r="1.2" fill="#4f46e5" opacity="0.15" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#card-dot-pattern)" />
            <circle cx="200" cy="100" r="60" fill="#4f46e5" fillOpacity="0.05" className="blur-[40px]" />
            <path d="M 50,100 H 350" stroke="#1e293b" strokeWidth="1.5" opacity="0.3" />
            <path d="M 200,20 V 180" stroke="#1e293b" strokeWidth="1.5" opacity="0.3" />
            <circle cx="200" cy="100" r="4" fill="#4f46e5" />
          </svg>
        );
    }
  };

  return (
    <div
      className={`relative w-full overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-800 ${heightClass} ${className}`}
    >
      {/* Dynamic graphic visualization matching the category */}
      {renderGraphic()}

      {/* Decorative linear bottom banner gradient */}
      <div className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-blue-500 via-teal-500 to-indigo-500 opacity-60" />
    </div>
  );
}
