import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  db,
  auth,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import type {
  ProjectStatsSummary,
  UserStatsRecord,
  StatsCloudSyncAdapter,
  InactivityThresholdDays,
} from '../types/telemetry';
import { normalizeUserPersonas } from '../types/user';
import {
  getAllUsers,
  getCurrentUser,
  isCurrentAuthBootstrappedAdmin,
} from './userPlanStore';
import {
  listProjectsLocally,
  listBoardProjectsLocally,
  listBatchesLocally,
} from './db';

import { isBootstrappedAdminEmail } from '../firebase';

const USER_STATS_STORAGE_KEY = 'tacstem_user_stats_v2';
const SESSION_STAMPED_KEY = 'tacstem_session_stamped_v2';
const LEGACY_LOCAL_OWNER_KEY = 'tacstem_legacy_claimed_by_v1';
const ADMIN_STATS_SYNC_CURSOR_KEY = 'tacstem_admin_stats_cursor_ms_v1';

/**
 * Quota-friendly sync intervals:
 * - Heartbeat & active workspace telemetry sync at most once every 30 minutes
 * - Dirty local stats flush immediately when user exits Workspace/Board, hides tab, or closes app
 */
const HEARTBEAT_THROTTLE_MS = 30 * 60 * 1000; // 30 minutes
const CLOUD_STATS_FLUSH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

const knownExistingCloudStatsDocs = new Set<string>();
const pendingStatsPayloads = new Map<string, UserStatsRecord>();
const inFlightStatsWrites = new Map<string, Promise<void>>();
let cloudAdapter: StatsCloudSyncAdapter | null = null;
let lastHeartbeatWriteMs = 0;
let lastCloudStatsFlushMs = 0;

// Dirty-flag & scheduled 30-min cloud flush state
const dirtyStatsUserIds = new Set<string>();
let scheduledCloudFlushTimer: ReturnType<typeof setTimeout> | null = null;
const lastFlushedStatsHashByUser = new Map<string, string>();

const projectSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const boardSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function safeBoundedInt(val: unknown, fallback = 0): number {
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return Math.min(99999999999999, Math.floor(num));
}

function computeMeaningfulStatsFingerprint(record: UserStatsRecord): string {
  const projKeys = Object.keys(record.projects || {}).sort();
  return [
    record.userId,
    record.displayName,
    record.plan,
    (record.personas || []).join(','),
    record.sessionsCount,
    record.videoProjectsCount,
    record.liveProjectsCount,
    record.boardProjectsCount,
    record.batchesCount,
    record.totalProjectsCount,
    record.totalEventsCount,
    record.totalActiveTagsCount,
    record.totalFreezeFramesCount,
    record.totalShapesCount,
    record.totalPlaylistClipsCount,
    projKeys.length,
    // Bucket lastActiveAt into 30-minute windows so pure timestamp ticks never force redundant writes
    Math.floor((record.lastActiveAt || 0) / HEARTBEAT_THROTTLE_MS),
  ].join('|');
}

function mapFirestoreDocToStatsRecord(id: string, d: any): UserStatsRecord {
  return {
    userId: id,
    displayName: String(d.displayName || 'Tacstem User'),
    email: String(d.email || ''),
    personas: normalizeUserPersonas(d.personas),
    plan: d.plan === 'pro' ? 'pro' : 'free',
    createdAt: Number(d.createdAtMs) || Date.now(),
    lastActiveAt: Number(d.lastActiveAtMs) > 0 ? Number(d.lastActiveAtMs) : null,
    sessionsCount: Number(d.sessionsCount) || 0,
    videoProjectsCount: Number(d.videoProjectsCount) || 0,
    liveProjectsCount: Number(d.liveProjectsCount) || 0,
    boardProjectsCount: Number(d.boardProjectsCount) || 0,
    batchesCount: Number(d.batchesCount) || 0,
    totalProjectsCount: Number(d.totalProjectsCount) || 0,
    totalEventsCount: Number(d.totalEventsCount) || 0,
    totalActiveTagsCount: Number(d.totalActiveTagsCount) || 0,
    totalFreezeFramesCount: Number(d.totalFreezeFramesCount) || 0,
    totalShapesCount: Number(d.totalShapesCount) || 0,
    totalPlaylistClipsCount: Number(d.totalPlaylistClipsCount) || 0,
    projects: d.projects && typeof d.projects === 'object' ? d.projects : {},
  };
}

function capProjectsMap(
  projects: Record<string, ProjectStatsSummary>
): Record<string, ProjectStatsSummary> {
  const entries = Object.entries(projects || {});
  if (entries.length <= 200) return projects || {};
  entries.sort((a, b) => (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0));
  return Object.fromEntries(entries.slice(0, 200));
}

function getAdminStatsSyncCursorMs(): number {
  try {
    const raw = Number(localStorage.getItem(ADMIN_STATS_SYNC_CURSOR_KEY));
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  } catch {
    return 0;
  }
}

function saveAdminStatsSyncCursorMs(tsMs: number): void {
  try {
    localStorage.setItem(ADMIN_STATS_SYNC_CURSOR_KEY, String(tsMs));
  } catch {
    // ignore
  }
}

async function flushSingleUserStatsWrite(record: UserStatsRecord): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !record.userId || record.userId === 'unauthenticated') return;
  if (fbUser.uid !== record.userId && !isCurrentAuthBootstrappedAdmin()) return;

  const fingerprint = computeMeaningfulStatsFingerprint(record);
  if (lastFlushedStatsHashByUser.get(record.userId) === fingerprint) {
    return;
  }

  const path = `user_stats/${record.userId}`;
  const ref = doc(db, 'user_stats', record.userId);
  const rawEmail =
    fbUser.uid === record.userId
      ? fbUser.email || record.email
      : record.email || 'user@tacstem.app';
  const cleanEmail = (rawEmail || 'user@tacstem.app').trim().toLowerCase().slice(0, 254);
  const safeEmail = cleanEmail.includes('@') ? cleanEmail : 'user@tacstem.app';
  const cleanDisplayName = (record.displayName || safeEmail.split('@')[0] || 'Tacstem User')
    .trim()
    .slice(0, 120);
  const normalizedPersonas = normalizeUserPersonas(record.personas).slice(0, 5);
  const cleanPersonas = normalizedPersonas.length > 0 ? normalizedPersonas : (['analyst'] as const);
  const cappedProjects = capProjectsMap(record.projects || {});

  const baseFields = {
    displayName: cleanDisplayName || 'Tacstem User',
    personas: [...cleanPersonas],
    plan: record.plan === 'pro' ? 'pro' : 'free',
    sessionsCount: safeBoundedInt(record.sessionsCount, 0),
    videoProjectsCount: safeBoundedInt(record.videoProjectsCount, 0),
    liveProjectsCount: safeBoundedInt(record.liveProjectsCount, 0),
    boardProjectsCount: safeBoundedInt(record.boardProjectsCount, 0),
    batchesCount: safeBoundedInt(record.batchesCount, 0),
    totalProjectsCount: safeBoundedInt(record.totalProjectsCount, 0),
    totalEventsCount: safeBoundedInt(record.totalEventsCount, 0),
    totalActiveTagsCount: safeBoundedInt(record.totalActiveTagsCount, 0),
    totalFreezeFramesCount: safeBoundedInt(record.totalFreezeFramesCount, 0),
    totalShapesCount: safeBoundedInt(record.totalShapesCount, 0),
    totalPlaylistClipsCount: safeBoundedInt(record.totalPlaylistClipsCount, 0),
    projects: cappedProjects,
    lastActiveAtMs: safeBoundedInt(record.lastActiveAt, Date.now()),
  };

  try {
    let exists = knownExistingCloudStatsDocs.has(record.userId);
    if (!exists) {
      const snap = await getDoc(ref);
      exists = snap.exists();
      if (exists) {
        knownExistingCloudStatsDocs.add(record.userId);
      }
    }

    if (exists) {
      await updateDoc(ref, {
        ...baseFields,
        updatedAt: serverTimestamp(),
      });
    } else {
      try {
        await setDoc(ref, {
          userId: record.userId,
          email: safeEmail,
          ...baseFields,
          createdAtMs: safeBoundedInt(record.createdAt, Date.now()),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        knownExistingCloudStatsDocs.add(record.userId);
      } catch (createErr) {
        // Handle multi-tab race where another tab created the stats doc moments ago
        const recheckSnap = await getDoc(ref).catch(() => null);
        if (recheckSnap && recheckSnap.exists()) {
          knownExistingCloudStatsDocs.add(record.userId);
          await updateDoc(ref, {
            ...baseFields,
            updatedAt: serverTimestamp(),
          });
        } else {
          throw createErr;
        }
      }
    }

    lastFlushedStatsHashByUser.set(record.userId, fingerprint);
    lastCloudStatsFlushMs = Date.now();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

const defaultFirestoreStatsAdapter: StatsCloudSyncAdapter = {
  async upsertUserStats(record: UserStatsRecord): Promise<void> {
    if (!auth.currentUser || !record?.userId || record.userId === 'unauthenticated') return;
    const userId = record.userId;
    pendingStatsPayloads.set(userId, record);

    const existingLoop = inFlightStatsWrites.get(userId);
    if (existingLoop) {
      return existingLoop;
    }

    const runner = (async () => {
      try {
        while (pendingStatsPayloads.has(userId)) {
          const nextRecord = pendingStatsPayloads.get(userId)!;
          pendingStatsPayloads.delete(userId);
          await flushSingleUserStatsWrite(nextRecord);
        }
      } finally {
        inFlightStatsWrites.delete(userId);
      }
    })();

    inFlightStatsWrites.set(userId, runner);
    return runner;
  },

  async deleteUserStats(userId: string): Promise<void> {
    if (!auth.currentUser || !isCurrentAuthBootstrappedAdmin()) return;
    const path = `user_stats/${userId}`;
    try {
      await deleteDoc(doc(db, 'user_stats', userId));
      knownExistingCloudStatsDocs.delete(userId);
      lastFlushedStatsHashByUser.delete(userId);
      dirtyStatsUserIds.delete(userId);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  /**
   * Incremental Delta Sync for Admin Analytics:
   * - First run (or when `forceFull` is true): fetches all user_stats once and records sync cursor.
   * - Subsequent opens / Refresh clicks: queries ONLY `where('updatedAt', '>', cursor)` so 0-10 changed
   *   documents are read instead of re-reading all 1,000+ user documents!
   */
  async fetchAllUserStats(forceFull = false): Promise<UserStatsRecord[]> {
    if (!auth.currentUser || !isCurrentAuthBootstrappedAdmin()) return [];
    try {
      const cachedMap = loadRawRecordsMap();
      const hasCachedRecords = Object.keys(cachedMap).length > 0;
      const lastCursorMs = forceFull || !hasCachedRecords ? 0 : getAdminStatsSyncCursorMs();
      const syncStartedMs = Date.now();

      // Subtract 60s safety overlap window for clock skew on delta queries
      const snap =
        lastCursorMs > 60_000
          ? await getDocs(
              query(
                collection(db, 'user_stats'),
                where('updatedAt', '>', Timestamp.fromMillis(lastCursorMs - 60_000))
              )
            )
          : await getDocs(collection(db, 'user_stats'));

      const mergedMap: Record<string, UserStatsRecord> =
        lastCursorMs > 60_000 ? { ...cachedMap } : {};

      snap.forEach((docSnap) => {
        knownExistingCloudStatsDocs.add(docSnap.id);
        const rec = mapFirestoreDocToStatsRecord(docSnap.id, docSnap.data());
        mergedMap[rec.userId] = rec;
      });

      saveRawRecordsMap(mergedMap);
      saveAdminStatsSyncCursorMs(syncStartedMs);
      return Object.values(mergedMap);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'user_stats');
    }
  },
};

cloudAdapter = defaultFirestoreStatsAdapter;

export function registerStatsCloudAdapter(adapter: StatsCloudSyncAdapter | null): void {
  cloudAdapter = adapter || defaultFirestoreStatsAdapter;
}

/**
 * Quota-safe Admin stats subscription:
 * Performs a single incremental delta sync on mount instead of attaching an unbounded
 * full-collection real-time `onSnapshot` listener.
 */
export function subscribeAdminUserStats(
  onUpdate: (records: UserStatsRecord[]) => void
): Unsubscribe {
  if (!isCurrentAuthBootstrappedAdmin()) {
    onUpdate([]);
    return () => {};
  }
  let cancelled = false;
  syncAllUserAndProjectStats({ includeRemoteForAdmin: true })
    .then((records) => {
      if (!cancelled) onUpdate(records);
    })
    .catch(() => {
      if (!cancelled) onUpdate([]);
    });
  return () => {
    cancelled = true;
  };
}

function loadRawRecordsMap(): Record<string, UserStatsRecord> {
  try {
    const raw = localStorage.getItem(USER_STATS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, UserStatsRecord>;
    }
  } catch {
    // ignore
  }
  return {};
}

function saveRawRecordsMap(map: Record<string, UserStatsRecord>): void {
  try {
    localStorage.setItem(USER_STATS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function removeLocalCachedUserStats(userId: string): void {
  if (!userId) return;
  const map = loadRawRecordsMap();
  if (map[userId]) {
    delete map[userId];
    saveRawRecordsMap(map);
    notifyStatsUpdated();
  }
}

function notifyStatsUpdated(): void {
  try {
    window.dispatchEvent(new CustomEvent('tacstem_stats_updated'));
  } catch {
    // ignore
  }
}

/**
 * Immediate cloud push (used on app open, workspace/board exit, tab hide/close, or project deletion).
 */
function pushRecordToCloudImmediate(record: UserStatsRecord): void {
  if (!cloudAdapter || !auth.currentUser || !record?.userId || record.userId === 'unauthenticated') {
    return;
  }
  dirtyStatsUserIds.delete(record.userId);
  try {
    cloudAdapter.upsertUserStats(record).catch(() => {});
  } catch {
    // ignore
  }
}

/**
 * Batched / 30-Minute Throttled Cloud Sync:
 * Local stats in localStorage update immediately for instant UI responsiveness, while Firestore
 * writes are batched into a 30-minute window OR flushed immediately when exiting a workspace or closing the app.
 */
function markRecordDirtyForBatchedCloudSync(record: UserStatsRecord): void {
  if (!cloudAdapter || !auth.currentUser || !record?.userId || record.userId === 'unauthenticated') {
    return;
  }
  dirtyStatsUserIds.add(record.userId);

  const elapsed = Date.now() - lastCloudStatsFlushMs;
  if (lastCloudStatsFlushMs === 0 || elapsed >= CLOUD_STATS_FLUSH_INTERVAL_MS) {
    // First sync of session or >30 mins since last cloud sync -> flush right away
    pushRecordToCloudImmediate(record);
    return;
  }

  if (!scheduledCloudFlushTimer) {
    const remainingMs = Math.max(5_000, CLOUD_STATS_FLUSH_INTERVAL_MS - elapsed);
    scheduledCloudFlushTimer = setTimeout(() => {
      scheduledCloudFlushTimer = null;
      flushPendingCloudStats();
    }, remainingMs);
  }
}

/**
 * Flush any pending local telemetry changes to Firestore immediately.
 * Safe to call on Workspace close, Tactical Board close, Sign-out, `visibilitychange` (hidden), and `pagehide`.
 */
export function flushPendingCloudStats(): void {
  try {
    if (scheduledCloudFlushTimer) {
      clearTimeout(scheduledCloudFlushTimer);
      scheduledCloudFlushTimer = null;
    }

    // Also flush any pending 600ms local debounce timers right away before pushing to Firestore
    if (projectSaveTimers.size === 0 && boardSaveTimers.size === 0 && dirtyStatsUserIds.size === 0) {
      return;
    }

    if (!cloudAdapter || !auth.currentUser) return;
    const map = loadRawRecordsMap();
    const idsToFlush = Array.from(dirtyStatsUserIds);
    dirtyStatsUserIds.clear();

    for (const uid of idsToFlush) {
      const rec = map[uid];
      if (rec) {
        pushRecordToCloudImmediate(rec);
      }
    }
  } catch {
    // Silent guard
  }
}

let listenersInitialized = false;

export function initStatsListeners(): void {
  if (listenersInitialized || typeof window === 'undefined') return;
  listenersInitialized = true;

  try {
    window.addEventListener('tacstem_db_mutated', (e: Event) => {
      try {
        const detail = (e as CustomEvent)?.detail;
        if (!detail) return;
        switch (detail.action) {
          case 'project_saved':
            scheduleProjectStatsUpdate(detail.payload);
            break;
          case 'project_deleted':
            recordProjectStatsDeleted(detail.id);
            break;
          case 'board_saved':
            scheduleBoardStatsUpdate(detail.payload);
            break;
          case 'board_deleted':
            recordBoardStatsDeleted(detail.id);
            break;
          case 'batch_mutated':
            syncAllUserAndProjectStats({ includeRemoteForAdmin: false, flushImmediate: false }).catch(
              () => {}
            );
            break;
          default:
            break;
        }
      } catch {
        // Silent guard
      }
    });

    window.addEventListener('tacstem_user_plan_updated', (e: Event) => {
      try {
        const updatedUser = (e as CustomEvent)?.detail?.user;
        if (updatedUser?.id && updatedUser.id !== 'unauthenticated') {
          const map = ensureUserRecordBase(updatedUser.id);
          if (map[updatedUser.id]) {
            saveRawRecordsMap(map);
            markRecordDirtyForBatchedCloudSync(map[updatedUser.id]);
            notifyStatsUpdated();
          }
        }
      } catch {
        // Silent guard
      }
    });

    // Flush batched stats cleanly when user switches away, minimizes, reloads, or closes the app
    const onLifecycleFlush = () => {
      flushPendingCloudStats();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingCloudStats();
      }
    };

    window.addEventListener('pagehide', onLifecycleFlush);
    window.addEventListener('beforeunload', onLifecycleFlush);
    document.addEventListener('visibilitychange', onVisibilityChange);
  } catch {
    // Silent guard
  }
}

export function computeVideoProjectStats(
  project: any,
  fallbackOwnerId: string
): ProjectStatsSummary {
  const d = project?.data && typeof project.data === 'object' ? project.data : {};
  const tagEvents: any[] = Array.isArray(d.tagEvents) ? d.tagEvents : [];
  const tags: any[] = Array.isArray(d.tags) ? d.tags : [];
  const freezeFrames: any[] = Array.isArray(d.freezeFrames) ? d.freezeFrames : [];
  const shapes: any[] = Array.isArray(d.shapes) ? d.shapes : [];
  const playlists: any[] = Array.isArray(d.playlists) ? d.playlists : [];
  const markers: any[] = Array.isArray(d.markers) ? d.markers : [];
  const labelEvents: any[] = Array.isArray(d.labelEvents) ? d.labelEvents : [];

  const configuredTagIds =
    tags.length > 0 ? new Set(tags.map((t) => t?.id).filter(Boolean)) : null;

  const activeTagIds = new Set<string>();
  const usedLabelIds = new Set<string>();

  for (const ev of tagEvents) {
    if (!ev) continue;
    if (ev.tagId && (!configuredTagIds || configuredTagIds.has(ev.tagId))) {
      activeTagIds.add(String(ev.tagId));
    }
    if (Array.isArray(ev.labelIds)) {
      for (const lid of ev.labelIds) {
        if (lid) usedLabelIds.add(String(lid));
      }
    }
  }

  for (const lev of labelEvents) {
    if (lev?.labelId) {
      usedLabelIds.add(String(lev.labelId));
    }
  }

  let playlistsWithClipsCount = 0;
  let playlistClipsCount = 0;
  for (const pl of playlists) {
    const items = Array.isArray(pl?.events) ? pl.events : [];
    if (items.length > 0) {
      playlistsWithClipsCount += 1;
      playlistClipsCount += items.length;
    }
  }

  const ownerId =
    project?.ownerId && project.ownerId !== 'guest'
      ? String(project.ownerId)
      : fallbackOwnerId;

  const isLive = project?.fileName === 'live';

  return {
    projectId: String(project?.id || ''),
    projectLabel: String(project?.name || 'Untitled Match').slice(0, 120),
    projectType: isLive ? 'live' : 'video',
    ownerId,
    eventsCount: tagEvents.length,
    activeTagsCount: activeTagIds.size,
    totalTagsCount: configuredTagIds ? configuredTagIds.size : activeTagIds.size,
    freezeFramesCount: freezeFrames.length,
    shapesCount: shapes.length,
    playlistsWithClipsCount,
    playlistClipsCount,
    labelsUsedCount: usedLabelIds.size,
    markersCount: markers.length,
    slidesCount: 0,
    createdAt: Number(project?.createdAt) || Date.now(),
    updatedAt: Number(project?.lastModified) || Date.now(),
  };
}

export function computeBoardProjectStats(
  board: any,
  fallbackOwnerId: string
): ProjectStatsSummary {
  const slides: any[] = Array.isArray(board?.data?.slides) ? board.data.slides : [];
  const slidesCount = slides.length || Number(board?.slideCount) || 1;

  let drawingsCount = 0;
  for (const sl of slides) {
    if (Array.isArray(sl?.drawings)) {
      drawingsCount += sl.drawings.length;
    }
  }

  const ownerId =
    board?.ownerId && board.ownerId !== 'guest'
      ? String(board.ownerId)
      : fallbackOwnerId;

  return {
    projectId: String(board?.id || ''),
    projectLabel: String(board?.name || 'Untitled Tactical Board').slice(0, 120),
    projectType: 'board',
    ownerId,
    eventsCount: 0,
    activeTagsCount: 0,
    totalTagsCount: 0,
    freezeFramesCount: 0,
    shapesCount: drawingsCount,
    playlistsWithClipsCount: 0,
    playlistClipsCount: 0,
    labelsUsedCount: 0,
    markersCount: 0,
    slidesCount,
    createdAt: Number(board?.createdAt) || Date.now(),
    updatedAt: Number(board?.lastModified) || Date.now(),
  };
}

function recomputeUserAggregates(
  record: UserStatsRecord,
  batchesCount?: number
): UserStatsRecord {
  const summaries = Object.values(record.projects || {});
  let videoProjectsCount = 0;
  let liveProjectsCount = 0;
  let boardProjectsCount = 0;
  let totalEventsCount = 0;
  let totalActiveTagsCount = 0;
  let totalFreezeFramesCount = 0;
  let totalShapesCount = 0;
  let totalPlaylistClipsCount = 0;

  for (const p of summaries) {
    if (p.projectType === 'video') videoProjectsCount += 1;
    else if (p.projectType === 'live') liveProjectsCount += 1;
    else if (p.projectType === 'board') boardProjectsCount += 1;

    totalEventsCount += p.eventsCount || 0;
    totalActiveTagsCount += p.activeTagsCount || 0;
    totalFreezeFramesCount += p.freezeFramesCount || 0;
    totalShapesCount += p.shapesCount || 0;
    totalPlaylistClipsCount += p.playlistClipsCount || 0;
  }

  return {
    ...record,
    videoProjectsCount,
    liveProjectsCount,
    boardProjectsCount,
    batchesCount: batchesCount !== undefined ? batchesCount : record.batchesCount || 0,
    totalProjectsCount: videoProjectsCount + liveProjectsCount + boardProjectsCount,
    totalEventsCount,
    totalActiveTagsCount,
    totalFreezeFramesCount,
    totalShapesCount,
    totalPlaylistClipsCount,
  };
}

function ensureUserRecordBase(userId?: string): Record<string, UserStatsRecord> {
  const users = getAllUsers();
  const map = loadRawRecordsMap();
  const activeUser = getCurrentUser();

  const allProfiles =
    activeUser.id !== 'unauthenticated' && !users.some((u) => u.id === activeUser.id)
      ? [activeUser, ...users]
      : users;

  for (const u of allProfiles) {
    if (!u.id || u.id === 'unauthenticated') continue;
    const existing = map[u.id];
    const defaultLastActive =
      u.id === activeUser.id
        ? Date.now()
        : u.demotedAt || u.planUpdatedAt || u.createdAt || null;

    if (!existing) {
      map[u.id] = {
        userId: u.id,
        displayName: u.displayName,
        email: u.email,
        personas: u.personas,
        plan: u.plan,
        createdAt: u.createdAt,
        lastActiveAt: defaultLastActive,
        sessionsCount: u.id === activeUser.id ? 1 : 0,
        videoProjectsCount: 0,
        liveProjectsCount: 0,
        boardProjectsCount: 0,
        batchesCount: 0,
        totalProjectsCount: 0,
        totalEventsCount: 0,
        totalActiveTagsCount: 0,
        totalFreezeFramesCount: 0,
        totalShapesCount: 0,
        totalPlaylistClipsCount: 0,
        projects: {},
      };
    } else {
      map[u.id] = {
        ...existing,
        displayName: u.displayName,
        email: u.email,
        personas: u.personas,
        plan: u.plan,
        createdAt: u.createdAt || existing.createdAt,
      };
    }
  }

  if (userId && !map[userId] && userId !== 'unauthenticated') {
    map[userId] = {
      userId,
      displayName: activeUser.displayName || 'User',
      email: activeUser.email || '',
      personas: activeUser.personas,
      plan: activeUser.plan,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      sessionsCount: 1,
      videoProjectsCount: 0,
      liveProjectsCount: 0,
      boardProjectsCount: 0,
      batchesCount: 0,
      totalProjectsCount: 0,
      totalEventsCount: 0,
      totalActiveTagsCount: 0,
      totalFreezeFramesCount: 0,
      totalShapesCount: 0,
      totalPlaylistClipsCount: 0,
      projects: {},
    };
  }

  return map;
}

export function recordUserActivityHeartbeat(explicitUserId?: string, force = false): void {
  try {
    if (!auth.currentUser) return;
    const now = Date.now();
    if (!force && now - lastHeartbeatWriteMs < HEARTBEAT_THROTTLE_MS) {
      return;
    }
    lastHeartbeatWriteMs = now;

    const current = getCurrentUser();
    const targetId = explicitUserId || current?.id;
    if (!targetId || targetId === 'unauthenticated') return;

    const map = ensureUserRecordBase(targetId);
    const rec = map[targetId];
    if (!rec) return;

    let sessionIncrement = 0;
    try {
      const sessionFlag = `${SESSION_STAMPED_KEY}_${targetId}`;
      if (!sessionStorage.getItem(sessionFlag)) {
        sessionStorage.setItem(sessionFlag, '1');
        sessionIncrement = 1;
      }
    } catch {
      // ignore
    }

    const updated: UserStatsRecord = {
      ...rec,
      lastActiveAt: now,
      sessionsCount: Math.max(1, (rec.sessionsCount || 0) + sessionIncrement),
    };

    map[targetId] = updated;
    saveRawRecordsMap(map);

    if (force || sessionIncrement > 0) {
      pushRecordToCloudImmediate(updated);
    } else {
      markRecordDirtyForBatchedCloudSync(updated);
    }
    notifyStatsUpdated();
  } catch {
    // Silent guard
  }
}

export function scheduleProjectStatsUpdate(project: any): void {
  try {
    const id = project?.id;
    if (!id || !auth.currentUser) return;

    const existingTimer = projectSaveTimers.get(id);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      projectSaveTimers.delete(id);
      try {
        const activeUser = getCurrentUser();
        const ownerId = activeUser?.id;
        if (!ownerId || ownerId === 'unauthenticated') return;

        const map = ensureUserRecordBase(ownerId);
        const targetRecord = map[ownerId];
        if (!targetRecord) return;

        const isBrandNewProject = !targetRecord.projects?.[id];
        const summary = computeVideoProjectStats(project, ownerId);
        const nextProjects = { ...(targetRecord.projects || {}), [id]: summary };
        const updatedRecord = recomputeUserAggregates({
          ...targetRecord,
          lastActiveAt: Date.now(),
          projects: nextProjects,
        });

        map[ownerId] = updatedRecord;
        saveRawRecordsMap(map);

        // Brand-new project creation syncs right away; in-project clicks/tags/freeze-frames batch on 30-min/exit cycle!
        if (isBrandNewProject) {
          pushRecordToCloudImmediate(updatedRecord);
        } else {
          markRecordDirtyForBatchedCloudSync(updatedRecord);
        }
        notifyStatsUpdated();
      } catch {
        // Silent guard
      }
    }, 600);

    projectSaveTimers.set(id, timer);
  } catch {
    // Silent guard
  }
}

export function recordProjectStatsDeleted(projectId: string): void {
  try {
    if (!projectId) return;
    const existingTimer = projectSaveTimers.get(projectId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      projectSaveTimers.delete(projectId);
    }

    const map = ensureUserRecordBase();
    const activeId = getCurrentUser()?.id;
    if (activeId && map[activeId]?.projects?.[projectId]) {
      const nextProjects = { ...map[activeId].projects };
      delete nextProjects[projectId];
      map[activeId] = recomputeUserAggregates({
        ...map[activeId],
        lastActiveAt: Date.now(),
        projects: nextProjects,
      });
      saveRawRecordsMap(map);
      pushRecordToCloudImmediate(map[activeId]);
      notifyStatsUpdated();
    }
  } catch {
    // Silent guard
  }
}

export function scheduleBoardStatsUpdate(board: any): void {
  try {
    const id = board?.id;
    if (!id || !auth.currentUser) return;

    const existingTimer = boardSaveTimers.get(id);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      boardSaveTimers.delete(id);
      try {
        const activeUser = getCurrentUser();
        const ownerId = activeUser?.id;
        if (!ownerId || ownerId === 'unauthenticated') return;

        const map = ensureUserRecordBase(ownerId);
        const targetRecord = map[ownerId];
        if (!targetRecord) return;

        const isBrandNewBoard = !targetRecord.projects?.[id];
        const summary = computeBoardProjectStats(board, ownerId);
        const nextProjects = { ...(targetRecord.projects || {}), [id]: summary };
        const updatedRecord = recomputeUserAggregates({
          ...targetRecord,
          lastActiveAt: Date.now(),
          projects: nextProjects,
        });

        map[ownerId] = updatedRecord;
        saveRawRecordsMap(map);

        if (isBrandNewBoard) {
          pushRecordToCloudImmediate(updatedRecord);
        } else {
          markRecordDirtyForBatchedCloudSync(updatedRecord);
        }
        notifyStatsUpdated();
      } catch {
        // Silent guard
      }
    }, 600);

    boardSaveTimers.set(id, timer);
  } catch {
    // Silent guard
  }
}

export function recordBoardStatsDeleted(boardId: string): void {
  recordProjectStatsDeleted(boardId);
}

export interface SyncUserStatsOptions {
  /** Only set to true when the Admin Analytics view explicitly loads or refreshes cross-user telemetry */
  includeRemoteForAdmin?: boolean;
  /** Force a full collection fetch instead of incremental delta query */
  forceFullRemote?: boolean;
  /** Push current user's reconciled stats immediately (true on app boot/close; false during background batch edits) */
  flushImmediate?: boolean;
}

/**
 * Reconcile current authenticated user's local IndexedDB stats AND (only when requested by Admin UI)
 * merge remote Firestore user stats via incremental delta query.
 */
export async function syncAllUserAndProjectStats(
  options: SyncUserStatsOptions = {}
): Promise<UserStatsRecord[]> {
  const {
    includeRemoteForAdmin = false,
    forceFullRemote = false,
    flushImmediate = false,
  } = options;

  try {
    const activeUser = getCurrentUser();
    const activeId = activeUser?.id;

    const [localProjects, localBoards, localBatches] = await Promise.all([
      listProjectsLocally().catch(() => []),
      listBoardProjectsLocally().catch(() => []),
      listBatchesLocally().catch(() => []),
    ]);

    const map = ensureUserRecordBase(activeId);

    // Recompute ONLY the currently signed-in user's local IndexedDB items
    if (activeId && activeId !== 'unauthenticated' && map[activeId]) {
      let canClaimLegacy = false;
      try {
        const claimedBy = localStorage.getItem(LEGACY_LOCAL_OWNER_KEY);
        if (!claimedBy || claimedBy === activeId || isBootstrappedAdminEmail(activeUser.email)) {
          canClaimLegacy = true;
        }
      } catch {
        canClaimLegacy = false;
      }

      const belongsToActiveUser = (ownerId?: string) => {
        if (ownerId === activeId) return true;
        const isLegacy = !ownerId || ownerId === 'guest' || ownerId === 'user_admin_vishnu';
        return isLegacy && canClaimLegacy;
      };

      const myProjectsMap: Record<string, ProjectStatsSummary> = {};
      let myBatchesCount = 0;

      for (const proj of localProjects || []) {
        if (!proj?.id) continue;
        if (belongsToActiveUser(proj.ownerId)) {
          myProjectsMap[proj.id] = computeVideoProjectStats(proj, activeId);
        }
      }

      for (const board of localBoards || []) {
        if (!board?.id) continue;
        if (belongsToActiveUser(board.ownerId)) {
          myProjectsMap[board.id] = computeBoardProjectStats(board, activeId);
        }
      }

      for (const batch of localBatches || []) {
        if (!batch?.id) continue;
        if (belongsToActiveUser(batch.ownerId)) {
          myBatchesCount += 1;
        }
      }

      let sessionIncrement = 0;
      try {
        const sessionFlag = `${SESSION_STAMPED_KEY}_${activeId}`;
        if (!sessionStorage.getItem(sessionFlag)) {
          sessionStorage.setItem(sessionFlag, '1');
          sessionIncrement = 1;
        }
      } catch {
        // ignore
      }

      map[activeId] = recomputeUserAggregates(
        {
          ...map[activeId],
          lastActiveAt: Date.now(),
          sessionsCount: Math.max(1, (map[activeId].sessionsCount || 0) + sessionIncrement),
          projects: myProjectsMap,
        },
        myBatchesCount
      );

      saveRawRecordsMap(map);

      if (flushImmediate || sessionIncrement > 0) {
        pushRecordToCloudImmediate(map[activeId]);
      } else {
        markRecordDirtyForBatchedCloudSync(map[activeId]);
      }
    }

    // Merge remote cross-user telemetry ONLY when Admin explicitly opens/refreshes Analytics
    if (
      includeRemoteForAdmin &&
      cloudAdapter?.fetchAllUserStats &&
      isCurrentAuthBootstrappedAdmin()
    ) {
      try {
        const remoteList = await cloudAdapter.fetchAllUserStats(forceFullRemote);
        for (const r of remoteList) {
          if (r?.userId && r.userId !== activeId) {
            map[r.userId] = r;
          }
        }
      } catch {
        // Fallback to cached records
      }
    }

    // Ensure every known user in user_entitlements has at least a zero-state stats row in Admin view
    const knownUsers = getAllUsers();
    for (const u of knownUsers) {
      if (!u.id || u.id === 'unauthenticated') continue;
      if (!map[u.id]) {
        map[u.id] = {
          userId: u.id,
          displayName: u.displayName,
          email: u.email,
          personas: u.personas,
          plan: u.plan,
          createdAt: u.createdAt,
          lastActiveAt: u.planUpdatedAt || u.createdAt || null,
          sessionsCount: 0,
          videoProjectsCount: 0,
          liveProjectsCount: 0,
          boardProjectsCount: 0,
          batchesCount: 0,
          totalProjectsCount: 0,
          totalEventsCount: 0,
          totalActiveTagsCount: 0,
          totalFreezeFramesCount: 0,
          totalShapesCount: 0,
          totalPlaylistClipsCount: 0,
          projects: {},
        };
      } else {
        map[u.id] = {
          ...map[u.id],
          displayName: u.displayName || map[u.id].displayName,
          email: u.email || map[u.id].email,
          plan: u.plan,
          personas: u.personas || map[u.id].personas,
        };
      }
    }

    saveRawRecordsMap(map);

    const allRows = Object.values(map).filter(
      (r) => r && r.userId && r.userId !== 'unauthenticated'
    );
    allRows.sort((a, b) => (b.lastActiveAt || b.createdAt || 0) - (a.lastActiveAt || a.createdAt || 0));
    return allRows;
  } catch {
    return [];
  }
}

export function getCachedAllUserStats(): UserStatsRecord[] {
  const map = ensureUserRecordBase();
  const allRows = Object.values(map).filter(
    (r) => r && r.userId && r.userId !== 'unauthenticated'
  );
  allRows.sort((a, b) => (b.lastActiveAt || b.createdAt || 0) - (a.lastActiveAt || a.createdAt || 0));
  return allRows;
}

export function isUserActiveWithinDays(
  record: UserStatsRecord,
  thresholdDays: InactivityThresholdDays
): boolean {
  if (!record.lastActiveAt) return false;
  const cutoff = Date.now() - thresholdDays * 24 * 60 * 60 * 1000;
  return record.lastActiveAt >= cutoff;
}

function escapeCsvCell(val: string | number | null | undefined): string {
  const s = val === null || val === undefined ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadUsersStatsCSV(
  records: UserStatsRecord[],
  thresholdDays: InactivityThresholdDays
): void {
  const headers = [
    'User Name',
    'Email',
    'Plan',
    `Activity Status (${thresholdDays}d Window)`,
    'Last Active',
    'Total Projects',
    'Match Video Projects',
    'Live Sessions',
    'Tactical Boards',
    'Multi-Game Batches',
    'Total Coded Events',
    'Total Active Tags (>=1 Event)',
    'Total Freeze Frames',
    'Total Drawings',
    'Total Playlist Clips',
  ];

  const rows = records.map((r) => {
    const active = isUserActiveWithinDays(r, thresholdDays);
    const lastActiveIso = r.lastActiveAt ? new Date(r.lastActiveAt).toISOString() : 'Never';
    return [
      r.displayName,
      r.email,
      r.plan.toUpperCase(),
      active ? 'Active' : 'Inactive',
      lastActiveIso,
      r.totalProjectsCount,
      r.videoProjectsCount,
      r.liveProjectsCount,
      r.boardProjectsCount,
      r.batchesCount,
      r.totalEventsCount,
      r.totalActiveTagsCount,
      r.totalFreezeFramesCount,
      r.totalShapesCount,
      r.totalPlaylistClipsCount,
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  triggerCsvDownload(
    [headers.map(escapeCsvCell).join(','), ...rows].join('\n'),
    `tacstem-users-activity-${new Date().toISOString().slice(0, 10)}.csv`
  );
}

export function downloadProjectsStatsCSV(records: UserStatsRecord[]): void {
  const headers = [
    'Owner Name',
    'Owner Email',
    'Plan',
    'Project Label',
    'Project Type',
    'Events Count',
    'Tags With >=1 Event',
    'Total Configured Tags',
    'Freeze Frames Count',
    'Drawings Count',
    'Playlists With Clips',
    'Playlist Clips Count',
    'Labels Used Count',
    'Markers Count',
    'Board Slides Count',
    'Last Updated',
  ];

  const rows: string[] = [];
  for (const r of records) {
    const projects = Object.values(r.projects || {}).sort((a, b) => b.updatedAt - a.updatedAt);
    for (const p of projects) {
      rows.push(
        [
          r.displayName,
          r.email,
          r.plan.toUpperCase(),
          p.projectLabel,
          p.projectType,
          p.eventsCount,
          p.activeTagsCount,
          p.totalTagsCount,
          p.freezeFramesCount,
          p.shapesCount,
          p.playlistsWithClipsCount,
          p.playlistClipsCount,
          p.labelsUsedCount,
          p.markersCount,
          p.slidesCount,
          new Date(p.updatedAt).toISOString(),
        ]
          .map(escapeCsvCell)
          .join(',')
      );
    }
  }

  triggerCsvDownload(
    [headers.map(escapeCsvCell).join(','), ...rows].join('\n'),
    `tacstem-project-metrics-${new Date().toISOString().slice(0, 10)}.csv`
  );
}

function triggerCsvDownload(csvContent: string, fileName: string): void {
  try {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch {
    // ignore
  }
}
