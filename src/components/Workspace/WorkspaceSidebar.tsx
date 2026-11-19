import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Tags,
  Tag,
  FolderOpen,
  Download,
  Upload,
  Layers,
  Settings2,
  Zap,
  FileSpreadsheet,
  Activity,
  Undo2,
  Redo2,
  ListPlus,
  Trash2,
  Trash,
  X,
  Check,
  Pencil,
  Plus,
  MapPin,
  Folder,
  FolderPlus,
  Scissors,
  StopCircle,
  Video,
  PlayCircle,
  FileCode,
  Save,
  Maximize,
  ExternalLink,
  FileText,
  StickyNote,
  MessageSquare,
  ChevronDown,
  Crosshair
} from 'lucide-react';
import type {
  Tag as TagData,
  TagEvent,
  Label,
  LabelGroup,
  ActiveRecording,
  Playlist,
  TimelineMarker,
  ToolType,
  Project,
  PlaylistItem,
  FreezeFrame
} from '../../types';
import { formatTime } from '../../utils/math';
import { formatSyncClock, getCanonicalPeriod } from '../../utils/periodSyncUtils';
import { fadeColor } from '../../utils/colors';
import { PlaylistClipsList } from '../Playlist/PlaylistClipsList';
import { getClipEventId, resolveClipTiming } from '../../utils/playlistUtils';

export interface WorkspaceSidebarProps {
  sidebarRef: React.RefObject<HTMLDivElement | null>;
  sidebarWidth: number;
  setIsResizingSidebar: (resizing: boolean) => void;
  activeSidebarTab: 'tags' | 'events' | 'notes' | 'playlist';
  setActiveSidebarTab: (tab: 'tags' | 'events' | 'notes' | 'playlist') => void;

  // Coding & Tags Tab Props
  isTaggingMode: boolean;
  setIsTaggingMode: (mode: boolean) => void;
  setActiveRecordings: (recordings: ActiveRecording[]) => void;
  setTool: (tool: ToolType) => void;
  setSelectedEventIds: (ids: Set<string>) => void;
  labelsEnabled: boolean;
  setLabelsEnabled: (enabled: boolean) => void;
  setShowNormalTemplateModal: (show: boolean) => void;
  currentNormalTemplateName: string;
  onOpenCodeFilesModal?: () => void;
  onOpenCodeFileSaveModal?: () => void;
  currentCodeFileName?: string;
  onPopoutCodingPanel?: () => void;
  exportUnifiedSetupToJSON: () => void;
  unifiedFileInputRef: React.RefObject<HTMLInputElement | null>;
  handleUnifiedFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setIsAdvancedCodingMode: (mode: boolean) => void;
  setTagSettingsOpen: (open: boolean) => void;
  tagPanelDensity: 'compact' | 'comfortable' | 'list';
  setTagPanelDensity: (density: 'compact' | 'comfortable' | 'list') => void;
  tagPanelFontSizeMode: 'auto' | 'sm' | 'md' | 'lg';
  setTagPanelFontSizeMode: (mode: 'auto' | 'sm' | 'md' | 'lg') => void;
  tags: TagData[];
  activeRecordings: ActiveRecording[];
  tagEvents: TagEvent[];
  setTagEvents: React.Dispatch<React.SetStateAction<TagEvent[]>>;
  filterTagId: string | null;
  setFilterTagId: (id: string | null) => void;
  filterLabelId: string | null;
  setFilterLabelId: (id: string | null) => void;
  handleTagClick: (tagId: string) => void;
  importEventsFromCSV: () => void;
  exportEventsToCSV: () => void;

  // Events Tab Props
  handleUndoEvents: () => void;
  canUndoEvents: boolean;
  handleRedoEvents: () => void;
  canRedoEvents: boolean;
  selectedEventLogs: Set<string>;
  setSelectedEventLogs: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedEventIds: Set<string>;
  addEventsToPlaylist: (ids: string[], playlistId?: string, forceDuplicate?: boolean) => void;
  getDisplayEvents: () => TagEvent[];
  showNotification: (msg: string, color?: string, onUndo?: () => void) => void;
  eventSortMode: 'recent' | 'timing';
  setEventSortMode: (mode: 'recent' | 'timing') => void;
  labels: Label[];
  labelGroups?: LabelGroup[];
  handleLabelClick?: (labelId: string) => void;
  bulkDeleteConfirmation: boolean;
  setBulkDeleteConfirmation: (val: boolean) => void;
  isEventsEditMode: boolean;
  setIsEventsEditMode: (val: boolean) => void;
  logDeleteConfirmation: string | null;
  setLogDeleteConfirmation: (id: string | null) => void;
  jumpToMarker: (time: number) => void;
  setPlaybarEventId: (id: string | null) => void;
  handleEventContextMenu: (e: React.MouseEvent, eventId: string) => void;
  onOpenEventNoteModal?: (eventId: string, projectId?: string) => void;
  onSaveEventNote?: (eventId: string, noteText: string, projectId?: string) => void;
  onDeleteEvents?: (ids: string[]) => void;

  // Notes Tab Props
  notesSubTab: 'timeline' | 'general';
  setNotesSubTab: (tab: 'timeline' | 'general') => void;
  setMarkerModal: (modal: any) => void;
  currentTime: number;
  markers: TimelineMarker[];
  setMarkers: React.Dispatch<React.SetStateAction<TimelineMarker[]>>;
  projectNotes: string;
  setProjectNotes: (notes: string) => void;

  // Playlist Tab Props
  playlists: Playlist[];
  setPlaylistModal: (modal: any) => void;
  activePlaylistId: string;
  setActivePlaylistId: (id: string) => void;
  setPlaylistDeleteId: (id: string | null) => void;
  showPlaylistPlaybar: boolean;
  setShowPlaylistPlaybar: (val: boolean) => void;
  handlePlaylistClipSelect: (index: number, startTime?: number, play?: boolean) => void;
  autoplay: { active: boolean; playlistId: string | null; eventIndex: number };
  setAutoplay: (val: any) => void;
  exportPlaylistVideo: (playlistId: string, withFreeze: boolean) => void;
  startPlaylistAutoplay: (playlistId: string) => void;
  allBatchTagEvents: TagEvent[];
  allBatchTags: TagData[];
  allBatchLabels: Label[];
  batchMode?: {
    batch: any;
    allBatchProjects: Project[];
    [key: string]: any;
  };
  playlistPlaybarIndex: number;
  draggingEventIndex: number | null;
  setDraggingEventIndex: (idx: number | null) => void;
  findEventAcrossBatch: (id: string, item?: PlaylistItem) => { event?: TagEvent; project?: Project };
  duplicatePlaylistEvent: (playlistId: string, index: number, options?: { cleanSlate?: boolean; isolate?: boolean }) => void;
  removeEventFromPlaylist: (playlistId: string, index: number) => void;
  handleResetPlaylistClipTrim: (playlistId: string, index: number) => void;
  reorderPlaylistEvents: (playlistId: string, fromIndex: number, toIndex: number) => void;
  addSelectedToPlaylist: (playlistId?: string, forceDuplicate?: boolean) => void;
  onEnterPresentationMode?: () => void;
  onOpenTracking?: (clipIndex?: number) => void;
  freezeFrames?: FreezeFrame[];
}

export const getSidebarTagStyle = (
  name: string,
  density: 'compact' | 'comfortable' | 'list',
  fontMode: 'auto' | 'sm' | 'md' | 'lg'
) => {
  if (fontMode === 'sm') {
    return { fontSize: '8px', lineHeight: '1.08', letterSpacing: '-0.02em', lineClamp: 2 };
  }
  if (fontMode === 'md') {
    return { fontSize: '9.5px', lineHeight: '1.15', letterSpacing: 'normal', lineClamp: 2 };
  }
  if (fontMode === 'lg') {
    return { fontSize: '11px', lineHeight: '1.2', letterSpacing: 'normal', lineClamp: 2 };
  }
  // Auto-fit calculation based on tag name length and grid layout density:
  const len = name.length;
  if (density === 'list') {
    if (len > 30) return { fontSize: '9px', lineHeight: '1.15', letterSpacing: '-0.01em', lineClamp: 2 };
    if (len > 20) return { fontSize: '10px', lineHeight: '1.2', letterSpacing: 'normal', lineClamp: 2 };
    return { fontSize: '11.5px', lineHeight: '1.25', letterSpacing: 'normal', lineClamp: 1 };
  } else if (density === 'comfortable') {
    if (len > 24) return { fontSize: '7.5px', lineHeight: '1.05', letterSpacing: '-0.025em', lineClamp: 2 };
    if (len > 16) return { fontSize: '8.5px', lineHeight: '1.1', letterSpacing: '-0.015em', lineClamp: 2 };
    if (len > 10) return { fontSize: '9.5px', lineHeight: '1.15', letterSpacing: 'normal', lineClamp: 2 };
    return { fontSize: '10.5px', lineHeight: '1.2', letterSpacing: 'normal', lineClamp: 2 };
  } else {
    // 'compact' mode (~82-85px min)
    if (len > 20) return { fontSize: '7px', lineHeight: '1.0', letterSpacing: '-0.03em', lineClamp: 2 };
    if (len > 14) return { fontSize: '7.5px', lineHeight: '1.05', letterSpacing: '-0.02em', lineClamp: 2 };
    if (len > 9) return { fontSize: '8.5px', lineHeight: '1.1', letterSpacing: '-0.01em', lineClamp: 2 };
    if (len > 6) return { fontSize: '9.5px', lineHeight: '1.15', letterSpacing: 'normal', lineClamp: 2 };
    return { fontSize: '10.5px', lineHeight: '1.2', letterSpacing: 'normal', lineClamp: 2 };
  }
};

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  sidebarRef,
  sidebarWidth,
  setIsResizingSidebar,
  activeSidebarTab,
  setActiveSidebarTab,
  isTaggingMode,
  setIsTaggingMode,
  setActiveRecordings,
  setTool,
  setSelectedEventIds,
  labelsEnabled,
  setLabelsEnabled,
  setShowNormalTemplateModal,
  currentNormalTemplateName,
  onOpenCodeFilesModal,
  onOpenCodeFileSaveModal,
  currentCodeFileName,
  onPopoutCodingPanel,
  exportUnifiedSetupToJSON,
  unifiedFileInputRef,
  handleUnifiedFileSelect,
  setIsAdvancedCodingMode,
  setTagSettingsOpen,
  tagPanelDensity,
  setTagPanelDensity,
  tagPanelFontSizeMode,
  setTagPanelFontSizeMode,
  tags,
  activeRecordings,
  tagEvents,
  setTagEvents,
  filterTagId,
  setFilterTagId,
  filterLabelId,
  setFilterLabelId,
  handleTagClick,
  importEventsFromCSV,
  exportEventsToCSV,
  handleUndoEvents,
  canUndoEvents,
  handleRedoEvents,
  canRedoEvents,
  selectedEventLogs,
  setSelectedEventLogs,
  selectedEventIds,
  addEventsToPlaylist,
  getDisplayEvents,
  showNotification,
  eventSortMode,
  setEventSortMode,
  labels,
  labelGroups = [],
  handleLabelClick,
  bulkDeleteConfirmation,
  setBulkDeleteConfirmation,
  isEventsEditMode,
  setIsEventsEditMode,
  logDeleteConfirmation,
  setLogDeleteConfirmation,
  jumpToMarker,
  setPlaybarEventId,
  handleEventContextMenu,
  onOpenEventNoteModal,
  onSaveEventNote,
  onDeleteEvents,
  notesSubTab,
  setNotesSubTab,
  setMarkerModal,
  currentTime,
  markers,
  setMarkers,
  projectNotes,
  setProjectNotes,
  playlists,
  setPlaylistModal,
  activePlaylistId,
  setActivePlaylistId,
  setPlaylistDeleteId,
  showPlaylistPlaybar,
  setShowPlaylistPlaybar,
  handlePlaylistClipSelect,
  autoplay,
  setAutoplay,
  exportPlaylistVideo,
  startPlaylistAutoplay,
  allBatchTagEvents,
  allBatchTags,
  allBatchLabels,
  batchMode,
  playlistPlaybarIndex,
  draggingEventIndex,
  setDraggingEventIndex,
  findEventAcrossBatch,
  duplicatePlaylistEvent,
  removeEventFromPlaylist,
  handleResetPlaylistClipTrim,
  reorderPlaylistEvents,
  addSelectedToPlaylist,
  onEnterPresentationMode,
  onOpenTracking,
  freezeFrames = []
}) => {
  const lastClickedSidebarEventIdRef = React.useRef<string | null>(null);
  const [notesTimelineFilter, setNotesTimelineFilter] = React.useState<'all' | 'events' | 'markers'>('all');
  const [editingEventNoteId, setEditingEventNoteId] = React.useState<string | null>(null);
  const [editingEventNoteText, setEditingEventNoteText] = React.useState('');
  const [isPlaylistsDrawerCollapsed, setIsPlaylistsDrawerCollapsed] = React.useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = React.useState(false);
  const exportMenuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!isExportMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isExportMenuOpen]);

  const eventNotesList = useMemo(() => {
    return tagEvents
      .filter((e) => e.notes && e.notes.trim().length > 0)
      .map((e) => {
        const tag = tags.find((t) => t.id === e.tagId);
        const eventLabels = (e.labelIds || [])
          .map((lid) => labels.find((l) => l.id === lid)?.name)
          .filter(Boolean) as string[];
        return {
          id: e.id,
          eventId: e.id,
          isEvent: true as const,
          time: e.startTime,
          endTime: e.endTime,
          tagName: tag?.name || 'Tagged Event',
          tagColor: tag?.color || '#3b82f6',
          labels: eventLabels,
          note: e.notes || '',
        };
      });
  }, [tagEvents, tags, labels]);
  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      ref={sidebarRef}
      className="flex flex-col bg-[#111] border-l border-[#222] z-30 shrink-0 relative"
      style={{ width: sidebarWidth }}
    >
      <div
        className="absolute top-0 bottom-0 -left-1 w-2 cursor-ew-resize hover:bg-[#a0d600]/50 transition-colors z-50"
        onMouseDown={() => setIsResizingSidebar(true)}
      />

      {/* Main Tabs */}
      <div className="flex border-b border-[#222] shrink-0 bg-[#0a0a0a]">
        <button
          onClick={() => setActiveSidebarTab('tags')}
          className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
            activeSidebarTab === 'tags'
              ? 'text-[#c6ff1f] bg-[#161616] border-t border-t-[#c6ff1f]'
              : 'text-gray-500 hover:bg-[#111]'
          }`}
        >
          Tags
        </button>
        <button
          onClick={() => setActiveSidebarTab('events')}
          className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
            activeSidebarTab === 'events'
              ? 'text-[#c6ff1f] bg-[#161616] border-t border-t-[#c6ff1f]'
              : 'text-gray-500 hover:bg-[#111]'
          }`}
        >
          Events
        </button>
        <button
          onClick={() => setActiveSidebarTab('notes')}
          className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
            activeSidebarTab === 'notes'
              ? 'text-[#c6ff1f] bg-[#161616] border-t border-t-[#c6ff1f]'
              : 'text-gray-500 hover:bg-[#111]'
          }`}
        >
          Notes
        </button>
        <button
          onClick={() => setActiveSidebarTab('playlist')}
          className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
            activeSidebarTab === 'playlist'
              ? 'text-[#c6ff1f] bg-[#161616] border-t border-t-[#c6ff1f]'
              : 'text-gray-500 hover:bg-[#111]'
          }`}
        >
          Playlist
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col relative bg-[#111]">
        {/* --- CODING / TAGS PANEL TAB --- */}
        {activeSidebarTab === 'tags' && (
          <div className="flex flex-col h-full">
            {/* Compact Tagging Header */}
            <div className="px-2 py-1.5 border-b border-[#222] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Tags className="w-3.5 h-3.5 text-[#c6ff1f]" />
                <span className="text-[11px] font-bold text-white">Event Tagging</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[9px] font-bold uppercase tracking-wider ${
                    isTaggingMode ? 'text-red-500 animate-pulse' : 'text-gray-500'
                  }`}
                >
                  {isTaggingMode ? 'REC' : 'OFF'}
                </span>
                <button
                  onClick={() => {
                    const nextMode = !isTaggingMode;
                    setIsTaggingMode(nextMode);
                    setActiveRecordings([]);
                    if (nextMode) {
                      setTool(null);
                      setSelectedEventIds(new Set());
                    }
                  }}
                  className={`w-7 h-4 rounded-full relative transition-colors ${
                    isTaggingMode ? 'bg-red-500' : 'bg-gray-700'
                  }`}
                >
                  <motion.div
                    className="w-2.5 h-2.5 bg-white rounded-full absolute top-0.5"
                    animate={{ left: isTaggingMode ? 'calc(100% - 12px)' : '2px' }}
                  />
                </button>
              </div>
            </div>

            {/* Labels Toggle */}
            <div className="px-2 py-1.5 border-b border-[#222] flex items-center justify-between shrink-0 bg-[#0a0a0a]">
              <div className="flex items-center gap-1.5 min-w-0">
                <Tag className="w-3.5 h-3.5 text-[#c6ff1f] shrink-0" />
                <span className="text-[11px] font-bold text-white truncate">Labels</span>
                <span className="px-1.5 py-0.2 bg-[#1a1a20] text-gray-400 rounded text-[8.5px] font-mono font-bold shrink-0">
                  {labels.length}
                </span>
                {(() => {
                  const attachedCount = activeRecordings.reduce((acc, r) => acc + (r.labelIds?.length || 0), 0);
                  if (attachedCount > 0) {
                    return (
                      <span className="px-1.5 py-0.2 bg-[#c6ff1f]/15 text-[#c6ff1f] border border-[#c6ff1f]/30 rounded text-[8.5px] font-bold animate-pulse shrink-0">
                        {attachedCount} rec
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`text-[9px] font-bold uppercase tracking-wider ${
                    labelsEnabled ? 'text-[#c6ff1f]' : 'text-gray-500'
                  }`}
                >
                  {labelsEnabled ? 'ON' : 'OFF'}
                </span>
                <button
                  type="button"
                  onClick={() => setLabelsEnabled(!labelsEnabled)}
                  className={`w-7 h-4 rounded-full relative transition-colors cursor-pointer ${
                    labelsEnabled ? 'bg-[#c6ff1f]' : 'bg-gray-700'
                  }`}
                  title="Toggle Labels panel"
                >
                  <motion.div
                    className="w-2.5 h-2.5 bg-white rounded-full absolute top-0.5"
                    animate={{ left: labelsEnabled ? 'calc(100% - 12px)' : '2px' }}
                  />
                </button>
              </div>
            </div>

            {/* Unified Code File Bar */}
            <div className="px-2 py-1.5 bg-[#141416] border-b border-[#222] flex items-center justify-between gap-1.5 shrink-0">
              <button
                onClick={onOpenCodeFilesModal || (() => setShowNormalTemplateModal(true))}
                className="flex items-center gap-1.5 min-w-0 text-left hover:bg-[#1c1c22] p-1 rounded-md transition-colors group cursor-pointer flex-1"
                title="Open Code Files & Presets (Tags, Labels & Pad Layout)"
              >
                <div className="w-5 h-5 rounded bg-[#c6ff1f]/10 border border-[#c6ff1f]/30 flex items-center justify-center text-[#c6ff1f] shrink-0 group-hover:scale-105 transition-transform">
                  <FileCode className="w-3 h-3" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[7.5px] font-extrabold uppercase tracking-wider text-gray-400 leading-none">
                    Code File
                  </span>
                  <span
                    className="text-[10px] font-bold text-white truncate max-w-[130px] leading-tight group-hover:text-[#c6ff1f] transition-colors"
                    title={currentCodeFileName || currentNormalTemplateName}
                  >
                    {currentCodeFileName || currentNormalTemplateName}
                  </span>
                </div>
              </button>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Save / Overwrite Button */}
                <button
                  onClick={onOpenCodeFileSaveModal || exportUnifiedSetupToJSON}
                  className="px-2 py-1 bg-[#c6ff1f]/10 hover:bg-[#c6ff1f]/25 text-[#c6ff1f] border border-[#c6ff1f]/30 hover:border-[#c6ff1f]/60 rounded text-[9px] font-bold flex items-center gap-1 transition-all shadow-xs cursor-pointer"
                  title="Save or Overwrite Code File"
                >
                  <Save className="w-2.5 h-2.5" />
                  <span>Save</span>
                </button>
              </div>
            </div>

            {/* Hidden File Input for Unified Coding Template */}
            <input
              type="file"
              ref={unifiedFileInputRef as any}
              onChange={handleUnifiedFileSelect}
              accept=".json"
              className="hidden"
            />

            {/* Quick Action: Open Coding Pad, Pop out & Tag Settings */}
            <div className="p-1 sm:p-1.5 bg-[#101012] border-b border-[#222] flex items-center justify-between gap-1 sm:gap-1.5 shrink-0">
              <button
                onClick={() => setIsAdvancedCodingMode(true)}
                className="flex-1 min-w-fit py-1 px-1.5 bg-[#c6ff1f]/10 hover:bg-[#c6ff1f]/20 border border-[#c6ff1f]/30 hover:border-[#c6ff1f]/60 rounded text-[9.5px] font-bold tracking-tight text-[#c6ff1f] flex items-center justify-center gap-1 transition-all shadow-xs group cursor-pointer"
                title="Open Interactive Coding Pad Canvas"
              >
                <Layers className="w-3 h-3 shrink-0 group-hover:scale-105 transition-transform" />
                <span className="whitespace-nowrap leading-none select-none">Open Pad</span>
              </button>
              {onPopoutCodingPanel && (
                <button
                  type="button"
                  onClick={onPopoutCodingPanel}
                  className="py-1 px-2 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 hover:border-indigo-500/60 rounded text-indigo-400 hover:text-white flex items-center justify-center transition-all shrink-0 cursor-pointer shadow-xs group"
                  title="Pop out Coding Panel into a floating resizable window entity near your video"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0 text-indigo-400 group-hover:scale-110 transition-transform" />
                </button>
              )}
              <button
                onClick={() => setTagSettingsOpen(true)}
                className="py-1 px-1.5 bg-[#1e1e24] hover:bg-[#282830] border border-[#2e2e3a] rounded text-[9.5px] font-medium text-gray-300 hover:text-white flex items-center justify-center gap-1 transition-colors shrink-0 min-w-fit cursor-pointer"
                title="Open Code Window & Tag Settings"
              >
                <Settings2 className="w-3 h-3 shrink-0 text-gray-400" />
                <span className="whitespace-nowrap leading-none select-none">Settings</span>
              </button>
            </div>

            {/* Responsive Tags Grid */}
            <div className="flex-1 overflow-y-auto p-1.5 custom-scrollbar">
              <div
                className="grid gap-1.5"
                style={{
                  gridTemplateColumns: 'repeat(auto-fill, minmax(82px, 1fr))'
                }}
              >
                {tags.map((tag) => {
                  const isActive = isTaggingMode && activeRecordings.some((r) => r.tagId === tag.id);
                  const count = tagEvents.filter((e) => e.tagId === tag.id).length;
                  const isFiltered = filterTagId === tag.id;
                  const tagStyle = getSidebarTagStyle(tag.name, 'compact', 'auto');
                  return (
                    <button
                      key={tag.id}
                      onClick={() => handleTagClick(tag.id)}
                      className={`relative min-h-[36px] sm:min-h-[38px] h-auto py-1 px-1.5 pl-2.5 rounded border flex items-center justify-between gap-1 transition-all overflow-hidden group text-left ${
                        isTaggingMode
                          ? isActive
                            ? 'border-transparent bg-gray-800 scale-95 ring-1 ring-white'
                            : 'border-[#333] bg-[#161616] hover:bg-[#222]'
                          : isFiltered
                          ? 'border-transparent bg-[#222] ring-1 ring-white'
                          : 'border-[#333] bg-[#161616] hover:bg-[#222]'
                      }`}
                      style={{
                        borderColor: isActive || isFiltered ? tag.color : undefined,
                        boxShadow: isActive ? `0 0 10px ${fadeColor(tag.color, 0.2)}` : undefined
                      }}
                      title={`${tag.name}${tag.shortcut ? ` [Key: ${tag.shortcut}]` : ''} • Click to ${
                        isTaggingMode ? 'record event' : 'filter events'
                      }`}
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-[3.5px]" style={{ backgroundColor: tag.color }} />
                      <div className="flex-1 min-w-0 pr-0.5 flex flex-col justify-center">
                        <span
                          className="font-medium text-gray-200 select-none"
                          style={{
                            fontSize: tagStyle.fontSize,
                            lineHeight: tagStyle.lineHeight,
                            letterSpacing: tagStyle.letterSpacing,
                            wordBreak: 'break-word',
                            display: '-webkit-box',
                            WebkitLineClamp: tagStyle.lineClamp,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                        >
                          {tag.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-0.5">
                        {tag.shortcut && (
                          <div
                            className="flex items-center justify-center min-w-[15px] h-[15px] bg-[#2a2a2a] group-hover:bg-[#383838] rounded-sm text-[8px] sm:text-[8.5px] font-bold text-gray-400 group-hover:text-white border border-[#444] px-0.5 font-mono shadow-xs"
                            title={`Hotkey: ${tag.shortcut}`}
                          >
                            {tag.shortcut}
                          </div>
                        )}
                        {!isTaggingMode && (
                          <span
                            className="text-[8.5px] text-gray-500 font-mono font-medium px-0.5"
                            title={`${count} logged events`}
                          >
                            {count}
                          </span>
                        )}
                      </div>
                      {isActive && (
                        <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      )}
                      {isTaggingMode && tag.leadLagEnabled && (
                        <div className="absolute bottom-0.5 right-0.5 opacity-50">
                          <Zap className="w-2 h-2 text-yellow-500 fill-yellow-500" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pinned Footer for Events Data CSV */}
            <div className="p-2 border-t border-[#222] bg-[#0c0c0e] flex items-center justify-between gap-1.5 shrink-0 select-none">
              <div className="flex items-center gap-1.5 min-w-0">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-[9.5px] font-bold text-gray-200 leading-tight">Events Data</span>
                  <span className="text-[8px] text-gray-500 font-mono leading-none">
                    {tagEvents.length} logged {tagEvents.length === 1 ? 'event' : 'events'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={importEventsFromCSV}
                  className="px-2 py-1 bg-[#1a1a22] hover:bg-[#262635] text-gray-300 hover:text-white rounded text-[9.5px] font-medium border border-[#2d2d38] transition-colors flex items-center gap-1 shadow-xs"
                  title="Import logged event timestamps and notes from CSV spreadsheet"
                >
                  <Upload className="w-3 h-3 text-gray-400" />
                  <span>Import CSV</span>
                </button>
                <button
                  onClick={exportEventsToCSV}
                  className="px-2 py-1 bg-[#16231c] hover:bg-[#1f3328] text-emerald-300 hover:text-emerald-200 rounded text-[9.5px] font-bold border border-emerald-800/40 transition-colors flex items-center gap-1 shadow-xs"
                  title="Export all logged events (timestamps, tags, labels, notes) to CSV spreadsheet"
                >
                  <Download className="w-3 h-3 text-emerald-400" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- EVENTS TAB --- */}
        {activeSidebarTab === 'events' && (
          <div className="flex flex-col h-full">
            <div className="px-2 py-1.5 border-b border-[#222] flex flex-wrap items-center justify-between gap-1 shrink-0">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] font-bold text-white">Events ({tagEvents.length})</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={handleUndoEvents}
                  disabled={!canUndoEvents}
                  className="text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
                  title="Undo Logging"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleRedoEvents}
                  disabled={!canRedoEvents}
                  className="text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
                  title="Redo Logging"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
                <div className="w-[1px] h-3 bg-[#333] mx-0.5 hidden sm:block"></div>
                <button
                  onClick={(e) => {
                    const force = e.shiftKey;
                    if (selectedEventLogs.size > 0 || selectedEventIds.size > 0) {
                      addSelectedToPlaylist(undefined, force);
                    } else {
                      const displayEvts = getDisplayEvents();
                      if (displayEvts.length > 0) {
                        addEventsToPlaylist(
                          displayEvts.map((e) => e.id),
                          undefined,
                          force
                        );
                      } else {
                        showNotification('No events to add to playlist', '#f59e0b');
                      }
                    }
                  }}
                  className="flex items-center gap-1 bg-[#1e293b] hover:bg-[#334155] text-[#c6ff1f] px-1.5 py-0.5 rounded text-[9px] font-bold border border-[#334155] transition-colors"
                  title="Add selected (or all filtered) events to playlist (Ctrl+S) • Hold Shift for duplicates"
                >
                  <ListPlus className="w-3.5 h-3.5" />
                  <span>+ Playlist</span>
                </button>
                <div className="w-[1px] h-3 bg-[#333] mx-0.5 hidden sm:block"></div>
                <select
                  value={eventSortMode}
                  onChange={(e) => setEventSortMode(e.target.value as 'recent' | 'timing')}
                  className="bg-[#222] border border-[#333] text-[9px] text-gray-300 rounded outline-none w-[55px] px-1 py-0.5"
                >
                  <option value="recent">Recent</option>
                  <option value="timing">Timing</option>
                </select>
                <select
                  value={filterTagId || ''}
                  onChange={(e) => setFilterTagId(e.target.value || null)}
                  className="bg-[#222] border border-[#333] text-[9px] text-gray-300 rounded outline-none w-[55px] px-1 py-0.5"
                >
                  <option value="">All Tags</option>
                  {tags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <select
                  value={filterLabelId || ''}
                  onChange={(e) => setFilterLabelId(e.target.value || null)}
                  className="bg-[#222] border border-[#333] text-[9px] text-gray-300 rounded outline-none w-[55px] px-1 py-0.5"
                >
                  <option value="">All Lbls</option>
                  {labels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>

                {bulkDeleteConfirmation ? (
                  <div className="flex items-center gap-1 bg-[#161616] px-1 rounded shadow-lg border border-[#333]">
                    <button
                      onClick={() => {
                        const idsToDelete = selectedEventLogs.size > 0
                          ? Array.from(selectedEventLogs)
                          : tagEvents.map((e) => e.id);
                        if (onDeleteEvents) {
                          onDeleteEvents(idsToDelete);
                        } else {
                          if (selectedEventLogs.size > 0) {
                            const deleteSet = new Set(selectedEventLogs);
                            setTagEvents((prev) => prev.filter((e) => !deleteSet.has(e.id)));
                          } else {
                            setTagEvents([]);
                          }
                          const nextIds = new Set(selectedEventIds);
                          idsToDelete.forEach((id) => nextIds.delete(id));
                          setSelectedEventIds(nextIds);
                          setPlaybarEventId(null);
                        }
                        if (idsToDelete.length > 1) {
                          showNotification(`Deleted ${idsToDelete.length} events`, '#ef4444');
                        }
                        setSelectedEventLogs(new Set());
                        setIsEventsEditMode(false);
                        setBulkDeleteConfirmation(false);
                      }}
                      className="text-green-400 hover:text-green-300 p-0.5"
                      title="Confirm Delete"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setBulkDeleteConfirmation(false)}
                      className="text-red-400 hover:text-red-300 p-0.5"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : isEventsEditMode ? (
                  <>
                    <button
                      onClick={() => setBulkDeleteConfirmation(true)}
                      className="text-red-400 hover:text-red-300 transition-colors bg-red-900/30 px-1.5 py-0.5 rounded flex items-center gap-1"
                      title={selectedEventLogs.size > 0 ? 'Delete Selected' : 'Clear All Events'}
                    >
                      <Trash2 className="w-3 h-3" />
                      <span className="text-[9px] font-bold">
                        {selectedEventLogs.size > 0 ? selectedEventLogs.size : 'All'}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedEventLogs(new Set());
                        setIsEventsEditMode(false);
                      }}
                      className="text-gray-400 hover:text-white transition-colors"
                      title="Cancel Edit"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEventsEditMode(true)}
                    className="text-gray-500 hover:text-red-400 transition-colors"
                    title="Delete Events"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-1.5 custom-scrollbar space-y-1">
              {getDisplayEvents().map((evt) => {
                const tag = tags.find((t) => t.id === evt.tagId);
                const isSelected = selectedEventLogs.has(evt.id);
                const isConfirming = logDeleteConfirmation === evt.id;
                return (
                  <div
                    key={evt.id}
                    className={`flex items-center gap-1.5 p-1.5 rounded border group cursor-pointer transition-colors ${
                      selectedEventLogs.has(evt.id) || selectedEventIds.has(evt.id)
                        ? 'bg-[#c6ff1f]/20 border-[#c6ff1f]/30'
                        : 'bg-[#161616] hover:bg-[#222] border-transparent hover:border-[#333]'
                    }`}
                    onClick={(e) => {
                      if (e.shiftKey && lastClickedSidebarEventIdRef.current) {
                        e.stopPropagation();
                        const events = getDisplayEvents();
                        const lastId = lastClickedSidebarEventIdRef.current;
                        const idx1 = events.findIndex(ev => ev.id === lastId);
                        const idx2 = events.findIndex(ev => ev.id === evt.id);
                        if (idx1 !== -1 && idx2 !== -1) {
                          const startIdx = Math.min(idx1, idx2);
                          const endIdx = Math.max(idx1, idx2);
                          const range = events.slice(startIdx, endIdx + 1);
                          const newSet = new Set(selectedEventLogs);
                          range.forEach(item => newSet.add(item.id));
                          setSelectedEventLogs(newSet);
                          setSelectedEventIds(new Set(newSet));
                          if (!isEventsEditMode) setIsEventsEditMode(true);
                          lastClickedSidebarEventIdRef.current = evt.id;
                          return;
                        }
                      }

                      if (isEventsEditMode || e.ctrlKey || e.metaKey) {
                        e.stopPropagation();
                        const newSet = new Set(selectedEventLogs);
                        if (newSet.has(evt.id)) newSet.delete(evt.id);
                        else newSet.add(evt.id);
                        setSelectedEventLogs(newSet);
                        setSelectedEventIds(new Set(newSet));
                        if (!isEventsEditMode) setIsEventsEditMode(true);
                        lastClickedSidebarEventIdRef.current = evt.id;
                      } else {
                        jumpToMarker(evt.startTime);
                        setSelectedEventIds(new Set([evt.id]));
                        setSelectedEventLogs(new Set([evt.id]));
                        setPlaybarEventId(evt.id);
                        lastClickedSidebarEventIdRef.current = evt.id;
                      }
                    }}
                    onContextMenu={(e) => handleEventContextMenu(e, evt.id)}
                  >
                    {isEventsEditMode && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          const newSet = new Set(selectedEventLogs);
                          if (e.target.checked) newSet.add(evt.id);
                          else newSet.delete(evt.id);
                          setSelectedEventLogs(newSet);
                        }}
                        className="w-2.5 h-2.5 shrink-0 rounded border-[#444] bg-[#222] cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <div
                      className="w-[3px] self-stretch min-h-[16px] rounded-full shrink-0"
                      style={{ backgroundColor: tag?.color }}
                    />

                    <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <span className="text-[10px] font-medium text-gray-300 truncate max-w-[80px] shrink-0">
                        {tag?.name}{' '}
                        {evt.labelIds && evt.labelIds.length > 0 && (
                          <span className="text-[#c6ff1f] font-normal">
                            {' '}
                            -{' '}
                            {evt.labelIds
                              .map((id) => labels.find((l) => l.id === id)?.name)
                              .filter(Boolean)
                              .join(', ')}
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-1 text-[9px] text-gray-500 font-mono shrink-0">
                        {evt.periodId && (
                          <span className="text-indigo-300 bg-indigo-500/15 border border-indigo-500/25 px-1 rounded text-[8px] font-bold">
                            {getCanonicalPeriod(evt.periodId)?.shortLabel || evt.periodId}
                          </span>
                        )}
                        <span>
                          {formatSyncClock(evt.startTime)} - {formatSyncClock(evt.endTime)}
                        </span>
                        <span className="text-gray-600 bg-[#222] px-1 rounded text-[8px]">
                          {(evt.endTime - evt.startTime).toFixed(1)}s
                        </span>
                      </div>
                      {evt.notes && evt.notes.trim().length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenEventNoteModal?.(evt.id);
                          }}
                          className="inline-flex items-center gap-0.5 text-[8.5px] text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 px-1 py-0.2 rounded transition-colors max-w-[110px]"
                          title={`Note: "${evt.notes}" (Click to edit)`}
                        >
                          <FileText className="w-2.5 h-2.5 shrink-0 text-amber-400" />
                          <span className="truncate italic">{evt.notes}</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-end shrink-0 ml-auto relative gap-1">
                      {!isEventsEditMode && onOpenEventNoteModal && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenEventNoteModal(evt.id);
                          }}
                          className={`${
                            evt.notes && evt.notes.trim().length > 0
                              ? 'opacity-85 group-hover:opacity-100 text-amber-300 hover:text-amber-200'
                              : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-amber-300'
                          } p-0.5 transition-opacity`}
                          title={evt.notes && evt.notes.trim().length > 0 ? 'Edit Event Note' : 'Add Event Note'}
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!isEventsEditMode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addEventsToPlaylist([evt.id], undefined, e.shiftKey);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-[#c6ff1f] p-0.5 transition-opacity"
                          title="Add to Playlist (Ctrl+S) • Hold Shift for duplicate"
                        >
                          <ListPlus className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {isConfirming ? (
                        <div className="flex items-center gap-1 bg-[#161616] px-1 rounded shadow-lg z-10 border border-[#333] absolute right-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onDeleteEvents) {
                                onDeleteEvents([evt.id]);
                              } else {
                                setTagEvents((prev) => prev.filter((x) => x.id !== evt.id));
                                const nextIds = new Set(selectedEventIds);
                                nextIds.delete(evt.id);
                                setSelectedEventIds(nextIds);
                                setSelectedEventLogs((prev) => {
                                  const next = new Set(prev);
                                  next.delete(evt.id);
                                  return next;
                                });
                                setPlaybarEventId(null);
                              }
                              setLogDeleteConfirmation(null);
                            }}
                            className="text-green-400 hover:text-green-300 p-0.5"
                            title="Confirm Delete"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setLogDeleteConfirmation(null);
                            }}
                            className="text-red-400 hover:text-red-300 p-0.5"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        !isEventsEditMode && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setLogDeleteConfirmation(evt.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 p-0.5 transition-opacity"
                            title="Delete"
                          >
                            <Trash className="w-3 h-3" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pinned Footer for Events Data CSV in Events Tab */}
            <div className="p-2 border-t border-[#222] bg-[#0c0c0e] flex items-center justify-between gap-1.5 shrink-0 select-none">
              <div className="flex items-center gap-1.5 min-w-0">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-[9.5px] font-bold text-gray-200 leading-tight">Events Data</span>
                  <span className="text-[8px] text-gray-500 font-mono leading-none">
                    {tagEvents.length} logged {tagEvents.length === 1 ? 'event' : 'events'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={importEventsFromCSV}
                  className="px-2 py-1 bg-[#1a1a22] hover:bg-[#262635] text-gray-300 hover:text-white rounded text-[9.5px] font-medium border border-[#2d2d38] transition-colors flex items-center gap-1 shadow-xs"
                  title="Import logged event timestamps and notes from CSV spreadsheet"
                >
                  <Upload className="w-3 h-3 text-gray-400" />
                  <span>Import CSV</span>
                </button>
                <button
                  onClick={exportEventsToCSV}
                  className="px-2 py-1 bg-[#16231c] hover:bg-[#1f3328] text-emerald-300 hover:text-emerald-200 rounded text-[9.5px] font-bold border border-emerald-800/40 transition-colors flex items-center gap-1 shadow-xs"
                  title="Export all logged events (timestamps, tags, labels, notes) to CSV spreadsheet"
                >
                  <Download className="w-3 h-3 text-emerald-400" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- NOTES TAB --- */}
        {activeSidebarTab === 'notes' && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#0a0a0a]">
            {/* Sub-tabs for Notes */}
            <div className="flex border-b border-[#222] shrink-0 p-1 bg-[#0e0e11] gap-1">
              <button
                onClick={() => setNotesSubTab('timeline')}
                className={`flex-1 py-1 text-[9.5px] font-bold uppercase tracking-wider rounded transition-all ${
                  notesSubTab === 'timeline'
                    ? 'bg-[#1e1e24] text-[#c6ff1f] shadow-xs'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
              >
                Timeline
              </button>
              <button
                onClick={() => setNotesSubTab('general')}
                className={`flex-1 py-1 text-[9.5px] font-bold uppercase tracking-wider rounded transition-all ${
                  notesSubTab === 'general'
                    ? 'bg-[#1e1e24] text-[#c6ff1f] shadow-xs'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
              >
                General
              </button>
            </div>

            {notesSubTab === 'timeline' ? (
              <>
                {/* Compact Toolbar Header */}
                <div className="px-2 py-1.5 border-b border-[#202025] bg-[#111115] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <StickyNote className="w-3.5 h-3.5 text-[#c6ff1f] shrink-0" />
                    <span className="text-[11px] font-bold text-gray-200 truncate">Timeline Notes</span>
                    <span className="text-[9px] font-mono text-gray-400 bg-white/5 px-1 py-0.2 rounded shrink-0">
                      {markers.length + eventNotesList.length}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      setMarkerModal({
                        isOpen: true,
                        x: 0,
                        y: 0,
                        mode: 'create',
                        time: currentTime,
                        tempLabel: '',
                        tempColor: '#3b82f6'
                      })
                    }
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1a1a22] hover:bg-[#252533] text-[#c6ff1f] hover:text-[#d4ff4d] border border-[#2e2e3f] text-[9.5px] font-semibold transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                    title={`Add Marker Note at Playhead (@${formatTime(currentTime)})`}
                  >
                    <Plus className="w-3 h-3 stroke-[2.5]" />
                    <span>Marker</span>
                  </button>
                </div>

                {/* Compact Filter Bar */}
                <div className="px-1.5 py-1 bg-[#0a0a0c] border-b border-[#1c1c20] flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setNotesTimelineFilter('all')}
                    className={`flex-1 py-0.5 px-1.5 rounded text-[9px] font-semibold transition-colors ${
                      notesTimelineFilter === 'all'
                        ? 'bg-[#22222a] text-white shadow-xs'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    All ({markers.length + eventNotesList.length})
                  </button>
                  <button
                    onClick={() => setNotesTimelineFilter('events')}
                    className={`flex-1 py-0.5 px-1.5 rounded text-[9px] font-semibold transition-colors ${
                      notesTimelineFilter === 'events'
                        ? 'bg-[#22222a] text-[#c6ff1f] shadow-xs'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Events ({eventNotesList.length})
                  </button>
                  <button
                    onClick={() => setNotesTimelineFilter('markers')}
                    className={`flex-1 py-0.5 px-1.5 rounded text-[9px] font-semibold transition-colors ${
                      notesTimelineFilter === 'markers'
                        ? 'bg-[#22222a] text-sky-400 shadow-xs'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Markers ({markers.length})
                  </button>
                </div>

                <div className="flex-1 p-1.5 overflow-y-auto custom-scrollbar space-y-1.5">
                  {/* Event Notes Section */}
                  {(notesTimelineFilter === 'all' || notesTimelineFilter === 'events') &&
                    eventNotesList
                      .sort((a, b) => a.time - b.time)
                      .map((item) => (
                        <div
                          key={`event-note-${item.id}`}
                          className="group relative bg-[#10131b] hover:bg-[#131822] border border-[#1e2638] hover:border-[#2f3b54] rounded-md p-1.5 transition-all shadow-xs border-l-[3px]"
                          style={{ borderLeftColor: item.tagColor }}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1 min-w-0">
                            {/* Event name & color dot */}
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span
                                className="w-2 h-2 rounded-full shrink-0 shadow-xs ring-1 ring-white/10"
                                style={{ backgroundColor: item.tagColor }}
                              />
                              <span
                                className="text-[11px] font-semibold text-gray-100 truncate hover:text-white"
                                title={`${item.tagName}${item.labels && item.labels.length > 0 ? ` • ${item.labels.join(', ')}` : ''}`}
                              >
                                {item.tagName}
                                {item.labels && item.labels.length > 0 && (
                                  <span className="text-[9px] font-normal text-[#c6ff1f]/85 ml-1 font-mono">
                                    • {item.labels.join(', ')}
                                  </span>
                                )}
                              </span>
                            </div>

                            {/* Jump timestamp, duration & actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => jumpToMarker(item.time)}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold text-[#c6ff1f] bg-[#c6ff1f]/10 hover:bg-[#c6ff1f]/20 border border-[#c6ff1f]/30 transition-all cursor-pointer"
                                title={`Jump to @${formatTime(item.time)}`}
                              >
                                @{formatTime(item.time)}
                              </button>
                              <span className="text-[8.5px] text-gray-400 font-mono bg-white/[0.04] px-1 py-0.5 rounded">
                                {(item.endTime - item.time).toFixed(1)}s
                              </span>

                              <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity ml-0.5">
                                <button
                                  onClick={() => {
                                    if (onOpenEventNoteModal) {
                                      onOpenEventNoteModal(item.id);
                                    } else {
                                      setEditingEventNoteId(item.id);
                                      setEditingEventNoteText(item.note);
                                    }
                                  }}
                                  className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                                  title="Edit Note"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (onSaveEventNote) {
                                      onSaveEventNote(item.id, '');
                                    } else {
                                      setTagEvents((prev) =>
                                        prev.map((e) => (e.id === item.id ? { ...e, notes: '' } : e))
                                      );
                                      showNotification('Event note removed', '#ef4444');
                                    }
                                  }}
                                  className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-900/30 rounded transition-colors"
                                  title="Clear Note"
                                >
                                  <Trash className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Note text box */}
                          {editingEventNoteId === item.id ? (
                            <div className="space-y-1.5 mt-1">
                              <textarea
                                value={editingEventNoteText}
                                onChange={(e) => setEditingEventNoteText(e.target.value)}
                                className="w-full bg-[#080a0f] border border-[#2d384e] focus:border-[#c6ff1f] rounded p-1.5 text-[11px] text-white focus:outline-none resize-none leading-snug custom-scrollbar placeholder-gray-500"
                                rows={2}
                                autoFocus
                                placeholder="Add note..."
                              />
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setEditingEventNoteId(null)}
                                  className="px-2 py-0.5 text-[10px] text-gray-400 hover:text-white rounded hover:bg-white/5 transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => {
                                    if (onSaveEventNote) {
                                      onSaveEventNote(item.id, editingEventNoteText.trim());
                                      setEditingEventNoteId(null);
                                    } else {
                                      setTagEvents((prev) =>
                                        prev.map((e) =>
                                          e.id === item.id
                                            ? { ...e, notes: editingEventNoteText.trim() }
                                            : e
                                        )
                                      );
                                      setEditingEventNoteId(null);
                                      showNotification('Event note updated', '#c6ff1f');
                                    }
                                  }}
                                  className="px-2.5 py-0.5 text-[10px] font-semibold bg-[#c6ff1f] hover:bg-[#d6ff4d] text-black rounded transition-colors"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-1 px-2 py-1.5 rounded bg-[#090b10]/90 border border-white/[0.04] text-[11px] text-gray-200 leading-snug whitespace-pre-wrap break-words select-text font-normal shadow-inner">
                              {item.note}
                            </div>
                          )}
                        </div>
                      ))}

                  {/* Timeline Markers Section */}
                  {(notesTimelineFilter === 'all' || notesTimelineFilter === 'markers') &&
                    [...markers]
                      .sort((a, b) => a.time - b.time)
                      .map((note) => (
                        <div
                          key={note.id}
                          className="group relative bg-[#121216] hover:bg-[#16161c] border border-[#22222a] hover:border-[#32323e] rounded-md p-1.5 transition-all shadow-xs border-l-[3px]"
                          style={{ borderLeftColor: note.color }}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1 min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span
                                className="w-2 h-2 rounded-full shrink-0 shadow-xs ring-1 ring-white/10"
                                style={{ backgroundColor: note.color }}
                              />
                              <span className="text-[11px] font-semibold text-gray-200 truncate">
                                Marker Note
                              </span>
                              <span className="text-[8.5px] uppercase tracking-wider font-mono px-1 py-0.2 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 shrink-0">
                                Marker
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => jumpToMarker(note.time)}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold text-[#c6ff1f] bg-[#c6ff1f]/10 hover:bg-[#c6ff1f]/20 border border-[#c6ff1f]/30 transition-all cursor-pointer"
                                title={`Jump to @${formatTime(note.time)}`}
                              >
                                @{formatTime(note.time)}
                              </button>

                              <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity ml-0.5">
                                <button
                                  onClick={() =>
                                    setMarkerModal({
                                      isOpen: true,
                                      x: 0,
                                      y: 0,
                                      mode: 'edit',
                                      markerId: note.id,
                                      tempLabel: note.label,
                                      tempColor: note.color
                                    })
                                  }
                                  className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                                  title="Edit Note"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => {
                                    setMarkers((prev) => prev.filter((m) => m.id !== note.id));
                                  }}
                                  className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-900/30 rounded transition-colors"
                                  title="Delete Note"
                                >
                                  <Trash className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="mt-1 px-2 py-1.5 rounded bg-[#0b0b0e]/90 border border-white/[0.04] text-[11px] text-gray-200 leading-snug whitespace-pre-wrap break-words select-text font-normal shadow-inner">
                            {note.label}
                          </div>
                        </div>
                      ))}

                  {/* Empty state */}
                  {((notesTimelineFilter === 'all' && markers.length === 0 && eventNotesList.length === 0) ||
                    (notesTimelineFilter === 'events' && eventNotesList.length === 0) ||
                    (notesTimelineFilter === 'markers' && markers.length === 0)) && (
                    <div className="text-center py-6 px-3">
                      <MapPin className="w-6 h-6 text-gray-600 mx-auto mb-1.5" />
                      <p className="text-xs font-semibold text-gray-400">
                        {notesTimelineFilter === 'events'
                          ? 'No event notes yet'
                          : notesTimelineFilter === 'markers'
                          ? 'No marker notes yet'
                          : 'No notes yet'}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5 max-w-[200px] mx-auto leading-normal">
                        {notesTimelineFilter === 'events'
                          ? 'Right-click any event on the timeline to add a note.'
                          : 'Click + Marker above or right-click events on timeline to add notes.'}
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col p-2 min-h-0 bg-[#0a0a0a]">
                <div className="mb-1.5 flex items-center justify-between shrink-0">
                  <span className="text-[10.5px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#c6ff1f]" /> Project Notes
                  </span>
                  <span className="text-[9px] text-gray-500 font-mono">
                    {projectNotes ? projectNotes.length : 0} chars
                  </span>
                </div>
                <textarea
                  value={projectNotes}
                  onChange={(e) => setProjectNotes(e.target.value)}
                  placeholder="Write general thoughts, match context, tactical to-dos..."
                  className="flex-1 w-full bg-[#0d0d10] border border-[#222] rounded-md text-gray-200 text-xs p-2.5 outline-none resize-none custom-scrollbar placeholder-gray-600 focus:border-[#c6ff1f]/50 transition-colors shadow-inner leading-relaxed"
                />
              </div>
            )}
          </div>
        )}

        {/* --- PLAYLIST TAB --- */}
        {activeSidebarTab === 'playlist' && (
          <div className="flex flex-col h-full min-h-0 overflow-hidden">
            {/* Playlists Header */}
            <div className="px-2 py-1.5 border-b border-[#222] flex items-center justify-between shrink-0 bg-[#0d0e12]">
              <button
                type="button"
                onClick={() => setIsPlaylistsDrawerCollapsed((prev) => !prev)}
                className="flex items-center gap-1.5 text-left group cursor-pointer"
                title={
                  isPlaylistsDrawerCollapsed
                    ? 'Expand playlists folder list'
                    : 'Collapse playlists folder list to give more room for clips'
                }
              >
                <ListPlus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-[11px] font-bold text-white">Playlists</span>
                <span className="text-[9.5px] font-mono tabular-nums text-gray-400">
                  ({playlists.length})
                </span>
                <ChevronDown
                  className={`w-3 h-3 text-gray-500 group-hover:text-gray-300 transition-transform duration-200 ${
                    isPlaylistsDrawerCollapsed ? '-rotate-90' : 'rotate-0'
                  }`}
                />
              </button>
              <div className="flex items-center gap-1.5">
                {onEnterPresentationMode && (
                  <button
                    onClick={onEnterPresentationMode}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#c6ff1f]/10 hover:bg-[#c6ff1f]/20 text-[#c6ff1f] border border-[#c6ff1f]/30 text-[10px] font-bold transition-all shadow-sm active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
                    title="Present Playlists in Full Screen"
                  >
                    <Maximize className="w-3 h-3" />
                    <span>Present</span>
                  </button>
                )}
                <button
                  onClick={() => setPlaylistModal({ isOpen: true, mode: 'create', tempName: '' })}
                  className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-white/10 cursor-pointer"
                  title="New Playlist"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              {/* Collapsible Playlists Folder Grid */}
              {!isPlaylistsDrawerCollapsed && playlists.length > 0 && (
                <div
                  className="p-1.5 grid gap-1 shrink-0 max-h-[132px] overflow-y-auto custom-scrollbar border-b border-[#222] bg-[#0e0f13]"
                  style={{
                    gridTemplateColumns: 'repeat(auto-fill, minmax(105px, 1fr))'
                  }}
                >
                  {playlists.map((pl) => {
                    const isActive = activePlaylistId === pl.id;
                    return (
                      <div key={pl.id} className="group relative min-w-0">
                        <button
                          onClick={() => setActivePlaylistId(pl.id)}
                          title={`${pl.name} (${pl.events.length} ${pl.events.length === 1 ? 'clip' : 'clips'})`}
                          className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded border text-[10px] transition-all cursor-pointer min-w-0 ${
                            isActive
                              ? 'bg-[#1b2113] text-white border-[#c6ff1f]/55 shadow-xs'
                              : 'bg-[#14151a] text-gray-400 border-[#24262f] hover:text-gray-200 hover:bg-[#1b1d24] hover:border-[#343744]'
                          }`}
                        >
                          <Folder
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isActive ? 'text-[#c6ff1f] fill-[#c6ff1f]/20' : 'text-gray-500 group-hover:text-gray-300'
                            }`}
                          />
                          <span className="flex-1 text-left truncate font-medium leading-tight">{pl.name}</span>
                          <span
                            className={`text-[9px] font-mono tabular-nums shrink-0 transition-opacity group-hover:opacity-0 ${
                              isActive ? 'text-[#c6ff1f]' : 'text-gray-500'
                            }`}
                          >
                            {pl.events.length}
                          </span>
                        </button>
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1c1c1e]/95 border border-[#333] rounded p-0.5 shadow-md z-10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPlaylistModal({
                                isOpen: true,
                                mode: 'edit',
                                playlistId: pl.id,
                                tempName: pl.name
                              });
                            }}
                            className="p-0.5 hover:bg-[#333] rounded text-gray-400 hover:text-white cursor-pointer"
                            title="Rename Playlist"
                          >
                            <Pencil className="w-2.5 h-2.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPlaylistDeleteId(pl.id);
                            }}
                            className="p-0.5 hover:bg-red-900/30 rounded text-gray-400 hover:text-red-400 cursor-pointer"
                            title="Delete Playlist"
                          >
                            <Trash className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Active Playlist Controls Bar */}
              {(() => {
                const activePlaylist = playlists.find((p) => p.id === activePlaylistId);
                const hasPlaylistClips = Boolean(activePlaylist && activePlaylist.events.length > 0);
                const isAutoplayingActive = autoplay.active && autoplay.playlistId === activePlaylistId;
                const showPlayLabel = sidebarWidth >= 275;

                return (
                  <div className="px-2 py-1.5 bg-[#131419] shrink-0 flex items-center justify-between gap-1.5 border-b border-[#222]">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <Folder className="w-3 h-3 text-[#c6ff1f] shrink-0" />
                      {isPlaylistsDrawerCollapsed && playlists.length > 1 ? (
                        <select
                          value={activePlaylistId}
                          onChange={(e) => setActivePlaylistId(e.target.value)}
                          className="bg-[#1b1d24] border border-[#2d303b] rounded px-1.5 py-0.5 text-[10px] font-bold text-gray-200 outline-none focus:border-[#c6ff1f]/60 max-w-full truncate cursor-pointer"
                          title="Switch active playlist"
                        >
                          {playlists.map((pl) => (
                            <option key={pl.id} value={pl.id}>
                              {pl.name} ({pl.events.length})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className="text-[10.5px] font-bold text-gray-200 truncate"
                          title={activePlaylist?.name || 'No Playlist'}
                        >
                          {activePlaylist?.name || 'No Playlist'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Open Playlist Clip in Tracking Studio */}
                      {onOpenTracking && (
                        <button
                          type="button"
                          onClick={() => onOpenTracking(playlistPlaybarIndex >= 0 ? playlistPlaybarIndex : 0)}
                          disabled={!hasPlaylistClips}
                          className="h-6 flex items-center justify-center gap-1 px-1.5 bg-[#1b1d24] hover:bg-[#252833] text-[#c6ff1f] border border-[#c6ff1f]/40 hover:border-[#c6ff1f] rounded-md text-[9.5px] font-bold disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                          title="Open Clip in Tracking Studio"
                        >
                          <Crosshair className="w-3 h-3 shrink-0" />
                          {showPlayLabel && <span>Track</span>}
                        </button>
                      )}

                      {/* Compact size-limited Playbar & Trimmer toggle */}
                      <button
                        type="button"
                        onClick={() => {
                          const newShow = !showPlaylistPlaybar;
                          setShowPlaylistPlaybar(newShow);
                          if (newShow && activePlaylist && activePlaylist.events.length > 0) {
                            handlePlaylistClipSelect(0, undefined, false);
                          }
                        }}
                        disabled={!hasPlaylistClips}
                        aria-label="Toggle Playlist Playbar"
                        className={`w-6 h-6 max-w-[24px] flex items-center justify-center rounded-md border transition-colors disabled:opacity-40 disabled:pointer-events-none shrink-0 cursor-pointer ${
                          showPlaylistPlaybar
                            ? 'bg-[#c6ff1f]/15 text-[#c6ff1f] border-[#c6ff1f]/45'
                            : 'bg-[#1b1d24] hover:bg-[#252833] text-gray-400 hover:text-gray-200 border-[#2b2e3a]'
                        }`}
                        title={
                          showPlaylistPlaybar
                            ? 'Hide Playlist Playbar & Trimmer'
                            : 'Open Playlist Playbar & Trimmer'
                        }
                      >
                        <Scissors className="w-3 h-3 shrink-0" />
                      </button>

                      {/* Secondary Play / Stop Reel Control */}
                      {isAutoplayingActive ? (
                        <button
                          type="button"
                          onClick={() => setAutoplay({ active: false, playlistId: null, eventIndex: -1 })}
                          className={`h-6 flex items-center justify-center gap-1 ${
                            showPlayLabel ? 'px-1.5' : 'w-6'
                          } bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/35 rounded-md text-[9.5px] font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors`}
                          title="Stop Playlist Playback"
                        >
                          <StopCircle className="w-3 h-3 shrink-0" />
                          {showPlayLabel && <span>Stop</span>}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startPlaylistAutoplay(activePlaylistId)}
                          disabled={!hasPlaylistClips}
                          className={`h-6 flex items-center justify-center gap-1 ${
                            showPlayLabel ? 'px-1.5' : 'w-6'
                          } bg-[#1b1d24] hover:bg-[#252833] text-gray-200 hover:text-white border border-[#2d313e] rounded-md text-[9.5px] font-bold disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap shrink-0 cursor-pointer transition-colors`}
                          title="Play Playlist Reel"
                        >
                          <PlayCircle className="w-3 h-3 text-[#c6ff1f] shrink-0" />
                          {showPlayLabel && <span>Play</span>}
                        </button>
                      )}

                      {/* Primary Privileged Export CTA + Options Menu */}
                      <div
                        ref={exportMenuRef}
                        className="relative group/export flex items-center shrink-0"
                      >
                        <div
                          className={`h-6 flex items-stretch rounded-md overflow-hidden border transition-all ${
                            hasPlaylistClips
                              ? 'bg-[#c6ff1f] border-[#c6ff1f] text-black shadow-[0_0_12px_rgba(198,255,31,0.22)] hover:shadow-[0_0_16px_rgba(198,255,31,0.35)]'
                              : 'bg-[#1e2028] border-[#2e313d] text-gray-500 opacity-50 pointer-events-none'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setIsExportMenuOpen(false);
                              exportPlaylistVideo(activePlaylistId, true);
                            }}
                            disabled={!hasPlaylistClips}
                            className="flex items-center gap-1 pl-2 pr-1.5 text-[10px] font-extrabold tracking-tight hover:bg-[#d5ff4d] active:bg-[#b5eb15] transition-colors whitespace-nowrap cursor-pointer"
                            title="Export Playlist Video (MP4 / Turbo Mode)"
                          >
                            <Download className="w-3 h-3 stroke-[2.5] shrink-0" />
                            <span>Export</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hasPlaylistClips) {
                                setIsExportMenuOpen((prev) => !prev);
                              }
                            }}
                            disabled={!hasPlaylistClips}
                            aria-label="Export options"
                            className="flex items-center justify-center px-1 border-l border-black/15 hover:bg-black/10 transition-colors cursor-pointer"
                            title="Choose Freeze Frame export mode"
                          >
                            <ChevronDown
                              className={`w-2.5 h-2.5 stroke-[2.5] transition-transform duration-150 ${
                                isExportMenuOpen ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                        </div>

                        {hasPlaylistClips && (
                          <div
                            className={`absolute top-full right-0 pt-1 z-50 transition-all duration-150 ${
                              isExportMenuOpen
                                ? 'opacity-100 visible translate-y-0'
                                : 'opacity-0 invisible -translate-y-0.5 group-hover/export:opacity-100 group-hover/export:visible group-hover/export:translate-y-0'
                            }`}
                          >
                            <div className="min-w-[152px] bg-[#181a21] border border-[#323644] rounded-lg shadow-[0_12px_28px_rgba(0,0,0,0.75)] flex flex-col overflow-hidden py-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsExportMenuOpen(false);
                                  exportPlaylistVideo(activePlaylistId, true);
                                }}
                                className="px-2.5 py-1.5 text-[10px] font-semibold text-left text-gray-200 hover:bg-[#242834] hover:text-[#c6ff1f] border-b border-[#262935] flex items-center justify-between gap-2 cursor-pointer transition-colors"
                              >
                                <span>With Freeze Frames</span>
                                <span className="text-[8.5px] font-mono text-[#c6ff1f]/80 uppercase">Default</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsExportMenuOpen(false);
                                  exportPlaylistVideo(activePlaylistId, false);
                                }}
                                className="px-2.5 py-1.5 text-[10px] font-medium text-left text-gray-300 hover:bg-[#242834] hover:text-white flex items-center justify-between gap-2 cursor-pointer transition-colors"
                              >
                                <span>Video Only (No Freeze)</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Animated Sortable Playlist Clips Viewport */}
              <PlaylistClipsList
                playlist={playlists.find((p) => p.id === activePlaylistId)}
                allBatchTagEvents={allBatchTagEvents}
                allBatchTags={allBatchTags}
                allBatchLabels={allBatchLabels}
                allBatchProjects={batchMode?.allBatchProjects}
                freezeFrames={freezeFrames}
                playlistPlaybarIndex={playlistPlaybarIndex}
                showPlaylistPlaybar={showPlaylistPlaybar}
                autoplay={autoplay}
                setDraggingEventIndex={setDraggingEventIndex}
                onSelectClip={(index, startTime) => {
                  setShowPlaylistPlaybar(true);
                  handlePlaylistClipSelect(index, startTime, false);
                }}
                onOpenInTrimmer={(index) => {
                  setShowPlaylistPlaybar(true);
                  const clipItem = playlists.find((p) => p.id === activePlaylistId)?.events[index];
                  const { event: evt } = findEventAcrossBatch(getClipEventId(clipItem), clipItem);
                  const timing = resolveClipTiming(clipItem, evt);
                  handlePlaylistClipSelect(index, timing.startTime, false);
                }}
                onOpenTracking={(index) => {
                  onOpenTracking?.(index);
                }}
                onOpenNoteModal={(evtId, projId) => {
                  onOpenEventNoteModal?.(evtId, projId);
                }}
                onPlayClip={(startTime, index) => {
                  setShowPlaylistPlaybar(true);
                  handlePlaylistClipSelect(index, startTime, true);
                }}
                onDuplicateClip={(index, options) => duplicatePlaylistEvent(activePlaylistId, index, options)}
                onRemoveClip={(index) => removeEventFromPlaylist(activePlaylistId, index)}
                onReorderClips={(fromIndex, toIndex) =>
                  reorderPlaylistEvents(activePlaylistId, fromIndex, toIndex)
                }
              />

              {/* Pinned Bottom Add Selected CTA */}
              <div className="p-1.5 border-t border-[#222] flex gap-1 shrink-0 bg-[#111216]">
                <button
                  id="save-playlist-btn"
                  onClick={(e) => addSelectedToPlaylist(undefined, e.shiftKey)}
                  className={`flex-1 text-[10px] font-bold py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-all border cursor-pointer ${
                    selectedEventIds.size > 0 || selectedEventLogs.size > 0
                      ? 'bg-[#c6ff1f] text-black border-[#c6ff1f] hover:bg-[#a0d600] shadow-[0_0_10px_rgba(198,255,31,0.25)]'
                      : 'bg-[#1c1e26] hover:bg-[#262934] text-gray-300 border-[#2d303d]'
                  }`}
                  title="Add selected events to active playlist (Ctrl+S) • Hold Shift for duplicates"
                >
                  <ListPlus className="w-3.5 h-3.5" />
                  <span>
                    {selectedEventIds.size > 0 || selectedEventLogs.size > 0
                      ? `Add Selected (${Math.max(selectedEventIds.size, selectedEventLogs.size)})`
                      : 'Add Selected (Ctrl+S)'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
