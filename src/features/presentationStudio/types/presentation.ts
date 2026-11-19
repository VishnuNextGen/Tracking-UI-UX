export type ThemeId =
  | 'minimal'
  | 'editorial'
  | 'modern-corporate'
  | 'dark-professional'
  | 'educational'
  | 'contemporary'
  | 'bold-typography';

export type SlideLayoutType =
  | 'title'
  | 'section-divider'
  | 'text-image'
  | 'two-column'
  | 'three-column'
  | 'comparison'
  | 'statistics'
  | 'timeline'
  | 'process'
  | 'quote'
  | 'full-image'
  | 'conclusion'
  | 'diagram'
  | 'data-viz';

export type SlideTransitionType = 'none' | 'fade' | 'slide' | 'zoom';

export interface SlideTheme {
  id: ThemeId;
  name: string;
  description: string;
  backgroundColor: string;
  surfaceColor: string;
  surfaceBorderColor: string;
  textColor: string;
  mutedTextColor: string;
  accentColor: string;
  accentContrastColor: string;
  secondaryColor: string;
  headingFont: string;
  bodyFont: string;
  monoFont: string;
  chartPalette: string[];
}

export type TextRole = 'heading' | 'subheading' | 'body' | 'quote' | 'stat-value' | 'stat-label' | 'kicker';

export interface BaseSlideElement {
  id: string;
  type:
    | 'text'
    | 'image'
    | 'shape'
    | 'icon'
    | 'chart'
    | 'table'
    | 'svg-diagram'
    | 'video-playlist'
    | 'tactical-board'
    | 'player-card'
    | 'match-comparison';
  name?: string;
  x: number; // Logical 1920px canvas coordinate
  y: number; // Logical 1080px canvas coordinate
  width: number;
  height: number;
  rotation?: number;
  zIndex: number;
  opacity?: number;
  locked?: boolean;
  visible?: boolean;
  groupId?: string;
}

export interface TextSlideElement extends BaseSlideElement {
  type: 'text';
  role?: TextRole;
  content: string;
  fontFamily: string;
  fontSize: number; // px in 1920x1080 space
  fontWeight: 300 | 400 | 500 | 600 | 700 | 800;
  italic?: boolean;
  underline?: boolean;
  textAlign: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  lineHeight: number;
  letterSpacing: number; // em
  color: string;
  backgroundColor?: string;
  padding?: number;
  borderRadius?: number;
  borderColor?: string;
  borderWidth?: number;
}

export interface ImageCropRect {
  x: number; // 0..1 normalized offset
  y: number;
  w: number; // 0..1 normalized size
  h: number;
}

export interface ImageSlideElement extends BaseSlideElement {
  type: 'image';
  assetId?: string; // Stored as Blob in IndexedDB assets table
  src?: string; // Optional dataURL / inline SVG fallback
  alt?: string;
  objectFit: 'cover' | 'contain' | 'fill';
  objectPosition?: string; // e.g. '50% 50%'
  crop?: ImageCropRect;
  borderRadius?: number;
  borderColor?: string;
  borderWidth?: number;
  lockAspectRatio?: boolean;
}

export type ShapeKind = 'rectangle' | 'circle' | 'line' | 'arrow' | 'triangle' | 'callout';

export interface ShapeSlideElement extends BaseSlideElement {
  type: 'shape';
  shapeKind: ShapeKind;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  strokeDashed?: boolean;
  borderRadius?: number;
  arrowStart?: boolean;
  arrowEnd?: boolean;
  label?: string;
  labelColor?: string;
  labelFontSize?: number;
}

export interface IconSlideElement extends BaseSlideElement {
  type: 'icon';
  iconName: string;
  color: string;
  strokeWidth?: number;
  backgroundColor?: string;
  borderRadius?: number;
  padding?: number;
}

export type ChartKind = 'bar' | 'horizontal-bar' | 'line' | 'donut';

export interface ChartDataPoint {
  label: string;
  value: number;
  secondaryValue?: number;
  color?: string;
}

export interface ChartSlideElement extends BaseSlideElement {
  type: 'chart';
  chartKind: ChartKind;
  title?: string;
  data: ChartDataPoint[];
  primaryLabel?: string;
  secondaryLabel?: string;
  textColor?: string;
  accentColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  showGrid?: boolean;
  showValues?: boolean;
}

export interface TableSlideElement extends BaseSlideElement {
  type: 'table';
  headers: string[];
  rows: string[][];
  headerBg: string;
  headerColor: string;
  cellBg: string;
  altCellBg?: string;
  cellColor: string;
  borderColor: string;
  fontSize?: number;
}

export interface DiagramNode {
  id: string;
  label: string;
  sublabel?: string;
  x: number; // 0..100 percentage inside element box
  y: number;
  color?: string;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
}

export interface SvgDiagramSlideElement extends BaseSlideElement {
  type: 'svg-diagram';
  title?: string;
  diagramStyle: 'flow' | 'cycle' | 'hierarchy';
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  accentColor: string;
  textColor: string;
  surfaceColor: string;
}

export interface ImportedPlaylistClip {
  id: string;
  projectId: string;
  projectName: string;
  playlistId: string;
  playlistName: string;
  eventId: string;
  tagName: string;
  tagColor: string;
  notes?: string;
  startTime: number;
  endTime: number;
  freezeFrames?: Array<{
    id: string;
    timestamp: number;
    duration: number;
    name?: string;
  }>;
}

export interface VideoPlaylistSlideElement extends BaseSlideElement {
  type: 'video-playlist';
  title: string;
  sourceLabel?: string;
  clips: ImportedPlaylistClip[];
  loop?: boolean;
  muted?: boolean;
  showOverlayHud?: boolean;
  showClipStrip?: boolean;
  accentColor?: string;
  backgroundColor?: string;
  borderRadius?: number;
}

export interface TacticalBoardSlideElement extends BaseSlideElement {
  type: 'tactical-board';
  title: string;
  boardProjectId: string;
  boardProjectName: string;
  pitchTemplate: string;
  boardData: unknown;
  importMode: 'single-slide' | 'all-slides';
  slideIndex?: number;
  slideName?: string;
  hasAnimations?: boolean;
  loop?: boolean;
  autoPlay?: boolean;
  showOverlayHud?: boolean;
  showSlideStrip?: boolean;
  accentColor?: string;
  backgroundColor?: string;
  borderRadius?: number;
}

export interface PlayerCardStat {
  label: string;
  value: string;
}

export interface PlayerCardSlideElement extends BaseSlideElement {
  type: 'player-card';
  playerName: string;
  jerseyNumber: string;
  position: string;
  teamName: string;
  subtitle?: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  stats: PlayerCardStat[];
  assetId?: string;
}

export interface MatchComparisonMetric {
  label: string;
  homeValue: number;
  awayValue: number;
  unit?: string;
}

export interface MatchComparisonSlideElement extends BaseSlideElement {
  type: 'match-comparison';
  title?: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: string;
  awayScore?: string;
  homeColor: string;
  awayColor: string;
  backgroundColor: string;
  textColor: string;
  metrics: MatchComparisonMetric[];
}

export type SlideElement =
  | TextSlideElement
  | ImageSlideElement
  | ShapeSlideElement
  | IconSlideElement
  | ChartSlideElement
  | TableSlideElement
  | SvgDiagramSlideElement
  | VideoPlaylistSlideElement
  | TacticalBoardSlideElement
  | PlayerCardSlideElement
  | MatchComparisonSlideElement;

export interface SlideBackground {
  type: 'solid' | 'gradient';
  color: string;
  gradientTo?: string;
  gradientAngle?: number;
}

export interface SlideSection {
  id: string;
  title: string;
  color?: string;
}

/**
 * Clean future integration metadata hooks for connecting Tacstem video projects,
 * playlists, tactical boards, and telestration frames without fake stubs.
 */
export interface FutureTacstemResourceRef {
  sourceType: 'video-project' | 'playlist-clip' | 'board-project' | 'telestration-frame' | 'batch-stats';
  sourceProjectId: string;
  sourceItemId?: string;
  timestampSec?: number;
  notes?: string;
}

export interface Slide {
  id: string;
  title: string;
  sectionId?: string;
  layout: SlideLayoutType;
  background: SlideBackground;
  transition: SlideTransitionType;
  speakerNotes?: string;
  elements: SlideElement[];
  futureSourceRefs?: FutureTacstemResourceRef[];
}

export interface PresentationProject {
  id: string;
  title: string;
  description: string;
  themeId: ThemeId;
  sections: SlideSection[];
  slides: Slide[];
  createdAt: number;
  updatedAt: number;
  favourite?: boolean;
  tags?: string[];
  aspectRatio: '16:9';
  futureLinkedTacstemIds?: {
    videoProjectIds?: string[];
    boardProjectIds?: string[];
    batchIds?: string[];
  };
}

export interface PresentationAssetRecord {
  id: string;
  presentationId: string;
  name: string;
  mimeType: string;
  blob: Blob;
  width?: number;
  height?: number;
  createdAt: number;
}

export interface PresentationExportBundle {
  schema: 'tacstem.presentation.studio.v1';
  version: 1;
  exportedAt: number;
  presentation: PresentationProject;
  embeddedAssets: Array<{
    id: string;
    name: string;
    mimeType: string;
    dataUrl: string;
    width?: number;
    height?: number;
  }>;
}
