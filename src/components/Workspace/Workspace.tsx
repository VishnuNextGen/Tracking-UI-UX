import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import type {
  ToolType,
  Shape,
  Playlist,
  ProjectData,
  PlaylistItem,
  FreezeFrame,
} from '../../types';
import type { WorkspaceProps, ExportModalState } from './Workspace.types';
import { useMasking } from './Masking';
import { useWorkspaceNotification } from './hooks/useWorkspaceNotification';
import { useScreenRecorder } from './hooks/useScreenRecorder';
import { useFreezeFrames } from './hooks/useFreezeFrames';
import { useWorkspacePopouts } from './hooks/useWorkspacePopouts';
import { useTaggingAndCoding } from './hooks/useTaggingAndCoding';
import { usePlaylistsAndPresentation } from './hooks/usePlaylistsAndPresentation';
import { usePlaybackAndTimeline } from './hooks/usePlaybackAndTimeline';
import { useTelestrationCanvas } from './hooks/useTelestrationCanvas';
import { useWorkspaceShortcuts } from './hooks/useWorkspaceShortcuts';
import { useWorkspaceLayoutResizing } from './hooks/useWorkspaceLayoutResizing';
import { useWorkspacePersistence } from './hooks/useWorkspacePersistence';
import { useWorkspaceProjectInfo } from './hooks/useWorkspaceProjectInfo';
import { BatchTabsBar } from '../Batches/BatchTabsBar';
import { getClipEventId } from '../../utils/playlistUtils';
import { RecordingTimer } from '../RecordingTimer';
import { AnimationPanel } from '../AnimationPanel';
import { LabelsPanel } from './LabelsPanel';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import { AdvancedCodingPad } from './AdvancedCodingPad';
import { WorkspaceDialogs } from './Modals/WorkspaceDialogs';
import { ProjectInfoModal } from './components/ProjectInfoModal';
import { WorkspaceTopBar } from './components/WorkspaceTopBar';
import { WorkspaceLeftSidebar } from './components/WorkspaceLeftSidebar';
import { WorkspaceViewport } from './components/WorkspaceViewport';
import { WorkspaceTimelineSection } from './components/WorkspaceTimelineSection';
import { WorkspaceFloatingPopouts } from './components/WorkspaceFloatingPopouts';
import { TrackingStudioModal } from '../Playlist/Tracking/TrackingStudioModal';

export { WorkspaceToggleSwitch, SectionHeader, RangeSlider } from './components/WorkspacePrimitives';
export type { WorkspaceProps, WorkspaceBatchModeProps } from './Workspace.types';

export const Workspace = ({
  userPlan,
  videoUrl,
  project,
  onUpdateProject,
  onUpdateMetadata,
  onClose,
  onForceSync,
  onRelinkVideo,
  onOpenBackupModal,
  batchMode,
}: WorkspaceProps) => {
  const {
    showInfoModal,
    setShowInfoModal,
    infoForm,
    setInfoForm,
    showBatchRelinkerModal,
    setShowBatchRelinkerModal,
    exportModalState,
    setExportModalState,
  } = useWorkspaceProjectInfo({
    project,
    onUpdateMetadata,
  });

  // Live Match State
  const isLive = videoUrl === 'live';
  const liveClockBridgeRef = useRef<{
    matchPeriod: string | null;
    getMatchTimeSec: () => number;
  } | null>(null);

  // Core Shared Playback, Tool, Shapes & Scrubbing State/Refs
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(
    project.fileName === 'live' ? project.data.liveTime || 0 : 0
  );
  const [duration, setDuration] = useState(0);
  const [tool, setTool] = useState<ToolType>(null);
  const [shapes, setShapes] = useState<Shape[]>(project.data.shapes || []);

  const [isScrubbing, setIsScrubbing] = useState(false);
  const isScrubbingRef = useRef<boolean>(false);
  const scrubTargetTimeRef = useRef<number | null>(null);
  const pendingScrubVideoTimeRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // DOM Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ghostCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const expandedTimelineContainerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stable operational refs across hooks
  const latestProjectDataRef = useRef<ProjectData>(project.data);
  latestProjectDataRef.current = project.data;
  const pendingSeekTimeRef = useRef<number | null>(batchMode?.initialSeekTime !== undefined ? batchMode.initialSeekTime : null);
  const pendingPlayRef = useRef<boolean>(Boolean(batchMode?.autoPlayPlaylist));
  const prevProjectIdRef = useRef<string>(project.id);

  // Playlists State & Persistence Bridge
  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    if (batchMode && batchMode.batch.playlists && batchMode.batch.playlists.length > 0) {
      return batchMode.batch.playlists;
    }
    if (batchMode) {
      return [{ id: 'bp1', name: 'Batch Highlights', events: [] }];
    }
    if (
      project.data?.playlists &&
      Array.isArray(project.data.playlists) &&
      project.data.playlists.length > 0
    ) {
      return project.data.playlists;
    }
    return [
      { id: 'p1', name: 'Highlights', events: [] },
      { id: 'p2', name: 'Defense', events: [] },
    ];
  });

  const syncPlaylistsToStorage = useCallback(
    (nextPlaylists: Playlist[]) => {
      if (batchMode) {
        batchMode.onUpdateBatch({
          ...batchMode.batch,
          playlists: nextPlaylists,
          lastModified: Date.now(),
        });
      } else {
        onUpdateProject({
          ...latestProjectDataRef.current,
          playlists: nextPlaylists,
        });
      }
    },
    [batchMode, onUpdateProject]
  );

  useEffect(() => {
    if (batchMode && batchMode.batch.playlists) {
      setPlaylists(batchMode.batch.playlists);
    }
  }, [batchMode?.batch?.id, batchMode?.batch?.lastModified]);

  const [activePlaylistId, setActivePlaylistId] = useState<string>(() => {
    if (
      batchMode?.initialPlaylistId &&
      batchMode.batch.playlists?.some((p) => p.id === batchMode.initialPlaylistId)
    ) {
      return batchMode.initialPlaylistId;
    }
    if (batchMode && batchMode.batch.playlists && batchMode.batch.playlists.length > 0) {
      return batchMode.batch.playlists[0].id;
    }
    if (batchMode) {
      return 'bp1';
    }
    return project.data.playlists?.[0]?.id || 'p1';
  });

  // Sidebar Tabs & Notes State
  const [activeSidebarTab, setActiveSidebarTab] = useState<'tags' | 'events' | 'notes' | 'playlist'>('tags');
  const [tagPanelDensity, setTagPanelDensity] = useState<'compact' | 'comfortable' | 'list'>('compact');
  const [tagPanelFontSizeMode, setTagPanelFontSizeMode] = useState<'auto' | 'sm' | 'md' | 'lg'>('auto');
  const [notesSubTab, setNotesSubTab] = useState<'timeline' | 'general'>('timeline');
  const [projectNotes, setProjectNotes] = useState(project.data.projectNotes || '');
  const [logDeleteConfirmation, setLogDeleteConfirmation] = useState<string | null>(null);
  const [noteModalTarget, setNoteModalTarget] = useState<{ eventId: string; projectId?: string } | null>(null);
  const [trackingStudioState, setTrackingStudioState] = useState<{ isOpen: boolean; clipIndex: number }>({
    isOpen: false,
    clipIndex: 0,
  });

  // 1. Notifications
  const { eventNotification, setEventNotification, showNotification } = useWorkspaceNotification();

  // 2. Masking / Green Screen
  const {
    maskSettings,
    setMaskSettings,
    maskCache,
    isProcessingMask,
    isPickingColor,
    setIsPickingColor,
    computeMaskingLayers,
    clearMaskCache,
    addColorAtPoint,
    removeColor,
  } = useMasking({
    videoRef,
    isPlaying,
    isScrubbing,
    currentTime,
  });

  // 3. Screen & Canvas Recorder
  const {
    isScreenRecording,
    isConvertingToMp4,
    recordingError,
    setRecordingError,
    mediaRecorderRef,
    recordingStartTimeRef,
    recordingCustomNameRef,
    exportSettingsRef,
    stopRecording,
    toggleScreenRecording,
  } = useScreenRecorder({
    videoRef,
    canvasRef,
    projectName: project.name,
  });

  // 4. Freeze Frames & Animation Timeline State
  const handleFreezeFrameAddedInClipRef = useRef<((newFF: FreezeFrame, clipHint: PlaylistItem) => void) | null>(null);

  const {
    hoveredFreezeFrameId,
    setHoveredFreezeFrameId,
    editingAnimationFFId,
    setEditingAnimationFFId,
    animationPreviewTime,
    setAnimationPreviewTime,
    isAnimationPreviewPlaying,
    setIsAnimationPreviewPlaying,
    animationPanelWidth,
    setAnimationPanelWidth,
    isResizingAnimPanel,
    setIsResizingAnimPanel,
    freezeFrames,
    setFreezeFrames,
    freezeFramePanelScope,
    setFreezeFramePanelScope,
    triggeredFreezeFrames,
    activeFreezeFrameId,
    setActiveFreezeFrameId,
    isFreezeFramePlaying,
    setIsFreezeFramePlaying,
    countdownValue,
    setCountdownValue,
    countdownInterval,
    setActiveStep,
    freezeFrameActiveSteps,
    setFreezeFrameActiveSteps,
    activeFreezeFrame,
    justPassedFFId,
    justNextFFId,
    currentStepForActiveFF,
    handleStepChange,
    deletedFFStack,
    ffRemainingSeconds,
    ffProgressPercent,
    deletedFFStackRef,
    undoDeleteFreezeFrameRef,
    toggleFreezeFramePlay,
    seekFreezeFrame,
    seekFreezeFrameRelative,
    skipFreezeFrame,
    addFreezeFrame,
    handleOpenAnimationPanel,
    deleteFreezeFrame,
    undoDeleteFreezeFrame,
    undoDeleteAllFreezeFrames,
    dismissDeletedFFNotification,
    updateFreezeFrameDuration,
    handleSelectedShapeStepChange,
  } = useFreezeFrames({
    project,
    videoRef,
    currentTime,
    setCurrentTime,
    duration,
    isPlaying,
    setIsPlaying,
    shapes,
    setShapes,
    setTool,
    maskSettings,
    maskCache,
    showNotification,
    onFreezeFrameCreatedInClip: (newFF, clipHint) => {
      handleFreezeFrameAddedInClipRef.current?.(newFF, clipHint);
    },
  });

  useEffect(() => {
    if (activeFreezeFrameId) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`ff-item-${activeFreezeFrameId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeFreezeFrameId]);

  // 5. Layout Resizing (Labels panel, Animation panel, Sidebar)
  const {
    labelsPanelWidth,
    isResizingLabelsPanel,
    setIsResizingLabelsPanel,
    sidebarWidth,
    setIsResizingSidebar,
  } = useWorkspaceLayoutResizing({
    isResizingAnimPanel,
    setIsResizingAnimPanel,
    setAnimationPanelWidth,
    sidebarRef,
  });

  // 6. Floating & External Browser Window Popouts
  const {
    poppedOutCodingMode,
    setPoppedOutCodingMode,
    showCodingPaneLabels,
    setShowCodingPaneLabels,
    isTimerPoppedOut,
    setIsTimerPoppedOut,
    isPadPoppedOut,
    setIsPadPoppedOut,
    timerDragControls,
    padDragControls,
    timerWidgetPos,
    padWidgetPos,
    timerExternalWindow,
    setTimerExternalWindow,
    padExternalWindow,
    setPadExternalWindow,
    externalTimerContainer,
    setExternalTimerContainer,
    externalPadContainer,
    setExternalPadContainer,
    openExternalWindow,
  } = useWorkspacePopouts({ showNotification });

  // 7. Tagging, Labels, Code Files & Event Undo/Redo
  const {
    labelsEnabled,
    setLabelsEnabled,
    isAdvancedCodingMode,
    setIsAdvancedCodingMode,
    advancedPadItems,
    setAdvancedPadItems,
    connectors,
    setConnectors,
    isPadQuickTagEnabled,
    labelGroups,
    setLabelGroups,
    labels,
    setLabels,
    labelEvents,
    setLabelEvents,
    editingLabelId,
    setEditingLabelId,
    editingGroupId,
    setEditingGroupId,
    tempLabel,
    setTempLabel,
    tempGroup,
    setTempGroup,
    draggedGroup,
    setDraggedGroup,
    draggedLabel,
    setDraggedLabel,
    isLabelsSelectMode,
    setIsLabelsSelectMode,
    selectedLabelIds,
    setSelectedLabelIds,
    selectedGroupIds,
    setSelectedGroupIds,
    labelDeleteConfirmation,
    setLabelDeleteConfirmation,
    showNormalTemplateModal,
    setShowNormalTemplateModal,
    currentCodeFileName,
    currentNormalTemplateName,
    showCodeFilesModal,
    setShowCodeFilesModal,
    showCodeFileSaveModal,
    setShowCodeFileSaveModal,
    unifiedFileInputRef,
    labelsActiveTargetTab,
    setLabelsActiveTargetTab,
    tags,
    setTags,
    tagEvents,
    setTagEvents,
    resetTagEventsForProjectSwitch,
    canUndoEvents,
    canRedoEvents,
    handleUndoEvents,
    handleRedoEvents,
    isTaggingMode,
    setIsTaggingMode,
    activeRecordings,
    setActiveRecordings,
    activeRecording,
    handleTogglePadQuickTag,
    filterTagId,
    setFilterTagId,
    filterLabelId,
    setFilterLabelId,
    tagSettingsOpen,
    setTagSettingsOpen,
    selectedEventIds,
    setSelectedEventIds,
    selectedEventLogs,
    setSelectedEventLogs,
    playbarEventId,
    setPlaybarEventId,
    isMultiSelectAction,
    setIsMultiSelectAction,
    editingTagId,
    setEditingTagId,
    tempTag,
    setTempTag,
    csvImportState,
    setCsvImportState,
    eventSortMode,
    setEventSortMode,
    isEventsEditMode,
    setIsEventsEditMode,
    bulkDeleteConfirmation,
    setBulkDeleteConfirmation,
    contextMenu,
    setContextMenu,
    editEventModal,
    setEditEventModal,
    deleteConfirmation,
    setDeleteConfirmation,
    tagDeleteConfirmation,
    setTagDeleteConfirmation,
    workspaceAlert,
    setWorkspaceAlert,
    confirmUnsavedModal,
    setConfirmUnsavedModal,
    lastTagActionTimestamp,
    exportUnifiedSetupToJSON,
    handleApplyCodeFile,
    handleCreateBlankCodeFile,
    handleSaveCodeFile,
    handleUnifiedFileSelect,
    importLabelsFromJSON,
    handleBulkDeleteLabels,
    confirmBulkDeleteLabels,
    exportEventsToCSV,
    importEventsFromCSV,
    handleLabelClick,
    handleTagClick,
    cancelRecording,
    timelineLanes,
    getFilteredEvents,
    getDisplayEvents,
    handleEventContextMenu,
    requestCloseEditEventModal,
    saveEditedEvent,
    deleteTag,
    confirmDeleteTag,
    handleDeleteEventRequest,
    deleteEventsByIds,
    confirmDeleteEvent,
    handleEventUpdate,
  } = useTaggingAndCoding({
    project,
    isLive,
    currentTime,
    duration,
    liveClockBridgeRef,
    latestProjectDataRef,
    playlists,
    setPlaylists,
    syncPlaylistsToStorage,
    showNotification,
  });

  // 8. Playlists, Cross-Batch Playback & Presentation Mode
  const {
    playlistModal,
    setPlaylistModal,
    playlistDeleteId,
    setPlaylistDeleteId,
    autoplay,
    setAutoplay,
    draggingEventIndex,
    setDraggingEventIndex,
    showPlaylistPlaybar,
    setShowPlaylistPlaybar,
    playlistPlaybarIndex,
    setPlaylistPlaybarIndex,
    isPresentationMode,
    showPresentationCustomizeModal,
    setShowPresentationCustomizeModal,
    presentationPlaylistIndex,
    setPresentationPlaylistIndex,
    presentationFinished,
    setPresentationFinished,
    presentationTransitionMsg,
    setPresentationTransitionMsg,
    presentationConfig,
    setPresentationConfig,
    allBatchTagEvents,
    allBatchTags,
    allBatchLabels,
    findEventAcrossBatch,
    handlePlaylistClipSelect,
    presentationPlaylists,
    currentPresentationPlaylist,
    currentPresentationEvent,
    currentPresentationTiming,
    isPresentationModeRef,
    presentationPlaylistsRef,
    presentationConfigRef,
    handleEnterPresentationMode,
    handleExitPresentationMode,
    handleSelectPresentationPlaylistIndex,
    handleNextPresentationClip,
    handlePrevPresentationClip,
    handleSeekPresentationClip,
    handleCreateDefaultPlaylist,
    savePlaylist,
    confirmDeletePlaylist,
    removeEventFromPlaylist,
    duplicatePlaylistEvent,
    handleIsolateClipFreezeFrames,
    handleToggleClipFreezeFrameIsolation,
    handleFreezeFrameAddedInClip,
    handleToggleClipFreezeFrameDeactivation,
    handleSetClipAllFreezeFramesDeactivation,
    handleUpdatePlaylistClipTrim,
    handleResetPlaylistClipTrim,
    reorderPlaylistEvents,
    startRecordExport,
    exportPlaylistVideo,
    startPlaylistAutoplay,
    addEventsToPlaylist,
    addSelectedToPlaylist,
  } = usePlaylistsAndPresentation({
    project,
    videoUrl,
    batchMode,
    videoRef,
    currentTime,
    setCurrentTime,
    duration,
    isPlaying,
    setIsPlaying,
    setTool,
    playlists,
    setPlaylists,
    activePlaylistId,
    setActivePlaylistId,
    syncPlaylistsToStorage,
    tags,
    labels,
    tagEvents,
    shapes,
    setShapes,
    freezeFrames,
    activeFreezeFrameId,
    setActiveFreezeFrameId,
    setIsFreezeFramePlaying,
    setCountdownValue,
    countdownInterval,
    editingAnimationFFId,
    setEditingAnimationFFId,
    setIsAnimationPreviewPlaying,
    selectedEventIds,
    setSelectedEventIds,
    selectedEventLogs,
    setSelectedEventLogs,
    playbarEventId,
    setPlaybarEventId,
    setIsMultiSelectAction,
    setIsEventsEditMode,
    setFreezeFramePanelScope,
    triggeredFreezeFrames,
    clearMaskCache,
    maskSettings,
    isScrubbingRef,
    scrubTargetTimeRef,
    lastTimeRef,
    pendingSeekTimeRef,
    pendingPlayRef,
    isScreenRecording,
    stopRecording,
    toggleScreenRecording,
    mediaRecorderRef,
    recordingCustomNameRef,
    exportSettingsRef,
    setExportModalState,
    showNotification,
  });

  handleFreezeFrameAddedInClipRef.current = handleFreezeFrameAddedInClip;

  // 9. Playback, Scrubbing, Markers, Period Syncs & Live Clock
  const {
    isVideoBuffering,
    setIsVideoBuffering,
    loadElapsedSec,
    playbackRate,
    setPlaybackRate,
    showCloseConfirm,
    setShowCloseConfirm,
    volume,
    setVolume,
    isMuted,
    setIsMuted,
    timelineZoom,
    isTimelineExpanded,
    setIsTimelineExpanded,
    showTimelineFiltersMenu,
    setShowTimelineFiltersMenu,
    showTimelineFreezeFrames,
    setShowTimelineFreezeFrames,
    showTimelineTags,
    setShowTimelineTags,
    markers,
    setMarkers,
    markerModal,
    setMarkerModal,
    hoveredNoteId,
    setHoveredNoteId,
    periodSyncs,
    setPeriodSyncs,
    timelineMarquee,
    liveClock,
    handleImportMatchVideo,
    togglePlay,
    toggleMute,
    handleZoomIn,
    handleZoomOut,
    beginScrubSession,
    scrubToTime,
    endScrubSession,
    handleManualSeek,
    jumpPrevEvent,
    jumpNextEvent,
    handleTimeUpdate,
    handleLoadedMetadata,
    handleScrubStart,
    handleTimelineMarqueeStart,
    handleTimelineContextMenu,
    handleMarkerContextMenu,
    saveMarker,
    deleteMarker,
    jumpToMarker,
    handleEventClick,
  } = usePlaybackAndTimeline({
    project,
    videoUrl,
    isLive,
    batchMode,
    onUpdateProject,
    onRelinkVideo,
    videoRef,
    timelineContainerRef,
    expandedTimelineContainerRef,
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    isScrubbing,
    setIsScrubbing,
    isScrubbingRef,
    scrubTargetTimeRef,
    pendingScrubVideoTimeRef,
    lastTimeRef,
    pendingSeekTimeRef,
    pendingPlayRef,
    prevProjectIdRef,
    latestProjectDataRef,
    liveClockBridgeRef,
    setIsTimerPoppedOut,
    freezeFrames,
    activeFreezeFrameId,
    setActiveFreezeFrameId,
    isFreezeFramePlaying,
    setIsFreezeFramePlaying,
    setCountdownValue,
    countdownInterval,
    triggeredFreezeFrames,
    editingAnimationFFId,
    setEditingAnimationFFId,
    setIsAnimationPreviewPlaying,
    toggleFreezeFramePlay,
    skipFreezeFrame,
    maskSettings,
    clearMaskCache,
    computeMaskingLayers,
    playlists,
    activePlaylistId,
    setActivePlaylistId,
    autoplay,
    setAutoplay,
    showPlaylistPlaybar,
    playlistPlaybarIndex,
    setPlaylistPlaybarIndex,
    findEventAcrossBatch,
    handlePlaylistClipSelect,
    isPresentationModeRef,
    presentationPlaylistsRef,
    presentationConfigRef,
    setPresentationPlaylistIndex,
    setPresentationTransitionMsg,
    setPresentationFinished,
    exportSettingsRef,
    stopRecording,
    tagEvents,
    setTagEvents,
    activeRecordings,
    setActiveRecordings,
    filterTagId,
    filterLabelId,
    selectedEventIds,
    setSelectedEventIds,
    setSelectedEventLogs,
    playbarEventId,
    setPlaybarEventId,
    isMultiSelectAction,
    setIsMultiSelectAction,
    getFilteredEvents,
    showNotification,
  });

  // 10. Telestration Canvas & Drawing Tools
  const {
    colors,
    activeColorId,
    setActiveColorId,
    telestrationColors,
    activeTelestrationSlot,
    setActiveTelestrationSlot,
    toolSize,
    setToolSize,
    setUndoStack,
    redoStack,
    setRedoStack,
    isDrawing,
    setIsDrawing,
    mousePosRef,
    arrowSettings,
    setArrowSettings,
    playerMoveState,
    playerMoveSettings,
    setPlayerMoveSettings,
    resetPlayerMove,
    selectedShapeId,
    setSelectedShapeId,
    setDraggingHandle,
    spotlightSettings,
    setSpotlightSettings,
    polygonSettings,
    setPolygonSettings,
    scannerSettings,
    setScannerSettings,
    lensSettings,
    setLensSettings,
    nameTagSettings,
    setNameTagSettings,
    ringSettings,
    setRingSettings,
    textSettings,
    setTextSettings,
    presetTexts,
    setPresetTexts,
    presetBulkText,
    setPresetBulkText,
    expandedPresetId,
    setExpandedPresetId,
    editingPresetId,
    setEditingPresetId,
    isDrawingTool,
    handleSelectTelestrationSlot,
    handleUpdateTelestrationColor,
    handleSwapHomeAwayColors,
    handleResetTelestrationColors,
    handleCycleTelestrationSlot,
    startDrawing,
    drawPreview,
    finishDrawing,
    handleDoubleClick,
    handleContextMenu,
    undo,
    redo,
    clearAll,
    handleColorRightClick,
    handleTelestrationRightClick,
  } = useTelestrationCanvas({
    project,
    videoUrl,
    videoRef,
    canvasRef,
    ghostCanvasRef,
    containerRef,
    tool,
    shapes,
    setShapes,
    isPlaying,
    setIsPlaying,
    currentTime,
    isScrubbing,
    isScrubbingRef,
    isScreenRecording,
    isTimelineExpanded,
    isPresentationMode,
    togglePlay,
    freezeFrames,
    setFreezeFrames,
    activeFreezeFrame,
    activeFreezeFrameId,
    setActiveFreezeFrameId,
    isFreezeFramePlaying,
    setIsFreezeFramePlaying,
    countdownValue,
    setCountdownValue,
    countdownInterval,
    editingAnimationFFId,
    animationPreviewTime,
    isAnimationPreviewPlaying,
    freezeFrameActiveSteps,
    currentStepForActiveFF,
    maskSettings,
    maskCache,
    isPickingColor,
    setIsPickingColor,
    addColorAtPoint,
    selectedEventIds,
    setSelectedEventIds,
    setPlaybarEventId,
    showNotification,
  });

  // 11. Global Shortcuts & Shift+Wheel Tool Cycling
  useWorkspaceShortcuts({
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
    disabled: trackingStudioState.isOpen,
  });

  // 12. Workspace Persistence, Autosave & Batch Lifecycle Management
  const {
    handleCanvasClick,
    confirmClose,
  } = useWorkspacePersistence({
    project,
    videoUrl,
    isLive,
    batchMode,
    onUpdateProject,
    onClose,
    videoRef,
    shapes,
    setShapes,
    freezeFrames,
    setFreezeFrames,
    tags,
    setTags,
    tagEvents,
    setTagEvents,
    resetTagEventsForProjectSwitch,
    labels,
    setLabels,
    labelGroups,
    setLabelGroups,
    labelEvents,
    setLabelEvents,
    markers,
    setMarkers,
    playlists,
    setPlaylists,
    activePlaylistId,
    setActivePlaylistId,
    presetTexts,
    setPresetTexts,
    projectNotes,
    setProjectNotes,
    periodSyncs,
    setPeriodSyncs,
    advancedPadItems,
    setAdvancedPadItems,
    connectors,
    setConnectors,
    nameTagSettings,
    setNameTagSettings,
    setInfoForm,
    setUndoStack,
    setRedoStack,
    selectedEventIds,
    setSelectedEventIds,
    setSelectedEventLogs,
    setPlaybarEventId,
    setActiveFreezeFrameId,
    setFreezeFrameActiveSteps,
    setActiveStep,
    isDrawing,
    setIsDrawing,
    currentTime,
    setCurrentTime,
    isPlaying,
    setIsPlaying,
    autoplay,
    tool,
  });

  const handleOpenEventNoteModal = useCallback((eventId: string, projectId?: string) => {
    setNoteModalTarget({ eventId, projectId });
  }, []);

  const handleSaveEventNote = useCallback(
    (eventId: string, noteText: string, targetProjectId?: string) => {
      const trimmedNote = noteText.trim();
      const isLocalEvent =
        (!targetProjectId || targetProjectId === project.id) &&
        tagEvents.some((e) => e.id === eventId);

      const previousLocalEvents = [...tagEvents];
      let updatedCrossProject: { id: string; prevData: ProjectData } | null = null;

      if (isLocalEvent) {
        setTagEvents((prev) =>
          prev.map((e) => (e.id === eventId ? { ...e, notes: trimmedNote } : e))
        );
      } else if (batchMode?.allBatchProjects) {
        const targetProj =
          (targetProjectId
            ? batchMode.allBatchProjects.find((p) => p.id === targetProjectId)
            : undefined) ||
          batchMode.allBatchProjects.find((p) =>
            p.data?.tagEvents?.some((e) => e.id === eventId)
          );
        if (targetProj) {
          updatedCrossProject = { id: targetProj.id, prevData: targetProj.data };
          const updatedEvents = (targetProj.data?.tagEvents || []).map((e) =>
            e.id === eventId ? { ...e, notes: trimmedNote } : e
          );
          onUpdateProject({ ...targetProj.data, tagEvents: updatedEvents }, targetProj.id);
        }
      }

      // Sync note on any playlist clip objects referencing this eventId
      let playlistsChanged = false;
      const previousPlaylists = playlists;
      const nextPlaylists = playlists.map((pl) => {
        let plChanged = false;
        const nextEvents = pl.events.map((item) => {
          if (typeof item === 'object' && getClipEventId(item) === eventId) {
            if ((item.notes || '') !== trimmedNote) {
              plChanged = true;
              playlistsChanged = true;
              return { ...item, notes: trimmedNote || undefined };
            }
          }
          return item;
        });
        return plChanged ? { ...pl, events: nextEvents } : pl;
      });

      if (playlistsChanged) {
        setPlaylists(nextPlaylists);
        syncPlaylistsToStorage(nextPlaylists);
      }

      // Sync with Right Panel Notes Tab unless user is actively inspecting a Playlist
      if (!showPlaylistPlaybar && activeSidebarTab !== 'playlist') {
        setActiveSidebarTab('notes');
        setNotesSubTab('timeline');
      }

      showNotification(
        trimmedNote ? 'Note saved and synced everywhere' : 'Note cleared',
        '#c6ff1f',
        () => {
          if (isLocalEvent) {
            setTagEvents(previousLocalEvents);
          } else if (updatedCrossProject) {
            onUpdateProject(updatedCrossProject.prevData, updatedCrossProject.id);
          }
          if (playlistsChanged) {
            setPlaylists(previousPlaylists);
            syncPlaylistsToStorage(previousPlaylists);
          }
        }
      );
    },
    [
      project.id,
      tagEvents,
      setTagEvents,
      batchMode,
      onUpdateProject,
      playlists,
      syncPlaylistsToStorage,
      showPlaylistPlaybar,
      activeSidebarTab,
      showNotification,
    ]
  );

  return (
    <div className="w-screen h-screen flex flex-col bg-[#0e0e0e] relative overflow-hidden">
      {!isPresentationMode && batchMode && (
        <BatchTabsBar
          batch={batchMode.batch}
          projects={batchMode.allBatchProjects}
          activeProjectId={project.id}
          projectBlobs={batchMode.projectBlobs}
          onSelectProject={batchMode.onSelectProject}
          onReloadVideo={batchMode.onReloadVideo}
          onAddGamesToBatch={batchMode.onAddGamesToBatch}
          onExitBatch={() => setShowCloseConfirm(true)}
          onOpenStats={batchMode.onOpenStats}
          onOpenRelinker={() => setShowBatchRelinkerModal(true)}
        />
      )}

      {!isPresentationMode && (
        <WorkspaceTopBar
          project={project}
          isLive={isLive}
          userPlan={userPlan}
          onForceSync={onForceSync}
          onOpenBackupModal={onOpenBackupModal}
          setShowCloseConfirm={setShowCloseConfirm}
          setShowInfoModal={setShowInfoModal}
          liveClockPeriods={liveClock.periods}
          liveClockMatchPeriod={liveClock.matchPeriod}
          isPlaying={isPlaying}
          isFreezeFramePlaying={isFreezeFramePlaying}
          currentTime={currentTime}
          duration={duration}
          activeFreezeFrame={activeFreezeFrame}
          activeFreezeFrameId={activeFreezeFrameId}
          freezeFrames={freezeFrames}
          setFreezeFrames={setFreezeFrames}
          currentStepForActiveFF={currentStepForActiveFF}
          handleStepChange={handleStepChange}
          shapes={shapes}
          setShapes={setShapes}
          selectedShapeId={selectedShapeId}
          handleSelectedShapeStepChange={handleSelectedShapeStepChange}
          handleOpenAnimationPanel={handleOpenAnimationPanel}
          editingAnimationFFId={editingAnimationFFId}
          addFreezeFrame={addFreezeFrame}
          deleteFreezeFrame={deleteFreezeFrame}
          deletedFFStack={deletedFFStack}
          undoDeleteFreezeFrame={undoDeleteFreezeFrame}
          undo={undo}
          redo={redo}
          tool={tool}
          setTool={setTool}
          clearAll={clearAll}
          isTimerPoppedOut={isTimerPoppedOut}
          setIsTimerPoppedOut={setIsTimerPoppedOut}
          isPadPoppedOut={isPadPoppedOut}
          setIsPadPoppedOut={setIsPadPoppedOut}
          setPoppedOutCodingMode={setPoppedOutCodingMode}
          showNotification={showNotification}
          handleImportMatchVideo={handleImportMatchVideo}
          handleManualSeek={handleManualSeek}
          togglePlay={togglePlay}
          periodSyncs={periodSyncs}
          setPeriodSyncs={setPeriodSyncs}
          tagEvents={tagEvents}
          setTagEvents={setTagEvents}
          markers={markers}
          setMarkers={setMarkers}
          isScreenRecording={isScreenRecording}
          isConvertingToMp4={isConvertingToMp4}
          toggleScreenRecording={toggleScreenRecording}
          telestrationColors={telestrationColors}
          activeTelestrationSlot={activeTelestrationSlot}
          setActiveTelestrationSlot={setActiveTelestrationSlot}
          handleSelectTelestrationSlot={handleSelectTelestrationSlot}
          handleTelestrationRightClick={handleTelestrationRightClick}
          colors={colors}
          activeColorId={activeColorId}
          setActiveColorId={setActiveColorId}
          handleColorRightClick={handleColorRightClick}
        />
      )}

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left Sidebar + Properties Panel */}
        {!editingAnimationFFId && !isPresentationMode && (
          <WorkspaceLeftSidebar
            isLive={isLive}
            labelsEnabled={labelsEnabled}
            setLabelsEnabled={setLabelsEnabled}
            isAdvancedCodingMode={isAdvancedCodingMode}
            setIsAdvancedCodingMode={setIsAdvancedCodingMode}
            tool={tool}
            setTool={setTool}
            polygonSettings={polygonSettings}
            showNotification={showNotification}
            propertiesPanelProps={{
              tool,
              project,
              videoRef,
              currentTime,
              setCurrentTime,
              duration,
              isPlaying,
              setIsPlaying,
              telestrationColors,
              activeTelestrationSlot,
              handleSelectTelestrationSlot,
              handleUpdateTelestrationColor,
              handleSwapHomeAwayColors,
              handleResetTelestrationColors,
              playlists,
              activePlaylistId,
              showPlaylistPlaybar,
              playlistPlaybarIndex,
              freezeFramePanelScope,
              setFreezeFramePanelScope,
              findEventAcrossBatch,
              freezeFrames,
              allBatchTagEvents,
              allBatchTags,
              activeFreezeFrameId,
              setActiveFreezeFrameId,
              isFreezeFramePlaying,
              setIsFreezeFramePlaying,
              countdownValue,
              setCountdownValue,
              toggleFreezeFramePlay,
              seekFreezeFrame,
              skipFreezeFrame,
              hoveredFreezeFrameId,
              setHoveredFreezeFrameId,
              handleManualSeek,
              handleToggleClipFreezeFrameDeactivation,
              handleSetClipAllFreezeFramesDeactivation,
              handleIsolateClipFreezeFrames,
              handleToggleClipFreezeFrameIsolation,
              duplicatePlaylistEvent,
              updateFreezeFrameDuration,
              setAnimationPreviewTime,
              setIsAnimationPreviewPlaying,
              setEditingAnimationFFId,
              deleteFreezeFrame,
              addFreezeFrame,
              deletedFFStack,
              ffRemainingSeconds,
              ffProgressPercent,
              dismissDeletedFFNotification,
              undoDeleteFreezeFrame,
              undoDeleteAllFreezeFrames,
              maskSettings,
              setMaskSettings,
              isPickingColor,
              setIsPickingColor,
              isProcessingMask,
              removeColor,
              spotlightSettings,
              setSpotlightSettings,
              lensSettings,
              setLensSettings,
              polygonSettings,
              setPolygonSettings,
              scannerSettings,
              setScannerSettings,
              activeColorId,
              setActiveColorId,
              colors,
              nameTagSettings,
              setNameTagSettings,
              textSettings,
              setTextSettings,
              presetBulkText,
              setPresetBulkText,
              presetTexts,
              setPresetTexts,
              editingPresetId,
              setEditingPresetId,
              expandedPresetId,
              setExpandedPresetId,
              playerMoveState,
              resetPlayerMove,
              setIsDrawing,
              toolSize,
              setToolSize,
              playerMoveSettings,
              setPlayerMoveSettings,
              arrowSettings,
              setArrowSettings,
              ringSettings,
              setRingSettings,
            }}
          />
        )}

        {/* Center Video, Telestration Canvas & Timeline Column */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
          className={`flex flex-col min-w-0 bg-[#0a0a0a] relative ${
            isAdvancedCodingMode
              ? 'w-full lg:w-[35%] shrink-0 h-[45vh] lg:h-full border-b lg:border-b-0 lg:border-r border-[#222]'
              : 'flex-1 h-full'
          }`}
        >
          {editingAnimationFFId && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#c6ff1f]/30 backdrop-blur-md border border-[#c6ff1f]/30 text-white px-6 py-2 rounded-full shadow-2xl z-[100] flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
              <div className="w-2 h-2 rounded-full bg-[#c6ff1f] animate-pulse" />
              <span className="font-bold tracking-widest uppercase text-sm text-[#c6ff1f]">
                Animation Timeline Editor
              </span>
            </div>
          )}

          {isScreenRecording && recordingStartTimeRef.current && (
            <RecordingTimer
              startTime={recordingStartTimeRef.current}
              label={exportSettingsRef.current.active ? 'RECORD EXPORT (MP4)' : 'SCREEN REC (MP4)'}
            />
          )}

          {isConvertingToMp4 && (
            <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-[70] pointer-events-none">
              <div className="bg-black/85 backdrop-blur-md text-white px-3 py-1.5 rounded-full shadow-lg border border-[#c6ff1f]/50 flex items-center gap-2 pointer-events-auto select-none animate-pulse">
                <span className="w-2.5 h-2.5 border-2 border-[#c6ff1f] border-t-transparent rounded-full animate-spin" />
                <span className="font-mono font-bold text-xs text-[#c6ff1f]">PACKAGING MP4...</span>
              </div>
            </div>
          )}

          {showInfoModal && (
            <ProjectInfoModal
              project={project}
              duration={duration}
              infoForm={infoForm}
              setInfoForm={setInfoForm}
              onClose={() => setShowInfoModal(false)}
              onUpdateMetadata={onUpdateMetadata}
            />
          )}

          <WorkspaceViewport
            containerRef={containerRef}
            videoRef={videoRef}
            canvasRef={canvasRef}
            ghostCanvasRef={ghostCanvasRef}
            isPresentationMode={isPresentationMode}
            tool={tool}
            setSelectedShapeId={setSelectedShapeId}
            setDraggingHandle={setDraggingHandle}
            videoUrl={videoUrl}
            duration={duration}
            setDuration={setDuration}
            isLive={isLive}
            project={project}
            loadElapsedSec={loadElapsedSec}
            isVideoBuffering={isVideoBuffering}
            setIsVideoBuffering={setIsVideoBuffering}
            liveClock={liveClock}
            batchMode={batchMode}
            handleTimeUpdate={handleTimeUpdate}
            handleLoadedMetadata={handleLoadedMetadata}
            pendingSeekTimeRef={pendingSeekTimeRef}
            pendingPlayRef={pendingPlayRef}
            currentTime={currentTime}
            setCurrentTime={setCurrentTime}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            autoplay={autoplay}
            isScrubbingRef={isScrubbingRef}
            activeFreezeFrameId={activeFreezeFrameId}
            clearMaskCache={clearMaskCache}
            pendingScrubVideoTimeRef={pendingScrubVideoTimeRef}
            maskSettings={maskSettings}
            computeMaskingLayers={computeMaskingLayers}
            isPickingColor={isPickingColor}
            startDrawing={startDrawing}
            drawPreview={drawPreview}
            finishDrawing={finishDrawing}
            setIsDrawing={setIsDrawing}
            mousePosRef={mousePosRef}
            handleDoubleClick={handleDoubleClick}
            handleContextMenu={handleContextMenu}
            handleCanvasClick={handleCanvasClick}
            eventNotification={eventNotification}
            setEventNotification={setEventNotification}
            selectedEventIds={selectedEventIds}
            tagEvents={tagEvents}
            hoveredNoteId={hoveredNoteId}
            markers={markers}
            isTaggingMode={isTaggingMode}
            activeRecordings={activeRecordings}
            setActiveRecordings={setActiveRecordings}
            tags={tags}
            labels={labels}
            handleTagClick={handleTagClick}
            isPadQuickTagEnabled={isPadQuickTagEnabled}
            labelsActiveTargetTab={labelsActiveTargetTab}
            setLabelsActiveTargetTab={setLabelsActiveTargetTab}
            isScreenRecording={isScreenRecording}
            recordingError={recordingError}
            setRecordingError={setRecordingError}
            currentPresentationPlaylist={currentPresentationPlaylist}
            presentationPlaylistIndex={presentationPlaylistIndex}
            presentationPlaylists={presentationPlaylists}
            playlistPlaybarIndex={playlistPlaybarIndex}
            currentPresentationEvent={currentPresentationEvent}
            currentPresentationTiming={currentPresentationTiming}
            togglePlay={togglePlay}
            handlePrevPresentationClip={handlePrevPresentationClip}
            handleNextPresentationClip={handleNextPresentationClip}
            handleSelectPresentationPlaylistIndex={handleSelectPresentationPlaylistIndex}
            scrubToTime={scrubToTime}
            handleSeekPresentationClip={handleSeekPresentationClip}
            beginScrubSession={beginScrubSession}
            endScrubSession={endScrubSession}
            setShowPresentationCustomizeModal={setShowPresentationCustomizeModal}
            handleExitPresentationMode={handleExitPresentationMode}
            volume={volume}
            setVolume={setVolume}
            isMuted={isMuted}
            toggleMute={toggleMute}
            playbackRate={playbackRate}
            setPlaybackRate={setPlaybackRate}
            presentationConfig={presentationConfig}
            setPresentationConfig={setPresentationConfig}
            presentationFinished={presentationFinished}
            handleEnterPresentationMode={handleEnterPresentationMode}
            presentationTransitionMsg={presentationTransitionMsg}
          />

          {!editingAnimationFFId && !isPresentationMode && (
            <WorkspaceTimelineSection
              project={project}
              isLive={isLive}
              videoRef={videoRef}
              timelineContainerRef={timelineContainerRef}
              expandedTimelineContainerRef={expandedTimelineContainerRef}
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              activeFreezeFrameId={activeFreezeFrameId}
              setActiveFreezeFrameId={setActiveFreezeFrameId}
              isFreezeFramePlaying={isFreezeFramePlaying}
              setIsFreezeFramePlaying={setIsFreezeFramePlaying}
              setCountdownValue={setCountdownValue}
              justPassedFFId={justPassedFFId}
              justNextFFId={justNextFFId}
              hoveredFreezeFrameId={hoveredFreezeFrameId}
              setHoveredFreezeFrameId={setHoveredFreezeFrameId}
              freezeFrames={freezeFrames}
              selectedEventIds={selectedEventIds}
              setSelectedEventIds={setSelectedEventIds}
              selectedEventLogs={selectedEventLogs}
              setSelectedEventLogs={setSelectedEventLogs}
              isMultiSelectAction={isMultiSelectAction}
              setIsMultiSelectAction={setIsMultiSelectAction}
              playbarEventId={playbarEventId}
              setPlaybarEventId={setPlaybarEventId}
              showPlaylistPlaybar={showPlaylistPlaybar}
              setShowPlaylistPlaybar={setShowPlaylistPlaybar}
              playlists={playlists}
              activePlaylistId={activePlaylistId}
              playlistPlaybarIndex={playlistPlaybarIndex}
              autoplay={autoplay}
              setAutoplay={setAutoplay}
              isTimelineExpanded={isTimelineExpanded}
              setIsTimelineExpanded={setIsTimelineExpanded}
              addSelectedToPlaylist={addSelectedToPlaylist}
              addEventsToPlaylist={addEventsToPlaylist}
              reorderPlaylistEvents={reorderPlaylistEvents}
              tagEvents={tagEvents}
              setTagEvents={setTagEvents}
              tags={tags}
              labels={labels}
              filterTagId={filterTagId}
              filterLabelId={filterLabelId}
              allBatchTagEvents={allBatchTagEvents}
              allBatchTags={allBatchTags}
              allBatchLabels={allBatchLabels}
              batchMode={batchMode}
              handleToggleClipFreezeFrameDeactivation={handleToggleClipFreezeFrameDeactivation}
              handleSetClipAllFreezeFramesDeactivation={handleSetClipAllFreezeFramesDeactivation}
              handlePlaylistClipSelect={handlePlaylistClipSelect}
              handleUpdatePlaylistClipTrim={handleUpdatePlaylistClipTrim}
              handleResetPlaylistClipTrim={handleResetPlaylistClipTrim}
              togglePlay={togglePlay}
              beginScrubSession={beginScrubSession}
              scrubToTime={scrubToTime}
              endScrubSession={endScrubSession}
              handleEventUpdate={handleEventUpdate}
              deleteEventsByIds={deleteEventsByIds}
              liveClock={liveClock}
              periodSyncs={periodSyncs}
              setPeriodSyncs={setPeriodSyncs}
              handleEventClick={handleEventClick}
              handleEventContextMenu={handleEventContextMenu}
              onOpenEventNoteModal={handleOpenEventNoteModal}
              timelineZoom={timelineZoom}
              showTimelineTags={showTimelineTags}
              setShowTimelineTags={setShowTimelineTags}
              showTimelineFreezeFrames={showTimelineFreezeFrames}
              setShowTimelineFreezeFrames={setShowTimelineFreezeFrames}
              showTimelineFiltersMenu={showTimelineFiltersMenu}
              setShowTimelineFiltersMenu={setShowTimelineFiltersMenu}
              markers={markers}
              setMarkers={setMarkers}
              lastTagActionTimestamp={lastTagActionTimestamp}
              timelineLanes={timelineLanes}
              setMarkerModal={setMarkerModal}
              handleScrubStart={handleScrubStart}
              handleTimelineContextMenu={handleTimelineContextMenu}
              handleTimelineMarqueeStart={handleTimelineMarqueeStart}
              timelineMarquee={timelineMarquee}
              jumpToMarker={jumpToMarker}
              setHoveredNoteId={setHoveredNoteId}
              isTaggingMode={isTaggingMode}
              activeRecordings={activeRecordings}
              handleMarkerContextMenu={handleMarkerContextMenu}
              handleZoomIn={handleZoomIn}
              handleZoomOut={handleZoomOut}
              setIsTimerPoppedOut={setIsTimerPoppedOut}
              setIsPadPoppedOut={setIsPadPoppedOut}
              showNotification={showNotification}
              handleImportMatchVideo={handleImportMatchVideo}
              jumpPrevEvent={jumpPrevEvent}
              jumpNextEvent={jumpNextEvent}
              handleManualSeek={handleManualSeek}
              playbackRate={playbackRate}
              setPlaybackRate={setPlaybackRate}
              isMuted={isMuted}
              setIsMuted={setIsMuted}
              toggleMute={toggleMute}
              volume={volume}
              setVolume={setVolume}
              onAddFreezeFrame={addFreezeFrame}
              onOpenFreezeFrameAnimation={handleOpenAnimationPanel}
            />
          )}
        </motion.div>

        {/* --- ANIMATION PANEL (RIGHT SIDEBAR REPLACEMENT) --- */}
        {editingAnimationFFId && freezeFrames.find((f) => f.id === editingAnimationFFId) && (
          <>
            <div
              className={`w-1 z-[100] cursor-col-resize transition-colors ${
                isResizingAnimPanel ? 'bg-[#c6ff1f]' : 'bg-[#222] hover:bg-gray-500'
              }`}
              onMouseDown={() => setIsResizingAnimPanel(true)}
            />
            <AnimationPanel
              width={animationPanelWidth}
              freezeFrame={freezeFrames.find((f) => f.id === editingAnimationFFId)!}
              shapes={shapes}
              setShapes={setShapes}
              onClose={() => {
                setEditingAnimationFFId(null);
                setIsAnimationPreviewPlaying(false);
              }}
              previewTime={animationPreviewTime}
              setPreviewTime={setAnimationPreviewTime}
              isPlaying={isAnimationPreviewPlaying}
              setIsPlaying={setIsAnimationPreviewPlaying}
              selectedShapeId={selectedShapeId}
              setSelectedShapeId={(id) => {
                setSelectedShapeId(id);
                if (id) {
                  setTool('move');
                }
              }}
              onUpdateFreezeFrame={(updatedFF) => {
                setFreezeFrames((prev) => prev.map((f) => (f.id === updatedFF.id ? updatedFF : f)));
              }}
            />
          </>
        )}

        {/* --- LABELS PANEL --- */}
        {!editingAnimationFFId && !isPresentationMode && (
          <LabelsPanel
            labelsEnabled={labelsEnabled}
            isAdvancedCodingMode={isAdvancedCodingMode}
            labelsPanelWidth={labelsPanelWidth}
            isResizingLabelsPanel={isResizingLabelsPanel}
            setIsResizingLabelsPanel={setIsResizingLabelsPanel}
            isTaggingMode={isTaggingMode}
            isLabelsSelectMode={isLabelsSelectMode}
            setIsLabelsSelectMode={setIsLabelsSelectMode}
            selectedLabelIds={selectedLabelIds}
            setSelectedLabelIds={setSelectedLabelIds}
            selectedGroupIds={selectedGroupIds}
            setSelectedGroupIds={setSelectedGroupIds}
            handleBulkDeleteLabels={handleBulkDeleteLabels}
            setShowNormalTemplateModal={setShowNormalTemplateModal}
            importLabelsFromJSON={importLabelsFromJSON}
            exportUnifiedSetupToJSON={exportUnifiedSetupToJSON}
            labels={labels}
            setLabels={setLabels}
            labelGroups={labelGroups}
            setLabelGroups={setLabelGroups}
            editingLabelId={editingLabelId}
            setEditingLabelId={setEditingLabelId}
            editingGroupId={editingGroupId}
            setEditingGroupId={setEditingGroupId}
            tempLabel={tempLabel}
            setTempLabel={setTempLabel}
            tempGroup={tempGroup}
            setTempGroup={setTempGroup}
            draggedGroup={draggedGroup}
            setDraggedGroup={setDraggedGroup}
            draggedLabel={draggedLabel}
            setDraggedLabel={setDraggedLabel}
            activeRecordings={activeRecordings}
            selectedEventIds={selectedEventIds}
            tagEvents={tagEvents}
            filterLabelId={filterLabelId}
            handleLabelClick={handleLabelClick}
            showNotification={showNotification}
            tags={tags}
            activeTargetTab={labelsActiveTargetTab}
            setActiveTargetTab={setLabelsActiveTargetTab}
          />
        )}

        {/* --- RIGHT SIDEBAR --- */}
        {!editingAnimationFFId && !isAdvancedCodingMode && !isPresentationMode && (
          <WorkspaceSidebar
            sidebarRef={sidebarRef}
            sidebarWidth={sidebarWidth}
            setIsResizingSidebar={setIsResizingSidebar}
            activeSidebarTab={activeSidebarTab}
            setActiveSidebarTab={setActiveSidebarTab}
            isTaggingMode={isTaggingMode}
            setIsTaggingMode={setIsTaggingMode}
            setActiveRecordings={setActiveRecordings}
            setTool={setTool}
            setSelectedEventIds={setSelectedEventIds}
            labelsEnabled={labelsEnabled}
            setLabelsEnabled={setLabelsEnabled}
            setShowNormalTemplateModal={setShowNormalTemplateModal}
            currentNormalTemplateName={currentNormalTemplateName}
            onOpenCodeFilesModal={() => setShowCodeFilesModal(true)}
            onOpenCodeFileSaveModal={() => setShowCodeFileSaveModal(true)}
            currentCodeFileName={currentCodeFileName}
            onPopoutCodingPanel={() => {
              setIsPadPoppedOut(true);
              setPoppedOutCodingMode('panel');
              showNotification(
                'Coding Panel popped out into a floating resizable window entity near your video!',
                '#c6ff1f'
              );
            }}
            exportUnifiedSetupToJSON={exportUnifiedSetupToJSON}
            unifiedFileInputRef={unifiedFileInputRef}
            handleUnifiedFileSelect={handleUnifiedFileSelect}
            setIsAdvancedCodingMode={setIsAdvancedCodingMode}
            setTagSettingsOpen={setTagSettingsOpen}
            tagPanelDensity={tagPanelDensity}
            setTagPanelDensity={setTagPanelDensity}
            tagPanelFontSizeMode={tagPanelFontSizeMode}
            setTagPanelFontSizeMode={setTagPanelFontSizeMode}
            tags={tags}
            activeRecordings={activeRecordings}
            tagEvents={tagEvents}
            setTagEvents={setTagEvents}
            filterTagId={filterTagId}
            setFilterTagId={setFilterTagId}
            filterLabelId={filterLabelId}
            setFilterLabelId={setFilterLabelId}
            handleTagClick={handleTagClick}
            importEventsFromCSV={importEventsFromCSV}
            exportEventsToCSV={exportEventsToCSV}
            handleUndoEvents={handleUndoEvents}
            canUndoEvents={canUndoEvents}
            handleRedoEvents={handleRedoEvents}
            canRedoEvents={canRedoEvents}
            selectedEventLogs={selectedEventLogs}
            setSelectedEventLogs={setSelectedEventLogs}
            selectedEventIds={selectedEventIds}
            addEventsToPlaylist={addEventsToPlaylist}
            getDisplayEvents={getDisplayEvents}
            showNotification={showNotification}
            eventSortMode={eventSortMode}
            setEventSortMode={setEventSortMode}
            labels={labels}
            labelGroups={labelGroups}
            handleLabelClick={handleLabelClick}
            bulkDeleteConfirmation={bulkDeleteConfirmation}
            setBulkDeleteConfirmation={setBulkDeleteConfirmation}
            isEventsEditMode={isEventsEditMode}
            setIsEventsEditMode={setIsEventsEditMode}
            logDeleteConfirmation={logDeleteConfirmation}
            setLogDeleteConfirmation={setLogDeleteConfirmation}
            jumpToMarker={jumpToMarker}
            setPlaybarEventId={setPlaybarEventId}
            handleEventContextMenu={handleEventContextMenu}
            onOpenEventNoteModal={handleOpenEventNoteModal}
            onSaveEventNote={handleSaveEventNote}
            onDeleteEvents={deleteEventsByIds}
            notesSubTab={notesSubTab}
            setNotesSubTab={setNotesSubTab}
            setMarkerModal={setMarkerModal}
            currentTime={currentTime}
            markers={markers}
            setMarkers={setMarkers}
            projectNotes={projectNotes}
            setProjectNotes={setProjectNotes}
            playlists={playlists}
            setPlaylistModal={setPlaylistModal}
            activePlaylistId={activePlaylistId}
            setActivePlaylistId={setActivePlaylistId}
            setPlaylistDeleteId={setPlaylistDeleteId}
            showPlaylistPlaybar={showPlaylistPlaybar}
            setShowPlaylistPlaybar={setShowPlaylistPlaybar}
            handlePlaylistClipSelect={handlePlaylistClipSelect}
            autoplay={autoplay}
            setAutoplay={setAutoplay}
            exportPlaylistVideo={exportPlaylistVideo}
            startPlaylistAutoplay={startPlaylistAutoplay}
            allBatchTagEvents={allBatchTagEvents}
            allBatchTags={allBatchTags}
            allBatchLabels={allBatchLabels}
            batchMode={batchMode}
            playlistPlaybarIndex={playlistPlaybarIndex}
            draggingEventIndex={draggingEventIndex}
            setDraggingEventIndex={setDraggingEventIndex}
            findEventAcrossBatch={findEventAcrossBatch}
            duplicatePlaylistEvent={duplicatePlaylistEvent}
            removeEventFromPlaylist={removeEventFromPlaylist}
            handleResetPlaylistClipTrim={handleResetPlaylistClipTrim}
            reorderPlaylistEvents={reorderPlaylistEvents}
            addSelectedToPlaylist={addSelectedToPlaylist}
            freezeFrames={freezeFrames}
            onEnterPresentationMode={() => handleEnterPresentationMode()}
            onOpenTracking={(clipIndex) => {
              if (videoRef.current && !videoRef.current.paused) {
                videoRef.current.pause();
                setIsPlaying(false);
              }
              setTrackingStudioState({
                isOpen: true,
                clipIndex: clipIndex !== undefined && clipIndex >= 0 ? clipIndex : 0,
              });
            }}
          />
        )}

        {/* --- ADVANCED CODING PAD --- */}
        {isAdvancedCodingMode && !editingAnimationFFId && !isPresentationMode && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 min-w-0 select-none"
            style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
          >
            <AdvancedCodingPad
              tags={tags}
              labels={labels}
              labelGroups={labelGroups}
              setTags={setTags}
              setLabels={setLabels}
              setLabelGroups={setLabelGroups}
              items={advancedPadItems}
              setItems={setAdvancedPadItems}
              connectors={connectors}
              setConnectors={setConnectors}
              isTaggingMode={isTaggingMode}
              setIsTaggingMode={setIsTaggingMode}
              activeRecording={activeRecording}
              activeRecordings={activeRecordings}
              onTagClick={(tagId) => handleTagClick(tagId, { ignoreLeadLag: !isPadQuickTagEnabled })}
              onLabelClick={handleLabelClick}
              onAddTag={(tag) => setTags((prev) => [...prev, tag])}
              onAddLabel={(label) => setLabels((prev) => [...prev, label])}
              onExit={() => setIsAdvancedCodingMode(false)}
              onPopout={() => {
                setIsPadPoppedOut(true);
                setPoppedOutCodingMode('pad');
                showNotification(
                  'Advanced Coding Pad popped out into a floating resizable window entity near your video!',
                  '#c6ff1f'
                );
              }}
              onOpenTagSettings={() => setTagSettingsOpen(true)}
              showNotification={showNotification}
              currentCodeFileName={currentCodeFileName}
              onOpenCodeFilesModal={() => setShowCodeFilesModal(true)}
              onOpenCodeFileSaveModal={() => setShowCodeFileSaveModal(true)}
              isQuickTagEnabled={isPadQuickTagEnabled}
              onToggleQuickTag={handleTogglePadQuickTag}
              onEditTag={(tagId) => {
                setEditingTagId(tagId);
                setTagSettingsOpen(true);
              }}
              onEditLabel={(labelId) => {
                const label = labels.find((l) => l.id === labelId);
                if (label) {
                  setEditingLabelId(labelId);
                  setTempLabel({
                    name: label.name,
                    shortcut: label.shortcut,
                    exclusive: label.exclusive,
                  });
                }
              }}
            />
          </motion.div>
        )}
      </div>

      {/* --- WORKSPACE DIALOGS & MODALS --- */}
      <WorkspaceDialogs
        project={project}
        batchMode={batchMode}
        currentTime={currentTime}
        showNotification={showNotification}
        tagSettingsOpen={tagSettingsOpen}
        setTagSettingsOpen={setTagSettingsOpen}
        tags={tags}
        setTags={setTags}
        editingTagId={editingTagId}
        setEditingTagId={setEditingTagId}
        tempTag={tempTag}
        setTempTag={setTempTag}
        deleteTag={deleteTag}
        tagDeleteConfirmation={tagDeleteConfirmation}
        setTagDeleteConfirmation={setTagDeleteConfirmation}
        confirmDeleteTag={confirmDeleteTag}
        contextMenu={contextMenu}
        setContextMenu={setContextMenu}
        csvImportState={csvImportState}
        setCsvImportState={setCsvImportState}
        labels={labels}
        setLabels={setLabels}
        labelGroups={labelGroups}
        setLabelGroups={setLabelGroups}
        editingLabelId={editingLabelId}
        setEditingLabelId={setEditingLabelId}
        tempLabel={tempLabel}
        setTempLabel={setTempLabel}
        isAdvancedCodingMode={isAdvancedCodingMode}
        labelDeleteConfirmation={labelDeleteConfirmation}
        setLabelDeleteConfirmation={setLabelDeleteConfirmation}
        confirmBulkDeleteLabels={confirmBulkDeleteLabels}
        showNormalTemplateModal={showNormalTemplateModal}
        setShowNormalTemplateModal={setShowNormalTemplateModal}
        showCodeFilesModal={showCodeFilesModal}
        setShowCodeFilesModal={setShowCodeFilesModal}
        showCodeFileSaveModal={showCodeFileSaveModal}
        setShowCodeFileSaveModal={setShowCodeFileSaveModal}
        currentCodeFileName={currentCodeFileName}
        advancedPadItems={advancedPadItems}
        connectors={connectors}
        handleApplyCodeFile={handleApplyCodeFile}
        handleCreateBlankCodeFile={handleCreateBlankCodeFile}
        handleSaveCodeFile={handleSaveCodeFile}
        exportUnifiedSetupToJSON={exportUnifiedSetupToJSON}
        playlists={playlists}
        activePlaylistId={activePlaylistId}
        playlistPlaybarIndex={playlistPlaybarIndex}
        playlistModal={playlistModal}
        setPlaylistModal={setPlaylistModal}
        savePlaylist={savePlaylist}
        playlistDeleteId={playlistDeleteId}
        setPlaylistDeleteId={setPlaylistDeleteId}
        confirmDeletePlaylist={confirmDeletePlaylist}
        addEventsToPlaylist={addEventsToPlaylist}
        showPresentationCustomizeModal={showPresentationCustomizeModal}
        setShowPresentationCustomizeModal={setShowPresentationCustomizeModal}
        presentationConfig={presentationConfig}
        setPresentationConfig={setPresentationConfig}
        handleEnterPresentationMode={handleEnterPresentationMode}
        handleCreateDefaultPlaylist={handleCreateDefaultPlaylist}
        editEventModal={editEventModal}
        setEditEventModal={setEditEventModal}
        requestCloseEditEventModal={requestCloseEditEventModal}
        saveEditedEvent={saveEditedEvent}
        handleDeleteEventRequest={handleDeleteEventRequest}
        deleteConfirmation={deleteConfirmation}
        setDeleteConfirmation={setDeleteConfirmation}
        confirmDeleteEvent={confirmDeleteEvent}
        deleteEventsByIds={deleteEventsByIds}
        tagEvents={tagEvents}
        setTagEvents={setTagEvents}
        activeSidebarTab={activeSidebarTab}
        setActiveSidebarTab={setActiveSidebarTab}
        notesSubTab={notesSubTab}
        setNotesSubTab={setNotesSubTab}
        noteModalTarget={noteModalTarget}
        setNoteModalTarget={setNoteModalTarget}
        onSaveEventNote={handleSaveEventNote}
        allBatchTagEvents={allBatchTagEvents}
        allBatchTags={allBatchTags}
        markerModal={markerModal}
        setMarkerModal={setMarkerModal}
        saveMarker={saveMarker}
        deleteMarker={deleteMarker}
        showCloseConfirm={showCloseConfirm}
        setShowCloseConfirm={setShowCloseConfirm}
        confirmClose={confirmClose}
        workspaceAlert={workspaceAlert}
        setWorkspaceAlert={setWorkspaceAlert}
        confirmUnsavedModal={confirmUnsavedModal}
        setConfirmUnsavedModal={setConfirmUnsavedModal}
        fileInputRef={fileInputRef}
        showBatchRelinkerModal={showBatchRelinkerModal}
        setShowBatchRelinkerModal={setShowBatchRelinkerModal}
        exportModalState={exportModalState}
        setExportModalState={setExportModalState}
        startRecordExport={startRecordExport}
        liveClock={liveClock}
      />

      {/* Floating Draggable & External OS Browser Popouts */}
      <WorkspaceFloatingPopouts
        liveClock={liveClock}
        periodSyncs={periodSyncs}
        isTaggingMode={isTaggingMode}
        setIsTaggingMode={setIsTaggingMode}
        activeRecording={activeRecording}
        activeRecordings={activeRecordings}
        setActiveRecordings={setActiveRecordings}
        labelsActiveTargetTab={labelsActiveTargetTab}
        selectedEventIds={selectedEventIds}
        tagEvents={tagEvents}
        filterTagId={filterTagId}
        filterLabelId={filterLabelId}
        handleLabelClick={handleLabelClick}
        showCodingPaneLabels={showCodingPaneLabels}
        setShowCodingPaneLabels={setShowCodingPaneLabels}
        labels={labels}
        setLabels={setLabels}
        labelGroups={labelGroups}
        setLabelGroups={setLabelGroups}
        labelsEnabled={labelsEnabled}
        setLabelsEnabled={setLabelsEnabled}
        tags={tags}
        setTags={setTags}
        handleTagClick={handleTagClick}
        exportEventsToCSV={exportEventsToCSV}
        isTimerPoppedOut={isTimerPoppedOut}
        setIsTimerPoppedOut={setIsTimerPoppedOut}
        isPadPoppedOut={isPadPoppedOut}
        setIsPadPoppedOut={setIsPadPoppedOut}
        poppedOutCodingMode={poppedOutCodingMode}
        setPoppedOutCodingMode={setPoppedOutCodingMode}
        timerDragControls={timerDragControls}
        padDragControls={padDragControls}
        timerWidgetPos={timerWidgetPos}
        padWidgetPos={padWidgetPos}
        timerExternalWindow={timerExternalWindow}
        setTimerExternalWindow={setTimerExternalWindow}
        padExternalWindow={padExternalWindow}
        setPadExternalWindow={setPadExternalWindow}
        externalTimerContainer={externalTimerContainer}
        setExternalTimerContainer={setExternalTimerContainer}
        externalPadContainer={externalPadContainer}
        setExternalPadContainer={setExternalPadContainer}
        openExternalWindow={openExternalWindow}
        advancedPadItems={advancedPadItems}
        setAdvancedPadItems={setAdvancedPadItems}
        connectors={connectors}
        setConnectors={setConnectors}
        isPadQuickTagEnabled={isPadQuickTagEnabled}
        handleTogglePadQuickTag={handleTogglePadQuickTag}
        setEditingLabelId={setEditingLabelId}
        setTempLabel={setTempLabel}
        showNotification={showNotification}
      />

      {trackingStudioState.isOpen && (
        <TrackingStudioModal
          isOpen={trackingStudioState.isOpen}
          initialClipIndex={trackingStudioState.clipIndex}
          project={project}
          videoUrl={videoUrl}
          playlists={playlists}
          activePlaylistId={activePlaylistId}
          setPlaylists={setPlaylists}
          syncPlaylistsToStorage={syncPlaylistsToStorage}
          allBatchTagEvents={allBatchTagEvents}
          allBatchTags={allBatchTags}
          batchMode={batchMode}
          findEventAcrossBatch={findEventAcrossBatch}
          projectFreezeFrames={freezeFrames}
          setProjectFreezeFrames={setFreezeFrames}
          projectShapes={shapes}
          setProjectShapes={setShapes}
          handleToggleClipFreezeFrameDeactivation={handleToggleClipFreezeFrameDeactivation}
          handleSetClipAllFreezeFramesDeactivation={handleSetClipAllFreezeFramesDeactivation}
          handleIsolateClipFreezeFrames={handleIsolateClipFreezeFrames}
          handleToggleClipFreezeFrameIsolation={handleToggleClipFreezeFrameIsolation}
          duplicatePlaylistEvent={duplicatePlaylistEvent}
          showNotification={showNotification}
          onClose={() => setTrackingStudioState((prev) => ({ ...prev, isOpen: false }))}
        />
      )}
    </div>
  );
};
