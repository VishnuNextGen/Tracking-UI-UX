import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Play, Pause, Square, Clock, ScanEye, Minus, Plus, Layers, Sparkles, ChevronDown, Check, Zap, SlidersHorizontal, Ban } from 'lucide-react';
import { Shape, FreezeFrame, ToolType } from '../types';
import { fadeColor } from '../utils/colors';
import { ScrubbableTimeInput, TimePreset } from './Shared/ScrubbableTimeInput';
import {
  DEFAULT_STEP_DELAY,
  MIN_END_GAP,
  getFreezeFrameStepDelay,
  getShapeStep,
  calculateStepAnimStart,
  calculateRequiredFreezeFrameDuration,
  calculateOptimalFreezeFrameDuration,
  assignShapeStep,
  syncFreezeFrameWithSteps,
  getStepOrdinal
} from '../utils/freezeFrameSteps';

const TOOL_ICONS: Record<string, React.FC<any>> = {
  'pen': () => <Square className="w-3 h-3" />,
  'arrow': () => <Square className="w-3 h-3" />,
  'line': () => <Square className="w-3 h-3" />,
  'circle': () => <Square className="w-3 h-3" />,
  'polygon': () => <Square className="w-3 h-3" />,
  'scanner': () => <ScanEye className="w-3 h-3" />,
};

const STEP_DELAY_PRESETS: TimePreset[] = [
  { label: 'Ultra Fast', value: 0.5, description: '0.5s rapid sequential reveals' },
  { label: 'Brisk', value: 0.75, description: '0.75s quick tempo' },
  { label: 'Snappy', value: 1.0, description: '1.0s clean cadence' },
  { label: 'Smooth', value: 1.25, description: '1.25s cadence' },
  { label: 'Standard', value: 1.5, description: '1.5s default standard', isDefault: true },
  { label: 'Paced', value: 2.0, description: '2.0s clear pause' },
  { label: 'Relaxed', value: 2.5, description: '2.5s for detailed tactics' },
  { label: 'Deliberate', value: 3.0, description: '3.0s presentation delay' },
  { label: 'Extended', value: 4.0, description: '4.0s slow analysis' },
  { label: 'Deep Study', value: 5.0, description: '5.0s deliberate hold' },
];

const DURATION_PRESETS: TimePreset[] = [
  { label: 'Brief Flash', value: 2.0 },
  { label: 'Quick Pause', value: 3.0 },
  { label: 'Standard Hold', value: 5.0, isDefault: true },
  { label: 'Medium Pause', value: 7.5 },
  { label: 'Extended Hold', value: 10.0 },
  { label: 'Detailed Breakdown', value: 15.0 },
  { label: 'Long Review', value: 20.0 },
  { label: 'In-Depth Analysis', value: 30.0 },
  { label: 'Comprehensive Hold', value: 45.0 },
  { label: 'Maximum', value: 60.0 },
];

export const AnimationPanel = ({
  freezeFrame,
  shapes,
  setShapes,
  onClose,
  previewTime,
  setPreviewTime,
  isPlaying,
  setIsPlaying,
  width,
  selectedShapeId,
  setSelectedShapeId,
  onUpdateFreezeFrame,
  overlappingTracks = [],
  onToggleTrackAvoidInFF
}: {
  freezeFrame: FreezeFrame;
  shapes: Shape[];
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
  onClose: () => void;
  previewTime: number;
  setPreviewTime: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
  width?: number;
  selectedShapeId: string | null;
  setSelectedShapeId: (id: string | null) => void;
  onUpdateFreezeFrame?: (updatedFF: FreezeFrame) => void;
  overlappingTracks?: Shape[];
  onToggleTrackAvoidInFF?: (trackId: string) => void;
}) => {
  const duration = freezeFrame.duration || 5;
  const stepDelay = getFreezeFrameStepDelay(freezeFrame);
  const ffShapes = shapes.filter(s => s.freezeFrameId === freezeFrame.id);
  const [dragging, setDragging] = useState<{ id: string, type: 'start' | 'end' | 'move', isDynamic?: boolean } | null>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [showOptimizeMenu, setShowOptimizeMenu] = useState(false);
  const [optimizeSuccessMsg, setOptimizeSuccessMsg] = useState<string | null>(null);
  const optimizeMenuRef = useRef<HTMLDivElement>(null);

  // Close optimize options dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (optimizeMenuRef.current && !optimizeMenuRef.current.contains(e.target as Node)) {
        setShowOptimizeMenu(false);
      }
    };
    if (showOptimizeMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showOptimizeMenu]);

  // Step and timing calculations for optimization
  const steppedShapes = ffShapes.filter(s => typeof s.step === 'number' && !isNaN(s.step));
  const optimalDurationTight = calculateOptimalFreezeFrameDuration(ffShapes, stepDelay, MIN_END_GAP);
  const optimalDurationComfortable = calculateOptimalFreezeFrameDuration(ffShapes, stepDelay, 2.5);
  const isAlreadyOptimal = Math.abs(duration - optimalDurationTight) < 0.15;

  // Direct duration change handler
  const handleDurationChange = (newDuration: number) => {
    const minDur = calculateRequiredFreezeFrameDuration(ffShapes, stepDelay, 1.5);
    const safeDur = Math.max(minDur, Math.min(60.0, Number(newDuration.toFixed(1))));
    const { updatedFreezeFrame, updatedShapes } = syncFreezeFrameWithSteps(freezeFrame, shapes, {
      newDuration: safeDur
    });

    setShapes(updatedShapes);
    if (onUpdateFreezeFrame) {
      onUpdateFreezeFrame(updatedFreezeFrame);
    }
  };

  // Optimize total freeze frame timings handler
  const handleOptimizeTimings = (holdGap: number = MIN_END_GAP) => {
    const optimalDur = calculateOptimalFreezeFrameDuration(ffShapes, stepDelay, holdGap);

    const updatedFF: FreezeFrame = {
      ...freezeFrame,
      duration: optimalDur,
      stepDelay
    };

    const updatedShapes = shapes.map(s => {
      if (s.freezeFrameId !== freezeFrame.id) return s;
      if (typeof s.step === 'number' && !isNaN(s.step)) {
        const step = Math.max(0, Math.floor(s.step));
        const animStart = calculateStepAnimStart(step, stepDelay);
        return {
          ...s,
          step,
          animStart,
          animEnd: optimalDur
        };
      }
      // Freeform shape
      const curStart = typeof s.animStart === 'number' ? s.animStart : 0;
      const curEnd = typeof s.animEnd === 'number' ? s.animEnd : optimalDur;
      return {
        ...s,
        animStart: curStart,
        animEnd: Math.min(optimalDur, curEnd)
      };
    });

    setShapes(updatedShapes);
    if (onUpdateFreezeFrame) {
      onUpdateFreezeFrame(updatedFF);
    }
    if (previewTime > optimalDur) {
      setPreviewTime(0);
    }

    const diff = Number((duration - optimalDur).toFixed(1));
    let msg = `Duration set to ${optimalDur.toFixed(1)}s`;
    if (diff > 0.1) {
      msg = `Optimized: ${optimalDur.toFixed(1)}s (saved ${diff}s idle hold)`;
    } else if (diff < -0.1) {
      msg = `Extended: ${optimalDur.toFixed(1)}s (fits all steps)`;
    } else {
      msg = `Timings already optimal (${optimalDur.toFixed(1)}s)`;
    }
    setOptimizeSuccessMsg(msg);
    setTimeout(() => setOptimizeSuccessMsg(null), 3200);
    setShowOptimizeMenu(false);
  };

  useEffect(() => {
    let interval: any;
    if (isPlaying && !isDraggingPlayhead) {
      interval = setInterval(() => {
        setPreviewTime(prev => {
          if (prev >= duration) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.1;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, isDraggingPlayhead, duration, setIsPlaying, setPreviewTime]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDraggingPlayhead) {
      const container = document.getElementById('animation-timeline-track');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, offsetX / rect.width));
      setPreviewTime(pct * duration);
      return;
    }

    if (!dragging) return;
    const container = document.getElementById('animation-timeline-track');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, offsetX / rect.width));
    const newTime = pct * duration;

    if (dragging.isDynamic && onUpdateFreezeFrame) {
      const prevCfg = freezeFrame.trackAnimations?.[dragging.id] || {};
      const start = prevCfg.animStart ?? 0;
      const end = prevCfg.animEnd ?? duration;
      let nextCfg = { ...prevCfg };
      if (dragging.type === 'start') {
        const updatedStart = Math.min(newTime, end - 0.1);
        nextCfg = { ...prevCfg, animStart: Number(updatedStart.toFixed(2)), animEnd: end, step: null };
      } else if (dragging.type === 'end') {
        const updatedEnd = Math.max(newTime, start + 0.1);
        nextCfg = { ...prevCfg, animStart: start, animEnd: Number(updatedEnd.toFixed(2)) };
      } else if (dragging.type === 'move') {
        const dur = end - start;
        let nStart = newTime - (dur / 2);
        let nEnd = newTime + (dur / 2);
        if (nStart < 0) { nStart = 0; nEnd = dur; }
        if (nEnd > duration) { nEnd = duration; nStart = duration - dur; }
        nextCfg = { animStart: Number(nStart.toFixed(2)), animEnd: Number(nEnd.toFixed(2)), step: null };
      }
      onUpdateFreezeFrame({
        ...freezeFrame,
        trackAnimations: {
          ...(freezeFrame.trackAnimations || {}),
          [dragging.id]: nextCfg,
        },
      });
      return;
    }

    setShapes(prev => prev.map(s => {
      if (s.id !== dragging.id) return s;
      const start = s.animStart ?? 0;
      const end = s.animEnd ?? duration;
      if (dragging.type === 'start') {
        const updatedStart = Math.min(newTime, end - 0.1);
        // Dragging positions telestrations freely without step constraints
        return { ...s, animStart: Number(updatedStart.toFixed(2)), step: null };
      } else if (dragging.type === 'end') {
        const updatedEnd = Math.max(newTime, start + 0.1);
        return { ...s, animEnd: Number(updatedEnd.toFixed(2)) };
      } else if (dragging.type === 'move') {
        const dur = end - start;
        let nStart = newTime - (dur / 2);
        let nEnd = newTime + (dur / 2);
        if (nStart < 0) { nStart = 0; nEnd = dur; }
        if (nEnd > duration) { nEnd = duration; nStart = duration - dur; }
        // Dragging and positioning without steps
        return { ...s, animStart: Number(nStart.toFixed(2)), animEnd: Number(nEnd.toFixed(2)), step: null };
      }
      return s;
    }));
  }, [dragging, isDraggingPlayhead, duration, freezeFrame, onUpdateFreezeFrame, setShapes, setPreviewTime]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setIsDraggingPlayhead(false);
  }, []);

  useEffect(() => {
    if (dragging || isDraggingPlayhead) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, isDraggingPlayhead, handleMouseMove, handleMouseUp]);

  const handleSeek = (e: React.MouseEvent) => {
    const container = document.getElementById('animation-timeline-track');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, offsetX / rect.width));
    setPreviewTime(pct * duration);
    setIsDraggingPlayhead(true);
    setIsPlaying(false);
  };

  // Change Step Delay for this freeze frame
  const handleStepDelayChange = (newDelay: number) => {
    const safeDelay = Math.max(0.2, Math.min(10.0, Number(newDelay.toFixed(2))));
    const { updatedFreezeFrame, updatedShapes } = syncFreezeFrameWithSteps(freezeFrame, shapes, {
      newStepDelay: safeDelay
    });

    setShapes(updatedShapes);
    if (onUpdateFreezeFrame) {
      onUpdateFreezeFrame(updatedFreezeFrame);
    }
  };

  // Change a specific shape's step (or set to null for freeform without steps)
  const handleShapeStepChange = (shapeId: string, targetStep: number | null) => {
    const targetShape = shapes.find(s => s.id === shapeId);
    if (!targetShape) return;

    if (targetStep === null) {
      setShapes(prev => prev.map(s => {
        if (s.id === shapeId) {
          return {
            ...s,
            step: null,
            animStart: s.animStart ?? 0,
            animEnd: s.animEnd ?? duration
          };
        }
        return s;
      }));
      return;
    }

    const safeStep = Math.max(0, targetStep);

    // Calculate required freeze frame duration
    const currentShapesInFF = shapes.filter(s => s.freezeFrameId === freezeFrame.id);
    const updatedFFShapes = currentShapesInFF.map(s => (s.id === shapeId ? { ...s, step: safeStep } : s));
    const requiredDur = calculateRequiredFreezeFrameDuration(updatedFFShapes, stepDelay, duration);
    const finalDuration = Math.max(duration, requiredDur);

    // Update shapes
    const updatedAnimStart = calculateStepAnimStart(safeStep, stepDelay);
    setShapes(prev => prev.map(s => {
      if (s.id === shapeId) {
        return {
          ...s,
          step: safeStep,
          animStart: updatedAnimStart,
          animEnd: finalDuration
        };
      }
      if (s.freezeFrameId === freezeFrame.id && finalDuration > duration) {
        // If duration extended, stretch other shapes' animEnd to the new duration
        return {
          ...s,
          animEnd: finalDuration
        };
      }
      return s;
    }));

    // Auto extend freeze frame if needed
    if (finalDuration > duration && onUpdateFreezeFrame) {
      onUpdateFreezeFrame({
        ...freezeFrame,
        duration: finalDuration
      });
    }
  };

  // Change step for an overlapping dynamic track inside this freeze frame
  const handleDynamicTrackStepChange = (trackId: string, targetStep: number | null) => {
    if (!onUpdateFreezeFrame) return;
    const prevCfg = freezeFrame.trackAnimations?.[trackId] || {};
    if (targetStep === null) {
      onUpdateFreezeFrame({
        ...freezeFrame,
        trackAnimations: {
          ...(freezeFrame.trackAnimations || {}),
          [trackId]: {
            step: null,
            animStart: prevCfg.animStart ?? 0,
            animEnd: prevCfg.animEnd ?? duration,
          },
        },
      });
      return;
    }

    const safeStep = Math.max(0, targetStep);
    const updatedAnimStart = calculateStepAnimStart(safeStep, stepDelay);
    const requiredDur = calculateRequiredFreezeFrameDuration(safeStep, stepDelay, duration);
    const finalDuration = Math.max(duration, requiredDur);

    onUpdateFreezeFrame({
      ...freezeFrame,
      duration: finalDuration,
      trackAnimations: {
        ...(freezeFrame.trackAnimations || {}),
        [trackId]: {
          step: safeStep,
          animStart: updatedAnimStart,
          animEnd: finalDuration,
        },
      },
    });
  };

  // Calculate step guides for timeline background
  const maxPossibleSteps = Math.floor(duration / stepDelay);
  const stepMarkers = Array.from({ length: maxPossibleSteps + 1 }, (_, i) => ({
    step: i,
    time: calculateStepAnimStart(i, stepDelay)
  })).filter(m => m.time <= duration);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="h-full bg-[#111] border-l border-[#222] flex flex-col shrink-0 overflow-hidden relative z-50 shadow-2xl"
      style={{ width: width || (typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.60) : 600) }}
    >
      {/* Consolidated Animation Timeline Header (Space-Efficient Single Bar) */}
      <div className="border-b border-[#222] bg-[#14151b] px-3 py-2 shrink-0 select-none">
        <div className="flex items-center justify-between gap-2.5 flex-wrap">
          {/* Left: Title & Freeze Frame Tag */}
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            <div className="w-6 h-6 rounded bg-[#c6ff1f]/10 border border-[#c6ff1f]/20 flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5 text-[#c6ff1f]" />
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <h3 className="text-xs font-semibold text-white whitespace-nowrap">Animation Timeline</h3>
              <span 
                className="text-[10px] text-gray-400 font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/5 truncate max-w-[120px]" 
                title={freezeFrame.name || 'Freeze Frame'}
              >
                {freezeFrame.name || 'Freeze Frame'}
              </span>
            </div>
          </div>

          {/* Center: Step Delay Controller & Optimize Timings Option */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Step Delay Controller with Scrub, Scroll, Inline Type & Presets */}
            <ScrubbableTimeInput
              value={stepDelay}
              onChange={handleStepDelayChange}
              min={0.2}
              max={10.0}
              step={0.25}
              precision={2}
              presets={STEP_DELAY_PRESETS}
              label="Step Delay"
              icon={<Layers className="w-3 h-3 text-[#c6ff1f]" />}
              size="sm"
              accentColor="#c6ff1f"
              tooltipTitle={`Step Delay: ${stepDelay.toFixed(2)}s between sequential steps. Scroll mouse wheel or drag to scrub, click to type, or click chevron for presets.`}
            />

            {/* Optimize Freeze Frame Timings Option */}
            <div className="relative" ref={optimizeMenuRef}>
              <div className="flex items-center bg-[#1c1f28] border border-white/10 rounded-md p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => handleOptimizeTimings(MIN_END_GAP)}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer ${
                    isAlreadyOptimal
                      ? 'text-gray-300 hover:text-white hover:bg-white/10'
                      : 'bg-[#c6ff1f]/15 text-[#c6ff1f] hover:bg-[#c6ff1f]/25 font-semibold shadow-[0_0_8px_rgba(198,255,31,0.2)]'
                  }`}
                  title={
                    isAlreadyOptimal
                      ? `Timings already optimal (${duration.toFixed(1)}s for ${steppedShapes.length} steps). Click to re-align.`
                      : `Optimize total freeze frame duration from ${duration.toFixed(1)}s to ${optimalDurationTight.toFixed(1)}s (fits all steps with 1.5s holding gap, removes dead time)`
                  }
                >
                  <Sparkles className="w-3 h-3 text-[#c6ff1f] shrink-0" />
                  <span className="whitespace-nowrap">Optimize Timings</span>
                  {!isAlreadyOptimal && (
                    <span className="text-[9px] font-mono font-bold text-[#c6ff1f] bg-black/40 px-1 py-0.2 rounded border border-[#c6ff1f]/30 tabular-nums">
                      {optimalDurationTight.toFixed(1)}s
                    </span>
                  )}
                  {isAlreadyOptimal && (
                    <Check className="w-2.5 h-2.5 text-[#c6ff1f] shrink-0" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowOptimizeMenu(!showOptimizeMenu)}
                  className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer ml-0.5"
                  title="Timing presets & options"
                >
                  <ChevronDown className={`w-3 h-3 transition-transform ${showOptimizeMenu ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Timing Options Dropdown Popover */}
              {showOptimizeMenu && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-[#181a24] border border-white/15 rounded-lg shadow-2xl p-2 z-[70] backdrop-blur-md">
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-1 flex items-center justify-between">
                    <span>Timing Optimization</span>
                    <span className="font-mono text-[#c6ff1f]">{duration.toFixed(1)}s current</span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => handleOptimizeTimings(1.5)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded bg-white/5 hover:bg-[#c6ff1f]/15 hover:text-[#c6ff1f] text-gray-200 text-left transition-colors cursor-pointer group"
                    >
                      <div className="flex flex-col">
                        <span className="text-[11px] font-semibold flex items-center gap-1">
                          <Zap className="w-3 h-3 text-[#c6ff1f]" />
                          Tight Fit (Snappy)
                        </span>
                        <span className="text-[9px] text-gray-400">Last step + 1.5s holding gap</span>
                      </div>
                      <span className="font-mono font-bold text-xs text-[#c6ff1f]">
                        {optimalDurationTight.toFixed(1)}s
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOptimizeTimings(2.5)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded bg-white/5 hover:bg-[#c6ff1f]/15 hover:text-[#c6ff1f] text-gray-200 text-left transition-colors cursor-pointer group"
                    >
                      <div className="flex flex-col">
                        <span className="text-[11px] font-semibold flex items-center gap-1">
                          <Clock className="w-3 h-3 text-cyan-400" />
                          Comfortable Hold
                        </span>
                        <span className="text-[9px] text-gray-400">Last step + 2.5s review hold</span>
                      </div>
                      <span className="font-mono font-bold text-xs text-cyan-400">
                        {optimalDurationComfortable.toFixed(1)}s
                      </span>
                    </button>
                  </div>

                  {/* Manual Duration Quick Presets */}
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <div className="text-[9px] text-gray-400 uppercase font-semibold tracking-wider mb-1 px-1">
                      Quick Duration Presets:
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {[3.0, 5.0, 7.5, 10.0].map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleDurationChange(preset)}
                          className={`py-1 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                            Math.abs(duration - preset) < 0.1
                              ? 'bg-[#c6ff1f] text-black'
                              : 'bg-white/5 hover:bg-white/10 text-gray-300'
                          }`}
                        >
                          {preset.toFixed(1)}s
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Duration Adjustment, Playhead Time, Play/Pause, Close */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Freeze Frame Duration Adjuster with Scrub, Scroll, Inline Type & Presets */}
            <div className="flex items-center bg-[#1c1f28] border border-white/10 rounded-md px-1.5 py-0.5 shadow-sm">
              <div className="flex items-center gap-1 font-mono text-[11px] text-gray-400 mr-1 shrink-0 select-none">
                <span className="text-xs font-bold text-white tabular-nums">{previewTime.toFixed(1)}s</span>
                <span className="text-[10px] text-gray-500">/</span>
              </div>
              <ScrubbableTimeInput
                value={duration}
                onChange={handleDurationChange}
                min={Math.max(1.5, calculateRequiredFreezeFrameDuration(ffShapes, stepDelay, 1.5))}
                max={60.0}
                step={0.5}
                precision={1}
                presets={DURATION_PRESETS}
                label="Duration"
                size="sm"
                accentColor="#c6ff1f"
                tooltipTitle={`Total Freeze Frame Duration: ${duration.toFixed(1)}s. Scroll mouse wheel or drag to scrub, click to type, or pick presets.`}
              />
            </div>

            {/* Play/Pause Button */}
            <button 
              onClick={() => { 
                setIsPlaying(!isPlaying); 
                if (!isPlaying && previewTime >= duration) setPreviewTime(0); 
              }} 
              className="w-7 h-7 flex items-center justify-center bg-[#c6ff1f] hover:bg-[#d4ff4d] text-black rounded-full transition-transform active:scale-95 shadow-md cursor-pointer shrink-0"
              title={isPlaying ? "Pause preview" : "Play preview"}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 fill-black" /> : <Play className="w-3.5 h-3.5 fill-black ml-0.5" />}
            </button>

            {/* Vertical Divider */}
            <div className="h-4 w-px bg-white/10 shrink-0" />

            {/* Close Button */}
            <button 
              onClick={onClose} 
              className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer shrink-0"
              title="Close animation timeline"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Dynamic Timing Optimization Feedback Notification */}
        {optimizeSuccessMsg && (
          <div className="mt-1.5 px-2.5 py-1 bg-[#c6ff1f]/15 border border-[#c6ff1f]/30 rounded text-[10px] font-mono text-[#c6ff1f] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 shrink-0" />
              {optimizeSuccessMsg}
            </span>
            <button 
              onClick={() => setOptimizeSuccessMsg(null)}
              className="text-[#c6ff1f]/70 hover:text-[#c6ff1f] cursor-pointer"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        )}
      </div>

      {/* Main Timeline View */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col custom-scrollbar">
        <div className="flex-1 flex gap-2 h-full overflow-hidden">
          {/* Left Tool Labels & Step Controller */}
          <div className="w-[140px] shrink-0 flex flex-col gap-2 pt-[24px] border-r border-[#222] pr-2">
            {ffShapes.map((s) => {
              const hasStep = typeof s.step === 'number' && !isNaN(s.step);
              const currentStep = hasStep ? Math.max(0, Math.floor(s.step!)) : null;
              const isSelected = selectedShapeId === s.id;

              return (
                <div 
                  key={s.id} 
                  className={`h-9 flex flex-col justify-center px-1.5 rounded transition-all cursor-pointer ${
                    isSelected ? 'bg-white/10 text-white border border-[#c6ff1f]/40' : 'text-gray-400 hover:bg-white/5 border border-transparent'
                  }`}
                  onClick={() => setSelectedShapeId(s.id)}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="truncate text-[10px] font-semibold text-gray-200">
                      {s.type.charAt(0).toUpperCase() + s.type.slice(1)}
                    </span>
                  </div>

                  {/* Step Stepper or Freeform Pill */}
                  <div 
                    className="flex items-center justify-between mt-0.5 bg-[#171922] px-1 py-0.5 rounded border border-white/5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {hasStep ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            if (currentStep! <= 0) {
                              handleShapeStepChange(s.id, null); // Switch to No Step
                            } else {
                              handleShapeStepChange(s.id, currentStep! - 1);
                            }
                          }}
                          className="w-4 h-3.5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded cursor-pointer transition-colors"
                          title={currentStep! <= 0 ? "Remove step (switch to freeform without steps)" : "Decrease step"}
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShapeStepChange(s.id, null)}
                          className="text-[9px] font-mono font-bold text-[#c6ff1f] hover:text-amber-400 px-1 cursor-pointer transition-colors"
                          title={`Step ${currentStep} (${getStepOrdinal(currentStep!)} · ${(currentStep! * stepDelay).toFixed(1)}s). Click to remove step.`}
                        >
                          Step {currentStep}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShapeStepChange(s.id, currentStep! + 1)}
                          className="w-4 h-3.5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded cursor-pointer transition-colors"
                          title="Increase step"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </>
                    ) : (
                      <div className="w-full flex items-center justify-between">
                        <span 
                          className="text-[8.5px] font-mono font-medium text-gray-400 px-0.5 select-none"
                          title="This drawing has no steps and can be dragged anywhere freely."
                        >
                          No Step
                        </span>
                        <button
                          type="button"
                          onClick={() => handleShapeStepChange(s.id, 0)}
                          className="text-[8.5px] font-mono font-semibold text-[#c6ff1f] hover:bg-[#c6ff1f]/20 px-1 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-0.5"
                          title="Assign to Step 0"
                        >
                          <Plus className="w-2 h-2" />
                          <span>Step</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {overlappingTracks.map((trk) => {
              const isAvoided = Boolean(freezeFrame.avoidedTrackIds?.includes(trk.id));
              const isContinuing =
                trk.trackStartTime !== undefined && trk.trackStartTime < freezeFrame.timestamp - 0.05;
              const cfg = freezeFrame.trackAnimations?.[trk.id];
              const hasStep = typeof cfg?.step === 'number' && !isNaN(cfg.step);
              const currentStep = hasStep ? Math.max(0, Math.floor(cfg!.step!)) : null;
              const isSelected = selectedShapeId === trk.id;
              return (
                <div
                  key={`dyn-${trk.id}`}
                  className={`h-9 flex flex-col justify-center px-1.5 rounded transition-all cursor-pointer ${
                    isAvoided
                      ? 'bg-red-950/20 text-gray-500 border border-red-500/20 opacity-65'
                      : isSelected
                      ? 'bg-cyan-500/15 text-white border border-cyan-400/50'
                      : 'text-gray-300 hover:bg-white/5 border border-cyan-500/20 bg-cyan-950/10'
                  }`}
                  onClick={() => setSelectedShapeId(trk.id)}
                >
                  <div className="flex items-center justify-between gap-1 min-w-0">
                    <div className="flex items-center gap-1 min-w-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: trk.color || '#c6ff1f' }} />
                      <span className={`truncate text-[10px] font-semibold ${isAvoided ? 'line-through text-gray-500' : 'text-cyan-200'}`}>
                        {trk.trackLabel || trk.type}
                      </span>
                    </div>
                    {onToggleTrackAvoidInFF && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleTrackAvoidInFF(trk.id);
                        }}
                        className={`px-1 py-0.2 rounded text-[7.5px] font-bold uppercase cursor-pointer shrink-0 ${
                          isAvoided
                            ? 'bg-red-500/20 text-red-300 hover:bg-[#c6ff1f]/20 hover:text-[#c6ff1f]'
                            : 'bg-[#c6ff1f]/20 text-[#c6ff1f] hover:bg-red-500/20 hover:text-red-300'
                        }`}
                        title={isAvoided ? 'Click to Use this dynamic tool in freeze frame' : 'Click to Avoid this dynamic tool during freeze frame'}
                      >
                        {isAvoided ? 'Avoid' : 'Use'}
                      </button>
                    )}
                  </div>
                  {isAvoided ? (
                    <div className="text-[8px] font-mono text-red-400/80 flex items-center gap-1 mt-0.5">
                      <Ban className="w-2.5 h-2.5" />
                      <span>Avoided in frame</span>
                    </div>
                  ) : isContinuing ? (
                    <div
                      className="text-[8px] font-mono text-cyan-300/75 mt-0.5 truncate"
                      title="Already active before this Freeze Frame — remains steady without re-animating"
                    >
                      Continuing · Steady
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-between mt-0.5 bg-[#171922] px-1 py-0.5 rounded border border-white/5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {hasStep ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleDynamicTrackStepChange(trk.id, currentStep! <= 0 ? null : currentStep! - 1)}
                            className="w-4 h-3.5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded cursor-pointer transition-colors"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDynamicTrackStepChange(trk.id, null)}
                            className="text-[9px] font-mono font-bold text-[#c6ff1f] hover:text-amber-400 px-1 cursor-pointer transition-colors"
                          >
                            Step {currentStep}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDynamicTrackStepChange(trk.id, currentStep! + 1)}
                            className="w-4 h-3.5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded cursor-pointer transition-colors"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </>
                      ) : (
                        <div className="w-full flex items-center justify-between">
                          <span className="text-[8px] font-mono text-cyan-300/80 px-0.5 select-none">Dynamic</span>
                          <button
                            type="button"
                            onClick={() => handleDynamicTrackStepChange(trk.id, 0)}
                            className="text-[8.5px] font-mono font-semibold text-[#c6ff1f] hover:bg-[#c6ff1f]/20 px-1 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-0.5"
                          >
                            <Plus className="w-2 h-2" />
                            <span>Step</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {ffShapes.length === 0 && overlappingTracks.length === 0 && (
              <div className="text-[10px] text-gray-500 italic mt-2">
                No tools on this freeze frame. Draw on the pitch to add tools.
              </div>
            )}
          </div>

          {/* Right Track Area */}
          <div className="flex-1 relative flex flex-col" id="animation-timeline-track" onMouseDown={handleSeek}>
            {/* Time markers header */}
            <div className="h-4 flex items-end relative border-b border-[#222] mb-2 pointer-events-none pb-0.5">
              {[...Array(Math.ceil(duration) + 1)].map((_, i) => (
                <div 
                  key={i} 
                  className="absolute text-[9px] text-gray-500 font-mono" 
                  style={{ left: `${(i / duration) * 100}%`, transform: 'translateX(-50%)' }}
                >
                  {i}s
                </div>
              ))}
            </div>

            {/* Step Guideline Markers Background */}
            <div className="absolute top-4 bottom-0 left-0 right-0 pointer-events-none z-0">
              {stepMarkers.map(marker => {
                const pct = (marker.time / duration) * 100;
                return (
                  <div
                    key={marker.step}
                    className="absolute top-0 bottom-0 border-l border-dashed border-white/5 flex flex-col justify-end pb-1"
                    style={{ left: `${pct}%` }}
                  >
                    <span className="text-[8px] font-mono text-gray-600 pl-0.5 select-none opacity-40">
                      S{marker.step}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Playhead */}
            <div 
              className="absolute top-4 bottom-0 w-[1px] bg-red-500 z-50 cursor-ew-resize group" 
              style={{ left: `${(previewTime / duration) * 100}%` }}
              onMouseDown={(e) => { e.stopPropagation(); setIsDraggingPlayhead(true); setIsPlaying(false); }}
            >
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] cursor-ew-resize group-hover:scale-125 transition-transform" />
              <div className="absolute top-0 bottom-0 -left-2 w-4 cursor-ew-resize" />
            </div>

            {/* Tracks */}
            <div className="flex flex-col gap-2 relative z-10 pointer-events-auto flex-1">
              {ffShapes.map(s => {
                const start = s.animStart ?? 0;
                const end = s.animEnd ?? duration;
                const startPct = Math.max(0, Math.min(100, (start / duration) * 100));
                const widthPct = Math.max(2, Math.min(100 - startPct, ((end - start) / duration) * 100));
                const isSelected = selectedShapeId === s.id;
                const hasStep = typeof s.step === 'number' && !isNaN(s.step);
                
                return (
                  <div 
                    key={s.id} 
                    className={`h-9 relative bg-[#1a1a1a] rounded border overflow-hidden group cursor-pointer transition-colors ${
                      isSelected ? 'border-white/50 bg-[#222]' : 'border-[#333] hover:border-[#444]'
                    }`}
                    onMouseDown={(e) => { e.stopPropagation(); setSelectedShapeId(s.id); }}
                  >
                    <div 
                      className={`absolute top-0 bottom-0 rounded shadow-sm transition-all flex items-center justify-between px-2 overflow-hidden ${
                        isSelected ? 'border-2' : 'border'
                      }`}
                      style={{
                        left: `${startPct}%`,
                        width: `${widthPct}%`,
                        backgroundColor: fadeColor(s.color, isSelected ? 0.35 : 0.22),
                        borderColor: s.color
                      }}
                      onMouseDown={(e) => { 
                        e.stopPropagation(); 
                        setSelectedShapeId(s.id); 
                        setDragging({ id: s.id, type: 'move' }); 
                      }}
                    >
                      {/* Left Handle */}
                      <div 
                        className={`absolute left-0 top-0 bottom-0 w-8 -ml-4 cursor-ew-resize flex items-center justify-center z-30 transition-all group/handle ${
                          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                        onMouseDown={(e) => { 
                          e.stopPropagation(); 
                          setSelectedShapeId(s.id); 
                          setDragging({ id: s.id, type: 'start' }); 
                        }}
                        title="Drag to trim start time"
                      >
                        <div className="w-1.5 h-4 bg-gray-300 rounded-full shadow-[0_0_4px_rgba(0,0,0,0.8)] border border-gray-600 group-hover/handle:bg-white group-hover/handle:scale-110 transition-all" />
                      </div>

                      {/* Track Label Details */}
                      <span className="text-[9px] font-mono font-bold text-white/90 truncate z-10 pointer-events-none select-none drop-shadow-sm">
                        {hasStep ? `Step ${s.step}` : 'No Step'} ({start.toFixed(1)}s - {end.toFixed(1)}s)
                      </span>
                      
                      {/* Right Handle */}
                      <div 
                        className={`absolute right-0 top-0 bottom-0 w-8 -mr-4 cursor-ew-resize flex items-center justify-center z-30 transition-all group/handle ${
                          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                        onMouseDown={(e) => { 
                          e.stopPropagation(); 
                          setSelectedShapeId(s.id); 
                          setDragging({ id: s.id, type: 'end' }); 
                        }}
                        title="Drag to trim end time"
                      >
                        <div className="w-1.5 h-4 bg-gray-300 rounded-full shadow-[0_0_4px_rgba(0,0,0,0.8)] border border-gray-600 group-hover/handle:bg-white group-hover/handle:scale-110 transition-all" />
                      </div>
                    </div>
                  </div>
                );
              })}
              {overlappingTracks.map((trk) => {
                const isAvoided = Boolean(freezeFrame.avoidedTrackIds?.includes(trk.id));
                const isContinuing =
                  trk.trackStartTime !== undefined && trk.trackStartTime < freezeFrame.timestamp - 0.05;
                const cfg = freezeFrame.trackAnimations?.[trk.id];
                const start = cfg?.animStart ?? 0;
                const end = cfg?.animEnd ?? duration;
                const startPct = Math.max(0, Math.min(100, (start / duration) * 100));
                const widthPct = Math.max(2, Math.min(100 - startPct, ((end - start) / duration) * 100));
                const isSelected = selectedShapeId === trk.id;
                const hasStep = typeof cfg?.step === 'number' && !isNaN(cfg.step);
                const trkColor = trk.color || '#38bdf8';

                return (
                  <div
                    key={`dyn-bar-${trk.id}`}
                    className={`h-9 relative rounded border overflow-hidden transition-colors ${
                      isAvoided
                        ? 'bg-[#141215] border-red-500/20 opacity-45'
                        : isSelected
                        ? 'bg-[#1a222a] border-cyan-400/60 cursor-pointer'
                        : 'bg-[#151920] border-cyan-500/30 hover:border-cyan-400/50 cursor-pointer'
                    }`}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setSelectedShapeId(trk.id);
                    }}
                  >
                    {isAvoided ? (
                      <div className="w-full h-full flex items-center justify-center text-[9px] font-mono text-red-400/80">
                        Avoided during Freeze Frame
                      </div>
                    ) : isContinuing ? (
                      <div
                        className="w-full h-full flex items-center justify-between px-2.5"
                        style={{
                          backgroundColor: fadeColor(trkColor, isSelected ? 0.24 : 0.14),
                          borderLeft: `3px solid ${trkColor}`,
                        }}
                        title="Already active from clip before this freeze frame — holds steady with no intro animation"
                      >
                        <span className="text-[9px] font-mono font-bold text-cyan-200/95 truncate select-none">
                          Continuing from clip · Steady (0.0s - {duration.toFixed(1)}s)
                        </span>
                      </div>
                    ) : (
                      <div
                        className={`group absolute top-0 bottom-0 rounded shadow-sm flex items-center justify-between px-2 overflow-hidden ${
                          isSelected ? 'border-2' : 'border'
                        }`}
                        style={{
                          left: `${startPct}%`,
                          width: `${widthPct}%`,
                          backgroundColor: fadeColor(trkColor, isSelected ? 0.35 : 0.22),
                          borderColor: trkColor,
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setSelectedShapeId(trk.id);
                          setDragging({ id: trk.id, type: 'move', isDynamic: true });
                        }}
                      >
                        <div
                          className={`absolute left-0 top-0 bottom-0 w-8 -ml-4 cursor-ew-resize flex items-center justify-center z-30 transition-all group/handle ${
                            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setSelectedShapeId(trk.id);
                            setDragging({ id: trk.id, type: 'start', isDynamic: true });
                          }}
                        >
                          <div className="w-1.5 h-4 bg-gray-300 rounded-full border border-gray-600" />
                        </div>
                        <span className="text-[9px] font-mono font-bold text-white/90 truncate z-10 pointer-events-none select-none drop-shadow-sm">
                          {hasStep ? `Step ${cfg!.step}` : 'Dynamic'} ({start.toFixed(1)}s - {end.toFixed(1)}s)
                        </span>
                        <div
                          className={`absolute right-0 top-0 bottom-0 w-8 -mr-4 cursor-ew-resize flex items-center justify-center z-30 transition-all group/handle ${
                            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setSelectedShapeId(trk.id);
                            setDragging({ id: trk.id, type: 'end', isDynamic: true });
                          }}
                        >
                          <div className="w-1.5 h-4 bg-gray-300 rounded-full border border-gray-600" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
