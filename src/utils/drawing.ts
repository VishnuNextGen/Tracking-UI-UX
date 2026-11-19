import type { Point, Particle, Rect, Shape, FreezeFrame } from '../types';
import { fadeColor, adjustBrightness, shiftColor, getContrastColor } from './colors';

export type AnyCanvasContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export const createParticles = (count: number = 30): Particle[] => {
  const arr: Particle[] = [];
  for (let i = 0; i < count; i++) {
    arr.push({
      initialAngle: Math.random() * Math.PI * 2,
      speed: 0.002 + Math.random() * 0.003
    });
  }
  return arr;
};

export const drawArrowHead = (ctx: AnyCanvasContext, from: Point, to: Point, size: number, isShadow: boolean = false) => {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - size * Math.cos(angle - Math.PI / 6), to.y - size * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(to.x - size * Math.cos(angle + Math.PI / 6), to.y - size * Math.sin(angle + Math.PI / 6));
  ctx.lineTo(to.x, to.y);
  ctx.fill();
};

export const drawTacticalArrowHead = (
  ctx: AnyCanvasContext,
  from: Point,
  to: Point,
  size: number,
  color: string,
  lineWidth: number = 2
) => {
  if (!from || !to || !Number.isFinite(from.x) || !Number.isFinite(to.x)) return;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const headLength = Math.max(14, size);
  const tipX = to.x;
  const tipY = to.y;
  const barb1x = tipX - headLength * Math.cos(angle - Math.PI / 6);
  const barb1y = tipY - headLength * Math.sin(angle - Math.PI / 6);
  const barb2x = tipX - headLength * Math.cos(angle + Math.PI / 6);
  const barb2y = tipY - headLength * Math.sin(angle + Math.PI / 6);

  // Ground drop shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;
  ctx.beginPath();
  ctx.moveTo(barb1x, barb1y);
  ctx.lineTo(tipX, tipY);
  ctx.lineTo(barb2x, barb2y);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fill();
  ctx.restore();

  // 3D Beveled gradient fill & outline
  ctx.save();
  const grad = createSafeLinearGradient(ctx, barb1x, barb1y, barb2x, barb2y);
  if (grad) {
    grad.addColorStop(0, adjustBrightness(color, 25));
    grad.addColorStop(0.5, color);
    grad.addColorStop(1, shiftColor(color, -25));
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = color;
  }
  ctx.beginPath();
  ctx.moveTo(barb1x, barb1y);
  ctx.lineTo(tipX, tipY);
  ctx.lineTo(barb2x, barb2y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = adjustBrightness(color, 45);
  ctx.lineWidth = Math.max(1, lineWidth * 0.25);
  ctx.stroke();
  ctx.restore();
};

export const drawDashedLine = (ctx: CanvasRenderingContext2D, p1: Point, p2: Point, color: string, width: number = 2) => {
  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash([width * 2, width * 2]);
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
  ctx.restore();
};

export const drawLabel = (ctx: any, p: Point, text: string, scale: number) => {
  ctx.save();
  const fontSize = 11 / scale;
  ctx.font = `500 ${fontSize}px Inter, sans-serif`;
  const metrics = ctx.measureText(text);
  const paddingX = 8 / scale;
  const h = 22 / scale;
  const w = metrics.width + paddingX * 2;
  const x = p.x + (15 / scale);
  const y = p.y + (15 / scale);
  const radius = 4 / scale;
  
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 4 / scale;
  ctx.fillStyle = 'rgba(20, 20, 20, 0.85)';
  ctx.beginPath();
  if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, radius);
  } else {
      ctx.rect(x, y, w, h);
  }
  ctx.fill();
  
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1 / scale;
  ctx.stroke();
  
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.shadowBlur = 0;
  ctx.fillText(text, x + paddingX, y + h/2 + (1/scale));
  ctx.restore();
};

export const createSafeLinearGradient = (
    ctx: CanvasRenderingContext2D | AnyCanvasContext,
    x0: number,
    y0: number,
    x1: number,
    y1: number
): CanvasGradient | null => {
    if (
        !ctx ||
        !Number.isFinite(x0) || !Number.isFinite(y0) || 
        !Number.isFinite(x1) || !Number.isFinite(y1)
    ) {
        return null;
    }
    try {
        const grad = ctx.createLinearGradient(x0, y0, x1, y1);
        if (!grad) return null;
        const origAddStop = grad.addColorStop.bind(grad);
        grad.addColorStop = (offset: number, color: string) => {
            if (!Number.isFinite(offset)) return;
            const clamped = Math.max(0, Math.min(1, offset));
            try {
                origAddStop(clamped, color);
            } catch {
                // Safeguard against invalid color strings
            }
        };
        return grad;
    } catch {
        return null;
    }
};

export const createSafeRadialGradient = (
    ctx: CanvasRenderingContext2D | AnyCanvasContext,
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number
): CanvasGradient | null => {
    if (
        !ctx ||
        !Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(r0) ||
        !Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(r1) ||
        r0 < 0 || r1 < 0
    ) {
        return null;
    }
    try {
        const grad = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
        if (!grad) return null;
        const origAddStop = grad.addColorStop.bind(grad);
        grad.addColorStop = (offset: number, color: string) => {
            if (!Number.isFinite(offset)) return;
            const clamped = Math.max(0, Math.min(1, offset));
            try {
                origAddStop(clamped, color);
            } catch {
                // Safeguard against invalid color strings
            }
        };
        return grad;
    } catch {
        return null;
    }
};

export const getShimmerGradient = (ctx: AnyCanvasContext, p1: Point, p2: Point, color: string, isPreview: boolean): CanvasGradient | string => {
    if (!p1 || !p2 || !Number.isFinite(p1.x) || !Number.isFinite(p1.y) || !Number.isFinite(p2.x) || !Number.isFinite(p2.y)) {
        return color;
    }
    const grad = createSafeLinearGradient(ctx, p1.x, p1.y, p2.x, p2.y);
    if (!grad) return color;

    const shimmerSpeed = 0.001; 
    const shimmerOffset = (Date.now() * shimmerSpeed) % 2; 

    if (isPreview) {
        grad.addColorStop(0, fadeColor(color, 0.2));
        grad.addColorStop(0.5, color);
        grad.addColorStop(1, fadeColor(color, 0.2));
    } else {
        const stop1 = Math.max(0, Math.min(1, shimmerOffset - 0.2));
        const stop2 = Math.max(0, Math.min(1, shimmerOffset));
        const stop3 = Math.max(0, Math.min(1, shimmerOffset + 0.2));
        grad.addColorStop(0, fadeColor(color, 0.6));
        if (stop2 > 0 && stop2 < 1) {
             grad.addColorStop(stop1, color);
             grad.addColorStop(stop2, '#ffffff'); 
             grad.addColorStop(stop3, color);
        } else {
             grad.addColorStop(0.5, color);
        }
        grad.addColorStop(1, fadeColor(color, 0.6));
    }
    return grad;
};

export const drawFreehandArrow = (ctx: AnyCanvasContext, points: Point[], color: string, thickness: number, isDashed: boolean, timestamp: number, isPreview: boolean, animProgress?: number) => {
    if (points.length < 2) return;

    let pts = points;
    if (animProgress !== undefined && animProgress < 1) {
        if (animProgress <= 0.001) return;
        let totalLen = 0;
        const dists: number[] = [];
        for (let i = 1; i < points.length; i++) {
            const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
            dists.push(d);
            totalLen += d;
        }
        const targetLen = totalLen * Math.max(0, Math.min(1, animProgress));
        let accum = 0;
        const trimmed: Point[] = [points[0]];
        for (let i = 0; i < dists.length; i++) {
            const d = dists[i];
            if (accum + d <= targetLen) {
                trimmed.push(points[i + 1]);
                accum += d;
            } else {
                const rem = targetLen - accum;
                const frac = d > 0 ? rem / d : 0;
                trimmed.push({
                    x: points[i].x + (points[i + 1].x - points[i].x) * frac,
                    y: points[i].y + (points[i + 1].y - points[i].y) * frac
                });
                break;
            }
        }
        if (trimmed.length < 2) return;
        pts = trimmed;
    }
    
    const pStart = pts[0];
    const pEnd = pts[pts.length - 1];

    // 1. Calculate a stable angle by looking back along the path
    let pPrev = pts.length > 1 ? pts[pts.length - 2] : pStart;
    for (let i = pts.length - 2; i >= 0; i--) {
        if (Math.hypot(pEnd.x - pts[i].x, pEnd.y - pts[i].y) > 15) {
            pPrev = pts[i];
            break;
        }
    }
    const angle = Math.atan2(pEnd.y - pPrev.y, pEnd.x - pPrev.x);

    // 2. Head dimensions
    const headSize = Math.max(thickness * 3.5, 16); 
    const headLength = headSize * 0.9;
    const shortenDist = headLength * Math.cos(Math.PI / 6) * 0.85;

    // 3. Collect points for the line body, stopping before the arrowhead
    const pathPoints: Point[] = [];
    for (let i = 0; i < pts.length; i++) {
        const dEnd = Math.hypot(pEnd.x - pts[i].x, pEnd.y - pts[i].y);
        if (dEnd > shortenDist) {
            pathPoints.push(pts[i]);
        }
    }
    
    // Fallback if path is very short
    if (pathPoints.length === 0) pathPoints.push(pStart);
    
    // Add the exact explicit cutoff point
    const lineEndX = pEnd.x - Math.cos(angle) * shortenDist;
    const lineEndY = pEnd.y - Math.sin(angle) * shortenDist;
    pathPoints.push({ x: lineEndX, y: lineEndY });

    const makePath = () => {
        if (pathPoints.length === 0) return;
        ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
        for (let i = 1; i < pathPoints.length - 2; i++) {
            const xc = (pathPoints[i].x + pathPoints[i + 1].x) / 2;
            const yc = (pathPoints[i].y + pathPoints[i + 1].y) / 2;
            ctx.quadraticCurveTo(pathPoints[i].x, pathPoints[i].y, xc, yc);
        }
        if (pathPoints.length > 2) {
            ctx.quadraticCurveTo(
                pathPoints[pathPoints.length - 2].x, 
                pathPoints[pathPoints.length - 2].y, 
                pathPoints[pathPoints.length - 1].x, 
                pathPoints[pathPoints.length - 1].y
            );
        } else if (pathPoints.length === 2) {
            ctx.lineTo(pathPoints[1].x, pathPoints[1].y);
        }
    };

    const drawHead = (isShadow: boolean) => {
        const tipX = pEnd.x;
        const tipY = pEnd.y;
        const barb1x = tipX - headLength * Math.cos(angle - Math.PI / 6);
        const barb1y = tipY - headLength * Math.sin(angle - Math.PI / 6);
        const barb2x = tipX - headLength * Math.cos(angle + Math.PI / 6);
        const barb2y = tipY - headLength * Math.sin(angle + Math.PI / 6);
        
        ctx.beginPath();
        ctx.moveTo(barb1x, barb1y);
        ctx.lineTo(tipX, tipY);
        ctx.lineTo(barb2x, barb2y);
        ctx.closePath();
        
        if (isShadow) {
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fill();
        } else {
            const grad = createSafeLinearGradient(ctx, barb1x, barb1y, barb2x, barb2y);
            if (grad) {
                grad.addColorStop(0, adjustBrightness(color, 20));
                grad.addColorStop(0.5, color);
                grad.addColorStop(1, shiftColor(color, -20));
                ctx.fillStyle = grad;
            } else {
                ctx.fillStyle = color;
            }
            ctx.fill();
            ctx.strokeStyle = adjustBrightness(color, 40);
            ctx.lineWidth = Math.max(1, thickness * 0.2);
            ctx.stroke();
        }
    };

    // Draw Ground Shadow
    if (!isPreview) {
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = thickness;
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = Math.max(4, thickness); 
        ctx.beginPath();
        makePath();
        ctx.stroke();
        
        drawHead(true);
        ctx.restore();
    }

    // Draw Main Body
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = thickness;
    
    ctx.strokeStyle = getShimmerGradient(ctx, pStart, pEnd, color, isPreview);
    if (isDashed) ctx.setLineDash([thickness * 2, thickness * 1.5]);
    if (!isPreview) { ctx.shadowColor = color; ctx.shadowBlur = 12; }
    
    ctx.beginPath();
    makePath();
    ctx.stroke();
    
    // Inner Highlight
    if (!isDashed && thickness > 3) {
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = thickness * 0.3;
      ctx.translate(-thickness * 0.15, -thickness * 0.15); 
      ctx.beginPath();
      makePath();
      ctx.stroke();
      ctx.restore();
    }

    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    drawHead(false);
    ctx.restore();
};

export const drawProArrow = (ctx: AnyCanvasContext, p1: Point, p2: Point, color: string, thickness: number, isDashed: boolean, timestamp: number, isPreview: boolean = false, animProgress?: number) => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const angle = Math.atan2(dy, dx);
    const length = Math.sqrt(dx*dx + dy*dy);
    const duration = 500; 
    const age = isPreview ? duration : (Date.now() - timestamp);
    const progress = animProgress !== undefined ? Math.max(0, animProgress) : Math.max(0, Math.min(1, age / duration));
    if (length < 1) return;
    const currentLength = length * progress;
    const currentEndX = p1.x + Math.cos(angle) * currentLength;
    const currentEndY = p1.y + Math.sin(angle) * currentLength;
    const headSize = Math.max(thickness * 3, 15); 
    const headLength = headSize * 0.9;
    const shortenDist = headLength * Math.cos(Math.PI / 6) * 0.85;
    let lineEndX = currentEndX;
    let lineEndY = currentEndY;
    const hasHead = currentLength > shortenDist || isPreview;
    if (hasHead) {
        lineEndX = currentEndX - Math.cos(angle) * shortenDist;
        lineEndY = currentEndY - Math.sin(angle) * shortenDist;
    }
    
    // Draw Ground Shadow
    if (!isPreview) {
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = thickness;
        if (isDashed) {
            ctx.setLineDash([thickness * 2, thickness * 1.5]);
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = Math.max(4, thickness); // Drop shadow down giving height
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        if (currentLength > 0) { ctx.lineTo(lineEndX, lineEndY); ctx.stroke(); }
        if (hasHead) {
            const tipX = currentEndX;
            const tipY = currentEndY;
            const barb1x = tipX - headLength * Math.cos(angle - Math.PI / 6);
            const barb1y = tipY - headLength * Math.sin(angle - Math.PI / 6);
            const barb2x = tipX - headLength * Math.cos(angle + Math.PI / 6);
            const barb2y = tipY - headLength * Math.sin(angle + Math.PI / 6);
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(barb1x, barb1y);
            ctx.lineTo(tipX, tipY);
            ctx.lineTo(barb2x, barb2y);
            ctx.closePath();
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fill();
        }
        ctx.restore();
    }

    // Draw Main Body
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = getShimmerGradient(ctx, p1, {x: currentEndX, y: currentEndY}, color, isPreview);
    ctx.lineWidth = thickness;
    if (isDashed) {
        ctx.setLineDash([thickness * 2, thickness * 1.5]);
    }
    if (!isPreview) { ctx.shadowColor = color; ctx.shadowBlur = 15; }
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    if (currentLength > 0) { ctx.lineTo(lineEndX, lineEndY); ctx.stroke(); }
    
    // Draw Inner Highlight to give cylindrical depth
    if (!isDashed && currentLength > 0 && thickness > 3) {
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = thickness * 0.3;
      ctx.beginPath();
      // small offset towards top-left to simulate light
      ctx.moveTo(p1.x - Math.sin(angle)*thickness*0.2, p1.y + Math.cos(angle)*thickness*0.2);
      ctx.lineTo(lineEndX - Math.sin(angle)*thickness*0.2, lineEndY + Math.cos(angle)*thickness*0.2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.shadowBlur = 0;
    ctx.setLineDash([]);
    
    if (hasHead) {
        const tipX = currentEndX;
        const tipY = currentEndY;
        const barb1x = tipX - headLength * Math.cos(angle - Math.PI / 6);
        const barb1y = tipY - headLength * Math.sin(angle - Math.PI / 6);
        const barb2x = tipX - headLength * Math.cos(angle + Math.PI / 6);
        const barb2y = tipY - headLength * Math.sin(angle + Math.PI / 6);
        
        ctx.beginPath();
        ctx.moveTo(barb1x, barb1y);
        ctx.lineTo(tipX, tipY);
        ctx.lineTo(barb2x, barb2y);
        ctx.closePath();
        
        // Gradient for arrow head to give it a 3D bevel
        const grad = createSafeLinearGradient(ctx, barb1x, barb1y, barb2x, barb2y);
        if (grad) {
            grad.addColorStop(0, adjustBrightness(color, 20));
            grad.addColorStop(0.5, color);
            grad.addColorStop(1, shiftColor(color, -20));
            ctx.fillStyle = grad;
        } else {
            ctx.fillStyle = color;
        }
        ctx.fill();
        ctx.strokeStyle = adjustBrightness(color, 40); 
        ctx.lineWidth = Math.max(1, thickness * 0.2);
        ctx.stroke();
    }
    ctx.restore();
};

export type RingPattern = 'telemetry-8' | 'brackets-4' | 'stamina-12' | 'asymmetric-hud' | 'continuous';

export const getTacticalPatternSegments = (pattern: string = 'telemetry-8'): [number, number][] => {
  switch (pattern) {
    case 'brackets-4':
      // from -34deg, repeating 68deg span, 22deg gap
      return [
        [-34, -34 + 68],
        [-34 + 90, -34 + 90 + 68],
        [-34 + 180, -34 + 180 + 68],
        [-34 + 270, -34 + 270 + 68]
      ];
    case 'stamina-12':
      // from -11.5deg, repeating 23deg span, 7deg gap
      return Array.from({ length: 12 }, (_, i) => [
        -11.5 + i * 30,
        -11.5 + i * 30 + 23
      ]);
    case 'asymmetric-hud':
      // from -52deg, matching codex asymmetric conic gradient
      return [
        [-52, -52 + 104],
        [-52 + 117, -52 + 142],
        [-52 + 155, -52 + 172],
        [-52 + 181, -52 + 284],
        [-52 + 297, -52 + 322],
        [-52 + 335, -52 + 352]
      ];
    case 'continuous':
      return [[0, 360]];
    case 'telemetry-8':
    default:
      // from -19deg, repeating 38deg span, 7deg gap
      return Array.from({ length: 8 }, (_, i) => [
        -19 + i * 45,
        -19 + i * 45 + 38
      ]);
  }
};

export const draw3DRing = (
  ctx: AnyCanvasContext,
  x: number,
  y: number,
  radius: number,
  color: string,
  tiltDegrees: number = 65,
  strokeWidth: number = 0,
  timestamp: number = 0,
  isGhost: boolean = false,
  config: any = {},
  unifiedProgress?: number
) => {
  if (radius < 1 || !ctx || !Number.isFinite(x) || !Number.isFinite(y)) return;
  const now = Date.now();
  const timeElapsed = isGhost ? 99999 : (now - timestamp);

  const outlineColor = typeof config === 'string' ? config : (config?.outlineColor || '#ffffff');
  const secondaryRing = typeof config === 'object' ? Boolean(config?.secondaryRing) : false;
  const secondaryColor = typeof config === 'object' ? (config?.secondaryColor || '#00eaff') : '#00eaff';
  const secondaryPattern: RingPattern = typeof config === 'object' ? (config?.secondaryPattern || 'telemetry-8') : 'telemetry-8';
  const secondaryOrbit = typeof config === 'object' ? (config?.secondaryOrbit !== false) : true;
  const showGlint = typeof config === 'object' ? (config?.showGlint !== false) : true;

  // 1. Entrance animation (420ms cubic-bezier from broadcast codex)
  let scaleEnt = 1;
  let alphaEnt = 1;
  const entSpeed = 420;
  if (unifiedProgress !== undefined) {
    const p = Math.max(0, Math.min(1, unifiedProgress));
    alphaEnt = Math.min(1, p * 1.25);
    scaleEnt = Math.max(0.01, Math.min(1.06, 0.15 + 0.85 * Math.pow(p, 0.7)));
  } else if (!isGhost && timeElapsed < entSpeed) {
    const p = Math.max(0, Math.min(1, timeElapsed / entSpeed));
    alphaEnt = p;
    if (p < 0.58) {
      scaleEnt = 0.52 + (1.08 - 0.52) * (p / 0.58);
    } else {
      scaleEnt = 1.08 - 0.08 * ((p - 0.58) / 0.42);
    }
  }

  // Perspective tilt & foreshortening
  const safeTilt = Math.max(0, Math.min(85, tiltDegrees ?? 65));
  const tiltRad = (safeTilt * Math.PI) / 180;
  const scaleY = Math.max(0.12, Math.cos(tiltRad));

  // Proportional thickness calculation:
  // When both rings are used, automatically reduce the thickness of both rings (default ~50% slimmer)
  // so the dual-ring broadcast assembly remains sharp, sleek, and does not overwhelm the player.
  const thicknessFactor = secondaryRing 
    ? (typeof config === 'object' && config?.bandThickness !== undefined ? (config.bandThickness / 100) : 0.50)
    : 1.0;

  const outerR1 = radius;
  // Primary band width: 0.42 * radius when single, reduced by thicknessFactor when both rings are active
  const primaryBandWidth = Math.max(2.5, outerR1 * 0.42 * thicknessFactor);
  const innerR1 = outerR1 - primaryBandWidth;

  const secGap = Math.max(2.0, outerR1 * 0.05 * Math.max(0.6, thicknessFactor));
  const secWidth = Math.max(3.5, outerR1 * 0.38 * thicknessFactor);
  const rSecInner = outerR1 + secGap;
  const rSecOuter = rSecInner + secWidth;

  // Broadcast color palette shifts from codex:
  // --ring-color: base color
  // --ring-deep: shiftColor(color, -24)
  // --ring-dark: shiftColor(color, -48)
  // --ring-light: shiftColor(color, 30)
  // --ring-hot: shiftColor(color, 58)
  const ringColor = color || '#00eaff';
  const ringDeep = shiftColor(ringColor, -24);
  const ringDark = shiftColor(ringColor, -48);
  const ringLight = shiftColor(ringColor, 30);
  const ringHot = shiftColor(ringColor, 58);

  const secBaseColor = secondaryColor || '#00eaff';
  const secDeep = shiftColor(secBaseColor, -24);
  const secDark = shiftColor(secBaseColor, -48);
  const secLight = shiftColor(secBaseColor, 30);
  const secHot = shiftColor(secBaseColor, 58);

  const fadeHex = (hex: string, alpha: number) => {
    let hr = parseInt(hex.slice(1, 3), 16),
        hg = parseInt(hex.slice(3, 5), 16),
        hb = parseInt(hex.slice(5, 7), 16);
    if (isNaN(hr)) return hex;
    return `rgba(${hr},${hg},${hb},${Math.max(0, Math.min(1, alpha))})`;
  };

  // 3D extrusion wall height based on perspective tilt
  const depthSize = Math.max(1.5, Math.min(18, radius * 0.22 * (1 - scaleY)));

  // Ground Contact Shadow on the pitch turf (matching .ring .contact-shadow in codex)
  if (!isGhost) {
    ctx.save();
    const effectiveOuterR = secondaryRing ? rSecOuter : outerR1;
    const shadowOffsetY = depthSize * 0.85 + effectiveOuterR * (1 - scaleY) * 0.18;
    const shadowRx = effectiveOuterR * 1.05 * scaleEnt;
    const shadowRy = Math.max(2, effectiveOuterR * scaleY * 0.78 * scaleEnt);

    ctx.translate(x, y + shadowOffsetY);
    ctx.beginPath();
    if (typeof (ctx as any).ellipse === 'function') {
      (ctx as any).ellipse(0, 0, shadowRx, shadowRy, 0, 0, Math.PI * 2);
    } else {
      ctx.save();
      ctx.scale(1, shadowRy / shadowRx);
      ctx.arc(0, 0, shadowRx, 0, Math.PI * 2);
      ctx.restore();
    }

    const shadowGrad = createSafeRadialGradient(ctx, 0, 0, innerR1 * 0.75, 0, 0, shadowRx);
    if (shadowGrad) {
      shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      shadowGrad.addColorStop(0.55, `rgba(0, 0, 0, ${0.22 * alphaEnt})`);
      shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = shadowGrad;
    }
    ctx.fill();
    ctx.restore();
  }

  // Setup main transform
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scaleEnt, scaleEnt * scaleY);
  ctx.globalAlpha = Math.max(0, Math.min(1, alphaEnt * (isGhost ? 0.75 : 1.0)));

  const donutPathPrimary = () => {
    ctx.beginPath();
    ctx.arc(0, 0, outerR1, 0, Math.PI * 2);
    ctx.moveTo(innerR1, 0);
    ctx.arc(0, 0, innerR1, 0, Math.PI * 2, true);
    ctx.closePath();
  };

  // Outer Segmented Tactical Bar calculation & helper paths
  const secSegments = secondaryRing ? getTacticalPatternSegments(secondaryPattern) : [];
  // Orbit angle (slow counter-rotation at 14s period as in codex)
  const orbitPeriod = 14000;
  const orbitAngle = secondaryOrbit ? -((now % orbitPeriod) / orbitPeriod) * Math.PI * 2 : 0;

  const buildSecondaryPath = () => {
    ctx.beginPath();
    if (secSegments.length === 1 && (secSegments[0][1] - secSegments[0][0]) >= 359) {
      ctx.arc(0, 0, rSecOuter, 0, Math.PI * 2);
      ctx.moveTo(rSecInner, 0);
      ctx.arc(0, 0, rSecInner, 0, Math.PI * 2, true);
      ctx.closePath();
      return;
    }
    for (let s = 0; s < secSegments.length; s++) {
      const [sDeg, eDeg] = secSegments[s];
      const startRad = orbitAngle + (sDeg * Math.PI) / 180;
      const endRad = orbitAngle + (eDeg * Math.PI) / 180;
      // Explicit moveTo prevents Canvas from connecting the end of the previous segment to this arc with a chord
      ctx.moveTo(Math.cos(startRad) * rSecOuter, Math.sin(startRad) * rSecOuter);
      ctx.arc(0, 0, rSecOuter, startRad, endRad, false);
      ctx.lineTo(Math.cos(endRad) * rSecInner, Math.sin(endRad) * rSecInner);
      ctx.arc(0, 0, rSecInner, endRad, startRad, true);
      ctx.closePath();
    }
  };

  // 2. User Outline underlay (if strokeWidth > 0)
  if (strokeWidth > 0 && !isGhost) {
    ctx.save();
    const sOuter = outerR1 + strokeWidth;
    const sInner = Math.max(0.1, innerR1 - strokeWidth);
    const sDepth = depthSize + strokeWidth;

    const outlinePath = () => {
      ctx.beginPath();
      ctx.arc(0, 0, sOuter, 0, Math.PI * 2);
      ctx.moveTo(sInner, 0);
      ctx.arc(0, 0, sInner, 0, Math.PI * 2, true);
      ctx.closePath();
      if (secondaryRing) {
        if (secSegments.length === 1 && (secSegments[0][1] - secSegments[0][0]) >= 359) {
          ctx.moveTo(rSecOuter + strokeWidth, 0);
          ctx.arc(0, 0, rSecOuter + strokeWidth, 0, Math.PI * 2);
          ctx.moveTo(Math.max(0.1, rSecInner - strokeWidth), 0);
          ctx.arc(0, 0, Math.max(0.1, rSecInner - strokeWidth), 0, Math.PI * 2, true);
          ctx.closePath();
        } else {
          for (let s = 0; s < secSegments.length; s++) {
            const [sDeg, eDeg] = secSegments[s];
            const startRad = orbitAngle + (sDeg * Math.PI) / 180;
            const endRad = orbitAngle + (eDeg * Math.PI) / 180;
            const sOut = rSecOuter + strokeWidth;
            const sIn = Math.max(0.1, rSecInner - strokeWidth);
            ctx.moveTo(Math.cos(startRad) * sOut, Math.sin(startRad) * sOut);
            ctx.arc(0, 0, sOut, startRad, endRad, false);
            ctx.lineTo(Math.cos(endRad) * sIn, Math.sin(endRad) * sIn);
            ctx.arc(0, 0, sIn, endRad, startRad, true);
            ctx.closePath();
          }
        }
      }
    };

    ctx.fillStyle = outlineColor;
    if (depthSize > 0.5) {
      const step = Math.max(0.25, scaleY);
      for (let d = sDepth; d >= -strokeWidth; d -= step) {
        ctx.save();
        ctx.translate(0, d / scaleY);
        outlinePath();
        ctx.fill('evenodd');
        ctx.restore();
      }
    } else {
      outlinePath();
      ctx.fill('evenodd');
    }
    ctx.restore();
  }

  // =========================================================================
  // 3. SECONDARY OUTER 3D BROADCAST RING (Segmented Tactical Bars from Codex)
  // =========================================================================
  if (secondaryRing) {
    const secDepthSize = depthSize;
    const midSecR = (rSecOuter + rSecInner) / 2;

    // A. 3D Body Layers Extrusion (Extruded 3D depth sidewalls)
    if (secDepthSize > 0.5) {
      ctx.save();
      const step = Math.max(0.3, scaleY);

      for (let d = secDepthSize; d > 0; d -= step) {
        const ratio = d / secDepthSize;
        ctx.save();
        ctx.translate(0, d / scaleY);
        buildSecondaryPath();

        const depthColor = ratio > 0.6 ? secDark : (ratio > 0.3 ? secDeep : shiftColor(secBaseColor, -12));
        ctx.fillStyle = fadeHex(depthColor, 0.96);
        ctx.fill();
        ctx.restore();
      }

      // Shaded bottom edge rim accent
      ctx.save();
      ctx.translate(0, secDepthSize / scaleY);
      buildSecondaryPath();
      ctx.strokeStyle = fadeHex(shiftColor(secBaseColor, -60), 0.75);
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.restore();

      ctx.restore();
    }

    // B. Top Face Rotating Broadcast Conic Fill + Bloom Shadow
    ctx.save();
    ctx.shadowColor = fadeHex(secBaseColor, 0.45);
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 0;

    // Counter-rotating broadcast spin (2.85s period in reverse as in codex)
    const secSpinDuration = 2850;
    const secSpeedVariation = 0.85 + ((timestamp % 1000) / 1000) * 0.4;
    const actualSecDuration = secSpinDuration / secSpeedVariation;
    const secSpinOffset = ((now % actualSecDuration) / actualSecDuration);
    const secSpinAngle = -secSpinOffset * Math.PI * 2;

    try {
      const gradSec = ctx.createConicGradient(secSpinAngle - 0.38, 0, 0);
      gradSec.addColorStop(0, secHot);
      gradSec.addColorStop(0.06, secLight);
      gradSec.addColorStop(0.20, secBaseColor);
      gradSec.addColorStop(0.36, secDeep);
      gradSec.addColorStop(0.51, secDark);
      gradSec.addColorStop(0.69, secBaseColor);
      gradSec.addColorStop(0.84, secLight);
      gradSec.addColorStop(1, secHot);

      ctx.fillStyle = gradSec;
      buildSecondaryPath();
      ctx.fill();
    } catch {
      ctx.fillStyle = secBaseColor;
      buildSecondaryPath();
      ctx.fill();
    }
    ctx.restore();

    // D. Top-Left Specular Radial Gleam
    ctx.save();
    buildSecondaryPath();
    ctx.clip();
    const sGleamX = -rSecOuter * 0.32;
    const sGleamY = -rSecOuter * 0.32;
    const sGleamR = rSecOuter * 0.75;
    const sGleamGrad = createSafeRadialGradient(ctx, sGleamX, sGleamY, sGleamR * 0.05, sGleamX, sGleamY, sGleamR);
    if (sGleamGrad) {
      sGleamGrad.addColorStop(0, 'rgba(255, 255, 255, 0.88)');
      sGleamGrad.addColorStop(0.18, 'rgba(255, 255, 255, 0.28)');
      sGleamGrad.addColorStop(0.45, 'rgba(255, 255, 255, 0.04)');
      sGleamGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = sGleamGrad;
      ctx.fillRect(-rSecOuter * 1.2, -rSecOuter * 1.2, rSecOuter * 2.4, rSecOuter * 2.4);
    }
    ctx.restore();

    // E. Glass Surface Reflection
    ctx.save();
    buildSecondaryPath();
    ctx.clip();
    const sGlassGrad = createSafeLinearGradient(ctx, -rSecOuter * 0.9, -rSecOuter * 0.9, rSecOuter * 0.9, rSecOuter * 0.9);
    if (sGlassGrad) {
      sGlassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.48)');
      sGlassGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.06)');
      sGlassGrad.addColorStop(0.62, 'rgba(0, 0, 0, 0)');
      sGlassGrad.addColorStop(1, 'rgba(0, 0, 0, 0.16)');
      ctx.fillStyle = sGlassGrad;
      ctx.fillRect(-rSecOuter * 1.2, -rSecOuter * 1.2, rSecOuter * 2.4, rSecOuter * 2.4);
    }
    ctx.restore();

    // F. 3D Bevel Edge Highlights (Clean highlight with no lines inside the bars)
    ctx.save();
    buildSecondaryPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = Math.max(0.8, Math.min(1.2, secWidth * 0.16));
    ctx.stroke();
    ctx.restore();

    // G. Orbiting Specular Glint Streak Across the Bars
    if (showGlint) {
      ctx.save();
      const glintSecPeriod = 1600;
      const glintSecOffset = ((now + (timestamp % 1000)) % glintSecPeriod) / glintSecPeriod;
      const glintSecAngle = -glintSecOffset * Math.PI * 2;
      const glintSecThickness = secWidth * 0.72;

      ctx.save();
      buildSecondaryPath();
      ctx.clip();

      ctx.beginPath();
      ctx.arc(0, 0, midSecR, glintSecAngle - 0.22, glintSecAngle + 0.22);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
      ctx.lineWidth = glintSecThickness;
      ctx.lineCap = 'round';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 10;
      ctx.stroke();

      const flareSecX = Math.cos(glintSecAngle) * midSecR;
      const flareSecY = Math.sin(glintSecAngle) * midSecR;
      const flareSecR = Math.max(3, glintSecThickness * 0.55);
      const flareSecGrad = createSafeRadialGradient(ctx, flareSecX, flareSecY, 0, flareSecX, flareSecY, flareSecR);
      if (flareSecGrad) {
        flareSecGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        flareSecGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.85)');
        flareSecGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = flareSecGrad;
        ctx.beginPath();
        ctx.arc(flareSecX, flareSecY, flareSecR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.restore();
    }

    // H. Ambient Broadcast Glow & Definition Stroke
    ctx.save();
    buildSecondaryPath();
    ctx.shadowColor = fadeHex(secBaseColor, 0.5);
    ctx.shadowBlur = 12;
    ctx.strokeStyle = fadeHex(secBaseColor, 0.45);
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.restore();
  }

  // =========================================================================
  // 4. PRIMARY CONTINUOUS 3D BROADCAST RING
  // =========================================================================

  // 3D Body Layers & Extrusion (body-layer-3, 2, 1 in codex)
  if (depthSize > 0.5) {
    ctx.save();
    const step = Math.max(0.3, scaleY);

    for (let d = depthSize; d > 0; d -= step) {
      const ratio = d / depthSize;
      ctx.save();
      ctx.translate(0, d / scaleY);
      donutPathPrimary();

      // Shaded transition from deep dark tone at bottom to vibrant base at top
      const depthColor = ratio > 0.6 ? ringDark : (ratio > 0.3 ? ringDeep : shiftColor(ringColor, -12));
      ctx.fillStyle = fadeHex(depthColor, 0.96);
      ctx.fill('evenodd');
      ctx.restore();
    }

    // Bottom edge accent rim (crisp shaded bottom boundary for single ring mode)
    if (!secondaryRing) {
      ctx.save();
      ctx.translate(0, depthSize / scaleY);
      donutPathPrimary();
      ctx.strokeStyle = fadeHex(shiftColor(ringColor, -60), 0.75);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  // Main Top Face (Conic Broadcast Spin + Bloom)
  ctx.save();
  ctx.shadowColor = fadeHex(ringColor, 0.45);
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 0;

  // Spin calculation matching codex (2.35s period)
  const spinDuration = 2350;
  const speedVariation = 0.85 + ((timestamp % 1000) / 1000) * 0.4;
  const actualDuration = spinDuration / speedVariation;
  const spinOffset1 = ((now % actualDuration) / actualDuration);
  const spinAngle = spinOffset1 * Math.PI * 2;

  try {
    const grad1 = ctx.createConicGradient(spinAngle - 0.38, 0, 0);
    grad1.addColorStop(0, ringHot);
    grad1.addColorStop(0.06, ringLight);
    grad1.addColorStop(0.20, ringColor);
    grad1.addColorStop(0.36, ringDeep);
    grad1.addColorStop(0.51, ringDark);
    grad1.addColorStop(0.69, ringColor);
    grad1.addColorStop(0.84, ringLight);
    grad1.addColorStop(1, ringHot);

    ctx.fillStyle = grad1;
    donutPathPrimary();
    ctx.fill('evenodd');
  } catch (e) {
    ctx.fillStyle = ringColor;
    donutPathPrimary();
    ctx.fill('evenodd');
  }
  ctx.restore();

  // Concentric mid-groove accent track (single ring only: removed when dual ring is used)
  if (!secondaryRing) {
    ctx.save();
    ctx.beginPath();
    const midR = (outerR1 + innerR1) / 2;
    ctx.arc(0, 0, midR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = (outerR1 - innerR1) * 0.45;
    ctx.stroke();
    ctx.restore();
  }

  // Top-left Specular Radial Gleam (matching codex radial-gradient at 34% 22%)
  ctx.save();
  donutPathPrimary();
  ctx.clip();
  const gleamX = -outerR1 * 0.32;
  const gleamY = -outerR1 * 0.32;
  const gleamR = outerR1 * 0.72;
  const gleamGrad = createSafeRadialGradient(ctx, gleamX, gleamY, gleamR * 0.05, gleamX, gleamY, gleamR);
  if (gleamGrad) {
    gleamGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    gleamGrad.addColorStop(0.18, 'rgba(255, 255, 255, 0.28)');
    gleamGrad.addColorStop(0.45, 'rgba(255, 255, 255, 0.04)');
    gleamGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gleamGrad;
    ctx.fillRect(-outerR1, -outerR1, outerR1 * 2, outerR1 * 2);
  }
  ctx.restore();

  // Glass Gloss Reflection Overlay (matching .ring .glass in codex)
  ctx.save();
  donutPathPrimary();
  ctx.clip();
  const glassGrad = createSafeLinearGradient(ctx, -outerR1 * 0.9, -outerR1 * 0.9, outerR1 * 0.9, outerR1 * 0.9);
  if (glassGrad) {
    glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
    glassGrad.addColorStop(0.28, 'rgba(255, 255, 255, 0.05)');
    glassGrad.addColorStop(0.62, 'rgba(0, 0, 0, 0.0)');
    glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = glassGrad;
    ctx.fillRect(-outerR1, -outerR1, outerR1 * 2, outerR1 * 2);
  }
  ctx.restore();

  // Recessed Inner Hole & Rim Highlight (single ring only: removed when dual ring is used)
  if (!secondaryRing) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, innerR1, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  // Orbiting Specular Glint Streak (matching .ring .specular-streak in codex)
  if (showGlint) {
    ctx.save();
    const glintPeriod = 1200;
    const glintOffset = ((now + (timestamp % 1000)) % glintPeriod) / glintPeriod;
    const glintAngle = glintOffset * Math.PI * 2;
    const glintMidR = (outerR1 + innerR1) / 2;
    const glintThickness = (outerR1 - innerR1) * 0.75;

    ctx.beginPath();
    ctx.arc(0, 0, glintMidR, glintAngle - 0.22, glintAngle + 0.22);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = glintThickness;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.stroke();

    const flareX = Math.cos(glintAngle) * glintMidR;
    const flareY = Math.sin(glintAngle) * glintMidR;
    const flareR = Math.max(3, glintThickness * 0.55);
    const flareGrad = createSafeRadialGradient(ctx, flareX, flareY, 0, flareX, flareY, flareR);
    if (flareGrad) {
      flareGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      flareGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.85)');
      flareGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = flareGrad;
      ctx.beginPath();
      ctx.arc(flareX, flareY, flareR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Outer Crisp Broadcast Rim Strokes (single ring only: removed when dual ring is used)
  if (!secondaryRing) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, outerR1, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, outerR1 - 1, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
};

export const drawSpotlight = (
    ctx: AnyCanvasContext,
    x: number,
    y: number,
    size: number,
    intensity: number,
    rotation: number,
    particles: Particle[],
    timestamp: number,
    isGhost: boolean = false,
    unifiedProgress?: number
) => {
    const now = Date.now();
    const alpha = isGhost ? 0.4 : 1.0;
    const beamWidth = size;
    const topY = 0;
    const bottomY = y;

    ctx.save();
    const wipeDuration = 600;
    let wipeProgress = isGhost ? 1 : (timestamp ? Math.min(1, Math.max(0, now - timestamp) / wipeDuration) : 1);
    if (unifiedProgress !== undefined) {
        wipeProgress = Math.max(0, Math.min(1, unifiedProgress));
    }
    if (wipeProgress < 1) {
        ctx.beginPath();
        const yMax = bottomY + size * 1.5;
        ctx.rect(-99999, -100, 199998, 100 + yMax * wipeProgress);
        ctx.clip();
        ctx.globalAlpha = Math.min(1, wipeProgress * 1.25) * alpha;
    }

    ctx.save();
    const grad = createSafeLinearGradient(ctx, x, topY, x, bottomY);
    if (grad) {
        grad.addColorStop(0, `rgba(255,255,255,0)`);
        grad.addColorStop(0.5, `rgba(255,255,255,${intensity * 0.25 * alpha})`);
        grad.addColorStop(1, `rgba(255,255,255,${0.05 * alpha})`);
        ctx.fillStyle = grad;
    } else {
        ctx.fillStyle = `rgba(255,255,255,${0.1 * alpha})`;
    }
    ctx.beginPath(); ctx.moveTo(x - beamWidth / 4, topY); ctx.lineTo(x + beamWidth / 4, topY); ctx.lineTo(x + beamWidth / 2, bottomY); ctx.lineTo(x - beamWidth / 2, bottomY); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(x, bottomY);
    ctx.scale(1, rotation); 
    const ringRadius = beamWidth / 2;
    const ringGrad = createSafeRadialGradient(ctx, 0, 0, ringRadius * 0.3, 0, 0, ringRadius * 1.3);
    if (ringGrad) {
        ringGrad.addColorStop(0, `rgba(255,255,255,${0.9 * alpha})`);
        ringGrad.addColorStop(0.6, `rgba(255,255,255,${0.3 * alpha})`);
        ringGrad.addColorStop(1, `rgba(255,255,255,0)`);
        ctx.fillStyle = ringGrad;
    } else {
        ctx.fillStyle = `rgba(255,255,255,${0.3 * alpha})`;
    }
    ctx.beginPath(); ctx.arc(0, 0, ringRadius * 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${0.2 * intensity * alpha})`; 
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, ringRadius, 0, Math.PI * 2); ctx.stroke();
    if (!isGhost) {
        const timeDelta = now - timestamp;
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const currentAngle = p.initialAngle + (timeDelta * p.speed);
            const px = Math.cos(currentAngle) * ringRadius;
            const py = Math.sin(currentAngle) * ringRadius; 
            const flicker = 0.5 + 0.5 * Math.sin(timeDelta * 0.005 + i);
            ctx.fillStyle = `rgba(255,255,255,${0.6 * flicker})`;
            ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill();
        }
    }
    ctx.restore();
    ctx.restore(); // Restore global wipe clip
};

export const drawTangentLine = (
  ctx: AnyCanvasContext,
  p1: Point,
  p2: Point,
  r1: number,
  r2: number,
  color: string,
  strokeWidth: number,
  progress: number,
  pulseAge: number = 0,
  isGhost: boolean = false,
  tiltDegrees: number = 65,
  config: any = {}
) => {
  if (!ctx || !p1 || !p2 || !Number.isFinite(p1.x) || !Number.isFinite(p2.x)) return;
  const outlineColor = typeof config === 'string' ? config : (config?.outlineColor || '#ffffff');

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist <= (r1 + r2) * 0.6) return;
  const ux = dx / dist;
  const uy = dy / dist;

  // Perspective tilt & foreshortening
  const safeTilt = Math.max(0, Math.min(85, tiltDegrees ?? 65));
  const tiltRad = (safeTilt * Math.PI) / 180;
  const scaleY = Math.max(0.12, Math.cos(tiltRad));
  const depthSize = Math.max(1.5, Math.min(18, Math.min(r1, r2) * 0.22 * (1 - scaleY)));

  const secondaryRing = typeof config === 'object' ? Boolean(config?.secondaryRing) : false;
  const thicknessFactor = secondaryRing 
    ? (typeof config === 'object' && config?.bandThickness !== undefined ? (config.bandThickness / 100) : 0.50)
    : 1.0;
  const secGap1 = Math.max(2.0, r1 * 0.05 * Math.max(0.6, thicknessFactor));
  const secWidth1 = Math.max(3.5, r1 * 0.38 * thicknessFactor);
  const effectiveR1 = secondaryRing ? (r1 + secGap1 + secWidth1) : r1;

  const secGap2 = Math.max(2.0, r2 * 0.05 * Math.max(0.6, thicknessFactor));
  const secWidth2 = Math.max(3.5, r2 * 0.38 * thicknessFactor);
  const effectiveR2 = secondaryRing ? (r2 + secGap2 + secWidth2) : r2;

  // Calculate effective radius in connecting direction
  const r1Eff = (effectiveR1 * scaleY) / Math.sqrt(scaleY * scaleY * ux * ux + uy * uy);
  const r2Eff = (effectiveR2 * scaleY) / Math.sqrt(scaleY * scaleY * ux * ux + uy * uy);

  const connectInset = secondaryRing ? 1.0 : 0.96;
  let startX = p1.x + ux * (r1Eff * connectInset);
  let startY = p1.y + uy * (r1Eff * connectInset);
  let endX = p2.x - ux * (r2Eff * connectInset);
  let endY = p2.y - uy * (r2Eff * connectInset);

  if (progress <= 0.001) return;

  const targetEndX = endX;
  const targetEndY = endY;

  if (progress < 1) {
    endX = startX + (targetEndX - startX) * progress;
    endY = startY + (targetEndY - startY) * progress;
  }

  // Matching broadcast palette
  const ringColor = color || '#00eaff';
  const ringDeep = shiftColor(ringColor, -24);
  const ringDark = shiftColor(ringColor, -48);
  const ringLight = shiftColor(ringColor, 30);
  const ringHot = shiftColor(ringColor, 58);

  const fadeHex = (hex: string, alpha: number) => {
    let hr = parseInt(hex.slice(1, 3), 16),
        hg = parseInt(hex.slice(3, 5), 16),
        hb = parseInt(hex.slice(5, 7), 16);
    if (isNaN(hr)) return hex;
    return `rgba(${hr},${hg},${hb},${Math.max(0, Math.min(1, alpha))})`;
  };

  const connThickness = Math.max(3, Math.min(r1 * 0.16, 7));
  const nx = -uy;
  const ny = ux;

  ctx.save();

  // 1. Clean ambient underlay beneath connecting link (no dark shadow)
  if (!isGhost) {
    ctx.save();
    ctx.strokeStyle = fadeHex(ringColor, 0.22);
    ctx.lineWidth = connThickness + 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.restore();
  }

  // 2. User Outline underlay
  if (strokeWidth > 0 && !isGhost) {
    ctx.save();
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = connThickness + strokeWidth * 2;
    ctx.lineCap = 'round';
    const sDepth = depthSize + strokeWidth;

    if (depthSize > 0.5) {
      const step = Math.max(0.25, scaleY);
      for (let d = sDepth; d >= -strokeWidth; d -= step) {
        ctx.beginPath();
        ctx.moveTo(startX, startY + d);
        ctx.lineTo(endX, endY + d);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 3. 3D Extrusion Wall (shaded cylinder slices)
  if (depthSize > 0.5) {
    ctx.save();
    const step = Math.max(0.3, scaleY);
    ctx.lineCap = 'round';
    ctx.lineWidth = connThickness;

    for (let d = depthSize; d > 0; d -= step) {
      const ratio = d / depthSize;
      const depthColor = ratio > 0.6 ? ringDark : (ratio > 0.3 ? ringDeep : shiftColor(ringColor, -12));
      ctx.strokeStyle = fadeHex(depthColor, 0.96);
      ctx.beginPath();
      ctx.moveTo(startX, startY + d);
      ctx.lineTo(endX, endY + d);
      ctx.stroke();
    }

    // Bottom edge accent
    ctx.strokeStyle = fadeHex(shiftColor(ringColor, -60), 0.75);
    ctx.lineWidth = connThickness;
    ctx.beginPath();
    ctx.moveTo(startX, startY + depthSize);
    ctx.lineTo(endX, endY + depthSize);
    ctx.stroke();
    ctx.restore();
  }

  // 4. Main Top Face with lateral 3D broadcast bevel gradient
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = connThickness;
  ctx.shadowColor = fadeHex(ringColor, 0.42);
  ctx.shadowBlur = 12;

  // Lateral gradient perpendicular to the link direction
  const pHalf = connThickness / 2;
  const latGrad = createSafeLinearGradient(
    ctx,
    startX - nx * pHalf,
    startY - ny * pHalf,
    startX + nx * pHalf,
    startY + ny * pHalf
  );
  if (latGrad) {
    latGrad.addColorStop(0, ringHot);
    latGrad.addColorStop(0.25, ringLight);
    latGrad.addColorStop(0.55, ringColor);
    latGrad.addColorStop(0.85, ringDeep);
    latGrad.addColorStop(1, ringDark);
    ctx.strokeStyle = latGrad;
  } else {
    ctx.strokeStyle = ringColor;
  }

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.restore();

  // 5. Specular Laser / Glass Core Hairline
  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = Math.max(1, connThickness * 0.28);
  ctx.lineCap = 'round';
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.restore();

  // Active glowing connector tip beacon while connecting or retracting
  if (progress < 0.98 && progress > 0.02 && !isGhost) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(endX, endY, Math.max(3, connThickness * 0.85), 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = ringColor;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
};

/**
 * Classic old-style luminous uniform filling inside of closed shape (no dark shadows).
 */
export const drawConnectedRingsFill = (
  ctx: AnyCanvasContext,
  points: Point[],
  color: string,
  timestamp: number = 0,
  tiltDegrees: number = 65,
  config: any = {},
  progress: number = 1
) => {
  if (!ctx || points.length < 3) return;
  const p = Math.max(0, Math.min(1, progress));
  if (p <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = (ctx.globalAlpha || 1) * p;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  // Old-style clean, luminous uniform color fill (no dark shadows)
  ctx.fillStyle = fadeColor(color, 0.28);
  ctx.fill();

  // Clean soft inner boundary
  ctx.strokeStyle = fadeColor(color, 0.45);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
};

export const drawCurvedRun = (ctx: AnyCanvasContext, points: Point[], color: string, thickness: number, isDashed: boolean, timestamp: number, isPreview: boolean, animProgress?: number) => {
    if (points.length < 2) return;
    const p1 = points[0];
    const p2 = points[1];
    
    let cpx: number, cpy: number;
    if (points.length >= 3) {
        const apex = points[2];
        cpx = 2 * apex.x - 0.5 * p1.x - 0.5 * p2.x;
        cpy = 2 * apex.y - 0.5 * p1.y - 0.5 * p2.y;
    } else {
        const dx = p2.x - p1.x; const dy = p2.y - p1.y; const dist = Math.sqrt(dx*dx + dy*dy);
        const mx = (p1.x + p2.x) / 2; const my = (p1.y + p2.y) / 2;
        const arcHeight = dist * 0.15; 
        const apexX = mx;
        const apexY = my - arcHeight;
        cpx = 2 * apexX - 0.5 * p1.x - 0.5 * p2.x;
        cpy = 2 * apexY - 0.5 * p1.y - 0.5 * p2.y;
    }

    const t = animProgress !== undefined ? Math.max(0, Math.min(1, animProgress)) : 1;
    if (t <= 0.001) return;

    const headSize = Math.max(thickness * 3, 15);
    const headLength = headSize * 0.9;
    const shortenDist = headLength * Math.cos(Math.PI / 6) * 0.85;

    let drawCP = { x: cpx, y: cpy };
    let drawEnd = { x: p2.x, y: p2.y };
    let angle = Math.atan2(p2.y - cpy, p2.x - cpx);

    if (t < 1) {
        drawCP = { x: (1 - t) * p1.x + t * cpx, y: (1 - t) * p1.y + t * cpy };
        drawEnd = {
            x: (1 - t) * (1 - t) * p1.x + 2 * (1 - t) * t * cpx + t * t * p2.x,
            y: (1 - t) * (1 - t) * p1.y + 2 * (1 - t) * t * cpy + t * t * p2.y
        };
        const tangentX = 2 * (1 - t) * (cpx - p1.x) + 2 * t * (p2.x - cpx);
        const tangentY = 2 * (1 - t) * (cpy - p1.y) + 2 * t * (p2.y - cpy);
        angle = Math.atan2(tangentY, tangentX);
    }

    const lineX = drawEnd.x - Math.cos(angle) * shortenDist;
    const lineY = drawEnd.y - Math.sin(angle) * shortenDist;

    ctx.save();
    if (t < 0.2) {
        ctx.globalAlpha = Math.min(1, t / 0.2);
    }
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = thickness;
    
    if (isDashed) {
        ctx.setLineDash([thickness * 2, thickness * 1.5]);
    }
    
    ctx.strokeStyle = getShimmerGradient(ctx, p1, {x: lineX, y: lineY}, color, isPreview);
    
    if (!isPreview) { 
        // Flat on pitch shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'; 
        ctx.shadowBlur = Math.max(2, thickness * 0.5); 
        ctx.shadowOffsetY = Math.max(1, thickness * 0.2);
    }
    
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.quadraticCurveTo(drawCP.x, drawCP.y, lineX, lineY);
    ctx.stroke();

    ctx.setLineDash([]);
    
    if (t > 0.15) {
        const barb1x = drawEnd.x - headLength * Math.cos(angle - Math.PI / 6);
        const barb1y = drawEnd.y - headLength * Math.sin(angle - Math.PI / 6);
        const barb2x = drawEnd.x - headLength * Math.cos(angle + Math.PI / 6);
        const barb2y = drawEnd.y - headLength * Math.sin(angle + Math.PI / 6);
        
        ctx.beginPath();
        ctx.moveTo(barb1x, barb1y);
        ctx.lineTo(drawEnd.x, drawEnd.y);
        ctx.lineTo(barb2x, barb2y);
        ctx.closePath();
        
        // Flat color for arrowhead to stay on pitch
        ctx.fillStyle = color;
        ctx.fill();
    }
    
    ctx.restore();
};

export const drawCurvedArrow = (ctx: AnyCanvasContext, points: Point[], color: string, width: number, isDashed: boolean, timestamp: number, renderMode: 'full' | 'shadow' | 'body' = 'full', animProgress?: number) => {
    const now = Date.now();
    const duration = 600;
    const progress = animProgress !== undefined ? Math.max(0, animProgress) : (timestamp > 0 ? Math.max(0, Math.min(1, (now - timestamp) / duration)) : 1);
    if (points.length < 2) return;
    const p1 = points[0];
    const p2 = points[1];
    
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) return;

    let cpx: number, cpy: number;
    if (points.length >= 3 && points[2]) {
        const apex = points[2];
        cpx = 2 * apex.x - 0.5 * p1.x - 0.5 * p2.x;
        cpy = 2 * apex.y - 0.5 * p1.y - 0.5 * p2.y;
    } else {
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        const arcHeight = Math.max(20, dist * 0.2); 
        const nx = -dy / (dist || 1);
        const ny = dx / (dist || 1);
        const sign = ny > 0 ? -1 : 1;
        const apexX = mx + nx * arcHeight * sign;
        const apexY = my + ny * arcHeight * sign;
        cpx = 2 * apexX - 0.5 * p1.x - 0.5 * p2.x;
        cpy = 2 * apexY - 0.5 * p1.y - 0.5 * p2.y;
    }

    // Tangent angle at endpoint p2 for quadratic Bézier (p1 -> cp -> p2)
    // Tangent vector B'(1) = 2 * (p2 - cp)
    const tdx = p2.x - cpx;
    const tdy = p2.y - cpy;
    const tangentDist = Math.hypot(tdx, tdy);
    const angle = tangentDist > 0.001 ? Math.atan2(tdy, tdx) : Math.atan2(dy, dx);

    const headSize = Math.max(12, width * 4.5);
    const headLength = headSize * 0.9;
    const maxShorten = tangentDist > 0 ? tangentDist * 0.5 : dist * 0.4;
    const shortenDist = Math.min(headLength * Math.cos(Math.PI / 6) * 0.85, maxShorten);
    const lineX = p2.x - Math.cos(angle) * shortenDist;
    const lineY = p2.y - Math.sin(angle) * shortenDist;

    // High-precision quadratic curve length calculation for smooth progressive animation and stretching
    let curveLen = 0;
    let prevX = p1.x;
    let prevY = p1.y;
    const STEPS = 24;
    for (let i = 1; i <= STEPS; i++) {
        const t = i / STEPS;
        const mt = 1 - t;
        const qx = mt * mt * p1.x + 2 * mt * t * cpx + t * t * lineX;
        const qy = mt * mt * p1.y + 2 * mt * t * cpy + t * t * lineY;
        curveLen += Math.hypot(qx - prevX, qy - prevY);
        prevX = qx;
        prevY = qy;
    }
    const safeCurveLen = Math.max(1, curveLen);
    
    // Draw Ground Shadow
    if (renderMode === 'full' || renderMode === 'shadow') {
        ctx.save();
        const groundAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const groundLineX = p2.x - Math.cos(groundAngle) * shortenDist;
        const groundLineY = p2.y - Math.sin(groundAngle) * shortenDist;
        const groundDist = Math.hypot(groundLineX - p1.x, groundLineY - p1.y);

        if (isDashed) {
            if (progress < 1) {
                ctx.beginPath();
                ctx.arc(p1.x, p1.y, dist * progress * 1.5, 0, Math.PI * 2);
                ctx.clip();
            }
            ctx.setLineDash([width * 2, width * 1.5]);
        } else if (progress < 1) {
            ctx.setLineDash([groundDist, groundDist * 2]);
            ctx.lineDashOffset = groundDist * (1 - progress);
        } else {
            ctx.setLineDash([]);
        }

        ctx.beginPath(); 
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; 
        ctx.lineWidth = width; 
        ctx.shadowBlur = Math.max(10, width * 1.5); 
        ctx.shadowOffsetY = 0; 
        ctx.shadowColor = 'rgba(0,0,0,0.6)'; 
        ctx.lineCap = 'round';
        ctx.moveTo(p1.x, p1.y); 
        ctx.lineTo(groundLineX, groundLineY); 
        ctx.stroke();
        
        if (progress > 0.8) { 
            ctx.setLineDash([]); 
            ctx.fillStyle = 'rgba(0,0,0,0.4)'; 
            ctx.shadowBlur = 8; 
            ctx.shadowOffsetY = 0;
            
            // Draw 3D-oriented arrowhead for the shadow, mimicking the main arrow's head shape
            const tipX = p2.x; const tipY = p2.y;
            const barb1x = tipX - headSize * Math.cos(angle - Math.PI / 6);
            const barb1y = tipY - headSize * Math.sin(angle - Math.PI / 6);
            const barb2x = tipX - headSize * Math.cos(angle + Math.PI / 6);
            const barb2y = tipY - headSize * Math.sin(angle + Math.PI / 6);
            
            ctx.beginPath(); 
            ctx.moveTo(barb1x, barb1y); 
            ctx.lineTo(tipX, tipY); 
            ctx.lineTo(barb2x, barb2y); 
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }
    
    // Draw 3D Body
    if (renderMode === 'full' || renderMode === 'body') {
        ctx.save();
        if (isDashed) {
            if (progress < 1) {
                const maxR = Math.max(dist, Math.hypot(cpx - p1.x, cpy - p1.y), safeCurveLen);
                ctx.beginPath();
                ctx.arc(p1.x, p1.y, maxR * progress * 1.5, 0, Math.PI * 2);
                ctx.clip();
            }
            ctx.setLineDash([width * 2, width * 1.5]);
        } else if (progress < 1) {
            ctx.setLineDash([safeCurveLen, safeCurveLen * 2]);
            ctx.lineDashOffset = safeCurveLen * (1 - progress);
        } else {
            // When progress >= 1 or static, remove lineDash completely so the shaft connects fully to the arrowhead
            ctx.setLineDash([]);
        }

        ctx.strokeStyle = getShimmerGradient(ctx, p1, p2, color, timestamp === 0);
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        if (timestamp === 0) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 15;
        }
        
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.quadraticCurveTo(cpx, cpy, lineX, lineY);
        ctx.stroke();
        
        ctx.shadowBlur = 0;
        
        // Inner highlight
        if (!isDashed && progress > 0.1 && width > 3) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = width * 0.3;
            if (progress < 1) {
                ctx.setLineDash([safeCurveLen, safeCurveLen * 2]);
                ctx.lineDashOffset = safeCurveLen * (1 - progress);
            } else {
                ctx.setLineDash([]);
            }
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y - width * 0.2);
            ctx.quadraticCurveTo(cpx, cpy - width * 0.2, lineX, lineY - width * 0.2);
            ctx.stroke();
            ctx.restore();
        }

        if (progress > 0.8) {
            ctx.setLineDash([]);
            const tipX = p2.x;
            const tipY = p2.y;
            const barb1x = tipX - headSize * Math.cos(angle - Math.PI / 6);
            const barb1y = tipY - headSize * Math.sin(angle - Math.PI / 6);
            const barb2x = tipX - headSize * Math.cos(angle + Math.PI / 6);
            const barb2y = tipY - headSize * Math.sin(angle + Math.PI / 6);
            
            ctx.beginPath();
            ctx.moveTo(barb1x, barb1y);
            ctx.lineTo(tipX, tipY);
            ctx.lineTo(barb2x, barb2y);
            ctx.closePath();
            
            // 3D Bevel Gradient for arrow head
            const grad = createSafeLinearGradient(ctx, barb1x, barb1y, barb2x, barb2y);
            if (grad) {
                grad.addColorStop(0, adjustBrightness(color, 20));
                grad.addColorStop(0.5, color);
                grad.addColorStop(1, shiftColor(color, -20));
                ctx.fillStyle = grad; 
            } else {
                ctx.fillStyle = color;
            }
            ctx.fill();
            
            ctx.strokeStyle = adjustBrightness(color, 40);
            ctx.lineWidth = Math.max(1, width * 0.2);
            ctx.stroke();
        }
        ctx.restore();
    }
};

export const drawLens = (ctx: AnyCanvasContext, center: Point, radius: number, zoom: number, video: CanvasImageSource, scale: number, timestamp: number, isGhost: boolean = false) => {
    const radiusVideo = radius / scale;
    const sourceW = (radiusVideo * 2) / zoom;
    const sourceH = sourceW;
    const sourceX = center.x - sourceW / 2;
    const sourceY = center.y - sourceH / 2;
    
    const popDuration = 400; // 400ms for pop
    const age = timestamp ? Date.now() - timestamp : 99999;
    let animScale = 1;
    if (!isGhost && age < popDuration) {
        const t = Math.max(0, Math.min(1, age / popDuration));
        animScale = (1 - Math.pow(1 - t, 3)) + Math.sin(t * Math.PI) * 0.15;
    }
    if (animScale <= 0) return;

    ctx.save();
    if (isGhost) ctx.globalAlpha = 0.8;
    
    // Apply animation scale about the center
    ctx.translate(center.x, center.y);
    ctx.scale(animScale, animScale);
    ctx.translate(-center.x, -center.y);

    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20 / scale; ctx.shadowOffsetY = 10 / scale;
    ctx.beginPath(); ctx.arc(center.x, center.y, radiusVideo, 0, Math.PI * 2); ctx.clip();
    try { ctx.drawImage(video, sourceX, sourceY, sourceW, sourceH, center.x - radiusVideo, center.y - radiusVideo, radiusVideo * 2, radiusVideo * 2); } catch(e) { ctx.fillStyle = '#000'; ctx.fill(); }
    const grad = createSafeRadialGradient(ctx, center.x - radiusVideo*0.3, center.y - radiusVideo*0.3, radiusVideo*0.2, center.x, center.y, radiusVideo);
    if (grad) {
        grad.addColorStop(0, 'rgba(255,255,255,0.15)');
        grad.addColorStop(1, 'rgba(255,255,255,0.02)');
        ctx.fillStyle = grad;
    } else {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
    }
    ctx.fill();
    ctx.beginPath(); ctx.arc(center.x, center.y, radiusVideo, 0, Math.PI * 2);
    ctx.shadowColor = 'transparent'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4 / scale; ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1 / scale; ctx.stroke();
    ctx.restore();
    
    if (isGhost) {
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.scale(animScale, animScale);
        ctx.translate(-center.x, -center.y);
        drawLabel(ctx, { x: center.x, y: center.y + radiusVideo }, `${zoom}x`, scale);
        ctx.restore();
    }
};

export const drawNameTag = (
    ctx: AnyCanvasContext,
    point: Point,
    text: string,
    color: string,
    scale: number,
    timestamp: number,
    fontSize: number = 14,
    isGhost: boolean = false,
    unifiedProgress?: number,
    playerNumber?: string,
    options?: {
        style?: 'broadcast' | 'minimal' | 'badge';
        uppercase?: boolean;
        showNumber?: boolean;
    }
) => {
    if (!ctx || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    const safeScale = (typeof scale === 'number' && Number.isFinite(scale) && scale > 0) ? scale : 1;
    const safeSize = (typeof fontSize === 'number' && Number.isFinite(fontSize) && fontSize > 0) ? fontSize : 14;
    const safeColor = color || '#c6ff1f';

    ctx.save();
    const now = Date.now();
    const age = (typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp > 0) ? now - timestamp : 99999;
    
    // Animation
    const animDuration = 400;
    let animProgress = 1;
    if (unifiedProgress !== undefined && Number.isFinite(unifiedProgress)) {
        animProgress = Math.max(0, Math.min(1, unifiedProgress));
    } else {
        animProgress = isGhost ? 1 : Math.max(0, Math.min(1, Math.max(0, age) / animDuration));
    }

    // Determine jersey number and player name
    let num = (playerNumber !== undefined && playerNumber !== null) ? String(playerNumber).trim() : '';
    let name = (text || '').trim();
    
    // Auto-extract number if not explicitly supplied, e.g. "#10 Messi" or "17. De Bruyne"
    if (!num && name) {
        const match = name.match(/^(?:#?\[?(\d{1,3})\]?[\.\-\:\s]\s*)(.*)$/);
        if (match) {
            num = match[1];
            name = match[2].trim();
        }
    }

    const showNumber = options?.showNumber !== false && num.length > 0;
    const isUppercase = options?.uppercase !== false; // Broadcast convention default
    const displayName = isUppercase ? name.toUpperCase() : name;

    // Smooth positioning
    ctx.translate(point.x, point.y);
    
    if (isGhost) {
        ctx.globalAlpha = 0.88;
    }

    // Calculate dimensions
    const nameFontSize = safeSize / safeScale;
    const numFontSize = Math.max(1 / safeScale, (safeSize * 0.95) / safeScale);
    const paddingX = Math.max(2 / safeScale, (safeSize * 0.6) / safeScale);
    const paddingY = Math.max(1 / safeScale, (safeSize * 0.35) / safeScale);
    const boxHeight = Math.max(4 / safeScale, nameFontSize + paddingY * 2);

    ctx.font = `bold ${nameFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const nameMetrics = ctx.measureText(displayName || 'PLAYER');
    const nameWidth = Number.isFinite(nameMetrics.width) ? nameMetrics.width : (displayName.length * nameFontSize * 0.6);

    let numBoxWidth = 0;
    if (showNumber) {
        ctx.font = `900 ${numFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        const numMetrics = ctx.measureText(num);
        const numW = Number.isFinite(numMetrics.width) ? numMetrics.width : (num.length * numFontSize * 0.6);
        numBoxWidth = Math.max(boxHeight * 0.95, numW + (6 / safeScale));
    }

    const nameBoxWidth = Math.max(10 / safeScale, nameWidth + paddingX * 2);
    const totalBoxWidth = numBoxWidth + nameBoxWidth;
    
    const triangleHeight = Math.max(2 / safeScale, boxHeight * 0.36);
    const triangleWidth = Math.max(3 / safeScale, boxHeight * 0.52);
    
    const boxX = -totalBoxWidth / 2;
    const boxY = -triangleHeight - boxHeight;

    if (!Number.isFinite(boxX) || !Number.isFinite(boxY) || !Number.isFinite(totalBoxWidth) || !Number.isFinite(boxHeight) || totalBoxWidth <= 0 || boxHeight <= 0) {
        ctx.restore();
        return;
    }
    
    if (animProgress < 1 && !isGhost) {
        ctx.beginPath();
        // Wiping symmetrically from center downward pointer anchor outwards
        const halfW = (totalBoxWidth / 2) * Math.max(0, Math.min(1, animProgress));
        ctx.rect(-halfW, boxY - 10, halfW * 2, boxHeight + triangleHeight + 20);
        ctx.clip();
        ctx.globalAlpha = (ctx.globalAlpha || 1) * Math.min(1, animProgress * 1.5);
    }

    const textContrastColor = getContrastColor(safeColor);
    const isDarkText = textContrastColor === '#000000';

    // Draw 3D Downward Pointer pointing to the player's ground point
    ctx.beginPath();
    ctx.moveTo(0, 0); // Bottom point at player location
    ctx.lineTo(-triangleWidth / 2, -triangleHeight); // Top left
    ctx.lineTo(triangleWidth / 2, -triangleHeight); // Top right
    ctx.closePath();
    ctx.fillStyle = safeColor;
    ctx.fill();
    
    // Shadow side of the triangle for 3D broadcast depth
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(triangleWidth / 2, -triangleHeight);
    ctx.lineTo(0, -triangleHeight);
    ctx.closePath();
    ctx.fillStyle = isDarkText ? 'rgba(0, 0, 0, 0.22)' : 'rgba(0, 0, 0, 0.4)';
    ctx.fill();
    
    // Draw Main Outer Capsule / Card with Shadow
    ctx.save();
    ctx.beginPath();
    const cornerRadius = Math.max(0, Math.min(boxHeight / 2, Math.max(1, 3 / safeScale)));
    if (typeof (ctx as any).roundRect === 'function') {
        try {
            (ctx as any).roundRect(boxX, boxY, totalBoxWidth, boxHeight, cornerRadius);
        } catch {
            ctx.rect(boxX, boxY, totalBoxWidth, boxHeight);
        }
    } else {
        ctx.rect(boxX, boxY, totalBoxWidth, boxHeight);
    }
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = Math.max(2 / safeScale, 8 / safeScale);
    ctx.shadowOffsetY = Math.max(1 / safeScale, 3 / safeScale);
    ctx.fillStyle = safeColor;
    ctx.fill();
    
    // Clip contents to rounded card
    ctx.shadowColor = 'transparent';
    ctx.clip();
    
    if (showNumber) {
        // --- Broadcast Left Block: Jersey Number Inset Badge ---
        const numBg = isDarkText ? 'rgba(0, 0, 0, 0.14)' : 'rgba(0, 0, 0, 0.28)';
        ctx.fillStyle = numBg;
        ctx.fillRect(boxX, boxY, numBoxWidth, boxHeight);

        // Number Text with high contrast
        ctx.fillStyle = textContrastColor;
        ctx.font = `900 ${numFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(num, boxX + numBoxWidth / 2, boxY + boxHeight / 2 + (0.5 / safeScale));

        // Hairline divider between number and name
        ctx.fillStyle = isDarkText ? 'rgba(0, 0, 0, 0.18)' : 'rgba(255, 255, 255, 0.25)';
        ctx.fillRect(boxX + numBoxWidth - (1 / safeScale), boxY, 1 / safeScale, boxHeight);

        // --- Broadcast Right Block: Player Name ---
        const nameStartX = boxX + numBoxWidth;

        // Player Name text with managed contrast
        ctx.fillStyle = textContrastColor;
        ctx.font = `bold ${nameFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        if (textContrastColor === '#ffffff') {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
            ctx.shadowBlur = 3 / safeScale;
            ctx.shadowOffsetY = 1 / safeScale;
        } else {
            ctx.shadowColor = 'rgba(255, 255, 255, 0.35)';
            ctx.shadowBlur = 1 / safeScale;
            ctx.shadowOffsetY = 0.5 / safeScale;
        }
        ctx.fillText(displayName, nameStartX + nameBoxWidth / 2, boxY + boxHeight / 2);
        ctx.shadowColor = 'transparent';
    } else {
        // --- Broadcast Style without Number ---
        // Player Name text directly centered in the colored tag
        ctx.fillStyle = textContrastColor;
        ctx.font = `bold ${nameFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        if (textContrastColor === '#ffffff') {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
            ctx.shadowBlur = 3 / safeScale;
            ctx.shadowOffsetY = 1 / safeScale;
        } else {
            ctx.shadowColor = 'rgba(255, 255, 255, 0.35)';
            ctx.shadowBlur = 1 / safeScale;
            ctx.shadowOffsetY = 0.5 / safeScale;
        }
        ctx.fillText(displayName, boxX + totalBoxWidth / 2, boxY + boxHeight / 2);
        ctx.shadowColor = 'transparent';
    }

    // Top Gloss Highlight across entire tag for broadcast polish
    const topGloss = createSafeLinearGradient(ctx, boxX, boxY, boxX, boxY + boxHeight * 0.45);
    if (topGloss) {
        topGloss.addColorStop(0, isDarkText ? 'rgba(255, 255, 255, 0.32)' : 'rgba(255, 255, 255, 0.22)');
        topGloss.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
        ctx.fillStyle = topGloss;
        ctx.fillRect(boxX, boxY, totalBoxWidth, boxHeight * 0.45);
    }

    // Subtle edge outline for clean separation against any pitch background
    ctx.strokeStyle = isDarkText ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.38)';
    ctx.lineWidth = Math.max(0.5, 1 / safeScale);
    if (typeof (ctx as any).roundRect === 'function') {
        try {
            ctx.beginPath();
            (ctx as any).roundRect(boxX, boxY, totalBoxWidth, boxHeight, cornerRadius);
            ctx.stroke();
        } catch {
            ctx.strokeRect(boxX, boxY, totalBoxWidth, boxHeight);
        }
    } else {
        ctx.strokeRect(boxX, boxY, totalBoxWidth, boxHeight);
    }

    ctx.restore();

    // Small anchor dot at player ground contact point
    if (isGhost) {
        ctx.beginPath();
        ctx.arc(0, 0, 3 / safeScale, 0, Math.PI * 2);
        ctx.fillStyle = safeColor;
        ctx.fill();
        ctx.lineWidth = 1 / safeScale;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
    }
    
    ctx.restore();
};

export const drawText = (ctx: AnyCanvasContext, point: Point, text: string, color: string, scale: number, timestamp: number, config: any, isGhost: boolean = false, unifiedProgress?: number) => {
    ctx.save();
    const now = Date.now();
    const age = timestamp ? now - timestamp : 99999;
    
    const animationType = config?.animation || 'fade';
    
    // Animation durations (slowed down)
    const fadeDuration = 800;
    const scaleDuration = 600;
    const typeDurationPerChar = 50; 
    
    let displayText = text;
    let alpha = 1;
    let scaleAnim = 1;
    
    if (!isGhost) {
        if (unifiedProgress !== undefined) {
            const progress = Math.max(0, Math.min(1, unifiedProgress));
            const charCount = Math.floor(text.length * progress);
            displayText = text.substring(0, charCount);
            alpha = progress < 1 ? Math.max(0, progress) : 1;
            // Add a little pop effect at the end of the reveal for extra juice, or just simple scale
            scaleAnim = progress < 0.2 ? 0.8 + progress : 1; 
        } else {
            if (animationType === 'type') {
                const charCount = Math.floor(Math.max(0, age) / typeDurationPerChar);
                displayText = text.substring(0, Math.min(text.length, charCount));
            }
            if (animationType === 'fade') {
                alpha = Math.min(1, Math.max(0, age) / fadeDuration);
            } else if (animationType === 'scale') {
                const animProgress = Math.min(1, Math.max(0, age) / scaleDuration);
                const easeOutBack = (x: number) => {
                    const c1 = 1.70158;
                    return 1 + (c1 + 1) * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
                };
                scaleAnim = easeOutBack(animProgress);
                alpha = Math.min(1, animProgress * 2); // quick fade in
            } else if (animationType === 'type') {
                alpha = 1;
                scaleAnim = 1;
            } else {
                alpha = 1;
                scaleAnim = 1;
            }
        }
    }
    
    if (alpha <= 0 || scaleAnim <= 0) {
        ctx.restore();
        return;
    }
    
    ctx.globalAlpha = alpha;
    ctx.translate(point.x, point.y);
    ctx.scale(scaleAnim, scaleAnim);
    
    const fontSize = config?.fontSize || 14;
    ctx.font = `bold ${fontSize / scale}px sans-serif`;
    
    // Measure full text to keep box size and alignment stable during typing
    const fullLines = text.split('\n');
    let maxFullLineWidth = 0;
    fullLines.forEach(line => {
        const metrics = ctx.measureText(line);
        maxFullLineWidth = Math.max(maxFullLineWidth, metrics.width);
    });
    
    const paddingX = fontSize / scale;
    const paddingY = (fontSize * 0.4) / scale;
    const lineHeight = (fontSize * 1.2) / scale;
    const boxHeight = (fullLines.length * lineHeight) + paddingY * 2;
    const boxWidth = maxFullLineWidth + paddingX * 2;
    
    const boxX = -boxWidth / 2;
    const boxY = -boxHeight / 2;
    
    if (config?.bgEnabled && text.length > 0) {
        ctx.save();
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 6 / scale);
        } else {
            ctx.rect(boxX, boxY, boxWidth, boxHeight);
        }
        ctx.fillStyle = config?.bgColor || 'rgba(0,0,0,0.8)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 10 / scale;
        ctx.shadowOffsetY = 4 / scale;
        ctx.fill();
        ctx.restore();
    }
    
    ctx.fillStyle = color;
    ctx.textAlign = 'left';  // Use left alignment to keep text from jittering center-outward
    ctx.textBaseline = 'middle';
    
    if (!config?.bgEnabled) {
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 6 / scale;
        ctx.shadowOffsetX = 1 / scale;
        ctx.shadowOffsetY = 1 / scale;
    }
    
    const startY = boxY + paddingY + (lineHeight / 2);
    
    // Split display text into lines. To keep left-alignment or center alignment visually stable,
    // we need to process the full lines and then substring within those lines.
    let remainingChars = displayText.length;
    
    fullLines.forEach((fullLine, index) => {
        if (remainingChars <= 0) return;
        const lineToDraw = fullLine.substring(0, remainingChars);
        remainingChars -= fullLine.length + 1; // +1 for the newline char
        
        // Calculate the starting X coordinate so that the full line would be centered
        const fullMetrics = ctx.measureText(fullLine);
        const startX = -fullMetrics.width / 2;
        
        ctx.fillText(lineToDraw, startX, startY + (index * lineHeight));
    });
    
    ctx.restore();
};

export const drawPlayerSelectionRect = (
    ctx: CanvasRenderingContext2D | AnyCanvasContext,
    rect: Rect,
    color: string,
    scale: number = 1,
    options?: {
        isOrigin?: boolean;
        isDragging?: boolean;
        showCrosshair?: boolean;
        showDimensions?: boolean;
        showCornerBrackets?: boolean;
        label?: string;
        alpha?: number;
    }
) => {
    if (!ctx || !rect) return;
    const { x, y, w, h } = rect;
    const rw = Math.abs(w);
    const rh = Math.abs(h);
    if (rw < 1 || rh < 1) return;
    const rx = w >= 0 ? x : x + w;
    const ry = h >= 0 ? y : y + h;

    const safeScale = (typeof scale === 'number' && Number.isFinite(scale) && scale > 0) ? scale : 1;
    const safeColor = color || '#c6ff1f';
    const isOrigin = options?.isOrigin || false;
    const isDragging = options?.isDragging || false;
    const alpha = options?.alpha ?? 1.0;

    ctx.save();
    ctx.globalAlpha = alpha;

    // 1. Semi-transparent background fill
    ctx.beginPath();
    ctx.rect(rx, ry, rw, rh);
    if (isOrigin) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    } else if (isDragging) {
        ctx.fillStyle = fadeColor(safeColor, 0.14);
    } else {
        ctx.fillStyle = fadeColor(safeColor, 0.08);
    }
    ctx.fill();

    // 2. Main rectangle border
    ctx.beginPath();
    ctx.rect(rx, ry, rw, rh);
    if (isOrigin) {
        ctx.strokeStyle = fadeColor(safeColor, 0.65);
        ctx.lineWidth = Math.max(1.5, 2 / safeScale);
        ctx.setLineDash([6 / safeScale, 4 / safeScale]);
        ctx.lineDashOffset = -((Date.now() / 1000) * 20);
    } else {
        ctx.strokeStyle = safeColor;
        ctx.lineWidth = Math.max(1.5, 2 / safeScale);
        ctx.setLineDash([]);
        ctx.shadowColor = safeColor;
        ctx.shadowBlur = isDragging ? Math.max(6, 10 / safeScale) : Math.max(3, 5 / safeScale);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);

    // 3. Tactical Corner Brackets (Broadcast tracking reticle)
    if (options?.showCornerBrackets !== false) {
        const bracketLen = Math.max(6 / safeScale, Math.min(18 / safeScale, Math.min(rw, rh) * 0.28));
        const bracketThick = Math.max(2.5, 3.5 / safeScale);
        ctx.lineWidth = bracketThick;
        ctx.strokeStyle = isOrigin ? fadeColor(safeColor, 0.8) : '#ffffff';
        ctx.lineCap = 'square';
        ctx.lineJoin = 'miter';

        ctx.beginPath();
        // Top-Left
        ctx.moveTo(rx, ry + bracketLen);
        ctx.lineTo(rx, ry);
        ctx.lineTo(rx + bracketLen, ry);
        // Top-Right
        ctx.moveTo(rx + rw - bracketLen, ry);
        ctx.lineTo(rx + rw, ry);
        ctx.lineTo(rx + rw, ry + bracketLen);
        // Bottom-Left
        ctx.moveTo(rx, ry + rh - bracketLen);
        ctx.lineTo(rx, ry + rh);
        ctx.lineTo(rx + bracketLen, ry + rh);
        // Bottom-Right
        ctx.moveTo(rx + rw - bracketLen, ry + rh);
        ctx.lineTo(rx + rw, ry + rh);
        ctx.lineTo(rx + rw, ry + rh - bracketLen);
        ctx.stroke();
    }

    // 4. Center Crosshair (for dragging or active selection)
    if (options?.showCrosshair || isDragging) {
        const cx = rx + rw / 2;
        const cy = ry + rh / 2;
        const arm = Math.max(3 / safeScale, Math.min(8 / safeScale, Math.min(rw, rh) * 0.1));
        ctx.strokeStyle = isOrigin ? 'rgba(255, 255, 255, 0.4)' : safeColor;
        ctx.lineWidth = Math.max(1, 1.5 / safeScale);
        ctx.beginPath();
        ctx.moveTo(cx - arm, cy);
        ctx.lineTo(cx + arm, cy);
        ctx.moveTo(cx, cy - arm);
        ctx.lineTo(cx, cy + arm);
        ctx.stroke();
    }

    // 5. Tactical Tag Badge (label / dimensions)
    if (options?.label || options?.showDimensions) {
        ctx.save();
        const dimText = options?.showDimensions ? `${Math.round(rw)}×${Math.round(rh)}` : '';
        const labelText = options?.label ? (dimText ? `${options.label} • ${dimText}` : options.label) : dimText;
        
        const badgeFontSize = Math.max(8 / safeScale, 10 / safeScale);
        ctx.font = `bold ${badgeFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        const metrics = ctx.measureText(labelText);
        const padX = 6 / safeScale;
        const padY = 3 / safeScale;
        const badgeW = metrics.width + padX * 2;
        const badgeH = badgeFontSize + padY * 2;
        const badgeX = rx + (rw - badgeW) / 2;
        const badgeY = ry - badgeH - (4 / safeScale);

        // Badge background
        ctx.fillStyle = 'rgba(15, 17, 23, 0.9)';
        ctx.beginPath();
        if (typeof (ctx as any).roundRect === 'function') {
            try {
                (ctx as any).roundRect(badgeX, badgeY, badgeW, badgeH, 3 / safeScale);
            } catch {
                ctx.rect(badgeX, badgeY, badgeW, badgeH);
            }
        } else {
            ctx.rect(badgeX, badgeY, badgeW, badgeH);
        }
        ctx.fill();
        ctx.strokeStyle = isOrigin ? 'rgba(255,255,255,0.3)' : safeColor;
        ctx.lineWidth = 1 / safeScale;
        ctx.stroke();

        // Badge text
        ctx.fillStyle = isOrigin ? '#cccccc' : '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(labelText, badgeX + badgeW / 2, badgeY + badgeH / 2 + (0.5 / safeScale));
        ctx.restore();
    }

    ctx.restore();
};

export {
    drawPolygon,
    drawPolygonPreview,
    isPointNearPolygon,
    isPointInPolygon,
    createPolygonShape,
    drawRadar,
    drawRadarPreview,
    createRadarShape,
    isPointNearRadar
} from '../components/Workspace/Polygon';


