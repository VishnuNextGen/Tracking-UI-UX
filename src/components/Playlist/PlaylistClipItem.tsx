import React, { useState, useRef, useEffect } from 'react';
import {
  GripVertical,
  Play,
  Copy,
  X,
  Scissors,
  MessageSquare,
  Film,
  Snowflake,
  ShieldCheck,
  FileText,
  ChevronUp,
  ChevronDown,
  Crosshair,
} from 'lucide-react';
import {
  useSortable,
  defaultAnimateLayoutChanges,
  type AnimateLayoutChanges,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type {
  Tag as TagData,
  TagEvent,
  Label,
  PlaylistItem,
  Project,
  FreezeFrame,
} from '../../types';
import { formatTime } from '../../utils/math';
import {
  resolveClipTiming,
  getClipEventId,
  getClipFreezeFramesInfo,
  ResolvedClipTiming,
  ClipFreezeFramesInfo,
} from '../../utils/playlistUtils';

export type PlaylistClipDensity = 'comfortable' | 'compact';

export interface ResolvedClipMetadata {
  eventId: string;
  effectiveEvent: TagEvent;
  tag?: TagData;
  timing: ResolvedClipTiming;
  deltaFormatted: string;
  ffInfo: ClipFreezeFramesInfo;
  clipTitle: string;
  clipLabels: string[];
  clipProjectName?: string;
  isMultiProject?: boolean;
}

export function resolveClipMetadata(
  item: PlaylistItem,
  index: number,
  tagEvents: TagEvent[],
  tags: TagData[],
  labels: Label[] = [],
  allBatchProjects?: Project[],
  freezeFrames: FreezeFrame[] = []
): ResolvedClipMetadata {
  const eventId = getClipEventId(item);
  let masterEvent = tagEvents.find((e) => e.id === eventId);
  let resolvedTags = tags;
  let resolvedLabels = labels;
  let resolvedFreezeFrames = freezeFrames;

  // In a single game project, all clips are from the same video/match.
  // We ONLY show clipProjectName if it's genuinely a multi-game batch project.
  const isMultiProject = Boolean(allBatchProjects && allBatchProjects.length > 1);
  let clipProjectName: string | undefined =
    isMultiProject && typeof item !== 'string' ? item.projectName : undefined;

  if (!masterEvent && typeof item !== 'string' && item.projectId && allBatchProjects) {
    const originProject = allBatchProjects.find((p) => p.id === item.projectId);
    if (originProject) {
      if (isMultiProject && !clipProjectName) clipProjectName = originProject.name;
      masterEvent = originProject.data?.tagEvents?.find((e) => e.id === eventId);
      if (originProject.data?.tags) resolvedTags = originProject.data.tags;
      if (originProject.data?.labels) resolvedLabels = originProject.data.labels;
      if (originProject.data?.freezeFrames) resolvedFreezeFrames = originProject.data.freezeFrames;
    }
  }

  if (!masterEvent && allBatchProjects) {
    for (const p of allBatchProjects) {
      const found = p.data?.tagEvents?.find((e) => e.id === eventId);
      if (found) {
        masterEvent = found;
        if (isMultiProject && !clipProjectName) clipProjectName = p.name;
        if (p.data?.tags) resolvedTags = p.data.tags;
        if (p.data?.labels) resolvedLabels = p.data.labels;
        if (p.data?.freezeFrames) resolvedFreezeFrames = p.data.freezeFrames;
        break;
      }
    }
  }

  const effectiveEvent: TagEvent = masterEvent || {
    id: eventId || `clip-${index}`,
    tagId: '',
    startTime: typeof item === 'object' && item.inPoint !== undefined ? item.inPoint : 0,
    endTime: typeof item === 'object' && item.outPoint !== undefined ? item.outPoint : 5,
    notes: typeof item === 'object' ? item.notes : undefined,
  };

  const tag = masterEvent ? resolvedTags.find((t) => t.id === masterEvent.tagId) : undefined;
  const timing = resolveClipTiming(item, effectiveEvent);

  const deltaFormatted =
    timing.durationDelta > 0
      ? `+${timing.durationDelta.toFixed(1)}s`
      : `${timing.durationDelta.toFixed(1)}s`;

  const ffInfo = getClipFreezeFramesInfo(item, timing, resolvedFreezeFrames);
  const clipTitle =
    tag?.name || (typeof item === 'object' && item.notes ? item.notes : `Clip #${index + 1}`);

  const clipLabels = (effectiveEvent.labelIds || [])
    .map((id) => resolvedLabels.find((l) => l.id === id)?.name)
    .filter((n): n is string => Boolean(n));

  return {
    eventId,
    effectiveEvent,
    tag,
    timing,
    deltaFormatted,
    ffInfo,
    clipTitle,
    clipLabels,
    clipProjectName,
    isMultiProject,
  };
}

export interface PlaylistClipCardProps {
  item: PlaylistItem;
  index: number;
  totalCount: number;
  metadata: ResolvedClipMetadata;
  density?: PlaylistClipDensity;
  isSelected: boolean;
  isPlaying: boolean;
  isRecentlyMoved?: boolean;
  isOverlay?: boolean;
  isSortingAny?: boolean;
  overlayTargetIndex?: number | null;
  dragDisabled?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  onSelect?: (e: React.MouseEvent, eventId: string, startTime: number) => void;
  onOpenInTrimmer?: (index: number) => void;
  onOpenTracking?: (index: number) => void;
  onOpenNoteModal?: (eventId: string, projectId?: string) => void;
  onPlayClip?: (startTime: number, index: number) => void;
  onDuplicate?: (index: number, options?: { cleanSlate?: boolean }) => void;
  onRemove?: (index: number) => void;
  onMoveToIndex?: (fromIndex: number, toIndex: number) => void;
}

export const PlaylistClipCard: React.FC<PlaylistClipCardProps> = ({
  item,
  index,
  totalCount,
  metadata,
  density = 'comfortable',
  isSelected,
  isPlaying,
  isRecentlyMoved = false,
  isOverlay = false,
  isSortingAny = false,
  overlayTargetIndex = null,
  dragDisabled = false,
  dragHandleProps,
  onSelect,
  onOpenInTrimmer,
  onOpenTracking,
  onOpenNoteModal,
  onPlayClip,
  onDuplicate,
  onRemove,
  onMoveToIndex,
}) => {
  const {
    effectiveEvent,
    tag,
    timing,
    deltaFormatted,
    ffInfo,
    clipTitle,
    clipLabels,
    clipProjectName,
    isMultiProject,
  } = metadata;

  const [isEditingPos, setIsEditingPos] = useState(false);
  const [posInput, setPosInput] = useState(String(index + 1));
  const posInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingPos) {
      setPosInput(String(index + 1));
      requestAnimationFrame(() => {
        posInputRef.current?.focus();
        posInputRef.current?.select();
      });
    }
  }, [isEditingPos, index]);

  const commitPositionJump = () => {
    setIsEditingPos(false);
    if (!onMoveToIndex) return;
    const parsed = parseInt(posInput, 10);
    if (!isNaN(parsed)) {
      const targetIdx = Math.max(0, Math.min(totalCount - 1, parsed - 1));
      if (targetIdx !== index) {
        onMoveToIndex(index, targetIdx);
      }
    }
  };

  const stopDragPropagation = (e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation();
  };

  const tagColor = tag?.color || '#3b82f6';
  const hasNote = Boolean(effectiveEvent.notes && effectiveEvent.notes.trim().length > 0);
  const trackedCount =
    typeof item === 'object' && Array.isArray(item.trackedShapes)
      ? item.trackedShapes.length
      : 0;
  const isCompact = density === 'compact';

  const cardStateClasses = isOverlay
    ? 'bg-[#171920]/95 backdrop-blur-md border-[#c6ff1f] shadow-[0_18px_42px_rgba(0,0,0,0.85)] ring-1 ring-[#c6ff1f]/60 scale-[1.015] cursor-grabbing'
    : isRecentlyMoved
    ? 'bg-[#1a2212] border-[#c6ff1f] shadow-[0_0_14px_rgba(198,255,31,0.22)]'
    : isPlaying
    ? 'bg-[#161e11] border-[#c6ff1f]/85 shadow-[0_0_10px_rgba(198,255,31,0.16)]'
    : isSelected
    ? 'bg-[#181a20] border-[#c6ff1f]/50'
    : 'bg-[#121317] hover:bg-[#171920] border-[#22242c] hover:border-[#323644]';

  return (
    <div
      onClick={(e) => {
        if (!isOverlay && onSelect) {
          onSelect(e, effectiveEvent.id, timing.startTime);
        }
      }}
      className={`group relative flex flex-col justify-center rounded-lg border transition-colors duration-150 select-none ${
        isCompact ? 'px-2 py-1' : 'px-2.5 py-1.5'
      } ${!isOverlay ? 'cursor-pointer' : ''} ${cardStateClasses}`}
    >
      {/* Primary Row: Grip, Sequence #, Tag Pip, Full Title & Labels, and Duration */}
      <div className="flex items-center gap-1.5 min-w-0 w-full">
        {/* Drag Handle */}
        <div
          {...(dragDisabled ? {} : dragHandleProps)}
          className={`shrink-0 p-0.5 -ml-1 rounded transition-colors touch-none ${
            dragDisabled
              ? 'text-gray-700 cursor-default'
              : isOverlay
              ? 'text-[#c6ff1f] cursor-grabbing'
              : 'text-gray-500 group-hover:text-gray-200 hover:bg-white/10 cursor-grab active:cursor-grabbing'
          }`}
          title={dragDisabled ? 'Clear search filter to drag-reorder' : 'Drag clip to reorder sequence'}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        {/* Interactive Sequence Position Badge (#1..#N) */}
        {isEditingPos && !isOverlay ? (
          <input
            ref={posInputRef}
            type="number"
            min={1}
            max={totalCount}
            value={posInput}
            onPointerDown={stopDragPropagation}
            onClick={stopDragPropagation}
            onChange={(e) => setPosInput(e.target.value)}
            onBlur={commitPositionJump}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                commitPositionJump();
              } else if (e.key === 'Escape') {
                setIsEditingPos(false);
              }
            }}
            className="w-9 h-4 px-1 bg-[#0a0b0e] border border-[#c6ff1f] rounded text-[9.5px] font-mono tabular-nums font-bold text-[#c6ff1f] text-center outline-none shrink-0"
            title={`Enter position (1–${totalCount}) and press Enter`}
          />
        ) : (
          <button
            type="button"
            disabled={isOverlay || dragDisabled || totalCount <= 1 || !onMoveToIndex}
            onPointerDown={stopDragPropagation}
            onClick={(e) => {
              e.stopPropagation();
              if (!isOverlay && !dragDisabled && totalCount > 1 && onMoveToIndex) {
                setIsEditingPos(true);
              }
            }}
            className={`font-mono tabular-nums text-[9.5px] font-bold px-1.5 py-0.2 rounded border transition-colors shrink-0 ${
              isPlaying || isSelected
                ? 'text-[#c6ff1f] bg-[#c6ff1f]/15 border-[#c6ff1f]/40 hover:bg-[#c6ff1f]/25'
                : 'text-gray-300 bg-white/[0.04] border-white/10 hover:text-white hover:border-white/20 hover:bg-white/10'
            } disabled:pointer-events-none`}
            title={
              totalCount > 1 && !dragDisabled
                ? `Clip #${index + 1} of ${totalCount} • Click to jump to any position`
                : `Clip #${index + 1}`
            }
          >
            #{index + 1}
          </button>
        )}

        {/* Tag Color Indicator Dot */}
        <span
          className="w-2 h-2 rounded-full shrink-0 ring-1 ring-white/20"
          style={{ backgroundColor: tagColor }}
        />

        {/* Clip Title + Inline Labels (Given full room to breathe) */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
          <span
            className="text-[11px] font-bold text-gray-100 truncate min-w-0"
            title={clipTitle}
          >
            {clipTitle}
          </span>

          {clipLabels.length > 0 && (
            <span
              className="text-[9.5px] text-[#c6ff1f]/80 truncate font-medium min-w-0 hidden xs:inline"
              title={clipLabels.join(', ')}
            >
              · {clipLabels.join(', ')}
            </span>
          )}

          {/* Compact Mode Icon Indicators */}
          {isCompact && timing.isTrimmed && (
            <Scissors
              className="w-2.5 h-2.5 text-amber-400 shrink-0"
              aria-label="Trimmed clip"
            />
          )}

          {isCompact && ffInfo.totalCount > 0 && (
            <Snowflake
              className="w-2.5 h-2.5 text-cyan-400 shrink-0"
              aria-label="Freeze Frame hold included"
            />
          )}

          {isCompact && hasNote && (
            <MessageSquare
              className="w-2.5 h-2.5 text-amber-400/80 shrink-0"
              aria-label="Has note"
            />
          )}

          {trackedCount > 0 && (
            <Crosshair
              className="w-2.5 h-2.5 text-[#c6ff1f] shrink-0"
              aria-label="Has tracked overlays"
            />
          )}
        </div>

        {/* Right Duration Badge or Live Overlay Target Badge */}
        {isOverlay &&
        overlayTargetIndex !== null &&
        overlayTargetIndex !== undefined &&
        overlayTargetIndex !== index ? (
          <span className="px-1.5 py-0.5 rounded bg-[#c6ff1f] text-black font-mono tabular-nums text-[9.5px] font-bold shrink-0 shadow-md">
            #{index + 1} → #{overlayTargetIndex + 1}
          </span>
        ) : (
          <span
            className={`font-mono tabular-nums text-[10px] font-semibold shrink-0 px-1.5 py-0.2 rounded transition-colors ${
              isPlaying || isSelected
                ? 'text-[#c6ff1f] bg-[#c6ff1f]/10 border border-[#c6ff1f]/40'
                : 'text-gray-300 bg-black/40 border border-white/5'
            }`}
            title={`Duration: ${formatTime(timing.duration)}`}
          >
            {formatTime(timing.duration)}
          </span>
        )}
      </div>

      {/* Sub Row (Comfortable Mode): Clear Timing In → Out, Trim Status, Freeze Frame Icon (no numbers), and Note */}
      {!isCompact && (
        <div className="flex items-center justify-between pl-6 pr-1 mt-0.5 text-[9.5px] font-mono tabular-nums text-gray-400 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            {/* Timestamp In → Out Range */}
            <span className="text-gray-300 font-semibold tracking-tight shrink-0">
              {formatTime(timing.startTime)} <span className="text-gray-500 font-sans mx-0.5">→</span> {formatTime(timing.endTime)}
            </span>

            {/* Trim delta if trimmed */}
            {timing.isTrimmed && (
              <>
                <span aria-hidden="true" className="text-gray-600">
                  ·
                </span>
                <span
                  className="inline-flex items-center gap-0.5 text-amber-300 font-bold shrink-0 bg-amber-500/10 border border-amber-500/30 px-1 py-0.2 rounded"
                  title={`Trimmed (${deltaFormatted}) from master event`}
                >
                  <Scissors className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                  <span>{deltaFormatted}</span>
                </span>
              </>
            )}

            {/* Freeze Frame indicator: Clean Snowflake icon ONLY, NO numbers! */}
            {ffInfo.totalCount > 0 && (
              <>
                <span aria-hidden="true" className="text-gray-600">
                  ·
                </span>
                <span
                  className="inline-flex items-center gap-1 text-cyan-300 shrink-0 bg-cyan-950/40 border border-cyan-500/30 px-1 py-0.2 rounded"
                  title="Includes freeze frame hold"
                >
                  <Snowflake className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                  <span className="font-sans text-[8.5px] text-cyan-300 font-medium">Freeze</span>
                </span>
              </>
            )}

            {/* Match / Game Project Name ONLY if genuinely a multi-game batch project */}
            {isMultiProject && clipProjectName && (
              <>
                <span aria-hidden="true" className="text-gray-600">
                  ·
                </span>
                <span
                  className="inline-flex items-center gap-0.5 text-cyan-300 font-sans truncate max-w-[100px] text-[8.5px] bg-black/40 border border-cyan-500/20 px-1 py-0.2 rounded"
                  title={`From Match: ${clipProjectName}`}
                >
                  <Film className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                  <span className="truncate">{clipProjectName}</span>
                </span>
              </>
            )}
          </div>

          {/* Optional Note Row (Comfortable Mode) */}
          {hasNote && (
            <div
              onPointerDown={stopDragPropagation}
              onClick={(e) => {
                if (!isOverlay && onOpenNoteModal && effectiveEvent.id) {
                  e.stopPropagation();
                  onOpenNoteModal(
                    effectiveEvent.id,
                    typeof item === 'object' ? item.projectId : undefined
                  );
                }
              }}
              className={`flex items-center gap-1 text-[9px] text-gray-400 shrink-0 max-w-[120px] truncate ${
                !isOverlay && onOpenNoteModal
                  ? 'hover:text-amber-300 cursor-pointer transition-colors'
                  : ''
              }`}
              title={effectiveEvent.notes}
            >
              <MessageSquare className="w-2.5 h-2.5 shrink-0 text-amber-400/80" />
              <span className="italic truncate">{effectiveEvent.notes}</span>
            </div>
          )}
        </div>
      )}

      {/* Hover Action Toolbar: Positioned absolutely so it NEVER pushes or crushes title text! */}
      {!isOverlay && !isSortingAny && (
        <div
          onPointerDown={stopDragPropagation}
          onClick={stopDragPropagation}
          className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto flex items-center gap-0.5 bg-[#14161f]/95 backdrop-blur-md px-1 py-0.5 rounded-md border border-[#2d3142] shadow-xl transition-opacity duration-150 z-20"
        >
          {onPlayClip && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPlayClip(timing.startTime, index);
              }}
              className="p-1 text-gray-300 hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
              title="Play clip (Space)"
            >
              <Play className="w-3 h-3 fill-current" />
            </button>
          )}

          {onMoveToIndex && !dragDisabled && totalCount > 1 && (
            <>
              <button
                type="button"
                disabled={index === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveToIndex(index, e.shiftKey ? 0 : index - 1);
                }}
                className="p-1 text-gray-300 hover:text-[#c6ff1f] disabled:opacity-25 disabled:pointer-events-none rounded hover:bg-[#c6ff1f]/10 transition-colors cursor-pointer"
                title="Move Up (Alt+↑) • Shift+Click: Move to Top (#1)"
              >
                <ChevronUp className="w-3 h-3" />
              </button>
              <button
                type="button"
                disabled={index >= totalCount - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveToIndex(index, e.shiftKey ? totalCount - 1 : index + 1);
                }}
                className="p-1 text-gray-300 hover:text-[#c6ff1f] disabled:opacity-25 disabled:pointer-events-none rounded hover:bg-[#c6ff1f]/10 transition-colors cursor-pointer"
                title={`Move Down (Alt+↓) • Shift+Click: Move to Bottom (#${totalCount})`}
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </>
          )}

          {onOpenTracking && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenTracking(index);
              }}
              className={`p-1 rounded transition-colors cursor-pointer ${
                trackedCount > 0
                  ? 'text-[#c6ff1f] hover:bg-[#c6ff1f]/15'
                  : 'text-gray-300 hover:text-[#c6ff1f] hover:bg-[#c6ff1f]/10'
              }`}
              title="Open in Tracking Studio"
            >
              <Crosshair className="w-3 h-3" />
            </button>
          )}

          {onOpenInTrimmer && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenInTrimmer(index);
              }}
              className="p-1 text-gray-300 hover:text-[#c6ff1f] rounded hover:bg-[#c6ff1f]/10 transition-colors cursor-pointer"
              title="Open in Playlist Trimmer"
            >
              <Scissors className="w-3 h-3" />
            </button>
          )}

          {onOpenNoteModal && effectiveEvent.id && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenNoteModal(
                  effectiveEvent.id,
                  typeof item === 'object' ? item.projectId : undefined
                );
              }}
              className={`p-1 rounded transition-colors cursor-pointer ${
                hasNote
                  ? 'text-amber-300 hover:text-amber-200 hover:bg-amber-500/15'
                  : 'text-gray-300 hover:text-amber-300 hover:bg-amber-500/10'
              }`}
              title={hasNote ? 'Edit Event Note' : 'Add Event Note'}
            >
              <FileText className="w-3 h-3" />
            </button>
          )}

          {onDuplicate && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate(index);
              }}
              className="p-1 text-gray-300 hover:text-[#c6ff1f] rounded hover:bg-[#c6ff1f]/10 transition-colors cursor-pointer"
              title="Duplicate clip"
            >
              <Copy className="w-3 h-3" />
            </button>
          )}

          {onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(index);
              }}
              className="p-1 text-gray-400 hover:text-red-400 rounded hover:bg-red-500/10 transition-colors cursor-pointer"
              title="Remove clip from playlist"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export interface SortablePlaylistClipItemProps {
  sortableId: string;
  item: PlaylistItem;
  index: number;
  totalCount: number;
  metadata: ResolvedClipMetadata;
  density: PlaylistClipDensity;
  isSelected: boolean;
  isPlaying: boolean;
  isRecentlyMoved: boolean;
  isSortingAny: boolean;
  liveOverIndex: number | null;
  dragDisabled?: boolean;
  registerItemEl?: (index: number, el: HTMLDivElement | null) => void;
  onSelect: (e: React.MouseEvent, eventId: string, startTime: number) => void;
  onOpenInTrimmer?: (index: number) => void;
  onOpenTracking?: (index: number) => void;
  onOpenNoteModal?: (eventId: string, projectId?: string) => void;
  onPlayClip: (startTime: number, index: number) => void;
  onDuplicate: (index: number, options?: { cleanSlate?: boolean }) => void;
  onRemove: (index: number) => void;
  onMoveToIndex: (fromIndex: number, toIndex: number) => void;
}

const animateClipLayoutChanges: AnimateLayoutChanges = (args) => {
  if (!args.isSorting && !args.wasDragging && args.previousItems !== args.items) {
    return args.index !== args.newIndex;
  }
  return defaultAnimateLayoutChanges(args);
};

export const SortablePlaylistClipItem: React.FC<SortablePlaylistClipItemProps> = ({
  sortableId,
  item,
  index,
  totalCount,
  metadata,
  density,
  isSelected,
  isPlaying,
  isRecentlyMoved,
  isSortingAny,
  liveOverIndex,
  dragDisabled = false,
  registerItemEl,
  onSelect,
  onOpenInTrimmer,
  onOpenTracking,
  onPlayClip,
  onOpenNoteModal,
  onDuplicate,
  onRemove,
  onMoveToIndex,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: sortableId,
    disabled: dragDisabled,
    animateLayoutChanges: animateClipLayoutChanges,
    transition: {
      duration: 210,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    },
  });

  const combinedRef = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    registerItemEl?.(index, node);
  };

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  if (isDragging) {
    const landingPosition =
      liveOverIndex !== null && liveOverIndex >= 0 ? liveOverIndex + 1 : index + 1;
    return (
      <div
        ref={combinedRef}
        style={style}
        className={`relative rounded-lg border border-dashed border-[#c6ff1f]/55 bg-[#c6ff1f]/[0.05] flex items-center justify-center select-none ${
          density === 'compact' ? 'min-h-[30px] py-1' : 'min-h-[46px] py-2'
        }`}
      >
        <span className="font-mono tabular-nums text-[10px] font-semibold text-[#c6ff1f]/85">
          Drop at #{landingPosition}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={combinedRef}
      style={style}
      {...(dragDisabled ? {} : attributes)}
      {...(dragDisabled ? {} : listeners)}
      className="touch-manipulation outline-none focus-visible:ring-1 focus-visible:ring-[#c6ff1f] rounded-lg"
    >
      <PlaylistClipCard
        item={item}
        index={index}
        totalCount={totalCount}
        metadata={metadata}
        density={density}
        isSelected={isSelected}
        isPlaying={isPlaying}
        isRecentlyMoved={isRecentlyMoved}
        isSortingAny={isSortingAny}
        dragDisabled={dragDisabled}
        onSelect={onSelect}
        onOpenInTrimmer={onOpenInTrimmer}
        onOpenTracking={onOpenTracking}
        onOpenNoteModal={onOpenNoteModal}
        onPlayClip={onPlayClip}
        onDuplicate={onDuplicate}
        onRemove={onRemove}
        onMoveToIndex={onMoveToIndex}
      />
    </div>
  );
};

// Backward-compatible wrapper export
export interface PlaylistClipItemProps {
  item: PlaylistItem;
  index: number;
  tagEvents: TagEvent[];
  tags: TagData[];
  labels?: Label[];
  allBatchProjects?: Project[];
  freezeFrames?: FreezeFrame[];
  isSelected: boolean;
  isPlaying: boolean;
  isDragging: boolean;
  onSelect: (e: React.MouseEvent, eventId: string, startTime: number) => void;
  onOpenInTrimmer?: (index: number) => void;
  onOpenTracking?: (index: number) => void;
  onOpenNoteModal?: (eventId: string, projectId?: string) => void;
  onPlayClip: (startTime: number, index: number) => void;
  onDuplicate: (index: number, options?: { cleanSlate?: boolean }) => void;
  onRemove: (index: number) => void;
  onResetTrim?: (index: number) => void;
  onDragStart?: (e: React.DragEvent, index: number) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, index: number) => void;
  onDragEnd?: (e: React.DragEvent, index: number) => void;
}

export const PlaylistClipItem: React.FC<PlaylistClipItemProps> = ({
  item,
  index,
  tagEvents,
  tags,
  labels = [],
  allBatchProjects,
  freezeFrames = [],
  isSelected,
  isPlaying,
  onSelect,
  onOpenInTrimmer,
  onOpenTracking,
  onOpenNoteModal,
  onPlayClip,
  onDuplicate,
  onRemove,
}) => {
  const metadata = resolveClipMetadata(
    item,
    index,
    tagEvents,
    tags,
    labels,
    allBatchProjects,
    freezeFrames
  );

  return (
    <PlaylistClipCard
      item={item}
      index={index}
      totalCount={index + 1}
      metadata={metadata}
      isSelected={isSelected}
      isPlaying={isPlaying}
      onSelect={onSelect}
      onOpenInTrimmer={onOpenInTrimmer}
      onOpenTracking={onOpenTracking}
      onOpenNoteModal={onOpenNoteModal}
      onPlayClip={onPlayClip}
      onDuplicate={onDuplicate}
      onRemove={onRemove}
    />
  );
};
