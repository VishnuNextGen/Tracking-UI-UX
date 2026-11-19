import type { WatermarkTier } from '../types/user';
import type { AnyCanvasContext } from './drawing';
import {
  type CreatorWatermarkConfig,
  hasActiveCreatorWatermark,
  resolveCreatorFontFamily,
} from './creatorWatermarkStore';

export interface WatermarkViewport {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RenderWatermarkOptions {
  tier: WatermarkTier;
  targetWidth: number;
  targetHeight: number;
  viewport?: WatermarkViewport;
  nowMs?: number;
  creatorWatermark?: CreatorWatermarkConfig | null;
  /** Used while the inline editor input is actively focused so text isn't drawn twice */
  suppressCreatorWatermark?: boolean;
}

export interface NormalizedWatermarkLayout {
  wordmarkHeightRatio: number;
  sublineHeightRatio: number;
  rightMarginRatio: number;
  leftMarginRatio: number;
  bottomMarginRatio: number;
  freeGridCols: number;
  freeGridRows: number;
}

interface ScratchSurface {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  ctx: AnyCanvasContext;
}

/**
 * Canonical minimum short-side reference resolution (1080p).
 * Any viewport smaller than 1080px on its shorter axis (such as a compact live editor canvas
 * or 720p export) is rendered in >=1080p canonical space and scaled onto the target viewport.
 * Any viewport >=1080p (such as 1080p or 4K export) renders natively at 1:1 physical pixels
 * using exact unclamped linear ratios. This guarantees 100% identical relative sizing,
 * kerning, and grid density between the live editor canvas and every export resolution.
 */
const MIN_CANONICAL_SHORT_SIDE = 1080;

const proTextCache = new Map<string, ScratchSurface>();
const freeFullOverlayCache = new Map<string, ScratchSurface>();
const creatorImageCache = new Map<string, CanvasImageSource>();
const creatorImagePending = new Set<string>();
const MAX_CACHE_ENTRIES = 8;

const BRAND_FONT_STACK =
  '"Outfit", "IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/**
 * Preloads the user's custom creator watermark image (works in both Main Thread and Web Worker)
 * so export frames composite synchronously from frame 0.
 */
export async function preloadCreatorWatermarkImage(
  config?: CreatorWatermarkConfig | null
): Promise<void> {
  const src = config?.imageDataUrl;
  if (!src || creatorImageCache.has(src)) return;

  const isWorker = typeof window === 'undefined' || typeof Image === 'undefined';
  if (isWorker) {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      if (typeof createImageBitmap === 'function') {
        const bmp = await createImageBitmap(blob);
        creatorImageCache.set(src, bmp);
      }
    } catch {
      // Ignore invalid image in worker
    }
    return;
  }

  await new Promise<void>(resolve => {
    const img = new Image();
    img.onload = () => {
      creatorImageCache.set(src, img);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = src;
  });
}

function getOrQueueCreatorImageSync(src?: string | null): CanvasImageSource | null {
  if (!src) return null;
  const existing = creatorImageCache.get(src);
  if (existing) return existing;

  if (
    typeof window !== 'undefined' &&
    typeof Image !== 'undefined' &&
    !creatorImagePending.has(src)
  ) {
    creatorImagePending.add(src);
    const img = new Image();
    img.onload = () => {
      creatorImagePending.delete(src);
      creatorImageCache.set(src, img);
      window.dispatchEvent(new CustomEvent('tacstem_creator_watermark_image_ready'));
    };
    img.onerror = () => {
      creatorImagePending.delete(src);
    };
    img.src = src;
  }

  return null;
}

function resolveCanonicalDimensions(vpW: number, vpH: number): {
  canonW: number;
  canonH: number;
  scaleX: number;
  scaleY: number;
} {
  const safeVpW = Math.max(1, vpW);
  const safeVpH = Math.max(1, vpH);
  const shortSide = Math.min(safeVpW, safeVpH);
  const upFactor = shortSide < MIN_CANONICAL_SHORT_SIDE ? MIN_CANONICAL_SHORT_SIDE / shortSide : 1;
  const canonW = safeVpW * upFactor;
  const canonH = safeVpH * upFactor;
  return {
    canonW,
    canonH,
    scaleX: safeVpW / canonW,
    scaleY: safeVpH / canonH,
  };
}

function enableHighQualitySmoothing(ctx: AnyCanvasContext): void {
  try {
    if ('imageSmoothingEnabled' in ctx) {
      (ctx as any).imageSmoothingEnabled = true;
    }
    if ('imageSmoothingQuality' in ctx) {
      (ctx as any).imageSmoothingQuality = 'high';
    }
  } catch {
    // Ignore on minimal headless mock contexts
  }
}

function createScratchSurface(width: number, height: number): ScratchSurface | null {
  const safeW = Math.max(1, Math.round(width));
  const safeH = Math.max(1, Math.round(height));

  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(safeW, safeH);
      const ctx = canvas.getContext('2d') as AnyCanvasContext | null;
      if (ctx) return { canvas, ctx };
    }
  } catch {
    // Fallback to HTMLCanvasElement if OffscreenCanvas is restricted
  }

  try {
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const canvas = document.createElement('canvas');
      canvas.width = safeW;
      canvas.height = safeH;
      const ctx = canvas.getContext('2d') as AnyCanvasContext | null;
      if (ctx) return { canvas, ctx };
    }
  } catch {
    // Headless environment (e.g. Node unit tests)
  }

  return null;
}

function safeRotate(ctx: AnyCanvasContext, radians: number): void {
  if (typeof (ctx as any).rotate === 'function') {
    (ctx as any).rotate(radians);
  }
}

function isDarkHexColor(color: string): boolean {
  const hex = (color || '').trim().replace('#', '');
  if (hex.length !== 3 && hex.length !== 6) return false;
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map(c => c + c)
          .join('')
      : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return false;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.34;
}

interface CornerWordmarkMetrics {
  titleFontPx: number;
  subFontPx: number;
  marginX: number;
  marginY: number;
  lineGap: number;
  estBlockW: number;
  estBlockH: number;
}

/**
 * Pure scale-invariant typographic metrics (zero logo, zero background box, zero clamps).
 * Shared horizontal marginX (2.4%) and vertical bottom marginY (2.8%) align both the
 * right-bottom Tacstem wordmark and left-bottom user creator watermark on the exact same line.
 */
function computeCornerWordmarkMetrics(canonW: number, canonH: number): CornerWordmarkMetrics {
  const shortSide = Math.max(1, Math.min(canonW, canonH));
  const titleFontPx = shortSide * 0.028; // ~30px on 1080p
  const subFontPx = shortSide * 0.013; // ~14px on 1080p
  const marginX = canonW * 0.024;
  const marginY = canonH * 0.028;
  const lineGap = subFontPx * 1.28;
  const estBlockW = titleFontPx * 5.2;
  const estBlockH = titleFontPx * 1.35 + lineGap;

  return {
    titleFontPx,
    subFontPx,
    marginX,
    marginY,
    lineGap,
    estBlockW,
    estBlockH,
  };
}

/**
 * Computes exact normalized layout ratios for verification that live editor canvases
 * and exported videos (720p, 1080p, 4K) maintain 1:1 identical proportions.
 */
export function getNormalizedWatermarkLayout(
  viewportWidth: number,
  viewportHeight: number,
  _tier: WatermarkTier
): NormalizedWatermarkLayout {
  const { canonW, canonH } = resolveCanonicalDimensions(viewportWidth, viewportHeight);
  const metrics = computeCornerWordmarkMetrics(canonW, canonH);
  const shortSide = Math.min(canonW, canonH);
  const stepX = shortSide * 0.31;
  const stepY = shortSide * 0.175;
  const diag = Math.hypot(canonW, canonH);

  return {
    wordmarkHeightRatio: metrics.titleFontPx / canonH,
    sublineHeightRatio: metrics.subFontPx / canonH,
    rightMarginRatio: metrics.marginX / canonW,
    leftMarginRatio: metrics.marginX / canonW,
    bottomMarginRatio: metrics.marginY / canonH,
    freeGridCols: Math.ceil(diag / stepX) + 2,
    freeGridRows: Math.ceil(diag / stepY) + 2,
  };
}

/**
 * Paints a pure, unboxed broadcast typographic wordmark ("Tacstem" + "tacstem.com")
 * right-aligned at (rightAnchorX, bottomAnchorY).
 */
function paintPureCornerWordmark(
  ctx: AnyCanvasContext,
  rightAnchorX: number,
  bottomAnchorY: number,
  metrics: CornerWordmarkMetrics,
  masterAlpha: number
): void {
  const { titleFontPx, subFontPx, lineGap } = metrics;

  ctx.save();
  ctx.globalAlpha *= masterAlpha;
  ctx.textBaseline = 'alphabetic';

  // Optical drop-shadow for contrast without any background box
  ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
  ctx.shadowBlur = titleFontPx * 0.24;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = titleFontPx * 0.05;

  // 1. Primary wordmark ("Tac" + "stem"), right-aligned to rightAnchorX
  ctx.font = `800 ${titleFontPx.toFixed(2)}px ${BRAND_FONT_STACK}`;
  const tacW = ctx.measureText('Tac')?.width || titleFontPx * 1.58;
  const stemW = ctx.measureText('stem')?.width || titleFontPx * 2.25;
  const wordStartX = rightAnchorX - (tacW + stemW);
  const titleBaselineY = bottomAnchorY - lineGap;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#c6ff1f';
  ctx.fillText('Tac', wordStartX, titleBaselineY);

  ctx.fillStyle = '#ffffff';
  ctx.fillText('stem', wordStartX + tacW, titleBaselineY);

  // 2. Subtle domain sub-line right-aligned directly below
  ctx.textAlign = 'right';
  ctx.font = `600 ${subFontPx.toFixed(2)}px ${BRAND_FONT_STACK}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.68)';
  ctx.fillText('tacstem.com', rightAnchorX, bottomAnchorY);

  ctx.restore();
}

/**
 * Renders the Pro user right-bottom pure typographic watermark (no logo, no background box).
 */
function renderProCornerWatermark(ctx: AnyCanvasContext, vp: WatermarkViewport): void {
  const { canonW, canonH, scaleX, scaleY } = resolveCanonicalDimensions(vp.w, vp.h);
  const metrics = computeCornerWordmarkMetrics(canonW, canonH);
  const padShadow = Math.ceil(metrics.titleFontPx * 0.45);
  const spriteW = Math.ceil(metrics.estBlockW + padShadow * 2);
  const spriteH = Math.ceil(metrics.estBlockH + padShadow * 2);
  const cacheKey = `pro_text_${Math.round(metrics.titleFontPx * 100)}`;

  const rightAnchorX = canonW - metrics.marginX;
  const bottomAnchorY = canonH - metrics.marginY;

  let cached = proTextCache.get(cacheKey);
  if (!cached) {
    const surface = createScratchSurface(spriteW, spriteH);
    if (surface) {
      paintPureCornerWordmark(
        surface.ctx,
        spriteW - padShadow,
        spriteH - padShadow,
        metrics,
        0.86
      );
      if (proTextCache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = proTextCache.keys().next().value;
        if (oldestKey) proTextCache.delete(oldestKey);
      }
      proTextCache.set(cacheKey, surface);
      cached = surface;
    }
  }

  ctx.save();
  if (typeof (ctx as any).rect === 'function' && typeof (ctx as any).clip === 'function') {
    ctx.beginPath();
    (ctx as any).rect(vp.x, vp.y, vp.w, vp.h);
    (ctx as any).clip();
  }
  enableHighQualitySmoothing(ctx);

  if (cached) {
    const canonSpriteLeft = rightAnchorX - (spriteW - padShadow);
    const canonSpriteTop = bottomAnchorY - (spriteH - padShadow);
    ctx.drawImage(
      cached.canvas as any,
      vp.x + canonSpriteLeft * scaleX,
      vp.y + canonSpriteTop * scaleY,
      spriteW * scaleX,
      spriteH * scaleY
    );
  } else {
    ctx.save();
    ctx.translate(vp.x, vp.y);
    ctx.scale(scaleX, scaleY);
    paintPureCornerWordmark(ctx, rightAnchorX, bottomAnchorY, metrics, 0.86);
    ctx.restore();
  }

  ctx.restore();
}

function paintFreeFullViewportPattern(
  targetCtx: AnyCanvasContext,
  canonW: number,
  canonH: number
): void {
  const shortSide = Math.max(1, Math.min(canonW, canonH));

  // 1. Full-frame low-opacity diagonal brick-staggered pure text grid (-24 deg)
  const stepX = shortSide * 0.31;
  const stepY = shortSide * 0.175;
  const labelPx = shortSide * 0.025;
  const subLabelPx = shortSide * 0.013;

  const diag = Math.hypot(canonW, canonH);

  targetCtx.save();
  targetCtx.translate(canonW / 2, canonH / 2);
  safeRotate(targetCtx, (-24 * Math.PI) / 180);

  targetCtx.textAlign = 'center';
  targetCtx.textBaseline = 'middle';

  // Soft low-opacity dark halo so white text remains subtly legible on bright white shirts/lines
  targetCtx.shadowColor = 'rgba(0, 0, 0, 0.22)';
  targetCtx.shadowBlur = labelPx * 0.18;
  targetCtx.shadowOffsetX = 0;
  targetCtx.shadowOffsetY = labelPx * 0.04;

  const cols = Math.ceil(diag / stepX) + 2;
  const rows = Math.ceil(diag / stepY) + 2;

  for (let row = -rows; row <= rows; row++) {
    const rowOffset = (Math.abs(row) % 2) * (stepX * 0.5);
    const y = row * stepY;

    for (let col = -cols; col <= cols; col++) {
      const x = col * stepX + rowOffset;

      targetCtx.font = `800 ${labelPx.toFixed(2)}px ${BRAND_FONT_STACK}`;
      targetCtx.fillStyle = 'rgba(255, 255, 255, 0.135)';
      targetCtx.fillText('TACSTEM', x, y - subLabelPx * 0.35);

      targetCtx.font = `600 ${subLabelPx.toFixed(2)}px ${BRAND_FONT_STACK}`;
      targetCtx.fillStyle = 'rgba(255, 255, 255, 0.095)';
      targetCtx.fillText('tacstem.com', x, y + labelPx * 0.58);
    }
  }

  targetCtx.restore();

  // 2. Clean unboxed right-bottom typographic wordmark for instant readability on social shares
  const cornerMetrics = computeCornerWordmarkMetrics(canonW, canonH);
  paintPureCornerWordmark(
    targetCtx,
    canonW - cornerMetrics.marginX,
    canonH - cornerMetrics.marginY,
    cornerMetrics,
    0.76
  );
}

/**
 * Renders the Free user full-video low-opacity pure typographic watermark.
 */
function renderFreeFullFrameWatermark(ctx: AnyCanvasContext, vp: WatermarkViewport): void {
  const { canonW, canonH, scaleX, scaleY } = resolveCanonicalDimensions(vp.w, vp.h);
  const safeCanonW = Math.max(1, Math.round(canonW));
  const safeCanonH = Math.max(1, Math.round(canonH));
  const cacheKey = `free_text_${safeCanonW}x${safeCanonH}`;

  let cached = freeFullOverlayCache.get(cacheKey);
  if (!cached) {
    const surface = createScratchSurface(safeCanonW, safeCanonH);
    if (surface) {
      paintFreeFullViewportPattern(surface.ctx, safeCanonW, safeCanonH);
      if (freeFullOverlayCache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = freeFullOverlayCache.keys().next().value;
        if (oldestKey) freeFullOverlayCache.delete(oldestKey);
      }
      freeFullOverlayCache.set(cacheKey, surface);
      cached = surface;
    }
  }

  ctx.save();
  if (typeof (ctx as any).rect === 'function' && typeof (ctx as any).clip === 'function') {
    ctx.beginPath();
    (ctx as any).rect(vp.x, vp.y, vp.w, vp.h);
    (ctx as any).clip();
  }
  enableHighQualitySmoothing(ctx);

  if (cached) {
    ctx.drawImage(cached.canvas as any, vp.x, vp.y, vp.w, vp.h);
  } else {
    ctx.save();
    ctx.translate(vp.x, vp.y);
    ctx.scale(scaleX, scaleY);
    paintFreeFullViewportPattern(ctx, safeCanonW, safeCanonH);
    ctx.restore();
  }

  ctx.restore();
}

function drawClippedCreatorImage(
  ctx: AnyCanvasContext,
  imgSource: CanvasImageSource,
  x: number,
  y: number,
  drawW: number,
  drawH: number,
  shape: 'original' | 'rounded' | 'circle'
): void {
  ctx.save();
  if (shape === 'circle') {
    const size = Math.min(drawW, drawH);
    const cx = x + drawW / 2;
    const cy = y + drawH / 2;
    if (typeof (ctx as any).arc === 'function' && typeof (ctx as any).clip === 'function') {
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
      (ctx as any).clip();
    }
  } else if (shape === 'rounded') {
    const r = Math.min(drawW, drawH) * 0.22;
    if (typeof (ctx as any).roundRect === 'function' && typeof (ctx as any).clip === 'function') {
      ctx.beginPath();
      (ctx as any).roundRect(x, y, drawW, drawH, r);
      (ctx as any).clip();
    }
  }
  ctx.drawImage(imgSource as any, x, y, drawW, drawH);
  ctx.restore();
}

/**
 * Renders the user's custom Creator Watermark on the LEFT-BOTTOM of the viewport,
 * aligned on the exact same horizontal bottom line (canonH - marginY) as the right-bottom
 * Tacstem watermark. Supports bold white/black/custom text, font choice, size scaling,
 * and an optional nearby image/crest on either side of the text.
 */
function renderCreatorLeftBottomWatermark(
  ctx: AnyCanvasContext,
  vp: WatermarkViewport,
  config: CreatorWatermarkConfig
): void {
  if (!hasActiveCreatorWatermark(config)) return;

  const { canonW, canonH, scaleX, scaleY } = resolveCanonicalDimensions(vp.w, vp.h);
  const baseMetrics = computeCornerWordmarkMetrics(canonW, canonH);
  const scaleMul = Math.max(0.55, Math.min(2.4, config.sizeScale || 1));

  const fontSize = baseMetrics.titleFontPx * scaleMul;
  const leftAnchorX = baseMetrics.marginX;
  const bottomAnchorY = canonH - baseMetrics.marginY;
  const fontFamily = resolveCreatorFontFamily(config.fontId);
  const cleanText = (config.text || '').trim();
  const imgSource = getOrQueueCreatorImageSync(config.imageDataUrl);

  ctx.save();
  if (typeof (ctx as any).rect === 'function' && typeof (ctx as any).clip === 'function') {
    ctx.beginPath();
    (ctx as any).rect(vp.x, vp.y, vp.w, vp.h);
    (ctx as any).clip();
  }
  enableHighQualitySmoothing(ctx);

  ctx.translate(vp.x, vp.y);
  ctx.scale(scaleX, scaleY);
  ctx.globalAlpha *= 0.92;

  // Measure nearby image if present
  let imgDrawW = 0;
  let imgDrawH = 0;
  if (imgSource) {
    const natW = (imgSource as any).naturalWidth || (imgSource as any).width || 64;
    const natH = (imgSource as any).naturalHeight || (imgSource as any).height || 64;
    const targetImgH = fontSize * 1.28;
    const aspect = natH > 0 ? natW / natH : 1;
    imgDrawH = targetImgH;
    imgDrawW =
      config.imageShape === 'circle'
        ? targetImgH
        : Math.min(targetImgH * 2.6, Math.max(targetImgH * 0.5, targetImgH * aspect));
  }

  const gap = imgSource && cleanText ? fontSize * 0.34 : 0;
  ctx.font = `800 ${fontSize.toFixed(2)}px ${fontFamily}`;
  const measuredTextW = cleanText
    ? ctx.measureText(cleanText)?.width || cleanText.length * fontSize * 0.56
    : 0;

  // Align text & image vertically along bottomAnchorY (same bottom line as right-bottom watermark)
  const textBaselineY = bottomAnchorY - fontSize * 0.14;
  const visualCenterY = textBaselineY - fontSize * 0.34;
  const imgY = visualCenterY - imgDrawH / 2;

  const imageOnRight = config.imagePosition === 'right';
  const imgX = imageOnRight ? leftAnchorX + measuredTextW + gap : leftAnchorX;
  const textX = imageOnRight ? leftAnchorX : leftAnchorX + (imgSource ? imgDrawW + gap : 0);

  // Draw optional nearby image with subtle drop-shadow
  if (imgSource && imgDrawW > 0 && imgDrawH > 0) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = fontSize * 0.2;
    ctx.shadowOffsetY = fontSize * 0.04;
    drawClippedCreatorImage(
      ctx,
      imgSource,
      imgX,
      imgY,
      imgDrawW,
      imgDrawH,
      config.imageShape || 'original'
    );
    ctx.restore();
  }

  // Draw bold creator text with luminance-aware optical contrast (supports both White & Black bold text)
  if (cleanText) {
    ctx.save();
    ctx.font = `800 ${fontSize.toFixed(2)}px ${fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    const darkText = isDarkHexColor(config.color || '#ffffff');
    if (darkText) {
      ctx.shadowColor = 'rgba(255, 255, 255, 0.55)';
      ctx.shadowBlur = fontSize * 0.2;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    } else {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.74)';
      ctx.shadowBlur = fontSize * 0.24;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = fontSize * 0.05;
    }

    ctx.fillStyle = config.color || '#ffffff';
    ctx.fillText(cleanText, textX, textBaselineY);
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Unified Tacstem Watermark Compositor across Live Editor Canvases, Workspace MP4 Export,
 * Live Screen/Canvas Recorder, Turbo Video Export, and Tactical Board Video/PNG Export.
 *
 * - Right-Bottom / Full-Frame: Tacstem tier watermark ('none' for Admin, 'pro' corner wordmark, 'free' full-frame grid).
 * - Left-Bottom (same horizontal baseline): User's custom Creator Watermark (bold text + optional nearby image).
 */
export function renderWatermarkOverlay(
  ctx: AnyCanvasContext,
  options: RenderWatermarkOptions
): void {
  const {
    tier,
    targetWidth,
    targetHeight,
    viewport,
    creatorWatermark,
    suppressCreatorWatermark = false,
  } = options;

  const vp: WatermarkViewport =
    viewport && viewport.w > 0 && viewport.h > 0
      ? viewport
      : { x: 0, y: 0, w: targetWidth, h: targetHeight };

  if (vp.w <= 0 || vp.h <= 0) return;

  if (tier === 'pro') {
    renderProCornerWatermark(ctx, vp);
  } else if (tier === 'free') {
    renderFreeFullFrameWatermark(ctx, vp);
  }

  if (!suppressCreatorWatermark && creatorWatermark && hasActiveCreatorWatermark(creatorWatermark)) {
    renderCreatorLeftBottomWatermark(ctx, vp, creatorWatermark);
  }
}
