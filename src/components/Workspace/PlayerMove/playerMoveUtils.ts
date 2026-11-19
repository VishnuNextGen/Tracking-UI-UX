import type { Point, Rect, Shape } from '../../../types';
import { drawTacticalArrowHead, drawPlayerSelectionRect } from '../../../utils/drawing';
import { renderMaskedSprite } from '../Masking';
import type { CapturedSprite, PlayerMoveSettings, PlayerMoveState, PlayerMoveMode } from './types';
import { DEFAULT_PLAYER_MOVE_SETTINGS } from './types';

export const resolveDrawableImage = (
  src: any,
  imageCache?: Map<string, HTMLImageElement>
): CanvasImageSource | null => {
  if (!src) return null;
  if (
    src instanceof HTMLImageElement ||
    src instanceof HTMLCanvasElement ||
    src instanceof ImageBitmap ||
    src instanceof HTMLVideoElement ||
    src instanceof OffscreenCanvas
  ) {
    return src;
  }
  if (typeof src === 'string' && (src.startsWith('data:image/') || src.startsWith('blob:') || src.startsWith('http'))) {
    if (imageCache) {
      let img = imageCache.get(src);
      if (!img) {
        img = new Image();
        img.src = src;
        imageCache.set(src, img);
      }
      return img.complete && img.naturalWidth > 0 ? img : null;
    }
  }
  return null;
};

/**
 * Evaluates candidate sampling regions around the player to find genuine pitch grass
 * and avoid other players, white lines, or foreign objects. Applies elliptical feathered
 * blending so the patch dissolves seamlessly into the video with zero rectangular seams.
 */
function samplePitchPatch(
  video: HTMLVideoElement,
  rect: Rect,
  featherRadius: number = 20
): HTMLCanvasElement | null {
  const w = Math.ceil(rect.w);
  const h = Math.ceil(rect.h);
  if (w <= 0 || h <= 0) return null;

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  // Evaluate candidate sampling positions around the player
  // Prioritize vertical mower stripe alignment (top/bottom) then adjacent sides
  const candidates: Array<{ x: number; y: number; name: string }> = [
    { x: rect.x, y: rect.y - h * 0.9, name: 'top' },
    { x: rect.x, y: rect.y + h * 0.9, name: 'bottom' },
    { x: rect.x - w * 1.15, y: rect.y, name: 'left' },
    { x: rect.x + w * 1.15, y: rect.y, name: 'right' },
    { x: rect.x - w * 0.85, y: rect.y - h * 0.6, name: 'top-left' },
    { x: rect.x + w * 0.85, y: rect.y - h * 0.6, name: 'top-right' },
    { x: rect.x - w * 0.85, y: rect.y + h * 0.6, name: 'bottom-left' },
    { x: rect.x + w * 0.85, y: rect.y + h * 0.6, name: 'bottom-right' },
  ];

  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = 32;
  sampleCanvas.height = 32;
  const sCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });

  let bestCandidate = candidates[0];
  let bestScore = -Infinity;

  for (const c of candidates) {
    const cx = Math.max(0, Math.min(vw - w, Math.round(c.x)));
    const cy = Math.max(0, Math.min(vh - h, Math.round(c.y)));

    // Reject candidates that heavily overlap with player's bounding box
    const overlapX = Math.max(0, Math.min(rect.x + w, cx + w) - Math.max(rect.x, cx));
    const overlapY = Math.max(0, Math.min(rect.y + h, cy + h) - Math.max(rect.y, cy));
    const overlapArea = (overlapX * overlapY) / (w * h);
    if (overlapArea > 0.4) continue;

    if (!sCtx) {
      bestCandidate = c;
      break;
    }

    sCtx.clearRect(0, 0, 32, 32);
    sCtx.drawImage(video, cx, cy, w, h, 0, 0, 32, 32);
    const imgData = sCtx.getImageData(0, 0, 32, 32).data;

    let greenScore = 0;
    let nonPitchPenalty = 0;
    const totalPixels = 32 * 32;

    for (let i = 0; i < imgData.length; i += 4) {
      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];

      // Pitch grass condition: Green is chromatic and dominates
      const isGreen = g >= b + 4 && g >= r * 0.92;
      if (isGreen) {
        greenScore += 2;
      } else {
        const isWhite = r > 185 && g > 185 && b > 185;
        const isDark = r < 35 && g < 35 && b < 35;
        const isColoredJersey = r > g + 25 || b > g + 20;
        if (isWhite || isColoredJersey || isDark) {
          nonPitchPenalty += 5;
        } else {
          nonPitchPenalty += 1;
        }
      }
    }

    const candidateScore = (greenScore / totalPixels) * 100 - (nonPitchPenalty / totalPixels) * 120;
    if (candidateScore > bestScore) {
      bestScore = candidateScore;
      bestCandidate = { x: cx, y: cy, name: c.name };
    }
  }

  const patchCanvas = document.createElement('canvas');
  patchCanvas.width = w;
  patchCanvas.height = h;
  const patchCtx = patchCanvas.getContext('2d');
  if (!patchCtx) return null;

  const srcX = Math.max(0, Math.min(vw - w, Math.round(bestCandidate.x)));
  const srcY = Math.max(0, Math.min(vh - h, Math.round(bestCandidate.y)));

  // Copy candidate pitch turf
  patchCtx.drawImage(video, srcX, srcY, w, h, 0, 0, w, h);

  // Apply smooth elliptical feathering to eliminate rectangular seams completely
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = w;
  maskCanvas.height = h;
  const mCtx = maskCanvas.getContext('2d');
  if (mCtx) {
    const cx = w / 2;
    const cy = h / 2;
    mCtx.save();
    mCtx.translate(cx, cy);
    mCtx.scale(1, h / Math.max(1, w));
    const radius = w / 2;
    const innerRadius = Math.max(0, radius - featherRadius);
    const grad = mCtx.createRadialGradient(0, 0, innerRadius, 0, 0, radius);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.65, 'rgba(0,0,0,0.95)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    mCtx.fillStyle = grad;
    mCtx.beginPath();
    mCtx.arc(0, 0, radius, 0, Math.PI * 2);
    mCtx.fill();
    mCtx.restore();

    patchCtx.globalCompositeOperation = 'destination-in';
    patchCtx.drawImage(maskCanvas, 0, 0);
    patchCtx.globalCompositeOperation = 'source-over';
  }

  return patchCanvas;
}

export function capturePlayerSprite(
  video: HTMLVideoElement | null,
  rect: Rect,
  maskForeground?: ImageBitmap | CanvasImageSource | null,
  maskEnabled?: boolean,
  settings: PlayerMoveSettings = DEFAULT_PLAYER_MOVE_SETTINGS
): CapturedSprite | null {
  if (!video) return null;
  const w = Math.ceil(rect.w);
  const h = Math.ceil(rect.h);
  if (w <= 0 || h <= 0) return null;

  // 1. Cutout player sprite (with chroma key if enabled)
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = w;
  cropCanvas.height = h;
  const ctx = cropCanvas.getContext('2d');
  if (!ctx) return null;
  renderMaskedSprite(ctx, video, (maskForeground as ImageBitmap | null) || null, rect, !!maskEnabled);

  // 2. Original video crop for Ghost mode (unmasked, authentic appearance)
  const originPlayerCanvas = document.createElement('canvas');
  originPlayerCanvas.width = w;
  originPlayerCanvas.height = h;
  const origCtx = originPlayerCanvas.getContext('2d');
  if (origCtx) {
    origCtx.drawImage(video, rect.x, rect.y, w, h, 0, 0, w, h);
  }

  // 3. Background pitch infill patch (if requested by settings)
  let bgCanvas: HTMLCanvasElement | null = null;
  if (settings.mode === 'seamless-patch' || settings.mode === 'ghost-patch') {
    bgCanvas = samplePitchPatch(video, rect, settings.featherRadius);
  }

  return {
    sprite: cropCanvas,
    patch: bgCanvas,
    originPlayer: originPlayerCanvas,
    box: rect,
    settings: { ...settings }
  };
}

export function hitTestPlayerMove(
  shape: Shape,
  pt: Point,
  threshold: number
): { hit: boolean; offsetX: number; offsetY: number } | null {
  if (shape.type !== 'player-move' || !shape.box || !shape.points || shape.points.length === 0) return null;
  const origBox = shape.box;
  const destPt = shape.points[1] || shape.points[0];
  const destBox = { x: destPt.x - origBox.w / 2, y: destPt.y - origBox.h / 2, w: origBox.w, h: origBox.h };
  const inOrig =
    pt.x >= origBox.x - threshold &&
    pt.x <= origBox.x + origBox.w + threshold &&
    pt.y >= origBox.y - threshold &&
    pt.y <= origBox.y + origBox.h + threshold;
  const inDest =
    pt.x >= destBox.x - threshold &&
    pt.x <= destBox.x + destBox.w + threshold &&
    pt.y >= destBox.y - threshold &&
    pt.y <= destBox.y + destBox.h + threshold;
  if (inOrig || inDest) {
    return {
      hit: true,
      offsetX: pt.x - shape.points[0].x,
      offsetY: pt.y - shape.points[0].y
    };
  }
  return null;
}

export function drawPlayerMoveShape(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  scale: number,
  ffAlpha: number = 1,
  unifiedProgress?: number,
  imageCache?: Map<string, HTMLImageElement>
): void {
  if (!shape.box || !shape.points || shape.points.length < 2) return;
  const originCenter = shape.points[0];
  const destCenter = shape.points[1];
  const { w, h } = shape.box;

  const mode: PlayerMoveMode = shape.playerMoveConfig?.mode || (shape.bgImg ? 'seamless-patch' : 'ghost');
  const ghostOpacity = shape.playerMoveConfig?.ghostOpacity ?? 0.35;
  const showArrow = shape.playerMoveConfig?.showArrow !== false;

  // 1. ORIGIN RENDERING
  // Draw seamless feathered pitch patch if enabled
  if (mode === 'seamless-patch' || mode === 'ghost-patch') {
    const bgDrawable = resolveDrawableImage(shape.bgImg, imageCache);
    if (bgDrawable) {
      try {
        ctx.save();
        ctx.globalAlpha = ffAlpha;
        ctx.drawImage(bgDrawable, shape.box.x, shape.box.y, w, h);
        ctx.restore();
      } catch {}
    }
  }

  // Draw Tactical Ghost Player if enabled (Hudl Studio / Coach Paint standard)
  if (mode === 'ghost' || mode === 'ghost-patch') {
    const originDrawable = resolveDrawableImage(shape.img, imageCache);
    if (originDrawable) {
      ctx.save();
      const alphaVal = (mode === 'ghost-patch' ? 0.25 : ghostOpacity) * ffAlpha;
      ctx.globalAlpha = Math.max(0.1, Math.min(1, alphaVal));
      try {
        ctx.drawImage(originDrawable, shape.box.x, shape.box.y, w, h);
      } catch {}
      ctx.restore();
    }
  }

  // 2. TACTICAL ARROW
  const pmDuration = 1800;
  const rawProgress =
    unifiedProgress !== undefined
      ? Math.max(0, Math.min(1, unifiedProgress))
      : shape.timestamp
      ? Math.max(0, Math.min(1, (Date.now() - shape.timestamp) / pmDuration))
      : 1;
  // Smooth ease-in-out cubic so relocation glides naturally instead of jumping fast
  const pmProgress =
    unifiedProgress !== undefined
      ? rawProgress
      : rawProgress < 0.5
      ? 4 * rawProgress * rawProgress * rawProgress
      : 1 - Math.pow(-2 * rawProgress + 2, 3) / 2;
  const totalDist = Math.hypot(destCenter.x - originCenter.x, destCenter.y - originCenter.y);
  const angle = Math.atan2(destCenter.y - originCenter.y, destCenter.x - originCenter.x);
  const spriteRadius = Math.min(w, h) * 0.42;
  const offsetDist = totalDist > spriteRadius + 15 ? spriteRadius : 0;

  const currentX = originCenter.x + (destCenter.x - originCenter.x) * pmProgress;
  const currentY = originCenter.y + (destCenter.y - originCenter.y) * pmProgress;
  const currentEnd = { x: currentX, y: currentY };
  const currentTip = {
    x: currentEnd.x - Math.cos(angle) * (offsetDist * pmProgress),
    y: currentEnd.y - Math.sin(angle) * (offsetDist * pmProgress)
  };

  if (showArrow) {
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = shape.color;
    ctx.fillStyle = shape.color;
    ctx.lineWidth = shape.strokeWidth / scale;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 4;
    ctx.setLineDash([10, 10]);
    ctx.lineDashOffset = 0;
    ctx.moveTo(originCenter.x, originCenter.y);
    ctx.lineTo(currentTip.x, currentTip.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.setLineDash([]);
    if (pmProgress > 0.05) {
      drawTacticalArrowHead(
        ctx,
        originCenter,
        currentTip,
        Math.max(16, (shape.strokeWidth * 4) / scale),
        shape.color,
        shape.strokeWidth / scale
      );
    }
    ctx.restore();
  }

  // 3. RELOCATED PLAYER AT DESTINATION
  const fgDrawable = resolveDrawableImage(shape.img, imageCache);
  if (fgDrawable) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 10;
    ctx.beginPath();
    ctx.ellipse(currentEnd.x, currentEnd.y + h / 2.5, w / 3, w / 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fill();
    const bobbing = Math.sin(Date.now() / 900) * 1.2;
    try {
      ctx.drawImage(fgDrawable, currentEnd.x - w / 2, currentEnd.y - h / 2 + bobbing, w, h);
    } catch {}
    ctx.restore();
  }
}

export function drawPlayerMoveGhost(
  ghostCtx: CanvasRenderingContext2D,
  playerMoveState: PlayerMoveState,
  m: Point,
  startPt: Point | null,
  capturedSprite: CapturedSprite | null,
  currentColor: string,
  scale: number,
  toolSize: number,
  settings: PlayerMoveSettings = DEFAULT_PLAYER_MOVE_SETTINGS
): void {
  if (playerMoveState === 'idle') {
    const reticleSize = 16 / scale;
    ghostCtx.save();
    ghostCtx.strokeStyle = currentColor;
    ghostCtx.lineWidth = 1.5 / scale;
    const half = reticleSize;
    const arm = half * 0.45;
    ghostCtx.beginPath();
    // TL
    ghostCtx.moveTo(m.x - half, m.y - half + arm);
    ghostCtx.lineTo(m.x - half, m.y - half);
    ghostCtx.lineTo(m.x - half + arm, m.y - half);
    // TR
    ghostCtx.moveTo(m.x + half - arm, m.y - half);
    ghostCtx.lineTo(m.x + half, m.y - half);
    ghostCtx.lineTo(m.x + half, m.y - half + arm);
    // BL
    ghostCtx.moveTo(m.x - half, m.y + half - arm);
    ghostCtx.lineTo(m.x - half, m.y + half);
    ghostCtx.lineTo(m.x - half + arm, m.y + half);
    // BR
    ghostCtx.moveTo(m.x + half - arm, m.y + half);
    ghostCtx.lineTo(m.x + half, m.y + half);
    ghostCtx.lineTo(m.x + half, m.y + half - arm);
    ghostCtx.stroke();
    // Center dot
    ghostCtx.beginPath();
    ghostCtx.arc(m.x, m.y, 2 / scale, 0, Math.PI * 2);
    ghostCtx.fillStyle = currentColor;
    ghostCtx.fill();

    // Hint tooltip badge
    const hintText = 'Drag rectangle over player';
    const fontSize = 10 / scale;
    ghostCtx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const tw = ghostCtx.measureText(hintText).width;
    const padX = 6 / scale;
    const padY = 3 / scale;
    const bx = m.x - (tw + padX * 2) / 2;
    const by = m.y + half + 8 / scale;
    ghostCtx.fillStyle = 'rgba(15, 17, 23, 0.9)';
    if ((ghostCtx as any).roundRect) {
      ghostCtx.beginPath();
      (ghostCtx as any).roundRect(bx, by, tw + padX * 2, fontSize + padY * 2, 3 / scale);
      ghostCtx.fill();
    } else {
      ghostCtx.fillRect(bx, by, tw + padX * 2, fontSize + padY * 2);
    }
    ghostCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ghostCtx.lineWidth = 1 / scale;
    ghostCtx.stroke();
    ghostCtx.fillStyle = '#ffffff';
    ghostCtx.textBaseline = 'middle';
    ghostCtx.textAlign = 'center';
    ghostCtx.fillText(hintText, m.x, by + (fontSize + padY * 2) / 2);
    ghostCtx.restore();
  } else if (playerMoveState === 'selecting') {
    const origin = startPt || m;
    const rx = Math.min(origin.x, m.x);
    const ry = Math.min(origin.y, m.y);
    const rw = Math.abs(m.x - origin.x);
    const rh = Math.abs(m.y - origin.y);

    if (rw > 2 || rh > 2) {
      drawPlayerSelectionRect(ghostCtx, { x: rx, y: ry, w: rw, h: rh }, currentColor, scale, {
        isDragging: true,
        showCornerBrackets: true,
        showDimensions: true,
        showCrosshair: true,
        label: 'SELECT PLAYER'
      });
    }
  } else if (playerMoveState === 'moving' && capturedSprite) {
    const { box } = capturedSprite;
    const originCenter = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    const destRect = { x: m.x - box.w / 2, y: m.y - box.h / 2, w: box.w, h: box.h };

    // 1. Origin preview (Pitch Infill / Ghost based on settings)
    const activeMode = settings.mode || 'seamless-patch';
    if ((activeMode === 'seamless-patch' || activeMode === 'ghost-patch') && capturedSprite.patch) {
      ghostCtx.save();
      ghostCtx.globalAlpha = 1;
      ghostCtx.drawImage(capturedSprite.patch, box.x, box.y, box.w, box.h);
      ghostCtx.restore();
    }
    if (activeMode === 'ghost' || activeMode === 'ghost-patch') {
      const ghostImg = capturedSprite.originPlayer || capturedSprite.sprite;
      if (ghostImg) {
        ghostCtx.save();
        ghostCtx.globalAlpha = activeMode === 'ghost-patch' ? 0.25 : (settings.ghostOpacity ?? 0.35);
        ghostCtx.drawImage(ghostImg, box.x, box.y, box.w, box.h);
        ghostCtx.restore();
      }
    }

    // 2. Static dashed preview arrow from origin to cursor position
    const ghostDist = Math.hypot(m.x - originCenter.x, m.y - originCenter.y);
    const ghostAngle = Math.atan2(m.y - originCenter.y, m.x - originCenter.x);
    const ghostSpriteRadius = Math.min(box.w, box.h) * 0.42;
    const ghostOffset = ghostDist > ghostSpriteRadius + 15 ? ghostSpriteRadius : 0;
    const ghostTip = {
      x: m.x - Math.cos(ghostAngle) * ghostOffset,
      y: m.y - Math.sin(ghostAngle) * ghostOffset
    };

    ghostCtx.save();
    ghostCtx.beginPath();
    ghostCtx.strokeStyle = currentColor;
    ghostCtx.lineWidth = Math.max(2, toolSize / scale);
    ghostCtx.shadowColor = 'rgba(0,0,0,0.5)';
    ghostCtx.shadowBlur = 6;
    ghostCtx.shadowOffsetY = 4;
    ghostCtx.setLineDash([8 / scale, 6 / scale]);
    ghostCtx.lineDashOffset = 0;
    ghostCtx.moveTo(originCenter.x, originCenter.y);
    ghostCtx.lineTo(ghostTip.x, ghostTip.y);
    ghostCtx.stroke();
    ghostCtx.setLineDash([]);
    ghostCtx.shadowBlur = 0;
    ghostCtx.shadowOffsetY = 0;
    drawTacticalArrowHead(ghostCtx, originCenter, ghostTip, (toolSize * 4) / scale, currentColor, toolSize / scale);
    ghostCtx.restore();

    // 3. Floating player sprite following cursor
    if (capturedSprite.sprite) {
      ghostCtx.save();
      ghostCtx.shadowColor = 'rgba(0,0,0,0.7)';
      ghostCtx.shadowBlur = 12;
      ghostCtx.shadowOffsetY = 8;
      ghostCtx.beginPath();
      ghostCtx.ellipse(m.x, m.y + box.h / 2.5, box.w / 3, box.w / 8, 0, 0, Math.PI * 2);
      ghostCtx.fillStyle = 'rgba(0,0,0,0.5)';
      ghostCtx.fill();
      ghostCtx.drawImage(capturedSprite.sprite, destRect.x, destRect.y, box.w, box.h);
      ghostCtx.restore();
    }

    // 4. Placement tooltip
    ghostCtx.save();
    const hintText = 'Click to place player • Esc to cancel';
    const fontSize = 10 / scale;
    ghostCtx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const tw = ghostCtx.measureText(hintText).width;
    const padX = 7 / scale;
    const padY = 3.5 / scale;
    const bx = m.x - (tw + padX * 2) / 2;
    const by = m.y + box.h / 2 + 16 / scale;
    ghostCtx.fillStyle = 'rgba(15, 17, 23, 0.9)';
    if ((ghostCtx as any).roundRect) {
      ghostCtx.beginPath();
      (ghostCtx as any).roundRect(bx, by, tw + padX * 2, fontSize + padY * 2, 4 / scale);
      ghostCtx.fill();
    } else {
      ghostCtx.fillRect(bx, by, tw + padX * 2, fontSize + padY * 2);
    }
    ghostCtx.strokeStyle = currentColor;
    ghostCtx.lineWidth = 1 / scale;
    ghostCtx.stroke();
    ghostCtx.fillStyle = '#ffffff';
    ghostCtx.textBaseline = 'middle';
    ghostCtx.textAlign = 'center';
    ghostCtx.fillText(hintText, m.x, by + (fontSize + padY * 2) / 2);
    ghostCtx.restore();
  }
}

export function createPlayerMoveShape(
  captured: CapturedSprite,
  destCenter: Point,
  color: string,
  strokeWidth: number,
  freezeFrameId?: string,
  settings?: PlayerMoveSettings
): Shape {
  const { box } = captured;
  const config = settings || captured.settings || DEFAULT_PLAYER_MOVE_SETTINGS;
  return {
    id: Date.now().toString(),
    type: 'player-move',
    points: [{ x: box.x + box.w / 2, y: box.y + box.h / 2 }, destCenter],
    box: box,
    color: color,
    strokeWidth: strokeWidth,
    img: captured.sprite,
    bgImg: captured.patch || undefined,
    timestamp: Date.now(),
    freezeFrameId: freezeFrameId,
    playerMoveConfig: {
      mode: config.mode,
      ghostOpacity: config.ghostOpacity,
      featherRadius: config.featherRadius,
      showArrow: config.showArrow,
    }
  };
}
