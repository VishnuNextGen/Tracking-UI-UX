import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import type React from 'react';
import type {
  ColorPreset,
  FreezeFrame,
  MaskLayerCache,
  MaskSettings,
  PlayerTagSettings,
  Point,
  Project,
  Shape,
  ToolType,
} from '../../../types';
import { getDistance, getVideoLayout } from '../../../utils/math';
import { createParticles } from '../../../utils/drawing';
import {
  calculateRequiredFreezeFrameDuration,
  calculateStepAnimStart,
  getFreezeFrameStepDelay,
} from '../../../utils/freezeFrameSteps';
import { INITIAL_COLORS } from '../Workspace.constants';
import {
  DEFAULT_TELESTRATION_COLORS,
  type TelestrationColors,
  type TelestrationSlot,
} from '../TelestrationColorPresets';
import {
  DEFAULT_POLYGON_SETTINGS,
  type PolygonSettings,
  type RadarParticle,
  createPolygonShape,
  createRadarBurstParticles,
  createRadarShape,
  getHueAndSatFromColor,
} from '../Polygon';
import { DEFAULT_SCANNER_SETTINGS, type ScannerSettings, createScannerShape } from '../Scanner';
import { loadPlayerTagSettings, savePlayerTagSettings } from '../PlayerTag';
import { usePlayerMove } from '../PlayerMove';
import {
  clampPointToVideo,
  filterShapesAfterErase,
  getVideoSpacePointFromEvent,
  hitTestWorkspaceShapes,
  isPointInsideVideo,
} from '../canvas/canvasHitTest';
import { renderWorkspaceCanvases } from '../canvas/canvasRenderer';
import type {
  ArrowSettings,
  DraggingHandleState,
  LensSettings,
  PresetTextItem,
  RingSettings,
  SpotlightSettings,
  TextSettings,
} from '../Workspace.types';
import { generateNextTrackLabel, isTrackableTool } from '../../Playlist/Tracking/trackingUtils';

export interface TrackingModeCanvasConfig {
  enabled: boolean;
  defaultDuration?: number;
  minTime?: number;
  maxTime?: number;
  onTrackAdded?: (shape: Shape) => void;
}

export function useTelestrationCanvas(params: {
  project: Project;
  videoUrl: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  ghostCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  tool: ToolType;
  shapes: Shape[];
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  currentTime: number;
  isScrubbing: boolean;
  isScrubbingRef: React.MutableRefObject<boolean>;
  isScreenRecording: boolean;
  isTimelineExpanded: boolean;
  isPresentationMode: boolean;
  togglePlay: () => void;
  freezeFrames: FreezeFrame[];
  setFreezeFrames: React.Dispatch<React.SetStateAction<FreezeFrame[]>>;
  activeFreezeFrame: FreezeFrame | undefined;
  activeFreezeFrameId: string | null;
  setActiveFreezeFrameId: React.Dispatch<React.SetStateAction<string | null>>;
  isFreezeFramePlaying: boolean;
  setIsFreezeFramePlaying: React.Dispatch<React.SetStateAction<boolean>>;
  countdownValue: number;
  setCountdownValue: React.Dispatch<React.SetStateAction<number>>;
  countdownInterval: React.MutableRefObject<number | null>;
  editingAnimationFFId: string | null;
  animationPreviewTime: number;
  isAnimationPreviewPlaying: boolean;
  freezeFrameActiveSteps: Record<string, number | null>;
  currentStepForActiveFF: number | null;
  maskSettings: MaskSettings;
  maskCache: MaskLayerCache;
  isPickingColor: boolean;
  setIsPickingColor: React.Dispatch<React.SetStateAction<boolean>>;
  addColorAtPoint: (pt: Point) => void;
  selectedEventIds: Set<string>;
  setSelectedEventIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setPlaybarEventId: React.Dispatch<React.SetStateAction<string | null>>;
  showNotification: (
    message: string,
    color: string,
    onUndo?: () => void,
    action?: { label: string; onClick: () => void }
  ) => void;
  trackingMode?: TrackingModeCanvasConfig;
}) {
  const {
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
    trackingMode,
  } = params;

  const [colors, setColors] = useState<ColorPreset[]>(INITIAL_COLORS);
  const [activeColorId, setActiveColorId] = useState<number>(6);
  const [telestrationColors, setTelestrationColors] = useState<TelestrationColors>(() => {
    try {
      const saved = localStorage.getItem('tacstem_telestration_colors');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    return DEFAULT_TELESTRATION_COLORS;
  });
  const [activeTelestrationSlot, setActiveTelestrationSlot] = useState<TelestrationSlot | null>('home');
  const [toolSize, setToolSize] = useState(5);
  const [ringStrokeWidth, setRingStrokeWidth] = useState(0);
  const [undoStack, setUndoStack] = useState<Shape[][]>([]);
  const [redoStack, setRedoStack] = useState<Shape[][]>([]);

  const [isDrawing, setIsDrawing] = useState(false);
  const [activePoints, setActivePoints] = useState<Point[]>([]);
  const activePointsRef = useRef<Point[]>([]);

  useEffect(() => {
    activePointsRef.current = activePoints;
  }, [activePoints]);

  const [, setCurrentDragStart] = useState<Point | null>(null);
  const mousePosRef = useRef<Point | null>(null);
  const lastTempVideoTimeRef = useRef<number | null>(null);

  const [arrowSettings, setArrowSettings] = useState<ArrowSettings>({
    isDashed: false,
    isFreehand: false,
    isCurved: false,
  });

  const {
    playerMoveState,
    setPlayerMoveState,
    playerSelectionRect,
    setPlayerSelectionRect,
    playerSelectionRectRef,
    playerMoveStartPointRef,
    capturedSprite,
    setCapturedSprite,
    playerMoveSettings,
    setPlayerMoveSettings,
    resetPlayerMove,
    startPlayerSelection,
    updatePlayerSelection,
    finishPlayerSelection,
    createPlayerMoveShape,
  } = usePlayerMove();

  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [draggingHandle, setDraggingHandle] = useState<DraggingHandleState | null>(null);

  const [spotlightSettings, setSpotlightSettings] = useState<SpotlightSettings>({
    size: 45,
    intensity: 0.75,
    rotation: 0.45,
  });

  const [polygonSettings, setPolygonSettings] = useState<PolygonSettings>(DEFAULT_POLYGON_SETTINGS);
  const radarParticlesRef = useRef<RadarParticle[]>([]);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const [scannerSettings, setScannerSettings] = useState<ScannerSettings>(DEFAULT_SCANNER_SETTINGS);
  const [lensSettings, setLensSettings] = useState<LensSettings>({ size: 90, zoom: 2.0 });
  const [nameTagSettings, setNameTagSettings] = useState<PlayerTagSettings>(() => {
    return loadPlayerTagSettings(project.data.nameTagSettings);
  });
  const lastSavedNameTagJsonRef = useRef<string>('');

  useEffect(() => {
    const serialized = JSON.stringify(nameTagSettings);
    if (serialized !== lastSavedNameTagJsonRef.current) {
      lastSavedNameTagJsonRef.current = serialized;
      savePlayerTagSettings(nameTagSettings);
    }
  }, [nameTagSettings]);

  useEffect(() => {
    const handleTagSettingsUpdate = (e: Event) => {
      const customDetail = (e as CustomEvent)?.detail;
      const targetSettings = customDetail || loadPlayerTagSettings();
      const serialized = JSON.stringify(targetSettings);
      if (serialized !== lastSavedNameTagJsonRef.current) {
        lastSavedNameTagJsonRef.current = serialized;
        setNameTagSettings(targetSettings);
      }
    };
    window.addEventListener('tacstem_player_tags_changed', handleTagSettingsUpdate as EventListener);
    return () => {
      window.removeEventListener('tacstem_player_tags_changed', handleTagSettingsUpdate as EventListener);
    };
  }, []);

  const [ringSettings, setRingSettings] = useState<RingSettings>({
    tilt: 65,
    isFilled: true,
    size: 36,
    outlineColor: '#ffffff',
    secondaryRing: false,
    secondaryColor: '#00eaff',
    secondaryPattern: 'telemetry-8',
    secondaryOrbit: true,
    bandThickness: 50,
    showGlint: true,
  });

  const [textSettings, setTextSettings] = useState<TextSettings>({
    text: 'Edit this text',
    bgEnabled: true,
    colorId: 5,
    bgColorId: 9,
    fontSize: 14,
    animation: 'type',
  });

  const [presetTexts, setPresetTexts] = useState<PresetTextItem[]>(
    project.data.presetTexts || [
      { id: 'p1', text: 'Great Defending!' },
      { id: 'p2', text: 'Offside Review' },
    ]
  );
  const [presetBulkText, setPresetBulkText] = useState('');
  const [expandedPresetId, setExpandedPresetId] = useState<string | null>(null);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);

  const isDrawingTool = useCallback((currentTool: ToolType | null): boolean => {
    return (
      currentTool === 'pen' ||
      currentTool === 'arrow' ||
      currentTool === 'curved-arrow' ||
      currentTool === 'circle' ||
      currentTool === 'connected-circle' ||
      currentTool === 'polygon' ||
      currentTool === 'scanner' ||
      currentTool === 'name-tag' ||
      currentTool === 'player-move'
    );
  }, []);

  const currentColor = useMemo(() => {
    if (activeTelestrationSlot && telestrationColors[activeTelestrationSlot]) {
      return telestrationColors[activeTelestrationSlot];
    }
    return colors.find((c) => c.id === activeColorId)?.value || '#00eaff';
  }, [activeTelestrationSlot, telestrationColors, colors, activeColorId]);

  const handleSelectTelestrationSlot = useCallback(
    (slot: TelestrationSlot) => {
      setActiveTelestrationSlot(slot);
      const color = telestrationColors[slot];
      if (selectedShapeId) {
        setShapes((prev) => prev.map((s) => (s.id === selectedShapeId ? { ...s, color } : s)));
      }
      if (slot === 'home') {
        setNameTagSettings((prev) => (prev.activeTeam === 'A' ? prev : { ...prev, activeTeam: 'A' }));
      } else if (slot === 'away') {
        setNameTagSettings((prev) => (prev.activeTeam === 'B' ? prev : { ...prev, activeTeam: 'B' }));
      }
      const label = slot === 'home' ? 'Home' : slot === 'away' ? 'Away' : 'Neutral';
      showNotification(`Telestration: ${label} Color active (${color})`, color);
    },
    [telestrationColors, selectedShapeId, setShapes, showNotification]
  );

  const handleUpdateTelestrationColor = useCallback(
    (slot: TelestrationSlot, color: string) => {
      setTelestrationColors((prev) => {
        const next = { ...prev, [slot]: color };
        try {
          localStorage.setItem('tacstem_telestration_colors', JSON.stringify(next));
        } catch (e) {}
        return next;
      });
      if (activeTelestrationSlot === slot && selectedShapeId) {
        setShapes((prev) => prev.map((s) => (s.id === selectedShapeId ? { ...s, color } : s)));
      }
    },
    [activeTelestrationSlot, selectedShapeId, setShapes]
  );

  const handleSwapHomeAwayColors = useCallback(() => {
    setTelestrationColors((prev) => {
      const next = { ...prev, home: prev.away, away: prev.home };
      try {
        localStorage.setItem('tacstem_telestration_colors', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    showNotification('Swapped Home & Away team colors', '#c6ff1f');
  }, [showNotification]);

  const handleResetTelestrationColors = useCallback(() => {
    setTelestrationColors(DEFAULT_TELESTRATION_COLORS);
    try {
      localStorage.setItem('tacstem_telestration_colors', JSON.stringify(DEFAULT_TELESTRATION_COLORS));
    } catch (e) {}
    showNotification('Reset telestration colors to default', '#c6ff1f');
  }, [showNotification]);

  const handleCycleTelestrationSlot = useCallback(() => {
    setActiveTelestrationSlot((prev) => {
      let next: TelestrationSlot = 'home';
      if (prev === 'home') next = 'away';
      else if (prev === 'away') next = 'neutral';
      else next = 'home';

      const color = telestrationColors[next];
      if (selectedShapeId) {
        setShapes((prevShapes) => prevShapes.map((s) => (s.id === selectedShapeId ? { ...s, color } : s)));
      }
      const label = next === 'home' ? 'Home' : next === 'away' ? 'Away' : 'Neutral';
      showNotification(`Telestration: ${label} Color active (${color})`, color);
      return next;
    });
  }, [telestrationColors, selectedShapeId, setShapes, showNotification]);

  // Temp drawing rule 1: Clear temp drawings on playback
  useEffect(() => {
    if (trackingMode?.enabled) return;
    if (isPlaying) {
      setShapes((prev) => prev.filter((s) => !!s.freezeFrameId || (s.trackStartTime !== undefined && s.trackEndTime !== undefined)));
      setRedoStack([]);
      setActivePoints([]);
      setIsDrawing(false);
      setCurrentDragStart(null);
      resetPlayerMove();
      lastTempVideoTimeRef.current = null;
    }
  }, [isPlaying, resetPlayerMove, setShapes, trackingMode?.enabled]);

  // Temp drawing rule 2: Clear temp drawings when scrubbing starts
  useEffect(() => {
    if (trackingMode?.enabled) return;
    if (isScrubbing) {
      setShapes((prev) => {
        const hasTemp = prev.some((s) => !s.freezeFrameId && (s.trackStartTime === undefined || s.trackEndTime === undefined));
        if (!hasTemp) return prev;
        return prev.filter((s) => Boolean(s.freezeFrameId) || (s.trackStartTime !== undefined && s.trackEndTime !== undefined));
      });
      lastTempVideoTimeRef.current = null;
    }
  }, [isScrubbing, setShapes, trackingMode?.enabled]);

  // Temp drawing rule 3: Clear temp drawings and stale selection/drag state when freeze frame changes
  useEffect(() => {
    if (trackingMode?.enabled) return;
    setDraggingHandle(null);
    const currentFFKey = editingAnimationFFId || activeFreezeFrameId || null;
    setSelectedShapeId((prevSelected) => {
      if (!prevSelected) return null;
      const found = shapes.find((s) => s.id === prevSelected);
      if (!found) return null;
      if ((found.freezeFrameId || null) !== currentFFKey) return null;
      return prevSelected;
    });

    if (activeFreezeFrameId || activeFreezeFrame) {
      setShapes((prev) => {
        const hasTemp = prev.some((s) => !s.freezeFrameId && (s.trackStartTime === undefined || s.trackEndTime === undefined));
        if (!hasTemp) return prev;
        return prev.filter((s) => Boolean(s.freezeFrameId) || (s.trackStartTime !== undefined && s.trackEndTime !== undefined));
      });
      lastTempVideoTimeRef.current = null;
    }
  }, [activeFreezeFrameId, activeFreezeFrame, editingAnimationFFId, setShapes, trackingMode?.enabled]);

  // Clear in-progress multi-point / drag gesture whenever active tool changes or is cleared
  useEffect(() => {
    setIsDrawing(false);
    setActivePoints([]);
    setCurrentDragStart(null);
    setDraggingHandle(null);
    if (tool !== 'player-move') {
      resetPlayerMove();
    }
  }, [tool, resetPlayerMove]);

  // Temp drawing rule 4: When playbar moves away from the timestamp where temp drawing was created, clear it
  useEffect(() => {
    if (trackingMode?.enabled) return;
    if (isDrawing) return;
    const currentVideoT = videoRef.current ? videoRef.current.currentTime : currentTime;
    setShapes((prev) => {
      const tempShapes = prev.filter((s) => !s.freezeFrameId && (s.trackStartTime === undefined || s.trackEndTime === undefined));
      if (tempShapes.length === 0) return prev;

      if (activeFreezeFrameId || activeFreezeFrame) {
        return prev.filter((s) => Boolean(s.freezeFrameId) || (s.trackStartTime !== undefined && s.trackEndTime !== undefined));
      }

      const shouldClear = tempShapes.some((s) => {
        const shapeVTime = s.videoTime ?? lastTempVideoTimeRef.current;
        return shapeVTime !== null && shapeVTime !== undefined && Math.abs(currentVideoT - shapeVTime) > 0.15;
      });

      if (shouldClear) {
        lastTempVideoTimeRef.current = null;
        return prev.filter((s) => Boolean(s.freezeFrameId) || (s.trackStartTime !== undefined && s.trackEndTime !== undefined));
      }

      return prev;
    });
  }, [currentTime, activeFreezeFrameId, activeFreezeFrame, isDrawing, setShapes, videoRef, trackingMode?.enabled]);

  const getVideoSpacePoint = (e: React.MouseEvent | MouseEvent): Point => {
    return getVideoSpacePointFromEvent(e, canvasRef.current, videoRef.current);
  };

  const getHitTest = (pt: Point, scale: number, forcePaused: boolean = false) => {
    return hitTestWorkspaceShapes({
      pt,
      scale,
      shapes,
      freezeFrames,
      currentTime,
      isPlaying,
      editingAnimationFFId,
      animationPreviewTime,
      activeFreezeFrameId,
      isFreezeFramePlaying: forcePaused ? false : isFreezeFramePlaying,
      countdownValue,
    });
  };

  const handleCanvasClick = () => {
    if ((tool === null || tool === 'move') && selectedEventIds.size > 0 && !isDrawing) {
      setSelectedEventIds(new Set());
      setPlaybarEventId(null);
    }
  };

  const eraseShapesNear = (pt: Point, scale: number) => {
    const currentVideoT = videoRef.current ? videoRef.current.currentTime : currentTime;
    const candidateActiveFF =
      activeFreezeFrame ||
      (activeFreezeFrameId ? freezeFrames.find((ff) => ff.id === activeFreezeFrameId) : undefined);
    const activeFF =
      (candidateActiveFF &&
      (editingAnimationFFId === candidateActiveFF.id ||
        Math.abs(candidateActiveFF.timestamp - currentVideoT) <= 0.12)
        ? candidateActiveFF
        : undefined) || freezeFrames.find((ff) => Math.abs(ff.timestamp - currentVideoT) < 0.04);

    setShapes((prev) => {
      const remaining = filterShapesAfterErase({
        shapes: prev,
        pt,
        scale,
        activeFF,
        activeFreezeFrameId: activeFF?.id || null,
        isPlaying,
        currentTime: currentVideoT,
      });
      if (remaining.length === prev.length) return prev;
      setUndoStack((u) => {
        const nu = [...u, prev];
        return nu.length > 30 ? nu.slice(nu.length - 30) : nu;
      });
      setRedoStack([]);
      return remaining;
    });
  };

  const addShape = (shape: Shape) => {
    const currentVideoT = videoRef.current ? videoRef.current.currentTime : currentTime;
    const candidateActiveFF =
      activeFreezeFrame ||
      (activeFreezeFrameId ? freezeFrames.find((ff) => ff.id === activeFreezeFrameId) : undefined);
    const activeFF =
      (candidateActiveFF &&
      (editingAnimationFFId === candidateActiveFF.id ||
        Math.abs(candidateActiveFF.timestamp - currentVideoT) <= 0.12)
        ? candidateActiveFF
        : undefined) || freezeFrames.find((ff) => Math.abs(ff.timestamp - currentVideoT) < 0.04);
    const targetFFId = shape.freezeFrameId || activeFF?.id;

    if (!targetFFId && trackingMode?.enabled) {
      const minT = trackingMode.minTime ?? 0;
      const maxT = Math.max(minT + 0.5, trackingMode.maxTime ?? (currentVideoT + 5));
      const defaultDur = trackingMode.defaultDuration ?? 5;
      const clipSpan = Math.max(0.25, maxT - minT);
      const effectiveDur = Math.min(defaultDur, clipSpan);
      const safeCurrentT = Math.min(maxT, currentVideoT);
      let startT =
        safeCurrentT < minT && minT - safeCurrentT <= 0.1
          ? safeCurrentT
          : Math.max(minT, safeCurrentT);
      let endT = Math.max(minT, startT) + effectiveDur;
      if (endT > maxT) {
        endT = maxT;
        if (endT - startT < Math.min(0.8, clipSpan)) {
          startT = Math.min(startT, Math.max(minT, endT - effectiveDur));
        }
      }
      const flooredStart = Math.floor(startT * 1000) / 1000;
      const ceiledEnd = Math.min(maxT, Math.ceil(endT * 1000) / 1000);

      const insertShapeByLayer = (currentList: Shape[], s: Shape): Shape[] => {
        const isPoly = s.type === 'polygon' || s.type === 'radar';
        if (!isPoly) {
          return [...currentList, s];
        }
        let lastPolyIdx = -1;
        for (let i = 0; i < currentList.length; i++) {
          if (currentList[i].type === 'polygon' || currentList[i].type === 'radar') {
            lastPolyIdx = i;
          }
        }
        const next = [...currentList];
        next.splice(lastPolyIdx + 1, 0, s);
        return next;
      };

      setShapes((prev) => {
        const trackLabel = isTrackableTool(shape.type)
          ? generateNextTrackLabel(shape.type, prev)
          : undefined;
        const trackedShape: Shape = {
          ...shape,
          freezeFrameId: undefined,
          step: null,
          videoTime: flooredStart,
          trackStartTime: flooredStart,
          trackEndTime: ceiledEnd,
          ...(trackLabel ? { trackLabel } : {}),
        };
        queueMicrotask(() => {
          setUndoStack((u) => {
            const nu = [...u, prev];
            return nu.length > 30 ? nu.slice(nu.length - 30) : nu;
          });
          setRedoStack([]);
          trackingMode.onTrackAdded?.(trackedShape);
        });
        return insertShapeByLayer(prev, trackedShape);
      });
      return;
    }

    let preparedShape: Shape = { ...shape };

    if (targetFFId) {
      const ff = freezeFrames.find((f) => f.id === targetFFId);
      const stepDelay = getFreezeFrameStepDelay(ff);
      const baseDur = ff?.duration || 5;

      const effectiveFFStep =
        freezeFrameActiveSteps[targetFFId] !== undefined
          ? freezeFrameActiveSteps[targetFFId]
          : targetFFId === activeFreezeFrame?.id
            ? currentStepForActiveFF
            : 0;

      if (typeof effectiveFFStep === 'number' && !isNaN(effectiveFFStep)) {
        const step = Math.max(0, Math.floor(effectiveFFStep));
        const animStart = calculateStepAnimStart(step, stepDelay);
        const reqDuration = calculateRequiredFreezeFrameDuration(step, stepDelay, baseDur);
        const isExtending = reqDuration > baseDur;
        const finalDuration = isExtending ? reqDuration : baseDur;

        preparedShape = {
          ...preparedShape,
          freezeFrameId: targetFFId,
          step,
          animStart,
          animEnd: finalDuration,
        };

        if (isExtending && ff) {
          setFreezeFrames((prev) =>
            prev.map((f) => (f.id === targetFFId ? { ...f, duration: finalDuration } : f))
          );
          if (activeFreezeFrameId === targetFFId && !isFreezeFramePlaying) {
            setCountdownValue((prev) =>
              Number(Math.min(finalDuration, Math.max(0, prev + (finalDuration - baseDur))).toFixed(2))
            );
          }
        }

        if (activeFreezeFrameId !== targetFFId) {
          setActiveFreezeFrameId(targetFFId);
          setCountdownValue(finalDuration);
          setIsFreezeFramePlaying(false);
        }

        const insertShapeByLayer = (currentList: Shape[], s: Shape): Shape[] => {
          const isPoly = s.type === 'polygon' || s.type === 'radar';
          if (!isPoly) {
            return [...currentList, s];
          }
          let lastPolyIdx = -1;
          for (let i = 0; i < currentList.length; i++) {
            if (currentList[i].type === 'polygon' || currentList[i].type === 'radar') {
              lastPolyIdx = i;
            }
          }
          const next = [...currentList];
          next.splice(lastPolyIdx + 1, 0, s);
          return next;
        };

        setShapes((prev) => {
          setUndoStack((u) => {
            const nu = [...u, prev];
            return nu.length > 30 ? nu.slice(nu.length - 30) : nu;
          });
          const mapped = prev.map((s) => {
            if (s.freezeFrameId === targetFFId && isExtending) {
              return { ...s, animEnd: finalDuration };
            }
            return s;
          });
          return insertShapeByLayer(mapped, preparedShape);
        });
        setRedoStack([]);
        return;
      } else {
        preparedShape = {
          ...preparedShape,
          freezeFrameId: targetFFId,
          step: null,
          animStart: 0,
          animEnd: baseDur,
        };
        if (activeFreezeFrameId !== targetFFId) {
          setActiveFreezeFrameId(targetFFId);
          setCountdownValue(baseDur);
          setIsFreezeFramePlaying(false);
        }
      }
    } else {
      preparedShape.step = null;
      if (preparedShape.videoTime === undefined) {
        preparedShape.videoTime = currentVideoT;
      }
      lastTempVideoTimeRef.current = currentVideoT;
    }

    const insertShapeByLayer = (currentList: Shape[], s: Shape): Shape[] => {
      const isPoly = s.type === 'polygon' || s.type === 'radar';
      if (!isPoly) {
        return [...currentList, s];
      }
      let lastPolyIdx = -1;
      for (let i = 0; i < currentList.length; i++) {
        if (currentList[i].type === 'polygon' || currentList[i].type === 'radar') {
          lastPolyIdx = i;
        }
      }
      const next = [...currentList];
      next.splice(lastPolyIdx + 1, 0, s);
      return next;
    };

    setShapes((prev) => {
      setUndoStack((u) => {
        const nu = [...u, prev];
        return nu.length > 30 ? nu.slice(nu.length - 30) : nu;
      });
      return insertShapeByLayer(prev, preparedShape);
    });
    setRedoStack([]);
  };

  const finishDrawing = (e: React.MouseEvent) => {
    if (tool === null || tool === 'masking') return;
    if (tool === 'eraser') {
      setIsDrawing(false);
      return;
    }
    if (draggingHandle) {
      setIsDrawing(false);
      setDraggingHandle(null);
      return;
    }
    if (tool === 'move') {
      setIsDrawing(false);
      setDraggingHandle(null);
      return;
    }
    const rawPoint = getVideoSpacePoint(e);
    const isInsideVideo = isPointInsideVideo(rawPoint, videoRef.current);
    if (
      trackingMode?.enabled &&
      !isInsideVideo &&
      (tool === 'spotlight' ||
        tool === 'lens' ||
        tool === 'name-tag' ||
        tool === 'text' ||
        tool === 'circle' ||
        tool === 'connected-circle')
    ) {
      setIsDrawing(false);
      return;
    }
    const currentPoint = trackingMode?.enabled
      ? clampPointToVideo(rawPoint, videoRef.current)
      : rawPoint;
    const currentVideoT = videoRef.current ? videoRef.current.currentTime : currentTime;
    const currentActiveFF =
      activeFreezeFrame ||
      (activeFreezeFrameId ? freezeFrames.find((ff) => ff.id === activeFreezeFrameId) : undefined);
    const activeFFId = currentActiveFF?.id;

    if (tool === 'player-move') {
      if (playerMoveState === 'selecting') {
        const startPt = playerMoveStartPointRef.current || activePointsRef.current[0];
        finishPlayerSelection(
          currentPoint,
          startPt,
          videoRef.current,
          maskCache.foreground,
          maskSettings.enabled
        );
        setIsDrawing(false);
      } else if (playerMoveState === 'moving' && capturedSprite) {
        const newShape = createPlayerMoveShape(
          capturedSprite,
          currentPoint,
          currentColor,
          toolSize,
          activeFFId
        );
        addShape(newShape);
        resetPlayerMove();
        setIsDrawing(false);
      }
      return;
    }
    if (tool === 'spotlight' && isDrawing) {
      setIsDrawing(false);
      const newShape: Shape = {
        id: Date.now().toString(),
        type: 'spotlight',
        points: [currentPoint],
        color: '#ffffff',
        strokeWidth: 1,
        timestamp: Date.now(),
        freezeFrameId: activeFFId,
        spotlightConfig: {
          size: spotlightSettings.size,
          intensity: spotlightSettings.intensity,
          rotation: spotlightSettings.rotation,
          particles: createParticles(30),
        },
      };
      addShape(newShape);
      return;
    }
    if (tool === 'lens' && isDrawing) {
      setIsDrawing(false);
      const newShape: Shape = {
        id: Date.now().toString(),
        type: 'lens',
        points: [currentPoint],
        color: '#ffffff',
        strokeWidth: 1,
        timestamp: Date.now(),
        freezeFrameId: activeFFId,
        lensConfig: { radius: lensSettings.size, zoom: lensSettings.zoom },
      };
      addShape(newShape);
      return;
    }
    if (tool === 'name-tag' && isDrawing) {
      setIsDrawing(false);
      const activeTeamKey = nameTagSettings.activeTeam === 'A' ? 'teamA' : 'teamB';
      const activeTeamData = nameTagSettings[activeTeamKey];
      const allNames = [...nameTagSettings.teamA.names, ...nameTagSettings.teamB.names];
      const activeItem =
        allNames.find((n) => n.id === nameTagSettings.activeId) || activeTeamData.names[0] || allNames[0];
      const activeNameText = activeItem?.name || activeItem?.text || 'PLAYER';
      const playerNumber = activeItem?.number || '';
      const teamColor =
        activeTelestrationSlot === 'home'
          ? (telestrationColors.home || '#ef4444')
          : activeTelestrationSlot === 'away'
          ? (telestrationColors.away || '#3b82f6')
          : activeTelestrationSlot === 'neutral'
          ? (telestrationColors.neutral || '#ffff00')
          : currentColor ||
            (nameTagSettings.activeTeam === 'A'
              ? (telestrationColors?.home || colors.find((c) => c.id === nameTagSettings.teamA.colorId)?.value || '#ef4444')
              : (telestrationColors?.away || colors.find((c) => c.id === nameTagSettings.teamB.colorId)?.value || '#3b82f6'));
      const newShape: Shape = {
        id: Date.now().toString(),
        type: 'name-tag',
        points: [currentPoint],
        color: teamColor,
        strokeWidth: nameTagSettings.size,
        timestamp: Date.now(),
        freezeFrameId: activeFFId,
        text: activeNameText,
        playerNumber: playerNumber,
        nameTagConfig: {
          playerNumber: playerNumber,
          uppercase: nameTagSettings.uppercase !== false,
          showNumber: nameTagSettings.showNumber !== false,
        },
      };
      addShape(newShape);
      return;
    }
    if (tool === 'text' && isDrawing) {
      setIsDrawing(false);
      const newShape: Shape = {
        id: Date.now().toString(),
        type: 'text',
        points: [currentPoint],
        color: colors.find((c) => c.id === textSettings.colorId)?.value || '#fff',
        strokeWidth: 1,
        timestamp: Date.now(),
        freezeFrameId: activeFFId,
        text: textSettings.text,
        textConfig: {
          bgEnabled: textSettings.bgEnabled,
          bgColor: colors.find((c) => c.id === textSettings.bgColorId)?.value || '#000',
          fontSize: textSettings.fontSize,
          animation: textSettings.animation,
        },
      };
      addShape(newShape);
      return;
    }
    if (tool === 'connected-circle') {
      if (isDrawing) {
        if (activePoints.length >= 2) {
          const distToStart = getDistance(currentPoint, activePoints[0]);
          if (distToStart < ringSettings.size) {
            const newShape: Shape = {
              id: Date.now().toString(),
              type: 'connected-circle',
              points: [...activePoints],
              color: currentColor,
              strokeWidth: 0,
              timestamp: Date.now(),
              ringConfig: { ...ringSettings, tilt: 65 },
              isClosed: true,
              isFilled: ringSettings.isFilled !== false,
              freezeFrameId: activeFFId,
            };
            addShape(newShape);
            setActivePoints([]);
            setIsDrawing(false);
            return;
          }
        }
        setActivePoints((prev) => [
          ...prev,
          { x: currentPoint.x, y: currentPoint.y, r: ringSettings.size, timestamp: Date.now() },
        ]);
        setIsDrawing(false);
      }
      return;
    }
    if (tool === 'circle' && isDrawing) {
      setIsDrawing(false);
      const newShape: Shape = {
        id: Date.now().toString(),
        type: 'circle',
        points: [currentPoint],
        color: currentColor,
        strokeWidth: 0,
        timestamp: Date.now(),
        ringConfig: { ...ringSettings, tilt: 65 },
        freezeFrameId: activeFFId,
      };
      addShape(newShape);
      setActivePoints([]);
      return;
    }
    if (tool === 'radar' || (tool === 'polygon' && polygonSettings.mode === 'radar')) {
      if (isDrawing) {
        setIsDrawing(false);
        const startPt = activePointsRef.current[0] || currentPoint;
        const tiltRad = ((polygonSettings.radarTilt ?? 65) * Math.PI) / 180;
        const scaleY = Math.max(0.1, Math.cos(tiltRad));
        const dragDx = currentPoint.x - startPt.x;
        const dragDy = (currentPoint.y - startPt.y) / scaleY;
        const dragDist = Math.hypot(dragDx, dragDy);
        const finalRadius = dragDist > 15 ? Math.round(dragDist) : polygonSettings.radarRadius;

        const newShape = createRadarShape(
          startPt,
          finalRadius,
          currentColor,
          toolSize,
          polygonSettings,
          activeFFId
        );
        addShape(newShape);
        setActivePoints([]);
        activePointsRef.current = [];

        const { h } = getHueAndSatFromColor(currentColor);
        radarParticlesRef.current = [
          ...radarParticlesRef.current,
          ...createRadarBurstParticles(startPt.x, startPt.y, h, 30, polygonSettings.radarTilt ?? 65),
        ];
        return;
      }
      return;
    }
    if (tool === 'scanner' && isDrawing) {
      setIsDrawing(false);
      const startPt = activePointsRef.current[0] || currentPoint;
      const dragDist = Math.hypot(currentPoint.x - startPt.x, currentPoint.y - startPt.y);
      const targetEndPt =
        dragDist > 15
          ? currentPoint
          : {
              x: startPt.x + Math.cos(0) * scannerSettings.length,
              y: startPt.y + Math.sin(0) * scannerSettings.length,
            };

      const newShape = createScannerShape(
        startPt,
        targetEndPt,
        currentColor,
        toolSize,
        scannerSettings,
        activeFFId
      );
      addShape(newShape);
      setSelectedShapeId(newShape.id);
      setActivePoints([]);
      activePointsRef.current = [];
      return;
    }
    if (isDrawing) {
      setIsDrawing(false);
      let pointsToSave = [activePointsRef.current[0], currentPoint];
      if (tool === 'pen' && arrowSettings.isFreehand) pointsToSave = [...activePointsRef.current];

      if (
        (tool === 'curved-arrow' ||
          tool === 'curved-run-arrow' ||
          (tool === 'arrow' && arrowSettings.isCurved)) &&
        pointsToSave.length === 2
      ) {
        const p1 = pointsToSave[0];
        const p2 = pointsToSave[1];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        const arcHeight = Math.max(20, dist * 0.2);
        const nx = -dy / (dist || 1);
        const ny = dx / (dist || 1);
        const sign = ny > 0 ? -1 : 1;
        const p3 = { x: mx + nx * arcHeight * sign, y: my + ny * arcHeight * sign };
        pointsToSave.push(p3);
      }

      let finalType: ToolType = tool;
      if (tool === 'pen') finalType = arrowSettings.isFreehand ? 'pen' : 'line';

      const newShape: Shape = {
        id: Date.now().toString(),
        type: finalType,
        points: pointsToSave,
        color: currentColor,
        strokeWidth: toolSize,
        isDashed: arrowSettings.isDashed,
        isFreehand: arrowSettings.isFreehand,
        isCurved: arrowSettings.isCurved,
        timestamp: Date.now(),
        freezeFrameId: activeFFId,
      };
      addShape(newShape);
      setActivePoints([]);
      activePointsRef.current = [];
      setCurrentDragStart(null);
    }
  };

  const startDrawing = (e: React.MouseEvent) => {
    if (e.button !== 0) return;

    if ((isPickingColor || tool === 'masking') && videoRef.current) {
      const point = getVideoSpacePoint(e);
      if (isPickingColor) {
        addColorAtPoint(point);
        setIsPickingColor(false);
        return;
      }
    }

    handleCanvasClick();
    if (tool === null) {
      if (selectedShapeId !== null) {
        setSelectedShapeId(null);
        setDraggingHandle(null);
      }
      return;
    }
    if (tool === 'masking') return;
    if (isPlaying) togglePlay();
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    if (isFreezeFramePlaying) {
      setIsFreezeFramePlaying(false);
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
        countdownInterval.current = null;
      }
    }
    const startPoint = getVideoSpacePoint(e);
    if (trackingMode?.enabled && !isPointInsideVideo(startPoint, videoRef.current)) {
      if (tool === 'move') {
        setSelectedShapeId(null);
        setDraggingHandle(null);
      }
      return;
    }
    const canvas = canvasRef.current;
    if (tool === 'eraser') {
      setIsDrawing(true);
      if (canvas && videoRef.current) {
        const layout = getVideoLayout(canvas, videoRef.current);
        eraseShapesNear(startPoint, layout.scale);
      }
      return;
    }
    if (tool === 'move' || tool === 'scanner') {
      if (canvas && videoRef.current) {
        const layout = getVideoLayout(canvas, videoRef.current);
        const hit = getHitTest(startPoint, layout.scale, true);
        if (hit) {
          const hitShape = shapes.find((s) => s.id === hit.shapeId);
          if (tool === 'move' || hitShape?.type === 'scanner') {
            if (hitShape) {
              const isCurved =
                hitShape.type === 'curved-arrow' ||
                hitShape.type === 'curved-run-arrow' ||
                (hitShape.type === 'arrow' && hitShape.isCurved);
              if (isCurved && hitShape.points.length === 2) {
                const p1 = hitShape.points[0];
                const p2 = hitShape.points[1];
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const dist = Math.hypot(dx, dy);
                const mx = (p1.x + p2.x) / 2;
                const my = (p1.y + p2.y) / 2;
                const arcHeight = Math.max(20, dist * 0.2);
                const nx = -dy / (dist || 1);
                const ny = dx / (dist || 1);
                const sign = ny > 0 ? -1 : 1;
                const p3 = { x: mx + nx * arcHeight * sign, y: my + ny * arcHeight * sign };
                setShapes((prev) =>
                  prev.map((s) => (s.id === hitShape.id ? { ...s, points: [p1, p2, p3] } : s))
                );
              }
            }
            setSelectedShapeId(hit.shapeId);
            setDraggingHandle(hit);
            setIsDrawing(true);
            return;
          }
        } else if (tool === 'move') {
          setSelectedShapeId(null);
          setDraggingHandle(null);
          return;
        }
      }
      if (tool === 'move') return;
    }
    if (tool === 'player-move') {
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
      if (playerMoveState === 'idle') {
        playerMoveStartPointRef.current = startPoint;
        const initRect = { x: startPoint.x, y: startPoint.y, w: 0, h: 0 };
        setPlayerSelectionRect(initRect);
        playerSelectionRectRef.current = initRect;
        setPlayerMoveState('selecting');
        setIsDrawing(true);
        setActivePoints([startPoint]);
        activePointsRef.current = [startPoint];
      } else if (playerMoveState === 'moving') {
        finishDrawing(e);
      }
      return;
    }
    if (tool === 'spotlight' || tool === 'lens' || tool === 'name-tag' || tool === 'text') {
      setIsDrawing(true);
      return;
    }
    if (tool === 'connected-circle') {
      setIsDrawing(true);
    } else if (tool === 'circle') {
      setIsDrawing(true);
      setActivePoints([startPoint]);
      activePointsRef.current = [startPoint];
    } else if (tool === 'radar' || (tool === 'polygon' && polygonSettings.mode === 'radar')) {
      setIsDrawing(true);
      setActivePoints([startPoint]);
      activePointsRef.current = [startPoint];
    } else if (tool === 'polygon') {
      setActivePoints((prev) => {
        const res = [...prev, startPoint];
        activePointsRef.current = res;
        return res;
      });
    } else {
      setIsDrawing(true);
      setActivePoints([startPoint]);
      activePointsRef.current = [startPoint];
    }
  };

  const drawPreview = (e: React.MouseEvent) => {
    if (tool === 'masking') return;
    const rawPoint = getVideoSpacePoint(e);
    if (trackingMode?.enabled && !isDrawing && !draggingHandle && playerMoveState !== 'selecting') {
      if (!isPointInsideVideo(rawPoint, videoRef.current)) {
        mousePosRef.current = null;
        return;
      }
    }
    const currentPoint = trackingMode?.enabled
      ? clampPointToVideo(rawPoint, videoRef.current)
      : rawPoint;
    mousePosRef.current = currentPoint;
    if (tool === 'eraser' && isDrawing) {
      const canvas = canvasRef.current;
      if (canvas && videoRef.current) {
        const layout = getVideoLayout(canvas, videoRef.current);
        eraseShapesNear(currentPoint, layout.scale);
      }
      return;
    }
    if ((tool === 'move' || tool === 'scanner') && isDrawing && draggingHandle) {
      if (draggingHandle.type === 'scannerHandle') {
        setShapes((prev) =>
          prev.map((s) => {
            if (s.id !== draggingHandle.shapeId || !s.scannerConfig) return s;
            const cfg = { ...s.scannerConfig };
            const v = s.points[0];
            if (draggingHandle.handleType === 'vertex') {
              const dx = currentPoint.x - v.x;
              const dy = currentPoint.y - v.y;
              const newV = { x: currentPoint.x, y: currentPoint.y };
              const p1 = s.points[1]
                ? { x: s.points[1].x + dx, y: s.points[1].y + dy }
                : {
                    x: newV.x + Math.cos(cfg.baseAngle ?? 0) * (cfg.length || 150),
                    y: newV.y + Math.sin(cfg.baseAngle ?? 0) * (cfg.length || 150),
                  };
              return { ...s, points: [newV, p1] };
            } else if (draggingHandle.handleType === 'tip') {
              const dx = currentPoint.x - v.x;
              const dy = currentPoint.y - v.y;
              const newLen = Math.max(30, Math.hypot(dx, dy));
              const newAngle = Math.atan2(dy, dx);
              const p1 = { x: v.x + Math.cos(newAngle) * newLen, y: v.y + Math.sin(newAngle) * newLen };
              return {
                ...s,
                points: [v, p1],
                scannerConfig: { ...cfg, length: Math.round(newLen), baseAngle: newAngle },
              };
            } else if (
              draggingHandle.handleType === 'leftHandle' ||
              draggingHandle.handleType === 'rightHandle'
            ) {
              const dx = currentPoint.x - v.x;
              const dy = currentPoint.y - v.y;
              const mouseAngle = Math.atan2(dy, dx);
              let diff = mouseAngle - (cfg.baseAngle ?? 0);
              while (diff > Math.PI) diff -= Math.PI * 2;
              while (diff < -Math.PI) diff += Math.PI * 2;
              const newSweep = Math.max(10, Math.min(180, (Math.abs(diff) * 2 * 180) / Math.PI));
              return { ...s, scannerConfig: { ...cfg, sweepRange: Math.round(newSweep) } };
            }
            return s;
          })
        );
        return;
      }
      setShapes((prev) =>
        prev.map((s) => {
          if (s.id !== draggingHandle.shapeId) return s;
          const newPoints = [...s.points];
          const isCurved =
            s.type === 'curved-arrow' || s.type === 'curved-run-arrow' || (s.type === 'arrow' && s.isCurved);
          if (isCurved && newPoints.length === 2) {
            const p1 = newPoints[0];
            const p2 = newPoints[1];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dist = Math.hypot(dx, dy);
            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;
            const arcHeight = Math.max(20, dist * 0.2);
            const nx = -dy / (dist || 1);
            const ny = dx / (dist || 1);
            const sign = ny > 0 ? -1 : 1;
            newPoints.push({ x: mx + nx * arcHeight * sign, y: my + ny * arcHeight * sign });
          }

          if (draggingHandle.type === 'point' && draggingHandle.pointIndex !== undefined) {
            const idx = draggingHandle.pointIndex;
            if (isCurved && newPoints.length >= 3) {
              if (idx === 0) {
                const deltaX = currentPoint.x - newPoints[0].x;
                const deltaY = currentPoint.y - newPoints[0].y;
                newPoints[0] = { ...newPoints[0], x: currentPoint.x, y: currentPoint.y };
                newPoints[2] = {
                  ...newPoints[2],
                  x: newPoints[2].x + deltaX * 0.5,
                  y: newPoints[2].y + deltaY * 0.5,
                };
              } else if (idx === 1) {
                const deltaX = currentPoint.x - newPoints[1].x;
                const deltaY = currentPoint.y - newPoints[1].y;
                newPoints[1] = { ...newPoints[1], x: currentPoint.x, y: currentPoint.y };
                newPoints[2] = {
                  ...newPoints[2],
                  x: newPoints[2].x + deltaX * 0.5,
                  y: newPoints[2].y + deltaY * 0.5,
                };
              } else if (idx === 2) {
                newPoints[2] = { ...newPoints[2], x: currentPoint.x, y: currentPoint.y };
              }
            } else {
              newPoints[idx] = { ...newPoints[idx], x: currentPoint.x, y: currentPoint.y };
            }
          } else if (draggingHandle.type === 'shape') {
            const dx = currentPoint.x - (draggingHandle.offsetX || 0) - newPoints[0].x;
            const dy = currentPoint.y - (draggingHandle.offsetY || 0) - newPoints[0].y;
            for (let i = 0; i < newPoints.length; i++) {
              newPoints[i] = { ...newPoints[i], x: newPoints[i].x + dx, y: newPoints[i].y + dy };
            }
            if (s.box) {
              return { ...s, points: newPoints, box: { ...s.box, x: s.box.x + dx, y: s.box.y + dy } };
            }
          }
          return { ...s, points: newPoints };
        })
      );
      return;
    }
    if (tool === 'player-move') {
      if (playerMoveState === 'selecting') {
        const startPt =
          playerMoveStartPointRef.current ||
          activePointsRef.current[0] ||
          (playerSelectionRectRef.current
            ? { x: playerSelectionRectRef.current.x, y: playerSelectionRectRef.current.y }
            : currentPoint);
        updatePlayerSelection(currentPoint, startPt);
      }
      return;
    }
    if (!isDrawing && tool === 'connected-circle') {
      return;
    }
    if (isDrawing && tool === 'pen' && arrowSettings.isFreehand) {
      activePointsRef.current.push(currentPoint);
      return;
    }
  };

  const handleDoubleClick = () => {
    const currentVideoT = videoRef.current ? videoRef.current.currentTime : currentTime;
    const currentActiveFF =
      activeFreezeFrame ||
      (activeFreezeFrameId ? freezeFrames.find((ff) => ff.id === activeFreezeFrameId) : undefined);
    const activeFFId = currentActiveFF?.id;
    if (tool === 'polygon' && polygonSettings.mode !== 'radar' && activePoints.length > 2) {
      const finalPts = [...activePoints];
      if (finalPts.length > 0) finalPts.pop();
      const newShape = createPolygonShape(
        finalPts,
        currentColor,
        toolSize,
        polygonSettings.fillStyle,
        activeFFId
      );
      addShape(newShape);
      setActivePoints([]);
    }
    if (tool === 'connected-circle') {
      if (activePoints.length > 0) {
        const finalPts = [...activePoints];
        if (finalPts.length > 0) finalPts.pop();
        const newShape: Shape = {
          id: Date.now().toString(),
          type: 'connected-circle',
          points: finalPts,
          color: currentColor,
          strokeWidth: 0,
          timestamp: 0,
          ringConfig: { ...ringSettings },
          isClosed: false,
          freezeFrameId: activeFFId,
        };
        addShape(newShape);
      }
      setActivePoints([]);
      setIsDrawing(false);
      setCurrentDragStart(null);
    }
  };

  const renderCanvas = useCallback(() => {
    renderWorkspaceCanvases({
      canvas: canvasRef.current,
      ghostCanvas: ghostCanvasRef.current,
      video: videoRef.current,
      activePts: activePointsRef.current,
      mousePos: mousePosRef.current,
      isPlaying,
      isScrubbing,
      isScrubbingRefCurrent: isScrubbingRef.current,
      isDrawing,
      isScreenRecording,
      maskSettings,
      maskCache,
      shapes,
      freezeFrames,
      activeFreezeFrame,
      activeFreezeFrameId,
      editingAnimationFFId,
      isAnimationPreviewPlaying,
      isFreezeFramePlaying,
      animationPreviewTime,
      countdownValue,
      selectedShapeId,
      freezeFrameActiveSteps,
      currentStepForActiveFF,
      tool,
      currentColor,
      toolSize,
      arrowSettings,
      ringSettings,
      spotlightSettings,
      polygonSettings,
      scannerSettings,
      lensSettings,
      nameTagSettings,
      textSettings,
      colors,
      playerMoveState,
      playerMoveStartPoint: playerMoveStartPointRef.current,
      capturedSprite,
      playerMoveSettings,
      radarParticlesRef,
      imageCache: imageCacheRef.current,
    });
  }, [
    canvasRef,
    ghostCanvasRef,
    videoRef,
    shapes,
    isDrawing,
    activePoints,
    tool,
    currentColor,
    toolSize,
    ringStrokeWidth,
    maskSettings,
    maskCache,
    isPlaying,
    isScrubbing,
    isScrubbingRef,
    isScreenRecording,
    playerMoveState,
    playerMoveStartPointRef,
    capturedSprite,
    playerMoveSettings,
    ringSettings,
    arrowSettings,
    spotlightSettings,
    polygonSettings,
    scannerSettings,
    lensSettings,
    freezeFrames,
    activeFreezeFrame,
    activeFreezeFrameId,
    isFreezeFramePlaying,
    isAnimationPreviewPlaying,
    freezeFrameActiveSteps,
    currentStepForActiveFF,
    nameTagSettings,
    textSettings,
    colors,
    editingAnimationFFId,
    animationPreviewTime,
    countdownValue,
    selectedShapeId,
  ]);

  useEffect(() => {
    let animationFrameId: number;
    const animate = () => {
      renderCanvas();
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, [renderCanvas]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (activePoints.length > 0 || isDrawing || playerMoveState !== 'idle') {
      setActivePoints([]);
      setIsDrawing(false);
      resetPlayerMove();
      setCurrentDragStart(null);
      renderCanvas();
      return;
    }
    if (tool === 'scanner' || tool === 'move') {
      const canvas = canvasRef.current;
      if (canvas && videoRef.current) {
        const layout = getVideoLayout(canvas, videoRef.current);
        const pt = getVideoSpacePoint(e);
        const hit = getHitTest(pt, layout.scale);
        if (hit && shapes.find((s) => s.id === hit.shapeId)?.type === 'scanner') {
          setShapes((prev) => prev.filter((s) => s.id !== hit.shapeId));
          if (selectedShapeId === hit.shapeId) setSelectedShapeId(null);
          return;
        }
      }
    }
  };

  const undo = () => {
    setUndoStack((prevUndo) => {
      if (prevUndo.length === 0) return prevUndo;
      const lastState = prevUndo[prevUndo.length - 1];
      setShapes((currentShapes) => {
        setRedoStack((r) => {
          const nr = [...r, currentShapes];
          return nr.length > 30 ? nr.slice(nr.length - 30) : nr;
        });
        return lastState;
      });
      return prevUndo.slice(0, -1);
    });
  };

  const redo = () => {
    setRedoStack((prevRedo) => {
      if (prevRedo.length === 0) return prevRedo;
      const nextState = prevRedo[prevRedo.length - 1];
      setShapes((currentShapes) => {
        setUndoStack((u) => {
          const nu = [...u, currentShapes];
          return nu.length > 30 ? nu.slice(nu.length - 30) : nu;
        });
        return nextState;
      });
      return prevRedo.slice(0, -1);
    });
  };

  const clearAll = () => {
    const currentActiveFF =
      activeFreezeFrame ||
      (activeFreezeFrameId ? freezeFrames.find((ff) => ff.id === activeFreezeFrameId) : undefined);
    const currentFFId = activeFreezeFrameId || (currentActiveFF ? currentActiveFF.id : null);

    if (trackingMode?.enabled && !currentFFId) {
      setShapes((prev) => {
        const remaining = prev.filter((shape) => Boolean(shape.freezeFrameId) || Boolean(shape.trackLocked));
        if (remaining.length === prev.length) return prev;
        setUndoStack((u) => {
          const nu = [...u, prev];
          return nu.length > 30 ? nu.slice(nu.length - 30) : nu;
        });
        setRedoStack([]);
        return remaining;
      });
      setActivePoints([]);
      setIsDrawing(false);
      setCurrentDragStart(null);
      resetPlayerMove();
      return;
    }

    setShapes((prev) => {
      const remaining = prev.filter(
        (shape) =>
          (shape.freezeFrameId && shape.freezeFrameId !== currentFFId) ||
          (trackingMode?.enabled && !shape.freezeFrameId && shape.trackStartTime !== undefined)
      );
      if (remaining.length === prev.length) return prev;
      setUndoStack((u) => {
        const nu = [...u, prev];
        return nu.length > 30 ? nu.slice(nu.length - 30) : nu;
      });
      setRedoStack([]);
      return remaining;
    });
    setActivePoints([]);
    setIsDrawing(false);
    setCurrentDragStart(null);
    resetPlayerMove();
  };

  useEffect(() => {
    const syncSize = () => {
      const dpr = window.devicePixelRatio || 1;
      if (containerRef.current && canvasRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        canvasRef.current.width = clientWidth * dpr;
        canvasRef.current.height = clientHeight * dpr;
      }
      if (containerRef.current && ghostCanvasRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        ghostCanvasRef.current.width = clientWidth * dpr;
        ghostCanvasRef.current.height = clientHeight * dpr;
      }
    };
    const resizeObserver = new ResizeObserver(syncSize);
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', syncSize);
    syncSize();
    return () => {
      window.removeEventListener('resize', syncSize);
      resizeObserver.disconnect();
    };
  }, [videoUrl, isTimelineExpanded, isPresentationMode, containerRef, canvasRef, ghostCanvasRef]);

  const handleColorRightClick = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    const input = document.createElement('input');
    input.type = 'color';
    input.value = colors.find((c) => c.id === id)?.value || '#ffffff';
    input.onchange = (ev) => {
      const val = (ev.target as HTMLInputElement).value;
      setColors((prev) => prev.map((c) => (c.id === id ? { ...c, value: val } : c)));
    };
    input.click();
  };

  const handleTelestrationRightClick = (e: React.MouseEvent, slot: TelestrationSlot) => {
    e.preventDefault();
    const input = document.createElement('input');
    input.type = 'color';
    input.value = telestrationColors[slot] || DEFAULT_TELESTRATION_COLORS[slot];
    input.onchange = (ev) => {
      const val = (ev.target as HTMLInputElement).value;
      handleUpdateTelestrationColor(slot, val);
    };
    input.click();
  };

  return {
    colors,
    setColors,
    activeColorId,
    setActiveColorId,
    telestrationColors,
    setTelestrationColors,
    activeTelestrationSlot,
    setActiveTelestrationSlot,
    toolSize,
    setToolSize,
    ringStrokeWidth,
    setRingStrokeWidth,
    undoStack,
    setUndoStack,
    redoStack,
    setRedoStack,
    isDrawing,
    setIsDrawing,
    activePoints,
    setActivePoints,
    mousePosRef,
    arrowSettings,
    setArrowSettings,
    playerMoveState,
    setPlayerMoveState,
    playerSelectionRect,
    setPlayerSelectionRect,
    capturedSprite,
    setCapturedSprite,
    playerMoveSettings,
    setPlayerMoveSettings,
    resetPlayerMove,
    startPlayerSelection,
    selectedShapeId,
    setSelectedShapeId,
    draggingHandle,
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
    editingNameId,
    setEditingNameId,
    isDrawingTool,
    currentColor,
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
    renderCanvas,
    handleColorRightClick,
    handleTelestrationRightClick,
  };
}
