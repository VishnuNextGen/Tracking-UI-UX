import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Maximize,
  Minimize,
  FileText,
  Play,
} from 'lucide-react';
import type { PresentationProject } from '../types/presentation';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants/themesAndLayouts';
import { SlideRenderer } from '../renderer/SlideRenderer';
import { dispatchSlidePlaylistTransport } from '../renderer/elements/VideoPlaylistElementRenderer';

interface PresentationModeProps {
  presentation: PresentationProject;
  initialSlideIndex?: number;
  onExit: () => void;
}

export const PresentationMode: React.FC<PresentationModeProps> = ({
  presentation,
  initialSlideIndex = 0,
  onExit,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(
    Math.max(0, Math.min(presentation.slides.length - 1, initialSlideIndex))
  );
  const [stageScale, setStageScale] = useState(0.5);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const slides = presentation.slides;
  const activeSlide = slides[currentIndex] || slides[0];
  const hasVideoPlaylists = Boolean(
    activeSlide?.elements?.some(
      (el) => el.type === 'video-playlist' || el.type === 'tactical-board'
    )
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateScale = () => {
      const rect = el.getBoundingClientRect();
      const s = Math.min(rect.width / CANVAS_WIDTH, rect.height / CANVAS_HEIGHT);
      setStageScale(Math.max(0.1, s));
    };
    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (el && el.requestFullscreen) {
      el.requestFullscreen().catch(() => {
        // Fullscreen may be restricted in iframe; full-viewport overlay still works cleanly
      });
    }
    const onFsChange = () => {
      setIsBrowserFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  const goNext = () => {
    setCurrentIndex((i) => Math.min(slides.length - 1, i + 1));
  };

  const goPrev = () => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (containerRef.current.requestFullscreen) {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        setCurrentIndex((i) => Math.min(slides.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrentIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        dispatchSlidePlaylistTransport('toggle');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onExit, slides.length]);

  const getMotionProps = () => {
    switch (activeSlide?.transition) {
      case 'slide':
        return {
          initial: { opacity: 0, x: 48 },
          animate: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: -48 },
          transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const },
        };
      case 'zoom':
        return {
          initial: { opacity: 0, scale: 0.94 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 1.04 },
          transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const },
        };
      case 'none':
        return {
          initial: { opacity: 1 },
          animate: { opacity: 1 },
          exit: { opacity: 1 },
          transition: { duration: 0 },
        };
      case 'fade':
      default:
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: 0.24 },
        };
    }
  };

  if (!activeSlide) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[200] bg-black flex items-center justify-center overflow-hidden select-none group"
      onClick={goNext}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSlide.id}
          {...getMotionProps()}
          className="flex items-center justify-center shadow-2xl"
        >
          <SlideRenderer slide={activeSlide} scale={stageScale} interactive={true} />
        </motion.div>
      </AnimatePresence>

      {/* Optional Speaker Notes Overlay */}
      {showNotes && activeSlide.speakerNotes && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 max-w-2xl w-[90%] p-4 rounded-2xl bg-[#101219]/95 border border-white/15 text-sm text-white/90 shadow-2xl backdrop-blur-md"
        >
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#c6ff1f] mb-1">
            Speaker Notes
          </div>
          <p className="leading-relaxed whitespace-pre-wrap">{activeSlide.speakerNotes}</p>
        </div>
      )}

      {/* Presenter Control Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#12141b]/90 border border-white/15 text-white shadow-2xl backdrop-blur-md opacity-90 sm:opacity-35 sm:group-hover:opacity-100 transition-opacity"
      >
        <button
          type="button"
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 cursor-pointer"
          title="Previous Slide (Left Arrow)"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="px-2 text-xs font-mono font-bold tabular-nums text-white/90">
          {String(currentIndex + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
        </span>

        <button
          type="button"
          onClick={goNext}
          disabled={currentIndex === slides.length - 1}
          className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 cursor-pointer"
          title="Next Slide (Right Arrow / Space)"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-white/15 mx-1" />

        {hasVideoPlaylists && (
          <button
            type="button"
            onClick={() => dispatchSlidePlaylistTransport('toggle')}
            className="px-2.5 py-1 rounded-lg bg-[#c6ff1f]/15 hover:bg-[#c6ff1f]/25 border border-[#c6ff1f]/40 text-[#c6ff1f] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            title="Play / Pause Playlist Videos Together (P)"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Play/Pause Reel</span>
          </button>
        )}

        {activeSlide.speakerNotes && (
          <button
            type="button"
            onClick={() => setShowNotes((v) => !v)}
            className={`p-1.5 rounded-lg cursor-pointer ${
              showNotes ? 'bg-[#c6ff1f]/20 text-[#c6ff1f]' : 'hover:bg-white/10 text-white/75'
            }`}
            title="Toggle Speaker Notes"
          >
            <FileText className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={toggleFullscreen}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/75 hover:text-white cursor-pointer"
          title="Toggle Fullscreen (F)"
        >
          {isBrowserFullscreen ? (
            <Minimize className="w-4 h-4" />
          ) : (
            <Maximize className="w-4 h-4" />
          )}
        </button>

        <button
          type="button"
          onClick={onExit}
          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-red-500/25 text-white hover:text-red-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
          title="Exit Presentation (Esc)"
        >
          <X className="w-3.5 h-3.5" />
          <span>Exit</span>
        </button>
      </div>
    </div>
  );
};
