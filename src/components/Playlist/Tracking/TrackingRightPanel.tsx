import React from 'react';
import {
  Crosshair,
  SquareDashed,
  Trash2,
  PanelRightClose,
  PanelRightOpen,
  Clock,
  Layers,
} from 'lucide-react';
import type { Shape } from '../../../types';
import {
  formatTrackClock,
  formatTrackDuration,
  getTrackDisplayColor,
  isTrackableTool,
} from './trackingUtils';

export interface TrackingRightPanelProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  selectedShape: Shape | null;
  clipStart: number;
  clipEnd: number;
  isDrawingRoi: boolean;
  onStartDrawRoi: (shapeId: string) => void;
  onCancelDrawRoi: () => void;
  onClearRoi: (shapeId: string) => void;
  onRenameTrack: (shapeId: string, nextLabel: string) => void;
}

export const TrackingRightPanel: React.FC<TrackingRightPanelProps> = ({
  isCollapsed,
  onToggleCollapse,
  selectedShape,
  clipStart,
  isDrawingRoi,
  onStartDrawRoi,
  onCancelDrawRoi,
  onClearRoi,
  onRenameTrack,
}) => {
  if (isCollapsed) {
    return (
      <div className="w-9 bg-[#0c0c0e] border-l border-[#222] flex flex-col items-center py-2.5 shrink-0 select-none">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-7 h-7 rounded-md bg-[#16181f] hover:bg-[#222530] border border-[#2a2d38] text-gray-300 hover:text-[#c6ff1f] flex items-center justify-center transition-colors cursor-pointer"
          title="Expand Tracking Panel"
        >
          <PanelRightOpen className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const isSelectedTrackable = Boolean(
    selectedShape && !selectedShape.freezeFrameId && isTrackableTool(selectedShape.type)
  );
  const selectedColor = selectedShape ? getTrackDisplayColor(selectedShape) : '#c6ff1f';
  const startOffset =
    selectedShape?.trackStartTime !== undefined
      ? Math.max(0, selectedShape.trackStartTime - clipStart)
      : 0;
  const spanDur =
    selectedShape?.trackStartTime !== undefined && selectedShape?.trackEndTime !== undefined
      ? Math.max(0, selectedShape.trackEndTime - selectedShape.trackStartTime)
      : 0;

  return (
    <aside className="w-[248px] xl:w-[272px] bg-[#0c0c0e] border-l border-[#222] flex flex-col shrink-0 select-none overflow-hidden">
      {/* Header */}
      <div className="h-9 px-3 border-b border-[#222] flex items-center justify-between gap-2 bg-[#101115] shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Crosshair className="w-3.5 h-3.5 text-[#c6ff1f] shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-200 truncate">
            Tracking Panel
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer shrink-0"
          title="Collapse Tracking Panel"
        >
          <PanelRightClose className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {selectedShape && isSelectedTrackable ? (
          <div className="rounded-lg bg-[#12141a] border border-[#262934] p-2.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-white/20"
                  style={{ backgroundColor: selectedColor }}
                />
                <input
                  type="text"
                  value={selectedShape.trackLabel || ''}
                  onChange={(e) => onRenameTrack(selectedShape.id, e.target.value)}
                  className="bg-transparent text-xs font-bold text-white outline-none border-b border-transparent focus:border-[#c6ff1f] min-w-0 w-full truncate"
                  placeholder="Track name..."
                />
              </div>
              <span className="text-[9.5px] font-mono tabular-nums text-gray-400 shrink-0">
                {formatTrackDuration(spanDur)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] font-mono tabular-nums text-gray-400 bg-black/30 px-2 py-1.5 rounded border border-white/[0.04]">
              <Clock className="w-3 h-3 text-gray-500 shrink-0" />
              <span>+{formatTrackClock(startOffset)}</span>
              <span className="text-gray-600">→</span>
              <span>+{formatTrackClock(startOffset + spanDur)}</span>
            </div>

            {/* Player Anchor / ROI Rectangle UX Slot */}
            <div className="pt-1 border-t border-[#222530] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-300">
                  Player Anchor Box
                </span>
                {selectedShape.playerBox && (
                  <span className="text-[9.5px] font-mono tabular-nums text-[#c6ff1f]">
                    {Math.round(selectedShape.playerBox.w)}×{Math.round(selectedShape.playerBox.h)}
                  </span>
                )}
              </div>

              {isDrawingRoi ? (
                <div className="space-y-1.5">
                  <div className="text-[10px] text-[#c6ff1f] bg-[#c6ff1f]/10 border border-[#c6ff1f]/35 rounded px-2 py-1.5 leading-snug">
                    Drag a rectangle over the target player on the video canvas.
                  </div>
                  <button
                    type="button"
                    onClick={onCancelDrawRoi}
                    className="w-full h-7 rounded bg-[#1d2029] hover:bg-[#272b36] text-gray-200 text-[10px] font-semibold border border-[#323644] transition-colors cursor-pointer"
                  >
                    Cancel Box Selection
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onStartDrawRoi(selectedShape.id)}
                    className="flex-1 h-7 px-2 rounded bg-[#c6ff1f]/12 hover:bg-[#c6ff1f]/20 text-[#c6ff1f] border border-[#c6ff1f]/40 text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                    title="Draw a player bounding box for upcoming tracking"
                  >
                    <SquareDashed className="w-3.5 h-3.5 shrink-0" />
                    <span>{selectedShape.playerBox ? 'Redraw Player Box' : 'Mark Player Box'}</span>
                  </button>
                  {selectedShape.playerBox && (
                    <button
                      type="button"
                      onClick={() => onClearRoi(selectedShape.id)}
                      className="w-7 h-7 rounded bg-[#181a22] hover:bg-red-950/50 text-gray-400 hover:text-red-400 border border-[#2b2e3a] flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      title="Clear Player Box"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Reserved Workspace Slot for Upcoming Auto-Tracker Controls */}
        <div className="rounded-lg border border-dashed border-[#272a36] bg-[#0f1015]/80 p-4 flex flex-col items-center text-center space-y-2">
          <div className="w-8 h-8 rounded-lg bg-[#161821] border border-[#282b38] flex items-center justify-center text-gray-400">
            <Layers className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-gray-200">
              Player Motion Tracking Slot
            </p>
            <p className="text-[10px] text-gray-500 leading-relaxed">
              Reserved panel for automated player box tracking controls in the next release.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};
