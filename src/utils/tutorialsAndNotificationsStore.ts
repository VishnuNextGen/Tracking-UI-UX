import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  db,
  auth,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import { getCurrentUser, isCurrentAuthBootstrappedAdmin, isUserAdmin } from './userPlanStore';
import { Tutorial, TutorialFolder, PushNotification } from '../types/tutorials';

const STORAGE_KEYS = {
  TUTORIALS: 'tacstem_tutorials_v3_cloud',
  FOLDERS: 'tacstem_tutorial_folders_v3_cloud',
  NOTIFICATIONS: 'tacstem_notifications_v3_cloud',
  PUSH_PERMISSION: 'tacstem_push_permission_requested_v1',
  NOTIF_READ_PREFIX: 'tacstem_notif_read_v3_',
  NOTIF_HIDDEN_PREFIX: 'tacstem_notif_hidden_v3_',
  NOTIF_PUSHED_PREFIX: 'tacstem_notif_pushed_v3_',
  ADMIN_SEEDED_FLAG: 'tacstem_firestore_academy_seeded_v1',
  ACADEMY_LAST_SYNC_MS: 'tacstem_academy_last_sync_ms_v1',
};

const ACADEMY_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours cache TTL for static curriculum folders & tutorials

const sessionBootTimeMs = Date.now();
const locallyOriginatedNotificationIds = new Set<string>();
let activeCloudSyncUnsub: (() => void) | null = null;

function activeUid(): string {
  return auth.currentUser?.uid || getCurrentUser()?.id || 'local';
}

function getSetFromStorage(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr.map(String));
    }
  } catch {
    // ignore
  }
  return new Set();
}

function saveSetToStorage(key: string, set: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

function getUserReadIds(): Set<string> {
  return getSetFromStorage(`${STORAGE_KEYS.NOTIF_READ_PREFIX}${activeUid()}`);
}

function saveUserReadIds(set: Set<string>): void {
  saveSetToStorage(`${STORAGE_KEYS.NOTIF_READ_PREFIX}${activeUid()}`, set);
}

function getUserHiddenIds(): Set<string> {
  return getSetFromStorage(`${STORAGE_KEYS.NOTIF_HIDDEN_PREFIX}${activeUid()}`);
}

function saveUserHiddenIds(set: Set<string>): void {
  saveSetToStorage(`${STORAGE_KEYS.NOTIF_HIDDEN_PREFIX}${activeUid()}`, set);
}

function getUserPushedIds(): Set<string> {
  return getSetFromStorage(`${STORAGE_KEYS.NOTIF_PUSHED_PREFIX}${activeUid()}`);
}

function saveUserPushedIds(set: Set<string>): void {
  saveSetToStorage(`${STORAGE_KEYS.NOTIF_PUSHED_PREFIX}${activeUid()}`, set);
}

// --- YouTube URL and Utility Helpers ---

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  const patterns = [
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))([\w-]{11})/,
    /[?&]v=([\w-]{11})/,
    /\/embed\/([\w-]{11})/,
    /\/shorts\/([\w-]{11})/,
  ];

  for (const regex of patterns) {
    const match = trimmed.match(regex);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export function getYouTubeThumbnail(youtubeId: string): string {
  if (!youtubeId) return '/favicon.svg';
  return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
}

export function getYouTubeEmbedUrl(youtubeId: string, autoplay = true): string {
  const params = new URLSearchParams({
    autoplay: autoplay ? '1' : '0',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    enablejsapi: '1',
  });
  return `https://www.youtube-nocookie.com/embed/${youtubeId}?${params.toString()}`;
}

// --- Default Pre-Seeded Folders ---

export const DEFAULT_TUTORIAL_FOLDERS: TutorialFolder[] = [
  {
    id: 'folder-getting-started',
    name: 'Getting Started & Workspace',
    description: 'Master the fundamentals of video loading, shortcuts, and tagging workspace setup.',
    iconName: 'Compass',
    order: 1,
  },
  {
    id: 'folder-tactical-board',
    name: 'Tactical Board & Pitch Telestration',
    description: 'Design pitch drills, 2D/3D animations, player paths, arrows, and visual overlays.',
    iconName: 'LayoutGrid',
    order: 2,
  },
  {
    id: 'folder-live-coding',
    name: 'Live Coding & Match Tagging',
    description: 'Code ongoing matches with hotkeys, custom tags, period clocks, and halftime markers.',
    iconName: 'Radio',
    order: 3,
  },
  {
    id: 'folder-batches-playlists',
    name: 'Batches & Multi-Game Playlists',
    description: 'Aggregate multiple match analyses into compiled playlists and batch stats presentations.',
    iconName: 'Layers',
    order: 4,
  },
  {
    id: 'folder-video-export',
    name: 'Video Export & Telestration Rendering',
    description: 'Render drawn graphics directly into exported MP4 highlights with zero quality loss.',
    iconName: 'FileVideo',
    order: 5,
  },
];

const REMOVED_DEFAULT_TUTORIAL_IDS = new Set([
  'tut-1',
  'tut-2',
  'tut-3',
  'tut-4',
  'tut-5',
  'tut-6',
]);

const REMOVED_DEFAULT_YOUTUBE_IDS = new Set([
  '0h5oV9r0m6g',
  'J3mC3N8rU4k',
  'dQw4w9WgXcQ',
  'jNQXAC9IVRw',
  'kJQP7kiw5Fk',
  'L_LUpnjgPso',
]);

function isRemovedDefaultTutorial(tut: { id?: string; youtubeId?: string } | null | undefined): boolean {
  if (!tut) return false;
  if (tut.id && REMOVED_DEFAULT_TUTORIAL_IDS.has(String(tut.id))) return true;
  if (tut.youtubeId && REMOVED_DEFAULT_YOUTUBE_IDS.has(String(tut.youtubeId))) return true;
  return false;
}

// --- Default Pre-Seeded YouTube Tutorial (Tacstem Official YouTube Channel Only) ---

export const DEFAULT_TUTORIALS: Tutorial[] = [
  {
    id: 'tut-basic',
    title: 'How to Create Analysis Video Using Tacstem Software',
    description:
      'Essential step-by-step walkthrough of Tacstem fundamentals: importing match video, workspace setup, fast event tagging, telestration overlays, and exporting highlights.',
    youtubeUrl: 'https://youtu.be/qJv3rzUGbNE',
    youtubeId: 'qJv3rzUGbNE',
    folderId: 'folder-getting-started',
    folderName: 'Getting Started & Workspace',
    duration: '06:45',
    recommended: true,
    tags: ['Basic Tutorial', 'Watch Before Start', 'Getting Started', 'Essential'],
    createdAt: Date.now() - 1 * 60 * 60 * 1000,
    author: 'Tacstem',
  },
];

// --- Default Pre-Seeded Push Notifications ---

export const FOUNDER_LETTER_BODY = `Hey there!

First of all, thank you for choosing Tacstem.

I started building Tacstem with a simple belief: football analysis shouldn't be complicated, expensive or time-consuming.

My goal is to help analysts and coaches spend less time managing their workflow and more time understanding the beautiful game.

Whether you're just getting started or already working in football, I'm genuinely happy to have you here.

Tacstem is still growing, and your feedback will play an important role in shaping its future.

Let's get started!`;

export const DEFAULT_NOTIFICATIONS: PushNotification[] = [
  {
    id: 'notif-welcome',
    title: 'Welcome to Tacstem Academy',
    message:
      'Explore our curated video tutorials below to master match tagging, tactical pitch animations, and telestration exports.',
    timestamp: Date.now() - 10 * 60 * 1000,
    read: false,
    category: 'tutorial',
    targetAudience: 'all',
    priority: 'normal',
    linkType: 'tab',
    link: 'tutorials',
    sentBy: 'Tacstem Team',
  },
  {
    id: 'notif-founder-letter',
    title: 'Welcome to Tacstem!',
    message: FOUNDER_LETTER_BODY,
    timestamp: Date.now() - 20 * 60 * 1000,
    read: false,
    category: 'announcement',
    targetAudience: 'all',
    priority: 'high',
    linkType: 'none',
    sentBy: 'Founder Letter',
  },
  {
    id: 'notif-basic-tutorial',
    title: 'Watch Before You Start: Basic Tutorial (Recommended)',
    message:
      'New to Tacstem? Watch this essential basic walkthrough first to get up and running in minutes.',
    timestamp: Date.now() - 30 * 60 * 1000,
    read: false,
    category: 'tutorial',
    targetAudience: 'all',
    priority: 'high',
    linkType: 'tutorial',
    link: 'tut-basic',
    sentBy: 'Tacstem Academy',
  },
];

// =========================================================================
// FIRESTORE REAL-TIME LISTENERS & INITIAL SEEDING
// =========================================================================

async function writeFolderToFirestore(folder: TutorialFolder): Promise<void> {
  if (!auth.currentUser) return;
  const path = `tutorial_folders/${folder.id}`;
  const ref = doc(db, 'tutorial_folders', folder.id);
  const cleanName = (folder.name || 'Academy Folder').trim().slice(0, 120);
  const cleanDesc = (folder.description || '').trim().slice(0, 500);
  const cleanIcon = (folder.iconName || 'Folder').trim().slice(0, 60);
  const cleanOrder = Math.min(1000, Math.max(0, Number(folder.order) || 1));

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        name: cleanName,
        description: cleanDesc,
        iconName: cleanIcon,
        order: cleanOrder,
        visibility: 'public',
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        id: folder.id,
        name: cleanName,
        description: cleanDesc,
        iconName: cleanIcon,
        order: cleanOrder,
        visibility: 'public',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

async function writeTutorialToFirestore(tut: Tutorial): Promise<void> {
  if (!auth.currentUser) return;
  const ytId = extractYouTubeId(tut.youtubeUrl || tut.youtubeId);
  if (!ytId) return;

  const path = `tutorials/${tut.id}`;
  const ref = doc(db, 'tutorials', tut.id);
  const cleanTitle = (tut.title || 'Tutorial').trim().slice(0, 200);
  const cleanDesc = (tut.description || '').trim().slice(0, 2000);
  const cleanUrl = (tut.youtubeUrl || `https://youtu.be/${ytId}`).trim().slice(0, 500);
  const cleanFolderId = (tut.folderId || 'folder-getting-started').trim().slice(0, 128);
  const cleanFolderName = (tut.folderName || 'General').trim().slice(0, 120);
  const cleanDuration = (tut.duration || '05:00').trim().slice(0, 20);
  const cleanTags = (Array.isArray(tut.tags) ? tut.tags : [])
    .map((t) => String(t).trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 15);
  const cleanAuthor = (tut.author || 'Tacstem Academy').trim().slice(0, 100);
  const cleanCreatedAtMs = Math.max(0, Number(tut.createdAt) || Date.now());

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        title: cleanTitle,
        description: cleanDesc,
        youtubeUrl: cleanUrl,
        youtubeId: ytId,
        folderId: cleanFolderId,
        folderName: cleanFolderName,
        duration: cleanDuration,
        recommended: Boolean(tut.recommended),
        tags: cleanTags,
        author: cleanAuthor,
        visibility: 'public',
        createdAtMs: cleanCreatedAtMs,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        id: tut.id,
        title: cleanTitle,
        description: cleanDesc,
        youtubeUrl: cleanUrl,
        youtubeId: ytId,
        folderId: cleanFolderId,
        folderName: cleanFolderName,
        duration: cleanDuration,
        recommended: Boolean(tut.recommended),
        tags: cleanTags,
        author: cleanAuthor,
        visibility: 'public',
        createdAtMs: cleanCreatedAtMs,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

async function writeNotificationToFirestore(notif: PushNotification): Promise<void> {
  if (!auth.currentUser) return;
  const path = `notifications/${notif.id}`;
  const ref = doc(db, 'notifications', notif.id);
  const cleanTitle = (notif.title || 'Tacstem Update').trim().slice(0, 160);
  const cleanMsg = (notif.message || 'New update available.').trim().slice(0, 2500);
  const cleanLink = (notif.link || '').trim().slice(0, 500);
  const cleanSentBy = (notif.sentBy || 'Tacstem Admin').trim().slice(0, 100);
  const cleanTimestampMs = Math.max(0, Number(notif.timestamp) || Date.now());

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        title: cleanTitle,
        message: cleanMsg,
        category: notif.category || 'announcement',
        targetAudience: notif.targetAudience || 'all',
        priority: notif.priority || 'normal',
        linkType: notif.linkType || 'none',
        link: cleanLink,
        sentBy: cleanSentBy,
        visibility: 'public',
        timestampMs: cleanTimestampMs,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        id: notif.id,
        title: cleanTitle,
        message: cleanMsg,
        category: notif.category || 'announcement',
        targetAudience: notif.targetAudience || 'all',
        priority: notif.priority || 'normal',
        linkType: notif.linkType || 'none',
        link: cleanLink,
        sentBy: cleanSentBy,
        authorId: auth.currentUser.uid,
        visibility: 'public',
        timestampMs: cleanTimestampMs,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

function matchesUserAudience(notif: PushNotification): boolean {
  if (!notif.targetAudience || notif.targetAudience === 'all') return true;
  const user = getCurrentUser();
  if (isUserAdmin(user)) return true;
  const personas = user.personas || ['analyst'];
  if (notif.targetAudience === 'analysts') return personas.includes('analyst');
  if (notif.targetAudience === 'coaches') return personas.includes('coach');
  if (notif.targetAudience === 'content_creators') return personas.includes('content_creator');
  return true;
}

/**
 * Quota-optimized Academy curriculum fetch:
 * Fetches `tutorial_folders` and `tutorials` once via `getDocs` and caches them in localStorage
 * for 6 hours (unless `forceRefresh` is requested by TutorialsPage or AdminPage).
 */
export async function refreshAcademyCurriculumFromCloud(forceRefresh = false): Promise<void> {
  if (!auth.currentUser) return;

  const isBootAdmin = isCurrentAuthBootstrappedAdmin();
  const canManageTutorials = isBootAdmin || isUserAdmin(getCurrentUser());
  const alreadySeededLocal = localStorage.getItem(STORAGE_KEYS.ADMIN_SEEDED_FLAG) === 'true';

  if (!forceRefresh && !canManageTutorials) {
    try {
      const lastSync = Number(localStorage.getItem(STORAGE_KEYS.ACADEMY_LAST_SYNC_MS) || 0);
      const hasCachedFolders = Boolean(localStorage.getItem(STORAGE_KEYS.FOLDERS));
      const hasCachedTutorials = Boolean(localStorage.getItem(STORAGE_KEYS.TUTORIALS));
      if (
        hasCachedFolders &&
        hasCachedTutorials &&
        lastSync > 0 &&
        Date.now() - lastSync < ACADEMY_CACHE_TTL_MS
      ) {
        return;
      }
    } catch {
      // proceed with fetch
    }
  }

  // 1. Fetch tutorial_folders once
  try {
    const foldersQuery = query(
      collection(db, 'tutorial_folders'),
      where('visibility', '==', 'public')
    );
    const folderSnap = await getDocs(foldersQuery);
    if (folderSnap.empty) {
      if (isBootAdmin && !alreadySeededLocal) {
        DEFAULT_TUTORIAL_FOLDERS.forEach((f) => {
          writeFolderToFirestore(f).catch(() => {});
        });
      }
    } else {
      const list: TutorialFolder[] = [];
      folderSnap.forEach((dSnap) => {
        const d = dSnap.data();
        list.push({
          id: dSnap.id,
          name: String(d.name || 'Folder'),
          description: String(d.description || ''),
          iconName: String(d.iconName || 'Folder'),
          order: Number(d.order) || 1,
        });
      });
      list.sort((a, b) => a.order - b.order);
      saveTutorialFolders(list, true);
    }
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.LIST, 'tutorial_folders');
    } catch {
      // Logged
    }
  }

  // 2. Fetch tutorials once
  try {
    const tutorialsQuery = query(collection(db, 'tutorials'), where('visibility', '==', 'public'));
    const tutSnap = await getDocs(tutorialsQuery);

    if (tutSnap.empty) {
      if (canManageTutorials && !alreadySeededLocal) {
        localStorage.setItem(STORAGE_KEYS.ADMIN_SEEDED_FLAG, 'true');
        DEFAULT_TUTORIALS.forEach((t) => {
          writeTutorialToFirestore(t).catch(() => {});
        });
      } else {
        saveTutorials([], true);
      }
    } else {
      const list: Tutorial[] = [];
      const idsToDelete = new Set<string>();

      tutSnap.forEach((dSnap) => {
        const d = dSnap.data();
        const item: Tutorial = {
          id: dSnap.id,
          title: String(d.title || 'Tutorial'),
          description: String(d.description || ''),
          youtubeUrl: String(d.youtubeUrl || ''),
          youtubeId: String(d.youtubeId || ''),
          folderId: String(d.folderId || ''),
          folderName: String(d.folderName || 'General'),
          duration: String(d.duration || '05:00'),
          recommended: Boolean(d.recommended),
          tags: Array.isArray(d.tags) ? d.tags.map(String) : [],
          createdAt: Number(d.createdAtMs) || Date.now(),
          author: String(d.author || 'Tacstem'),
        };

        if (isRemovedDefaultTutorial(item)) {
          idsToDelete.add(item.id);
        } else {
          list.push(item);
        }
      });

      list.sort((a, b) => b.createdAt - a.createdAt);

      let finalTutorials = list;

      if (idsToDelete.size > 0) {
        const customTutorials = list.filter((t) => t.id !== 'tut-basic');
        if (customTutorials.length > 0) {
          const chosen =
            customTutorials.find((t) => t.youtubeId === 'qJv3rzUGbNE') ||
            customTutorials.find(
              (t) =>
                t.title.toLowerCase().includes('tacstem') ||
                (t.author || '').toLowerCase().includes('tacstem')
            ) ||
            customTutorials[0];
          finalTutorials = [chosen];
          for (const docItem of list) {
            if (docItem.id !== chosen.id) {
              idsToDelete.add(docItem.id);
            }
          }
        } else if (list.length > 0) {
          finalTutorials = [list[0]];
          for (const docItem of list.slice(1)) {
            idsToDelete.add(docItem.id);
          }
        } else if (canManageTutorials) {
          finalTutorials = [...DEFAULT_TUTORIALS];
          DEFAULT_TUTORIALS.forEach((t) => {
            writeTutorialToFirestore(t).catch(() => {});
          });
        }
      }

      if (canManageTutorials && idsToDelete.size > 0) {
        idsToDelete.forEach((delId) => {
          deleteDoc(doc(db, 'tutorials', delId)).catch((err) => {
            try {
              handleFirestoreError(err, OperationType.DELETE, `tutorials/${delId}`);
            } catch {
              // Logged
            }
          });
        });
      }

      saveTutorials(finalTutorials, true);
    }

    try {
      localStorage.setItem(STORAGE_KEYS.ACADEMY_LAST_SYNC_MS, String(Date.now()));
    } catch {
      // ignore
    }
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.LIST, 'tutorials');
    } catch {
      // Logged
    }
  }
}

export function initAcademyAndNotificationsSync(): () => void {
  if (activeCloudSyncUnsub) {
    activeCloudSyncUnsub();
    activeCloudSyncUnsub = null;
  }
  if (!auth.currentUser) {
    return () => {};
  }

  const unsubs: Unsubscribe[] = [];
  const isBootAdmin = isCurrentAuthBootstrappedAdmin();
  const alreadySeededLocal = localStorage.getItem(STORAGE_KEYS.ADMIN_SEEDED_FLAG) === 'true';

  // 1 & 2. Fetch Academy folders & tutorials using cached TTL fetch (eliminates ~7-10 reads on every reload!)
  refreshAcademyCurriculumFromCloud(false).catch(() => {});

  // 3. Notifications listener (with live native desktop push alert for incoming broadcasts!)
  const notifsQuery = query(collection(db, 'notifications'), where('visibility', '==', 'public'));
  unsubs.push(
    onSnapshot(
      notifsQuery,
      (snap) => {
        if (snap.empty) {
          if (isBootAdmin && !alreadySeededLocal) {
            DEFAULT_NOTIFICATIONS.forEach((n) => {
              writeNotificationToFirestore(n).catch(() => {});
            });
          } else {
            saveRawBroadcastNotifications([], true);
          }
          return;
        }

        const list: PushNotification[] = [];
        const pushedSet = getUserPushedIds();
        let pushedSetChanged = false;

        snap.forEach((dSnap) => {
          const d = dSnap.data();
          const item: PushNotification = {
            id: dSnap.id,
            title: String(d.title || 'Announcement'),
            message: String(d.message || ''),
            timestamp: Number(d.timestampMs) || Date.now(),
            read: false,
            category: d.category || 'announcement',
            targetAudience: d.targetAudience || 'all',
            priority: d.priority === 'high' ? 'high' : 'normal',
            linkType: d.linkType || 'none',
            link: String(d.link || ''),
            sentBy: String(d.sentBy || 'Tacstem Team'),
          };
          list.push(item);

          // Trigger native desktop push notification if newly broadcasted during this active session
          const isRecentLiveBroadcast = item.timestamp >= sessionBootTimeMs - 10_000;
          if (
            isRecentLiveBroadcast &&
            !pushedSet.has(item.id) &&
            !locallyOriginatedNotificationIds.has(item.id) &&
            matchesUserAudience(item)
          ) {
            pushedSet.add(item.id);
            pushedSetChanged = true;
            triggerNativeNotification(
              item.title,
              item.message,
              '/pwa-192x192.png',
              item.id
            ).catch(() => {});
          }
        });

        if (pushedSetChanged) {
          saveUserPushedIds(pushedSet);
        }

        list.sort((a, b) => b.timestamp - a.timestamp);
        saveRawBroadcastNotifications(list, true);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'notifications');
        } catch {
          // Logged
        }
      }
    )
  );

  activeCloudSyncUnsub = () => {
    unsubs.forEach((u) => u());
  };
  return activeCloudSyncUnsub;
}

// --- Tutorials Store Methods ---

export function getTutorialFolders(): TutorialFolder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FOLDERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.sort((a, b) => a.order - b.order);
      }
    }
  } catch (e) {
    console.error('Failed to load tutorial folders:', e);
  }
  saveTutorialFolders(DEFAULT_TUTORIAL_FOLDERS, false);
  return DEFAULT_TUTORIAL_FOLDERS;
}

export function saveTutorialFolders(folders: TutorialFolder[], notify = true): void {
  try {
    localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(folders));
    if (notify) {
      notifyTutorialsChanged();
    }
  } catch (e) {
    console.error('Failed to save tutorial folders:', e);
  }
}

export function saveTutorialFolder(folder: TutorialFolder): TutorialFolder[] {
  const folders = getTutorialFolders();
  const existingIndex = folders.findIndex((f) => f.id === folder.id);
  const updated =
    existingIndex >= 0
      ? folders.map((f, i) => (i === existingIndex ? folder : f))
      : [...folders, folder];
  saveTutorialFolders(updated);
  writeFolderToFirestore(folder).catch(() => {});
  return updated;
}

export function deleteTutorialFolder(folderId: string): TutorialFolder[] {
  const folders = getTutorialFolders();
  const updated = folders.filter((f) => f.id !== folderId);
  saveTutorialFolders(updated);
  if (auth.currentUser) {
    deleteDoc(doc(db, 'tutorial_folders', folderId)).catch((err) => {
      try {
        handleFirestoreError(err, OperationType.DELETE, `tutorial_folders/${folderId}`);
      } catch {
        // Logged
      }
    });
  }
  return updated;
}

export function getTutorials(): Tutorial[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TUTORIALS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((t) => !isRemovedDefaultTutorial(t));
        if (cleaned.length !== parsed.length) {
          saveTutorials(cleaned, false);
        }
        return cleaned.sort((a, b) => b.createdAt - a.createdAt);
      }
    }
  } catch (e) {
    console.error('Failed to load tutorials:', e);
  }
  saveTutorials(DEFAULT_TUTORIALS, false);
  return DEFAULT_TUTORIALS;
}

export function saveTutorials(tutorials: Tutorial[], notify = true): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TUTORIALS, JSON.stringify(tutorials));
    if (notify) {
      notifyTutorialsChanged();
    }
  } catch (e) {
    console.error('Failed to save tutorials:', e);
  }
}

export function saveTutorial(tutorial: Tutorial): Tutorial[] {
  const tutorials = getTutorials();
  const existingIndex = tutorials.findIndex((t) => t.id === tutorial.id);
  const savedItem =
    existingIndex >= 0 ? { ...tutorial, lastModified: Date.now() } : tutorial;
  const updated =
    existingIndex >= 0
      ? tutorials.map((t, i) => (i === existingIndex ? savedItem : t))
      : [savedItem, ...tutorials];
  saveTutorials(updated);
  writeTutorialToFirestore(savedItem).catch(() => {});
  return updated;
}

export function deleteTutorial(tutorialId: string): Tutorial[] {
  const tutorials = getTutorials();
  const updated = tutorials.filter((t) => t.id !== tutorialId);
  saveTutorials(updated);
  if (auth.currentUser) {
    deleteDoc(doc(db, 'tutorials', tutorialId)).catch((err) => {
      try {
        handleFirestoreError(err, OperationType.DELETE, `tutorials/${tutorialId}`);
      } catch {
        // Logged
      }
    });
  }
  return updated;
}

// --- Notifications Store Methods ---

function loadRawBroadcastNotifications(): PushNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.sort((a, b) => b.timestamp - a.timestamp);
      }
    }
  } catch {
    // ignore
  }
  saveRawBroadcastNotifications(DEFAULT_NOTIFICATIONS, false);
  return DEFAULT_NOTIFICATIONS;
}

function saveRawBroadcastNotifications(notifications: PushNotification[], notify = true): void {
  try {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
    if (notify) {
      notifyNotificationsChanged();
    }
  } catch (e) {
    console.error('Failed to save notifications:', e);
  }
}

/**
 * Returns user-facing notifications filtered by audience & per-user hidden list, with per-user `read` flags applied.
 */
export function getNotifications(): PushNotification[] {
  const raw = loadRawBroadcastNotifications();
  const readIds = getUserReadIds();
  const hiddenIds = getUserHiddenIds();

  return raw
    .filter((n) => !hiddenIds.has(n.id) && matchesUserAudience(n))
    .map((n) => ({
      ...n,
      read: readIds.has(n.id),
    }));
}

/**
 * Returns all broadcast notifications unfiltered for the Admin Console Broadcast History list.
 */
export function getAdminBroadcastNotifications(): PushNotification[] {
  const raw = loadRawBroadcastNotifications();
  const readIds = getUserReadIds();
  return raw.map((n) => ({
    ...n,
    read: readIds.has(n.id),
  }));
}

export function saveNotifications(notifications: PushNotification[], notify = true): void {
  saveRawBroadcastNotifications(notifications, notify);
}

export function markNotificationRead(id: string): PushNotification[] {
  const readIds = getUserReadIds();
  readIds.add(id);
  saveUserReadIds(readIds);
  notifyNotificationsChanged();
  return getNotifications();
}

export function markAllNotificationsRead(): PushNotification[] {
  const readIds = getUserReadIds();
  for (const n of loadRawBroadcastNotifications()) {
    readIds.add(n.id);
  }
  saveUserReadIds(readIds);
  notifyNotificationsChanged();
  return getNotifications();
}

/**
 * Per-user hide notification (called by NotificationBell "Hide notification")
 */
export function deleteNotification(id: string): PushNotification[] {
  const hiddenIds = getUserHiddenIds();
  hiddenIds.add(id);
  saveUserHiddenIds(hiddenIds);
  notifyNotificationsChanged();
  return getNotifications();
}

/**
 * Admin-only global broadcast deletion from Firestore
 */
export async function adminDeleteBroadcastNotification(id: string): Promise<PushNotification[]> {
  const updated = loadRawBroadcastNotifications().filter((n) => n.id !== id);
  saveRawBroadcastNotifications(updated, true);
  if (auth.currentUser) {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `notifications/${id}`);
    }
  }
  return updated;
}

/**
 * Per-user clear all visible notifications in NotificationBell
 */
export function clearAllNotifications(): void {
  const hiddenIds = getUserHiddenIds();
  for (const n of loadRawBroadcastNotifications()) {
    hiddenIds.add(n.id);
  }
  saveUserHiddenIds(hiddenIds);
  notifyNotificationsChanged();
}

/**
 * Admin-only global deletion of all broadcast notifications in Firestore
 */
export async function adminClearAllBroadcastNotifications(): Promise<void> {
  const current = loadRawBroadcastNotifications();
  saveRawBroadcastNotifications([], true);
  if (auth.currentUser) {
    try {
      const batch = writeBatch(db);
      for (const n of current) {
        batch.delete(doc(db, 'notifications', n.id));
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'notifications');
    }
  }
}

/**
 * Per-user restore hidden notifications in NotificationBell
 */
export function resetNotificationsToDefault(): PushNotification[] {
  saveUserHiddenIds(new Set());
  saveUserReadIds(new Set());
  notifyNotificationsChanged();
  return getNotifications();
}

/**
 * Admin-only re-seed of default broadcast notifications in Firestore
 */
export async function adminResetBroadcastNotifications(): Promise<PushNotification[]> {
  saveUserHiddenIds(new Set());
  saveRawBroadcastNotifications(DEFAULT_NOTIFICATIONS, true);
  if (auth.currentUser) {
    for (const n of DEFAULT_NOTIFICATIONS) {
      await writeNotificationToFirestore(n);
    }
  }
  return getAdminBroadcastNotifications();
}

export async function triggerNativeNotification(
  title: string,
  body: string,
  icon = '/pwa-192x192.png',
  tag?: string
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body,
          icon,
          badge: '/favicon.svg',
          tag: tag || 'tacstem-' + Date.now(),
        });
        return true;
      }
    } catch (swErr) {
      console.warn('Service worker push notification fallback:', swErr);
    }
  }

  try {
    const notif = new Notification(title, {
      body,
      icon,
      badge: '/favicon.svg',
      tag: tag || 'tacstem-' + Date.now(),
    });
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
    return true;
  } catch (ctorErr) {
    console.warn('Notification constructor error (safely handled):', ctorErr);
    return false;
  }
}

/**
 * Admin Broadcast: persists push notification to Firestore `/notifications/{id}` so all connected users receive it in real time!
 */
export async function sendPushNotification(
  payload: Omit<PushNotification, 'id' | 'timestamp' | 'read'>
): Promise<PushNotification> {
  const id = 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  locallyOriginatedNotificationIds.add(id);

  const newNotification: PushNotification = {
    ...payload,
    id,
    timestamp: Date.now(),
    read: false,
  };

  const existing = loadRawBroadcastNotifications();
  const updated = [newNotification, ...existing];
  saveRawBroadcastNotifications(updated, true);

  const pushedIds = getUserPushedIds();
  pushedIds.add(id);
  saveUserPushedIds(pushedIds);

  await writeNotificationToFirestore(newNotification);

  try {
    await triggerNativeNotification(
      newNotification.title,
      newNotification.message,
      '/pwa-192x192.png',
      newNotification.id
    );
  } catch (err) {
    console.warn('Browser native notification error (safely handled):', err);
  }

  return newNotification;
}

export async function requestBrowserPushPermission(): Promise<'granted' | 'denied' | 'default'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    let permission: NotificationPermission;
    try {
      permission = await Notification.requestPermission();
    } catch {
      permission = await new Promise<NotificationPermission>((resolve) => {
        Notification.requestPermission((status) => resolve(status));
      });
    }
    localStorage.setItem(STORAGE_KEYS.PUSH_PERMISSION, permission);
    return permission;
  } catch (e) {
    console.warn('Failed to request notification permission:', e);
    return Notification.permission || 'denied';
  }
}

export function getBrowserPushPermissionStatus(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export function notifyNotificationsChanged() {
  if (typeof window !== 'undefined') {
    queueMicrotask(() => {
      window.dispatchEvent(new CustomEvent('tacstem_notifications_updated'));
    });
  }
}

export function notifyTutorialsChanged() {
  if (typeof window !== 'undefined') {
    queueMicrotask(() => {
      window.dispatchEvent(new CustomEvent('tacstem_tutorials_updated'));
    });
  }
}
