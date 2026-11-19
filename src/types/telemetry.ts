import type { UserPlan, UserPersona } from './user';

export type TrackedProjectType = 'video' | 'live' | 'board';

export type InactivityThresholdDays = 7 | 14 | 30;

/**
 * Metadata-only summary for a single project.
 * Contains strictly numeric counts and timestamps (no video blobs, notes, tag names, or canvas drawings)
 * so it can sync 1:1 to a cloud document later with near-zero bandwidth and full user privacy.
 */
export interface ProjectStatsSummary {
  projectId: string;
  projectLabel: string;
  projectType: TrackedProjectType;
  ownerId: string;
  eventsCount: number;
  activeTagsCount: number; // Number of tags in this project with >= 1 recorded event
  totalTagsCount: number;  // Total configured tags in this project
  freezeFramesCount: number;
  shapesCount: number;
  playlistsWithClipsCount: number;
  playlistClipsCount: number;
  labelsUsedCount: number;
  markersCount: number;
  slidesCount: number;     // Used by tactical board projects (0 for video/live)
  createdAt: number;
  updatedAt: number;
}

/**
 * Per-user aggregated statistics & activity record.
 * Designed as a single compact document (`user_stats/{userId}`) for future Firebase Firestore drop-in.
 */
export interface UserStatsRecord {
  userId: string;
  displayName: string;
  email: string;
  personas?: UserPersona[];
  plan: UserPlan;
  createdAt: number;
  lastActiveAt: number | null;
  sessionsCount: number;
  videoProjectsCount: number;
  liveProjectsCount: number;
  boardProjectsCount: number;
  batchesCount: number;
  totalProjectsCount: number;
  totalEventsCount: number;
  totalActiveTagsCount: number;
  totalFreezeFramesCount: number;
  totalShapesCount: number;
  totalPlaylistClipsCount: number;
  projects: Record<string, ProjectStatsSummary>;
}

/**
 * Pluggable cloud adapter interface so Firebase Firestore can be attached later
 * without changing any workspace persistence or Admin UI code.
 */
export interface StatsCloudSyncAdapter {
  upsertUserStats: (record: UserStatsRecord) => Promise<void>;
  deleteUserStats?: (userId: string) => Promise<void>;
  fetchAllUserStats?: (forceFull?: boolean) => Promise<UserStatsRecord[]>;
}

