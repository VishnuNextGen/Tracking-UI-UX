import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Presentation,
  Plus,
  Star,
  Clock,
  Trash2,
  Edit2,
  Copy,
  Download,
  ArrowRight,
  FileUp,
  Sparkles,
  Play,
  Check,
  X,
} from 'lucide-react';
import type { PresentationProject, Slide } from '../types/presentation';
import { SLIDE_THEMES } from '../constants/themesAndLayouts';
import { SlideRenderer } from '../renderer/SlideRenderer';

const ResponsiveSlideThumb: React.FC<{ slide: Slide }> = ({ slide }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.18);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / 1920);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center overflow-hidden pointer-events-none">
      <SlideRenderer slide={slide} scale={scale} />
    </div>
  );
};

interface StudioHomeProps {
  presentations: PresentationProject[];
  searchTerm: string;
  filterType: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  viewMode: 'minimal' | 'expanded';
  onOpenPresentation: (project: PresentationProject) => void;
  onPresentImmediately: (project: PresentationProject) => void;
  onNewPresentationClick: (initialMode?: 'blank' | 'templates' | 'ai') => void;
  onRenamePresentation: (id: string, title: string, description: string) => void;
  onDuplicatePresentation: (id: string) => void;
  onDeletePresentation: (id: string) => void;
  onToggleFavourite: (id: string) => void;
  onExportPresentationJSON: (project: PresentationProject) => void;
  onImportPresentationJSON: (file: File) => void;
}

export const StudioHome: React.FC<StudioHomeProps> = ({
  presentations,
  searchTerm,
  filterType,
  sortBy,
  sortOrder,
  viewMode,
  onOpenPresentation,
  onPresentImmediately,
  onNewPresentationClick,
  onRenamePresentation,
  onDuplicatePresentation,
  onDeletePresentation,
  onToggleFavourite,
  onExportPresentationJSON,
  onImportPresentationJSON,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const filtered = useMemo(() => {
    let result = [...presentations];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          p.slides.some((s) => s.title.toLowerCase().includes(q))
      );
    }

    if (filterType === 'recent') {
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      result = result.filter((p) => p.updatedAt >= cutoff);
    } else if (filterType === 'favourites') {
      result = result.filter((p) => p.favourite);
    }

    if (sortBy === 'date') {
      result.sort((a, b) =>
        sortOrder === 'desc' ? b.updatedAt - a.updatedAt : a.updatedAt - b.updatedAt
      );
    } else if (sortBy === 'name') {
      result.sort((a, b) =>
        sortOrder === 'desc' ? b.title.localeCompare(a.title) : a.title.localeCompare(b.title)
      );
    }

    return result;
  }, [presentations, searchTerm, filterType, sortBy, sortOrder]);

  const formatTimeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(ts).toLocaleDateString();
  };

  const startEditing = (p: PresentationProject) => {
    setEditingId(p.id);
    setEditTitle(p.title);
    setEditDesc(p.description || '');
  };

  const saveEdit = () => {
    if (editingId) {
      onRenamePresentation(editingId, editTitle, editDesc);
      setEditingId(null);
    }
  };

  if (filtered.length === 0) {
    return (
      <div className="glass rounded-2xl text-center py-16 px-4 text-white/40 flex flex-col items-center justify-center border border-white/5 mt-2">
        <div className="w-14 h-14 rounded-2xl bg-[#c6ff1f]/10 border border-[#c6ff1f]/20 flex items-center justify-center text-[#c6ff1f] mb-3.5 shadow-lg shadow-[#c6ff1f]/5">
          <Presentation className="w-7 h-7 stroke-[2]" />
        </div>
        <p className="text-base font-semibold text-white/85">
          {presentations.length === 0
            ? 'Welcome to Presentation Studio'
            : 'No presentations match your filter'}
        </p>
        <p className="text-xs mt-1.5 text-white/45 max-w-md leading-relaxed">
          {presentations.length === 0
            ? 'Design interactive 16:9 tactical presentations with editable SVG pitches, charts, custom layouts, AI design assistance, and fullscreen presentation mode — saved 100% locally in your browser.'
            : 'Try clearing your search query or switching filters.'}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
          <button
            type="button"
            onClick={() => onNewPresentationClick('blank')}
            className="btn-glow text-black text-xs font-semibold py-2 px-4 rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Blank Presentation</span>
          </button>
          <button
            type="button"
            onClick={() => onNewPresentationClick('templates')}
            className="bg-white/5 hover:bg-white/10 text-white/85 text-xs font-semibold py-2 px-4 rounded-lg border border-white/10 cursor-pointer"
          >
            Start from Template
          </button>
          <button
            type="button"
            onClick={() => onNewPresentationClick('ai')}
            className="bg-[#c6ff1f]/10 hover:bg-[#c6ff1f]/20 text-[#c6ff1f] text-xs font-semibold py-2 px-4 rounded-lg border border-[#c6ff1f]/25 flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate with AI</span>
          </button>
          <label className="bg-white/5 hover:bg-white/10 text-white/75 hover:text-white text-xs font-semibold py-2 px-4 rounded-lg flex items-center gap-1.5 cursor-pointer border border-white/10">
            <FileUp className="w-3.5 h-3.5" />
            <span>Import JSON</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  onImportPresentationJSON(e.target.files[0]);
                  e.target.value = '';
                }
              }}
            />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div>
      {viewMode === 'minimal' ? (
        <div className="bg-[#121216]/80 border border-white/[0.07] rounded-xl overflow-hidden shadow-xl backdrop-blur-md">
          <div className="hidden md:grid md:grid-cols-[minmax(240px,1fr)_160px_110px_110px_230px] gap-3 px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.06] text-[11px] font-semibold text-white/40 uppercase tracking-wider items-center">
            <div>Presentation</div>
            <div>Theme</div>
            <div>Slides</div>
            <div>Modified</div>
            <div className="text-right pr-1">Actions</div>
          </div>

          <div className="divide-y divide-white/[0.04]">
            {filtered.map((project) => {
              const theme = SLIDE_THEMES[project.themeId] || SLIDE_THEMES['dark-professional'];
              const isEditing = editingId === project.id;

              if (isEditing) {
                return (
                  <div
                    key={project.id}
                    className="p-3.5 bg-[#181a22] space-y-2 border-y border-[#c6ff1f]/30"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Presentation Title"
                        autoFocus
                        className="bg-[#0e1016] border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#c6ff1f]"
                      />
                      <input
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Description (optional)"
                        className="bg-[#0e1016] border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white/80 focus:outline-none focus:border-[#c6ff1f]"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1 rounded-lg bg-white/10 text-white/80 text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3 h-3" /> Cancel
                      </button>
                      <button
                        type="button"
                        onClick={saveEdit}
                        className="px-3 py-1 rounded-lg bg-[#c6ff1f] text-black font-semibold text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3 h-3" /> Save
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={project.id}
                  onClick={() => onOpenPresentation(project)}
                  className="project-row px-3.5 sm:px-4 py-2.5 hover:bg-white/[0.025] transition-colors group cursor-pointer"
                >
                  <div className="grid grid-cols-1 md:grid-cols-[minmax(240px,1fr)_160px_110px_110px_230px] gap-3 items-center">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavourite(project.id);
                        }}
                        className={`star-btn shrink-0 p-1 cursor-pointer ${
                          project.favourite ? 'active text-amber-400' : 'text-white/20 hover:text-amber-400'
                        }`}
                        title={project.favourite ? 'Starred' : 'Add to Starred'}
                      >
                        <Star className={`w-3.5 h-3.5 ${project.favourite ? 'fill-current' : ''}`} />
                      </button>

                      <div
                        className="w-10 h-6 rounded border shrink-0 overflow-hidden flex items-center justify-center"
                        style={{
                          backgroundColor: theme.backgroundColor,
                          borderColor: theme.surfaceBorderColor,
                        }}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: theme.accentColor }}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-semibold text-white truncate group-hover:text-[#c6ff1f] transition-colors">
                          {project.title}
                        </h4>
                        {project.description && (
                          <p className="text-[11px] text-white/45 truncate mt-0.5">
                            {project.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-white/65 flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: theme.accentColor }}
                      />
                      <span className="truncate">{theme.name}</span>
                    </div>

                    <div className="text-xs font-mono text-white/70 tabular-nums">
                      {project.slides.length} {project.slides.length === 1 ? 'slide' : 'slides'}
                    </div>

                    <div className="text-[11px] text-white/45 flex items-center gap-1 tabular-nums">
                      <Clock className="w-3 h-3 text-white/30" />
                      <span>{formatTimeAgo(project.updatedAt)}</span>
                    </div>

                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => onPresentImmediately(project)}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-[#c6ff1f] transition-colors cursor-pointer"
                        title="Present Fullscreen"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditing(project)}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/45 hover:text-white transition-colors cursor-pointer"
                        title="Rename"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDuplicatePresentation(project.id)}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/45 hover:text-white transition-colors cursor-pointer"
                        title="Duplicate"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onExportPresentationJSON(project)}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/45 hover:text-white transition-colors cursor-pointer"
                        title="Export Backup JSON"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeletePresentation(project.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/45 hover:text-red-400 transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenPresentation(project)}
                        className="ml-1 px-2.5 py-1 rounded-lg bg-[#c6ff1f]/15 hover:bg-[#c6ff1f] text-[#c6ff1f] hover:text-black font-semibold text-xs transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <span>Edit</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => {
            const theme = SLIDE_THEMES[project.themeId] || SLIDE_THEMES['dark-professional'];
            const firstSlide = project.slides[0];
            const isEditing = editingId === project.id;

            return (
              <div
                key={project.id}
                onClick={() => !isEditing && onOpenPresentation(project)}
                className="project-card glass rounded-2xl p-4 flex flex-col justify-between border border-white/10 hover:border-[#c6ff1f]/40 transition-all cursor-pointer group"
              >
                {/* Live 16:9 First-Slide Miniature */}
                <div className="w-full aspect-video rounded-xl mb-3.5 overflow-hidden border border-white/10 relative bg-[#0c0e14] flex items-center justify-center">
                  {firstSlide ? <ResponsiveSlideThumb slide={firstSlide} /> : null}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavourite(project.id);
                    }}
                    className={`absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/70 border border-white/15 cursor-pointer ${
                      project.favourite ? 'text-amber-400' : 'text-white/50 hover:text-amber-400'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${project.favourite ? 'fill-current' : ''}`} />
                  </button>
                </div>

                {isEditing ? (
                  <div className="space-y-2 mb-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      autoFocus
                      className="w-full bg-[#0e1016] border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#c6ff1f]"
                    />
                    <input
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Description"
                      className="w-full bg-[#0e1016] border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-white/75 focus:outline-none focus:border-[#c6ff1f]"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-2.5 py-1 rounded bg-white/10 text-xs text-white/75 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={saveEdit}
                        className="px-2.5 py-1 rounded bg-[#c6ff1f] text-xs font-bold text-black cursor-pointer"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-3">
                    <h3 className="text-sm font-bold text-white leading-tight group-hover:text-[#c6ff1f] transition-colors truncate">
                      {project.title}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-white/45 mt-1 tabular-nums">
                      <span>{theme.name}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {project.slides.length} {project.slides.length === 1 ? 'slide' : 'slides'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{formatTimeAgo(project.updatedAt)}</span>
                    </div>
                  </div>
                )}

                <div
                  className="flex items-center justify-between gap-2 pt-2.5 border-t border-white/[0.07]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onPresentImmediately(project)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-[#c6ff1f] cursor-pointer"
                      title="Present"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => startEditing(project)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-white/45 hover:text-white cursor-pointer"
                      title="Rename"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDuplicatePresentation(project.id)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-white/45 hover:text-white cursor-pointer"
                      title="Duplicate"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onExportPresentationJSON(project)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-white/45 hover:text-white cursor-pointer"
                      title="Export JSON"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeletePresentation(project.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/45 hover:text-red-400 cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenPresentation(project)}
                    className="btn-glow inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-black text-xs font-bold cursor-pointer"
                  >
                    <span>Open Studio</span>
                    <ArrowRight className="w-3 h-3 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
