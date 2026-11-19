import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`relative shrink-0 ${className}`}>
      <svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" className="w-full h-full block">
        <defs>
          <radialGradient id="logoApexGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#c6ff1f" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#c6ff1f" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Base squircle container */}
        <rect width="240" height="240" rx="54" fill="#111" />
        
        {/* Spirograph base geometric accents */}
        <g fill="none" stroke="#c6ff1f" strokeWidth="6">
          <rect x="50" y="50" width="140" height="140" rx="16" opacity="0.15" transform="rotate(0, 120, 120)" />
          <rect x="50" y="50" width="140" height="140" rx="16" opacity="0.25" transform="rotate(30, 120, 120)" />
          <rect x="50" y="50" width="140" height="140" rx="16" opacity="0.40" transform="rotate(60, 120, 120)" />
        </g>
        
        {/* Core data line */}
        <path
          d="M 50 170 L 95 105 L 145 135 L 190 75"
          fill="none"
          stroke="#c6ff1f"
          strokeWidth="20"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Nodes */}
        <circle cx="50" cy="170" r="14" fill="#111" stroke="#c6ff1f" strokeWidth="8" />
        <circle cx="95" cy="105" r="14" fill="#111" stroke="#c6ff1f" strokeWidth="8" />
        <circle cx="145" cy="135" r="14" fill="#111" stroke="#c6ff1f" strokeWidth="8" />
        
        {/* Final highlight node in white with subtle glow */}
        <circle cx="190" cy="75" r="32" fill="url(#logoApexGlow)" />
        <circle cx="190" cy="75" r="18" fill="#fff" />
      </svg>
    </div>
  );
};

export const Wordmark: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`text-center flex flex-col items-center justify-center ${className}`}>
      <div className="font-extrabold tracking-tight leading-none text-4xl">
        <span className="text-[#c6ff1f]">Tac</span>
        <span className="text-white">stem</span>
      </div>
      <div className="mt-2 text-[#888] text-[11px] tracking-[5px] uppercase font-semibold">
        Football Analysis
      </div>
    </div>
  );
};
