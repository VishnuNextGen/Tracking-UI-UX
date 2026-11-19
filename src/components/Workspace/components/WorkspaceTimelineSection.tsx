import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ListPlus, X, Video, Snowflake, MapPin, Plus, FileText, CornerDownRight } from 'lucide-react';
import { PlaylistPlaybar } from '../../Playlist/PlaylistPlaybar';
import { EventPlaybar } from '../../EventPlaybar';
import { LiveHalfTimeline, LiveCodingBottomBar, useLiveClock } from '../LiveCoding';
import { WorkspaceBottomBar } from '../WorkspaceBottomBar';
import { formatTime } from '../../../utils/math';
import { fadeColor } from '../../../utils/colors';
import { getCanonicalPeriod, formatSyncClock } from '../../../utils/periodSyncUtils';
import type {
  Project,
  Playlist,
  TagEvent,
  Tag as TagData,
  Label,
  FreezeFrame,
  PeriodSync,
  TimelineMarker,
  ActiveRecording,
  PlaylistItem,
} from '../../../types';
import type {
  WorkspaceBatchModeProps,
  AutoplayState,
  MarkerModalState,
  TimelineMarqueeState,
} from '../Workspace.types';

export interface WorkspaceTimelineSectionProps {
  project: Project;
  isLive: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  timelineContainerRef: React.RefObject<HTMLDivElement | null>;
  expandedTimelineContainerRef: React.RefObject<HTMLDivElement | null>;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  activeFreezeFrameId: string | null;
  setActiveFreezeFrameId: React.Dispatch<React.SetStateAction<string | null>>;
  isFreezeFramePlaying: boolean;
  setIsFreezeFramePlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setCountdownValue: React.Dispatch<React.SetStateAction<number>>;
  justPassedFFId: string | null;
  justNextFFId: string | null;
  hoveredFreezeFrameId: string | null;
  setHoveredFreezeFrameId: React.Dispatch<React.SetStateAction<string | null>>;
  freezeFrames: FreezeFrame[];
  selectedEventIds: Set<string>;
  setSelectedEventIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedEventLogs: Set<string>;
  setSelectedEventLogs: React.Dispatch<React.SetStateAction<Set<string>>>;
  isMultiSelectAction: boolean;
  setIsMultiSelectAction: React.Dispatch<React.SetStateAction<boolean>>;
  playbarEventId: string | null;
  setPlaybarEventId: React.Dispatch<React.SetStateAction<string | null>>;
  showPlaylistPlaybar: boolean;
  setShowPlaylistPlaybar: React.Dispatch<React.SetStateAction<boolean>>;
  playlists: Playlist[];
  activePlaylistId: string;
  playlistPlaybarIndex: number;
  autoplay: AutoplayState;
  setAutoplay: React.Dispatch<React.SetStateAction<AutoplayState>>;
  isTimelineExpanded: boolean;
  setIsTimelineExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  addSelectedToPlaylist: (targetPlaylistId?: string, forceDuplicate?: boolean, insertAtIndex?: number) => void;
  addEventsToPlaylist?: (
    eventIds: string[],
    targetPlaylistId?: string,
    forceDuplicate?: boolean,
    insertAtIndex?: number
  ) => void;
  reorderPlaylistEvents?: (playlistId: string, fromIndex: number, toIndex: number) => void;
  tagEvents: TagEvent[];
  setTagEvents: (
    updater: TagEvent[] | ((prev: TagEvent[]) => TagEvent[]),
    options?: { skipHistory?: boolean }
  ) => void;
  tags: TagData[];
  labels: Label[];
  filterTagId: string | null;
  filterLabelId: string | null;
  allBatchTagEvents: TagEvent[];
  allBatchTags: TagData[];
  allBatchLabels: Label[];
  batchMode?: WorkspaceBatchModeProps;
  handleToggleClipFreezeFrameDeactivation: (playlistId: string, clipIndex: number, ffId: string) => void;
  handleSetClipAllFreezeFramesDeactivation: (
    playlistId: string,
    clipIndex: number,
    ffIds: string[],
    deactivate: boolean
  ) => void;
  handlePlaylistClipSelect: (idx: number, seekVideoTime?: number, autoPlay?: boolean) => void;
  handleUpdatePlaylistClipTrim: (
    playlistId: string,
    clipIndex: number,
    newStart: number,
    newEnd: number
  ) => void;
  handleResetPlaylistClipTrim: (playlistId: string, clipIndex: number) => void;
  togglePlay: () => void;
  beginScrubSession: () => void;
  scrubToTime: (time: number, options?: { skipModeClamp?: boolean }) => void;
  endScrubSession: () => void;
  handleEventUpdate: (start: number, end: number) => void;
  deleteEventsByIds: (ids: string[]) => void;
  liveClock: ReturnType<typeof useLiveClock>;
  periodSyncs: PeriodSync[];
  setPeriodSyncs: React.Dispatch<React.SetStateAction<PeriodSync[]>>;
  handleEventClick: (e: React.MouseEvent, id: string, startTime: number) => void;
  handleEventContextMenu: (e: React.MouseEvent, id: string) => void;
  onOpenEventNoteModal?: (eventId: string, projectId?: string) => void;
  timelineZoom: number;
  showTimelineTags: boolean;
  setShowTimelineTags: React.Dispatch<React.SetStateAction<boolean>>;
  showTimelineFreezeFrames: boolean;
  setShowTimelineFreezeFrames: React.Dispatch<React.SetStateAction<boolean>>;
  showTimelineFiltersMenu: boolean;
  setShowTimelineFiltersMenu: React.Dispatch<React.SetStateAction<boolean>>;
  markers: TimelineMarker[];
  setMarkers: React.Dispatch<React.SetStateAction<TimelineMarker[]>>;
  lastTagActionTimestamp: number;
  timelineLanes: TagEvent[][];
  setMarkerModal: React.Dispatch<React.SetStateAction<MarkerModalState>>;
  handleScrubStart: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleTimelineContextMenu: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleTimelineMarqueeStart: (e: React.MouseEvent<HTMLDivElement>) => void;
  timelineMarquee: TimelineMarqueeState | null;
  jumpToMarker: (time: number) => void;
  setHoveredNoteId: React.Dispatch<React.SetStateAction<string | null>>;
  isTaggingMode: boolean;
  activeRecordings: ActiveRecording[];
  handleMarkerContextMenu: (e: React.MouseEvent, marker: TimelineMarker) => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  setIsTimerPoppedOut: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPadPoppedOut: React.Dispatch<React.SetStateAction<boolean>>;
  showNotification: (
    message: string,
    color: string,
    onUndo?: () => void,
    action?: { label: string; onClick: () => void }
  ) => void;
  handleImportMatchVideo: () => void;
  jumpPrevEvent: () => void;
  jumpNextEvent: () => void;
  handleManualSeek: (time: number, options?: { pause?: boolean }) => void;
  playbackRate: number;
  setPlaybackRate: React.Dispatch<React.SetStateAction<number>>;
  isMuted: boolean;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  toggleMute: () => void;
  volume: number;
  setVolume: React.Dispatch<React.SetStateAction<number>>;
  onAddFreezeFrame?: (clipHint?: PlaylistItem) => void;
  onOpenFreezeFrameAnimation?: (ffId: string) => void;
}

export const WorkspaceTimelineSection: React.FC<WorkspaceTimelineSectionProps> = ({
  project,
  isLive,
  videoRef,
  timelineContainerRef,
  expandedTimelineContainerRef,
  currentTime,
  duration,
  isPlaying,
  setIsPlaying,
  activeFreezeFrameId,
  setActiveFreezeFrameId,
  isFreezeFramePlaying,
  setIsFreezeFramePlaying,
  setCountdownValue,
  justPassedFFId,
  justNextFFId,
  hoveredFreezeFrameId,
  setHoveredFreezeFrameId,
  freezeFrames,
  selectedEventIds,
  setSelectedEventIds,
  selectedEventLogs,
  setSelectedEventLogs,
  isMultiSelectAction,
  setIsMultiSelectAction,
  playbarEventId,
  setPlaybarEventId,
  showPlaylistPlaybar,
  setShowPlaylistPlaybar,
  playlists,
  activePlaylistId,
  playlistPlaybarIndex,
  autoplay,
  setAutoplay,
  isTimelineExpanded,
  setIsTimelineExpanded,
  addSelectedToPlaylist,
  addEventsToPlaylist,
  reorderPlaylistEvents,
  tagEvents,
  setTagEvents,
  tags,
  labels,
  filterTagId,
  filterLabelId,
  allBatchTagEvents,
  allBatchTags,
  allBatchLabels,
  batchMode,
  handleToggleClipFreezeFrameDeactivation,
  handleSetClipAllFreezeFramesDeactivation,
  handlePlaylistClipSelect,
  handleUpdatePlaylistClipTrim,
  handleResetPlaylistClipTrim,
  togglePlay,
  beginScrubSession,
  scrubToTime,
  endScrubSession,
  handleEventUpdate,
  deleteEventsByIds,
  liveClock,
  periodSyncs,
  setPeriodSyncs,
  handleEventClick,
  handleEventContextMenu,
  onOpenEventNoteModal,
  timelineZoom,
  showTimelineTags,
  setShowTimelineTags,
  showTimelineFreezeFrames,
  setShowTimelineFreezeFrames,
  showTimelineFiltersMenu,
  setShowTimelineFiltersMenu,
  markers,
  setMarkers,
  lastTagActionTimestamp,
  timelineLanes,
  setMarkerModal,
  handleScrubStart,
  handleTimelineContextMenu,
  handleTimelineMarqueeStart,
  timelineMarquee,
  jumpToMarker,
  setHoveredNoteId,
  isTaggingMode,
  activeRecordings,
  handleMarkerContextMenu,
  handleZoomIn,
  handleZoomOut,
  setIsTimerPoppedOut,
  setIsPadPoppedOut,
  showNotification,
  handleImportMatchVideo,
  jumpPrevEvent,
  jumpNextEvent,
  handleManualSeek,
  playbackRate,
  setPlaybackRate,
  isMuted,
  setIsMuted,
  toggleMute,
  volume,
  setVolume,
  onAddFreezeFrame,
  onOpenFreezeFrameAnimation,
}) => {
  const activeTrimEvent =
    selectedEventIds.size === 1 &&
    !isMultiSelectAction &&
    playbarEventId === Array.from(selectedEventIds)[0] &&
    !showPlaylistPlaybar
      ? tagEvents.find(e => e.id === playbarEventId)
      : null;
  const isTrimmingActive = Boolean(activeTrimEvent);
  const isExpandedOrLive = isTimelineExpanded || isLive;

  const sortedFilteredTrimEvents = isTrimmingActive && activeTrimEvent
    ? (() => {
        const sortFn = (a: TagEvent, b: TagEvent) =>
          a.startTime - b.startTime || a.endTime - b.endTime || a.id.localeCompare(b.id);
        const filtered = tagEvents
          .filter(evt => {
            if (filterTagId && evt.tagId !== filterTagId) return false;
            if (filterLabelId && (!evt.labelIds || !evt.labelIds.includes(filterLabelId))) return false;
            return true;
          })
          .sort(sortFn);
        if (filtered.length > 1 && filtered.some(e => e.id === activeTrimEvent.id)) {
          return filtered;
        }
        return [...tagEvents].sort(sortFn);
      })()
    : [];
  const activeTrimEventIndex = activeTrimEvent
    ? sortedFilteredTrimEvents.findIndex(e => e.id === activeTrimEvent.id)
    : -1;
  const hasPrevTrimEvent = sortedFilteredTrimEvents.length > 1;
  const hasNextTrimEvent = sortedFilteredTrimEvents.length > 1;

  const isPlaylistPlaybarActive = Boolean(
    showPlaylistPlaybar &&
      playlists.find(p => p.id === activePlaylistId) &&
      (playlists.find(p => p.id === activePlaylistId)?.events.length || 0) > 0
  );

  const sectionRef = React.useRef<HTMLDivElement | null>(null);
  const [lockedCollapsedHeight, setLockedCollapsedHeight] = React.useState<number>(114);

  React.useLayoutEffect(() => {
    if (isTrimmingActive || isPlaylistPlaybarActive || isExpandedOrLive) return;
    const el = sectionRef.current;
    if (!el) return;

    const syncHeight = () => {
      const measured = Math.round(el.getBoundingClientRect().height);
      if (measured > 0) {
        setLockedCollapsedHeight(prev => (prev !== measured ? measured : prev));
      }
    };

    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isTrimmingActive, isPlaylistPlaybarActive, isExpandedOrLive]);

  const activePlaylistObj = playlists.find(p => p.id === activePlaylistId);
  const activePlaylistCount = activePlaylistObj?.events.length || 0;
  const safeActiveClipIdx =
    activePlaylistCount > 0
      ? Math.max(0, Math.min(activePlaylistCount - 1, playlistPlaybarIndex))
      : -1;
  const canInsertAfterActiveClip =
    activePlaylistCount > 0 && safeActiveClipIdx >= 0 && safeActiveClipIdx < activePlaylistCount - 1;

  const handleTimelineEventDragStart = (e: React.DragEvent<HTMLDivElement>, eventId: string) => {
    const idsToDrag =
      selectedEventIds.has(eventId) && selectedEventIds.size > 1
        ? Array.from(selectedEventIds)
        : [eventId];
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/x-tacstem-events', JSON.stringify(idsToDrag));
  };

  const renderEventTrimmer = (trimmerClassName: string) => {
    if (!activeTrimEvent) return null;
    return (
      <EventPlaybar
        className={trimmerClassName}
        event={activeTrimEvent}
        tag={tags.find(t => t.id === activeTrimEvent.tagId)}
        labels={labels}
        videoDuration={duration}
        currentTime={currentTime}
        freezeFrames={freezeFrames}
        isPlaying={activeFreezeFrameId ? isFreezeFramePlaying : isPlaying}
        onTogglePlay={togglePlay}
        onPrevEvent={jumpPrevEvent}
        onNextEvent={jumpNextEvent}
        hasPrevEvent={hasPrevTrimEvent}
        hasNextEvent={hasNextTrimEvent}
        eventIndex={activeTrimEventIndex !== -1 ? activeTrimEventIndex : undefined}
        totalEvents={sortedFilteredTrimEvents.length}
        videoRef={videoRef}
        onUpdate={handleEventUpdate}
        onClose={() => {
          setSelectedEventIds(new Set());
          setSelectedEventLogs(new Set());
          setPlaybarEventId(null);
        }}
        onDelete={() => {
          deleteEventsByIds([activeTrimEvent.id]);
        }}
        onAddToPlaylist={force => addSelectedToPlaylist(undefined, force)}
        activeClipPositionLabel={canInsertAfterActiveClip ? `#${safeActiveClipIdx + 1}` : undefined}
        onInsertAfterActiveClip={
          canInsertAfterActiveClip
            ? force => addSelectedToPlaylist(undefined, force, safeActiveClipIdx + 1)
            : undefined
        }
        onOpenNoteModal={() => {
          onOpenEventNoteModal?.(activeTrimEvent.id);
        }}
        activePlaylistName={activePlaylistObj?.name || 'Playlist'}
        onScrubStart={beginScrubSession}
        onScrubMove={t => scrubToTime(t, { skipModeClamp: true })}
        onScrubEnd={endScrubSession}
      />
    );
  };

  return (
    <motion.div
      ref={sectionRef}
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      style={
        !isPlaylistPlaybarActive && !isExpandedOrLive && isTrimmingActive
          ? { height: `${lockedCollapsedHeight}px` }
          : undefined
      }
      className={`flex flex-col bg-[#111] border-t border-[#222] relative z-20 shrink-0 ${
        isPlaylistPlaybarActive
          ? 'h-auto'
          : isExpandedOrLive
          ? 'h-[260px]'
          : 'h-auto'
      }`}
    >
      {/* Floating Selection Toolbar for Multi-select - Elevated gracefully above the playbar */}
      <AnimatePresence>
        {!showPlaylistPlaybar &&
          !isPlaylistPlaybarActive &&
          (selectedEventIds.size > 0 || selectedEventLogs.size > 0) &&
          !(
            selectedEventIds.size === 1 &&
            !isMultiSelectAction &&
            playbarEventId === Array.from(selectedEventIds)[0] &&
            tagEvents.some(e => e.id === playbarEventId)
          ) && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-2.5 bg-[#141416]/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 shadow-[0_12px_36px_rgba(0,0,0,0.85)] text-xs text-white pointer-events-auto"
            >
              <span className="flex items-center gap-1.5 font-bold text-[#c6ff1f] text-[11px] select-none">
                <Check className="w-3.5 h-3.5 text-[#c6ff1f]" />
                {Math.max(selectedEventIds.size, selectedEventLogs.size)} event
                {Math.max(selectedEventIds.size, selectedEventLogs.size) > 1 ? 's' : ''} selected
              </span>
              <div className="w-[1px] h-3.5 bg-white/20" />
              {canInsertAfterActiveClip && (
                <button
                  onClick={e => addSelectedToPlaylist(undefined, e.shiftKey, safeActiveClipIdx + 1)}
                  className="flex items-center gap-1 bg-[#1e2128] hover:bg-[#282c36] text-[#c6ff1f] font-bold px-2.5 py-1 rounded-full text-xs border border-[#c6ff1f]/40 transition-all active:scale-95 cursor-pointer"
                  title={`Insert selected events right after clip #${safeActiveClipIdx + 1} in "${activePlaylistObj?.name || 'Playlist'}" • Hold Shift for duplicates`}
                >
                  <CornerDownRight className="w-3.5 h-3.5" />
                  <span>After #{safeActiveClipIdx + 1}</span>
                </button>
              )}
              <button
                onClick={e => addSelectedToPlaylist(undefined, e.shiftKey)}
                className="flex items-center gap-1.5 bg-[#c6ff1f] hover:bg-[#d4ff4d] text-black font-bold px-3 py-1 rounded-full text-xs transition-all shadow-[0_0_12px_rgba(198,255,31,0.4)] hover:shadow-[0_0_18px_rgba(198,255,31,0.6)] active:scale-95 cursor-pointer"
                title="Append selected events to end of active playlist (Ctrl+S) • Hold Shift for duplicates"
              >
                <ListPlus className="w-3.5 h-3.5" />
                <span>{canInsertAfterActiveClip ? '+ End' : 'Add to Playlist'}</span>
                <kbd className="text-[9px] bg-black/25 px-1.5 py-0.5 rounded font-mono font-semibold">
                  Ctrl+S
                </kbd>
              </button>
              <button
                onClick={() => {
                  const visibleEvents = tagEvents.filter(evt => {
                    let match = true;
                    if (filterTagId && evt.tagId !== filterTagId) match = false;
                    if (filterLabelId && (!evt.labelIds || !evt.labelIds.includes(filterLabelId)))
                      match = false;
                    return match;
                  });
                  const allIds = new Set(visibleEvents.map(evt => evt.id));
                  setSelectedEventIds(allIds);
                  setSelectedEventLogs(allIds);
                  setIsMultiSelectAction(true);
                }}
                className="text-gray-300 hover:text-white px-2.5 py-1 rounded-full hover:bg-white/10 text-[11px] font-medium transition-colors"
                title="Select all visible events (Ctrl+A)"
              >
                Select All
              </button>
              <button
                onClick={() => {
                  setSelectedEventIds(new Set());
                  setSelectedEventLogs(new Set());
                  setPlaybarEventId(null);
                  setIsMultiSelectAction(false);
                }}
                className="text-gray-400 hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors ml-0.5"
                title="Deselect all (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
      </AnimatePresence>

      {isPlaylistPlaybarActive ? (
        <PlaylistPlaybar
          playlist={playlists.find(p => p.id === activePlaylistId)!}
          tagEvents={allBatchTagEvents}
          tags={allBatchTags}
          labels={allBatchLabels}
          allBatchProjects={batchMode?.allBatchProjects}
          currentProjectId={project.id}
          videoRef={videoRef}
          currentTime={currentTime}
          videoDuration={duration}
          isPlaying={activeFreezeFrameId ? isFreezeFramePlaying : isPlaying}
          activeClipIndex={playlistPlaybarIndex}
          freezeFrames={freezeFrames}
          onToggleFreezeFrameDeactivation={ffId => {
            handleToggleClipFreezeFrameDeactivation(activePlaylistId, playlistPlaybarIndex, ffId);
          }}
          onSetAllFreezeFramesDeactivation={(ffIds, deact) => {
            handleSetClipAllFreezeFramesDeactivation(activePlaylistId, playlistPlaybarIndex, ffIds, deact);
          }}
          onAddFreezeFrame={
            onAddFreezeFrame
              ? () => {
                  const clip = activePlaylistObj?.events[safeActiveClipIdx];
                  onAddFreezeFrame(clip);
                }
              : undefined
          }
          onOpenFreezeFrameAnimation={onOpenFreezeFrameAnimation}
          onSelectClipIndex={(idx, seekVideoTime, autoPlay) => {
            handlePlaylistClipSelect(idx, seekVideoTime, autoPlay);
          }}
          onUpdateClipTrim={(clipIndex, newStart, newEnd) => {
            handleUpdatePlaylistClipTrim(activePlaylistId, clipIndex, newStart, newEnd);
          }}
          onResetClipTrim={clipIndex => {
            handleResetPlaylistClipTrim(activePlaylistId, clipIndex);
          }}
          onTogglePlay={togglePlay}
          onOpenNoteModal={(eventId, projectId) => {
            onOpenEventNoteModal?.(eventId, projectId);
          }}
          onScrubStart={beginScrubSession}
          onScrubMove={t => scrubToTime(t, { skipModeClamp: true })}
          onScrubEnd={endScrubSession}
          onReorderClips={
            reorderPlaylistEvents
              ? (fromIdx, toIdx) => reorderPlaylistEvents(activePlaylistId, fromIdx, toIdx)
              : undefined
          }
          onInsertEventsAt={
            addEventsToPlaylist
              ? (ids, insertIdx) => addEventsToPlaylist(ids, activePlaylistId, false, insertIdx)
              : undefined
          }
          onClose={() => {
            setShowPlaylistPlaybar(false);
            if (autoplay.active) {
              setAutoplay({ active: false, playlistId: null, eventIndex: -1 });
            }
          }}
        />
      ) : isTrimmingActive && activeTrimEvent && !isExpandedOrLive ? (
        renderEventTrimmer('h-full flex-1 min-h-0')
      ) : (
        <>
          {/* Layer 1: Timeline Content */}
          {isLive ? (
            <LiveHalfTimeline
              isLive={isLive}
              currentTime={currentTime}
              periodSyncs={periodSyncs}
              setPeriodSyncs={setPeriodSyncs}
              activePeriodId={liveClock.matchPeriod}
              periods={liveClock.periods}
              clockDetails={liveClock.getMatchClockDetails()}
              clockState={liveClock.matchClockState}
              tagEvents={tagEvents}
              setTagEvents={setTagEvents}
              tags={tags}
              labels={labels}
              selectedEventIds={selectedEventIds}
              setSelectedEventIds={setSelectedEventIds}
              handleEventClick={handleEventClick}
              handleEventContextMenu={handleEventContextMenu}
              timelineZoom={timelineZoom}
              showTimelineTags={showTimelineTags}
              markers={markers}
              setMarkers={setMarkers}
              onTogglePlay={liveClock.toggleLiveClock}
              lastTagActionTimestamp={lastTagActionTimestamp}
            />
          ) : isTimelineExpanded ? (
            // EXPANDED MULTI-LAYER TIMELINE
            <div className="flex-1 flex min-h-0 relative group/timeline bg-[#0a0a0a]">
              {/* Left Sidebar (Track Headers) */}
              <div className="w-28 bg-[#111] border-r border-[#222] shrink-0 flex flex-col relative z-40 shadow-[4px_0_15px_rgba(0,0,0,0.5)]">
                {/* Header for sticky ruler alignment */}
                <div className="h-6 border-b border-white/5 bg-[#111]/80 backdrop-blur-md sticky top-0 shrink-0" />

                {/* Track rows */}
                <div className="flex-1 flex flex-col py-2 space-y-1 px-2 relative z-10 pointer-events-none">
                  {showTimelineTags &&
                    timelineLanes.map((_, i) => (
                      <div
                        key={i}
                        className="h-6 flex items-center gap-1.5 text-[10px] font-medium text-gray-300 pointer-events-auto shrink-0"
                      >
                        {i === 0 ? <Video className="w-3 h-3 text-gray-400" /> : <div className="w-3 h-3" />}
                        <span className="truncate">{i === 0 ? 'Tag Tracks' : `Track ${i + 1}`}</span>
                      </div>
                    ))}

                  {!isLive && showTimelineFreezeFrames && (
                    <div className="h-6 flex items-center gap-1.5 text-[10px] font-medium text-gray-300 pointer-events-auto shrink-0 border-t border-white/5 pt-1 mt-1">
                      <Snowflake className="w-3 h-3 text-gray-400" />
                      <span className="truncate">Freeze Frames</span>
                    </div>
                  )}

                  <div className="h-6 flex items-center justify-between group pointer-events-auto shrink-0 border-t border-white/5 pt-1 mt-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-300 truncate">
                      <MapPin className="w-3 h-3 text-gray-400" />
                      <span>Notes</span>
                    </div>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setMarkerModal({
                          isOpen: true,
                          x: 0,
                          y: 0,
                          mode: 'create',
                          time: currentTime,
                          tempLabel: '',
                          tempColor: '#3b82f6',
                        });
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-all shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Scrollable Timeline Area */}
              <div
                ref={expandedTimelineContainerRef}
                className="flex-1 relative overflow-auto bg-[#0a0a0a] scroll-smooth"
              >
                <div
                  style={{ width: `${timelineZoom * 100}%`, minWidth: '100%', minHeight: '100%' }}
                  className="relative flex flex-col"
                >
                  {/* Time Ruler (Top) */}
                  <div className="h-6 border-b border-white/5 bg-[#111]/80 backdrop-blur-md sticky top-0 w-full shrink-0 z-30 shadow-sm">
                    {/* Ticks logic */}
                    <div className="absolute inset-0 opacity-40 pointer-events-none flex items-end">
                      {[...Array(Math.floor(Math.max(5, 20 / (timelineZoom > 30 ? 2 : 1)) * timelineZoom))].map(
                        (_, i, arr) => {
                          const pct = (i / (arr.length - 1)) * 100 || 0;
                          return (
                            <div
                              key={i}
                              className="absolute h-full flex flex-col items-center justify-end pb-1 gap-0.5 -translate-x-1/2"
                              style={{ left: `${pct}%` }}
                            >
                              <div className="w-[1px] h-1.5 bg-gray-500 rounded-full" />
                              <span className="text-[9px] text-gray-500 font-mono tracking-wider font-medium">
                                {formatTime((duration / Math.max(1, arr.length - 1)) * i)}
                              </span>
                            </div>
                          );
                        }
                      )}
                    </div>
                    <div
                      className="absolute inset-0 w-full h-full cursor-ew-resize z-50"
                      onMouseDown={handleScrubStart}
                      onContextMenu={handleTimelineContextMenu}
                    />
                  </div>

                  {/* Dynamic Tracks Area */}
                  <div
                    className="flex-1 relative w-full pb-8 bg-gradient-to-b from-[#0a0a0a] to-[#050505] cursor-crosshair select-none"
                    onMouseDown={handleTimelineMarqueeStart}
                    onContextMenu={handleTimelineContextMenu}
                  >
                    {/* Marquee Drag Selection Box (Expanded Timeline) */}
                    {timelineMarquee && (
                      <div
                        className="absolute top-0 bottom-0 pointer-events-none z-40 bg-[#c6ff1f]/15 border-2 border-[#c6ff1f] rounded shadow-[0_0_20px_rgba(198,255,31,0.35)] backdrop-blur-[0.5px] transition-all flex items-start justify-center"
                        style={{
                          left: `${
                            (Math.min(timelineMarquee.startTime, timelineMarquee.currentTime) /
                              (duration || 1)) *
                            100
                          }%`,
                          width: `${Math.max(
                            0.2,
                            (Math.abs(timelineMarquee.currentTime - timelineMarquee.startTime) /
                              (duration || 1)) *
                              100
                          )}%`,
                        }}
                      >
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-[#141416]/95 border border-[#c6ff1f]/60 text-[#c6ff1f] text-[10px] font-mono font-bold rounded-full shadow-2xl whitespace-nowrap z-50 flex items-center gap-1.5">
                          <span>
                            {formatTime(Math.min(timelineMarquee.startTime, timelineMarquee.currentTime))} -{' '}
                            {formatTime(Math.max(timelineMarquee.startTime, timelineMarquee.currentTime))}
                          </span>
                          <span className="text-gray-300 font-normal">
                            ({Math.abs(timelineMarquee.currentTime - timelineMarquee.startTime).toFixed(1)}s)
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Grid Lines */}
                    <div className="absolute inset-0 opacity-5 pointer-events-none z-0">
                      {[...Array(Math.floor(Math.max(10, 40 / (timelineZoom > 30 ? 4 : 1)) * timelineZoom))].map(
                        (_, i, arr) => {
                          const pct = (i / (arr.length - 1)) * 100 || 0;
                          return (
                            <div
                              key={i}
                              className="absolute top-0 bottom-0 w-[1px] bg-white -translate-x-1/2 dashed"
                              style={{ left: `${pct}%` }}
                            />
                          );
                        }
                      )}
                    </div>

                    {/* Playhead (Spanning all tracks) */}
                    <motion.div
                      className="absolute top-0 bottom-0 z-50 flex items-start justify-center"
                      style={{ left: `${(currentTime / (duration || 1)) * 100}%` }}
                      transition={{ type: 'tween', ease: 'linear', duration: 0.1 }}
                    >
                      <div
                        className="absolute top-0 bottom-0 w-6 cursor-ew-resize -translate-x-1/2 group/playhead"
                        onMouseDown={e => {
                          e.stopPropagation();
                          handleScrubStart(e);
                        }}
                      >
                        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)] pointer-events-none" />
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-red-500 rounded-full shadow-[0_0_12px_rgba(239,68,68,1)] border-[3px] border-[#111] group-hover/playhead:scale-125 transition-transform pointer-events-none" />
                      </div>
                    </motion.div>

                    {/* Dynamic Lanes */}
                    <div className="absolute top-0 left-0 right-0 py-2 space-y-1 px-1">
                      {showTimelineTags &&
                        timelineLanes.map((lane, laneIndex) => (
                          <div
                            key={laneIndex}
                            className="relative h-6 w-full z-10 bg-white/5 rounded-full shadow-inner border border-white/5 backdrop-blur-sm shrink-0"
                          >
                            {lane.map(evt => {
                              const tag = tags.find(t => t.id === evt.tagId);
                              const startPct = (evt.startTime / (duration || 1)) * 100;
                              const widthPct = ((evt.endTime - evt.startTime) / (duration || 1)) * 100;
                              const isSelected = selectedEventIds.has(evt.id);
                              const isRecording = evt.id.startsWith('RECORDING_PSEUDO');

                              return (
                                <div
                                  key={evt.id}
                                  draggable={!isRecording}
                                  onDragStart={e => !isRecording && handleTimelineEventDragStart(e, evt.id)}
                                  style={{
                                    left: `${startPct}%`,
                                    width: `${Math.max(widthPct, 0.1)}%`,
                                    backgroundColor: isSelected ? '#fff' : fadeColor(tag?.color || '#888', 0.85),
                                    borderColor: tag?.color || '#888',
                                  }}
                                  className={`group/tagevent absolute top-0.5 bottom-0.5 rounded-full cursor-pointer transition-all hover:scale-y-110 hover:z-50 flex items-center justify-center overflow-hidden shadow-md border
                                    ${
                                      isSelected
                                        ? 'z-40 ring-2 ring-white ring-offset-2 ring-offset-[#0a0a0a]'
                                        : 'opacity-90 hover:brightness-125'
                                    }
                                    ${isRecording ? 'animate-pulse border-r-4 border-r-white' : ''}
                                  `}
                                  onClick={e => !isRecording && handleEventClick(e, evt.id, evt.startTime)}
                                  onContextMenu={e => !isRecording && handleEventContextMenu(e, evt.id)}
                                  title={!isRecording ? `${tag?.name || 'Event'} (${formatTime(evt.startTime)} – ${formatTime(evt.endTime)}) • Drag into Playlist to insert between clips` : undefined}
                                >
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                                  <span
                                    className={`text-[10px] font-bold truncate px-1 select-none z-10 w-full text-center flex items-center justify-center gap-1 ${
                                      isSelected ? 'text-gray-950' : 'text-white drop-shadow-md'
                                    }`}
                                  >
                                    <span className="truncate">{tag?.name} {isRecording && '(REC)'}</span>
                                    {evt.notes && evt.notes.trim().length > 0 && !isRecording && (
                                      <span
                                        className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full shrink-0 border ${
                                          isSelected
                                            ? 'bg-black/15 text-gray-900 border-black/25'
                                            : 'bg-[#090a0d]/80 text-white border-white/35 shadow-xs'
                                        }`}
                                        title={`Note: ${evt.notes}`}
                                      >
                                        <FileText className="w-2 h-2 stroke-[2.5]" />
                                      </span>
                                    )}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ))}

                      {!isLive && showTimelineFreezeFrames && (
                        <div className="relative h-6 w-full z-10 pointer-events-none shrink-0 border-t border-white/5 pt-1 mt-1 bg-[#0a0a0a]">
                          {[...freezeFrames]
                            .sort((a, b) => a.timestamp - b.timestamp)
                            .map((ff, index, sortedArr) => {
                              const isActive = activeFreezeFrameId === ff.id;
                              const isNext = !isActive && ff.id === justNextFFId;
                              const isJustPassed = !isActive && ff.id === justPassedFFId;
                              const isOlderPassed = !isActive && !isJustPassed && ff.timestamp < currentTime;
                              const isHovered = hoveredFreezeFrameId === ff.id && !isActive;

                              let bgColor = '#c6ff1f';
                              let shadowStyle = '0 0 8px rgba(198,255,31,0.8)';
                              let ringClass = 'border border-white/20';
                              let animClass = '';
                              let scaleClass = isHovered ? 'scale-125 z-50' : 'hover:scale-125';
                              let label = `Freeze Frame @ ${formatTime(ff.timestamp)}`;

                              if (isActive) {
                                bgColor = '#f59e0b';
                                shadowStyle = '0 0 14px rgba(245,158,11,1)';
                                ringClass = 'ring-2 ring-amber-400 border border-white/40';
                                animClass = 'animate-pulse';
                                scaleClass = 'scale-125 z-50';
                                label = `ACTIVE Freeze Frame @ ${formatTime(ff.timestamp)}`;
                              } else if (isNext) {
                                bgColor = '#22c55e';
                                shadowStyle = '0 0 14px rgba(34,197,94,1)';
                                ringClass = 'ring-2 ring-emerald-400 border border-white/40';
                                animClass = 'animate-pulse';
                                scaleClass = 'scale-125 z-50';
                                label = `NEXT Freeze Frame (in ${Math.max(
                                  0,
                                  ff.timestamp - currentTime
                                ).toFixed(1)}s) @ ${formatTime(ff.timestamp)}`;
                              } else if (isJustPassed) {
                                bgColor = '#a855f7';
                                shadowStyle = '0 0 12px rgba(168,85,247,0.9)';
                                ringClass = 'ring-2 ring-violet-400 border border-white/30';
                                scaleClass = 'scale-125 z-50';
                                label = `PASSED Freeze Frame (+${Math.max(
                                  0,
                                  currentTime - ff.timestamp
                                ).toFixed(1)}s) @ ${formatTime(ff.timestamp)}`;
                              } else if (isOlderPassed) {
                                bgColor = '#c6ff1f';
                                shadowStyle = '0 0 8px rgba(198,255,31,0.8)';
                                ringClass = 'border border-white/20';
                                label = `Passed Freeze Frame @ ${formatTime(ff.timestamp)}`;
                              }

                              return (
                                <div
                                  key={ff.id}
                                  className={`absolute top-1 bottom-1 w-2 rounded-full cursor-pointer pointer-events-auto transition-all ${scaleClass} ${animClass} ${ringClass}`}
                                  style={{
                                    left: `${(ff.timestamp / (duration || 1)) * 100}%`,
                                    backgroundColor: bgColor,
                                    boxShadow: shadowStyle,
                                    transform: 'translateX(-50%)',
                                  }}
                                  onMouseEnter={() => {
                                    setHoveredFreezeFrameId(ff.id);
                                  }}
                                  onMouseLeave={() => {
                                    setHoveredFreezeFrameId(null);
                                  }}
                                  onClick={e => {
                                    e.stopPropagation();
                                    setActiveFreezeFrameId(ff.id);
                                    setCountdownValue(ff.duration || 5);
                                    setIsFreezeFramePlaying(false);
                                    jumpToMarker(ff.timestamp);
                                    if (videoRef.current) {
                                      videoRef.current.pause();
                                      setIsPlaying(false);
                                    }
                                  }}
                                  title={label}
                                />
                              );
                            })}
                        </div>
                      )}

                      {/* Markers Row */}
                      <div className="relative h-6 w-full z-40 pointer-events-none shrink-0 border-t border-white/5 pt-1 mt-1">
                        {markers.map(marker => (
                          <div
                            key={marker.id}
                            className="absolute top-0 bottom-0 w-[2px] pointer-events-none transition-colors"
                            style={{
                              left: `${(marker.time / (duration || 1)) * 100}%`,
                              backgroundColor: `${marker.color}80`,
                            }}
                          >
                            <div
                              className="absolute -top-1 -ml-[11px] pointer-events-auto cursor-pointer transition-transform hover:scale-110 flex items-center justify-center w-6 h-6 rounded-full"
                              onClick={e => {
                                e.stopPropagation();
                                jumpToMarker(marker.time);
                                setMarkerModal({
                                  isOpen: true,
                                  x: 0,
                                  y: 0,
                                  mode: 'edit',
                                  markerId: marker.id,
                                  tempLabel: marker.label,
                                  tempColor: marker.color,
                                });
                              }}
                              onMouseEnter={() => setHoveredNoteId(marker.id)}
                              onMouseLeave={() => setHoveredNoteId(null)}
                            >
                              <MapPin
                                className="w-5 h-5 drop-shadow-md"
                                style={{ color: marker.color, fill: `${marker.color}30` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // COLLAPSED SIMPLE TIMELINE
            <div className="h-16 relative w-full group/timeline bg-[#0a0a0a] border-b border-[#222] flex flex-col justify-center px-4 overflow-hidden shadow-inner">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover/timeline:opacity-100 pointer-events-none transition-opacity duration-500" />

              {/* Event Trimmer handled at top-level playbar */}

              {/* Standard Timeline (Hidden if trimming) */}
              {!(
                selectedEventIds.size === 1 &&
                !isMultiSelectAction &&
                playbarEventId === Array.from(selectedEventIds)[0] &&
                tagEvents.some(e => e.id === playbarEventId)
              ) && (
                <div
                  className="relative h-12 w-full flex flex-col justify-end overflow-hidden"
                  ref={timelineContainerRef}
                >
                  <div className="relative h-full" style={{ width: `${timelineZoom * 100}%` }}>
                    {/* YouTube Style Scrubber Line (Safe Zone) */}
                    <div
                      className="absolute top-0 left-0 w-full h-4 z-50 cursor-ew-resize group/scrubber flex items-center"
                      onMouseDown={handleScrubStart}
                      onContextMenu={handleTimelineContextMenu}
                    >
                      <div className="relative w-full h-[3px] bg-white/20 group-hover/scrubber:h-1.5 transition-all rounded-full hover:bg-white/30">
                        <div
                          className="absolute top-0 bottom-0 left-0 bg-red-500 rounded-full"
                          style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                        />
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-red-500 rounded-full opacity-0 group-hover/scrubber:opacity-100 transition-opacity shadow-[0_0_8px_rgba(239,68,68,0.8)] border border-white/50 pointer-events-none"
                          style={{ left: `calc(${(currentTime / (duration || 1)) * 100}% - 6px)` }}
                        />
                      </div>
                    </div>

                    {/* Events Container (Supports Marquee Box Selection on drag) */}
                    <div
                      className="absolute bottom-0 left-0 w-full h-8 bg-[#111] rounded-xl border border-white/10 shadow-inner overflow-hidden cursor-crosshair select-none"
                      onMouseDown={handleTimelineMarqueeStart}
                    >
                      {/* Marquee Drag Selection Box (Collapsed Timeline) */}
                      {timelineMarquee && (
                        <div
                          className="absolute top-0 bottom-0 pointer-events-none z-40 bg-[#c6ff1f]/20 border-2 border-[#c6ff1f] rounded-lg shadow-[0_0_16px_rgba(198,255,31,0.45)] backdrop-blur-[0.5px]"
                          style={{
                            left: `${
                              (Math.min(timelineMarquee.startTime, timelineMarquee.currentTime) /
                                (duration || 1)) *
                              100
                            }%`,
                            width: `${Math.max(
                              0.2,
                              (Math.abs(timelineMarquee.currentTime - timelineMarquee.startTime) /
                                (duration || 1)) *
                                100
                            )}%`,
                          }}
                        />
                      )}

                      {/* Playhead vertical indicator line */}
                      <motion.div
                        className="absolute top-0 bottom-0 w-[2px] bg-red-500/80 z-50 pointer-events-none"
                        style={{ left: `${(currentTime / (duration || 1)) * 100}%` }}
                        transition={{ type: 'tween', ease: 'linear', duration: 0.1 }}
                      />

                      {/* Live Recording Overlay */}
                      {isTaggingMode &&
                        activeRecordings.map(rec => (
                          <div
                            key={rec.tagId}
                            style={{
                              left: `${(Math.min(rec.startTime, currentTime) / (duration || 1)) * 100}%`,
                              width: `${(Math.abs(currentTime - rec.startTime) / (duration || 1)) * 100}%`,
                              backgroundColor: tags.find(t => t.id === rec.tagId)?.color || 'red',
                            }}
                            className="absolute top-0 bottom-0 opacity-30 z-0 pointer-events-none animate-pulse bg-gradient-to-r from-transparent to-current"
                          />
                        ))}

                      {/* Ticks/Grid */}
                      <div className="absolute inset-0 flex justify-between items-center px-1 opacity-20 pointer-events-none">
                        {[...Array(40)].map((_, i) => (
                          <div key={i} className="w-1 h-1 rounded-full bg-white" />
                        ))}
                      </div>

                      {/* Events Layer */}
                      {showTimelineTags && (
                        <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-6 pointer-events-none z-10 px-0.5">
                          {tagEvents
                            .filter(evt => {
                              let match = true;
                              if (filterTagId && evt.tagId !== filterTagId) match = false;
                              if (filterLabelId && (!evt.labelIds || !evt.labelIds.includes(filterLabelId)))
                                match = false;
                              return match;
                            })
                            .map(evt => {
                              const tag = tags.find(t => t.id === evt.tagId);
                              const startPct = (evt.startTime / (duration || 1)) * 100;
                              const widthPct = ((evt.endTime - evt.startTime) / (duration || 1)) * 100;
                              const isSelected = selectedEventIds.has(evt.id);

                              return (
                                <div
                                  key={evt.id}
                                  draggable
                                  onDragStart={e => handleTimelineEventDragStart(e, evt.id)}
                                  style={{
                                    left: `${startPct}%`,
                                    width: `${Math.max(widthPct, 0.4)}%`,
                                    backgroundColor: tag?.color || '#fff',
                                  }}
                                  className={`absolute top-0 bottom-0 cursor-pointer pointer-events-auto transition-all hover:scale-y-115 hover:z-50 rounded-full group/tagevent shadow-sm border border-black/20
                                    ${
                                      isSelected
                                        ? 'ring-2 ring-white z-40 opacity-100 brightness-125'
                                        : 'opacity-85 hover:opacity-100 hover:brightness-110'
                                    }
                                  `}
                                  onClick={e => handleEventClick(e, evt.id, evt.startTime)}
                                  onContextMenu={e => handleEventContextMenu(e, evt.id)}
                                >
                                  <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent rounded-full pointer-events-none" />
                                  {evt.notes && evt.notes.trim().length > 0 && (
                                    widthPct * timelineZoom >= 1.5 ? (
                                      <span className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden rounded-full z-20 px-0.5">
                                        <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#090a0d]/85 border border-white/40 shadow-sm shrink-0">
                                          <FileText className="w-2 h-2 text-white stroke-[2.5]" />
                                        </span>
                                      </span>
                                    ) : (
                                      <span className="absolute inset-x-0 top-0 h-[4px] bg-[#090a0d]/90 border-b border-white/85 rounded-t-full pointer-events-none z-20" />
                                    )
                                  )}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-black/90 text-white text-[10px] font-medium rounded-lg whitespace-nowrap opacity-0 group-hover/tagevent:opacity-100 pointer-events-none transition-all duration-200 border border-white/10 z-50 shadow-xl backdrop-blur-sm transform translate-y-1 group-hover/tagevent:translate-y-0">
                                    {tag?.name}{' '}
                                    {evt.labelIds && evt.labelIds.length > 0 && (
                                      <span className="text-[#c6ff1f]">
                                        {' '}
                                        -{' '}
                                        {evt.labelIds
                                          .map(id => labels.find(l => l.id === id)?.name)
                                          .filter(Boolean)
                                          .join(', ')}
                                      </span>
                                    )}{' '}
                                    <span className="text-gray-400 ml-1">
                                      ({(evt.endTime - evt.startTime).toFixed(1)}s)
                                    </span>
                                    {evt.notes && evt.notes.trim().length > 0 && (
                                      <span className="text-amber-300 ml-1.5 italic">
                                        • "{evt.notes.length > 35 ? `${evt.notes.slice(0, 35)}…` : evt.notes}"
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}

                      {/* Freeze Frames Layer */}
                      {!isLive && showTimelineFreezeFrames && (
                        <div className="absolute top-0 bottom-0 left-0 w-full pointer-events-none z-30">
                          {[...freezeFrames]
                            .sort((a, b) => a.timestamp - b.timestamp)
                            .map((ff, index, sortedArr) => {
                              const isActive = activeFreezeFrameId === ff.id;
                              const isHovered = hoveredFreezeFrameId === ff.id && !isActive;
                              const isNext = !isActive && ff.id === justNextFFId;
                              const isJustPassed = !isActive && ff.id === justPassedFFId;
                              const isOlderPassed = !isActive && !isJustPassed && ff.timestamp < currentTime;

                              const prevFF = index > 0 ? sortedArr[index - 1] : null;
                              const deltaFromPrev = prevFF ? ff.timestamp - prevFF.timestamp : null;
                              const isClustered = deltaFromPrev !== null && deltaFromPrev < 0.6;
                              const staggerTopClass = isClustered && index % 2 === 1 ? '-top-5.5' : '-top-3';

                              let markerClass = 'absolute top-0 bottom-0 transition-all ';
                              let badgeClass =
                                'w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shadow-md border mb-0.5 ';
                              let iconClass = 'w-3 h-3 ';
                              let statusTag: string | null = null;
                              let statusTagClass = '';

                              if (isActive) {
                                markerClass += 'bg-amber-400 w-1 shadow-[0_0_14px_rgba(245,158,11,1)] z-50';
                                badgeClass +=
                                  'bg-amber-500 text-white border-amber-300 ring-1 ring-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.8)]';
                                iconClass +=
                                  'text-amber-300 fill-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.9)] animate-pulse';
                                statusTag = 'ACTIVE';
                                statusTagClass = 'bg-amber-500 text-black border-amber-300 font-black';
                              } else if (isNext) {
                                markerClass +=
                                  'bg-emerald-400 w-1 shadow-[0_0_14px_rgba(34,197,94,1)] z-50 animate-pulse';
                                badgeClass +=
                                  'bg-emerald-500 text-white border-emerald-300 ring-1 ring-emerald-400 shadow-[0_0_10px_rgba(34,197,94,0.8)]';
                                iconClass +=
                                  'text-emerald-300 fill-emerald-300 drop-shadow-[0_0_8px_rgba(34,197,94,0.9)]';
                                statusTag = 'NEXT';
                                statusTagClass =
                                  'bg-emerald-500 text-black border-emerald-300 font-black animate-pulse';
                              } else if (isJustPassed) {
                                markerClass += 'bg-violet-400 w-1 shadow-[0_0_12px_rgba(168,85,247,0.9)] z-50';
                                badgeClass +=
                                  'bg-violet-500 text-white border-violet-300 ring-1 ring-violet-400 shadow-[0_0_10px_rgba(168,85,247,0.7)]';
                                iconClass +=
                                  'text-violet-300 fill-violet-300 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]';
                                statusTag = 'PASSED';
                                statusTagClass = 'bg-violet-500 text-white border-violet-300 font-bold';
                              } else if (isOlderPassed) {
                                markerClass +=
                                  'bg-[#c6ff1f] group/ffmarker shadow-[0_0_8px_rgba(198,255,31,0.8)] w-0.5';
                                badgeClass += 'bg-[#c6ff1f] text-black border-white/20';
                                iconClass += 'text-[#a0d600] fill-[#c6ff1f] drop-shadow-md';
                              } else if (isHovered) {
                                markerClass +=
                                  'bg-[#c6ff1f] w-1 shadow-[0_0_12px_rgba(198,255,31,0.9)] z-50';
                                badgeClass += 'bg-[#c6ff1f] text-black border-white/40 ring-1 ring-[#c6ff1f]';
                                iconClass +=
                                  'text-white fill-[#c6ff1f] drop-shadow-[0_0_5px_rgba(198,255,31,0.8)]';
                              } else {
                                markerClass +=
                                  'bg-[#c6ff1f] group/ffmarker shadow-[0_0_8px_rgba(198,255,31,0.8)] w-0.5';
                                badgeClass += 'bg-[#c6ff1f] text-black border-white/20';
                                iconClass += 'text-[#a0d600] fill-[#c6ff1f] drop-shadow-md';
                              }

                              const deltaBadge = deltaFromPrev !== null && deltaFromPrev < 1.0 ? ` (+${Math.round(deltaFromPrev * 1000)}ms)` : '';

                              return (
                                <div
                                  key={ff.id}
                                  style={{ left: `${(ff.timestamp / (duration || 1)) * 100}%` }}
                                  className={`${markerClass} pointer-events-auto cursor-pointer`}
                                  onMouseEnter={() => {
                                    setHoveredFreezeFrameId(ff.id);
                                  }}
                                  onMouseLeave={() => {
                                    setHoveredFreezeFrameId(null);
                                  }}
                                  onClick={e => {
                                    e.stopPropagation();
                                    setActiveFreezeFrameId(ff.id);
                                    setCountdownValue(ff.duration || 5);
                                    setIsFreezeFramePlaying(false);
                                    jumpToMarker(ff.timestamp);
                                    if (videoRef.current) {
                                      videoRef.current.pause();
                                      setIsPlaying(false);
                                    }
                                  }}
                                  title={`${statusTag ? `[${statusTag}] ` : ''}Freeze Frame #${
                                    index + 1
                                  } @ ${formatTime(ff.timestamp)}${deltaBadge}`}
                                >
                                  <div
                                    className={`absolute ${staggerTopClass} left-1/2 -translate-x-1/2 flex flex-col items-center transition-all ${
                                      isActive || isHovered || isNext || isJustPassed ? 'scale-125 z-50' : ''
                                    }`}
                                  >
                                    {statusTag && (
                                      <div
                                        className={`absolute -top-3 px-1 py-0.2 rounded text-[6.5px] leading-tight uppercase tracking-tighter whitespace-nowrap shadow-sm border ${statusTagClass}`}
                                      >
                                        {statusTag}
                                      </div>
                                    )}
                                    <div className={badgeClass}>{index + 1}</div>
                                    <Snowflake className={iconClass} />
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}

                      {/* Synced Period Kick-off Flags Layer */}
                      {!isLive && duration > 0 && periodSyncs.some(ps => !ps.needsVideoSync) && (
                        <div className="absolute top-0 bottom-0 left-0 w-full pointer-events-none z-35">
                          {periodSyncs
                            .filter(
                              ps =>
                                !ps.needsVideoSync &&
                                ps.videoTimeSeconds >= 0 &&
                                ps.videoTimeSeconds <= duration
                            )
                            .map(ps => {
                              const pInfo = getCanonicalPeriod(ps.id);
                              const pct = (ps.videoTimeSeconds / (duration || 1)) * 100;
                              return (
                                <div
                                  key={`ps-flag-${ps.id}`}
                                  style={{ left: `${pct}%` }}
                                  className="absolute top-0 bottom-0 w-[1.5px] bg-indigo-400/80 pointer-events-auto cursor-pointer group/psflag shadow-[0_0_8px_rgba(129,140,248,0.6)]"
                                  onClick={e => {
                                    e.stopPropagation();
                                    jumpToMarker(ps.videoTimeSeconds);
                                  }}
                                  title={`${ps.name} @ ${formatSyncClock(ps.videoTimeSeconds)} — Click to jump`}
                                >
                                  <span className="absolute top-0.5 left-1 px-1 py-0.2 rounded bg-indigo-600/90 text-white text-[8px] font-mono font-bold tracking-tight border border-indigo-400/50 shadow-sm whitespace-nowrap">
                                    {pInfo?.shortLabel || ps.id}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      )}

                      {/* Markers Layer */}
                      {showTimelineTags && (
                        <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-8 pointer-events-none z-40">
                          {markers.map(marker => (
                            <div
                              key={marker.id}
                              style={{
                                left: `${(marker.time / (duration || 1)) * 100}%`,
                                backgroundColor: marker.color,
                              }}
                              className="absolute top-0 bottom-0 w-0.5 pointer-events-auto hover:w-1 transition-all cursor-pointer group/marker shadow-md"
                              onClick={e => {
                                e.stopPropagation();
                                jumpToMarker(marker.time);
                              }}
                              onContextMenu={e => handleMarkerContextMenu(e, marker)}
                            >
                              <div
                                className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full border border-[#111] shadow-sm"
                                style={{ backgroundColor: marker.color }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Layer 2: Controls or Trimmer when Expanded / Live */}
          {isTrimmingActive && activeTrimEvent ? (
            renderEventTrimmer('h-[113px] shrink-0 border-t border-[#222]')
          ) : isLive ? (
            <LiveCodingBottomBar
              clockDetails={liveClock.getMatchClockDetails()}
              clockState={liveClock.matchClockState}
              activePeriod={liveClock.activePeriodDef}
              tagEventsCount={tagEvents.length}
              timelineZoom={timelineZoom}
              handleZoomIn={handleZoomIn}
              handleZoomOut={handleZoomOut}
              showTimelineFiltersMenu={showTimelineFiltersMenu}
              setShowTimelineFiltersMenu={setShowTimelineFiltersMenu}
              showTimelineTags={showTimelineTags}
              setShowTimelineTags={setShowTimelineTags}
              onTogglePlay={() => liveClock.toggleLiveClock()}
              onStartEditing={() => liveClock.setIsEditingTimer(true)}
              onPopoutTimer={() => {
                setIsTimerPoppedOut(true);
                showNotification('Timer popped out into floating resizable window overlay!', '#c6ff1f');
              }}
              onPopoutPad={() => {
                setIsPadPoppedOut(true);
                showNotification(
                  'Coding component popped out into floating resizable window overlay!',
                  '#c6ff1f'
                );
              }}
              onImportVideo={handleImportMatchVideo}
            />
          ) : (
            <WorkspaceBottomBar
              jumpPrevEvent={jumpPrevEvent}
              jumpNextEvent={jumpNextEvent}
              handleManualSeek={handleManualSeek}
              togglePlay={togglePlay}
              isPlaying={activeFreezeFrameId ? isFreezeFramePlaying : isPlaying}
              currentTime={currentTime}
              duration={duration}
              timelineZoom={timelineZoom}
              handleZoomIn={handleZoomIn}
              handleZoomOut={handleZoomOut}
              playbackRate={playbackRate}
              setPlaybackRate={setPlaybackRate}
              showTimelineFiltersMenu={showTimelineFiltersMenu}
              setShowTimelineFiltersMenu={setShowTimelineFiltersMenu}
              showTimelineFreezeFrames={showTimelineFreezeFrames}
              setShowTimelineFreezeFrames={setShowTimelineFreezeFrames}
              showTimelineTags={showTimelineTags}
              setShowTimelineTags={setShowTimelineTags}
              isTimelineExpanded={isTimelineExpanded}
              setIsTimelineExpanded={setIsTimelineExpanded}
              isMuted={isMuted}
              toggleMute={toggleMute}
              volume={volume}
              setVolume={setVolume}
              videoRef={videoRef}
              setIsMuted={setIsMuted}
              isLive={isLive}
            />
          )}
        </>
      )}
    </motion.div>
  );
};
