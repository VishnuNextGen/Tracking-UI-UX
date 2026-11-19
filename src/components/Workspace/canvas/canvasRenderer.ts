import type React from 'react';
import type {
  ColorPreset,
  FreezeFrame,
  MaskLayerCache,
  MaskSettings,
  PlayerTagSettings,
  Point,
  Shape,
  ToolType,
} from '../../../types';
import { getDistance, getVideoLayout } from '../../../utils/math';
import {
  draw3DRing,
  drawConnectedRingsFill,
  drawCurvedArrow,
  drawCurvedRun,
  drawFreehandArrow,
  drawLens,
  drawNameTag,
  drawProArrow,
  drawSpotlight,
  drawTangentLine,
  drawText,
} from '../../../utils/drawing';
import { renderMaskForeground, renderMaskOverlay } from '../Masking';
import {
  drawPolygon,
  drawPolygonPreview,
  drawRadar,
  drawRadarPreview,
  type PolygonSettings,
  type RadarParticle,
  updateAndDrawRadarParticles,
} from '../Polygon';
import { drawScanner, drawScannerPreview, type ScannerSettings } from '../Scanner';
import { drawPlayerMoveGhost, drawPlayerMoveShape } from '../PlayerMove';
import type {
  ArrowSettings,
  LensSettings,
  RingSettings,
  SpotlightSettings,
  TextSettings,
} from '../Workspace.types';

export function drawShapeOnCanvas(params: {
  ctx: CanvasRenderingContext2D;
  shape: Shape;
  scale: number;
  renderMode?: 'full' | 'shadow' | 'body';
  ffAlpha?: number;
  unifiedProgress?: number;
  ringSettings: RingSettings;
  imageCache: Map<string, HTMLImageElement>;
  selectedShapeId: string | null;
}): void {
  const {
    ctx,
    shape,
    scale,
    renderMode = 'full',
    ffAlpha = 1,
    unifiedProgress,
    ringSettings,
    imageCache,
    selectedShapeId,
  } = params;

  ctx.save();
  if (
    shape.timestamp > 0 &&
    !shape.freezeFrameId &&
    shape.trackStartTime === undefined &&
    shape.type !== 'curved-arrow' &&
    shape.type !== 'player-move' &&
    shape.type !== 'spotlight' &&
    shape.type !== 'lens' &&
    shape.type !== 'arrow'
  ) {
    const age = Date.now() - shape.timestamp;
    const fadeDuration = 300;
    if (age < fadeDuration) ctx.globalAlpha = Math.min(1, age / fadeDuration) * ffAlpha;
    else ctx.globalAlpha = ffAlpha;
  } else {
    ctx.globalAlpha = ffAlpha;
  }
  ctx.strokeStyle = shape.color;
  ctx.lineWidth = shape.strokeWidth / scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.fillStyle = shape.color;
  const { points, type } = shape;
  if (points.length < 1) {
    ctx.restore();
    return;
  }
  const p1 = points[0];
  const p2 = points[points.length - 1];

  ctx.beginPath();

  ctx.save();

  switch (type) {
    case 'pen': {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;
      if (shape.isDashed) {
        ctx.setLineDash([(shape.strokeWidth / scale) * 2, (shape.strokeWidth / scale) * 1.5]);
      }
      const penProg = unifiedProgress !== undefined ? Math.max(0, Math.min(1, unifiedProgress)) : 1;
      if (penProg <= 0.001) {
        ctx.restore();
        break;
      }
      if (penProg < 0.2) {
        ctx.globalAlpha = (ctx.globalAlpha || 1) * (penProg / 0.2);
      }
      if (points.length < 2) {
        ctx.beginPath();
        ctx.arc(points[0].x, points[0].y, shape.strokeWidth / scale / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        let ptsToDraw = points;
        let activeTip = points[points.length - 1];
        if (penProg < 1) {
          let totalLen = 0;
          const dists: number[] = [];
          for (let i = 1; i < points.length; i++) {
            const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
            dists.push(d);
            totalLen += d;
          }
          const targetLen = totalLen * penProg;
          let accum = 0;
          const trimmed: Point[] = [points[0]];
          activeTip = points[0];
          for (let i = 0; i < dists.length; i++) {
            const d = dists[i];
            if (accum + d <= targetLen) {
              trimmed.push(points[i + 1]);
              accum += d;
              activeTip = points[i + 1];
            } else {
              const rem = targetLen - accum;
              const frac = d > 0 ? rem / d : 0;
              activeTip = {
                x: points[i].x + (points[i + 1].x - points[i].x) * frac,
                y: points[i].y + (points[i + 1].y - points[i].y) * frac,
              };
              trimmed.push(activeTip);
              break;
            }
          }
          ptsToDraw = trimmed;
        }

        ctx.beginPath();
        ctx.moveTo(ptsToDraw[0].x, ptsToDraw[0].y);
        for (let i = 1; i < ptsToDraw.length - 2; i++) {
          const xc = (ptsToDraw[i].x + ptsToDraw[i + 1].x) / 2;
          const yc = (ptsToDraw[i].y + ptsToDraw[i + 1].y) / 2;
          ctx.quadraticCurveTo(ptsToDraw[i].x, ptsToDraw[i].y, xc, yc);
        }
        if (ptsToDraw.length > 2) {
          ctx.quadraticCurveTo(
            ptsToDraw[ptsToDraw.length - 2].x,
            ptsToDraw[ptsToDraw.length - 2].y,
            ptsToDraw[ptsToDraw.length - 1].x,
            ptsToDraw[ptsToDraw.length - 1].y
          );
        } else if (ptsToDraw.length === 2) {
          ctx.lineTo(ptsToDraw[1].x, ptsToDraw[1].y);
        }
        ctx.stroke();

        // Add inner bright stroke
        if (shape.strokeWidth > 3) {
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.lineWidth = (shape.strokeWidth / scale) * 0.3;
          ctx.stroke();
        }

        // Active glowing beacon at drawing tip while animating
        if (penProg < 0.98 && penProg > 0.02) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(activeTip.x, activeTip.y, Math.max(3, (shape.strokeWidth / scale) * 1.1), 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = shape.color;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.restore();
      break;
    }
    case 'line': {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;
      if (shape.isDashed) {
        ctx.setLineDash([(shape.strokeWidth / scale) * 2, (shape.strokeWidth / scale) * 1.5]);
      }
      const lineProg = unifiedProgress !== undefined ? Math.max(0, Math.min(1, unifiedProgress)) : 1;
      if (lineProg <= 0.001) {
        ctx.restore();
        break;
      }
      if (lineProg < 0.2) {
        ctx.globalAlpha = (ctx.globalAlpha || 1) * (lineProg / 0.2);
      }
      const endX = p1.x + (p2.x - p1.x) * lineProg;
      const endY = p1.y + (p2.y - p1.y) * lineProg;

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      if (shape.strokeWidth > 3) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = (shape.strokeWidth / scale) * 0.3;
        ctx.stroke();
      }

      // Active glowing beacon at drawing tip while animating
      if (lineProg < 0.98 && lineProg > 0.02) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(endX, endY, Math.max(3, (shape.strokeWidth / scale) * 1.1), 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = shape.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      break;
    }
    case 'arrow':
      if (shape.isFreehand) {
        drawFreehandArrow(
          ctx,
          points,
          shape.color,
          shape.strokeWidth / scale,
          shape.isDashed || false,
          shape.timestamp,
          false,
          unifiedProgress
        );
      } else if (shape.isCurved) {
        drawCurvedRun(
          ctx,
          points,
          shape.color,
          shape.strokeWidth / scale,
          shape.isDashed || false,
          shape.timestamp,
          false,
          unifiedProgress
        );
      } else {
        drawProArrow(
          ctx,
          p1,
          p2,
          shape.color,
          shape.strokeWidth / scale,
          shape.isDashed || false,
          shape.timestamp,
          false,
          unifiedProgress
        );
      }
      break;
    case 'curved-arrow':
      drawCurvedArrow(
        ctx,
        points,
        shape.color,
        shape.strokeWidth / scale,
        shape.isDashed || false,
        shape.timestamp,
        renderMode,
        unifiedProgress
      );
      break;
    case 'curved-run-arrow':
      drawCurvedRun(
        ctx,
        points,
        shape.color,
        shape.strokeWidth / scale,
        shape.isDashed || false,
        shape.timestamp,
        false,
        unifiedProgress
      );
      break;
    case 'circle': {
      const radius =
        (shape.ringConfig as any)?.size || (shape.points.length >= 2 ? getDistance(p1, p2) : 40);
      draw3DRing(
        ctx,
        p1.x,
        p1.y,
        radius,
        shape.color,
        shape.ringConfig?.tilt ?? 65,
        shape.strokeWidth / scale,
        shape.timestamp,
        false,
        shape.ringConfig,
        unifiedProgress
      );
      break;
    }
    case 'polygon':
      if (shape.polygonConfig?.mode === 'radar' || shape.radarConfig) {
        drawRadar(ctx, shape, scale, renderMode, ffAlpha, unifiedProgress);
      } else {
        drawPolygon(ctx, shape, scale, renderMode, ffAlpha, unifiedProgress);
      }
      break;
    case 'radar':
      drawRadar(ctx, shape, scale, renderMode, ffAlpha, unifiedProgress);
      break;
    case 'connected-circle': {
      const p = unifiedProgress !== undefined ? Math.max(0, Math.min(1, unifiedProgress)) : 1;
      const ringProg = unifiedProgress !== undefined ? Math.max(0, Math.min(1, p / 0.5)) : 1;
      const connProg = unifiedProgress !== undefined ? Math.max(0, Math.min(1, (p - 0.4) / 0.6)) : 1;
      const fillProg = unifiedProgress !== undefined ? Math.max(0, Math.min(1, (connProg - 0.2) / 0.8)) : 1;

      if (shape.isClosed && shape.isFilled !== false && points.length > 2 && fillProg > 0) {
        drawConnectedRingsFill(
          ctx,
          points,
          shape.color,
          shape.timestamp,
          shape.ringConfig?.tilt ?? 65,
          shape.ringConfig,
          fillProg
        );
      }
      if (points.length > 1 && connProg > 0) {
        for (let i = 0; i < points.length - 1; i++) {
          const c1 = points[i];
          const c2 = points[i + 1];
          drawTangentLine(
            ctx,
            c1,
            c2,
            c1.r || ringSettings.size,
            c2.r || ringSettings.size,
            shape.color,
            shape.strokeWidth / scale,
            connProg,
            0,
            false,
            shape.ringConfig?.tilt ?? 65,
            shape.ringConfig
          );
        }
        if (shape.isClosed) {
          const last = points[points.length - 1];
          const first = points[0];
          drawTangentLine(
            ctx,
            last,
            first,
            last.r || ringSettings.size,
            first.r || ringSettings.size,
            shape.color,
            shape.strokeWidth / scale,
            connProg,
            0,
            false,
            shape.ringConfig?.tilt ?? 65,
            shape.ringConfig
          );
        }
      }
      points.forEach((pt) => {
        draw3DRing(
          ctx,
          pt.x,
          pt.y,
          pt.r || ringSettings.size,
          shape.color,
          shape.ringConfig?.tilt ?? 65,
          shape.strokeWidth / scale,
          pt.timestamp || shape.timestamp,
          false,
          shape.ringConfig,
          ringProg
        );
      });
      break;
    }
    case 'player-move':
      drawPlayerMoveShape(ctx, shape, scale, ffAlpha, unifiedProgress, imageCache);
      break;

    case 'spotlight':
      if (shape.spotlightConfig) {
        drawSpotlight(
          ctx,
          points[0].x,
          points[0].y,
          shape.spotlightConfig.size,
          shape.spotlightConfig.intensity,
          shape.spotlightConfig.rotation,
          shape.spotlightConfig.particles,
          shape.timestamp,
          false,
          unifiedProgress
        );
      }
      break;

    case 'name-tag':
      if (shape.text || shape.playerNumber) {
        drawNameTag(
          ctx,
          points[0],
          shape.text || '',
          shape.color,
          scale,
          shape.timestamp,
          shape.strokeWidth,
          false,
          unifiedProgress,
          shape.playerNumber || shape.nameTagConfig?.playerNumber,
          {
            uppercase: shape.nameTagConfig?.uppercase !== false,
            showNumber: shape.nameTagConfig?.showNumber !== false,
          }
        );
      }
      break;
    case 'text':
      if (shape.text && shape.textConfig) {
        drawText(
          ctx,
          points[0],
          shape.text,
          shape.color,
          scale,
          shape.timestamp,
          shape.textConfig,
          false,
          unifiedProgress
        );
      }
      break;
    case 'scanner':
      drawScanner(ctx, shape, scale, renderMode, ffAlpha, unifiedProgress, shape.id === selectedShapeId);
      break;
  }
  ctx.restore();
  ctx.restore();
}

export function drawActiveChainOnCanvas(params: {
  ctx: CanvasRenderingContext2D;
  tool: ToolType;
  activePts: Point[];
  ringSettings: RingSettings;
  currentColor: string;
}): void {
  const { ctx, tool, activePts, ringSettings, currentColor } = params;
  if (tool !== 'connected-circle' || activePts.length === 0) return;
  const now = Date.now();
  if (ringSettings.isFilled !== false && activePts.length > 2) {
    drawConnectedRingsFill(ctx, activePts, currentColor, now, 65, ringSettings);
  }
  if (activePts.length > 1) {
    for (let i = 0; i < activePts.length - 1; i++) {
      const c1 = activePts[i];
      const c2 = activePts[i + 1];
      drawTangentLine(
        ctx,
        c1,
        c2,
        c1.r || ringSettings.size,
        c2.r || ringSettings.size,
        currentColor,
        0,
        1,
        0,
        false,
        65,
        ringSettings
      );
    }
  }
  activePts.forEach((p) => {
    draw3DRing(
      ctx,
      p.x,
      p.y,
      p.r || ringSettings.size,
      currentColor,
      65,
      0,
      p.timestamp || now,
      false,
      ringSettings
    );
  });
}

function getShapeStepBadgeAnchor(shape: Shape): Point | null {
  if (!shape.points || shape.points.length === 0) return null;
  if (shape.type === 'polygon' && shape.points.length >= 3) {
    let sumX = 0;
    let sumY = 0;
    for (let i = 0; i < shape.points.length; i++) {
      sumX += shape.points[i].x;
      sumY += shape.points[i].y;
    }
    return { x: sumX / shape.points.length, y: sumY / shape.points.length };
  }
  return shape.points[0] || null;
}

function drawShapeStepBadge(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  scale: number,
  isSelected: boolean
): void {
  if (typeof shape.step !== 'number' || isNaN(shape.step)) return;
  const anchor = getShapeStepBadgeAnchor(shape);
  if (!anchor) return;

  const stepNum = Math.max(0, Math.floor(shape.step));
  const label = `S${stepNum}`;
  const isDelayedStep = stepNum > 0;

  ctx.save();
  const fontSize = 9 / scale;
  ctx.font = `700 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  const textWidth = ctx.measureText(label).width;

  const dotRadius = 2 / scale;
  const gap = 3.5 / scale;
  const padX = 4.5 / scale;
  const pillH = 14.5 / scale;
  const pillW = padX * 2 + dotRadius * 2 + gap + textWidth;

  const offsetX = shape.type === 'polygon' ? -pillW / 2 : 8 / scale;
  const offsetY =
    shape.type === 'name-tag' || shape.type === 'text'
      ? -24 / scale
      : shape.type === 'polygon'
        ? -pillH / 2
        : -18 / scale;

  const pillX = anchor.x + offsetX;
  const pillY = anchor.y + offsetY;
  const radius = 3.5 / scale;

  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 4 / scale;
  ctx.shadowOffsetY = 1 / scale;

  ctx.fillStyle = isSelected ? 'rgba(10, 12, 16, 0.94)' : 'rgba(10, 12, 16, 0.82)';
  ctx.strokeStyle = isSelected
    ? '#c6ff1f'
    : isDelayedStep
      ? 'rgba(198, 255, 31, 0.5)'
      : 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = (isSelected ? 1.35 : 1) / scale;

  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(pillX, pillY, pillW, pillH, radius);
  } else {
    ctx.rect(pillX, pillY, pillW, pillH);
  }
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Shape color indicator dot
  const dotCx = pillX + padX + dotRadius;
  const midY = pillY + pillH / 2;
  ctx.beginPath();
  ctx.fillStyle = shape.color || '#c6ff1f';
  ctx.arc(dotCx, midY, dotRadius, 0, Math.PI * 2);
  ctx.fill();

  // Step label (S0, S1, S2...)
  ctx.fillStyle = isSelected || isDelayedStep ? '#c6ff1f' : '#e5e7eb';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(label, dotCx + dotRadius + gap, midY + 0.5 / scale);

  ctx.restore();
}

export function renderWorkspaceCanvases(params: {
  canvas: HTMLCanvasElement | null;
  ghostCanvas: HTMLCanvasElement | null;
  video: HTMLVideoElement | null;
  activePts: Point[];
  mousePos: Point | null;
  isPlaying: boolean;
  isScrubbing: boolean;
  isScrubbingRefCurrent: boolean;
  isDrawing: boolean;
  isScreenRecording: boolean;
  maskSettings: MaskSettings;
  maskCache: MaskLayerCache;
  shapes: Shape[];
  freezeFrames: FreezeFrame[];
  activeFreezeFrame: FreezeFrame | undefined;
  activeFreezeFrameId: string | null;
  editingAnimationFFId: string | null;
  isAnimationPreviewPlaying: boolean;
  isFreezeFramePlaying: boolean;
  animationPreviewTime: number;
  countdownValue: number;
  selectedShapeId: string | null;
  freezeFrameActiveSteps: Record<string, number | null>;
  currentStepForActiveFF: number | null;
  tool: ToolType;
  currentColor: string;
  toolSize: number;
  arrowSettings: ArrowSettings;
  ringSettings: RingSettings;
  spotlightSettings: SpotlightSettings;
  polygonSettings: PolygonSettings;
  scannerSettings: ScannerSettings;
  lensSettings: LensSettings;
  nameTagSettings: PlayerTagSettings;
  textSettings: TextSettings;
  colors: ColorPreset[];
  playerMoveState: any;
  playerMoveStartPoint: Point | null;
  capturedSprite: any;
  playerMoveSettings: any;
  radarParticlesRef: React.MutableRefObject<RadarParticle[]>;
  imageCache: Map<string, HTMLImageElement>;
}): void {
  const {
    canvas,
    ghostCanvas,
    video,
    activePts,
    mousePos,
    isPlaying,
    isScrubbing,
    isScrubbingRefCurrent,
    isDrawing,
    isScreenRecording,
    maskSettings,
    maskCache,
    shapes,
    freezeFrames,
    activeFreezeFrame,
    activeFreezeFrameId,
    editingAnimationFFId,
    isAnimationPreviewPlaying,
    isFreezeFramePlaying,
    animationPreviewTime,
    countdownValue,
    selectedShapeId,
    freezeFrameActiveSteps,
    currentStepForActiveFF,
    tool,
    currentColor,
    toolSize,
    arrowSettings,
    ringSettings,
    spotlightSettings,
    polygonSettings,
    scannerSettings,
    lensSettings,
    nameTagSettings,
    textSettings,
    colors,
    playerMoveState,
    playerMoveStartPoint,
    capturedSprite,
    playerMoveSettings,
    radarParticlesRef,
    imageCache,
  } = params;

  if (!canvas || !video) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const layout = getVideoLayout(canvas, video);
  const { x, y, w, h, scale } = layout;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const currentVideoTime = video ? video.currentTime : 0;
  const isVideoStatic = Boolean(
    video && video.paused && !video.seeking && !isPlaying && !isScrubbing && !isScrubbingRefCurrent
  );
  const isMaskSynced =
    isVideoStatic && maskCache.timestamp !== -1 && Math.abs(maskCache.timestamp - currentVideoTime) < 0.02;

  let ffAlpha = 1;
  let shouldRenderDrawings = true;
  if (!isPlaying && maskSettings.enabled && maskCache.processedAt > 0 && isMaskSynced) {
    const age = Date.now() - maskCache.processedAt;
    const fadeDuration = 800; // 800ms fade in for telestrations
    if (age < fadeDuration) ffAlpha = Math.min(1, age / fadeDuration);
    else ffAlpha = 1;
  } else if (!isPlaying && maskSettings.enabled && (!isMaskSynced || maskCache.processedAt === 0)) {
    ffAlpha = 0; // Don't show shapes until mask is ready
    shouldRenderDrawings = false;
  }

  if (maskSettings.enabled && isVideoStatic && maskSettings.showOverlay && maskCache.overlay && isMaskSynced) {
    renderMaskOverlay(ctx, maskCache.overlay, x, y, w, h);
  }

  if (shouldRenderDrawings) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    const rawActiveFF =
      activeFreezeFrame ||
      (activeFreezeFrameId ? freezeFrames.find((ff) => ff.id === activeFreezeFrameId) : undefined) ||
      (editingAnimationFFId ? freezeFrames.find((ff) => ff.id === editingAnimationFFId) : undefined);
    const activeFF =
      rawActiveFF &&
      (editingAnimationFFId === rawActiveFF.id ||
        (!isPlaying && Math.abs(currentVideoTime - rawActiveFF.timestamp) <= 0.12))
        ? rawActiveFF
        : undefined;

    // Gather candidate ground shapes and evaluate visibility
    const evaluatedGroundShapes: Array<{ shape: Shape; unifiedProgress: number | undefined }> = [];

    shapes.forEach((shape) => {
      if (shape.trackHidden) return;
      let shouldRender = false;
      let unifiedProgress: number | undefined = undefined;
      const isTrackedShape = shape.trackStartTime !== undefined && shape.trackEndTime !== undefined;
      if (isTrackedShape) {
        shouldRender =
          currentVideoTime >= shape.trackStartTime! - 0.005 &&
          currentVideoTime <= shape.trackEndTime! + 0.005;
        if (shouldRender && activeFF) {
          const isContinuingFromBefore = shape.trackStartTime! < activeFF.timestamp - 0.05;
          if (activeFF.avoidedTrackIds?.includes(shape.id)) {
            shouldRender = false;
          } else if (isContinuingFromBefore) {
            // Already active on the clip before the freeze frame began: stay steady, no re-animation
            unifiedProgress = 1;
          } else if (activeFF.trackAnimations?.[shape.id]) {
            const trackAnim = activeFF.trackAnimations[shape.id];
            const isEditingAnim = editingAnimationFFId === activeFF.id;
            const isPlayingAnim = isEditingAnim ? isAnimationPreviewPlaying : isFreezeFramePlaying;
            const activeFFDur = activeFF.duration ?? 10;
            const start = trackAnim.animStart ?? 0;
            const end = trackAnim.animEnd ?? activeFFDur;
            if (isPlayingAnim) {
              const elapsed = isEditingAnim ? animationPreviewTime : Math.max(0, activeFFDur - countdownValue);
              if (elapsed < start || elapsed > end) {
                shouldRender = false;
              } else {
                const totalVisible = Math.max(0.1, end - start);
                const transitionDuration = Math.min(0.8, totalVisible * 0.4);
                let ap = 1;
                let dp = 0;
                if (elapsed >= start && elapsed < start + transitionDuration) {
                  const linearAp = (elapsed - start) / transitionDuration;
                  ap = 1 - Math.pow(1 - linearAp, 3);
                }
                if (elapsed > end - transitionDuration && elapsed <= end) {
                  const linearDp = (elapsed - (end - transitionDuration)) / transitionDuration;
                  dp = Math.pow(linearDp, 3);
                }
                unifiedProgress = ap < 1 ? Math.max(0, Math.min(1, ap)) : Math.max(0, Math.min(1, 1 - dp));
              }
            } else if (isEditingAnim) {
              const elapsed = animationPreviewTime;
              if (shape.id !== selectedShapeId && (elapsed < start || elapsed > end)) {
                shouldRender = false;
              } else {
                unifiedProgress = 1;
              }
            }
          } else {
            unifiedProgress = 1;
          }
        }
      } else if (!shape.freezeFrameId) {
        const isAtFreezeFrame = Boolean(activeFF || editingAnimationFFId);
        const isTimeMatching =
          shape.videoTime === undefined || Math.abs(currentVideoTime - shape.videoTime) <= 0.05;
        shouldRender = !isPlaying && !isAtFreezeFrame && isTimeMatching;
      } else if (editingAnimationFFId === shape.freezeFrameId) {
        shouldRender = true;
      } else if (!isPlaying && activeFreezeFrameId === shape.freezeFrameId) {
        const ffMatch =
          (activeFF?.id === shape.freezeFrameId ? activeFF : undefined) ||
          freezeFrames.find((f) => f.id === shape.freezeFrameId);
        shouldRender = Boolean(ffMatch && Math.abs(currentVideoTime - ffMatch.timestamp) <= 0.12);
      }

      if (shouldRender && shape.freezeFrameId) {
        const isEditingAnim = editingAnimationFFId === shape.freezeFrameId;
        const isPlayingAnim = isEditingAnim ? isAnimationPreviewPlaying : isFreezeFramePlaying;
        const ffObj = freezeFrames.find((f) => f.id === shape.freezeFrameId) || activeFF;
        const activeFFDur = ffObj?.duration ?? 10;
        const start = shape.animStart ?? 0;
        const end = shape.animEnd ?? activeFFDur;

        if (isPlayingAnim) {
          const elapsed = isEditingAnim ? animationPreviewTime : Math.max(0, activeFFDur - countdownValue);
          if (elapsed < start || elapsed > end) {
            shouldRender = false;
          } else {
            const totalVisible = Math.max(0.1, end - start);
            const transitionDuration = Math.min(0.8, totalVisible * 0.4);
            const appearDuration = transitionDuration;
            const disappearDuration = transitionDuration;
            let ap = 1;
            let dp = 0;
            if (elapsed >= start && elapsed < start + appearDuration) {
              const linearAp = (elapsed - start) / appearDuration;
              ap = 1 - Math.pow(1 - linearAp, 3);
            }
            if (elapsed > end - disappearDuration && elapsed <= end) {
              const linearDp = (elapsed - (end - disappearDuration)) / disappearDuration;
              dp = Math.pow(linearDp, 3);
            }
            unifiedProgress = ap < 1 ? Math.max(0, Math.min(1, ap)) : Math.max(0, Math.min(1, 1 - dp));
          }
        } else if (isEditingAnim) {
          const elapsed = animationPreviewTime;
          if (shape.id !== selectedShapeId && (elapsed < start || elapsed > end)) {
            shouldRender = false;
          } else {
            unifiedProgress = 1;
          }
        } else {
          // Freeze frame is paused (authoring / inspecting):
          // Render all drawings belonging to this freeze frame so every step is visible and editable.
          shouldRender = true;
          unifiedProgress = 1;
        }
      }

      if (shouldRender) {
        if (
          shape.type === 'player-move' ||
          shape.type === 'lens' ||
          shape.type === 'name-tag' ||
          shape.type === 'text'
        )
          return;
        evaluatedGroundShapes.push({ shape, unifiedProgress });
      }
    });

    const isPolygonShape = (s: Shape) => s.type === 'polygon' || s.type === 'radar';

    // Sub-pass 1A: Polygon & Radar pitch layer (always rendered nearest to pitch under all other tools)
    evaluatedGroundShapes.forEach(({ shape, unifiedProgress }) => {
      if (!isPolygonShape(shape)) return;
      drawShapeOnCanvas({
        ctx,
        shape,
        scale,
        renderMode: 'full',
        ffAlpha,
        unifiedProgress,
        ringSettings,
        imageCache,
        selectedShapeId,
      });
    });

    // Sub-pass 1B: All other ground shapes (circles, connected-circles, arrows, lines, pens, etc. OVER polygons)
    evaluatedGroundShapes.forEach(({ shape, unifiedProgress }) => {
      if (isPolygonShape(shape)) return;
      if (shape.type === 'curved-arrow') {
        drawShapeOnCanvas({
          ctx,
          shape,
          scale,
          renderMode: 'shadow',
          ffAlpha,
          unifiedProgress,
          ringSettings,
          imageCache,
          selectedShapeId,
        });
      } else {
        drawShapeOnCanvas({
          ctx,
          shape,
          scale,
          renderMode: 'full',
          ffAlpha,
          unifiedProgress,
          ringSettings,
          imageCache,
          selectedShapeId,
        });
      }
    });

    ctx.save();
    ctx.globalAlpha = ffAlpha;
    if (isDrawing && tool === 'pen' && arrowSettings.isFreehand && activePts.length > 0) {
      drawShapeOnCanvas({
        ctx,
        shape: {
          id: 'active_pen',
          type: 'pen',
          points: activePts,
          color: currentColor,
          strokeWidth: toolSize,
          isDashed: arrowSettings.isDashed,
          isFreehand: arrowSettings.isFreehand,
          isCurved: arrowSettings.isCurved,
          timestamp: 0,
        },
        scale,
        renderMode: 'full',
        ffAlpha,
        ringSettings,
        imageCache,
        selectedShapeId,
      });
    }
    if (tool === 'connected-circle' && activePts.length > 0) {
      drawActiveChainOnCanvas({ ctx, tool, activePts, ringSettings, currentColor });
    }
    ctx.restore();

    ctx.restore();
  }

  if (maskSettings.enabled && isVideoStatic && maskCache.foreground && isMaskSynced) {
    renderMaskForeground(ctx, maskCache.foreground, x, y, w, h);
  }

  if (shouldRenderDrawings) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    const rawActiveFF =
      activeFreezeFrame ||
      (activeFreezeFrameId ? freezeFrames.find((ff) => ff.id === activeFreezeFrameId) : undefined) ||
      (editingAnimationFFId ? freezeFrames.find((ff) => ff.id === editingAnimationFFId) : undefined);
    const activeFF =
      rawActiveFF &&
      (editingAnimationFFId === rawActiveFF.id ||
        (!isPlaying && Math.abs(currentVideoTime - rawActiveFF.timestamp) <= 0.12))
        ? rawActiveFF
        : undefined;

    shapes.forEach((shape) => {
      if (shape.trackHidden) return;
      let shouldRender = false;
      let unifiedProgress: number | undefined = undefined;
      const isTrackedShape = shape.trackStartTime !== undefined && shape.trackEndTime !== undefined;
      if (isTrackedShape) {
        shouldRender =
          currentVideoTime >= shape.trackStartTime! - 0.005 &&
          currentVideoTime <= shape.trackEndTime! + 0.005;
        if (shouldRender && activeFF) {
          const isContinuingFromBefore = shape.trackStartTime! < activeFF.timestamp - 0.05;
          if (activeFF.avoidedTrackIds?.includes(shape.id)) {
            shouldRender = false;
          } else if (isContinuingFromBefore) {
            // Already active on the clip before the freeze frame began: stay steady, no re-animation
            unifiedProgress = 1;
          } else if (activeFF.trackAnimations?.[shape.id]) {
            const trackAnim = activeFF.trackAnimations[shape.id];
            const isEditingAnim = editingAnimationFFId === activeFF.id;
            const isPlayingAnim = isEditingAnim ? isAnimationPreviewPlaying : isFreezeFramePlaying;
            const activeFFDur = activeFF.duration ?? 10;
            const start = trackAnim.animStart ?? 0;
            const end = trackAnim.animEnd ?? activeFFDur;
            if (isPlayingAnim) {
              const elapsed = isEditingAnim ? animationPreviewTime : Math.max(0, activeFFDur - countdownValue);
              if (elapsed < start || elapsed > end) {
                shouldRender = false;
              } else {
                const totalVisible = Math.max(0.1, end - start);
                const transitionDuration = Math.min(0.8, totalVisible * 0.4);
                let ap = 1;
                let dp = 0;
                if (elapsed >= start && elapsed < start + transitionDuration) {
                  const linearAp = (elapsed - start) / transitionDuration;
                  ap = 1 - Math.pow(1 - linearAp, 3);
                }
                if (elapsed > end - transitionDuration && elapsed <= end) {
                  const linearDp = (elapsed - (end - transitionDuration)) / transitionDuration;
                  dp = Math.pow(linearDp, 3);
                }
                unifiedProgress = ap < 1 ? Math.max(0, Math.min(1, ap)) : Math.max(0, Math.min(1, 1 - dp));
              }
            } else if (isEditingAnim) {
              const elapsed = animationPreviewTime;
              if (shape.id !== selectedShapeId && (elapsed < start || elapsed > end)) {
                shouldRender = false;
              } else {
                unifiedProgress = 1;
              }
            }
          } else {
            unifiedProgress = 1;
          }
        }
      } else if (!shape.freezeFrameId) {
        const isAtFreezeFrame = Boolean(activeFF || editingAnimationFFId);
        const isTimeMatching =
          shape.videoTime === undefined || Math.abs(currentVideoTime - shape.videoTime) <= 0.05;
        shouldRender = !isPlaying && !isAtFreezeFrame && isTimeMatching;
      } else if (editingAnimationFFId === shape.freezeFrameId) {
        shouldRender = true;
      } else if (!isPlaying && activeFreezeFrameId === shape.freezeFrameId) {
        const ffMatch =
          (activeFF?.id === shape.freezeFrameId ? activeFF : undefined) ||
          freezeFrames.find((f) => f.id === shape.freezeFrameId);
        shouldRender = Boolean(ffMatch && Math.abs(currentVideoTime - ffMatch.timestamp) <= 0.12);
      }

      if (shouldRender && shape.freezeFrameId) {
        const isEditingAnim = editingAnimationFFId === shape.freezeFrameId;
        const isPlayingAnim = isEditingAnim ? isAnimationPreviewPlaying : isFreezeFramePlaying;
        const ffObj = freezeFrames.find((f) => f.id === shape.freezeFrameId) || activeFF;
        const activeFFDur = ffObj?.duration ?? 10;
        const start = shape.animStart ?? 0;
        const end = shape.animEnd ?? activeFFDur;

        if (isPlayingAnim) {
          const elapsed = isEditingAnim ? animationPreviewTime : Math.max(0, activeFFDur - countdownValue);
          if (elapsed < start || elapsed > end) {
            shouldRender = false;
          } else if (shape.type === 'player-move') {
            const totalVisible = Math.max(0.1, end - start);
            const pmDur = Math.min(1.8, Math.max(0.6, totalVisible * 0.65));
            if (elapsed >= start && elapsed < start + pmDur) {
              const t = (elapsed - start) / pmDur;
              unifiedProgress = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            } else {
              unifiedProgress = 1;
            }
          } else {
            const totalVisible = Math.max(0.1, end - start);
            const transitionDuration = Math.min(0.8, totalVisible * 0.4);
            const appearDuration = transitionDuration;
            const disappearDuration = transitionDuration;
            let ap = 1;
            let dp = 0;
            if (elapsed >= start && elapsed < start + appearDuration) {
              const linearAp = (elapsed - start) / appearDuration;
              ap = 1 - Math.pow(1 - linearAp, 3);
            }
            if (elapsed > end - disappearDuration && elapsed <= end) {
              const linearDp = (elapsed - (end - disappearDuration)) / disappearDuration;
              dp = Math.pow(linearDp, 3);
            }
            unifiedProgress = ap < 1 ? Math.max(0, Math.min(1, ap)) : Math.max(0, Math.min(1, 1 - dp));
          }
        } else if (isEditingAnim) {
          const elapsed = animationPreviewTime;
          if (shape.id !== selectedShapeId && (elapsed < start || elapsed > end)) {
            shouldRender = false;
          } else {
            unifiedProgress = 1;
          }
        } else {
          // Freeze frame is paused (authoring / inspecting):
          // Render all drawings belonging to this freeze frame so every step is visible and editable.
          shouldRender = true;
          unifiedProgress = 1;
        }
      }

      if (shouldRender) {
        const alphaToUse = ffAlpha;

        if (shape.type === 'curved-arrow') {
          drawShapeOnCanvas({
            ctx,
            shape,
            scale,
            renderMode: 'body',
            ffAlpha: alphaToUse,
            unifiedProgress,
            ringSettings,
            imageCache,
            selectedShapeId,
          });
        }
        if (shape.type === 'player-move') {
          drawShapeOnCanvas({
            ctx,
            shape,
            scale,
            renderMode: 'full',
            ffAlpha: alphaToUse,
            unifiedProgress,
            ringSettings,
            imageCache,
            selectedShapeId,
          });
        }
        if (shape.type === 'lens' && video) {
          if (shape.lensConfig && shape.points[0]) {
            ctx.save();
            ctx.globalAlpha = ffAlpha;
            const actualProgress = unifiedProgress !== undefined ? Math.max(0, unifiedProgress) : 1;
            const effScale = actualProgress < 1 ? Math.max(0.0001, Math.pow(actualProgress, 0.5)) : 1;
            if (effScale < 1) {
              ctx.translate(shape.points[0].x, shape.points[0].y);
              ctx.scale(effScale, effScale);
              ctx.translate(-shape.points[0].x, -shape.points[0].y);
            }
            drawLens(
              ctx,
              shape.points[0],
              shape.lensConfig.radius,
              shape.lensConfig.zoom,
              video,
              scale,
              shape.timestamp
            );
            ctx.restore();
          }
        }
        if (shape.type === 'name-tag' || shape.type === 'text') {
          drawShapeOnCanvas({
            ctx,
            shape,
            scale,
            renderMode: 'full',
            ffAlpha: alphaToUse,
            unifiedProgress,
            ringSettings,
            imageCache,
            selectedShapeId,
          });
        }
      }
    });

    if (tool === 'name-tag' && mousePos && !isPlaying && !isDrawing && !isScreenRecording) {
      const activeTeamKey = nameTagSettings.activeTeam === 'A' ? 'teamA' : 'teamB';
      const activeTeamData = nameTagSettings[activeTeamKey];
      const allNames = [...nameTagSettings.teamA.names, ...nameTagSettings.teamB.names];
      const activeItem =
        allNames.find((n) => n.id === nameTagSettings.activeId) || activeTeamData.names[0] || allNames[0];
      const activeNameText = activeItem?.name || activeItem?.text || 'PLAYER';
      const playerNumber = activeItem?.number || '';
      const teamColor = currentColor || colors.find((c) => c.id === activeTeamData.colorId)?.value || '#ef4444';
      drawNameTag(
        ctx,
        mousePos,
        activeNameText,
        teamColor,
        scale,
        Date.now(),
        nameTagSettings.size,
        true,
        undefined,
        playerNumber,
        {
          uppercase: nameTagSettings.uppercase !== false,
          showNumber: nameTagSettings.showNumber !== false,
        }
      );
    }

    if (tool === 'text' && mousePos && !isPlaying && !isDrawing && !isScreenRecording) {
      drawText(
        ctx,
        mousePos,
        textSettings.text,
        colors.find((c) => c.id === textSettings.colorId)?.value || '#fff',
        scale,
        Date.now(),
        {
          bgEnabled: textSettings.bgEnabled,
          bgColor: colors.find((c) => c.id === textSettings.bgColorId)?.value || '#000',
          fontSize: textSettings.fontSize,
          animation: textSettings.animation,
        },
        true
      );
    }

    if (!isPlaying && !isFreezeFramePlaying && !isAnimationPreviewPlaying && !isScreenRecording) {
      shapes.forEach((shape) => {
        if (shape.trackHidden) return;
        const isSelected = shape.id === selectedShapeId;
        const hasPlayerBox = Boolean(shape.playerBox && shape.playerBox.w > 4 && shape.playerBox.h > 4);
        if (tool !== 'move' && !isSelected && !hasPlayerBox) return;

        let shouldRender = false;
        if (shape.trackStartTime !== undefined && shape.trackEndTime !== undefined) {
          shouldRender =
            currentVideoTime >= shape.trackStartTime - 0.005 &&
            currentVideoTime <= shape.trackEndTime + 0.005;
        } else if (!shape.freezeFrameId) {
          const isAtFreezeFrame = Boolean(activeFF || editingAnimationFFId);
          const isTimeMatching =
            shape.videoTime === undefined || Math.abs(currentVideoTime - shape.videoTime) <= 0.05;
          shouldRender = !isPlaying && !isAtFreezeFrame && isTimeMatching;
        } else if (editingAnimationFFId === shape.freezeFrameId) {
          const ffObj = freezeFrames.find((f) => f.id === shape.freezeFrameId) || activeFF;
          const activeFFDur = ffObj?.duration ?? 10;
          const start = shape.animStart ?? 0;
          const end = shape.animEnd ?? activeFFDur;
          shouldRender = isSelected || (animationPreviewTime >= start && animationPreviewTime <= end);
        } else if (!isPlaying && activeFreezeFrameId === shape.freezeFrameId) {
          const ffMatch =
            (activeFF?.id === shape.freezeFrameId ? activeFF : undefined) ||
            freezeFrames.find((f) => f.id === shape.freezeFrameId);
          shouldRender = Boolean(ffMatch && Math.abs(currentVideoTime - ffMatch.timestamp) <= 0.12);
        }

        if (shouldRender) {
          ctx.save();
          if (hasPlayerBox && shape.playerBox && isSelected) {
            const b = shape.playerBox;
            const corner = Math.min(14 / scale, Math.max(5 / scale, Math.min(b.w, b.h) * 0.25));
            ctx.save();
            ctx.fillStyle = 'rgba(198, 255, 31, 0.07)';
            ctx.fillRect(b.x, b.y, b.w, b.h);
            ctx.strokeStyle = 'rgba(198, 255, 31, 0.45)';
            ctx.lineWidth = 1 / scale;
            ctx.setLineDash([4 / scale, 3 / scale]);
            ctx.strokeRect(b.x, b.y, b.w, b.h);
            ctx.setLineDash([]);
            ctx.strokeStyle = '#c6ff1f';
            ctx.lineWidth = 2.2 / scale;
            ctx.beginPath();
            // Top-left
            ctx.moveTo(b.x, b.y + corner); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x + corner, b.y);
            // Top-right
            ctx.moveTo(b.x + b.w - corner, b.y); ctx.lineTo(b.x + b.w, b.y); ctx.lineTo(b.x + b.w, b.y + corner);
            // Bottom-right
            ctx.moveTo(b.x + b.w, b.y + b.h - corner); ctx.lineTo(b.x + b.w, b.y + b.h); ctx.lineTo(b.x + b.w - corner, b.y + b.h);
            // Bottom-left
            ctx.moveTo(b.x + corner, b.y + b.h); ctx.lineTo(b.x, b.y + b.h); ctx.lineTo(b.x, b.y + b.h - corner);
            ctx.stroke();

            if (shape.trackLabel) {
              const labelTxt = `${shape.trackLabel} ROI`;
              const fSize = 10 / scale;
              ctx.font = `700 ${fSize}px ui-monospace, monospace`;
              const m = ctx.measureText(labelTxt);
              const px = b.x;
              const py = Math.max(0, b.y - 16 / scale);
              ctx.fillStyle = 'rgba(10, 10, 12, 0.9)';
              ctx.fillRect(px, py, m.width + 8 / scale, 14 / scale);
              ctx.fillStyle = '#c6ff1f';
              ctx.textBaseline = 'middle';
              ctx.fillText(labelTxt, px + 4 / scale, py + 7 / scale);
            }
            ctx.restore();
          }
          if (tool === 'move' && isSelected) {
            const isCurved =
              shape.type === 'curved-arrow' ||
              shape.type === 'curved-run-arrow' ||
              (shape.type === 'arrow' && shape.isCurved);
            if (isCurved && shape.points.length >= 2) {
              const p1 = shape.points[0];
              const p2 = shape.points[1];
              const apex = shape.points[2] || {
                x: (p1.x + p2.x) / 2,
                y: (p1.y + p2.y) / 2 - Math.hypot(p2.x - p1.x, p2.y - p1.y) * 0.15,
              };

              ctx.save();
              // 1. Dashed Chord Baseline connecting start & end
              ctx.beginPath();
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
              ctx.lineWidth = 1 / scale;
              ctx.setLineDash([3 / scale, 3 / scale]);
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();

              // 2. Normal Guide from chord midpoint to the on-curve Apex
              const mx = (p1.x + p2.x) / 2;
              const my = (p1.y + p2.y) / 2;
              ctx.beginPath();
              ctx.strokeStyle = 'rgba(198, 255, 31, 0.45)';
              ctx.lineWidth = 1 / scale;
              ctx.setLineDash([2 / scale, 2 / scale]);
              ctx.moveTo(mx, my);
              ctx.lineTo(apex.x, apex.y);
              ctx.stroke();

              ctx.setLineDash([]);

              // 3. Start Point Handle (P0)
              ctx.beginPath();
              ctx.fillStyle = '#3b82f6';
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2 / scale;
              ctx.arc(p1.x, p1.y, 5.5 / scale, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();

              // 4. End Point Handle (P1)
              ctx.beginPath();
              ctx.fillStyle = '#3b82f6';
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2 / scale;
              ctx.arc(p2.x, p2.y, 5.5 / scale, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();

              // 5. On-Curve Controlling Handle (P2) - Centered directly ON the curve path
              ctx.beginPath();
              ctx.fillStyle = 'rgba(198, 255, 31, 0.35)';
              ctx.arc(apex.x, apex.y, 10 / scale, 0, Math.PI * 2);
              ctx.fill();

              ctx.beginPath();
              ctx.fillStyle = '#c6ff1f';
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2 / scale;
              ctx.arc(apex.x, apex.y, 6 / scale, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();

              // Inner accent center dot
              ctx.beginPath();
              ctx.fillStyle = '#0a0a0c';
              ctx.arc(apex.x, apex.y, 2 / scale, 0, Math.PI * 2);
              ctx.fill();

              // Subtle on-curve label pill
              const labelText = 'Curve';
              const fontSize = 8.5 / scale;
              ctx.font = `600 ${fontSize}px sans-serif`;
              const textMetrics = ctx.measureText(labelText);
              const pillW = textMetrics.width + 8 / scale;
              const pillH = 14 / scale;
              const pillX = apex.x + 9 / scale;
              const pillY = apex.y - 7 / scale;

              ctx.fillStyle = 'rgba(10, 10, 12, 0.85)';
              ctx.strokeStyle = 'rgba(198, 255, 31, 0.5)';
              ctx.lineWidth = 1 / scale;
              if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(pillX, pillY, pillW, pillH, 3 / scale);
                ctx.fill();
                ctx.stroke();
              }
              ctx.fillStyle = '#c6ff1f';
              ctx.textBaseline = 'middle';
              ctx.fillText(labelText, pillX + 4 / scale, pillY + pillH / 2);

              ctx.restore();
            } else if (shape.type !== 'pen' && !shape.isFreehand) {
              const ptsToRender = shape.type === 'circle' ? [shape.points[0]] : shape.points;
              ptsToRender.forEach((p) => {
                if (!p) return;
                ctx.beginPath();
                ctx.fillStyle = '#3b82f6';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2 / scale;
                ctx.arc(p.x, p.y, 5 / scale, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
              });
            }
          }

          if (shape.freezeFrameId && typeof shape.step === 'number' && !isNaN(shape.step)) {
            drawShapeStepBadge(ctx, shape, scale, isSelected);
          }
          ctx.restore();
        }
      });
    }

    if (radarParticlesRef.current.length > 0) {
      radarParticlesRef.current = updateAndDrawRadarParticles(ctx, radarParticlesRef.current, scale, 1);
    }

    ctx.restore();
  }

  const ghostCtx = ghostCanvas ? ghostCanvas.getContext('2d') : null;
  if (ghostCtx && ghostCanvas) {
    ghostCtx.clearRect(0, 0, ghostCanvas.width, ghostCanvas.height);

    if (!isPlaying && mousePos && tool && tool !== 'masking' && tool !== 'name-tag' && tool !== 'text') {
      const m = mousePos;
      ghostCtx.save();
      ghostCtx.translate(x, y);
      ghostCtx.scale(scale, scale);
      ghostCtx.globalAlpha = 0.85 * ffAlpha;

      if (tool === 'circle' && !isDrawing) {
        draw3DRing(
          ghostCtx,
          m.x,
          m.y,
          ringSettings.size,
          currentColor,
          ringSettings.tilt,
          0,
          Date.now(),
          true,
          ringSettings
        );
      } else if (tool === 'connected-circle' && !isDrawing) {
        if (activePts.length > 0) {
          const lastPt = activePts[activePts.length - 1];
          drawTangentLine(
            ghostCtx,
            lastPt,
            m,
            lastPt.r || ringSettings.size,
            ringSettings.size,
            currentColor,
            0,
            1,
            0,
            true,
            ringSettings.tilt,
            ringSettings
          );
        }
        draw3DRing(
          ghostCtx,
          m.x,
          m.y,
          ringSettings.size,
          currentColor,
          ringSettings.tilt,
          0,
          Date.now(),
          true,
          ringSettings
        );
      } else if (tool === 'spotlight' && !isDrawing) {
        drawSpotlight(
          ghostCtx,
          m.x,
          m.y,
          spotlightSettings.size,
          spotlightSettings.intensity,
          spotlightSettings.rotation,
          [],
          Date.now(),
          true
        );
      } else if (tool === 'lens' && !isDrawing && video) {
        drawLens(ghostCtx, m, lensSettings.size, lensSettings.zoom, video, scale, Date.now(), true);
      } else if ((tool === 'arrow' || tool === 'curved-arrow' || tool === 'line' || tool === 'pen') && !isDrawing) {
        ghostCtx.beginPath();
        ghostCtx.arc(m.x, m.y, toolSize / scale / 2, 0, Math.PI * 2);
        ghostCtx.fillStyle = currentColor;
        ghostCtx.fill();
      } else if (tool === 'radar' || (tool === 'polygon' && polygonSettings.mode === 'radar')) {
        if (isDrawing && activePts.length > 0) {
            const tiltRad = ((polygonSettings.radarTilt ?? 65) * Math.PI) / 180;
            const scaleY = Math.max(0.1, Math.cos(tiltRad));
            const dragDx = m.x - activePts[0].x;
            const dragDy = (m.y - activePts[0].y) / scaleY;
            const dragDist = Math.hypot(dragDx, dragDy);
            const r = dragDist > 15 ? dragDist : polygonSettings.radarRadius;
            drawRadarPreview(
              ghostCtx,
              activePts[0].x,
              activePts[0].y,
              r,
              currentColor,
              scale,
              polygonSettings,
              Date.now(),
              ffAlpha
            );
          } else {
            drawRadarPreview(
              ghostCtx,
              m.x,
              m.y,
              polygonSettings.radarRadius,
              currentColor,
              scale,
              polygonSettings,
              Date.now(),
              ffAlpha
            );
          }
        } else if (tool === 'polygon') {
        drawPolygonPreview(
          ghostCtx,
          activePts,
          m,
          currentColor,
          toolSize,
          scale,
          polygonSettings.fillStyle,
          ffAlpha
        );
      } else if (tool === 'scanner') {
        if (isDrawing && activePts.length > 0) {
          drawScannerPreview(ghostCtx, activePts[0], m, currentColor, scale, scannerSettings, Date.now(), ffAlpha);
        } else {
          const tipPreview = {
            x: m.x + Math.cos(0) * scannerSettings.length,
            y: m.y + Math.sin(0) * scannerSettings.length,
          };
          drawScannerPreview(ghostCtx, m, tipPreview, currentColor, scale, scannerSettings, Date.now(), ffAlpha);
        }
      } else if (
        (tool === 'arrow' || tool === 'curved-arrow' || tool === 'line' || tool === 'pen') &&
        isDrawing &&
        activePts.length > 0
      ) {
        const pts = [activePts[0], m];
        let ghostType: ToolType = tool;
        if (tool === 'pen') ghostType = arrowSettings.isFreehand ? 'pen' : 'line';

        drawShapeOnCanvas({
          ctx: ghostCtx,
          shape: {
            id: 'ghost',
            type: ghostType,
            points: tool === 'pen' && arrowSettings.isFreehand ? [...activePts, m] : pts,
            color: currentColor,
            strokeWidth: toolSize,
            timestamp: 0,
            isDashed: arrowSettings.isDashed,
            isFreehand: arrowSettings.isFreehand,
            isCurved: arrowSettings.isCurved,
          },
          scale,
          renderMode: 'full',
          ffAlpha: 0.5 * ffAlpha,
          ringSettings,
          imageCache,
          selectedShapeId,
        });
      } else if (tool === 'player-move') {
        const startPt = playerMoveStartPoint || (activePts[0] ? activePts[0] : null);
        drawPlayerMoveGhost(
          ghostCtx,
          playerMoveState,
          m,
          startPt,
          capturedSprite,
          currentColor,
          scale,
          toolSize,
          playerMoveSettings
        );
      }
      ghostCtx.restore();
    }
  }
}
