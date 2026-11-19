import React, { useState, useRef, useEffect } from 'react';
import { Minus, Plus, Layers, Sparkles, Check, Film, Lock } from 'lucide-react';
import { Shape } from '../../../types';
import { getStepOrdinal, calculateStepAnimStart } from '../../../utils/freezeFrameSteps';
import { ScrubbableTimeInput, TimePreset } from '../../Shared/ScrubbableTimeInput';

interface FreezeFrameStepSelectorProps {
  currentStep: number | null;
  onStepChange: (newStep: number | null) => void;
  stepDelay?: number;
  onStepDelayChange?: (newDelay: number) => void;
  selectedShape?: Shape | null;
  onSelectedShapeStepChange?: (newStep: number | null) => void;
  hasActiveFreezeFrame?: boolean;
  disabled?: boolean;
  onOpenAnimationPanel?: () => void;
  isAnimationPanelOpen?: boolean;
}

export const FreezeFrameStepSelector: React.FC<FreezeFrameStepSelectorProps> = ({
  currentStep,
  onStepChange,
  stepDelay = 1.5,
  onStepDelayChange,
  selectedShape = null,
  onSelectedShapeStepChange,
  hasActiveFreezeFrame = false,
  disabled = false,
  onOpenAnimationPanel,
  isAnimationPanelOpen = false
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // If a shape is selected, its step takes precedence in display and modification
  const isEditingSelected = Boolean(selectedShape);
  const effectiveStep: number | null = isEditingSelected && selectedShape
    ? (selectedShape.step !== undefined ? selectedShape.step : currentStep)
    : currentStep;

  // Requirement: Steps inactive on temp drawings, works only for freeze frames
  const isInactiveOnTemp = !hasActiveFreezeFrame && !selectedShape?.freezeFrameId;
  const isEffectivelyDisabled = disabled || isInactiveOnTemp;

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEffectivelyDisabled) return;
    if (effectiveStep === null) return;
    // Decrementing from Step 0 switches to No Step (null)
    const nextStep = effectiveStep <= 0 ? null : effectiveStep - 1;
    if (isEditingSelected && onSelectedShapeStepChange) {
      onSelectedShapeStepChange(nextStep);
    } else {
      onStepChange(nextStep);
    }
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEffectivelyDisabled) return;
    // Incrementing from null switches to Step 0
    const nextStep = effectiveStep === null ? 0 : effectiveStep + 1;
    if (isEditingSelected && onSelectedShapeStepChange) {
      onSelectedShapeStepChange(nextStep);
    } else {
      onStepChange(nextStep);
    }
  };

  const handleSelectStep = (stepNumber: number | null) => {
    if (isEditingSelected && onSelectedShapeStepChange) {
      onSelectedShapeStepChange(stepNumber);
    } else {
      onStepChange(stepNumber);
    }
    setIsDropdownOpen(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isDropdownOpen]);

  const timeOffset = typeof effectiveStep === 'number' ? calculateStepAnimStart(effectiveStep, stepDelay) : 0;
  const ordinal = typeof effectiveStep === 'number' ? getStepOrdinal(effectiveStep) : '';

  // Inactive state on temporary drawings
  if (isInactiveOnTemp) {
    return (
      <div 
        ref={dropdownRef}
        className="relative flex items-center shrink-0 z-30 select-none"
        title="Steps are inactive on temporary drawings. Create or select a Freeze Frame to animate steps."
      >
        <div className="flex items-center bg-[#15171d]/70 border border-white/5 rounded-md px-1.5 py-0.5 text-gray-500 text-[10px] font-mono">
          <span className="opacity-60 mr-1 hidden xl:inline">Steps:</span>
          <span className="text-gray-400 font-medium">FF only</span>
          
          {onOpenAnimationPanel && (
            <>
              <div className="h-3 w-[1px] bg-white/10 mx-1" />
              <button
                type="button"
                onClick={onOpenAnimationPanel}
                className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-[#c6ff1f] hover:bg-white/10 transition-colors cursor-pointer"
                title="Convert to Freeze Frame & Open Animation Timeline"
                aria-label="Open animation timeline"
              >
                <Film className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={dropdownRef}
      className="relative flex items-center shrink-0 z-30 select-none"
      title={typeof effectiveStep === 'number' 
        ? `Step ${effectiveStep}: appears ${ordinal} at ${timeOffset.toFixed(1)}s (Delay: ${stepDelay.toFixed(1)}s)` 
        : 'No Step: Custom timing in Animation Timeline'}
    >
      <div 
        className={`flex items-center bg-[#15171d] border ${
          isEditingSelected 
            ? 'border-[#c6ff1f]/60 shadow-[0_0_8px_rgba(198,255,31,0.2)]' 
            : 'border-white/15 hover:border-white/25'
        } rounded-md p-0.5 transition-all text-[11px]`}
      >
        {/* Decrement Button (-) */}
        <button
          type="button"
          onClick={handleDecrement}
          disabled={isEffectivelyDisabled || effectiveStep === null}
          className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors cursor-pointer disabled:cursor-not-allowed"
          aria-label="Decrease step"
          title={effectiveStep === 0 ? "Switch to No Step (Freeform)" : effectiveStep === null ? "No Step" : `Decrease to Step ${effectiveStep - 1}`}
        >
          <Minus className="w-3 h-3 stroke-[2.5]" />
        </button>

        {/* Center Step Badge & Quick Picker Trigger */}
        <button
          type="button"
          onClick={() => !isEffectivelyDisabled && setIsDropdownOpen(prev => !prev)}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-left transition-colors cursor-pointer group ${
            isEditingSelected ? 'hover:bg-[#c6ff1f]/10' : 'hover:bg-white/5'
          }`}
          title="Click to pick a step or set to No Step (Freeform)"
        >
          <div className="flex items-center gap-1">
            {isEditingSelected && selectedShape ? (
              <span 
                className="w-1.5 h-1.5 rounded-full ring-1 ring-white/30 shrink-0" 
                style={{ backgroundColor: selectedShape.color || '#c6ff1f' }} 
              />
            ) : (
              <Layers className="w-2.5 h-2.5 text-[#c6ff1f] shrink-0" />
            )}
            <span className="text-[10px] font-mono font-bold text-white tracking-wide">
              {typeof effectiveStep === 'number' ? `Step ${effectiveStep}` : 'No Step'}
            </span>
          </div>

          {typeof effectiveStep === 'number' && (
            <span className="text-[8.5px] font-mono text-gray-400 group-hover:text-gray-200 hidden xl:inline">
              ({timeOffset.toFixed(1)}s)
            </span>
          )}
        </button>

        {/* Increment Button (+) */}
        <button
          type="button"
          onClick={handleIncrement}
          disabled={isEffectivelyDisabled}
          className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent transition-colors cursor-pointer"
          aria-label="Increase step"
          title={effectiveStep === null ? "Activate Steps (Start at Step 0)" : `Increase to Step ${effectiveStep + 1}`}
        >
          <Plus className="w-3 h-3 stroke-[2.5]" />
        </button>

        {/* Requirement: Button to open animation panel directly from steps */}
        {onOpenAnimationPanel && (
          <>
            <div className="h-3 w-[1px] bg-white/15 mx-0.5" />
            <button
              type="button"
              onClick={onOpenAnimationPanel}
              className={`w-5 h-5 flex items-center justify-center rounded transition-all cursor-pointer ${
                isAnimationPanelOpen
                  ? 'bg-[#c6ff1f] text-black font-bold shadow-xs'
                  : 'text-gray-400 hover:text-[#c6ff1f] hover:bg-white/10'
              }`}
              title={isAnimationPanelOpen ? "Close Animation Timeline Panel" : "Open Animation Timeline Panel"}
              aria-label="Open animation timeline panel"
            >
              <Film className="w-3 h-3" />
            </button>
          </>
        )}
      </div>

      {/* Quick Step Picker Popover */}
      {isDropdownOpen && (
        <div 
          className="absolute top-full left-0 mt-1.5 w-64 bg-[#12141a] border border-[#2a2e3d] rounded-xl shadow-2xl py-2 px-1 z-50 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-2 pb-1.5 mb-1.5 border-b border-white/5 flex items-center justify-between gap-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate">
              {isEditingSelected ? 'Selected Tool Step' : 'Draw Tool Step'}
            </span>
            {onStepDelayChange ? (
              <ScrubbableTimeInput
                value={stepDelay}
                onChange={onStepDelayChange}
                min={0.2}
                max={10.0}
                step={0.25}
                precision={1}
                label="Delay"
                size="xs"
                accentColor="#c6ff1f"
                showPresetsDropdown={true}
                presets={[
                  { label: '0.5s Rapid', value: 0.5 },
                  { label: '1.0s Snappy', value: 1.0 },
                  { label: '1.5s Standard', value: 1.5, isDefault: true },
                  { label: '2.0s Paced', value: 2.0 },
                  { label: '2.5s Relaxed', value: 2.5 },
                  { label: '3.0s Deliberate', value: 3.0 },
                  { label: '4.0s Slow', value: 4.0 },
                ]}
                tooltipTitle={`Step Delay: ${stepDelay.toFixed(1)}s. Scroll wheel or drag horizontally to adjust.`}
              />
            ) : (
              <span className="text-[9px] font-mono text-gray-500 shrink-0">
                Delay: {stepDelay.toFixed(1)}s
              </span>
            )}
          </div>

          {/* Quick Activate Steps Banner if currently No Step */}
          {effectiveStep === null && (
            <button
              type="button"
              onClick={() => handleSelectStep(0)}
              className="w-full mb-1 flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors text-left bg-[#c6ff1f]/15 hover:bg-[#c6ff1f]/25 text-[#c6ff1f] border border-[#c6ff1f]/30 font-semibold cursor-pointer shadow-xs"
              title="Activate stepped sequencing starting at Step 0"
            >
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Activate Steps</span>
              </div>
              <span className="text-[9.5px] font-bold bg-[#c6ff1f] text-black px-1.5 py-0.5 rounded">
                Start Step 0
              </span>
            </button>
          )}

          <div className="grid grid-cols-1 gap-0.5 max-h-56 overflow-y-auto custom-scrollbar">
            {/* Option: No Step (Freeform) */}
            <button
              type="button"
              onClick={() => handleSelectStep(null)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors text-left ${
                effectiveStep === null
                  ? 'bg-[#c6ff1f] text-black font-bold shadow-sm'
                  : 'text-gray-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-bold">No Step</span>
                <span className={`text-[9.5px] ${effectiveStep === null ? 'text-black/80 font-semibold' : 'text-gray-400'}`}>
                  (Freeform)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-[9.5px] font-mono ${effectiveStep === null ? 'text-black/80 font-bold' : 'text-gray-400'}`}>
                  Timeline
                </span>
                {effectiveStep === null && <Check className="w-3.5 h-3.5 stroke-[3] ml-1 text-black" />}
              </div>
            </button>

            <div className="my-1 border-t border-white/5" />

            {/* Stepped Options */}
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(stepNum => {
              const startT = calculateStepAnimStart(stepNum, stepDelay);
              const ord = getStepOrdinal(stepNum);
              const isSelected = effectiveStep === stepNum;

              return (
                <button
                  key={stepNum}
                  type="button"
                  onClick={() => handleSelectStep(stepNum)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors text-left ${
                    isSelected
                      ? 'bg-[#c6ff1f] text-black font-bold shadow-sm'
                      : 'text-gray-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold">Step {stepNum}</span>
                    <span className={`text-[10px] ${isSelected ? 'text-black/80 font-semibold' : 'text-gray-400'}`}>
                      ({ord})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-mono ${isSelected ? 'text-black/80 font-bold' : 'text-gray-400'}`}>
                      {startT.toFixed(1)}s
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3] ml-1 text-black" />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="px-2 pt-2 mt-1 border-t border-white/5 text-[8.5px] text-gray-400 leading-tight">
            Use 'No Step' for freeform timing, or assign steps (Step 0, 1, 2...) for sequenced reveals.
          </div>
        </div>
      )}
    </div>
  );
};
