import React from 'react';
import { ExternalLink } from 'lucide-react';

export const FOUNDER_LINKEDIN_URL = 'https://www.linkedin.com/in/vishnu-perikamana/';

export const LinkedInIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
  >
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

interface FounderConnectButtonProps {
  variant?: 'floating' | 'menu-item' | 'compact' | 'card' | 'footer';
  onClick?: () => void;
  className?: string;
}

export const FounderConnectButton: React.FC<FounderConnectButtonProps> = ({
  variant = 'floating',
  onClick,
  className = '',
}) => {
  if (variant === 'menu-item') {
    return (
      <a
        href={FOUNDER_LINKEDIN_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className={`w-full text-left px-3 py-2 text-xs text-white/80 hover:text-white hover:bg-white/5 flex items-center justify-between gap-2 transition-colors cursor-pointer ${className}`}
        title="Connect & chat with the Founder on LinkedIn"
      >
        <span className="flex items-center gap-2 min-w-0">
          <LinkedInIcon className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
          <span className="truncate">Chat with Founder</span>
        </span>
        <ExternalLink className="w-3 h-3 text-white/35 shrink-0" />
      </a>
    );
  }

  if (variant === 'compact') {
    return (
      <a
        href={FOUNDER_LINKEDIN_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#0A66C2]/15 hover:bg-[#0A66C2]/25 text-sky-300 hover:text-white border border-sky-400/25 hover:border-sky-400/45 transition-all cursor-pointer whitespace-nowrap ${className}`}
        title="Connect & chat with the Founder on LinkedIn"
      >
        <LinkedInIcon className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
        <span>Chat with Founder</span>
      </a>
    );
  }

  if (variant === 'card') {
    return (
      <a
        href={FOUNDER_LINKEDIN_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className={`block p-2.5 rounded-xl bg-[#0A66C2]/10 hover:bg-[#0A66C2]/20 border border-sky-400/20 hover:border-sky-400/40 transition-all group cursor-pointer ${className}`}
        title="Connect with Vishnu on LinkedIn"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-[#0A66C2] text-white flex items-center justify-center shrink-0 shadow-sm">
              <LinkedInIcon className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-white group-hover:text-[#c6ff1f] transition-colors truncate">
                Chat with Founder
              </div>
              <div className="text-[10px] text-white/50 truncate">
                Connect on LinkedIn
              </div>
            </div>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-white/40 group-hover:text-white transition-colors shrink-0" />
        </div>
      </a>
    );
  }

  if (variant === 'footer') {
    return (
      <a
        href={FOUNDER_LINKEDIN_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 text-gray-300 hover:text-[#c6ff1f] transition-colors font-medium ${className}`}
        title="Connect & chat with the Founder on LinkedIn"
      >
        <LinkedInIcon className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
        <span>Chat with Founder</span>
        <ExternalLink className="w-3 h-3 opacity-60" />
      </a>
    );
  }

  // Default: 'floating'
  return (
    <a
      href={FOUNDER_LINKEDIN_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={`glass px-3.5 py-2 rounded-full text-xs font-semibold text-white/90 hover:text-white hover:border-sky-400/50 transition-all flex items-center gap-2 shadow-xl hover:shadow-sky-500/15 cursor-pointer group ${className}`}
      title="Connect & chat with the Founder on LinkedIn"
    >
      <span className="w-4 h-4 rounded-[4px] bg-[#0A66C2] text-white flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
        <LinkedInIcon className="w-2.5 h-2.5" />
      </span>
      <span>Chat with Founder</span>
      <span className="text-[10px] text-sky-400/90 group-hover:text-[#c6ff1f] transition-colors">↗</span>
    </a>
  );
};
