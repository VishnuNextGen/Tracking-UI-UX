import React from 'react';
import {
  Snowflake,
  Clock,
  X,
  Undo2,
  RotateCcw,
  PlusCircle,
  Check,
  LayoutGrid,
  Trash2,
  Pause,
  Play,
  SkipForward,
  Flashlight,
  ZoomIn,
  Type,
  Plus,
  Edit2,
  ChevronUp,
  ChevronDown,
  Pen,
  Minus,
  MoveUpRight,
  CornerUpRight,
  Circle,
  GitCommitVertical,
} from 'lucide-react';
import { WorkspaceToggleSwitch, SectionHeader, RangeSlider } from './WorkspacePrimitives';
import { TelestrationColorPresets } from '../TelestrationColorPresets';
import type { TelestrationColors, TelestrationSlot } from '../TelestrationColorPresets';
import { PlaylistClipFreezeFramePanel } from '../FreezeFrame/PlaylistClipFreezeFramePanel';
import { ScrubbableTimeInput } from '../../Shared/ScrubbableTimeInput';
import { MaskingPanel } from '../Masking';
import { PolygonPanel, RadarPanel, PolygonSettings } from '../Polygon';
import { ScannerPanel, ScannerSettings } from '../Scanner';
import { PlayerTagPanel } from '../PlayerTag';
import { PlayerMovePanel } from '../PlayerMove';
import type { PlayerMoveSettings, PlayerMoveState } from '../PlayerMove/types';
import { getClipEventId } from '../../../utils/playlistUtils';
import { formatTime } from '../../../utils/math';
import type {
  Project,
  ToolType,
  FreezeFrame,
  Playlist,
  PlaylistItem,
  Shape,
  TagEvent,
  Tag as TagData,
  ColorPreset,
  MaskSettings,
  PlayerTagSettings,
} from '../../../types';
import type {
  DeletedFreezeFrameRecord,
  ArrowSettings,
  SpotlightSettings,
  LensSettings,
  RingSettings,
  TextSettings,
  PresetTextItem,
} from '../Workspace.types';

export interface WorkspacePropertiesPanelProps {
  tool: ToolType;
  project: Project;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  currentTime: number;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  duration: number;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  telestrationColors: TelestrationColors;
  activeTelestrationSlot: TelestrationSlot | null;
  handleSelectTelestrationSlot: (slot: TelestrationSlot) => void;
  handleUpdateTelestrationColor: (slot: TelestrationSlot, color: string) => void;
  handleSwapHomeAwayColors: () => void;
  handleResetTelestrationColors: () => void;
  playlists: Playlist[];
  activePlaylistId: string;
  showPlaylistPlaybar: boolean;
  playlistPlaybarIndex: number;
  freezeFramePanelScope: 'all' | 'clip';
  setFreezeFramePanelScope: React.Dispatch<React.SetStateAction<'all' | 'clip'>>;
  findEventAcrossBatch: (
    eventId: string,
    clipHint?: PlaylistItem
  ) => { event: TagEvent | undefined; project: Project | undefined };
  freezeFrames: FreezeFrame[];
  allBatchTagEvents: TagEvent[];
  allBatchTags: TagData[];
  activeFreezeFrameId: string | null;
  setActiveFreezeFrameId: React.Dispatch<React.SetStateAction<string | null>>;
  isFreezeFramePlaying: boolean;
  setIsFreezeFramePlaying: React.Dispatch<React.SetStateAction<boolean>>;
  countdownValue: number;
  setCountdownValue: React.Dispatch<React.SetStateAction<number>>;
  toggleFreezeFramePlay: (freezeFrameId?: string) => void;
  seekFreezeFrame: (elapsedSeconds: number) => void;
  skipFreezeFrame: () => void;
  hoveredFreezeFrameId: string | null;
  setHoveredFreezeFrameId: React.Dispatch<React.SetStateAction<string | null>>;
  handleManualSeek: (time: number, options?: { pause?: boolean; skipModeClamp?: boolean }) => void;
  handleToggleClipFreezeFrameDeactivation: (playlistId: string, clipIndex: number, ffId: string) => void;
  handleSetClipAllFreezeFramesDeactivation: (
    playlistId: string,
    clipIndex: number,
    ffIds: string[],
    deactivate: boolean
  ) => void;
  updateFreezeFrameDuration: (id: string, newDuration: number) => void;
  setAnimationPreviewTime: React.Dispatch<React.SetStateAction<number>>;
  setIsAnimationPreviewPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingAnimationFFId: React.Dispatch<React.SetStateAction<string | null>>;
  deleteFreezeFrame: (id: string) => void;
  addFreezeFrame: (clipHint?: PlaylistItem) => void;
  handleIsolateClipFreezeFrames?: (playlistId: string, clipIndex: number) => void;
  handleToggleClipFreezeFrameIsolation?: (playlistId: string, clipIndex: number) => void;
  duplicatePlaylistEvent?: (playlistId: string, clipIndex: number, options?: { cleanSlate?: boolean; isolate?: boolean }) => void;
  clipTrackedShapes?: Shape[];
  onToggleTrackInFreezeFrame?: (freezeFrameId: string, trackId: string) => void;
  deletedFFStack: DeletedFreezeFrameRecord[];
  ffRemainingSeconds: number;
  ffProgressPercent: number;
  dismissDeletedFFNotification: () => void;
  undoDeleteFreezeFrame: () => void;
  undoDeleteAllFreezeFrames: () => void;
  maskSettings: MaskSettings;
  setMaskSettings: React.Dispatch<React.SetStateAction<MaskSettings>>;
  isPickingColor: boolean;
  setIsPickingColor: React.Dispatch<React.SetStateAction<boolean>>;
  isProcessingMask: boolean;
  removeColor: (color: string) => void;
  spotlightSettings: SpotlightSettings;
  setSpotlightSettings: React.Dispatch<React.SetStateAction<SpotlightSettings>>;
  lensSettings: LensSettings;
  setLensSettings: React.Dispatch<React.SetStateAction<LensSettings>>;
  polygonSettings: PolygonSettings;
  setPolygonSettings: React.Dispatch<React.SetStateAction<PolygonSettings>>;
  scannerSettings: ScannerSettings;
  setScannerSettings: React.Dispatch<React.SetStateAction<ScannerSettings>>;
  activeColorId: number;
  setActiveColorId: React.Dispatch<React.SetStateAction<number>>;
  colors: ColorPreset[];
  nameTagSettings: PlayerTagSettings;
  setNameTagSettings: React.Dispatch<React.SetStateAction<PlayerTagSettings>>;
  textSettings: TextSettings;
  setTextSettings: React.Dispatch<React.SetStateAction<TextSettings>>;
  presetBulkText: string;
  setPresetBulkText: React.Dispatch<React.SetStateAction<string>>;
  presetTexts: PresetTextItem[];
  setPresetTexts: React.Dispatch<React.SetStateAction<PresetTextItem[]>>;
  editingPresetId: string | null;
  setEditingPresetId: React.Dispatch<React.SetStateAction<string | null>>;
  expandedPresetId: string | null;
  setExpandedPresetId: React.Dispatch<React.SetStateAction<string | null>>;
  playerMoveState: PlayerMoveState;
  resetPlayerMove: () => void;
  setIsDrawing: React.Dispatch<React.SetStateAction<boolean>>;
  toolSize: number;
  setToolSize: React.Dispatch<React.SetStateAction<number>>;
  playerMoveSettings: PlayerMoveSettings;
  setPlayerMoveSettings: React.Dispatch<React.SetStateAction<PlayerMoveSettings>>;
  arrowSettings: ArrowSettings;
  setArrowSettings: React.Dispatch<React.SetStateAction<ArrowSettings>>;
  ringSettings: RingSettings;
  setRingSettings: React.Dispatch<React.SetStateAction<RingSettings>>;
}

export const WorkspacePropertiesPanel: React.FC<WorkspacePropertiesPanelProps> = ({
  tool,
  project,
  videoRef,
  currentTime,
  setCurrentTime,
  duration,
  isPlaying,
  setIsPlaying,
  telestrationColors,
  activeTelestrationSlot,
  handleSelectTelestrationSlot,
  handleUpdateTelestrationColor,
  handleSwapHomeAwayColors,
  handleResetTelestrationColors,
  playlists,
  activePlaylistId,
  showPlaylistPlaybar,
  playlistPlaybarIndex,
  freezeFramePanelScope,
  setFreezeFramePanelScope,
  findEventAcrossBatch,
  freezeFrames,
  allBatchTagEvents,
  allBatchTags,
  activeFreezeFrameId,
  setActiveFreezeFrameId,
  isFreezeFramePlaying,
  setIsFreezeFramePlaying,
  countdownValue,
  setCountdownValue,
  toggleFreezeFramePlay,
  seekFreezeFrame,
  skipFreezeFrame,
  hoveredFreezeFrameId,
  setHoveredFreezeFrameId,
  handleManualSeek,
  handleToggleClipFreezeFrameDeactivation,
  handleSetClipAllFreezeFramesDeactivation,
  updateFreezeFrameDuration,
  setAnimationPreviewTime,
  setIsAnimationPreviewPlaying,
  setEditingAnimationFFId,
  deleteFreezeFrame,
  addFreezeFrame,
  handleIsolateClipFreezeFrames,
  handleToggleClipFreezeFrameIsolation,
  duplicatePlaylistEvent,
  clipTrackedShapes,
  onToggleTrackInFreezeFrame,
  deletedFFStack,
  ffRemainingSeconds,
  ffProgressPercent,
  dismissDeletedFFNotification,
  undoDeleteFreezeFrame,
  undoDeleteAllFreezeFrames,
  maskSettings,
  setMaskSettings,
  isPickingColor,
  setIsPickingColor,
  isProcessingMask,
  removeColor,
  spotlightSettings,
  setSpotlightSettings,
  lensSettings,
  setLensSettings,
  polygonSettings,
  setPolygonSettings,
  scannerSettings,
  setScannerSettings,
  activeColorId,
  setActiveColorId,
  colors,
  nameTagSettings,
  setNameTagSettings,
  textSettings,
  setTextSettings,
  presetBulkText,
  setPresetBulkText,
  presetTexts,
  setPresetTexts,
  editingPresetId,
  setEditingPresetId,
  expandedPresetId,
  setExpandedPresetId,
  playerMoveState,
  resetPlayerMove,
  setIsDrawing,
  toolSize,
  setToolSize,
  playerMoveSettings,
  setPlayerMoveSettings,
  arrowSettings,
  setArrowSettings,
  ringSettings,
  setRingSettings,
}) => {
  const ToggleSwitch = WorkspaceToggleSwitch;

  const renderTelestrationColorPresetBlock = () => (
    <TelestrationColorPresets
      colors={telestrationColors}
      activeSlot={activeTelestrationSlot}
      onSelectSlot={handleSelectTelestrationSlot}
      onUpdateColor={handleUpdateTelestrationColor}
      onSwapHomeAway={handleSwapHomeAwayColors}
      onResetDefaults={handleResetTelestrationColors}
    />
  );

  const activePl = playlists.find(p => p.id === activePlaylistId);
  const isPlaylistActive = showPlaylistPlaybar && Boolean(activePl && activePl.events.length > 0);
  const selectedClipIndex = isPlaylistActive
    ? Math.max(0, Math.min(playlistPlaybarIndex, activePl!.events.length - 1))
    : -1;
  const selectedClipItem = selectedClipIndex >= 0 ? activePl!.events[selectedClipIndex] : null;

  if (tool === null) {
    if (selectedClipItem && freezeFramePanelScope === 'clip') {
      const clipEventId = getClipEventId(selectedClipItem);
      const { project: clipProj } = findEventAcrossBatch(clipEventId, selectedClipItem);
      const candidateFfs =
        clipProj?.data?.freezeFrames && clipProj.id !== project.id
          ? clipProj.data.freezeFrames
          : freezeFrames;

      return (
        <PlaylistClipFreezeFramePanel
          clipItem={selectedClipItem}
          clipIndex={selectedClipIndex}
          playlistName={activePl?.name || 'Playlist'}
          allPlaylistClips={activePl?.events}
          tagEvents={allBatchTagEvents}
          tags={allBatchTags}
          candidateFreezeFrames={candidateFfs}
          allMatchFreezeFramesCount={freezeFrames.length}
          currentVideoTime={currentTime}
          isPlaying={activeFreezeFrameId ? isFreezeFramePlaying : isPlaying}
          activeFreezeFrameId={activeFreezeFrameId}
          isFreezeFramePlaying={isFreezeFramePlaying}
          countdownValue={countdownValue}
          onToggleFreezeFramePlay={toggleFreezeFramePlay}
          onSeekFreezeFrame={seekFreezeFrame}
          onSkipFreezeFrame={skipFreezeFrame}
          hoveredFreezeFrameId={hoveredFreezeFrameId}
          setHoveredFreezeFrameId={setHoveredFreezeFrameId}
          onSeek={time => {
            const matchedFF = freezeFrames.find(f => Math.abs(f.timestamp - time) <= 0.025);
            if (matchedFF) {
              setActiveFreezeFrameId(matchedFF.id);
              setCountdownValue(matchedFF.duration || 5);
              setIsFreezeFramePlaying(false);
            }
            handleManualSeek(time, { pause: true, skipModeClamp: true });
            if (videoRef.current) {
              videoRef.current.pause();
              setIsPlaying(false);
            }
          }}
          onToggleDeactivation={ffId => {
            handleToggleClipFreezeFrameDeactivation(activePlaylistId, selectedClipIndex, ffId);
          }}
          onSetAllDeactivation={(ffIds, deactivate) => {
            handleSetClipAllFreezeFramesDeactivation(activePlaylistId, selectedClipIndex, ffIds, deactivate);
          }}
          onUpdateDuration={(ffId, dur) => {
            updateFreezeFrameDuration(ffId, dur);
          }}
          onEditAnimation={(ffId, timestamp) => {
            if (videoRef.current) {
              videoRef.current.currentTime = timestamp;
              videoRef.current.pause();
            }
            setCurrentTime(timestamp);
            setIsPlaying(false);
            setAnimationPreviewTime(0);
            setIsAnimationPreviewPlaying(false);
            setTimeout(() => setEditingAnimationFFId(ffId), 0);
          }}
          onDeleteFromProject={ffId => {
            deleteFreezeFrame(ffId);
          }}
          onAddFreezeFrame={() => addFreezeFrame(selectedClipItem)}
          onDuplicateClip={duplicatePlaylistEvent ? () => duplicatePlaylistEvent(activePlaylistId, selectedClipIndex) : undefined}
          onSwitchToAllFramesScope={() => setFreezeFramePanelScope('all')}
          clipProjectName={clipProj && clipProj.id !== project.id ? clipProj.name : undefined}
          clipTrackedShapes={clipTrackedShapes}
          onToggleTrackInFreezeFrame={onToggleTrackInFreezeFrame}
        />
      );
    }

    return (
      <div className="space-y-1.5 animate-in fade-in duration-200">
        {selectedClipItem && (
          <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#111215] border border-[#c6ff1f]/30 text-[9px] mb-1.5 shadow-sm">
            <div className="flex items-center gap-1.5 min-w-0">
              <Snowflake className="w-3 h-3 text-[#c6ff1f] shrink-0" />
              <span className="text-gray-300 font-semibold truncate">
                Clip #{selectedClipIndex + 1} active in playlist
              </span>
            </div>
            <button
              type="button"
              onClick={() => setFreezeFramePanelScope('clip')}
              className="px-2 py-0.5 rounded bg-[#c6ff1f] text-black font-extrabold hover:bg-[#b0e615] transition-colors shrink-0 text-[8.5px] shadow-sm"
            >
              Scope to Clip #{selectedClipIndex + 1}
            </button>
          </div>
        )}
        <SectionHeader
          icon={Snowflake}
          title="Freeze Frames"
          subtitle="Persistent Telestrations"
          colorClass="text-[#c6ff1f]"
          bgClass="bg-[#c6ff1f]/10"
          borderClass="border-[#c6ff1f]/20"
        />

        {/* In-Property-Panel Undo Notification Banner for Deleted Freeze Frames */}
        {deletedFFStack.length > 0 && (
          <div className="relative rounded-lg bg-gradient-to-b from-[#1c1816] to-[#141212] border border-amber-500/40 p-2 shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-start justify-between gap-1.5 mb-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-4 h-4 rounded bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
                  <Snowflake className="w-2.5 h-2.5 text-red-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-gray-200 leading-tight">
                      {deletedFFStack.length > 1 ? `${deletedFFStack.length} frames deleted` : 'Frame deleted'}
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
                  onClick={dismissDeletedFFNotification}
                  className="p-0.5 text-gray-400 hover:text-white rounded hover:bg-white/10 transition-colors"
                  title="Dismiss"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={undoDeleteFreezeFrame}
                className="flex-1 py-1 px-2 bg-[#c6ff1f] hover:bg-[#b5ee15] active:bg-[#a3d610] text-black text-[9px] font-bold rounded flex items-center justify-center gap-1 transition-all active:scale-95 shadow-sm"
                title="Restore most recently deleted frame (Ctrl+Z)"
              >
                <Undo2 className="w-3 h-3 stroke-[2.5]" />
                <span>Undo {deletedFFStack.length > 1 ? 'Last' : ''}</span>
              </button>
              {deletedFFStack.length > 1 && (
                <button
                  onClick={undoDeleteAllFreezeFrames}
                  className="py-1 px-2 bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/30 text-[9px] font-bold rounded flex items-center justify-center gap-1 transition-all active:scale-95 shadow-sm"
                  title={`Restore all ${deletedFFStack.length} deleted freeze frames`}
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>All ({deletedFFStack.length})</span>
                </button>
              )}
            </div>

            {/* Countdown progress line */}
            <div className="h-[2px] w-full bg-white/10 rounded-b overflow-hidden absolute bottom-0 left-0 right-0">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-[#c6ff1f] transition-[width] duration-75 ease-linear"
                style={{ width: `${ffProgressPercent}%` }}
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <button
            onClick={() => addFreezeFrame()}
            disabled={isPlaying}
            className="w-full py-1.5 bg-[#c6ff1f]/10 hover:bg-[#c6ff1f]/20 text-[#c6ff1f] border border-[#c6ff1f]/30 hover:border-[#c6ff1f]/50 rounded-md flex items-center justify-center gap-1.5 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all text-[10px] shadow-sm"
          >
            <PlusCircle className="w-3 h-3" /> Add Freeze Frame
          </button>
          <div className="space-y-1.5">
            {freezeFrames.length === 0 && (
              <div className="text-center py-6 text-gray-500 text-[9px] font-medium italic bg-[#141416] rounded-lg border border-[#222] border-dashed">
                Pause video to add frames
              </div>
            )}
            {(() => {
              const sortedFFs = [...freezeFrames].sort((a, b) => a.timestamp - b.timestamp);
              const activeFFIndex = sortedFFs.findIndex(
                ff => activeFreezeFrameId === ff.id
              );

              let justPassedFFId: string | null = null;
              let justNextFFId: string | null = null;

              if (activeFFIndex !== -1) {
                if (activeFFIndex > 0) {
                  justPassedFFId = sortedFFs[activeFFIndex - 1].id;
                }
                if (activeFFIndex < sortedFFs.length - 1) {
                  justNextFFId = sortedFFs[activeFFIndex + 1].id;
                }
              } else {
                const passedFFs = sortedFFs.filter(ff => ff.timestamp <= currentTime + 0.001);
                justPassedFFId = passedFFs.length > 0 ? passedFFs[passedFFs.length - 1].id : null;

                const upcomingFFs = sortedFFs.filter(ff => ff.timestamp > currentTime + 0.001);
                justNextFFId = upcomingFFs.length > 0 ? upcomingFFs[0].id : null;
              }

              const halfDuration = (duration || 0) / 2;

              const renderFF = (ff: FreezeFrame, index: number) => {
                const isActive = activeFreezeFrameId === ff.id;
                const isHovered = hoveredFreezeFrameId === ff.id;
                const isNext = !isActive && ff.id === justNextFFId;
                const isJustPassed = !isActive && ff.id === justPassedFFId;
                const isSpecialThree = isActive || isNext || isJustPassed;

                return (
                  <div key={ff.id} className="relative group/ffitem">
                    <div
                      id={`ff-item-${ff.id}`}
                      className={`relative rounded-md overflow-hidden transition-all duration-200 cursor-pointer ${
                        isActive
                          ? 'p-[1.5px] shadow-[0_0_12px_rgba(245,158,11,0.35)] ring-1 ring-amber-500/60'
                          : isNext
                          ? 'p-[1.5px] shadow-[0_0_14px_rgba(34,197,94,0.4)] ring-1 ring-emerald-500/70'
                          : isJustPassed
                          ? 'p-[1.5px] shadow-[0_0_12px_rgba(168,85,247,0.35)] ring-1 ring-violet-500/60'
                          : isHovered
                          ? 'p-[1px] bg-[#1a1e2b] border border-[#c6ff1f] shadow-[0_0_8px_rgba(59,130,246,0.2)]'
                          : 'p-[1px] bg-[#141416] border border-[#262629] hover:border-[#3a3a3f]'
                      }`}
                      onMouseEnter={() => {
                        setHoveredFreezeFrameId(ff.id);
                      }}
                      onMouseLeave={() => {
                        setHoveredFreezeFrameId(null);
                      }}
                      onClick={() => {
                        setActiveFreezeFrameId(ff.id);
                        setCountdownValue(ff.duration || 5);
                        setIsFreezeFramePlaying(false);
                        handleManualSeek(ff.timestamp, { pause: true, skipModeClamp: true });
                        if (videoRef.current) {
                          videoRef.current.pause();
                          setIsPlaying(false);
                        }
                      }}
                    >
                      {/* Green border passing around NEXT freeze frame (just after) */}
                      {isNext && (
                        <div
                          className="absolute top-1/2 left-1/2 w-[450px] h-[450px] animate-border-beam-green pointer-events-none"
                          style={{
                            background:
                              'conic-gradient(from 0deg, transparent 0deg 260deg, rgba(34,197,94,0.3) 290deg, #10b981 320deg, #22c55e 345deg, #86efac 360deg)',
                          }}
                        />
                      )}

                      {/* Violet border passing around JUST PASSED freeze frame (just before) */}
                      {isJustPassed && (
                        <div
                          className="absolute top-1/2 left-1/2 w-[450px] h-[450px] animate-border-beam-violet pointer-events-none"
                          style={{
                            background:
                              'conic-gradient(from 0deg, transparent 0deg 260deg, rgba(168,85,247,0.35) 290deg, #9333ea 320deg, #a855f7 345deg, #d8b4fe 360deg)',
                          }}
                        />
                      )}

                      {/* Amber border for ACTIVE freezing frame */}
                      {isActive && (
                        <div
                          className="absolute top-1/2 left-1/2 w-[450px] h-[450px] animate-border-beam-amber pointer-events-none"
                          style={{
                            background:
                              'conic-gradient(from 0deg, transparent 0deg 260deg, rgba(245,158,11,0.35) 290deg, #f59e0b 330deg, #fbbf24 350deg, #fef08a 360deg)',
                          }}
                        />
                      )}

                      {isSpecialThree ? (
                        /* 2-Line Format with Text Signals for Active, Just-Before, and Just-After */
                        <div
                          className={`relative z-10 w-full rounded-[5px] p-2 transition-colors ${
                            isActive ? 'bg-[#18140f]' : isNext ? 'bg-[#0c150e]' : 'bg-[#15111c]'
                          }`}
                        >
                          {/* Line 1: Badge, Timestamp, and Text Signal Pill */}
                          <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-white/5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div
                                className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[8px] font-bold border shrink-0 ${
                                  isActive
                                    ? 'bg-amber-500/25 text-amber-300 border-amber-500/40 shadow-sm'
                                    : isNext
                                    ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/40 shadow-sm'
                                    : 'bg-violet-500/25 text-violet-300 border-violet-500/40 shadow-sm'
                                }`}
                              >
                                {index + 1}
                              </div>
                              <span
                                className={`font-mono text-[9.5px] font-bold tracking-tight ${
                                  isActive
                                    ? 'text-amber-300'
                                    : isNext
                                    ? 'text-emerald-300'
                                    : 'text-violet-300'
                                }`}
                              >
                                {formatTime(ff.timestamp)}
                              </span>
                            </div>

                            {/* Text Signals */}
                            <div className="shrink-0 flex items-center">
                              {isActive ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[7.5px] font-mono font-bold tracking-tight uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs animate-pulse">
                                  <Snowflake className="w-2 h-2 text-amber-300" />
                                  <span>ACTIVE</span>
                                </span>
                              ) : isNext ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[7.5px] font-mono font-bold tracking-tight uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-xs">
                                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                  </span>
                                  <span>NEXT</span>
                                  {currentTime < ff.timestamp && (
                                    <span className="text-[7px] text-emerald-300/80 font-normal">
                                      in {(ff.timestamp - currentTime).toFixed(1)}s
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[7.5px] font-mono font-bold tracking-tight uppercase bg-violet-500/20 text-violet-300 border border-violet-500/40 shadow-xs">
                                  <Check className="w-2.5 h-2.5 text-violet-300 stroke-[3]" />
                                  <span>PASSED</span>
                                  {currentTime > ff.timestamp && (
                                    <span className="text-[7px] text-violet-300/80 font-normal">
                                      +{(currentTime - ff.timestamp).toFixed(1)}s
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Line 2: Frame Name/Hint + Controls */}
                          <div
                            className="flex items-center justify-between gap-1 pt-1.5"
                            onClick={e => e.stopPropagation()}
                          >
                            <span
                              className={`text-[7.5px] font-sans font-medium truncate max-w-[65px] ${
                                isActive
                                  ? 'text-amber-400/80'
                                  : isNext
                                  ? 'text-emerald-400/80'
                                  : 'text-violet-400/80'
                              }`}
                            >
                              {ff.name || `Frame ${index + 1}`}
                            </span>

                            <div className="flex items-center gap-1">
                              <ScrubbableTimeInput
                                value={ff.duration || 5}
                                onChange={newDur => updateFreezeFrameDuration(ff.id, newDur)}
                                min={1.0}
                                max={60.0}
                                step={0.5}
                                precision={1}
                                size="xs"
                                showPresetsDropdown={false}
                                presets={[
                                  { label: '3.0s Quick', value: 3.0 },
                                  { label: '5.0s Standard', value: 5.0, isDefault: true },
                                  { label: '7.5s Medium', value: 7.5 },
                                  { label: '10.0s Extended', value: 10.0 },
                                  { label: '15.0s Breakdown', value: 15.0 },
                                  { label: '20.0s Review', value: 20.0 },
                                  { label: '30.0s Analysis', value: 30.0 },
                                ]}
                                tooltipTitle="Freeze Frame Duration. Scroll wheel or drag horizontally, click to type, or pick presets."
                              />
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  if (videoRef.current) {
                                    videoRef.current.currentTime = ff.timestamp;
                                    videoRef.current.pause();
                                  }
                                  setCurrentTime(ff.timestamp);
                                  setIsPlaying(false);
                                  setAnimationPreviewTime(0);
                                  setIsAnimationPreviewPlaying(false);
                                  setTimeout(() => setEditingAnimationFFId(ff.id), 0);
                                }}
                                className={`p-0.5 rounded transition-colors ${
                                  isActive
                                    ? 'text-amber-400 hover:text-amber-200 hover:bg-amber-500/10'
                                    : isNext
                                    ? 'text-emerald-400 hover:text-emerald-200 hover:bg-emerald-500/10'
                                    : 'text-violet-400 hover:text-violet-200 hover:bg-violet-500/10'
                                }`}
                                title="Edit Animation Timeline"
                              >
                                <LayoutGrid className="w-2.5 h-2.5" />
                              </button>
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  deleteFreezeFrame(ff.id);
                                }}
                                className="p-0.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>

                          {/* Line 3: Compact Timer & Scrub Playbar for Active Freeze Frame */}
                          {isActive && (
                            <div
                              className="pt-1.5 mt-1 border-t border-amber-500/20 space-y-1"
                              onClick={e => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => toggleFreezeFramePlay(ff.id)}
                                    className="p-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-colors cursor-pointer"
                                    title={
                                      isFreezeFramePlaying
                                        ? 'Pause Freeze Frame (Space)'
                                        : 'Play Freeze Frame (Space)'
                                    }
                                  >
                                    {isFreezeFramePlaying ? (
                                      <Pause className="w-2.5 h-2.5 fill-current" />
                                    ) : (
                                      <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                                    )}
                                  </button>
                                  <div className="font-mono text-[9px] flex items-baseline gap-0.5">
                                    <span className="font-bold text-amber-300">
                                      {Math.max(0, (ff.duration || 5) - countdownValue).toFixed(1)}s
                                    </span>
                                    <span className="text-[7.5px] text-gray-400">
                                      / {(ff.duration || 5).toFixed(1)}s
                                    </span>
                                  </div>
                                  <span
                                    className={`text-[7px] font-mono px-1 py-0.5 rounded font-semibold ${
                                      isFreezeFramePlaying
                                        ? 'bg-amber-400/20 text-amber-300'
                                        : 'bg-gray-700/60 text-gray-300'
                                    }`}
                                  >
                                    {isFreezeFramePlaying ? 'PLAYING' : 'PAUSED'}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={skipFreezeFrame}
                                  className="px-1.5 py-0.5 rounded text-[8px] font-mono text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-0.5"
                                  title="Resume video playback (Esc)"
                                >
                                  <span>Skip</span>
                                  <SkipForward className="w-2.5 h-2.5" />
                                </button>
                              </div>

                              {/* Compact Scrub Playbar */}
                              {(() => {
                                const dur = Math.max(0.1, ff.duration || 5);
                                const elapsed = Math.max(0, Math.min(dur, dur - countdownValue));
                                const pct = Math.min(100, Math.max(0, (elapsed / dur) * 100));
                                return (
                                  <div
                                    className="relative h-2 w-full bg-[#10141f] hover:bg-[#1a2233] border border-amber-500/30 rounded-full cursor-pointer overflow-hidden transition-colors select-none group"
                                    onClick={e => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const clickPct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                                      seekFreezeFrame(clickPct * dur);
                                    }}
                                    title="Click or drag to scrub freeze frame (jump to any second)"
                                  >
                                    <div
                                      className="h-full bg-gradient-to-r from-amber-500 to-[#c6ff1f] transition-[width] duration-75"
                                      style={{ width: `${pct}%` }}
                                    />
                                    <div
                                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white shadow border border-black transition-transform group-hover:scale-125 pointer-events-none"
                                      style={{ left: `${pct}%` }}
                                    />
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Clean 1-Line Compact Row for All Other Freeze Frames */
                        <div
                          className={`relative z-10 w-full flex items-center justify-between rounded-[5px] px-2 py-1.5 transition-colors ${
                            isHovered ? 'bg-[#1a1e2b]' : 'bg-[#141416]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-3.5 h-3.5 rounded flex items-center justify-center text-[8px] font-bold border shrink-0 bg-[#c6ff1f]/20 text-[#c6ff1f] border-[#c6ff1f]/30">
                              {index + 1}
                            </div>
                            <div className="font-mono text-[9px] font-medium tracking-tight text-[#c6ff1f] hover:text-[#a0d600]">
                              {formatTime(ff.timestamp)}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                            <ScrubbableTimeInput
                              value={ff.duration || 5}
                              onChange={newDur => updateFreezeFrameDuration(ff.id, newDur)}
                              min={1.0}
                              max={60.0}
                              step={0.5}
                              precision={1}
                              size="xs"
                              showPresetsDropdown={false}
                              presets={[
                                { label: '3.0s Quick', value: 3.0 },
                                { label: '5.0s Standard', value: 5.0, isDefault: true },
                                { label: '7.5s Medium', value: 7.5 },
                                { label: '10.0s Extended', value: 10.0 },
                                { label: '15.0s Breakdown', value: 15.0 },
                                { label: '20.0s Review', value: 20.0 },
                                { label: '30.0s Analysis', value: 30.0 },
                              ]}
                              tooltipTitle="Freeze Frame Duration. Scroll wheel or drag horizontally, click to type, or pick presets."
                            />
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                if (videoRef.current) {
                                  videoRef.current.currentTime = ff.timestamp;
                                  videoRef.current.pause();
                                }
                                setCurrentTime(ff.timestamp);
                                setIsPlaying(false);
                                setAnimationPreviewTime(0);
                                setIsAnimationPreviewPlaying(false);
                                setTimeout(() => setEditingAnimationFFId(ff.id), 0);
                              }}
                              className="p-0.5 text-gray-500 hover:text-[#c6ff1f] hover:bg-[#a0d600]/10 rounded transition-colors"
                              title="Edit Animation Timeline"
                            >
                              <LayoutGrid className="w-2.5 h-2.5" />
                            </button>
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                deleteFreezeFrame(ff.id);
                              }}
                              className="p-0.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              };

              const firstHalf = sortedFFs.filter(ff => ff.timestamp <= halfDuration);
              const secondHalf = sortedFFs.filter(ff => ff.timestamp > halfDuration);

              return (
                <div className="space-y-2.5">
                  {firstHalf.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider px-1">
                        First Half
                      </div>
                      <div className="space-y-1.5">
                        {firstHalf.map(ff => renderFF(ff, sortedFFs.indexOf(ff)))}
                      </div>
                    </div>
                  )}
                  {secondHalf.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider px-1">
                        Second Half
                      </div>
                      <div className="space-y-1.5">
                        {secondHalf.map(ff => renderFF(ff, sortedFFs.indexOf(ff)))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  }

  if (tool === 'masking') {
    return (
      <MaskingPanel
        maskSettings={maskSettings}
        setMaskSettings={setMaskSettings}
        isPickingColor={isPickingColor}
        setIsPickingColor={setIsPickingColor}
        isProcessingMask={isProcessingMask}
        onRemoveColor={removeColor}
      />
    );
  }

  if (tool === 'spotlight') {
    return (
      <div className="space-y-3 animate-in fade-in duration-200">
        <SectionHeader
          icon={Flashlight}
          title="Spotlight"
          subtitle="Focus Attention"
          colorClass="text-yellow-400"
          bgClass="bg-yellow-500/10"
          borderClass="border-yellow-500/20"
        />
        <div className="space-y-4 pt-1">
          <RangeSlider
            label="Radius Size"
            value={spotlightSettings.size}
            onChange={(e: any) => setSpotlightSettings({ ...spotlightSettings, size: parseInt(e.target.value) })}
            min={20}
            max={150}
            step={1}
            unit="px"
            accentClass="[&::-webkit-slider-thumb]:bg-yellow-500"
          />
          <RangeSlider
            label="Intensity"
            value={spotlightSettings.intensity}
            onChange={(e: any) =>
              setSpotlightSettings({ ...spotlightSettings, intensity: parseFloat(e.target.value) })
            }
            min={0.1}
            max={1}
            step={0.05}
            unit="x"
            accentClass="[&::-webkit-slider-thumb]:bg-yellow-500"
          />
          <RangeSlider
            label="Rotation"
            value={spotlightSettings.rotation}
            onChange={(e: any) =>
              setSpotlightSettings({ ...spotlightSettings, rotation: parseFloat(e.target.value) })
            }
            min={0.1}
            max={1}
            step={0.05}
            unit="rad"
            accentClass="[&::-webkit-slider-thumb]:bg-yellow-500"
          />
        </div>
      </div>
    );
  }

  if (tool === 'lens') {
    return (
      <div className="space-y-3 animate-in fade-in duration-200">
        <SectionHeader
          icon={ZoomIn}
          title="Zoom Lens"
          subtitle="Magnify Details"
          colorClass="text-cyan-400"
          bgClass="bg-cyan-500/10"
          borderClass="border-cyan-500/20"
        />
        <div className="space-y-4 pt-1">
          <RangeSlider
            label="Radius Size"
            value={lensSettings.size}
            onChange={(e: any) => setLensSettings({ ...lensSettings, size: parseInt(e.target.value) })}
            min={40}
            max={150}
            step={1}
            unit="px"
            accentClass="[&::-webkit-slider-thumb]:bg-cyan-500"
          />
          <RangeSlider
            label="Magnification"
            value={lensSettings.zoom}
            onChange={(e: any) => setLensSettings({ ...lensSettings, zoom: parseFloat(e.target.value) })}
            min={1.5}
            max={4.0}
            step={0.1}
            unit="x"
            accentClass="[&::-webkit-slider-thumb]:bg-cyan-500"
          />
        </div>
      </div>
    );
  }

  if (tool === 'polygon') {
    return (
      <div className="space-y-3">
        {renderTelestrationColorPresetBlock()}
        <PolygonPanel
          settings={polygonSettings}
          onChange={setPolygonSettings}
          toolSize={toolSize}
          onToolSizeChange={setToolSize}
        />
      </div>
    );
  }

  if (tool === 'radar') {
    return (
      <div className="space-y-3">
        {renderTelestrationColorPresetBlock()}
        <RadarPanel
          settings={polygonSettings}
          onChange={setPolygonSettings}
        />
      </div>
    );
  }

  if (tool === 'scanner') {
    return (
      <div className="space-y-3">
        {renderTelestrationColorPresetBlock()}
        <ScannerPanel
          settings={scannerSettings}
          onChange={setScannerSettings}
        />
      </div>
    );
  }

  if (tool === 'name-tag') {
    return (
      <div className="space-y-3">
        {renderTelestrationColorPresetBlock()}
        <PlayerTagPanel
          settings={nameTagSettings}
          onChange={setNameTagSettings}
          colors={colors}
          activeColorId={activeColorId}
          onSelectColorId={setActiveColorId}
          telestrationColors={telestrationColors}
          activeTelestrationSlot={activeTelestrationSlot}
          onSelectSlot={handleSelectTelestrationSlot}
          onUpdateColor={handleUpdateTelestrationColor}
        />
      </div>
    );
  }

  if (tool === 'text') {
    return (
      <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-200">
        <SectionHeader
          icon={Type}
          title="Text Tool"
          subtitle="Add text to canvas"
          colorClass="text-pink-400"
          bgClass="bg-pink-500/10"
          borderClass="border-pink-500/20"
        />

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Text Content</label>
            <textarea
              className="w-full bg-[#141416] border border-[#262629] rounded-lg p-2 text-white text-xs focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500/50 resize-none shadow-inner font-medium transition-all"
              rows={2}
              value={textSettings.text}
              onChange={e => setTextSettings({ ...textSettings, text: e.target.value })}
              placeholder="Enter text..."
            />
          </div>

          <div className="space-y-2 pb-3 border-b border-[#262629]">
            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Preset Texts</label>

            <div className="flex gap-1.5 shrink-0">
              <input
                type="text"
                value={presetBulkText}
                onChange={e => setPresetBulkText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && presetBulkText.trim()) {
                    const newTexts = presetBulkText
                      .split(';')
                      .map(n => n.trim())
                      .filter(Boolean)
                      .map(n => ({ id: Date.now().toString() + Math.random(), text: n }));
                    setPresetTexts(prev => [...prev, ...newTexts]);
                    setPresetBulkText('');
                  }
                }}
                className="flex-1 min-w-0 bg-[#0a0a0c] border border-[#262629] rounded-md px-2 py-1 text-[10px] font-medium text-white focus:outline-none focus:border-pink-500 transition-all shadow-inner"
                placeholder="Add preset (use ; for multiple)"
              />
              <button
                onClick={() => {
                  if (presetBulkText.trim()) {
                    const newTexts = presetBulkText
                      .split(';')
                      .map(n => n.trim())
                      .filter(Boolean)
                      .map(n => ({ id: Date.now().toString() + Math.random(), text: n }));
                    setPresetTexts(prev => [...prev, ...newTexts]);
                    setPresetBulkText('');
                  }
                }}
                className="p-1 transition-colors bg-pink-600 hover:bg-pink-500 text-white rounded-md shrink-0 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
              {presetTexts.map(preset => (
                <div
                  key={preset.id}
                  className={`flex flex-col bg-[#1a1a1c] border rounded-md transition-all ${
                    textSettings.text === preset.text
                      ? 'border-pink-500/50 bg-pink-500/10 shadow-sm'
                      : 'border-[#2a2a2c] hover:border-[#3a3a3f]'
                  }`}
                >
                  <div
                    className="flex items-center justify-between p-1.5 cursor-pointer"
                    onClick={() => setTextSettings(prev => ({ ...prev, text: preset.text }))}
                  >
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      {editingPresetId === preset.id ? (
                        <input
                          type="text"
                          autoFocus
                          value={preset.text}
                          onClick={e => e.stopPropagation()}
                          onBlur={() => setEditingPresetId(null)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') setEditingPresetId(null);
                          }}
                          onChange={e => {
                            const val = e.target.value;
                            setPresetTexts(prev =>
                              prev.map(p => (p.id === preset.id ? { ...p, text: val } : p))
                            );
                            if (textSettings.text === preset.text) {
                              setTextSettings(prev => ({ ...prev, text: val }));
                            }
                          }}
                          className="bg-[#0a0a0c] border border-pink-500/50 rounded px-1 outline-none text-[10px] font-semibold text-white w-full truncate py-0.5"
                        />
                      ) : (
                        <span className="text-[10px] font-semibold text-gray-200 w-full truncate tracking-wide leading-none">
                          {preset.text}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center shrink-0">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setEditingPresetId(preset.id);
                        }}
                        className="p-1 ml-0.5 text-gray-500 hover:text-white hover:bg-[#333] rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setExpandedPresetId(expandedPresetId === preset.id ? null : preset.id);
                        }}
                        className="p-1 ml-0.5 text-gray-500 hover:text-white hover:bg-[#333] rounded transition-colors"
                        title="Expand"
                      >
                        {expandedPresetId === preset.id ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setPresetTexts(prev => prev.filter(p => p.id !== preset.id));
                        }}
                        className="p-1 ml-0.5 text-gray-500 hover:text-red-400 hover:bg-red-900/30 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  {expandedPresetId === preset.id && (
                    <div className="p-2 border-t border-[#2a2a2c] bg-[#141416] rounded-b-md">
                      <textarea
                        className="w-full bg-[#0a0a0c] border border-[#2a2a2c] rounded-md p-1.5 text-[10px] font-medium text-gray-300 focus:outline-none focus:border-pink-500 resize-none h-12 shadow-inner"
                        value={preset.text}
                        onClick={e => e.stopPropagation()}
                        onChange={e => {
                          const val = e.target.value;
                          setPresetTexts(prev =>
                            prev.map(p => (p.id === preset.id ? { ...p, text: val } : p))
                          );
                          if (textSettings.text === preset.text) {
                            setTextSettings(prev => ({ ...prev, text: val }));
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
              {presetTexts.length === 0 && (
                <div className="text-[9px] text-center text-gray-500 py-2 italic font-medium border border-dashed border-[#333] rounded-md">
                  No presets
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 pb-3 border-b border-[#262629]">
            <RangeSlider
              label="Font Size"
              value={textSettings.fontSize}
              onChange={(e: any) => setTextSettings({ ...textSettings, fontSize: parseInt(e.target.value) })}
              min={8}
              max={100}
              step={1}
              unit="px"
              accentClass="[&::-webkit-slider-thumb]:bg-pink-500"
            />

            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Animation</label>
              <div className="flex gap-1 p-0.5 bg-[#141416] rounded-md border border-[#262629]">
                {(['none', 'fade', 'scale', 'type'] as const).map(anim => (
                  <button
                    key={anim}
                    onClick={() => setTextSettings({ ...textSettings, animation: anim })}
                    className={`flex-1 py-1 rounded-[4px] text-[9px] font-bold uppercase tracking-wider transition-all shadow-sm ${
                      textSettings.animation === anim
                        ? 'bg-pink-600 text-white'
                        : 'bg-transparent text-gray-500 hover:text-gray-300 hover:bg-[#222]'
                    }`}
                  >
                    {anim}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Text Color</label>
              <div className="flex gap-1.5 flex-wrap">
                {colors.map(c => (
                  <button
                    key={`text-c-${c.id}`}
                    onClick={() => setTextSettings({ ...textSettings, colorId: c.id })}
                    className={`w-4 h-4 rounded-full border-[1.5px] transition-transform shadow-sm ${
                      textSettings.colorId === c.id ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.value}
                  />
                ))}
              </div>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => setTextSettings(prev => ({ ...prev, bgEnabled: !prev.bgEnabled }))}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setTextSettings(prev => ({ ...prev, bgEnabled: !prev.bgEnabled }));
                }
              }}
              className="flex items-center justify-between cursor-pointer p-2 bg-[#141416] border border-[#262629] rounded-lg hover:border-[#3a3a3f] transition-all select-none"
            >
              <span className="text-[10px] font-bold text-gray-200 tracking-wide">Background Solid</span>
              <ToggleSwitch
                checked={textSettings.bgEnabled}
                onChange={() => setTextSettings(prev => ({ ...prev, bgEnabled: !prev.bgEnabled }))}
                colorClass="bg-pink-500"
              />
            </div>

            {textSettings.bgEnabled && (
              <div className="space-y-1.5 pt-1 animate-in fade-in slide-in-from-top-2">
                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                  Background Color
                </label>
                <div className="flex gap-1.5 flex-wrap bg-[#141416] p-2 rounded-lg border border-[#262629]">
                  {colors.map(c => (
                    <button
                      key={`bg-c-${c.id}`}
                      onClick={() => setTextSettings({ ...textSettings, bgColorId: c.id })}
                      className={`w-4 h-4 rounded-[4px] border-[1.5px] transition-transform shadow-sm ${
                        textSettings.bgColorId === c.id
                          ? 'border-white scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.value}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (tool === 'player-move') {
    return (
      <PlayerMovePanel
        playerMoveState={playerMoveState}
        onCancel={() => {
          resetPlayerMove();
          setIsDrawing(false);
        }}
        toolSize={toolSize}
        onToolSizeChange={setToolSize}
        colors={colors}
        activeColorId={activeColorId}
        onSelectColorId={setActiveColorId}
        settings={playerMoveSettings}
        onSettingsChange={setPlayerMoveSettings}
        telestrationPresetBlock={renderTelestrationColorPresetBlock()}
      />
    );
  }

  // Default Drawing Tools
  let headerIcon: any = Pen;
  let headerTitle = 'Drawing Tools';
  if (tool === 'pen') {
    headerIcon = Pen;
    headerTitle = 'Pen Tool';
  } else if (tool === 'line') {
    headerIcon = Minus;
    headerTitle = 'Line Tool';
  } else if (tool === 'arrow') {
    headerIcon = MoveUpRight;
    headerTitle = 'Arrow Tool';
  } else if (tool === 'curved-arrow') {
    headerIcon = CornerUpRight;
    headerTitle = 'Aerial Arrow';
  }
  let headerSubtitle = 'Customize Stroke';
  if (tool === 'circle') {
    headerIcon = Circle;
    headerTitle = 'Ring Tool';
    headerSubtitle = 'Broadcast 3D Telestration';
  } else if (tool === 'connected-circle') {
    headerIcon = GitCommitVertical;
    headerTitle = 'Chain Tool';
    headerSubtitle = 'Broadcast Tactical Units';
  }

  return (
    <div className="space-y-3 animate-in fade-in duration-200">
      <SectionHeader
        icon={headerIcon}
        title={headerTitle}
        subtitle={headerSubtitle}
        colorClass="text-[#c6ff1f]"
        bgClass="bg-[#c6ff1f]/10"
        borderClass="border-[#c6ff1f]/20"
      />
      {renderTelestrationColorPresetBlock()}

      <div className="space-y-3">
        {!['circle', 'connected-circle'].includes(tool || '') && (
          <RangeSlider
            label="Tool Size"
            value={toolSize}
            onChange={(e: any) => setToolSize(parseInt(e.target.value))}
            min={1}
            max={20}
            step={1}
            unit="px"
            accentClass="[&::-webkit-slider-thumb]:bg-[#c6ff1f]"
          />
        )}

        {(tool === 'pen' || tool === 'arrow' || tool === 'curved-arrow') && (
          <div className="space-y-2 pt-3 border-t border-[#262629]">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setArrowSettings(prev => ({ ...prev, isDashed: !prev.isDashed }))}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setArrowSettings(prev => ({ ...prev, isDashed: !prev.isDashed }));
                }
              }}
              className="flex items-center justify-between cursor-pointer p-2 bg-[#141416] border border-[#262629] rounded-lg hover:border-[#3a3a3f] transition-all select-none"
            >
              <span className="text-[10px] font-bold text-gray-200 tracking-wide">Dashed Line</span>
              <ToggleSwitch
                checked={arrowSettings.isDashed}
                onChange={() => setArrowSettings(prev => ({ ...prev, isDashed: !prev.isDashed }))}
                colorClass="bg-[#c6ff1f]"
              />
            </div>
            {tool === 'arrow' && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => setArrowSettings(prev => ({ ...prev, isCurved: !prev.isCurved }))}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setArrowSettings(prev => ({ ...prev, isCurved: !prev.isCurved }));
                  }
                }}
                className="flex items-center justify-between cursor-pointer p-2 bg-[#141416] border border-[#262629] rounded-lg hover:border-[#3a3a3f] transition-all select-none"
              >
                <span className="text-[10px] font-bold text-gray-200 tracking-wide">Curved Arrow</span>
                <ToggleSwitch
                  checked={arrowSettings.isCurved}
                  onChange={() => setArrowSettings(prev => ({ ...prev, isCurved: !prev.isCurved }))}
                  colorClass="bg-[#c6ff1f]"
                />
              </div>
            )}
            {tool === 'pen' && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => setArrowSettings(prev => ({ ...prev, isFreehand: !prev.isFreehand }))}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setArrowSettings(prev => ({ ...prev, isFreehand: !prev.isFreehand }));
                  }
                }}
                className="flex items-center justify-between cursor-pointer p-2 bg-[#141416] border border-[#262629] rounded-lg hover:border-[#3a3a3f] transition-all select-none"
              >
                <span className="text-[10px] font-bold text-gray-200 tracking-wide">Freehand Mode</span>
                <ToggleSwitch
                  checked={arrowSettings.isFreehand}
                  onChange={() => setArrowSettings(prev => ({ ...prev, isFreehand: !prev.isFreehand }))}
                  colorClass="bg-[#c6ff1f]"
                />
              </div>
            )}
          </div>
        )}

        {(tool === 'circle' || tool === 'connected-circle') && (
          <div className="space-y-3 pt-3 border-t border-[#262629]">
            <RangeSlider
              label="Ring Radius"
              value={ringSettings.size}
              onChange={(e: any) => setRingSettings(prev => ({ ...prev, size: parseInt(e.target.value) }))}
              min={15}
              max={180}
              step={1}
              unit="px"
              accentClass="[&::-webkit-slider-thumb]:bg-[#c6ff1f]"
            />

            {/* Shimmer / Orbiting Glint Streak */}
            <div
              role="button"
              tabIndex={0}
              onClick={() =>
                setRingSettings(prev => ({ ...prev, showGlint: prev.showGlint === false ? true : false }))
              }
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setRingSettings(prev => ({ ...prev, showGlint: prev.showGlint === false ? true : false }));
                }
              }}
              className="flex items-center justify-between cursor-pointer p-2 bg-[#141416] border border-[#262629] rounded-lg hover:border-[#3a3a3f] transition-all select-none"
            >
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-gray-200 tracking-wide">Specular Glint Shimmer</span>
                <span className="text-[8px] text-gray-400">Broadcast glint highlight streak</span>
              </div>
              <ToggleSwitch
                checked={ringSettings.showGlint !== false}
                onChange={() =>
                  setRingSettings(prev => ({ ...prev, showGlint: prev.showGlint === false ? true : false }))
                }
                colorClass="bg-[#c6ff1f]"
              />
            </div>

            {tool === 'connected-circle' && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => setRingSettings(prev => ({ ...prev, isFilled: !prev.isFilled }))}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setRingSettings(prev => ({ ...prev, isFilled: !prev.isFilled }));
                  }
                }}
                className="flex items-center justify-between cursor-pointer p-2 bg-[#141416] border border-[#262629] rounded-lg hover:border-[#3a3a3f] transition-all select-none"
              >
                <span className="text-[10px] font-bold text-gray-200 tracking-wide">Filled Shape</span>
                <ToggleSwitch
                  checked={ringSettings.isFilled}
                  onChange={() => setRingSettings(prev => ({ ...prev, isFilled: !prev.isFilled }))}
                  colorClass="bg-[#c6ff1f]"
                />
              </div>
            )}

            <div className="pt-2 border-t border-[#262629] space-y-2">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setRingSettings(prev => ({ ...prev, secondaryRing: !prev.secondaryRing }))}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setRingSettings(prev => ({ ...prev, secondaryRing: !prev.secondaryRing }));
                  }
                }}
                className="flex items-center justify-between cursor-pointer p-2 bg-[#141416] border border-[#262629] rounded-lg hover:border-[#3a3a3f] transition-all select-none"
              >
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-200 tracking-wide">
                    Secondary Outer 3D Ring
                  </span>
                  <span className="text-[8px] text-gray-400">Broadcast 3D tactical segmented bars</span>
                </div>
                <ToggleSwitch
                  checked={ringSettings.secondaryRing}
                  onChange={() => setRingSettings(prev => ({ ...prev, secondaryRing: !prev.secondaryRing }))}
                  colorClass="bg-[#c6ff1f]"
                />
              </div>

              {ringSettings.secondaryRing && (
                <div className="space-y-2.5 pl-1 animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                        Secondary Color
                      </label>
                      <span className="text-[8px] font-mono text-cyan-400">{ringSettings.secondaryColor}</span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap items-center bg-[#141416] p-2 rounded-lg border border-[#262629]">
                      {colors.map(c => (
                        <button
                          key={c.id}
                          onClick={() => setRingSettings(prev => ({ ...prev, secondaryColor: c.value }))}
                          className={`w-4 h-4 rounded-full border-2 transition-transform shadow-sm ${
                            ringSettings.secondaryColor.toLowerCase() === c.value.toLowerCase()
                              ? 'border-white scale-110 ring-2 ring-[#c6ff1f]/40'
                              : 'border-transparent hover:scale-105'
                          }`}
                          style={{ backgroundColor: c.value }}
                        />
                      ))}
                      {/* Broadcast special colors from codex */}
                      {['#00eaff', '#ffcc00', '#ff2a55', '#39ff14', '#ffffff'].map(c => (
                        <button
                          key={c}
                          onClick={() => setRingSettings(prev => ({ ...prev, secondaryColor: c }))}
                          className={`w-4 h-4 rounded-full border-2 transition-transform shadow-sm ${
                            ringSettings.secondaryColor.toLowerCase() === c.toLowerCase()
                              ? 'border-white scale-110 ring-2 ring-[#c6ff1f]/40'
                              : 'border-transparent hover:scale-105'
                          }`}
                          style={{ backgroundColor: c }}
                          title={`Codex ${c}`}
                        />
                      ))}
                      <input
                        type="color"
                        value={ringSettings.secondaryColor || '#00eaff'}
                        onChange={e => setRingSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
                        className="w-4 h-4 rounded cursor-pointer border border-[#444] bg-transparent p-0 ml-auto"
                        title="Custom color"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                      Outer Bars Pattern
                    </label>
                    <select
                      value={ringSettings.secondaryPattern || 'telemetry-8'}
                      onChange={e =>
                        setRingSettings(prev => ({ ...prev, secondaryPattern: e.target.value as any }))
                      }
                      className="w-full bg-[#141416] text-[10px] text-gray-200 font-medium px-2 py-1.5 rounded-md border border-[#262629] focus:border-[#c6ff1f] outline-none cursor-pointer"
                    >
                      <option value="telemetry-8">8 Telemetry Bars (Default)</option>
                      <option value="brackets-4">4 Tactical Brackets</option>
                      <option value="stamina-12">12 Stamina Blocks</option>
                      <option value="asymmetric-hud">Asymmetric Broadcast HUD</option>
                      <option value="continuous">Continuous Dual Ring</option>
                    </select>
                  </div>

                  <div className="pt-1">
                    <RangeSlider
                      label="Dual Band Thickness"
                      value={ringSettings.bandThickness ?? 50}
                      onChange={(e: any) =>
                        setRingSettings(prev => ({ ...prev, bandThickness: parseInt(e.target.value) }))
                      }
                      min={25}
                      max={90}
                      step={5}
                      unit="%"
                      accentClass="[&::-webkit-slider-thumb]:bg-[#c6ff1f]"
                    />
                  </div>

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setRingSettings(prev => ({
                        ...prev,
                        secondaryOrbit: prev.secondaryOrbit === false ? true : false,
                      }))
                    }
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setRingSettings(prev => ({
                          ...prev,
                          secondaryOrbit: prev.secondaryOrbit === false ? true : false,
                        }));
                      }
                    }}
                    className="flex items-center justify-between cursor-pointer p-1.5 bg-[#141416] border border-[#262629] rounded-md hover:border-[#3a3a3f] transition-all select-none"
                  >
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-gray-300">Orbit Counter-Rotation</span>
                      <span className="text-[7.5px] text-gray-400">Slow rotation of outer tactical bars</span>
                    </div>
                    <ToggleSwitch
                      checked={ringSettings.secondaryOrbit !== false}
                      onChange={() =>
                        setRingSettings(prev => ({
                          ...prev,
                          secondaryOrbit: prev.secondaryOrbit === false ? true : false,
                        }))
                      }
                      colorClass="bg-[#c6ff1f]"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
