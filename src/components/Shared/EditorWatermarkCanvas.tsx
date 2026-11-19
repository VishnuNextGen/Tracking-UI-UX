import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { WatermarkTier } from '../../types/user';
import { getCurrentWatermarkTier } from '../../utils/userPlanStore';
import {
  type CreatorWatermarkConfig,
  getCreatorWatermarkConfig,
  hasActiveCreatorWatermark,
} from '../../utils/creatorWatermarkStore';
import { renderWatermarkOverlay } from '../../utils/watermarkRenderer';
import { calculateFitLayout } from '../Workspace/VideoExport/exportRenderer';

interface EditorWatermarkCanvasProps {
  /** For Workspace Video Editor: container element hosting the letterboxed/pillarboxed video */
  containerRef?: React.RefObject<HTMLElement | null>;
  /** For Workspace Video Editor: active <video> element to match intrinsic aspect ratio 1:1 */
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  /** For Tactical Board Editor: fixed logical frame size matching export dimensions (P_WIDTH x P_HEIGHT) */
  fixedLogicalSize?: { width: number; height: number };
  /** Optional CSS transform scale applied to parent container (e.g. TacticalBoard boardScale) for HiDPI sharpness */
  displayScale?: number;
  /** Hide watermark when no video is loaded or in non-video views */
  visible?: boolean;
  /** Optional key (e.g. videoUrl) to re-bind listeners when video source changes */
  mediaKey?: string;
  /** Tailwind z-index utility class */
  zIndexClass?: string;
}

/**
 * Pure non-interactive (pointer-events-none) live canvas watermark overlay.
 * Renders Tacstem's tier watermark + the user's left-bottom Creator Watermark at exact 1:1 export scale,
 * with zero interactive DOM elements over the video/board canvas so telestration UX is 100% untouched.
 */
export const EditorWatermarkCanvas: React.FC<EditorWatermarkCanvasProps> = ({
  containerRef,
  videoRef,
  fixedLogicalSize,
  displayScale = 1,
  visible = true,
  mediaKey,
  zIndexClass = 'z-[25]',
}) => {
  const watermarkCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tier, setTier] = useState<WatermarkTier>(() => getCurrentWatermarkTier());
  const [creatorConfig, setCreatorConfig] = useState<CreatorWatermarkConfig>(() =>
    getCreatorWatermarkConfig()
  );

  useEffect(() => {
    const syncAll = () => {
      setTier(getCurrentWatermarkTier());
      setCreatorConfig(getCreatorWatermarkConfig());
    };
    window.addEventListener('tacstem_user_plan_updated', syncAll);
    window.addEventListener('tacstem_creator_watermark_updated', syncAll);
    window.addEventListener('storage', syncAll);
    return () => {
      window.removeEventListener('tacstem_user_plan_updated', syncAll);
      window.removeEventListener('tacstem_creator_watermark_updated', syncAll);
      window.removeEventListener('storage', syncAll);
    };
  }, []);

  const hasAnyWatermark = tier !== 'none' || hasActiveCreatorWatermark(creatorConfig);

  const drawOverlay = useCallback(
    (nowMs: number) => {
      const canvas = watermarkCanvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (!visible || !hasAnyWatermark) {
        if (canvas.width > 0 && canvas.height > 0) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        return;
      }

      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

      // Mode A: Fixed logical frame (Tactical Board Editor -> P_WIDTH x P_HEIGHT)
      if (fixedLogicalSize && fixedLogicalSize.width > 0 && fixedLogicalSize.height > 0) {
        const effectiveScale = Math.max(0.5, displayScale * dpr);
        const physW = Math.max(2, Math.round(fixedLogicalSize.width * effectiveScale));
        const physH = Math.max(2, Math.round(fixedLogicalSize.height * effectiveScale));

        if (canvas.width !== physW || canvas.height !== physH) {
          canvas.width = physW;
          canvas.height = physH;
        } else {
          ctx.clearRect(0, 0, physW, physH);
        }

        renderWatermarkOverlay(ctx, {
          tier,
          targetWidth: physW,
          targetHeight: physH,
          viewport: { x: 0, y: 0, w: physW, h: physH },
          nowMs,
          creatorWatermark: creatorConfig,
        });
        return;
      }

      // Mode B: Video-fitted container (Workspace Video Editor & Fullscreen Presentation Mode)
      const container = containerRef?.current;
      const video = videoRef?.current;
      if (!container || !video) {
        if (canvas.width > 0 && canvas.height > 0) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        return;
      }

      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const physW = Math.max(2, Math.round(rect.width * dpr));
      const physH = Math.max(2, Math.round(rect.height * dpr));

      if (canvas.width !== physW || canvas.height !== physH) {
        canvas.width = physW;
        canvas.height = physH;
      } else {
        ctx.clearRect(0, 0, physW, physH);
      }

      if (!video.videoWidth || !video.videoHeight) {
        return;
      }

      const physLayout = calculateFitLayout(physW, physH, video.videoWidth, video.videoHeight);
      if (physLayout.w <= 0 || physLayout.h <= 0) return;

      renderWatermarkOverlay(ctx, {
        tier,
        targetWidth: physW,
        targetHeight: physH,
        viewport: {
          x: physLayout.x,
          y: physLayout.y,
          w: physLayout.w,
          h: physLayout.h,
        },
        nowMs,
        creatorWatermark: creatorConfig,
      });
    },
    [
      visible,
      hasAnyWatermark,
      tier,
      creatorConfig,
      fixedLogicalSize,
      displayScale,
      containerRef,
      videoRef,
    ]
  );

  useEffect(() => {
    if (!visible || !hasAnyWatermark) return;

    drawOverlay(performance.now());

    const handleTrigger = () => {
      drawOverlay(performance.now());
    };

    let resizeObserver: ResizeObserver | null = null;
    const container = containerRef?.current;
    if (container && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(handleTrigger);
      resizeObserver.observe(container);
    }

    const video = videoRef?.current;
    if (video) {
      video.addEventListener('loadedmetadata', handleTrigger);
      video.addEventListener('loadeddata', handleTrigger);
      video.addEventListener('canplay', handleTrigger);
      video.addEventListener('resize', handleTrigger);
      video.addEventListener('emptied', handleTrigger);
    }

    window.addEventListener('resize', handleTrigger);
    window.addEventListener('tacstem_creator_watermark_image_ready', handleTrigger);

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      if (video) {
        video.removeEventListener('loadedmetadata', handleTrigger);
        video.removeEventListener('loadeddata', handleTrigger);
        video.removeEventListener('canplay', handleTrigger);
        video.removeEventListener('resize', handleTrigger);
        video.removeEventListener('emptied', handleTrigger);
      }
      window.removeEventListener('resize', handleTrigger);
      window.removeEventListener('tacstem_creator_watermark_image_ready', handleTrigger);
    };
  }, [
    visible,
    hasAnyWatermark,
    tier,
    drawOverlay,
    containerRef,
    videoRef,
    fixedLogicalSize?.width,
    fixedLogicalSize?.height,
    displayScale,
    mediaKey,
  ]);

  if (!visible || !hasAnyWatermark) {
    return null;
  }

  return (
    <canvas
      ref={watermarkCanvasRef}
      aria-hidden="true"
      className={`absolute inset-0 w-full h-full pointer-events-none select-none ${zIndexClass}`}
    />
  );
};
