import {
  listProjectsLocally,
  saveProjectDataLocally,
  deleteProjectLocally,
  listBatchesLocally,
  saveBatchLocally,
  deleteBatchLocally,
  listBoardProjectsLocally,
  saveBoardProjectLocally,
  deleteBoardProjectLocally,
  sanitizeProjectForStorage,
  subscribeDbMutationSafe,
} from './db';
import { db as tacticoDb } from '../board/db';
import type { Project, Batch, BoardProject, ProjectData } from '../types';
import { DEFAULT_TAGS } from '../components/Workspace/Workspace.constants';
import {
  STORAGE_KEY_CODE_FILES,
  STORAGE_KEY_ACTIVE_CODE_FILE,
  loadAllCodeFiles,
  saveAllCodeFiles,
  type CodeFile,
} from './codeFiles';
import {
  getCreatorWatermarkConfig,
  saveCreatorWatermarkConfig,
  type CreatorWatermarkConfig,
} from './creatorWatermarkStore';
import {
  loadPlayerTagSettings,
  savePlayerTagSettings,
} from '../components/Workspace/PlayerTag';
import { auth } from '../firebase';

export const PORTABLE_BACKUP_SCHEMA_ID = 'tacstem.portable.workspace.backup';
export const PORTABLE_BACKUP_VERSION = 2;

export const BACKUP_META_KEY = 'tacstem_portable_backup_meta_v2';
export const LEGACY_BACKUP_META_KEY = 'tacstem_backup_folder_meta';
export const DATA_WIPE_NOTICE_DISMISSED_KEY = 'tacstem_local_data_notice_minimized_v1';

export interface BackupMetaState {
  lastExportTime: number | null;
  lastExportFormatted: string | null;
  lastImportTime: number | null;
  lastImportFormatted: string | null;
  lastExportFileName?: string;
  projectsCount: number;
  boardsCount: number;
  batchesCount: number;
  codeFilesCount: number;
  hasUnsavedChangesSinceExport: boolean;
}

export interface PortableUserSettings {
  creatorWatermark?: CreatorWatermarkConfig | any;
  playerTagSettings?: any;
  telestrationColors?: any;
  codeFiles?: CodeFile[];
  activeCodeFileName?: string | null;
  advancedPadQuickTagEnabled?: boolean;
  dashboardViewMode?: 'minimal' | 'expanded';
  boardCustomColors?: string[];
  rawLocalStorageSnapshot?: Record<string, string>;
  [key: string]: any;
}

export interface BackupBundle {
  schema: string;
  version: number;
  minCompatibleVersion?: number;
  appName: string;
  exportedAt: number;
  exportedAtISO: string;
  exportedAtFormatted: string;
  exportedBy?: {
    uid?: string;
    email?: string;
    displayName?: string;
  };
  counts: {
    projects: number;
    batches: number;
    boardProjects: number;
    codeFiles: number;
    totalTagEvents: number;
    totalTelestrationShapes: number;
    totalFreezeFrames: number;
    totalPlaylists: number;
  };
  projects: Project[];
  batches: Batch[];
  boardProjects: BoardProject[];
  codeFiles?: CodeFile[];
  userSettings?: PortableUserSettings;
  // Forward-compatible extension bag so future versions never lose unknown domains
  extensions?: Record<string, any>;
}

export interface BackupScanResult {
  hasValidBackup: boolean;
  schema?: string;
  version?: number;
  timestamp?: number;
  formattedDate?: string;
  fileName?: string;
  fileSizeBytes?: number;
  projectsCount: number;
  batchesCount: number;
  boardProjectsCount: number;
  codeFilesCount: number;
  totalTagEventsCount: number;
  totalShapesCount: number;
  totalFreezeFramesCount: number;
  projectsList: Array<{
    id: string;
    name: string;
    lastModified: number;
    fileName?: string;
    tagEventsCount: number;
    shapesCount: number;
    freezeFramesCount: number;
  }>;
  boardProjectsList: Array<{
    id: string;
    name: string;
    lastModified: number;
    slideCount: number;
  }>;
  batchesList: Array<{
    id: string;
    name: string;
    projectCount: number;
  }>;
  bundle?: BackupBundle;
  errorMessage?: string;
}

export function getBackupMeta(): BackupMetaState {
  const fallback: BackupMetaState = {
    lastExportTime: null,
    lastExportFormatted: null,
    lastImportTime: null,
    lastImportFormatted: null,
    projectsCount: 0,
    boardsCount: 0,
    batchesCount: 0,
    codeFilesCount: 0,
    hasUnsavedChangesSinceExport: false,
  };

  try {
    const raw = localStorage.getItem(BACKUP_META_KEY);
    if (raw) {
      return { ...fallback, ...JSON.parse(raw) };
    }
    // Check legacy meta if user had used previous backup utility
    const legacyRaw = localStorage.getItem(LEGACY_BACKUP_META_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      if (legacy?.lastBackupTime) {
        return {
          ...fallback,
          lastExportTime: legacy.lastBackupTime,
          lastExportFormatted: legacy.lastBackupFormatted || new Date(legacy.lastBackupTime).toLocaleString(),
          projectsCount: legacy.projectsCount || 0,
          boardsCount: legacy.boardsCount || 0,
          batchesCount: legacy.batchesCount || 0,
        };
      }
    }
  } catch {
    // ignore
  }
  return fallback;
}

export function setBackupMeta(updates: Partial<BackupMetaState>): BackupMetaState {
  const current = getBackupMeta();
  const next: BackupMetaState = { ...current, ...updates };
  try {
    localStorage.setItem(BACKUP_META_KEY, JSON.stringify(next));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tacstem_backup_meta_changed', { detail: next }));
    }
  } catch {
    // ignore
  }
  return next;
}

function collectSafeLocalStorageSnapshot(): Record<string, string> {
  const snapshot: Record<string, string> = {};
  if (typeof localStorage === 'undefined') return snapshot;

  const excludedPrefixes = [
    'firebase:',
    'tacstem_projects',
    'tacstem_batches',
    'tacstem_board_projects',
    'tacstem_users_v3_auth',
    'tacstem_current_user_id_v2',
    'tacstem_legacy_claimed_by_v1',
    BACKUP_META_KEY,
    LEGACY_BACKUP_META_KEY,
  ];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (excludedPrefixes.some((p) => key.startsWith(p))) continue;
      if (
        key.startsWith('tacstem_') ||
        key.startsWith('sportscode_') ||
        key.startsWith('normalCoding') ||
        key.startsWith('advanced_pad_') ||
        key === 'playerTagSettings' ||
        key === 'tacstemDashboardViewMode'
      ) {
        const val = localStorage.getItem(key);
        if (val !== null && val.length < 500_000) {
          snapshot[key] = val;
        }
      }
    }
  } catch {
    // ignore
  }
  return snapshot;
}

/**
 * Ensures any project (from current DB or imported from older/newer versions) has
 * a complete, valid, non-crashing structure while preserving all unknown future fields.
 */
export function normalizeProjectRecord(raw: any, targetOwnerId?: string): Project | null {
  if (!raw || typeof raw !== 'object') return null;

  const id = String(raw.id || `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const d: Partial<ProjectData> & Record<string, any> =
    raw.data && typeof raw.data === 'object' ? raw.data : raw;

  const rawPlaylists = Array.isArray(d.playlists) ? d.playlists : [];
  const normalizedPlaylists =
    rawPlaylists.length > 0
      ? rawPlaylists.map((pl: any, idx: number) => ({
          ...pl,
          id: String(pl?.id || `p${idx + 1}`),
          name: String(pl?.name || `Playlist ${idx + 1}`),
          events: Array.isArray(pl?.events)
            ? pl.events
                .map((ev: any) => {
                  if (!ev) return null;
                  if (typeof ev === 'string') return ev;
                  if (typeof ev === 'object') {
                    const eventId = ev.eventId || ev.id;
                    if (!eventId) return null;
                    return {
                      ...ev,
                      eventId: String(eventId),
                      instanceId: String(ev.instanceId || `${eventId}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`),
                    };
                  }
                  return null;
                })
                .filter(Boolean)
            : [],
        }))
      : [
          { id: 'p1', name: 'Highlights', events: [] },
          { id: 'p2', name: 'Defense', events: [] },
        ];

  const sanitizedProject = sanitizeProjectForStorage({
    ...raw,
    id,
    name: String(raw.name || 'Untitled Match Project'),
    description: typeof raw.description === 'string' ? raw.description : '',
    createdAt: Number(raw.createdAt) || Date.now(),
    lastModified: Number(raw.lastModified) || Date.now(),
    fileName: raw.fileName ? String(raw.fileName) : undefined,
    ownerId: targetOwnerId || raw.ownerId || undefined,
    favourite: Boolean(raw.favourite),
    data: {
      ...d, // Preserve any future/unknown properties inside ProjectData!
      shapes: Array.isArray(d.shapes) ? d.shapes : [],
      freezeFrames: Array.isArray(d.freezeFrames) ? d.freezeFrames : [],
      tags: Array.isArray(d.tags) && d.tags.length > 0 ? d.tags : DEFAULT_TAGS,
      labelGroups: Array.isArray(d.labelGroups) ? d.labelGroups : [],
      labels: Array.isArray(d.labels) ? d.labels : [],
      labelEvents: Array.isArray(d.labelEvents) ? d.labelEvents : [],
      tagEvents: Array.isArray(d.tagEvents) ? d.tagEvents : [],
      playlists: normalizedPlaylists,
      markers: Array.isArray(d.markers) ? d.markers : [],
      presetTexts: Array.isArray(d.presetTexts) ? d.presetTexts : undefined,
      projectNotes: typeof d.projectNotes === 'string' ? d.projectNotes : '',
      advancedPadItems: Array.isArray(d.advancedPadItems) ? d.advancedPadItems : [],
      connectors: Array.isArray(d.connectors) ? d.connectors : [],
      periodSyncs: Array.isArray(d.periodSyncs) ? d.periodSyncs : [],
      maskSettings: d.maskSettings && typeof d.maskSettings === 'object' ? d.maskSettings : undefined,
      nameTagSettings: d.nameTagSettings && typeof d.nameTagSettings === 'object' ? d.nameTagSettings : undefined,
    },
  });

  return sanitizedProject as Project;
}

export function normalizeBoardProjectRecord(raw: any, targetOwnerId?: string): BoardProject | null {
  if (!raw || typeof raw !== 'object') return null;

  // Support importing a standalone Tactical Board canvas JSON directly as well
  const isStandaloneBoardCanvas = !raw.data && raw.teams && Array.isArray(raw.slides);
  const boardCanvasData = isStandaloneBoardCanvas ? raw : raw.data;
  if (!boardCanvasData || typeof boardCanvasData !== 'object') return null;

  const id = String(raw.id || `board_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const name = String(raw.name || boardCanvasData.name || 'Tactical Board');

  return {
    ...raw,
    id,
    name,
    description: typeof raw.description === 'string' ? raw.description : '',
    createdAt: Number(raw.createdAt) || Date.now(),
    lastModified: Number(raw.lastModified) || Date.now(),
    ownerId: targetOwnerId || raw.ownerId || undefined,
    favourite: Boolean(raw.favourite),
    slideCount: Number(raw.slideCount || boardCanvasData.slides?.length || 1),
    data: {
      ...boardCanvasData,
      name: boardCanvasData.name || name,
    },
  };
}

export function normalizeBatchRecord(raw: any, targetOwnerId?: string): Batch | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  return {
    ...raw,
    id,
    name: String(raw.name || 'Untitled Batch'),
    description: typeof raw.description === 'string' ? raw.description : '',
    createdAt: Number(raw.createdAt) || Date.now(),
    lastModified: Number(raw.lastModified) || Date.now(),
    projectIds: Array.isArray(raw.projectIds) ? raw.projectIds.map(String) : [],
    ownerId: targetOwnerId || raw.ownerId || undefined,
    favourite: Boolean(raw.favourite),
    playlists: Array.isArray(raw.playlists)
      ? raw.playlists
      : [{ id: 'bp1', name: 'Batch Highlights', events: [] }],
  };
}

/**
 * Gathers all user data (projects, tags, labels, coding pads, telestrations, freeze frames,
 * playlists, notes, multi-game batches, tactical boards with latest Dexie slide edits,
 * custom code files, watermarks, team/telestration colors, and player rosters) into a
 * self-contained, future-compatible JSON bundle.
 */
export async function gatherCurrentAppData(): Promise<BackupBundle> {
  const currentUid = auth.currentUser?.uid;
  const currentEmail = auth.currentUser?.email || undefined;
  const currentDisplayName = auth.currentUser?.displayName || undefined;

  const [rawProjects, rawBatches, rawBoardProjects] = await Promise.all([
    listProjectsLocally().catch(() => []),
    listBatchesLocally().catch(() => []),
    listBoardProjectsLocally().catch(() => []),
  ]);

  // Also pull latest Tactical Board canvas states from TacticoDB (Dexie) so no slide/keyframe is missed
  const dexieBoardsMap = new Map<string, any>();
  try {
    const allDexie = await tacticoDb.projects.toArray();
    for (const entry of allDexie) {
      if (entry && entry.id && entry.data) {
        dexieBoardsMap.set(entry.id, entry.data);
      }
    }
  } catch (err) {
    console.warn('[PortableBackup] Dexie board read warning:', err);
  }

  const projects: Project[] = (rawProjects || [])
    .map((p) => normalizeProjectRecord(p))
    .filter((p): p is Project => Boolean(p));

  const batches: Batch[] = (rawBatches || [])
    .map((b) => normalizeBatchRecord(b))
    .filter((b): b is Batch => Boolean(b));

  const boardProjects: BoardProject[] = (rawBoardProjects || [])
    .map((bp) => {
      const normalized = normalizeBoardProjectRecord(bp);
      if (!normalized) return null;
      const latestDexieData = dexieBoardsMap.get(normalized.id);
      if (latestDexieData && Array.isArray(latestDexieData.slides)) {
        return {
          ...normalized,
          name: latestDexieData.name || normalized.name,
          slideCount: latestDexieData.slides.length,
          data: latestDexieData,
        };
      }
      return normalized;
    })
    .filter((b): b is BoardProject => Boolean(b));

  const allCodeFiles = loadAllCodeFiles();
  const customCodeFiles = allCodeFiles.filter((cf) => !cf.isBuiltIn);

  let telestrationColors: any = undefined;
  try {
    const tc = localStorage.getItem('tacstem_telestration_colors');
    if (tc) telestrationColors = JSON.parse(tc);
  } catch {}

  let activeCodeFileName: string | null = null;
  try {
    activeCodeFileName = localStorage.getItem(STORAGE_KEY_ACTIVE_CODE_FILE);
  } catch {}

  let advancedPadQuickTagEnabled: boolean | undefined = undefined;
  try {
    const qt = localStorage.getItem('advanced_pad_quick_tag_enabled');
    if (qt !== null) advancedPadQuickTagEnabled = qt === 'true';
  } catch {}

  let dashboardViewMode: 'minimal' | 'expanded' | undefined = undefined;
  try {
    const vm = localStorage.getItem('tacstemDashboardViewMode');
    if (vm === 'minimal' || vm === 'expanded') dashboardViewMode = vm;
  } catch {}

  const creatorWatermark = getCreatorWatermarkConfig();
  const playerTagSettings = loadPlayerTagSettings();
  const rawLocalStorageSnapshot = collectSafeLocalStorageSnapshot();

  let totalTagEvents = 0;
  let totalTelestrationShapes = 0;
  let totalFreezeFrames = 0;
  let totalPlaylists = 0;

  for (const p of projects) {
    totalTagEvents += p.data?.tagEvents?.length || 0;
    totalTelestrationShapes += p.data?.shapes?.length || 0;
    totalFreezeFrames += p.data?.freezeFrames?.length || 0;
    totalPlaylists += p.data?.playlists?.length || 0;
  }
  for (const b of batches) {
    totalPlaylists += b.playlists?.length || 0;
  }

  const now = Date.now();
  return {
    schema: PORTABLE_BACKUP_SCHEMA_ID,
    version: PORTABLE_BACKUP_VERSION,
    minCompatibleVersion: 1,
    appName: 'Tacstem Tactical Video Analysis',
    exportedAt: now,
    exportedAtISO: new Date(now).toISOString(),
    exportedAtFormatted: new Date(now).toLocaleString(),
    exportedBy: currentUid
      ? {
          uid: currentUid,
          email: currentEmail,
          displayName: currentDisplayName,
        }
      : undefined,
    counts: {
      projects: projects.length,
      batches: batches.length,
      boardProjects: boardProjects.length,
      codeFiles: allCodeFiles.length,
      totalTagEvents,
      totalTelestrationShapes,
      totalFreezeFrames,
      totalPlaylists,
    },
    projects,
    batches,
    boardProjects,
    codeFiles: allCodeFiles,
    userSettings: {
      creatorWatermark,
      playerTagSettings,
      telestrationColors,
      codeFiles: customCodeFiles,
      activeCodeFileName,
      advancedPadQuickTagEnabled,
      dashboardViewMode,
      rawLocalStorageSnapshot,
    },
    extensions: {},
  };
}

/**
 * Exports all user data to a single portable local `.json` file via standard browser download.
 * Works across ALL browsers (Chrome, Safari, Firefox, Edge, Brave, Mobile/Desktop) and survives
 * browser wipes, domain migrations, and future app updates.
 */
export async function exportUserDataToFile(
  onProgress?: (step: string) => void
): Promise<{ success: boolean; fileName?: string; bundle?: BackupBundle; error?: string }> {
  try {
    onProgress?.('Collecting match projects, tagging events & telestrations...');
    const bundle = await gatherCurrentAppData();

    onProgress?.('Packaging tactical boards, batches, code templates & settings...');
    const jsonString = JSON.stringify(bundle, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });

    const dateStamp = new Date(bundle.exportedAt).toISOString().split('T')[0];
    const timeStamp = new Date(bundle.exportedAt)
      .toTimeString()
      .slice(0, 5)
      .replace(':', '-');
    const fileName = `tacstem-full-backup-${dateStamp}_${timeStamp}.tacstem.json`;

    onProgress?.('Triggering local file download...');
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    setBackupMeta({
      lastExportTime: bundle.exportedAt,
      lastExportFormatted: bundle.exportedAtFormatted,
      lastExportFileName: fileName,
      projectsCount: bundle.projects.length,
      boardsCount: bundle.boardProjects.length,
      batchesCount: bundle.batches.length,
      codeFilesCount: (bundle.codeFiles || []).length,
      hasUnsavedChangesSinceExport: false,
    });

    onProgress?.('Export complete!');
    return { success: true, fileName, bundle };
  } catch (err: any) {
    console.error('[PortableBackup] Export failed:', err);
    return {
      success: false,
      error: err?.message || 'Failed to export backup file.',
    };
  }
}

/**
 * Parses and validates any Tacstem JSON file:
 * - Full Workspace Backup v2 (`tacstem.portable.workspace.backup`)
 * - Legacy Folder Backup v1 (`tacstem_backup_full_bundle.json`)
 * - Single Match Project JSON
 * - Single Tactical Board JSON
 * - Standalone Code File / Coding Template JSON
 * - Future v3+ Tacstem Backup bundles (graceful forward compatibility)
 */
export async function parseAndValidateBackupFile(file: File): Promise<BackupScanResult> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    if (!parsed || typeof parsed !== 'object') {
      return createInvalidScanResult('The selected file does not contain valid JSON object data.');
    }

    let rawProjects: any[] = [];
    let rawBatches: any[] = [];
    let rawBoardProjects: any[] = [];
    let rawCodeFiles: CodeFile[] = [];
    let userSettings: PortableUserSettings = {};
    let version = Number(parsed.version) || 1;
    let exportedAt = Number(parsed.exportedAt || parsed.timestamp) || file.lastModified || Date.now();
    let formattedDate =
      parsed.exportedAtFormatted ||
      parsed.backupDate ||
      new Date(exportedAt).toLocaleString();

    // Case 1: Full Workspace Bundle (v1, v2, or future v3+)
    if (
      parsed.schema === PORTABLE_BACKUP_SCHEMA_ID ||
      Array.isArray(parsed.projects) ||
      Array.isArray(parsed.boardProjects) ||
      Array.isArray(parsed.batches)
    ) {
      rawProjects = Array.isArray(parsed.projects) ? parsed.projects : [];
      rawBatches = Array.isArray(parsed.batches) ? parsed.batches : [];
      rawBoardProjects = Array.isArray(parsed.boardProjects) ? parsed.boardProjects : [];
      if (Array.isArray(parsed.codeFiles)) {
        rawCodeFiles = parsed.codeFiles;
      } else if (Array.isArray(parsed.userSettings?.codeFiles)) {
        rawCodeFiles = parsed.userSettings.codeFiles;
      }
      if (parsed.userSettings && typeof parsed.userSettings === 'object') {
        userSettings = parsed.userSettings;
      }
    }
    // Case 2: Single Match Project JSON
    else if (parsed.data && (Array.isArray(parsed.data.tagEvents) || Array.isArray(parsed.data.shapes))) {
      rawProjects = [parsed];
    }
    // Case 3: Single Tactical Board JSON (either BoardProject wrapper or raw canvas Project)
    else if (
      (parsed.teams && Array.isArray(parsed.slides)) ||
      (parsed.data && parsed.data.teams && Array.isArray(parsed.data.slides))
    ) {
      rawBoardProjects = [parsed];
    }
    // Case 4: Standalone Code File / Coding Template JSON
    else if (
      parsed.format === 'TacStem Code File' ||
      parsed.format === 'TacStem Normal Coding Template' ||
      (Array.isArray(parsed.tags) && (Array.isArray(parsed.labels) || Array.isArray(parsed.items)))
    ) {
      const codeFile: CodeFile = {
        id: String(parsed.id || `imported-cf-${Date.now()}`),
        name: String(parsed.name || file.name.replace(/\.json$/i, '')),
        description: parsed.description || 'Imported Code File',
        createdAt: parsed.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isBuiltIn: false,
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        labels: Array.isArray(parsed.labels) ? parsed.labels : [],
        labelGroups: Array.isArray(parsed.labelGroups) ? parsed.labelGroups : [],
        items: Array.isArray(parsed.items) ? parsed.items : undefined,
        connectors: Array.isArray(parsed.connectors) ? parsed.connectors : undefined,
      };
      rawCodeFiles = [codeFile];
      userSettings = { codeFiles: [codeFile] };
    } else {
      return createInvalidScanResult(
        'Unrecognized JSON format. Please select a Tacstem Backup file (.tacstem.json or .json).'
      );
    }

    const normalizedProjects = rawProjects
      .map((p) => normalizeProjectRecord(p))
      .filter((p): p is Project => Boolean(p));

    const normalizedBoards = rawBoardProjects
      .map((b) => normalizeBoardProjectRecord(b))
      .filter((b): b is BoardProject => Boolean(b));

    const normalizedBatches = rawBatches
      .map((b) => normalizeBatchRecord(b))
      .filter((b): b is Batch => Boolean(b));

    if (
      normalizedProjects.length === 0 &&
      normalizedBoards.length === 0 &&
      normalizedBatches.length === 0 &&
      rawCodeFiles.length === 0 &&
      Object.keys(userSettings).length === 0
    ) {
      return createInvalidScanResult('The backup file appears to be empty.');
    }

    let totalTagEventsCount = 0;
    let totalShapesCount = 0;
    let totalFreezeFramesCount = 0;

    const projectsList = normalizedProjects.map((p) => {
      const tagEventsCount = p.data?.tagEvents?.length || 0;
      const shapesCount = p.data?.shapes?.length || 0;
      const freezeFramesCount = p.data?.freezeFrames?.length || 0;
      totalTagEventsCount += tagEventsCount;
      totalShapesCount += shapesCount;
      totalFreezeFramesCount += freezeFramesCount;
      return {
        id: p.id,
        name: p.name,
        lastModified: p.lastModified,
        fileName: p.fileName,
        tagEventsCount,
        shapesCount,
        freezeFramesCount,
      };
    });

    const boardProjectsList = normalizedBoards.map((b) => ({
      id: b.id,
      name: b.name,
      lastModified: b.lastModified,
      slideCount: b.slideCount || b.data?.slides?.length || 1,
    }));

    const batchesList = normalizedBatches.map((b) => ({
      id: b.id,
      name: b.name,
      projectCount: b.projectIds?.length || 0,
    }));

    const normalizedBundle: BackupBundle = {
      schema: parsed.schema || PORTABLE_BACKUP_SCHEMA_ID,
      version,
      appName: parsed.appName || 'Tacstem Tactical Video Analysis',
      exportedAt,
      exportedAtISO: parsed.exportedAtISO || new Date(exportedAt).toISOString(),
      exportedAtFormatted: formattedDate,
      exportedBy: parsed.exportedBy,
      counts: {
        projects: normalizedProjects.length,
        batches: normalizedBatches.length,
        boardProjects: normalizedBoards.length,
        codeFiles: rawCodeFiles.length,
        totalTagEvents: totalTagEventsCount,
        totalTelestrationShapes: totalShapesCount,
        totalFreezeFrames: totalFreezeFramesCount,
        totalPlaylists: normalizedProjects.reduce((acc, p) => acc + (p.data?.playlists?.length || 0), 0),
      },
      projects: normalizedProjects,
      batches: normalizedBatches,
      boardProjects: normalizedBoards,
      codeFiles: rawCodeFiles,
      userSettings,
      extensions: parsed.extensions || {},
    };

    return {
      hasValidBackup: true,
      schema: normalizedBundle.schema,
      version,
      timestamp: exportedAt,
      formattedDate,
      fileName: file.name,
      fileSizeBytes: file.size,
      projectsCount: normalizedProjects.length,
      batchesCount: normalizedBatches.length,
      boardProjectsCount: normalizedBoards.length,
      codeFilesCount: rawCodeFiles.length,
      totalTagEventsCount,
      totalShapesCount,
      totalFreezeFramesCount,
      projectsList,
      boardProjectsList,
      batchesList,
      bundle: normalizedBundle,
    };
  } catch (err: any) {
    console.error('[PortableBackup] File parse error:', err);
    return createInvalidScanResult(
      err?.message?.includes('JSON')
        ? 'Invalid JSON syntax. Please select a valid Tacstem backup file.'
        : err?.message || 'Unable to read the selected backup file.'
    );
  }
}

function createInvalidScanResult(errorMessage: string): BackupScanResult {
  return {
    hasValidBackup: false,
    projectsCount: 0,
    batchesCount: 0,
    boardProjectsCount: 0,
    codeFilesCount: 0,
    totalTagEventsCount: 0,
    totalShapesCount: 0,
    totalFreezeFramesCount: 0,
    projectsList: [],
    boardProjectsList: [],
    batchesList: [],
    errorMessage,
  };
}

/**
 * Restores a validated BackupBundle into IndexedDB, Dexie (TacticoDB), and localStorage.
 * Rebinds `ownerId` to the currently signed-in user so imported data from another app URL,
 * browser, or account immediately appears in the user's workspace.
 */
export async function importBackupBundle(
  bundle: BackupBundle,
  mode: 'merge' | 'replace' = 'merge',
  onProgress?: (step: string) => void
): Promise<{
  success: boolean;
  restoredProjectsCount: number;
  restoredBoardsCount: number;
  restoredBatchesCount: number;
  restoredCodeFilesCount: number;
  error?: string;
}> {
  try {
    const activeUid =
      auth.currentUser?.uid ||
      (() => {
        try {
          return localStorage.getItem('tacstem_current_user_id_v2') || undefined;
        } catch {
          return undefined;
        }
      })();

    if (mode === 'replace') {
      onProgress?.('Clearing existing workspace items before clean replacement...');
      const [existingProjs, existingBatches, existingBoards] = await Promise.all([
        listProjectsLocally().catch(() => []),
        listBatchesLocally().catch(() => []),
        listBoardProjectsLocally().catch(() => []),
      ]);

      const incomingProjIds = new Set((bundle.projects || []).map((p) => p.id));
      const incomingBatchIds = new Set((bundle.batches || []).map((b) => b.id));
      const incomingBoardIds = new Set((bundle.boardProjects || []).map((b) => b.id));

      for (const p of existingProjs) {
        if (p?.id && !incomingProjIds.has(p.id)) {
          await deleteProjectLocally(p.id);
        }
      }
      for (const b of existingBatches) {
        if (b?.id && !incomingBatchIds.has(b.id)) {
          await deleteBatchLocally(b.id);
        }
      }
      for (const bp of existingBoards) {
        if (bp?.id && !incomingBoardIds.has(bp.id)) {
          await deleteBoardProjectLocally(bp.id);
          try {
            await tacticoDb.projects.delete(bp.id);
          } catch {}
        }
      }
    }

    // 1. Restore Match Projects (with all tags, labels, coding pads, telestrations, freeze frames, playlists)
    let restoredProjectsCount = 0;
    if (Array.isArray(bundle.projects) && bundle.projects.length > 0) {
      onProgress?.(`Importing ${bundle.projects.length} match projects, tags & telestrations...`);
      for (const rawProj of bundle.projects) {
        const normalized = normalizeProjectRecord(rawProj, activeUid);
        if (normalized) {
          await saveProjectDataLocally(normalized.id, normalized);
          restoredProjectsCount++;
        }
      }
    }

    // 2. Restore Tactical Board Projects (into both TacstemVideosDB and Dexie TacticoDB!)
    let restoredBoardsCount = 0;
    if (Array.isArray(bundle.boardProjects) && bundle.boardProjects.length > 0) {
      onProgress?.(`Importing ${bundle.boardProjects.length} tactical boards & slide animations...`);
      for (const rawBoard of bundle.boardProjects) {
        const normalized = normalizeBoardProjectRecord(rawBoard, activeUid);
        if (normalized) {
          await saveBoardProjectLocally(normalized);
          if (normalized.data) {
            try {
              await tacticoDb.projects.put({ id: normalized.id, data: normalized.data });
            } catch (dexieErr) {
              console.warn('[PortableBackup] Dexie board put warning:', dexieErr);
            }
          }
          restoredBoardsCount++;
        }
      }
    }

    // 3. Restore Multi-Game Batches
    let restoredBatchesCount = 0;
    if (Array.isArray(bundle.batches) && bundle.batches.length > 0) {
      onProgress?.(`Importing ${bundle.batches.length} multi-game batches...`);
      for (const rawBatch of bundle.batches) {
        const normalized = normalizeBatchRecord(rawBatch, activeUid);
        if (normalized) {
          await saveBatchLocally(normalized);
          restoredBatchesCount++;
        }
      }
    }

    // 4. Restore Code Files / Coding Pad Templates
    let restoredCodeFilesCount = 0;
    const incomingCodeFiles = [
      ...(Array.isArray(bundle.codeFiles) ? bundle.codeFiles : []),
      ...(Array.isArray(bundle.userSettings?.codeFiles) ? bundle.userSettings!.codeFiles! : []),
    ];
    if (incomingCodeFiles.length > 0) {
      onProgress?.('Importing custom coding templates & smart connectors...');
      const currentFiles = loadAllCodeFiles();
      const mergedMap = new Map<string, CodeFile>();
      if (mode === 'merge') {
        for (const cf of currentFiles) {
          mergedMap.set(cf.id, cf);
        }
      } else {
        for (const cf of currentFiles.filter((f) => f.isBuiltIn)) {
          mergedMap.set(cf.id, cf);
        }
      }
      for (const cf of incomingCodeFiles) {
        if (cf && cf.id && cf.name) {
          mergedMap.set(cf.id, cf);
          if (!cf.isBuiltIn) restoredCodeFilesCount++;
        }
      }
      saveAllCodeFiles(Array.from(mergedMap.values()));
    }

    // 5. Restore User Preferences, Watermark, Team/Telestration Colors & Player Rosters
    const settings = bundle.userSettings;
    if (settings && typeof settings === 'object') {
      onProgress?.('Restoring preferences, player rosters & watermark settings...');

      if (settings.rawLocalStorageSnapshot && typeof settings.rawLocalStorageSnapshot === 'object') {
        for (const [k, v] of Object.entries(settings.rawLocalStorageSnapshot)) {
          if (typeof v === 'string' && k !== STORAGE_KEY_CODE_FILES) {
            try {
              localStorage.setItem(k, v);
            } catch {}
          }
        }
      }

      if (settings.creatorWatermark && typeof settings.creatorWatermark === 'object') {
        saveCreatorWatermarkConfig(settings.creatorWatermark);
      }

      if (settings.playerTagSettings && typeof settings.playerTagSettings === 'object') {
        savePlayerTagSettings(settings.playerTagSettings);
      }

      if (settings.telestrationColors && typeof settings.telestrationColors === 'object') {
        try {
          localStorage.setItem('tacstem_telestration_colors', JSON.stringify(settings.telestrationColors));
        } catch {}
      }

      if (settings.activeCodeFileName) {
        try {
          localStorage.setItem(STORAGE_KEY_ACTIVE_CODE_FILE, String(settings.activeCodeFileName));
        } catch {}
      }

      if (typeof settings.advancedPadQuickTagEnabled === 'boolean') {
        try {
          localStorage.setItem(
            'advanced_pad_quick_tag_enabled',
            settings.advancedPadQuickTagEnabled ? 'true' : 'false'
          );
        } catch {}
      }

      if (settings.dashboardViewMode === 'minimal' || settings.dashboardViewMode === 'expanded') {
        try {
          localStorage.setItem('tacstemDashboardViewMode', settings.dashboardViewMode);
        } catch {}
      }
    }

    const now = Date.now();
    setBackupMeta({
      lastImportTime: now,
      lastImportFormatted: new Date(now).toLocaleString(),
      projectsCount: restoredProjectsCount,
      boardsCount: restoredBoardsCount,
      batchesCount: restoredBatchesCount,
      codeFilesCount: restoredCodeFilesCount,
      hasUnsavedChangesSinceExport: false,
    });

    onProgress?.('Import complete!');
    return {
      success: true,
      restoredProjectsCount,
      restoredBoardsCount,
      restoredBatchesCount,
      restoredCodeFilesCount,
    };
  } catch (err: any) {
    console.error('[PortableBackup] Import failed:', err);
    return {
      success: false,
      restoredProjectsCount: 0,
      restoredBoardsCount: 0,
      restoredBatchesCount: 0,
      restoredCodeFilesCount: 0,
      error: err?.message || 'Failed to import backup data.',
    };
  }
}

/**
 * Tracks local database mutations so the UI can remind the user when they have
 * unsaved/unexported changes since their last local file export.
 */
export function initAutoBackupDbListener(): () => void {
  return subscribeDbMutationSafe((event) => {
    if (
      event.action === 'project_saved' ||
      event.action === 'project_deleted' ||
      event.action === 'board_saved' ||
      event.action === 'board_deleted' ||
      event.action === 'batch_mutated'
    ) {
      const current = getBackupMeta();
      if (!current.hasUnsavedChangesSinceExport) {
        setBackupMeta({ hasUnsavedChangesSinceExport: true });
      }
    }
  });
}
