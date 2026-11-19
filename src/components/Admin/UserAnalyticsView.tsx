import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react';
import type {
  UserStatsRecord,
  ProjectStatsSummary,
  InactivityThresholdDays,
} from '../../types/telemetry';
import {
  syncAllUserAndProjectStats,
  getCachedAllUserStats,
  isUserActiveWithinDays,
  downloadUsersStatsCSV,
  downloadProjectsStatsCSV,
} from '../../utils/telemetryStore';
import { syncAdminUserEntitlements } from '../../utils/userPlanStore';
import { formatUserPersonas } from '../../types/user';

type ViewScope = 'users' | 'projects';
type ActivityFilter = 'all' | 'active' | 'inactive';
type ProjectTypeFilter = 'all' | 'match' | 'board';
type UserSortField = 'lastActive' | 'projects' | 'events' | 'freezeFrames' | 'activeTags';
type ProjectSortField = 'updatedAt' | 'events' | 'activeTags' | 'freezeFrames' | 'shapes';

function formatRelativeTime(ts: number | null): string {
  if (!ts) return 'Never active';
  const diffMs = Date.now() - ts;
  if (diffMs < 60_000) return 'Just now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatShortDate(ts: number | null): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export const UserAnalyticsView: React.FC = () => {
  const [records, setRecords] = useState<UserStatsRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(true);
  const [viewScope, setViewScope] = useState<ViewScope>('users');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [thresholdDays, setThresholdDays] = useState<InactivityThresholdDays>(14);
  const [projectTypeFilter, setProjectTypeFilter] = useState<ProjectTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [userSortBy, setUserSortBy] = useState<UserSortField>('lastActive');
  const [projectSortBy, setProjectSortBy] = useState<ProjectSortField>('updatedAt');
  const [sortDesc, setSortDesc] = useState<boolean>(true);
  const [expandedUserIds, setExpandedUserIds] = useState<Set<string>>(new Set());

  const loadStats = useCallback(async (expandActiveByDefault = false, forceFull = false) => {
    setIsSyncing(true);
    try {
      // Sync changed user_entitlements (delta) + changed user_stats (delta) in parallel
      await syncAdminUserEntitlements(forceFull).catch(() => {});
      const synced = await syncAllUserAndProjectStats({
        includeRemoteForAdmin: true,
        forceFullRemote: forceFull,
        flushImmediate: false,
      });
      setRecords(synced);
      if (expandActiveByDefault) {
        const withProjects = synced.filter((r) => r.totalProjectsCount > 0).map((r) => r.userId);
        if (withProjects.length > 0) {
          setExpandedUserIds(new Set([withProjects[0]]));
        }
      }
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    // Single incremental delta fetch on mount (zero continuous background Firestore listeners!)
    loadStats(true, false);

    // Local-only listener: updates Admin's own local workspace counts instantly with ZERO Firestore reads
    const onLocalStatsUpdated = () => {
      setRecords(getCachedAllUserStats());
    };
    window.addEventListener('tacstem_stats_updated', onLocalStatsUpdated);
    return () => {
      window.removeEventListener('tacstem_stats_updated', onLocalStatsUpdated);
    };
  }, [loadStats]);

  const toggleExpandUser = (userId: string) => {
    setExpandedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  // Global aggregate calculations
  const overview = useMemo(() => {
    let activeUsers = 0;
    let inactiveUsers = 0;
    let totalProjects = 0;
    let matchProjects = 0; // video + live
    let videoProjects = 0;
    let liveProjects = 0;
    let boardProjects = 0;
    let totalBatches = 0;
    let totalEvents = 0;
    let totalActiveTags = 0;
    let totalConfiguredTags = 0;
    let totalFreezeFrames = 0;
    let totalShapes = 0;
    let totalClips = 0;

    for (const r of records) {
      if (isUserActiveWithinDays(r, thresholdDays)) activeUsers += 1;
      else inactiveUsers += 1;

      totalProjects += r.totalProjectsCount;
      videoProjects += r.videoProjectsCount;
      liveProjects += r.liveProjectsCount;
      matchProjects += r.videoProjectsCount + r.liveProjectsCount;
      boardProjects += r.boardProjectsCount;
      totalBatches += r.batchesCount;
      totalEvents += r.totalEventsCount;
      totalActiveTags += r.totalActiveTagsCount;
      totalFreezeFrames += r.totalFreezeFramesCount;
      totalShapes += r.totalShapesCount;
      totalClips += r.totalPlaylistClipsCount;

      for (const p of Object.values(r.projects || {})) {
        if (p.projectType !== 'board') {
          totalConfiguredTags += p.totalTagsCount || 0;
        }
      }
    }

    const avgEventsPerMatch =
      matchProjects > 0 ? (totalEvents / matchProjects).toFixed(1) : '0.0';
    const avgTagsPerMatch =
      matchProjects > 0 ? (totalActiveTags / matchProjects).toFixed(1) : '0.0';
    const avgFreezePerMatch =
      matchProjects > 0 ? (totalFreezeFrames / matchProjects).toFixed(1) : '0.0';

    return {
      totalUsers: records.length,
      activeUsers,
      inactiveUsers,
      totalProjects,
      matchProjects,
      videoProjects,
      liveProjects,
      boardProjects,
      totalBatches,
      totalEvents,
      totalActiveTags,
      totalConfiguredTags,
      totalFreezeFrames,
      totalShapes,
      totalClips,
      avgEventsPerMatch,
      avgTagsPerMatch,
      avgFreezePerMatch,
    };
  }, [records, thresholdDays]);

  // Filtered & sorted user rows
  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const list = records.filter((r) => {
      const isActive = isUserActiveWithinDays(r, thresholdDays);
      if (activityFilter === 'active' && !isActive) return false;
      if (activityFilter === 'inactive' && isActive) return false;

      if (q) {
        const personaLabel = formatUserPersonas(r.personas).toLowerCase();
        const matchesUser =
          r.displayName.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          personaLabel.includes(q);
        const matchesProject = Object.values(r.projects || {}).some((p) =>
          p.projectLabel.toLowerCase().includes(q)
        );
        if (!matchesUser && !matchesProject) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      let diff = 0;
      switch (userSortBy) {
        case 'projects':
          diff = a.totalProjectsCount - b.totalProjectsCount;
          break;
        case 'events':
          diff = a.totalEventsCount - b.totalEventsCount;
          break;
        case 'freezeFrames':
          diff = a.totalFreezeFramesCount - b.totalFreezeFramesCount;
          break;
        case 'activeTags':
          diff = a.totalActiveTagsCount - b.totalActiveTagsCount;
          break;
        case 'lastActive':
        default:
          diff = (a.lastActiveAt || 0) - (b.lastActiveAt || 0);
          break;
      }
      return sortDesc ? -diff : diff;
    });

    return list;
  }, [records, thresholdDays, activityFilter, searchQuery, userSortBy, sortDesc]);

  // Flattened per-project rows across all users
  const flattenedProjects = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const rows: Array<{
      project: ProjectStatsSummary;
      ownerName: string;
      ownerEmail: string;
      ownerPlan: string;
      ownerActive: boolean;
    }> = [];

    for (const r of records) {
      const ownerActive = isUserActiveWithinDays(r, thresholdDays);
      for (const p of Object.values(r.projects || {})) {
        if (projectTypeFilter === 'match' && p.projectType === 'board') continue;
        if (projectTypeFilter === 'board' && p.projectType !== 'board') continue;

        if (q) {
          const hit =
            p.projectLabel.toLowerCase().includes(q) ||
            r.displayName.toLowerCase().includes(q) ||
            r.email.toLowerCase().includes(q);
          if (!hit) continue;
        }

        rows.push({
          project: p,
          ownerName: r.displayName,
          ownerEmail: r.email,
          ownerPlan: r.plan,
          ownerActive,
        });
      }
    }

    rows.sort((a, b) => {
      let diff = 0;
      switch (projectSortBy) {
        case 'events':
          diff = a.project.eventsCount - b.project.eventsCount;
          break;
        case 'activeTags':
          diff = a.project.activeTagsCount - b.project.activeTagsCount;
          break;
        case 'freezeFrames':
          diff = a.project.freezeFramesCount - b.project.freezeFramesCount;
          break;
        case 'shapes':
          diff = a.project.shapesCount - b.project.shapesCount;
          break;
        case 'updatedAt':
        default:
          diff = a.project.updatedAt - b.project.updatedAt;
          break;
      }
      return sortDesc ? -diff : diff;
    });

    return rows;
  }, [records, thresholdDays, projectTypeFilter, searchQuery, projectSortBy, sortDesc]);

  const handleExportCSV = () => {
    if (viewScope === 'users') {
      downloadUsersStatsCSV(filteredUsers, thresholdDays);
    } else {
      downloadProjectsStatsCSV(records);
    }
  };

  return (
    <div className="space-y-6">
      {/* Unified Executive Summary Strip (Single Elevation Surface, Tabular Numerals) */}
      <div className="bg-[#111116] border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.07]">
          {/* Metric 1: Active vs Non-Active Users */}
          <div className="p-5">
            <div className="text-xs font-medium text-white/55">User Activity ({thresholdDays}d)</div>
            <div className="mt-2 flex items-baseline gap-2.5 font-mono tabular-nums">
              <span className="text-2xl font-bold text-white">{overview.activeUsers}</span>
              <span className="text-xs text-white/50">active of {overview.totalUsers}</span>
            </div>
            <div className="mt-2 text-xs text-white/45 font-mono tabular-nums">
              <span>{overview.activeUsers} active</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>{overview.inactiveUsers} non-active</span>
            </div>
          </div>

          {/* Metric 2: Total Projects Breakdown */}
          <div className="p-5">
            <div className="text-xs font-medium text-white/55">Projects Across Users</div>
            <div className="mt-2 flex items-baseline gap-2 font-mono tabular-nums">
              <span className="text-2xl font-bold text-white">{overview.totalProjects}</span>
              <span className="text-xs text-white/50">total workspaces</span>
            </div>
            <div className="mt-2 text-xs text-white/45 font-mono tabular-nums">
              <span>{overview.matchProjects} match</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>{overview.boardProjects} board</span>
              {overview.totalBatches > 0 && (
                <>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <span>{overview.totalBatches} batches</span>
                </>
              )}
            </div>
          </div>

          {/* Metric 3: Coded Events */}
          <div className="p-5">
            <div className="text-xs font-medium text-white/55">Events Coded</div>
            <div className="mt-2 flex items-baseline gap-2 font-mono tabular-nums">
              <span className="text-2xl font-bold text-[#c6ff1f]">{overview.totalEvents}</span>
              <span className="text-xs text-white/50">timeline events</span>
            </div>
            <div className="mt-2 text-xs text-white/45 font-mono tabular-nums">
              <span>Avg {overview.avgEventsPerMatch} / match</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>{overview.totalClips} clips</span>
            </div>
          </div>

          {/* Metric 4: Active Tags (with >= 1 Event) */}
          <div className="p-5">
            <div className="text-xs font-medium text-white/55">Tags Used (≥1 Event)</div>
            <div className="mt-2 flex items-baseline gap-2 font-mono tabular-nums">
              <span className="text-2xl font-bold text-white">{overview.totalActiveTags}</span>
              <span className="text-xs text-white/50">active tags</span>
            </div>
            <div className="mt-2 text-xs text-white/45 font-mono tabular-nums">
              <span>Avg {overview.avgTagsPerMatch} / match</span>
              {overview.totalConfiguredTags > 0 && (
                <>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <span>of {overview.totalConfiguredTags} total</span>
                </>
              )}
            </div>
          </div>

          {/* Metric 5: Freeze Frames & Drawings */}
          <div className="p-5">
            <div className="text-xs font-medium text-white/55">Freeze Frames</div>
            <div className="mt-2 flex items-baseline gap-2 font-mono tabular-nums">
              <span className="text-2xl font-bold text-white">{overview.totalFreezeFrames}</span>
              <span className="text-xs text-white/50">frames</span>
            </div>
            <div className="mt-2 text-xs text-white/45 font-mono tabular-nums">
              <span>Avg {overview.avgFreezePerMatch} / match</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>{overview.totalShapes} drawings</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Analytics Table Container */}
      <div className="bg-[#111116] border border-white/[0.08] rounded-2xl p-6 space-y-5">
        {/* Top Controls Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Primary View Mode Switcher */}
            <div className="flex items-center gap-1 p-1 bg-white/[0.04] border border-white/10 rounded-xl">
              <button
                type="button"
                onClick={() => setViewScope('users')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  viewScope === 'users'
                    ? 'bg-[#c6ff1f] text-black font-bold'
                    : 'text-white/65 hover:text-white'
                }`}
              >
                Users & Activity ({records.length})
              </button>
              <button
                type="button"
                onClick={() => setViewScope('projects')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  viewScope === 'projects'
                    ? 'bg-[#c6ff1f] text-black font-bold'
                    : 'text-white/65 hover:text-white'
                }`}
              >
                Per-Project Breakdown ({overview.totalProjects})
              </button>
            </div>

            {/* Active / Non-Active Filter (when viewing Users) */}
            {viewScope === 'users' ? (
              <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/[0.08] rounded-xl">
                <button
                  type="button"
                  onClick={() => setActivityFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    activityFilter === 'all'
                      ? 'bg-white/15 text-white font-semibold'
                      : 'text-white/55 hover:text-white'
                  }`}
                >
                  All ({overview.totalUsers})
                </button>
                <button
                  type="button"
                  onClick={() => setActivityFilter('active')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    activityFilter === 'active'
                      ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                      : 'text-white/55 hover:text-white'
                  }`}
                >
                  Active ({overview.activeUsers})
                </button>
                <button
                  type="button"
                  onClick={() => setActivityFilter('inactive')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    activityFilter === 'inactive'
                      ? 'bg-amber-500/20 text-amber-300 font-semibold'
                      : 'text-white/55 hover:text-white'
                  }`}
                >
                  Non-Active ({overview.inactiveUsers})
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/[0.08] rounded-xl">
                <button
                  type="button"
                  onClick={() => setProjectTypeFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    projectTypeFilter === 'all'
                      ? 'bg-white/15 text-white font-semibold'
                      : 'text-white/55 hover:text-white'
                  }`}
                >
                  All ({overview.totalProjects})
                </button>
                <button
                  type="button"
                  onClick={() => setProjectTypeFilter('match')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    projectTypeFilter === 'match'
                      ? 'bg-white/15 text-white font-semibold'
                      : 'text-white/55 hover:text-white'
                  }`}
                >
                  Match & Live ({overview.matchProjects})
                </button>
                <button
                  type="button"
                  onClick={() => setProjectTypeFilter('board')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    projectTypeFilter === 'board'
                      ? 'bg-white/15 text-white font-semibold'
                      : 'text-white/55 hover:text-white'
                  }`}
                >
                  Tactical Boards ({overview.boardProjects})
                </button>
              </div>
            )}
          </div>

          {/* Right Actions: Active Window Selector, Sync & CSV Export */}
          <div className="flex flex-wrap items-center gap-2.5">
            {viewScope === 'users' && (
              <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/[0.08] rounded-xl">
                {([7, 14, 30] as InactivityThresholdDays[]).map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setThresholdDays(days)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono tabular-nums transition-colors cursor-pointer ${
                      thresholdDays === days
                        ? 'bg-white/15 text-white font-semibold'
                        : 'text-white/50 hover:text-white'
                    }`}
                    title={`Classify users active within the last ${days} days as Active`}
                  >
                    {days}d window
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => loadStats(false, false)}
              disabled={isSyncing}
              className="px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 text-xs font-medium text-white/80 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Fetch latest changed user & project stats from Firestore (incremental delta sync)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#c6ff1f]' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-white transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#c6ff1f]" />
              <span>Download CSV</span>
            </button>
          </div>
        </div>

        {/* Search & Sort Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                viewScope === 'users'
                  ? 'Search users by name, email, or project...'
                  : 'Search projects or owners...'
              }
              className="w-full pl-9 pr-4 py-2 bg-white/[0.03] border border-white/10 rounded-xl text-xs text-white placeholder:text-white/35 focus:outline-none focus:border-[#c6ff1f]/50 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-white/45">Sort by</span>
            {viewScope === 'users' ? (
              <select
                value={userSortBy}
                onChange={(e) => setUserSortBy(e.target.value as UserSortField)}
                className="px-3 py-2 bg-[#18181f] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[#c6ff1f]/50 cursor-pointer"
              >
                <option value="lastActive">Last Active</option>
                <option value="projects">No. of Projects</option>
                <option value="events">No. of Events</option>
                <option value="activeTags">Tags Used (≥1 Event)</option>
                <option value="freezeFrames">No. of Freeze Frames</option>
              </select>
            ) : (
              <select
                value={projectSortBy}
                onChange={(e) => setProjectSortBy(e.target.value as ProjectSortField)}
                className="px-3 py-2 bg-[#18181f] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[#c6ff1f]/50 cursor-pointer"
              >
                <option value="updatedAt">Last Updated</option>
                <option value="events">Events per Project</option>
                <option value="activeTags">Tags (≥1 Event) per Project</option>
                <option value="freezeFrames">Freeze Frames per Project</option>
                <option value="shapes">Drawings per Project</option>
              </select>
            )}

            <button
              type="button"
              onClick={() => setSortDesc((prev) => !prev)}
              className="px-2.5 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-xl text-xs text-white/75 hover:text-white transition-colors flex items-center gap-1 cursor-pointer font-mono"
              title="Toggle ascending / descending order"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>{sortDesc ? 'DESC' : 'ASC'}</span>
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* VIEW 1: USERS & ACTIVITY LIST (WITH EXPANDABLE PER-PROJECT STATS) */}
        {/* ============================================================== */}
        {viewScope === 'users' && (
          <div className="overflow-x-auto border border-white/[0.07] rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.02] text-xs font-semibold text-white/55">
                  <th className="py-3 pl-4 pr-2 w-8"></th>
                  <th className="py-3 px-3">User</th>
                  <th className="py-3 px-3">Status ({thresholdDays}d)</th>
                  <th className="py-3 px-3 text-right">Projects</th>
                  <th className="py-3 px-3 text-right">Events</th>
                  <th className="py-3 px-3 text-right">Tags (≥1 Event)</th>
                  <th className="py-3 px-3 text-right">Freeze Frames</th>
                  <th className="py-3 pl-3 pr-4 text-right">Drawings & Clips</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-xs">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-white/45">
                      No users match the current activity filter or search query.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isActive = isUserActiveWithinDays(u, thresholdDays);
                    const isExpanded = expandedUserIds.has(u.userId);
                    const userProjects = Object.values(u.projects || {}).sort(
                      (a, b) => b.updatedAt - a.updatedAt
                    );
                    const matchCount = u.videoProjectsCount + u.liveProjectsCount;

                    return (
                      <React.Fragment key={u.userId}>
                        <tr
                          onClick={() => toggleExpandUser(u.userId)}
                          className="hover:bg-white/[0.03] transition-colors cursor-pointer"
                        >
                          <td className="py-3.5 pl-4 pr-2 text-white/50">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-[#c6ff1f]" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="font-semibold text-white text-sm">{u.displayName}</div>
                            <div className="text-white/45 mt-0.5 flex items-center gap-1.5 flex-wrap">
                              <span>{u.email}</span>
                              {u.personas && u.personas.length > 0 && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-white/60">{formatUserPersonas(u.personas)}</span>
                                </>
                              )}
                              <span aria-hidden="true">·</span>
                              <span className={u.plan === 'pro' ? 'text-[#c6ff1f] font-medium' : 'text-white/60'}>
                                {u.plan === 'pro' ? 'Pro Plan' : 'Free Plan'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <div
                              className={`font-semibold ${
                                isActive ? 'text-emerald-400' : 'text-amber-400/90'
                              }`}
                            >
                              {isActive ? 'Active' : 'Non-Active'}
                            </div>
                            <div className="text-white/45 font-mono tabular-nums mt-0.5">
                              <span>{formatRelativeTime(u.lastActiveAt)}</span>
                              <span className="mx-1" aria-hidden="true">·</span>
                              <span>{formatShortDate(u.lastActiveAt)}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                            <div className="text-sm font-bold text-white">{u.totalProjectsCount}</div>
                            <div className="text-[11px] text-white/45 mt-0.5">
                              {matchCount} match · {u.boardProjectsCount} board
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                            <div className="text-sm font-bold text-white">{u.totalEventsCount}</div>
                            <div className="text-[11px] text-white/45 mt-0.5">
                              {matchCount > 0
                                ? `${(u.totalEventsCount / matchCount).toFixed(1)} / match`
                                : '0.0 / match'}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                            <div className="text-sm font-bold text-[#c6ff1f]">{u.totalActiveTagsCount}</div>
                            <div className="text-[11px] text-white/45 mt-0.5">
                              {matchCount > 0
                                ? `${(u.totalActiveTagsCount / matchCount).toFixed(1)} / match`
                                : '0.0 / match'}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                            <div className="text-sm font-bold text-white">{u.totalFreezeFramesCount}</div>
                            <div className="text-[11px] text-white/45 mt-0.5">
                              {matchCount > 0
                                ? `${(u.totalFreezeFramesCount / matchCount).toFixed(1)} / match`
                                : '0.0 / match'}
                            </div>
                          </td>
                          <td className="py-3.5 pl-3 pr-4 text-right font-mono tabular-nums">
                            <div className="text-sm font-semibold text-white">{u.totalShapesCount} shapes</div>
                            <div className="text-[11px] text-white/45 mt-0.5">
                              {u.totalPlaylistClipsCount} clips
                              {u.batchesCount > 0 ? ` · ${u.batchesCount} batch` : ''}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Per-Project Breakdown Row */}
                        {isExpanded && (
                          <tr className="bg-[#0c0c10]">
                            <td colSpan={8} className="px-6 py-4">
                              <div className="flex items-center justify-between mb-2.5">
                                <span className="text-xs font-semibold text-white/75">
                                  Per-Project Breakdown for {u.displayName} ({userProjects.length})
                                </span>
                                <span className="text-[11px] text-white/40">
                                  Metadata-only metrics · Zero project content stored externally
                                </span>
                              </div>

                              {userProjects.length === 0 ? (
                                <div className="py-4 text-xs text-white/40 border-t border-white/[0.05]">
                                  No projects recorded under this account yet.
                                </div>
                              ) : (
                                <div className="overflow-x-auto border-t border-white/[0.07]">
                                  <table className="w-full text-left border-collapse">
                                    <thead>
                                      <tr className="border-b border-white/[0.06] text-[11px] font-medium text-white/45">
                                        <th className="py-2 pr-3">Project</th>
                                        <th className="py-2 px-3">Type</th>
                                        <th className="py-2 px-3 text-right">Events</th>
                                        <th className="py-2 px-3 text-right">Tags (≥1 Event)</th>
                                        <th className="py-2 px-3 text-right">Freeze Frames</th>
                                        <th className="py-2 px-3 text-right">Drawings</th>
                                        <th className="py-2 px-3 text-right">Clips / Slides</th>
                                        <th className="py-2 px-3 text-right">Labels & Markers</th>
                                        <th className="py-2 pl-3 text-right">Updated</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.04] text-xs font-mono tabular-nums">
                                      {userProjects.map((p) => {
                                        const isBoard = p.projectType === 'board';
                                        return (
                                          <tr key={p.projectId} className="hover:bg-white/[0.02]">
                                            <td className="py-2.5 pr-3 font-sans font-medium text-white max-w-[240px] truncate">
                                              {p.projectLabel}
                                            </td>
                                            <td className="py-2.5 px-3 font-sans text-white/55">
                                              {p.projectType === 'video'
                                                ? 'Match Video'
                                                : p.projectType === 'live'
                                                ? 'Live Coding'
                                                : 'Tactical Board'}
                                            </td>
                                            <td className="py-2.5 px-3 text-right text-white">
                                              {isBoard ? '—' : p.eventsCount}
                                            </td>
                                            <td className="py-2.5 px-3 text-right">
                                              {isBoard ? (
                                                <span className="text-white/35">—</span>
                                              ) : (
                                                <span>
                                                  <span className="text-[#c6ff1f] font-semibold">
                                                    {p.activeTagsCount}
                                                  </span>
                                                  <span className="text-white/40"> / {p.totalTagsCount}</span>
                                                </span>
                                              )}
                                            </td>
                                            <td className="py-2.5 px-3 text-right text-white">
                                              {isBoard ? '—' : p.freezeFramesCount}
                                            </td>
                                            <td className="py-2.5 px-3 text-right text-white/80">
                                              {p.shapesCount}
                                            </td>
                                            <td className="py-2.5 px-3 text-right text-white/70">
                                              {isBoard
                                                ? `${p.slidesCount} slides`
                                                : `${p.playlistClipsCount} clips (${p.playlistsWithClipsCount} lists)`}
                                            </td>
                                            <td className="py-2.5 px-3 text-right text-white/55">
                                              {isBoard
                                                ? '—'
                                                : `${p.labelsUsedCount} lbl · ${p.markersCount} mrk`}
                                            </td>
                                            <td className="py-2.5 pl-3 text-right text-white/50">
                                              {formatShortDate(p.updatedAt)}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 2: FLAT PER-PROJECT METRICS MATRIX ACROSS ALL USERS       */}
        {/* ============================================================== */}
        {viewScope === 'projects' && (
          <div className="overflow-x-auto border border-white/[0.07] rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.02] text-xs font-semibold text-white/55">
                  <th className="py-3 pl-4 pr-3">Project</th>
                  <th className="py-3 px-3">Owner</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3 text-right">No. of Events</th>
                  <th className="py-3 px-3 text-right">Tags (≥1 Event)</th>
                  <th className="py-3 px-3 text-right">Freeze Frames</th>
                  <th className="py-3 px-3 text-right">Drawings</th>
                  <th className="py-3 px-3 text-right">Clips / Slides</th>
                  <th className="py-3 pl-3 pr-4 text-right">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-xs font-mono tabular-nums">
                {flattenedProjects.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center font-sans text-white/45">
                      No projects match your current filter.
                    </td>
                  </tr>
                ) : (
                  flattenedProjects.map(({ project: p, ownerName, ownerEmail, ownerPlan }) => {
                    const isBoard = p.projectType === 'board';
                    return (
                      <tr key={`${p.ownerId}-${p.projectId}`} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-3.5 pl-4 pr-3 font-sans">
                          <div className="font-semibold text-white text-sm max-w-[240px] truncate">
                            {p.projectLabel}
                          </div>
                          {!isBoard && (
                            <div className="text-[11px] text-white/45 mt-0.5">
                              {p.labelsUsedCount} labels used · {p.markersCount} markers
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-3 font-sans">
                          <div className="font-medium text-white/90">{ownerName}</div>
                          <div className="text-[11px] text-white/45">
                            {ownerEmail} · {ownerPlan === 'pro' ? 'Pro' : 'Free'}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 font-sans text-white/65">
                          {p.projectType === 'video'
                            ? 'Match Video'
                            : p.projectType === 'live'
                            ? 'Live Coding'
                            : 'Tactical Board'}
                        </td>
                        <td className="py-3.5 px-3 text-right text-sm font-bold text-white">
                          {isBoard ? <span className="text-white/35 font-normal">—</span> : p.eventsCount}
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          {isBoard ? (
                            <span className="text-white/35">—</span>
                          ) : (
                            <span>
                              <span className="text-sm font-bold text-[#c6ff1f]">{p.activeTagsCount}</span>
                              <span className="text-white/45"> / {p.totalTagsCount}</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-right text-sm font-bold text-white">
                          {isBoard ? <span className="text-white/35 font-normal">—</span> : p.freezeFramesCount}
                        </td>
                        <td className="py-3.5 px-3 text-right text-white/85">{p.shapesCount}</td>
                        <td className="py-3.5 px-3 text-right text-white/65">
                          {isBoard
                            ? `${p.slidesCount} slides`
                            : `${p.playlistClipsCount} clips (${p.playlistsWithClipsCount} lists)`}
                        </td>
                        <td className="py-3.5 pl-3 pr-4 text-right text-white/55">
                          {formatShortDate(p.updatedAt)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
