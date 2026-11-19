import type { BoardProject } from '../../../types';
import { getBoardProjectLocally, listBoardProjectsLocally } from '../../../utils/db';
import { getCurrentUser } from '../../../utils/userPlanStore';
import { db as tacticoDexieDb } from '../../../board/db';
import { compileAnimation } from '../../../board/utils';
import { PITCH_HEIGHT, PITCH_WIDTH } from '../../../board/constants';
import {
  PitchTemplate,
  PitchView,
  TeamSide,
  type CoinSettings,
  type Project as TacticalProject,
  type Slide as TacticalSlide,
  type Team,
} from '../../../board/types';

export interface BoardTimelineSegment {
  segmentIndex: number;
  slideIdx: number;
  slide: TacticalSlide;
  previousSlide: TacticalSlide | null;
  startTimeMs: number;
  transitionEndMs: number;
  endTimeMs: number;
  transitionDurationMs: number;
  holdDurationMs: number;
  hasAnimation: boolean;
}

export interface BoardPlaybackTimeline {
  segments: BoardTimelineSegment[];
  totalDurationMs: number;
  hasAnyAnimation: boolean;
}

const DEFAULT_COIN_SETTINGS: CoinSettings = {
  showName: true,
  showNumber: true,
  showPositionLabel: false,
  shape: 'circle',
  globalScale: 1,
  globalTextScale: 1,
  globalNamePos: 'bottom',
  orientation: 'normal',
  trails: {
    enabled: false,
    style: 'dashed',
    color: '#fbbf24',
    opacity: 0.6,
  },
  motionPaths: {
    enabled: true,
    color: '#ef4444',
  },
};

export function resolveSlideCoinSettings(
  slide?: TacticalSlide | null,
  fallbackCoinSettings?: CoinSettings | null
): CoinSettings {
  const source = slide?.coinSettings || fallbackCoinSettings;
  if (!source) return DEFAULT_COIN_SETTINGS;
  return {
    ...DEFAULT_COIN_SETTINGS,
    ...source,
    trails: {
      ...DEFAULT_COIN_SETTINGS.trails,
      ...(source.trails || {}),
    },
    motionPaths: {
      ...DEFAULT_COIN_SETTINGS.motionPaths,
      ...(source.motionPaths || {}),
    },
  };
}

export function resolvePitchTemplate(rawTemplate?: string): PitchTemplate {
  const values = Object.values(PitchTemplate) as string[];
  if (rawTemplate && values.includes(rawTemplate)) {
    return rawTemplate as PitchTemplate;
  }
  return PitchTemplate.THEME_FRESH;
}

function resolvePitchView(rawView?: string): PitchView {
  const values = Object.values(PitchView) as string[];
  if (rawView && values.includes(rawView)) {
    return rawView as PitchView;
  }
  return PitchView.HORIZONTAL;
}

function normalizeTeam(rawTeam: Partial<Team> | undefined, side: TeamSide, fallbackColor: string): Team {
  return {
    id: rawTeam?.id || side,
    name: rawTeam?.name || (side === TeamSide.HOME ? 'Home' : side === TeamSide.AWAY ? 'Away' : 'Neutral'),
    color: rawTeam?.color || fallbackColor,
    secondaryColor: rawTeam?.secondaryColor,
    players: Array.isArray(rawTeam?.players) ? rawTeam.players : [],
    logo: rawTeam?.logo,
    settings: rawTeam?.settings,
  };
}

export function isBoardSlideEmpty(slide?: TacticalSlide | null): boolean {
  if (!slide) return true;
  const posCount = Object.keys(slide.positions || {}).length;
  const drawCount = Array.isArray(slide.drawings) ? slide.drawings.length : 0;
  return posCount === 0 && drawCount === 0;
}

export function getPreferredPreviewSlideIndex(project?: TacticalProject | null): number {
  if (!project || !Array.isArray(project.slides) || project.slides.length === 0) return 0;
  const nonEmptyIdx = project.slides.findIndex((s) => !isBoardSlideEmpty(s));
  return nonEmptyIdx >= 0 ? nonEmptyIdx : 0;
}

export function countBoardProjectContentScore(proj?: Partial<TacticalProject> | null): number {
  if (!proj || !Array.isArray(proj.slides)) return 0;
  let score = proj.slides.length;
  for (const s of proj.slides) {
    if (!s) continue;
    score += Object.keys(s.positions || {}).length * 10;
    score += (Array.isArray(s.drawings) ? s.drawings.length : 0) * 10;
  }
  return score;
}

export function normalizeBoardProjectData(
  rawData: unknown,
  fallbackMeta?: Partial<BoardProject>
): TacticalProject | null {
  if (!rawData || typeof rawData !== 'object') return null;
  const candidate = rawData as Partial<TacticalProject>;
  const rawSlides = Array.isArray(candidate.slides) ? candidate.slides : [];
  if (rawSlides.length === 0 || !candidate.teams) return null;

  const baseCoinSettings = rawSlides[0]?.coinSettings;
  const slides: TacticalSlide[] = rawSlides.map((s, idx) => ({
    ...s,
    id: s?.id || `slide-${idx + 1}`,
    name: s?.name || `Slide ${idx + 1}`,
    duration: typeof s?.duration === 'number' && s.duration > 0 ? s.duration : 5,
    positions: s?.positions && typeof s.positions === 'object' ? s.positions : {},
    drawings: Array.isArray(s?.drawings) ? s.drawings : [],
    coinSettings: s?.coinSettings || baseCoinSettings,
  }));

  const rawTemplate = (candidate.pitchTemplate as string | undefined) || fallbackMeta?.pitchTemplate;
  const pitchTemplate = rawTemplate ? resolvePitchTemplate(rawTemplate) : undefined;

  return {
    name: candidate.name || fallbackMeta?.name,
    teams: {
      [TeamSide.HOME]: normalizeTeam(candidate.teams[TeamSide.HOME], TeamSide.HOME, fallbackMeta?.homeTeamColor || '#ef4444'),
      [TeamSide.AWAY]: normalizeTeam(candidate.teams[TeamSide.AWAY], TeamSide.AWAY, fallbackMeta?.awayTeamColor || '#3b82f6'),
      [TeamSide.NEUTRAL]: normalizeTeam(candidate.teams[TeamSide.NEUTRAL], TeamSide.NEUTRAL, '#eab308'),
    },
    slides,
    currentSlideId: candidate.currentSlideId || slides[0].id,
    selectedSlideIds: Array.isArray(candidate.selectedSlideIds) && candidate.selectedSlideIds.length > 0
      ? candidate.selectedSlideIds
      : [slides[0].id],
    aspectRatio: candidate.aspectRatio,
    pitchView: resolvePitchView(
      (candidate.pitchView as string | undefined) || fallbackMeta?.pitchView
    ),
    pitchWidth: candidate.pitchWidth || PITCH_WIDTH,
    pitchHeight: candidate.pitchHeight || PITCH_HEIGHT,
    pitchTemplate,
    backgroundImage: candidate.backgroundImage ?? null,
    lastSavedAt: candidate.lastSavedAt,
  };
}

function pickFresherBoardSnapshot(bp: BoardProject, dexieData?: TacticalProject | null): BoardProject {
  if (!dexieData || !Array.isArray(dexieData.slides) || dexieData.slides.length === 0) {
    return bp;
  }

  const bpData = bp.data as Partial<TacticalProject> | undefined;
  const dexieTs = dexieData.lastSavedAt || 0;
  const bpTs = bpData?.lastSavedAt || 0;

  let useDexie = false;
  if (dexieTs > 0 || bpTs > 0) {
    useDexie = dexieTs >= bpTs;
  } else {
    // Legacy snapshots without lastSavedAt: prefer whichever has actual slide/player/drawing content
    const dexieScore = countBoardProjectContentScore(dexieData);
    const bpScore = countBoardProjectContentScore(bpData);
    useDexie = dexieScore >= bpScore;
  }

  const chosenData = useDexie ? dexieData : (bp.data || dexieData);
  return {
    ...bp,
    slideCount: chosenData.slides?.length || bp.slideCount,
    pitchView: chosenData.pitchView || bp.pitchView,
    pitchTemplate: chosenData.pitchTemplate || bp.pitchTemplate,
    data: chosenData,
  };
}

export async function loadAvailableBoardProjects(): Promise<BoardProject[]> {
  const currentUid = getCurrentUser()?.id;
  const localBoards = await listBoardProjectsLocally();

  const belongs = (ownerId?: string) =>
    !currentUid || !ownerId || ownerId === currentUid || ownerId === 'guest';

  const owned = (localBoards || [])
    .filter((bp): bp is BoardProject => Boolean(bp && belongs(bp.ownerId)))
    .sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));

  // Merge fresher Dexie snapshot if present so the latest Tactical Board edits are imported
  const hydrated = await Promise.all(
    owned.map(async (bp) => {
      try {
        const dexieRecord = await tacticoDexieDb.projects.get(bp.id);
        return pickFresherBoardSnapshot(bp, dexieRecord?.data);
      } catch {
        return bp;
      }
    })
  );

  return hydrated;
}

export async function loadLiveBoardProjectById(boardProjectId: string): Promise<{
  boardData: TacticalProject;
  pitchTemplate: PitchTemplate;
  lastSavedAt: number;
} | null> {
  if (!boardProjectId) return null;
  try {
    const [bp, dexieRecord] = await Promise.all([
      getBoardProjectLocally(boardProjectId).catch(() => null),
      tacticoDexieDb.projects.get(boardProjectId).catch(() => null),
    ]);

    let mergedBp: BoardProject | null = bp;
    if (mergedBp) {
      mergedBp = pickFresherBoardSnapshot(mergedBp, dexieRecord?.data);
    }

    const rawData = mergedBp?.data || dexieRecord?.data;
    const normalized = normalizeBoardProjectData(rawData, mergedBp || undefined);
    if (!normalized) return null;

    const pitchTemplate = resolvePitchTemplate(
      (normalized.pitchTemplate as string | undefined) || mergedBp?.pitchTemplate
    );
    const lastSavedAt = Math.max(
      normalized.lastSavedAt || 0,
      mergedBp?.lastModified || 0
    );

    return {
      boardData: normalized,
      pitchTemplate,
      lastSavedAt,
    };
  } catch {
    return null;
  }
}

export function detectBoardSlideHasAnimations(
  slides: TacticalSlide[],
  slideIndex: number
): boolean {
  const slide = slides[slideIndex];
  if (!slide) return false;

  const positions = slide.positions || {};
  const drawings = Array.isArray(slide.drawings) ? slide.drawings : [];

  // Step-ordered animations on players or drawings
  if (Object.values(positions).some((pos) => (pos?.animationOrder ?? 0) > 0 || (pos?.motionPath?.length ?? 0) > 0)) {
    return true;
  }
  if (drawings.some((d) => (d?.animationOrder ?? 0) > 0)) {
    return true;
  }

  const prev = slideIndex > 0 ? slides[slideIndex - 1] : null;
  if (!prev) {
    // First slide: drawings animate in cleanly when previousSlide is null
    return drawings.length > 0;
  }

  // Compare camera changes
  const cCam = slide.camera;
  const pCam = prev.camera;
  if (
    (cCam?.zoom ?? 1) !== (pCam?.zoom ?? 1) ||
    (cCam?.panX ?? 0) !== (pCam?.panX ?? 0) ||
    (cCam?.panY ?? 0) !== (pCam?.panY ?? 0) ||
    (cCam?.rotateZ ?? 0) !== (pCam?.rotateZ ?? 0) ||
    (cCam?.rotateX ?? 0) !== (pCam?.rotateX ?? 0) ||
    (cCam?.rotateY ?? 0) !== (pCam?.rotateY ?? 0)
  ) {
    return true;
  }

  // Compare player position/rotation/scale changes between previous and current slide
  const prevPositions = prev.positions || {};
  const allPlayerIds = new Set([...Object.keys(positions), ...Object.keys(prevPositions)]);
  for (const pid of allPlayerIds) {
    const curPos = positions[pid];
    const prevPos = prevPositions[pid];
    if (!curPos || !prevPos) return true;
    if (
      Math.abs(curPos.x - prevPos.x) > 0.5 ||
      Math.abs(curPos.y - prevPos.y) > 0.5 ||
      Math.abs((curPos.rotation || 0) - (prevPos.rotation || 0)) > 0.5 ||
      Math.abs((curPos.scale || 1) - (prevPos.scale || 1)) > 0.02
    ) {
      return true;
    }
  }

  // Compare drawings added/removed/changed
  const prevDrawings = Array.isArray(prev.drawings) ? prev.drawings : [];
  if (drawings.length !== prevDrawings.length) return true;
  const prevById = new Map(prevDrawings.map((d) => [d.id, d]));
  for (const d of drawings) {
    const pd = prevById.get(d.id);
    if (!pd) return true;
    if (
      d.color !== pd.color ||
      d.text !== pd.text ||
      JSON.stringify(d.points) !== JSON.stringify(pd.points) ||
      JSON.stringify(d.props) !== JSON.stringify(pd.props)
    ) {
      return true;
    }
  }

  return false;
}

export function buildBoardPlaybackTimeline(
  project: TacticalProject | null,
  importMode: 'single-slide' | 'all-slides',
  singleSlideIndex = 0
): BoardPlaybackTimeline {
  if (!project || !project.slides || project.slides.length === 0) {
    return { segments: [], totalDurationMs: 0, hasAnyAnimation: false };
  }

  const slides = project.slides;
  const segments: BoardTimelineSegment[] = [];
  let cursorMs = 0;
  let hasAnyAnimation = false;

  if (importMode === 'single-slide') {
    const clampedIdx = Math.max(0, Math.min(slides.length - 1, singleSlideIndex));
    const slide = slides[clampedIdx];
    const prevSlide = clampedIdx > 0 ? slides[clampedIdx - 1] : null;
    const hasAnim = detectBoardSlideHasAnimations(slides, clampedIdx);
    const compiled = compileAnimation(slide);

    const transitionDurationMs = hasAnim ? Math.max(400, compiled.durationMs) : 0;
    const holdDurationMs = hasAnim
      ? Math.min(Math.max(800, (slide.duration || 2) * 1000), 2500)
      : (slide.duration || 5) * 1000;

    if (hasAnim) hasAnyAnimation = true;

    const totalMs = hasAnim ? transitionDurationMs + holdDurationMs : 0;
    segments.push({
      segmentIndex: 0,
      slideIdx: clampedIdx,
      slide,
      previousSlide: prevSlide,
      startTimeMs: 0,
      transitionEndMs: transitionDurationMs,
      endTimeMs: totalMs,
      transitionDurationMs,
      holdDurationMs: hasAnim ? holdDurationMs : 0,
      hasAnimation: hasAnim,
    });

    return {
      segments,
      totalDurationMs: totalMs,
      hasAnyAnimation,
    };
  }

  // 'all-slides': match Tactical Board's useExportAndPlayback.ts video export timeline 1:1
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const previousSlide = i > 0 ? slides[i - 1] : null;
    const hasAnim = detectBoardSlideHasAnimations(slides, i);
    if (hasAnim) hasAnyAnimation = true;

    const compiled = compileAnimation(slide);
    const transitionDurationMs = hasAnim || i > 0 ? compiled.durationMs : 0;
    const holdDurationMs = Math.max(500, (slide.duration || 5) * 1000);
    const segDuration = transitionDurationMs + holdDurationMs;

    segments.push({
      segmentIndex: i,
      slideIdx: i,
      slide,
      previousSlide,
      startTimeMs: cursorMs,
      transitionEndMs: cursorMs + transitionDurationMs,
      endTimeMs: cursorMs + segDuration,
      transitionDurationMs,
      holdDurationMs,
      hasAnimation: hasAnim,
    });
    cursorMs += segDuration;
  }

  return {
    segments,
    totalDurationMs: cursorMs,
    hasAnyAnimation: hasAnyAnimation || slides.length > 1,
  };
}

export function formatBoardDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '00:00';
  const totalSec = Math.round(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
