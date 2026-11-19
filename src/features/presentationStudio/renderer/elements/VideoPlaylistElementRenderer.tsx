import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Film,
  ListVideo,
  FolderPlus,
  Upload,
} from 'lucide-react';
import type { ImportedPlaylistClip, VideoPlaylistSlideElement } from '../../types/presentation';
import {
  formatReelTime,
  getCachedVideoObjectUrl,
  relinkProjectVideoFile,
  resolveProjectVideoUrl,
} from '../../storage/playlistVideoResolver';

interface ComputedReelSegment {
  index: number;
  clip: ImportedPlaylistClip;
  duration: number;
  macroStart: number;
  macroEnd: number;
}

export const SLIDE_PLAYLIST_TRANSPORT_EVENT = 'tacstem_ps_playlist_transport';

export function dispatchSlidePlaylistTransport(action: 'play' | 'pause' | 'toggle') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SLIDE_PLAYLIST_TRANSPORT_EVENT, { detail: { action } }));
}

export const VideoPlaylistElementRenderer: React.FC<{
  element: VideoPlaylistSlideElement;
  interactive?: boolean;
  onOpenImporter?: (elementId: string) => void;
}> = ({ element, interactive = false, onOpenImporter }) => {
  const clips = element.clips || [];
  const accent = element.accentColor || '#c6ff1f';
  const bg = element.backgroundColor || '#0b0e14';
  const borderRadius = element.borderRadius ?? 20;

  const { segments, totalDuration, distinctProjects } = useMemo(() => {
    let cursor = 0;
    const projectSet = new Set<string>();
    const segs: ComputedReelSegment[] = clips.map((clip, index) => {
      const duration = Math.max(0.1, clip.endTime - clip.startTime);
      const macroStart = cursor;
      const macroEnd = cursor + duration;
      cursor = macroEnd;
      if (clip.projectId) projectSet.add(clip.projectId);
      return { index, clip, duration, macroStart, macroEnd };
    });
    return {
      segments: segs,
      totalDuration: cursor,
      distinctProjects: Array.from(projectSet),
    };
  }, [clips]);

  // Fast static poster card when rendered inside sidebar/dashboard thumbnails
  if (!interactive) {
    return (
      <div
        className="w-full h-full flex flex-col justify-between p-7 border border-white/15 overflow-hidden relative"
        style={{ backgroundColor: bg, borderRadius }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${accent}22`, color: accent }}
            >
              <ListVideo className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-bold text-white truncate">
                {element.title || 'Match Video Playlist'}
              </div>
              <div className="text-sm font-mono text-white/55">
                {clips.length === 0
                  ? 'No clips imported yet'
                  : `${clips.length} clip${clips.length > 1 ? 's' : ''} · ${distinctProjects.length} project${distinctProjects.length > 1 ? 's' : ''} · ${formatReelTime(totalDuration)}`}
              </div>
            </div>
          </div>
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 text-black shadow-lg"
            style={{ backgroundColor: accent }}
          >
            <Play className="w-6 h-6 fill-current ml-0.5" />
          </div>
        </div>

        <div className="flex-1 my-4 rounded-xl bg-black/50 border border-white/10 flex flex-col items-center justify-center gap-2 text-white/50">
          <Film className="w-12 h-12 opacity-60" />
          <span className="text-lg font-medium">
            {clips.length > 0
              ? 'Unified Multi-Project Video Reel'
              : 'Import Playlists from Analysis Projects'}
          </span>
        </div>

        {clips.length > 0 && (
          <div className="flex items-center gap-2 overflow-hidden">
            {clips.slice(0, 4).map((c, idx) => (
              <div
                key={c.id}
                className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-xs text-white/85 truncate flex items-center gap-2"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: c.tagColor || accent }}
                />
                <span className="font-mono text-white/45">#{idx + 1}</span>
                <span className="truncate">{c.tagName}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <InteractiveUnifiedPlaylistPlayer
      element={element}
      segments={segments}
      totalDuration={totalDuration}
      distinctProjects={distinctProjects}
      accent={accent}
      bg={bg}
      borderRadius={borderRadius}
      onOpenImporter={onOpenImporter}
    />
  );
};

const InteractiveUnifiedPlaylistPlayer: React.FC<{
  element: VideoPlaylistSlideElement;
  segments: ComputedReelSegment[];
  totalDuration: number;
  distinctProjects: string[];
  accent: string;
  bg: string;
  borderRadius: number;
  onOpenImporter?: (elementId: string) => void;
}> = ({
  element,
  segments,
  totalDuration,
  distinctProjects,
  accent,
  bg,
  borderRadius,
  onOpenImporter,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const relinkInputRef = useRef<HTMLInputElement>(null);

  const [videoUrls, setVideoUrls] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    distinctProjects.forEach((pid) => {
      const cached = getCachedVideoObjectUrl(pid);
      if (cached) initial[pid] = cached;
    });
    return initial;
  });
  const [missingProjects, setMissingProjects] = useState<Record<string, boolean>>({});
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const [clipLocalTime, setClipLocalTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(Boolean(element.muted));
  const [loopEnabled, setLoopEnabled] = useState(element.loop !== false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [relinkingProjectId, setRelinkingProjectId] = useState<string | null>(null);

  // Refs for jitter-free frame advance & cross-project video src transitions
  const pendingSeekRef = useRef<{ targetTime: number; autoPlay: boolean } | null>(null);
  const isPlayingRef = useRef(isPlaying);
  const activeClipIndexRef = useRef(activeClipIndex);
  const loopEnabledRef = useRef(loopEnabled);
  const segmentsRef = useRef(segments);
  const videoUrlsRef = useRef(videoUrls);

  isPlayingRef.current = isPlaying;
  activeClipIndexRef.current = activeClipIndex;
  loopEnabledRef.current = loopEnabled;
  segmentsRef.current = segments;
  videoUrlsRef.current = videoUrls;

  // Keep local clip index valid if user deletes/reorders clips in PropertiesPanel
  useEffect(() => {
    if (segments.length === 0) {
      setActiveClipIndex(0);
      setClipLocalTime(0);
      setIsPlaying(false);
    } else if (activeClipIndex >= segments.length) {
      setActiveClipIndex(0);
      setClipLocalTime(0);
    }
  }, [segments.length, activeClipIndex]);

  useEffect(() => {
    setIsMuted(Boolean(element.muted));
  }, [element.muted]);

  useEffect(() => {
    setLoopEnabled(element.loop !== false);
  }, [element.loop]);

  // Pre-resolve local video URLs for all referenced analysis projects
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const nextUrls: Record<string, string> = {};
      const nextMissing: Record<string, boolean> = {};
      await Promise.all(
        distinctProjects.map(async (pid) => {
          const url = await resolveProjectVideoUrl(pid);
          if (url) nextUrls[pid] = url;
          else nextMissing[pid] = true;
        })
      );
      if (!cancelled) {
        setVideoUrls((prev) => ({ ...prev, ...nextUrls }));
        setMissingProjects(nextMissing);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [distinctProjects]);

  const activeSegment = segments[activeClipIndex] || segments[0];
  const activeProjectId = activeSegment?.clip.projectId || '';
  const activeVideoUrl = activeProjectId ? videoUrls[activeProjectId] : undefined;

  const macroCurrentTime = useMemo(() => {
    if (!activeSegment) return 0;
    const clampedLocal = Math.max(0, Math.min(activeSegment.duration, clipLocalTime));
    return activeSegment.macroStart + clampedLocal;
  }, [activeSegment, clipLocalTime]);

  const jumpToClip = useCallback(
    (nextIndex: number, offsetSeconds = 0, shouldPlay?: boolean) => {
      const segs = segmentsRef.current;
      if (segs.length === 0) return;
      const clampedIdx = Math.max(0, Math.min(segs.length - 1, nextIndex));
      const targetSeg = segs[clampedIdx];
      const clampedOffset = Math.max(0, Math.min(targetSeg.duration, offsetSeconds));
      const targetTime = targetSeg.clip.startTime + clampedOffset;
      const playAfter = shouldPlay ?? isPlayingRef.current;

      const currentUrl = segs[activeClipIndexRef.current]
        ? videoUrlsRef.current[segs[activeClipIndexRef.current].clip.projectId]
        : undefined;
      const nextUrl = videoUrlsRef.current[targetSeg.clip.projectId];

      setActiveClipIndex(clampedIdx);
      setClipLocalTime(clampedOffset);

      const vid = videoRef.current;
      if (vid && nextUrl && currentUrl === nextUrl && vid.readyState >= 1) {
        pendingSeekRef.current = null;
        try {
          vid.currentTime = targetTime;
        } catch {
          // ignore
        }
        if (playAfter) {
          vid.playbackRate = playbackRate;
          vid.play().catch(() => setIsPlaying(false));
        } else {
          vid.pause();
        }
      } else {
        pendingSeekRef.current = { targetTime, autoPlay: playAfter };
      }
    },
    [playbackRate]
  );

  const togglePlayPause = useCallback(() => {
    if (segmentsRef.current.length === 0) return;
    const vid = videoRef.current;
    if (isPlayingRef.current) {
      setIsPlaying(false);
      vid?.pause();
    } else {
      const seg = segmentsRef.current[activeClipIndexRef.current];
      if (!seg) return;
      setIsPlaying(true);
      if (vid) {
        vid.playbackRate = playbackRate;
        if (
          vid.currentTime < seg.clip.startTime - 0.1 ||
          vid.currentTime >= seg.clip.endTime - 0.05
        ) {
          vid.currentTime = seg.clip.startTime;
        }
        vid.play().catch(() => {
          pendingSeekRef.current = { targetTime: seg.clip.startTime, autoPlay: true };
        });
      }
    }
  }, [playbackRate]);

  // Listen for slide-wide unified play/pause commands (e.g. Presenter "Play/Pause All" or 'P' hotkey)
  useEffect(() => {
    const handler = (e: Event) => {
      const action = (e as CustomEvent)?.detail?.action;
      if (segmentsRef.current.length === 0) return;
      const vid = videoRef.current;
      if (action === 'pause') {
        setIsPlaying(false);
        vid?.pause();
      } else if (action === 'play') {
        if (!isPlayingRef.current) togglePlayPause();
      } else if (action === 'toggle') {
        togglePlayPause();
      }
    };
    window.addEventListener(SLIDE_PLAYLIST_TRANSPORT_EVENT, handler);
    return () => window.removeEventListener(SLIDE_PLAYLIST_TRANSPORT_EVENT, handler);
  }, [togglePlayPause]);

  // Seek initial frame cleanly when metadata loads
  const handleLoadedMetadata = () => {
    const vid = videoRef.current;
    const seg = segmentsRef.current[activeClipIndexRef.current];
    if (!vid || !seg) return;

    const pending = pendingSeekRef.current;
    const target = pending ? pending.targetTime : seg.clip.startTime;
    const shouldPlay = pending ? pending.autoPlay : isPlayingRef.current;
    pendingSeekRef.current = null;

    try {
      vid.currentTime = target;
    } catch {
      // ignore
    }
    vid.playbackRate = playbackRate;
    if (shouldPlay) {
      vid.play().catch(() => setIsPlaying(false));
    }
  };

  // Continuous playback loop across clips & different projects
  useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;

    const tick = () => {
      const vid = videoRef.current;
      const segs = segmentsRef.current;
      const curIdx = activeClipIndexRef.current;
      const seg = segs[curIdx];

      if (vid && seg && !pendingSeekRef.current) {
        const t = vid.currentTime;
        setClipLocalTime(Math.max(0, Math.min(seg.duration, t - seg.clip.startTime)));

        if (t >= seg.clip.endTime - 0.04 || vid.ended) {
          if (curIdx + 1 < segs.length) {
            jumpToClip(curIdx + 1, 0, true);
          } else if (loopEnabledRef.current) {
            jumpToClip(0, 0, true);
          } else {
            vid.pause();
            setIsPlaying(false);
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, jumpToClip]);

  const handleScrubBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!progressBarRef.current || totalDuration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetMacro = pct * totalDuration;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (targetMacro >= seg.macroStart && (targetMacro < seg.macroEnd || i === segments.length - 1)) {
        jumpToClip(i, targetMacro - seg.macroStart);
        return;
      }
    }
  };

  const handleRelinkFileSelected = async (file: File) => {
    const pid = relinkingProjectId || activeProjectId;
    if (!pid) return;
    const url = await relinkProjectVideoFile(pid, file);
    setVideoUrls((prev) => ({ ...prev, [pid]: url }));
    setMissingProjects((prev) => ({ ...prev, [pid]: false }));
    setRelinkingProjectId(null);
  };

  if (segments.length === 0) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center p-10 text-center border-2 border-dashed border-white/20"
        style={{ backgroundColor: bg, borderRadius }}
      >
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
          style={{ backgroundColor: `${accent}20`, color: accent }}
        >
          <ListVideo className="w-10 h-10" />
        </div>
        <h3 className="text-3xl font-bold text-white mb-2">
          {element.title || 'Multi-Project Video Playlist'}
        </h3>
        <p className="text-xl text-white/60 max-w-2xl mb-6 leading-relaxed">
          Import one or more playlists from your Tacstem analysis projects to play and pause them seamlessly together as a single video reel.
        </p>
        {onOpenImporter && (
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onOpenImporter(element.id);
            }}
            className="px-7 py-3.5 rounded-xl font-bold text-lg text-black inline-flex items-center gap-2.5 shadow-lg cursor-pointer transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: accent }}
          >
            <FolderPlus className="w-6 h-6" />
            <span>Import Playlists from Projects</span>
          </button>
        )}
      </div>
    );
  }

  const macroPct = totalDuration > 0 ? Math.min(100, (macroCurrentTime / totalDuration) * 100) : 0;

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden border border-white/15 shadow-2xl relative"
      style={{ backgroundColor: '#05070b', borderRadius }}
    >
      {/* Hidden input for manual video relink if a project's local video was moved */}
      <input
        ref={relinkInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            handleRelinkFileSelected(e.target.files[0]);
            e.target.value = '';
          }
        }}
      />

      {/* Main Video Stage */}
      <div
        className="relative flex-1 min-h-0 bg-black flex items-center justify-center overflow-hidden cursor-pointer group"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          if (activeVideoUrl) togglePlayPause();
        }}
      >
        {activeVideoUrl ? (
          <video
            key={activeProjectId}
            ref={videoRef}
            src={activeVideoUrl}
            muted={isMuted}
            playsInline
            preload="auto"
            onLoadedMetadata={handleLoadedMetadata}
            className="w-full h-full object-contain bg-black"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center gap-4">
            <Film className="w-16 h-16 text-white/30" />
            <div className="text-2xl font-bold text-white">
              Video file needed for “{activeSegment?.clip.projectName}”
            </div>
            <p className="text-lg text-white/55 max-w-xl">
              {missingProjects[activeProjectId]
                ? 'This project’s video file was not found in browser storage. Relink the video file once to enable playback across your playlist.'
                : 'Loading local project video...'}
            </p>
            {missingProjects[activeProjectId] && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setRelinkingProjectId(activeProjectId);
                  relinkInputRef.current?.click();
                }}
                className="px-6 py-3 rounded-xl font-bold text-base text-black inline-flex items-center gap-2 cursor-pointer"
                style={{ backgroundColor: accent }}
              >
                <Upload className="w-5 h-5" />
                <span>Relink Match Video</span>
              </button>
            )}
          </div>
        )}

        {/* Top Clip Overlay HUD */}
        {element.showOverlayHud !== false && activeSegment && (
          <div className="absolute top-5 left-5 right-5 flex items-start justify-between gap-4 pointer-events-none">
            <div className="px-4 py-2.5 rounded-xl bg-black/75 border border-white/15 backdrop-blur-md flex items-center gap-3 max-w-[75%]">
              <span
                className="w-3.5 h-3.5 rounded-full shrink-0"
                style={{ backgroundColor: activeSegment.clip.tagColor || accent }}
              />
              <div className="min-w-0">
                <div className="text-lg font-bold text-white truncate">
                  {activeSegment.clip.tagName}
                  {activeSegment.clip.notes ? ` — ${activeSegment.clip.notes}` : ''}
                </div>
                <div className="text-sm font-mono text-white/65 truncate">
                  {activeSegment.clip.projectName} · {activeSegment.clip.playlistName}
                </div>
              </div>
            </div>

            <div className="px-4 py-2 rounded-xl bg-black/75 border border-white/15 backdrop-blur-md text-base font-mono font-bold text-white shrink-0">
              Clip {String(activeClipIndex + 1).padStart(2, '0')} / {String(segments.length).padStart(2, '0')}
            </div>
          </div>
        )}

        {/* Center Play Overlay when Paused */}
        {activeVideoUrl && !isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/25 transition-opacity pointer-events-none">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-black shadow-2xl"
              style={{ backgroundColor: accent }}
            >
              <Play className="w-11 h-11 fill-current ml-1.5" />
            </div>
          </div>
        )}
      </div>

      {/* Unified Contiguous Transport & Multi-Project Timeline Bar */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 bg-[#11141d] border-t border-white/12 px-5 py-3.5 space-y-2.5"
      >
        {/* Contiguous Macro Progress Scrubber showing all clips stitched together */}
        <div
          ref={progressBarRef}
          onClick={handleScrubBarClick}
          className="relative h-4 rounded-full bg-white/10 overflow-hidden cursor-pointer flex items-center"
          title="Click anywhere to seek across all imported clips"
        >
          {/* Colored clip segments */}
          {segments.map((seg) => {
            const widthPct = totalDuration > 0 ? (seg.duration / totalDuration) * 100 : 0;
            const isCurrent = seg.index === activeClipIndex;
            return (
              <div
                key={seg.clip.id}
                className="h-full border-r border-black/60 last:border-r-0 transition-opacity"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: seg.clip.tagColor || accent,
                  opacity: isCurrent ? 0.38 : 0.18,
                }}
              />
            );
          })}

          {/* Continuous Played Fill */}
          <div
            className="absolute inset-y-0 left-0 pointer-events-none"
            style={{ width: `${macroPct}%`, backgroundColor: accent }}
          />
        </div>

        {/* Transport Controls Row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => jumpToClip(Math.max(0, activeClipIndex - 1), 0)}
              disabled={activeClipIndex === 0}
              className="p-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] disabled:opacity-30 text-white cursor-pointer"
              title="Previous Clip"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={togglePlayPause}
              className="px-4 py-2 rounded-xl font-bold text-base text-black inline-flex items-center gap-2 cursor-pointer"
              style={{ backgroundColor: accent }}
              title="Play / Pause Unified Playlist Video"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
              <span>{isPlaying ? 'Pause' : 'Play All'}</span>
            </button>

            <button
              type="button"
              onClick={() => jumpToClip(Math.min(segments.length - 1, activeClipIndex + 1), 0)}
              disabled={activeClipIndex >= segments.length - 1}
              className="p-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] disabled:opacity-30 text-white cursor-pointer"
              title="Next Clip"
            >
              <SkipForward className="w-5 h-5" />
            </button>

            <span className="text-base font-mono font-bold tabular-nums text-white/90 ml-2">
              {formatReelTime(macroCurrentTime)} / {formatReelTime(totalDuration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Speed Selector */}
            <button
              type="button"
              onClick={() => {
                const speeds = [0.5, 1, 1.5, 2];
                const next = speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length];
                setPlaybackRate(next);
                if (videoRef.current) videoRef.current.playbackRate = next;
              }}
              className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] text-sm font-mono font-bold text-white/85 cursor-pointer"
              title="Playback Speed"
            >
              {playbackRate}x
            </button>

            <button
              type="button"
              onClick={() => setLoopEnabled((v) => !v)}
              className={`p-2 rounded-lg border cursor-pointer ${
                loopEnabled
                  ? 'bg-white/[0.12] border-white/25 text-white'
                  : 'bg-white/[0.04] border-white/10 text-white/45'
              }`}
              title="Loop Continuous Playlist"
            >
              <Repeat className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsMuted((v) => !v)}
              className="p-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] text-white/85 cursor-pointer"
              title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>

            {onOpenImporter && (
              <button
                type="button"
                onClick={() => onOpenImporter(element.id)}
                className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] border border-white/15 text-sm font-semibold text-white/90 inline-flex items-center gap-1.5 cursor-pointer"
                title="Add or Manage Imported Playlists"
              >
                <FolderPlus className="w-4 h-4" style={{ color: accent }} />
                <span>Playlists</span>
              </button>
            )}
          </div>
        </div>

        {/* Clip Queue Strip */}
        {element.showClipStrip !== false && segments.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-0.5 scrollbar-none">
            {segments.map((seg) => {
              const isCurrent = seg.index === activeClipIndex;
              return (
                <button
                  key={seg.clip.id}
                  type="button"
                  onClick={() => jumpToClip(seg.index, 0)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2 ${
                    isCurrent
                      ? 'bg-white/[0.15] border-white/40 text-white'
                      : 'bg-white/[0.04] hover:bg-white/[0.09] border-white/10 text-white/70'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: seg.clip.tagColor || accent }}
                  />
                  <span className="text-xs font-semibold truncate max-w-[180px]">
                    {seg.index + 1}. {seg.clip.tagName}
                  </span>
                  <span className="text-[11px] font-mono text-white/45 shrink-0">
                    {seg.clip.projectName.slice(0, 14)} · {Math.round(seg.duration)}s
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
