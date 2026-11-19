import { Shape, FreezeFrame } from '../types';

export const DEFAULT_STEP_DELAY = 1.5; // seconds
export const MIN_END_GAP = 1.5; // seconds minimum gap between end of freeze frame and last step
export const DEFAULT_FREEZE_FRAME_DURATION = 5.0; // default duration in seconds

/**
 * Returns the configured step delay for a freeze frame, falling back to 1.5s
 */
export function getFreezeFrameStepDelay(freezeFrame?: Partial<FreezeFrame> | null): number {
  if (!freezeFrame || typeof freezeFrame.stepDelay !== 'number' || freezeFrame.stepDelay <= 0) {
    return DEFAULT_STEP_DELAY;
  }
  return freezeFrame.stepDelay;
}

/**
 * Returns the step number (0, 1, 2, ...) for a given shape, or null if the shape is freeform (without steps).
 */
export function getShapeStep(shape: Shape, stepDelay: number = DEFAULT_STEP_DELAY): number | null {
  if (shape.step === null) {
    return null;
  }
  if (typeof shape.step === 'number' && !isNaN(shape.step)) {
    return Math.max(0, Math.floor(shape.step));
  }
  return null;
}

/**
 * Calculates animStart for a step
 * Step 0 -> 0.0s
 * Step 1 -> 1.5s (with default 1.5s delay)
 * Step 2 -> 3.0s
 */
export function calculateStepAnimStart(step: number, stepDelay: number = DEFAULT_STEP_DELAY): number {
  const safeStep = Math.max(0, Math.floor(step));
  const safeDelay = Math.max(0.1, stepDelay);
  return Number((safeStep * safeDelay).toFixed(2));
}

/**
 * Calculates the required minimum duration of a freeze frame given its shapes or max step.
 * Shapes without steps (step === null) do not impose step-delay requirements.
 */
export function calculateRequiredFreezeFrameDuration(
  shapesOrMaxStep: Shape[] | number,
  stepDelay: number = DEFAULT_STEP_DELAY,
  baseDuration: number = DEFAULT_FREEZE_FRAME_DURATION
): number {
  const safeDelay = Math.max(0.1, stepDelay);
  let maxStep = 0;
  let hasSteppedShape = false;
  let maxAnimEnd = baseDuration;

  if (Array.isArray(shapesOrMaxStep)) {
    shapesOrMaxStep.forEach(s => {
      if (typeof s.step === 'number' && !isNaN(s.step)) {
        hasSteppedShape = true;
        maxStep = Math.max(maxStep, Math.floor(s.step));
      }
      if (typeof s.animEnd === 'number' && !isNaN(s.animEnd)) {
        maxAnimEnd = Math.max(maxAnimEnd, s.animEnd);
      }
    });
  } else if (typeof shapesOrMaxStep === 'number' && !isNaN(shapesOrMaxStep)) {
    hasSteppedShape = true;
    maxStep = Math.max(0, Math.floor(shapesOrMaxStep));
  }

  // Required duration for stepped shapes = (last step start time) + minimum gap of 1.5s
  const requiredStepDuration = hasSteppedShape 
    ? Number(((maxStep * safeDelay) + MIN_END_GAP).toFixed(2))
    : baseDuration;

  return Math.max(baseDuration, requiredStepDuration, maxAnimEnd);
}

/**
 * Calculates optimal freeze frame duration to tightly fit all steps and drawings,
 * eliminating unnecessary dead holding time at the end or extending if needed.
 *
 * @param shapes All shapes in the freeze frame
 * @param stepDelay Delay in seconds between steps
 * @param holdGap Hold time in seconds after the last step appears (default 1.5s)
 */
export function calculateOptimalFreezeFrameDuration(
  shapes: Shape[],
  stepDelay: number = DEFAULT_STEP_DELAY,
  holdGap: number = MIN_END_GAP
): number {
  const safeDelay = Math.max(0.1, stepDelay);
  const safeGap = Math.max(0.5, holdGap);
  let maxStep = -1;
  let hasSteppedShape = false;
  let maxFreeformEnd = 0;

  shapes.forEach(s => {
    if (typeof s.step === 'number' && !isNaN(s.step)) {
      hasSteppedShape = true;
      maxStep = Math.max(maxStep, Math.floor(s.step));
    } else {
      if (typeof s.animEnd === 'number' && !isNaN(s.animEnd)) {
        maxFreeformEnd = Math.max(maxFreeformEnd, s.animEnd);
      }
    }
  });

  if (!hasSteppedShape && maxFreeformEnd === 0) {
    return 3.0; // clean baseline for empty freeze frames
  }

  const steppedRequired = hasSteppedShape
    ? Number(((maxStep * safeDelay) + safeGap).toFixed(1))
    : 0;

  return Number(Math.max(2.0, steppedRequired, maxFreeformEnd).toFixed(1));
}

/**
 * Synchronizes a shape's timing to its step.
 * When step is null, it preserves custom timing (freeform without step).
 */
export function assignShapeStep(
  shape: Shape,
  step: number | null,
  stepDelay: number = DEFAULT_STEP_DELAY,
  freezeFrameDuration?: number
): Shape {
  if (step === null) {
    return {
      ...shape,
      step: null,
      animStart: shape.animStart ?? 0,
      animEnd: shape.animEnd ?? (freezeFrameDuration || DEFAULT_FREEZE_FRAME_DURATION)
    };
  }

  const safeStep = Math.max(0, Math.floor(step));
  const animStart = calculateStepAnimStart(safeStep, stepDelay);
  const minRequiredDur = animStart + MIN_END_GAP;
  const targetEnd = freezeFrameDuration ? Math.max(minRequiredDur, freezeFrameDuration) : minRequiredDur;

  return {
    ...shape,
    step: safeStep,
    animStart,
    animEnd: Number(targetEnd.toFixed(2))
  };
}

/**
 * Re-aligns stepped shapes of a freeze frame to their steps and auto-extends the freeze frame
 * duration if the steps extend past the current freeze frame time.
 * Preserves freeform shapes (step === null) without overwriting their custom positions.
 */
export function syncFreezeFrameWithSteps(
  freezeFrame: FreezeFrame,
  allShapes: Shape[],
  options?: {
    newStepDelay?: number;
    newDuration?: number;
  }
): {
  updatedFreezeFrame: FreezeFrame;
  updatedShapes: Shape[];
} {
  const stepDelay = options?.newStepDelay !== undefined ? options.newStepDelay : getFreezeFrameStepDelay(freezeFrame);
  const currentDuration = options?.newDuration !== undefined ? options.newDuration : (freezeFrame.duration || DEFAULT_FREEZE_FRAME_DURATION);

  const ffShapes = allShapes.filter(s => s.freezeFrameId === freezeFrame.id);
  const requiredDuration = calculateRequiredFreezeFrameDuration(ffShapes, stepDelay, currentDuration);
  const finalDuration = Math.max(currentDuration, requiredDuration);

  const updatedFreezeFrame: FreezeFrame = {
    ...freezeFrame,
    stepDelay,
    duration: finalDuration
  };

  const updatedShapes = allShapes.map(s => {
    if (s.freezeFrameId !== freezeFrame.id) return s;
    if (typeof s.step === 'number' && !isNaN(s.step)) {
      const step = Math.max(0, Math.floor(s.step));
      const animStart = calculateStepAnimStart(step, stepDelay);
      return {
        ...s,
        step,
        animStart,
        animEnd: finalDuration
      };
    }
    // Preserves shapes without steps (freeform)
    const curStart = typeof s.animStart === 'number' ? s.animStart : 0;
    const curEnd = typeof s.animEnd === 'number' ? s.animEnd : finalDuration;
    return {
      ...s,
      animStart: curStart,
      animEnd: curEnd > finalDuration ? finalDuration : curEnd
    };
  });

  return { updatedFreezeFrame, updatedShapes };
}

/**
 * Returns human-readable label for a step (e.g., "1st", "2nd", "3rd", "4th")
 */
export function getStepOrdinal(step: number): string {
  const n = step + 1;
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
