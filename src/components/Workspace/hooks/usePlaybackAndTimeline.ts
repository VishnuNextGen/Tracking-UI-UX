import { useState, useRef, useEffect, useCallback } from 'react';
import type React from 'react';
import type {
  ActiveRecording,
  FreezeFrame,
  MaskSettings,
  PeriodSync,
  Playlist,
  PlaylistItem,
  Project,
  ProjectData,
  TagEvent,
  TimelineMarker,
} from '../../../types';
import { getClipEventId, resolveClipTiming, isFreezeFrameActiveForClip } from '../../../utils/playlistUtils';
import { prepareLivePeriodSyncsForVideo } from '../../../utils/periodSyncUtils';
import { useLiveClock } from '../LiveCoding';
import type { PresentationConfig } from '../Presentation';
import type {
  AutoplayState,
  MarkerModalState,
  TimelineMarqueeState,
  WorkspaceBatchModeProps,
} from '../Workspace.types';

export function usePlaybackAndTimeline(params: {
  project: Project;
  videoUrl: string;
  isLive: boolean;
  batchMode?: WorkspaceBatchModeProps;
  onUpdateProject: (data: ProjectData, targetId?: string) => void;
  onRelinkVideo?: (project: Project, isNewVideo: boolean) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  timelineContainerRef: React.RefObject<HTMLDivElement | null>;
  expandedTimelineContainerRef: React.RefObject<HTMLDivElement | null>;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  currentTime: number;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  duration: number;
  setDuration: React.Dispatch<React.SetStateAction<number>>;
  isScrubbing: boolean;
  setIsScrubbing: React.Dispatch<React.SetStateAction<boolean>>;
  isScrubbingRef: React.MutableRefObject<boolean>;
  scrubTargetTimeRef: React.MutableRefObject<number | null>;
  pendingScrubVideoTimeRef: React.MutableRefObject<number | null>;
  lastTimeRef: React.MutableRefObject<number>;
  pendingSeekTimeRef: React.MutableRefObject<number | null>;
  pendingPlayRef: React.MutableRefObject<boolean>;
  prevProjectIdRef: React.MutableRefObject<string>;
  latestProjectDataRef: React.MutableRefObject<ProjectData>;
  liveClockBridgeRef: React.MutableRefObject<{
    matchPeriod: string | null;
    getMatchTimeSec: () => number;
  } | null>;
  setIsTimerPoppedOut: React.Dispatch<React.SetStateAction<boolean>>;
  freezeFrames: FreezeFrame[];
  activeFreezeFrameId: string | null;
  setActiveFreezeFrameId: React.Dispatch<React.SetStateAction<string | null>>;
  isFreezeFramePlaying: boolean;
  setIsFreezeFramePlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setCountdownValue: React.Dispatch<React.SetStateAction<number>>;
  countdownInterval: React.MutableRefObject<number | null>;
  triggeredFreezeFrames: React.MutableRefObject<Set<string>>;
  editingAnimationFFId: string | null;
  setEditingAnimationFFId: React.Dispatch<React.SetStateAction<string | null>>;
  setIsAnimationPreviewPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  toggleFreezeFramePlay: (targetFFId?: string) => void;
  skipFreezeFrame: () => void;
  maskSettings: MaskSettings;
  clearMaskCache: () => void;
  computeMaskingLayers: () => void;
  playlists: Playlist[];
  activePlaylistId: string;
  setActivePlaylistId: React.Dispatch<React.SetStateAction<string>>;
  autoplay: AutoplayState;
  setAutoplay: React.Dispatch<React.SetStateAction<AutoplayState>>;
  showPlaylistPlaybar: boolean;
  playlistPlaybarIndex: number;
  setPlaylistPlaybarIndex: React.Dispatch<React.SetStateAction<number>>;
  findEventAcrossBatch: (
    eventId: string,
    item?: PlaylistItem
  ) => { event: TagEvent | undefined; project: Project | undefined };
  handlePlaylistClipSelect: (clipIndex: number, targetVideoTime?: number, autoPlay?: boolean) => void;
  isPresentationModeRef: React.MutableRefObject<boolean>;
  presentationPlaylistsRef: React.MutableRefObject<Playlist[]>;
  presentationConfigRef: React.MutableRefObject<PresentationConfig>;
  setPresentationPlaylistIndex: React.Dispatch<React.SetStateAction<number>>;
  setPresentationTransitionMsg: React.Dispatch<React.SetStateAction<string | null>>;
  setPresentationFinished: React.Dispatch<React.SetStateAction<boolean>>;
  exportSettingsRef: React.MutableRefObject<{
    active: boolean;
    playlistId: string | null;
    withFreezeFrames: boolean;
    customFileName?: string;
  }>;
  stopRecording: () => void;
  tagEvents: TagEvent[];
  setTagEvents: React.Dispatch<React.SetStateAction<TagEvent[]>>;
  activeRecordings: ActiveRecording[];
  setActiveRecordings: React.Dispatch<React.SetStateAction<ActiveRecording[]>>;
  filterTagId: string | null;
  filterLabelId: string | null;
  selectedEventIds: Set<string>;
  setSelectedEventIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelectedEventLogs: React.Dispatch<React.SetStateAction<Set<string>>>;
  playbarEventId: string | null;
  setPlaybarEventId: React.Dispatch<React.SetStateAction<string | null>>;
  isMultiSelectAction: boolean;
  setIsMultiSelectAction: React.Dispatch<React.SetStateAction<boolean>>;
  getFilteredEvents: () => TagEvent[];
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
    isLive,
    batchMode,
    onUpdateProject,
    onRelinkVideo,
    videoRef,
    timelineContainerRef,
    expandedTimelineContainerRef,
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    isScrubbing,
    setIsScrubbing,
    isScrubbingRef,
    scrubTargetTimeRef,
    pendingScrubVideoTimeRef,
    lastTimeRef,
    pendingSeekTimeRef,
    pendingPlayRef,
    prevProjectIdRef,
    latestProjectDataRef,
    liveClockBridgeRef,
    setIsTimerPoppedOut,
    freezeFrames,
    activeFreezeFrameId,
    setActiveFreezeFrameId,
    isFreezeFramePlaying,
    setIsFreezeFramePlaying,
    setCountdownValue,
    countdownInterval,
    triggeredFreezeFrames,
    editingAnimationFFId,
    setEditingAnimationFFId,
    setIsAnimationPreviewPlaying,
    toggleFreezeFramePlay,
    skipFreezeFrame,
    maskSettings,
    clearMaskCache,
    computeMaskingLayers,
    playlists,
    activePlaylistId,
    setActivePlaylistId,
    autoplay,
    setAutoplay,
    showPlaylistPlaybar,
    playlistPlaybarIndex,
    setPlaylistPlaybarIndex,
    findEventAcrossBatch,
    handlePlaylistClipSelect,
    isPresentationModeRef,
    presentationPlaylistsRef,
    presentationConfigRef,
    setPresentationPlaylistIndex,
    setPresentationTransitionMsg,
    setPresentationFinished,
    exportSettingsRef,
    stopRecording,
    tagEvents,
    setTagEvents,
    activeRecordings,
    setActiveRecordings,
    filterTagId,
    filterLabelId,
    selectedEventIds,
    setSelectedEventIds,
    setSelectedEventLogs,
    playbarEventId,
    setPlaybarEventId,
    isMultiSelectAction,
    setIsMultiSelectAction,
    getFilteredEvents,
    showNotification,
  } = params;

  const [isVideoBuffering, setIsVideoBuffering] = useState(false);
  const [loadElapsedSec, setLoadElapsedSec] = useState(0);

  useEffect(() => {
    if (duration > 0 || isLive) {
      setLoadElapsedSec(0);
      return;
    }
    const timer = setInterval(() => {
      setLoadElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [duration, isLive]);

  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(true);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);
  const [showTimelineFiltersMenu, setShowTimelineFiltersMenu] = useState(false);
  const [showTimelineFreezeFrames, setShowTimelineFreezeFrames] = useState(true);
  const [showTimelineTags, setShowTimelineTags] = useState(true);

  const wasPlayingBeforeScrubRef = useRef(false);
  const wasAutoplayBeforeScrubRef = useRef(false);
  const scrubContainerRef = useRef<HTMLDivElement | null>(null);

  const [markers, setMarkers] = useState<TimelineMarker[]>(project.data.markers);
  const [markerModal, setMarkerModal] = useState<MarkerModalState | null>(null);
  const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null);

  const [periodSyncs, setPeriodSyncs] = useState<PeriodSync[]>(project.data.periodSyncs || []);
  const [timelineMarquee, setTimelineMarquee] = useState<TimelineMarqueeState | null>(null);
  const lastClickedEventIdRef = useRef<string | null>(null);
  const playbarEventIdRef = useRef<string | null>(playbarEventId);
  playbarEventIdRef.current = playbarEventId;

  const liveClock = useLiveClock({
    isLive,
    currentTime,
    setCurrentTime,
    periodSyncs,
    setPeriodSyncs,
    initialPeriodId: '1st-half',
    onPeriodChange: (_id, name) => {
      showNotification(`Kick-off: ${name}`, '#c6ff1f');
    },
  });

  liveClockBridgeRef.current = {
    matchPeriod: liveClock.matchPeriod,
    getMatchTimeSec: () => liveClock.getMatchClockDetails().matchTimeSeconds ?? currentTime,
  };

  const prevIsLiveRef = useRef<boolean>(isLive);

  useEffect(() => {
    if (prevIsLiveRef.current && !isLive) {
      liveClock.pauseLiveClock();
      setIsTimerPoppedOut(false);

      const preparedSyncs = prepareLivePeriodSyncsForVideo({
        ...latestProjectDataRef.current,
        periodSyncs:
          project.data.periodSyncs && project.data.periodSyncs.length > 0
            ? project.data.periodSyncs
            : periodSyncs,
        tagEvents,
        markers,
      });

      setPeriodSyncs(preparedSyncs);
      setCurrentTime(0);
      lastTimeRef.current = 0;
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
      }

      showNotification('Match video imported! Sync period kick-offs to align your live events.', '#c6ff1f');
    }
    prevIsLiveRef.current = isLive;
  }, [isLive]);

  useEffect(() => {
    const incomingSyncs = project.data.periodSyncs;
    if (
      project.id === prevProjectIdRef.current &&
      incomingSyncs &&
      incomingSyncs.some((s) => s.needsVideoSync) &&
      !periodSyncs.some((s) => s.needsVideoSync)
    ) {
      setPeriodSyncs(incomingSyncs);
    }
  }, [project.id, project.data.periodSyncs]);

  const handleImportMatchVideo = () => {
    liveClock.pauseLiveClock();

    let finalizedTagEvents = tagEvents;
    if (activeRecordings.length > 0) {
      const liveMatchNow = liveClock.getMatchClockDetails().matchTimeSeconds ?? currentTime;
      const closedEvents: TagEvent[] = [];
      activeRecordings.forEach((rec) => {
        const start = rec.startTime;
        const end = Math.max(start + 1, currentTime);
        const mStart = rec.matchStartTime;
        let mEnd = liveMatchNow;
        if (mStart !== undefined && mEnd !== undefined && mEnd <= mStart) {
          mEnd = mStart + 1;
        }
        closedEvents.push({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          tagId: rec.tagId,
          startTime: start,
          endTime: end,
          labelIds: rec.labelIds || [],
          periodId: rec.periodId || liveClock.matchPeriod || '1st-half',
          matchStart: mStart,
          matchEnd: mEnd,
        });
      });
      finalizedTagEvents = [...tagEvents, ...closedEvents];
      setTagEvents(finalizedTagEvents);
      setActiveRecordings([]);
    }

    const preparedSyncs = prepareLivePeriodSyncsForVideo({
      ...latestProjectDataRef.current,
      tagEvents: finalizedTagEvents,
      periodSyncs,
      markers,
    });

    const freshProjectSnapshot: Project = {
      ...project,
      data: {
        ...latestProjectDataRef.current,
        tagEvents: finalizedTagEvents,
        periodSyncs: preparedSyncs,
        markers,
        liveTime: currentTime,
      },
    };

    if (onRelinkVideo) {
      onRelinkVideo(freshProjectSnapshot, true);
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'video/*';
      input.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          setPeriodSyncs(preparedSyncs);
          onUpdateProject({
            ...freshProjectSnapshot.data,
            periodSyncs: preparedSyncs,
          });
          showNotification(`Video loaded: ${file.name}. Align kick-offs in Period Sync Manager!`, '#c6ff1f');
        }
      };
      input.click();
    }
  };

  useEffect(() => {
    if (isLive) {
      setDuration(Math.max(currentTime + 60, 60));
    }
  }, [currentTime, isLive, setDuration]);

  useEffect(() => {
    if (
      videoRef.current &&
      pendingSeekTimeRef.current !== null &&
      (videoRef.current.currentSrc === videoUrl || videoRef.current.src === videoUrl) &&
      videoRef.current.readyState >= 1
    ) {
      const seekTo = pendingSeekTimeRef.current;
      pendingSeekTimeRef.current = null;
      videoRef.current.currentTime = seekTo;
      setCurrentTime(seekTo);
      if (pendingPlayRef.current || isPlaying || autoplay.active) {
        pendingPlayRef.current = false;
        setIsPlaying(true);
        videoRef.current.play().catch((e) => console.log('Video resume error:', e));
      }
    }
  }, [videoUrl, isPlaying, autoplay.active]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate, videoRef]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted, videoRef]);

  useEffect(() => {
    if (isTimelineExpanded) {
      setTimelineZoom(30);
    } else {
      setTimelineZoom(1);
    }
  }, [isTimelineExpanded]);

  const togglePlay = () => {
    if (isLive) {
      liveClock.toggleLiveClock();
      return;
    }
    if (editingAnimationFFId) {
      setEditingAnimationFFId(null);
      setIsAnimationPreviewPlaying(false);
    }
    const ffAtCurrent = findActiveFreezeFrameNear(currentTime);
    if (activeFreezeFrameId || isFreezeFramePlaying || (ffAtCurrent && !triggeredFreezeFrames.current.has(ffAtCurrent.id))) {
      skipFreezeFrame();
      if (showPlaylistPlaybar) {
        setAutoplay({ active: true, playlistId: activePlaylistId, eventIndex: playlistPlaybarIndex });
      }
      return;
    }
    if (showPlaylistPlaybar) {
      const pl = playlists.find((p) => p.id === activePlaylistId);
      if (pl && pl.events.length > 0) {
        if (isPlaying) {
          videoRef.current?.pause();
          setIsPlaying(false);
          if (autoplay.active) {
            setAutoplay({ active: false, playlistId: null, eventIndex: -1 });
          }
        } else {
          const currentItem = pl.events[playlistPlaybarIndex] || pl.events[0];
          const { event: currentEvent, project: currentProj } = findEventAcrossBatch(
            getClipEventId(currentItem),
            currentItem
          );
          const currentTiming = resolveClipTiming(currentItem, currentEvent);
          if (currentProj && currentProj.id !== project.id && batchMode) {
            handlePlaylistClipSelect(playlistPlaybarIndex, currentTiming.startTime, true);
            return;
          }
          if (videoRef.current) {
            if (
              videoRef.current.currentTime < currentTiming.startTime ||
              videoRef.current.currentTime >= currentTiming.endTime - 0.05
            ) {
              videoRef.current.currentTime = currentTiming.startTime;
            }
            videoRef.current.play().catch((e) => console.log(e));
            setIsPlaying(true);
            setAutoplay({ active: true, playlistId: activePlaylistId, eventIndex: playlistPlaybarIndex });
          }
        }
        return;
      }
    }
    if (
      selectedEventIds.size === 1 &&
      !isMultiSelectAction &&
      playbarEventId === Array.from(selectedEventIds)[0]
    ) {
      const trimmingEvt = tagEvents.find((e) => e.id === playbarEventId);
      if (trimmingEvt && videoRef.current) {
        if (isPlaying) {
          videoRef.current.pause();
          setIsPlaying(false);
        } else {
          if (
            videoRef.current.currentTime < trimmingEvt.startTime ||
            videoRef.current.currentTime >= trimmingEvt.endTime - 0.05
          ) {
            videoRef.current.currentTime = trimmingEvt.startTime;
          }
          videoRef.current.play().catch((e) => console.log(e));
          setIsPlaying(true);
        }
        return;
      }
    }
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        if (autoplay.active) {
          setAutoplay({ active: false, playlistId: null, eventIndex: -1 });
        }
      } else {
        videoRef.current.play().catch((e) => console.log(e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleZoomIn = () => {
    setTimelineZoom((prev) => Math.min(100, prev + 5));
  };

  const handleZoomOut = () => {
    setTimelineZoom((prev) => Math.max(1, prev - 5));
  };

  useEffect(() => {
    if (isScrubbing) return;
    const updateScroll = (container: HTMLDivElement | null) => {
      if (!container) return;
      if (timelineZoom > 1) {
        const scrollWidth = container.scrollWidth;
        const clientWidth = container.clientWidth;
        const progress = currentTime / (duration || 1);
        const center = progress * scrollWidth - clientWidth / 2;
        container.scrollLeft = center;
      } else {
        container.scrollLeft = 0;
      }
    };

    updateScroll(timelineContainerRef.current);
    updateScroll(expandedTimelineContainerRef.current);
  }, [currentTime, timelineZoom, duration, isScrubbing, timelineContainerRef, expandedTimelineContainerRef]);

  const clampSeekTimeForActiveMode = useCallback(
    (time: number) => {
      let targetTime = Math.max(0, duration > 0 ? Math.min(duration, time) : time);
      if (showPlaylistPlaybar) {
        const pl = playlists.find((p) => p.id === activePlaylistId);
        if (pl && pl.events.length > 0) {
          const currentItem = pl.events[playlistPlaybarIndex] || pl.events[0];
          const { event: currentEvent } = findEventAcrossBatch(getClipEventId(currentItem), currentItem);
          const currentTiming = resolveClipTiming(currentItem, currentEvent);
          targetTime = Math.max(currentTiming.startTime, Math.min(currentTiming.endTime, targetTime));
        }
      } else if (playbarEventIdRef.current && selectedEventIds.size === 1 && !isMultiSelectAction) {
        const trimmingEvt = tagEvents.find((e) => e.id === playbarEventIdRef.current);
        if (trimmingEvt) {
          targetTime = Math.max(trimmingEvt.startTime, Math.min(trimmingEvt.endTime, targetTime));
        }
      }
      return targetTime;
    },
    [
      duration,
      showPlaylistPlaybar,
      playlists,
      activePlaylistId,
      playlistPlaybarIndex,
      findEventAcrossBatch,
      playbarEventId,
      selectedEventIds,
      isMultiSelectAction,
      tagEvents,
    ]
  );

  const findActiveFreezeFrameNear = useCallback(
    (targetTime: number) => {
      let activeItem: PlaylistItem | null = null;
      let activeIndex = 0;
      if (
        showPlaylistPlaybar ||
        (autoplay.active && autoplay.playlistId) ||
        isPresentationModeRef.current
      ) {
        const targetPlId = autoplay.playlistId || activePlaylistId;
        const pl = playlists.find((p) => p.id === targetPlId);
        if (pl && pl.events.length > 0) {
          activeIndex =
            autoplay.active && autoplay.eventIndex >= 0 ? autoplay.eventIndex : playlistPlaybarIndex;
          activeItem = pl.events[activeIndex] || null;
        }
      }
      return freezeFrames.find(
        (f) =>
          Math.abs(f.timestamp - targetTime) <= 0.035 &&
          isFreezeFrameActiveForClip(f, activeItem, activeIndex)
      );
    },
    [freezeFrames, showPlaylistPlaybar, autoplay, activePlaylistId, playlists, playlistPlaybarIndex, isPresentationModeRef]
  );

  const beginScrubSession = useCallback(() => {
    if (editingAnimationFFId) {
      setEditingAnimationFFId(null);
      setIsAnimationPreviewPlaying(false);
    }
    if (!isScrubbingRef.current) {
      const videoActivelyPlaying = Boolean(
        videoRef.current && !videoRef.current.paused && !videoRef.current.ended
      );
      wasPlayingBeforeScrubRef.current = isPlaying || videoActivelyPlaying || isFreezeFramePlaying;
      wasAutoplayBeforeScrubRef.current = autoplay.active;
      isScrubbingRef.current = true;
      setIsScrubbing(true);
    }
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
    setIsFreezeFramePlaying(false);
    setActiveFreezeFrameId(null);
    setCountdownValue(0);
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
    }
    setIsPlaying(false);
    clearMaskCache();
  }, [
    editingAnimationFFId,
    setEditingAnimationFFId,
    setIsAnimationPreviewPlaying,
    isScrubbingRef,
    videoRef,
    isPlaying,
    isFreezeFramePlaying,
    autoplay.active,
    setIsScrubbing,
    countdownInterval,
    setIsFreezeFramePlaying,
    setActiveFreezeFrameId,
    setCountdownValue,
    setIsPlaying,
    clearMaskCache,
  ]);

  const scrubToTime = useCallback(
    (rawTime: number, options?: { skipModeClamp?: boolean }) => {
      const targetTime = options?.skipModeClamp
        ? Math.max(0, duration > 0 ? Math.min(duration, rawTime) : rawTime)
        : clampSeekTimeForActiveMode(rawTime);
      scrubTargetTimeRef.current = targetTime;
      setCurrentTime(targetTime);
      lastTimeRef.current = targetTime;
      triggeredFreezeFrames.current.clear();

      const video = videoRef.current;
      if (video) {
        if (!video.seeking) {
          pendingScrubVideoTimeRef.current = null;
          if (Math.abs(video.currentTime - targetTime) > 0.005) {
            video.currentTime = targetTime;
          }
        } else {
          pendingScrubVideoTimeRef.current = targetTime;
        }
      }
    },
    [
      duration,
      clampSeekTimeForActiveMode,
      scrubTargetTimeRef,
      setCurrentTime,
      lastTimeRef,
      triggeredFreezeFrames,
      videoRef,
      pendingScrubVideoTimeRef,
    ]
  );

  const endScrubSession = useCallback(() => {
    if (!isScrubbingRef.current && !isScrubbing) return;
    isScrubbingRef.current = false;
    setIsScrubbing(false);
    scrubContainerRef.current = null;
    pendingScrubVideoTimeRef.current = null;

    const finalTime = scrubTargetTimeRef.current ?? (videoRef.current?.currentTime ?? currentTime);
    scrubTargetTimeRef.current = null;

    const shouldResume = wasPlayingBeforeScrubRef.current;
    const shouldRestoreAutoplay = wasAutoplayBeforeScrubRef.current;
    wasPlayingBeforeScrubRef.current = false;
    wasAutoplayBeforeScrubRef.current = false;

    const video = videoRef.current;
    if (video && pendingSeekTimeRef.current === null) {
      if (Math.abs(video.currentTime - finalTime) > 0.005) {
        video.currentTime = finalTime;
      }
    }
    setCurrentTime(finalTime);
    lastTimeRef.current = finalTime;
    triggeredFreezeFrames.current.clear();

    if (shouldResume && (shouldRestoreAutoplay || showPlaylistPlaybar || isPresentationModeRef.current)) {
      const targetPlId = autoplay.playlistId || activePlaylistId;
      setAutoplay({ active: true, playlistId: targetPlId, eventIndex: playlistPlaybarIndex });
    }

    if (pendingSeekTimeRef.current !== null) {
      pendingPlayRef.current = shouldResume;
      return;
    }

    const matchedFF = findActiveFreezeFrameNear(finalTime);
    if (matchedFF) {
      if (video) {
        video.pause();
        const diff = video.currentTime - matchedFF.timestamp;
        if (diff < -0.005 || diff > 0.045) {
          video.currentTime = Math.min(duration || Infinity, matchedFF.timestamp + 0.005);
        }
      }
      setCurrentTime(matchedFF.timestamp);
      lastTimeRef.current = matchedFF.timestamp;
      if (shouldResume) {
        triggeredFreezeFrames.current.add(matchedFF.id);
      }
      setActiveFreezeFrameId(matchedFF.id);
      setCountdownValue(matchedFF.duration || 5);
      setIsFreezeFramePlaying(shouldResume);
      setIsPlaying(false);
    } else {
      setActiveFreezeFrameId(null);
      setIsFreezeFramePlaying(false);
      setCountdownValue(0);
      if (shouldResume && video) {
        setIsPlaying(true);
        video.play().catch((e) => console.log('Scrub resume error:', e));
      } else {
        if (video && !video.paused) {
          video.pause();
        }
        setIsPlaying(false);
        if (maskSettings.enabled && video && !video.seeking) {
          computeMaskingLayers();
        }
      }
    }
  }, [
    isScrubbingRef,
    setIsScrubbing,
    pendingScrubVideoTimeRef,
    scrubTargetTimeRef,
    videoRef,
    currentTime,
    pendingSeekTimeRef,
    setCurrentTime,
    lastTimeRef,
    triggeredFreezeFrames,
    showPlaylistPlaybar,
    isPresentationModeRef,
    autoplay.playlistId,
    activePlaylistId,
    setAutoplay,
    playlistPlaybarIndex,
    pendingPlayRef,
    findActiveFreezeFrameNear,
    setActiveFreezeFrameId,
    setCountdownValue,
    setIsFreezeFramePlaying,
    setIsPlaying,
    maskSettings.enabled,
    computeMaskingLayers,
  ]);

  const handleManualSeek = useCallback(
    (time: number, options?: { pause?: boolean; skipModeClamp?: boolean }) => {
      if (editingAnimationFFId) {
        setEditingAnimationFFId(null);
        setIsAnimationPreviewPlaying(false);
      }
      const targetTime = options?.skipModeClamp
        ? Math.max(0, duration > 0 ? Math.min(duration, time) : time)
        : clampSeekTimeForActiveMode(time);
      const video = videoRef.current;
      const wasPlaying =
        !options?.pause &&
        (isPlaying || isFreezeFramePlaying || Boolean(video && !video.paused && !video.ended));

      clearMaskCache();

      if (video) {
        const matchedFF = findActiveFreezeFrameNear(targetTime);
        if (matchedFF) {
          // When navigating to a freeze frame, seek safely into the frame (+0.005s)
          // so HTML5 video decoder never snaps to the previous frame due to PTS floor-rounding
          const safeSeek = Math.min(duration || Infinity, matchedFF.timestamp + 0.005);
          video.currentTime = safeSeek;
          setCurrentTime(matchedFF.timestamp);
          lastTimeRef.current = matchedFF.timestamp;
          triggeredFreezeFrames.current.clear();
          if (countdownInterval.current) {
            clearInterval(countdownInterval.current);
            countdownInterval.current = null;
          }
          video.pause();
          if (wasPlaying) {
            triggeredFreezeFrames.current.add(matchedFF.id);
          }
          setActiveFreezeFrameId(matchedFF.id);
          setCountdownValue(matchedFF.duration || 5);
          setIsFreezeFramePlaying(wasPlaying);
          setIsPlaying(false);
        } else {
          video.currentTime = targetTime;
          setCurrentTime(targetTime);
          lastTimeRef.current = targetTime;
          triggeredFreezeFrames.current.clear();
          if (countdownInterval.current) {
            clearInterval(countdownInterval.current);
            countdownInterval.current = null;
          }
          setActiveFreezeFrameId(null);
          setIsFreezeFramePlaying(false);
          setCountdownValue(0);
          if (wasPlaying) {
            setIsPlaying(true);
            if (video.paused) {
              video.play().catch((e) => console.log('Manual seek resume error:', e));
            }
          } else {
            if (!video.paused) {
              video.pause();
            }
            setIsPlaying(false);
          }
        }
      } else {
        setCurrentTime(targetTime);
        lastTimeRef.current = targetTime;
        triggeredFreezeFrames.current.clear();
        if (countdownInterval.current) {
          clearInterval(countdownInterval.current);
          countdownInterval.current = null;
        }
        setActiveFreezeFrameId(null);
        setIsFreezeFramePlaying(false);
        setCountdownValue(0);
      }
    },
    [
      duration,
      editingAnimationFFId,
      setEditingAnimationFFId,
      setIsAnimationPreviewPlaying,
      clampSeekTimeForActiveMode,
      videoRef,
      isPlaying,
      isFreezeFramePlaying,
      clearMaskCache,
      setCurrentTime,
      lastTimeRef,
      triggeredFreezeFrames,
      countdownInterval,
      findActiveFreezeFrameNear,
      setActiveFreezeFrameId,
      setCountdownValue,
      setIsFreezeFramePlaying,
      setIsPlaying,
    ]
  );

  const getChronologicalTrimEvents = useCallback(
    (activeId: string | null) => {
      const sortFn = (a: TagEvent, b: TagEvent) =>
        a.startTime - b.startTime || a.endTime - b.endTime || a.id.localeCompare(b.id);
      const filtered = [...getFilteredEvents()].sort(sortFn);
      if (filtered.length > 1 && (!activeId || filtered.some((e) => e.id === activeId))) {
        return filtered;
      }
      return [...tagEvents].sort(sortFn);
    },
    [getFilteredEvents, tagEvents]
  );

  const jumpPrevEvent = () => {
    const activeTrimId = playbarEventIdRef.current || playbarEventId;
    const isTrimming =
      Boolean(activeTrimId) &&
      selectedEventIds.size === 1 &&
      !isMultiSelectAction &&
      !showPlaylistPlaybar;

    if (isTrimming && activeTrimId) {
      const navEvents = getChronologicalTrimEvents(activeTrimId);
      if (navEvents.length <= 1) return;
      const currentIdx = navEvents.findIndex((e) => e.id === activeTrimId);
      const prevIdx =
        currentIdx > 0
          ? currentIdx - 1
          : currentIdx === 0
          ? navEvents.length - 1
          : navEvents.length - 1;
      const prevEvt = navEvents[prevIdx];
      if (prevEvt && prevEvt.id !== activeTrimId) {
        playbarEventIdRef.current = prevEvt.id;
        lastClickedEventIdRef.current = prevEvt.id;
        setSelectedEventIds(new Set([prevEvt.id]));
        setSelectedEventLogs(new Set([prevEvt.id]));
        setIsMultiSelectAction(false);
        setPlaybarEventId(prevEvt.id);
        handleManualSeek(prevEvt.startTime, { skipModeClamp: true });
      }
      return;
    }

    const events = [...getFilteredEvents()].sort(
      (a, b) => a.startTime - b.startTime || a.endTime - b.endTime || a.id.localeCompare(b.id)
    );
    if (!events.length) return;
    const now = videoRef.current ? videoRef.current.currentTime : currentTime;
    const prev = [...events].reverse().find((e) => e.startTime < now - 0.5);
    if (prev) {
      handleManualSeek(prev.startTime);
    } else if (now > 0.5) {
      handleManualSeek(0);
    }
  };

  const jumpNextEvent = () => {
    const activeTrimId = playbarEventIdRef.current || playbarEventId;
    const isTrimming =
      Boolean(activeTrimId) &&
      selectedEventIds.size === 1 &&
      !isMultiSelectAction &&
      !showPlaylistPlaybar;

    if (isTrimming && activeTrimId) {
      const navEvents = getChronologicalTrimEvents(activeTrimId);
      if (navEvents.length <= 1) return;
      const currentIdx = navEvents.findIndex((e) => e.id === activeTrimId);
      const nextIdx =
        currentIdx !== -1 && currentIdx < navEvents.length - 1 ? currentIdx + 1 : 0;
      const nextEvt = navEvents[nextIdx];
      if (nextEvt && nextEvt.id !== activeTrimId) {
        playbarEventIdRef.current = nextEvt.id;
        lastClickedEventIdRef.current = nextEvt.id;
        setSelectedEventIds(new Set([nextEvt.id]));
        setSelectedEventLogs(new Set([nextEvt.id]));
        setIsMultiSelectAction(false);
        setPlaybarEventId(nextEvt.id);
        handleManualSeek(nextEvt.startTime, { skipModeClamp: true });
      }
      return;
    }

    const events = [...getFilteredEvents()].sort(
      (a, b) => a.startTime - b.startTime || a.endTime - b.endTime || a.id.localeCompare(b.id)
    );
    if (!events.length) return;
    const now = videoRef.current ? videoRef.current.currentTime : currentTime;
    const next = events.find((e) => e.startTime > now + 0.5);
    if (next) {
      handleManualSeek(next.startTime);
    }
  };

  const handleTimeUpdate = () => {
    if (isScrubbingRef.current) return;
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      const prevTime = lastTimeRef.current;

      if (time < prevTime - 0.05) {
        triggeredFreezeFrames.current.forEach((id) => {
          const ff = freezeFrames.find((f) => f.id === id);
          if (ff && ff.timestamp > time) {
            triggeredFreezeFrames.current.delete(id);
          }
        });
      }

      setCurrentTime(time);
      lastTimeRef.current = time;
    }
  };

  useEffect(() => {
    let animationFrameId: number;
    let lastPolledTime = videoRef.current ? videoRef.current.currentTime : 0;

    const tick = () => {
      if (isPlaying && videoRef.current) {
        let time = videoRef.current.currentTime;

        let ff = undefined;
        if (!exportSettingsRef.current.active || exportSettingsRef.current.withFreezeFrames) {
          let activeItem: PlaylistItem | null = null;
          let activeIndex = 0;
          if (
            showPlaylistPlaybar ||
            (autoplay.active && autoplay.playlistId) ||
            isPresentationModeRef.current
          ) {
            const targetPlId = autoplay.playlistId || activePlaylistId;
            const pl = playlists.find((p) => p.id === targetPlId);
            if (pl && pl.events.length > 0) {
              activeIndex =
                autoplay.active && autoplay.eventIndex >= 0 ? autoplay.eventIndex : playlistPlaybarIndex;
              activeItem = pl.events[activeIndex] || null;
            }
          }

          if (time > lastPolledTime && time - lastPolledTime < 1.0) {
            // Trigger strictly when video has arrived at or reached the freeze frame timestamp.
            // Do NOT use a premature lookahead (such as time + 0.03s), which triggers and pauses
            // the video 1 frame early (showing the previous frame while telestrations draw).
            const candidates = freezeFrames.filter(
              (f) =>
                f.timestamp > lastPolledTime - 0.005 &&
                f.timestamp <= time + 0.001 &&
                !triggeredFreezeFrames.current.has(f.id) &&
                isFreezeFrameActiveForClip(f, activeItem, activeIndex)
            );
            if (candidates.length > 0) {
              candidates.sort((a, b) => a.timestamp - b.timestamp);
              ff = candidates[0];
            }
          } else {
            ff = freezeFrames.find(
              (f) =>
                Math.abs(f.timestamp - time) <= 0.035 &&
                !triggeredFreezeFrames.current.has(f.id) &&
                isFreezeFrameActiveForClip(f, activeItem, activeIndex)
            );
          }
        }

        if (ff) {
          videoRef.current.pause();

          // If the video naturally played to this frame and is within the frame duration (-0.005 to +0.045s),
          // DO NOT force a backward seek to ff.timestamp! Backward seeks flush the video decoder and
          // cause the browser to snap to the previous frame (one frame back).
          // Only seek if we significantly overshot (>0.05s due to frame drop/tab blur) or paused way before.
          const curVTime = videoRef.current.currentTime;
          const diff = curVTime - ff.timestamp;
          if (diff < -0.005 || diff > 0.05) {
            videoRef.current.currentTime = Math.min(duration || Infinity, ff.timestamp + 0.005);
          }
          time = ff.timestamp;

          setCurrentTime(time);
          setIsPlaying(false);
          lastTimeRef.current = time;
          lastPolledTime = time;

          triggeredFreezeFrames.current.add(ff.id);
          setActiveFreezeFrameId(ff.id);
          setCountdownValue(ff.duration);
          setIsFreezeFramePlaying(true);
          if (countdownInterval.current) {
            clearInterval(countdownInterval.current);
            countdownInterval.current = null;
          }
        } else if (
          showPlaylistPlaybar ||
          (autoplay.active && autoplay.playlistId) ||
          isPresentationModeRef.current
        ) {
          const targetPlaylistId = autoplay.playlistId || activePlaylistId;
          const playlist = playlists.find((p) => p.id === targetPlaylistId);
          if (playlist && playlist.events.length > 0) {
            const activeIndex =
              autoplay.active && autoplay.eventIndex >= 0 ? autoplay.eventIndex : playlistPlaybarIndex;
            const safeIndex = Math.max(0, Math.min(activeIndex, playlist.events.length - 1));
            const currentItem = playlist.events[safeIndex];
            const currentEventId = getClipEventId(currentItem);
            const { event: currentEvent, project: currentClipProj } = findEventAcrossBatch(
              currentEventId,
              currentItem
            );
            const currentTiming = resolveClipTiming(currentItem, currentEvent);

            if (currentClipProj && currentClipProj.id !== project.id && batchMode) {
              if (pendingSeekTimeRef.current === null) {
                if (videoRef.current) {
                  videoRef.current.pause();
                }
                pendingSeekTimeRef.current = currentTiming.startTime;
                pendingPlayRef.current = true;
                batchMode.onSelectProject(currentClipProj.id);
              }
              lastPolledTime = time;
              animationFrameId = requestAnimationFrame(tick);
              return;
            }

            if (time < currentTiming.startTime - 0.05) {
              videoRef.current.currentTime = currentTiming.startTime;
              time = currentTiming.startTime;
            }

            if (time >= currentTiming.endTime) {
              const nextIndex = safeIndex + 1;
              if (nextIndex < playlist.events.length) {
                const nextItem = playlist.events[nextIndex];
                const nextEventId = getClipEventId(nextItem);
                const { event: nextEvent, project: nextClipProj } = findEventAcrossBatch(
                  nextEventId,
                  nextItem
                );
                const nextTiming = resolveClipTiming(nextItem, nextEvent);

                setAutoplay((prev) => ({
                  ...prev,
                  active: true,
                  playlistId: targetPlaylistId,
                  eventIndex: nextIndex,
                }));
                setPlaylistPlaybarIndex(nextIndex);

                if (nextClipProj && nextClipProj.id !== project.id && batchMode) {
                  if (videoRef.current) {
                    videoRef.current.pause();
                  }
                  pendingSeekTimeRef.current = nextTiming.startTime;
                  pendingPlayRef.current = true;
                  batchMode.onSelectProject(nextClipProj.id);
                } else {
                  videoRef.current.currentTime = nextTiming.startTime;
                  time = nextTiming.startTime;
                  if (videoRef.current.paused) videoRef.current.play().catch((e) => console.log(e));
                }
              } else {
                if (isPresentationModeRef.current) {
                  const presPlaylists = presentationPlaylistsRef.current;
                  const curPlIndex = presPlaylists.findIndex((p) => p.id === targetPlaylistId);
                  const presConfig = presentationConfigRef.current;

                  if (curPlIndex !== -1 && curPlIndex + 1 < presPlaylists.length) {
                    const nextPl = presPlaylists[curPlIndex + 1];
                    setPresentationPlaylistIndex(curPlIndex + 1);
                    setActivePlaylistId(nextPl.id);
                    setAutoplay({ active: true, playlistId: nextPl.id, eventIndex: 0 });
                    setPlaylistPlaybarIndex(0);

                    setPresentationTransitionMsg(`Now Playing: ${nextPl.name}`);
                    setTimeout(() => setPresentationTransitionMsg(null), 2500);

                    if (nextPl.events.length > 0) {
                      const firstItem = nextPl.events[0];
                      const firstEventId = getClipEventId(firstItem);
                      const { event: firstEvent, project: firstClipProj } = findEventAcrossBatch(
                        firstEventId,
                        firstItem
                      );
                      const firstTiming = resolveClipTiming(firstItem, firstEvent);

                      if (firstClipProj && firstClipProj.id !== project.id && batchMode) {
                        if (videoRef.current) videoRef.current.pause();
                        pendingSeekTimeRef.current = firstTiming.startTime;
                        pendingPlayRef.current = !presConfig.pauseBetweenPlaylists;
                        batchMode.onSelectProject(firstClipProj.id);
                      } else {
                        videoRef.current.currentTime = firstTiming.startTime;
                        time = firstTiming.startTime;
                        if (presConfig.pauseBetweenPlaylists) {
                          videoRef.current.pause();
                          setIsPlaying(false);
                        } else if (videoRef.current.paused) {
                          videoRef.current.play().catch((e) => console.log(e));
                        }
                      }
                    }
                    return;
                  } else if (curPlIndex !== -1 && presConfig.loop && presPlaylists.length > 0) {
                    const firstPl = presPlaylists[0];
                    setPresentationPlaylistIndex(0);
                    setActivePlaylistId(firstPl.id);
                    setAutoplay({ active: true, playlistId: firstPl.id, eventIndex: 0 });
                    setPlaylistPlaybarIndex(0);

                    setPresentationTransitionMsg(`Looping: ${firstPl.name}`);
                    setTimeout(() => setPresentationTransitionMsg(null), 2500);

                    if (firstPl.events.length > 0) {
                      const firstItem = firstPl.events[0];
                      const firstEventId = getClipEventId(firstItem);
                      const { event: firstEvent, project: firstClipProj } = findEventAcrossBatch(
                        firstEventId,
                        firstItem
                      );
                      const firstTiming = resolveClipTiming(firstItem, firstEvent);

                      if (firstClipProj && firstClipProj.id !== project.id && batchMode) {
                        if (videoRef.current) videoRef.current.pause();
                        pendingSeekTimeRef.current = firstTiming.startTime;
                        pendingPlayRef.current = true;
                        batchMode.onSelectProject(firstClipProj.id);
                      } else {
                        videoRef.current.currentTime = firstTiming.startTime;
                        time = firstTiming.startTime;
                        if (videoRef.current.paused) videoRef.current.play().catch((e) => console.log(e));
                      }
                    }
                    return;
                  } else {
                    setPresentationFinished(true);
                    videoRef.current.pause();
                    videoRef.current.currentTime = currentTiming.endTime;
                    setIsPlaying(false);
                    if (autoplay.active) {
                      setAutoplay({ active: false, playlistId: null, eventIndex: -1 });
                    }
                  }
                } else {
                  videoRef.current.pause();
                  videoRef.current.currentTime = currentTiming.endTime;
                  setIsPlaying(false);
                  if (autoplay.active) {
                    setAutoplay({ active: false, playlistId: null, eventIndex: -1 });
                  }

                  if (exportSettingsRef.current.active) {
                    stopRecording();
                    exportSettingsRef.current = { active: false, playlistId: null, withFreezeFrames: true };
                  }
                }
              }
            }
          }
        } else if (playbarEventIdRef.current && selectedEventIds.size === 1 && !isMultiSelectAction) {
          const trimmingEvt = tagEvents.find((e) => e.id === playbarEventIdRef.current);
          if (trimmingEvt) {
            if (time < trimmingEvt.startTime - 0.05) {
              videoRef.current.currentTime = trimmingEvt.startTime;
              time = trimmingEvt.startTime;
            } else if (time >= trimmingEvt.endTime) {
              videoRef.current.pause();
              videoRef.current.currentTime = trimmingEvt.endTime;
              setIsPlaying(false);
            }
          }
        }

        lastPolledTime = time;
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(tick);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [
    isPlaying,
    freezeFrames,
    autoplay,
    playlists,
    showPlaylistPlaybar,
    playlistPlaybarIndex,
    activePlaylistId,
    tagEvents,
    playbarEventId,
    selectedEventIds,
    isMultiSelectAction,
    project.id,
    batchMode,
  ]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      videoRef.current.playbackRate = playbackRate;
      videoRef.current.muted = isMuted;

      if (pendingSeekTimeRef.current !== null) {
        const seekTo = pendingSeekTimeRef.current;
        pendingSeekTimeRef.current = null;
        videoRef.current.currentTime = seekTo;
        setCurrentTime(seekTo);
        if (pendingPlayRef.current || isPlaying || autoplay.active) {
          pendingPlayRef.current = false;
          setIsPlaying(true);
          videoRef.current.play().catch((e) => console.log('Video resume error:', e));
        }
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    handleManualSeek(time);
  };

  const calculateTimeFromMouse = useCallback(
    (e: MouseEvent | React.MouseEvent, container: HTMLElement) => {
      const rect = container.getBoundingClientRect();
      const scrollLeft = container.scrollLeft;
      const clickX = e.clientX - rect.left;
      const totalClickX = scrollLeft + clickX;
      let percentage = totalClickX / container.scrollWidth;
      percentage = Math.max(0, Math.min(1, percentage));
      return percentage * (duration || 0);
    },
    [duration]
  );

  const handleScrubStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = (e.currentTarget as HTMLElement).closest('.overflow-auto, .overflow-hidden') as HTMLDivElement;
    if (!target) return;
    scrubContainerRef.current = target;
    beginScrubSession();
    const time = calculateTimeFromMouse(e, target);
    scrubToTime(time);
  };

  const handleScrubMove = useCallback(
    (e: MouseEvent) => {
      if (!isScrubbingRef.current) return;
      // If mouse button is no longer held down, terminate scrub session immediately
      if ((e.buttons & 1) === 0) {
        endScrubSession();
        return;
      }
      // ONLY scrub if this was initiated by a timeline container scrubber
      // (PlaylistPlaybar and EventPlaybar have their own precise scrub logic)
      if (!scrubContainerRef.current) return;
      const time = calculateTimeFromMouse(e, scrubContainerRef.current);
      scrubToTime(time);
    },
    [calculateTimeFromMouse, scrubToTime, isScrubbingRef, endScrubSession]
  );

  const handleScrubEnd = useCallback(() => {
    endScrubSession();
  }, [endScrubSession]);

  useEffect(() => {
    if (isScrubbing) {
      window.addEventListener('mousemove', handleScrubMove);
      window.addEventListener('mouseup', handleScrubEnd);
      return () => {
        window.removeEventListener('mousemove', handleScrubMove);
        window.removeEventListener('mouseup', handleScrubEnd);
      };
    }
  }, [isScrubbing, handleScrubMove, handleScrubEnd]);

  const handleTimelineMarqueeStart = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('button, input, [role="button"], .group\\/ffmarker, .group\\/tagevent')) {
        return;
      }
      const container = expandedTimelineContainerRef.current || timelineContainerRef.current;
      if (!container) return;

      const startTime = calculateTimeFromMouse(e, container);
      const rect = container.getBoundingClientRect();
      const startX = e.clientX - rect.left + container.scrollLeft;
      const isShift = Boolean(e.shiftKey || e.ctrlKey || e.metaKey);

      setTimelineMarquee({
        startTime,
        currentTime: startTime,
        startX,
        currentX: startX,
        isShift,
        initialSelectedIds: isShift ? Array.from(selectedEventIds) : [],
      });
    },
    [calculateTimeFromMouse, selectedEventIds, expandedTimelineContainerRef, timelineContainerRef]
  );

  const handleTimelineMarqueeMove = useCallback(
    (e: MouseEvent) => {
      if (!timelineMarquee) return;
      const container = expandedTimelineContainerRef.current || timelineContainerRef.current;
      if (!container) return;

      const currentMouseTime = calculateTimeFromMouse(e, container);
      const rect = container.getBoundingClientRect();
      const currentX = e.clientX - rect.left + container.scrollLeft;

      setTimelineMarquee((prev) => (prev ? { ...prev, currentTime: currentMouseTime, currentX } : null));

      const minTime = Math.min(timelineMarquee.startTime, currentMouseTime);
      const maxTime = Math.max(timelineMarquee.startTime, currentMouseTime);

      const visibleEvents = tagEvents.filter((evt) => {
        let match = true;
        if (filterTagId && evt.tagId !== filterTagId) match = false;
        if (filterLabelId && (!evt.labelIds || !evt.labelIds.includes(filterLabelId))) match = false;
        return match;
      });

      const nextSelected = new Set<string>(timelineMarquee.isShift ? timelineMarquee.initialSelectedIds : []);

      visibleEvents.forEach((evt) => {
        if (evt.startTime <= maxTime && evt.endTime >= minTime) {
          nextSelected.add(evt.id);
        }
      });

      setSelectedEventIds(nextSelected);
      setSelectedEventLogs(nextSelected);
      if (nextSelected.size > 0) {
        setIsMultiSelectAction(true);
      }
    },
    [
      timelineMarquee,
      calculateTimeFromMouse,
      tagEvents,
      filterTagId,
      filterLabelId,
      expandedTimelineContainerRef,
      timelineContainerRef,
      setSelectedEventIds,
      setSelectedEventLogs,
      setIsMultiSelectAction,
    ]
  );

  const handleTimelineMarqueeEnd = useCallback(() => {
    if (!timelineMarquee) return;
    const timeSpan = Math.abs(timelineMarquee.currentTime - timelineMarquee.startTime);
    const pxSpan = Math.abs(timelineMarquee.currentX - timelineMarquee.startX);

    if (pxSpan > 6 || timeSpan > 0.05) {
      if (selectedEventIds.size > 0) {
        setIsMultiSelectAction(true);
        showNotification(
          `Selected ${selectedEventIds.size} event${selectedEventIds.size > 1 ? 's' : ''}`,
          '#c6ff1f'
        );
      }
    } else {
      if (!timelineMarquee.isShift) {
        setSelectedEventIds(new Set());
        setSelectedEventLogs(new Set());
        setPlaybarEventId(null);
        setIsMultiSelectAction(false);
        lastClickedEventIdRef.current = null;
      }
    }
    setTimelineMarquee(null);
  }, [
    timelineMarquee,
    selectedEventIds.size,
    setIsMultiSelectAction,
    showNotification,
    setSelectedEventIds,
    setSelectedEventLogs,
    setPlaybarEventId,
  ]);

  useEffect(() => {
    if (timelineMarquee) {
      window.addEventListener('mousemove', handleTimelineMarqueeMove);
      window.addEventListener('mouseup', handleTimelineMarqueeEnd);
      return () => {
        window.removeEventListener('mousemove', handleTimelineMarqueeMove);
        window.removeEventListener('mouseup', handleTimelineMarqueeEnd);
      };
    }
  }, [timelineMarquee, handleTimelineMarqueeMove, handleTimelineMarqueeEnd]);

  const handleTimelineContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!timelineContainerRef.current || duration === 0) return;
    const container = timelineContainerRef.current;
    const scrollLeft = container.scrollLeft;
    const rect = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const totalClickX = scrollLeft + clickX;
    const totalWidth = container.scrollWidth;
    const percentage = Math.max(0, Math.min(1, totalClickX / totalWidth));
    const time = percentage * duration;
    setMarkerModal({
      isOpen: true,
      x: e.clientX,
      y: e.clientY - 160,
      mode: 'create',
      time: time,
      tempLabel: '',
      tempColor: '#ef4444',
    });
  };

  const handleMarkerContextMenu = (e: React.MouseEvent, marker: TimelineMarker) => {
    e.preventDefault();
    e.stopPropagation();
    setMarkerModal({
      isOpen: true,
      x: e.clientX,
      y: e.clientY - 160,
      mode: 'edit',
      markerId: marker.id,
      tempLabel: marker.label,
      tempColor: marker.color,
    });
  };

  const saveMarker = () => {
    if (!markerModal) return;
    if (markerModal.mode === 'create' && markerModal.time !== undefined) {
      setMarkers((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          time: markerModal.time!,
          label: markerModal.tempLabel || 'Marker',
          color: markerModal.tempColor,
        },
      ]);
    } else if (markerModal.mode === 'edit' && markerModal.markerId) {
      setMarkers((prev) =>
        prev.map((m) =>
          m.id === markerModal.markerId
            ? { ...m, label: markerModal.tempLabel, color: markerModal.tempColor }
            : m
        )
      );
    }
    setMarkerModal(null);
  };

  const deleteMarker = () => {
    if (markerModal?.markerId) {
      setMarkers((prev) => prev.filter((m) => m.id !== markerModal.markerId));
      setMarkerModal(null);
    }
  };

  const jumpToMarker = (time: number) => {
    handleManualSeek(time, { pause: true, skipModeClamp: true });
  };

  const handleEventClick = (e: React.MouseEvent, eventId: string, time: number) => {
    e.stopPropagation();
    handleManualSeek(time);

    if (e.shiftKey && lastClickedEventIdRef.current) {
      const lastId = lastClickedEventIdRef.current;
      const sortedEvents = [...tagEvents].sort((a, b) => a.startTime - b.startTime);
      const idx1 = sortedEvents.findIndex((ev) => ev.id === lastId);
      const idx2 = sortedEvents.findIndex((ev) => ev.id === eventId);

      if (idx1 !== -1 && idx2 !== -1) {
        const startIdx = Math.min(idx1, idx2);
        const endIdx = Math.max(idx1, idx2);
        const rangeEvents = sortedEvents.slice(startIdx, endIdx + 1);

        const newSet = new Set(selectedEventIds);
        rangeEvents.forEach((ev) => newSet.add(ev.id));

        setSelectedEventIds(newSet);
        setSelectedEventLogs(newSet);
        setIsMultiSelectAction(true);
        lastClickedEventIdRef.current = eventId;
        showNotification(`Selected ${newSet.size} events`, '#c6ff1f');
        return;
      }
    }

    if (e.ctrlKey || e.metaKey) {
      setIsMultiSelectAction(true);
      const newSet = new Set(selectedEventIds);
      if (newSet.has(eventId)) newSet.delete(eventId);
      else newSet.add(eventId);
      setSelectedEventIds(newSet);
      setSelectedEventLogs(newSet);
      lastClickedEventIdRef.current = eventId;
    } else {
      setIsMultiSelectAction(false);
      if (selectedEventIds.size === 1 && selectedEventIds.has(eventId)) {
        playbarEventIdRef.current = null;
        setSelectedEventIds(new Set());
        setSelectedEventLogs(new Set());
        setPlaybarEventId(null);
        lastClickedEventIdRef.current = null;
      } else {
        playbarEventIdRef.current = eventId;
        setSelectedEventIds(new Set([eventId]));
        setSelectedEventLogs(new Set([eventId]));
        setPlaybarEventId(eventId);
        lastClickedEventIdRef.current = eventId;
        handleManualSeek(time, { skipModeClamp: true });
      }
    }
  };

  return {
    isVideoBuffering,
    setIsVideoBuffering,
    loadElapsedSec,
    playbackRate,
    setPlaybackRate,
    showCloseConfirm,
    setShowCloseConfirm,
    volume,
    setVolume,
    isMuted,
    setIsMuted,
    timelineZoom,
    setTimelineZoom,
    isTimelineExpanded,
    setIsTimelineExpanded,
    showTimelineFiltersMenu,
    setShowTimelineFiltersMenu,
    showTimelineFreezeFrames,
    setShowTimelineFreezeFrames,
    showTimelineTags,
    setShowTimelineTags,
    markers,
    setMarkers,
    markerModal,
    setMarkerModal,
    hoveredNoteId,
    setHoveredNoteId,
    periodSyncs,
    setPeriodSyncs,
    timelineMarquee,
    liveClock,
    handleImportMatchVideo,
    togglePlay,
    toggleMute,
    handleZoomIn,
    handleZoomOut,
    beginScrubSession,
    scrubToTime,
    endScrubSession,
    handleManualSeek,
    jumpPrevEvent,
    jumpNextEvent,
    handleTimeUpdate,
    handleLoadedMetadata,
    handleSeek,
    handleScrubStart,
    handleTimelineMarqueeStart,
    handleTimelineContextMenu,
    handleMarkerContextMenu,
    saveMarker,
    deleteMarker,
    jumpToMarker,
    handleEventClick,
  };
}
