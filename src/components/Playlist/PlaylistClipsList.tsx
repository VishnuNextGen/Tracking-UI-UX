import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDndContext,
  MeasuringStrategy,
  defaultDropAnimationSideEffects,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type DropAnimation,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  ListPlus,
  Search,
  X,
  Rows3,
  AlignJustify,
  ChevronsUp,
  ChevronsDown,
  ChevronUp,
  ChevronDown,
  Crosshair,
} from 'lucide-react';
import type {
  Playlist,
  TagEvent,
  Tag as TagData,
  Label,
  Project,
  FreezeFrame,
} from '../../types';
import { formatTime } from '../../utils/math';
import { getClipInstanceId } from '../../utils/playlistUtils';
import {
  SortablePlaylistClipItem,
  PlaylistClipCard,
  PlaylistClipDensity,
  resolveClipMetadata,
} from './PlaylistClipItem';

const dropAnimationConfig: DropAnimation = {
  duration: 190,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.45',
      },
    },
  }),
};

/**
 * Keeps @dnd-kit droppable rects synced in real time whenever the scroll container scrolls
 * (via edge-zone auto-scroll or mouse wheel / trackpad while holding a clip).
 */
const ScrollDroppableMeasurer: React.FC<{
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  isDragging: boolean;
}> = ({ scrollContainerRef, isDragging }) => {
  const { measureDroppableContainers, droppableContainers } = useDndContext();

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !isDragging) return;

    let rafPending = false;
    const handleScroll = () => {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        const ids = droppableContainers.getEnabled().map((c) => c.id);
        if (ids.length > 0) {
          measureDroppableContainers(ids);
        }
      });
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [scrollContainerRef, isDragging, measureDroppableContainers, droppableContainers]);

  return null;
};

export interface PlaylistClipsListProps {
  playlist: Playlist | undefined;
  allBatchTagEvents: TagEvent[];
  allBatchTags: TagData[];
  allBatchLabels: Label[];
  allBatchProjects?: Project[];
  freezeFrames?: FreezeFrame[];
  playlistPlaybarIndex: number;
  showPlaylistPlaybar: boolean;
  autoplay: { active: boolean; playlistId: string | null; eventIndex: number };
  setDraggingEventIndex?: (idx: number | null) => void;
  onSelectClip: (index: number, startTime: number) => void;
  onOpenInTrimmer: (index: number) => void;
  onOpenTracking?: (index: number) => void;
  onOpenNoteModal?: (eventId: string, projectId?: string) => void;
  onPlayClip: (startTime: number, index: number) => void;
  onDuplicateClip: (index: number, options?: { cleanSlate?: boolean }) => void;
  onRemoveClip: (index: number) => void;
  onReorderClips: (fromIndex: number, toIndex: number) => void;
}

export const PlaylistClipsList: React.FC<PlaylistClipsListProps> = ({
  playlist,
  allBatchTagEvents,
  allBatchTags,
  allBatchLabels,
  allBatchProjects,
  freezeFrames = [],
  playlistPlaybarIndex,
  showPlaylistPlaybar,
  autoplay,
  setDraggingEventIndex,
  onSelectClip,
  onOpenInTrimmer,
  onOpenTracking,
  onOpenNoteModal,
  onPlayClip,
  onDuplicateClip,
  onRemoveClip,
  onReorderClips,
}) => {
  const [density, setDensity] = useState<PlaylistClipDensity>(() => {
    try {
      const saved = localStorage.getItem('tacstem_playlist_density');
      if (saved === 'compact' || saved === 'comfortable') return saved;
    } catch {}
    return 'comfortable';
  });

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overDragId, setOverDragId] = useState<string | null>(null);
  const [recentlyMovedId, setRecentlyMovedId] = useState<string | null>(null);
  const [edgeScrollDir, setEdgeScrollDir] = useState<'up' | 'down' | null>(null);
  const [scrollState, setScrollState] = useState({
    isScrollable: false,
    canScrollUp: false,
    canScrollDown: false,
  });

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const itemElementsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const movedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerClientYRef = useRef<number | null>(null);

  const toggleDensity = () => {
    setDensity((prev) => {
      const next: PlaylistClipDensity = prev === 'comfortable' ? 'compact' : 'comfortable';
      try {
        localStorage.setItem('tacstem_playlist_density', next);
      } catch {}
      return next;
    });
  };

  const events = playlist?.events || [];

  // Resolve metadata + guaranteed unique sortable IDs for every clip
  const enrichedClips = useMemo(() => {
    const usedIds = new Set<string>();
    return events.map((item, idx) => {
      let baseId = getClipInstanceId(item, idx);
      if (usedIds.has(baseId)) {
        baseId = `${baseId}__${idx}`;
      }
      usedIds.add(baseId);

      const metadata = resolveClipMetadata(
        item,
        idx,
        allBatchTagEvents,
        allBatchTags,
        allBatchLabels,
        allBatchProjects,
        freezeFrames
      );

      return {
        sortableId: baseId,
        item,
        originalIndex: idx,
        metadata,
      };
    });
  }, [events, allBatchTagEvents, allBatchTags, allBatchLabels, allBatchProjects, freezeFrames]);

  const totalReelDuration = useMemo(() => {
    return enrichedClips.reduce((sum, c) => sum + c.metadata.timing.duration, 0);
  }, [enrichedClips]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const isFiltering = normalizedQuery.length > 0;

  const visibleClips = useMemo(() => {
    if (!isFiltering) return enrichedClips;
    return enrichedClips.filter((c) => {
      const idxText = `#${c.originalIndex + 1}`;
      const title = c.metadata.clipTitle.toLowerCase();
      const labels = c.metadata.clipLabels.join(' ').toLowerCase();
      const proj = (c.metadata.clipProjectName || '').toLowerCase();
      const note = (c.metadata.effectiveEvent.notes || '').toLowerCase();
      return (
        idxText.includes(normalizedQuery) ||
        title.includes(normalizedQuery) ||
        labels.includes(normalizedQuery) ||
        proj.includes(normalizedQuery) ||
        note.includes(normalizedQuery)
      );
    });
  }, [enrichedClips, isFiltering, normalizedQuery]);

  const sortableIds = useMemo(() => visibleClips.map((c) => c.sortableId), [visibleClips]);

  const updateScrollMetrics = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isScrollable = el.scrollHeight > el.clientHeight + 4;
    const canScrollUp = el.scrollTop > 4;
    const canScrollDown = el.scrollTop + el.clientHeight < el.scrollHeight - 4;
    setScrollState((prev) => {
      if (
        prev.isScrollable === isScrollable &&
        prev.canScrollUp === canScrollUp &&
        prev.canScrollDown === canScrollDown
      ) {
        return prev;
      }
      return { isScrollable, canScrollUp, canScrollDown };
    });
  }, []);

  useEffect(() => {
    updateScrollMetrics();
  }, [visibleClips.length, density, playlist?.id, updateScrollMetrics]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => updateScrollMetrics());
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateScrollMetrics]);

  // Reset search when switching playlists
  useEffect(() => {
    setSearchQuery('');
    setIsSearchOpen(false);
  }, [playlist?.id]);

  // Smoothly scroll to active clip during autoplay progression
  useEffect(() => {
    if (
      autoplay.active &&
      playlist &&
      autoplay.playlistId === playlist.id &&
      autoplay.eventIndex >= 0 &&
      !activeDragId
    ) {
      const node = itemElementsRef.current.get(autoplay.eventIndex);
      if (node) {
        node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [autoplay.active, autoplay.playlistId, autoplay.eventIndex, playlist, activeDragId]);

  const flashMovedClip = useCallback((id: string) => {
    setRecentlyMovedId(id);
    if (movedTimerRef.current) clearTimeout(movedTimerRef.current);
    movedTimerRef.current = setTimeout(() => {
      setRecentlyMovedId(null);
    }, 650);
  }, []);

  useEffect(() => {
    return () => {
      if (movedTimerRef.current) clearTimeout(movedTimerRef.current);
    };
  }, []);

  const scrollToClipIndex = useCallback((targetIndex: number) => {
    requestAnimationFrame(() => {
      const node = itemElementsRef.current.get(targetIndex);
      if (node) {
        node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }, []);

  const handleManualMove = useCallback(
    (fromIndex: number, toIndex: number) => {
      const clampedTo = Math.max(0, Math.min(events.length - 1, toIndex));
      if (fromIndex === clampedTo) return;
      const movedClip = enrichedClips[fromIndex];
      onReorderClips(fromIndex, clampedTo);
      if (movedClip) {
        flashMovedClip(movedClip.sortableId);
      }
      scrollToClipIndex(clampedTo);
    },
    [events.length, enrichedClips, onReorderClips, flashMovedClip, scrollToClipIndex]
  );

  // Keyboard shortcut: Alt + ArrowUp / Alt + ArrowDown to move selected clip smoothly
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!playlist || events.length <= 1 || isFiltering) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        const currentIdx = playlistPlaybarIndex;
        if (currentIdx < 0 || currentIdx >= events.length) return;
        const nextIdx = e.key === 'ArrowUp' ? currentIdx - 1 : currentIdx + 1;
        if (nextIdx >= 0 && nextIdx < events.length) {
          e.preventDefault();
          handleManualMove(currentIdx, nextIdx);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [playlist, events.length, isFiltering, playlistPlaybarIndex, handleManualMove]);

  // Continuous proximity edge-zone auto-scroller while dragging (works even when holding cursor completely still)
  useEffect(() => {
    if (!activeDragId) {
      pointerClientYRef.current = null;
      setEdgeScrollDir(null);
      return;
    }

    const onPointerMove = (e: PointerEvent) => {
      pointerClientYRef.current = e.clientY;
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });

    let rafId = 0;
    const EDGE_ZONE_PX = 64;

    const tick = () => {
      const container = scrollContainerRef.current;
      const clientY = pointerClientYRef.current;
      if (container && clientY !== null) {
        const rect = container.getBoundingClientRect();
        const distTop = clientY - rect.top;
        const distBottom = rect.bottom - clientY;

        if (distTop < EDGE_ZONE_PX && distTop > -140 && container.scrollTop > 0) {
          const intensity = Math.min(1, Math.max(0.1, (EDGE_ZONE_PX - distTop) / EDGE_ZONE_PX));
          const delta = 2.5 + 13 * Math.pow(intensity, 1.65);
          container.scrollTop -= delta;
          setEdgeScrollDir('up');
        } else if (
          distBottom < EDGE_ZONE_PX &&
          distBottom > -140 &&
          container.scrollTop + container.clientHeight < container.scrollHeight - 1
        ) {
          const intensity = Math.min(1, Math.max(0.1, (EDGE_ZONE_PX - distBottom) / EDGE_ZONE_PX));
          const delta = 2.5 + 13 * Math.pow(intensity, 1.65);
          container.scrollTop += delta;
          setEdgeScrollDir('down');
        } else {
          setEdgeScrollDir(null);
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      cancelAnimationFrame(rafId);
      setEdgeScrollDir(null);
    };
  }, [activeDragId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 140,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeDraggedClip = useMemo(() => {
    if (!activeDragId) return null;
    return enrichedClips.find((c) => c.sortableId === activeDragId) || null;
  }, [activeDragId, enrichedClips]);

  const liveOverIndex = useMemo(() => {
    if (!overDragId) return null;
    const idx = enrichedClips.findIndex((c) => c.sortableId === overDragId);
    return idx >= 0 ? idx : null;
  }, [overDragId, enrichedClips]);

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    const nativeEvt = event.activatorEvent as MouseEvent | TouchEvent | undefined;
    if (nativeEvt && 'clientY' in nativeEvt && typeof nativeEvt.clientY === 'number') {
      pointerClientYRef.current = nativeEvt.clientY;
    } else if (
      nativeEvt &&
      'touches' in nativeEvt &&
      nativeEvt.touches &&
      nativeEvt.touches.length > 0
    ) {
      pointerClientYRef.current = nativeEvt.touches[0].clientY;
    }

    setActiveDragId(id);
    setOverDragId(id);
    const idx = enrichedClips.findIndex((c) => c.sortableId === id);
    if (idx >= 0) {
      setDraggingEventIndex?.(idx);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (event.over) {
      setOverDragId(String(event.over.id));
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    setOverDragId(null);
    setDraggingEventIndex?.(null);

    if (over && active.id !== over.id) {
      const fromIdx = enrichedClips.findIndex((c) => c.sortableId === String(active.id));
      const toIdx = enrichedClips.findIndex((c) => c.sortableId === String(over.id));
      if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
        onReorderClips(fromIdx, toIdx);
        flashMovedClip(String(active.id));
      }
    }
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
    setOverDragId(null);
    setDraggingEventIndex?.(null);
  };

  const registerItemEl = useCallback((index: number, el: HTMLDivElement | null) => {
    if (el) {
      itemElementsRef.current.set(index, el);
    } else {
      itemElementsRef.current.delete(index);
    }
  }, []);

  if (!playlist || events.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-500 bg-[#0a0a0c] min-h-[160px]">
        <ListPlus className="w-8 h-8 mb-2 text-gray-600 opacity-60" />
        <p className="text-xs font-semibold text-gray-300">Playlist is empty</p>
        <p className="text-[10.5px] text-gray-400 mt-1 max-w-[210px] leading-relaxed">
          Select timeline events and press{' '}
          <span className="text-[#c6ff1f] font-mono font-bold">Ctrl+S</span> or click Add Selected
          below.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#0a0a0c] relative">
      {/* Sub-Header Controls: Total Duration, Density Switcher, Search & Quick Scroll */}
      <div className="px-2 py-1 bg-[#0e0f13] border-b border-[#1d1f26] flex items-center justify-between gap-1.5 shrink-0 select-none">
        <div className="flex items-center gap-1.5 min-w-0 text-[10px] font-mono tabular-nums text-gray-400">
          <span className="text-gray-200 font-semibold">{events.length}</span>
          <span>{events.length === 1 ? 'clip' : 'clips'}</span>
          <span aria-hidden="true" className="text-gray-600">
            ·
          </span>
          <span className="text-[#c6ff1f] font-semibold">{formatTime(totalReelDuration)}</span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {/* Quick Jump to Active Clip when scrollable */}
          {scrollState.isScrollable &&
            playlistPlaybarIndex >= 0 &&
            playlistPlaybarIndex < events.length && (
              <button
                type="button"
                onClick={() => scrollToClipIndex(playlistPlaybarIndex)}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9.5px] font-mono tabular-nums font-semibold text-gray-300 hover:text-[#c6ff1f] hover:bg-white/5 transition-colors cursor-pointer"
                title={`Scroll to selected clip (#${playlistPlaybarIndex + 1})`}
              >
                <Crosshair className="w-2.5 h-2.5 text-[#c6ff1f]" />
                <span>#{playlistPlaybarIndex + 1}</span>
              </button>
            )}

          {/* Top / Bottom fast scroll buttons for long playlists */}
          {scrollState.isScrollable && (
            <>
              <button
                type="button"
                disabled={!scrollState.canScrollUp}
                onClick={() =>
                  scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
                }
                className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Scroll to top of playlist"
              >
                <ChevronsUp className="w-3 h-3" />
              </button>
              <button
                type="button"
                disabled={!scrollState.canScrollDown}
                onClick={() =>
                  scrollContainerRef.current?.scrollTo({
                    top: scrollContainerRef.current.scrollHeight,
                    behavior: 'smooth',
                  })
                }
                className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Scroll to bottom of playlist"
              >
                <ChevronsDown className="w-3 h-3" />
              </button>
            </>
          )}

          {/* Density Toggle (Comfortable vs Compact for long lists) */}
          <button
            type="button"
            onClick={toggleDensity}
            className={`p-1 rounded transition-colors cursor-pointer ${
              density === 'compact'
                ? 'text-[#c6ff1f] bg-[#c6ff1f]/10'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            title={
              density === 'compact'
                ? 'Compact view active (great for long lists) • Click for detailed view'
                : 'Switch to compact single-line view for fast long-list dragging'
            }
          >
            {density === 'compact' ? (
              <AlignJustify className="w-3 h-3" />
            ) : (
              <Rows3 className="w-3 h-3" />
            )}
          </button>

          {/* Search / Filter Toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !isSearchOpen;
              setIsSearchOpen(next);
              if (!next) {
                setSearchQuery('');
              } else {
                requestAnimationFrame(() => searchInputRef.current?.focus());
              }
            }}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isSearchOpen || isFiltering
                ? 'text-[#c6ff1f] bg-[#c6ff1f]/10'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            title="Filter clips by tag, label, match, note, or #number"
          >
            <Search className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Collapsible Search Filter Bar */}
      {isSearchOpen && (
        <div className="px-2 py-1.5 bg-[#101218] border-b border-[#1d1f26] flex items-center gap-1.5 shrink-0">
          <Search className="w-3 h-3 text-gray-500 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearchQuery('');
                setIsSearchOpen(false);
              }
            }}
            placeholder="Filter by tag, label, note, #pos..."
            className="flex-1 bg-transparent text-[11px] text-white placeholder-gray-500 outline-none min-w-0"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                searchInputRef.current?.focus();
              }}
              className="p-0.5 text-gray-400 hover:text-white rounded hover:bg-white/10 cursor-pointer"
              title="Clear filter"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Active Filter Status Hint */}
      {isFiltering && (
        <div className="px-2 py-1 bg-[#141720] border-b border-[#1f2433] flex items-center justify-between text-[9.5px] text-gray-400 shrink-0">
          <span>
            Showing <span className="font-mono tabular-nums text-white">{visibleClips.length}</span>{' '}
            of <span className="font-mono tabular-nums">{events.length}</span> clips
          </span>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-[#c6ff1f] hover:underline font-medium cursor-pointer"
          >
            Reset to reorder
          </button>
        </div>
      )}

      {/* Scrollable Clips Viewport + Visual Edge Auto-Scroll Zones */}
      <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Top Auto-Scroll Indicator Zone (During Drag) */}
        {activeDragId && scrollState.canScrollUp && (
          <div
            className={`pointer-events-none absolute top-0 left-0 right-0 h-9 z-30 flex items-start justify-center pt-1 bg-gradient-to-b from-[#090a0d] via-[#090a0d]/85 to-transparent transition-opacity duration-150 ${
              edgeScrollDir === 'up' ? 'opacity-100' : 'opacity-75'
            }`}
          >
            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[9.5px] font-medium border transition-colors ${
                edgeScrollDir === 'up'
                  ? 'bg-[#c6ff1f]/20 text-[#c6ff1f] border-[#c6ff1f]/50'
                  : 'bg-[#15171e]/95 text-gray-300 border-white/10'
              }`}
            >
              <ChevronUp className="w-3 h-3" />
              <span>{edgeScrollDir === 'up' ? 'Scrolling up…' : 'Hold near top to scroll up'}</span>
            </div>
          </div>
        )}

        {/* Bottom Auto-Scroll Indicator Zone (During Drag) */}
        {activeDragId && scrollState.canScrollDown && (
          <div
            className={`pointer-events-none absolute bottom-0 left-0 right-0 h-9 z-30 flex items-end justify-center pb-1 bg-gradient-to-t from-[#090a0d] via-[#090a0d]/85 to-transparent transition-opacity duration-150 ${
              edgeScrollDir === 'down' ? 'opacity-100' : 'opacity-75'
            }`}
          >
            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[9.5px] font-medium border transition-colors ${
                edgeScrollDir === 'down'
                  ? 'bg-[#c6ff1f]/20 text-[#c6ff1f] border-[#c6ff1f]/50'
                  : 'bg-[#15171e]/95 text-gray-300 border-white/10'
              }`}
            >
              <ChevronDown className="w-3 h-3" />
              <span>
                {edgeScrollDir === 'down' ? 'Scrolling down…' : 'Hold near bottom to scroll down'}
              </span>
            </div>
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          measuring={{
            droppable: {
              strategy: MeasuringStrategy.Always,
            },
          }}
          autoScroll={false}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <ScrollDroppableMeasurer
            scrollContainerRef={scrollContainerRef}
            isDragging={activeDragId !== null}
          />

          <div
            ref={scrollContainerRef}
            onScroll={updateScrollMetrics}
            className={`flex-1 overflow-y-auto overscroll-contain p-1.5 custom-scrollbar ${
              density === 'compact' ? 'space-y-1' : 'space-y-1.5'
            }`}
          >
            {visibleClips.length === 0 ? (
              <div className="py-8 px-4 text-center text-xs text-gray-500">
                No clips match "{searchQuery}".
              </div>
            ) : (
              <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                {visibleClips.map((entry) => {
                  const i = entry.originalIndex;
                  const isPlayingEvent =
                    (autoplay.active &&
                      autoplay.playlistId === playlist.id &&
                      autoplay.eventIndex === i) ||
                    (showPlaylistPlaybar && playlistPlaybarIndex === i);

                  return (
                    <SortablePlaylistClipItem
                      key={entry.sortableId}
                      sortableId={entry.sortableId}
                      item={entry.item}
                      index={i}
                      totalCount={events.length}
                      metadata={entry.metadata}
                      density={density}
                      isSelected={playlistPlaybarIndex === i}
                      isPlaying={isPlayingEvent}
                      isRecentlyMoved={recentlyMovedId === entry.sortableId}
                      isSortingAny={activeDragId !== null}
                      liveOverIndex={liveOverIndex}
                      dragDisabled={isFiltering}
                      registerItemEl={registerItemEl}
                      onSelect={(_e, _id, startTime) => {
                        onSelectClip(i, startTime);
                      }}
                      onOpenInTrimmer={onOpenInTrimmer}
                      onOpenTracking={onOpenTracking}
                      onOpenNoteModal={onOpenNoteModal}
                      onPlayClip={onPlayClip}
                      onDuplicate={onDuplicateClip}
                      onRemove={onRemoveClip}
                      onMoveToIndex={handleManualMove}
                    />
                  );
                })}
              </SortableContext>
            )}
          </div>

          {typeof document !== 'undefined' &&
            createPortal(
              <DragOverlay dropAnimation={dropAnimationConfig} zIndex={9999}>
                {activeDraggedClip ? (
                  <div
                    style={{
                      width: scrollContainerRef.current
                        ? Math.max(180, scrollContainerRef.current.clientWidth - 14)
                        : undefined,
                    }}
                  >
                    <PlaylistClipCard
                      item={activeDraggedClip.item}
                      index={activeDraggedClip.originalIndex}
                      totalCount={events.length}
                      metadata={activeDraggedClip.metadata}
                      density={density}
                      isSelected={playlistPlaybarIndex === activeDraggedClip.originalIndex}
                      isPlaying={
                        (autoplay.active &&
                          autoplay.playlistId === playlist.id &&
                          autoplay.eventIndex === activeDraggedClip.originalIndex) ||
                        (showPlaylistPlaybar &&
                          playlistPlaybarIndex === activeDraggedClip.originalIndex)
                      }
                      isOverlay={true}
                      overlayTargetIndex={liveOverIndex}
                    />
                  </div>
                ) : null}
              </DragOverlay>,
              document.body
            )}
        </DndContext>
      </div>
    </div>
  );
};
