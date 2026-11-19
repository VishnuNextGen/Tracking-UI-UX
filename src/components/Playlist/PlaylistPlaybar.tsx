import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Pause, SkipBack, SkipForward, X, Scissors, RotateCcw, 
  ListPlus, Layers, Snowflake, Check, EyeOff, Eye, Ban, FileText,
  Clock, Sparkles, Crosshair, ChevronLeft, ChevronRight, Plus
} from 'lucide-react';
import { Playlist, TagEvent, Tag as TagData, Label, FreezeFrame } from '../../types';
import { formatTime } from '../../utils/math';
import { fadeColor } from '../../utils/colors';
import { 
  calculatePlaylistSequence, 
  getVideoTimeFromMacroTime, 
  getMacroTimeFromVideoTime,
  getClipFreezeFramesInfo,
  getClipDeactivatedFreezeFrameIds,
  PlaylistSegment 
} from '../../utils/playlistUtils';

interface PlaylistPlaybarProps {
  playlist: Playlist;
  tagEvents: TagEvent[];
  tags: TagData[];
  labels?: Label[];
  allBatchProjects?: any[];
  currentProjectId?: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  currentTime: number;
  videoDuration: number;
  isPlaying: boolean;
  activeClipIndex: number;
  freezeFrames?: FreezeFrame[];
  onSelectClipIndex: (index: number, seekVideoTime?: number, autoPlay?: boolean) => void;
  onUpdateClipTrim: (clipIndex: number, newStart: number, newEnd: number) => void;
  onResetClipTrim: (clipIndex: number) => void;
  onTogglePlay: () => void;
  onClose: () => void;
  onOpenNoteModal?: (eventId: string, projectId?: string) => void;
  onToggleFreezeFrameDeactivation?: (freezeFrameId: string) => void;
  onSetAllFreezeFramesDeactivation?: (freezeFrameIds: string[], deactivate: boolean) => void;
  onAddFreezeFrame?: () => void;
  onOpenFreezeFrameAnimation?: (freezeFrameId: string) => void;
  onScrubStart?: () => void;
  onScrubMove?: (time: number) => void;
  onScrubEnd?: () => void;
  onReorderClips?: (fromIndex: number, toIndex: number) => void;
  onInsertEventsAt?: (eventIds: string[], insertAtIndex: number) => void;
}

export const PlaylistPlaybar: React.FC<PlaylistPlaybarProps> = ({
  playlist,
  tagEvents,
  tags,
  labels = [],
  allBatchProjects,
  currentProjectId,
  videoRef,
  currentTime,
  videoDuration,
  isPlaying,
  activeClipIndex,
  freezeFrames = [],
  onSelectClipIndex,
  onUpdateClipTrim,
  onResetClipTrim,
  onTogglePlay,
  onClose,
  onOpenNoteModal,
  onToggleFreezeFrameDeactivation,
  onSetAllFreezeFramesDeactivation,
  onAddFreezeFrame,
  onOpenFreezeFrameAnimation,
  onScrubStart,
  onScrubMove,
  onScrubEnd,
  onReorderClips,
  onInsertEventsAt,
}) => {
  const [isDraggingMacro, setIsDraggingMacro] = useState(false);
  const [draggingMicro, setDraggingMicro] = useState<'start' | 'end' | null>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [tempStart, setTempStart] = useState<number>(0);
  const [tempEnd, setTempEnd] = useState<number>(0);
  const [microWindow, setMicroWindow] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [dragClipIdx, setDragClipIdx] = useState<number | null>(null);
  const [macroDropSlot, setMacroDropSlot] = useState<{ index: number; side: 'left' | 'right' } | null>(null);

  // Freeze Frame interaction state (Hover inspector popover)
  const [hoveredFfId, setHoveredFfId] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const macroTrackRef = useRef<HTMLDivElement>(null);

  // Compute contiguous macro timeline across all batch projects
  const { totalDuration, segments } = useMemo(() => {
    return calculatePlaylistSequence(playlist, tagEvents, allBatchProjects);
  }, [playlist, tagEvents, allBatchProjects]);

  const isMultiProject = Boolean(allBatchProjects && allBatchProjects.length > 1);

  // Safe active segment and item
  const activeSegment: PlaylistSegment | undefined = segments[activeClipIndex] || segments[0];
  const activePlaylistItem = playlist.events[activeClipIndex] || activeSegment?.item;

  // Resolve candidate freeze frames for the active clip
  const candidateFreezeFrames = useMemo(() => {
    if (activeSegment?.projectId && allBatchProjects) {
      const p = allBatchProjects.find(proj => proj.id === activeSegment.projectId);
      if (p?.data?.freezeFrames) return p.data.freezeFrames;
    }
    return freezeFrames || [];
  }, [activeSegment?.projectId, allBatchProjects, freezeFrames]);

  // Compute active vs deactivated freeze frames for the selected clip
  const activeClipFfInfo = useMemo(() => {
    if (!activeSegment) {
      return { totalCount: 0, activeCount: 0, deactivatedCount: 0, allClipFreezeFrames: [], activeFreezeFrames: [], deactivatedFreezeFrames: [] };
    }
    return getClipFreezeFramesInfo(
      activePlaylistItem,
      { startTime: tempStart, endTime: tempEnd },
      candidateFreezeFrames
    );
  }, [activePlaylistItem, tempStart, tempEnd, candidateFreezeFrames]);

  // Sync tempStart/tempEnd when active clip changes or stops dragging
  useEffect(() => {
    if (!draggingMicro && activeSegment) {
      setTempStart(activeSegment.startTime);
      setTempEnd(activeSegment.endTime);

      // Add context padding (3.5s before, 3.5s after)
      const padding = 3.5;
      const minBound = Math.max(0, Math.min(activeSegment.startTime, activeSegment.originalStartTime) - padding);
      const maxBound = Math.min(videoDuration, Math.max(activeSegment.endTime, activeSegment.originalEndTime) + padding);
      setMicroWindow({ start: minBound, end: maxBound });
    }
  }, [activeClipIndex, activeSegment?.startTime, activeSegment?.endTime, draggingMicro, videoDuration]);

  // Clamped current video time within the active clip range [tempStart, tempEnd]
  const clampedVideoTime = useMemo(() => {
    if (!activeSegment) return currentTime;
    return Math.max(tempStart, Math.min(tempEnd, currentTime));
  }, [activeSegment, tempStart, tempEnd, currentTime]);

  // Calculate current macro playhead time
  const currentMacroTime = useMemo(() => {
    return getMacroTimeFromVideoTime(clampedVideoTime, activeClipIndex, segments);
  }, [clampedVideoTime, activeClipIndex, segments]);

  const isDraggingMacroRef = useRef(false);
  const isDraggingPlayheadRef = useRef(false);
  const draggingMicroRef = useRef<'start' | 'end' | null>(null);
  const tempStartRef = useRef(tempStart);
  const tempEndRef = useRef(tempEnd);
  tempStartRef.current = tempStart;
  tempEndRef.current = tempEnd;

  // Cleanup on unmount if user was dragging
  useEffect(() => {
    return () => {
      if (isDraggingMacroRef.current || isDraggingPlayheadRef.current || draggingMicroRef.current) {
        onScrubEnd?.();
      }
    };
  }, [onScrubEnd]);

  // --- MACRO TRACK SCRUBBING & DRAGGING ---
  const seekMacroAtClientX = useCallback((clientX: number) => {
    if (!macroTrackRef.current || totalDuration <= 0) return;
    const track = macroTrackRef.current.getBoundingClientRect();
    const clickX = clientX - track.left;
    const pct = Math.max(0, Math.min(1, clickX / track.width));
    const targetMacroTime = pct * totalDuration;

    const { videoTime, clipIndex } = getVideoTimeFromMacroTime(targetMacroTime, segments);
    const targetSeg = segments[clipIndex];

    onSelectClipIndex(clipIndex, videoTime);
    if (!targetSeg?.projectId || targetSeg.projectId === currentProjectId) {
      if (onScrubMove) {
        onScrubMove(videoTime);
      } else if (videoRef.current) {
        videoRef.current.currentTime = videoTime;
      }
    }
  }, [totalDuration, segments, onSelectClipIndex, currentProjectId, onScrubMove, videoRef]);

  const seekMacroRef = useRef(seekMacroAtClientX);
  seekMacroRef.current = seekMacroAtClientX;

  const handleMacroMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onScrubStart?.();
    setIsDraggingMacro(true);
    isDraggingMacroRef.current = true;
    seekMacroRef.current(e.clientX);

    const onMouseMove = (moveEvent: MouseEvent) => {
      // If mouse button is no longer held down, terminate drag immediately
      if ((moveEvent.buttons & 1) === 0) {
        cleanup();
        return;
      }
      seekMacroRef.current(moveEvent.clientX);
    };

    const onMouseUp = () => {
      cleanup();
    };

    const cleanup = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setIsDraggingMacro(false);
      isDraggingMacroRef.current = false;
      onScrubEnd?.();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [onScrubStart, onScrubEnd]);

  // --- MICRO TRIMMER HANDLE DRAGGING ---
  const handleMicroTrimMouseDown = useCallback((type: 'start' | 'end', e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onScrubStart?.();
    setDraggingMicro(type);
    draggingMicroRef.current = type;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if ((moveEvent.buttons & 1) === 0) {
        cleanup();
        return;
      }
      const container = document.getElementById('playlist-micro-trimmer-track');
      if (!container || !activeSegment) return;

      const rect = container.getBoundingClientRect();
      const offsetX = moveEvent.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, offsetX / rect.width));
      const windowDuration = microWindow.end - microWindow.start;
      const newTime = microWindow.start + (pct * windowDuration);

      if (type === 'start') {
        const clamped = Math.min(newTime, tempEndRef.current - 0.2);
        const safeStart = Math.max(0, clamped);
        setTempStart(safeStart);
        tempStartRef.current = safeStart;
        // Only gently clamp playhead if current playback is strictly behind new start boundary
        if (videoRef.current && videoRef.current.currentTime < safeStart) {
          videoRef.current.currentTime = safeStart;
          onScrubMove?.(safeStart);
        }
      } else {
        const clamped = Math.max(newTime, tempStartRef.current + 0.2);
        const safeEnd = Math.min(videoDuration, clamped);
        setTempEnd(safeEnd);
        tempEndRef.current = safeEnd;
        // Only gently clamp playhead if current playback is strictly ahead of new end boundary
        if (videoRef.current && videoRef.current.currentTime > safeEnd) {
          videoRef.current.currentTime = safeEnd;
          onScrubMove?.(safeEnd);
        }
      }
    };

    const onMouseUp = () => {
      cleanup();
    };

    const cleanup = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setDraggingMicro(null);
      draggingMicroRef.current = null;
      onUpdateClipTrim(activeClipIndex, tempStartRef.current, tempEndRef.current);
      onScrubEnd?.();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [activeSegment, microWindow, videoDuration, videoRef, onScrubMove, onUpdateClipTrim, activeClipIndex, onScrubStart, onScrubEnd]);

  // Freeze Frame navigation helpers
  const sortedClipFfs = useMemo(() => {
    return [...activeClipFfInfo.allClipFreezeFrames].sort((a, b) => a.timestamp - b.timestamp);
  }, [activeClipFfInfo.allClipFreezeFrames]);

  const hasPrevFF = useMemo(() => {
    return sortedClipFfs.some(f => f.timestamp < clampedVideoTime - 0.05);
  }, [sortedClipFfs, clampedVideoTime]);

  const hasNextFF = useMemo(() => {
    return sortedClipFfs.some(f => f.timestamp > clampedVideoTime + 0.05);
  }, [sortedClipFfs, clampedVideoTime]);

  const handleJumpToFF = useCallback((direction: 'prev' | 'next') => {
    if (!sortedClipFfs.length) return;
    const current = clampedVideoTime;
    
    if (direction === 'prev') {
      const prevs = sortedClipFfs.filter(f => f.timestamp < current - 0.05);
      const target = prevs.length ? prevs[prevs.length - 1] : sortedClipFfs[sortedClipFfs.length - 1];
      if (target) {
        const targetTime = Math.max(tempStartRef.current, Math.min(tempEndRef.current, target.timestamp));
        if (videoRef.current) videoRef.current.currentTime = targetTime;
        onScrubMove?.(targetTime);
      }
    } else {
      const nexts = sortedClipFfs.filter(f => f.timestamp > current + 0.05);
      const target = nexts.length ? nexts[0] : sortedClipFfs[0];
      if (target) {
        const targetTime = Math.max(tempStartRef.current, Math.min(tempEndRef.current, target.timestamp));
        if (videoRef.current) videoRef.current.currentTime = targetTime;
        onScrubMove?.(targetTime);
      }
    }
  }, [sortedClipFfs, clampedVideoTime, videoRef, onScrubMove]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === '[' || (e.shiftKey && e.key === 'ArrowLeft')) {
        e.preventDefault();
        handleJumpToFF('prev');
      } else if (e.key === ']' || (e.shiftKey && e.key === 'ArrowRight')) {
        e.preventDefault();
        handleJumpToFF('next');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleJumpToFF]);

  // --- MICRO PLAYHEAD (VIDEO POINT) DRAGGING (Strictly clamped to [tempStart, tempEnd]) ---
  const seekMicroPlayheadAtClientX = useCallback((clientX: number) => {
    const container = document.getElementById('playlist-micro-trimmer-track');
    if (!container || !activeSegment) return;
    const rect = container.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, offsetX / rect.width));
    const windowDuration = Math.max(0.01, microWindow.end - microWindow.start);
    const rawTime = microWindow.start + (pct * windowDuration);
    const clamped = Math.max(tempStartRef.current, Math.min(tempEndRef.current, rawTime));

    if (onScrubMove) {
      onScrubMove(clamped);
    } else if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
  }, [activeSegment, microWindow, onScrubMove, videoRef]);

  const seekMicroRef = useRef(seekMicroPlayheadAtClientX);
  seekMicroRef.current = seekMicroPlayheadAtClientX;

  const handleMicroPlayheadMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onScrubStart?.();
    setIsDraggingPlayhead(true);
    isDraggingPlayheadRef.current = true;
    seekMicroRef.current(e.clientX);

    const onMouseMove = (moveEvent: MouseEvent) => {
      // If mouse button is no longer held down, terminate immediately
      if ((moveEvent.buttons & 1) === 0) {
        cleanup();
        return;
      }
      seekMicroRef.current(moveEvent.clientX);
    };

    const onMouseUp = () => {
      cleanup();
    };

    const cleanup = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setIsDraggingPlayhead(false);
      isDraggingPlayheadRef.current = false;
      onScrubEnd?.();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [onScrubStart, onScrubEnd]);

  // Nudge start or end
  const handleNudge = (type: 'start' | 'end', delta: number) => {
    if (!activeSegment) return;
    if (type === 'start') {
      const newS = Math.max(0, Math.min(tempStart + delta, tempEnd - 0.2));
      setTempStart(newS);
      onUpdateClipTrim(activeClipIndex, newS, tempEnd);
      if (videoRef.current && videoRef.current.currentTime < newS) {
        onSelectClipIndex(activeClipIndex, newS, false);
      }
    } else {
      const newE = Math.max(tempStart + 0.2, Math.min(videoDuration, tempEnd + delta));
      setTempEnd(newE);
      onUpdateClipTrim(activeClipIndex, tempStart, newE);
      if (videoRef.current && videoRef.current.currentTime > newE) {
        onSelectClipIndex(activeClipIndex, newE, false);
      }
    }
  };

  // Calculations for Micro Trimmer percentages
  const microDuration = Math.max(0.01, microWindow.end - microWindow.start);
  const activeStartPct = Math.max(0, Math.min(100, ((tempStart - microWindow.start) / microDuration) * 100));
  const activeWidthPct = Math.max(0, Math.min(100 - activeStartPct, ((tempEnd - tempStart) / microDuration) * 100));

  // Ghost master event calculations
  const origStartPct = activeSegment 
    ? Math.max(0, Math.min(100, ((activeSegment.originalStartTime - microWindow.start) / microDuration) * 100))
    : 0;
  const origWidthPct = activeSegment
    ? Math.max(0, Math.min(100 - origStartPct, ((activeSegment.originalEndTime - activeSegment.originalStartTime) / microDuration) * 100))
    : 0;

  // Micro playhead position (strictly clamped to [tempStart, tempEnd])
  const microPlayheadPct = ((clampedVideoTime - microWindow.start) / microDuration) * 100;
  const showMicroPlayhead = microPlayheadPct >= 0 && microPlayheadPct <= 100;

  // Jump to clip
  const jumpPrev = () => {
    if (activeClipIndex > 0) {
      const nextIndex = activeClipIndex - 1;
      const targetSeg = segments[nextIndex];
      const targetTime = targetSeg?.startTime;
      onSelectClipIndex(nextIndex, targetTime);
      if (videoRef.current && targetSeg && (!targetSeg.projectId || targetSeg.projectId === currentProjectId)) {
        videoRef.current.currentTime = targetSeg.startTime;
      }
    }
  };

  const jumpNext = () => {
    if (activeClipIndex < segments.length - 1) {
      const nextIndex = activeClipIndex + 1;
      const targetSeg = segments[nextIndex];
      const targetTime = targetSeg?.startTime;
      onSelectClipIndex(nextIndex, targetTime);
      if (videoRef.current && targetSeg && (!targetSeg.projectId || targetSeg.projectId === currentProjectId)) {
        videoRef.current.currentTime = targetSeg.startTime;
      }
    }
  };

  const activeTag = activeSegment?.tagEvent ? tags.find(t => t.id === activeSegment.tagEvent?.tagId) : undefined;
  const activeLabels = activeSegment?.tagEvent?.labelIds?.map(id => labels.find(l => l.id === id)?.name).filter(Boolean) || [];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      transition={{ duration: 0.2 }}
      className="relative w-full z-50 flex flex-col bg-[#0b0c0e]/95 backdrop-blur-xl border-t border-[#2a2c32] shadow-2xl select-none"
    >
      {/* Top Header Controls: Playlist Info, Clip Selection, Play Controls & Exit */}
      <div className="flex items-center justify-between px-3 h-10 border-b border-[#1f2127] gap-2 shrink-0 select-none overflow-hidden">
        {/* Left: Playlist & Active Clip Metadata */}
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#c6ff1f]/15 border border-[#c6ff1f]/40 text-[#c6ff1f] text-[9.5px] font-bold uppercase tracking-wider shrink-0">
            <ListPlus className="w-3 h-3" />
            <span className="hidden xs:inline">Playlist Mode</span>
          </div>

          <span className="text-gray-400 text-xs font-semibold truncate max-w-[120px] hidden sm:inline" title={playlist.name}>
            {playlist.name}
          </span>

          <span className="text-gray-600 text-xs hidden sm:inline">•</span>

          {/* Active Clip Title */}
          <div className="flex items-center gap-1.5 min-w-0 shrink truncate">
            <span 
              className="w-2 h-2 rounded-full shrink-0 shadow-sm"
              style={{ backgroundColor: activeTag?.color || '#3b82f6' }}
            />
            <span className="text-xs font-bold text-white truncate max-w-[140px] flex items-center gap-1">
              #{activeClipIndex + 1} {activeTag?.name || 'Clip'}
            </span>
            {isMultiProject && activeSegment?.projectName && (
              <span className="text-[9px] font-semibold text-cyan-300 bg-cyan-950/70 border border-cyan-700/50 px-1 py-0.2 rounded font-mono truncate max-w-[90px] hidden lg:inline" title={`Match: ${activeSegment.projectName}`}>
                {activeSegment.projectName}
              </span>
            )}
            {activeLabels.length > 0 && (
              <span className="text-[#c6ff1f] font-normal text-[10px] truncate max-w-[110px] hidden xl:inline" title={activeLabels.join(', ')}>
                ({activeLabels.join(', ')})
              </span>
            )}
          </div>

          {/* Trimmed Badge + Reset to Master (only on playlist bar) */}
          {activeSegment?.isTrimmed ? (
            <div className="flex items-center gap-1 shrink-0 ml-0.5">
              <span 
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs"
                title={`Trimmed (${activeSegment.durationDelta > 0 ? `+${activeSegment.durationDelta.toFixed(1)}s` : `${activeSegment.durationDelta.toFixed(1)}s`})`}
              >
                <Scissors className="w-2.5 h-2.5 shrink-0 text-amber-300" />
                <span>{activeSegment.durationDelta > 0 ? `+${activeSegment.durationDelta.toFixed(1)}s` : `${activeSegment.durationDelta.toFixed(1)}s`}</span>
              </span>
              <button
                onClick={() => onResetClipTrim(activeClipIndex)}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] text-gray-300 hover:text-white bg-[#1e2025] hover:bg-[#282a31] border border-white/10 transition-colors shrink-0"
                title={`Revert to original master event duration (${formatTime(activeSegment.originalDuration)})`}
              >
                <RotateCcw className="w-2.5 h-2.5 shrink-0" />
                <span className="hidden md:inline">Reset</span>
              </button>
            </div>
          ) : (
            <span className="text-[9px] text-gray-500 font-mono hidden 2xl:inline shrink-0">
              (Master Duration)
            </span>
          )}
        </div>

        {/* Center: Playback & Navigation Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={jumpPrev}
            disabled={activeClipIndex <= 0}
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-[#1f2127] disabled:opacity-30 transition-colors"
            title="Previous Clip (Q)"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onTogglePlay}
            className="p-1 bg-[#c6ff1f] hover:bg-[#a5db0f] text-black rounded-full transition-transform active:scale-95 shadow-[0_0_8px_rgba(198,255,31,0.4)] flex items-center justify-center"
            title={isPlaying ? "Pause Reel (Space)" : "Play Reel (Space)"}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
          </button>

          <button
            onClick={jumpNext}
            disabled={activeClipIndex >= segments.length - 1}
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-[#1f2127] disabled:opacity-30 transition-colors"
            title="Next Clip (E)"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Sequence Time Readout & Return to Master */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenNoteModal && activeSegment?.eventId && (() => {
            const noteVal = activeSegment.tagEvent?.notes || (typeof activePlaylistItem === 'object' ? activePlaylistItem?.notes : '');
            const hasNote = Boolean(noteVal && noteVal.trim().length > 0);
            return (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenNoteModal(activeSegment.eventId, activeSegment.projectId);
                }}
                className={`flex items-center gap-1 h-6 px-2 rounded text-[10px] font-semibold border transition-colors shrink-0 cursor-pointer ${
                  hasNote
                    ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-400/45'
                    : 'bg-[#181a20] hover:bg-[#22252d] text-gray-300 hover:text-white border-white/10'
                }`}
                title={hasNote ? `Edit Note: "${noteVal}"` : 'Add Event Note'}
              >
                <FileText className="w-3 h-3 shrink-0" />
                <span className="hidden md:inline">Note</span>
              </button>
            );
          })()}

          <div className="text-[10px] font-mono text-gray-300 bg-[#16181d] px-2 py-0.5 rounded-md border border-white/5 flex items-center gap-1.5 shrink-0">
            <span className="text-gray-400 text-[9px] hidden sm:inline">REEL:</span>
            <span className="text-[#c6ff1f] font-bold">{formatTime(currentMacroTime)}</span>
            <span className="text-gray-500">/ {formatTime(totalDuration)}</span>
            <span className="text-gray-400 text-[9px] border-l border-white/10 pl-1.5">
              {activeClipIndex + 1}/{segments.length}
            </span>
          </div>

          <button
            onClick={onClose}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#1f2127] hover:bg-[#282a32] text-gray-300 hover:text-white text-xs font-medium border border-white/10 transition-colors shrink-0"
            title="Exit Playlist Mode and return to Master Timeline"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Return to Timeline</span>
          </button>
        </div>
      </div>

      {/* TIER 1: MACRO SEQUENCE BAR (Total Playlist contiguous reel) */}
      <div className="px-4 pt-2.5 pb-1 flex flex-col gap-1">
        <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono gap-3 min-w-0 overflow-hidden">
          <span className="flex items-center gap-1.5 font-semibold text-gray-300 truncate shrink-0">
            <Layers className="w-3 h-3 text-[#c6ff1f] shrink-0" />
            <span>Playlist Sequence</span>
            <span className="text-gray-400 font-normal hidden xs:inline">(Total Reel: {formatTime(totalDuration)})</span>
          </span>
          <span className="text-gray-400 text-[9px] truncate min-w-0 hidden md:block text-right">
            {onReorderClips
              ? 'Drag blocks to reorder • Drag playhead to scrub • Click to jump'
              : 'Drag video point to scrub sequence • Click any block to jump'}
          </span>
        </div>

        <div 
          ref={macroTrackRef}
          onMouseDown={handleMacroMouseDown}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setMacroDropSlot(null);
            }
          }}
          className="relative h-7 w-full bg-[#121418] rounded-lg border border-white/10 flex overflow-visible cursor-pointer shadow-inner group select-none"
        >
          {segments.map((seg, idx) => {
            const widthPct = totalDuration > 0 ? (seg.duration / totalDuration) * 100 : 0;
            const tag = seg.tagEvent ? tags.find(t => t.id === seg.tagEvent?.tagId) : undefined;
            const isSegActive = idx === activeClipIndex;
            const isBeingDragged = dragClipIdx === idx;
            const dropSide = macroDropSlot?.index === idx ? macroDropSlot.side : null;

            const segCandidateFfs = seg.projectId && allBatchProjects
              ? (allBatchProjects.find(p => p.id === seg.projectId)?.data?.freezeFrames || [])
              : (freezeFrames || []);
            const segFfInfo = getClipFreezeFramesInfo(seg.item, { startTime: seg.startTime, endTime: seg.endTime }, segCandidateFfs);

            return (
              <div
                key={seg.instanceId}
                draggable={Boolean(onReorderClips && segments.length > 1)}
                onDragStart={(e) => {
                  if (!onReorderClips || segments.length <= 1) return;
                  e.stopPropagation();
                  setDragClipIdx(idx);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(idx));
                }}
                onDragEnd={() => {
                  setDragClipIdx(null);
                  setMacroDropSlot(null);
                }}
                onDragOver={(e) => {
                  const hasExternalEvents = Array.from(e.dataTransfer.types || []).includes('application/x-tacstem-events');
                  if (!onReorderClips && !(hasExternalEvents && onInsertEventsAt)) return;
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = hasExternalEvents ? 'copy' : 'move';
                  const rect = e.currentTarget.getBoundingClientRect();
                  const side: 'left' | 'right' = e.clientX < rect.left + rect.width / 2 ? 'left' : 'right';
                  if (macroDropSlot?.index !== idx || macroDropSlot?.side !== side) {
                    setMacroDropSlot({ index: idx, side });
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const side: 'left' | 'right' = e.clientX < rect.left + rect.width / 2 ? 'left' : 'right';
                  const rawSlot = side === 'left' ? idx : idx + 1;

                  const externalPayload = e.dataTransfer.getData('application/x-tacstem-events');
                  if (externalPayload && onInsertEventsAt) {
                    try {
                      const parsedIds = JSON.parse(externalPayload);
                      if (Array.isArray(parsedIds) && parsedIds.length > 0) {
                        onInsertEventsAt(parsedIds, rawSlot);
                      }
                    } catch {}
                    setDragClipIdx(null);
                    setMacroDropSlot(null);
                    return;
                  }

                  const rawFrom = dragClipIdx !== null ? dragClipIdx : parseInt(e.dataTransfer.getData('text/plain'), 10);
                  if (!Number.isNaN(rawFrom) && onReorderClips) {
                    const targetIdx = rawSlot > rawFrom ? rawSlot - 1 : rawSlot;
                    const clampedTarget = Math.max(0, Math.min(segments.length - 1, targetIdx));
                    if (clampedTarget !== rawFrom) {
                      onReorderClips(rawFrom, clampedTarget);
                    }
                  }
                  setDragClipIdx(null);
                  setMacroDropSlot(null);
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectClipIndex(idx, seg.startTime);
                  if (videoRef.current && (!seg.projectId || seg.projectId === currentProjectId)) {
                    videoRef.current.currentTime = seg.startTime;
                  }
                }}
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: fadeColor(tag?.color || '#3b82f6', isSegActive ? 0.45 : 0.2),
                  borderRight: idx < segments.length - 1 ? '1px solid rgba(255,255,255,0.15)' : 'none',
                }}
                className={`relative h-full flex items-center justify-between px-1.5 transition-all text-left overflow-hidden first:rounded-l-lg last:rounded-r-lg ${
                  onReorderClips && segments.length > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                } ${
                  isBeingDragged ? 'opacity-40' : ''
                } ${
                  isSegActive 
                    ? 'ring-2 ring-[#c6ff1f] z-10 shadow-[inset_0_0_8px_rgba(198,255,31,0.3)]' 
                    : 'hover:brightness-125'
                }`}
                title={`Clip #${idx + 1}: ${tag?.name || 'Clip'} (${formatTime(seg.duration)})${isMultiProject && seg.projectName ? ` • ${seg.projectName}` : ''}${seg.isTrimmed ? ' [Trimmed]' : ''}${segFfInfo.totalCount > 0 ? ' • Freeze Frame hold included' : ''}${onReorderClips ? ' • Drag horizontally to reorder' : ''}`}
              >
                {dropSide === 'left' && (
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#c6ff1f] shadow-[0_0_10px_rgba(198,255,31,1)] z-30 pointer-events-none" />
                )}
                {dropSide === 'right' && (
                  <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-[#c6ff1f] shadow-[0_0_10px_rgba(198,255,31,1)] z-30 pointer-events-none" />
                )}
                <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden pointer-events-none">
                  {widthPct < 3.5 ? (
                    <span className="text-[9.5px] font-bold text-white/90 truncate min-w-0 font-mono">
                      #{idx + 1}
                    </span>
                  ) : widthPct < 7 ? (
                    <span className="text-[10px] font-bold text-white truncate min-w-0">
                      #{idx + 1} {tag?.name || 'Clip'}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-white truncate min-w-0">
                      {idx + 1}. {tag?.name || 'Clip'}
                    </span>
                  )}

                  {isMultiProject && widthPct >= 14 && seg.projectName && (
                    <span className="text-[8px] px-1 py-0.2 rounded bg-black/60 text-cyan-200 border border-cyan-500/30 font-mono shrink-0 hidden md:inline truncate max-w-[70px]">
                      {seg.projectName}
                    </span>
                  )}
                  {widthPct >= 5 && seg.isTrimmed && (
                    <Scissors className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                  )}
                  {widthPct >= 6 && (seg.tagEvent?.notes || (typeof seg.item === 'object' && seg.item.notes)) && (
                    <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-[#090a0d]/80 border border-white/30 shrink-0">
                      <FileText className="w-2 h-2 text-white stroke-[2.5]" />
                    </span>
                  )}
                  {widthPct >= 6 && segFfInfo.totalCount > 0 && (
                    <span
                      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-cyan-950/80 border border-cyan-400/40 text-cyan-300 shrink-0"
                      title="Clip includes freeze frame hold"
                    >
                      <Snowflake className="w-2 h-2 text-cyan-300" />
                    </span>
                  )}
                </div>

                {widthPct >= 7 && (
                  <span className="text-[9px] font-mono text-gray-300 opacity-80 shrink-0 ml-1.5 pointer-events-none whitespace-nowrap">
                    {formatTime(seg.duration)}
                  </span>
                )}

                {/* Submerged freeze frame hold notches embedded into the macro bar rail */}
                {segFfInfo.allClipFreezeFrames.map((ff, ffIdx) => {
                  const tickPct = Math.max(0, Math.min(100, ((ff.timestamp - seg.startTime) / Math.max(0.01, seg.duration)) * 100));
                  const isDeact = segFfInfo.deactivatedFreezeFrames.some(d => d.id === ff.id);
                  const isCurrentlyAtFF = Math.abs(clampedVideoTime - ff.timestamp) < 0.08 && idx === activeClipIndex;

                  return (
                    <div
                      key={ff.id}
                      style={{ left: `${tickPct}%` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectClipIndex(idx, ff.timestamp);
                        if (videoRef.current && (!seg.projectId || seg.projectId === currentProjectId)) {
                          videoRef.current.currentTime = ff.timestamp;
                        }
                      }}
                      className="absolute bottom-0 -translate-x-1/2 flex flex-col items-center group/macroff cursor-pointer z-20 pointer-events-auto"
                      title={`Clip #${idx + 1} Freeze Frame #${ffIdx + 1} (${formatTime(ff.timestamp)}) [${ff.duration || 5}s Hold]${isDeact ? ' - Bypassed' : ''} • Click to seek`}
                    >
                      {/* Inset submerged diamond notch flush with the bottom rail */}
                      <div
                        className={`w-2 h-2 rotate-45 -mb-1 rounded-[1px] transition-all duration-150 ${
                          isDeact
                            ? 'bg-gray-600/70 border border-gray-500/40 opacity-50'
                            : isCurrentlyAtFF
                            ? 'bg-cyan-300 ring-2 ring-cyan-400 shadow-[0_0_8px_rgba(56,189,248,1)] scale-125'
                            : 'bg-cyan-400 group-hover/macroff:bg-cyan-300 group-hover/macroff:scale-125 shadow-[0_0_4px_rgba(56,189,248,0.7)]'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Macro Playhead (Draggable) */}
          {totalDuration > 0 && (
            <div 
              className="absolute top-0 bottom-0 w-[2px] bg-[#c6ff1f] shadow-[0_0_10px_rgba(198,255,31,1)] z-30 cursor-ew-resize group/macroplayhead"
              style={{ left: `${Math.max(0, Math.min(100, (currentMacroTime / totalDuration) * 100))}%` }}
            >
              <div 
                onMouseDown={handleMacroMouseDown}
                className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#c6ff1f] border-2 border-black shadow-lg cursor-grab active:cursor-grabbing hover:scale-125 transition-transform" 
                title="Drag video playhead across playlist"
              />
            </div>
          )}
        </div>
      </div>

      {/* TIER 2: MICRO CLIP TRIMMER (Precision zoom on currently selected clip) */}
      <div className="px-4 pt-1.5 pb-3 flex flex-col gap-1.5">
        {/* Micro Header: Timestamps, Nudges, In/Out info */}
        <div className="flex items-center justify-between text-[10.5px] font-mono flex-nowrap gap-2 shrink-0 min-w-0">
          {/* Left: IN point */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-gray-400 text-[9.5px] font-sans font-bold uppercase tracking-wider hidden sm:inline shrink-0">
              Trimmer:
            </span>
            <div className="flex items-center gap-1 bg-[#14161b] px-1.5 py-0.5 rounded border border-white/5 shrink-0">
              <span className="text-gray-400 text-[9.5px]">IN:</span>
              <span className="text-white font-bold">{formatTime(tempStart)}</span>
              {activeSegment?.isTrimmed && (
                <span className="text-amber-400 text-[8.5px] ml-0.5 hidden xl:inline" title={`Original Master IN: ${formatTime(activeSegment.originalStartTime)}`}>
                  ({formatTime(activeSegment.originalStartTime)})
                </span>
              )}
            </div>
            
            {/* Nudge Buttons for In Point */}
            <div className="hidden lg:flex items-center gap-0.5 shrink-0">
              <button 
                onClick={() => handleNudge('start', -0.2)}
                className="px-1 py-0.5 bg-[#1f2127] hover:bg-[#2a2c34] text-[8.5px] text-gray-300 rounded cursor-pointer"
                title="Expand start -0.2s"
              >
                -0.2s
              </button>
              <button 
                onClick={() => handleNudge('start', 0.2)}
                className="px-1 py-0.5 bg-[#1f2127] hover:bg-[#2a2c34] text-[8.5px] text-gray-300 rounded cursor-pointer"
                title="Trim start +0.2s"
              >
                +0.2s
              </button>
            </div>
          </div>

          {/* Center Duration Readout with Delta & Note */}
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            <div className="flex items-center gap-1 bg-[#14161b] px-2 py-0.5 rounded border border-white/5 shrink-0">
              <span className="text-gray-400 text-[9.5px]">DUR:</span>
              <span className="text-[#c6ff1f] font-bold text-[11px] font-mono">{formatTime(tempEnd - tempStart)}</span>
              {activeSegment?.isTrimmed && (
                <span className="text-amber-300 text-[9px] font-bold font-mono hidden sm:inline">
                  ({activeSegment.durationDelta > 0 ? `+${activeSegment.durationDelta.toFixed(1)}s` : `${activeSegment.durationDelta.toFixed(1)}s`})
                </span>
              )}
            </div>

            {/* Quick Note Button in Micro Trimmer Header */}
            {onOpenNoteModal && activeSegment?.eventId && (() => {
              const noteVal = activeSegment.tagEvent?.notes || (typeof activePlaylistItem === 'object' ? activePlaylistItem?.notes : '');
              const hasNote = Boolean(noteVal && noteVal.trim().length > 0);
              return (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenNoteModal(activeSegment.eventId, activeSegment.projectId);
                  }}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9.5px] font-sans font-bold transition-colors shrink-0 cursor-pointer ${
                    hasNote
                      ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-400/45'
                      : 'bg-[#14161b] hover:bg-[#22252d] text-gray-300 hover:text-white border-white/10'
                  }`}
                  title={hasNote ? `Edit Note: "${noteVal}"` : 'Add Event Note'}
                >
                  <FileText className="w-2.5 h-2.5 shrink-0" />
                  <span className="hidden sm:inline">Note</span>
                </button>
              );
            })()}
          </div>

          {/* Right: OUT point & nudge */}
          <div className="flex items-center gap-1.5 shrink-0 min-w-0">
            <div className="flex items-center gap-0.5 shrink-0">
              <button 
                onClick={() => handleNudge('end', -0.2)}
                className="px-1 py-0.5 bg-[#1f2127] hover:bg-[#2a2c34] text-[8.5px] text-gray-300 rounded"
                title="Trim end -0.2s"
              >
                -0.2s
              </button>
              <button 
                onClick={() => handleNudge('end', 0.2)}
                className="px-1 py-0.5 bg-[#1f2127] hover:bg-[#2a2c34] text-[8.5px] text-gray-300 rounded"
                title="Expand end +0.2s"
              >
                +0.2s
              </button>
            </div>

            <div className="flex items-center gap-1 bg-[#14161b] px-1.5 py-0.5 rounded border border-white/5 shrink-0">
              <span className="text-gray-400 text-[9.5px]">OUT:</span>
              <span className="text-white font-bold">{formatTime(tempEnd)}</span>
              {activeSegment?.isTrimmed && (
                <span className="text-amber-400 text-[8.5px] ml-0.5 hidden lg:inline" title={`Original Master OUT: ${formatTime(activeSegment.originalEndTime)}`}>
                  ({formatTime(activeSegment.originalEndTime)})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Micro Track Container */}
        <div 
          id="playlist-micro-trimmer-track"
          className="relative h-11 w-full bg-[#121418] rounded-xl border border-white/10 shadow-inner overflow-hidden cursor-crosshair select-none"
        >
          {/* Subtle ruler grid ticks */}
          <div className="absolute inset-0 flex justify-between items-center px-1 opacity-15 pointer-events-none">
            {[...Array(50)].map((_, i) => (
              <div key={i} className={`w-[1px] ${i % 5 === 0 ? 'h-3 bg-white' : 'h-1.5 bg-gray-500'}`} />
            ))}
          </div>

          {/* GHOST MASTER EVENT RANGE (Faint dashed reference zone) */}
          {activeSegment && (
            <div
              className="absolute top-0 bottom-0 h-full pointer-events-none z-10 border-y border-dashed border-white/20 bg-white/[0.03]"
              style={{
                left: `${origStartPct}%`,
                width: `${origWidthPct}%`
              }}
              title={`Original Master Event: ${formatTime(activeSegment.originalStartTime)} - ${formatTime(activeSegment.originalEndTime)}`}
            >
              <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-white/40" />
              <div className="absolute top-0 right-0 bottom-0 w-[2px] bg-white/40" />
              <div className="absolute top-1 left-2 text-[9px] text-white/40 font-mono pointer-events-none">
                Master Bounds [{formatTime(activeSegment.originalDuration)}]
              </div>
            </div>
          )}

          {/* ACTIVE TRIMMED CLIP REGION - Click/Drag scrubs video point strictly within [tempStart, tempEnd] */}
          <div
            className="absolute top-0 bottom-0 h-full z-20 cursor-pointer"
            style={{
              left: `${activeStartPct}%`,
              width: `${activeWidthPct}%`,
              backgroundColor: fadeColor(activeTag?.color || '#3b82f6', 0.3),
              borderLeft: `2px solid ${activeTag?.color || '#3b82f6'}`,
              borderRight: `2px solid ${activeTag?.color || '#3b82f6'}`
            }}
            onMouseDown={handleMicroPlayheadMouseDown}
          >
            {/* Shimmer gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />

            {/* Left Drag Handle (IN Point) */}
            <div
              onMouseDown={(e) => {
                handleMicroTrimMouseDown('start', e);
              }}
              className="absolute left-0 top-0 bottom-0 w-8 -ml-4 cursor-ew-resize flex items-center justify-center pointer-events-auto z-50 group/handle"
              title="Drag to trim IN point (non-destructive for playlist)"
            >
              <div className="w-3.5 h-8 bg-[#1f2127] rounded-md border border-[#c6ff1f] shadow-[0_0_8px_rgba(0,0,0,0.8)] flex items-center justify-center group-hover/handle:scale-110 group-hover/handle:bg-[#2a2c34] transition-all">
                <div className="w-[2px] h-3.5 bg-[#c6ff1f] rounded-full" />
              </div>
            </div>

            {/* Right Drag Handle (OUT Point) */}
            <div
              onMouseDown={(e) => {
                handleMicroTrimMouseDown('end', e);
              }}
              className="absolute right-0 top-0 bottom-0 w-8 -mr-4 cursor-ew-resize flex items-center justify-center pointer-events-auto z-50 group/handle"
              title="Drag to trim OUT point (non-destructive for playlist)"
            >
              <div className="w-3.5 h-8 bg-[#1f2127] rounded-md border border-[#c6ff1f] shadow-[0_0_8px_rgba(0,0,0,0.8)] flex items-center justify-center group-hover/handle:scale-110 group-hover/handle:bg-[#2a2c34] transition-all">
                <div className="w-[2px] h-3.5 bg-[#c6ff1f] rounded-full" />
              </div>
            </div>

            {/* Clip Title Overlay inside the trimmed region */}
            <div className="w-full h-full flex items-center justify-center pointer-events-none px-4">
              <span className="text-[10px] font-bold text-white tracking-wide truncate bg-black/60 px-2 py-0.5 rounded border border-white/10 shadow-sm">
                {activeTag?.name || 'Clip'} • {formatTime(tempEnd - tempStart)}
              </span>
            </div>
          </div>

          {/* SUBMERGED FREEZE FRAME HOLDERS (Integrated directly into the timeline bar) */}
          {activeClipFfInfo.allClipFreezeFrames.map((ff, ffIdx) => {
            const ffTime = ff.timestamp;
            const ffPct = ((ffTime - microWindow.start) / microDuration) * 100;
            if (ffPct < 0 || ffPct > 100) return null;
            const isDeactivated = activeClipFfInfo.deactivatedFreezeFrames.some(d => d.id === ff.id);
            const isInsideTrim = ffTime >= tempStart - 0.05 && ffTime <= tempEnd + 0.05;
            const isHovered = hoveredFfId === ff.id;
            const isCurrentlyAtFF = Math.abs(clampedVideoTime - ffTime) < 0.06;
            const ffName = ff.name?.trim();

            return (
              <div
                key={ff.id}
                style={{ left: `${ffPct}%` }}
                onMouseEnter={() => {
                  if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                  setHoveredFfId(ff.id);
                }}
                onMouseLeave={() => {
                  hoverTimeoutRef.current = setTimeout(() => {
                    setHoveredFfId(prev => (prev === ff.id ? null : prev));
                  }, 220);
                }}
                className="absolute top-0 bottom-0 z-35 -translate-x-1/2 flex flex-col items-center group/submergedff select-none"
              >
                {/* 1. Submerged Hold Column Aura (Shimmers subtly on hover or when playhead is on hold point) */}
                <div 
                  className={`absolute inset-y-0 w-3 -ml-1.5 pointer-events-none transition-opacity duration-200 ${
                    isHovered || isCurrentlyAtFF
                      ? 'opacity-100 bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent'
                      : 'opacity-0'
                  }`}
                />

                {/* 2. Submerged Inset Fissure / Hairline (Integrated into the timeline track surface, NOT an obstructing wall) */}
                <div
                  className={`w-[1.5px] h-full transition-all duration-150 ${
                    isDeactivated
                      ? 'border-l border-dashed border-gray-500/40 bg-transparent opacity-50'
                      : isCurrentlyAtFF
                      ? 'bg-cyan-300 shadow-[0_0_10px_rgba(56,189,248,0.95)]'
                      : isHovered
                      ? 'bg-cyan-300 shadow-[0_0_6px_rgba(56,189,248,0.8)]'
                      : isInsideTrim
                      ? 'bg-gradient-to-b from-cyan-400/90 via-cyan-400/35 to-cyan-400/90 shadow-[0_0_4px_rgba(56,189,248,0.4)]'
                      : 'bg-gray-500/30'
                  }`}
                />

                {/* 3. Top Submerged Rail Gem / Diamond Pip (Recessed flush into the top rim of the bar) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const targetTime = Math.max(tempStart, Math.min(tempEnd, ffTime));
                    if (videoRef.current) {
                      videoRef.current.currentTime = targetTime;
                    }
                    onScrubMove?.(targetTime);
                  }}
                  className={`absolute -top-1.5 w-3.5 h-3.5 flex items-center justify-center cursor-pointer pointer-events-auto transition-transform active:scale-90 ${
                    isHovered || isCurrentlyAtFF ? 'scale-125 z-40' : 'hover:scale-115'
                  }`}
                  title={`Freeze Frame #${ffIdx + 1} (${formatTime(ffTime)}) [${ff.duration || 5}s Hold] • Click to seek`}
                >
                  <div 
                    className={`w-2.5 h-2.5 rotate-45 rounded-[1.5px] border transition-all shadow-sm flex items-center justify-center ${
                      isDeactivated
                        ? 'bg-[#16181f] border-gray-600/80 shadow-none'
                        : isCurrentlyAtFF
                        ? 'bg-cyan-300 border-white shadow-[0_0_10px_rgba(56,189,248,1)] ring-1 ring-cyan-200'
                        : isHovered
                        ? 'bg-cyan-300 border-white shadow-[0_0_6px_rgba(56,189,248,0.8)]'
                        : 'bg-cyan-500/90 border-cyan-300/80'
                    }`}
                  >
                    {/* Micro center jewel pupil */}
                    <div className={`w-0.5 h-0.5 rounded-full ${isDeactivated ? 'bg-gray-400' : 'bg-black/90'}`} />
                  </div>
                </button>

                {/* 4. Bottom Rail Inset Notch */}
                <div
                  className={`absolute -bottom-0.5 w-2 h-1 rounded-b-sm pointer-events-none transition-colors ${
                    isDeactivated
                      ? 'bg-gray-700/60'
                      : isCurrentlyAtFF || isHovered
                      ? 'bg-cyan-300 shadow-[0_0_6px_rgba(56,189,248,0.8)]'
                      : 'bg-cyan-500/80'
                  }`}
                />

                {/* 5. Submerged Hold Duration Micro-Indicator */}
                {isInsideTrim && !isDeactivated && (
                  <div 
                    className={`absolute bottom-0.5 px-1 py-0.2 rounded text-[7.5px] font-mono font-bold pointer-events-none transition-all duration-150 ${
                      isHovered || isCurrentlyAtFF
                        ? 'bg-cyan-950/90 text-cyan-300 border border-cyan-500/50 shadow-sm opacity-100 scale-100'
                        : 'text-cyan-400/60 opacity-0 group-hover/submergedff:opacity-100'
                    }`}
                  >
                    {ff.duration || 5}s
                  </div>
                )}

                {/* 6. Floating Interactive Freeze Frame Inspector Popover on Hover */}
                <AnimatePresence>
                  {isHovered && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      onMouseEnter={() => {
                        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                        setHoveredFfId(ff.id);
                      }}
                      onMouseLeave={() => {
                        hoverTimeoutRef.current = setTimeout(() => {
                          setHoveredFfId(prev => (prev === ff.id ? null : prev));
                        }, 220);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        left: ffPct < 15 ? '0px' : ffPct > 85 ? undefined : '50%',
                        right: ffPct > 85 ? '0px' : undefined,
                        transform: ffPct >= 15 && ffPct <= 85 ? 'translateX(-50%)' : undefined,
                      }}
                      className="absolute bottom-full mb-2 z-50 pointer-events-auto min-w-[220px] max-w-[260px] bg-[#0c0e12]/95 backdrop-blur-xl border border-cyan-500/35 rounded-xl p-2.5 shadow-[0_16px_36px_rgba(0,0,0,0.85)] flex flex-col gap-2 select-none"
                    >
                      {/* Popover Header */}
                      <div className="flex items-center justify-between gap-1.5 border-b border-white/10 pb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className={`p-1 rounded-md ${isDeactivated ? 'bg-gray-800 text-gray-400' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'}`}>
                            <Snowflake className="w-3 h-3" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[11px] font-bold text-white leading-tight">
                              Freeze Frame #{ffIdx + 1}
                            </span>
                            <span className="text-[9.5px] font-mono text-cyan-400 font-semibold">
                              {formatTime(ffTime)}
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wider shrink-0 ${
                          isDeactivated
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
                        }`}>
                          {isDeactivated ? 'Bypassed' : 'Active'}
                        </span>
                      </div>

                      {/* Popover Details (Hold duration & annotations) */}
                      <div className="flex items-center justify-between text-[10px] text-gray-300 font-mono">
                        <span className="flex items-center gap-1 text-gray-400">
                          <Clock className="w-2.5 h-2.5 text-gray-400" />
                          Hold Duration:
                        </span>
                        <span className="font-bold text-white">{ff.duration || 5}s pause</span>
                      </div>

                      {ffName && (
                        <div className="flex items-center justify-between text-[10px] text-gray-300 font-mono">
                          <span className="flex items-center gap-1 text-gray-400">
                            <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                            Label:
                          </span>
                          <span className="text-amber-300 font-semibold truncate max-w-[130px]" title={ffName}>
                            {ffName}
                          </span>
                        </div>
                      )}

                      {/* Quick Actions Bar inside Hover Card */}
                      <div className="flex items-center gap-1.5 pt-1 border-t border-white/10">
                        {/* Jump to Frame Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const targetTime = Math.max(tempStart, Math.min(tempEnd, ffTime));
                            if (videoRef.current) {
                              videoRef.current.currentTime = targetTime;
                            }
                            onScrubMove?.(targetTime);
                          }}
                          className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-md bg-[#181b22] hover:bg-cyan-950/80 text-gray-200 hover:text-cyan-200 border border-white/10 hover:border-cyan-500/40 text-[10px] font-semibold transition-all active:scale-95"
                          title="Seek video directly to this freeze frame"
                        >
                          <Crosshair className="w-3 h-3 text-cyan-400" />
                          <span>Jump</span>
                        </button>

                        {/* Toggle Active / Deactivate Button */}
                        {onToggleFreezeFrameDeactivation && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFreezeFrameDeactivation(ff.id);
                            }}
                            className={`flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-md text-[10px] font-semibold border transition-all active:scale-95 ${
                              isDeactivated
                                ? 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border-cyan-500/40'
                                : 'bg-[#181b22] hover:bg-amber-950/60 text-gray-300 hover:text-amber-200 border-white/10 hover:border-amber-500/40'
                            }`}
                            title={isDeactivated ? 'Activate freeze frame in this reel' : 'Bypass this freeze frame for this clip'}
                          >
                            {isDeactivated ? (
                              <>
                                <Check className="w-3 h-3 text-cyan-400" />
                                <span>Activate</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3 h-3 text-amber-400" />
                                <span>Bypass</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* Edit Steps / Animation Button */}
                        {onOpenFreezeFrameAnimation && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenFreezeFrameAnimation(ff.id);
                            }}
                            className="p-1 rounded-md bg-[#181b22] hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-[10px] transition-all"
                            title="Open Animation & Step Editor for this Freeze Frame"
                          >
                            <Layers className="w-3 h-3 text-cyan-400" />
                          </button>
                        )}
                      </div>

                      {/* Downward Pointer Notch */}
                      <div 
                        style={{
                          left: ffPct < 15 ? '20px' : ffPct > 85 ? undefined : '50%',
                          right: ffPct > 85 ? '20px' : undefined,
                          transform: ffPct >= 15 && ffPct <= 85 ? 'translateX(-50%)' : undefined,
                        }}
                        className="absolute -bottom-1 w-2 h-2 rotate-45 bg-[#0c0e12] border-r border-b border-cyan-500/35"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* Micro Playhead (Draggable Video Point - strictly clamped to clip range) */}
          {showMicroPlayhead && (
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-40 shadow-[0_0_12px_rgba(239,68,68,0.9)] cursor-ew-resize group/microplayhead"
              style={{ left: `${microPlayheadPct}%` }}
            >
              <div 
                onMouseDown={handleMicroPlayheadMouseDown}
                className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-xl cursor-grab active:cursor-grabbing group-hover/microplayhead:scale-125 transition-transform" 
                title="Drag video point within clip bounds"
              />
              <div 
                onMouseDown={handleMicroPlayheadMouseDown}
                className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-3 h-7 bg-red-500 rounded-full shadow-md border border-red-300 cursor-grab active:cursor-grabbing hover:scale-110 transition-transform flex items-center justify-center"
              >
                <div className="w-[1px] h-3 bg-white/80 rounded-full" />
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
