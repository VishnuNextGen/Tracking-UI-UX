import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  ListVideo,
  Check,
  ChevronDown,
  ChevronRight,
  Film,
  Search,
  FolderOpen,
  Layers,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { Batch, Playlist, Project } from '../../../types';
import { listBatchesLocally, listProjectsLocally } from '../../../utils/db';
import { getCurrentUser } from '../../../utils/userPlanStore';
import {
  checkProjectHasVideo,
  extractClipFromProjectEvent,
  extractClipsFromPlaylist,
  formatReelTime,
  relinkProjectVideoFile,
} from '../storage/playlistVideoResolver';
import type { ImportedPlaylistClip } from '../types/presentation';

interface ImportPlaylistsModalProps {
  isOpen: boolean;
  targetElementId?: string | null;
  initialTitle?: string;
  onClose: () => void;
  onConfirmImport: (params: {
    targetElementId?: string | null;
    title: string;
    clips: ImportedPlaylistClip[];
  }) => void;
}

interface SelectableClipGroup {
  key: string; // e.g. proj:<projId>:pl:<plId> or batch:<batchId>:pl:<plId> or proj:<projId>:events
  kind: 'project-playlist' | 'batch-playlist' | 'project-events';
  sourceLabel: string;
  title: string;
  projectIds: string[];
  clips: ImportedPlaylistClip[];
}

export const ImportPlaylistsModal: React.FC<ImportPlaylistsModalProps> = ({
  isOpen,
  targetElementId,
  initialTitle,
  onClose,
  onConfirmImport,
}) => {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [videoReadyMap, setVideoReadyMap] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [selectedClipKeys, setSelectedClipKeys] = useState<Record<string, ImportedPlaylistClip>>({});
  const [reelTitle, setReelTitle] = useState(initialTitle || 'Multi-Project Video Reel');
  const [relinkProjectId, setRelinkProjectId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setReelTitle(initialTitle || 'Match Video Playlist');
    setSelectedClipKeys({});
    setSearchTerm('');

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const currentUid = getCurrentUser()?.id;
        const [allProjs, allBatches] = await Promise.all([
          listProjectsLocally(),
          listBatchesLocally(),
        ]);

        const belongs = (ownerId?: string) =>
          !currentUid || !ownerId || ownerId === currentUid || ownerId === 'guest';

        const filteredProjs = (allProjs || [])
          .filter((p: Project) => p && belongs(p.ownerId))
          .sort((a: Project, b: Project) => (b.lastModified || 0) - (a.lastModified || 0));

        const filteredBatches = (allBatches || [])
          .filter((b: Batch) => b && belongs(b.ownerId))
          .sort((a: Batch, b: Batch) => (b.lastModified || 0) - (a.lastModified || 0));

        const vidStatus: Record<string, boolean> = {};
        await Promise.all(
          filteredProjs.map(async (p: Project) => {
            vidStatus[p.id] = await checkProjectHasVideo(p.id);
          })
        );

        if (!cancelled) {
          setProjects(filteredProjs);
          setBatches(filteredBatches);
          setVideoReadyMap(vidStatus);

          // Auto-expand first non-empty group
          const initialExpanded: Record<string, boolean> = {};
          for (const p of filteredProjs) {
            const firstPl = (p.data?.playlists || []).find((pl: Playlist) => (pl.events?.length || 0) > 0);
            if (firstPl) {
              initialExpanded[`proj:${p.id}:pl:${firstPl.id}`] = true;
              break;
            }
          }
          setExpandedGroups(initialExpanded);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, initialTitle]);

  const groups = useMemo<SelectableClipGroup[]>(() => {
    const out: SelectableClipGroup[] = [];

    // 1. Batch Multi-Game Playlists
    for (const batch of batches) {
      const batchProjs = projects.filter((p) => batch.projectIds?.includes(p.id));
      for (const pl of batch.playlists || []) {
        const clips = extractClipsFromPlaylist({
          playlist: pl,
          allProjects: batchProjs.length > 0 ? batchProjs : projects,
          batch,
        });
        if (clips.length === 0) continue;
        const pIds = Array.from(new Set(clips.map((c) => c.projectId)));
        out.push({
          key: `batch:${batch.id}:pl:${pl.id}`,
          kind: 'batch-playlist',
          sourceLabel: `Batch · ${batch.name}`,
          title: pl.name || 'Batch Playlist',
          projectIds: pIds,
          clips,
        });
      }
    }

    // 2. Individual Analysis Project Playlists & Tagged Events
    for (const proj of projects) {
      for (const pl of proj.data?.playlists || []) {
        const clips = extractClipsFromPlaylist({
          playlist: pl,
          primaryProject: proj,
          allProjects: projects,
        });
        if (clips.length === 0) continue;
        out.push({
          key: `proj:${proj.id}:pl:${pl.id}`,
          kind: 'project-playlist',
          sourceLabel: proj.name || 'Analysis Project',
          title: pl.name || 'Playlist',
          projectIds: [proj.id],
          clips,
        });
      }

      // Also expose raw tagged events for that project so any tagged moment is importable
      const eventClips = (proj.data?.tagEvents || [])
        .map((ev) => extractClipFromProjectEvent(proj, ev.id))
        .filter((c): c is ImportedPlaylistClip => Boolean(c));
      if (eventClips.length > 0) {
        out.push({
          key: `proj:${proj.id}:events`,
          kind: 'project-events',
          sourceLabel: proj.name || 'Analysis Project',
          title: 'All Tagged Events',
          projectIds: [proj.id],
          clips: eventClips,
        });
      }
    }

    if (!searchTerm.trim()) return out;
    const q = searchTerm.toLowerCase().trim();
    return out.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        g.sourceLabel.toLowerCase().includes(q) ||
        g.clips.some(
          (c) =>
            c.tagName.toLowerCase().includes(q) ||
            (c.notes && c.notes.toLowerCase().includes(q))
        )
    );
  }, [projects, batches, searchTerm]);

  const clipKey = (groupKey: string, idx: number) => `${groupKey}::${idx}`;

  const toggleGroupSelection = (group: SelectableClipGroup) => {
    const allSelected = group.clips.every((_, idx) => Boolean(selectedClipKeys[clipKey(group.key, idx)]));
    setSelectedClipKeys((prev) => {
      const next = { ...prev };
      group.clips.forEach((clip, idx) => {
        const k = clipKey(group.key, idx);
        if (allSelected) {
          delete next[k];
        } else {
          next[k] = clip;
        }
      });
      return next;
    });
  };

  const toggleSingleClip = (groupKey: string, idx: number, clip: ImportedPlaylistClip) => {
    const k = clipKey(groupKey, idx);
    setSelectedClipKeys((prev) => {
      const next = { ...prev };
      if (next[k]) delete next[k];
      else next[k] = clip;
      return next;
    });
  };

  const selectedClips = Object.values(selectedClipKeys);
  const selectedProjectCount = new Set(selectedClips.map((c) => c.projectId)).size;
  const totalSelectedSeconds = selectedClips.reduce(
    (sum, c) => sum + Math.max(0.1, c.endTime - c.startTime),
    0
  );

  const handleRelinkFile = async (file: File) => {
    if (!relinkProjectId) return;
    await relinkProjectVideoFile(relinkProjectId, file);
    setVideoReadyMap((prev) => ({ ...prev, [relinkProjectId]: true }));
    setRelinkProjectId(null);
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedClips.length === 0) return;
    onConfirmImport({
      targetElementId,
      title: reelTitle.trim() || 'Multi-Project Video Reel',
      clips: selectedClips,
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
        className="bg-[#12141b] border border-white/15 rounded-2xl shadow-2xl max-w-3xl w-full p-6 text-left flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              handleRelinkFile(e.target.files[0]);
              e.target.value = '';
            }
          }}
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#c6ff1f]/12 border border-[#c6ff1f]/30 flex items-center justify-center text-[#c6ff1f]">
              <ListVideo className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {targetElementId ? 'Add Playlists to Video Reel' : 'Import Playlists from Analysis Projects'}
              </h2>
              <p className="text-xs text-white/55 mt-0.5">
                Pick playlists or tagged clips from multiple games—all clips play and pause continuously as one video.
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
              Slide Video Reel Title
            </label>
            <input
              type="text"
              value={reelTitle}
              onChange={(e) => setReelTitle(e.target.value)}
              placeholder="e.g. Pressing Traps vs Top 4"
              className="w-full bg-white/[0.04] border border-white/15 focus:border-[#c6ff1f] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-white/60 block mb-1">
              Search Projects, Playlists, or Tags
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter by match name, playlist, tag..."
                className="w-full bg-white/[0.04] border border-white/15 focus:border-[#c6ff1f] rounded-xl pl-8 pr-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Groups List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-panel min-h-[260px]">
          {loading ? (
            <div className="py-16 text-center text-xs text-white/50">
              Scanning local analysis projects and playlists...
            </div>
          ) : groups.length === 0 ? (
            <div className="py-14 px-6 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] text-center space-y-2">
              <FolderOpen className="w-8 h-8 text-white/30 mx-auto" />
              <div className="text-sm font-semibold text-white">
                {projects.length === 0
                  ? 'No Analysis Projects Found Yet'
                  : 'No Populated Playlists or Tagged Clips Found'}
              </div>
              <p className="text-xs text-white/50 max-w-md mx-auto leading-relaxed">
                Open a match inside the <strong className="text-white/80">Games</strong> or <strong className="text-white/80">Batches</strong> tab, tag events or build a playlist, then return here to import those playlists into your presentation slides.
              </p>
            </div>
          ) : (
            groups.map((group) => {
              const selectedCount = group.clips.filter((_, idx) =>
                Boolean(selectedClipKeys[clipKey(group.key, idx)])
              ).length;
              const allChecked = selectedCount === group.clips.length && group.clips.length > 0;
              const partialChecked = selectedCount > 0 && !allChecked;
              const isExpanded = Boolean(expandedGroups[group.key]);
              const groupDuration = group.clips.reduce(
                (s, c) => s + Math.max(0.1, c.endTime - c.startTime),
                0
              );
              const missingVideoPids = group.projectIds.filter((pid) => !videoReadyMap[pid]);

              return (
                <div
                  key={group.key}
                  className={`rounded-xl border transition-colors ${
                    selectedCount > 0
                      ? 'bg-[#c6ff1f]/[0.06] border-[#c6ff1f]/40'
                      : 'bg-white/[0.025] border-white/10'
                  }`}
                >
                  <div className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedGroups((prev) => ({ ...prev, [group.key]: !prev[group.key] }))
                        }
                        className="p-1 rounded-md hover:bg-white/10 text-white/55 cursor-pointer shrink-0"
                        title="Expand individual clips"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleGroupSelection(group)}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                          allChecked
                            ? 'bg-[#c6ff1f] border-[#c6ff1f] text-black'
                            : partialChecked
                            ? 'bg-[#c6ff1f]/30 border-[#c6ff1f] text-[#c6ff1f]'
                            : 'bg-black/40 border-white/25 hover:border-white/50'
                        }`}
                      >
                        {(allChecked || partialChecked) && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>

                      <div
                        className="min-w-0 flex-1 cursor-pointer"
                        onClick={() => toggleGroupSelection(group)}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white truncate">
                            {group.title}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.07] text-[10px] font-medium text-white/70">
                            {group.kind === 'batch-playlist' ? (
                              <Layers className="w-2.5 h-2.5 text-[#c6ff1f]" />
                            ) : (
                              <Film className="w-2.5 h-2.5 text-sky-400" />
                            )}
                            {group.sourceLabel}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-white/45 mt-0.5">
                          {group.clips.length} clip{group.clips.length > 1 ? 's' : ''} · {formatReelTime(groupDuration)}
                          {selectedCount > 0 && ` · ${selectedCount} selected`}
                        </div>
                      </div>
                    </div>

                    {/* Local Video Readiness Badge */}
                    <div className="shrink-0">
                      {missingVideoPids.length === 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-[10px] font-semibold text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Video Ready</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setRelinkProjectId(missingVideoPids[0]);
                            fileInputRef.current?.click();
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-[10px] font-semibold text-amber-200 cursor-pointer"
                          title="Relink local video file for this project"
                        >
                          <Upload className="w-3 h-3" />
                          <span>Link Video</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded individual clips */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t border-white/[0.07] space-y-1.5">
                      {group.clips.map((clip, idx) => {
                        const checked = Boolean(selectedClipKeys[clipKey(group.key, idx)]);
                        const hasVid = videoReadyMap[clip.projectId];
                        return (
                          <div
                            key={`${group.key}-${idx}`}
                            onClick={() => toggleSingleClip(group.key, idx, clip)}
                            className={`px-2.5 py-2 rounded-lg border flex items-center justify-between gap-2 text-xs cursor-pointer transition-colors ${
                              checked
                                ? 'bg-[#c6ff1f]/10 border-[#c6ff1f]/40 text-white'
                                : 'bg-black/25 hover:bg-white/[0.05] border-white/[0.06] text-white/75'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {}}
                                className="accent-[#c6ff1f] pointer-events-none"
                              />
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: clip.tagColor }}
                              />
                              <span className="font-semibold truncate">{clip.tagName}</span>
                              {clip.notes && (
                                <span className="text-[11px] text-white/45 truncate">
                                  — {clip.notes}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0 text-[10px] font-mono text-white/50">
                              {!hasVid && (
                                <span title="Video file not cached locally yet">
                                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                                </span>
                              )}
                              <span>
                                {formatReelTime(clip.startTime)}–{formatReelTime(clip.endTime)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <form
          onSubmit={handleConfirm}
          className="pt-4 mt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="text-xs text-white/65 font-mono">
            {selectedClips.length === 0 ? (
              <span>Select playlists or clips from any analysis project above</span>
            ) : (
              <span className="text-[#c6ff1f] font-semibold">
                {selectedClips.length} clip{selectedClips.length > 1 ? 's' : ''} · {selectedProjectCount} project{selectedProjectCount > 1 ? 's' : ''} · {formatReelTime(totalSelectedSeconds)} continuous video
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white/75 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={selectedClips.length === 0}
              className="btn-glow px-5 py-2 rounded-xl text-black text-xs font-bold inline-flex items-center gap-2 disabled:opacity-40 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {targetElementId ? `Add ${selectedClips.length} Clips` : `Import as Video Reel (${selectedClips.length})`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
