import type { Rect, Point, Shape } from '../../../types';

export type PlayerMoveState = 'idle' | 'selecting' | 'moving';
export type PlayerMoveMode = 'ghost' | 'seamless-patch' | 'ghost-patch';

export interface PlayerMoveSettings {
  mode: PlayerMoveMode;
  ghostOpacity: number; // 0.15 - 0.70
  featherRadius: number; // 8 - 36px
  showArrow: boolean;
}

export const DEFAULT_PLAYER_MOVE_SETTINGS: PlayerMoveSettings = {
  mode: 'seamless-patch',
  ghostOpacity: 0.35,
  featherRadius: 20,
  showArrow: true,
};

export interface CapturedSprite {
  sprite: HTMLCanvasElement;
  patch: HTMLCanvasElement | null;
  originPlayer: HTMLCanvasElement;
  box: Rect;
  settings?: PlayerMoveSettings;
}

export interface PlayerMovePanelProps {
  playerMoveState: PlayerMoveState;
  onCancel: () => void;
  toolSize: number;
  onToolSizeChange: (size: number) => void;
  colors?: Array<{ id: number; value: string }>;
  activeColorId?: number;
  onSelectColorId?: (id: number) => void;
  settings: PlayerMoveSettings;
  onSettingsChange: (settings: PlayerMoveSettings) => void;
  telestrationPresetBlock?: React.ReactNode;
}
