import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Minus, Plus, ChevronDown, Check, SlidersHorizontal, RotateCcw } from 'lucide-react';

export interface TimePreset {
  label: string;
  value: number;
  description?: string;
  isDefault?: boolean;
}

export interface ScrubbableTimeInputProps {
  value: number;
  onChange: (newValue: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  precision?: number;
  label?: string;
  icon?: React.ReactNode;
  presets?: TimePreset[];
  showPlusMinus?: boolean;
  showPresetsDropdown?: boolean;
  size?: 'xs' | 'sm' | 'md';
  accentColor?: string;
  disabled?: boolean;
  className?: string;
  tooltipTitle?: string;
}

export const ScrubbableTimeInput: React.FC<ScrubbableTimeInputProps> = ({
  value,
  onChange,
  min = 0.1,
  max = 60.0,
  step = 0.5,
  unit = 's',
  precision = 1,
  label,
  icon,
  presets,
  showPlusMinus = true,
  showPresetsDropdown = true,
  size = 'sm',
  accentColor = '#c6ff1f',
  disabled = false,
  className = '',
  tooltipTitle,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value.toFixed(precision));
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubDelta, setScrubDelta] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);

  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrubStartXRef = useRef<number>(0);
  const scrubStartValRef = useRef<number>(value);
  const hasMovedSignificantlyRef = useRef<boolean>(false);
  const valueRef = useRef<number>(value);
  valueRef.current = value;

  // Sync input value when external value changes
  useEffect(() => {
    if (!isEditing) {
      setInputValue(value.toFixed(precision));
    }
  }, [value, precision, isEditing]);

  // Round and clamp helper
  const clampValue = useCallback((val: number): number => {
    const clamped = Math.max(min, Math.min(max, val));
    return Number(clamped.toFixed(precision));
  }, [min, max, precision]);

  // Handle value commit
  const handleCommit = useCallback((newVal: number) => {
    if (disabled) return;
    const clamped = clampValue(newVal);
    if (clamped !== value) {
      onChange(clamped);
    }
  }, [disabled, clampValue, value, onChange]);

  // Scroll wheel adjusting with modifier support
  useEffect(() => {
    const badgeEl = badgeRef.current;
    if (!badgeEl) return;

    const handleWheel = (e: WheelEvent) => {
      if (disabled || isEditing) return;
      e.preventDefault();
      e.stopPropagation();

      // Multiplier: Shift = 4x step, Alt/Ctrl = 0.2x step or 0.1s
      let mult = 1;
      if (e.shiftKey) mult = 4;
      else if (e.altKey || e.ctrlKey || e.metaKey) mult = 0.2;

      const delta = e.deltaY < 0 ? step * mult : -(step * mult);
      handleCommit(value + delta);
    };

    badgeEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      badgeEl.removeEventListener('wheel', handleWheel);
    };
  }, [disabled, isEditing, step, value, handleCommit]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
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

  // Focus and select input text when entering inline edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Inline edit input submit
  const submitInlineEdit = () => {
    const cleaned = inputValue.replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed)) {
      handleCommit(parsed);
    } else {
      setInputValue(value.toFixed(precision));
    }
    setIsEditing(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      submitInlineEdit();
    } else if (e.key === 'Escape') {
      setInputValue(value.toFixed(precision));
      setIsEditing(false);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const mult = e.shiftKey ? 4 : 1;
      handleCommit(value + step * mult);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const mult = e.shiftKey ? 4 : 1;
      handleCommit(value - step * mult);
    }
  };

  // Horizontal scrub drag handling
  const handleBadgeMouseDown = (e: React.MouseEvent) => {
    if (disabled || isEditing || e.button !== 0) return;
    scrubStartXRef.current = e.clientX;
    scrubStartValRef.current = value;
    hasMovedSignificantlyRef.current = false;
    setScrubDelta(0);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const diffX = moveEvent.clientX - scrubStartXRef.current;
      if (Math.abs(diffX) > 3) {
        hasMovedSignificantlyRef.current = true;
        setIsScrubbing(true);
      }

      if (hasMovedSignificantlyRef.current) {
        let mult = 1;
        if (moveEvent.shiftKey) mult = 4;
        else if (moveEvent.altKey || moveEvent.ctrlKey) mult = 0.2;

        // Each 12 pixels is 1 step
        const stepChanges = (diffX / 12) * step * mult;
        const targetVal = scrubStartValRef.current + stepChanges;
        const clamped = clampValue(targetVal);
        setScrubDelta(Number((clamped - scrubStartValRef.current).toFixed(precision)));
        onChange(clamped);
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setIsScrubbing(false);
      setScrubDelta(0);

      // If user merely clicked without dragging, open inline typing!
      if (!hasMovedSignificantlyRef.current) {
        setIsEditing(true);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Repeat on hold for Plus / Minus buttons
  const startHold = (direction: 'inc' | 'dec') => {
    if (disabled) return;
    const delta = direction === 'inc' ? step : -step;
    handleCommit(valueRef.current + delta);

    // After 350ms initial delay, repeat every 75ms
    holdTimeoutRef.current = setTimeout(() => {
      holdIntervalRef.current = setInterval(() => {
        handleCommit(valueRef.current + delta);
      }, 75);
    }, 350);
  };

  const stopHold = () => {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
  };

  // Size styling classes
  const sizeClasses = {
    xs: {
      wrapper: 'text-[10px] h-5',
      btn: 'w-3.5 h-3.5',
      icon: 'w-2 h-2',
      badge: 'px-1 py-0.5 text-[9px]',
      input: 'w-9 text-[9px]',
    },
    sm: {
      wrapper: 'text-[11px] h-6',
      btn: 'w-4 h-4',
      icon: 'w-2.5 h-2.5',
      badge: 'px-1.5 py-0.5 text-[10.5px]',
      input: 'w-12 text-[10px]',
    },
    md: {
      wrapper: 'text-xs h-7',
      btn: 'w-5 h-5',
      icon: 'w-3 h-3',
      badge: 'px-2 py-0.5 text-xs',
      input: 'w-14 text-xs',
    },
  }[size];

  const defaultTooltip = tooltipTitle || `${label ? `${label}: ` : ''}${value.toFixed(precision)}${unit} · Scroll wheel or drag horizontally · Click to type · Chevron for presets`;

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center select-none ${className}`}
      title={isEditing ? undefined : defaultTooltip}
    >
      <div
        className={`flex items-center bg-[#181a24] border border-white/10 rounded-md p-0.5 shadow-xs transition-all ${
          isScrubbing ? 'ring-1 ring-[#c6ff1f]/70 border-[#c6ff1f]/50' : 'hover:border-white/20'
        } ${sizeClasses.wrapper}`}
      >
        {/* Optional Label / Icon */}
        {(icon || label) && (
          <div className="flex items-center gap-1 px-1 text-gray-400 shrink-0 font-medium select-none pointer-events-none">
            {icon}
            {label && (
              <span className="text-[9.5px] uppercase tracking-wider font-semibold opacity-90 hidden sm:inline">
                {label}:
              </span>
            )}
          </div>
        )}

        {/* Minus Button */}
        {showPlusMinus && (
          <button
            type="button"
            onMouseDown={() => startHold('dec')}
            onMouseUp={stopHold}
            onMouseLeave={stopHold}
            disabled={disabled || value <= min}
            className={`${sizeClasses.btn} flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors shrink-0`}
            title={`Decrease (-${step}${unit}) · Hold to ramp down`}
            aria-label="Decrease time"
          >
            <Minus className={sizeClasses.icon} />
          </button>
        )}

        {/* Value Badge / Editable Input */}
        <div
          ref={badgeRef}
          onMouseDown={handleBadgeMouseDown}
          className={`flex items-center justify-center font-mono font-bold tabular-nums cursor-ew-resize rounded transition-colors group relative ${
            isScrubbing ? 'bg-[#c6ff1f]/20 text-[#c6ff1f]' : 'hover:bg-white/5 text-white'
          } ${sizeClasses.badge}`}
        >
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onBlur={submitInlineEdit}
              onKeyDown={handleInputKeyDown}
              className={`bg-black/90 text-white font-mono font-bold border border-[#c6ff1f] rounded px-1 py-0 text-center outline-none ${sizeClasses.input}`}
              style={{ color: accentColor }}
            />
          ) : (
            <span
              className="flex items-center tracking-tight"
              style={{ color: accentColor }}
            >
              {value.toFixed(precision)}
              <span className="text-gray-400 text-[80%] font-normal ml-0.5">{unit}</span>
            </span>
          )}

          {/* Scrub Delta Floating Hint */}
          {isScrubbing && (
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black/95 text-white border border-[#c6ff1f]/50 px-1.5 py-0.5 rounded text-[9px] font-mono whitespace-nowrap shadow-xl pointer-events-none z-50">
              {scrubDelta >= 0 ? `+${scrubDelta.toFixed(precision)}` : scrubDelta.toFixed(precision)}{unit}
            </div>
          )}
        </div>

        {/* Plus Button */}
        {showPlusMinus && (
          <button
            type="button"
            onMouseDown={() => startHold('inc')}
            onMouseUp={stopHold}
            onMouseLeave={stopHold}
            disabled={disabled || value >= max}
            className={`${sizeClasses.btn} flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors shrink-0`}
            title={`Increase (+${step}${unit}) · Hold to ramp up`}
            aria-label="Increase time"
          >
            <Plus className={sizeClasses.icon} />
          </button>
        )}

        {/* Presets & Slider Popover Trigger */}
        {showPresetsDropdown && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) setIsDropdownOpen((prev) => !prev);
            }}
            className={`${sizeClasses.btn} flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0 ml-0.5`}
            title="Timing presets & slider"
            aria-label="Open presets"
          >
            <ChevronDown
              className={`${sizeClasses.icon} transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </div>

      {/* Modern Popover: Live Sweep Slider + Preset Tags */}
      {isDropdownOpen && (
        <div
          ref={popoverRef}
          className="absolute top-full right-0 mt-1.5 w-64 bg-[#14161f] border border-[#2b3042] rounded-xl shadow-2xl p-2.5 z-[100] backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-white/10">
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="w-3 h-3 text-[#c6ff1f]" />
              <span className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider">
                {label || 'Timing Settings'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-mono font-bold text-[#c6ff1f] tabular-nums">
                {value.toFixed(precision)}{unit}
              </span>
            </div>
          </div>

          {/* Sweep Range Slider */}
          <div className="mb-3 px-1">
            <div className="flex items-center justify-between text-[9px] font-mono text-gray-400 mb-1">
              <span>{min.toFixed(precision)}{unit}</span>
              <span className="text-gray-500">Drag Slider</span>
              <span>{max.toFixed(precision)}{unit}</span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={(e) => handleCommit(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-black/60 rounded-lg appearance-none cursor-pointer accent-[#c6ff1f] focus:outline-none"
            />
          </div>

          {/* Quick Curated Presets */}
          {presets && presets.length > 0 && (
            <div className="space-y-1 mb-2.5">
              <div className="text-[9px] text-gray-400 uppercase font-semibold tracking-wider px-1">
                Quick Presets
              </div>
              <div className="grid grid-cols-2 gap-1 max-h-36 overflow-y-auto custom-scrollbar pr-0.5">
                {presets.map((preset) => {
                  const isCurrent = Math.abs(value - preset.value) < 0.05;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => {
                        handleCommit(preset.value);
                        setIsDropdownOpen(false);
                      }}
                      className={`flex items-center justify-between px-2 py-1 rounded text-left transition-colors cursor-pointer text-[10px] font-mono ${
                        isCurrent
                          ? 'bg-[#c6ff1f] text-black font-bold shadow-xs'
                          : 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white'
                      }`}
                    >
                      <span className="truncate">{preset.label}</span>
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <span className={isCurrent ? 'text-black font-bold' : 'text-gray-400'}>
                          {preset.value.toFixed(precision)}{unit}
                        </span>
                        {isCurrent && <Check className="w-2.5 h-2.5 stroke-[3] text-black" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Increment Bumps & Mouse Scroll Tips */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[9px] text-gray-400">
            <span className="flex items-center gap-1">
              <span>Scroll wheel to nudge</span>
            </span>
            <div className="flex items-center gap-1 font-mono">
              <button
                type="button"
                onClick={() => handleCommit(value - step * 2)}
                disabled={value <= min}
                className="px-1 py-0.5 rounded bg-white/5 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                title={`-${(step * 2).toFixed(precision)}${unit}`}
              >
                -{(step * 2).toFixed(precision)}{unit}
              </button>
              <button
                type="button"
                onClick={() => handleCommit(value + step * 2)}
                disabled={value >= max}
                className="px-1 py-0.5 rounded bg-white/5 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                title={`+${(step * 2).toFixed(precision)}${unit}`}
              >
                +{(step * 2).toFixed(precision)}{unit}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
