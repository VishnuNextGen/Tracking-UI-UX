import React from 'react';
import {
  MousePointer2,
  Pen,
  MoveUpRight,
  CornerUpRight,
  Circle,
  GitCommitVertical,
  Flashlight,
  ZoomIn,
  User,
  Tag,
  Type,
  Radar,
  Hexagon,
  ScanEye,
  Layers,
  Snowflake,
  Crosshair,
} from 'lucide-react';
import type { ToolType } from '../../../types';
import type { PolygonSettings } from '../../Workspace/Polygon';

export interface TrackingToolsPanelProps {
  tool: ToolType;
  setTool: React.Dispatch<React.SetStateAction<ToolType>>;
  setPolygonSettings?: React.Dispatch<React.SetStateAction<PolygonSettings>>;
  hasActiveFreezeFrame?: boolean;
  freezeFrameCount?: number;
}

const TOOL_ICON_MAP: Record<Exclude<ToolType, null>, React.ComponentType<{ className?: string }>> = {
  move: MousePointer2,
  pen: Pen,
  line: Pen,
  arrow: MoveUpRight,
  'curved-arrow': CornerUpRight,
  'curved-run-arrow': CornerUpRight,
  circle: Circle,
  'connected-circle': GitCommitVertical,
  spotlight: Flashlight,
  lens: ZoomIn,
  'player-move': User,
  'name-tag': Tag,
  text: Type,
  polygon: Hexagon,
  radar: Radar,
  scanner: ScanEye,
  masking: Layers,
  eraser: MousePointer2,
};

const TRACKABLE_COLUMN: { id: Exclude<ToolType, null>; label: string }[] = [
  { id: 'circle', label: 'Telestration Ring' },
  { id: 'connected-circle', label: 'Chain' },
  { id: 'lens', label: 'Zoom Lens' },
  { id: 'spotlight', label: 'Spotlight' },
  { id: 'radar', label: 'Radar Ring' },
  { id: 'name-tag', label: 'Player Tag' },
  { id: 'text', label: 'Text' },
];

const OTHER_TOOLS_COLUMN: { id: Exclude<ToolType, null>; label: string }[] = [
  { id: 'move', label: 'Move / Select' },
  { id: 'pen', label: 'Draw' },
  { id: 'arrow', label: 'Arrow' },
  { id: 'curved-arrow', label: 'Aerial Arrow' },
  { id: 'player-move', label: 'Player Move Tool' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'scanner', label: 'Field Scanner' },
  { id: 'masking', label: 'Masking / Green Screen' },
];

export const TrackingToolsPanel: React.FC<TrackingToolsPanelProps> = ({
  tool,
  setTool,
  setPolygonSettings,
  hasActiveFreezeFrame = false,
  freezeFrameCount = 0,
}) => {
  const selectTool = (targetTool: ToolType) => {
    const nextTool: ToolType = tool === targetTool ? null : targetTool;
    setTool(nextTool);
    if (nextTool === 'polygon') {
      setPolygonSettings?.((prev) => ({ ...prev, mode: 'polygon' }));
    } else if (nextTool === 'radar') {
      setPolygonSettings?.((prev) => ({ ...prev, mode: 'radar' }));
    }
  };

  return (
    <div className="w-[116px] bg-[#101114] border-r border-[#222] flex flex-col justify-between py-2.5 px-2 shrink-0 z-30 select-none">
      <div className="grid grid-cols-2 gap-2 flex-1 min-h-0 overflow-y-auto no-scrollbar content-start">
        {/* Column 1: Trackable Tools (Added to Tracker Timeline) */}
        <div className="flex flex-col items-center gap-2 pr-1.5 border-r border-[#1f2128]">
          <div
            className="w-full flex items-center justify-center gap-1 pb-1.5 mb-0.5 border-b border-[#c6ff1f]/20 overflow-hidden"
            title="Trackable tools — added to Tracker Timeline (Default 5s)"
          >
            <Crosshair className="w-2.5 h-2.5 text-[#c6ff1f] shrink-0" />
            <span className="text-[7px] font-bold uppercase tracking-wide leading-none text-[#c6ff1f] whitespace-nowrap">
              Track
            </span>
          </div>
          {TRACKABLE_COLUMN.map((item) => {
            const Icon = TOOL_ICON_MAP[item.id];
            const isActive = tool === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectTool(item.id)}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all relative cursor-pointer ${
                  isActive
                    ? 'bg-[#c6ff1f]/20 text-[#c6ff1f] ring-1 ring-[#c6ff1f]/70 shadow-[0_0_10px_rgba(198,255,31,0.18)]'
                    : 'text-gray-300 bg-[#16181e]/70 hover:bg-[#22252e] hover:text-white border border-white/[0.04]'
                }`}
                title={`${item.label} (Adds to Tracker Timeline · 5s default)`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.4px]' : ''}`} />
              </button>
            );
          })}
        </div>

        {/* Column 2: Other Analysis Drawing Tools */}
        <div className="flex flex-col items-center gap-2 pl-0.5">
          <div
            className="w-full flex items-center justify-center pb-1.5 mb-0.5 border-b border-white/10"
            title="Standard drawing & canvas tools (5s persistent overlay)"
          >
            <span className="text-[7px] font-bold uppercase tracking-wide leading-none text-gray-400">
              Tools
            </span>
          </div>
          {OTHER_TOOLS_COLUMN.map((item) => {
            const Icon = TOOL_ICON_MAP[item.id];
            const isActive = tool === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectTool(item.id)}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all relative cursor-pointer ${
                  isActive
                    ? 'bg-[#c6ff1f]/20 text-[#c6ff1f] ring-1 ring-[#c6ff1f]/70'
                    : 'text-gray-400 hover:bg-[#20232b] hover:text-white'
                }`}
                title={item.label}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.4px]' : ''}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Freeze Frames Control (Opens Freeze Frame Properties & Controls) */}
      <div className="pt-2.5 border-t border-[#222] flex flex-col items-center">
        <button
          type="button"
          onClick={() => setTool(null)}
          className={`w-full h-9 px-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer relative ${
            tool === null
              ? 'bg-[#c6ff1f]/18 text-[#c6ff1f] ring-1 ring-[#c6ff1f]/70 shadow-[0_0_10px_rgba(198,255,31,0.14)]'
              : hasActiveFreezeFrame
              ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/50 hover:bg-amber-500/25'
              : 'text-gray-300 bg-[#16181e]/70 hover:bg-[#22252e] hover:text-white border border-white/[0.04]'
          }`}
          title="Freeze Frames Panel (Shift+F to add Freeze Frame at playhead)"
        >
          <Snowflake className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[8.5px] font-bold uppercase tracking-tight leading-none whitespace-nowrap">
            Freeze Frames
          </span>
          {freezeFrameCount > 0 && (
            <span
              className={`px-1 py-0.2 rounded text-[8px] font-mono font-bold leading-tight shrink-0 ${
                tool === null
                  ? 'bg-[#c6ff1f] text-black'
                  : hasActiveFreezeFrame
                  ? 'bg-amber-400 text-black'
                  : 'bg-white/10 text-gray-200'
              }`}
            >
              {freezeFrameCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
