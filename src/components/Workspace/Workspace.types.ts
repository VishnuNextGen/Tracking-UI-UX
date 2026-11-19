import type {
  Batch,
  FreezeFrame,
  Label,
  MaskSettings,
  Project,
  ProjectData,
  Tag as TagData,
  TagEvent,
} from '../../types';
import type { ExportClipItem } from './VideoExport/exportTypes';

export interface WorkspaceBatchModeProps {
  batch: Batch;
  onUpdateBatch: (batch: Batch) => void;
  allBatchProjects: Project[];
  projectBlobs: Map<string, string>;
  onSelectProject: (projectId: string) => void;
  onReloadVideo: (project: Project) => void;
  onRelinkSingleVideo?: (project: Project, file: File, handle?: any) => Promise<void> | void;
  onBatchRelinkVideos?: (mappings: { projectId: string; file: File; handle?: any }[]) => Promise<void> | void;
  onAddGamesToBatch: () => void;
  onOpenStats?: () => void;
  initialPlaylistId?: string;
  initialSeekTime?: number;
  autoPlayPlaylist?: boolean;
}

export interface WorkspaceProps {
  userPlan: 'free' | 'pro';
  videoUrl: string;
  project: Project;
  onUpdateProject: (data: ProjectData, targetId?: string) => void;
  onUpdateMetadata: (name: string, description: string) => void;
  onClose: () => void;
  onForceSync: () => void;
  onRelinkVideo?: (project: Project, isNewVideo: boolean) => void;
  onOpenBackupModal?: () => void;
  batchMode?: WorkspaceBatchModeProps;
}

export interface ExportModalState {
  isOpen: boolean;
  isPreparing?: boolean;
  playlistId?: string;
  title: string;
  clips: ExportClipItem[];
  defaultWithFreezeFrames: boolean;
  defaultMaskSettings?: MaskSettings;
  missingProjectNames?: string[];
  initError?: string;
}

export interface DraggingHandleState {
  shapeId: string;
  pointIndex?: number;
  type: 'point' | 'shape' | 'scannerHandle';
  handleType?: string;
  offsetX?: number;
  offsetY?: number;
}

export interface ArrowSettings {
  isDashed: boolean;
  isFreehand: boolean;
  isCurved: boolean;
}

export interface SpotlightSettings {
  size: number;
  intensity: number;
  rotation: number;
}

export interface LensSettings {
  size: number;
  zoom: number;
}

export interface RingSettings {
  tilt: number;
  isFilled: boolean;
  size: number;
  outlineColor: string;
  secondaryRing: boolean;
  secondaryColor: string;
  secondaryPattern: 'telemetry-8' | 'brackets-4' | 'stamina-12' | 'asymmetric-hud' | 'continuous';
  secondaryOrbit: boolean;
  bandThickness: number;
  showGlint: boolean;
}

export interface TextSettings {
  text: string;
  bgEnabled: boolean;
  colorId: number;
  bgColorId: number;
  fontSize: number;
  animation: 'none' | 'fade' | 'scale' | 'type';
}

export interface PresetTextItem {
  id: string;
  text: string;
}

export interface MarkerModalState {
  isOpen: boolean;
  x: number;
  y: number;
  mode: 'create' | 'edit';
  markerId?: string;
  time?: number;
  tempLabel: string;
  tempColor: string;
}

export interface EventNotificationState {
  message: string;
  color: string;
  id: number;
  onUndo?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface DeletedFreezeFrameRecord {
  id: string;
  name: string;
  timestamp: number;
  frame: FreezeFrame;
  shapeIds: string[];
  originalIndex: number;
}

export interface CsvImportState {
  isOpen: boolean;
  events: TagEvent[];
  newTags: TagData[];
  newLabels: Label[];
  errors: string[];
}

export interface PlaylistModalState {
  isOpen: boolean;
  mode: 'create' | 'edit';
  playlistId?: string;
  tempName: string;
}

export interface AutoplayState {
  active: boolean;
  playlistId: string | null;
  eventIndex: number;
}

export interface ContextMenuState {
  x: number;
  y: number;
  eventId: string;
}

export interface EditEventModalState {
  isOpen: boolean;
  eventId: string;
  startTime: number;
  endTime: number;
  notes: string;
}

export interface TimelineMarqueeState {
  startTime: number;
  currentTime: number;
  startX: number;
  currentX: number;
  isShift: boolean;
  initialSelectedIds: string[];
}
