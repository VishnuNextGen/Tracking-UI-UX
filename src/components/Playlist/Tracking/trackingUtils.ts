import type { FreezeFrame, Shape, ToolType } from '../../../types';

export interface TrackingToolMeta {
  id: ToolType;
  label: string;
  shortLabel: string;
  trackPrefix?: string;
}

export const TRACKABLE_TOOL_IDS: ReadonlySet<Exclude<ToolType, null>> = new Set([
  'circle',
  'connected-circle',
  'lens',
  'spotlight',
  'radar',
  'name-tag',
  'text',
]);

export const TRACKABLE_TOOLS: TrackingToolMeta[] = [
  { id: 'circle', label: 'Telestration Ring', shortLabel: 'Ring', trackPrefix: 'Ring' },
  { id: 'connected-circle', label: 'Chain', shortLabel: 'Chain', trackPrefix: 'Chain' },
  { id: 'lens', label: 'Zoom Lens', shortLabel: 'Lens', trackPrefix: 'Lens' },
  { id: 'spotlight', label: 'Spotlight', shortLabel: 'Spot', trackPrefix: 'Spotlight' },
  { id: 'radar', label: 'Radar Ring', shortLabel: 'Radar', trackPrefix: 'Radar' },
  { id: 'name-tag', label: 'Player Tag', shortLabel: 'Tag', trackPrefix: 'Player Tag' },
  { id: 'text', label: 'Text', shortLabel: 'Text', trackPrefix: 'Text' },
];

export const STANDARD_DRAW_TOOLS: TrackingToolMeta[] = [
  { id: 'move', label: 'Move / Select', shortLabel: 'Move' },
  { id: 'pen', label: 'Draw', shortLabel: 'Draw' },
  { id: 'arrow', label: 'Arrow', shortLabel: 'Arrow' },
  { id: 'curved-arrow', label: 'Aerial Arrow', shortLabel: 'Aerial' },
  { id: 'player-move', label: 'Player Move Tool', shortLabel: 'PMove' },
  { id: 'polygon', label: 'Polygon', shortLabel: 'Poly' },
  { id: 'scanner', label: 'Field Scanner', shortLabel: 'Scan' },
  { id: 'masking', label: 'Masking / Green Screen', shortLabel: 'Mask' },
];

export function isTrackableTool(type: ToolType): boolean {
  if (!type) return false;
  return TRACKABLE_TOOL_IDS.has(type);
}

export function getTrackBaseName(type: ToolType): string {
  switch (type) {
    case 'circle':
      return 'Ring';
    case 'connected-circle':
      return 'Chain';
    case 'lens':
      return 'Lens';
    case 'spotlight':
      return 'Spotlight';
    case 'radar':
      return 'Radar';
    case 'name-tag':
      return 'Player Tag';
    case 'text':
      return 'Text';
    default:
      return 'Overlay';
  }
}

export function generateNextTrackLabel(type: ToolType, existingShapes: Shape[]): string {
  const baseName = getTrackBaseName(type);
  const matching = existingShapes.filter((s) => s.type === type);
  const usedNumbers = new Set<number>();

  const regex = new RegExp(`^${baseName}\\s+(\\d+)$`, 'i');
  matching.forEach((s) => {
    if (s.trackLabel) {
      const m = s.trackLabel.trim().match(regex);
      if (m && m[1]) {
        const num = parseInt(m[1], 10);
        if (!isNaN(num)) usedNumbers.add(num);
      }
    }
  });

  let nextNum = 1;
  while (usedNumbers.has(nextNum)) {
    nextNum++;
  }
  return `${baseName} ${nextNum}`;
}

export function formatTrackClock(seconds: number, includeTenths = true): string {
  const safe = Math.max(0, isFinite(seconds) ? seconds : 0);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const tenths = Math.floor((safe % 1) * 10);
  const base = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return includeTenths ? `${base}.${tenths}` : base;
}

export function formatTrackDuration(seconds: number): string {
  const safe = Math.max(0, isFinite(seconds) ? seconds : 0);
  return `${safe.toFixed(1)}s`;
}

export function getTrackDisplayColor(shape: Shape): string {
  if (shape.type === 'spotlight') return '#facc15';
  if (shape.type === 'lens') return '#38bdf8';
  if (!shape.color || shape.color.toLowerCase() === '#ffffff') {
    return '#c6ff1f';
  }
  return shape.color;
}

export interface VirtualTimelineSegment {
  type: 'video' | 'freeze';
  virtualStart: number;
  virtualEnd: number;
  videoStart: number;
  videoEnd: number;
  duration: number;
  ff?: FreezeFrame;
}

/**
 * Returns dynamic tracked tools whose time range overlaps a Freeze Frame timestamp.
 */
export function getTracksOverlappingTimestamp(tracks: Shape[], timestamp: number): Shape[] {
  return tracks.filter(
    (s) =>
      !s.freezeFrameId &&
      !s.trackHidden &&
      s.trackStartTime !== undefined &&
      s.trackEndTime !== undefined &&
      s.trackStartTime - 0.05 <= timestamp &&
      s.trackEndTime + 0.05 >= timestamp
  );
}

/**
 * Checks whether an overlapping dynamic tracked tool is active ("Used") in a given Freeze Frame.
 */
export function isTrackUsedInFreezeFrame(ff: FreezeFrame, trackId: string): boolean {
  return !ff.avoidedTrackIds?.includes(trackId);
}

/**
 * Builds alternating video and Freeze Frame hold segments across [clipStart, clipEnd].
 * Adding a 5s Freeze Frame increases effective clip timeline duration by 5s cleanly.
 */
export function buildVirtualTimelineSegments(
  clipStart: number,
  clipEnd: number,
  activeFreezeFrames: FreezeFrame[]
): { segments: VirtualTimelineSegment[]; totalDuration: number } {
  const safeStart = Math.max(0, clipStart);
  const safeEnd = Math.max(safeStart + 0.5, clipEnd);
  const sortedFFs = [...activeFreezeFrames]
    .filter((ff) => ff.timestamp >= safeStart - 0.05 && ff.timestamp <= safeEnd + 0.05)
    .sort((a, b) => a.timestamp - b.timestamp);

  const segments: VirtualTimelineSegment[] = [];
  let cursorVideo = safeStart;
  let cursorVirtual = 0;

  for (const ff of sortedFFs) {
    const ffVideoTime = Math.max(safeStart, Math.min(safeEnd, ff.timestamp));
    if (ffVideoTime > cursorVideo + 0.0005) {
      const vidDur = ffVideoTime - cursorVideo;
      segments.push({
        type: 'video',
        virtualStart: cursorVirtual,
        virtualEnd: cursorVirtual + vidDur,
        videoStart: cursorVideo,
        videoEnd: ffVideoTime,
        duration: vidDur,
      });
      cursorVirtual += vidDur;
      cursorVideo = ffVideoTime;
    }

    const ffDur = Math.max(0.1, ff.duration || 5);
    segments.push({
      type: 'freeze',
      virtualStart: cursorVirtual,
      virtualEnd: cursorVirtual + ffDur,
      videoStart: ffVideoTime,
      videoEnd: ffVideoTime,
      duration: ffDur,
      ff,
    });
    cursorVirtual += ffDur;
  }

  if (safeEnd > cursorVideo + 0.0005 || segments.length === 0) {
    const tailDur = Math.max(0, safeEnd - cursorVideo);
    if (tailDur > 0.0005 || segments.length === 0) {
      segments.push({
        type: 'video',
        virtualStart: cursorVirtual,
        virtualEnd: cursorVirtual + tailDur,
        videoStart: cursorVideo,
        videoEnd: safeEnd,
        duration: tailDur,
      });
      cursorVirtual += tailDur;
    }
  }

  return {
    segments,
    totalDuration: Math.max(0.5, cursorVirtual),
  };
}

/**
 * Converts a source video timestamp into an offset on the expanded NLE timeline [0 .. totalDuration].
 */
export function videoTimeToVirtualOffset(
  videoTime: number,
  segments: VirtualTimelineSegment[],
  clipStart: number,
  boundaryMode: 'before-freeze' | 'after-freeze' = 'before-freeze'
): number {
  let offset = Math.max(0, videoTime - clipStart);
  for (const seg of segments) {
    if (seg.type !== 'freeze') continue;
    const ffT = seg.videoStart;
    if (videoTime > ffT + 0.005) {
      offset += seg.duration;
    } else if (Math.abs(videoTime - ffT) <= 0.005 && boundaryMode === 'after-freeze') {
      offset += seg.duration;
    }
  }
  return Math.max(0, offset);
}

/**
 * Computes current playhead virtual offset along the expanded NLE timeline (video + freeze frame countdown).
 */
export function getPlayheadVirtualOffset(params: {
  currentTime: number;
  activeFreezeFrameId: string | null;
  countdownValue: number;
  editingAnimationFFId: string | null;
  animationPreviewTime: number;
  segments: VirtualTimelineSegment[];
  clipStart: number;
  triggeredFFIds?: Set<string>;
}): number {
  const {
    currentTime,
    activeFreezeFrameId,
    countdownValue,
    editingAnimationFFId,
    animationPreviewTime,
    segments,
    clipStart,
    triggeredFFIds,
  } = params;

  const targetFFId = editingAnimationFFId || activeFreezeFrameId;
  if (targetFFId) {
    const ffSeg = segments.find((s) => s.type === 'freeze' && s.ff?.id === targetFFId);
    if (ffSeg && ffSeg.ff) {
      const ffDur = Math.max(0.1, ffSeg.ff.duration || 5);
      const elapsed =
        editingAnimationFFId === targetFFId
          ? Math.max(0, Math.min(ffDur, animationPreviewTime))
          : Math.max(0, Math.min(ffDur, ffDur - countdownValue));
      return ffSeg.virtualStart + elapsed;
    }
  }

  let offset = Math.max(0, currentTime - clipStart);
  for (const seg of segments) {
    if (seg.type !== 'freeze' || !seg.ff) continue;
    const ffT = seg.videoStart;
    if (currentTime > ffT + 0.005) {
      offset += seg.duration;
    } else if (Math.abs(currentTime - ffT) <= 0.005 && triggeredFFIds?.has(seg.ff.id)) {
      offset += seg.duration;
    }
  }
  return Math.max(0, offset);
}

/**
 * Maps a timeline virtual offset back to either a video playback timestamp or a Freeze Frame scrub position.
 */
export function virtualOffsetToState(
  virtualOffset: number,
  segments: VirtualTimelineSegment[],
  clipStart: number,
  clipEnd: number
):
  | { kind: 'video'; videoTime: number }
  | { kind: 'freeze'; ff: FreezeFrame; videoTime: number; freezeElapsed: number } {
  if (segments.length === 0) {
    return {
      kind: 'video',
      videoTime: Math.max(clipStart, Math.min(clipEnd, clipStart + virtualOffset)),
    };
  }

  const totalDur = segments[segments.length - 1].virtualEnd;
  const clamped = Math.max(0, Math.min(totalDur, virtualOffset));

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;
    if (clamped >= seg.virtualStart && (clamped < seg.virtualEnd || isLast)) {
      if (seg.type === 'freeze' && seg.ff) {
        return {
          kind: 'freeze',
          ff: seg.ff,
          videoTime: seg.videoStart,
          freezeElapsed: Math.max(0, Math.min(seg.duration, clamped - seg.virtualStart)),
        };
      }
      const inSeg = clamped - seg.virtualStart;
      return {
        kind: 'video',
        videoTime: Math.max(clipStart, Math.min(clipEnd, seg.videoStart + inSeg)),
      };
    }
  }

  return {
    kind: 'video',
    videoTime: clipEnd,
  };
}

/**
 * Converts a virtual timeline offset directly into source video timestamp [clipStart .. clipEnd].
 */
export function virtualOffsetToVideoTime(
  virtualOffset: number,
  segments: VirtualTimelineSegment[],
  clipStart: number,
  clipEnd: number
): number {
  const mapped = virtualOffsetToState(virtualOffset, segments, clipStart, clipEnd);
  return mapped.videoTime;
}
