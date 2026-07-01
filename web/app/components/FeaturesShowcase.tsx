'use client';

import { useState } from 'react';

const features = [
  {
    id: 'helpdesk',
    label: 'Fully-featured helpdesk',
    description: 'Comprehensive support system built for modern teams',
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=600&fit=crop',
  },
  {
    id: 'ai-agent',
    label: 'Natively integrated AI Agent',
    description: 'AI that understands your business processes',
    image: 'https://images.unsplash.com/photo-1677442d019cecf8d87d51e5a91af4c4?w=1200&h=600&fit=crop',
  },
  {
    id: 'insights',
    label: 'AI-powered Insights',
    description: 'Deep analytics and actionable intelligence',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=600&fit=crop',
  },
  {
    id: 'system',
    label: 'Self-improving system',
    description: 'Continuously learning and adapting to your needs',
    image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&h=600&fit=crop',
  },
];

export function FeaturesShowcase() {
  const [activeTab, setActiveTab] = useState(0);
  const activeFeature = features[activeTab];

  return (
    <div className="mt-32 flex flex-col items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="w-full max-w-5xl">
        {/* Tabs */}
        <div className="border-b border-black/20 mb-8">
          <div className="flex gap-8">
            {features.map((feature, index) => (
              <button
                key={feature.id}
                onClick={() => setActiveTab(index)}
                className={`pb-4 text-lg font-medium transition-colors relative ${
                  activeTab === index
                    ? 'text-black'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {feature.label}
                {activeTab === index && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="rounded-lg overflow-hidden border border-black/10 bg-white shadow-lg">
          <img
            src={activeFeature.image}
            alt={activeFeature.label}
            className="w-full h-96 object-cover"
          />
        </div>

        {/* Description */}
        <p className="mt-6 text-center text-slate-600 text-lg">
          {activeFeature.description}
        </p>
      </div>
    </div>
  );
}
