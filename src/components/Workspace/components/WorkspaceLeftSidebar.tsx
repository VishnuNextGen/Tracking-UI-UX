import React, { useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
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
  SlidersHorizontal,
} from 'lucide-react';
import { WorkspacePropertiesPanel, WorkspacePropertiesPanelProps } from './WorkspacePropertiesPanel';
import type { ToolType } from '../../../types';
import type { PolygonSettings } from '../Polygon';

export interface WorkspaceLeftSidebarProps {
  isLive: boolean;
  labelsEnabled: boolean;
  setLabelsEnabled?: React.Dispatch<React.SetStateAction<boolean>>;
  isAdvancedCodingMode: boolean;
  setIsAdvancedCodingMode?: React.Dispatch<React.SetStateAction<boolean>>;
  tool: ToolType;
  setTool: React.Dispatch<React.SetStateAction<ToolType>>;
  polygonSettings: PolygonSettings;
  propertiesPanelProps: WorkspacePropertiesPanelProps;
  showNotification?: (
    message: string,
    color: string,
    onUndo?: () => void,
    action?: { label: string; onClick: () => void }
  ) => void;
}

export const WorkspaceLeftSidebar: React.FC<WorkspaceLeftSidebarProps> = ({
  isLive,
  labelsEnabled,
  setLabelsEnabled,
  isAdvancedCodingMode,
  setIsAdvancedCodingMode,
  tool,
  setTool,
  polygonSettings,
  propertiesPanelProps,
  showNotification,
}) => {
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastClickRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });

  // Double click handler: closes label panel / advanced coding mode & ensures tool is selected and properties panel opens
  const handleToolDoubleClick = useCallback(
    (targetTool: ToolType) => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      lastClickRef.current = { id: '', time: 0 };

      // Ensure the clicked tool is selected
      setTool(targetTool);
      if (targetTool === 'polygon') {
        propertiesPanelProps?.setPolygonSettings?.((prev: any) => ({ ...prev, mode: 'polygon' }));
      } else if (targetTool === 'radar') {
        propertiesPanelProps?.setPolygonSettings?.((prev: any) => ({ ...prev, mode: 'radar' }));
      }

      // If labels panel or advanced coding is open, close them so the properties panel opens
      if (labelsEnabled || isAdvancedCodingMode) {
        setLabelsEnabled?.(false);
        setIsAdvancedCodingMode?.(false);
        showNotification?.(
          'Tool properties opened • Labels panel closed',
          '#c6ff1f',
          () => {
            setLabelsEnabled?.(true);
          }
        );
      }
    },
    [labelsEnabled, isAdvancedCodingMode, setLabelsEnabled, setIsAdvancedCodingMode, setTool, propertiesPanelProps, showNotification]
  );

  // Single click handler: supports toggle when labels are off, and guides/detects rapid double clicks when labels are on
  const handleToolClick = useCallback(
    (targetTool: ToolType, isMasking = false) => {
      const now = Date.now();
      const timeSinceLast = now - lastClickRef.current.time;
      const toolIdKey = targetTool || 'clear';
      const isSameTool = lastClickRef.current.id === toolIdKey;

      // Rapid consecutive click detection (<= 400ms on same tool acts as double click)
      if (isSameTool && timeSinceLast <= 400) {
        handleToolDoubleClick(targetTool);
        return;
      }

      // Record current click
      lastClickRef.current = { id: toolIdKey, time: now };

      // Standard tool selection
      const nextTool: ToolType = isMasking
        ? (tool === 'masking' ? null : 'masking')
        : (tool === targetTool ? null : targetTool);
      setTool(nextTool);

      if (nextTool === 'polygon') {
        propertiesPanelProps?.setPolygonSettings?.((prev: any) => ({ ...prev, mode: 'polygon' }));
      } else if (nextTool === 'radar') {
        propertiesPanelProps?.setPolygonSettings?.((prev: any) => ({ ...prev, mode: 'radar' }));
      }

      // If labels panel is on, provide helpful guidance toast with an instant "Open Properties" action
      if (labelsEnabled || isAdvancedCodingMode) {
        if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = setTimeout(() => {
          if (nextTool) {
            showNotification?.(
              'Labels panel is active. Double-click any tool icon to open its properties panel.',
              '#c6ff1f',
              undefined,
              {
                label: 'Open Properties',
                onClick: () => {
                  setLabelsEnabled?.(false);
                  setIsAdvancedCodingMode?.(false);
                },
              }
            );
          }
        }, 400);
      }
    },
    [tool, labelsEnabled, isAdvancedCodingMode, handleToolDoubleClick, setTool, setLabelsEnabled, setIsAdvancedCodingMode, showNotification]
  );

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  return (
    <motion.div
      initial={{ x: -300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="flex h-full shrink-0 z-30 relative"
    >
      {!isLive && (
        <div className="w-12 bg-[#111] border-r border-[#222] flex flex-col justify-between py-2 z-40 overflow-y-auto no-scrollbar">
          {/* Tools */}
          <div className="flex flex-col items-center gap-1">
            {[
              { id: 'move', icon: MousePointer2, label: 'Move / Select' },
              { id: 'pen', icon: Pen, label: 'Draw' },
              { id: 'arrow', icon: MoveUpRight, label: 'Arrow' },
              { id: 'curved-arrow', icon: CornerUpRight, label: 'Aerial Arrow' },
              { id: 'circle', icon: Circle, label: 'Telestration Ring' },
              { id: 'connected-circle', icon: GitCommitVertical, label: 'Chain' },
              { id: 'spotlight', icon: Flashlight, label: 'Spotlight' },
              { id: 'lens', icon: ZoomIn, label: 'Zoom Lens' },
              { id: 'player-move', icon: User, label: 'Player Move Tool' },
              { id: 'name-tag', icon: Tag, label: 'Player Tag' },
              { id: 'text', icon: Type, label: 'Text' },
              { id: 'polygon', icon: Hexagon, label: 'Polygon' },
              { id: 'radar', icon: Radar, label: 'Radar Ring' },
              { id: 'scanner', icon: ScanEye, label: 'Field Scanner' },
              { id: 'masking', icon: Layers, label: 'Masking / Green Screen' },
            ].map(item => (
              <div key={item.id} className="relative group w-full flex justify-center">
                <button
                  type="button"
                  onClick={() => handleToolClick(item.id as ToolType, item.id === 'masking')}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleToolDoubleClick(item.id as ToolType);
                  }}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                    tool === item.id
                      ? 'bg-[#c6ff1f]/20 text-[#c6ff1f] ring-2 ring-[#c6ff1f]/50'
                      : 'text-gray-400 hover:bg-[#222] hover:text-white'
                  }`}
                  title={`${item.label}${labelsEnabled || isAdvancedCodingMode ? ' (Double-click to open properties)' : ''}`}
                >
                  <item.icon className={`w-4 h-4 ${tool === item.id ? 'stroke-[2.5px]' : ''}`} />
                </button>
                <div className="absolute left-full ml-3 px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-md opacity-0 group-hover:opacity-100 group-hover:scale-100 scale-95 pointer-events-none transition-all duration-200 transform translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap z-50 shadow-xl border border-gray-700 flex flex-col gap-0.5 origin-left">
                  <span>{item.label}</span>
                  {(labelsEnabled || isAdvancedCodingMode) && (
                    <span className="text-[10px] text-[#c6ff1f] font-normal flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#c6ff1f] inline-block animate-pulse" />
                      Double-click to open properties
                    </span>
                  )}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 -mr-[1px] border-8 border-transparent border-r-gray-800"></div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center gap-1 pt-2 border-t border-[#222]">
            {/* Clear tool */}
            <div className="relative group w-full flex justify-center">
              <button
                type="button"
                onClick={() => handleToolClick(null)}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleToolDoubleClick(null);
                }}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                  tool === null
                    ? 'bg-[#c6ff1f]/20 text-[#c6ff1f] ring-2 ring-[#c6ff1f]/50'
                    : 'text-gray-400 hover:bg-[#222] hover:text-white'
                }`}
                title={`Clear Tool & Pause${labelsEnabled || isAdvancedCodingMode ? ' (Double-click to open properties)' : ''}`}
              >
                <Snowflake className="w-4 h-4" />
              </button>
              <div className="absolute left-full ml-3 px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-md opacity-0 group-hover:opacity-100 scale-95 pointer-events-none transition-all duration-200 transform translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap z-50 shadow-xl border border-gray-700 flex flex-col gap-0.5 origin-left">
                <span>Clear Tool & Pause</span>
                {(labelsEnabled || isAdvancedCodingMode) && (
                  <span className="text-[10px] text-[#c6ff1f] font-normal flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#c6ff1f] inline-block animate-pulse" />
                    Double-click to open properties
                  </span>
                )}
                <div className="absolute right-full top-1/2 -translate-y-1/2 -mr-[1px] border-8 border-transparent border-r-gray-800"></div>
              </div>
            </div>

            {/* Quick Properties Opener button when labels panel is hiding the properties panel */}
            {(labelsEnabled || isAdvancedCodingMode) && (
              <div className="relative group w-full flex justify-center mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setLabelsEnabled?.(false);
                    setIsAdvancedCodingMode?.(false);
                    showNotification?.('Tool properties opened • Labels panel closed', '#c6ff1f');
                  }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all text-[#c6ff1f] bg-[#c6ff1f]/10 hover:bg-[#c6ff1f]/25 border border-[#c6ff1f]/40 animate-pulse hover:animate-none"
                  title="Open Tool Properties (Closes Labels)"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>
                <div className="absolute left-full ml-3 px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-md opacity-0 group-hover:opacity-100 scale-95 pointer-events-none transition-all duration-200 transform translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap z-50 shadow-xl border border-gray-700 flex flex-col gap-0.5 origin-left">
                  <span className="font-semibold text-[#c6ff1f]">Open Properties Panel</span>
                  <span className="text-[10px] text-gray-300">Switches from labels to tool properties</span>
                  <div className="absolute right-full top-1/2 -translate-y-1/2 -mr-[1px] border-8 border-transparent border-r-gray-800"></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Properties Panel */}
      {!isLive && (
        <div
          className={`${
            labelsEnabled || isAdvancedCodingMode ? 'w-0 border-r-0 px-0' : 'w-[220px]'
          } bg-[#0c0c0e] border-r border-[#222] overflow-hidden flex flex-col relative z-30 shrink-0 transition-all duration-300`}
        >
          <div className="h-full w-[220px] overflow-y-auto p-3 custom-scrollbar">
            <WorkspacePropertiesPanel {...propertiesPanelProps} />
          </div>
        </div>
      )}
    </motion.div>
  );
};
