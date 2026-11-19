import React, { useRef } from 'react';
import { ArrowLeftRight } from 'lucide-react';

export type TelestrationSlot = 'home' | 'away' | 'neutral';

export interface TelestrationColors {
  home: string;
  away: string;
  neutral: string;
}

export const DEFAULT_TELESTRATION_COLORS: TelestrationColors = {
  home: '#ef4444',     // Crimson / Red
  away: '#3b82f6',     // Royal Blue
  neutral: '#ffff00',  // Tactical Yellow
};

interface TelestrationColorPresetsProps {
  colors: TelestrationColors;
  activeSlot: TelestrationSlot | null;
  onSelectSlot: (slot: TelestrationSlot) => void;
  onUpdateColor: (slot: TelestrationSlot, color: string) => void;
  onSwapHomeAway?: () => void;
  onResetDefaults?: () => void;
}

export const TelestrationColorPresets: React.FC<TelestrationColorPresetsProps> = ({
  colors,
  activeSlot,
  onSelectSlot,
  onUpdateColor,
  onSwapHomeAway,
}) => {
  const homeColorInputRef = useRef<HTMLInputElement>(null);
  const awayColorInputRef = useRef<HTMLInputElement>(null);
  const neutralColorInputRef = useRef<HTMLInputElement>(null);

  const slots: Array<{
    id: TelestrationSlot;
    label: string;
    inputRef: React.RefObject<HTMLInputElement | null>;
    color: string;
  }> = [
    {
      id: 'home',
      label: 'Home',
      inputRef: homeColorInputRef,
      color: colors.home || DEFAULT_TELESTRATION_COLORS.home,
    },
    {
      id: 'away',
      label: 'Away',
      inputRef: awayColorInputRef,
      color: colors.away || DEFAULT_TELESTRATION_COLORS.away,
    },
    {
      id: 'neutral',
      label: 'Neut',
      inputRef: neutralColorInputRef,
      color: colors.neutral || DEFAULT_TELESTRATION_COLORS.neutral,
    },
  ];

  return (
    <div className="bg-[#121216] border border-[#23232a] rounded-lg p-1.5 space-y-1 mb-2 shrink-0">
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">
          Presets
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className="text-[7.5px] font-mono text-gray-400 flex items-center gap-0.5"
            title="Press Shift + C to cycle between Home, Away, and Neutral colors"
          >
            <kbd className="px-1 py-0.2 rounded bg-black/80 text-[#c6ff1f] font-bold border border-[#c6ff1f]/30">Shift+C</kbd>
          </span>
          {onSwapHomeAway && (
            <button
              type="button"
              onClick={onSwapHomeAway}
              className="p-0.5 text-gray-400 hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
              title="Swap Home & Away colors"
            >
              <ArrowLeftRight className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      </div>

      {/* Compact 3-Pill Row */}
      <div className="grid grid-cols-3 gap-1">
        {slots.map((slot) => {
          const isSelected = activeSlot === slot.id;
          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => onSelectSlot(slot.id)}
              onDoubleClick={(e) => {
                e.preventDefault();
                slot.inputRef.current?.click();
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                slot.inputRef.current?.click();
              }}
              className={`h-6 flex items-center justify-center gap-1 px-1 rounded-md border text-[9px] font-bold transition-all cursor-pointer relative ${
                isSelected
                  ? 'bg-[#1e1e26] border-white/60 text-white shadow-xs ring-1 ring-white/40'
                  : 'bg-[#16161b] border-[#292932] text-gray-400 hover:text-gray-200 hover:border-gray-500/40 hover:bg-[#1a1a20]'
              }`}
              title={`${slot.label} Preset (Shift+C to cycle) • Click to select, Double-click to choose color from spectrum`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm border border-black/30 cursor-pointer"
                style={{ backgroundColor: slot.color }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectSlot(slot.id);
                  slot.inputRef.current?.click();
                }}
                title="Click or double-click to pick color from spectrum"
              />
              <span className="truncate">{slot.label}</span>

              <input
                ref={slot.inputRef}
                type="color"
                value={slot.color}
                onChange={(e) => onUpdateColor(slot.id, e.target.value)}
                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer pointer-events-none"
                tabIndex={-1}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};
