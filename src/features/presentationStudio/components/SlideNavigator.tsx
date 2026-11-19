import React, { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Copy,
  Trash2,
  FolderPlus,
  GripVertical,
  ChevronDown,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Slide, SlideLayoutType, SlideSection } from '../types/presentation';
import { SLIDE_LAYOUTS } from '../constants/themesAndLayouts';
import { SlideRenderer } from '../renderer/SlideRenderer';

interface SlideNavigatorProps {
  slides: Slide[];
  sections: SlideSection[];
  activeSlideId: string;
  onSelectSlide: (slideId: string) => void;
  onAddSlide: (layout?: SlideLayoutType, afterSlideId?: string) => void;
  onDuplicateSlide: (slideId: string) => void;
  onDeleteSlide: (slideId: string) => void;
  onReorderSlides: (fromIndex: number, toIndex: number) => void;
  onAssignSection: (slideId: string, sectionId: string) => void;
  onAddSection: (title: string) => void;
}

const SortableSlideThumbnail: React.FC<{
  slide: Slide;
  index: number;
  isActive: boolean;
  canDelete: boolean;
  sectionName?: string;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}> = ({
  slide,
  index,
  isActive,
  canDelete,
  sectionName,
  onSelect,
  onDuplicate,
  onDelete,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slide.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`group rounded-xl p-2 border transition-all cursor-pointer ${
        isActive
          ? 'bg-[#c6ff1f]/10 border-[#c6ff1f]/60 shadow-lg shadow-[#c6ff1f]/5'
          : 'bg-white/[0.02] border-white/[0.07] hover:border-white/20 hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-center justify-between gap-1.5 mb-1.5">
        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="p-0.5 text-white/30 hover:text-white/75 cursor-grab active:cursor-grabbing shrink-0"
            title="Drag to reorder"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <span
            className={`text-[11px] font-mono font-bold tabular-nums ${
              isActive ? 'text-[#c6ff1f]' : 'text-white/50'
            }`}
          >
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="text-[11px] font-medium text-white/80 truncate">
            {slide.title}
          </span>
        </div>

        <div
          className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onDuplicate}
            className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white cursor-pointer"
            title="Duplicate slide"
          >
            <Copy className="w-3 h-3" />
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-1 rounded hover:bg-red-500/20 text-white/50 hover:text-red-400 cursor-pointer"
              title="Delete slide"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <ResponsiveNavigatorThumb slide={slide} />

      {sectionName && (
        <div className="mt-1.5 text-[10px] text-white/40 truncate px-1">{sectionName}</div>
      )}
    </div>
  );
};

const ResponsiveNavigatorThumb: React.FC<{ slide: Slide }> = ({ slide }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.11);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      if (el.clientWidth > 0) setScale(el.clientWidth / 1920);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="w-full aspect-video rounded-lg overflow-hidden border border-white/10 bg-[#090b10] pointer-events-none flex items-center justify-center"
    >
      <SlideRenderer slide={slide} scale={scale} />
    </div>
  );
};

export const SlideNavigator: React.FC<SlideNavigatorProps> = ({
  slides,
  sections,
  activeSlideId,
  onSelectSlide,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onReorderSlides,
  onAssignSection,
  onAddSection,
}) => {
  const [showAddLayouts, setShowAddLayouts] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [showSectionInput, setShowSectionInput] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = slides.findIndex((s) => s.id === active.id);
    const newIndex = slides.findIndex((s) => s.id === over.id);
    if (oldIndex >= 0 && newIndex >= 0) {
      onReorderSlides(oldIndex, newIndex);
    }
  };

  const sectionMap = new Map(sections.map((s) => [s.id, s.title]));
  const activeSlide = slides.find((s) => s.id === activeSlideId);

  return (
    <aside className="w-60 xl:w-64 shrink-0 bg-[#0f1117] border-r border-white/[0.08] flex flex-col h-full select-none">
      {/* Header */}
      <div className="p-3 border-b border-white/[0.08] flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-white/75">
          Slides ({slides.length})
        </span>
        <div className="flex items-center gap-1 relative">
          <button
            type="button"
            onClick={() => setShowSectionInput((v) => !v)}
            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] text-white/65 hover:text-white border border-white/10 cursor-pointer"
            title="Add slide section"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onAddSlide('two-column', activeSlideId)}
            className="px-2.5 py-1.5 rounded-lg bg-[#c6ff1f] hover:bg-[#d4ff4d] text-black font-bold text-xs flex items-center gap-1 cursor-pointer"
            title="Add new slide"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddLayouts((v) => !v)}
            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] text-white/70 hover:text-white border border-white/10 cursor-pointer"
            title="Add slide with specific layout"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {showAddLayouts && (
            <div className="absolute right-0 top-full mt-1.5 w-56 bg-[#171923] border border-white/15 rounded-xl shadow-2xl py-1.5 z-40 max-h-80 overflow-y-auto">
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Insert Layout
              </div>
              {SLIDE_LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    onAddSlide(l.id, activeSlideId);
                    setShowAddLayouts(false);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-white/[0.06] text-xs text-white/85 flex flex-col cursor-pointer"
                >
                  <span className="font-medium">{l.label}</span>
                  <span className="text-[10px] text-white/45">{l.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Section inline */}
      {showSectionInput && (
        <div className="p-2.5 border-b border-white/[0.08] bg-white/[0.02] flex items-center gap-1.5">
          <input
            type="text"
            value={newSectionTitle}
            onChange={(e) => setNewSectionTitle(e.target.value)}
            placeholder="Section name..."
            autoFocus
            className="flex-1 min-w-0 bg-[#090b10] border border-white/15 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#c6ff1f]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newSectionTitle.trim()) {
                onAddSection(newSectionTitle);
                setNewSectionTitle('');
                setShowSectionInput(false);
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (newSectionTitle.trim()) {
                onAddSection(newSectionTitle);
                setNewSectionTitle('');
                setShowSectionInput(false);
              }
            }}
            className="px-2.5 py-1 rounded-lg bg-[#c6ff1f] text-black text-xs font-bold cursor-pointer"
          >
            Add
          </button>
        </div>
      )}

      {/* Active Slide Section Assignment */}
      {activeSlide && sections.length > 0 && (
        <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between gap-2 text-[11px] text-white/50">
          <span className="shrink-0">Section:</span>
          <select
            value={activeSlide.sectionId || ''}
            onChange={(e) => onAssignSection(activeSlide.id, e.target.value)}
            className="bg-[#161923] border border-white/10 rounded-md px-2 py-1 text-[11px] text-white/85 flex-1 min-w-0 focus:outline-none"
          >
            <option value="">Unassigned</option>
            {sections.map((sec) => (
              <option key={sec.id} value={sec.id}>
                {sec.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Sortable Thumbnails */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2 scrollbar-panel">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={slides.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {slides.map((slide, idx) => (
              <SortableSlideThumbnail
                key={slide.id}
                slide={slide}
                index={idx}
                isActive={slide.id === activeSlideId}
                canDelete={slides.length > 1}
                sectionName={slide.sectionId ? sectionMap.get(slide.sectionId) : undefined}
                onSelect={() => onSelectSlide(slide.id)}
                onDuplicate={() => onDuplicateSlide(slide.id)}
                onDelete={() => onDeleteSlide(slide.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </aside>
  );
};
