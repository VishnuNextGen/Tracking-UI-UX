import React from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  Edit2,
  RefreshCw,
  Snowflake,
  Trash2,
  Undo2,
  Redo2,
  Eraser,
  Clock,
  Layers,
  FileVideo,
  Download,
} from 'lucide-react';
import { Logo, Wordmark } from '../../Logo';
import { FreezeFrameStepSelector } from '../FreezeFrame/FreezeFrameStepSelector';
import { PeriodSyncManager } from '../PeriodSyncManager';
import { CreatorWatermarkTopBarButton } from '../../Shared/CreatorWatermarkTopBarButton';
import { getFreezeFrameStepDelay, syncFreezeFrameWithSteps } from '../../../utils/freezeFrameSteps';
import type {
  Project,
  ToolType,
  Shape,
  FreezeFrame,
  PlaylistItem,
  ColorPreset,
  PeriodSync,
  TagEvent,
  TimelineMarker,
} from '../../../types';
import type { TelestrationColors } from '../TelestrationColorPresets';
import type { DeletedFreezeFrameRecord } from '../Workspace.types';

export interface WorkspaceTopBarProps {
  project: Project;
  isLive: boolean;
  userPlan?: string;
  onForceSync?: () => void;
  onOpenBackupModal?: () => void;
  setShowCloseConfirm: React.Dispatch<React.SetStateAction<boolean>>;
  setShowInfoModal: React.Dispatch<React.SetStateAction<boolean>>;
  liveClockPeriods: { id: string; name: string }[];
  liveClockMatchPeriod: string;
  isPlaying: boolean;
  isFreezeFramePlaying: boolean;
  currentTime: number;
  duration: number;
  activeFreezeFrame: FreezeFrame | undefined;
  activeFreezeFrameId: string | null;
  freezeFrames: FreezeFrame[];
  setFreezeFrames: React.Dispatch<React.SetStateAction<FreezeFrame[]>>;
  currentStepForActiveFF: number | null;
  handleStepChange: (step: number | null) => void;
  shapes: Shape[];
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
  selectedShapeId: string | null;
  handleSelectedShapeStepChange: (selectedShapeId: string | null, newStep: number | null) => void;
  handleOpenAnimationPanel: () => void;
  editingAnimationFFId: string | null;
  addFreezeFrame: (clipHint?: PlaylistItem) => void;
  deleteFreezeFrame: (id: string) => void;
  deletedFFStack: DeletedFreezeFrameRecord[];
  undoDeleteFreezeFrame: () => void;
  undo: () => void;
  redo: () => void;
  tool: ToolType;
  setTool: React.Dispatch<React.SetStateAction<ToolType>>;
  clearAll: () => void;
  isTimerPoppedOut: boolean;
  setIsTimerPoppedOut: React.Dispatch<React.SetStateAction<boolean>>;
  isPadPoppedOut: boolean;
  setIsPadPoppedOut: React.Dispatch<React.SetStateAction<boolean>>;
  setPoppedOutCodingMode: React.Dispatch<React.SetStateAction<'panel' | 'pad'>>;
  showNotification: (
    message: string,
    color: string,
    onUndo?: () => void,
    action?: { label: string; onClick: () => void }
  ) => void;
  handleImportMatchVideo: () => void;
  handleManualSeek: (time: number, options?: { pause?: boolean }) => void;
  togglePlay: () => void;
  periodSyncs: PeriodSync[];
  setPeriodSyncs: React.Dispatch<React.SetStateAction<PeriodSync[]>>;
  tagEvents: TagEvent[];
  setTagEvents: React.Dispatch<React.SetStateAction<TagEvent[]>>;
  markers: TimelineMarker[];
  setMarkers: React.Dispatch<React.SetStateAction<TimelineMarker[]>>;
  isScreenRecording: boolean;
  isConvertingToMp4?: boolean;
  toggleScreenRecording: () => void;
  telestrationColors: TelestrationColors;
  activeTelestrationSlot: 'home' | 'away' | 'neutral' | null;
  setActiveTelestrationSlot: React.Dispatch<React.SetStateAction<'home' | 'away' | 'neutral' | null>>;
  handleSelectTelestrationSlot: (slot: 'home' | 'away' | 'neutral') => void;
  handleTelestrationRightClick: (e: React.MouseEvent, slot: 'home' | 'away' | 'neutral') => void;
  colors: ColorPreset[];
  activeColorId: number;
  setActiveColorId: React.Dispatch<React.SetStateAction<number>>;
  handleColorRightClick: (e: React.MouseEvent, colorId: number) => void;
}

export const WorkspaceTopBar: React.FC<WorkspaceTopBarProps> = ({
  project,
  isLive,
  userPlan,
  onForceSync,
  onOpenBackupModal,
  setShowCloseConfirm,
  setShowInfoModal,
  liveClockPeriods,
  liveClockMatchPeriod,
  isPlaying,
  isFreezeFramePlaying,
  currentTime,
  duration,
  activeFreezeFrame,
  activeFreezeFrameId,
  freezeFrames,
  setFreezeFrames,
  currentStepForActiveFF,
  handleStepChange,
  shapes,
  setShapes,
  selectedShapeId,
  handleSelectedShapeStepChange,
  handleOpenAnimationPanel,
  editingAnimationFFId,
  addFreezeFrame,
  deleteFreezeFrame,
  deletedFFStack,
  undoDeleteFreezeFrame,
  undo,
  redo,
  tool,
  setTool,
  clearAll,
  isTimerPoppedOut,
  setIsTimerPoppedOut,
  isPadPoppedOut,
  setIsPadPoppedOut,
  setPoppedOutCodingMode,
  showNotification,
  handleImportMatchVideo,
  handleManualSeek,
  togglePlay,
  periodSyncs,
  setPeriodSyncs,
  tagEvents,
  setTagEvents,
  markers,
  setMarkers,
  isScreenRecording,
  isConvertingToMp4,
  toggleScreenRecording,
  telestrationColors,
  activeTelestrationSlot,
  setActiveTelestrationSlot,
  handleSelectTelestrationSlot,
  handleTelestrationRightClick,
  colors,
  activeColorId,
  setActiveColorId,
  handleColorRightClick,
}) => {
  return (
    <motion.div
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="h-9 bg-[#111] border-b border-[#222] flex items-center justify-between px-2 sm:px-3 z-20 shrink-0 gap-1 sm:gap-2 overflow-hidden"
    >
      {/* Left: Branding & Project Info */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 min-w-0">
        <button
          onClick={() => setShowCloseConfirm(true)}
          className="flex items-center gap-0.5 px-1.5 py-0.5 bg-[#222] hover:bg-[#333] rounded text-gray-400 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-wider shrink-0 cursor-pointer"
        >
          <ChevronLeft className="w-2.5 h-2.5" /> <span className="hidden xs:inline">BACK</span>
        </button>
        <a
          href="https://www.tacstem.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 hover:opacity-90 transition-opacity cursor-pointer shrink-0"
          title="Tacstem — Visit www.tacstem.com"
        >
          <Logo className="w-5 h-5 shrink-0" />
          <Wordmark className="scale-[0.45] origin-left -ml-2.5 hidden 2xl:block shrink-0" />
        </a>
        <button
          onClick={() => setShowInfoModal(true)}
          className="flex items-center gap-1 px-1.5 py-0.5 bg-[#1c1c1f] hover:bg-[#27272c] border border-white/5 hover:border-white/10 rounded transition-all text-left group shrink-0 cursor-pointer min-w-0"
          title="Click to view/edit project details & description"
        >
          <span className="text-[11px] text-gray-200 group-hover:text-white font-medium truncate max-w-[70px] sm:max-w-[90px] md:max-w-[120px] lg:max-w-[150px] xl:max-w-[170px] 2xl:max-w-[220px]">
            {project.name}
          </span>
          <Edit2 className="w-2.5 h-2.5 text-gray-500 group-hover:text-[#c6ff1f] transition-colors shrink-0" />
        </button>
        {isLive && (
          <div className="flex items-center gap-1 shrink-0">
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[9px] font-bold uppercase tracking-wider shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span>LIVE</span>
            </div>
            <span className="text-[9.5px] px-1.5 py-0.5 rounded font-mono font-bold bg-white/5 text-gray-300 border border-white/10 shrink-0 hidden md:inline">
              {liveClockPeriods.find(p => p.id === liveClockMatchPeriod)?.name || '1st Half'}
            </span>
          </div>
        )}
        {onOpenBackupModal ? (
          <button
            onClick={onOpenBackupModal}
            className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-400/10 border border-amber-400/30 hover:border-amber-400/60 hover:bg-amber-400/20 rounded text-[10px] font-semibold text-amber-300 transition-colors shrink-0 cursor-pointer"
            title="Data is stored only in your browser — Click to Export or Import local backup file"
          >
            <Download className="w-2.5 h-2.5" />
            <span className="hidden xl:inline">Backup</span>
          </button>
        ) : userPlan === 'free' ? (
          <button
            onClick={onForceSync}
            className="flex items-center gap-1 px-1.5 py-0.5 bg-[#222] border border-[#333] hover:border-[#555] hover:bg-[#333] rounded text-[10px] font-medium text-gray-300 transition-colors shrink-0 cursor-pointer"
            title="Save to local browser storage"
          >
            <RefreshCw className="w-2.5 h-2.5" /> <span className="hidden xl:inline">Save</span>
          </button>
        ) : null}

        {/* Step Selector: Between Project Name / Sync and Active Freeze Frame Notification */}
        {(!isPlaying || activeFreezeFrameId) && (
          <FreezeFrameStepSelector
            currentStep={currentStepForActiveFF}
            onStepChange={handleStepChange}
            stepDelay={(() => {
              const targetFF =
                activeFreezeFrame ||
                (activeFreezeFrameId ? freezeFrames.find(ff => ff.id === activeFreezeFrameId) : undefined);
              return getFreezeFrameStepDelay(targetFF);
            })()}
            onStepDelayChange={newDelay => {
              const targetFF =
                activeFreezeFrame ||
                (activeFreezeFrameId ? freezeFrames.find(ff => ff.id === activeFreezeFrameId) : undefined);
              if (targetFF) {
                const { updatedFreezeFrame, updatedShapes } = syncFreezeFrameWithSteps(targetFF, shapes, {
                  newStepDelay: newDelay,
                });
                setShapes(updatedShapes);
                setFreezeFrames(prev => prev.map(f => (f.id === updatedFreezeFrame.id ? updatedFreezeFrame : f)));
              }
            }}
            selectedShape={selectedShapeId ? shapes.find(s => s.id === selectedShapeId) : null}
            onSelectedShapeStepChange={newStep => handleSelectedShapeStepChange(selectedShapeId, newStep)}
            hasActiveFreezeFrame={Boolean(activeFreezeFrame || activeFreezeFrameId)}
            onOpenAnimationPanel={handleOpenAnimationPanel}
            isAnimationPanelOpen={Boolean(editingAnimationFFId)}
          />
        )}

        {!isPlaying && (
          <div className="flex items-center ml-0.5 sm:ml-1 gap-1 shrink-0">
            {(() => {
              const activeFF =
                activeFreezeFrame ||
                (activeFreezeFrameId ? freezeFrames.find(ff => ff.id === activeFreezeFrameId) : undefined);
              if (activeFF) {
                return (
                  <div className="flex items-center gap-1 animate-in fade-in shrink-0">
                    <div 
                      className="bg-[#c6ff1f]/90 backdrop-blur-sm text-black px-1.5 py-0.5 rounded text-[10px] font-bold border border-[#c6ff1f]/50 flex items-center gap-1 select-none shadow-xs cursor-default"
                      title="Active Freeze Frame. Press Space to skip animation and resume video playback"
                    >
                      <Snowflake className="w-2.5 h-2.5 text-black shrink-0" />
                      <span className="hidden xl:inline">FREEZE FRAME</span>
                      <span className="xl:hidden">FF</span>
                    </div>
                    <button
                      onClick={() => deleteFreezeFrame(activeFF.id)}
                      className="p-0.5 bg-red-600/80 hover:bg-red-600 text-white rounded border border-red-500/50 shadow-xs transition-colors cursor-pointer"
                      title="Delete Freeze Frame"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                );
              }

              return (
                <button
                  onClick={() => addFreezeFrame()}
                  className="px-1.5 py-0.5 bg-[#1c1c1f] hover:bg-[#28282d] text-gray-200 hover:text-[#c6ff1f] border border-white/10 hover:border-[#c6ff1f]/50 rounded text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs group shrink-0"
                  title="Add Freeze Frame (Shortcut: Shift+F)"
                >
                  <Snowflake className="w-3 h-3 text-[#c6ff1f] group-hover:rotate-45 transition-transform shrink-0" />
                  <span className="hidden xl:inline">Add Freeze Frame</span>
                  <span className="hidden sm:inline xl:hidden">Add FF</span>
                  <span className="hidden 2xl:inline text-[8.5px] text-gray-400 font-mono bg-white/5 px-1 py-0.2 rounded border border-white/10">
                    Shift+F
                  </span>
                </button>
              );
            })()}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {!isLive && (
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => {
              if (deletedFFStack.length > 0) {
                undoDeleteFreezeFrame();
              } else {
                undo();
              }
            }}
            className="w-5.5 h-5.5 sm:w-6 sm:h-6 flex items-center justify-center hover:bg-[#222] rounded text-gray-300 hover:text-white transition-colors cursor-pointer"
            title={deletedFFStack.length > 0 ? 'Undo Delete Freeze Frame (Ctrl+Z)' : 'Undo (Ctrl+Z)'}
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={redo}
            className="w-5.5 h-5.5 sm:w-6 sm:h-6 flex items-center justify-center hover:bg-[#222] rounded text-gray-300 hover:text-white transition-colors cursor-pointer"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <div className="h-3 w-[1px] bg-[#333] mx-0.5 sm:mx-1" />
          <button
            onClick={() => setTool('eraser')}
            className={`w-5.5 h-5.5 sm:w-6 sm:h-6 flex items-center justify-center rounded transition-colors cursor-pointer ${
              tool === 'eraser' ? 'bg-[#c6ff1f] text-black' : 'hover:bg-[#222] text-gray-300 hover:text-white'
            }`}
            title="Eraser Tool"
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={clearAll}
            className="w-5.5 h-5.5 sm:w-6 sm:h-6 flex items-center justify-center hover:bg-red-900/30 rounded text-gray-300 hover:text-red-400 transition-colors cursor-pointer"
            title="Clear All (Del)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex-1 min-w-[2px]" />

      <div className="flex items-center gap-1.5 shrink-0">
        {isLive && (
          <div className="flex items-center gap-1 shrink-0">
            {/* Exactly 2 floating toggle buttons across the entire live experience */}
            <button
              type="button"
              onClick={() => {
                setIsTimerPoppedOut(prev => !prev);
                if (!isTimerPoppedOut) showNotification('Floating Timer enabled', '#c6ff1f');
              }}
              className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded text-[11px] font-bold transition-all border cursor-pointer ${
                isTimerPoppedOut
                  ? 'bg-[#c6ff1f]/20 border-[#c6ff1f] text-[#c6ff1f] shadow-xs'
                  : 'bg-[#1a1a20] hover:bg-[#252530] border-white/10 text-gray-300 hover:text-white'
              }`}
              title={isTimerPoppedOut ? 'Dock Floating Timer' : 'Open Floating Timer overlay'}
            >
              <Clock className="w-3 h-3" />
              <span className="hidden sm:inline">Timer</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPadPoppedOut(prev => !prev);
                if (!isPadPoppedOut) {
                  setPoppedOutCodingMode('panel');
                  showNotification('Floating Code Pad enabled', '#818cf8');
                }
              }}
              className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded text-[11px] font-bold transition-all border cursor-pointer ${
                isPadPoppedOut
                  ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300 shadow-xs'
                  : 'bg-[#1a1a20] hover:bg-[#252530] border-white/10 text-gray-300 hover:text-white'
              }`}
              title={isPadPoppedOut ? 'Dock Floating Code Pad' : 'Open Floating Code Pad overlay'}
            >
              <Layers className="w-3 h-3" />
              <span className="hidden sm:inline">Code Pad</span>
            </button>
            <button
              type="button"
              onClick={handleImportMatchVideo}
              className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded text-[11px] font-bold shadow-xs transition-all active:scale-95 cursor-pointer ml-0.5"
              title="Finish match session and import video recording"
            >
              <FileVideo className="w-3 h-3" />
              <span className="hidden md:inline">Finish & Import</span>
              <span className="hidden sm:inline md:hidden">Finish</span>
            </button>
          </div>
        )}

        {!isLive && (
          <PeriodSyncManager
            currentTime={currentTime}
            duration={duration}
            isPlaying={activeFreezeFrameId ? isFreezeFramePlaying : isPlaying}
            onSeek={t => handleManualSeek(t, { pause: true })}
            onTogglePlay={togglePlay}
            periodSyncs={periodSyncs}
            setPeriodSyncs={setPeriodSyncs}
            tagEvents={tagEvents}
            setTagEvents={setTagEvents}
            markers={markers}
            setMarkers={setMarkers}
            onNotify={showNotification}
          />
        )}
        {!isLive && <CreatorWatermarkTopBarButton variant="workspace" />}
        {!isLive && (
          <button
            onClick={toggleScreenRecording}
            disabled={isConvertingToMp4}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-full font-bold text-[10px] sm:text-[11px] tracking-wide transition-all border shrink-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
              isConvertingToMp4
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 animate-pulse'
                : isScreenRecording
                ? 'bg-red-600 hover:bg-red-700 text-white border-red-500 animate-pulse ring-1 ring-red-500/50'
                : 'bg-[#1a1a1a] hover:bg-[#222] text-gray-300 hover:text-white border-[#333] hover:border-red-500/50 hover:text-red-400'
            }`}
            title={
              isConvertingToMp4
                ? 'Converting and saving MP4 video...'
                : isScreenRecording
                ? 'Stop Recording'
                : 'Record Canvas Video'
            }
          >
            {isConvertingToMp4 ? (
              <>
                <RefreshCw className="w-2.5 h-2.5 animate-spin text-amber-300" />
                <span>SAVING MP4</span>
              </>
            ) : (
              <>
                <div className={`w-2 h-2 rounded-full ${isScreenRecording ? 'bg-white' : 'bg-red-500'}`} />
                <span className="hidden sm:inline">{isScreenRecording ? 'REC' : 'RECORD'}</span>
                <span className="sm:hidden">REC</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Right: Colors (separated into Team Presets column & General Palette) */}
      {!isLive && (
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 pl-0.5 sm:pl-1">
          {/* Column 1: Team & Telestration Presets (Home, Away, Neutral) */}
          <div
            className="flex items-center gap-0.5 sm:gap-1 bg-[#15151a] px-1 sm:px-1.5 py-0.5 rounded-full border border-white/10"
            title="Team & Match Presets (Home, Away, Neutral) - Left-click to select, Right-click to configure"
          >
            {(['home', 'away', 'neutral'] as const).map(slot => {
              const isSelected = activeTelestrationSlot === slot;
              const label = slot === 'home' ? 'Home' : slot === 'away' ? 'Away' : 'Neutral';
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => handleSelectTelestrationSlot(slot)}
                  onDoubleClick={e => handleTelestrationRightClick(e, slot)}
                  onContextMenu={e => handleTelestrationRightClick(e, slot)}
                  className={`w-4 h-4 sm:w-4.5 sm:h-4.5 2xl:w-5 2xl:h-5 rounded-full border transition-transform hover:scale-115 cursor-pointer shrink-0 flex items-center justify-center relative ${
                    isSelected
                      ? 'border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.7)] ring-1 ring-white/60'
                      : 'border-white/20 opacity-80 hover:opacity-100 hover:border-white/50'
                  }`}
                  style={{ backgroundColor: telestrationColors[slot] }}
                  title={`${label} Team Color (Shift+C to cycle) • Left-click to select, Double-click to pick color from spectrum`}
                >
                  <span className="text-[7px] sm:text-[7.5px] font-black uppercase text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                    {slot[0]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="h-3.5 w-[1px] bg-white/15 shrink-0" />

          {/* Column 2: General Palette */}
          <div className="flex items-center gap-1 sm:gap-1.2">
            {colors.map(color => (
              <button
                key={color.id}
                onClick={() => {
                  setActiveColorId(color.id);
                  setActiveTelestrationSlot(null);
                }}
                onDoubleClick={e => handleColorRightClick(e, color.id)}
                onContextMenu={e => handleColorRightClick(e, color.id)}
                className={`w-4 h-4 sm:w-4.5 sm:h-4.5 2xl:w-5 2xl:h-5 rounded-full border transition-transform hover:scale-115 cursor-pointer shrink-0 ${
                  activeTelestrationSlot === null && activeColorId === color.id
                    ? 'border-white scale-110 shadow-[0_0_6px_rgba(255,255,255,0.4)] ring-1 ring-white/50'
                    : 'border-transparent ring-1 ring-white/10 hover:border-white/40'
                }`}
                style={{ backgroundColor: color.value }}
                title="Palette Color • Left-click to select, Double-click to pick color from spectrum"
              />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};
