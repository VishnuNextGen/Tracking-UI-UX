import { PlaylistItem, PlaylistClip, Playlist, TagEvent, FreezeFrame } from '../types';

export interface ResolvedClipTiming {
  startTime: number;
  endTime: number;
  duration: number;
  originalStartTime: number;
  originalEndTime: number;
  originalDuration: number;
  isTrimmed: boolean;
  inTrimDelta: number;
  outTrimDelta: number;
  durationDelta: number;
}

export interface PlaylistSegment {
  index: number;
  instanceId: string;
  eventId: string;
  projectId?: string;
  projectName?: string;
  item: PlaylistItem;
  tagEvent?: TagEvent;
  startTime: number;
  endTime: number;
  duration: number;
  originalStartTime: number;
  originalEndTime: number;
  originalDuration: number;
  isTrimmed: boolean;
  durationDelta: number;
  macroStart: number;
  macroEnd: number;
}

/**
 * Extracts the master event ID from a PlaylistItem (whether string or PlaylistClip object)
 */
export function getClipEventId(item: PlaylistItem | undefined | null): string {
  if (!item) return '';
  if (typeof item === 'string') return item;
  return item.eventId || (item as any).id || '';
}

/**
 * Gets a stable unique instance ID for a playlist item
 */
export function getClipInstanceId(item: PlaylistItem | undefined | null, fallbackIndex: number): string {
  if (!item) return `clip-${fallbackIndex}`;
  if (typeof item === 'string') return `${item}-${fallbackIndex}`;
  return item.instanceId || `${item.eventId || (item as any).id || 'item'}-${fallbackIndex}`;
}

/**
 * Resolves the effective start/end times and calculates delta against the master timeline event
 */
export function resolveClipTiming(
  item: PlaylistItem | undefined | null,
  masterEvent: TagEvent | undefined | null
): ResolvedClipTiming {
  const originalStart = masterEvent 
    ? masterEvent.startTime 
    : (typeof item === 'object' && item && item.inPoint !== undefined ? item.inPoint : 0);
  const originalEnd = masterEvent 
    ? masterEvent.endTime 
    : (typeof item === 'object' && item && item.outPoint !== undefined ? item.outPoint : originalStart + 5);
  const originalDuration = Math.max(0, originalEnd - originalStart);

  if (!item || typeof item === 'string') {
    return {
      startTime: originalStart,
      endTime: originalEnd,
      duration: originalDuration,
      originalStartTime: originalStart,
      originalEndTime: originalEnd,
      originalDuration,
      isTrimmed: false,
      inTrimDelta: 0,
      outTrimDelta: 0,
      durationDelta: 0
    };
  }

  const startTime = item.inPoint !== undefined ? item.inPoint : originalStart;
  const endTime = item.outPoint !== undefined ? item.outPoint : originalEnd;
  const duration = Math.max(0, endTime - startTime);

  const isTrimmed = Boolean(
    (item.inPoint !== undefined && Math.abs(item.inPoint - originalStart) > 0.05) ||
    (item.outPoint !== undefined && Math.abs(item.outPoint - originalEnd) > 0.05)
  );

  const inTrimDelta = startTime - originalStart;
  const outTrimDelta = endTime - originalEnd;
  const durationDelta = duration - originalDuration;

  return {
    startTime,
    endTime,
    duration,
    originalStartTime: originalStart,
    originalEndTime: originalEnd,
    originalDuration,
    isTrimmed,
    inTrimDelta,
    outTrimDelta,
    durationDelta
  };
}

/**
 * Updates a playlist item's custom trim without affecting the master event
 */
export function updateClipTrim(
  item: PlaylistItem,
  newStart: number,
  newEnd: number,
  instanceId?: string
): PlaylistClip {
  const eventId = getClipEventId(item);
  const stableId = instanceId || (typeof item === 'object' && item.instanceId ? item.instanceId : `${eventId}-${Date.now()}`);
  const existingNotes = typeof item === 'object' ? item.notes : undefined;
  const projectId = typeof item === 'object' ? item.projectId : undefined;
  const projectName = typeof item === 'object' ? item.projectName : undefined;
  const deactivatedFreezeFrameIds = typeof item === 'object' && Array.isArray(item.deactivatedFreezeFrameIds)
    ? [...item.deactivatedFreezeFrameIds]
    : undefined;
  const enabledFreezeFrameIds = typeof item === 'object' && Array.isArray((item as any).enabledFreezeFrameIds)
    ? [...(item as any).enabledFreezeFrameIds]
    : undefined;
  const isolatedFreezeFrames = typeof item === 'object' ? item.isolatedFreezeFrames : undefined;
  const trackedShapes = typeof item === 'object' ? item.trackedShapes : undefined;

  return {
    instanceId: stableId,
    eventId,
    projectId,
    projectName,
    inPoint: Math.max(0, Math.min(newStart, newEnd - 0.1)),
    outPoint: Math.max(newStart + 0.1, newEnd),
    notes: existingNotes,
    deactivatedFreezeFrameIds,
    enabledFreezeFrameIds,
    isolatedFreezeFrames,
    trackedShapes,
  };
}

/**
 * Resets a playlist item's trim back to master event bounds
 */
export function resetClipTrim(item: PlaylistItem): PlaylistItem {
  const eventId = getClipEventId(item);
  if (typeof item === 'string') return item;
  return {
    instanceId: item.instanceId,
    eventId,
    projectId: item.projectId,
    projectName: item.projectName,
    notes: item.notes,
    deactivatedFreezeFrameIds: item.deactivatedFreezeFrameIds ? [...item.deactivatedFreezeFrameIds] : undefined,
    enabledFreezeFrameIds: (item as any).enabledFreezeFrameIds ? [...(item as any).enabledFreezeFrameIds] : undefined,
    isolatedFreezeFrames: item.isolatedFreezeFrames,
    trackedShapes: item.trackedShapes,
  };
}

/**
 * Computes contiguous macro-timeline coordinates for all clips in a playlist
 */
export function calculatePlaylistSequence(
  playlist: Playlist | undefined | null,
  tagEvents: TagEvent[],
  allBatchProjects?: any[]
): { totalDuration: number; segments: PlaylistSegment[] } {
  if (!playlist || !playlist.events || playlist.events.length === 0) {
    return { totalDuration: 0, segments: [] };
  }

  let accumulatedTime = 0;
  const segments: PlaylistSegment[] = [];

  playlist.events.forEach((item, index) => {
    const eventId = getClipEventId(item);
    let tagEvent = tagEvents.find(e => e.id === eventId);
    let projectId = typeof item === 'object' ? item.projectId : undefined;
    let projectName = typeof item === 'object' ? item.projectName : undefined;

    // Fallback to search allBatchProjects if tagEvent or project metadata is missing
    if (allBatchProjects && (!tagEvent || !projectId || !projectName)) {
      if (projectId) {
        const p = allBatchProjects.find(bp => bp.id === projectId);
        if (p) {
          if (!tagEvent) tagEvent = p.data?.tagEvents?.find((e: any) => e.id === eventId);
          if (!projectName) projectName = p.name;
        }
      }
      if (!tagEvent) {
        for (const p of allBatchProjects) {
          const found = p.data?.tagEvents?.find((e: any) => e.id === eventId);
          if (found) {
            tagEvent = found;
            if (!projectId) projectId = p.id;
            if (!projectName) projectName = p.name;
            break;
          }
        }
      }
    }

    const resolved = resolveClipTiming(item, tagEvent);
    const duration = resolved.duration;

    const macroStart = accumulatedTime;
    const macroEnd = accumulatedTime + duration;
    accumulatedTime = macroEnd;

    segments.push({
      index,
      instanceId: getClipInstanceId(item, index),
      eventId,
      projectId,
      projectName,
      item,
      tagEvent,
      startTime: resolved.startTime,
      endTime: resolved.endTime,
      duration,
      originalStartTime: resolved.originalStartTime,
      originalEndTime: resolved.originalEndTime,
      originalDuration: resolved.originalDuration,
      isTrimmed: resolved.isTrimmed,
      durationDelta: resolved.durationDelta,
      macroStart,
      macroEnd
    });
  });

  return { totalDuration: accumulatedTime, segments };
}

/**
 * Translates current master video time into macro-timeline time
 */
export function getMacroTimeFromVideoTime(
  videoTime: number,
  activeClipIndex: number,
  segments: PlaylistSegment[]
): number {
  if (!segments.length || activeClipIndex < 0 || activeClipIndex >= segments.length) {
    return 0;
  }
  const currentSegment = segments[activeClipIndex];
  const clipProgress = Math.max(0, Math.min(currentSegment.duration, videoTime - currentSegment.startTime));
  return currentSegment.macroStart + clipProgress;
}

/**
 * Translates macro-timeline time into target video time and clip index
 */
export function getVideoTimeFromMacroTime(
  macroTime: number,
  segments: PlaylistSegment[]
): { videoTime: number; clipIndex: number } {
  if (!segments.length) return { videoTime: 0, clipIndex: 0 };

  const clampedMacro = Math.max(0, Math.min(macroTime, segments[segments.length - 1].macroEnd));
  
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (clampedMacro >= seg.macroStart && (clampedMacro < seg.macroEnd || i === segments.length - 1)) {
      const offset = clampedMacro - seg.macroStart;
      return {
        videoTime: seg.startTime + offset,
        clipIndex: i
      };
    }
  }

  return { videoTime: segments[0].startTime, clipIndex: 0 };
}

/**
 * Gets array of deactivated freeze frame IDs for a playlist clip
 */
export function getClipDeactivatedFreezeFrameIds(item: PlaylistItem | undefined | null): string[] {
  if (!item || typeof item === 'string' || !Array.isArray(item.deactivatedFreezeFrameIds)) {
    return [];
  }
  return item.deactivatedFreezeFrameIds;
}

/**
 * Gets array of explicitly enabled freeze frame IDs for a playlist clip
 */
export function getClipEnabledFreezeFrameIds(item: PlaylistItem | undefined | null): string[] {
  if (!item || typeof item === 'string' || !Array.isArray((item as any).enabledFreezeFrameIds)) {
    return [];
  }
  return (item as any).enabledFreezeFrameIds;
}

/**
 * Checks whether a specific freeze frame is active for a clip.
 * Default behavior:
 * - If freeze frame was created in this clip (ff.clipInstanceId === currentInstanceId), it is ON by default.
 * - If freeze frame was created in another clip (ff.clipInstanceId !== currentInstanceId), it is OFF by default.
 * - If freeze frame was created on match timeline (no clipInstanceId), it is ON by default.
 * - Explicit item overrides (deactivatedFreezeFrameIds / enabledFreezeFrameIds) always win!
 */
export function isFreezeFrameActiveForClip(
  ff: FreezeFrame,
  item: PlaylistItem | undefined | null,
  fallbackIndex: number = 0
): boolean {
  if (!item) return true;
  const currentInstanceId = getClipInstanceId(item, fallbackIndex);
  const deactivatedIds = getClipDeactivatedFreezeFrameIds(item);
  if (deactivatedIds.includes(ff.id)) {
    return false;
  }
  const enabledIds = getClipEnabledFreezeFrameIds(item);
  if (enabledIds.includes(ff.id)) {
    return true;
  }

  // If this frame was added to a specific clip instance, it is exclusively active there by default!
  if (ff.clipInstanceId) {
    return ff.clipInstanceId === currentInstanceId;
  }

  return true;
}

/**
 * Checks whether a specific freeze frame is deactivated for a clip
 */
export function isFreezeFrameDeactivatedForClip(
  item: PlaylistItem | undefined | null,
  freezeFrameId: string,
  candidateFreezeFrames: FreezeFrame[] = [],
  fallbackIndex: number = 0
): boolean {
  const targetFF = candidateFreezeFrames.find(f => f.id === freezeFrameId);
  if (targetFF) {
    return !isFreezeFrameActiveForClip(targetFF, item, fallbackIndex);
  }
  return getClipDeactivatedFreezeFrameIds(item).includes(freezeFrameId);
}

export interface ClipFreezeFramesInfo {
  totalCount: number;
  activeCount: number;
  deactivatedCount: number;
  allClipFreezeFrames: FreezeFrame[];
  activeFreezeFrames: FreezeFrame[];
  deactivatedFreezeFrames: FreezeFrame[];
  isIsolated?: boolean;
}

/**
 * Resolves all freeze frames situated within a clip's time range, separating active vs deactivated.
 * Automatically respects clip exclusivity: new frames created in a clip do not appear in other clips unless turned on.
 */
export function getClipFreezeFramesInfo(
  item: PlaylistItem | undefined | null,
  timing: { startTime: number; endTime: number },
  candidateFreezeFrames: FreezeFrame[] = [],
  fallbackIndex: number = 0
): ClipFreezeFramesInfo {
  const start = timing.startTime - 0.05;
  const end = timing.endTime + 0.05;

  const allClipFreezeFrames = candidateFreezeFrames
    .filter(ff => ff.timestamp >= start && ff.timestamp <= end)
    .sort((a, b) => a.timestamp - b.timestamp);

  const activeFreezeFrames: FreezeFrame[] = [];
  const deactivatedFreezeFrames: FreezeFrame[] = [];

  for (const ff of allClipFreezeFrames) {
    if (isFreezeFrameActiveForClip(ff, item, fallbackIndex)) {
      activeFreezeFrames.push(ff);
    } else {
      deactivatedFreezeFrames.push(ff);
    }
  }

  return {
    totalCount: allClipFreezeFrames.length,
    activeCount: activeFreezeFrames.length,
    deactivatedCount: deactivatedFreezeFrames.length,
    allClipFreezeFrames,
    activeFreezeFrames,
    deactivatedFreezeFrames,
    isIsolated: typeof item === 'object' && Boolean(item?.isolatedFreezeFrames)
  };
}

/**
 * Toggles a freeze frame's activation status specifically for a given playlist clip
 */
export function toggleClipFreezeFrameDeactivation(
  item: PlaylistItem,
  freezeFrameId: string,
  candidateFreezeFrames: FreezeFrame[] = [],
  fallbackIndex: number = 0
): PlaylistClip {
  const eventId = getClipEventId(item);
  const stableId = getClipInstanceId(item, fallbackIndex);
  const existingNotes = typeof item === 'object' ? item.notes : undefined;
  const projectId = typeof item === 'object' ? item.projectId : undefined;
  const projectName = typeof item === 'object' ? item.projectName : undefined;
  const inPoint = typeof item === 'object' ? item.inPoint : undefined;
  const outPoint = typeof item === 'object' ? item.outPoint : undefined;
  const isolatedFreezeFrames = typeof item === 'object' ? item.isolatedFreezeFrames : undefined;
  const trackedShapes = typeof item === 'object' ? item.trackedShapes : undefined;

  const targetFF = candidateFreezeFrames.find(f => f.id === freezeFrameId);
  const currentDeactivated = getClipDeactivatedFreezeFrameIds(item);
  const currentEnabled = getClipEnabledFreezeFrameIds(item);

  const isCurrentlyActive = targetFF
    ? isFreezeFrameActiveForClip(targetFF, item, fallbackIndex)
    : !currentDeactivated.includes(freezeFrameId);

  let nextDeactivated: string[];
  let nextEnabled: string[];

  if (isCurrentlyActive) {
    // Turn it OFF for this clip
    nextDeactivated = Array.from(new Set([...currentDeactivated, freezeFrameId]));
    nextEnabled = currentEnabled.filter(id => id !== freezeFrameId);
  } else {
    // Turn it ON for this clip
    nextEnabled = Array.from(new Set([...currentEnabled, freezeFrameId]));
    nextDeactivated = currentDeactivated.filter(id => id !== freezeFrameId);
  }

  return {
    instanceId: stableId,
    eventId,
    projectId,
    projectName,
    inPoint,
    outPoint,
    notes: existingNotes,
    deactivatedFreezeFrameIds: nextDeactivated,
    enabledFreezeFrameIds: nextEnabled,
    isolatedFreezeFrames,
    trackedShapes
  };
}

/**
 * Activates or deactivates all given freeze frames for a clip
 */
export function setClipAllFreezeFramesDeactivation(
  item: PlaylistItem,
  freezeFrameIds: string[],
  deactivate: boolean,
  fallbackIndex: number = 0
): PlaylistClip {
  const eventId = getClipEventId(item);
  const stableId = getClipInstanceId(item, fallbackIndex);
  const existingNotes = typeof item === 'object' ? item.notes : undefined;
  const projectId = typeof item === 'object' ? item.projectId : undefined;
  const projectName = typeof item === 'object' ? item.projectName : undefined;
  const inPoint = typeof item === 'object' ? item.inPoint : undefined;
  const outPoint = typeof item === 'object' ? item.outPoint : undefined;
  const isolatedFreezeFrames = typeof item === 'object' ? item.isolatedFreezeFrames : undefined;
  const trackedShapes = typeof item === 'object' ? item.trackedShapes : undefined;

  let nextDeactivated: string[];
  let nextEnabled: string[];

  if (deactivate) {
    nextDeactivated = Array.from(new Set([...getClipDeactivatedFreezeFrameIds(item), ...freezeFrameIds]));
    nextEnabled = getClipEnabledFreezeFrameIds(item).filter(id => !freezeFrameIds.includes(id));
  } else {
    nextEnabled = Array.from(new Set([...getClipEnabledFreezeFrameIds(item), ...freezeFrameIds]));
    nextDeactivated = getClipDeactivatedFreezeFrameIds(item).filter(id => !freezeFrameIds.includes(id));
  }

  return {
    instanceId: stableId,
    eventId,
    projectId,
    projectName,
    inPoint,
    outPoint,
    notes: existingNotes,
    deactivatedFreezeFrameIds: nextDeactivated,
    enabledFreezeFrameIds: nextEnabled,
    isolatedFreezeFrames,
    trackedShapes
  };
}

/**
 * Toggles a clip's independent freeze frames isolation mode.
 */
export function toggleClipFreezeFrameIsolation(
  item: PlaylistItem,
  fallbackIndex: number = 0
): PlaylistClip {
  const eventId = getClipEventId(item);
  const stableId = getClipInstanceId(item, fallbackIndex);
  const existingNotes = typeof item === 'object' ? item.notes : undefined;
  const projectId = typeof item === 'object' ? item.projectId : undefined;
  const projectName = typeof item === 'object' ? item.projectName : undefined;
  const inPoint = typeof item === 'object' ? item.inPoint : undefined;
  const outPoint = typeof item === 'object' ? item.outPoint : undefined;
  const deactivatedFreezeFrameIds = typeof item === 'object' && Array.isArray(item.deactivatedFreezeFrameIds)
    ? [...item.deactivatedFreezeFrameIds]
    : [];
  const currentIsolated = typeof item === 'object' ? Boolean(item.isolatedFreezeFrames) : false;
  const trackedShapes = typeof item === 'object' ? item.trackedShapes : undefined;

  return {
    instanceId: stableId,
    eventId,
    projectId,
    projectName,
    inPoint,
    outPoint,
    notes: existingNotes,
    deactivatedFreezeFrameIds,
    isolatedFreezeFrames: !currentIsolated,
    trackedShapes
  };
}

/**
 * When a new freeze frame is created while focused on a playlist clip,
 * automatically deactivates it in other clips in the playlist that overlap that timestamp.
 * This prevents new freeze frames added in Clip #2 from unexpectedly showing in Clip #1!
 */
export function deactivateFreezeFrameInOtherPlaylistClips(
  playlists: Playlist[],
  activePlaylistId: string,
  currentClipIndex: number,
  newFreezeFrameId: string,
  timestamp: number,
  tagEvents: TagEvent[] = []
): { updatedPlaylists: Playlist[]; affectedCount: number } {
  let affectedCount = 0;

  const updatedPlaylists = playlists.map(pl => {
    if (pl.id !== activePlaylistId) return pl;

    const currentItem = pl.events[currentClipIndex];
    const currentInstanceId = typeof currentItem === 'object' ? currentItem?.instanceId : null;

    const newEvents = pl.events.map((item, idx) => {
      if (idx === currentClipIndex) return item;

      const eventId = getClipEventId(item);
      const masterEvent = tagEvents.find(e => e.id === eventId);
      const timing = resolveClipTiming(item, masterEvent);

      // Check if this other clip spans the timestamp of the new freeze frame
      if (timestamp >= timing.startTime - 0.1 && timestamp <= timing.endTime + 0.1) {
        affectedCount++;
        const currentDeact = getClipDeactivatedFreezeFrameIds(item);
        if (!currentDeact.includes(newFreezeFrameId)) {
          const stableId = getClipInstanceId(item, idx);
          const objItem = typeof item === 'object' ? item : { eventId };
          return {
            ...objItem,
            instanceId: stableId,
            eventId,
            deactivatedFreezeFrameIds: [...currentDeact, newFreezeFrameId]
          };
        }
      }
      return item;
    });

    return { ...pl, events: newEvents };
  });

  return { updatedPlaylists, affectedCount };
}

/**
 * Isolates freeze frames between duplicate or overlapping sibling clips in a playlist.
 * For the active clip: locks its current active freeze frames and deactivates them on all sister clips.
 * Also deactivates sister clips' active frames on the active clip.
 */
export function isolateClipFreezeFramesInPlaylist(
  playlists: Playlist[],
  playlistId: string,
  clipIndex: number,
  candidateFreezeFrames: FreezeFrame[],
  tagEvents: TagEvent[] = []
): { updatedPlaylists: Playlist[]; affectedSisterClipsCount: number } {
  let affectedSisterClipsCount = 0;

  const updatedPlaylists = playlists.map(pl => {
    if (pl.id !== playlistId) return pl;

    const activeItem = pl.events[clipIndex];
    if (!activeItem) return pl;

    const activeEventId = getClipEventId(activeItem);
    const activeMasterEvent = tagEvents.find(e => e.id === activeEventId);
    const activeTiming = resolveClipTiming(activeItem, activeMasterEvent);
    const activeFfInfo = getClipFreezeFramesInfo(activeItem, activeTiming, candidateFreezeFrames);

    const activeFrameIds = new Set(activeFfInfo.activeFreezeFrames.map(f => f.id));
    const activeDeactivatedIds = new Set(getClipDeactivatedFreezeFrameIds(activeItem));

    const newEvents = pl.events.map((item, idx) => {
      const eventId = getClipEventId(item);
      const masterEvent = tagEvents.find(e => e.id === eventId);
      const timing = resolveClipTiming(item, masterEvent);

      // Check if item is a sister clip (same eventId or overlapping time)
      const isSister = idx !== clipIndex && (
        eventId === activeEventId ||
        (timing.startTime < activeTiming.endTime && timing.endTime > activeTiming.startTime)
      );

      if (isSister) {
        affectedSisterClipsCount++;
        const sisterDeactivated = new Set(getClipDeactivatedFreezeFrameIds(item));
        // Add active clip's frames to sister's deactivated set
        activeFrameIds.forEach(id => sisterDeactivated.add(id));

        // Mark sister clip's active frames to be deactivated on active clip
        const sisterFfInfo = getClipFreezeFramesInfo(item, timing, candidateFreezeFrames);
        sisterFfInfo.activeFreezeFrames.forEach(f => {
          if (!activeFrameIds.has(f.id)) {
            activeDeactivatedIds.add(f.id);
          }
        });

        const stableId = getClipInstanceId(item, idx);
        const objItem = typeof item === 'object' ? item : { eventId };
        return {
          ...objItem,
          instanceId: stableId,
          eventId,
          deactivatedFreezeFrameIds: Array.from(sisterDeactivated),
          isolatedFreezeFrames: true
        };
      }

      return item;
    });

    // Update active item with isolation mode enabled and sister frames deactivated
    const activeStableId = getClipInstanceId(activeItem, clipIndex);
    const activeObjItem = typeof activeItem === 'object' ? activeItem : { eventId: activeEventId };
    newEvents[clipIndex] = {
      ...activeObjItem,
      instanceId: activeStableId,
      eventId: activeEventId,
      deactivatedFreezeFrameIds: Array.from(activeDeactivatedIds),
      isolatedFreezeFrames: true
    };

    return { ...pl, events: newEvents };
  });

  return { updatedPlaylists, affectedSisterClipsCount };
}
