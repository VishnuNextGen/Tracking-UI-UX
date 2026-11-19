import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Search,
  Clapperboard,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Play,
  Repeat,
  FolderOpen,
  Check,
  Lock,
} from 'lucide-react';
import type { BoardProject } from '../../../types';
import type { Project as TacticalProject } from '../../../board/types';
import {
  buildBoardPlaybackTimeline,
  detectBoardSlideHasAnimations,
  formatBoardDurationMs,
  getPreferredPreviewSlideIndex,
  loadAvailableBoardProjects,
  normalizeBoardProjectData,
  resolvePitchTemplate,
} from '../storage/boardProjectResolver';
import { TacticalBoardSnapshotCanvas } from '../renderer/elements/TacticalBoardElementRenderer';

export interface TacticalBoardImportSelection {
  targetElementId?: string | null;
  title: string;
  boardProjectId: string;
  boardProjectName: string;
  pitchTemplate: string;
  boardData: TacticalProject;
  importMode: 'single-slide' | 'all-slides';
  slideIndex?: number;
  slideName?: string;
  hasAnimations: boolean;
  loop: boolean;
  autoPlay: boolean;
}

interface ImportTacticalBoardModalProps {
  isOpen: boolean;
  targetElementId?: string | null;
  initialTitle?: string;
  initialBoardProjectId?: string;
  initialImportMode?: 'single-slide' | 'all-slides';
  initialSlideIndex?: number;
  onClose: () => void;
  onConfirmImport: (selection: TacticalBoardImportSelection) => void;
}

interface SelectedChoice {
  projectId: string;
  importMode: 'single-slide' | 'all-slides';
  slideIndex: number;
}

export const ImportTacticalBoardModal: React.FC<ImportTacticalBoardModalProps> = ({
  isOpen,
  targetElementId,
  initialTitle,
  initialBoardProjectId,
  initialImportMode,
  initialSlideIndex,
  onClose,
  onConfirmImport,
}) => {
  const [loading, setLoading] = useState(true);
  const [boardProjects, setBoardProjects] = useState<BoardProject[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [selectedChoice, setSelectedChoice] = useState<SelectedChoice | null>(null);
  const [elementTitle, setElementTitle] = useState(initialTitle || '');
  const [hasCustomTitle, setHasCustomTitle] = useState(Boolean(initialTitle));
  const [loopPlayback, setLoopPlayback] = useState(true);
  const [autoPlayOnSlide, setAutoPlayOnSlide] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setSearchTerm('');
    setElementTitle(initialTitle || '');
    setHasCustomTitle(Boolean(initialTitle));

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await loadAvailableBoardProjects();
        if (cancelled) return;
        setBoardProjects(list);

        if (initialBoardProjectId) {
          setExpandedProjects({ [initialBoardProjectId]: true });
          setSelectedChoice({
            projectId: initialBoardProjectId,
            importMode: initialImportMode || 'all-slides',
            slideIndex: initialSlideIndex ?? 0,
          });
        } else if (list.length > 0) {
          setExpandedProjects({ [list[0].id]: true });
          setSelectedChoice(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, initialTitle, initialBoardProjectId, initialImportMode, initialSlideIndex]);

  const parsedProjects = useMemo(() => {
    return boardProjects
      .map((bp) => {
        const normalized = normalizeBoardProjectData(bp.data, bp);
        if (!normalized || normalized.slides.length === 0) return null;
        const timelineAll = buildBoardPlaybackTimeline(normalized, 'all-slides');
        const template = resolvePitchTemplate(
          (normalized.pitchTemplate as string | undefined) || bp.pitchTemplate
        );
        return {
          meta: bp,
          project: normalized,
          template,
          timelineAll,
          previewSlideIndex: getPreferredPreviewSlideIndex(normalized),
          slideAnimations: normalized.slides.map((_, idx) =>
            detectBoardSlideHasAnimations(normalized.slides, idx)
          ),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [boardProjects]);

  const filteredProjects = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return parsedProjects;
    return parsedProjects.filter(
      (item) =>
        item.meta.name.toLowerCase().includes(q) ||
        (item.meta.description || '').toLowerCase().includes(q) ||
        item.project.slides.some((s) => (s.name || '').toLowerCase().includes(q))
    );
  }, [parsedProjects, searchTerm]);

  const activeSelectionDetails = useMemo(() => {
    if (!selectedChoice) return null;
    const found = parsedProjects.find((p) => p.meta.id === selectedChoice.projectId);
    if (!found) return null;
    const clampedIdx = Math.max(
      0,
      Math.min(found.project.slides.length - 1, selectedChoice.slideIndex)
    );
    const hasAnimations =
      selectedChoice.importMode === 'single-slide'
        ? found.slideAnimations[clampedIdx]
        : found.timelineAll.hasAnyAnimation;
    const slideName =
      found.project.slides[clampedIdx]?.name || `Slide ${clampedIdx + 1}`;
    return {
      ...found,
      clampedIdx,
      hasAnimations,
      slideName,
    };
  }, [selectedChoice, parsedProjects]);

  const selectAllSlides = (projectId: string, projectName: string, slideCount: number) => {
    setSelectedChoice({ projectId, importMode: 'all-slides', slideIndex: 0 });
    setLoopPlayback(true);
    setAutoPlayOnSlide(true);
    if (!hasCustomTitle) {
      setElementTitle(`${projectName} · All Slides (${slideCount})`);
    }
  };

  const selectSingleSlide = (
    projectId: string,
    projectName: string,
    slideIndex: number,
    slideName: string,
    hasAnim: boolean
  ) => {
    setSelectedChoice({ projectId, importMode: 'single-slide', slideIndex });
    setLoopPlayback(hasAnim);
    setAutoPlayOnSlide(hasAnim);
    if (!hasCustomTitle) {
      setElementTitle(`${projectName} · ${slideName}`);
    }
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSelectionDetails || !selectedChoice) return;

    const clonedBoardData: TacticalProject = JSON.parse(
      JSON.stringify(activeSelectionDetails.project)
    );

    const fallbackTitle =
      selectedChoice.importMode === 'all-slides'
        ? `${activeSelectionDetails.meta.name} · All Slides`
        : `${activeSelectionDetails.meta.name} · ${activeSelectionDetails.slideName}`;

    onConfirmImport({
      targetElementId,
      title: elementTitle.trim() || fallbackTitle,
      boardProjectId: activeSelectionDetails.meta.id,
      boardProjectName: activeSelectionDetails.meta.name,
      pitchTemplate: activeSelectionDetails.template,
      boardData: clonedBoardData,
      importMode: selectedChoice.importMode,
      slideIndex:
        selectedChoice.importMode === 'single-slide'
          ? activeSelectionDetails.clampedIdx
          : undefined,
      slideName:
        selectedChoice.importMode === 'single-slide'
          ? activeSelectionDetails.slideName
          : undefined,
      hasAnimations: activeSelectionDetails.hasAnimations,
      loop: loopPlayback,
      autoPlay: autoPlayOnSlide,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[140] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#12141b] border border-white/15 rounded-2xl shadow-2xl max-w-4xl w-full p-6 text-left flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#c6ff1f]/12 border border-[#c6ff1f]/30 flex items-center justify-center text-[#c6ff1f]">
              <Clapperboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {targetElementId
                  ? 'Replace Tactical Board Player'
                  : 'Import from Tactical Board'}
              </h2>
              <p className="text-xs text-white/55 mt-0.5">
                Import a single slide as a looping animation video, or import all slides as a read-only play-all video player.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Title & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
          <div>
            <label className="text-[11px] font-semibold text-white/60 block mb-1">
              Slide Player Title
            </label>
            <input
              type="text"
              value={elementTitle}
              onChange={(e) => {
                setElementTitle(e.target.value);
                setHasCustomTitle(e.target.value.trim().length > 0);
              }}
              placeholder="Auto-filled from selected board or slide"
              className="w-full bg-white/[0.04] border border-white/15 focus:border-[#c6ff1f] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-white/60 block mb-1">
              Search Tactical Board Projects
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter by board name or slide title..."
                className="w-full bg-white/[0.04] border border-white/15 focus:border-[#c6ff1f] rounded-xl pl-8 pr-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Projects & Slides Browser */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-panel min-h-[280px]">
          {loading ? (
            <div className="py-16 text-center text-xs text-white/50">
              Loading your Tactical Board projects...
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="py-14 px-6 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] text-center space-y-2">
              <FolderOpen className="w-8 h-8 text-white/30 mx-auto" />
              <div className="text-sm font-semibold text-white">
                {boardProjects.length === 0
                  ? 'No Tactical Board Projects Found Yet'
                  : 'No Tactical Boards Match Your Search'}
              </div>
              <p className="text-xs text-white/50 max-w-md mx-auto leading-relaxed">
                Create or open a board in the <strong className="text-white/80">Tactical Board</strong> tab, add formations or slide animations, and return here to import it into your presentation.
              </p>
            </div>
          ) : (
            filteredProjects.map((item) => {
              const isExpanded = Boolean(expandedProjects[item.meta.id]);
              const isAllSelected =
                selectedChoice?.projectId === item.meta.id &&
                selectedChoice.importMode === 'all-slides';
              const hasSlideSelected =
                selectedChoice?.projectId === item.meta.id &&
                selectedChoice.importMode === 'single-slide';
              const animatedCount = item.slideAnimations.filter(Boolean).length;

              return (
                <div
                  key={item.meta.id}
                  className={`rounded-xl border transition-colors ${
                    isAllSelected || hasSlideSelected
                      ? 'bg-[#c6ff1f]/[0.05] border-[#c6ff1f]/40'
                      : 'bg-white/[0.025] border-white/10'
                  }`}
                >
                  {/* Project Header Row */}
                  <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedProjects((prev) => ({
                            ...prev,
                            [item.meta.id]: !prev[item.meta.id],
                          }))
                        }
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 cursor-pointer shrink-0"
                        title="Show individual slides"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>

                      {/* Mini Preview Thumb */}
                      <div className="w-20 h-11 rounded-lg overflow-hidden border border-white/15 shrink-0 bg-[#080b12]">
                        <TacticalBoardSnapshotCanvas
                          boardData={item.project}
                          pitchTemplate={item.template}
                          slideIndex={item.previewSlideIndex}
                          renderScale={0.25}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white truncate">
                            {item.meta.name}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-white/[0.07] text-[10px] font-mono text-white/70 uppercase">
                            {item.project.pitchView || 'HORIZONTAL'}
                          </span>
                          {animatedCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#c6ff1f]/12 border border-[#c6ff1f]/25 text-[10px] font-semibold text-[#c6ff1f]">
                              <Sparkles className="w-2.5 h-2.5" />
                              {animatedCount} animated
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-white/45 mt-0.5">
                          {item.project.slides.length} slide
                          {item.project.slides.length > 1 ? 's' : ''} ·{' '}
                          {formatBoardDurationMs(item.timelineAll.totalDurationMs)} total playback
                        </div>
                      </div>
                    </div>

                    {/* All-Slides Player Select Button */}
                    <div className="flex items-center gap-2 shrink-0 pl-9 sm:pl-0">
                      <button
                        type="button"
                        onClick={() =>
                          selectAllSlides(
                            item.meta.id,
                            item.meta.name,
                            item.project.slides.length
                          )
                        }
                        className={`px-3.5 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-all ${
                          isAllSelected
                            ? 'bg-[#c6ff1f] border-[#c6ff1f] text-black shadow-lg'
                            : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/15 text-white'
                        }`}
                      >
                        {isAllSelected ? (
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        ) : (
                          <Layers className="w-3.5 h-3.5 text-[#c6ff1f]" />
                        )}
                        <span>Import All Slides ({item.project.slides.length})</span>
                      </button>
                    </div>
                  </div>

                  {/* Expanded Single-Slide Picker */}
                  {isExpanded && (
                    <div className="px-3.5 pb-3.5 pt-2 border-t border-white/[0.07]">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-2">
                        Or Pick One Slide (Plays as Looping Video When Animated)
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                        {item.project.slides.map((s, idx) => {
                          const hasAnim = item.slideAnimations[idx];
                          const isSlideSelected =
                            selectedChoice?.projectId === item.meta.id &&
                            selectedChoice.importMode === 'single-slide' &&
                            selectedChoice.slideIndex === idx;
                          const sName = s.name || `Slide ${idx + 1}`;

                          return (
                            <button
                              key={s.id + '-' + idx}
                              type="button"
                              onClick={() =>
                                selectSingleSlide(
                                  item.meta.id,
                                  item.meta.name,
                                  idx,
                                  sName,
                                  hasAnim
                                )
                              }
                              className={`group text-left rounded-xl border overflow-hidden transition-all cursor-pointer ${
                                isSlideSelected
                                  ? 'border-[#c6ff1f] ring-2 ring-[#c6ff1f]/40 bg-[#c6ff1f]/10'
                                  : 'border-white/10 hover:border-white/30 bg-black/30'
                              }`}
                            >
                              <div className="aspect-video w-full bg-[#080b12] relative overflow-hidden">
                                <TacticalBoardSnapshotCanvas
                                  boardData={item.project}
                                  pitchTemplate={item.template}
                                  slideIndex={idx}
                                  renderScale={0.28}
                                />
                                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-mono font-bold text-white">
                                  #{idx + 1}
                                </div>
                                {isSlideSelected && (
                                  <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#c6ff1f] text-black flex items-center justify-center">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                  </div>
                                )}
                              </div>
                              <div className="p-2 space-y-1">
                                <div className="text-[11px] font-semibold text-white truncate">
                                  {sName}
                                </div>
                                <div className="flex items-center justify-between gap-1 text-[10px]">
                                  {hasAnim ? (
                                    <span className="inline-flex items-center gap-1 text-[#c6ff1f] font-semibold">
                                      <Repeat className="w-2.5 h-2.5" />
                                      Loops Video
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-white/45">
                                      <Lock className="w-2.5 h-2.5" />
                                      Static Frame
                                    </span>
                                  )}
                                  <span className="font-mono text-white/40">
                                    {s.duration || 5}s
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Options & Confirm */}
        <form
          onSubmit={handleConfirm}
          className="pt-4 mt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex flex-wrap items-center gap-4 text-xs text-white/75">
            {activeSelectionDetails ? (
              <>
                <span className="font-mono text-[#c6ff1f] font-semibold">
                  {selectedChoice?.importMode === 'all-slides'
                    ? `All Slides Player (${activeSelectionDetails.project.slides.length} slides · Read-only)`
                    : `Slide #${activeSelectionDetails.clampedIdx + 1} (${
                        activeSelectionDetails.hasAnimations
                          ? 'Animated · Loops'
                          : 'Static Frame'
                      })`}
                </span>
                {(selectedChoice?.importMode === 'all-slides' ||
                  activeSelectionDetails.hasAnimations) && (
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-white/75">
                      <input
                        type="checkbox"
                        checked={loopPlayback}
                        onChange={(e) => setLoopPlayback(e.target.checked)}
                        className="accent-[#c6ff1f]"
                      />
                      <span>Loop</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-white/75">
                      <input
                        type="checkbox"
                        checked={autoPlayOnSlide}
                        onChange={(e) => setAutoPlayOnSlide(e.target.checked)}
                        className="accent-[#c6ff1f]"
                      />
                      <span>Auto-play</span>
                    </label>
                  </div>
                )}
              </>
            ) : (
              <span className="text-white/50 font-mono">
                Select “Import All Slides” or pick any single slide above
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 justify-end shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white/75 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!activeSelectionDetails}
              className="btn-glow px-5 py-2 rounded-xl text-black text-xs font-bold inline-flex items-center gap-2 disabled:opacity-40 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>
                {selectedChoice?.importMode === 'all-slides'
                  ? 'Import All Slides Player'
                  : activeSelectionDetails
                  ? `Import Slide ${activeSelectionDetails.clampedIdx + 1} Video`
                  : 'Import Board Player'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
