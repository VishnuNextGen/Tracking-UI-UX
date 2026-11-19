import React from 'react';
import { 
  Snowflake, Eye, EyeOff, Check, PlusCircle, 
  LayoutGrid, Trash2, Film, Play, Pause, SkipForward, Clock, Info, Ban
} from 'lucide-react';
import { FreezeFrame, PlaylistItem, Shape, TagEvent, Tag as TagData } from '../../../types';
import { formatTime } from '../../../utils/math';
import { 
  resolveClipTiming, 
  getClipEventId, 
  getClipFreezeFramesInfo,
  getClipInstanceId,
  ClipFreezeFramesInfo 
} from '../../../utils/playlistUtils';
import { ScrubbableTimeInput } from '../../Shared/ScrubbableTimeInput';

export interface PlaylistClipFreezeFramePanelProps {
  clipItem: PlaylistItem;
  clipIndex: number;
  playlistName: string;
  allPlaylistClips?: PlaylistItem[];
  tagEvents: TagEvent[];
  tags: TagData[];
  candidateFreezeFrames: FreezeFrame[];
  allMatchFreezeFramesCount: number;
  currentVideoTime: number;
  isPlaying: boolean;
  activeFreezeFrameId: string | null;
  isFreezeFramePlaying?: boolean;
  countdownValue?: number;
  onToggleFreezeFramePlay?: (freezeFrameId?: string) => void;
  onSeekFreezeFrame?: (targetElapsed: number) => void;
  onSkipFreezeFrame?: () => void;
  hoveredFreezeFrameId: string | null;
  setHoveredFreezeFrameId: (id: string | null) => void;
  onSeek: (time: number) => void;
  onToggleDeactivation: (freezeFrameId: string) => void;
  onSetAllDeactivation: (freezeFrameIds: string[], deactivate: boolean) => void;
  onUpdateDuration: (freezeFrameId: string, duration: number) => void;
  onEditAnimation: (freezeFrameId: string, timestamp: number) => void;
  onDeleteFromProject: (freezeFrameId: string) => void;
  onAddFreezeFrame: () => void;
  onSwitchToAllFramesScope?: () => void;
  onDuplicateClip?: () => void;
  onDuplicateCleanSlate?: () => void;
  onIsolateClip?: () => void;
  onToggleIsolation?: () => void;
  clipProjectName?: string;
  clipTrackedShapes?: Shape[];
  onToggleTrackInFreezeFrame?: (freezeFrameId: string, trackId: string) => void;
}

export const PlaylistClipFreezeFramePanel: React.FC<PlaylistClipFreezeFramePanelProps> = ({
  clipItem,
  clipIndex,
  tagEvents,
  tags,
  candidateFreezeFrames,
  currentVideoTime,
  isPlaying,
  activeFreezeFrameId,
  isFreezeFramePlaying = false,
  countdownValue = 0,
  onToggleFreezeFramePlay,
  onSeekFreezeFrame,
  onSkipFreezeFrame,
  hoveredFreezeFrameId,
  setHoveredFreezeFrameId,
  onSeek,
  onToggleDeactivation,
  onSetAllDeactivation,
  onUpdateDuration,
  onEditAnimation,
  onDeleteFromProject,
  onAddFreezeFrame,
  clipProjectName,
  clipTrackedShapes = [],
  onToggleTrackInFreezeFrame,
}) => {
  const eventId = getClipEventId(clipItem);
  const masterEvent = tagEvents.find(e => e.id === eventId);
  const tag = masterEvent ? tags.find(t => t.id === masterEvent.tagId) : undefined;
  const timing = resolveClipTiming(clipItem, masterEvent);
  const currentClipInstanceId = getClipInstanceId(clipItem, clipIndex);

  // Filter freeze frames belonging specifically to this clip range
  const ffInfo: ClipFreezeFramesInfo = getClipFreezeFramesInfo(clipItem, timing, candidateFreezeFrames, clipIndex);

  const isCurrentTimeInClip = currentVideoTime >= timing.startTime - 0.05 && currentVideoTime <= timing.endTime + 0.05;

  return (
    <div className="space-y-2 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="p-2.5 rounded-lg bg-[#111215] border border-[#252830] shadow-sm space-y-2">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-md bg-[#c6ff1f]/15 border border-[#c6ff1f]/30 shrink-0 shadow-xs">
              <Snowflake className="w-3.5 h-3.5 text-[#c6ff1f]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-white tracking-tight truncate">
                  Clip #{clipIndex + 1}: {tag?.name || 'Clip'}
                </span>
              </div>
              <p className="text-[8.5px] text-gray-400 font-mono leading-none mt-0.5">
                {formatTime(timing.startTime)} – {formatTime(timing.endTime)} ({formatTime(timing.duration)})
              </p>
            </div>
          </div>

          {/* Tag Dot */}
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm border border-white/20"
            style={{ backgroundColor: tag?.color || '#3b82f6' }}
            title={tag?.name || 'Clip'}
          />
        </div>

        {clipProjectName && (
          <div className="flex items-center gap-1">
            <span className="inline-flex items-center gap-1 text-[8px] font-semibold text-cyan-300 bg-cyan-950/60 border border-cyan-800/40 px-1.5 py-0.5 rounded truncate max-w-full">
              <Film className="w-2.5 h-2.5 shrink-0 text-cyan-400" />
              <span className="truncate">Match: {clipProjectName}</span>
            </span>
          </div>
        )}

        {/* Primary Action: Standard Add Freeze Frame Button */}
        <div className="pt-0.5">
          <button
            type="button"
            onClick={onAddFreezeFrame}
            disabled={isPlaying}
            className="w-full py-1.5 px-3 bg-[#c6ff1f] hover:bg-[#b5ee15] active:bg-[#a5db12] text-black rounded-md flex items-center justify-center gap-1.5 font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all text-[9.5px] shadow-sm cursor-pointer"
            title={
              isCurrentTimeInClip
                ? `Add freeze frame at current video time (${formatTime(currentVideoTime)})`
                : `Seek video into Clip #${clipIndex + 1} and pause to add a frame`
            }
          >
            <PlusCircle className="w-3.5 h-3.5 text-black stroke-[2.5]" />
            <span>Add Freeze Frame</span>
          </button>
        </div>
      </div>

      {/* Status Bar & Quick Toggle: Active vs Off */}
      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#111215] border border-[#22252c] text-[9px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${
            ffInfo.activeCount > 0 ? 'bg-[#c6ff1f] shadow-[0_0_6px_rgba(198,255,31,0.6)]' : 'bg-gray-600'
          }`} />
          <span className="font-semibold text-gray-300">
            {ffInfo.activeCount} Active <span className="text-gray-500">·</span> {ffInfo.deactivatedCount} Off
          </span>
          <span 
            className="text-gray-500 hover:text-gray-300 transition-colors cursor-help shrink-0 ml-0.5" 
            title="Automatic Scope: Freeze frames added in this clip stay exclusive to it. They remain OFF in other clips unless turned on."
          >
            <Info className="w-3 h-3" />
          </span>
        </div>

        {ffInfo.totalCount > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onSetAllDeactivation(ffInfo.allClipFreezeFrames.map(f => f.id), false)}
              disabled={ffInfo.deactivatedCount === 0}
              className="py-0.5 px-1.5 bg-[#1b2028] hover:bg-[#252b36] disabled:opacity-30 disabled:hover:bg-[#1b2028] text-gray-200 hover:text-[#c6ff1f] rounded text-[8px] font-bold flex items-center gap-0.5 transition-all cursor-pointer disabled:cursor-default"
              title="Turn ON all freeze frames in this clip's time range"
            >
              <Check className="w-2.5 h-2.5 text-[#c6ff1f]" />
              <span>All ON</span>
            </button>
            <button
              type="button"
              onClick={() => onSetAllDeactivation(ffInfo.allClipFreezeFrames.map(f => f.id), true)}
              disabled={ffInfo.activeCount === 0}
              className="py-0.5 px-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 text-gray-400 hover:text-white rounded text-[8px] font-bold flex items-center gap-0.5 transition-all cursor-pointer disabled:cursor-default"
              title="Turn OFF all freeze frames in this clip (skips pausing during this clip)"
            >
              <EyeOff className="w-2.5 h-2.5" />
              <span>All OFF</span>
            </button>
          </div>
        )}
      </div>

      {/* Freeze Frames List */}
      <div className="space-y-1.5 pt-0.5">
        {ffInfo.allClipFreezeFrames.length === 0 ? (
          <div className="text-center py-6 px-3 bg-[#111215] rounded-lg border border-[#22242b] border-dashed space-y-1.5">
            <div className="w-8 h-8 rounded-full bg-[#181a20] border border-white/5 flex items-center justify-center mx-auto text-gray-500">
              <Snowflake className="w-4 h-4 stroke-1" />
            </div>
            <p className="text-[10px] font-bold text-gray-300">No freeze frames in this clip</p>
            <p className="text-[8.5px] text-gray-500 max-w-[220px] mx-auto leading-relaxed">
              Pause between {formatTime(timing.startTime)} and {formatTime(timing.endTime)} and click <strong className="text-gray-300">Add Freeze Frame</strong>.
            </p>
          </div>
        ) : (
          ffInfo.allClipFreezeFrames.map((ff, idx) => {
            const isDeactivated = ffInfo.deactivatedFreezeFrames.some(d => d.id === ff.id);
            const isActivePlaying = activeFreezeFrameId === ff.id && !isDeactivated;
            const isHovered = hoveredFreezeFrameId === ff.id;
            const isCreatedHere = Boolean(
              ff.clipInstanceId && ff.clipInstanceId === currentClipInstanceId
            );

            return (
              <div
                key={ff.id}
                onMouseEnter={() => setHoveredFreezeFrameId(ff.id)}
                onMouseLeave={() => setHoveredFreezeFrameId(null)}
                className={`relative rounded-lg overflow-hidden transition-all duration-150 ${
                  isDeactivated
                    ? 'p-[1px] bg-[#101115]/80 border border-white/5 opacity-60 hover:opacity-100'
                    : isActivePlaying
                    ? 'p-[1px] bg-[#1a160d] border border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.25)] ring-1 ring-amber-500/50'
                    : isHovered
                    ? 'p-[1px] bg-[#151720] border border-[#c6ff1f]/60'
                    : 'p-[1px] bg-[#111317] border border-[#232630] hover:border-[#353948]'
                }`}
              >
                {/* Main Card Content */}
                <div className="p-2 space-y-1.5">
                  {/* Row 1: Timestamp & Seek (Left) vs Obvious ON/OFF Toggle (Right) */}
                  <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-white/5">
                    {/* Timestamp & Seek */}
                    <div 
                      className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden cursor-pointer group"
                      onClick={() => onSeek(ff.timestamp)}
                      title="Click to seek video to this freeze frame"
                    >
                      <div className={`w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold border shrink-0 ${
                        isDeactivated
                          ? 'bg-white/5 text-gray-500 border-white/10'
                          : isActivePlaying
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-[#c6ff1f]/20 text-[#c6ff1f] border-[#c6ff1f]/40'
                      }`}>
                        {idx + 1}
                      </div>

                      <span className={`font-mono text-[9.5px] font-bold tracking-tight transition-colors shrink-0 ${
                        isDeactivated
                          ? 'text-gray-500 line-through'
                          : isActivePlaying
                          ? 'text-amber-300'
                          : 'text-white group-hover:text-[#c6ff1f]'
                      }`}>
                        {formatTime(ff.timestamp)}
                      </span>

                      {/* Origin Badge */}
                      {isCreatedHere ? (
                        <span className="text-[7px] font-mono px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold shrink-0 truncate max-w-[60px]">
                          This Clip
                        </span>
                      ) : (
                        <span className="text-[7px] font-mono px-1 py-0.2 rounded bg-blue-500/10 text-blue-300/80 border border-blue-500/20 font-medium shrink-0 truncate max-w-[55px]" title="Created in another clip or on match timeline">
                          Shared
                        </span>
                      )}
                    </div>

                    {/* Dedicated ON / OFF Toggle Button - Clean on the Right */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleDeactivation(ff.id);
                      }}
                      className={`px-2 py-0.5 rounded text-[8px] font-bold border flex items-center gap-1 transition-all cursor-pointer shrink-0 z-10 ${
                        !isDeactivated
                          ? 'bg-[#c6ff1f]/15 hover:bg-amber-500/20 text-[#c6ff1f] hover:text-amber-300 border-[#c6ff1f]/35 hover:border-amber-500/40 shadow-xs'
                          : 'bg-white/5 hover:bg-[#c6ff1f]/20 text-gray-400 hover:text-[#c6ff1f] border-white/10 hover:border-[#c6ff1f]/35'
                      }`}
                      title={
                        isDeactivated
                          ? 'Turn ON for this clip: frame will pause and render during playback/export'
                          : 'Turn OFF for this clip: video plays smoothly past this frame without stopping'
                      }
                    >
                      {!isDeactivated ? (
                        <>
                          <Eye className="w-2.5 h-2.5 text-[#c6ff1f]" />
                          <span>ON</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-2.5 h-2.5 text-gray-500" />
                          <span className="text-gray-400">OFF</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Row 2: Duration / Timing Component (Left) vs Edit & Delete (Right) */}
                  <div className="flex items-center justify-between gap-2 pt-1" onClick={e => e.stopPropagation()}>
                    {/* Timing Component: Clean, compact, NO downward symbol */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Clock className="w-2.5 h-2.5 text-gray-500 shrink-0" />
                      <ScrubbableTimeInput
                        value={ff.duration || 5}
                        onChange={(newDur) => onUpdateDuration(ff.id, newDur)}
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
                        tooltipTitle="Freeze duration. Drag or scroll to adjust, click to type, or choose a preset."
                      />
                    </div>

                    {/* Timeline Animation & Delete Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onEditAnimation(ff.id, ff.timestamp)}
                        className="p-1 rounded text-gray-400 hover:text-[#c6ff1f] hover:bg-[#c6ff1f]/10 transition-colors cursor-pointer flex items-center gap-1 text-[8.5px]"
                        title="Edit drawings and animation timeline"
                      >
                        <LayoutGrid className="w-3 h-3" />
                        <span className="text-[7.5px] font-medium hidden sm:inline">Timeline</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteFromProject(ff.id)}
                        className="p-1 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
                        title="Delete permanently from match project"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Active Frame Live Playback Controls */}
                  {isActivePlaying && (
                    <div className="pt-1.5 mt-1 border-t border-amber-500/20 space-y-1" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {onToggleFreezeFramePlay && (
                            <button
                              type="button"
                              onClick={() => onToggleFreezeFramePlay(ff.id)}
                              className="p-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-colors cursor-pointer"
                              title={isFreezeFramePlaying ? "Pause Freeze Frame Preview" : "Play Freeze Frame Preview"}
                            >
                              {isFreezeFramePlaying ? (
                                <Pause className="w-2.5 h-2.5 fill-current" />
                              ) : (
                                <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                              )}
                            </button>
                          )}
                          <div className="font-mono text-[9px] flex items-baseline gap-0.5">
                            <span className="font-bold text-amber-300">
                              {Math.max(0, (ff.duration || 5) - (countdownValue || 0)).toFixed(1)}s
                            </span>
                            <span className="text-[7.5px] text-gray-400">
                              / {(ff.duration || 5).toFixed(1)}s
                            </span>
                          </div>
                          <span className={`text-[7px] font-mono px-1 py-0.5 rounded font-semibold ${
                            isFreezeFramePlaying ? 'bg-amber-400/20 text-amber-300' : 'bg-gray-700/60 text-gray-300'
                          }`}>
                            {isFreezeFramePlaying ? 'PLAYING' : 'PAUSED'}
                          </span>
                        </div>
                        {onSkipFreezeFrame && (
                          <button
                            type="button"
                            onClick={onSkipFreezeFrame}
                            className="px-1.5 py-0.5 rounded text-[8px] font-mono text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-0.5 cursor-pointer"
                            title="Resume video playback (Space or Esc)"
                          >
                            <span>Skip</span>
                            <SkipForward className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>

                      {/* Scrub Playbar */}
                      {(() => {
                        const dur = Math.max(0.1, ff.duration || 5);
                        const elapsed = Math.max(0, Math.min(dur, dur - (countdownValue || 0)));
                        const pct = Math.min(100, Math.max(0, (elapsed / dur) * 100));
                        return (
                          <div
                            className="relative h-2 w-full bg-[#10141f] hover:bg-[#1a2233] border border-amber-500/30 rounded-full cursor-pointer overflow-hidden transition-colors select-none group"
                            onClick={(e) => {
                              if (!onSeekFreezeFrame) return;
                              const rect = e.currentTarget.getBoundingClientRect();
                              const clickPct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                              onSeekFreezeFrame(clickPct * dur);
                            }}
                            title="Click to scrub freeze frame (jump to any point)"
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

                  {/* Overlapping Dynamic Tools at this Freeze Frame timestamp: Use vs Avoid */}
                  {(() => {
                    const overlappingTracks = clipTrackedShapes.filter(
                      (s) =>
                        !s.freezeFrameId &&
                        !s.trackHidden &&
                        s.trackStartTime !== undefined &&
                        s.trackEndTime !== undefined &&
                        s.trackStartTime - 0.05 <= ff.timestamp &&
                        s.trackEndTime + 0.05 >= ff.timestamp
                    );
                    if (overlappingTracks.length === 0) return null;
                    return (
                      <div
                        className="pt-1.5 mt-1 border-t border-white/[0.06] space-y-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between text-[8px] font-semibold uppercase tracking-wider text-gray-400">
                          <span>Dynamic Tools at Frame</span>
                          <span className="font-mono text-gray-500">
                            {overlappingTracks.filter((t) => !ff.avoidedTrackIds?.includes(t.id)).length}/{overlappingTracks.length} used
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {overlappingTracks.map((trk) => {
                            const isAvoided = Boolean(ff.avoidedTrackIds?.includes(trk.id));
                            const dotColor = trk.type === 'spotlight' ? '#facc15' : trk.type === 'lens' ? '#38bdf8' : trk.color || '#c6ff1f';
                            return (
                              <button
                                key={trk.id}
                                type="button"
                                onClick={() => onToggleTrackInFreezeFrame?.(ff.id, trk.id)}
                                className={`px-1.5 py-0.5 rounded text-[8px] font-semibold border flex items-center gap-1 transition-all cursor-pointer ${
                                  isAvoided
                                    ? 'bg-red-950/30 border-red-500/30 text-gray-400 hover:border-[#c6ff1f]/40 hover:text-gray-200'
                                    : 'bg-[#c6ff1f]/12 border-[#c6ff1f]/40 text-gray-100 hover:bg-red-950/30 hover:border-red-400/40'
                                }`}
                                title={
                                  isAvoided
                                    ? `Avoided during ${ff.name || 'Freeze Frame'} — click to Use in this frame`
                                    : `Used in ${ff.name || 'Freeze Frame'} — click to Avoid during freeze`
                                }
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: dotColor, opacity: isAvoided ? 0.4 : 1 }}
                                />
                                <span className={`truncate max-w-[78px] ${isAvoided ? 'line-through opacity-70' : ''}`}>
                                  {trk.trackLabel || trk.type}
                                </span>
                                {isAvoided ? (
                                  <span className="text-[7px] font-mono uppercase text-red-400 flex items-center gap-0.5">
                                    <Ban className="w-2 h-2" /> Avoid
                                  </span>
                                ) : (
                                  <span className="text-[7px] font-mono uppercase text-[#c6ff1f]">Use</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
