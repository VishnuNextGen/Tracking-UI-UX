import React from 'react';
import { User, Ghost, Sparkles, Layers, Sliders, Check } from 'lucide-react';
import type { PlayerMovePanelProps, PlayerMoveMode } from './types';

const SectionHeader: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}> = ({ icon: Icon, title, subtitle, colorClass, bgClass, borderClass }) => (
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

const RangeSlider: React.FC<{
  label: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
  accentClass: string;
}> = ({ label, value, onChange, min, max, step, unit, accentClass }) => (
  <div className="space-y-1.5">
    <div className="flex justify-between items-center">
      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{label}</label>
      <span className="text-[10px] font-mono text-gray-300 bg-[#1a1a1c] px-1.5 py-0.5 rounded border border-[#2a2a2c]">
        {value}{unit}
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

export const PlayerMovePanel: React.FC<PlayerMovePanelProps> = ({
  playerMoveState,
  onCancel,
  toolSize,
  onToolSizeChange,
  settings,
  onSettingsChange,
  telestrationPresetBlock,
}) => {
  const currentMode = settings.mode;

  const handleModeChange = (mode: PlayerMoveMode) => {
    onSettingsChange({ ...settings, mode });
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-200">
      <SectionHeader
        icon={User}
        title="Player Move Tool"
        subtitle="Tactical Relocation & Cutout"
        colorClass="text-[#c6ff1f]"
        bgClass="bg-[#c6ff1f]/10"
        borderClass="border-[#c6ff1f]/20"
      />
      {telestrationPresetBlock}

      {/* Step status banner */}
      <div className="p-2.5 rounded-lg bg-[#141416] border border-[#2a2a2e] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Current Step</span>
          <span
            className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded ${
              playerMoveState === 'idle'
                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                : playerMoveState === 'selecting'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse'
                : 'bg-[#c6ff1f]/15 text-[#c6ff1f] border border-[#c6ff1f]/30 animate-pulse'
            }`}
          >
            {playerMoveState === 'idle' && '1. Draw Box Over Player'}
            {playerMoveState === 'selecting' && 'Selecting Player...'}
            {playerMoveState === 'moving' && '2. Click Destination on Pitch'}
          </span>
        </div>
        <p className="text-[10px] text-gray-300 leading-snug">
          {playerMoveState === 'idle' && 'Click and drag a rectangle over the player to cut them out.'}
          {playerMoveState === 'selecting' && 'Release to capture the player cutout.'}
          {playerMoveState === 'moving' && 'Move your cursor to the desired tactical spot and click to relocate.'}
        </p>
        {playerMoveState !== 'idle' && (
          <button
            onClick={onCancel}
            className="w-full py-1 text-[9px] font-bold text-red-400 hover:text-white bg-red-900/20 hover:bg-red-900/40 border border-red-800/40 rounded transition-colors"
          >
            Cancel Selection (Esc)
          </button>
        )}
      </div>

      {/* Relocation Mode Selector */}
      <div className="p-2.5 rounded-lg bg-[#141416] border border-[#2a2a2e] space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3 h-3 text-[#c6ff1f]" /> Origin Fill Technique
          </label>
        </div>
        <div className="grid grid-cols-3 gap-1 bg-[#0d0e11] p-1 rounded-lg border border-[#262629]">
          <button
            type="button"
            onClick={() => handleModeChange('seamless-patch')}
            className={`py-1.5 px-1 rounded text-center transition-all flex flex-col items-center gap-0.5 ${
              currentMode === 'seamless-patch'
                ? 'bg-[#c6ff1f]/15 text-[#c6ff1f] border border-[#c6ff1f]/30 font-bold'
                : 'text-gray-400 hover:text-gray-200 border border-transparent'
            }`}
            title="Seamless Pitch Infill: Samples adjacent grass and applies feathered blending to dissolve into the pitch."
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-[9px] leading-tight">Pitch Infill</span>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('ghost')}
            className={`py-1.5 px-1 rounded text-center transition-all flex flex-col items-center gap-0.5 ${
              currentMode === 'ghost'
                ? 'bg-[#c6ff1f]/15 text-[#c6ff1f] border border-[#c6ff1f]/30 font-bold'
                : 'text-gray-400 hover:text-gray-200 border border-transparent'
            }`}
            title="Hudl Studio / Coach Paint standard: Keeps a clean faded ghost silhouette at the origin with zero fake grass artifacts."
          >
            <Ghost className="w-3.5 h-3.5" />
            <span className="text-[9px] leading-tight">Ghost (Hudl)</span>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('ghost-patch')}
            className={`py-1.5 px-1 rounded text-center transition-all flex flex-col items-center gap-0.5 ${
              currentMode === 'ghost-patch'
                ? 'bg-[#c6ff1f]/15 text-[#c6ff1f] border border-[#c6ff1f]/30 font-bold'
                : 'text-gray-400 hover:text-gray-200 border border-transparent'
            }`}
            title="Ghost + Infill: Combines feathered grass infill with a subtle tactical ghost silhouette."
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="text-[9px] leading-tight">Combined</span>
          </button>
        </div>

        {/* Explanatory note */}
        <p className="text-[9px] text-gray-500 leading-tight">
          {currentMode === 'ghost' && '✓ Ghost mode preserves origin position context without any grass seams.'}
          {currentMode === 'seamless-patch' && '✓ Elliptical feathered pitch sampling blends smoothly into turf.'}
          {currentMode === 'ghost-patch' && '✓ Dual mode: blends turf patch with subtle tactical ghost silhouette.'}
        </p>

        {/* Dynamic Sliders based on Mode */}
        {currentMode !== 'seamless-patch' && (
          <RangeSlider
            label="Ghost Opacity"
            value={Math.round(settings.ghostOpacity * 100)}
            onChange={(e: any) =>
              onSettingsChange({ ...settings, ghostOpacity: parseInt(e.target.value) / 100 })
            }
            min={15}
            max={75}
            step={5}
            unit="%"
            accentClass="[&::-webkit-slider-thumb]:bg-[#c6ff1f]"
          />
        )}

        {currentMode !== 'ghost' && (
          <RangeSlider
            label="Feather Softness"
            value={settings.featherRadius}
            onChange={(e: any) =>
              onSettingsChange({ ...settings, featherRadius: parseInt(e.target.value) })
            }
            min={8}
            max={36}
            step={2}
            unit="px"
            accentClass="[&::-webkit-slider-thumb]:bg-[#c6ff1f]"
          />
        )}

      </div>

      {/* Stroke & Style Controls */}
      <div className="space-y-3 pt-1">
        <RangeSlider
          label="Arrow Size"
          value={toolSize}
          onChange={(e: any) => onToolSizeChange(parseInt(e.target.value))}
          min={1}
          max={12}
          step={1}
          unit="px"
          accentClass="[&::-webkit-slider-thumb]:bg-[#c6ff1f]"
        />
      </div>
    </div>
  );
};
