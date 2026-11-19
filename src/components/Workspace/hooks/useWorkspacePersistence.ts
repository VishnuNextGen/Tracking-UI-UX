import { useRef, useEffect, useCallback, type MutableRefObject } from 'react';
import type {
  Project,
  ProjectData,
  Playlist,
  Shape,
  FreezeFrame,
  Tag,
  TagEvent,
  TimelineMarker,
  Label,
  LabelGroup,
  AdvancedPadItem,
  SmartConnector,
  PeriodSync,
  PlayerTagSettings,
  ToolType,
} from '../../../types';
import type { WorkspaceBatchModeProps } from '../Workspace.types';
import { DEFAULT_TAGS } from '../Workspace.constants';
import { loadPlayerTagSettings } from '../PlayerTag';

export interface UseWorkspacePersistenceProps {
  project: Project;
  videoUrl: string;
  isLive: boolean;
  batchMode?: WorkspaceBatchModeProps;
  onUpdateProject: (data: ProjectData, projectId?: string) => void;
  onClose: () => void;
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  shapes: Shape[];
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
  freezeFrames: FreezeFrame[];
  setFreezeFrames: React.Dispatch<React.SetStateAction<FreezeFrame[]>>;
  tags: Tag[];
  setTags: React.Dispatch<React.SetStateAction<Tag[]>>;
  tagEvents: TagEvent[];
  setTagEvents: React.Dispatch<React.SetStateAction<TagEvent[]>>;
  resetTagEventsForProjectSwitch: (events: TagEvent[]) => void;
  labels: Label[];
  setLabels: React.Dispatch<React.SetStateAction<Label[]>>;
  labelGroups: LabelGroup[];
  setLabelGroups: React.Dispatch<React.SetStateAction<LabelGroup[]>>;
  labelEvents: any[];
  setLabelEvents: React.Dispatch<React.SetStateAction<any[]>>;
  markers: TimelineMarker[];
  setMarkers: React.Dispatch<React.SetStateAction<TimelineMarker[]>>;
  playlists: Playlist[];
  setPlaylists: React.Dispatch<React.SetStateAction<Playlist[]>>;
  activePlaylistId: string;
  setActivePlaylistId: React.Dispatch<React.SetStateAction<string>>;
  presetTexts: { id: string; text: string }[];
  setPresetTexts: React.Dispatch<React.SetStateAction<{ id: string; text: string }[]>>;
  projectNotes: string;
  setProjectNotes: React.Dispatch<React.SetStateAction<string>>;
  periodSyncs: PeriodSync[];
  setPeriodSyncs: React.Dispatch<React.SetStateAction<PeriodSync[]>>;
  advancedPadItems: AdvancedPadItem[];
  setAdvancedPadItems: React.Dispatch<React.SetStateAction<AdvancedPadItem[]>>;
  connectors: SmartConnector[];
  setConnectors: React.Dispatch<React.SetStateAction<SmartConnector[]>>;
  nameTagSettings: PlayerTagSettings;
  setNameTagSettings: React.Dispatch<React.SetStateAction<PlayerTagSettings>>;
  setInfoForm: React.Dispatch<React.SetStateAction<{ name: string; description: string }>>;
  setUndoStack: React.Dispatch<React.SetStateAction<any[]>>;
  setRedoStack: React.Dispatch<React.SetStateAction<any[]>>;
  selectedEventIds: Set<string>;
  setSelectedEventIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelectedEventLogs: React.Dispatch<React.SetStateAction<Set<string>>>;
  setPlaybarEventId: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveFreezeFrameId: React.Dispatch<React.SetStateAction<string | null>>;
  setFreezeFrameActiveSteps: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setActiveStep: (step: number) => void;
  isDrawing: boolean;
  setIsDrawing: React.Dispatch<React.SetStateAction<boolean>>;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  autoplay: { active: boolean };
  tool: ToolType;
}

export const useWorkspacePersistence = ({
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
}: UseWorkspacePersistenceProps) => {
  // Refs for seamless cross-project batch playlist playback & autosave
  const prevProjectIdRef = useRef<string>(project.id);
  const pendingSeekTimeRef = useRef<number | null>(
    batchMode?.initialSeekTime !== undefined ? batchMode.initialSeekTime : null
  );
  const pendingPlayRef = useRef<boolean>(Boolean(batchMode?.autoPlayPlaylist));
  const latestProjectDataRef = useRef<ProjectData>({ ...project.data });

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

  // Synchronize latestProjectDataRef with all state variables
  useEffect(() => {
    latestProjectDataRef.current = {
      ...project.data,
      shapes: shapes.filter((s) => Boolean(s.freezeFrameId)),
      freezeFrames,
      tags,
      tagEvents,
      playlists: batchMode ? project.data.playlists : playlists,
      markers,
      presetTexts,
      projectNotes,
      labelGroups,
      labels,
      labelEvents,
      advancedPadItems,
      connectors,
      periodSyncs,
      nameTagSettings,
      ...(isLive ? { liveTime: currentTime } : {}),
    };
  }, [
    shapes,
    freezeFrames,
    tags,
    tagEvents,
    playlists,
    markers,
    presetTexts,
    projectNotes,
    labelGroups,
    labels,
    labelEvents,
    advancedPadItems,
    connectors,
    periodSyncs,
    nameTagSettings,
    batchMode,
    isLive,
    currentTime,
    project.data,
  ]);

  // Sync state when project changes in batch mode without unmounting Workspace
  useEffect(() => {
    if (prevProjectIdRef.current === project.id) return;

    if (prevProjectIdRef.current) {
      onUpdateProject(latestProjectDataRef.current, prevProjectIdRef.current);
    }
    prevProjectIdRef.current = project.id;

    setShapes(project.data.shapes || []);
    setFreezeFrames(project.data.freezeFrames || []);
    setTags(project.data.tags || DEFAULT_TAGS);
    resetTagEventsForProjectSwitch(project.data.tagEvents || []);
    setLabels(project.data.labels || []);
    setLabelGroups(project.data.labelGroups || []);
    setLabelEvents(project.data.labelEvents || []);
    setMarkers(project.data.markers || []);
    if (
      !batchMode &&
      project.data?.playlists &&
      Array.isArray(project.data.playlists) &&
      project.data.playlists.length > 0
    ) {
      setPlaylists(project.data.playlists);
      if (!project.data.playlists.some((p) => p.id === activePlaylistId)) {
        setActivePlaylistId(project.data.playlists[0].id);
      }
    }
    setPresetTexts(
      project.data.presetTexts || [
        { id: '1', text: 'Good pressure' },
        { id: '2', text: 'Compact shape' },
        { id: '3', text: 'Switch play' },
        { id: '4', text: 'Overload' },
        { id: '5', text: 'Counter attack' },
      ]
    );
    setProjectNotes(project.data.projectNotes || '');
    setPeriodSyncs(project.data.periodSyncs || []);
    setConnectors(project.data.connectors || []);
    setAdvancedPadItems(project.data.advancedPadItems || []);
    if (project.data.nameTagSettings) {
      setNameTagSettings(loadPlayerTagSettings(project.data.nameTagSettings));
    }
    setInfoForm({ name: project.name || '', description: project.description || '' });
    setUndoStack([]);
    setRedoStack([]);
    setSelectedEventIds(new Set());
    setSelectedEventLogs(new Set());
    setPlaybarEventId(null);
    setActiveFreezeFrameId(null);
    setFreezeFrameActiveSteps({});
    setActiveStep(0);
    setIsDrawing(false);

    if (pendingSeekTimeRef.current === null) {
      const initTime = project.fileName === 'live' ? project.data.liveTime || 0 : 0;
      setCurrentTime(initTime);
      if (videoRef.current) {
        videoRef.current.currentTime = initTime;
      }
    }
  }, [project.id]);

  // Immediate flush on tab close, reload, or navigate
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (latestProjectDataRef.current && project.id) {
        onUpdateProject(latestProjectDataRef.current, project.id);
        if (batchMode) {
          batchMode.onUpdateBatch({
            ...batchMode.batch,
            playlists,
            lastModified: Date.now(),
          });
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [project.id, batchMode, playlists, onUpdateProject]);

  // Immediate seek/play when videoUrl changes and video is ready
  useEffect(() => {
    if (
      videoRef.current &&
      pendingSeekTimeRef.current !== null &&
      (videoRef.current.currentSrc === videoUrl || videoRef.current.src === videoUrl) &&
      videoRef.current.readyState >= 1
    ) {
      const seekTo = pendingSeekTimeRef.current;
      pendingSeekTimeRef.current = null;
      videoRef.current.currentTime = seekTo;
      setCurrentTime(seekTo);
      if (pendingPlayRef.current || isPlaying || autoplay.active) {
        pendingPlayRef.current = false;
        setIsPlaying(true);
        videoRef.current.play().catch((e) => console.log('Video resume error:', e));
      }
    }
  }, [videoUrl, isPlaying, autoplay.active]);

  // Debounced autosave to parent
  useEffect(() => {
    const timeout = setTimeout(() => {
      onUpdateProject({
        ...project.data,
        shapes,
        freezeFrames,
        tags,
        tagEvents,
        playlists: batchMode ? project.data.playlists : playlists,
        markers,
        presetTexts,
        projectNotes,
        labelGroups,
        labels,
        labelEvents,
        advancedPadItems,
        connectors,
        periodSyncs,
        nameTagSettings,
        ...(isLive ? { liveTime: currentTime } : {}),
      });
      if (batchMode) {
        batchMode.onUpdateBatch({
          ...batchMode.batch,
          playlists,
          lastModified: Date.now(),
        });
      }
    }, 1000);
    return () => clearTimeout(timeout);
  }, [
    shapes,
    freezeFrames,
    tags,
    tagEvents,
    playlists,
    markers,
    presetTexts,
    projectNotes,
    labelGroups,
    labels,
    labelEvents,
    advancedPadItems,
    connectors,
    periodSyncs,
    nameTagSettings,
    batchMode,
  ]);

  const handleCanvasClick = useCallback(() => {
    if ((tool === null || tool === 'move') && selectedEventIds.size > 0 && !isDrawing) {
      setSelectedEventIds(new Set());
      setPlaybarEventId(null);
    }
  }, [tool, selectedEventIds.size, isDrawing, setSelectedEventIds, setPlaybarEventId]);

  const confirmClose = useCallback(() => {
    onUpdateProject({
      ...project.data,
      shapes,
      freezeFrames,
      tags,
      tagEvents,
      playlists: batchMode ? project.data.playlists : playlists,
      markers,
      presetTexts,
      projectNotes,
      labelGroups,
      labels,
      labelEvents,
      advancedPadItems,
      connectors,
      periodSyncs,
      nameTagSettings,
      ...(isLive ? { liveTime: currentTime } : {}),
    });
    if (batchMode) {
      batchMode.onUpdateBatch({
        ...batchMode.batch,
        playlists,
        lastModified: Date.now(),
      });
    }
    onClose();
  }, [
    onUpdateProject,
    project.data,
    shapes,
    freezeFrames,
    tags,
    tagEvents,
    batchMode,
    project.data.playlists,
    playlists,
    markers,
    presetTexts,
    projectNotes,
    labelGroups,
    labels,
    labelEvents,
    advancedPadItems,
    connectors,
    periodSyncs,
    nameTagSettings,
    isLive,
    currentTime,
    onClose,
  ]);

  return {
    prevProjectIdRef,
    pendingSeekTimeRef,
    pendingPlayRef,
    latestProjectDataRef,
    syncPlaylistsToStorage,
    handleCanvasClick,
    confirmClose,
  };
};
