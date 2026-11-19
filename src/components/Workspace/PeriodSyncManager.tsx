import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Timer,
  X,
  Clock,
  PlayCircle,
  AlertTriangle,
  Undo2,
  Redo2,
  Play,
  Pause,
  CheckCircle2,
  GripHorizontal,
  Crosshair,
  ArrowRight
} from 'lucide-react';
import type { PeriodSync, TagEvent, TimelineMarker } from '../../types';
import {
  CANONICAL_PERIODS,
  formatSyncClock,
  parseSyncTimeInput,
  getMatchClockForVideoTime,
  getCanonicalPeriod
} from '../../utils/periodSyncUtils';

interface PeriodSyncManagerProps {
  currentTime: number;
  duration?: number;
  isPlaying?: boolean;
  onSeek?: (time: number) => void;
  onTogglePlay?: () => void;
  periodSyncs: PeriodSync[];
  setPeriodSyncs: (syncs: PeriodSync[]) => void;
  tagEvents: TagEvent[];
  setTagEvents: (events: TagEvent[]) => void;
  markers?: TimelineMarker[];
  setMarkers?: React.Dispatch<React.SetStateAction<TimelineMarker[]>>;
  onNotify?: (msg: string, color?: string) => void;
}

interface PendingSyncUpdate {
  id: PeriodSync['id'];
  name: string;
  newTime: number;
  shiftDiff: number;
  isFromLiveUnsynced: boolean;
  tags: TagEvent[];
  markersToShift: TimelineMarker[];
}

interface HistorySnapshot {
  periodSyncs: PeriodSync[];
  tagEvents: TagEvent[];
  markers: TimelineMarker[];
}

const TimeInput: React.FC<{
  initialTime: number;
  onUpdate: (val: string) => boolean;
}> = ({ initialTime, onUpdate }) => {
  const formattedInitial = useMemo(() => formatSyncClock(initialTime, true), [initialTime]);
  const [val, setVal] = useState(formattedInitial);
  const [localError, setLocalError] = useState(false);

  useEffect(() => {
    setVal(formattedInitial);
    setLocalError(false);
  }, [formattedInitial]);

  const commitValue = () => {
    // If user didn't change the displayed text at all, do nothing!
    if (val.trim() === formattedInitial) {
      setLocalError(false);
      return;
    }
    const success = onUpdate(val);
    if (!success) {
      setLocalError(true);
      setTimeout(() => {
        setVal(formattedInitial);
        setLocalError(false);
      }, 1000);
    } else {
      setLocalError(false);
    }
  };

  return (
    <input
      type="text"
      placeholder="00:00"
      title="Enter kick-off video time (MM:SS or HH:MM:SS)"
      className={`w-full bg-black/50 border ${
        localError
          ? 'border-red-500 text-red-400'
          : 'border-white/15 hover:border-white/30 text-white focus:border-[#c6ff1f]'
      } rounded-md px-2 py-1.5 text-xs text-center focus:outline-none font-mono transition-colors`}
      value={val}
      onChange={(e) => {
        setVal(e.target.value);
        setLocalError(false);
      }}
      onBlur={commitValue}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          e.stopPropagation();
          setVal(formattedInitial);
          setLocalError(false);
          e.currentTarget.blur();
        }
      }}
    />
  );
};

export const PeriodSyncManager: React.FC<PeriodSyncManagerProps> = ({
  currentTime,
  duration = 0,
  isPlaying = false,
  onSeek,
  onTogglePlay,
  periodSyncs,
  setPeriodSyncs,
  tagEvents,
  setTagEvents,
  markers = [],
  setMarkers,
  onNotify
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<PendingSyncUpdate | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: PeriodSync['id']; name: string } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [future, setFuture] = useState<HistorySnapshot[]>([]);

  const triggerBtnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [anchorPos, setAnchorPos] = useState<{ top: number; left: number }>({ top: 44, left: 20 });
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const unsyncedPeriods = useMemo(() => periodSyncs.filter(s => s.needsVideoSync), [periodSyncs]);
  const hasUnsynced = unsyncedPeriods.length > 0;
  const prevUnsyncedCountRef = useRef<number>(0);

  // Compute anchor position whenever opened or window resizes
  const updateAnchorPosition = useCallback(() => {
    if (!triggerBtnRef.current || typeof window === 'undefined') return;
    const rect = triggerBtnRef.current.getBoundingClientRect();
    const panelWidth = Math.min(400, window.innerWidth - 16);
    const idealLeft = rect.right - panelWidth;
    const clampedLeft = Math.max(8, Math.min(window.innerWidth - panelWidth - 8, idealLeft));
    const clampedTop = Math.max(40, Math.min(window.innerHeight - 160, rect.bottom + 8));
    setAnchorPos({ top: clampedTop, left: clampedLeft });
  }, []);

  // Auto-open whenever unsynced periods appear (e.g., right after uploading video to a Live Match project)
  useEffect(() => {
    if (unsyncedPeriods.length > 0 && prevUnsyncedCountRef.current === 0) {
      updateAnchorPosition();
      setDragOffset({ x: 0, y: 0 });
      setIsOpen(true);
    }
    prevUnsyncedCountRef.current = unsyncedPeriods.length;
  }, [unsyncedPeriods.length, updateAnchorPosition]);

  useEffect(() => {
    if (!isOpen) return;
    updateAnchorPosition();
    const handleResize = () => updateAnchorPosition();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, updateAnchorPosition]);

  // Allow Escape key to close panel when no input is focused
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
        if (pendingUpdate) {
          setPendingUpdate(null);
        } else if (pendingDelete) {
          setPendingDelete(null);
        } else {
          setIsOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, pendingUpdate, pendingDelete]);

  // Header drag handlers so analyst can move the panel freely while inspecting video
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: dragOffset.x,
      origY: dragOffset.y
    };

    const onMouseMove = (moveEvt: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = moveEvt.clientX - dragStartRef.current.startX;
      const dy = moveEvt.clientY - dragStartRef.current.startY;
      setDragOffset({
        x: dragStartRef.current.origX + dx,
        y: dragStartRef.current.origY + dy
      });
    };

    const onMouseUp = () => {
      dragStartRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleToggleOpen = () => {
    if (isOpen) {
      setIsOpen(false);
      setPendingUpdate(null);
      setPendingDelete(null);
      setValidationError(null);
    } else {
      updateAnchorPosition();
      setDragOffset({ x: 0, y: 0 });
      setIsOpen(true);
    }
  };

  const saveStateToHistory = () => {
    setHistory(prev => [...prev.slice(-19), { periodSyncs, tagEvents, markers }]);
    setFuture([]);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const lastState = history[history.length - 1];

    setFuture(prev => [...prev, { periodSyncs, tagEvents, markers }]);
    setHistory(prev => prev.slice(0, -1));

    setPeriodSyncs(lastState.periodSyncs);
    setTagEvents(lastState.tagEvents);
    if (setMarkers) setMarkers(lastState.markers);
    setValidationError(null);
    onNotify?.('Undid period sync change', '#c6ff1f');
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const nextState = future[future.length - 1];

    setHistory(prev => [...prev, { periodSyncs, tagEvents, markers }]);
    setFuture(prev => prev.slice(0, -1));

    setPeriodSyncs(nextState.periodSyncs);
    setTagEvents(nextState.tagEvents);
    if (setMarkers) setMarkers(nextState.markers);
    setValidationError(null);
    onNotify?.('Redid period sync change', '#c6ff1f');
  };

  // Count events & markers associated with each period
  const getEventsAndMarkersForPeriod = useCallback(
    (periodId: PeriodSync['id'], customOldTime?: number | null) => {
      const sortedOldSyncs = [...periodSyncs].sort((a, b) => a.videoTimeSeconds - b.videoTimeSeconds);
      const currentIndex = sortedOldSyncs.findIndex(s => s.id === periodId);
      const existing = periodSyncs.find(s => s.id === periodId);
      const oldTime = customOldTime !== undefined ? customOldTime : (existing ? existing.videoTimeSeconds : null);
      const nextPeriodTime =
        currentIndex !== -1 && currentIndex < sortedOldSyncs.length - 1
          ? sortedOldSyncs[currentIndex + 1].videoTimeSeconds
          : Infinity;
      const isFirstEnabledPeriod = currentIndex === 0;

      const matchedTags = tagEvents.filter(evt => {
        if (evt.periodId) {
          return evt.periodId === periodId;
        }
        // Fallback for video-coded events or legacy events without periodId
        if (oldTime !== null) {
          if (isFirstEnabledPeriod && existing?.needsVideoSync) {
            return evt.startTime < nextPeriodTime;
          }
          return evt.startTime >= oldTime && evt.startTime < nextPeriodTime;
        }
        return false;
      });

      const matchedMarkers = markers.filter(m => {
        if (m.periodId) {
          return m.periodId === periodId;
        }
        if (oldTime !== null && !existing?.needsVideoSync) {
          return m.time >= oldTime && m.time < nextPeriodTime;
        }
        return false;
      });

      return { matchedTags, matchedMarkers };
    },
    [periodSyncs, tagEvents, markers]
  );

  const validateChronologicalOrder = (id: PeriodSync['id'], newTime: number): string | null => {
    const periodOrder = CANONICAL_PERIODS.map(p => p.id);
    const targetIdx = periodOrder.indexOf(id);

    for (let i = 0; i < targetIdx; i++) {
      const prevSync = periodSyncs.find(s => s.id === periodOrder[i]);
      // Only enforce strict order against periods that are ALREADY synced (don't block if a later/earlier period is still awaiting live video sync!)
      if (prevSync && !prevSync.needsVideoSync && newTime <= prevSync.videoTimeSeconds) {
        const currName = getCanonicalPeriod(id)?.name || id;
        const prevName = getCanonicalPeriod(periodOrder[i])?.name || periodOrder[i];
        return `${currName} (${formatSyncClock(newTime)}) must start after ${prevName} (${formatSyncClock(prevSync.videoTimeSeconds)}).`;
      }
    }

    for (let i = targetIdx + 1; i < periodOrder.length; i++) {
      const nextSync = periodSyncs.find(s => s.id === periodOrder[i]);
      if (nextSync && !nextSync.needsVideoSync && newTime >= nextSync.videoTimeSeconds) {
        const currName = getCanonicalPeriod(id)?.name || id;
        const nextName = getCanonicalPeriod(periodOrder[i])?.name || periodOrder[i];
        return `${currName} (${formatSyncClock(newTime)}) must start before ${nextName} (${formatSyncClock(nextSync.videoTimeSeconds)}).`;
      }
    }

    return null;
  };

  const handleEnablePeriod = (id: PeriodSync['id'], name: string) => {
    setValidationError(null);
    const periodOrder = CANONICAL_PERIODS.map(p => p.id);
    const targetIdx = periodOrder.indexOf(id);

    let minTime = 0;
    for (let i = targetIdx - 1; i >= 0; i--) {
      const prevSync = periodSyncs.find(s => s.id === periodOrder[i] && !s.needsVideoSync);
      if (prevSync) {
        minTime = prevSync.videoTimeSeconds + 1;
        break;
      }
    }

    let maxTime = Infinity;
    for (let i = targetIdx + 1; i < periodOrder.length; i++) {
      const nextSync = periodSyncs.find(s => s.id === periodOrder[i] && !s.needsVideoSync);
      if (nextSync) {
        maxTime = nextSync.videoTimeSeconds - 1;
        break;
      }
    }

    if (minTime > maxTime) {
      setValidationError(`Cannot enable ${name} because there is no time gap between adjacent synced periods.`);
      return;
    }

    let safeTime = currentTime;
    if (safeTime < minTime) safeTime = minTime;
    if (safeTime > maxTime) safeTime = maxTime;

    updateSyncTime(id, name, safeTime);
  };

  const handleSetTime = (id: PeriodSync['id'], name: string) => {
    updateSyncTime(id, name, currentTime);
  };

  const handleClearTime = (id: PeriodSync['id']) => {
    const period = getCanonicalPeriod(id);
    if (period) {
      setPendingDelete({ id, name: period.name });
    }
  };

  const confirmClearTime = () => {
    if (pendingDelete) {
      saveStateToHistory();
      const updated = periodSyncs.filter(s => s.id !== pendingDelete.id);
      setPeriodSyncs(updated);
      setValidationError(null);
      setPendingDelete(null);
    }
  };

  const handleManualEdit = (id: PeriodSync['id'], name: string, value: string): boolean => {
    const time = parseSyncTimeInput(value);
    if (time === null) {
      return false;
    }
    if (duration > 0 && time > duration) {
      setValidationError(`Time ${formatSyncClock(time)} exceeds video duration (${formatSyncClock(duration)}).`);
      return false;
    }
    return updateSyncTime(id, name, time);
  };

  const updateSyncTime = (id: PeriodSync['id'], name: string, newTime: number): boolean => {
    setValidationError(null);
    const clampedNewTime = Math.max(0, duration > 0 ? Math.min(duration, newTime) : newTime);

    const orderError = validateChronologicalOrder(id, clampedNewTime);
    if (orderError) {
      setValidationError(orderError);
      return false;
    }

    const existing = periodSyncs.find(s => s.id === id);
    const oldTime = existing ? existing.videoTimeSeconds : null;
    const isFromLiveUnsynced = Boolean(existing?.needsVideoSync);

    const { matchedTags, matchedMarkers } = getEventsAndMarkersForPeriod(id, oldTime);
    const hasItems = matchedTags.length > 0 || matchedMarkers.length > 0;
    const timeChanged = oldTime === null || Math.abs(oldTime - clampedNewTime) > 0.01;

    // Trigger confirmation whenever events/notes exist AND either the time changed OR this period needs initial live-to-video sync
    if (hasItems && (isFromLiveUnsynced || timeChanged)) {
      const shiftDiff = oldTime !== null ? clampedNewTime - oldTime : clampedNewTime;
      setPendingUpdate({
        id,
        name,
        newTime: clampedNewTime,
        shiftDiff,
        isFromLiveUnsynced,
        tags: matchedTags,
        markersToShift: matchedMarkers
      });
      return true;
    }

    applySyncUpdate(
      {
        id,
        name,
        newTime: clampedNewTime,
        shiftDiff: 0,
        isFromLiveUnsynced,
        tags: [],
        markersToShift: []
      },
      false
    );
    return true;
  };

  const applySyncUpdate = (update: PendingSyncUpdate, shiftItems: boolean) => {
    saveStateToHistory();

    const existing = periodSyncs.find(s => s.id === update.id);
    let updatedSyncs: PeriodSync[];
    if (existing) {
      updatedSyncs = periodSyncs.map(s =>
        s.id === update.id
          ? { ...s, videoTimeSeconds: update.newTime, needsVideoSync: false }
          : s
      );
    } else {
      updatedSyncs = [
        ...periodSyncs,
        {
          id: update.id,
          name: update.name,
          videoTimeSeconds: update.newTime,
          needsVideoSync: false
        }
      ];
    }

    // Keep periodSyncs sorted in canonical period order
    const canonicalOrder = CANONICAL_PERIODS.map(p => p.id);
    updatedSyncs.sort((a, b) => canonicalOrder.indexOf(a.id) - canonicalOrder.indexOf(b.id));
    setPeriodSyncs(updatedSyncs);

    const periodInfo = getCanonicalPeriod(update.id);
    const periodOffset = periodInfo?.matchStartOffset ?? 0;

    if (shiftItems && update.tags.length > 0) {
      const tagIds = new Set(update.tags.map(t => t.id));
      const newTagEvents = tagEvents.map(evt => {
        const isTagInPeriod = evt.periodId ? evt.periodId === update.id : tagIds.has(evt.id);
        if (!isTagInPeriod) return evt;

        const origDuration = Math.max(
          1,
          evt.matchEnd !== undefined && evt.matchStart !== undefined
            ? evt.matchEnd - evt.matchStart
            : evt.endTime - evt.startTime
        );

        let newStart: number;
        let newEnd: number;

        if (evt.matchStart !== undefined) {
          // Preserve exact relative match clock offset from kick-off (including pre-kickoff lead time if negative!)
          const elapsedFromKickoff = evt.matchStart - periodOffset;
          const rawStart = update.newTime + elapsedFromKickoff;
          newStart = Math.max(0, duration > 0 ? Math.min(duration - 0.5, rawStart) : rawStart);
          newEnd = duration > 0 ? Math.min(duration, newStart + origDuration) : newStart + origDuration;
          if (newEnd <= newStart) {
            newEnd = newStart + Math.min(origDuration, 1);
          }
        } else {
          const rawStart = evt.startTime + update.shiftDiff;
          newStart = Math.max(0, duration > 0 ? Math.min(duration - 0.5, rawStart) : rawStart);
          const rawEnd = evt.endTime + update.shiftDiff;
          newEnd = Math.max(newStart + 1, duration > 0 ? Math.min(duration, rawEnd) : rawEnd);
        }

        return {
          ...evt,
          startTime: newStart,
          endTime: newEnd,
          periodId: update.id
        };
      });
      setTagEvents(newTagEvents);
    }

    if (shiftItems && update.markersToShift.length > 0 && setMarkers) {
      const markerIds = new Set(update.markersToShift.map(m => m.id));
      setMarkers(prev =>
        prev.map(m => {
          const isMarkerInPeriod = m.periodId ? m.periodId === update.id : markerIds.has(m.id);
          if (!isMarkerInPeriod) return m;

          let newTimeVal: number;
          if (m.matchTime !== undefined) {
            const elapsedFromKickoff = m.matchTime - periodOffset;
            newTimeVal = Math.max(0, update.newTime + elapsedFromKickoff);
          } else {
            newTimeVal = Math.max(0, m.time + update.shiftDiff);
          }
          if (duration > 0) {
            newTimeVal = Math.min(duration, newTimeVal);
          }
          return {
            ...m,
            time: newTimeVal,
            periodId: update.id
          };
        })
      );
    }

    setPendingUpdate(null);

    if (shiftItems && (update.tags.length > 0 || update.markersToShift.length > 0)) {
      const parts: string[] = [];
      if (update.tags.length > 0) parts.push(`${update.tags.length} event${update.tags.length !== 1 ? 's' : ''}`);
      if (update.markersToShift.length > 0) parts.push(`${update.markersToShift.length} note${update.markersToShift.length !== 1 ? 's' : ''}`);
      onNotify?.(`Synced ${update.name} @ ${formatSyncClock(update.newTime)} — aligned ${parts.join(' & ')}!`, '#c6ff1f');
    } else {
      onNotify?.(`Set ${update.name} kick-off to ${formatSyncClock(update.newTime)}`, '#c6ff1f');
    }
  };

  // Compute current active match clock for display in Top Bar and Panel
  const syncedPeriodsOnly = useMemo(
    () => periodSyncs.filter(s => !s.needsVideoSync),
    [periodSyncs]
  );
  const activeMatchClock = useMemo(
    () => getMatchClockForVideoTime(currentTime, syncedPeriodsOnly),
    [currentTime, syncedPeriodsOnly]
  );

  // Preview sample event alignment for confirmation modal
  const samplePreview = useMemo(() => {
    if (!pendingUpdate || pendingUpdate.tags.length === 0) return null;
    const sorted = [...pendingUpdate.tags].sort(
      (a, b) => (a.matchStart ?? a.startTime) - (b.matchStart ?? b.startTime)
    );
    const sample = sorted[0];
    const pInfo = getCanonicalPeriod(pendingUpdate.id);
    const offset = pInfo?.matchStartOffset ?? 0;
    if (sample.matchStart !== undefined) {
      const newVideoStart = Math.max(0, pendingUpdate.newTime + (sample.matchStart - offset));
      return {
        fromLabel: `Match ${formatSyncClock(sample.matchStart)}`,
        toLabel: `Video ${formatSyncClock(newVideoStart)}`
      };
    }
    const newVideoStart = Math.max(0, sample.startTime + pendingUpdate.shiftDiff);
    return {
      fromLabel: `Video ${formatSyncClock(sample.startTime)}`,
      toLabel: `Video ${formatSyncClock(newVideoStart)}`
    };
  }, [pendingUpdate]);

  const panelLeft = Math.max(
    8,
    Math.min(
      (typeof window !== 'undefined' ? window.innerWidth : 1280) - 396,
      anchorPos.left + dragOffset.x
    )
  );
  const panelTop = Math.max(
    8,
    Math.min(
      (typeof window !== 'undefined' ? window.innerHeight : 800) - 120,
      anchorPos.top + dragOffset.y
    )
  );

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerBtnRef}
        type="button"
        onClick={handleToggleOpen}
        className={`h-6 sm:h-6.5 px-1.5 sm:px-2 rounded-md transition-all flex items-center gap-1 sm:gap-1.5 relative cursor-pointer border text-[10px] sm:text-[11px] font-bold ${
          hasUnsynced
            ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
            : isOpen
            ? 'bg-[#c6ff1f]/20 text-[#c6ff1f] border-[#c6ff1f]/50'
            : syncedPeriodsOnly.length > 0
            ? 'bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border-indigo-500/30'
            : 'bg-[#1a1a1a] hover:bg-[#252529] text-gray-300 hover:text-white border-[#333]'
        }`}
        title={
          hasUnsynced
            ? `Sync ${unsyncedPeriods.length} live period kick-off(s) to this video`
            : 'Period Sync Manager — Align match periods & live-coded events to video'
        }
        aria-label="Period Sync Manager"
      >
        <Timer className={`w-3.5 h-3.5 shrink-0 ${hasUnsynced ? 'text-amber-400 animate-pulse' : ''}`} />
        {hasUnsynced ? (
          <>
            <span className="hidden sm:inline">Sync Kick-offs</span>
            <span className="sm:hidden">Sync</span>
            <span className="px-1 py-0.2 rounded-full bg-amber-500 text-black text-[9px] font-black leading-none">
              {unsyncedPeriods.length}
            </span>
          </>
        ) : activeMatchClock ? (
          <span className="font-mono tracking-tight text-[10px] sm:text-[11px]">
            <span className="text-[#c6ff1f] mr-1">{activeMatchClock.period.shortLabel}</span>
            {activeMatchClock.displayClock}
          </span>
        ) : syncedPeriodsOnly.length > 0 ? (
          <span className="hidden md:inline">Sync ({syncedPeriodsOnly.length})</span>
        ) : (
          <>
            <span className="hidden 2xl:inline">Period Sync</span>
            <span className="hidden md:inline 2xl:hidden">Sync</span>
          </>
        )}
      </button>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                ref={panelRef}
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                style={{
                  position: 'fixed',
                  top: panelTop,
                  left: panelLeft,
                  width: 'min(392px, calc(100vw - 16px))'
                }}
                className="bg-[#151518]/98 backdrop-blur-xl border border-white/15 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.75)] z-[9990] overflow-hidden select-none"
              >
                {/* Disable Period Confirmation Overlay */}
                {pendingDelete && (
                  <div className="absolute inset-0 bg-[#151518]/96 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-center">
                    <AlertTriangle className="w-8 h-8 text-amber-500 mb-3" />
                    <h3 className="text-white font-semibold text-sm mb-2">Disable {pendingDelete.name}?</h3>
                    <p className="text-xs text-gray-400 mb-5 leading-relaxed">
                      Disabling <strong className="text-white">{pendingDelete.name}</strong> removes its kick-off marker from the video timeline. Your tagged events will not be deleted.
                    </p>
                    <div className="flex gap-2.5 w-full">
                      <button
                        type="button"
                        onClick={() => setPendingDelete(null)}
                        className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={confirmClearTime}
                        className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        Disable Period
                      </button>
                    </div>
                  </div>
                )}

                {/* Align Events Confirmation Overlay */}
                {pendingUpdate && !pendingDelete && (
                  <div className="absolute inset-0 bg-[#151518]/96 backdrop-blur-md z-20 flex flex-col items-center justify-center p-5 text-center">
                    <div className="w-10 h-10 rounded-full bg-[#c6ff1f]/15 border border-[#c6ff1f]/30 flex items-center justify-center mb-3">
                      <Clock className="w-5 h-5 text-[#c6ff1f]" />
                    </div>
                    <h3 className="text-white font-bold text-sm mb-1.5">
                      Align Events with {pendingUpdate.name}?
                    </h3>
                    <p className="text-xs text-gray-300 mb-3 leading-relaxed">
                      Setting kick-off to{' '}
                      <span className="font-mono font-bold text-[#c6ff1f] bg-[#c6ff1f]/10 px-1.5 py-0.5 rounded">
                        {formatSyncClock(pendingUpdate.newTime, true)}
                      </span>{' '}
                      will automatically align{' '}
                      <strong className="text-white">
                        {pendingUpdate.tags.length} tagged event{pendingUpdate.tags.length !== 1 ? 's' : ''}
                      </strong>
                      {pendingUpdate.markersToShift.length > 0 && (
                        <>
                          {' '}and{' '}
                          <strong className="text-white">
                            {pendingUpdate.markersToShift.length} timeline note{pendingUpdate.markersToShift.length !== 1 ? 's' : ''}
                          </strong>
                        </>
                      )}{' '}
                      to their exact match moments in this video.
                    </p>

                    {samplePreview && (
                      <div className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 mb-4 flex items-center justify-center gap-2 text-[11px] font-mono">
                        <span className="text-gray-400">{samplePreview.fromLabel}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#c6ff1f]" />
                        <span className="text-[#c6ff1f] font-bold">{samplePreview.toLabel}</span>
                      </div>
                    )}

                    <div className="flex flex-col gap-2 w-full">
                      <button
                        type="button"
                        onClick={() => applySyncUpdate(pendingUpdate, true)}
                        className="w-full px-4 py-2.5 bg-[#c6ff1f] hover:bg-[#b5ee15] text-black font-bold text-xs rounded-lg transition-all shadow-md cursor-pointer"
                      >
                        Sync & Align {pendingUpdate.tags.length} Event{pendingUpdate.tags.length !== 1 ? 's' : ''}
                        {pendingUpdate.markersToShift.length > 0 ? ` + ${pendingUpdate.markersToShift.length} Note${pendingUpdate.markersToShift.length !== 1 ? 's' : ''}` : ''}
                      </button>
                      <button
                        type="button"
                        onClick={() => applySyncUpdate(pendingUpdate, false)}
                        className="w-full px-4 py-2 bg-white/8 hover:bg-white/14 text-gray-200 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                      >
                        Update Kick-off Only (Don&apos;t Move Events)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingUpdate(null)}
                        className="w-full px-4 py-1.5 text-gray-400 hover:text-white text-xs rounded-lg transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Draggable Header */}
                <div
                  onMouseDown={handleHeaderMouseDown}
                  className="px-3.5 py-2.5 border-b border-white/10 bg-[#1c1c21] flex items-center justify-between cursor-move"
                  title="Drag to move panel anywhere on screen while scrubbing video"
                >
                  <div className="flex items-center gap-2 text-white">
                    <GripHorizontal className="w-3.5 h-3.5 text-gray-500" />
                    <Clock className="w-4 h-4 text-[#c6ff1f]" />
                    <span className="font-semibold text-xs tracking-wide">Game Period Sync</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={history.length === 0}
                      className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 transition-colors rounded hover:bg-white/5 cursor-pointer disabled:cursor-not-allowed"
                      title="Undo Period Sync"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleRedo}
                      disabled={future.length === 0}
                      className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 transition-colors rounded hover:bg-white/5 cursor-pointer disabled:cursor-not-allowed"
                      title="Redo Period Sync"
                    >
                      <Redo2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-[1px] h-4 bg-white/10 mx-1" />
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="p-1.5 text-gray-400 hover:text-white transition-colors rounded hover:bg-white/10 cursor-pointer"
                      title="Close (Esc)"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Quick Video Whistle Finder Bar */}
                <div className="px-3.5 py-2.5 bg-black/45 border-b border-white/10 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {onTogglePlay && (
                      <button
                        type="button"
                        onClick={onTogglePlay}
                        className="w-7 h-7 rounded-full bg-[#c6ff1f] hover:bg-[#b2ea14] text-black flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer"
                        title={isPlaying ? 'Pause Video' : 'Play Video to locate kick-off whistle'}
                      >
                        {isPlaying ? (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        )}
                      </button>
                    )}
                    <div className="flex flex-col leading-tight">
                      <span className="text-[9.5px] uppercase tracking-wider text-gray-400 font-semibold">
                        Video Playhead
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-bold text-white">
                          {formatSyncClock(currentTime, true)}
                        </span>
                        {activeMatchClock && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#c6ff1f]/15 text-[#c6ff1f] border border-[#c6ff1f]/30">
                            {activeMatchClock.period.shortLabel} {activeMatchClock.displayClock}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {onSeek && (
                    <div className="flex items-center gap-1 shrink-0">
                      {[
                        { label: '-10s', delta: -10 },
                        { label: '-1s', delta: -1 },
                        { label: '+1s', delta: 1 },
                        { label: '+10s', delta: 10 }
                      ].map(step => (
                        <button
                          key={step.label}
                          type="button"
                          onClick={() => onSeek(Math.max(0, currentTime + step.delta))}
                          className="px-1.5 py-1 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-[10px] font-mono text-gray-300 hover:text-white transition-colors cursor-pointer"
                          title={`Step video ${step.label}`}
                        >
                          {step.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="p-3.5 max-h-[420px] overflow-y-auto space-y-2.5 custom-scrollbar">
                  {validationError && (
                    <div className="bg-red-500/15 border border-red-500/40 rounded-lg p-2.5 text-red-300 text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <span>{validationError}</span>
                    </div>
                  )}

                  {hasUnsynced ? (
                    <div className="bg-amber-500/12 border border-amber-500/35 rounded-lg p-2.5 text-amber-200 text-[11px] flex items-start gap-2 leading-relaxed">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-amber-300 block mb-0.5">Live Match Video Imported</strong>
                        Scrub the video to each period&apos;s kick-off whistle and click{' '}
                        <strong className="text-white">Sync Kick-off</strong> to align your live-tagged events.
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-400 leading-relaxed px-0.5">
                      Mark each period&apos;s exact kick-off on the video to align live-coded events, timeline notes, and CSV match timestamps.
                    </div>
                  )}

                  {CANONICAL_PERIODS.map(period => {
                    const currentSync = periodSyncs.find(s => s.id === period.id);
                    const isEnabled = !!currentSync;
                    const needsSync = Boolean(currentSync?.needsVideoSync);
                    const { matchedTags, matchedMarkers } = getEventsAndMarkersForPeriod(period.id);
                    const eventCount = matchedTags.length;
                    const noteCount = matchedMarkers.length;

                    return (
                      <div
                        key={period.id}
                        className={`border rounded-lg p-2.5 transition-all relative overflow-hidden ${
                          isEnabled
                            ? needsSync
                              ? 'bg-amber-950/25 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.08)]'
                              : 'bg-indigo-950/20 border-indigo-500/30'
                            : eventCount > 0
                            ? 'bg-white/[0.03] border-amber-500/25'
                            : 'bg-black/25 border-white/8 hover:border-white/15'
                        }`}
                      >
                        {isEnabled && needsSync && (
                          <div className="absolute top-0 left-0 right-0 h-0.5 bg-amber-400" />
                        )}

                        <div className="flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2 cursor-pointer min-w-0">
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  handleEnablePeriod(period.id, period.name);
                                } else {
                                  handleClearTime(period.id);
                                }
                              }}
                              className="w-3.5 h-3.5 rounded border-gray-600 bg-black/50 text-[#c6ff1f] focus:ring-0 cursor-pointer shrink-0"
                            />
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-white/8 text-gray-300 shrink-0">
                              {period.shortLabel}
                            </span>
                            <span
                              className={`text-xs font-semibold truncate ${
                                isEnabled ? 'text-white' : 'text-gray-400'
                              }`}
                            >
                              {period.name}
                            </span>
                          </label>

                          <div className="flex items-center gap-1 shrink-0">
                            {eventCount > 0 && (
                              <span
                                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/8 text-gray-200 border border-white/10"
                                title={`${eventCount} tagged event${eventCount !== 1 ? 's' : ''}${noteCount > 0 ? ` & ${noteCount} note${noteCount !== 1 ? 's' : ''}` : ''} in ${period.name}`}
                              >
                                {eventCount} evt{eventCount !== 1 ? 's' : ''}
                              </span>
                            )}

                            {isEnabled && needsSync && (
                              <span className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                Needs Sync
                              </span>
                            )}

                            {isEnabled && !needsSync && (
                              <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                Synced
                              </span>
                            )}
                          </div>
                        </div>

                        {isEnabled && currentSync && (
                          <div className="flex items-center gap-1.5 mt-2.5">
                            <button
                              type="button"
                              onClick={() => handleSetTime(period.id, period.name)}
                              className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                needsSync
                                  ? 'bg-amber-500 hover:bg-amber-400 text-black font-bold shadow-sm'
                                  : 'bg-white/8 hover:bg-white/15 border border-white/10 text-white'
                              }`}
                              title={`Set ${period.name} to current video playhead (${formatSyncClock(currentTime, true)})`}
                            >
                              <PlayCircle className={`w-3.5 h-3.5 shrink-0 ${needsSync ? 'text-black' : 'text-[#c6ff1f]'}`} />
                              <span>
                                {needsSync
                                  ? `Sync Kick-off (${formatSyncClock(currentTime)})`
                                  : `Set Current (${formatSyncClock(currentTime)})`}
                              </span>
                            </button>

                            <div className="w-22 shrink-0">
                              <TimeInput
                                initialTime={currentSync.videoTimeSeconds}
                                onUpdate={(val) => handleManualEdit(period.id, period.name, val)}
                              />
                            </div>

                            {onSeek && !needsSync && (
                              <button
                                type="button"
                                onClick={() => onSeek(currentSync.videoTimeSeconds)}
                                className="p-1.5 rounded-md bg-white/5 hover:bg-white/15 border border-white/10 text-gray-300 hover:text-[#c6ff1f] transition-colors cursor-pointer shrink-0"
                                title={`Jump video to ${period.name} (${formatSyncClock(currentSync.videoTimeSeconds)})`}
                              >
                                <Crosshair className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};
