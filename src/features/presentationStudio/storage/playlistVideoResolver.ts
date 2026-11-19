import type { Batch, Playlist, Project } from '../../../types';
import {
  cacheVideoFileInMemory,
  getCachedVideoFile,
  hasVideoLocally,
  loadFileHandle,
  loadVideoLocally,
  saveVideoLocally,
} from '../../../utils/db';
import {
  getClipEventId,
  isFreezeFrameActiveForClip,
  resolveClipTiming,
} from '../../../utils/playlistUtils';
import type { ImportedPlaylistClip } from '../types/presentation';
import { uid } from '../constants/themesAndLayouts';

const objectUrlCache = new Map<string, string>();
const inflightResolutions = new Map<string, Promise<string | null>>();

export function getCachedVideoObjectUrl(projectId: string): string | null {
  return objectUrlCache.get(projectId) || null;
}

export async function resolveProjectVideoUrl(projectId: string): Promise<string | null> {
  if (!projectId) return null;

  const existing = objectUrlCache.get(projectId);
  if (existing) return existing;

  const inflight = inflightResolutions.get(projectId);
  if (inflight) return inflight;

  const task = (async (): Promise<string | null> => {
    try {
      let file: File | null = getCachedVideoFile(projectId);

      if (!file) {
        try {
          const handle = await loadFileHandle(projectId);
          if (handle && typeof handle.queryPermission === 'function') {
            const perm = await handle.queryPermission({ mode: 'read' });
            if (perm === 'granted') {
              const f = await handle.getFile();
              if (f && f.size > 0) {
                cacheVideoFileInMemory(projectId, f);
                file = f;
              }
            }
          }
        } catch {
          // ignore handle lookup errors
        }
      }

      if (!file) {
        file = await loadVideoLocally(projectId);
      }

      if (file && file.size > 0) {
        const url = URL.createObjectURL(file);
        objectUrlCache.set(projectId, url);
        return url;
      }
      return null;
    } finally {
      inflightResolutions.delete(projectId);
    }
  })();

  inflightResolutions.set(projectId, task);
  return task;
}

export async function relinkProjectVideoFile(projectId: string, file: File): Promise<string> {
  const prev = objectUrlCache.get(projectId);
  if (prev) {
    try {
      URL.revokeObjectURL(prev);
    } catch {
      // ignore
    }
    objectUrlCache.delete(projectId);
  }
  await saveVideoLocally(projectId, file);
  const url = URL.createObjectURL(file);
  objectUrlCache.set(projectId, url);
  return url;
}

export async function checkProjectHasVideo(projectId: string): Promise<boolean> {
  if (!projectId) return false;
  if (objectUrlCache.has(projectId) || getCachedVideoFile(projectId)) return true;
  try {
    const handle = await loadFileHandle(projectId);
    if (handle && typeof handle.queryPermission === 'function') {
      const perm = await handle.queryPermission({ mode: 'read' });
      if (perm === 'granted') return true;
    }
  } catch {
    // ignore
  }
  return await hasVideoLocally(projectId);
}

/**
 * Extracts resolved ImportedPlaylistClip items from a Project Playlist or Batch Multi-Game Playlist.
 */
export function extractClipsFromPlaylist(params: {
  playlist: Playlist;
  primaryProject?: Project;
  allProjects: Project[];
  batch?: Batch;
}): ImportedPlaylistClip[] {
  const { playlist, primaryProject, allProjects } = params;
  const result: ImportedPlaylistClip[] = [];

  (playlist.events || []).forEach((item, clipIdx) => {
    const eventId = getClipEventId(item);
    const explicitProjectId = typeof item === 'object' ? item.projectId : undefined;

    let sourceProject: Project | undefined =
      (explicitProjectId ? allProjects.find((p) => p.id === explicitProjectId) : undefined) ||
      (primaryProject?.data?.tagEvents?.some((e) => e.id === eventId) ? primaryProject : undefined) ||
      allProjects.find((p) => p.data?.tagEvents?.some((e) => e.id === eventId)) ||
      primaryProject;

    if (!sourceProject) return;

    const tagEvent = sourceProject.data?.tagEvents?.find((e) => e.id === eventId);
    const timing = resolveClipTiming(item, tagEvent);
    if (timing.duration <= 0.05) return;

    const tag = tagEvent
      ? sourceProject.data?.tags?.find((t) => t.id === tagEvent.tagId)
      : undefined;

    const projectFreezeFrames = sourceProject.data?.freezeFrames || [];
    const activeFfs = projectFreezeFrames
      .filter(
        (ff) =>
          ff.timestamp >= timing.startTime - 0.05 &&
          ff.timestamp <= timing.endTime + 0.05 &&
          isFreezeFrameActiveForClip(ff, item, clipIdx)
      )
      .map((ff) => ({
        id: ff.id,
        timestamp: ff.timestamp,
        duration: ff.duration || 2.5,
        name: ff.name,
      }));

    const itemNotes =
      (typeof item === 'object' ? item.notes : undefined) || tagEvent?.notes || undefined;

    result.push({
      id: uid('vclip'),
      projectId: sourceProject.id,
      projectName:
        (typeof item === 'object' && item.projectName) || sourceProject.name || 'Analysis Project',
      playlistId: playlist.id,
      playlistName: playlist.name || 'Playlist',
      eventId,
      tagName: tag?.name || 'Tagged Clip',
      tagColor: tag?.color || '#c6ff1f',
      notes: itemNotes,
      startTime: timing.startTime,
      endTime: timing.endTime,
      freezeFrames: activeFfs.length > 0 ? activeFfs : undefined,
    });
  });

  return result;
}

export function extractClipFromProjectEvent(project: Project, eventId: string): ImportedPlaylistClip | null {
  const tagEvent = project.data?.tagEvents?.find((e) => e.id === eventId);
  if (!tagEvent) return null;
  const duration = Math.max(0, tagEvent.endTime - tagEvent.startTime);
  if (duration <= 0.05) return null;
  const tag = project.data?.tags?.find((t) => t.id === tagEvent.tagId);
  return {
    id: uid('vclip'),
    projectId: project.id,
    projectName: project.name || 'Analysis Project',
    playlistId: 'events',
    playlistName: 'Tagged Events',
    eventId: tagEvent.id,
    tagName: tag?.name || 'Event',
    tagColor: tag?.color || '#c6ff1f',
    notes: tagEvent.notes,
    startTime: tagEvent.startTime,
    endTime: tagEvent.endTime,
  };
}

export function formatReelTime(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
