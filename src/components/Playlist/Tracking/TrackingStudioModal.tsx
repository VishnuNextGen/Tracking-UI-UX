import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Undo2,
  Redo2,
  Eraser,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Film,
  SquareDashed,
  Check,
  Snowflake,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { Logo } from '../../Logo';
import type {
  FreezeFrame,
  Playlist,
  PlaylistClip,
  PlaylistItem,
  Point,
  Project,
  Rect,
  Shape,
  Tag as TagData,
  TagEvent,
  ToolType,
} from '../../../types';
import type { WorkspaceBatchModeProps } from '../../Workspace/Workspace.types';
import { useMasking } from '../../Workspace/Masking';
import { useFreezeFrames } from '../../Workspace/hooks/useFreezeFrames';
import { useTelestrationCanvas } from '../../Workspace/hooks/useTelestrationCanvas';
import { WorkspacePropertiesPanel } from '../../Workspace/components/WorkspacePropertiesPanel';
import { FreezeFrameStepSelector } from '../../Workspace/FreezeFrame/FreezeFrameStepSelector';
import { AnimationPanel } from '../../AnimationPanel';
import {
  clampPointToVideo,
  getVideoSpacePointFromEvent,
  isPointInsideVideo,
} from '../../Workspace/canvas/canvasHitTest';
import { formatTime, getVideoLayout } from '../../../utils/math';
import {
  calculateRequiredFreezeFrameDuration,
  calculateStepAnimStart,
  DEFAULT_STEP_DELAY,
  getFreezeFrameStepDelay,
  syncFreezeFrameWithSteps,
} from '../../../utils/freezeFrameSteps';
import {
  deactivateFreezeFrameInOtherPlaylistClips,
  getClipEventId,
  getClipInstanceId,
  isFreezeFrameActiveForClip,
  resolveClipTiming,
} from '../../../utils/playlistUtils';
import { TrackingToolsPanel } from './TrackingToolsPanel';
import { TrackingRightPanel } from './TrackingRightPanel';
import { TrackingTimeline } from './TrackingTimeline';
import {
  buildVirtualTimelineSegments,
  formatTrackClock,
  generateNextTrackLabel,
  getTracksOverlappingTimestamp,
  isTrackableTool,
  virtualOffsetToState,
} from './trackingUtils';

export interface TrackingStudioModalProps {
  isOpen: boolean;
  initialClipIndex: number;
  project: Project;
  videoUrl: string;
  playlists: Playlist[];
  activePlaylistId: string;
  setPlaylists: React.Dispatch<React.SetStateAction<Playlist[]>>;
  syncPlaylistsToStorage: (nextPlaylists: Playlist[]) => void;
  allBatchTagEvents: TagEvent[];
  allBatchTags: TagData[];
  batchMode?: WorkspaceBatchModeProps;
  findEventAcrossBatch: (
    eventId: string,
    clipHint?: PlaylistItem
  ) => { event: TagEvent | undefined; project: Project | undefined };
  projectFreezeFrames: FreezeFrame[];
  setProjectFreezeFrames: React.Dispatch<React.SetStateAction<FreezeFrame[]>>;
  projectShapes: Shape[];
  setProjectShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
  handleToggleClipFreezeFrameDeactivation: (
    playlistId: string,
    clipIndex: number,
    ffId: string
  ) => void;
  handleSetClipAllFreezeFramesDeactivation: (
    playlistId: string,
    clipIndex: number,
    ffIds: string[],
    deactivate: boolean
  ) => void;
  handleIsolateClipFreezeFrames?: (playlistId: string, clipIndex: number) => void;
  handleToggleClipFreezeFrameIsolation?: (playlistId: string, clipIndex: number) => void;
  duplicatePlaylistEvent?: (
    playlistId: string,
    clipIndex: number,
    options?: { cleanSlate?: boolean; isolate?: boolean }
  ) => void;
  showNotification: (
    message: string,
    color: string,
    onUndo?: () => void,
    action?: { label: string; onClick: () => void }
  ) => void;
  onClose: () => void;
}

const isTrackedStudioShape = (s: Shape): boolean =>
  s.trackStartTime !== undefined && !s.freezeFrameId;

export const TrackingStudioModal: React.FC<TrackingStudioModalProps> = ({
  isOpen,
  initialClipIndex,
  project,
  videoUrl,
  playlists,
  activePlaylistId,
  setPlaylists,
  syncPlaylistsToStorage,
  allBatchTagEvents,
  allBatchTags,
  batchMode,
  findEventAcrossBatch,
  projectFreezeFrames,
  setProjectFreezeFrames,
  projectShapes,
  setProjectShapes,
  handleToggleClipFreezeFrameDeactivation,
  handleSetClipAllFreezeFramesDeactivation,
  handleIsolateClipFreezeFrames,
  handleToggleClipFreezeFrameIsolation,
  duplicatePlaylistEvent,
  showNotification,
  onClose,
}) => {
  const activePlaylist = useMemo(
    () => playlists.find((p) => p.id === activePlaylistId),
    [playlists, activePlaylistId]
  );

  const clipEntries = useMemo(() => {
    const items = activePlaylist?.events || [];
    return items.map((item, idx) => {
      const eventId = getClipEventId(item);
      const { event, project: clipProject } = findEventAcrossBatch(eventId, item);
      const timing = resolveClipTiming(item, event);
      const tag = event ? allBatchTags.find((t) => t.id === event.tagId) : undefined;
      const title =
        tag?.name || (typeof item === 'object' && item.notes) || `Clip #${idx + 1}`;
      return {
        index: idx,
        item,
        eventId,
        event,
        clipProject,
        timing,
        title,
      };
    });
  }, [activePlaylist, findEventAcrossBatch, allBatchTags]);

  const [activeClipIndex, setActiveClipIndex] = useState<number>(() =>
    Math.max(0, Math.min(initialClipIndex, Math.max(0, clipEntries.length - 1)))
  );

  useEffect(() => {
    if (isOpen) {
      setActiveClipIndex(
        Math.max(0, Math.min(initialClipIndex, Math.max(0, clipEntries.length - 1)))
      );
    }
  }, [isOpen, initialClipIndex, clipEntries.length]);

  const activeClip = clipEntries[activeClipIndex] || null;
  const clipStart = activeClip ? activeClip.timing.startTime : 0;
  const clipEnd = activeClip ? Math.max(clipStart + 0.5, activeClip.timing.endTime) : 10;

  // Keep Workspace active project synced with the active clip's batch project
  // so Freeze Frames & FF shapes always read/write to the correct match project.
  useEffect(() => {
    if (!isOpen || !batchMode) return;
    const clipProjId = activeClip?.clipProject?.id;
    if (clipProjId && clipProjId !== project.id) {
      batchMode.onSelectProject(clipProjId);
    }
  }, [isOpen, activeClip?.clipProject?.id, project.id, batchMode]);

  const resolvedVideoUrl = useMemo(() => {
    if (activeClip?.clipProject?.id && batchMode?.projectBlobs) {
      const blobUrl = batchMode.projectBlobs.get(activeClip.clipProject.id);
      if (blobUrl) return blobUrl;
    }
    return videoUrl;
  }, [activeClip?.clipProject?.id, batchMode?.projectBlobs, videoUrl]);

  // DOM Refs for independent Tracking Studio player & canvas
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ghostCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [tool, setTool] = useState<ToolType>('circle');
  const [trackedShapes, setTrackedShapes] = useState<Shape[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(clipStart);
  const [duration, setDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState<boolean>(false);

  // Target ROI bounding rectangle preview state (for future player CV tracking)
  const [drawingRoiShapeId, setDrawingRoiShapeId] = useState<string | null>(null);
  const [roiDraftRect, setRoiDraftRect] = useState<Rect | null>(null);
  const [isCursorOutsideVideo, setIsCursorOutsideVideo] = useState<boolean>(false);
  const roiStartPtRef = useRef<Point | null>(null);

  const isScrubbingRef = useRef<boolean>(false);
  const lastPolledVideoTimeRef = useRef<number>(clipStart);
  const activeClipIndexRef = useRef<number>(activeClipIndex);
  activeClipIndexRef.current = activeClipIndex;

  // All Freeze Frames belonging to this clip's time range (regardless of ON/OFF)
  const clipFreezeFrames = useMemo(() => {
    return projectFreezeFrames
      .filter((ff) => ff.timestamp >= clipStart - 0.05 && ff.timestamp <= clipEnd + 0.05)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [projectFreezeFrames, clipStart, clipEnd]);

  const clipFFIdSet = useMemo(
    () => new Set(clipFreezeFrames.map((ff) => ff.id)),
    [clipFreezeFrames]
  );

  // Persist trackedShapes cleanly into the active PlaylistClip whenever modified inside studio
  const persistTrackedShapes = useCallback(
    (nextTrackedShapes: Shape[], targetIndex: number) => {
      if (!activePlaylistId) return;
      setPlaylists((prevPlaylists) => {
        const updated = prevPlaylists.map((pl) => {
          if (pl.id !== activePlaylistId) return pl;
          if (targetIndex < 0 || targetIndex >= pl.events.length) return pl;
          const existingItem = pl.events[targetIndex];
          const eventId = getClipEventId(existingItem);
          const instanceId = getClipInstanceId(existingItem, targetIndex);
          const nextItem: PlaylistClip =
            typeof existingItem === 'object'
              ? { ...existingItem, instanceId, eventId, trackedShapes: nextTrackedShapes }
              : { instanceId, eventId, trackedShapes: nextTrackedShapes };
          const nextEvents = [...pl.events];
          nextEvents[targetIndex] = nextItem;
          return { ...pl, events: nextEvents };
        });
        syncPlaylistsToStorage(updated);
        return updated;
      });
    },
    [activePlaylistId, setPlaylists, syncPlaylistsToStorage]
  );

  // Ref for unlinked deleted FF shape IDs so Undo Delete Freeze Frame relinks cleanly
  const deletedShapeIdsRef = useRef<Set<string>>(new Set());

  // Combined view of shapes visible/editable in Tracking Studio:
  // (1) Freeze Frame shapes belonging to this clip's Freeze Frames (+ temporarily unlinked deleted FF shapes)
  // (2) Tracked timeline shapes stored on this playlist clip
  const studioShapes = useMemo(() => {
    const ffShapes = projectShapes.filter(
      (s) =>
        (Boolean(s.freezeFrameId) && clipFFIdSet.has(s.freezeFrameId!)) ||
        deletedShapeIdsRef.current.has(s.id)
    );
    return [...ffShapes, ...trackedShapes];
  }, [projectShapes, clipFFIdSet, trackedShapes]);

  const studioShapesRef = useRef<Shape[]>(studioShapes);
  studioShapesRef.current = studioShapes;

  const setCombinedShapes: React.Dispatch<React.SetStateAction<Shape[]>> = useCallback(
    (updater) => {
      const prevCombined = studioShapesRef.current;
      const nextCombined = typeof updater === 'function' ? updater(prevCombined) : updater;
      if (nextCombined === prevCombined) return;
      studioShapesRef.current = nextCombined;

      const prevTracked = prevCombined.filter(isTrackedStudioShape);
      const nextTracked = nextCombined.filter(isTrackedStudioShape);
      const prevStudioProject = prevCombined.filter((s) => !isTrackedStudioShape(s));
      const nextStudioProject = nextCombined.filter((s) => !isTrackedStudioShape(s));

      const trackedChanged =
        prevTracked.length !== nextTracked.length ||
        prevTracked.some((s, i) => s !== nextTracked[i]);
      if (trackedChanged) {
        const targetIdx = activeClipIndexRef.current;
        setTrackedShapes(nextTracked);
        queueMicrotask(() => persistTrackedShapes(nextTracked, targetIdx));
      }

      const projectChanged =
        prevStudioProject.length !== nextStudioProject.length ||
        prevStudioProject.some((s, i) => s !== nextStudioProject[i]);
      if (projectChanged) {
        const prevStudioProjectIds = new Set(prevStudioProject.map((s) => s.id));
        setProjectShapes((prevProj) => [
          ...prevProj.filter((s) => !prevStudioProjectIds.has(s.id)),
          ...nextStudioProject,
        ]);
      }
    },
    [persistTrackedShapes, setProjectShapes]
  );

  // Masking hook (reused cleanly for Masking / Green Screen tool)
  const {
    maskSettings,
    setMaskSettings,
    maskCache,
    isProcessingMask,
    isPickingColor,
    setIsPickingColor,
    addColorAtPoint,
    removeColor,
  } = useMasking({
    videoRef,
    isPlaying,
    isScrubbing: false,
    currentTime,
  });

  // Ensure a freeze frame created from inside Tracking Studio is deactivated in duplicate sister clips
  const handleStudioFreezeFrameCreatedInClip = useCallback(
    (newFF: FreezeFrame, _clipHint: PlaylistItem) => {
      const targetIdx = activeClipIndexRef.current;
      const { updatedPlaylists, affectedCount } = deactivateFreezeFrameInOtherPlaylistClips(
        playlists,
        activePlaylistId,
        targetIdx,
        newFF.id,
        newFF.timestamp,
        allBatchTagEvents
      );
      if (affectedCount > 0) {
        setPlaylists(updatedPlaylists);
        syncPlaylistsToStorage(updatedPlaylists);
        showNotification(
          `Added ${newFF.name} to Clip #${targetIdx + 1} (excluded from ${affectedCount} duplicate clip${affectedCount > 1 ? 's' : ''})`,
          '#c6ff1f'
        );
      } else {
        showNotification(`Added ${newFF.name} (Shift+F)`, '#c6ff1f');
      }
    },
    [playlists, activePlaylistId, allBatchTagEvents, setPlaylists, syncPlaylistsToStorage, showNotification]
  );

  // Reuses the exact app Freeze Frame engine bound to Tracking Studio's own video player & timeline
  const {
    hoveredFreezeFrameId,
    setHoveredFreezeFrameId,
    editingAnimationFFId,
    setEditingAnimationFFId,
    animationPreviewTime,
    setAnimationPreviewTime,
    isAnimationPreviewPlaying,
    setIsAnimationPreviewPlaying,
    animationPanelWidth,
    setAnimationPanelWidth,
    isResizingAnimPanel,
    setIsResizingAnimPanel,
    freezeFramePanelScope,
    setFreezeFramePanelScope,
    triggeredFreezeFrames,
    activeFreezeFrameId,
    setActiveFreezeFrameId,
    isFreezeFramePlaying,
    setIsFreezeFramePlaying,
    countdownValue,
    setCountdownValue,
    countdownInterval,
    freezeFrameActiveSteps,
    activeFreezeFrame,
    currentStepForActiveFF,
    handleStepChange,
    deletedFFStack,
    ffRemainingSeconds,
    ffProgressPercent,
    deletedFFStackRef,
    undoDeleteFreezeFrameRef,
    toggleFreezeFramePlay,
    seekFreezeFrame,
    seekFreezeFrameRelative,
    skipFreezeFrame,
    addFreezeFrame,
    handleOpenAnimationPanel,
    deleteFreezeFrame,
    undoDeleteFreezeFrame,
    undoDeleteAllFreezeFrames,
    dismissDeletedFFNotification,
    updateFreezeFrameDuration,
    handleSelectedShapeStepChange,
  } = useFreezeFrames({
    project,
    videoRef,
    currentTime,
    setCurrentTime,
    duration,
    isPlaying,
    setIsPlaying,
    shapes: studioShapes,
    setShapes: setCombinedShapes,
    setTool,
    maskSettings,
    maskCache,
    onFreezeFrameCreatedInClip: handleStudioFreezeFrameCreatedInClip,
    externalFreezeFrames: projectFreezeFrames,
    externalSetFreezeFrames: setProjectFreezeFrames,
    showNotification,
  });

  // Sync deletedShapeIdsRef so temporarily unlinked shapes stay reachable for Undo Delete Freeze Frame
  deletedShapeIdsRef.current = useMemo(
    () => new Set(deletedFFStack.flatMap((d) => d.shapeIds)),
    [deletedFFStack]
  );

  // Active freeze frames for this specific clip (ON in this clip OR currently open in AnimationPanel)
  const activeClipFreezeFrames = useMemo(
    () =>
      clipFreezeFrames.filter(
        (ff) =>
          isFreezeFrameActiveForClip(ff, activeClip?.item, activeClipIndex) ||
          ff.id === editingAnimationFFId
      ),
    [clipFreezeFrames, activeClip?.item, activeClipIndex, editingAnimationFFId]
  );

  // Expanded NLE timeline segments combining base clip playback and active Freeze Frame holds
  const { segments: virtualSegments } = useMemo(
    () => buildVirtualTimelineSegments(clipStart, clipEnd, activeClipFreezeFrames),
    [clipStart, clipEnd, activeClipFreezeFrames]
  );

  // Drag-resize handler for AnimationPanel when open inside Tracking Studio
  useEffect(() => {
    if (!isResizingAnimPanel) return;
    const onMove = (e: MouseEvent) => {
      const nextWidth = document.body.clientWidth - e.clientX;
      setAnimationPanelWidth(
        Math.max(280, Math.min(nextWidth, document.body.clientWidth * 0.85))
      );
    };
    const onUp = () => setIsResizingAnimPanel(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isResizingAnimPanel, setAnimationPanelWidth, setIsResizingAnimPanel]);

  // Keep video playbackRate aligned whenever countdown finishes and resumes playback
  useEffect(() => {
    if (isPlaying && videoRef.current && videoRef.current.playbackRate !== playbackRate) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [isPlaying, playbackRate]);

  // Load clip's saved trackedShapes & reset FF playback state whenever activeClipIndex or modal open changes
  const activeClipIdentity = activeClip
    ? `${activePlaylistId}::${activeClip.index}::${getClipInstanceId(activeClip.item, activeClip.index)}`
    : '';

  useEffect(() => {
    if (!isOpen || !activeClip) return;
    const savedShapes =
      typeof activeClip.item === 'object' && Array.isArray(activeClip.item.trackedShapes)
        ? activeClip.item.trackedShapes.map((s) => ({ ...s }))
        : [];
    setTrackedShapes(savedShapes);
    setDrawingRoiShapeId(null);
    setRoiDraftRect(null);
    setIsPlaying(false);
    setActiveFreezeFrameId(null);
    setIsFreezeFramePlaying(false);
    setCountdownValue(0);
    setEditingAnimationFFId(null);
    setIsAnimationPreviewPlaying(false);
    triggeredFreezeFrames.current.clear();
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
    setCurrentTime(clipStart);
    lastPolledVideoTimeRef.current = clipStart;
    if (videoRef.current) {
      videoRef.current.pause();
      try {
        videoRef.current.currentTime = clipStart;
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeClipIdentity]);

  // Playback controls scoped to active clip [clipStart, clipEnd], integrated with Freeze Frames
  const togglePlay = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;

    // 1. Active freeze frame at playhead: skip freeze frame & resume video playback (matching Workspace Spacebar behavior)
    if (activeFreezeFrameId || isFreezeFramePlaying) {
      skipFreezeFrame();
      return;
    }

    if (vid.paused) {
      // Check if sitting paused right on an un-triggered active clip freeze frame
      const atFF = activeClipFreezeFrames.find(
        (ff) =>
          Math.abs(ff.timestamp - vid.currentTime) <= 0.035 &&
          !triggeredFreezeFrames.current.has(ff.id)
      );
      if (atFF) {
        triggeredFreezeFrames.current.add(atFF.id);
        setActiveFreezeFrameId(atFF.id);
        setCountdownValue(atFF.duration || 5);
        setIsFreezeFramePlaying(true);
        return;
      }

      if (vid.currentTime < clipStart - 0.05 || vid.currentTime >= clipEnd - 0.05) {
        triggeredFreezeFrames.current.clear();
        vid.currentTime = clipStart;
        setCurrentTime(clipStart);
        lastPolledVideoTimeRef.current = clipStart;
      }
      vid.playbackRate = playbackRate;
      vid.play().catch(() => {});
      setIsPlaying(true);
    } else {
      vid.pause();
      setIsPlaying(false);
    }
  }, [
    activeFreezeFrameId,
    isFreezeFramePlaying,
    skipFreezeFrame,
    activeClipFreezeFrames,
    triggeredFreezeFrames,
    setActiveFreezeFrameId,
    setCountdownValue,
    setIsFreezeFramePlaying,
    clipStart,
    clipEnd,
    playbackRate,
  ]);

  const seekToTime = useCallback(
    (rawTime: number, pause = true) => {
      const clamped = Math.max(clipStart, Math.min(clipEnd, rawTime));
      triggeredFreezeFrames.current.clear();

      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
        countdownInterval.current = null;
      }
      setIsFreezeFramePlaying(false);

      const matchedFF = pause
        ? activeClipFreezeFrames.find((ff) => Math.abs(ff.timestamp - clamped) <= 0.025)
        : undefined;
      const resolvedSeek = matchedFF ? matchedFF.timestamp : clamped;

      if (matchedFF) {
        setActiveFreezeFrameId(matchedFF.id);
        setCountdownValue(matchedFF.duration || 5);
      } else {
        setActiveFreezeFrameId(null);
        setCountdownValue(0);
      }

      const vid = videoRef.current;
      if (vid) {
        if (pause && !vid.paused) {
          vid.pause();
          setIsPlaying(false);
        }
        try {
          vid.currentTime = matchedFF
            ? Math.min(duration || Infinity, resolvedSeek + 0.005)
            : resolvedSeek;
        } catch {}
      }
      lastPolledVideoTimeRef.current = resolvedSeek;
      setCurrentTime(resolvedSeek);
    },
    [
      clipStart,
      clipEnd,
      duration,
      activeClipFreezeFrames,
      triggeredFreezeFrames,
      countdownInterval,
      setActiveFreezeFrameId,
      setCountdownValue,
      setIsFreezeFramePlaying,
    ]
  );

  const seekVirtual = useCallback(
    (virtualOffset: number, pause = true) => {
      const mapped = virtualOffsetToState(virtualOffset, virtualSegments, clipStart, clipEnd);

      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
        countdownInterval.current = null;
      }
      setIsFreezeFramePlaying(false);

      // Keep triggeredFreezeFrames aligned with virtual cursor position so playback resumes cleanly
      triggeredFreezeFrames.current.clear();
      for (const seg of virtualSegments) {
        if (seg.type === 'freeze' && seg.ff && virtualOffset >= seg.virtualEnd - 0.005) {
          triggeredFreezeFrames.current.add(seg.ff.id);
        }
      }

      const vid = videoRef.current;
      if (vid && pause && !vid.paused) {
        vid.pause();
        setIsPlaying(false);
      }

      if (mapped.kind === 'freeze') {
        const ffDur = Math.max(0.1, mapped.ff.duration || 5);
        if (vid) {
          try {
            vid.currentTime = Math.min(duration || Infinity, mapped.videoTime + 0.005);
          } catch {}
        }
        lastPolledVideoTimeRef.current = mapped.videoTime;
        setCurrentTime(mapped.videoTime);
        setActiveFreezeFrameId(mapped.ff.id);
        // Keep >= 0.1s while scrubbing inside the hold so activeFreezeFrame stays engaged
        const remaining = Math.max(0.1, Number((ffDur - mapped.freezeElapsed).toFixed(2)));
        setCountdownValue(remaining);
        if (editingAnimationFFId === mapped.ff.id) {
          setAnimationPreviewTime(Number(mapped.freezeElapsed.toFixed(2)));
        }
      } else {
        setActiveFreezeFrameId(null);
        setCountdownValue(0);
        if (vid) {
          try {
            vid.currentTime = mapped.videoTime;
          } catch {}
        }
        lastPolledVideoTimeRef.current = mapped.videoTime;
        setCurrentTime(mapped.videoTime);
      }
    },
    [
      virtualSegments,
      clipStart,
      clipEnd,
      duration,
      editingAnimationFFId,
      countdownInterval,
      triggeredFreezeFrames,
      setIsFreezeFramePlaying,
      setActiveFreezeFrameId,
      setCountdownValue,
      setAnimationPreviewTime,
    ]
  );

  const handleTimelineTogglePlay = useCallback(() => {
    if (editingAnimationFFId) {
      setIsAnimationPreviewPlaying((prev) => !prev);
      return;
    }
    if (activeFreezeFrameId) {
      toggleFreezeFramePlay(activeFreezeFrameId);
      return;
    }
    togglePlay();
  }, [
    editingAnimationFFId,
    setIsAnimationPreviewPlaying,
    activeFreezeFrameId,
    toggleFreezeFramePlay,
    togglePlay,
  ]);

  const stepFrame = useCallback(
    (frames: number) => {
      seekToTime(currentTime + frames * 0.04, true);
    },
    [currentTime, seekToTime]
  );

  const handleChangePlaybackRate = useCallback((rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  }, []);

  // High-precision rAF playback loop: glides playhead, detects Freeze Frame crossings, & loops clip cleanly
  useEffect(() => {
    if (!isOpen || !isPlaying) return;
    let rafId = 0;
    lastPolledVideoTimeRef.current = videoRef.current ? videoRef.current.currentTime : currentTime;

    const tick = () => {
      const vid = videoRef.current;
      if (vid) {
        const lastPolled = lastPolledVideoTimeRef.current;
        let t = vid.currentTime;

        // Detect crossing any active Freeze Frame within this clip
        let crossedFF: FreezeFrame | undefined;
        if (t > lastPolled && t - lastPolled < 1.0 && !editingAnimationFFId) {
          const candidates = activeClipFreezeFrames.filter(
            (f) =>
              f.timestamp > lastPolled - 0.005 &&
              f.timestamp <= t + 0.001 &&
              !triggeredFreezeFrames.current.has(f.id)
          );
          if (candidates.length > 0) {
            candidates.sort((a, b) => a.timestamp - b.timestamp);
            crossedFF = candidates[0];
          }
        }

        if (crossedFF) {
          vid.pause();
          const diff = vid.currentTime - crossedFF.timestamp;
          if (diff < -0.005 || diff > 0.05) {
            vid.currentTime = Math.min(duration || Infinity, crossedFF.timestamp + 0.005);
          }
          t = crossedFF.timestamp;
          lastPolledVideoTimeRef.current = t;
          setCurrentTime(t);
          setIsPlaying(false);
          triggeredFreezeFrames.current.add(crossedFF.id);
          setActiveFreezeFrameId(crossedFF.id);
          setCountdownValue(crossedFF.duration || 5);
          setIsFreezeFramePlaying(true);
          if (countdownInterval.current) {
            clearInterval(countdownInterval.current);
            countdownInterval.current = null;
          }
          return;
        }

        if (t >= clipEnd - 0.02) {
          if (isLooping) {
            triggeredFreezeFrames.current.clear();
            vid.currentTime = clipStart;
            lastPolledVideoTimeRef.current = clipStart;
            setCurrentTime(clipStart);
          } else {
            vid.pause();
            vid.currentTime = clipEnd;
            lastPolledVideoTimeRef.current = clipEnd;
            setCurrentTime(clipEnd);
            setIsPlaying(false);
            return;
          }
        } else {
          lastPolledVideoTimeRef.current = t;
          setCurrentTime(t);
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [
    isOpen,
    isPlaying,
    clipStart,
    clipEnd,
    isLooping,
    duration,
    editingAnimationFFId,
    activeClipFreezeFrames,
    triggeredFreezeFrames,
    countdownInterval,
    setActiveFreezeFrameId,
    setCountdownValue,
    setIsFreezeFramePlaying,
  ]);

  const noop = useCallback(() => {}, []);

  // Telestration canvas hook reused 100%:
  // - When a Freeze Frame is active at playhead, draws stepped Freeze Frame shapes
  // - Otherwise draws timed Track / Overlay spans (`trackingMode`, 5s default)
  const {
    colors,
    activeColorId,
    setActiveColorId,
    telestrationColors,
    activeTelestrationSlot,
    handleSelectTelestrationSlot,
    handleUpdateTelestrationColor,
    handleSwapHomeAwayColors,
    handleResetTelestrationColors,
    handleCycleTelestrationSlot,
    toolSize,
    setToolSize,
    undoStack,
    redoStack,
    isDrawing,
    setIsDrawing,
    mousePosRef,
    arrowSettings,
    setArrowSettings,
    playerMoveState,
    playerMoveSettings,
    setPlayerMoveSettings,
    resetPlayerMove,
    selectedShapeId,
    setSelectedShapeId,
    setDraggingHandle,
    spotlightSettings,
    setSpotlightSettings,
    polygonSettings,
    setPolygonSettings,
    scannerSettings,
    setScannerSettings,
    lensSettings,
    setLensSettings,
    nameTagSettings,
    setNameTagSettings,
    ringSettings,
    setRingSettings,
    textSettings,
    setTextSettings,
    presetTexts,
    setPresetTexts,
    presetBulkText,
    setPresetBulkText,
    expandedPresetId,
    setExpandedPresetId,
    editingPresetId,
    setEditingPresetId,
    startDrawing,
    drawPreview,
    finishDrawing,
    handleDoubleClick,
    handleContextMenu,
    undo,
    redo,
    clearAll,
    handleColorRightClick,
    handleTelestrationRightClick,
  } = useTelestrationCanvas({
    project,
    videoUrl: resolvedVideoUrl,
    videoRef,
    canvasRef,
    ghostCanvasRef,
    containerRef,
    tool,
    shapes: studioShapes,
    setShapes: setCombinedShapes,
    isPlaying,
    setIsPlaying,
    currentTime,
    isScrubbing: false,
    isScrubbingRef,
    isScreenRecording: false,
    isTimelineExpanded: false,
    isPresentationMode: false,
    togglePlay,
    freezeFrames: activeClipFreezeFrames,
    setFreezeFrames: setProjectFreezeFrames,
    activeFreezeFrame,
    activeFreezeFrameId,
    setActiveFreezeFrameId,
    isFreezeFramePlaying,
    setIsFreezeFramePlaying,
    countdownValue,
    setCountdownValue,
    countdownInterval,
    editingAnimationFFId,
    animationPreviewTime,
    isAnimationPreviewPlaying,
    freezeFrameActiveSteps,
    currentStepForActiveFF,
    maskSettings,
    maskCache,
    isPickingColor,
    setIsPickingColor,
    addColorAtPoint,
    selectedEventIds: new Set<string>(),
    setSelectedEventIds: noop,
    setPlaybarEventId: noop,
    showNotification,
    trackingMode: {
      enabled: true,
      defaultDuration: 5,
      minTime: clipStart,
      maxTime: clipEnd,
      onTrackAdded: (newShape) => {
        if (isTrackableTool(newShape.type)) {
          setSelectedShapeId(newShape.id);
        }
      },
    },
  });

  // Trackable items shown as rows in Tracker Timeline (Column 1 tools, excluding FF shapes)
  const trackShapes = useMemo(
    () => trackedShapes.filter((s) => !s.freezeFrameId && isTrackableTool(s.type)),
    [trackedShapes]
  );

  const selectedShape = useMemo(
    () => studioShapes.find((s) => s.id === selectedShapeId) || null,
    [studioShapes, selectedShapeId]
  );

  // Timeline Track Mutators
  const handleUpdateTrackRange = useCallback(
    (shapeId: string, newStart: number, newEnd: number) => {
      setCombinedShapes((prev) =>
        prev.map((s) =>
          s.id === shapeId && !s.trackLocked
            ? {
                ...s,
                trackStartTime: Math.max(clipStart, Number(newStart.toFixed(3))),
                trackEndTime: Math.min(clipEnd, Number(newEnd.toFixed(3))),
              }
            : s
        )
      );
    },
    [setCombinedShapes, clipStart, clipEnd]
  );

  const handleToggleTrackHidden = useCallback(
    (shapeId: string) => {
      setCombinedShapes((prev) =>
        prev.map((s) => (s.id === shapeId ? { ...s, trackHidden: !s.trackHidden } : s))
      );
    },
    [setCombinedShapes]
  );

  const handleToggleTrackLocked = useCallback(
    (shapeId: string) => {
      setCombinedShapes((prev) =>
        prev.map((s) => (s.id === shapeId ? { ...s, trackLocked: !s.trackLocked } : s))
      );
    },
    [setCombinedShapes]
  );

  const handleRenameTrack = useCallback(
    (shapeId: string, label: string) => {
      setCombinedShapes((prev) =>
        prev.map((s) => (s.id === shapeId ? { ...s, trackLabel: label } : s))
      );
    },
    [setCombinedShapes]
  );

  const handleDeleteShapeOrTrack = useCallback(
    (shapeId: string) => {
      setCombinedShapes((prev) =>
        prev.filter((s) => s.id !== shapeId || Boolean(s.trackLocked))
      );
      if (selectedShapeId === shapeId) setSelectedShapeId(null);
      if (drawingRoiShapeId === shapeId) {
        setDrawingRoiShapeId(null);
        setRoiDraftRect(null);
      }
    },
    [setCombinedShapes, selectedShapeId, setSelectedShapeId, drawingRoiShapeId]
  );

  const handleDuplicateTrack = useCallback(
    (shapeId: string) => {
      setCombinedShapes((prev) => {
        const src = prev.find((s) => s.id === shapeId);
        if (!src) return prev;
        const clone: Shape = {
          ...src,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: Date.now(),
          trackLabel: generateNextTrackLabel(src.type, prev),
          trackLocked: false,
          points: src.points.map((p) => ({ ...p, x: p.x + 14, y: p.y + 14 })),
          playerBox: src.playerBox
            ? { ...src.playerBox, x: src.playerBox.x + 14, y: src.playerBox.y + 14 }
            : undefined,
        };
        setSelectedShapeId(clone.id);
        return [...prev, clone];
      });
    },
    [setCombinedShapes, setSelectedShapeId]
  );

  const handleSplitTrackAtPlayhead = useCallback(
    (shapeId: string) => {
      setCombinedShapes((prev) => {
        const idx = prev.findIndex((s) => s.id === shapeId);
        if (idx === -1) return prev;
        const src = prev[idx];
        if (src.trackLocked) return prev;
        const startT = src.trackStartTime ?? clipStart;
        const endT = src.trackEndTime ?? clipEnd;
        if (currentTime <= startT + 0.3 || currentTime >= endT - 0.3) return prev;

        const splitT = Number(currentTime.toFixed(3));
        const leftPart: Shape = { ...src, trackEndTime: splitT };
        const rightPart: Shape = {
          ...src,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: Date.now(),
          trackStartTime: splitT,
          trackEndTime: endT,
          trackLabel: generateNextTrackLabel(src.type, prev),
          points: src.points.map((p) => ({ ...p })),
          playerBox: src.playerBox ? { ...src.playerBox } : undefined,
        };
        const next = [...prev];
        next[idx] = leftPart;
        next.splice(idx + 1, 0, rightPart);
        setSelectedShapeId(rightPart.id);
        return next;
      });
    },
    [setCombinedShapes, clipStart, clipEnd, currentTime, setSelectedShapeId]
  );

  const handleClearRoi = useCallback(
    (shapeId: string) => {
      setCombinedShapes((prev) =>
        prev.map((s) => (s.id === shapeId ? { ...s, playerBox: undefined } : s))
      );
    },
    [setCombinedShapes]
  );

  // Timeline Freeze Frame Bar Handlers
  const handleSelectFreezeFrameFromTimeline = useCallback(
    (ffId: string) => {
      const ff = clipFreezeFrames.find((f) => f.id === ffId);
      if (!ff) return;
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
        countdownInterval.current = null;
      }
      setIsFreezeFramePlaying(false);
      triggeredFreezeFrames.current.delete(ffId);

      const vid = videoRef.current;
      if (vid) {
        if (!vid.paused) vid.pause();
        setIsPlaying(false);
        try {
          vid.currentTime = Math.min(duration || Infinity, ff.timestamp + 0.005);
        } catch {}
      }
      lastPolledVideoTimeRef.current = ff.timestamp;
      setCurrentTime(ff.timestamp);
      setActiveFreezeFrameId(ff.id);
      setCountdownValue(ff.duration || 5);
    },
    [
      clipFreezeFrames,
      countdownInterval,
      setIsFreezeFramePlaying,
      triggeredFreezeFrames,
      duration,
      setActiveFreezeFrameId,
      setCountdownValue,
    ]
  );

  const handleStepDelayChange = useCallback(
    (newDelay: number) => {
      const targetFF =
        activeFreezeFrame ||
        (activeFreezeFrameId
          ? activeClipFreezeFrames.find((ff) => ff.id === activeFreezeFrameId)
          : undefined);
      if (targetFF) {
        const { updatedFreezeFrame, updatedShapes } = syncFreezeFrameWithSteps(
          targetFF,
          studioShapes,
          { newStepDelay: newDelay }
        );
        setCombinedShapes(updatedShapes);
        setProjectFreezeFrames((prev) =>
          prev.map((f) => (f.id === updatedFreezeFrame.id ? updatedFreezeFrame : f))
        );
      }
    },
    [
      activeFreezeFrame,
      activeFreezeFrameId,
      activeClipFreezeFrames,
      studioShapes,
      setCombinedShapes,
      setProjectFreezeFrames,
    ]
  );

  const handleToggleTrackInFreezeFrame = useCallback(
    (ffId: string, trackId: string) => {
      setProjectFreezeFrames((prev) =>
        prev.map((ff) => {
          if (ff.id !== ffId) return ff;
          const avoided = new Set(ff.avoidedTrackIds || []);
          if (avoided.has(trackId)) {
            avoided.delete(trackId);
          } else {
            avoided.add(trackId);
          }
          return { ...ff, avoidedTrackIds: Array.from(avoided) };
        })
      );
    },
    [setProjectFreezeFrames]
  );

  const activeHeaderFF =
    activeFreezeFrame ||
    (activeFreezeFrameId
      ? activeClipFreezeFrames.find((ff) => ff.id === activeFreezeFrameId)
      : undefined);

  const selectedShapeForStepSelector = useMemo(() => {
    if (!selectedShape) return null;
    if (
      activeHeaderFF &&
      isTrackedStudioShape(selectedShape) &&
      (selectedShape.trackStartTime ?? 0) >= activeHeaderFF.timestamp - 0.05
    ) {
      const existingAnim = activeHeaderFF.trackAnimations?.[selectedShape.id];
      return {
        ...selectedShape,
        freezeFrameId: activeHeaderFF.id,
        step: existingAnim?.step ?? null,
      };
    }
    return selectedShape;
  }, [selectedShape, activeHeaderFF]);

  const handleStudioSelectedShapeStepChange = useCallback(
    (newStep: number | null) => {
      if (
        selectedShape &&
        activeHeaderFF &&
        isTrackedStudioShape(selectedShape) &&
        (selectedShape.trackStartTime ?? 0) >= activeHeaderFF.timestamp - 0.05
      ) {
        const stepDelay = getFreezeFrameStepDelay(activeHeaderFF) ?? DEFAULT_STEP_DELAY;
        const oldDur = activeHeaderFF.duration || 5;
        const safeStep = newStep === null ? null : Math.max(0, newStep);
        const reqDuration =
          safeStep !== null
            ? Math.max(oldDur, calculateRequiredFreezeFrameDuration(safeStep, stepDelay, oldDur))
            : oldDur;
        const animStart = safeStep !== null ? calculateStepAnimStart(safeStep, stepDelay) : 0;

        setProjectFreezeFrames((prev) =>
          prev.map((ff) => {
            if (ff.id !== activeHeaderFF.id) return ff;
            const prevTrackAnims = ff.trackAnimations || {};
            const prevAnim = prevTrackAnims[selectedShape.id] || {};
            const avoided = (ff.avoidedTrackIds || []).filter((id) => id !== selectedShape.id);
            return {
              ...ff,
              duration: reqDuration,
              avoidedTrackIds: avoided,
              trackAnimations: {
                ...prevTrackAnims,
                [selectedShape.id]: {
                  ...prevAnim,
                  step: safeStep,
                  animStart,
                  animEnd: reqDuration,
                },
              },
            };
          })
        );
        return;
      }
      handleSelectedShapeStepChange(selectedShapeId, newStep);
    },
    [
      selectedShape,
      activeHeaderFF,
      setProjectFreezeFrames,
      handleSelectedShapeStepChange,
      selectedShapeId,
    ]
  );

  // Scoped Keyboard Shortcuts inside Tracking Studio (matching Workspace shortcuts!)
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      const isMod = e.ctrlKey || e.metaKey;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (drawingRoiShapeId) {
          setDrawingRoiShapeId(null);
          setRoiDraftRect(null);
          roiStartPtRef.current = null;
          return;
        }
        if (editingAnimationFFId) {
          setEditingAnimationFFId(null);
          setIsAnimationPreviewPlaying(false);
          return;
        }
        if (activeFreezeFrameId) {
          skipFreezeFrame();
          return;
        }
        onClose();
        return;
      }

      // Shift+F -> Add / focus Freeze Frame at playhead (exact Workspace shortcut)
      if ((e.key === 'f' || e.key === 'F') && e.shiftKey && !isMod && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        addFreezeFrame(activeClip?.item);
        return;
      }

      // Shift+C -> Cycle Home / Away / Neutral team color preset
      if ((e.key === 'c' || e.key === 'C') && e.shiftKey && !isMod && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        handleCycleTelestrationSlot();
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        if (editingAnimationFFId) {
          setIsAnimationPreviewPlaying((prev) => !prev);
        } else {
          togglePlay();
        }
        return;
      }

      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        if (editingAnimationFFId) {
          setIsAnimationPreviewPlaying(false);
          setAnimationPreviewTime((prev) => Math.max(0, Number((prev - 0.1).toFixed(2))));
        } else if (activeFreezeFrameId) {
          seekFreezeFrameRelative(e.shiftKey ? -0.1 : -0.5);
        } else {
          seekToTime(currentTime - (e.shiftKey ? 0.04 : 0.5), true);
        }
        return;
      }

      if (e.code === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        if (editingAnimationFFId) {
          const ff = activeClipFreezeFrames.find((f) => f.id === editingAnimationFFId);
          const maxDur = ff?.duration || 5;
          setIsAnimationPreviewPlaying(false);
          setAnimationPreviewTime((prev) => Math.min(maxDur, Number((prev + 0.1).toFixed(2))));
        } else if (activeFreezeFrameId) {
          seekFreezeFrameRelative(e.shiftKey ? 0.1 : 0.5);
        } else {
          seekToTime(currentTime + (e.shiftKey ? 0.04 : 0.5), true);
        }
        return;
      }

      if (isMod && (e.code === 'KeyZ' || e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          redo();
        } else if (deletedFFStackRef.current.length > 0) {
          undoDeleteFreezeFrameRef.current();
        } else {
          undo();
        }
        return;
      }

      if (isMod && (e.code === 'KeyY' || e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        e.stopPropagation();
        redo();
        return;
      }

      if (e.code === 'Delete' || e.code === 'Backspace') {
        if (selectedShapeId) {
          e.preventDefault();
          e.stopPropagation();
          handleDeleteShapeOrTrack(selectedShapeId);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    isOpen,
    drawingRoiShapeId,
    editingAnimationFFId,
    activeFreezeFrameId,
    activeClip?.item,
    activeClipFreezeFrames,
    onClose,
    skipFreezeFrame,
    addFreezeFrame,
    handleCycleTelestrationSlot,
    setEditingAnimationFFId,
    setIsAnimationPreviewPlaying,
    setAnimationPreviewTime,
    seekFreezeFrameRelative,
    togglePlay,
    seekToTime,
    currentTime,
    deletedFFStackRef,
    undoDeleteFreezeFrameRef,
    undo,
    redo,
    selectedShapeId,
    handleDeleteShapeOrTrack,
  ]);

  // ROI Rectangle overlay mouse handlers (strictly inside rendered video frame)
  const handleRoiMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drawingRoiShapeId) return;
    e.preventDefault();
    e.stopPropagation();
    const pt = getVideoSpacePointFromEvent(e, canvasRef.current, videoRef.current);
    if (!isPointInsideVideo(pt, videoRef.current)) return;
    roiStartPtRef.current = pt;
    setRoiDraftRect({ x: pt.x, y: pt.y, w: 0, h: 0 });
  };

  const handleRoiMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drawingRoiShapeId || !roiStartPtRef.current) return;
    const rawPt = getVideoSpacePointFromEvent(e, canvasRef.current, videoRef.current);
    const pt = clampPointToVideo(rawPt, videoRef.current);
    const sx = roiStartPtRef.current.x;
    const sy = roiStartPtRef.current.y;
    setRoiDraftRect({
      x: Math.min(sx, pt.x),
      y: Math.min(sy, pt.y),
      w: Math.abs(pt.x - sx),
      h: Math.abs(pt.y - sy),
    });
  };

  const handleRoiMouseUp = () => {
    if (!drawingRoiShapeId || !roiStartPtRef.current) return;
    if (roiDraftRect && roiDraftRect.w >= 8 && roiDraftRect.h >= 8) {
      const targetId = drawingRoiShapeId;
      const box = {
        x: Math.round(roiDraftRect.x),
        y: Math.round(roiDraftRect.y),
        w: Math.round(roiDraftRect.w),
        h: Math.round(roiDraftRect.h),
      };
      setCombinedShapes((prev) =>
        prev.map((s) => (s.id === targetId ? { ...s, playerBox: box } : s))
      );
      showNotification('Player target box anchored to track', '#c6ff1f');
    }
    roiStartPtRef.current = null;
    setRoiDraftRect(null);
    setDrawingRoiShapeId(null);
  };

  // Convert ROI draft rectangle from video-space to screen px for visual preview
  const roiDraftScreenStyle = useMemo(() => {
    if (!roiDraftRect || !canvasRef.current || !videoRef.current) return null;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const dprX = canvas.width / rect.width;
    const dprY = canvas.height / rect.height;
    const layout = getVideoLayout(canvas, videoRef.current);
    return {
      left: (layout.x + roiDraftRect.x * layout.scale) / dprX,
      top: (layout.y + roiDraftRect.y * layout.scale) / dprY,
      width: (roiDraftRect.w * layout.scale) / dprX,
      height: (roiDraftRect.h * layout.scale) / dprY,
    };
  }, [roiDraftRect]);

  const editingAnimFF = useMemo(
    () =>
      editingAnimationFFId
        ? projectFreezeFrames.find((f) => f.id === editingAnimationFFId) || null
        : null,
    [editingAnimationFFId, projectFreezeFrames]
  );

  const editingAnimOverlappingTracks = useMemo(() => {
    if (!editingAnimFF) return [];
    return getTracksOverlappingTimestamp(trackedShapes, editingAnimFF.timestamp);
  }, [editingAnimFF, trackedShapes]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-[#08090b] text-white flex flex-col overflow-hidden">
      {/* COMPACT TOP BAR: Branding + Clip Switcher + Steps Selector + Freeze Frame Control + Drawing Controls */}
      <header className="h-9 px-2 bg-[#101115] border-b border-[#222530] flex items-center justify-between gap-2 shrink-0 select-none">
        {/* Left: Compact Branding + Active Playlist Clip Switcher + Steps Selector + Freeze Frame Action */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex items-center gap-1 shrink-0 overflow-hidden">
            <Logo className="w-3.5 h-3.5 shrink-0" />
            <div className="hidden sm:flex flex-col justify-center leading-none">
              <div className="font-extrabold tracking-tight leading-none text-[10px]">
                <span className="text-[#c6ff1f]">Tac</span>
                <span className="text-white">stem</span>
              </div>
              <div className="mt-[1.5px] text-[#888] text-[5.5px] tracking-[1.2px] uppercase font-semibold leading-none whitespace-nowrap">
                Football Analysis
              </div>
            </div>
          </div>

          <div className="h-3.5 w-px bg-[#252834] shrink-0" />

          <div className="flex items-center gap-1 text-[10.5px] font-bold tracking-wide text-[#c6ff1f] shrink-0">
            <Crosshair className="w-3 h-3" />
            <span className="hidden md:inline">Tracking</span>
          </div>

          {clipEntries.length > 0 && (
            <div className="flex items-center gap-0.5 bg-[#161821] border border-[#282c3a] rounded px-1 h-6 min-w-0">
              <Film className="w-2.5 h-2.5 text-gray-400 shrink-0" />
              <button
                type="button"
                disabled={activeClipIndex <= 0}
                onClick={() => setActiveClipIndex((i) => Math.max(0, i - 1))}
                className="p-0.5 text-gray-400 hover:text-white disabled:opacity-25 cursor-pointer shrink-0"
                title="Previous Playlist Clip"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <select
                value={activeClipIndex}
                onChange={(e) => setActiveClipIndex(Number(e.target.value))}
                className="bg-transparent text-[10px] font-semibold text-gray-100 outline-none cursor-pointer max-w-[140px] sm:max-w-[190px] truncate"
                title="Switch playlist clip"
              >
                {clipEntries.map((entry) => (
                  <option
                    key={`${entry.index}-${entry.eventId}`}
                    value={entry.index}
                    className="bg-[#14161e] text-white"
                  >
                    #{entry.index + 1} · {entry.title} ({formatTrackClock(entry.timing.duration)})
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={activeClipIndex >= clipEntries.length - 1}
                onClick={() =>
                  setActiveClipIndex((i) => Math.min(clipEntries.length - 1, i + 1))
                }
                className="p-0.5 text-gray-400 hover:text-white disabled:opacity-25 cursor-pointer shrink-0"
                title="Next Playlist Clip"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Steps Selector visible on top (matches main WorkspaceTopBar behavior) */}
          {(!isPlaying || activeFreezeFrameId) && (
            <FreezeFrameStepSelector
              currentStep={currentStepForActiveFF}
              onStepChange={handleStepChange}
              stepDelay={getFreezeFrameStepDelay(activeHeaderFF)}
              onStepDelayChange={handleStepDelayChange}
              selectedShape={selectedShapeForStepSelector}
              onSelectedShapeStepChange={handleStudioSelectedShapeStepChange}
              hasActiveFreezeFrame={Boolean(activeHeaderFF)}
              onOpenAnimationPanel={() => handleOpenAnimationPanel()}
              isAnimationPanelOpen={Boolean(editingAnimationFFId)}
            />
          )}

          {/* Add Freeze Frame (Shift+F) / Active FREEZE FRAME Badge + Delete FF */}
          {!isPlaying && (
            <div className="flex items-center gap-1 shrink-0">
              {activeHeaderFF ? (
                <div className="flex items-center gap-1 shrink-0">
                  <div
                    className="bg-[#c6ff1f]/90 backdrop-blur-sm text-black px-1.5 py-0.5 rounded text-[10px] font-bold border border-[#c6ff1f]/50 flex items-center gap-1 select-none shadow-xs cursor-default"
                    title="Active Freeze Frame. Press Space to skip animation and resume clip playback"
                  >
                    <Snowflake className="w-2.5 h-2.5 text-black shrink-0" />
                    <span className="hidden xl:inline">FREEZE FRAME</span>
                    <span className="xl:hidden">FF</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteFreezeFrame(activeHeaderFF.id)}
                    className="p-1 bg-red-600/80 hover:bg-red-600 text-white rounded border border-red-500/50 shadow-xs transition-colors cursor-pointer"
                    title="Delete Freeze Frame"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => addFreezeFrame(activeClip?.item)}
                  className="px-1.5 py-0.5 bg-[#1c1c1f] hover:bg-[#28282d] text-gray-200 hover:text-[#c6ff1f] border border-white/10 hover:border-[#c6ff1f]/50 rounded text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs group shrink-0"
                  title="Add Freeze Frame at playhead (Shortcut: Shift+F)"
                >
                  <Snowflake className="w-3 h-3 text-[#c6ff1f] group-hover:rotate-45 transition-transform shrink-0" />
                  <span className="hidden xl:inline">Add Freeze Frame</span>
                  <span className="hidden sm:inline xl:hidden">Add FF</span>
                  <span className="hidden 2xl:inline text-[8.5px] text-gray-400 font-mono bg-white/5 px-1 py-0.2 rounded border border-white/10">
                    Shift+F
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Center: Undo/Redo/Eraser/Clear + Telestration Team & Color Presets */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-0.5 bg-[#15171f] border border-[#262936] rounded px-1 h-6">
            <button
              type="button"
              onClick={() => {
                if (deletedFFStack.length > 0) {
                  undoDeleteFreezeFrame();
                } else {
                  undo();
                }
              }}
              disabled={undoStack.length === 0 && deletedFFStack.length === 0}
              className="w-5 h-5 rounded flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              title={
                deletedFFStack.length > 0
                  ? 'Undo Delete Freeze Frame (Ctrl+Z)'
                  : 'Undo (Ctrl+Z)'
              }
            >
              <Undo2 className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={redoStack.length === 0}
              className="w-5 h-5 rounded flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-3 h-3" />
            </button>
            <div className="h-3 w-px bg-[#282b38] mx-0.5" />
            <button
              type="button"
              onClick={() => setTool((prev) => (prev === 'eraser' ? null : 'eraser'))}
              className={`w-5 h-5 rounded flex items-center justify-center transition-colors cursor-pointer ${
                tool === 'eraser'
                  ? 'bg-[#c6ff1f] text-black'
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
              title="Eraser"
            >
              <Eraser className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={studioShapes.length === 0}
              className="w-5 h-5 rounded flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-950/40 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              title={
                activeHeaderFF
                  ? 'Clear drawings on this Freeze Frame'
                  : 'Clear All Unlocked Track Drawings'
              }
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>

          {/* Home / Away / Neutral Team Telestration Colors */}
          <div className="hidden lg:flex items-center gap-0.5 bg-[#15171f] border border-[#262936] rounded px-1 h-6">
            {(['home', 'away', 'neutral'] as const).map((slot) => {
              const slotColor = telestrationColors[slot];
              const isSlotActive = activeTelestrationSlot === slot;
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => handleSelectTelestrationSlot(slot)}
                  onContextMenu={(e) => handleTelestrationRightClick(e, slot)}
                  className={`h-4.5 px-1.5 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                    isSlotActive
                      ? 'bg-[#252834] text-white ring-1 ring-[#c6ff1f]'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                  title={`${slot} team color (Shift+C to cycle · Right-click to customize)`}
                >
                  <span
                    className="w-2 h-2 rounded-full border border-white/30"
                    style={{ backgroundColor: slotColor }}
                  />
                  <span>{slot === 'home' ? 'Home' : slot === 'away' ? 'Away' : 'Neu'}</span>
                </button>
              );
            })}
          </div>

          {/* Palette Swatches */}
          <div className="hidden xl:flex items-center gap-1 bg-[#15171f] border border-[#262936] rounded px-1.5 h-6">
            {colors.slice(0, 7).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setActiveColorId(c.id);
                  if (selectedShapeId) {
                    setCombinedShapes((prev) =>
                      prev.map((s) =>
                        s.id === selectedShapeId ? { ...s, color: c.value } : s
                      )
                    );
                  }
                }}
                onContextMenu={(e) => handleColorRightClick(e, c.id)}
                style={{ backgroundColor: c.value }}
                className={`w-3 h-3 rounded-full border transition-transform cursor-pointer ${
                  activeColorId === c.id
                    ? 'border-[#c6ff1f] scale-115 ring-1 ring-[#c6ff1f]/60'
                    : 'border-white/25 hover:scale-110'
                }`}
                title="Select color (Right-click to change)"
              />
            ))}
          </div>
        </div>

        {/* Right: Player Box ROI / Done / Close Studio */}
        <div className="flex items-center gap-1 shrink-0">
          {selectedShape &&
            !selectedShape.freezeFrameId &&
            isTrackableTool(selectedShape.type) && (
              <button
                type="button"
                onClick={() =>
                  drawingRoiShapeId
                    ? (setDrawingRoiShapeId(null), setRoiDraftRect(null))
                    : setDrawingRoiShapeId(selectedShape.id)
                }
                className={`h-6 px-2 rounded text-[9.5px] font-bold flex items-center gap-1 border transition-colors whitespace-nowrap cursor-pointer ${
                  drawingRoiShapeId
                    ? 'bg-[#c6ff1f] text-black border-[#c6ff1f]'
                    : 'bg-[#171922] text-gray-200 hover:text-[#c6ff1f] border-[#2b2f3d]'
                }`}
                title="Draw player bounding box around target player"
              >
                <SquareDashed className="w-3 h-3 shrink-0" />
                <span>{drawingRoiShapeId ? 'Drawing ROI…' : 'Player Box'}</span>
              </button>
            )}

          <button
            type="button"
            onClick={onClose}
            className="h-6 px-2 rounded bg-[#c6ff1f] hover:bg-[#b2ea14] text-black text-[10px] font-extrabold flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
            title="Done & Return to Workspace (Esc)"
          >
            <Check className="w-3 h-3 stroke-[2.5]" />
            <span>Done</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Tracking Studio"
            className="w-6 h-6 rounded bg-[#161820] hover:bg-[#232632] border border-[#2a2d3a] text-gray-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Close Tracking Studio (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* CENTER WORKSPACE: [2-Col Tools] | [Properties / Freeze Frame Panel] | [Video Canvas] | [Right Panel OR AnimationPanel] */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* 1. Left Two-Column Tools Panel */}
        <TrackingToolsPanel
          tool={tool}
          setTool={setTool}
          setPolygonSettings={setPolygonSettings}
          hasActiveFreezeFrame={Boolean(activeHeaderFF)}
          freezeFrameCount={clipFreezeFrames.length}
        />

        {/* 2. Property / Freeze Frame Panel (Always mounts exact WorkspacePropertiesPanel) */}
        <div className="w-[228px] bg-[#0c0c0e] border-r border-[#222] overflow-y-auto p-3 custom-scrollbar shrink-0 space-y-2">
          {/* In clip-scoped view, surface Deleted Freeze Frame Undo banner cleanly above PlaylistClipFreezeFramePanel */}
          {tool === null &&
            freezeFramePanelScope === 'clip' &&
            deletedFFStack.length > 0 && (
              <div className="relative rounded-lg bg-gradient-to-b from-[#1c1816] to-[#141212] border border-amber-500/40 p-2 shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex items-start justify-between gap-1.5 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-4 h-4 rounded bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
                      <Snowflake className="w-2.5 h-2.5 text-red-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-gray-200 leading-tight">
                          {deletedFFStack.length > 1
                            ? `${deletedFFStack.length} frames deleted`
                            : 'Frame deleted'}
                        </span>
                        {deletedFFStack.length > 1 && (
                          <span className="text-[8px] font-mono font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1 rounded">
                            ×{deletedFFStack.length}
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-gray-400 font-mono truncate">
                        {deletedFFStack[deletedFFStack.length - 1].name} (
                        {formatTime(deletedFFStack[deletedFFStack.length - 1].timestamp)})
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[9px] font-mono font-bold text-amber-400 bg-black/40 border border-amber-500/30 px-1 py-0.5 rounded flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5 text-amber-400" />
                      {ffRemainingSeconds}s
                    </span>
                    <button
                      type="button"
                      onClick={dismissDeletedFFNotification}
                      className="p-0.5 text-gray-400 hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
                      title="Dismiss"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={undoDeleteFreezeFrame}
                    className="flex-1 py-1 px-2 bg-[#c6ff1f] hover:bg-[#b5ee15] active:bg-[#a3d610] text-black text-[9px] font-bold rounded flex items-center justify-center gap-1 transition-all active:scale-95 shadow-sm cursor-pointer"
                    title="Restore most recently deleted frame (Ctrl+Z)"
                  >
                    <Undo2 className="w-3 h-3 stroke-[2.5]" />
                    <span>Undo {deletedFFStack.length > 1 ? 'Last' : ''}</span>
                  </button>
                  {deletedFFStack.length > 1 && (
                    <button
                      type="button"
                      onClick={undoDeleteAllFreezeFrames}
                      className="py-1 px-2 bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/30 text-[9px] font-bold rounded flex items-center justify-center gap-1 transition-all active:scale-95 shadow-sm cursor-pointer"
                      title={`Restore all ${deletedFFStack.length} deleted freeze frames`}
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>All ({deletedFFStack.length})</span>
                    </button>
                  )}
                </div>
                <div className="h-[2px] w-full bg-white/10 rounded-b overflow-hidden absolute bottom-0 left-0 right-0">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-[#c6ff1f] transition-[width] duration-75 ease-linear"
                    style={{ width: `${ffProgressPercent}%` }}
                  />
                </div>
              </div>
            )}

          <WorkspacePropertiesPanel
            tool={tool}
            project={project}
            videoRef={videoRef}
            currentTime={currentTime}
            setCurrentTime={setCurrentTime}
            duration={duration}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            telestrationColors={telestrationColors}
            activeTelestrationSlot={activeTelestrationSlot}
            handleSelectTelestrationSlot={handleSelectTelestrationSlot}
            handleUpdateTelestrationColor={handleUpdateTelestrationColor}
            handleSwapHomeAwayColors={handleSwapHomeAwayColors}
            handleResetTelestrationColors={handleResetTelestrationColors}
            playlists={playlists}
            activePlaylistId={activePlaylistId}
            showPlaylistPlaybar={Boolean(activeClip)}
            playlistPlaybarIndex={activeClipIndex}
            freezeFramePanelScope={freezeFramePanelScope}
            setFreezeFramePanelScope={setFreezeFramePanelScope}
            findEventAcrossBatch={findEventAcrossBatch}
            freezeFrames={projectFreezeFrames}
            allBatchTagEvents={allBatchTagEvents}
            allBatchTags={allBatchTags}
            activeFreezeFrameId={activeFreezeFrameId}
            setActiveFreezeFrameId={setActiveFreezeFrameId}
            isFreezeFramePlaying={isFreezeFramePlaying}
            setIsFreezeFramePlaying={setIsFreezeFramePlaying}
            countdownValue={countdownValue}
            setCountdownValue={setCountdownValue}
            toggleFreezeFramePlay={toggleFreezeFramePlay}
            seekFreezeFrame={seekFreezeFrame}
            skipFreezeFrame={skipFreezeFrame}
            hoveredFreezeFrameId={hoveredFreezeFrameId}
            setHoveredFreezeFrameId={setHoveredFreezeFrameId}
            handleManualSeek={(t) => seekToTime(t, true)}
            handleToggleClipFreezeFrameDeactivation={handleToggleClipFreezeFrameDeactivation}
            handleSetClipAllFreezeFramesDeactivation={handleSetClipAllFreezeFramesDeactivation}
            handleIsolateClipFreezeFrames={handleIsolateClipFreezeFrames}
            handleToggleClipFreezeFrameIsolation={handleToggleClipFreezeFrameIsolation}
            duplicatePlaylistEvent={duplicatePlaylistEvent}
            clipTrackedShapes={trackedShapes}
            onToggleTrackInFreezeFrame={handleToggleTrackInFreezeFrame}
            updateFreezeFrameDuration={updateFreezeFrameDuration}
            setAnimationPreviewTime={setAnimationPreviewTime}
            setIsAnimationPreviewPlaying={setIsAnimationPreviewPlaying}
            setEditingAnimationFFId={setEditingAnimationFFId}
            deleteFreezeFrame={deleteFreezeFrame}
            addFreezeFrame={addFreezeFrame}
            deletedFFStack={deletedFFStack}
            ffRemainingSeconds={ffRemainingSeconds}
            ffProgressPercent={ffProgressPercent}
            dismissDeletedFFNotification={dismissDeletedFFNotification}
            undoDeleteFreezeFrame={undoDeleteFreezeFrame}
            undoDeleteAllFreezeFrames={undoDeleteAllFreezeFrames}
            maskSettings={maskSettings}
            setMaskSettings={setMaskSettings}
            isPickingColor={isPickingColor}
            setIsPickingColor={setIsPickingColor}
            isProcessingMask={isProcessingMask}
            removeColor={removeColor}
            spotlightSettings={spotlightSettings}
            setSpotlightSettings={setSpotlightSettings}
            lensSettings={lensSettings}
            setLensSettings={setLensSettings}
            polygonSettings={polygonSettings}
            setPolygonSettings={setPolygonSettings}
            scannerSettings={scannerSettings}
            setScannerSettings={setScannerSettings}
            activeColorId={activeColorId}
            setActiveColorId={setActiveColorId}
            colors={colors}
            nameTagSettings={nameTagSettings}
            setNameTagSettings={setNameTagSettings}
            textSettings={textSettings}
            setTextSettings={setTextSettings}
            presetBulkText={presetBulkText}
            setPresetBulkText={setPresetBulkText}
            presetTexts={presetTexts}
            setPresetTexts={setPresetTexts}
            editingPresetId={editingPresetId}
            setEditingPresetId={setEditingPresetId}
            expandedPresetId={expandedPresetId}
            setExpandedPresetId={setExpandedPresetId}
            playerMoveState={playerMoveState}
            resetPlayerMove={resetPlayerMove}
            setIsDrawing={setIsDrawing}
            toolSize={toolSize}
            setToolSize={setToolSize}
            playerMoveSettings={playerMoveSettings}
            setPlayerMoveSettings={setPlayerMoveSettings}
            arrowSettings={arrowSettings}
            setArrowSettings={setArrowSettings}
            ringSettings={ringSettings}
            setRingSettings={setRingSettings}
          />
        </div>

        {/* 3. Center Video + Interactive Telestration Canvas */}
        <div
          ref={containerRef}
          className="flex-1 min-w-0 bg-black relative flex items-center justify-center overflow-hidden"
        >
          {/* Animation Timeline Editor badge matching Workspace */}
          {editingAnimFF && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[#c6ff1f]/25 backdrop-blur-md border border-[#c6ff1f]/40 text-white px-4 py-1.5 rounded-full shadow-2xl z-40 flex items-center gap-2 pointer-events-none">
              <div className="w-2 h-2 rounded-full bg-[#c6ff1f] animate-pulse" />
              <span className="font-bold tracking-widest uppercase text-xs text-[#c6ff1f]">
                Animation Timeline Editor
              </span>
            </div>
          )}

          {resolvedVideoUrl && resolvedVideoUrl !== 'live' ? (
            <>
              <video
                ref={videoRef}
                src={resolvedVideoUrl}
                muted
                playsInline
                preload="auto"
                onLoadedMetadata={(e) => {
                  const vid = e.currentTarget;
                  setDuration(vid.duration || 0);
                  try {
                    vid.currentTime = clipStart;
                  } catch {}
                  lastPolledVideoTimeRef.current = clipStart;
                  setCurrentTime(clipStart);
                }}
                onTimeUpdate={(e) => {
                  if (!isPlaying) {
                    setCurrentTime(e.currentTarget.currentTime);
                  }
                }}
                onEnded={() => setIsPlaying(false)}
                className="max-w-full max-h-full w-full h-full object-contain pointer-events-none select-none"
              />

              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={(e) => {
                  const pt = getVideoSpacePointFromEvent(
                    e,
                    canvasRef.current,
                    videoRef.current
                  );
                  const inside = isPointInsideVideo(pt, videoRef.current);
                  if (isCursorOutsideVideo === inside) {
                    setIsCursorOutsideVideo(!inside);
                  }
                  drawPreview(e);
                }}
                onMouseUp={finishDrawing}
                onMouseLeave={() => {
                  mousePosRef.current = null;
                  setIsCursorOutsideVideo(false);
                  if (isDrawing) setIsDrawing(false);
                }}
                onDoubleClick={handleDoubleClick}
                onContextMenu={handleContextMenu}
                className={`absolute inset-0 w-full h-full z-10 ${
                  isCursorOutsideVideo && tool !== null && tool !== 'move'
                    ? 'cursor-default'
                    : tool === 'move'
                    ? 'cursor-move'
                    : tool === 'eraser'
                    ? 'cursor-cell'
                    : tool !== null
                    ? 'cursor-crosshair'
                    : 'cursor-default'
                }`}
              />

              <canvas
                ref={ghostCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none z-20"
              />

              {/* Target Player ROI Rectangle Overlay Mode */}
              {drawingRoiShapeId && (
                <div
                  onMouseDown={handleRoiMouseDown}
                  onMouseMove={handleRoiMouseMove}
                  onMouseUp={handleRoiMouseUp}
                  className="absolute inset-0 z-30 cursor-crosshair bg-black/15"
                >
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-md bg-[#0a0b0e]/90 border border-[#c6ff1f]/60 text-[11px] font-semibold text-[#c6ff1f] pointer-events-none shadow-lg whitespace-nowrap">
                    Drag a rectangle around the player · Release to anchor · Esc to cancel
                  </div>
                  {roiDraftScreenStyle && (
                    <div
                      style={roiDraftScreenStyle}
                      className="absolute border-2 border-[#c6ff1f] bg-[#c6ff1f]/15 pointer-events-none"
                    />
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-6 text-gray-500">
              <Film className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm font-semibold text-gray-300">No Video Loaded</p>
              <p className="text-xs text-gray-500 mt-1">
                Link or load the match video to preview and track overlays on this clip.
              </p>
            </div>
          )}
        </div>

        {/* 4. Right Panel: Animation Timeline Panel (when editing FF animation) OR Tracking Right Panel */}
        {editingAnimFF ? (
          <>
            <div
              className={`w-1 z-30 cursor-col-resize transition-colors shrink-0 ${
                isResizingAnimPanel ? 'bg-[#c6ff1f]' : 'bg-[#222] hover:bg-gray-500'
              }`}
              onMouseDown={() => setIsResizingAnimPanel(true)}
            />
            <AnimationPanel
              width={animationPanelWidth}
              freezeFrame={editingAnimFF}
              shapes={studioShapes}
              setShapes={setCombinedShapes}
              onClose={() => {
                setEditingAnimationFFId(null);
                setIsAnimationPreviewPlaying(false);
              }}
              previewTime={animationPreviewTime}
              setPreviewTime={setAnimationPreviewTime}
              isPlaying={isAnimationPreviewPlaying}
              setIsPlaying={setIsAnimationPreviewPlaying}
              selectedShapeId={selectedShapeId}
              setSelectedShapeId={(id) => {
                setSelectedShapeId(id);
                if (id) setTool('move');
              }}
              onUpdateFreezeFrame={(updatedFF) => {
                setProjectFreezeFrames((prev) =>
                  prev.map((f) => (f.id === updatedFF.id ? updatedFF : f))
                );
              }}
              overlappingTracks={editingAnimOverlappingTracks}
              onToggleTrackAvoidInFF={(trackId) =>
                handleToggleTrackInFreezeFrame(editingAnimFF.id, trackId)
              }
            />
          </>
        ) : (
          <TrackingRightPanel
            isCollapsed={isRightPanelCollapsed}
            onToggleCollapse={() => setIsRightPanelCollapsed((c) => !c)}
            selectedShape={selectedShape}
            clipStart={clipStart}
            clipEnd={clipEnd}
            isDrawingRoi={Boolean(drawingRoiShapeId)}
            onStartDrawRoi={(shapeId) => {
              if (isPlaying) togglePlay();
              setSelectedShapeId(shapeId);
              setDrawingRoiShapeId(shapeId);
            }}
            onCancelDrawRoi={() => {
              setDrawingRoiShapeId(null);
              setRoiDraftRect(null);
              roiStartPtRef.current = null;
            }}
            onClearRoi={handleClearRoi}
            onRenameTrack={handleRenameTrack}
          />
        )}
      </div>

      {/* BOTTOM: Expanded NLE Timeline with Full-Height Vertical Freeze Frame Pause Columns & Track Bars */}
      <TrackingTimeline
        clipKey={activeClipIdentity}
        clipItem={activeClip?.item || null}
        clipIndex={activeClipIndex}
        clipStart={clipStart}
        clipEnd={clipEnd}
        currentTime={currentTime}
        isPlaying={isPlaying}
        isLooping={isLooping}
        playbackRate={playbackRate}
        trackShapes={trackShapes}
        allTrackedShapes={trackedShapes}
        clipFreezeFrames={clipFreezeFrames}
        activeFreezeFrameId={activeFreezeFrameId}
        isFreezeFramePlaying={isFreezeFramePlaying}
        countdownValue={countdownValue}
        triggeredFreezeFrameIds={Array.from(triggeredFreezeFrames.current)}
        editingAnimationFFId={editingAnimationFFId}
        animationPreviewTime={animationPreviewTime}
        hoveredFreezeFrameId={hoveredFreezeFrameId}
        onHoverFreezeFrame={setHoveredFreezeFrameId}
        onSelectFreezeFrame={handleSelectFreezeFrameFromTimeline}
        onUpdateFreezeFrameDuration={updateFreezeFrameDuration}
        onOpenFreezeFrameAnimation={(ffId) => handleOpenAnimationPanel(ffId)}
        onToggleFreezeFrameDeactivation={(ffId) =>
          handleToggleClipFreezeFrameDeactivation(activePlaylistId, activeClipIndex, ffId)
        }
        onDeleteFreezeFrame={deleteFreezeFrame}
        onAddFreezeFrame={() => addFreezeFrame(activeClip?.item)}
        onToggleTrackInFreezeFrame={handleToggleTrackInFreezeFrame}
        selectedShapeId={selectedShapeId}
        onSelectShape={(id) => {
          setSelectedShapeId(id);
          if (id) setTool('move');
        }}
        onTogglePlay={togglePlay}
        onTimelineTogglePlay={handleTimelineTogglePlay}
        onSeek={seekToTime}
        onSeekVirtual={seekVirtual}
        onStepFrame={stepFrame}
        onToggleLoop={() => setIsLooping((l) => !l)}
        onChangePlaybackRate={handleChangePlaybackRate}
        onUpdateTrackRange={handleUpdateTrackRange}
        onToggleTrackHidden={handleToggleTrackHidden}
        onToggleTrackLocked={handleToggleTrackLocked}
        onRenameTrack={handleRenameTrack}
        onDeleteTrack={handleDeleteShapeOrTrack}
        onDuplicateTrack={handleDuplicateTrack}
        onSplitTrackAtPlayhead={handleSplitTrackAtPlayhead}
        onSetTrackRoi={(shapeId) => {
          if (isPlaying) togglePlay();
          setSelectedShapeId(shapeId);
          setDrawingRoiShapeId(shapeId);
        }}
      />
    </div>
  );
};
