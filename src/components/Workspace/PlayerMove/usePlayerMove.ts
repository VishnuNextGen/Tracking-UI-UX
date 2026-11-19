import { useState, useRef, useCallback } from 'react';
import type { Point, Rect, Shape } from '../../../types';
import type { PlayerMoveState, CapturedSprite, PlayerMoveSettings } from './types';
import { DEFAULT_PLAYER_MOVE_SETTINGS } from './types';
import { capturePlayerSprite, createPlayerMoveShape as baseCreatePlayerMoveShape } from './playerMoveUtils';

export function usePlayerMove() {
  const [playerMoveState, setPlayerMoveState] = useState<PlayerMoveState>('idle');
  const [playerSelectionRect, setPlayerSelectionRect] = useState<Rect | null>(null);
  const playerSelectionRectRef = useRef<Rect | null>(null);
  const playerMoveStartPointRef = useRef<Point | null>(null);
  const [capturedSprite, setCapturedSprite] = useState<CapturedSprite | null>(null);
  const [playerMoveSettings, setPlayerMoveSettings] = useState<PlayerMoveSettings>(DEFAULT_PLAYER_MOVE_SETTINGS);
  const playerMoveSettingsRef = useRef<PlayerMoveSettings>(DEFAULT_PLAYER_MOVE_SETTINGS);

  const updateSettings = useCallback((newSettings: PlayerMoveSettings | ((prev: PlayerMoveSettings) => PlayerMoveSettings)) => {
    setPlayerMoveSettings(prev => {
      const next = typeof newSettings === 'function' ? newSettings(prev) : newSettings;
      playerMoveSettingsRef.current = next;
      return next;
    });
  }, []);

  const resetPlayerMove = useCallback(() => {
    setPlayerMoveState('idle');
    setPlayerSelectionRect(null);
    playerSelectionRectRef.current = null;
    playerMoveStartPointRef.current = null;
    setCapturedSprite(null);
  }, []);

  const startPlayerSelection = useCallback((startPoint: Point) => {
    playerMoveStartPointRef.current = startPoint;
    const initRect: Rect = { x: startPoint.x, y: startPoint.y, w: 0, h: 0 };
    setPlayerSelectionRect(initRect);
    playerSelectionRectRef.current = initRect;
    setPlayerMoveState('selecting');
  }, []);

  const updatePlayerSelection = useCallback((currentPoint: Point, startPoint?: Point | null) => {
    const startPt =
      startPoint ||
      playerMoveStartPointRef.current ||
      (playerSelectionRectRef.current
        ? { x: playerSelectionRectRef.current.x, y: playerSelectionRectRef.current.y }
        : currentPoint);
    const w = currentPoint.x - startPt.x;
    const h = currentPoint.y - startPt.y;
    const updatedRect: Rect = {
      x: w >= 0 ? startPt.x : currentPoint.x,
      y: h >= 0 ? startPt.y : currentPoint.y,
      w: Math.abs(w),
      h: Math.abs(h)
    };
    playerSelectionRectRef.current = updatedRect;
  }, []);

  const finishPlayerSelection = useCallback(
    (
      currentPoint: Point,
      startPoint: Point | null,
      video: HTMLVideoElement | null,
      maskForeground?: ImageBitmap | CanvasImageSource | null,
      maskEnabled?: boolean,
      explicitSettings?: PlayerMoveSettings
    ): boolean => {
      const startPt = startPoint || playerMoveStartPointRef.current;
      let finalRect: Rect | null = playerSelectionRectRef.current;
      if (!finalRect && startPt) {
        const w = currentPoint.x - startPt.x;
        const h = currentPoint.y - startPt.y;
        finalRect = {
          x: w >= 0 ? startPt.x : currentPoint.x,
          y: h >= 0 ? startPt.y : currentPoint.y,
          w: Math.abs(w),
          h: Math.abs(h)
        };
      }
      playerMoveStartPointRef.current = null;
      if (!finalRect || finalRect.w < 8 || finalRect.h < 8) {
        resetPlayerMove();
        return false;
      }
      const normalizedRect: Rect = {
        x: Math.round(finalRect.x),
        y: Math.round(finalRect.y),
        w: Math.round(finalRect.w),
        h: Math.round(finalRect.h)
      };
      const activeSettings = explicitSettings || playerMoveSettingsRef.current;
      const result = capturePlayerSprite(video, normalizedRect, maskForeground, maskEnabled, activeSettings);
      if (result) {
        setCapturedSprite(result);
        setPlayerSelectionRect(normalizedRect);
        playerSelectionRectRef.current = normalizedRect;
        setPlayerMoveState('moving');
        return true;
      } else {
        resetPlayerMove();
        return false;
      }
    },
    [resetPlayerMove]
  );

  const createPlayerMoveShape = useCallback(
    (
      captured: CapturedSprite,
      destCenter: Point,
      color: string,
      strokeWidth: number,
      freezeFrameId?: string
    ): Shape => {
      return baseCreatePlayerMoveShape(captured, destCenter, color, strokeWidth, freezeFrameId, playerMoveSettingsRef.current);
    },
    []
  );

  return {
    playerMoveState,
    setPlayerMoveState,
    playerSelectionRect,
    setPlayerSelectionRect,
    playerSelectionRectRef,
    playerMoveStartPointRef,
    capturedSprite,
    setCapturedSprite,
    playerMoveSettings,
    setPlayerMoveSettings: updateSettings,
    resetPlayerMove,
    startPlayerSelection,
    updatePlayerSelection,
    finishPlayerSelection,
    createPlayerMoveShape,
  };
}
