import type React from 'react';
import type { FreezeFrame, Point, Shape } from '../../../types';
import { getVideoLayout } from '../../../utils/math';
import { isPointNearPolygon, isPointNearRadar } from '../Polygon';
import { hitTestScanner } from '../Scanner';
import { hitTestPlayerMove } from '../PlayerMove';
import type { DraggingHandleState } from '../Workspace.types';

export function getVideoSpacePointFromEvent(
  e: React.MouseEvent | MouseEvent,
  canvas: HTMLCanvasElement | null,
  video: HTMLVideoElement | null
): Point {
  if (!canvas || !video) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  const dprX = canvas.width / rect.width;
  const dprY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * dprX;
  const y = (e.clientY - rect.top) * dprY;
  const layout = getVideoLayout(canvas, video);
  return { x: (x - layout.x) / layout.scale, y: (y - layout.y) / layout.scale };
}

export function isPointInsideVideo(
  pt: Point,
  video: HTMLVideoElement | null
): boolean {
  if (!video || !video.videoWidth || !video.videoHeight) return false;
  return pt.x >= 0 && pt.x <= video.videoWidth && pt.y >= 0 && pt.y <= video.videoHeight;
}

export function clampPointToVideo(
  pt: Point,
  video: HTMLVideoElement | null
): Point {
  if (!video || !video.videoWidth || !video.videoHeight) return pt;
  return {
    ...pt,
    x: Math.max(0, Math.min(video.videoWidth, pt.x)),
    y: Math.max(0, Math.min(video.videoHeight, pt.y)),
  };
}

export function hitTestWorkspaceShapes(params: {
  pt: Point;
  scale: number;
  shapes: Shape[];
  freezeFrames: FreezeFrame[];
  currentTime: number;
  isPlaying: boolean;
  editingAnimationFFId: string | null;
  animationPreviewTime: number;
  activeFreezeFrameId: string | null;
  isFreezeFramePlaying?: boolean;
  countdownValue: number;
}): DraggingHandleState | null {
  const {
    pt,
    scale,
    shapes,
    freezeFrames,
    currentTime,
    isPlaying,
    editingAnimationFFId,
    animationPreviewTime,
    activeFreezeFrameId,
    isFreezeFramePlaying = false,
    countdownValue,
  } = params;

  const rawActiveFF =
    (activeFreezeFrameId ? freezeFrames.find((ff) => ff.id === activeFreezeFrameId) : undefined) ||
    (editingAnimationFFId ? freezeFrames.find((ff) => ff.id === editingAnimationFFId) : undefined);
  const activeFF =
    rawActiveFF &&
    (editingAnimationFFId === rawActiveFF.id ||
      (!isPlaying && Math.abs(currentTime - rawActiveFF.timestamp) <= 0.12))
      ? rawActiveFF
      : undefined;
  const visibleShapes = shapes.filter((shape) => {
    if (shape.trackHidden || shape.trackLocked) return false;
    let isVisible = false;
    if (shape.trackStartTime !== undefined && shape.trackEndTime !== undefined) {
      isVisible =
        currentTime >= shape.trackStartTime - 0.005 &&
        currentTime <= shape.trackEndTime + 0.005;
      if (isVisible && activeFF?.avoidedTrackIds?.includes(shape.id)) {
        isVisible = false;
      }
    } else if (!shape.freezeFrameId) {
      const isAtFreezeFrame = Boolean(activeFF || editingAnimationFFId);
      const isTimeMatching =
        shape.videoTime === undefined || Math.abs(currentTime - shape.videoTime) <= 0.05;
      isVisible = !isPlaying && !isAtFreezeFrame && isTimeMatching;
    } else if (editingAnimationFFId === shape.freezeFrameId) {
      isVisible = true;
    } else if (!isPlaying && activeFreezeFrameId === shape.freezeFrameId) {
      const ffMatch =
        (activeFF?.id === shape.freezeFrameId ? activeFF : undefined) ||
        freezeFrames.find((ff) => ff.id === shape.freezeFrameId);
      isVisible = Boolean(ffMatch && Math.abs(currentTime - ffMatch.timestamp) <= 0.12);
    }
    if (!isVisible) return false;

    if (shape.freezeFrameId && shape.freezeFrameId === editingAnimationFFId) {
      const activeFFDur = freezeFrames.find((f) => f.id === editingAnimationFFId)?.duration ?? 10;
      const elapsed = animationPreviewTime;
      const start = shape.animStart ?? 0;
      const end = shape.animEnd ?? activeFFDur;
      if (elapsed < start || elapsed > end) return false;
    } else if (shape.freezeFrameId && shape.freezeFrameId === activeFreezeFrameId && isFreezeFramePlaying) {
      const activeFFDur = freezeFrames.find((f) => f.id === activeFreezeFrameId)?.duration ?? 10;
      const elapsed = activeFFDur - countdownValue;
      const start = shape.animStart ?? 0;
      const end = shape.animEnd ?? activeFFDur;
      if (elapsed < start || elapsed > end) return false;
    }
    return true;
  });

  const threshold = 15 / scale;
  // Reverse visibleShapes to hit the topmost shape
  for (let i = visibleShapes.length - 1; i >= 0; i--) {
    const shape = visibleShapes[i];

    // Check points first
    if (shape.type !== 'pen' && !shape.isFreehand) {
      if (shape.type === 'scanner') {
        const scanHit = hitTestScanner(pt, shape, scale);
        if (scanHit.type) {
          if (scanHit.type === 'body') {
            return {
              shapeId: shape.id,
              type: 'shape',
              offsetX: pt.x - shape.points[0].x,
              offsetY: pt.y - shape.points[0].y,
            };
          } else {
            return {
              shapeId: shape.id,
              type: 'scannerHandle',
              handleType: scanHit.type,
              offsetX: pt.x - shape.points[0].x,
              offsetY: pt.y - shape.points[0].y,
            };
          }
        }
      }
      // For circle, only check the first point (center), ignore any others that might be left over from old data
      const isCurvedShape =
        shape.type === 'curved-arrow' ||
        shape.type === 'curved-run-arrow' ||
        (shape.type === 'arrow' && shape.isCurved);
      const ptsToCheck = shape.type === 'circle' ? [shape.points[0]] : [...shape.points];
      if (isCurvedShape && ptsToCheck.length === 2) {
        const p1 = ptsToCheck[0];
        const p2 = ptsToCheck[1];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        const arcHeight = Math.max(20, dist * 0.2);
        const nx = -dy / (dist || 1);
        const ny = dx / (dist || 1);
        const sign = ny > 0 ? -1 : 1;
        ptsToCheck.push({ x: mx + nx * arcHeight * sign, y: my + ny * arcHeight * sign });
      }
      for (let j = 0; j < ptsToCheck.length; j++) {
        const p = ptsToCheck[j];
        if (!p) continue;
        const dist = Math.sqrt(Math.pow(pt.x - p.x, 2) + Math.pow(pt.y - p.y, 2));
        if (dist <= threshold) {
          return { shapeId: shape.id, pointIndex: j, type: 'point' };
        }
      }
    }

    // Then check if it hit the shape body (simplified, bounding box or center check)
    if (shape.points.length > 0) {
      let hitBody = false;
      let offsetX = 0;
      let offsetY = 0;

      if (shape.type === 'circle' && shape.points.length >= 1) {
        const r =
          (shape.ringConfig as any)?.size ||
          (shape.points.length >= 2
            ? Math.sqrt(
                Math.pow(shape.points[0].x - shape.points[1].x, 2) +
                  Math.pow(shape.points[0].y - shape.points[1].y, 2)
              )
            : 50);
        const cx = shape.points[0].x;
        const cy = shape.points[0].y;
        const dist = Math.sqrt(Math.pow(pt.x - cx, 2) + Math.pow(pt.y - cy, 2));
        if (dist <= r + threshold) {
          hitBody = true;
          offsetX = pt.x - cx;
          offsetY = pt.y - cy;
        }
      } else if (
        ['pen', 'line', 'arrow', 'curved-arrow', 'curved-run-arrow', 'polygon', 'connected-circle', 'radar'].includes(
          shape.type as string
        )
      ) {
        const distToSegment = (p: Point, v: Point, w: Point) => {
          const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
          if (l2 === 0) return Math.sqrt(Math.pow(p.x - v.x, 2) + Math.pow(p.y - v.y, 2));
          let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
          t = Math.max(0, Math.min(1, t));
          return Math.sqrt(
            Math.pow(p.x - (v.x + t * (w.x - v.x)), 2) + Math.pow(p.y - (v.y + t * (w.y - v.y)), 2)
          );
        };
        if (
          (shape.type === 'arrow' && shape.isCurved) ||
          shape.type === 'curved-arrow' ||
          shape.type === 'curved-run-arrow'
        ) {
          const p1 = shape.points[0];
          const p2 = shape.points[1] || shape.points[0];
          let apex = shape.points[2];
          if (!apex) {
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dist = Math.hypot(dx, dy);
            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;
            const arcHeight = Math.max(20, dist * 0.2);
            const nx = -dy / (dist || 1);
            const ny = dx / (dist || 1);
            const sign = ny > 0 ? -1 : 1;
            apex = { x: mx + nx * arcHeight * sign, y: my + ny * arcHeight * sign };
          }
          const cpx = 2 * apex.x - 0.5 * p1.x - 0.5 * p2.x;
          const cpy = 2 * apex.y - 0.5 * p1.y - 0.5 * p2.y;
          let prevPt = p1;
          for (let t = 0.05; t <= 1.01; t += 0.05) {
            const x = (1 - t) * (1 - t) * p1.x + 2 * (1 - t) * t * cpx + t * t * p2.x;
            const y = (1 - t) * (1 - t) * p1.y + 2 * (1 - t) * t * cpy + t * t * p2.y;
            const curPt = { x, y };
            if (distToSegment(pt, prevPt, curPt) <= threshold) {
              hitBody = true;
              break;
            }
            prevPt = curPt;
          }
        } else if (
          shape.type === 'radar' ||
          (shape.type === 'polygon' && shape.polygonConfig?.mode === 'radar') ||
          shape.radarConfig
        ) {
          const r = shape.radarConfig?.radius || 130;
          const tilt = shape.radarConfig?.tilt ?? 65;
          hitBody = isPointNearRadar(pt, shape.points[0], r, tilt);
        } else {
          if (shape.type === 'polygon') {
            hitBody = isPointNearPolygon(pt, shape.points, threshold, shape.polygonConfig?.fillStyle !== 'none');
          } else {
            for (let j = 0; j < shape.points.length - 1; j++) {
              if (distToSegment(pt, shape.points[j], shape.points[j + 1]) <= threshold) {
                hitBody = true;
                break;
              }
            }
          }
        }
        if (hitBody) {
          offsetX = pt.x - shape.points[0].x;
          offsetY = pt.y - shape.points[0].y;
        }
      } else if (shape.type === 'player-move') {
        const pmHit = hitTestPlayerMove(shape, pt, threshold);
        if (pmHit) {
          hitBody = true;
          offsetX = pmHit.offsetX;
          offsetY = pmHit.offsetY;
        }
      } else {
        let minX = shape.points[0].x,
          maxX = shape.points[0].x,
          minY = shape.points[0].y,
          maxY = shape.points[0].y;
        shape.points.forEach((p) => {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        });
        if (
          pt.x >= minX - threshold &&
          pt.x <= maxX + threshold &&
          pt.y >= minY - threshold &&
          pt.y <= maxY + threshold
        ) {
          hitBody = true;
          offsetX = pt.x - shape.points[0].x;
          offsetY = pt.y - shape.points[0].y;
        }
      }

      if (hitBody) {
        return { shapeId: shape.id, type: 'shape', offsetX, offsetY };
      }
    }
  }
  return null;
}

export function filterShapesAfterErase(params: {
  shapes: Shape[];
  pt: Point;
  scale: number;
  activeFF: FreezeFrame | undefined;
  activeFreezeFrameId: string | null;
  isPlaying: boolean;
  currentTime?: number;
}): Shape[] {
  const { shapes, pt, scale, activeFF, activeFreezeFrameId, isPlaying, currentTime } = params;
  const threshold = 20 / scale; // Screen radius of 20px

  return shapes.filter((shape) => {
    if (shape.trackHidden || shape.trackLocked) return true;
    let isVisible = false;
    if (shape.trackStartTime !== undefined && shape.trackEndTime !== undefined) {
      isVisible =
        currentTime === undefined ||
        (currentTime >= shape.trackStartTime - 0.005 && currentTime <= shape.trackEndTime + 0.005);
      if (isVisible && activeFF?.avoidedTrackIds?.includes(shape.id)) {
        isVisible = false;
      }
    } else if (!shape.freezeFrameId) {
      const isAtFreezeFrame = Boolean(activeFF || activeFreezeFrameId);
      isVisible = !isPlaying && !isAtFreezeFrame;
    } else if (activeFreezeFrameId === shape.freezeFrameId) {
      isVisible = true;
    }

    if (!isVisible) return true; // Keep shapes that are not currently visible

    if (shape.type === 'scanner') {
      const hit = hitTestScanner(pt, shape, scale);
      return hit.type === null;
    }

    if (shape.points.length === 0) return false;
    if (shape.points.length === 1) {
      if (shape.type === 'radar' || shape.radarConfig) {
        const r = shape.radarConfig?.radius || 130;
        const tilt = shape.radarConfig?.tilt ?? 65;
        return !isPointNearRadar(pt, shape.points[0], r, tilt);
      }
      return Math.sqrt(Math.pow(pt.x - shape.points[0].x, 2) + Math.pow(pt.y - shape.points[0].y, 2)) > threshold;
    }
    // Check segments
    for (let i = 0; i < shape.points.length - 1; i++) {
      const v = shape.points[i];
      const w = shape.points[i + 1];
      const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
      let t = 0;
      if (l2 !== 0) {
        t = ((pt.x - v.x) * (w.x - v.x) + (pt.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
      }
      const dist = Math.sqrt((pt.x - (v.x + t * (w.x - v.x))) ** 2 + (pt.y - (v.y + t * (w.y - v.y))) ** 2);
      if (dist <= threshold) return false; // erase
    }
    return true;
  });
}
