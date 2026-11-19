import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import type React from 'react';
import type { FreezeFrame, MaskLayerCache, MaskSettings, PlaylistItem, Project, Shape, ToolType } from '../../../types';
import { formatTime } from '../../../utils/math';
import {
  DEFAULT_STEP_DELAY,
  calculateRequiredFreezeFrameDuration,
  calculateStepAnimStart,
  getFreezeFrameStepDelay,
} from '../../../utils/freezeFrameSteps';
import { getClipInstanceId, isFreezeFrameActiveForClip } from '../../../utils/playlistUtils';
import type { DeletedFreezeFrameRecord } from '../Workspace.types';

const FF_UNDO_DURATION = 8000; // 8 seconds timeout

export function useFreezeFrames(params: {
  project: Project;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  currentTime: number;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  duration: number;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  shapes: Shape[];
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
  setTool: React.Dispatch<React.SetStateAction<ToolType>>;
  maskSettings: MaskSettings;
  maskCache: MaskLayerCache;
  onFreezeFrameCreatedInClip?: (newFF: FreezeFrame, clipHint: PlaylistItem) => void;
  externalFreezeFrames?: FreezeFrame[];
  externalSetFreezeFrames?: React.Dispatch<React.SetStateAction<FreezeFrame[]>>;
  showNotification: (
    message: string,
    color: string,
    onUndo?: () => void,
    action?: { label: string; onClick: () => void }
  ) => void;
}) {
  const {
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
    onFreezeFrameCreatedInClip,
    externalFreezeFrames,
    externalSetFreezeFrames,
    showNotification,
  } = params;

  const [hoveredFreezeFrameId, setHoveredFreezeFrameId] = useState<string | null>(null);
  const [editingAnimationFFId, setEditingAnimationFFId] = useState<string | null>(null);
  const [animationPreviewTime, setAnimationPreviewTime] = useState<number>(0);
  const [isAnimationPreviewPlaying, setIsAnimationPreviewPlaying] = useState<boolean>(false);
  const [animationPanelWidth, setAnimationPanelWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth * 0.6 : 500
  );
  const [isResizingAnimPanel, setIsResizingAnimPanel] = useState<boolean>(false);

  // Ensure animation timeline opens at 60% of screen size
  useEffect(() => {
    if (editingAnimationFFId && typeof window !== 'undefined') {
      setAnimationPanelWidth(Math.round(window.innerWidth * 0.6));
    }
  }, [editingAnimationFFId]);

  const [internalFreezeFrames, setInternalFreezeFrames] = useState<FreezeFrame[]>(project.data.freezeFrames);
  const freezeFrames = externalFreezeFrames ?? internalFreezeFrames;
  const setFreezeFrames = externalSetFreezeFrames ?? setInternalFreezeFrames;
  const [freezeFramePanelScope, setFreezeFramePanelScope] = useState<'clip' | 'all'>('clip');
  const triggeredFreezeFrames = useRef<Set<string>>(new Set());
  const [activeFreezeFrameId, setActiveFreezeFrameId] = useState<string | null>(null);
  const [isFreezeFramePlaying, setIsFreezeFramePlaying] = useState<boolean>(false);
  const [countdownValue, setCountdownValue] = useState(0);
  const countdownInterval = useRef<number | null>(null);
  const [activeStep, setActiveStep] = useState<number | null>(0);
  const [freezeFrameActiveSteps, setFreezeFrameActiveSteps] = useState<Record<string, number | null>>({});
  const freezeFrameActiveStepsRef = useRef<Record<string, number | null>>(freezeFrameActiveSteps);
  freezeFrameActiveStepsRef.current = freezeFrameActiveSteps;
  const prevActiveFFIdRef = useRef<string | null>(null);

  // Deleted Freeze Frame Undo Notification State
  const [deletedFFStack, setDeletedFFStack] = useState<DeletedFreezeFrameRecord[]>([]);
  const [ffExpiryTime, setFfExpiryTime] = useState<number | null>(null);
  const [ffRemainingSeconds, setFfRemainingSeconds] = useState<number>(8);
  const [ffProgressPercent, setFfProgressPercent] = useState<number>(100);

  useEffect(() => {
    if (!ffExpiryTime || deletedFFStack.length === 0) {
      setFfRemainingSeconds(8);
      setFfProgressPercent(100);
      return;
    }

    const update = () => {
      const remainingMs = ffExpiryTime - Date.now();
      if (remainingMs <= 0) {
        setDeletedFFStack([]);
        setFfExpiryTime(null);
      } else {
        setFfRemainingSeconds(Math.ceil(remainingMs / 1000));
        setFfProgressPercent(Math.max(0, (remainingMs / FF_UNDO_DURATION) * 100));
      }
    };

    update();
    const interval = setInterval(update, 50);
    return () => clearInterval(interval);
  }, [ffExpiryTime, deletedFFStack.length]);

  const activeFreezeFrame = useMemo(() => {
    if (editingAnimationFFId) {
      const ff = freezeFrames.find((f) => f.id === editingAnimationFFId);
      if (ff) return ff;
    }
    if (activeFreezeFrameId) {
      const ff = freezeFrames.find((f) => f.id === activeFreezeFrameId);
      if (ff) return ff;
    }
    return undefined;
  }, [editingAnimationFFId, activeFreezeFrameId, freezeFrames]);

  const { justPassedFFId, justNextFFId } = useMemo(() => {
    const sorted = [...freezeFrames].sort((a, b) => a.timestamp - b.timestamp);
    const activeIdx = sorted.findIndex((ff) => activeFreezeFrameId === ff.id);

    let passedId: string | null = null;
    let nextId: string | null = null;

    if (activeIdx !== -1) {
      if (activeIdx > 0) passedId = sorted[activeIdx - 1].id;
      if (activeIdx < sorted.length - 1) nextId = sorted[activeIdx + 1].id;
    } else {
      const passed = sorted.filter((ff) => ff.timestamp <= currentTime + 0.001);
      passedId = passed.length > 0 ? passed[passed.length - 1].id : null;

      const upcoming = sorted.filter((ff) => ff.timestamp > currentTime + 0.001);
      nextId = upcoming.length > 0 ? upcoming[0].id : null;
    }

    return { justPassedFFId: passedId, justNextFFId: nextId };
  }, [freezeFrames, activeFreezeFrameId, currentTime]);

  const currentStepForActiveFF = useMemo(() => {
    if (!activeFreezeFrame) {
      return activeStep;
    }
    const ffStep = freezeFrameActiveSteps[activeFreezeFrame.id];
    return ffStep !== undefined ? ffStep : 0;
  }, [activeFreezeFrame, freezeFrameActiveSteps, activeStep]);

  useEffect(() => {
    const currentFFId = activeFreezeFrame?.id || null;
    if (currentFFId && currentFFId !== prevActiveFFIdRef.current) {
      const step = freezeFrameActiveStepsRef.current[currentFFId];
      if (step === undefined) {
        setFreezeFrameActiveSteps((prev) => {
          if (prev[currentFFId] === undefined) {
            return { ...prev, [currentFFId]: 0 };
          }
          return prev;
        });
        setActiveStep(0);
      } else {
        setActiveStep(step);
      }
    }
    prevActiveFFIdRef.current = currentFFId;
  }, [activeFreezeFrame?.id]);

  const handleStepChange = useCallback(
    (newStep: number | null) => {
      if (activeFreezeFrame) {
        setFreezeFrameActiveSteps((prev) => ({
          ...prev,
          [activeFreezeFrame.id]: newStep,
        }));
      }
      setActiveStep(newStep);
    },
    [activeFreezeFrame]
  );

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

  const activeFreezeFrameIdRef = useRef<string | null>(activeFreezeFrameId);
  activeFreezeFrameIdRef.current = activeFreezeFrameId;

  const isFreezeFramePlayingRef = useRef<boolean>(isFreezeFramePlaying);
  isFreezeFramePlayingRef.current = isFreezeFramePlaying;

  const countdownValueRef = useRef<number>(countdownValue);
  countdownValueRef.current = countdownValue;

  const freezeFramesRef = useRef<FreezeFrame[]>(freezeFrames);
  freezeFramesRef.current = freezeFrames;

  // Initialize countdown duration if needed when activeFreezeFrame is set
  useEffect(() => {
    if (activeFreezeFrame && countdownValueRef.current <= 0.05) {
      const initDur = activeFreezeFrame.duration || 5;
      setCountdownValue(initDur);
      countdownValueRef.current = initDur;
    }
  }, [activeFreezeFrame]);

  // Safety guard: never allow activeFreezeFrameId to stay stuck if normal video playback is running
  // or if the playhead / video element has jumped away from the active freeze frame's timestamp
  useEffect(() => {
    if (!activeFreezeFrameId || editingAnimationFFId) return;
    const ff = freezeFrames.find((f) => f.id === activeFreezeFrameId);
    const videoTime = videoRef.current ? videoRef.current.currentTime : currentTime;
    const driftedAway =
      !ff ||
      (Math.abs(currentTime - ff.timestamp) > 0.15 && Math.abs(videoTime - ff.timestamp) > 0.15);

    if (isPlaying || driftedAway) {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
        countdownInterval.current = null;
      }
      setIsFreezeFramePlaying(false);
      isFreezeFramePlayingRef.current = false;
      setActiveFreezeFrameId(null);
      activeFreezeFrameIdRef.current = null;
      setCountdownValue(0);
      countdownValueRef.current = 0;
    }
  }, [activeFreezeFrameId, editingAnimationFFId, isPlaying, currentTime, freezeFrames, videoRef]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (!activeFreezeFrameId || !isFreezeFramePlaying) {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
        countdownInterval.current = null;
      }
      return;
    }

    const ff = freezeFrames.find((f) => f.id === activeFreezeFrameId);
    if (!ff) return;

    const startCountdown = () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
        countdownInterval.current = null;
      }
      countdownInterval.current = window.setInterval(() => {
        setCountdownValue((prev) => {
          // Guard against 0 or stale depleted remaining time so the frame doesn't immediately dismiss on tick 0
          const currentRemaining = prev <= 0.05 ? (ff.duration || 5) : prev;
          const remaining = Math.max(0, currentRemaining - 0.1);
          if (remaining <= 0.001) {
            if (countdownInterval.current) {
              clearInterval(countdownInterval.current);
              countdownInterval.current = null;
            }
            setIsFreezeFramePlaying(false);
            isFreezeFramePlayingRef.current = false;
            setActiveFreezeFrameId(null);
            activeFreezeFrameIdRef.current = null;
            triggeredFreezeFrames.current.add(ff.id);
            if (videoRef.current) {
              const nextTime = Math.min(duration || 0, ff.timestamp + 0.01);
              videoRef.current.currentTime = nextTime;
              setCurrentTime(nextTime);
              videoRef.current.play().catch((e) => console.log(e));
              setIsPlaying(true);
            }
            return 0;
          }
          const formatted = Number(remaining.toFixed(2));
          countdownValueRef.current = formatted;
          return formatted;
        });
      }, 100);
    };

    // Always start countdown immediately when playing so freeze frame playback is never blocked or stalled
    startCountdown();

    return () => {
      if (timer) clearTimeout(timer);
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
        countdownInterval.current = null;
      }
    };
  }, [
    activeFreezeFrameId,
    isFreezeFramePlaying,
    freezeFrames,
    duration,
    videoRef,
    setCurrentTime,
    setIsPlaying,
    triggeredFreezeFrames,
  ]);

  const toggleFreezeFramePlay = useCallback(
    (targetFFId?: string) => {
      const targetId = targetFFId || activeFreezeFrameIdRef.current || activeFreezeFrame?.id;
      if (!targetId) {
        const ffAtTime = freezeFramesRef.current.find((f) => Math.abs(f.timestamp - currentTime) <= 0.035);
        if (ffAtTime) {
          setActiveFreezeFrameId(ffAtTime.id);
          activeFreezeFrameIdRef.current = ffAtTime.id;
          if (videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
          }
          setIsPlaying(false);
          const dur = ffAtTime.duration || 5;
          setCountdownValue(dur);
          countdownValueRef.current = dur;
          setIsFreezeFramePlaying(true);
          isFreezeFramePlayingRef.current = true;
        }
        return;
      }

      const currentFF = freezeFramesRef.current.find((f) => f.id === targetId);
      if (!currentFF) return;

      if (activeFreezeFrameIdRef.current !== targetId) {
        setActiveFreezeFrameId(targetId);
        activeFreezeFrameIdRef.current = targetId;
      }

      if (isFreezeFramePlayingRef.current) {
        // Pause active freeze frame
        setIsFreezeFramePlaying(false);
        isFreezeFramePlayingRef.current = false;
        if (countdownInterval.current) {
          clearInterval(countdownInterval.current);
          countdownInterval.current = null;
        }
      } else {
        // Play / Resume active freeze frame
        if (videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
        }
        setIsPlaying(false);

        if (countdownValueRef.current <= 0.05) {
          const resetVal = currentFF.duration || 5;
          setCountdownValue(resetVal);
          countdownValueRef.current = resetVal;
        }
        setIsFreezeFramePlaying(true);
        isFreezeFramePlayingRef.current = true;
      }
    },
    [activeFreezeFrame, currentTime, videoRef, setIsPlaying]
  );

  const seekFreezeFrame = useCallback(
    (targetElapsed: number) => {
      const targetId = activeFreezeFrameIdRef.current || activeFreezeFrame?.id;
      if (!targetId) return;
      const currentFF = freezeFramesRef.current.find((f) => f.id === targetId);
      if (!currentFF) return;
      const dur = Math.max(0.1, currentFF.duration || 5);
      const clampedElapsed = Math.max(0, Math.min(dur, targetElapsed));
      const newCountdown = Math.max(0, dur - clampedElapsed);
      const formatted = Number(newCountdown.toFixed(2));
      setCountdownValue(formatted);
      countdownValueRef.current = formatted;
    },
    [activeFreezeFrame]
  );

  const seekFreezeFrameRelative = useCallback(
    (deltaSeconds: number) => {
      const targetId = activeFreezeFrameIdRef.current || activeFreezeFrame?.id;
      if (!targetId) return;
      const currentFF = freezeFramesRef.current.find((f) => f.id === targetId);
      if (!currentFF) return;
      const dur = Math.max(0.1, currentFF.duration || 5);
      const currentElapsed = dur - countdownValueRef.current;
      const targetElapsed = currentElapsed + deltaSeconds;
      seekFreezeFrame(targetElapsed);
    },
    [activeFreezeFrame, seekFreezeFrame]
  );

  const skipFreezeFrame = useCallback(() => {
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
    const targetId = activeFreezeFrameIdRef.current || activeFreezeFrame?.id;
    const currentFF = targetId
      ? freezeFramesRef.current.find((f) => f.id === targetId)
      : freezeFramesRef.current.find((f) => Math.abs(f.timestamp - currentTime) <= 0.05);
    if (currentFF) {
      triggeredFreezeFrames.current.add(currentFF.id);
    }
    setActiveFreezeFrameId(null);
    activeFreezeFrameIdRef.current = null;
    setIsFreezeFramePlaying(false);
    isFreezeFramePlayingRef.current = false;
    setCountdownValue(0);
    countdownValueRef.current = 0;
    if (videoRef.current) {
      const nextTime = Math.min(duration || 0, (currentFF?.timestamp ?? currentTime) + 0.05);
      videoRef.current.currentTime = nextTime;
      setCurrentTime(nextTime);
      videoRef.current.play().catch((e) => console.log(e));
      setIsPlaying(true);
    }
  }, [activeFreezeFrame, duration, currentTime, videoRef, setCurrentTime, setIsPlaying, triggeredFreezeFrames]);

  const resetFreezeFrame = useCallback(() => {
    const targetId = activeFreezeFrameIdRef.current || activeFreezeFrame?.id;
    if (!targetId) return;
    const currentFF = freezeFramesRef.current.find((f) => f.id === targetId);
    if (!currentFF) return;
    const dur = currentFF.duration || 5;
    setCountdownValue(dur);
    countdownValueRef.current = dur;
  }, [activeFreezeFrame]);

  const addFreezeFrame = useCallback((clipHint?: PlaylistItem) => {
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
    }
    setIsPlaying(false);
    const current = videoRef.current ? videoRef.current.currentTime : currentTime;
    setCurrentTime(current);

    const clipInstanceId = clipHint
      ? (typeof clipHint === 'object' && clipHint.instanceId ? clipHint.instanceId : getClipInstanceId(clipHint, 0))
      : undefined;

    // Find if an active freeze frame already exists at this timestamp FOR THIS SPECIFIC CLIP
    const existing = freezeFrames.find((ff) => {
      if (Math.abs(ff.timestamp - current) > 0.035) return false;
      if (clipHint) {
        return isFreezeFrameActiveForClip(ff, clipHint);
      }
      return true;
    });

    if (!existing) {
      const newFFId = Date.now().toString();
      const tempShapes = shapes.filter(
        (s) =>
          !s.freezeFrameId &&
          s.trackStartTime === undefined &&
          (s.videoTime === undefined || Math.abs(current - s.videoTime) <= 0.05)
      );
      const reqDuration = calculateRequiredFreezeFrameDuration(tempShapes, DEFAULT_STEP_DELAY, 5);

      const newFF: FreezeFrame = {
        id: newFFId,
        timestamp: current,
        duration: reqDuration,
        stepDelay: DEFAULT_STEP_DELAY,
        name: `Frame ${freezeFrames.length + 1}`,
        clipInstanceId: clipInstanceId || undefined,
      };
      setFreezeFrames((prev) => [...prev, newFF]);
      setFreezeFrameActiveSteps((prev) => ({ ...prev, [newFFId]: 0 }));
      setActiveStep(0);
      setActiveFreezeFrameId(newFFId);
      setCountdownValue(reqDuration);
      setIsFreezeFramePlaying(false);

      // Attach matching temporary shapes drawn at this timestamp to this new freeze frame,
      // and discard any stale temporary shapes from other times (preserving tracked shapes)
      setShapes((prev) => {
        const nextShapes: Shape[] = [];
        for (const s of prev) {
          if (!s.freezeFrameId && s.trackStartTime === undefined) {
            if (s.videoTime === undefined || Math.abs(current - s.videoTime) <= 0.05) {
              const hasStep = typeof s.step === 'number' && !isNaN(s.step);
              const step = hasStep ? s.step! : null;
              const animStart = hasStep
                ? calculateStepAnimStart(step, DEFAULT_STEP_DELAY)
                : (s.animStart ?? 0);
              nextShapes.push({
                ...s,
                freezeFrameId: newFFId,
                videoTime: undefined,
                step,
                animStart,
                animEnd: s.animEnd ?? reqDuration,
              });
            }
          } else {
            nextShapes.push(s);
          }
        }
        return nextShapes;
      });

      if (onFreezeFrameCreatedInClip && clipHint) {
        onFreezeFrameCreatedInClip(newFF, clipHint);
      } else {
        showNotification(`Added ${newFF.name} (Shift+F)`, '#c6ff1f');
      }
    } else {
      setShapes((prev) => prev.filter((s) => Boolean(s.freezeFrameId) || s.trackStartTime !== undefined));
      setActiveFreezeFrameId(existing.id);
      setCountdownValue(existing.duration || 5);
      setIsFreezeFramePlaying(false);
      showNotification(`Active on ${existing.name || 'Freeze Frame'} (ready for telestrations)`, '#c6ff1f');
    }
  }, [videoRef, setIsPlaying, setCurrentTime, currentTime, freezeFrames, shapes, setShapes, showNotification, onFreezeFrameCreatedInClip]);

  const handleOpenAnimationPanel = useCallback((targetFFId?: string) => {
    if (editingAnimationFFId && (!targetFFId || editingAnimationFFId === targetFFId)) {
      setEditingAnimationFFId(null);
      setIsAnimationPreviewPlaying(false);
      return;
    }
    const current = videoRef.current?.currentTime || currentTime;
    const activeFF =
      (targetFFId ? freezeFrames.find((ff) => ff.id === targetFFId) : undefined) ||
      (activeFreezeFrameId ? freezeFrames.find((ff) => ff.id === activeFreezeFrameId) : undefined) ||
      freezeFrames.find((ff) => Math.abs(ff.timestamp - current) <= 0.035);

    if (activeFF) {
      if (videoRef.current) {
        const diff = videoRef.current.currentTime - activeFF.timestamp;
        if (diff < -0.005 || diff > 0.045) {
          videoRef.current.currentTime = Math.min(duration || Infinity, activeFF.timestamp + 0.005);
        }
        videoRef.current.pause();
      }
      setCurrentTime(activeFF.timestamp);
      setIsPlaying(false);
      setActiveFreezeFrameId(activeFF.id);
      setCountdownValue(activeFF.duration || 5);
      setIsFreezeFramePlaying(false);
      setAnimationPreviewTime(0);
      setIsAnimationPreviewPlaying(false);
      setEditingAnimationFFId(activeFF.id);
      setShapes((prev) => prev.filter((s) => Boolean(s.freezeFrameId) || s.trackStartTime !== undefined));
    } else {
      const newFFId = Date.now().toString();
      const tempShapes = shapes.filter(
        (s) =>
          !s.freezeFrameId &&
          s.trackStartTime === undefined &&
          (s.videoTime === undefined || Math.abs(current - s.videoTime) < 0.3)
      );
      const reqDuration = calculateRequiredFreezeFrameDuration(tempShapes, DEFAULT_STEP_DELAY, 5);

      const newFF: FreezeFrame = {
        id: newFFId,
        timestamp: current,
        duration: reqDuration,
        stepDelay: DEFAULT_STEP_DELAY,
        name: `Frame ${freezeFrames.length + 1}`,
      };
      setFreezeFrames((prev) => [...prev, newFF]);
      setFreezeFrameActiveSteps((prev) => ({ ...prev, [newFFId]: 0 }));
      setActiveStep(0);

      setShapes((prev) => {
        const nextShapes: Shape[] = [];
        for (const s of prev) {
          if (!s.freezeFrameId && s.trackStartTime === undefined) {
            if (s.videoTime === undefined || Math.abs(current - s.videoTime) < 0.3) {
              const hasStep = typeof s.step === 'number' && !isNaN(s.step);
              const step = hasStep ? s.step! : null;
              const animStart = hasStep
                ? calculateStepAnimStart(step, DEFAULT_STEP_DELAY)
                : (s.animStart ?? 0);
              nextShapes.push({
                ...s,
                freezeFrameId: newFFId,
                videoTime: undefined,
                step,
                animStart,
                animEnd: s.animEnd ?? reqDuration,
              });
            }
          } else {
            nextShapes.push(s);
          }
        }
        return nextShapes;
      });

      if (videoRef.current) {
        videoRef.current.currentTime = current;
        videoRef.current.pause();
      }
      setIsPlaying(false);
      setAnimationPreviewTime(0);
      setIsAnimationPreviewPlaying(false);
      setEditingAnimationFFId(newFFId);
    }
  }, [
    editingAnimationFFId,
    videoRef,
    currentTime,
    duration,
    freezeFrames,
    activeFreezeFrameId,
    setCurrentTime,
    setIsPlaying,
    setFreezeFrames,
    shapes,
    setShapes,
  ]);

  const deleteFreezeFrame = useCallback(
    (id: string) => {
      const ffToDelete = freezeFrames.find((ff) => ff.id === id);
      if (!ffToDelete) return;

      const originalIndex = freezeFrames.findIndex((ff) => ff.id === id);
      const affectedShapeIds = shapes.filter((s) => s.freezeFrameId === id).map((s) => s.id);

      setFreezeFrames((prev) => prev.filter((ff) => ff.id !== id));
      setShapes((prev) => prev.map((s) => (s.freezeFrameId === id ? { ...s, freezeFrameId: undefined } : s)));
      setFreezeFrameActiveSteps((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      if (activeFreezeFrameId === id) {
        setActiveFreezeFrameId(null);
        setIsFreezeFramePlaying(false);
        setCountdownValue(0);
      }
      if (editingAnimationFFId === id) {
        setEditingAnimationFFId(null);
      }
      // Ensure property panel shows Freeze Frames so the undo banner is immediately visible
      setTool(null);

      const newRecord: DeletedFreezeFrameRecord = {
        id: ffToDelete.id,
        name: ffToDelete.name || `Frame at ${formatTime(ffToDelete.timestamp)}`,
        timestamp: ffToDelete.timestamp,
        frame: { ...ffToDelete },
        shapeIds: affectedShapeIds,
        originalIndex,
      };

      setDeletedFFStack((prev) => [...prev, newRecord]);
      setFfExpiryTime(Date.now() + FF_UNDO_DURATION);
      setFfRemainingSeconds(Math.ceil(FF_UNDO_DURATION / 1000));
      setFfProgressPercent(100);
    },
    [freezeFrames, shapes, activeFreezeFrameId, editingAnimationFFId, setShapes, setTool]
  );

  const undoDeleteFreezeFrame = useCallback(() => {
    if (deletedFFStack.length === 0) return;

    const lastDeleted = deletedFFStack[deletedFFStack.length - 1];
    const remainingStack = deletedFFStack.slice(0, -1);

    setFreezeFrames((prev) => {
      if (prev.some((f) => f.id === lastDeleted.frame.id)) return prev;
      const next = [...prev];
      if (lastDeleted.originalIndex >= 0 && lastDeleted.originalIndex <= next.length) {
        next.splice(lastDeleted.originalIndex, 0, lastDeleted.frame);
      } else {
        next.push(lastDeleted.frame);
      }
      return next.sort((a, b) => a.timestamp - b.timestamp);
    });

    if (lastDeleted.shapeIds.length > 0) {
      setShapes((prev) =>
        prev.map((s) => {
          if (lastDeleted.shapeIds.includes(s.id)) {
            return { ...s, freezeFrameId: lastDeleted.frame.id };
          }
          return s;
        })
      );
    }

    if (remainingStack.length > 0) {
      setDeletedFFStack(remainingStack);
      setFfExpiryTime(Date.now() + FF_UNDO_DURATION);
      setFfRemainingSeconds(Math.ceil(FF_UNDO_DURATION / 1000));
      setFfProgressPercent(100);
    } else {
      setDeletedFFStack([]);
      setFfExpiryTime(null);
    }
  }, [deletedFFStack, setShapes]);

  const undoDeleteAllFreezeFrames = useCallback(() => {
    if (deletedFFStack.length === 0) return;

    const framesToRestore = deletedFFStack.map((d) => d.frame);
    const allShapeIdsToRelink = new Map<string, string>();
    deletedFFStack.forEach((d) => {
      d.shapeIds.forEach((sId) => allShapeIdsToRelink.set(sId, d.frame.id));
    });

    setFreezeFrames((prev) => {
      const existingIds = new Set(prev.map((f) => f.id));
      const additions = framesToRestore.filter((f) => !existingIds.has(f.id));
      return [...prev, ...additions].sort((a, b) => a.timestamp - b.timestamp);
    });

    if (allShapeIdsToRelink.size > 0) {
      setShapes((prev) =>
        prev.map((s) => {
          const targetFFId = allShapeIdsToRelink.get(s.id);
          if (targetFFId) {
            return { ...s, freezeFrameId: targetFFId };
          }
          return s;
        })
      );
    }

    setDeletedFFStack([]);
    setFfExpiryTime(null);
  }, [deletedFFStack, setShapes]);

  const dismissDeletedFFNotification = useCallback(() => {
    setDeletedFFStack([]);
    setFfExpiryTime(null);
  }, []);

  const deletedFFStackRef = useRef<DeletedFreezeFrameRecord[]>([]);
  deletedFFStackRef.current = deletedFFStack;

  const undoDeleteFreezeFrameRef = useRef<() => void>(() => {});
  undoDeleteFreezeFrameRef.current = undoDeleteFreezeFrame;

  const updateFreezeFrameDuration = useCallback(
    (id: string, newDuration: number) => {
      const safeDuration = Math.max(1.0, Math.min(120.0, Number(newDuration.toFixed(1))));
      const targetFF = freezeFramesRef.current.find((ff) => ff.id === id);
      const oldDuration = targetFF?.duration || 5;

      setFreezeFrames((prev) => prev.map((ff) => (ff.id === id ? { ...ff, duration: safeDuration } : ff)));
      if (activeFreezeFrameIdRef.current === id && !isFreezeFramePlayingRef.current) {
        const currentElapsed = Math.max(0, oldDuration - countdownValueRef.current);
        const nextCountdown = Number(Math.max(0, safeDuration - currentElapsed).toFixed(2));
        setCountdownValue(nextCountdown);
        countdownValueRef.current = nextCountdown;
      }
      setShapes((prev) =>
        prev.map((s) => {
          if (s.freezeFrameId !== id) return s;
          const oldEnd = s.animEnd ?? 5;
          if (oldEnd > safeDuration || typeof s.step === 'number') {
            return { ...s, animEnd: safeDuration };
          }
          return s;
        })
      );
    },
    [setShapes]
  );

  const handleSelectedShapeStepChange = useCallback(
    (selectedShapeId: string | null, newStep: number | null) => {
      if (activeFreezeFrame) {
        setFreezeFrameActiveSteps((prev) => ({
          ...prev,
          [activeFreezeFrame.id]: newStep,
        }));
      }
      setActiveStep(newStep);
      if (!selectedShapeId) return;

      const targetShape = shapes.find((s) => s.id === selectedShapeId);
      if (!targetShape) return;

      if (targetShape.freezeFrameId) {
        setFreezeFrameActiveSteps((prev) => ({
          ...prev,
          [targetShape.freezeFrameId!]: newStep,
        }));
      }

      if (newStep === null) {
        setShapes((prev) => prev.map((s) => (s.id === selectedShapeId ? { ...s, step: null } : s)));
        return;
      }

      const safeStep = Math.max(0, newStep);

      if (targetShape.freezeFrameId) {
        const ff = freezeFrames.find((f) => f.id === targetShape.freezeFrameId);
        if (ff) {
          const oldDur = ff.duration || 5;
          const stepDelay = getFreezeFrameStepDelay(ff);
          const animStart = calculateStepAnimStart(safeStep, stepDelay);
          const reqDuration = calculateRequiredFreezeFrameDuration(safeStep, stepDelay, oldDur);
          const finalDuration = Math.max(oldDur, reqDuration);
          const isExtending = finalDuration > oldDur;

          if (isExtending) {
            setFreezeFrames((prev) =>
              prev.map((f) => (f.id === ff.id ? { ...f, duration: finalDuration } : f))
            );
            if (activeFreezeFrameIdRef.current === ff.id && !isFreezeFramePlayingRef.current) {
              const currentElapsed = Math.max(0, oldDur - countdownValueRef.current);
              const nextCountdown = Number(Math.max(0, finalDuration - currentElapsed).toFixed(2));
              setCountdownValue(nextCountdown);
              countdownValueRef.current = nextCountdown;
            }
          }

          setShapes((prev) =>
            prev.map((s) => {
              if (s.id === selectedShapeId) {
                return {
                  ...s,
                  step: safeStep,
                  animStart,
                  animEnd: finalDuration,
                };
              }
              if (s.freezeFrameId === ff.id && isExtending) {
                return { ...s, animEnd: finalDuration };
              }
              return s;
            })
          );
          return;
        }
      }

      setShapes((prev) => prev.map((s) => (s.id === selectedShapeId ? { ...s, step: safeStep } : s)));
    },
    [activeFreezeFrame, shapes, freezeFrames, setShapes]
  );

  return {
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
    activeStep,
    setActiveStep,
    freezeFrameActiveSteps,
    setFreezeFrameActiveSteps,
    activeFreezeFrame,
    justPassedFFId,
    justNextFFId,
    currentStepForActiveFF,
    handleStepChange,
    deletedFFStack,
    setDeletedFFStack,
    ffExpiryTime,
    setFfExpiryTime,
    ffRemainingSeconds,
    ffProgressPercent,
    deletedFFStackRef,
    undoDeleteFreezeFrameRef,
    toggleFreezeFramePlay,
    seekFreezeFrame,
    seekFreezeFrameRelative,
    skipFreezeFrame,
    resetFreezeFrame,
    addFreezeFrame,
    handleOpenAnimationPanel,
    deleteFreezeFrame,
    undoDeleteFreezeFrame,
    undoDeleteAllFreezeFrames,
    dismissDeletedFFNotification,
    updateFreezeFrameDuration,
    handleSelectedShapeStepChange,
  };
}
