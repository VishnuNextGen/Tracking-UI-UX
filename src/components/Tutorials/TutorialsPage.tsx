import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Search, Folder, FolderOpen, Star, ExternalLink,
  Clock, X, Sparkles, Filter, Share2, Check, ArrowRight,
  Video, Compass, LayoutGrid, Radio, Layers, FileVideo,
  ChevronRight, BookOpen, LayoutList, Grid, SlidersHorizontal,
  ArrowUpDown, CheckCircle2, Shield
} from 'lucide-react';
import {
  getTutorials,
  getTutorialFolders,
  getYouTubeThumbnail,
  getYouTubeEmbedUrl,
  refreshAcademyCurriculumFromCloud,
} from '../../utils/tutorialsAndNotificationsStore';
import { FounderConnectButton } from '../Shared/FounderConnectButton';
import { ContactForFreeUpgradeButton } from '../Shared/ContactForFreeUpgradeButton';
import { ContactForUpgradeModal } from '../Shared/ContactForUpgradeModal';
import { getCurrentUser, getPlatformSettings } from '../../utils/userPlanStore';
import type { Tutorial, TutorialFolder } from '../../types/tutorials';

interface TutorialsPageProps {
  onBackToHome: () => void;
  onOpenAdmin?: () => void;
  initialTutorialId?: string | null;
  onClearInitialTutorialId?: () => void;
}

export const TutorialsPage: React.FC<TutorialsPageProps> = ({
  onBackToHome,
  onOpenAdmin,
  initialTutorialId,
  onClearInitialTutorialId,
}) => {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [folders, setFolders] = useState<TutorialFolder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [durationFilter, setDurationFilter] = useState<'all' | 'short' | 'long'>('all');
  const [sortBy, setSortBy] = useState<'recommended' | 'duration_asc' | 'duration_desc' | 'title'>('recommended');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeVideo, setActiveVideo] = useState<Tutorial | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isFreeUpgradeModalOpen, setIsFreeUpgradeModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const [platformSettings, setPlatformSettings] = useState(() => getPlatformSettings());
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load tutorials and folders from synced store
  const reloadData = () => {
    const tuts = getTutorials();
    const flds = getTutorialFolders();
    setTutorials(tuts);
    setFolders(flds);
  };

  useEffect(() => {
    reloadData();
    refreshAcademyCurriculumFromCloud(false).catch(() => {});

    const handleUpdate = () => {
      reloadData();
    };
    const handlePlanChange = () => {
      setCurrentUser(getCurrentUser());
      setPlatformSettings(getPlatformSettings());
    };
    const handleSettingsChange = () => {
      setPlatformSettings(getPlatformSettings());
    };

    window.addEventListener('tacstem_tutorials_updated', handleUpdate);
    window.addEventListener('tacstem_user_plan_updated', handlePlanChange);
    window.addEventListener('tacstem_platform_settings_updated', handleSettingsChange);
    return () => {
      window.removeEventListener('tacstem_tutorials_updated', handleUpdate);
      window.removeEventListener('tacstem_user_plan_updated', handlePlanChange);
      window.removeEventListener('tacstem_platform_settings_updated', handleSettingsChange);
    };
  }, []);

  useEffect(() => {
    if (initialTutorialId && tutorials.length > 0) {
      const target =
        tutorials.find(t => t.id === initialTutorialId) ||
        (initialTutorialId === 'tut-basic' ? tutorials[0] : undefined);
      if (target) {
        setActiveVideo(target);
      }
      if (onClearInitialTutorialId) onClearInitialTutorialId();
    }
  }, [initialTutorialId, tutorials, onClearInitialTutorialId]);

  // Handle ESC key to close active modal & shortcut for search '/'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeVideo) {
        setActiveVideo(null);
      }
      if (e.key === '/' && !activeVideo && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeVideo]);

  // Helper to parse duration string (e.g. "08:45" -> 525 seconds)
  const parseDurationInSeconds = (durationStr: string): number => {
    if (!durationStr) return 0;
    const parts = durationStr.split(':').map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  };

  // Compute total duration of all tutorials
  const totalDurationFormatted = useMemo(() => {
    let totalSec = 0;
    for (const t of tutorials) {
      totalSec += parseDurationInSeconds(t.duration);
    }
    const mins = Math.floor(totalSec / 60);
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hours > 0) {
      return `${hours}h ${remMins}m`;
    }
    return `${mins} min`;
  }, [tutorials]);

  // Filtered & sorted tutorials
  const filteredTutorials = useMemo(() => {
    let list = tutorials.filter(tut => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        q === '' ||
        tut.title.toLowerCase().includes(q) ||
        tut.description.toLowerCase().includes(q) ||
        tut.tags.some(t => t.toLowerCase().includes(q));

      const matchesFolder =
        selectedFolderId === 'all' ||
        (selectedFolderId === 'recommended' ? tut.recommended : tut.folderId === selectedFolderId);

      const durSec = parseDurationInSeconds(tut.duration);
      const matchesDuration =
        durationFilter === 'all' ||
        (durationFilter === 'short' && durSec < 8 * 60) ||
        (durationFilter === 'long' && durSec >= 8 * 60);

      return matchesSearch && matchesFolder && matchesDuration;
    });

    // Apply sorting
    list = [...list].sort((a, b) => {
      if (sortBy === 'recommended') {
        if (a.recommended && !b.recommended) return -1;
        if (!a.recommended && b.recommended) return 1;
        return b.createdAt - a.createdAt;
      }
      if (sortBy === 'duration_asc') {
        return parseDurationInSeconds(a.duration) - parseDurationInSeconds(b.duration);
      }
      if (sortBy === 'duration_desc') {
        return parseDurationInSeconds(b.duration) - parseDurationInSeconds(a.duration);
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });

    return list;
  }, [tutorials, searchTerm, selectedFolderId, durationFilter, sortBy]);

  // Recommended count
  const recommendedCount = useMemo(() => {
    return tutorials.filter(t => t.recommended).length;
  }, [tutorials]);

  // Spotlight tutorial (first recommended tutorial for high-value preview, if no active search)
  const spotlightTutorial = useMemo(() => {
    if (searchTerm || selectedFolderId !== 'all') return null;
    return tutorials.find(t => t.recommended) || tutorials[0] || null;
  }, [tutorials, searchTerm, selectedFolderId]);

  // Copy share URL
  const handleShare = (tut: Tutorial, e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(tut.youtubeUrl);
      setCopiedId(tut.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const getFolderIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Compass':
        return <Compass className="w-3.5 h-3.5 text-emerald-400" />;
      case 'LayoutGrid':
        return <LayoutGrid className="w-3.5 h-3.5 text-[#c6ff1f]" />;
      case 'Radio':
        return <Radio className="w-3.5 h-3.5 text-rose-400" />;
      case 'Layers':
        return <Layers className="w-3.5 h-3.5 text-cyan-400" />;
      case 'FileVideo':
        return <FileVideo className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Folder className="w-3.5 h-3.5 text-white/60" />;
    }
  };

  // Get active folder info
  const activeFolder = useMemo(() => {
    if (selectedFolderId === 'all') {
      return {
        name: 'All Academy Masterclasses',
        description:
          platformSettings.academySubtitle ||
          'Complete curriculum spanning tactical board design, live coding, and video export.',
      };
    }
    if (selectedFolderId === 'recommended') {
      return {
        name: 'Recommended Masterclasses',
        description: 'High-impact essential walkthroughs recommended for coaches and video analysts.',
      };
    }
    const found = folders.find(f => f.id === selectedFolderId);
    return (
      found || {
        name: 'Tutorial Module',
        description: 'Targeted drills and workflow guides.',
      }
    );
  }, [selectedFolderId, folders, platformSettings.academySubtitle]);

  return (
    <div className="w-full h-screen bg-[#09090c] text-white flex flex-col overflow-hidden select-none">
      {/* --- Sleek Compact Top Bar --- */}
      <header className="sticky top-0 z-30 bg-[#0d0d12]/95 backdrop-blur-md border-b border-white/[0.08] px-3 sm:px-6 py-2 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Left: Navigation and Title */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <button
              onClick={onBackToHome}
              className="px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/10 text-xs font-semibold text-white/80 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 border border-white/5 shrink-0"
              title="Return to Projects Dashboard"
            >
              <span>← Dashboard</span>
            </button>
            <div className="h-3.5 w-px bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1 rounded-md bg-[#c6ff1f]/15 text-[#c6ff1f] shrink-0">
                <BookOpen className="w-3.5 h-3.5" />
              </div>
              <div className="truncate">
                <span className="text-xs sm:text-sm font-bold text-white tracking-tight">
                  {platformSettings.academyTitle || 'Tacstem Video Academy'}
                </span>
                <span className="hidden md:inline text-[11px] text-white/40 ml-2">
                  {tutorials.length} Tutorials · {totalDurationFormatted}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Quick Search + View Switcher + Admin Button */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Compact Search Input */}
            <div className="relative w-36 sm:w-56 md:w-64">
              <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search tutorials... (/)"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-white/[0.04] hover:bg-white/[0.07] focus:bg-white/[0.1] border border-white/10 focus:border-[#c6ff1f]/50 rounded-lg pl-8 pr-7 py-1 text-xs text-white placeholder:text-white/35 focus:outline-none transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-0.5"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* View Mode Toggle: Grid vs Compact List */}
            <div className="hidden sm:flex items-center bg-white/[0.04] p-0.5 rounded-lg border border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded-md transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-[#c6ff1f] text-black shadow-xs font-bold'
                    : 'text-white/50 hover:text-white'
                }`}
                title="Grid View (Compact cards)"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1 rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-[#c6ff1f] text-black shadow-xs font-bold'
                    : 'text-white/50 hover:text-white'
                }`}
                title="List View (Single screen scannable)"
              >
                <LayoutList className="w-3.5 h-3.5" />
              </button>
            </div>

            {currentUser.plan === 'free' && (
              <ContactForFreeUpgradeButton
                variant="compact"
                onClick={() => setIsFreeUpgradeModalOpen(true)}
                className="hidden lg:inline-flex"
              />
            )}
            <FounderConnectButton variant="compact" className="hidden lg:inline-flex" />

            {/* Admin Console Switcher */}
            {onOpenAdmin && (
              <button
                type="button"
                onClick={onOpenAdmin}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white/60 hover:text-white hover:bg-white/5 transition-colors cursor-pointer border border-white/5 whitespace-nowrap hidden sm:inline-block"
              >
                Admin
              </button>
            )}
          </div>
        </div>
      </header>

      {/* --- Main Body: Left Category Rail + Right Compact Stage --- */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex flex-col md:flex-row overflow-hidden">
        {/* --- Left Sidebar (Category Rail) --- */}
        <aside className="w-full md:w-60 lg:w-64 bg-[#0c0c10] border-b md:border-b-0 md:border-r border-white/[0.07] flex flex-col shrink-0 overflow-y-auto scrollbar-thin">
          <div className="p-3 sm:p-4 space-y-3">
            {/* Modules Title */}
            <div className="flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wider text-white/40">
              <span>Curriculum Modules</span>
              <span className="font-mono text-[10px]">{tutorials.length} videos</span>
            </div>

            {/* Category Navigation Items */}
            <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-1 md:pb-0 scrollbar-none">
              {/* All Masterclasses */}
              <button
                type="button"
                onClick={() => setSelectedFolderId('all')}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-between gap-2 shrink-0 cursor-pointer ${
                  selectedFolderId === 'all'
                    ? 'bg-[#c6ff1f] text-black font-bold shadow-xs'
                    : 'text-white/70 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">All Tutorials</span>
                </div>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                    selectedFolderId === 'all' ? 'bg-black/20 text-black' : 'bg-white/10 text-white/50'
                  }`}
                >
                  {tutorials.length}
                </span>
              </button>

              {/* Recommended Top Picks */}
              <button
                type="button"
                onClick={() => setSelectedFolderId('recommended')}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-between gap-2 shrink-0 cursor-pointer ${
                  selectedFolderId === 'recommended'
                    ? 'bg-[#c6ff1f] text-black font-bold shadow-xs'
                    : 'text-white/70 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Star className="w-3.5 h-3.5 shrink-0 fill-current text-amber-400" />
                  <span className="truncate">Recommended</span>
                </div>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                    selectedFolderId === 'recommended'
                      ? 'bg-black/20 text-black'
                      : 'bg-white/10 text-white/50'
                  }`}
                >
                  {recommendedCount}
                </span>
              </button>

              <div className="hidden md:block h-px bg-white/[0.06] my-1" />

              {/* Individual Folders */}
              {folders.map(folder => {
                const count = tutorials.filter(t => t.folderId === folder.id).length;
                const isActive = selectedFolderId === folder.id;
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-between gap-2 shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-[#c6ff1f] text-black font-bold shadow-xs'
                        : 'text-white/70 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="shrink-0">{getFolderIcon(folder.iconName)}</span>
                      <span className="truncate">{folder.name}</span>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md shrink-0 ${
                        isActive ? 'bg-black/20 text-black' : 'bg-white/10 text-white/50'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </nav>

            {/* Duration Quick Filter */}
            <div className="hidden md:block pt-3 border-t border-white/[0.06]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 block mb-1.5 px-1">
                Duration Filter
              </span>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => setDurationFilter('all')}
                  className={`py-1 text-[11px] rounded font-medium text-center transition-colors cursor-pointer ${
                    durationFilter === 'all'
                      ? 'bg-white/15 text-white font-semibold'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Any
                </button>
                <button
                  type="button"
                  onClick={() => setDurationFilter('short')}
                  className={`py-1 text-[11px] rounded font-medium text-center transition-colors cursor-pointer ${
                    durationFilter === 'short'
                      ? 'bg-white/15 text-white font-semibold'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                  title="Under 8 minutes"
                >
                  &lt; 8m
                </button>
                <button
                  type="button"
                  onClick={() => setDurationFilter('long')}
                  className={`py-1 text-[11px] rounded font-medium text-center transition-colors cursor-pointer ${
                    durationFilter === 'long'
                      ? 'bg-white/15 text-white font-semibold'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                  title="8 minutes and longer"
                >
                  8m+
                </button>
              </div>
            </div>

            {/* Quick Pro-Tip Card (Compact) */}
            <div className="hidden md:block mt-auto p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#c6ff1f]">
                <Sparkles className="w-3 h-3" />
                <span>Analyst Tip</span>
              </div>
              <p className="text-[10px] text-white/50 mt-1 leading-snug">
                Click any masterclass to open the in-app player, or copy the direct YouTube link for sharing with coaching staff.
              </p>
            </div>

            {/* Founder Direct Connect Card */}
            <div className="hidden md:block space-y-2">
              {currentUser.plan === 'free' && (
                <ContactForFreeUpgradeButton
                  variant="card"
                  onClick={() => setIsFreeUpgradeModalOpen(true)}
                />
              )}
              <FounderConnectButton variant="card" />
            </div>
          </div>
        </aside>

        {/* --- Right Content Area (Sized-down & Concise) --- */}
        <main className="flex-1 overflow-y-auto scrollbar-thin px-3 sm:px-6 py-3 sm:py-4 flex flex-col space-y-3.5">
          {/* Header Row: Category Title & Control Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-white/[0.07]">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                  {activeFolder.name}
                </h2>
                <span className="text-[11px] font-mono text-[#c6ff1f] bg-[#c6ff1f]/10 border border-[#c6ff1f]/20 px-1.5 py-0.2 rounded-md shrink-0">
                  {filteredTutorials.length} {filteredTutorials.length === 1 ? 'video' : 'videos'}
                </span>
              </div>
              <p className="text-xs text-white/45 truncate max-w-xl mt-0.5">
                {activeFolder.description}
              </p>
            </div>

            {/* Sort & Quick Filter Controls */}
            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-white/50">
                <ArrowUpDown className="w-3 h-3 text-white/40" />
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  className="bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 rounded-lg px-2 py-1 text-xs text-white/80 focus:outline-none focus:border-[#c6ff1f]/50 cursor-pointer"
                >
                  <option value="recommended" className="bg-[#121217]">
                    Recommended First
                  </option>
                  <option value="duration_asc" className="bg-[#121217]">
                    Shortest Duration
                  </option>
                  <option value="duration_desc" className="bg-[#121217]">
                    Longest Duration
                  </option>
                  <option value="title" className="bg-[#121217]">
                    Alphabetical (A-Z)
                  </option>
                </select>
              </div>

              {/* Mobile View Switcher */}
              <div className="sm:hidden flex items-center bg-white/[0.04] p-0.5 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1 rounded-md ${
                    viewMode === 'grid' ? 'bg-[#c6ff1f] text-black font-bold' : 'text-white/50'
                  }`}
                >
                  <Grid className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-1 rounded-md ${
                    viewMode === 'list' ? 'bg-[#c6ff1f] text-black font-bold' : 'text-white/50'
                  }`}
                >
                  <LayoutList className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Optional Compact Spotlight Banner (Only ~100px height, concise!) */}
          {spotlightTutorial && (
            <div
              onClick={() => setActiveVideo(spotlightTutorial)}
              className="group relative rounded-xl border border-white/10 hover:border-[#c6ff1f]/40 bg-gradient-to-r from-[#14141e] via-[#101017] to-[#0c0c12] p-2.5 sm:p-3 transition-all cursor-pointer shadow-sm hover:shadow-md flex items-center gap-3 sm:gap-4 overflow-hidden shrink-0"
            >
              {/* Thumbnail Mini-Preview */}
              <div className="relative w-32 sm:w-44 aspect-video rounded-lg overflow-hidden bg-black shrink-0 border border-white/10">
                <img
                  src={getYouTubeThumbnail(spotlightTutorial.youtubeId)}
                  alt={spotlightTutorial.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#c6ff1f] text-black flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  </div>
                </div>
                <div className="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-black/80 font-mono text-[9px] font-bold text-white">
                  {spotlightTutorial.duration}
                </div>
              </div>

              {/* Text Info */}
              <div className="flex-1 min-w-0 pr-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-bold text-[#c6ff1f] uppercase tracking-wider flex items-center gap-1">
                    <Star className="w-2.5 h-2.5 fill-current" />
                    <span>Featured Masterclass</span>
                  </span>
                  <span className="text-[10px] text-white/40 hidden sm:inline">·</span>
                  <span className="text-[10px] text-white/40 hidden sm:inline truncate">
                    {spotlightTutorial.folderName}
                  </span>
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-[#c6ff1f] transition-colors truncate">
                  {spotlightTutorial.title}
                </h3>
                <p className="text-[11px] text-white/50 truncate mt-0.5 hidden sm:block">
                  {spotlightTutorial.description}
                </p>
              </div>

              {/* Action Button */}
              <button
                type="button"
                className="hidden md:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#c6ff1f] text-black font-bold text-xs shadow-xs group-hover:shadow-sm shrink-0"
              >
                <span>Watch</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Empty State */}
          {filteredTutorials.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 mb-3">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">No matching tutorials found</h3>
              <p className="text-xs text-white/40 mt-1 max-w-sm">
                Try adjusting your search query, selecting another module, or clearing the duration filter.
              </p>
              {(searchTerm || selectedFolderId !== 'all' || durationFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedFolderId('all');
                    setDurationFilter('all');
                  }}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  Reset all filters
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            /* --- COMPACT GRID VIEW (Sized down, 3 columns, clean spacing) --- */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredTutorials.map(tut => (
                <div
                  key={tut.id}
                  onClick={() => setActiveVideo(tut)}
                  className="group bg-[#111117] hover:bg-[#161622] border border-white/[0.07] hover:border-[#c6ff1f]/40 rounded-xl overflow-hidden transition-all duration-200 cursor-pointer flex flex-col shadow-xs hover:shadow-md"
                >
                  {/* Thumbnail (16:9 Aspect Ratio) */}
                  <div className="relative aspect-video w-full bg-black/60 overflow-hidden shrink-0">
                    <img
                      src={getYouTubeThumbnail(tut.youtubeId)}
                      alt={tut.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors" />

                    {/* Compact Play Button */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-85 group-hover:opacity-100 transition-opacity">
                      <div className="w-9 h-9 rounded-full bg-[#c6ff1f] text-black flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </div>
                    </div>

                    {/* Duration badge */}
                    <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/85 backdrop-blur-xs font-mono text-[10px] font-bold text-white flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5 text-[#c6ff1f]" />
                      <span>{tut.duration}</span>
                    </div>

                    {/* Recommended Tag */}
                    {tut.recommended && (
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/85 border border-[#c6ff1f]/30 text-[9px] font-bold text-[#c6ff1f] flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 fill-current" />
                        <span>TOP</span>
                      </div>
                    )}
                  </div>

                  {/* Concise Body Information */}
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] font-medium text-[#c6ff1f] truncate mb-0.5">
                        {tut.folderName}
                      </div>
                      <h4 className="text-xs font-bold text-white group-hover:text-[#c6ff1f] transition-colors line-clamp-2 leading-snug">
                        {tut.title}
                      </h4>
                      <p className="text-[11px] text-white/50 mt-1 line-clamp-1 leading-relaxed">
                        {tut.description}
                      </p>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-2.5 pt-2 border-t border-white/[0.05] flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={e => handleShare(tut, e)}
                          title="Copy YouTube URL"
                          className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          {copiedId === tut.id ? (
                            <Check className="w-3.5 h-3.5 text-[#c6ff1f]" />
                          ) : (
                            <Share2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <a
                          href={tut.youtubeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          title="Open directly on YouTube"
                          className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>

                      <span className="font-semibold text-xs text-[#c6ff1f] flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                        <span>Watch</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* --- COMPACT HIGH-DENSITY LIST VIEW (Instant scannability, zero scrolling!) --- */
            <div className="bg-[#111116] border border-white/[0.07] rounded-xl overflow-hidden divide-y divide-white/[0.05]">
              {filteredTutorials.map((tut, idx) => (
                <div
                  key={tut.id}
                  onClick={() => setActiveVideo(tut)}
                  className="group flex items-center justify-between gap-3 p-2.5 hover:bg-white/[0.04] transition-colors cursor-pointer select-none"
                >
                  {/* Left: Thumbnail & Title */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-[10px] font-mono text-white/30 w-4 text-center shrink-0">
                      {idx + 1}
                    </span>

                    {/* Mini thumbnail */}
                    <div className="relative w-16 sm:w-20 aspect-video rounded bg-black/80 overflow-hidden shrink-0 border border-white/10">
                      <img
                        src={getYouTubeThumbnail(tut.youtubeId)}
                        alt={tut.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-80 group-hover:opacity-100">
                        <Play className="w-3.5 h-3.5 text-[#c6ff1f] fill-current" />
                      </div>
                    </div>

                    {/* Title & Preview */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-semibold text-white group-hover:text-[#c6ff1f] transition-colors truncate">
                          {tut.title}
                        </h4>
                        {tut.recommended && (
                          <span className="shrink-0 text-[9px] font-bold text-[#c6ff1f] bg-[#c6ff1f]/10 px-1.5 py-0.2 rounded border border-[#c6ff1f]/20">
                            TOP
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-white/40 mt-0.5 truncate">
                        <span className="text-white/60">{tut.folderName}</span>
                        <span>·</span>
                        <span className="truncate">{tut.description}</span>
                      </div>
                    </div>
                  </div>

                  {/* Center/Right: Duration & Tags */}
                  <div className="hidden sm:flex items-center gap-4 shrink-0 text-xs text-white/60">
                    <div className="flex items-center gap-1 font-mono text-xs tabular-nums text-white/70">
                      <Clock className="w-3 h-3 text-[#c6ff1f]" />
                      <span>{tut.duration}</span>
                    </div>

                    {tut.tags.length > 0 && (
                      <span className="text-[10px] text-white/40 bg-white/[0.04] px-1.5 py-0.5 rounded hidden md:inline">
                        #{tut.tags[0]}
                      </span>
                    )}
                  </div>

                  {/* Far Right: Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={e => handleShare(tut, e)}
                      title="Copy link"
                      className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      {copiedId === tut.id ? (
                        <Check className="w-3.5 h-3.5 text-[#c6ff1f]" />
                      ) : (
                        <Share2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <a
                      href={tut.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      title="Open on YouTube"
                      className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      className="ml-1 px-2 py-1 rounded bg-[#c6ff1f]/10 hover:bg-[#c6ff1f] text-[#c6ff1f] hover:text-black font-semibold text-[11px] transition-colors flex items-center gap-1"
                    >
                      <span>Play</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* --- IN-APP YOUTUBE VIDEO PLAYER MODAL --- */}
      <AnimatePresence>
        {activeVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
            onClick={() => setActiveVideo(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              transition={{ duration: 0.18 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#111116] border border-white/15 rounded-2xl overflow-hidden max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl"
            >
              {/* Modal Top Bar */}
              <div className="p-3 px-4 sm:px-5 border-b border-white/[0.08] flex items-center justify-between gap-3 bg-white/[0.02]">
                <div className="min-w-0 flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#c6ff1f] bg-[#c6ff1f]/10 px-2 py-0.5 rounded border border-[#c6ff1f]/20 shrink-0">
                    {activeVideo.folderName}
                  </span>
                  <h3 className="text-xs sm:text-sm font-bold text-white truncate max-w-lg">
                    {activeVideo.title}
                  </h3>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={activeVideo.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                    title="Open on YouTube"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => setActiveVideo(null)}
                    className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    title="Close player (ESC)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* YouTube Responsive Embed Container */}
              <div className="relative aspect-video w-full bg-black">
                <iframe
                  src={getYouTubeEmbedUrl(activeVideo.youtubeId, true)}
                  title={activeVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              </div>

              {/* Video Info & Notes (Compact) */}
              <div className="p-4 overflow-y-auto space-y-3 max-h-40 scrollbar-thin">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-white">{activeVideo.title}</h2>
                    <div className="flex items-center gap-2.5 text-[11px] text-white/40 mt-0.5">
                      <span>{activeVideo.author || 'Tacstem Academy'}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1 font-mono text-white/60">
                        <Clock className="w-3 h-3 text-[#c6ff1f]" />
                        {activeVideo.duration}
                      </span>
                      {activeVideo.recommended && (
                        <>
                          <span>·</span>
                          <span className="text-[#c6ff1f] font-semibold flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 fill-current" /> Recommended
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={e => handleShare(activeVideo, e)}
                    className="px-2.5 py-1 rounded bg-white/[0.05] hover:bg-white/10 border border-white/10 text-xs text-white/80 transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    {copiedId === activeVideo.id ? (
                      <>
                        <Check className="w-3 h-3 text-[#c6ff1f]" />
                        <span className="text-[#c6ff1f] text-[11px]">Link Copied</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3 h-3" />
                        <span className="text-[11px]">Share</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-xs text-white/65 leading-relaxed whitespace-pre-wrap">
                  {activeVideo.description}
                </p>

                {activeVideo.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {activeVideo.tags.map(t => (
                      <span
                        key={t}
                        className="text-[10px] text-white/50 bg-white/[0.04] border border-white/5 px-1.5 py-0.2 rounded"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ContactForUpgradeModal
        isOpen={isFreeUpgradeModalOpen}
        onClose={() => setIsFreeUpgradeModalOpen(false)}
        currentUser={currentUser}
        onUpgraded={() => {
          setCurrentUser(getCurrentUser());
        }}
      />
    </div>
  );
};
