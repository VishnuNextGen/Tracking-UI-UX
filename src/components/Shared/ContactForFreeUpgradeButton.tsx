import React from 'react';
import { Sparkles } from 'lucide-react';

interface ContactForFreeUpgradeButtonProps {
  variant?: 'floating' | 'menu-item' | 'compact' | 'card';
  onClick?: () => void;
  className?: string;
}

export const ContactForFreeUpgradeButton: React.FC<ContactForFreeUpgradeButtonProps> = ({
  variant = 'floating',
  onClick,
  className = '',
}) => {
  if (variant === 'menu-item') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-full text-left px-3 py-2 text-xs text-[#c6ff1f] hover:text-white hover:bg-[#c6ff1f]/10 flex items-center justify-between gap-2 transition-colors cursor-pointer font-medium ${className}`}
        title="Free tier offer: Contact founder for a free upgrade"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-[#c6ff1f] shrink-0" />
          <span className="truncate">Contact for free upgrade</span>
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#c6ff1f]/20 text-[#c6ff1f] font-bold shrink-0">Free</span>
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#c6ff1f] hover:bg-[#d4ff4d] text-black transition-all cursor-pointer whitespace-nowrap shadow-sm shadow-[#c6ff1f]/20 ${className}`}
        title="Contact founder for a free upgrade"
      >
        <Sparkles className="w-3.5 h-3.5 text-black shrink-0" />
        <span>Contact for free upgrade</span>
      </button>
    );
  }

  if (variant === 'card') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-full block p-2.5 rounded-xl bg-[#c6ff1f]/10 hover:bg-[#c6ff1f]/20 border border-[#c6ff1f]/30 hover:border-[#c6ff1f]/60 transition-all group cursor-pointer text-left ${className}`}
        title="Contact founder for a free upgrade"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-[#c6ff1f] text-black flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-white group-hover:text-[#c6ff1f] transition-colors truncate">
                Contact for free upgrade
              </div>
              <div className="text-[10px] text-white/50 truncate">
                Complimentary Pro Access
              </div>
            </div>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#c6ff1f]/20 text-[#c6ff1f] font-bold shrink-0">Free</span>
        </div>
      </button>
    );
  }

  // Default: 'floating' (sits right above Chat with Founder)
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group px-3 py-1.5 rounded-full text-xs font-bold text-black bg-gradient-to-r from-[#c6ff1f] via-[#d4ff4d] to-[#bbf412] hover:brightness-110 border border-[#c6ff1f] shadow-lg shadow-[#c6ff1f]/30 hover:shadow-[#c6ff1f]/50 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${className}`}
      title="Free tier offer: Contact founder for a free upgrade"
    >
      <Sparkles className="w-3.5 h-3.5 text-black shrink-0 animate-pulse" />
      <span>Contact for free upgrade</span>
      <span className="text-[10px] bg-black/20 text-black px-1 py-0.5 rounded font-black tracking-wider uppercase">Free</span>
    </button>
  );
};
