import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Film, Video, RefreshCw, Plus, MapPin } from 'lucide-react';
import { saveVideoLocally } from '../../../utils/db';
import { formatTime } from '../../../utils/math';
import { LiveCodingCenterView, useLiveClock } from '../LiveCoding';
import { BatchVideoRelinker } from '../../Batches/BatchVideoRelinker';
import { ActiveRecordingsBar } from '../ActiveRecordingsBar';
import { PresentationHUD, PresentationConfig } from '../Presentation';
import { EditorWatermarkCanvas } from '../../Shared/EditorWatermarkCanvas';
import type {
  Project,
  ToolType,
  Point,
  MaskSettings,
  TagEvent,
  Tag as TagData,
  Label,
  TimelineMarker,
  ActiveRecording,
  Playlist,
} from '../../../types';
import type {
  WorkspaceBatchModeProps,
  DraggingHandleState,
  AutoplayState,
  EventNotificationState,
} from '../Workspace.types';

export interface WorkspaceViewportProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  ghostCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  isPresentationMode: boolean;
  tool: ToolType;
  setSelectedShapeId: React.Dispatch<React.SetStateAction<string | null>>;
  setDraggingHandle: React.Dispatch<React.SetStateAction<DraggingHandleState>>;
  videoUrl: string | null;
  duration: number;
  setDuration: React.Dispatch<React.SetStateAction<number>>;
  isLive: boolean;
  project: Project;
  loadElapsedSec: number;
  isVideoBuffering: boolean;
  setIsVideoBuffering: React.Dispatch<React.SetStateAction<boolean>>;
  liveClock: ReturnType<typeof useLiveClock>;
  batchMode?: WorkspaceBatchModeProps;
  handleTimeUpdate: () => void;
  handleLoadedMetadata: () => void;
  pendingSeekTimeRef: React.MutableRefObject<number | null>;
  pendingPlayRef: React.MutableRefObject<boolean>;
  currentTime: number;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  autoplay: AutoplayState;
  isScrubbingRef: React.MutableRefObject<boolean>;
  activeFreezeFrameId: string | null;
  clearMaskCache: () => void;
  pendingScrubVideoTimeRef: React.MutableRefObject<number | null>;
  maskSettings: MaskSettings;
  computeMaskingLayers: () => void;
  isPickingColor: boolean;
  startDrawing: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  drawPreview: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  finishDrawing: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  setIsDrawing: React.Dispatch<React.SetStateAction<boolean>>;
  mousePosRef: React.MutableRefObject<Point | null>;
  handleDoubleClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleContextMenu: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleCanvasClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  eventNotification: EventNotificationState | null;
  setEventNotification: React.Dispatch<React.SetStateAction<EventNotificationState | null>>;
  selectedEventIds: Set<string>;
  tagEvents: TagEvent[];
  hoveredNoteId: string | null;
  markers: TimelineMarker[];
  isTaggingMode: boolean;
  activeRecordings: ActiveRecording[];
  setActiveRecordings: React.Dispatch<React.SetStateAction<ActiveRecording[]>>;
  tags: TagData[];
  labels: Label[];
  handleTagClick: (tagId: string, options?: { ignoreLeadLag?: boolean }) => void;
  isPadQuickTagEnabled: boolean;
  labelsActiveTargetTab: string;
  setLabelsActiveTargetTab: React.Dispatch<React.SetStateAction<string>>;
  isScreenRecording: boolean;
  recordingError: string | null;
  setRecordingError: React.Dispatch<React.SetStateAction<string | null>>;
  currentPresentationPlaylist: Playlist | undefined;
  presentationPlaylistIndex: number;
  presentationPlaylists: Playlist[];
  playlistPlaybarIndex: number;
  currentPresentationEvent: TagEvent | null;
  currentPresentationTiming: { startTime: number; endTime: number; duration: number } | null;
  togglePlay: () => void;
  handlePrevPresentationClip: () => void;
  handleNextPresentationClip: () => void;
  handleSelectPresentationPlaylistIndex: (idx: number) => void;
  scrubToTime: (time: number, options?: { skipModeClamp?: boolean }) => void;
  handleSeekPresentationClip: (time: number) => void;
  beginScrubSession: () => void;
  endScrubSession: () => void;
  setShowPresentationCustomizeModal: React.Dispatch<React.SetStateAction<boolean>>;
  handleExitPresentationMode: () => void;
  volume: number;
  setVolume: React.Dispatch<React.SetStateAction<number>>;
  isMuted: boolean;
  toggleMute: () => void;
  playbackRate: number;
  setPlaybackRate: React.Dispatch<React.SetStateAction<number>>;
  presentationConfig: PresentationConfig;
  setPresentationConfig: React.Dispatch<React.SetStateAction<PresentationConfig>>;
  presentationFinished: boolean;
  handleEnterPresentationMode: (fromStart?: boolean) => void;
  presentationTransitionMsg: string | null;
}

export const WorkspaceViewport: React.FC<WorkspaceViewportProps> = ({
  containerRef,
  videoRef,
  canvasRef,
  ghostCanvasRef,
  isPresentationMode,
  tool,
  setSelectedShapeId,
  setDraggingHandle,
  videoUrl,
  duration,
  setDuration,
  isLive,
  project,
  loadElapsedSec,
  isVideoBuffering,
  setIsVideoBuffering,
  liveClock,
  batchMode,
  handleTimeUpdate,
  handleLoadedMetadata,
  pendingSeekTimeRef,
  pendingPlayRef,
  currentTime,
  setCurrentTime,
  isPlaying,
  setIsPlaying,
  autoplay,
  isScrubbingRef,
  activeFreezeFrameId,
  clearMaskCache,
  pendingScrubVideoTimeRef,
  maskSettings,
  computeMaskingLayers,
  isPickingColor,
  startDrawing,
  drawPreview,
  finishDrawing,
  setIsDrawing,
  mousePosRef,
  handleDoubleClick,
  handleContextMenu,
  handleCanvasClick,
  eventNotification,
  setEventNotification,
  selectedEventIds,
  tagEvents,
  hoveredNoteId,
  markers,
  isTaggingMode,
  activeRecordings,
  setActiveRecordings,
  tags,
  labels,
  handleTagClick,
  isPadQuickTagEnabled,
  labelsActiveTargetTab,
  setLabelsActiveTargetTab,
  isScreenRecording,
  recordingError,
  setRecordingError,
  currentPresentationPlaylist,
  presentationPlaylistIndex,
  presentationPlaylists,
  playlistPlaybarIndex,
  currentPresentationEvent,
  currentPresentationTiming,
  togglePlay,
  handlePrevPresentationClip,
  handleNextPresentationClip,
  handleSelectPresentationPlaylistIndex,
  scrubToTime,
  handleSeekPresentationClip,
  beginScrubSession,
  endScrubSession,
  setShowPresentationCustomizeModal,
  handleExitPresentationMode,
  volume,
  setVolume,
  isMuted,
  toggleMute,
  playbackRate,
  setPlaybackRate,
  presentationConfig,
  setPresentationConfig,
  presentationFinished,
  handleEnterPresentationMode,
  presentationTransitionMsg,
}) => {
  return (
    <div
      ref={containerRef}
      className={
        isPresentationMode
          ? 'fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center overflow-hidden bg-black select-none'
          : 'flex-1 relative flex items-center justify-center overflow-hidden bg-black transition-all'
      }
      onMouseDown={e => {
        if (e.target === containerRef.current && (tool === 'move' || tool === null)) {
          setSelectedShapeId(null);
          setDraggingHandle(null);
        }
      }}
    >
      {Boolean(videoUrl) && duration === 0 && !isLive && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0a0a0c]/85 backdrop-blur-md p-4 transition-all duration-300">
          <div className="flex flex-col items-center bg-[#131316] border border-[#26262b] px-6 py-5 rounded-2xl shadow-2xl max-w-sm w-full text-center relative overflow-hidden animate-in fade-in zoom-in-95">
            {/* Accent Glow */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#e4ff7a] via-[#c6ff1f] to-[#a0d600]" />

            <div className="relative w-12 h-12 flex items-center justify-center mb-3">
              <div className="absolute inset-0 rounded-full border-2 border-[#c6ff1f]/20 animate-ping" />
              <div className="w-10 h-10 border-2 border-[#2b2b30] border-t-[#c6ff1f] rounded-full animate-spin" />
              <Film className="w-4 h-4 text-[#c6ff1f] absolute" />
            </div>

            <h3 className="text-sm font-bold text-white tracking-tight mb-0.5">Loading Video Stream</h3>
            <p className="text-xs text-gray-400 truncate max-w-full px-2 mb-3" title={project.fileName}>
              {project.fileName || 'Analyzing media payload...'}
            </p>

            {/* Animated Shimmer Bar */}
            <div className="w-full h-1 bg-[#222227] rounded-full overflow-hidden mb-2.5 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#c6ff1f] to-transparent w-full animate-pulse" />
            </div>

            <div className="flex items-center justify-between w-full text-[11px] text-gray-500 font-mono">
              <span>Decoding frames</span>
              <span>{loadElapsedSec > 0 ? `${loadElapsedSec}s` : 'Buffering'}</span>
            </div>

            {loadElapsedSec >= 5 && (
              <button
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current
                      .play()
                      .then(() => {
                        videoRef.current?.pause();
                        if (videoRef.current?.duration) setDuration(videoRef.current.duration);
                      })
                      .catch(() => {});
                  }
                }}
                className="mt-3 text-[11px] text-[#c6ff1f] hover:underline cursor-pointer"
              >
                Click to force playback probe
              </button>
            )}
          </div>
        </div>
      )}

      {isVideoBuffering && duration > 0 && !isLive && (
        <div className="absolute top-4 right-4 z-30 flex items-center gap-2 bg-black/75 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full text-xs text-white shadow-xl pointer-events-none animate-in fade-in">
          <div className="w-3 h-3 border-2 border-[#c6ff1f]/30 border-t-[#c6ff1f] rounded-full animate-spin" />
          <span className="font-medium text-[11px] text-gray-300">Buffering video...</span>
        </div>
      )}

      {isLive ? (
        <LiveCodingCenterView
          projectName={project.name || 'Live Match'}
          clockDetails={liveClock.getMatchClockDetails()}
          clockState={liveClock.matchClockState}
          activePeriodId={liveClock.matchPeriod}
          periods={liveClock.periods}
          maxPeriodIndex={liveClock.maxPeriodIndex}
          isEditingTimer={liveClock.isEditingTimer}
          editedTimerValue={liveClock.editedTimerValue}
          onSetEditedTimerValue={liveClock.setEditedTimerValue}
          onStartEditing={liveClock.startEditingTimer}
          onCancelEditing={() => liveClock.setIsEditingTimer(false)}
          onSaveEditing={() => liveClock.handleSaveTimer()}
          onResume={liveClock.resumeLiveClock}
          onPause={liveClock.pauseLiveClock}
          onRequestPeriod={liveClock.requestStartLiveClock}
          onAdjustTime={liveClock.adjustLiveTime}
          onNudgeTimer={liveClock.nudgeEditedTimer}
        />
      ) : !videoUrl ? (
        batchMode ? (
          <BatchVideoRelinker
            batch={batchMode.batch}
            projects={batchMode.allBatchProjects}
            activeProjectId={project.id}
            projectBlobs={batchMode.projectBlobs}
            onSelectProject={batchMode.onSelectProject}
            onRelinkSingle={async (proj, file, handle) => {
              if (batchMode.onRelinkSingleVideo) {
                await batchMode.onRelinkSingleVideo(proj, file, handle);
              } else {
                batchMode.onReloadVideo(proj);
              }
            }}
            onRelinkBatch={async mappings => {
              if (batchMode.onBatchRelinkVideos) {
                await batchMode.onBatchRelinkVideos(mappings);
              }
            }}
            isInline={true}
          />
        ) : (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0d0e12]/95 backdrop-blur-md p-6 text-center select-none">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 shadow-xl">
              <Video className="w-8 h-8" />
            </div>
            <h3 className="text-white font-bold text-base mb-1">
              Video file not loaded for "{project.name}"
            </h3>
            <p className="text-gray-400 text-xs max-w-md mb-3">
              Select or drag in the video file for this match to analyze footage.
            </p>
            {project.fileName && (
              <p className="font-mono text-[11px] text-gray-400 bg-white/5 px-3 py-1 rounded-lg border border-white/10 mb-4">
                Expected: {project.fileName}
              </p>
            )}
            <button
              onClick={() => {
                const fallback = document.createElement('input');
                fallback.type = 'file';
                fallback.accept = 'video/*';
                fallback.onchange = (e: any) => {
                  if (e.target.files?.[0]) {
                    const file = e.target.files[0];
                    saveVideoLocally(project.id, file).catch(console.error);
                    window.location.reload();
                  }
                };
                fallback.click();
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#c6ff1f] hover:bg-[#d4ff4d] text-black font-bold text-xs shadow-lg shadow-[#c6ff1f]/20 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Select Video File</span>
            </button>
          </div>
        )
      ) : (
        <video
          ref={videoRef}
          src={videoUrl}
          className="absolute max-w-none max-h-none"
          style={{
            width: containerRef.current ? '100%' : 'auto',
            height: '100%',
            objectFit: 'contain',
          }}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onWaiting={() => setIsVideoBuffering(true)}
          onPlaying={() => setIsVideoBuffering(false)}
          onLoadedData={() => {
            setIsVideoBuffering(false);
            if (videoRef.current && (!duration || duration === 0)) {
              setDuration(videoRef.current.duration);
            }
          }}
          onCanPlay={() => {
            setIsVideoBuffering(false);
            if (videoRef.current && (!duration || duration === 0)) {
              setDuration(videoRef.current.duration);
            }
            if (pendingSeekTimeRef.current !== null && videoRef.current) {
              const seekTo = pendingSeekTimeRef.current;
              pendingSeekTimeRef.current = null;
              videoRef.current.currentTime = seekTo;
              setCurrentTime(seekTo);
              if (pendingPlayRef.current || isPlaying || autoplay.active) {
                pendingPlayRef.current = false;
                setIsPlaying(true);
                videoRef.current.play().catch(e => console.log('CanPlay resume error:', e));
              }
            }
          }}
          onPlay={() => {
            if (!isScrubbingRef.current && !activeFreezeFrameId) {
              setIsPlaying(true);
              clearMaskCache();
            }
          }}
          onPause={() => {
            if (
              !isScrubbingRef.current &&
              pendingSeekTimeRef.current === null &&
              videoRef.current &&
              !videoRef.current.ended
            ) {
              setIsPlaying(false);
            }
          }}
          onSeeked={() => {
            const video = videoRef.current;
            if (isScrubbingRef.current && video && pendingScrubVideoTimeRef.current !== null) {
              const nextTime = pendingScrubVideoTimeRef.current;
              pendingScrubVideoTimeRef.current = null;
              if (Math.abs(video.currentTime - nextTime) > 0.005) {
                video.currentTime = nextTime;
                return;
              }
            }
            if (!isPlaying && !isScrubbingRef.current && video && video.paused && maskSettings.enabled) {
              computeMaskingLayers();
            }
          }}
          onEnded={() => setIsPlaying(false)}
          disablePictureInPicture
          controls={false}
          preload="auto"
          playsInline
        />
      )}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 z-10 touch-none ${
          !videoUrl || isLive || isPresentationMode ? 'pointer-events-none' : ''
        } ${!videoUrl || isLive ? 'opacity-0 hidden' : ''} ${
          isPickingColor
            ? 'cursor-crosshair'
            : tool === 'masking'
            ? 'cursor-default'
            : tool === 'eraser'
            ? 'cursor-cell'
            : tool
            ? 'cursor-crosshair'
            : 'cursor-default'
        }`}
        onMouseDown={startDrawing}
        onMouseMove={drawPreview}
        onMouseUp={finishDrawing}
        onMouseLeave={() => {
          setIsDrawing(false);
          mousePosRef.current = null;
        }}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onClick={handleCanvasClick}
        style={{ width: '100%', height: '100%' }}
      />

      <canvas
        ref={ghostCanvasRef}
        className={`absolute inset-0 z-20 pointer-events-none ${!videoUrl ? 'hidden' : ''}`}
        style={{ width: '100%', height: '100%' }}
      />

      {/* Live 1:1 Tier + Creator Watermark Overlay (matches exported & recorded video sizing) */}
      <EditorWatermarkCanvas
        containerRef={containerRef}
        videoRef={videoRef}
        visible={Boolean(videoUrl) && !isLive}
        mediaKey={videoUrl}
        zIndexClass="z-[25]"
      />

      {/* Compact Non-Intrusive Event Toast (bottom-right corner) */}
      <AnimatePresence>
        {eventNotification && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.14 }}
            className={`absolute right-2.5 ${
              selectedEventIds.size === 1 &&
              tagEvents.find(e => e.id === Array.from(selectedEventIds)[0])?.notes
                ? 'bottom-14'
                : 'bottom-2.5'
            } z-[60] max-w-xs px-2.5 py-1 rounded-md bg-[#111114]/90 border border-white/10 shadow-lg flex items-center gap-1.5 backdrop-blur-sm select-none ${
              eventNotification.onUndo || eventNotification.action ? 'pointer-events-auto' : 'pointer-events-none'
            }`}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: eventNotification.color }}
            />
            <span className="font-medium text-gray-100 text-[11px] leading-tight truncate">
              {eventNotification.message}
            </span>
            {eventNotification.action && (
              <>
                <div className="w-px h-3 bg-white/15 mx-0.5 shrink-0" />
                <button
                  onClick={e => {
                    e.stopPropagation();
                    const action = eventNotification.action;
                    setEventNotification(null);
                    action?.onClick();
                  }}
                  className="bg-white/10 hover:bg-[#c6ff1f] text-white hover:text-black px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors flex items-center gap-0.5 shrink-0 cursor-pointer"
                >
                  <Plus className="w-2.5 h-2.5" />
                  {eventNotification.action.label}
                </button>
              </>
            )}
            {eventNotification.onUndo && (
              <>
                <div className="w-px h-3 bg-white/15 mx-0.5 shrink-0" />
                <button
                  onClick={e => {
                    e.stopPropagation();
                    eventNotification.onUndo?.();
                    setEventNotification(null);
                  }}
                  className="text-[#c6ff1f] hover:underline px-1 py-0.5 text-[10.5px] font-semibold transition-colors shrink-0 cursor-pointer"
                >
                  Undo
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Centralized Hover Insight for Notes */}
      <AnimatePresence>
        {hoveredNoteId &&
          (() => {
            const note = markers.find(m => m.id === hoveredNoteId);
            if (!note) return null;
            return (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none"
              >
                <div className="bg-black/60 backdrop-blur-md border border-white/10 px-6 py-4 rounded-2xl flex items-start gap-4 shadow-[0_10px_40px_rgba(0,0,0,0.5)] max-w-lg mx-4">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: `${note.color}20` }}
                  >
                    <MapPin className="w-5 h-5" style={{ color: note.color }} />
                  </div>
                  <div>
                    <div
                      className="text-[11px] uppercase tracking-wider font-bold mb-1"
                      style={{ color: note.color }}
                    >
                      Timeline Note @ {formatTime(note.time)}
                    </div>
                    <div className="text-gray-100 text-lg leading-relaxed whitespace-pre-wrap">{note.label}</div>
                  </div>
                </div>
              </motion.div>
            );
          })()}
      </AnimatePresence>

      {/* Compact Top-Right Active Tag Recordings */}
      {isTaggingMode && activeRecordings.length > 0 && (
        <ActiveRecordingsBar
          activeRecordings={activeRecordings}
          tags={tags}
          labels={labels}
          currentTime={currentTime}
          duration={duration}
          onStopAndSave={tagId => handleTagClick(tagId, { ignoreLeadLag: !isPadQuickTagEnabled })}
          onCancel={tagId => {
            setActiveRecordings(prev => prev.filter(r => r.tagId !== tagId));
          }}
          activeTargetTabId={labelsActiveTargetTab}
          onSelectTargetTab={tagId => setLabelsActiveTargetTab(tagId)}
          offsetTop={isScreenRecording}
        />
      )}

      {/* Recording Error Toast */}
      {recordingError && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-red-900/90 border border-red-500/50 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center justify-between gap-2 max-w-md">
          <div className="flex items-center gap-3">
            <Video className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-sm">{recordingError}</p>
          </div>
          <button
            onClick={() => setRecordingError(null)}
            className="p-1 hover:bg-white/10 rounded-lg shrink-0"
          >
            <span className="sr-only">Close</span>
            <Plus className="w-4 h-4 rotate-45" />
          </button>
        </div>
      )}

      {/* Event Notes Overlay */}
      {selectedEventIds.size === 1 &&
        (() => {
          const selectedEvent = tagEvents.find(e => e.id === Array.from(selectedEventIds)[0]);
          const eventTag = selectedEvent ? tags.find(t => t.id === selectedEvent.tagId) : null;
          if (selectedEvent && selectedEvent.notes) {
            return (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-0 left-0 right-0 w-full z-40 pointer-events-none"
                >
                  <div className="w-full bg-black/40 backdrop-blur-sm text-gray-200 text-lg px-8 py-3 flex items-center justify-center gap-3 font-medium tracking-wide">
                    {eventTag && (
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: eventTag.color }}
                      />
                    )}
                    {selectedEvent.notes}
                  </div>
                </motion.div>
              </AnimatePresence>
            );
          }
          return null;
        })()}

      {/* Presentation Mode Full Screen HUD */}
      {isPresentationMode && (
        <PresentationHUD
          currentPlaylist={currentPresentationPlaylist}
          playlistIndex={presentationPlaylistIndex}
          totalPlaylists={presentationPlaylists.length}
          allOrderedPlaylists={presentationPlaylists}
          currentClipIndex={playlistPlaybarIndex}
          totalClipsInPlaylist={currentPresentationPlaylist?.events.length || 0}
          currentEvent={currentPresentationEvent}
          currentTiming={currentPresentationTiming}
          currentTime={currentTime}
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          onPrevClip={handlePrevPresentationClip}
          onNextClip={handleNextPresentationClip}
          onSelectPlaylistIndex={handleSelectPresentationPlaylistIndex}
          onSeekClip={time => {
            if (isScrubbingRef.current) {
              scrubToTime(time, { skipModeClamp: true });
            } else {
              handleSeekPresentationClip(time);
            }
          }}
          onScrubStart={beginScrubSession}
          onScrubEnd={endScrubSession}
          onOpenCustomize={() => setShowPresentationCustomizeModal(true)}
          onExitPresentation={handleExitPresentationMode}
          volume={volume}
          setVolume={setVolume}
          isMuted={isMuted}
          toggleMute={toggleMute}
          playbackRate={playbackRate}
          setPlaybackRate={setPlaybackRate}
          loop={presentationConfig.loop}
          onToggleLoop={() => {
            setPresentationConfig(prev => {
              const next = { ...prev, loop: !prev.loop };
              try {
                localStorage.setItem(`tacstem_presentation_config_${project.id}`, JSON.stringify(next));
              } catch (e) {}
              return next;
            });
          }}
          isFinished={presentationFinished}
          onReplayPresentation={() => handleEnterPresentationMode(true)}
          transitionMessage={presentationTransitionMsg}
        />
      )}
    </div>
  );
};
