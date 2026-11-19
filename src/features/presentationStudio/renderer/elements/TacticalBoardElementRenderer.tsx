import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Clapperboard,
  Layers,
  Sparkles,
  Lock,
} from 'lucide-react';
import type { TacticalBoardSlideElement } from '../../types/presentation';
import { drawBoardToCanvas, drawStaticBackgroundToCanvas } from '../../../../board/canvasRenderer';
import { PITCH_HEIGHT, PITCH_WIDTH } from '../../../../board/constants';
import type { PitchTemplate, Project as TacticalProject } from '../../../../board/types';
import {
  buildBoardPlaybackTimeline,
  countBoardProjectContentScore,
  detectBoardSlideHasAnimations,
  formatBoardDurationMs,
  getPreferredPreviewSlideIndex,
  isBoardSlideEmpty,
  loadLiveBoardProjectById,
  normalizeBoardProjectData,
  resolvePitchTemplate,
  resolveSlideCoinSettings,
  type BoardTimelineSegment,
} from '../../storage/boardProjectResolver';
import { SLIDE_PLAYLIST_TRANSPORT_EVENT } from './VideoPlaylistElementRenderer';

function useLoadedBackgroundImage(src?: string | null): HTMLImageElement | null {
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setImgEl(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!cancelled) setImgEl(img);
    };
    img.onerror = () => {
      if (!cancelled) setImgEl(null);
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return imgEl;
}

/**
 * Lightweight, read-only single-frame snapshot canvas for Tactical Board slides.
 * Used both for sidebar slide thumbnails and preview cards in the importer modal.
 */
export const TacticalBoardSnapshotCanvas: React.FC<{
  boardData: unknown;
  pitchTemplate?: string;
  slideIndex?: number;
  renderScale?: number;
  className?: string;
}> = ({ boardData, pitchTemplate, slideIndex = 0, renderScale = 0.7, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const project = useMemo(() => normalizeBoardProjectData(boardData), [boardData]);
  const template = useMemo(
    () => resolvePitchTemplate(pitchTemplate || (project?.pitchTemplate as string | undefined)),
    [pitchTemplate, project?.pitchTemplate]
  );
  const bgImg = useLoadedBackgroundImage(project?.backgroundImage);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !project || project.slides.length === 0) return;

    const pWidth = project.pitchWidth || PITCH_WIDTH;
    const pHeight = project.pitchHeight || PITCH_HEIGHT;
    const w = Math.max(160, Math.round(pWidth * renderScale));
    const h = Math.max(90, Math.round(pHeight * renderScale));

    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const idx = Math.max(0, Math.min(project.slides.length - 1, slideIndex));
    const currentSlide = project.slides[idx];
    const previousSlide = idx > 0 ? project.slides[idx - 1] : null;
    const coinSettings = resolveSlideCoinSettings(currentSlide, project.slides[0]?.coinSettings);

    const staticCanvas = document.createElement('canvas');
    staticCanvas.width = w;
    staticCanvas.height = h;
    const staticCtx = staticCanvas.getContext('2d');
    if (staticCtx) {
      try {
        drawStaticBackgroundToCanvas(staticCtx, project, bgImg, template, w, h, renderScale);
      } catch (err) {
        console.error('drawStaticBackgroundToCanvas error:', err);
      }
    }

    ctx.fillStyle = '#080b12';
    ctx.fillRect(0, 0, w, h);
    try {
      drawBoardToCanvas(
        ctx,
        project,
        currentSlide,
        previousSlide,
        1,
        coinSettings,
        bgImg,
        template,
        w,
        h,
        renderScale,
        null,
        null,
        false,
        [],
        null,
        null,
        staticCanvas
      );
    } catch (err) {
      console.error('drawBoardToCanvas snapshot error:', err);
    }
  }, [project, template, bgImg, slideIndex, renderScale]);

  return (
    <canvas
      ref={canvasRef}
      className={`block w-full h-full object-contain bg-[#080b12] ${className}`}
    />
  );
};

export const TacticalBoardElementRenderer: React.FC<{
  element: TacticalBoardSlideElement;
  interactive?: boolean;
  onOpenBoardImporter?: (elementId: string) => void;
}> = ({ element, interactive = false, onOpenBoardImporter }) => {
  const accent = element.accentColor || '#c6ff1f';
  const bg = element.backgroundColor || '#0b0e14';
  const borderRadius = element.borderRadius ?? 20;

  const embeddedProject = useMemo(
    () => normalizeBoardProjectData(element.boardData),
    [element.boardData]
  );

  const [syncedState, setSyncedState] = useState<{
    boardProjectId: string;
    project: TacticalProject;
    template: PitchTemplate;
  } | null>(null);

  // If this board exists in local storage and has newer/richer edits, stay in sync with Tactical Board
  useEffect(() => {
    if (!element.boardProjectId) {
      setSyncedState(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const live = await loadLiveBoardProjectById(element.boardProjectId!);
      if (cancelled || !live) return;

      const embeddedTs = embeddedProject?.lastSavedAt || 0;
      const liveTs = live.lastSavedAt || 0;
      const liveScore = countBoardProjectContentScore(live.boardData);
      const embeddedScore = countBoardProjectContentScore(embeddedProject);

      const shouldUseLive =
        !embeddedProject ||
        liveTs > embeddedTs ||
        (embeddedScore === 0 && liveScore > 0) ||
        liveScore !== embeddedScore;

      if (shouldUseLive) {
        setSyncedState({
          boardProjectId: element.boardProjectId!,
          project: live.boardData,
          template: live.pitchTemplate,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [element.boardProjectId, embeddedProject]);

  const project =
    syncedState && syncedState.boardProjectId === element.boardProjectId
      ? syncedState.project
      : embeddedProject;

  const template = useMemo(
    () =>
      resolvePitchTemplate(
        (syncedState && syncedState.boardProjectId === element.boardProjectId
          ? syncedState.template
          : undefined) ||
          (project?.pitchTemplate as string | undefined) ||
          element.pitchTemplate
      ),
    [syncedState, element.boardProjectId, project?.pitchTemplate, element.pitchTemplate]
  );

  // Fast static preview when rendered inside slide navigator thumbnails or deck cards
  if (!interactive) {
    const thumbSlideIdx =
      element.importMode === 'single-slide'
        ? Math.max(0, Math.min((project?.slides.length || 1) - 1, element.slideIndex ?? 0))
        : getPreferredPreviewSlideIndex(project);

    return (
      <div
        className="w-full h-full flex flex-col justify-between border border-white/15 overflow-hidden relative"
        style={{ backgroundColor: bg, borderRadius }}
      >
        <div className="flex-1 min-h-0 relative bg-[#080b12]">
          {project ? (
            <TacticalBoardSnapshotCanvas
              boardData={project}
              pitchTemplate={template}
              slideIndex={thumbSlideIdx}
              renderScale={0.55}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/40">
              <Clapperboard className="w-12 h-12" />
            </div>
          )}

          <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
            <div className="px-3 py-1.5 rounded-lg bg-black/75 border border-white/15 text-xs font-bold text-white truncate max-w-[70%]">
              {element.title || element.boardProjectName || 'Tactical Board'}
            </div>
            <div
              className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold text-black shrink-0"
              style={{ backgroundColor: accent }}
            >
              {element.importMode === 'single-slide'
                ? `Slide ${(element.slideIndex ?? 0) + 1}`
                : `${project?.slides.length || 0} Slides`}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <InteractiveTacticalBoardVideoPlayer
      element={element}
      project={project}
      template={template}
      accent={accent}
      bg={bg}
      borderRadius={borderRadius}
      onOpenBoardImporter={onOpenBoardImporter}
    />
  );
};

const InteractiveTacticalBoardVideoPlayer: React.FC<{
  element: TacticalBoardSlideElement;
  project: TacticalProject | null;
  template: PitchTemplate;
  accent: string;
  bg: string;
  borderRadius: number;
  onOpenBoardImporter?: (elementId: string) => void;
}> = ({
  element,
  project,
  template,
  accent,
  bg,
  borderRadius,
  onOpenBoardImporter,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const staticBgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const scrubberFillRef = useRef<HTMLDivElement>(null);
  const stageDownPtRef = useRef<{ x: number; y: number } | null>(null);

  const bgImg = useLoadedBackgroundImage(project?.backgroundImage);

  const timeline = useMemo(
    () => buildBoardPlaybackTimeline(project, element.importMode, element.slideIndex ?? 0),
    [project, element.importMode, element.slideIndex]
  );

  const isSingleSlide = element.importMode === 'single-slide';
  const singleSlideHasAnimation = useMemo(() => {
    if (!project || !isSingleSlide) return false;
    return detectBoardSlideHasAnimations(project.slides, element.slideIndex ?? 0);
  }, [project, isSingleSlide, element.slideIndex]);

  const canPlayAsVideo =
    timeline.segments.length > 0 &&
    timeline.totalDurationMs > 0 &&
    (!isSingleSlide || singleSlideHasAnimation);

  const defaultAutoPlay = isSingleSlide ? singleSlideHasAnimation : true;

  const [playheadMs, setPlayheadMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(() =>
    Boolean(canPlayAsVideo && (element.autoPlay ?? defaultAutoPlay))
  );
  const [loopEnabled, setLoopEnabled] = useState(
    element.loop !== undefined ? element.loop : isSingleSlide ? singleSlideHasAnimation : true
  );
  const [playbackRate, setPlaybackRate] = useState<number>(1);

  const playheadRef = useRef(playheadMs);
  const isPlayingRef = useRef(isPlaying);
  const loopRef = useRef(loopEnabled);
  const rateRef = useRef(playbackRate);
  const lastFrameTsRef = useRef<number | null>(null);
  const lastHudSyncTsRef = useRef<number>(0);

  isPlayingRef.current = isPlaying;
  loopRef.current = loopEnabled;
  rateRef.current = playbackRate;

  // Sync property toggles when changed from PropertiesPanel
  useEffect(() => {
    if (element.loop !== undefined) {
      setLoopEnabled(element.loop);
    }
  }, [element.loop]);

  // Reset playhead cleanly if source project or import mode changes
  useEffect(() => {
    setPlayheadMs(0);
    playheadRef.current = 0;
    const shouldAuto = Boolean(
      canPlayAsVideo && (element.autoPlay ?? defaultAutoPlay)
    );
    setIsPlaying(shouldAuto);
  }, [
    element.boardProjectId,
    element.importMode,
    element.slideIndex,
    canPlayAsVideo,
    element.autoPlay,
    defaultAutoPlay,
  ]);

  const renderScale = 1.5;
  const pWidth = project?.pitchWidth || PITCH_WIDTH;
  const pHeight = project?.pitchHeight || PITCH_HEIGHT;
  const canvasWidth = Math.max(160, Math.round(pWidth * renderScale));
  const canvasHeight = Math.max(90, Math.round(pHeight * renderScale));

  const fallbackCoinSettings = project?.slides?.[0]?.coinSettings;

  // Draw frame for a given playhead timestamp in milliseconds
  const drawAtPlayhead = useCallback(
    (timeMs: number, forcePosterWhenPaused = false) => {
      const canvas = canvasRef.current;
      if (!canvas || !project || timeline.segments.length === 0) return;

      if (canvas.width !== canvasWidth) canvas.width = canvasWidth;
      if (canvas.height !== canvasHeight) canvas.height = canvasHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let activeSeg: BoardTimelineSegment = timeline.segments[timeline.segments.length - 1];
      for (const seg of timeline.segments) {
        if (timeMs >= seg.startTimeMs && timeMs <= seg.endTimeMs) {
          activeSeg = seg;
          break;
        }
      }

      // If paused cleanly at initial resting frame (t = 0), show completed frame cleanly
      // and if Slide 0 was left blank while a later slide has content, show the first populated frame
      let slideToRender = activeSeg.slide;
      let prevSlideToRender = activeSeg.previousSlide;
      let progress = 1;

      if (forcePosterWhenPaused && timeMs === 0) {
        if (!isSingleSlide && isBoardSlideEmpty(activeSeg.slide)) {
          const previewIdx = getPreferredPreviewSlideIndex(project);
          const previewSeg = timeline.segments[previewIdx];
          if (previewSeg) {
            slideToRender = previewSeg.slide;
            prevSlideToRender = previewSeg.previousSlide;
          }
        }
        progress = 1;
      } else if (
        activeSeg.transitionEndMs > activeSeg.startTimeMs &&
        timeMs < activeSeg.transitionEndMs
      ) {
        progress = Math.max(
          0,
          Math.min(
            1,
            (timeMs - activeSeg.startTimeMs) /
              (activeSeg.transitionEndMs - activeSeg.startTimeMs)
          )
        );
      }

      const coinSettings = resolveSlideCoinSettings(slideToRender, fallbackCoinSettings);

      ctx.fillStyle = '#080b12';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      try {
        drawBoardToCanvas(
          ctx,
          project,
          slideToRender,
          prevSlideToRender,
          progress,
          coinSettings,
          bgImg,
          template,
          canvasWidth,
          canvasHeight,
          renderScale,
          null,
          null,
          false,
          [],
          null,
          null,
          staticBgCanvasRef.current
        );
      } catch (err) {
        console.error('drawBoardToCanvas error in player:', err);
      }
    },
    [project, timeline, template, bgImg, canvasWidth, canvasHeight, fallbackCoinSettings, isSingleSlide]
  );

  const drawAtPlayheadRef = useRef(drawAtPlayhead);
  drawAtPlayheadRef.current = drawAtPlayhead;

  // Pre-render & cache static pitch background whenever dimensions, template, or backgroundImage change,
  // then immediately paint the current canvas frame so initial mount never appears blank.
  useEffect(() => {
    if (!project) {
      staticBgCanvasRef.current = null;
      return;
    }
    const offscreen = document.createElement('canvas');
    offscreen.width = canvasWidth;
    offscreen.height = canvasHeight;
    const sCtx = offscreen.getContext('2d');
    if (sCtx) {
      try {
        drawStaticBackgroundToCanvas(
          sCtx,
          project,
          bgImg,
          template,
          canvasWidth,
          canvasHeight,
          renderScale
        );
      } catch (err) {
        console.error('drawStaticBackgroundToCanvas error:', err);
      }
    }
    staticBgCanvasRef.current = offscreen;
    drawAtPlayheadRef.current(playheadRef.current, !isPlayingRef.current);
  }, [project, bgImg, template, canvasWidth, canvasHeight]);

  // Redraw immediately when paused and playhead / project changes
  useEffect(() => {
    if (!isPlaying) {
      drawAtPlayhead(playheadMs, true);
    }
  }, [drawAtPlayhead, playheadMs, isPlaying]);

  // Continuous 60fps canvas playback animation loop with throttled React HUD updates
  useEffect(() => {
    if (!isPlaying || !canPlayAsVideo) {
      lastFrameTsRef.current = null;
      return;
    }

    let rafId = 0;
    lastFrameTsRef.current = null;
    lastHudSyncTsRef.current = 0;
    drawAtPlayhead(playheadRef.current, false);

    const tick = (now: number) => {
      if (!isPlayingRef.current) return;
      if (lastFrameTsRef.current === null) {
        lastFrameTsRef.current = now;
      }
      const deltaMs = Math.min(100, Math.max(0, now - lastFrameTsRef.current)) * rateRef.current;
      lastFrameTsRef.current = now;

      let nextMs = playheadRef.current + deltaMs;
      if (nextMs >= timeline.totalDurationMs) {
        if (loopRef.current) {
          nextMs = timeline.totalDurationMs > 0 ? nextMs % timeline.totalDurationMs : 0;
        } else {
          nextMs = timeline.totalDurationMs;
          playheadRef.current = nextMs;
          if (scrubberFillRef.current && timeline.totalDurationMs > 0) {
            scrubberFillRef.current.style.width = '100%';
          }
          setPlayheadMs(nextMs);
          drawAtPlayhead(nextMs, false);
          setIsPlaying(false);
          return;
        }
      }

      playheadRef.current = nextMs;
      if (scrubberFillRef.current && timeline.totalDurationMs > 0) {
        scrubberFillRef.current.style.width = `${Math.min(100, (nextMs / timeline.totalDurationMs) * 100)}%`;
      }
      drawAtPlayhead(nextMs, false);

      if (now - lastHudSyncTsRef.current >= 80) {
        lastHudSyncTsRef.current = now;
        setPlayheadMs(nextMs);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, canPlayAsVideo, timeline.totalDurationMs, drawAtPlayhead]);

  const togglePlayPause = useCallback(() => {
    if (!canPlayAsVideo) return;
    setIsPlaying((prev) => {
      if (!prev && playheadRef.current >= timeline.totalDurationMs - 20) {
        playheadRef.current = 0;
        setPlayheadMs(0);
      }
      return !prev;
    });
  }, [canPlayAsVideo, timeline.totalDurationMs]);

  // Listen to global PresentationMode transport event (P key / "Play/Pause Reel" button)
  useEffect(() => {
    const handleTransport = (evt: Event) => {
      const detail = (evt as CustomEvent<{ action: 'play' | 'pause' | 'toggle' }>).detail;
      if (!detail || !canPlayAsVideo) return;
      if (detail.action === 'play') {
        if (playheadRef.current >= timeline.totalDurationMs - 20) {
          playheadRef.current = 0;
          setPlayheadMs(0);
        }
        setIsPlaying(true);
      } else if (detail.action === 'pause') {
        setIsPlaying(false);
      } else {
        togglePlayPause();
      }
    };

    window.addEventListener(SLIDE_PLAYLIST_TRANSPORT_EVENT, handleTransport);
    return () => window.removeEventListener(SLIDE_PLAYLIST_TRANSPORT_EVENT, handleTransport);
  }, [canPlayAsVideo, timeline.totalDurationMs, togglePlayPause]);

  // Compute current active segment for HUD and strip
  const activeSegment = useMemo(() => {
    if (timeline.segments.length === 0) return null;
    for (const seg of timeline.segments) {
      if (playheadMs >= seg.startTimeMs && playheadMs <= seg.endTimeMs) {
        return seg;
      }
    }
    return timeline.segments[timeline.segments.length - 1];
  }, [timeline.segments, playheadMs]);

  const jumpToSegment = (segmentIndex: number) => {
    const seg = timeline.segments[segmentIndex];
    if (!seg) return;
    const nextMs = seg.startTimeMs;
    playheadRef.current = nextMs;
    setPlayheadMs(nextMs);
    drawAtPlayhead(nextMs, !isPlayingRef.current);
  };

  const handleScrubClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!progressBarRef.current || timeline.totalDurationMs <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetMs = ratio * timeline.totalDurationMs;
    playheadRef.current = targetMs;
    setPlayheadMs(targetMs);
    drawAtPlayhead(targetMs, !isPlayingRef.current);
  };

  if (!project || timeline.segments.length === 0) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center p-10 text-center border-2 border-dashed border-white/20"
        style={{ backgroundColor: bg, borderRadius }}
      >
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
          style={{ backgroundColor: `${accent}20`, color: accent }}
        >
          <Clapperboard className="w-10 h-10" />
        </div>
        <h3 className="text-3xl font-bold text-white mb-2">
          {element.title || 'Tactical Board Player'}
        </h3>
        <p className="text-xl text-white/60 max-w-2xl mb-6 leading-relaxed">
          Import one animated slide as a looping tactical video or import all slides of a Tactical Board project as a non-editable video player.
        </p>
        {onOpenBoardImporter && (
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onOpenBoardImporter(element.id);
            }}
            className="px-7 py-3.5 rounded-xl font-bold text-lg text-black inline-flex items-center gap-2.5 shadow-lg cursor-pointer transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: accent }}
          >
            <Clapperboard className="w-6 h-6" />
            <span>Import from Tactical Board</span>
          </button>
        )}
      </div>
    );
  }

  const macroPct =
    timeline.totalDurationMs > 0
      ? Math.min(100, (playheadMs / timeline.totalDurationMs) * 100)
      : 100;

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden border border-white/15 shadow-2xl relative"
      style={{ backgroundColor: '#05070b', borderRadius }}
    >
      {/* Non-editable Read-Only Pitch Video Stage */}
      <div
        className="relative flex-1 min-h-0 bg-[#080b12] flex items-center justify-center overflow-hidden"
        onMouseDownCapture={(e) => {
          stageDownPtRef.current = { x: e.clientX, y: e.clientY };
        }}
        onClick={(e) => {
          const down = stageDownPtRef.current;
          stageDownPtRef.current = null;
          if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) {
            return;
          }
          if (canPlayAsVideo) {
            e.stopPropagation();
            togglePlayPause();
          }
        }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain block pointer-events-none"
        />

        {/* Top Read-Only Player HUD */}
        {element.showOverlayHud !== false && (
          <div className="absolute top-5 left-5 right-5 flex items-start justify-between gap-4 pointer-events-none">
            <div className="px-4 py-2.5 rounded-xl bg-black/75 border border-white/15 backdrop-blur-md flex items-center gap-3 max-w-[70%]">
              <span
                className="w-3.5 h-3.5 rounded-full shrink-0"
                style={{ backgroundColor: accent }}
              />
              <div className="min-w-0">
                <div className="text-lg font-bold text-white truncate">
                  {element.title || element.boardProjectName}
                </div>
                <div className="text-sm font-mono text-white/65 truncate flex items-center gap-2">
                  <span>{element.boardProjectName}</span>
                  <span>·</span>
                  <span>
                    {activeSegment?.slide.name || `Slide ${(activeSegment?.slideIdx ?? 0) + 1}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="px-3.5 py-2 rounded-xl bg-black/75 border border-white/15 backdrop-blur-md text-sm font-mono font-bold text-white flex items-center gap-2">
                {isSingleSlide ? (
                  singleSlideHasAnimation ? (
                    <>
                      <Sparkles className="w-4 h-4" style={{ color: accent }} />
                      <span>Looping Slide</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-white/60" />
                      <span>Static Frame</span>
                    </>
                  )
                ) : (
                  <>
                    <Layers className="w-4 h-4" style={{ color: accent }} />
                    <span>
                      Slide {String((activeSegment?.segmentIndex ?? 0) + 1).padStart(2, '0')} /{' '}
                      {String(timeline.segments.length).padStart(2, '0')}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Center Play Trigger when Paused (clickable independently of SlideCanvas drag) */}
        {canPlayAsVideo && !isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                togglePlayPause();
              }}
              className="w-24 h-24 rounded-full flex items-center justify-center text-black shadow-2xl pointer-events-auto cursor-pointer transition-transform hover:scale-105"
              style={{ backgroundColor: accent }}
              title={isSingleSlide ? 'Play Looping Slide Video' : 'Play All Slides'}
            >
              <Play className="w-11 h-11 fill-current ml-1.5" />
            </button>
          </div>
        )}
      </div>

      {/* Video Player Transport Bar */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 bg-[#11141d] border-t border-white/12 px-5 py-3.5 space-y-2.5"
      >
        {canPlayAsVideo ? (
          <>
            {/* Scrubber Timeline */}
            <div
              ref={progressBarRef}
              onClick={handleScrubClick}
              className="relative h-4 rounded-full bg-white/10 overflow-hidden cursor-pointer flex items-center"
              title="Click to seek timeline"
            >
              {timeline.segments.map((seg) => {
                const segDur = seg.endTimeMs - seg.startTimeMs;
                const widthPct =
                  timeline.totalDurationMs > 0
                    ? (segDur / timeline.totalDurationMs) * 100
                    : 0;
                const isCurrent = activeSegment?.segmentIndex === seg.segmentIndex;
                return (
                  <div
                    key={seg.slide.id + '-' + seg.segmentIndex}
                    className="h-full border-r border-black/60 last:border-r-0 transition-opacity"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: seg.hasAnimation ? accent : '#94a3b8',
                      opacity: isCurrent ? 0.38 : 0.16,
                    }}
                  />
                );
              })}
              <div
                ref={scrubberFillRef}
                className="absolute inset-y-0 left-0 pointer-events-none"
                style={{ width: `${macroPct}%`, backgroundColor: accent }}
              />
            </div>

            {/* Transport Buttons */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                {!isSingleSlide && timeline.segments.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      jumpToSegment(Math.max(0, (activeSegment?.segmentIndex ?? 0) - 1))
                    }
                    disabled={(activeSegment?.segmentIndex ?? 0) === 0}
                    className="p-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] disabled:opacity-30 text-white cursor-pointer"
                    title="Previous Board Slide"
                  >
                    <SkipBack className="w-5 h-5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={togglePlayPause}
                  className="px-4 py-2 rounded-xl font-bold text-base text-black inline-flex items-center gap-2 cursor-pointer"
                  style={{ backgroundColor: accent }}
                  title={isSingleSlide ? 'Play / Pause Looping Slide' : 'Play / Pause All Slides'}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current" />
                  )}
                  <span>
                    {isPlaying ? 'Pause' : isSingleSlide ? 'Play Loop' : 'Play All'}
                  </span>
                </button>

                {!isSingleSlide && timeline.segments.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      jumpToSegment(
                        Math.min(
                          timeline.segments.length - 1,
                          (activeSegment?.segmentIndex ?? 0) + 1
                        )
                      )
                    }
                    disabled={
                      (activeSegment?.segmentIndex ?? 0) >= timeline.segments.length - 1
                    }
                    className="p-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] disabled:opacity-30 text-white cursor-pointer"
                    title="Next Board Slide"
                  >
                    <SkipForward className="w-5 h-5" />
                  </button>
                )}

                <span className="text-base font-mono font-bold tabular-nums text-white/90 ml-2">
                  {formatBoardDurationMs(playheadMs)} /{' '}
                  {formatBoardDurationMs(timeline.totalDurationMs)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const speeds = [0.5, 1, 1.5, 2];
                    const next = speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length];
                    setPlaybackRate(next);
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
                  title="Loop Video Playback"
                >
                  <Repeat className="w-4 h-4" />
                </button>

                {onOpenBoardImporter && (
                  <button
                    type="button"
                    onClick={() => onOpenBoardImporter(element.id)}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] border border-white/15 text-sm font-semibold text-white/90 inline-flex items-center gap-1.5 cursor-pointer"
                    title="Change Tactical Board Project or Slide"
                  >
                    <Clapperboard className="w-4 h-4" style={{ color: accent }} />
                    <span>Board</span>
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-sm text-white/75">
              <Lock className="w-4 h-4 text-white/50" />
              <span>
                Static Tactical Frame · Slide {(element.slideIndex ?? 0) + 1} has no motion animations
              </span>
            </div>
            {onOpenBoardImporter && (
              <button
                type="button"
                onClick={() => onOpenBoardImporter(element.id)}
                className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] border border-white/15 text-sm font-semibold text-white/90 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Clapperboard className="w-4 h-4" style={{ color: accent }} />
                <span>Change Board</span>
              </button>
            )}
          </div>
        )}

        {/* Read-only Slide Navigation Strip (All Slides Video Player mode) */}
        {!isSingleSlide &&
          element.showSlideStrip !== false &&
          timeline.segments.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-0.5 scrollbar-none">
              {timeline.segments.map((seg) => {
                const isCurrent = activeSegment?.segmentIndex === seg.segmentIndex;
                const segDurationSec = Math.round(
                  (seg.endTimeMs - seg.startTimeMs) / 1000
                );
                return (
                  <button
                    key={seg.slide.id + '-' + seg.segmentIndex}
                    type="button"
                    onClick={() => jumpToSegment(seg.segmentIndex)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2 ${
                      isCurrent
                        ? 'bg-white/[0.15] border-white/40 text-white'
                        : 'bg-white/[0.04] hover:bg-white/[0.09] border-white/10 text-white/70'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: seg.hasAnimation ? accent : '#94a3b8',
                      }}
                    />
                    <span className="text-xs font-semibold truncate max-w-[160px]">
                      {seg.segmentIndex + 1}. {seg.slide.name || `Slide ${seg.segmentIndex + 1}`}
                    </span>
                    <span className="text-[11px] font-mono text-white/45 shrink-0">
                      {segDurationSec}s
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
