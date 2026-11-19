import React from 'react';

export interface WorkspaceToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  colorClass?: string;
  disabled?: boolean;
}

export const WorkspaceToggleSwitch: React.FC<WorkspaceToggleSwitchProps> = React.memo(
  ({ checked, onChange, colorClass = 'bg-[#c6ff1f]', disabled }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={`w-7 h-4 rounded-full relative transition-colors shrink-0 outline-none focus-visible:ring-1 focus-visible:ring-[#c6ff1f] ${
        checked ? colorClass : 'bg-[#2a2a2c] hover:bg-[#333]'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div
        className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all duration-150 shadow-sm pointer-events-none ${
          checked ? 'left-3.5' : 'left-0.5'
        }`}
      />
    </button>
  )
);

export const SectionHeader = ({ icon: Icon, title, subtitle, colorClass, bgClass, borderClass }: any) => (
  <div className="flex items-center gap-2 mb-2">
    <div className={`p-1 rounded border shadow-sm ${bgClass} ${borderClass}`}>
      <Icon className={`w-3 h-3 ${colorClass}`} />
    </div>
    <div>
      <h3 className="text-[11px] font-bold text-gray-100 tracking-tight leading-none">{title}</h3>
      <p className="text-[8px] text-gray-500 font-semibold uppercase tracking-wider leading-none mt-0.5">{subtitle}</p>
    </div>
  </div>
);

export const RangeSlider = ({ label, value, onChange, min, max, step, unit, accentClass }: any) => (
  <div className="space-y-1.5">
    <div className="flex justify-between items-center">
      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{label}</label>
      <span className="text-[10px] font-mono text-gray-300 bg-[#1a1a1c] px-1.5 py-0.5 rounded border border-[#2a2a2c]">
        {value}
        {unit}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={onChange}
      className={`w-full h-1 bg-[#2a2a2c] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full ${accentClass}`}
    />
  </div>
);
