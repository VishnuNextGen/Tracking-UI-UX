import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Repeat,
  Magnet,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Scissors,
  Copy,
  SquareDashed,
  Circle,
  GitCommitVertical,
  ZoomIn as LensIcon,
  Flashlight,
  Radar,
  Tag,
  Type,
  Crosshair,
  Snowflake,
  LayoutGrid,
  Ban,
  Check,
} from 'lucide-react';
import type { FreezeFrame, PlaylistItem, Shape, ToolType } from '../../../types';
import { isFreezeFrameActiveForClip } from '../../../utils/playlistUtils';
import {
  buildVirtualTimelineSegments,
  formatTrackClock,
  formatTrackDuration,
  getPlayheadVirtualOffset,
  getTrackDisplayColor,
  getTracksOverlappingTimestamp,
  isTrackUsedInFreezeFrame,
  videoTimeToVirtualOffset,
  virtualOffsetToVideoTime,
} from './trackingUtils';

export interface TrackingTimelineProps {
  clipKey?: string;
  clipItem?: PlaylistItem | null;
  clipIndex?: number;
  clipStart: number;
  clipEnd: number;
  currentTime: number;
  isPlaying: boolean;
  isLooping: boolean;
  playbackRate: number;
  trackShapes: Shape[];
  allTrackedShapes?: Shape[];
  clipFreezeFrames?: FreezeFrame[];
  activeFreezeFrameId?: string | null;
  isFreezeFramePlaying?: boolean;
  countdownValue?: number;
  triggeredFreezeFrameIds?: string[];
  editingAnimationFFId?: string | null;
  animationPreviewTime?: number;
  hoveredFreezeFrameId?: string | null;
  onHoverFreezeFrame?: (ffId: string | null) => void;
  onSelectFreezeFrame?: (ffId: string) => void;
  onUpdateFreezeFrameDuration?: (ffId: string, duration: number) => void;
  onOpenFreezeFrameAnimation?: (ffId: string) => void;
  onToggleFreezeFrameDeactivation?: (ffId: string) => void;
  onDeleteFreezeFrame?: (ffId: string) => void;
  onAddFreezeFrame?: () => void;
  onToggleTrackInFreezeFrame?: (ffId: string, trackId: string) => void;
  selectedShapeId: string | null;
  onSelectShape: (shapeId: string | null) => void;
  onTogglePlay: () => void;
  onTimelineTogglePlay?: () => void;
  onSeek: (time: number, pause?: boolean) => void;
  onSeekVirtual?: (virtualOffset: number, pause?: boolean) => void;
  onStepFrame: (frames: number) => void;
  onToggleLoop: () => void;
  onChangePlaybackRate: (rate: number) => void;
  onUpdateTrackRange: (shapeId: string, newStart: number, newEnd: number) => void;
  onToggleTrackHidden: (shapeId: string) => void;
  onToggleTrackLocked: (shapeId: string) => void;
  onRenameTrack: (shapeId: string, label: string) => void;
  onDeleteTrack: (shapeId: string) => void;
  onDuplicateTrack: (shapeId: string) => void;
  onSplitTrackAtPlayhead: (shapeId: string) => void;
  onSetTrackRoi: (shapeId: string) => void;
}

const TRACK_ICON_MAP: Partial<Record<Exclude<ToolType, null>, React.ComponentType<{ className?: string }>>> = {
  circle: Circle,
  'connected-circle': GitCommitVertical,
  lens: LensIcon,
  spotlight: Flashlight,
  radar: Radar,
  'name-tag': Tag,
  text: Type,
};

const ROW_HEIGHT = 22;
const RULER_HEIGHT = 20;
const FF_STRIP_HEIGHT = 26;
const HEADER_COL_WIDTH = 208;
const MIN_BAR_DURATION = 0.25;
const MIN_FF_DURATION = 1.0;
const MAX_FF_DURATION = 60.0;
const MIN_TIMELINE_HEIGHT = 160;
const MAX_TIMELINE_HEIGHT = 440;
const DEFAULT_TIMELINE_HEIGHT = 216;

type DragMode = 'move' | 'trim-left' | 'trim-right';

interface ActiveBarDrag {
  shapeId: string;
  mode: DragMode;
  startClientX: number;
  dragPxPerSecond: number;
  initialStart: number;
  initialEnd: number;
  initialVirtualStart: number;
  initialVirtualEnd: number;
  currentStart: number;
  currentEnd: number;
  snappedEdgeTime: number | null;
}

interface ActiveFFDrag {
  ffId: string;
  startClientX: number;
  dragPxPerSecond: number;
  initialTimestamp: number;
  initialDuration: number;
  currentDuration: number;
  hasMoved: boolean;
}

export const TrackingTimeline: React.FC<TrackingTimelineProps> = ({
  clipKey,
  clipItem = null,
  clipIndex = 0,
  clipStart,
  clipEnd,
  currentTime,
  isPlaying,
  isLooping,
  playbackRate,
  trackShapes,
  allTrackedShapes,
  clipFreezeFrames = [],
  activeFreezeFrameId = null,
  isFreezeFramePlaying = false,
  countdownValue = 0,
  triggeredFreezeFrameIds = [],
  editingAnimationFFId = null,
  animationPreviewTime = 0,
  hoveredFreezeFrameId = null,
  onHoverFreezeFrame,
  onSelectFreezeFrame,
  onUpdateFreezeFrameDuration,
  onOpenFreezeFrameAnimation,
  onToggleFreezeFrameDeactivation,
  onDeleteFreezeFrame,
  onAddFreezeFrame,
  onToggleTrackInFreezeFrame,
  selectedShapeId,
  onSelectShape,
  onTogglePlay,
  onTimelineTogglePlay,
  onSeek,
  onSeekVirtual,
  onStepFrame,
  onToggleLoop,
  onChangePlaybackRate,
  onUpdateTrackRange,
  onToggleTrackHidden,
  onToggleTrackLocked,
  onRenameTrack,
  onDeleteTrack,
  onDuplicateTrack,
  onSplitTrackAtPlayhead,
  onSetTrackRoi,
}) => {
  const clipDuration = Math.max(0.5, clipEnd - clipStart);
  const overlapSourceShapes = allTrackedShapes ?? trackShapes;

  const [panelHeight, setPanelHeight] = useState<number>(DEFAULT_TIMELINE_HEIGHT);
  const [snapEnabled, setSnapEnabled] = useState<boolean>(true);
  const [zoomFactor, setZoomFactor] = useState<number>(1);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState<string>('');
  const [activeBarDrag, setActiveBarDrag] = useState<ActiveBarDrag | null>(null);
  const [activeFFDrag, setActiveFFDrag] = useState<ActiveFFDrag | null>(null);
  const [isScrubbingRuler, setIsScrubbingRuler] = useState<boolean>(false);

  const laneViewportRef = useRef<HTMLDivElement | null>(null);
  const headerScrollRef = useRef<HTMLDivElement | null>(null);
  const laneScrollRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState<number>(800);

  useEffect(() => {
    const el = laneViewportRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 120) setViewportWidth(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Split clip freeze frames into active (pause playback + expand NLE duration) vs disabled (thin marker only)
  const { enabledFreezeFrames, disabledFreezeFrames } = useMemo(() => {
    const enabled: FreezeFrame[] = [];
    const disabled: FreezeFrame[] = [];
    for (const ff of clipFreezeFrames) {
      const isEnabled =
        isFreezeFrameActiveForClip(ff, clipItem, clipIndex) || ff.id === editingAnimationFFId;
      const effectiveFF =
        activeFFDrag?.ffId === ff.id
          ? {
              ...ff,
              duration: activeFFDrag.currentDuration,
            }
          : ff;
      if (isEnabled) {
        enabled.push(effectiveFF);
      } else {
        disabled.push(effectiveFF);
      }
    }
    return { enabledFreezeFrames: enabled, disabledFreezeFrames: disabled };
  }, [clipFreezeFrames, clipItem, clipIndex, editingAnimationFFId, activeFFDrag]);

  // Expand clip timeline cleanly wherever an enabled Freeze Frame pauses playback
  const { segments, totalDuration: virtualDuration } = useMemo(
    () => buildVirtualTimelineSegments(clipStart, clipEnd, enabledFreezeFrames),
    [clipStart, clipEnd, enabledFreezeFrames]
  );

  const totalFreezeDuration = Math.max(0, virtualDuration - clipDuration);
  const timelineContentWidth = Math.max(viewportWidth, Math.round(viewportWidth * zoomFactor));
  const pxPerSecond = timelineContentWidth / virtualDuration;

  const triggeredSet = useMemo(() => new Set(triggeredFreezeFrameIds), [triggeredFreezeFrameIds]);

  const playheadVirtualOffset = useMemo(
    () =>
      getPlayheadVirtualOffset({
        currentTime,
        activeFreezeFrameId,
        countdownValue,
        editingAnimationFFId,
        animationPreviewTime,
        segments,
        clipStart,
        triggeredFFIds: triggeredSet,
      }),
    [
      currentTime,
      activeFreezeFrameId,
      countdownValue,
      editingAnimationFFId,
      animationPreviewTime,
      segments,
      clipStart,
      triggeredSet,
    ]
  );

  const playheadX = playheadVirtualOffset * pxPerSecond;
  const effectiveIsPlaying = isPlaying || isFreezeFramePlaying;

  // Vertical resize splitter at top of timeline
  const handleResizePointerDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = panelHeight;
    const onMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY;
      setPanelHeight(Math.max(MIN_TIMELINE_HEIGHT, Math.min(MAX_TIMELINE_HEIGHT, startH + delta)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Sync vertical scroll between left headers and right track lanes
  const syncingScrollRef = useRef<'header' | 'lane' | 'auto' | null>(null);
  const autoScrollRafRef = useRef<number | null>(null);
  const prevClipKeyRef = useRef<string | undefined>(clipKey);
  const prevTrackIdsRef = useRef<Set<string> | null>(null);

  const handleHeaderScroll = () => {
    if (syncingScrollRef.current === 'lane' || syncingScrollRef.current === 'auto') return;
    syncingScrollRef.current = 'header';
    if (headerScrollRef.current && laneScrollRef.current) {
      laneScrollRef.current.scrollTop = headerScrollRef.current.scrollTop;
    }
    requestAnimationFrame(() => {
      if (syncingScrollRef.current === 'header') {
        syncingScrollRef.current = null;
      }
    });
  };

  const handleLaneScroll = () => {
    if (syncingScrollRef.current === 'header' || syncingScrollRef.current === 'auto') return;
    syncingScrollRef.current = 'lane';
    if (headerScrollRef.current && laneScrollRef.current) {
      headerScrollRef.current.scrollTop = laneScrollRef.current.scrollTop;
    }
    requestAnimationFrame(() => {
      if (syncingScrollRef.current === 'lane') {
        syncingScrollRef.current = null;
      }
    });
  };

  // Auto-scroll timeline cleanly when a new dynamic track is added
  useEffect(() => {
    const currentIds = new Set(trackShapes.map((s) => s.id));
    if (prevTrackIdsRef.current === null || prevClipKeyRef.current !== clipKey) {
      prevClipKeyRef.current = clipKey;
      prevTrackIdsRef.current = currentIds;
      return;
    }

    const addedIndexes: number[] = [];
    trackShapes.forEach((shape, idx) => {
      if (!prevTrackIdsRef.current!.has(shape.id)) {
        addedIndexes.push(idx);
      }
    });
    prevTrackIdsRef.current = currentIds;

    if (addedIndexes.length === 0) return;

    const targetIndex = addedIndexes[addedIndexes.length - 1];
    const headerEl = headerScrollRef.current;
    const laneEl = laneScrollRef.current;
    if (!headerEl || !laneEl) return;

    const visibleHeight = headerEl.clientHeight;
    if (visibleHeight <= 0) return;

    const rowTop = targetIndex * ROW_HEIGHT;
    const rowBottom = rowTop + ROW_HEIGHT;
    const currentTop = headerEl.scrollTop;
    const maxTop = Math.max(0, trackShapes.length * ROW_HEIGHT - visibleHeight);

    let nextTop = currentTop;
    if (rowBottom > currentTop + visibleHeight) {
      nextTop = Math.min(maxTop, rowBottom - visibleHeight);
    } else if (rowTop < currentTop) {
      nextTop = Math.max(0, rowTop);
    }

    if (Math.abs(nextTop - currentTop) < 1) return;

    if (autoScrollRafRef.current !== null) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }

    const startTime = performance.now();
    const durationMs = 180;
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const interpolated = currentTop + (nextTop - currentTop) * eased;
      syncingScrollRef.current = 'auto';
      if (headerScrollRef.current) headerScrollRef.current.scrollTop = interpolated;
      if (laneScrollRef.current) laneScrollRef.current.scrollTop = interpolated;
      if (t < 1) {
        autoScrollRafRef.current = requestAnimationFrame(step);
      } else {
        autoScrollRafRef.current = null;
        requestAnimationFrame(() => {
          if (syncingScrollRef.current === 'auto') {
            syncingScrollRef.current = null;
          }
        });
      }
    };
    autoScrollRafRef.current = requestAnimationFrame(step);
  }, [trackShapes, clipKey]);

  useEffect(() => {
    return () => {
      if (autoScrollRafRef.current !== null) {
        cancelAnimationFrame(autoScrollRafRef.current);
      }
    };
  }, []);

  // Ruler tick spacing chosen dynamically by pxPerSecond across expanded virtualDuration
  const ticks = useMemo(() => {
    const minMajorPx = 72;
    const candidates = [0.2, 0.5, 1, 2, 5, 10, 15, 30, 60];
    let majorStep = 60;
    for (const c of candidates) {
      if (c * pxPerSecond >= minMajorPx) {
        majorStep = c;
        break;
      }
    }
    const minorStep = majorStep / 5;
    const list: { offsetSec: number; isMajor: boolean; label: string }[] = [];
    const totalMinorCount = Math.floor(virtualDuration / minorStep);
    for (let i = 0; i <= totalMinorCount; i++) {
      const offsetSec = Number((i * minorStep).toFixed(4));
      if (offsetSec > virtualDuration + 0.001) break;
      const isMajor = i % 5 === 0;
      list.push({
        offsetSec,
        isMajor,
        label: isMajor ? `${offsetSec.toFixed(majorStep < 1 ? 1 : 0)}s` : '',
      });
    }
    return list;
  }, [virtualDuration, pxPerSecond]);

  const virtualOffsetFromClientX = useCallback(
    (clientX: number): number => {
      const scrollEl = laneScrollRef.current;
      if (!scrollEl) return 0;
      const rect = scrollEl.getBoundingClientRect();
      const xInContent = clientX - rect.left + scrollEl.scrollLeft;
      const clampedX = Math.max(0, Math.min(virtualDuration * pxPerSecond, xInContent));
      return clampedX / pxPerSecond;
    },
    [virtualDuration, pxPerSecond]
  );

  const performVirtualSeek = useCallback(
    (virtualOffset: number, pause = true) => {
      if (onSeekVirtual) {
        onSeekVirtual(virtualOffset, pause);
      } else {
        onSeek(virtualOffsetToVideoTime(virtualOffset, segments, clipStart, clipEnd), pause);
      }
    },
    [onSeekVirtual, onSeek, segments, clipStart, clipEnd]
  );

  // Playhead scrubbing on ruler or empty lane/freeze pause backdrop
  const beginRulerScrub = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsScrubbingRuler(true);
    performVirtualSeek(virtualOffsetFromClientX(e.clientX), true);
  };

  useEffect(() => {
    if (!isScrubbingRuler) return;
    const onMove = (e: MouseEvent) => {
      performVirtualSeek(virtualOffsetFromClientX(e.clientX), true);
    };
    const onUp = () => {
      setIsScrubbingRuler(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isScrubbingRuler, performVirtualSeek, virtualOffsetFromClientX]);

  // Snap candidates (in source video seconds) for magnetic drag/trim
  const findSnapTime = useCallback(
    (rawVideoTime: number, excludeShapeId: string): number | null => {
      if (!snapEnabled) return null;
      const thresholdSec = 8 / pxPerSecond;
      const candidates: number[] = [clipStart, clipEnd, currentTime];
      enabledFreezeFrames.forEach((ff) => candidates.push(ff.timestamp));
      trackShapes.forEach((s) => {
        if (s.id === excludeShapeId) return;
        if (s.trackStartTime !== undefined) candidates.push(s.trackStartTime);
        if (s.trackEndTime !== undefined) candidates.push(s.trackEndTime);
      });
      let best: number | null = null;
      let bestDist = thresholdSec;
      for (const cand of candidates) {
        const d = Math.abs(cand - rawVideoTime);
        if (d < bestDist) {
          bestDist = d;
          best = cand;
        }
      }
      return best;
    },
    [snapEnabled, pxPerSecond, clipStart, clipEnd, currentTime, enabledFreezeFrames, trackShapes]
  );

  // Drag / crop track bar handlers (mapping virtual timeline px smoothly to source video times)
  const beginBarDrag = (e: React.MouseEvent, shape: Shape, mode: DragMode) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    onSelectShape(shape.id);
    if (shape.trackLocked) return;

    const initialStart = Math.max(clipStart, shape.trackStartTime ?? clipStart);
    const initialEnd = Math.min(clipEnd, Math.max(initialStart + MIN_BAR_DURATION, shape.trackEndTime ?? clipStart + 5));
    const initialVirtualStart = videoTimeToVirtualOffset(initialStart, segments, clipStart, 'before-freeze');
    const initialVirtualEnd = videoTimeToVirtualOffset(initialEnd, segments, clipStart, 'after-freeze');

    setActiveBarDrag({
      shapeId: shape.id,
      mode,
      startClientX: e.clientX,
      dragPxPerSecond: pxPerSecond,
      initialStart,
      initialEnd,
      initialVirtualStart,
      initialVirtualEnd,
      currentStart: initialStart,
      currentEnd: initialEnd,
      snappedEdgeTime: null,
    });
  };

  useEffect(() => {
    if (!activeBarDrag) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - activeBarDrag.startClientX;
      const deltaVirtualSec = dx / activeBarDrag.dragPxPerSecond;
      let nextStart = activeBarDrag.initialStart;
      let nextEnd = activeBarDrag.initialEnd;
      let snapped: number | null = null;

      if (activeBarDrag.mode === 'move') {
        const barDur = activeBarDrag.initialEnd - activeBarDrag.initialStart;
        const targetVirtualStart = activeBarDrag.initialVirtualStart + deltaVirtualSec;
        const rawVideoStart = virtualOffsetToVideoTime(targetVirtualStart, segments, clipStart, clipEnd);
        let candStart = Math.max(clipStart, Math.min(clipEnd - barDur, rawVideoStart));
        const snapLeft = findSnapTime(candStart, activeBarDrag.shapeId);
        const snapRight = findSnapTime(candStart + barDur, activeBarDrag.shapeId);
        if (snapLeft !== null && snapLeft + barDur <= clipEnd + 0.001 && snapLeft >= clipStart - 0.001) {
          candStart = Math.max(clipStart, Math.min(clipEnd - barDur, snapLeft));
          snapped = candStart;
        } else if (snapRight !== null && snapRight - barDur >= clipStart - 0.001 && snapRight <= clipEnd + 0.001) {
          candStart = Math.max(clipStart, Math.min(clipEnd - barDur, snapRight - barDur));
          snapped = candStart + barDur;
        }
        nextStart = candStart;
        nextEnd = candStart + barDur;
      } else if (activeBarDrag.mode === 'trim-left') {
        const targetVirtualStart = activeBarDrag.initialVirtualStart + deltaVirtualSec;
        const rawVideoStart = virtualOffsetToVideoTime(targetVirtualStart, segments, clipStart, clipEnd);
        let candStart = Math.max(
          clipStart,
          Math.min(activeBarDrag.initialEnd - MIN_BAR_DURATION, rawVideoStart)
        );
        const snapLeft = findSnapTime(candStart, activeBarDrag.shapeId);
        if (
          snapLeft !== null &&
          snapLeft >= clipStart - 0.001 &&
          snapLeft <= activeBarDrag.initialEnd - MIN_BAR_DURATION
        ) {
          candStart = Math.max(clipStart, snapLeft);
          snapped = candStart;
        }
        nextStart = candStart;
      } else if (activeBarDrag.mode === 'trim-right') {
        const targetVirtualEnd = activeBarDrag.initialVirtualEnd + deltaVirtualSec;
        const rawVideoEnd = virtualOffsetToVideoTime(targetVirtualEnd, segments, clipStart, clipEnd);
        let candEnd = Math.min(
          clipEnd,
          Math.max(activeBarDrag.initialStart + MIN_BAR_DURATION, rawVideoEnd)
        );
        const snapRight = findSnapTime(candEnd, activeBarDrag.shapeId);
        if (
          snapRight !== null &&
          snapRight <= clipEnd + 0.001 &&
          snapRight >= activeBarDrag.initialStart + MIN_BAR_DURATION
        ) {
          candEnd = Math.min(clipEnd, snapRight);
          snapped = candEnd;
        }
        nextEnd = candEnd;
      }

      nextStart = Number(nextStart.toFixed(3));
      nextEnd = Number(nextEnd.toFixed(3));
      setActiveBarDrag((prev) =>
        prev
          ? {
              ...prev,
              currentStart: nextStart,
              currentEnd: nextEnd,
              snappedEdgeTime: snapped,
            }
          : null
      );
      onUpdateTrackRange(activeBarDrag.shapeId, nextStart, nextEnd);
    };

    const onUp = () => {
      setActiveBarDrag(null);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [activeBarDrag, segments, clipStart, clipEnd, findSnapTime, onUpdateTrackRange]);

  // Freeze Frame right-edge drag (only expand or reduce end point / hold duration; position is anchored)
  const beginFFResizeDrag = (e: React.MouseEvent, ff: FreezeFrame) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    setActiveFFDrag({
      ffId: ff.id,
      startClientX: e.clientX,
      dragPxPerSecond: pxPerSecond,
      initialTimestamp: ff.timestamp,
      initialDuration: Math.max(MIN_FF_DURATION, ff.duration || 5),
      currentDuration: Math.max(MIN_FF_DURATION, ff.duration || 5),
      hasMoved: false,
    });
  };

  useEffect(() => {
    if (!activeFFDrag) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - activeFFDrag.startClientX;
      const moved = activeFFDrag.hasMoved || Math.abs(dx) >= 3;
      const deltaSec = dx / activeFFDrag.dragPxPerSecond;

      const rawDur = Math.max(
        MIN_FF_DURATION,
        Math.min(MAX_FF_DURATION, activeFFDrag.initialDuration + deltaSec)
      );
      const nextDur = Number(rawDur.toFixed(1));
      setActiveFFDrag((prev) =>
        prev ? { ...prev, currentDuration: nextDur, hasMoved: moved } : null
      );
      if (moved) {
        onUpdateFreezeFrameDuration?.(activeFFDrag.ffId, nextDur);
      }
    };

    const onUp = () => {
      setActiveFFDrag(null);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [activeFFDrag, onUpdateFreezeFrameDuration]);

  const selectedTrack = useMemo(
    () => trackShapes.find((s) => s.id === selectedShapeId) || null,
    [trackShapes, selectedShapeId]
  );

  const commitRename = (shapeId: string) => {
    const trimmed = editingNameValue.trim();
    if (trimmed) {
      onRenameTrack(shapeId, trimmed);
    }
    setEditingTrackId(null);
  };

  return (
    <section
      style={{ height: panelHeight }}
      className="w-full bg-[#090a0d] border-t border-[#222] flex flex-col shrink-0 select-none relative z-30"
    >
      {/* Top Vertical Resize Splitter */}
      <div
        onMouseDown={handleResizePointerDown}
        className="h-1 w-full cursor-row-resize hover:bg-[#c6ff1f]/70 active:bg-[#c6ff1f] transition-colors shrink-0 bg-[#14161d]"
        title="Drag to resize timeline height"
      />

      {/* Transport + Timeline Controls Bar */}
      <div className="h-8 px-2.5 bg-[#0f1014] border-b border-[#1f222c] flex items-center justify-between gap-2 shrink-0 overflow-x-auto no-scrollbar">
        {/* Left: Playback Transport & Expanded Clip Timecode */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => performVirtualSeek(0, true)}
            className="w-6 h-6 rounded hover:bg-[#1e212b] text-gray-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Jump to Clip Start"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onStepFrame(-1)}
            className="w-6 h-6 rounded hover:bg-[#1e212b] text-gray-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Previous Frame (←)"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onTimelineTogglePlay ?? onTogglePlay}
            className={`w-7 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
              effectiveIsPlaying
                ? 'bg-[#c6ff1f] text-black hover:bg-[#b2e817]'
                : 'bg-[#1c1f29] hover:bg-[#272b38] text-[#c6ff1f] border border-[#c6ff1f]/35'
            }`}
            title={
              activeFreezeFrameId
                ? isFreezeFramePlaying
                  ? 'Pause Freeze Frame Hold (Space skips to video)'
                  : 'Play Freeze Frame Hold'
                : 'Play / Pause (Space)'
            }
          >
            {effectiveIsPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onStepFrame(1)}
            className="w-6 h-6 rounded hover:bg-[#1e212b] text-gray-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Next Frame (→)"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => performVirtualSeek(virtualDuration, true)}
            className="w-6 h-6 rounded hover:bg-[#1e212b] text-gray-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Jump to Clip End"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onToggleLoop}
            className={`h-6 px-1.5 rounded text-[10px] font-semibold flex items-center gap-1 border transition-colors cursor-pointer whitespace-nowrap ${
              isLooping
                ? 'bg-[#c6ff1f]/15 text-[#c6ff1f] border-[#c6ff1f]/40'
                : 'bg-[#161820] text-gray-400 border-[#262934] hover:text-gray-200'
            }`}
            title="Loop Clip Playback"
          >
            <Repeat className="w-3 h-3" />
          </button>

          <div className="h-4 w-px bg-[#242732] mx-1" />

          {/* Expanded NLE Timecode Readout */}
          <div className="flex items-center gap-1.5 font-mono tabular-nums text-[11px] bg-[#08090c] border border-[#222530] rounded px-2 py-0.5 whitespace-nowrap">
            <span className={activeFreezeFrameId ? 'text-amber-300 font-bold' : 'text-[#c6ff1f] font-bold'}>
              {formatTrackClock(playheadVirtualOffset)}
            </span>
            <span className="text-gray-600">/</span>
            <span className="text-gray-300">{formatTrackClock(virtualDuration)}</span>
            {totalFreezeDuration > 0.05 && (
              <span
                className="text-[9px] font-bold px-1 rounded bg-amber-500/15 text-amber-300 border border-amber-400/30"
                title={`Base clip ${formatTrackClock(clipDuration)} + ${totalFreezeDuration.toFixed(1)}s freeze frame hold`}
              >
                +{totalFreezeDuration.toFixed(1)}s FF
              </span>
            )}
          </div>

          {/* Speed Selector */}
          <select
            value={playbackRate}
            onChange={(e) => onChangePlaybackRate(Number(e.target.value))}
            className="h-6 bg-[#14161e] border border-[#262934] rounded px-1.5 text-[10px] font-mono tabular-nums text-gray-200 outline-none focus:border-[#c6ff1f]/60 cursor-pointer"
            title="Playback Speed"
          >
            <option value={0.25}>0.25x</option>
            <option value={0.5}>0.5x</option>
            <option value={1}>1.0x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2.0x</option>
          </select>
        </div>

        {/* Center: Selected Track Quick Edit OR Timeline Summary + Add Freeze Frame */}
        {selectedTrack ? (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#14161e] border border-[#282c3a] shrink-0">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: getTrackDisplayColor(selectedTrack) }}
            />
            <span className="text-[10px] font-bold text-white max-w-[90px] truncate">
              {selectedTrack.trackLabel || 'Track'}
            </span>
            <span className="text-[10px] font-mono tabular-nums text-gray-400">
              {formatTrackDuration(
                (selectedTrack.trackEndTime ?? clipEnd) - (selectedTrack.trackStartTime ?? clipStart)
              )}
            </span>
            <div className="h-3.5 w-px bg-[#2c303f] mx-0.5" />
            {[
              { label: '2s', sec: 2 },
              { label: '5s', sec: 5 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                disabled={selectedTrack.trackLocked}
                onClick={() => {
                  const s = selectedTrack.trackStartTime ?? clipStart;
                  const nextEnd = Math.min(clipEnd, s + preset.sec);
                  onUpdateTrackRange(selectedTrack.id, s, Math.max(s + MIN_BAR_DURATION, nextEnd));
                }}
                className="h-5 px-1.5 rounded bg-[#1d202b] hover:bg-[#282c3a] text-[9.5px] font-mono tabular-nums text-gray-200 hover:text-[#c6ff1f] disabled:opacity-35 transition-colors cursor-pointer"
                title={`Set duration to ${preset.label}`}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              disabled={selectedTrack.trackLocked}
              onClick={() => onUpdateTrackRange(selectedTrack.id, clipStart, clipEnd)}
              className="h-5 px-1.5 rounded bg-[#1d202b] hover:bg-[#282c3a] text-[9.5px] font-semibold text-gray-200 hover:text-[#c6ff1f] disabled:opacity-35 transition-colors whitespace-nowrap cursor-pointer"
              title="Extend track to entire clip"
            >
              Clip
            </button>
            <button
              type="button"
              disabled={
                selectedTrack.trackLocked ||
                currentTime <= (selectedTrack.trackStartTime ?? clipStart) + 0.3 ||
                currentTime >= (selectedTrack.trackEndTime ?? clipEnd) - 0.3
              }
              onClick={() => onSplitTrackAtPlayhead(selectedTrack.id)}
              className="w-5 h-5 rounded hover:bg-[#282c3a] text-gray-300 hover:text-[#c6ff1f] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-colors cursor-pointer"
              title="Split track at playhead"
            >
              <Scissors className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => onDuplicateTrack(selectedTrack.id)}
              className="w-5 h-5 rounded hover:bg-[#282c3a] text-gray-300 hover:text-[#c6ff1f] flex items-center justify-center transition-colors cursor-pointer"
              title="Duplicate track"
            >
              <Copy className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => onSetTrackRoi(selectedTrack.id)}
              className={`w-5 h-5 rounded hover:bg-[#282c3a] flex items-center justify-center transition-colors cursor-pointer ${
                selectedTrack.playerBox ? 'text-[#c6ff1f]' : 'text-gray-300 hover:text-[#c6ff1f]'
              }`}
              title="Draw Player Target Box"
            >
              <SquareDashed className="w-3 h-3" />
            </button>
            <button
              type="button"
              disabled={selectedTrack.trackLocked}
              onClick={() => onDeleteTrack(selectedTrack.id)}
              className="w-5 h-5 rounded hover:bg-red-950/60 text-gray-400 hover:text-red-400 disabled:opacity-30 flex items-center justify-center transition-colors cursor-pointer"
              title="Delete track (Del)"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="text-[10px] text-gray-500 hidden md:flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <Crosshair className="w-3 h-3 text-[#c6ff1f]/70" />
              <span>
                {trackShapes.length} {trackShapes.length === 1 ? 'track' : 'tracks'}
              </span>
              {enabledFreezeFrames.length > 0 && (
                <>
                  <span aria-hidden="true" className="text-gray-700">·</span>
                  <span className="inline-flex items-center gap-1 text-amber-300 font-semibold">
                    <Snowflake className="w-2.5 h-2.5 text-[#c6ff1f]" />
                    {enabledFreezeFrames.length}{' '}
                    {enabledFreezeFrames.length === 1 ? 'pause hold' : 'pause holds'}
                  </span>
                </>
              )}
              <span aria-hidden="true" className="text-gray-700">·</span>
              <span>Drag bar edges to expand duration</span>
            </div>
            {onAddFreezeFrame && (
              <button
                type="button"
                onClick={onAddFreezeFrame}
                className="h-5.5 px-2 rounded bg-[#181b23] hover:bg-[#c6ff1f]/15 text-[#c6ff1f] border border-[#c6ff1f]/35 hover:border-[#c6ff1f]/70 text-[9.5px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                title="Add Freeze Frame pause hold at playhead (Shift+F)"
              >
                <Snowflake className="w-2.5 h-2.5" />
                <span>+ Freeze Frame</span>
              </button>
            )}
          </div>
        )}

        {/* Right: Snap & Zoom */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setSnapEnabled((prev) => !prev)}
            className={`h-6 px-2 rounded text-[10px] font-semibold flex items-center gap-1 border transition-colors whitespace-nowrap cursor-pointer ${
              snapEnabled
                ? 'bg-[#c6ff1f]/15 text-[#c6ff1f] border-[#c6ff1f]/40'
                : 'bg-[#161820] text-gray-400 border-[#262934] hover:text-gray-200'
            }`}
            title="Toggle Magnetic Snapping"
          >
            <Magnet className="w-3 h-3" />
            <span>Snap</span>
          </button>

          <div className="flex items-center gap-1 bg-[#14161e] border border-[#262934] rounded px-1.5 h-6">
            <button
              type="button"
              onClick={() => setZoomFactor((z) => Math.max(1, Number((z / 1.35).toFixed(2))))}
              className="p-0.5 text-gray-400 hover:text-white cursor-pointer"
              title="Zoom Out Timeline"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <input
              type="range"
              min={1}
              max={6}
              step={0.1}
              value={zoomFactor}
              onChange={(e) => setZoomFactor(Number(e.target.value))}
              className="w-16 accent-[#c6ff1f] h-1 cursor-pointer"
              title={`Timeline Zoom: ${zoomFactor.toFixed(1)}x`}
            />
            <button
              type="button"
              onClick={() => setZoomFactor((z) => Math.min(6, Number((z * 1.35).toFixed(2))))}
              className="p-0.5 text-gray-400 hover:text-white cursor-pointer"
              title="Zoom In Timeline"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setZoomFactor(1)}
              className="p-0.5 text-gray-400 hover:text-[#c6ff1f] cursor-pointer"
              title="Fit Clip to View"
            >
              <Maximize2 className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Split Body: Left Layers Column (Track shapes only) + Right Expanded NLE Canvas */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left Track Names Column */}
        <div
          style={{ width: HEADER_COL_WIDTH }}
          className="bg-[#0d0e12] border-r border-[#222530] flex flex-col shrink-0"
        >
          {/* Ruler corner header (20px) */}
          <div
            style={{ height: RULER_HEIGHT }}
            className="px-2.5 border-b border-[#222530] bg-[#111319] flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-gray-400 shrink-0"
          >
            <span>Layers ({trackShapes.length})</span>
            <span className="font-mono tabular-nums text-[8.5px] text-gray-500">5s Default</span>
          </div>

          {/* Freeze Holds Strip Corner Header (26px — aligned with right Freeze Frame Header Strip) */}
          <div
            style={{ height: FF_STRIP_HEIGHT }}
            className="px-2 border-b border-[#242836] bg-[#101219] flex items-center justify-between text-[9px] font-bold uppercase tracking-wider shrink-0"
          >
            <div className="flex items-center gap-1.5 text-amber-300/90 min-w-0">
              <Snowflake className="w-2.5 h-2.5 text-[#c6ff1f] shrink-0" />
              <span className="truncate">Freeze Holds ({enabledFreezeFrames.length})</span>
            </div>
            {onAddFreezeFrame && (
              <button
                type="button"
                onClick={onAddFreezeFrame}
                className="px-1.5 py-0.5 rounded bg-[#c6ff1f]/12 hover:bg-[#c6ff1f]/25 text-[#c6ff1f] border border-[#c6ff1f]/30 text-[8.5px] font-bold transition-colors cursor-pointer shrink-0"
                title="Add Freeze Frame pause hold at playhead (Shift+F)"
              >
                + FF
              </button>
            )}
          </div>

          {/* Left Track Headers Scroll Viewport (Dynamic Overlays ONLY — Freeze Frames are NOT layer rows) */}
          <div
            ref={headerScrollRef}
            onScroll={handleHeaderScroll}
            className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar"
          >
            {trackShapes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center px-3 text-center text-gray-500">
                <span className="text-[10px] font-medium text-gray-400">No tracked layers</span>
                <span className="text-[9px] text-gray-600 mt-0.5">
                  Draw Ring, Chain, Lens, Spotlight, Radar, Tag or Text
                </span>
              </div>
            ) : (
              trackShapes.map((shape) => {
                const isSelected = shape.id === selectedShapeId;
                const Icon = (shape.type && TRACK_ICON_MAP[shape.type]) || Circle;
                const color = getTrackDisplayColor(shape);

                return (
                  <div
                    key={shape.id}
                    style={{ height: ROW_HEIGHT }}
                    onClick={() => onSelectShape(shape.id)}
                    className={`px-2 border-b border-[#191b23] flex items-center justify-between gap-1 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#1a1f14] text-white'
                        : 'hover:bg-[#151720] text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span
                        className="w-1.5 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <Icon className="w-3 h-3 text-gray-400 shrink-0" />
                      {editingTrackId === shape.id ? (
                        <input
                          type="text"
                          autoFocus
                          value={editingNameValue}
                          onChange={(e) => setEditingNameValue(e.target.value)}
                          onBlur={() => commitRename(shape.id)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') commitRename(shape.id);
                            if (e.key === 'Escape') setEditingTrackId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-[#090a0d] border border-[#c6ff1f] rounded px-1 text-[10px] text-white outline-none w-full min-w-0 h-4"
                        />
                      ) : (
                        <span
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingTrackId(shape.id);
                            setEditingNameValue(shape.trackLabel || 'Track');
                          }}
                          className={`text-[10.5px] font-semibold truncate ${
                            shape.trackHidden ? 'line-through text-gray-600' : ''
                          }`}
                          title={`${shape.trackLabel || 'Track'} (Double-click to rename)`}
                        >
                          {shape.trackLabel || 'Track'}
                        </span>
                      )}
                    </div>

                    {/* Row Controls: ROI indicator + Visibility + Lock + Delete */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      {shape.playerBox && (
                        <span
                          className="text-[#c6ff1f] p-0.5"
                          title="Player Target ROI Box Ready"
                        >
                          <SquareDashed className="w-2.5 h-2.5" />
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleTrackHidden(shape.id);
                        }}
                        className={`p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer ${
                          shape.trackHidden ? 'text-amber-400' : 'text-gray-500 hover:text-white'
                        }`}
                        title={shape.trackHidden ? 'Show Track' : 'Hide Track'}
                      >
                        {shape.trackHidden ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleTrackLocked(shape.id);
                        }}
                        className={`p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer ${
                          shape.trackLocked ? 'text-amber-400' : 'text-gray-500 hover:text-white'
                        }`}
                        title={shape.trackLocked ? 'Unlock Track' : 'Lock Track'}
                      >
                        {shape.trackLocked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                      </button>
                      <button
                        type="button"
                        disabled={shape.trackLocked}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTrack(shape.id);
                        }}
                        className="p-0.5 rounded hover:bg-red-950/60 text-gray-500 hover:text-red-400 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                        title="Remove Track"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Timeline Ruler, Freeze Frame Top Strip & Full-Height Freeze Pause Columns + Track Bars */}
        <div ref={laneViewportRef} className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[#08090c] relative">
          <div
            ref={laneScrollRef}
            onScroll={handleLaneScroll}
            className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative"
          >
            <div style={{ width: timelineContentWidth }} className="min-h-full relative flex flex-col">
              {/* Sticky Header Group: Time Ruler (20px) + Freeze Frame Control Strip (26px) */}
              <div className="sticky top-0 z-30 shrink-0">
                {/* 1. Time Ruler */}
                <div
                  style={{ height: RULER_HEIGHT }}
                  onMouseDown={beginRulerScrub}
                  className="bg-[#101218] border-b border-[#252834] relative cursor-pointer"
                >
                  {/* Highlighted Freeze Hold Spans right along the Ruler */}
                  {segments
                    .filter((seg) => seg.type === 'freeze' && seg.ff)
                    .map((seg) => (
                      <div
                        key={`ruler-ff-${seg.ff!.id}`}
                        style={{
                          left: seg.virtualStart * pxPerSecond,
                          width: Math.max(4, seg.duration * pxPerSecond),
                        }}
                        className="absolute top-0 bottom-0 bg-amber-400/15 border-x border-amber-400/45 pointer-events-none"
                      />
                    ))}

                  {ticks.map((t, idx) => {
                    const x = t.offsetSec * pxPerSecond;
                    return (
                      <div
                        key={idx}
                        style={{ left: x }}
                        className="absolute bottom-0 top-0 pointer-events-none flex flex-col justify-end"
                      >
                        <div
                          className={`w-px ${
                            t.isMajor ? 'h-3 bg-gray-500' : 'h-1.5 bg-gray-700'
                          }`}
                        />
                        {t.isMajor && (
                          <span className="absolute top-0.5 left-1 font-mono tabular-nums text-[9px] text-gray-400 whitespace-nowrap">
                            {t.label}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {/* Playhead Cap */}
                  <div
                    style={{ left: playheadX }}
                    className="absolute top-0 bottom-0 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center"
                  >
                    <div className="w-2.5 h-3 bg-[#c6ff1f] rounded-b-sm shadow-[0_0_8px_rgba(198,255,31,0.7)]" />
                  </div>
                </div>

                {/* 2. Freeze Frame Header Strip (Top of full-height vertical Freeze Frame bars) */}
                <div
                  style={{ height: FF_STRIP_HEIGHT }}
                  onMouseDown={beginRulerScrub}
                  className="bg-[#0c0e13] border-b border-[#242836] relative cursor-pointer"
                >
                  {clipFreezeFrames.length === 0 && (
                    <div className="h-full px-3 flex items-center text-[9.5px] text-gray-600 pointer-events-none">
                      Add Freeze Frame (Shift+F) to pause video & expand timeline at playhead
                    </div>
                  )}

                  {/* Disabled Freeze Frame quick-enable markers */}
                  {disabledFreezeFrames.map((ff) => {
                    const markerX =
                      videoTimeToVirtualOffset(ff.timestamp, segments, clipStart, 'before-freeze') *
                      pxPerSecond;
                    return (
                      <button
                        key={`disabled-ff-marker-${ff.id}`}
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFreezeFrameDeactivation?.(ff.id);
                        }}
                        style={{ left: markerX }}
                        className="absolute top-1 bottom-1 -translate-x-1/2 px-1.5 rounded bg-[#181a22] hover:bg-amber-500/20 border border-dashed border-gray-500 hover:border-amber-400 text-[8.5px] font-bold text-gray-400 hover:text-amber-300 flex items-center gap-1 z-20 cursor-pointer whitespace-nowrap"
                        title={`${ff.name || 'Freeze Frame'} is OFF for this clip · Click to turn ON`}
                      >
                        <EyeOff className="w-2.5 h-2.5" />
                        <span>{ff.name || 'FF'}</span>
                      </button>
                    );
                  })}

                  {/* Enabled Freeze Frame Controls Headers aligned cleanly above each full-height block */}
                  {segments
                    .filter((seg) => seg.type === 'freeze' && seg.ff)
                    .map((seg) => {
                      const ff = seg.ff!;
                      const isActive =
                        activeFreezeFrameId === ff.id || editingAnimationFFId === ff.id;
                      const isEditingAnim = editingAnimationFFId === ff.id;
                      const isHovered = hoveredFreezeFrameId === ff.id;
                      const isDraggingThis = activeFFDrag?.ffId === ff.id;
                      const barLeftPx = seg.virtualStart * pxPerSecond;
                      const barWidthPx = Math.max(28, seg.duration * pxPerSecond);

                      const overlappingTracks = getTracksOverlappingTimestamp(
                        overlapSourceShapes,
                        ff.timestamp
                      );

                      return (
                        <div
                          key={`ff-top-${ff.id}`}
                          onMouseEnter={() => onHoverFreezeFrame?.(ff.id)}
                          onMouseLeave={() => onHoverFreezeFrame?.(null)}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectFreezeFrame?.(ff.id);
                          }}
                          style={{ left: barLeftPx, width: barWidthPx }}
                          className={`group/fftop absolute top-[2px] bottom-[2px] rounded-t-sm border-t-2 border-x flex items-center gap-1 pl-1.5 pr-0.5 cursor-pointer z-20 transition-colors ${
                            isEditingAnim
                              ? 'bg-gradient-to-r from-[#c6ff1f]/30 via-amber-400/25 to-[#c6ff1f]/20 border-t-[#c6ff1f] border-x-[#c6ff1f] text-white'
                              : isActive
                              ? 'bg-gradient-to-r from-amber-500/30 via-[#c6ff1f]/22 to-amber-500/20 border-t-amber-400 border-x-amber-400/85 text-white'
                              : isHovered
                              ? 'bg-gradient-to-r from-[#c6ff1f]/22 via-amber-400/18 to-amber-500/15 border-t-[#c6ff1f] border-x-[#c6ff1f]/70 text-white'
                              : 'bg-gradient-to-r from-amber-500/20 via-amber-400/12 to-[#c6ff1f]/14 border-t-[#c6ff1f]/85 border-x-amber-400/45 text-gray-100 hover:border-x-[#c6ff1f]/75'
                          }`}
                          title={`${ff.name || 'Freeze Frame'} · ${seg.duration.toFixed(1)}s hold at +${formatTrackClock(ff.timestamp - clipStart)} (Click to pause at frame · Drag right edge to resize end point)`}
                        >
                          <Snowflake
                            className={`w-3 h-3 shrink-0 pointer-events-none ${
                              isActive ? 'text-[#c6ff1f]' : 'text-amber-300'
                            }`}
                          />
                          {barWidthPx > 72 && (
                            <span className="text-[9.5px] font-bold truncate pointer-events-none">
                              {ff.name || 'Freeze'}
                            </span>
                          )}
                          <span className="text-[9px] font-mono tabular-nums font-bold text-[#c6ff1f] shrink-0 pointer-events-none">
                            {seg.duration.toFixed(1)}s
                          </span>

                          {/* Dynamic tools overlapping this Freeze Frame timestamp (Use / Avoid quick toggles) */}
                          {overlappingTracks.length > 0 && barWidthPx > 145 && (
                            <div
                              onMouseDown={(e) => e.stopPropagation()}
                              className="flex items-center gap-0.5 min-w-0 overflow-hidden"
                            >
                              {overlappingTracks.slice(0, barWidthPx > 260 ? 3 : 1).map((trk) => {
                                const used = isTrackUsedInFreezeFrame(ff, trk.id);
                                return (
                                  <button
                                    key={trk.id}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleTrackInFreezeFrame?.(ff.id, trk.id);
                                    }}
                                    className={`h-4 px-1 rounded text-[8px] font-bold flex items-center gap-0.5 border shrink-0 cursor-pointer transition-colors ${
                                      used
                                        ? 'bg-[#c6ff1f]/18 border-[#c6ff1f]/50 text-[#c6ff1f] hover:bg-[#c6ff1f]/30'
                                        : 'bg-black/50 border-red-400/40 text-gray-400 line-through hover:text-white'
                                    }`}
                                    title={`${trk.trackLabel || 'Track'}: ${
                                      used
                                        ? 'Used during this Freeze Frame (Click to Avoid)'
                                        : 'Avoided during this Freeze Frame (Click to Use)'
                                    }`}
                                  >
                                    {used ? (
                                      <Check className="w-2 h-2 shrink-0" />
                                    ) : (
                                      <Ban className="w-2 h-2 shrink-0 text-red-400" />
                                    )}
                                    <span className="max-w-[44px] truncate">
                                      {trk.trackLabel || 'Track'}
                                    </span>
                                  </button>
                                );
                              })}
                              {overlappingTracks.length > (barWidthPx > 260 ? 3 : 1) && (
                                <span className="text-[8px] font-mono text-gray-300 px-0.5 shrink-0">
                                  +{overlappingTracks.length - (barWidthPx > 260 ? 3 : 1)}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="flex-1" />

                          {/* Direct Animation Panel Button right on the Freeze Frame Timeline Bar */}
                          {onOpenFreezeFrameAnimation && (
                            <button
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenFreezeFrameAnimation(ff.id);
                              }}
                              className={`h-4 px-1.5 rounded text-[8.5px] font-bold flex items-center gap-1 transition-all shrink-0 cursor-pointer ${
                                isEditingAnim
                                  ? 'bg-[#c6ff1f] text-black shadow-xs'
                                  : 'bg-[#090a0e]/85 hover:bg-[#c6ff1f] text-[#c6ff1f] hover:text-black border border-[#c6ff1f]/50'
                              }`}
                              title="Open Animation Timeline Panel for this Freeze Frame"
                            >
                              <LayoutGrid className="w-2.5 h-2.5 shrink-0" />
                              {barWidthPx > 125 && <span>Anim</span>}
                            </button>
                          )}

                          {/* Quick Toggle OFF & Delete on hover/active */}
                          {barWidthPx > 95 && onToggleFreezeFrameDeactivation && (
                            <button
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleFreezeFrameDeactivation(ff.id);
                              }}
                              className="p-0.5 rounded text-gray-300 hover:text-amber-300 hover:bg-black/40 opacity-0 group-hover/fftop:opacity-100 transition-opacity cursor-pointer shrink-0"
                              title="Turn OFF Freeze Frame for this clip"
                            >
                              <EyeOff className="w-2.5 h-2.5" />
                            </button>
                          )}

                          {barWidthPx > 110 && onDeleteFreezeFrame && (
                            <button
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteFreezeFrame(ff.id);
                              }}
                              className="p-0.5 rounded text-gray-300 hover:text-red-400 hover:bg-black/40 opacity-0 group-hover/fftop:opacity-100 transition-opacity cursor-pointer shrink-0"
                              title="Delete Freeze Frame"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          )}

                          {/* Top Strip Right Resize Handle (Expand / Reduce end point only) */}
                          <div
                            onMouseDown={(e) => beginFFResizeDrag(e, ff)}
                            className="w-2 h-full shrink-0 flex items-center justify-center rounded-tr-sm cursor-ew-resize bg-white/10 hover:bg-[#c6ff1f]/85 transition-colors"
                            title="Drag right edge to expand or reduce Freeze Frame end point"
                          >
                            <div className="w-[1.5px] h-2.5 bg-white/80 rounded-full pointer-events-none" />
                          </div>

                          {/* Floating Readout during End-Point Resize */}
                          {isDraggingThis && activeFFDrag && (
                            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-[#0a0b0e] border border-amber-400/75 text-amber-300 px-1.5 py-0.5 rounded text-[9px] font-mono tabular-nums whitespace-nowrap shadow-xl pointer-events-none z-50">
                              +{formatTrackClock(activeFFDrag.initialTimestamp - clipStart)} ·{' '}
                              <span className="text-[#c6ff1f] font-bold">
                                {activeFFDrag.currentDuration.toFixed(1)}s hold
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {/* Playhead vertical stem through FF Strip */}
                  <div
                    style={{ left: playheadX }}
                    className="absolute top-0 bottom-0 w-[1.5px] bg-[#c6ff1f] pointer-events-none z-30"
                  />
                </div>
              </div>

              {/* Track Lanes Area + Full-Height Freeze Frame Pause Columns */}
              <div className="relative flex-1 min-h-0">
                {/* Vertical Time Grid Lines */}
                <div className="absolute inset-0 pointer-events-none">
                  {ticks
                    .filter((t) => t.isMajor)
                    .map((t, idx) => (
                      <div
                        key={idx}
                        style={{ left: t.offsetSec * pxPerSecond }}
                        className="absolute top-0 bottom-0 w-px bg-white/[0.035]"
                      />
                    ))}
                </div>

                {/* Disabled Freeze Frame Thin Dashed Markers */}
                {disabledFreezeFrames.map((ff) => {
                  const markerX =
                    videoTimeToVirtualOffset(ff.timestamp, segments, clipStart, 'before-freeze') *
                    pxPerSecond;
                  return (
                    <div
                      key={`disabled-ff-line-${ff.id}`}
                      style={{ left: markerX }}
                      className="absolute top-0 bottom-0 w-px border-l border-dashed border-gray-500/40 pointer-events-none z-[1]"
                    />
                  );
                })}

                {/* Full-Height Vertical Freeze Frame Pause Columns (Span top-to-bottom across timeline) */}
                {segments
                  .filter((seg) => seg.type === 'freeze' && seg.ff)
                  .map((seg) => {
                    const ff = seg.ff!;
                    const isActive =
                      activeFreezeFrameId === ff.id || editingAnimationFFId === ff.id;
                    const isEditingAnim = editingAnimationFFId === ff.id;
                    const isHovered = hoveredFreezeFrameId === ff.id;
                    const barLeftPx = seg.virtualStart * pxPerSecond;
                    const barWidthPx = Math.max(28, seg.duration * pxPerSecond);

                    return (
                      <div
                        key={`ff-fullcol-${ff.id}`}
                        onMouseEnter={() => onHoverFreezeFrame?.(ff.id)}
                        onMouseLeave={() => onHoverFreezeFrame?.(null)}
                        onMouseDown={(e) => {
                          if (e.button !== 0) return;
                          e.stopPropagation();
                          setIsScrubbingRuler(true);
                          performVirtualSeek(virtualOffsetFromClientX(e.clientX), true);
                        }}
                        style={{
                          left: barLeftPx,
                          width: barWidthPx,
                          backgroundImage:
                            'repeating-linear-gradient(-45deg, rgba(245,158,11,0.09) 0px, rgba(245,158,11,0.09) 6px, rgba(198,255,31,0.03) 6px, rgba(198,255,31,0.03) 12px)',
                        }}
                        className={`group/ffcol absolute top-0 bottom-0 border-x cursor-pointer transition-colors z-[2] ${
                          isEditingAnim
                            ? 'bg-[#c6ff1f]/[0.09] border-x-[#c6ff1f]/80 shadow-[inset_0_0_24px_rgba(198,255,31,0.12)]'
                            : isActive
                            ? 'bg-amber-500/[0.11] border-x-amber-400/75 shadow-[inset_0_0_24px_rgba(245,158,11,0.14)]'
                            : isHovered
                            ? 'bg-[#c6ff1f]/[0.06] border-x-[#c6ff1f]/55'
                            : 'bg-amber-500/[0.05] border-x-amber-400/35'
                        }`}
                        title={`Freeze Frame Hold (${seg.duration.toFixed(1)}s) · Click to scrub hold · Drag right edge to expand duration`}
                      >
                        {/* Bottom Pause Indicator Tag inside full-height column */}
                        <div className="absolute bottom-1.5 left-1.5 right-2.5 flex items-center justify-between gap-1 pointer-events-none">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[8.5px] font-mono font-bold uppercase tracking-wider truncate backdrop-blur-xs border ${
                              isActive
                                ? 'bg-[#090a0d]/85 text-[#c6ff1f] border-[#c6ff1f]/45'
                                : 'bg-[#090a0d]/75 text-amber-300/90 border-amber-400/30'
                            }`}
                          >
                            {barWidthPx > 95 ? `PAUSE · ${seg.duration.toFixed(1)}s` : `${seg.duration.toFixed(1)}s`}
                          </span>
                        </div>

                        {/* Full-Height Right Edge Resize Handle (Expand / Reduce end point only) */}
                        <div
                          onMouseDown={(e) => beginFFResizeDrag(e, ff)}
                          className="absolute top-0 bottom-0 -right-1 w-2.5 cursor-ew-resize z-[18] flex items-center justify-center hover:bg-[#c6ff1f]/35 group-hover/ffcol:bg-amber-400/15 transition-colors"
                          title="Drag right edge to expand or reduce Freeze Frame end point"
                        >
                          <div className="w-[2px] h-7 rounded-full bg-amber-300/60 group-hover/ffcol:bg-[#c6ff1f] pointer-events-none" />
                        </div>
                      </div>
                    );
                  })}

                {/* Magnetic Snap Guideline while dragging track bars */}
                {activeBarDrag && activeBarDrag.snappedEdgeTime !== null && (
                  <div
                    style={{
                      left:
                        videoTimeToVirtualOffset(
                          activeBarDrag.snappedEdgeTime,
                          segments,
                          clipStart,
                          'before-freeze'
                        ) * pxPerSecond,
                    }}
                    className="absolute top-0 bottom-0 w-px bg-amber-400/90 z-20 pointer-events-none"
                  />
                )}

                {trackShapes.length === 0 ? (
                  <div
                    onMouseDown={beginRulerScrub}
                    className="h-full min-h-[100px] flex items-center justify-center text-[11px] text-gray-500 px-6 text-center cursor-pointer relative z-[5]"
                  >
                    {enabledFreezeFrames.length === 0
                      ? 'Use Freeze Frames (Shift+F) or any Track tool (Ring, Chain, Lens, Spotlight, Radar, Player Tag, Text) to annotate this clip.'
                      : 'Video pauses inside highlighted Freeze Frame columns. Select any tool on the left to add overlays.'}
                  </div>
                ) : (
                  <div className="relative z-[10]">
                    {trackShapes.map((shape) => {
                      const isSelected = shape.id === selectedShapeId;
                      const barStart = Math.max(clipStart, shape.trackStartTime ?? clipStart);
                      const barEnd = Math.min(
                        clipEnd,
                        Math.max(barStart + MIN_BAR_DURATION, shape.trackEndTime ?? barStart + 5)
                      );
                      const virtualBarStart = videoTimeToVirtualOffset(
                        barStart,
                        segments,
                        clipStart,
                        'before-freeze'
                      );
                      const virtualBarEnd = videoTimeToVirtualOffset(
                        barEnd,
                        segments,
                        clipStart,
                        'after-freeze'
                      );
                      const barLeftPx = virtualBarStart * pxPerSecond;
                      const barWidthPx = Math.max(12, (virtualBarEnd - virtualBarStart) * pxPerSecond);
                      const barColor = getTrackDisplayColor(shape);
                      const isDraggingThis = activeBarDrag?.shapeId === shape.id;

                      // Any active freeze frame pauses whose video timestamp overlaps this track's span
                      const intersectingFFSegments = segments.filter(
                        (seg) =>
                          seg.type === 'freeze' &&
                          seg.ff &&
                          seg.videoStart >= barStart - 0.05 &&
                          seg.videoStart <= barEnd + 0.05
                      );

                      return (
                        <div
                          key={shape.id}
                          style={{ height: ROW_HEIGHT }}
                          onMouseDown={(e) => {
                            if (e.target === e.currentTarget) {
                              onSelectShape(shape.id);
                            }
                          }}
                          className={`relative border-b border-[#161821]/80 ${
                            isSelected ? 'bg-[#14171f]/45' : ''
                          }`}
                        >
                          {/* Interactive Draggable + Croppable Dynamic Track Bar */}
                          <div
                            onMouseDown={(e) => beginBarDrag(e, shape, 'move')}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              performVirtualSeek(virtualBarStart, true);
                            }}
                            style={{
                              left: barLeftPx,
                              width: barWidthPx,
                              borderTopColor: barColor,
                              backgroundColor: isSelected
                                ? 'rgba(198, 255, 31, 0.16)'
                                : 'rgba(255, 255, 255, 0.08)',
                              opacity: shape.trackHidden ? 0.35 : 1,
                            }}
                            className={`group/bar absolute top-[2px] bottom-[2px] rounded-sm border-t-2 border-x border-b flex items-center overflow-visible transition-shadow ${
                              shape.trackLocked ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
                            } ${
                              isSelected
                                ? 'border-x-[#c6ff1f] border-b-[#c6ff1f]/70 shadow-[0_0_10px_rgba(198,255,31,0.2)] z-10'
                                : 'border-x-white/15 border-b-white/10 hover:border-x-white/35'
                            }`}
                            title={`${shape.trackLabel || 'Track'} · ${formatTrackDuration(
                              barEnd - barStart
                            )} active video span (Drag bar to move · Drag ends to crop)`}
                          >
                            {/* Visual Use / Avoid Slices inside any Freeze Frame Pause crossing this Track */}
                            {intersectingFFSegments.map((ffSeg) => {
                              const ff = ffSeg.ff!;
                              const used = isTrackUsedInFreezeFrame(ff, shape.id);
                              const relLeft = Math.max(0, (ffSeg.virtualStart - virtualBarStart) * pxPerSecond);
                              const sliceW = Math.min(
                                barWidthPx - relLeft,
                                ffSeg.duration * pxPerSecond
                              );
                              if (sliceW <= 4) return null;
                              return (
                                <button
                                  key={`slice-${ff.id}`}
                                  type="button"
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleTrackInFreezeFrame?.(ff.id, shape.id);
                                  }}
                                  style={{
                                    left: relLeft,
                                    width: sliceW,
                                    backgroundImage: !used
                                      ? 'repeating-linear-gradient(45deg, rgba(239,68,68,0.25) 0px, rgba(239,68,68,0.25) 4px, rgba(0,0,0,0.55) 4px, rgba(0,0,0,0.55) 8px)'
                                      : undefined,
                                  }}
                                  className={`absolute top-0 bottom-0 z-10 flex items-center justify-center transition-colors cursor-pointer ${
                                    used
                                      ? 'bg-amber-400/15 hover:bg-[#c6ff1f]/25 border-x border-amber-300/40'
                                      : 'bg-black/65 hover:bg-red-950/70 border-x border-red-400/55'
                                  }`}
                                  title={`${shape.trackLabel || 'Track'} during ${ff.name || 'Freeze Frame'}: ${
                                    used ? 'USING (click to Avoid)' : 'AVOIDED (click to Use)'
                                  }`}
                                >
                                  {sliceW > 38 && (
                                    <span
                                      className={`text-[7.5px] font-bold uppercase tracking-wider px-1 rounded ${
                                        used
                                          ? 'text-[#c6ff1f] bg-black/50'
                                          : 'text-red-300 bg-black/75'
                                      }`}
                                    >
                                      {used ? 'Use' : 'Avoid'}
                                    </span>
                                  )}
                                </button>
                              );
                            })}

                            {/* Left Crop Handle */}
                            <div
                              onMouseDown={(e) => beginBarDrag(e, shape, 'trim-left')}
                              className={`w-2 h-full shrink-0 flex items-center justify-center rounded-l-sm z-20 transition-colors ${
                                shape.trackLocked
                                  ? 'pointer-events-none'
                                  : 'cursor-ew-resize hover:bg-[#c6ff1f]/80 group-hover/bar:bg-white/25'
                              }`}
                            >
                              <div className="w-[2px] h-2.5 bg-white/70 rounded-full pointer-events-none" />
                            </div>

                            {/* Inner Label & Duration */}
                            <div className="flex-1 min-w-0 px-1.5 flex items-center justify-between gap-1 pointer-events-none overflow-hidden z-20">
                              <span className="text-[10px] font-semibold text-white truncate drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
                                {shape.trackLabel || 'Track'}
                              </span>
                              {barWidthPx > 72 && (
                                <span className="text-[9px] font-mono tabular-nums text-gray-200 shrink-0 drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
                                  {formatTrackDuration(barEnd - barStart)}
                                </span>
                              )}
                            </div>

                            {/* Right Crop Handle */}
                            <div
                              onMouseDown={(e) => beginBarDrag(e, shape, 'trim-right')}
                              className={`w-2 h-full shrink-0 flex items-center justify-center rounded-r-sm z-20 transition-colors ${
                                shape.trackLocked
                                  ? 'pointer-events-none'
                                  : 'cursor-ew-resize hover:bg-[#c6ff1f]/80 group-hover/bar:bg-white/25'
                              }`}
                            >
                              <div className="w-[2px] h-2.5 bg-white/70 rounded-full pointer-events-none" />
                            </div>

                            {/* Live Floating Readout Tooltip during Drag / Crop */}
                            {isDraggingThis && activeBarDrag && (
                              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#0a0b0e] border border-[#c6ff1f]/60 text-[#c6ff1f] px-1.5 py-0.5 rounded text-[9px] font-mono tabular-nums whitespace-nowrap shadow-xl pointer-events-none z-40">
                                +{formatTrackClock(activeBarDrag.currentStart - clipStart)} → +
                                {formatTrackClock(activeBarDrag.currentEnd - clipStart)} (
                                {formatTrackDuration(activeBarDrag.currentEnd - activeBarDrag.currentStart)})
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Full-Height Vertical Playhead Laser Line */}
                <div
                  style={{ left: playheadX }}
                  className="absolute top-0 bottom-0 w-[1.5px] bg-[#c6ff1f] shadow-[0_0_8px_rgba(198,255,31,0.55)] pointer-events-none z-25"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
