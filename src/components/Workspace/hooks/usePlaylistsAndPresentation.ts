import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import type React from 'react';
import type {
  FreezeFrame,
  Label,
  MaskSettings,
  Playlist,
  PlaylistClip,
  PlaylistItem,
  Project,
  Shape,
  Tag as TagData,
  TagEvent,
  ToolType,
} from '../../../types';
import { formatTime } from '../../../utils/math';
import {
  getClipEventId,
  resetClipTrim,
  resolveClipTiming,
  setClipAllFreezeFramesDeactivation,
  toggleClipFreezeFrameDeactivation,
  updateClipTrim,
  isolateClipFreezeFramesInPlaylist,
  toggleClipFreezeFrameIsolation,
  deactivateFreezeFrameInOtherPlaylistClips,
  isFreezeFrameActiveForClip,
} from '../../../utils/playlistUtils';
import {
  buildPlaylistExportItems,
  buildPlaylistPreviewItemsSync,
} from '../VideoExport/exportTimeline';
import type { PresentationConfig } from '../Presentation';
import type {
  AutoplayState,
  ExportModalState,
  PlaylistModalState,
  WorkspaceBatchModeProps,
} from '../Workspace.types';

export function usePlaylistsAndPresentation(params: {
  project: Project;
  videoUrl: string;
  batchMode?: WorkspaceBatchModeProps;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  currentTime: number;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  duration: number;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setTool: React.Dispatch<React.SetStateAction<ToolType>>;
  playlists: Playlist[];
  setPlaylists: React.Dispatch<React.SetStateAction<Playlist[]>>;
  activePlaylistId: string;
  setActivePlaylistId: React.Dispatch<React.SetStateAction<string>>;
  syncPlaylistsToStorage: (nextPlaylists: Playlist[]) => void;
  tags: TagData[];
  labels: Label[];
  tagEvents: TagEvent[];
  shapes: Shape[];
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
  freezeFrames: FreezeFrame[];
  activeFreezeFrameId: string | null;
  setActiveFreezeFrameId: React.Dispatch<React.SetStateAction<string | null>>;
  setIsFreezeFramePlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setCountdownValue: React.Dispatch<React.SetStateAction<number>>;
  countdownInterval: React.MutableRefObject<number | null>;
  editingAnimationFFId: string | null;
  setEditingAnimationFFId: React.Dispatch<React.SetStateAction<string | null>>;
  setIsAnimationPreviewPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  selectedEventIds: Set<string>;
  setSelectedEventIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedEventLogs: Set<string>;
  setSelectedEventLogs: React.Dispatch<React.SetStateAction<Set<string>>>;
  playbarEventId: string | null;
  setPlaybarEventId?: React.Dispatch<React.SetStateAction<string | null>>;
  setIsMultiSelectAction?: React.Dispatch<React.SetStateAction<boolean>>;
  setIsEventsEditMode?: React.Dispatch<React.SetStateAction<boolean>>;
  setFreezeFramePanelScope: React.Dispatch<React.SetStateAction<'clip' | 'all'>>;
  triggeredFreezeFrames: React.MutableRefObject<Set<string>>;
  clearMaskCache: () => void;
  maskSettings: MaskSettings;
  isScrubbingRef: React.MutableRefObject<boolean>;
  scrubTargetTimeRef: React.MutableRefObject<number | null>;
  lastTimeRef: React.MutableRefObject<number>;
  pendingSeekTimeRef: React.MutableRefObject<number | null>;
  pendingPlayRef: React.MutableRefObject<boolean>;
  isScreenRecording: boolean;
  stopRecording: () => void;
  toggleScreenRecording: () => Promise<void>;
  mediaRecorderRef: React.MutableRefObject<MediaRecorder | null>;
  recordingCustomNameRef: React.MutableRefObject<string | null>;
  exportSettingsRef: React.MutableRefObject<{
    active: boolean;
    playlistId: string | null;
    withFreezeFrames: boolean;
    customFileName?: string;
  }>;
  setExportModalState: React.Dispatch<React.SetStateAction<ExportModalState>>;
  showNotification: (
    message: string,
    color: string,
    onUndo?: () => void,
    action?: { label: string; onClick: () => void }
  ) => void;
}) {
  const {
    project,
    videoUrl,
    batchMode,
    videoRef,
    currentTime,
    setCurrentTime,
    duration,
    isPlaying,
    setIsPlaying,
    setTool,
    playlists,
    setPlaylists,
    activePlaylistId,
    setActivePlaylistId,
    syncPlaylistsToStorage,
    tags,
    labels,
    tagEvents,
    shapes,
    setShapes,
    freezeFrames,
    activeFreezeFrameId,
    setActiveFreezeFrameId,
    setIsFreezeFramePlaying,
    setCountdownValue,
    countdownInterval,
    editingAnimationFFId,
    setEditingAnimationFFId,
    setIsAnimationPreviewPlaying,
    selectedEventIds,
    setSelectedEventIds,
    selectedEventLogs,
    setSelectedEventLogs,
    playbarEventId,
    setPlaybarEventId,
    setIsMultiSelectAction,
    setIsEventsEditMode,
    setFreezeFramePanelScope,
    triggeredFreezeFrames,
    clearMaskCache,
    maskSettings,
    isScrubbingRef,
    scrubTargetTimeRef,
    lastTimeRef,
    pendingSeekTimeRef,
    pendingPlayRef,
    isScreenRecording,
    stopRecording,
    toggleScreenRecording,
    mediaRecorderRef,
    recordingCustomNameRef,
    exportSettingsRef,
    setExportModalState,
    showNotification,
  } = params;

  const [playlistModal, setPlaylistModal] = useState<PlaylistModalState | null>(null);
  const [playlistDeleteId, setPlaylistDeleteId] = useState<string | null>(null);
  const [autoplay, setAutoplay] = useState<AutoplayState>({
    active: false,
    playlistId: null,
    eventIndex: -1,
  });
  const [draggingEventIndex, setDraggingEventIndex] = useState<number | null>(null);
  const [showPlaylistPlaybar, setShowPlaylistPlaybar] = useState<boolean>(() => {
    return Boolean(batchMode?.autoPlayPlaylist || batchMode?.initialPlaylistId);
  });
  const [playlistPlaybarIndex, setPlaylistPlaybarIndex] = useState<number>(0);

  const [isPresentationMode, setIsPresentationMode] = useState<boolean>(false);
  const [showPresentationCustomizeModal, setShowPresentationCustomizeModal] = useState<boolean>(false);
  const [presentationPlaylistIndex, setPresentationPlaylistIndex] = useState<number>(0);
  const [presentationFinished, setPresentationFinished] = useState<boolean>(false);
  const [presentationTransitionMsg, setPresentationTransitionMsg] = useState<string | null>(null);

  const [presentationConfig, setPresentationConfig] = useState<PresentationConfig>(() => {
    try {
      const saved = localStorage.getItem(`tacstem_presentation_config_${project.id}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    const initialIds = (project.data.playlists || []).map((p) => p.id);
    return {
      selectedPlaylistIds: initialIds,
      orderedPlaylistIds: initialIds,
      loop: false,
      pauseBetweenPlaylists: false,
      showDrawings: true,
    };
  });

  useEffect(() => {
    setPresentationConfig((prev) => {
      const currentIds = new Set(playlists.map((p) => p.id));
      const filteredSelected = prev.selectedPlaylistIds.filter((id) => currentIds.has(id));
      const filteredOrdered = prev.orderedPlaylistIds.filter((id) => currentIds.has(id));
      playlists.forEach((p) => {
        if (!filteredOrdered.includes(p.id)) filteredOrdered.push(p.id);
        if (!filteredSelected.includes(p.id)) filteredSelected.push(p.id);
      });
      return {
        ...prev,
        selectedPlaylistIds: filteredSelected,
        orderedPlaylistIds: filteredOrdered,
      };
    });
  }, [playlists]);

  // Ensure every clip item across playlists has a stable unique instanceId for animated drag-and-drop
  useEffect(() => {
    let needsUpgrade = false;
    const seenIds = new Set<string>();
    for (const pl of playlists) {
      for (const item of pl.events) {
        if (typeof item === 'string' || !item.instanceId || seenIds.has(item.instanceId)) {
          needsUpgrade = true;
          break;
        }
        seenIds.add(item.instanceId);
      }
      if (needsUpgrade) break;
    }

    if (!needsUpgrade) return;

    const usedIds = new Set<string>();
    const upgradedPlaylists = playlists.map((pl) => ({
      ...pl,
      events: pl.events.map((item, idx) => {
        if (typeof item === 'string') {
          const id = `clip-${item}-${idx}-${Math.random().toString(36).slice(2, 7)}`;
          usedIds.add(id);
          return { instanceId: id, eventId: item };
        }
        if (!item.instanceId || usedIds.has(item.instanceId)) {
          const evId = getClipEventId(item) || 'evt';
          const id = `clip-${evId}-${idx}-${Math.random().toString(36).slice(2, 7)}`;
          usedIds.add(id);
          return { ...item, instanceId: id };
        }
        usedIds.add(item.instanceId);
        return item;
      }),
    }));

    setPlaylists(upgradedPlaylists);
    syncPlaylistsToStorage(upgradedPlaylists);
  }, [playlists, setPlaylists, syncPlaylistsToStorage]);

  const allBatchTagEvents = useMemo(() => {
    if (!batchMode?.allBatchProjects) return tagEvents;
    const map = new Map<string, TagEvent>();
    tagEvents.forEach((e) => map.set(e.id, e));
    batchMode.allBatchProjects.forEach((bp) => {
      if (bp.id !== project.id) {
        bp.data?.tagEvents?.forEach((e) => {
          if (!map.has(e.id)) map.set(e.id, e);
        });
      }
    });
    return Array.from(map.values());
  }, [tagEvents, project.id, batchMode?.allBatchProjects]);

  const allBatchTags = useMemo(() => {
    if (!batchMode?.allBatchProjects) return tags;
    const map = new Map<string, TagData>();
    tags.forEach((t) => map.set(t.id, t));
    batchMode.allBatchProjects.forEach((bp) => {
      if (bp.id !== project.id) {
        bp.data?.tags?.forEach((t) => {
          if (!map.has(t.id)) map.set(t.id, t);
        });
      }
    });
    return Array.from(map.values());
  }, [tags, project.id, batchMode?.allBatchProjects]);

  const allBatchLabels = useMemo(() => {
    if (!batchMode?.allBatchProjects) return labels;
    const map = new Map<string, Label>();
    labels.forEach((l) => map.set(l.id, l));
    batchMode.allBatchProjects.forEach((bp) => {
      if (bp.id !== project.id) {
        bp.data?.labels?.forEach((l) => {
          if (!map.has(l.id)) map.set(l.id, l);
        });
      }
    });
    return Array.from(map.values());
  }, [labels, project.id, batchMode?.allBatchProjects]);

  const findEventAcrossBatch = useCallback(
    (
      eventId: string,
      item?: PlaylistItem
    ): { event: TagEvent | undefined; project: Project | undefined } => {
      const itemProjectId = typeof item === 'object' ? item.projectId : undefined;

      if (itemProjectId && batchMode?.allBatchProjects) {
        const matchProj = batchMode.allBatchProjects.find((p) => p.id === itemProjectId);
        if (matchProj) {
          if (matchProj.id === project.id) {
            const ev = tagEvents.find((e) => e.id === eventId);
            if (ev) return { event: ev, project: matchProj };
          }
          const ev = matchProj.data?.tagEvents?.find((e) => e.id === eventId);
          if (ev) return { event: ev, project: matchProj };
        }
      }

      const currentEv = tagEvents.find((e) => e.id === eventId);
      if (currentEv) return { event: currentEv, project };

      if (batchMode?.allBatchProjects) {
        for (const p of batchMode.allBatchProjects) {
          if (p.id === project.id) continue;
          const ev = p.data?.tagEvents?.find((e) => e.id === eventId);
          if (ev) return { event: ev, project: p };
        }
      }

      return { event: undefined, project: undefined };
    },
    [tagEvents, project, batchMode?.allBatchProjects]
  );

  const syncFreezeFrameStateOnClipSeek = useCallback(
    (
      seekTime: number,
      item: PlaylistItem | undefined,
      isSameProject: boolean,
      shouldPlay: boolean
    ): FreezeFrame | undefined => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
        countdownInterval.current = null;
      }
      if (editingAnimationFFId) {
        setEditingAnimationFFId(null);
        setIsAnimationPreviewPlaying(false);
      }
      triggeredFreezeFrames.current.clear();

      // Clear any transient (non-freeze-frame) drawings from the previous frame
      setShapes((prev) => {
        const hasTemp = prev.some((s) => !s.freezeFrameId);
        return hasTemp ? prev.filter((s) => Boolean(s.freezeFrameId)) : prev;
      });

      if (!isSameProject || shouldPlay) {
        setActiveFreezeFrameId(null);
        setIsFreezeFramePlaying(false);
        setCountdownValue(0);
        return undefined;
      }

      const matchedFF = freezeFrames.find(
        (ff) => isFreezeFrameActiveForClip(ff, item) && Math.abs(ff.timestamp - seekTime) <= 0.035
      );

      if (matchedFF) {
        setActiveFreezeFrameId(matchedFF.id);
        setIsFreezeFramePlaying(false);
        setCountdownValue(matchedFF.duration || 5);
        return matchedFF;
      }

      setActiveFreezeFrameId(null);
      setIsFreezeFramePlaying(false);
      setCountdownValue(0);
      return undefined;
    },
    [
      countdownInterval,
      editingAnimationFFId,
      setEditingAnimationFFId,
      setIsAnimationPreviewPlaying,
      triggeredFreezeFrames,
      setShapes,
      freezeFrames,
      setActiveFreezeFrameId,
      setIsFreezeFramePlaying,
      setCountdownValue,
    ]
  );

  const handlePlaylistClipSelect = useCallback(
    (clipIndex: number, targetVideoTime?: number, autoPlay?: boolean) => {
      const pl = playlists.find((p) => p.id === activePlaylistId);
      if (!pl || !pl.events[clipIndex]) return;

      const item = pl.events[clipIndex];
      const eventId = getClipEventId(item);
      const { event, project: clipProj } = findEventAcrossBatch(eventId, item);
      const timing = resolveClipTiming(item, event);
      const seekTime = targetVideoTime !== undefined ? targetVideoTime : timing.startTime;
      const isSameProject = !clipProj || clipProj.id === project.id || !batchMode;
      const shouldPlay = isScrubbingRef.current
        ? false
        : autoPlay !== undefined
          ? Boolean(autoPlay)
          : isPlaying;

      setPlaylistPlaybarIndex(clipIndex);
      // Cleanly clear timeline event selection when selecting a playlist clip
      setSelectedEventIds(new Set());
      setSelectedEventLogs(new Set());
      setPlaybarEventId?.(null);
      setIsMultiSelectAction?.(false);
      setFreezeFramePanelScope('clip');
      setTool(null);

      const matchedFF = syncFreezeFrameStateOnClipSeek(
        seekTime,
        item,
        isSameProject,
        shouldPlay
      );

      if (!isScrubbingRef.current && (autoPlay || autoplay.active)) {
        setAutoplay({ active: true, playlistId: activePlaylistId, eventIndex: clipIndex });
      }

      clearMaskCache();

      if (!isSameProject && clipProj && batchMode) {
        if (videoRef.current) {
          videoRef.current.pause();
        }
        pendingSeekTimeRef.current = seekTime;
        pendingPlayRef.current = shouldPlay;
        batchMode.onSelectProject(clipProj.id);
      } else if (isScrubbingRef.current) {
        scrubTargetTimeRef.current = seekTime;
        setCurrentTime(seekTime);
        lastTimeRef.current = seekTime;
        if (videoRef.current && Math.abs(videoRef.current.currentTime - seekTime) > 0.05) {
          videoRef.current.currentTime = seekTime;
        }
      } else {
        if (videoRef.current) {
          const safeVideoSeek = matchedFF
            ? Math.min(duration || Infinity, matchedFF.timestamp + 0.005)
            : seekTime;
          videoRef.current.currentTime = safeVideoSeek;
          setCurrentTime(matchedFF ? matchedFF.timestamp : seekTime);
          lastTimeRef.current = matchedFF ? matchedFF.timestamp : seekTime;
          if (shouldPlay) {
            videoRef.current.play().catch((e) => console.log(e));
            setIsPlaying(true);
          } else {
            videoRef.current.pause();
            setIsPlaying(false);
          }
        } else {
          setCurrentTime(matchedFF ? matchedFF.timestamp : seekTime);
          lastTimeRef.current = matchedFF ? matchedFF.timestamp : seekTime;
          if (!shouldPlay) {
            setIsPlaying(false);
          }
        }
      }
    },
    [
      playlists,
      activePlaylistId,
      findEventAcrossBatch,
      batchMode,
      project.id,
      duration,
      isPlaying,
      autoplay.active,
      clearMaskCache,
      syncFreezeFrameStateOnClipSeek,
      setSelectedEventIds,
      setSelectedEventLogs,
      setPlaybarEventId,
      setIsMultiSelectAction,
      setFreezeFramePanelScope,
      setTool,
      isScrubbingRef,
      videoRef,
      pendingSeekTimeRef,
      pendingPlayRef,
      scrubTargetTimeRef,
      setCurrentTime,
      lastTimeRef,
      setIsPlaying,
    ]
  );

  const presentationPlaylists = useMemo(() => {
    const existingMap = new Map(playlists.map((p) => [p.id, p]));
    const ordered = presentationConfig.orderedPlaylistIds
      .map((id) => existingMap.get(id))
      .filter((p): p is Playlist => Boolean(p && p.events.length > 0));

    const selectedSet = new Set(presentationConfig.selectedPlaylistIds);
    const filtered = ordered.filter((p) => selectedSet.has(p.id));

    if (filtered.length === 0) {
      return playlists.filter((p) => p.events.length > 0);
    }
    return filtered;
  }, [playlists, presentationConfig.orderedPlaylistIds, presentationConfig.selectedPlaylistIds]);

  const currentPresentationPlaylist =
    presentationPlaylists[presentationPlaylistIndex] || presentationPlaylists[0];

  const { currentPresentationEvent, currentPresentationTiming } = useMemo(() => {
    if (!currentPresentationPlaylist || currentPresentationPlaylist.events.length === 0) {
      return {
        currentPresentationEvent: undefined,
        currentPresentationTiming: { startTime: 0, endTime: duration, duration: duration },
      };
    }
    const safeClipIdx = Math.max(
      0,
      Math.min(playlistPlaybarIndex, currentPresentationPlaylist.events.length - 1)
    );
    const item = currentPresentationPlaylist.events[safeClipIdx];
    const evId = getClipEventId(item);
    const { event } = findEventAcrossBatch(evId, item);
    const timing = resolveClipTiming(item, event);
    return {
      currentPresentationEvent: event,
      currentPresentationTiming: timing,
    };
  }, [currentPresentationPlaylist, playlistPlaybarIndex, findEventAcrossBatch, duration]);

  const isPresentationModeRef = useRef(isPresentationMode);
  isPresentationModeRef.current = isPresentationMode;

  const presentationPlaylistsRef = useRef(presentationPlaylists);
  presentationPlaylistsRef.current = presentationPlaylists;

  const presentationConfigRef = useRef(presentationConfig);
  presentationConfigRef.current = presentationConfig;

  const presentationPlaylistIndexRef = useRef(presentationPlaylistIndex);
  presentationPlaylistIndexRef.current = presentationPlaylistIndex;

  const handleEnterPresentationMode = useCallback(
    (startFromBeginning: boolean = false) => {
      const nonEmpties = playlists.filter((p) => p.events.length > 0);
      if (playlists.length === 0 || nonEmpties.length === 0) {
        setShowPresentationCustomizeModal(true);
        return;
      }

      setIsPresentationMode(true);
      setPresentationFinished(false);

      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch (e) {}

      let targetPlIdx = presentationPlaylistIndex;
      if (startFromBeginning || targetPlIdx >= presentationPlaylists.length || targetPlIdx < 0) {
        targetPlIdx = 0;
        setPresentationPlaylistIndex(0);
      }

      const targetPl = presentationPlaylists[targetPlIdx] || nonEmpties[0];
      if (targetPl && targetPl.events.length > 0) {
        setActivePlaylistId(targetPl.id);
        setPlaylistPlaybarIndex(0);
        setAutoplay({ active: true, playlistId: targetPl.id, eventIndex: 0 });

        const firstItem = targetPl.events[0];
        const eventId = getClipEventId(firstItem);
        const { event, project: clipProj } = findEventAcrossBatch(eventId, firstItem);
        const timing = resolveClipTiming(firstItem, event);
        const isSameProject = !clipProj || clipProj.id === project.id || !batchMode;

        setTool(null);
        const matchedFF = syncFreezeFrameStateOnClipSeek(
          timing.startTime,
          firstItem,
          isSameProject,
          false
        );

        if (!isSameProject && clipProj && batchMode) {
          if (videoRef.current) videoRef.current.pause();
          pendingSeekTimeRef.current = timing.startTime;
          pendingPlayRef.current = false;
          batchMode.onSelectProject(clipProj.id);
        } else if (videoRef.current) {
          videoRef.current.currentTime = matchedFF
            ? Math.min(duration || Infinity, matchedFF.timestamp + 0.005)
            : timing.startTime;
          setCurrentTime(matchedFF ? matchedFF.timestamp : timing.startTime);
          lastTimeRef.current = matchedFF ? matchedFF.timestamp : timing.startTime;
          videoRef.current.pause();
          setIsPlaying(false);
        }
      }
    },
    [
      playlists,
      presentationPlaylists,
      presentationPlaylistIndex,
      findEventAcrossBatch,
      project.id,
      duration,
      batchMode,
      setActivePlaylistId,
      setTool,
      syncFreezeFrameStateOnClipSeek,
      videoRef,
      pendingSeekTimeRef,
      pendingPlayRef,
      setCurrentTime,
      lastTimeRef,
      setIsPlaying,
    ]
  );

  const handleExitPresentationMode = useCallback(() => {
    setIsPresentationMode(false);
    setShowPresentationCustomizeModal(false);
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch (e) {}
  }, []);

  const handleSelectPresentationPlaylistIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= presentationPlaylists.length) return;
      const targetPl = presentationPlaylists[index];
      if (!targetPl || targetPl.events.length === 0) return;

      setPresentationPlaylistIndex(index);
      setActivePlaylistId(targetPl.id);
      setPlaylistPlaybarIndex(0);
      setAutoplay({ active: true, playlistId: targetPl.id, eventIndex: 0 });

      const firstItem = targetPl.events[0];
      const eventId = getClipEventId(firstItem);
      const { event, project: clipProj } = findEventAcrossBatch(eventId, firstItem);
      const timing = resolveClipTiming(firstItem, event);
      const isSameProject = !clipProj || clipProj.id === project.id || !batchMode;

      setTool(null);
      syncFreezeFrameStateOnClipSeek(timing.startTime, firstItem, isSameProject, true);

      if (!isSameProject && clipProj && batchMode) {
        if (videoRef.current) videoRef.current.pause();
        pendingSeekTimeRef.current = timing.startTime;
        pendingPlayRef.current = true;
        batchMode.onSelectProject(clipProj.id);
      } else if (videoRef.current) {
        videoRef.current.currentTime = timing.startTime;
        setCurrentTime(timing.startTime);
        lastTimeRef.current = timing.startTime;
        videoRef.current.play().catch((e) => console.log(e));
        setIsPlaying(true);
      }
    },
    [
      presentationPlaylists,
      findEventAcrossBatch,
      project.id,
      batchMode,
      setActivePlaylistId,
      setTool,
      syncFreezeFrameStateOnClipSeek,
      videoRef,
      pendingSeekTimeRef,
      pendingPlayRef,
      setCurrentTime,
      lastTimeRef,
      setIsPlaying,
    ]
  );

  const handleNextPresentationClip = useCallback(() => {
    if (!currentPresentationPlaylist || currentPresentationPlaylist.events.length === 0) return;
    const nextClipIdx = playlistPlaybarIndex + 1;
    if (nextClipIdx < currentPresentationPlaylist.events.length) {
      handlePlaylistClipSelect(nextClipIdx, undefined, true);
    } else {
      const nextPlIdx = presentationPlaylistIndex + 1;
      if (nextPlIdx < presentationPlaylists.length) {
        handleSelectPresentationPlaylistIndex(nextPlIdx);
      } else if (presentationConfig.loop && presentationPlaylists.length > 0) {
        handleSelectPresentationPlaylistIndex(0);
      } else {
        setPresentationFinished(true);
        if (videoRef.current) videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [
    currentPresentationPlaylist,
    playlistPlaybarIndex,
    presentationPlaylistIndex,
    presentationPlaylists,
    presentationConfig.loop,
    handlePlaylistClipSelect,
    handleSelectPresentationPlaylistIndex,
    videoRef,
    setIsPlaying,
  ]);

  const handlePrevPresentationClip = useCallback(() => {
    if (!currentPresentationPlaylist || currentPresentationPlaylist.events.length === 0) return;
    const prevClipIdx = playlistPlaybarIndex - 1;
    if (prevClipIdx >= 0) {
      handlePlaylistClipSelect(prevClipIdx, undefined, true);
    } else {
      const prevPlIdx = presentationPlaylistIndex - 1;
      if (prevPlIdx >= 0) {
        const prevPl = presentationPlaylists[prevPlIdx];
        if (prevPl && prevPl.events.length > 0) {
          setPresentationPlaylistIndex(prevPlIdx);
          setActivePlaylistId(prevPl.id);
          const lastClipIdx = prevPl.events.length - 1;
          setPlaylistPlaybarIndex(lastClipIdx);
          setAutoplay({ active: true, playlistId: prevPl.id, eventIndex: lastClipIdx });
          const lastItem = prevPl.events[lastClipIdx];
          const eventId = getClipEventId(lastItem);
          const { event, project: clipProj } = findEventAcrossBatch(eventId, lastItem);
          const timing = resolveClipTiming(lastItem, event);
          const isSameProject = !clipProj || clipProj.id === project.id || !batchMode;

          setTool(null);
          syncFreezeFrameStateOnClipSeek(timing.startTime, lastItem, isSameProject, true);

          if (!isSameProject && clipProj && batchMode) {
            if (videoRef.current) videoRef.current.pause();
            pendingSeekTimeRef.current = timing.startTime;
            pendingPlayRef.current = true;
            batchMode.onSelectProject(clipProj.id);
          } else if (videoRef.current) {
            videoRef.current.currentTime = timing.startTime;
            setCurrentTime(timing.startTime);
            lastTimeRef.current = timing.startTime;
            videoRef.current.play().catch((e) => console.log(e));
            setIsPlaying(true);
          }
        }
      }
    }
  }, [
    currentPresentationPlaylist,
    playlistPlaybarIndex,
    presentationPlaylistIndex,
    presentationPlaylists,
    handlePlaylistClipSelect,
    findEventAcrossBatch,
    project.id,
    batchMode,
    setActivePlaylistId,
    setTool,
    syncFreezeFrameStateOnClipSeek,
    videoRef,
    pendingSeekTimeRef,
    pendingPlayRef,
    setCurrentTime,
    lastTimeRef,
    setIsPlaying,
  ]);

  const handleSeekPresentationClip = useCallback(
    (seekTime: number) => {
      const activeItem = currentPresentationPlaylist?.events[playlistPlaybarIndex];
      const matchedFF = syncFreezeFrameStateOnClipSeek(seekTime, activeItem, true, isPlaying);
      if (videoRef.current) {
        videoRef.current.currentTime = matchedFF
          ? Math.min(duration || Infinity, matchedFF.timestamp + 0.005)
          : seekTime;
        setCurrentTime(matchedFF ? matchedFF.timestamp : seekTime);
        lastTimeRef.current = matchedFF ? matchedFF.timestamp : seekTime;
      }
    },
    [
      currentPresentationPlaylist,
      playlistPlaybarIndex,
      syncFreezeFrameStateOnClipSeek,
      isPlaying,
      duration,
      videoRef,
      setCurrentTime,
      lastTimeRef,
    ]
  );

  const handleCreateDefaultPlaylist = useCallback(() => {
    const newId = `pl-${Date.now()}`;
    const newEvents: PlaylistItem[] = tagEvents.slice(0, 10).map((te, idx) => ({
      instanceId: `clip-${te.id}-${idx}`,
      eventId: te.id,
      inPoint: te.startTime,
      outPoint: te.endTime,
    }));
    const newPl: Playlist = {
      id: newId,
      name: newEvents.length > 0 ? 'Match Highlights' : 'Presentation Playlist 1',
      events: newEvents,
    };
    setPlaylists((prev) => [...prev, newPl]);
    setActivePlaylistId(newId);
    setPresentationConfig((prev) => {
      const next = {
        ...prev,
        selectedPlaylistIds: [...prev.selectedPlaylistIds, newId],
        orderedPlaylistIds: [...prev.orderedPlaylistIds, newId],
      };
      try {
        localStorage.setItem(`tacstem_presentation_config_${project.id}`, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    showNotification(`Created "${newPl.name}" with ${newEvents.length} clips`, '#c6ff1f');
  }, [tagEvents, project.id, setPlaylists, setActivePlaylistId, showNotification]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      )
        return;

      if (e.key === 'Escape' && isPresentationMode) {
        e.preventDefault();
        if (showPresentationCustomizeModal) {
          setShowPresentationCustomizeModal(false);
        } else {
          handleExitPresentationMode();
        }
      } else if (e.key === ' ' && isPresentationMode && !showPresentationCustomizeModal) {
        e.preventDefault();
        if (videoRef.current) {
          if (videoRef.current.paused) {
            videoRef.current.play().catch((err) => console.log(err));
            setIsPlaying(true);
          } else {
            videoRef.current.pause();
            setIsPlaying(false);
          }
        }
      } else if (e.key === 'ArrowLeft' && isPresentationMode && !showPresentationCustomizeModal) {
        e.preventDefault();
        handlePrevPresentationClip();
      } else if (e.key === 'ArrowRight' && isPresentationMode && !showPresentationCustomizeModal) {
        e.preventDefault();
        handleNextPresentationClip();
      } else if ((e.key === 'p' || e.key === 'P') && e.shiftKey) {
        e.preventDefault();
        if (!isPresentationMode) {
          handleEnterPresentationMode();
        } else {
          handleExitPresentationMode();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isPresentationMode,
    showPresentationCustomizeModal,
    handlePrevPresentationClip,
    handleNextPresentationClip,
    handleEnterPresentationMode,
    handleExitPresentationMode,
    videoRef,
    setIsPlaying,
  ]);

  const savePlaylist = () => {
    if (!playlistModal) return;
    let nextPlaylists: Playlist[] = [];
    if (playlistModal.mode === 'create') {
      const newId = Date.now().toString();
      nextPlaylists = [
        ...playlists,
        { id: newId, name: playlistModal.tempName || 'New Playlist', events: [] },
      ];
      setPlaylists(nextPlaylists);
      setActivePlaylistId(newId);
    } else if (playlistModal.mode === 'edit' && playlistModal.playlistId) {
      nextPlaylists = playlists.map((p) =>
        p.id === playlistModal.playlistId ? { ...p, name: playlistModal.tempName } : p
      );
      setPlaylists(nextPlaylists);
    }
    if (nextPlaylists.length > 0) {
      syncPlaylistsToStorage(nextPlaylists);
    }
    setPlaylistModal(null);
  };

  const confirmDeletePlaylist = () => {
    if (playlistDeleteId) {
      const next = playlists.filter((p) => p.id !== playlistDeleteId);
      setPlaylists(next);
      if (activePlaylistId === playlistDeleteId) {
        setActivePlaylistId(next[0]?.id || '');
      }
      syncPlaylistsToStorage(next);
      setPlaylistDeleteId(null);
    }
  };

  const removeEventFromPlaylist = (playlistId: string, eventIndex: number) => {
    const previousPlaylists = playlists;
    const previousPlaybarIdx = playlistPlaybarIndex;
    let newLength = 0;

    const next = playlists.map((p) => {
      if (p.id === playlistId) {
        const newEvents = [...p.events];
        newEvents.splice(eventIndex, 1);
        newLength = newEvents.length;
        return { ...p, events: newEvents };
      }
      return p;
    });

    setPlaylists(next);
    syncPlaylistsToStorage(next);

    if (playlistId === activePlaylistId) {
      setPlaylistPlaybarIndex((prev) => {
        if (newLength === 0) return 0;
        if (eventIndex < prev) return Math.max(0, prev - 1);
        return Math.min(prev, newLength - 1);
      });
    }

    setAutoplay((prev) => {
      if (!prev.active || prev.playlistId !== playlistId) return prev;
      if (newLength === 0) return { active: false, playlistId: null, eventIndex: -1 };
      if (eventIndex < prev.eventIndex) {
        return { ...prev, eventIndex: Math.max(0, prev.eventIndex - 1) };
      }
      return { ...prev, eventIndex: Math.min(prev.eventIndex, newLength - 1) };
    });

    showNotification('Removed clip from playlist', '#ef4444', () => {
      setPlaylists(previousPlaylists);
      syncPlaylistsToStorage(previousPlaylists);
      if (playlistId === activePlaylistId) {
        setPlaylistPlaybarIndex(previousPlaybarIdx);
      }
    });
  };

  const duplicatePlaylistEvent = (
    playlistId: string,
    eventIndex: number,
    options?: { cleanSlate?: boolean; isolate?: boolean }
  ) => {
    let playlistName = '';
    const isCleanSlate = Boolean(options?.cleanSlate);
    const shouldIsolate = options?.isolate !== false;

    const next = playlists.map((p) => {
      if (p.id === playlistId) {
        const newEvents = [...p.events];
        const item = newEvents[eventIndex];
        if (item) {
          const eventId = getClipEventId(item);
          const masterEvent = tagEvents.find((e) => e.id === eventId);
          const timing = resolveClipTiming(item, masterEvent);
          const existingDeactivated =
            typeof item === 'object' && Array.isArray(item.deactivatedFreezeFrameIds)
              ? [...item.deactivatedFreezeFrameIds]
              : [];

          // Find all candidate freeze frames situated in this clip's time range
          const inRangeFfs = freezeFrames.filter(
            (f) => f.timestamp >= timing.startTime - 0.05 && f.timestamp <= timing.endTime + 0.05
          );

          let targetDeactivated = existingDeactivated;
          let targetEnabled: string[] = [];

          if (isCleanSlate) {
            targetDeactivated = Array.from(new Set([...existingDeactivated, ...inRangeFfs.map((f) => f.id)]));
            targetEnabled = [];
          } else {
            // Keep all active freeze frames from the first clip turned ON in the duplicate!
            const activeFfsInOriginal = inRangeFfs.filter((ff) =>
              isFreezeFrameActiveForClip(ff, item, eventIndex)
            );
            targetEnabled = activeFfsInOriginal.map((ff) => ff.id);
            targetDeactivated = [...existingDeactivated];
          }

          // Mark original item as isolated if requested
          if (shouldIsolate && typeof item === 'object') {
            newEvents[eventIndex] = {
              ...item,
              isolatedFreezeFrames: true,
            };
          }

          const clonedInstanceId = `${eventId}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
          const cloned: PlaylistClip =
            typeof item === 'object'
              ? {
                  ...item,
                  instanceId: clonedInstanceId,
                  deactivatedFreezeFrameIds: targetDeactivated,
                  enabledFreezeFrameIds: targetEnabled,
                  isolatedFreezeFrames: shouldIsolate ? true : item.isolatedFreezeFrames,
                }
              : {
                  instanceId: clonedInstanceId,
                  eventId: item,
                  deactivatedFreezeFrameIds: targetDeactivated,
                  enabledFreezeFrameIds: targetEnabled,
                  isolatedFreezeFrames: shouldIsolate ? true : undefined,
                };

          // Duplicated clip appears directly down to it in the playlist order
          newEvents.splice(eventIndex + 1, 0, cloned);
          playlistName = p.name;
          return { ...p, events: newEvents };
        }
      }
      return p;
    });
    setPlaylists(next);
    syncPlaylistsToStorage(next);

    if (playlistId === activePlaylistId && eventIndex < playlistPlaybarIndex) {
      setPlaylistPlaybarIndex((prev) => prev + 1);
    }
    setAutoplay((prev) => {
      if (!prev.active || prev.playlistId !== playlistId) return prev;
      if (eventIndex < prev.eventIndex) {
        return { ...prev, eventIndex: prev.eventIndex + 1 };
      }
      return prev;
    });

    if (isCleanSlate) {
      showNotification(
        `Duplicated Clip #${eventIndex + 1} with fresh annotations (all previous frames turned OFF)`,
        '#c6ff1f'
      );
    } else {
      showNotification(
        `Duplicated Clip #${eventIndex + 1} (frames from first clip turned ON)`,
        '#c6ff1f'
      );
    }
  };

  const handleIsolateClipFreezeFrames = (playlistId: string, clipIndex: number) => {
    const { updatedPlaylists, affectedSisterClipsCount } = isolateClipFreezeFramesInPlaylist(
      playlists,
      playlistId,
      clipIndex,
      freezeFrames,
      tagEvents
    );
    setPlaylists(updatedPlaylists);
    syncPlaylistsToStorage(updatedPlaylists);
    if (affectedSisterClipsCount > 0) {
      showNotification(
        `Isolated Clip #${clipIndex + 1}: separated freeze frames from ${affectedSisterClipsCount} duplicate clip(s)`,
        '#c6ff1f'
      );
    } else {
      showNotification(`Clip #${clipIndex + 1} freeze frames isolated`, '#c6ff1f');
    }
  };

  const handleToggleClipFreezeFrameIsolation = (playlistId: string, clipIndex: number) => {
    const next = playlists.map((p) => {
      if (p.id !== playlistId) return p;
      const newEvents = [...p.events];
      const item = newEvents[clipIndex];
      if (!item) return p;
      newEvents[clipIndex] = toggleClipFreezeFrameIsolation(item, clipIndex);
      return { ...p, events: newEvents };
    });
    setPlaylists(next);
    syncPlaylistsToStorage(next);
    const updatedItem = next.find((p) => p.id === playlistId)?.events[clipIndex] as any;
    const isNowIsolated = Boolean(updatedItem?.isolatedFreezeFrames);
    showNotification(
      isNowIsolated
        ? `Clip #${clipIndex + 1} isolated: frames from other clips won't leak here`
        : `Clip #${clipIndex + 1} un-isolated (linked to match timeline)`,
      '#c6ff1f'
    );
  };

  const handleFreezeFrameAddedInClip = (newFF: FreezeFrame, activeClip: PlaylistItem) => {
    const activeClipIndex = playlistPlaybarIndex;
    const { updatedPlaylists, affectedCount } = deactivateFreezeFrameInOtherPlaylistClips(
      playlists,
      activePlaylistId,
      activeClipIndex,
      newFF.id,
      newFF.timestamp,
      tagEvents
    );
    if (affectedCount > 0) {
      setPlaylists(updatedPlaylists);
      syncPlaylistsToStorage(updatedPlaylists);
      showNotification(
        `Added ${newFF.name} to Clip #${activeClipIndex + 1} (excluded from ${affectedCount} duplicate clip${affectedCount > 1 ? 's' : ''})`,
        '#c6ff1f'
      );
    } else {
      showNotification(`Added ${newFF.name} (Shift+F)`, '#c6ff1f');
    }
  };

  const handleToggleClipFreezeFrameDeactivation = (
    playlistId: string,
    clipIndex: number,
    freezeFrameId: string
  ) => {
    let wasDeactivated = false;
    const targetFF = freezeFrames.find(f => f.id === freezeFrameId);
    const next = playlists.map((p) => {
      if (p.id !== playlistId) return p;
      const newEvents = [...p.events];
      const item = newEvents[clipIndex];
      if (!item) return p;

      const updated = toggleClipFreezeFrameDeactivation(item, freezeFrameId, freezeFrames, clipIndex);
      wasDeactivated = targetFF
        ? !isFreezeFrameActiveForClip(targetFF, updated, clipIndex)
        : Boolean(updated.deactivatedFreezeFrameIds?.includes(freezeFrameId));
      newEvents[clipIndex] = updated;
      return { ...p, events: newEvents };
    });
    setPlaylists(next);
    syncPlaylistsToStorage(next);

    if (
      wasDeactivated &&
      playlistId === activePlaylistId &&
      clipIndex === playlistPlaybarIndex &&
      activeFreezeFrameId === freezeFrameId
    ) {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
        countdownInterval.current = null;
      }
      setActiveFreezeFrameId(null);
      setIsFreezeFramePlaying(false);
      setCountdownValue(0);
    }
  };

  const handleSetClipAllFreezeFramesDeactivation = (
    playlistId: string,
    clipIndex: number,
    freezeFrameIds: string[],
    deactivate: boolean
  ) => {
    const next = playlists.map((p) => {
      if (p.id !== playlistId) return p;
      const newEvents = [...p.events];
      const item = newEvents[clipIndex];
      if (!item) return p;

      const updated = setClipAllFreezeFramesDeactivation(item, freezeFrameIds, deactivate, clipIndex);
      newEvents[clipIndex] = updated;
      return { ...p, events: newEvents };
    });
    setPlaylists(next);
    syncPlaylistsToStorage(next);

    if (
      deactivate &&
      playlistId === activePlaylistId &&
      clipIndex === playlistPlaybarIndex &&
      activeFreezeFrameId &&
      freezeFrameIds.includes(activeFreezeFrameId)
    ) {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
        countdownInterval.current = null;
      }
      setActiveFreezeFrameId(null);
      setIsFreezeFramePlaying(false);
      setCountdownValue(0);
    }
  };

  const handleUpdatePlaylistClipTrim = (
    playlistId: string,
    clipIndex: number,
    newStart: number,
    newEnd: number
  ) => {
    const next = playlists.map((p) => {
      if (p.id === playlistId) {
        const newEvents = [...p.events];
        const currentItem = newEvents[clipIndex];
        if (currentItem) {
          newEvents[clipIndex] = updateClipTrim(currentItem, newStart, newEnd);
          return { ...p, events: newEvents };
        }
      }
      return p;
    });
    setPlaylists(next);
    syncPlaylistsToStorage(next);
    showNotification('Trimmed clip for playlist (master event unaffected)', '#c6ff1f');
  };

  const handleResetPlaylistClipTrim = (playlistId: string, clipIndex: number) => {
    const next = playlists.map((p) => {
      if (p.id === playlistId) {
        const newEvents = [...p.events];
        const currentItem = newEvents[clipIndex];
        if (currentItem) {
          newEvents[clipIndex] = resetClipTrim(currentItem);
          return { ...p, events: newEvents };
        }
      }
      return p;
    });
    setPlaylists(next);
    syncPlaylistsToStorage(next);
    showNotification('Reset clip to original master event duration', '#c6ff1f');
  };

  const reorderPlaylistEvents = (playlistId: string, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    const mapMovedIndex = (currentIdx: number, maxLen: number): number => {
      const clampedTo = Math.max(0, Math.min(maxLen - 1, toIndex));
      if (currentIdx === fromIndex) return clampedTo;
      if (fromIndex < currentIdx && clampedTo >= currentIdx) return currentIdx - 1;
      if (fromIndex > currentIdx && clampedTo <= currentIdx) return currentIdx + 1;
      return currentIdx;
    };

    let targetLen = 0;
    const next = playlists.map((p) => {
      if (p.id === playlistId) {
        const newEvents = [...p.events];
        targetLen = newEvents.length;
        if (fromIndex < 0 || fromIndex >= targetLen) return p;
        const clampedTo = Math.max(0, Math.min(targetLen - 1, toIndex));
        const [moved] = newEvents.splice(fromIndex, 1);
        newEvents.splice(clampedTo, 0, moved);
        return { ...p, events: newEvents };
      }
      return p;
    });

    if (targetLen === 0) return;

    setPlaylists(next);
    syncPlaylistsToStorage(next);

    if (playlistId === activePlaylistId) {
      setPlaylistPlaybarIndex((prev) => mapMovedIndex(prev, targetLen));
    }

    setAutoplay((prev) => {
      if (!prev.active || prev.playlistId !== playlistId) return prev;
      return {
        ...prev,
        eventIndex: mapMovedIndex(prev.eventIndex, targetLen),
      };
    });
  };

  const startRecordExport = async (
    playlistId?: string,
    options?: { withFreezeFrames?: boolean; customFileName?: string }
  ) => {
    const targetPlaylistId = playlistId || activePlaylistId;
    const playlist = playlists.find((p) => p.id === targetPlaylistId);
    if (!playlist || playlist.events.length === 0) {
      showNotification('No clips found in playlist to record export.', '#ef4444');
      return;
    }

    const withFreezeFrames = options?.withFreezeFrames !== undefined ? options.withFreezeFrames : true;
    const cleanName = (options?.customFileName || playlist.name || `${project.name}-playlist`)
      .replace(/[^\w\s-]/gi, '')
      .trim();
    recordingCustomNameRef.current = cleanName || 'playlist-record-export';

    if (isScreenRecording) {
      stopRecording();
    }
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
      setIsPlaying(false);
    }

    exportSettingsRef.current = {
      active: true,
      playlistId: targetPlaylistId,
      withFreezeFrames,
      customFileName: cleanName,
    };

    const firstItem = playlist.events[0];
    const { event: firstEvent, project: firstProj } = findEventAcrossBatch(
      getClipEventId(firstItem),
      firstItem
    );
    const firstTiming = resolveClipTiming(firstItem, firstEvent);
    const isSameProject = !firstProj || firstProj.id === project.id || !batchMode;

    setTool(null);
    syncFreezeFrameStateOnClipSeek(firstTiming.startTime, firstItem, isSameProject, true);

    setPlaylistPlaybarIndex(0);
    setShowPlaylistPlaybar(true);
    setAutoplay({ active: true, playlistId: targetPlaylistId, eventIndex: 0 });

    if (!isSameProject && firstProj && batchMode) {
      pendingSeekTimeRef.current = firstTiming.startTime;
      pendingPlayRef.current = false;
      batchMode.onSelectProject(firstProj.id);
    } else if (videoRef.current) {
      videoRef.current.currentTime = firstTiming.startTime;
      setCurrentTime(firstTiming.startTime);
      lastTimeRef.current = firstTiming.startTime;
    }

    showNotification(
      `🔴 Initializing Record Export for "${playlist.name}" from ${formatTime(firstTiming.startTime)}...`,
      '#c6ff1f'
    );

    setTimeout(async () => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
        try {
          await toggleScreenRecording();
        } catch (e) {
          console.error('Export recorder start error', e);
          showNotification('Failed to start canvas recorder', '#ef4444');
          exportSettingsRef.current = { active: false, playlistId: null, withFreezeFrames: true };
          return;
        }
      }
      if (videoRef.current) {
        videoRef.current.currentTime = firstTiming.startTime;
        setCurrentTime(firstTiming.startTime);
        videoRef.current.play().catch((e) => console.log('Record export playback play error:', e));
        setIsPlaying(true);
      }
      showNotification(
        `🔴 Record Export running: recording "${playlist.name}" to end... (Auto-stops on finish)`,
        '#c6ff1f'
      );
    }, 400);
  };

  const exportPrepRequestIdRef = useRef(0);

  const exportPlaylistVideo = async (playlistId: string, withFreezeFrames: boolean) => {
    const playlist = playlists.find((p) => p.id === playlistId);
    if (!playlist || playlist.events.length === 0) {
      showNotification('Playlist is empty. Add clips before exporting.', '#ef4444');
      return;
    }

    const requestId = ++exportPrepRequestIdRef.current;

    // Build an up-to-date snapshot of the active project using live Workspace state
    // so newly logged events, drawings, and freeze frames are never missed due to debounced autosave.
    const liveCurrentProject: Project = {
      ...project,
      data: {
        ...project.data,
        shapes,
        freezeFrames,
        tags,
        labels,
        tagEvents,
        playlists,
        maskSettings,
      },
    };

    const liveBatchProjects = batchMode?.allBatchProjects
      ? batchMode.allBatchProjects.map((p) => (p.id === project.id ? liveCurrentProject : p))
      : [liveCurrentProject];

    const videoElSrc = videoRef.current?.currentSrc || videoRef.current?.src || '';
    const effectiveBlobUrl =
      videoUrl && !videoUrl.startsWith('live')
        ? videoUrl
        : videoElSrc.startsWith('blob:')
        ? videoElSrc
        : '';

    const buildParams = {
      playlist,
      currentProject: liveCurrentProject,
      allBatchProjects: liveBatchProjects,
      projectBlobs: batchMode?.projectBlobs,
      currentBlobUrl: effectiveBlobUrl,
      maskSettings,
      deferShapeSanitization: true,
      options: {
        resolution: 'original' as const,
        mode: 'auto' as const,
        withFreezeFrames: true,
        preserveAudio: true,
        maskSettings,
      },
    };

    // 1. Instant 0ms synchronous open! If all project Files are already in the session cache,
    // the modal opens immediately in its ready state without waiting on OPFS/IndexedDB.
    const { clips: syncClips, allFilesResolvedSync } = buildPlaylistPreviewItemsSync(buildParams);

    setExportModalState({
      isOpen: true,
      isPreparing: !allFilesResolvedSync,
      playlistId,
      title: playlist.name || 'Playlist Export',
      clips: syncClips,
      defaultWithFreezeFrames: withFreezeFrames,
      defaultMaskSettings: maskSettings,
      missingProjectNames: undefined,
      initError:
        syncClips.length === 0
          ? 'No exportable video clips could be resolved. Ensure a match video is linked to this project.'
          : undefined,
    });

    if (allFilesResolvedSync || syncClips.length === 0) {
      return;
    }

    // 2. Cold path (e.g. uncached multi-game batch project): resolve storage handles in background
    // while the modal is already open and interactive.
    try {
      const { clips, missingProjectNames } = await buildPlaylistExportItems(buildParams);
      if (exportPrepRequestIdRef.current !== requestId) return;

      if (missingProjectNames.length > 0) {
        showNotification(`Missing video file for: ${missingProjectNames.join(', ')}`, '#ff9900');
      }

      setExportModalState((prev) => {
        if (!prev.isOpen) return prev;
        return {
          ...prev,
          isPreparing: false,
          clips,
          missingProjectNames: missingProjectNames.length > 0 ? missingProjectNames : undefined,
          initError:
            clips.length === 0 && missingProjectNames.length === 0
              ? 'No exportable video clips could be resolved. Ensure a match video is linked to this project.'
              : undefined,
        };
      });
    } catch (err: any) {
      if (exportPrepRequestIdRef.current !== requestId) return;
      console.error('Failed to prepare playlist export items:', err);
      setExportModalState((prev) => {
        if (!prev.isOpen) return prev;
        return {
          ...prev,
          isPreparing: false,
          clips: [],
          initError: err?.message || 'Failed to prepare clips for direct MP4 export.',
        };
      });
    }
  };

  const startPlaylistAutoplay = (playlistId: string) => {
    const playlist = playlists.find((p) => p.id === playlistId);
    if (playlist && playlist.events.length > 0) {
      setShowPlaylistPlaybar(true);
      handlePlaylistClipSelect(0, undefined, true);
    }
  };

  const addEventsToPlaylist = useCallback(
    (eventIds: string[], targetPlaylistId?: string, forceAllowDuplicates: boolean = false) => {
      if (!eventIds || eventIds.length === 0) {
        showNotification('No events selected to add to playlist', '#f59e0b');
        return;
      }

      let plId = targetPlaylistId || activePlaylistId;
      let target = playlists.find((p) => p.id === plId);

      if (!target && playlists.length > 0) {
        target = playlists[0];
        plId = target.id;
        setActivePlaylistId(plId);
      }

      if (!target) {
        const newId = Date.now().toString();
        target = { id: newId, name: 'Highlights', events: [] };
        plId = newId;
        setPlaylists([target]);
        setActivePlaylistId(newId);
      }

      const playlistName = target.name;
      let addedCount = 0;
      let skippedDuplicatesCount = 0;

      const formatClipItem = (eventId: string): PlaylistItem => {
        const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        const evt = tagEvents.find((e) => e.id === eventId);
        return {
          instanceId: `clip-${eventId}-${uniqueSuffix}`,
          eventId,
          projectId: project.id,
          projectName: project.name,
          inPoint: evt?.startTime,
          outPoint: evt?.endTime,
          notes: evt?.notes,
        };
      };

      const exists = playlists.some((p) => p.id === plId);
      const baseList = exists ? playlists : [...playlists, target];
      const nextPlaylists = baseList.map((p) => {
        if (p.id === plId) {
          if (forceAllowDuplicates) {
            addedCount = eventIds.length;
            const newClips = eventIds.map(formatClipItem);
            return { ...p, events: [...p.events, ...newClips] };
          } else {
            const currentSet = new Set(p.events.map((item) => getClipEventId(item)));
            const newUniqueEvents = eventIds.filter((id) => !currentSet.has(id));
            addedCount = newUniqueEvents.length;
            skippedDuplicatesCount = eventIds.length - newUniqueEvents.length;
            if (newUniqueEvents.length === 0) {
              return p;
            }
            const newUniqueClips = newUniqueEvents.map(formatClipItem);
            return { ...p, events: [...p.events, ...newUniqueClips] };
          }
        }
        return p;
      });

      setPlaylists(nextPlaylists);
      syncPlaylistsToStorage(nextPlaylists);

      if (forceAllowDuplicates) {
        showNotification(
          `Added ${eventIds.length} event${eventIds.length > 1 ? 's' : ''} (including duplicates) to "${playlistName}"`,
          '#c6ff1f'
        );
      } else if (addedCount > 0 && skippedDuplicatesCount === 0) {
        showNotification(
          `Added ${addedCount} event${addedCount > 1 ? 's' : ''} to "${playlistName}"`,
          '#c6ff1f'
        );
      } else if (addedCount > 0 && skippedDuplicatesCount > 0) {
        showNotification(
          `Added ${addedCount} event${addedCount > 1 ? 's' : ''} (${skippedDuplicatesCount} duplicate${skippedDuplicatesCount > 1 ? 's' : ''} skipped)`,
          '#c6ff1f',
          undefined,
          {
            label: `+ Add ${skippedDuplicatesCount > 1 ? `${skippedDuplicatesCount} Duplicates` : 'Duplicate'}`,
            onClick: () => addEventsToPlaylist(eventIds, plId, true),
          }
        );
      } else {
        showNotification(
          `Selected event${eventIds.length > 1 ? 's are' : ' is'} already in "${playlistName}"`,
          '#3b82f6',
          undefined,
          {
            label: eventIds.length > 1 ? 'Add Duplicates Anyway' : 'Add Duplicate Anyway',
            onClick: () => addEventsToPlaylist(eventIds, plId, true),
          }
        );
      }

      const btn = document.getElementById('save-playlist-btn');
      if (btn) {
        btn.classList.add('bg-green-500');
        setTimeout(() => btn.classList.remove('bg-green-500'), 500);
      }
    },
    [
      playlists,
      activePlaylistId,
      tagEvents,
      project.id,
      project.name,
      setPlaylists,
      setActivePlaylistId,
      syncPlaylistsToStorage,
      showNotification,
    ]
  );

  const addSelectedToPlaylist = useCallback(
    (targetPlaylistId?: string, forceAllowDuplicates: boolean = false) => {
      let ids: string[] = [];
      if (selectedEventIds.size > 0) {
        ids = Array.from(selectedEventIds);
      } else if (selectedEventLogs.size > 0) {
        ids = Array.from(selectedEventLogs);
      } else if (playbarEventId) {
        ids = [playbarEventId];
      } else {
        const currentEvt = tagEvents.find((e) => currentTime >= e.startTime && currentTime <= e.endTime);
        if (currentEvt) {
          ids = [currentEvt.id];
        }
      }

      if (ids.length === 0) {
        showNotification(
          'No events selected. Click an event on the timeline or in the Events tab to select it.',
          '#f59e0b'
        );
        return;
      }

      addEventsToPlaylist(ids, targetPlaylistId, forceAllowDuplicates);

      // Clear selection and close the selection popup / trimmer once added to playlist
      setSelectedEventIds(new Set());
      setSelectedEventLogs(new Set());
      setPlaybarEventId?.(null);
      setIsMultiSelectAction?.(false);
      setIsEventsEditMode?.(false);
    },
    [
      selectedEventIds,
      selectedEventLogs,
      playbarEventId,
      tagEvents,
      currentTime,
      setSelectedEventIds,
      setSelectedEventLogs,
      setPlaybarEventId,
      setIsMultiSelectAction,
      setIsEventsEditMode,
      showNotification,
      addEventsToPlaylist,
    ]
  );

  return {
    playlistModal,
    setPlaylistModal,
    playlistDeleteId,
    setPlaylistDeleteId,
    autoplay,
    setAutoplay,
    draggingEventIndex,
    setDraggingEventIndex,
    showPlaylistPlaybar,
    setShowPlaylistPlaybar,
    playlistPlaybarIndex,
    setPlaylistPlaybarIndex,
    isPresentationMode,
    setIsPresentationMode,
    showPresentationCustomizeModal,
    setShowPresentationCustomizeModal,
    presentationPlaylistIndex,
    setPresentationPlaylistIndex,
    presentationFinished,
    setPresentationFinished,
    presentationTransitionMsg,
    setPresentationTransitionMsg,
    presentationConfig,
    setPresentationConfig,
    allBatchTagEvents,
    allBatchTags,
    allBatchLabels,
    findEventAcrossBatch,
    handlePlaylistClipSelect,
    presentationPlaylists,
    currentPresentationPlaylist,
    currentPresentationEvent,
    currentPresentationTiming,
    isPresentationModeRef,
    presentationPlaylistsRef,
    presentationConfigRef,
    presentationPlaylistIndexRef,
    handleEnterPresentationMode,
    handleExitPresentationMode,
    handleSelectPresentationPlaylistIndex,
    handleNextPresentationClip,
    handlePrevPresentationClip,
    handleSeekPresentationClip,
    handleCreateDefaultPlaylist,
    savePlaylist,
    confirmDeletePlaylist,
    removeEventFromPlaylist,
    duplicatePlaylistEvent,
    handleIsolateClipFreezeFrames,
    handleToggleClipFreezeFrameIsolation,
    handleFreezeFrameAddedInClip,
    handleToggleClipFreezeFrameDeactivation,
    handleSetClipAllFreezeFramesDeactivation,
    handleUpdatePlaylistClipTrim,
    handleResetPlaylistClipTrim,
    reorderPlaylistEvents,
    startRecordExport,
    exportPlaylistVideo,
    startPlaylistAutoplay,
    addEventsToPlaylist,
    addSelectedToPlaylist,
  };
}
