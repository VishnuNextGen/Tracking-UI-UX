import type { PeriodSync, ProjectData } from '../types';

export interface CanonicalPeriodInfo {
  id: PeriodSync['id'];
  name: string;
  shortLabel: string;
  matchStartOffset: number;
  normalDuration: number;
}

export const CANONICAL_PERIODS: readonly CanonicalPeriodInfo[] = [
  { id: '1st-half', name: '1st Half Kick-off', shortLabel: '1H', matchStartOffset: 0, normalDuration: 45 * 60 },
  { id: '2nd-half', name: '2nd Half Kick-off', shortLabel: '2H', matchStartOffset: 45 * 60, normalDuration: 45 * 60 },
  { id: 'et-1st', name: 'Extra Time - First Half', shortLabel: 'ET1', matchStartOffset: 90 * 60, normalDuration: 15 * 60 },
  { id: 'et-2nd', name: 'Extra Time - Second Half', shortLabel: 'ET2', matchStartOffset: 105 * 60, normalDuration: 15 * 60 },
  { id: 'penalties', name: 'Penalties', shortLabel: 'PEN', matchStartOffset: 120 * 60, normalDuration: 0 },
] as const;

export const getCanonicalPeriod = (id?: string | null): CanonicalPeriodInfo | undefined => {
  if (!id) return undefined;
  return CANONICAL_PERIODS.find(p => p.id === id);
};

/**
 * Formats seconds as MM:SS (or MM:SS.d if includeTenths is true and fractional part exists).
 * Supports > 60 minutes (e.g. 68:15) cleanly for football match video analysis.
 */
export const formatSyncClock = (seconds: number, includeTenths = false): string => {
  if (!Number.isFinite(seconds) || Number.isNaN(seconds)) return '00:00';
  const sign = seconds < 0 ? '-' : '';
  const abs = Math.abs(seconds);
  const totalWholeSeconds = Math.floor(abs + 1e-6);
  const mins = Math.floor(totalWholeSeconds / 60);
  const secs = totalWholeSeconds % 60;
  const tenths = Math.floor(((abs - totalWholeSeconds) + 1e-6) * 10);

  const base = `${sign}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  if (includeTenths && tenths > 0) {
    return `${base}.${tenths}`;
  }
  return base;
};

/**
 * Parses manual time strings cleanly:
 * - "03:42" -> 222
 * - "03:42.5" -> 222.5
 * - "01:05:12" -> 3912
 * - "01:05:12.4" -> 3912.4
 * - "45m" -> 2700
 * - "90s" -> 90
 * - "45" -> 2700 (plain integer defaults to minutes)
 */
export const parseSyncTimeInput = (raw: string): number | null => {
  const cleaned = raw.trim();
  if (!cleaned) return null;

  // Explicit seconds suffix, e.g. "90s" or "12.5s"
  if (/^\d+(\.\d+)?s$/i.test(cleaned)) {
    const val = parseFloat(cleaned.slice(0, -1));
    return Number.isFinite(val) && val >= 0 ? val : null;
  }

  // Explicit minutes suffix, e.g. "45m" or "45'"
  if (/^\d+(\.\d+)?[m']$/i.test(cleaned)) {
    const val = parseFloat(cleaned.slice(0, -1));
    return Number.isFinite(val) && val >= 0 ? val * 60 : null;
  }

  // Plain number without colons -> minutes (consistent with match analysis convention, with 0 -> 0)
  if (/^\d+(\.\d+)?$/.test(cleaned)) {
    const val = parseFloat(cleaned);
    return Number.isFinite(val) && val >= 0 ? val * 60 : null;
  }

  // Colon-separated MM:SS(.d) or HH:MM:SS(.d)
  const parts = cleaned.split(':');
  if (parts.length === 2) {
    const mins = Number(parts[0]);
    const secs = Number(parts[1]);
    if (!Number.isFinite(mins) || !Number.isFinite(secs) || mins < 0 || secs < 0 || secs >= 60) {
      // Allow secs >= 60 only if user typed something unusual? Keep standard 0..59.999
      if (!Number.isFinite(mins) || !Number.isFinite(secs) || mins < 0 || secs < 0) return null;
    }
    return mins * 60 + secs;
  }

  if (parts.length === 3) {
    const hrs = Number(parts[0]);
    const mins = Number(parts[1]);
    const secs = Number(parts[2]);
    if (!Number.isFinite(hrs) || !Number.isFinite(mins) || !Number.isFinite(secs) || hrs < 0 || mins < 0 || secs < 0) {
      return null;
    }
    return hrs * 3600 + mins * 60 + secs;
  }

  return null;
};

/**
 * Ensures all periods coded during a Live Tagging session exist in `periodSyncs`
 * (including `1st-half` even if the clock was started via Resume or events were tagged directly)
 * and marks them all with `needsVideoSync: true` when a match video is uploaded.
 */
export const prepareLivePeriodSyncsForVideo = (data?: Partial<ProjectData> | null): PeriodSync[] => {
  const existingSyncs = data?.periodSyncs || [];
  const tagEvents = data?.tagEvents || [];
  const markers = data?.markers || [];

  const requiredIds = new Set<PeriodSync['id']>();

  // Always include 1st-half when transitioning a Live project to an uploaded video
  requiredIds.add('1st-half');

  existingSyncs.forEach(s => {
    if (CANONICAL_PERIODS.some(p => p.id === s.id)) {
      requiredIds.add(s.id);
    }
  });

  tagEvents.forEach(evt => {
    if (evt.periodId && CANONICAL_PERIODS.some(p => p.id === evt.periodId)) {
      requiredIds.add(evt.periodId as PeriodSync['id']);
    }
  });

  markers.forEach(m => {
    if (m.periodId && CANONICAL_PERIODS.some(p => p.id === m.periodId)) {
      requiredIds.add(m.periodId as PeriodSync['id']);
    }
  });

  let lastTime = -1;
  const result: PeriodSync[] = [];

  for (const period of CANONICAL_PERIODS) {
    if (!requiredIds.has(period.id)) continue;

    const existing = existingSyncs.find(s => s.id === period.id);
    let videoTime = existing ? existing.videoTimeSeconds : period.matchStartOffset;
    if (videoTime <= lastTime) {
      videoTime = lastTime + 1;
    }
    lastTime = videoTime;

    result.push({
      id: period.id,
      name: period.name,
      videoTimeSeconds: videoTime,
      needsVideoSync: true,
    });
  }

  return result;
};

/**
 * Computes the corresponding Match Clock (e.g. "1H 23:14" or "2H 45+2'") for a given video timestamp
 * based on active `periodSyncs`.
 */
export const getMatchClockForVideoTime = (
  videoTime: number,
  periodSyncs: PeriodSync[]
): {
  period: CanonicalPeriodInfo;
  sync: PeriodSync;
  elapsedInPeriod: number;
  matchTimeSeconds: number;
  displayClock: string;
} | null => {
  if (!periodSyncs || periodSyncs.length === 0) return null;

  const sorted = [...periodSyncs].sort((a, b) => a.videoTimeSeconds - b.videoTimeSeconds);
  let matchedSync: PeriodSync | null = null;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (videoTime >= sorted[i].videoTimeSeconds) {
      matchedSync = sorted[i];
      break;
    }
  }

  if (!matchedSync) return null;
  const period = getCanonicalPeriod(matchedSync.id);
  if (!period) return null;

  const elapsed = Math.max(0, videoTime - matchedSync.videoTimeSeconds);
  const matchTimeSeconds = period.matchStartOffset + elapsed;

  let displayClock: string;
  if (period.normalDuration > 0 && elapsed > period.normalDuration) {
    const baseMins = Math.floor((period.matchStartOffset + period.normalDuration) / 60);
    const extraSecs = elapsed - period.normalDuration;
    displayClock = `${baseMins}:00 +${formatSyncClock(extraSecs)}`;
  } else {
    displayClock = formatSyncClock(matchTimeSeconds);
  }

  return {
    period,
    sync: matchedSync,
    elapsedInPeriod: elapsed,
    matchTimeSeconds,
    displayClock,
  };
};
