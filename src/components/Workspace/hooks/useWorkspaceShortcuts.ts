import { useEffect, useRef } from 'react';
import type React from 'react';
import type {
  ActiveRecording,
  ColorPreset,
  FreezeFrame,
  PlayerTagSettings,
  Playlist,
  PlaylistItem,
  Shape,
  Tag as TagData,
  TagEvent,
  ToolType,
} from '../../../types';
import type { TelestrationColors, TelestrationSlot } from '../TelestrationColorPresets';
import type {
  AutoplayState,
  ContextMenuState,
  DeletedFreezeFrameRecord,
  EditEventModalState,
  LensSettings,
  RingSettings,
  SpotlightSettings,
  TextSettings,
} from '../Workspace.types';
import type { PolygonSettings } from '../Polygon/types';

export function useWorkspaceShortcuts(params: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  shapes: Shape[];
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
  redoStack: Shape[][];
  tool: ToolType;
  setTool: React.Dispatch<React.SetStateAction<ToolType>>;
  setToolSize: React.Dispatch<React.SetStateAction<number>>;
  colors: ColorPreset[];
  setActiveColorId: React.Dispatch<React.SetStateAction<number>>;
  selectedShapeId: string | null;
  setSelectedShapeId: React.Dispatch<React.SetStateAction<string | null>>;
  playerMoveState: string;
  resetPlayerMove: () => void;
  setIsDrawing: React.Dispatch<React.SetStateAction<boolean>>;
  setSpotlightSettings: React.Dispatch<React.SetStateAction<SpotlightSettings>>;
  setLensSettings: React.Dispatch<React.SetStateAction<LensSettings>>;
  setRingSettings: React.Dispatch<React.SetStateAction<RingSettings>>;
  setNameTagSettings: React.Dispatch<React.SetStateAction<PlayerTagSettings>>;
  setTextSettings: React.Dispatch<React.SetStateAction<TextSettings>>;
  setPolygonSettings?: React.Dispatch<React.SetStateAction<PolygonSettings>>;
  undo: () => void;
  redo: () => void;
  clearAll: () => void;
  isDrawingTool: (t: ToolType | null) => boolean;
  activeTelestrationSlot: TelestrationSlot | null;
  telestrationColors: TelestrationColors;
  handleSelectTelestrationSlot: (slot: TelestrationSlot) => void;
  handleCycleTelestrationSlot: () => void;
  freezeFrames: FreezeFrame[];
  activeFreezeFrameId: string | null;
  editingAnimationFFId: string | null;
  isAnimationPreviewPlaying: boolean;
  setIsAnimationPreviewPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  animationPreviewTime: number;
  setAnimationPreviewTime: React.Dispatch<React.SetStateAction<number>>;
  addFreezeFrame: (clipHint?: PlaylistItem) => void;
  seekFreezeFrameRelative: (delta: number) => void;
  skipFreezeFrame: () => void;
  deletedFFStackRef: React.MutableRefObject<DeletedFreezeFrameRecord[]>;
  undoDeleteFreezeFrameRef: React.MutableRefObject<() => void>;
  togglePlay: () => void;
  handleManualSeek: (time: number, options?: { pause?: boolean }) => void;
  isTaggingMode: boolean;
  setIsTaggingMode: React.Dispatch<React.SetStateAction<boolean>>;
  isAdvancedCodingMode: boolean;
  isPadQuickTagEnabled: boolean;
  tags: TagData[];
  tagEvents: TagEvent[];
  activeRecording: ActiveRecording | null;
  activeRecordings: ActiveRecording[];
  filterTagId: string | null;
  filterLabelId: string | null;
  selectedEventIds: Set<string>;
  setSelectedEventIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedEventLogs: Set<string>;
  setSelectedEventLogs: React.Dispatch<React.SetStateAction<Set<string>>>;
  playbarEventId: string | null;
  setPlaybarEventId: React.Dispatch<React.SetStateAction<string | null>>;
  setIsMultiSelectAction: React.Dispatch<React.SetStateAction<boolean>>;
  contextMenu: ContextMenuState | null;
  editEventModal: EditEventModalState | null;
  handleTagClick: (tagId: string, options?: { ignoreLeadLag?: boolean }) => void;
  cancelRecording: () => void;
  deleteEventsByIds: (ids: string[]) => void;
  playlists: Playlist[];
  activePlaylistId: string;
  showPlaylistPlaybar?: boolean;
  playlistPlaybarIndex?: number;
  autoplay: AutoplayState;
  addEventsToPlaylist: (ids: string[], targetPlaylistId?: string, forceAllowDuplicates?: boolean) => void;
  addSelectedToPlaylist: (targetPlaylistId?: string, forceAllowDuplicates?: boolean) => void;
  showNotification: (
    message: string,
    color: string,
    onUndo?: () => void,
    action?: { label: string; onClick: () => void }
  ) => void;
  disabled?: boolean;
}) {
  const {
    videoRef,
    isPlaying,
    duration,
    currentTime,
    shapes,
    setShapes,
    redoStack,
    tool,
    setTool,
    setToolSize,
    colors,
    setActiveColorId,
    selectedShapeId,
    setSelectedShapeId,
    playerMoveState,
    resetPlayerMove,
    setIsDrawing,
    setSpotlightSettings,
    setLensSettings,
    setRingSettings,
    setNameTagSettings,
    setTextSettings,
    setPolygonSettings,
    undo,
    redo,
    clearAll,
    isDrawingTool,
    activeTelestrationSlot,
    telestrationColors,
    handleSelectTelestrationSlot,
    handleCycleTelestrationSlot,
    freezeFrames,
    activeFreezeFrameId,
    editingAnimationFFId,
    isAnimationPreviewPlaying,
    setIsAnimationPreviewPlaying,
    animationPreviewTime,
    setAnimationPreviewTime,
    addFreezeFrame,
    seekFreezeFrameRelative,
    skipFreezeFrame,
    deletedFFStackRef,
    undoDeleteFreezeFrameRef,
    togglePlay,
    handleManualSeek,
    isTaggingMode,
    setIsTaggingMode,
    isAdvancedCodingMode,
    isPadQuickTagEnabled,
    tags,
    tagEvents,
    activeRecording,
    activeRecordings,
    filterTagId,
    filterLabelId,
    selectedEventIds,
    setSelectedEventIds,
    selectedEventLogs,
    setSelectedEventLogs,
    playbarEventId,
    setPlaybarEventId,
    setIsMultiSelectAction,
    contextMenu,
    editEventModal,
    handleTagClick,
    cancelRecording,
    deleteEventsByIds,
    playlists,
    activePlaylistId,
    showPlaylistPlaybar,
    playlistPlaybarIndex,
    autoplay,
    addEventsToPlaylist,
    addSelectedToPlaylist,
    showNotification,
    disabled = false,
  } = params;

  const togglePlayRef = useRef(togglePlay);
  togglePlayRef.current = togglePlay;

  const seekFreezeFrameRelativeRef = useRef(seekFreezeFrameRelative);
  seekFreezeFrameRelativeRef.current = seekFreezeFrameRelative;

  const skipFreezeFrameRef = useRef(skipFreezeFrame);
  skipFreezeFrameRef.current = skipFreezeFrame;

  const addFreezeFrameRef = useRef(addFreezeFrame);
  addFreezeFrameRef.current = addFreezeFrame;

  useEffect(() => {
    if (disabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      )
        return;
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      // Priority 1: Ctrl+S / Cmd+S - Add selected events to playlist (Shift+Ctrl+S forces duplicates)
      if (isCtrlOrMeta && (e.code === 'KeyS' || e.key.toLowerCase() === 's')) {
        e.preventDefault();
        e.stopPropagation();
        addSelectedToPlaylist(undefined, e.shiftKey);
        return;
      }

      // Priority 2: Ctrl+A / Cmd+A - Select all visible events
      if (isCtrlOrMeta && (e.code === 'KeyA' || e.key.toLowerCase() === 'a') && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        const visibleEvents = tagEvents.filter((evt) => {
          let match = true;
          if (filterTagId && evt.tagId !== filterTagId) match = false;
          if (filterLabelId && (!evt.labelIds || !evt.labelIds.includes(filterLabelId))) match = false;
          return match;
        });
        const allIds = new Set(visibleEvents.map((evt) => evt.id));
        setSelectedEventIds(allIds);
        setSelectedEventLogs(allIds);
        setIsMultiSelectAction(true);
        showNotification(
          `Selected ${visibleEvents.length} event${visibleEvents.length !== 1 ? 's' : ''} (Press Ctrl+S to add to playlist)`,
          '#c6ff1f'
        );
        return;
      }

      // Shortcut key to add freeze frame: Shift+F
      if ((e.code === 'KeyF' || e.key.toLowerCase() === 'f') && e.shiftKey && !isCtrlOrMeta && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        let clipHint: PlaylistItem | undefined = undefined;
        if (showPlaylistPlaybar && activePlaylistId && playlistPlaybarIndex !== undefined && playlistPlaybarIndex >= 0) {
          const activePl = playlists.find((p) => p.id === activePlaylistId);
          clipHint = activePl?.events[playlistPlaybarIndex];
        }
        addFreezeFrameRef.current(clipHint);
        return;
      }

      // Telestration Quick 3-Color Preset Shortcut: Shift+C
      if (!isCtrlOrMeta && !e.altKey && e.shiftKey && (e.code === 'KeyC' || e.key.toLowerCase() === 'c')) {
        e.preventDefault();
        e.stopPropagation();
        handleCycleTelestrationSlot();
        return;
      }

      // Single-letter Tag shortcuts
      if (!isCtrlOrMeta && !e.altKey) {
        const tag = tags.find((t) => t.shortcut && t.shortcut.toLowerCase() === e.key.toLowerCase());
        if (tag) {
          e.preventDefault();
          const ignoreLeadLag = isAdvancedCodingMode && !isPadQuickTagEnabled;
          if (isTaggingMode) {
            handleTagClick(tag.id, { ignoreLeadLag });
          } else {
            setIsTaggingMode(true);
            setTool(null);
            setSelectedEventIds(new Set());
            handleTagClick(tag.id, { ignoreLeadLag });
          }
          return;
        }
      }

      if (e.key === 'Escape') {
        if (playerMoveState !== 'idle') {
          resetPlayerMove();
          setIsDrawing(false);
          return;
        }
        if (isTaggingMode) {
          cancelRecording();
          setIsTaggingMode(false);
          return;
        }
        if (selectedEventIds.size > 0 || selectedEventLogs.size > 0 || playbarEventId) {
          setSelectedEventIds(new Set());
          setSelectedEventLogs(new Set());
          setPlaybarEventId(null);
          setIsMultiSelectAction(false);
          return;
        }
      }
      switch (e.code) {
        case 'KeyQ':
          if (e.shiftKey) {
            e.preventDefault();
            setActiveColorId((prevId) => {
              const currentIndex = colors.findIndex((c) => c.id === prevId);
              if (currentIndex === -1) return prevId;
              const newIndex = currentIndex === 0 ? colors.length - 1 : currentIndex - 1;
              return colors[newIndex].id;
            });
          }
          break;
        case 'KeyW':
          if (e.shiftKey) {
            e.preventDefault();
            setActiveColorId((prevId) => {
              const currentIndex = colors.findIndex((c) => c.id === prevId);
              if (currentIndex === -1) return prevId;
              const newIndex = currentIndex === colors.length - 1 ? 0 : currentIndex + 1;
              return colors[newIndex].id;
            });
          }
          break;
        case 'Space':
          e.preventDefault();
          e.stopPropagation();
          if (editingAnimationFFId) {
            if (videoRef.current && !videoRef.current.paused) {
              videoRef.current.pause();
            }
            const ff = freezeFrames.find((f) => f.id === editingAnimationFFId);
            if (ff) {
              if (!isAnimationPreviewPlaying && animationPreviewTime >= (ff.duration || 10)) {
                setAnimationPreviewTime(0);
              }
              setIsAnimationPreviewPlaying((prev) => !prev);
            }
          } else {
            togglePlayRef.current();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          e.stopPropagation();
          if (editingAnimationFFId) {
            setAnimationPreviewTime((prev) => Math.max(0, prev - 0.5));
          } else if (activeFreezeFrameId) {
            seekFreezeFrameRelativeRef.current(e.shiftKey ? -2.0 : -0.5);
          } else if (videoRef.current) {
            handleManualSeek(Math.max(0, videoRef.current.currentTime - 5));
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          e.stopPropagation();
          if (editingAnimationFFId) {
            const ff = freezeFrames.find((f) => f.id === editingAnimationFFId);
            if (ff) {
              setAnimationPreviewTime((prev) => Math.min(ff.duration || 10, prev + 0.5));
            }
          } else if (activeFreezeFrameId) {
            seekFreezeFrameRelativeRef.current(e.shiftKey ? 2.0 : 0.5);
          } else if (videoRef.current) {
            handleManualSeek(Math.min(duration, videoRef.current.currentTime + 5));
          }
          break;
        case 'Escape':
          if (activeFreezeFrameId) {
            e.preventDefault();
            e.stopPropagation();
            skipFreezeFrameRef.current();
          }
          break;
        case 'KeyZ':
          if (isCtrlOrMeta) {
            e.preventDefault();
            if (e.shiftKey) {
              redo();
            } else if (deletedFFStackRef.current.length > 0) {
              undoDeleteFreezeFrameRef.current();
            } else {
              undo();
            }
          }
          break;
        case 'KeyY':
          if (isCtrlOrMeta) {
            e.preventDefault();
            redo();
          }
          break;
        case 'Delete':
        case 'Backspace':
          if (selectedShapeId) {
            e.preventDefault();
            setShapes((prev) => prev.filter((s) => s.id !== selectedShapeId));
            setSelectedShapeId(null);
            return;
          }
          e.preventDefault();
          if (selectedEventIds.size > 0) {
            deleteEventsByIds(Array.from(selectedEventIds));
          } else {
            clearAll();
          }
          break;
        case 'KeyA':
          if (e.shiftKey && !isCtrlOrMeta) {
            e.preventDefault();
            if (tool === 'spotlight') {
              setSpotlightSettings((prev) => ({ ...prev, size: Math.min(prev.size + 5, 150) }));
            } else if (tool === 'lens') {
              setLensSettings((prev) => ({ ...prev, size: Math.min(prev.size + 5, 150) }));
            } else if (tool === 'circle' || tool === 'connected-circle') {
              setRingSettings((prev) => ({ ...prev, size: Math.min(prev.size + 5, 200) }));
            } else if (tool === 'name-tag') {
              setNameTagSettings((prev) => ({ ...prev, size: Math.min(prev.size + 0.5, 30) }));
            } else if (tool === 'text') {
              setTextSettings((prev) => ({ ...prev, fontSize: Math.min(prev.fontSize + 2, 100) }));
            } else if (tool === 'radar') {
              setPolygonSettings?.((prev) => ({ ...prev, radarRadius: Math.min(prev.radarRadius + 5, 250) }));
            } else {
              setToolSize((prev) => Math.min(prev + 1, 50));
            }
          } else if (isCtrlOrMeta) {
            e.preventDefault();
            const visibleEvents = tagEvents.filter((evt) => {
              let match = true;
              if (filterTagId && evt.tagId !== filterTagId) match = false;
              if (filterLabelId && (!evt.labelIds || !evt.labelIds.includes(filterLabelId))) match = false;
              return match;
            });
            setSelectedEventIds(new Set(visibleEvents.map((evt) => evt.id)));
            setIsMultiSelectAction(true);
          }
          break;
        case 'KeyS':
          if (e.shiftKey && !isCtrlOrMeta) {
            e.preventDefault();
            if (tool === 'spotlight') {
              setSpotlightSettings((prev) => ({ ...prev, size: Math.max(prev.size - 5, 20) }));
            } else if (tool === 'lens') {
              setLensSettings((prev) => ({ ...prev, size: Math.max(prev.size - 5, 40) }));
            } else if (tool === 'circle' || tool === 'connected-circle') {
              setRingSettings((prev) => ({ ...prev, size: Math.max(prev.size - 5, 10) }));
            } else if (tool === 'name-tag') {
              setNameTagSettings((prev) => ({ ...prev, size: Math.max(prev.size - 0.5, 1) }));
            } else if (tool === 'text') {
              setTextSettings((prev) => ({ ...prev, fontSize: Math.max(prev.fontSize - 2, 8) }));
            } else if (tool === 'radar') {
              setPolygonSettings?.((prev) => ({ ...prev, radarRadius: Math.max(prev.radarRadius - 5, 40) }));
            } else {
              setToolSize((prev) => Math.max(prev - 1, 1));
            }
          } else if (isCtrlOrMeta) {
            e.preventDefault();
            addSelectedToPlaylist(undefined, e.shiftKey);
          }
          break;
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.shiftKey) {
        e.preventDefault();
        setTool((prev) => {
          const tools: ToolType[] = [
            'pen',
            'line',
            'arrow',
            'curved-arrow',
            'circle',
            'connected-circle',
            'spotlight',
            'lens',
            'player-move',
            'name-tag',
            'text',
            'polygon',
            'radar',
            'scanner',
          ];
          const idx = prev ? tools.indexOf(prev) : -1;
          if (e.deltaY > 0) {
            return tools[(idx + 1) % tools.length];
          } else {
            return tools[(idx - 1 + tools.length) % tools.length];
          }
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [
    isPlaying,
    duration,
    shapes,
    redoStack,
    isTaggingMode,
    isAdvancedCodingMode,
    isPadQuickTagEnabled,
    tags,
    activeRecording,
    activeRecordings,
    currentTime,
    tagEvents,
    selectedEventIds,
    selectedEventLogs,
    activePlaylistId,
    autoplay,
    contextMenu,
    editEventModal,
    tool,
    colors,
    filterTagId,
    filterLabelId,
    selectedShapeId,
    editingAnimationFFId,
    isAnimationPreviewPlaying,
    animationPreviewTime,
    freezeFrames,
    activeFreezeFrameId,
    playerMoveState,
    addSelectedToPlaylist,
    addEventsToPlaylist,
    playlists,
    playbarEventId,
    addFreezeFrame,
    handleSelectTelestrationSlot,
    handleCycleTelestrationSlot,
    isDrawingTool,
    activeTelestrationSlot,
    telestrationColors,
    disabled,
  ]);
}
