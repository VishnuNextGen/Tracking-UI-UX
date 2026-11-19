import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, DragControls } from 'framer-motion';
import {
  Check,
  Tag,
  ChevronDown,
  Zap,
  Download,
  GripHorizontal,
  Maximize2,
  X,
  Layers,
} from 'lucide-react';
import { LiveTimerWidget, useLiveClock } from '../LiveCoding';
import { AdvancedCodingPad } from '../AdvancedCodingPad';
import { fadeColor } from '../../../utils/colors';
import type {
  PeriodSync,
  ActiveRecording,
  Label,
  LabelGroup,
  Tag as TagData,
  TagEvent,
  AdvancedPadItem,
  SmartConnector,
} from '../../../types';

export interface WorkspaceFloatingPopoutsProps {
  liveClock: ReturnType<typeof useLiveClock>;
  periodSyncs: PeriodSync[];
  isTaggingMode: boolean;
  setIsTaggingMode: React.Dispatch<React.SetStateAction<boolean>>;
  activeRecording: ActiveRecording | null;
  activeRecordings: ActiveRecording[];
  setActiveRecordings: React.Dispatch<React.SetStateAction<ActiveRecording[]>>;
  labelsActiveTargetTab: string | null;
  selectedEventIds: Set<string>;
  tagEvents: TagEvent[];
  filterTagId: string | null;
  filterLabelId: string | null;
  handleLabelClick: (labelId: string, targetOverride?: string | null) => void;
  showCodingPaneLabels: boolean;
  setShowCodingPaneLabels: React.Dispatch<React.SetStateAction<boolean>>;
  labels: Label[];
  setLabels: React.Dispatch<React.SetStateAction<Label[]>>;
  labelGroups: LabelGroup[];
  setLabelGroups: React.Dispatch<React.SetStateAction<LabelGroup[]>>;
  labelsEnabled: boolean;
  setLabelsEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  tags: TagData[];
  setTags: React.Dispatch<React.SetStateAction<TagData[]>>;
  handleTagClick: (tagId: string, options?: { ignoreLeadLag?: boolean }) => void;
  exportEventsToCSV: () => void;
  isTimerPoppedOut: boolean;
  setIsTimerPoppedOut: React.Dispatch<React.SetStateAction<boolean>>;
  isPadPoppedOut: boolean;
  setIsPadPoppedOut: React.Dispatch<React.SetStateAction<boolean>>;
  poppedOutCodingMode: 'panel' | 'pad';
  setPoppedOutCodingMode: React.Dispatch<React.SetStateAction<'panel' | 'pad'>>;
  timerDragControls: DragControls;
  padDragControls: DragControls;
  timerWidgetPos: { x: number; y: number; w: number; h: number };
  padWidgetPos: { x: number; y: number; w: number; h: number };
  timerExternalWindow: Window | null;
  setTimerExternalWindow: React.Dispatch<React.SetStateAction<Window | null>>;
  padExternalWindow: Window | null;
  setPadExternalWindow: React.Dispatch<React.SetStateAction<Window | null>>;
  externalTimerContainer: HTMLElement | null;
  setExternalTimerContainer: React.Dispatch<React.SetStateAction<HTMLElement | null>>;
  externalPadContainer: HTMLElement | null;
  setExternalPadContainer: React.Dispatch<React.SetStateAction<HTMLElement | null>>;
  openExternalWindow: (type: 'timer' | 'pad') => void;
  advancedPadItems: AdvancedPadItem[];
  setAdvancedPadItems: React.Dispatch<React.SetStateAction<AdvancedPadItem[]>>;
  connectors: SmartConnector[];
  setConnectors: React.Dispatch<React.SetStateAction<SmartConnector[]>>;
  isPadQuickTagEnabled: boolean;
  handleTogglePadQuickTag: () => void;
  setEditingLabelId: React.Dispatch<React.SetStateAction<string | null>>;
  setTempLabel: React.Dispatch<React.SetStateAction<Partial<Label>>>;
  showNotification: (
    message: string,
    color: string,
    onUndo?: () => void,
    action?: { label: string; onClick: () => void }
  ) => void;
}

export const WorkspaceFloatingPopouts: React.FC<WorkspaceFloatingPopoutsProps> = ({
  liveClock,
  periodSyncs,
  isTaggingMode,
  setIsTaggingMode,
  activeRecording,
  activeRecordings,
  setActiveRecordings,
  labelsActiveTargetTab,
  selectedEventIds,
  tagEvents,
  filterTagId,
  filterLabelId,
  handleLabelClick,
  showCodingPaneLabels,
  setShowCodingPaneLabels,
  labels,
  setLabels,
  labelGroups,
  setLabelGroups,
  labelsEnabled,
  setLabelsEnabled,
  tags,
  setTags,
  handleTagClick,
  exportEventsToCSV,
  isTimerPoppedOut,
  setIsTimerPoppedOut,
  isPadPoppedOut,
  setIsPadPoppedOut,
  poppedOutCodingMode,
  setPoppedOutCodingMode,
  timerDragControls,
  padDragControls,
  timerWidgetPos,
  padWidgetPos,
  timerExternalWindow,
  setTimerExternalWindow,
  padExternalWindow,
  setPadExternalWindow,
  externalTimerContainer,
  setExternalTimerContainer,
  externalPadContainer,
  setExternalPadContainer,
  openExternalWindow,
  advancedPadItems,
  setAdvancedPadItems,
  connectors,
  setConnectors,
  isPadQuickTagEnabled,
  handleTogglePadQuickTag,
  setEditingLabelId,
  setTempLabel,
  showNotification,
}) => {
  const renderTimerWidgetContent = () => {
    return (
      <LiveTimerWidget
        clockDetails={liveClock.getMatchClockDetails()}
        clockState={liveClock.matchClockState}
        activePeriodId={liveClock.matchPeriod}
        periods={liveClock.periods}
        maxPeriodIndex={liveClock.maxPeriodIndex}
        periodSyncs={periodSyncs}
        isEditingTimer={liveClock.isEditingTimer}
        editedTimerValue={liveClock.editedTimerValue}
        onSetEditedTimerValue={liveClock.setEditedTimerValue}
        onStartEditing={liveClock.startEditingTimer}
        onCancelEditing={() => liveClock.setIsEditingTimer(false)}
        onSaveEditing={() => liveClock.handleSaveTimer()}
        onResume={liveClock.resumeLiveClock}
        onPause={liveClock.pauseLiveClock}
        onRequestPeriod={liveClock.requestStartLiveClock}
        onAdjustTime={liveClock.nudgeEditedTimer}
      />
    );
  };

  const renderCodingPanelContent = () => {
    // Count active attached labels across recordings
    const attachedCount = activeRecordings.reduce((acc, r) => acc + (r.labelIds?.length || 0), 0);

    const renderLabelButton = (l: Label) => {
      let isActiveLabel = false;
      if (isTaggingMode) {
        if (activeRecordings.length > 0) {
          if (labelsActiveTargetTab && labelsActiveTargetTab !== 'all') {
            const targetRec = activeRecordings.find(r => r.tagId === labelsActiveTargetTab);
            isActiveLabel = !!targetRec?.labelIds?.includes(l.id);
          } else {
            isActiveLabel = activeRecordings.every(r => r.labelIds?.includes(l.id));
          }
        } else if (selectedEventIds.size > 0) {
          if (labelsActiveTargetTab && labelsActiveTargetTab !== 'all') {
            const targetEvt = tagEvents.find(e => e.id === labelsActiveTargetTab);
            isActiveLabel = !!targetEvt?.labelIds?.includes(l.id);
          } else {
            const selectedEvents = tagEvents.filter(e => selectedEventIds.has(e.id));
            isActiveLabel =
              selectedEvents.length > 0 && selectedEvents.every(e => e.labelIds?.includes(l.id));
          }
        }
      } else {
        isActiveLabel = filterLabelId === l.id;
      }

      return (
        <button
          key={l.id}
          type="button"
          onClick={() => handleLabelClick(l.id, labelsActiveTargetTab)}
          className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 ${
            isActiveLabel
              ? 'bg-[#c6ff1f]/20 border-[#c6ff1f] text-[#c6ff1f] shadow-[0_0_10px_rgba(198,255,31,0.2)] font-black ring-1 ring-[#c6ff1f]/50'
              : 'bg-[#18181d] hover:bg-[#25252c] border-[#2c2c36] text-gray-300 hover:text-white'
          }`}
          title={`${l.name}${l.shortcut ? ` [Key: ${l.shortcut}]` : ''} • Click to ${
            isTaggingMode ? 'attach/detach qualifier' : 'filter'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isActiveLabel ? 'bg-[#c6ff1f] ring-2 ring-[#c6ff1f]/40' : 'bg-indigo-400'
            }`}
            style={{ backgroundColor: isActiveLabel ? '#c6ff1f' : (l as any).color || undefined }}
          />
          <span className="truncate max-w-[110px]">{l.name}</span>
          {l.shortcut && (
            <span className="text-[8px] font-mono opacity-70 bg-black/40 px-1 py-0.2 rounded border border-white/10 shrink-0">
              [{l.shortcut}]
            </span>
          )}
          {isActiveLabel && <Check className="w-2.5 h-2.5 text-[#c6ff1f] shrink-0 ml-0.5" />}
        </button>
      );
    };

    return (
      <div className="flex-1 flex flex-col min-h-0 bg-[#0c0c0e] text-white overflow-hidden select-none font-sans">
        {/* Sub-header with Tagging State & Controls - Clean, no settings button, no code file bar */}
        <div className="px-3 py-2 border-b border-[#222] bg-[#141418] flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isTaggingMode ? 'text-red-400' : 'text-gray-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isTaggingMode ? 'bg-red-500 animate-pulse ring-2 ring-red-500/30' : 'bg-gray-600'
                }`}
              />
              {isTaggingMode ? 'Recording Active' : 'Tagging Idle'}
            </span>
            {activeRecordings.length > 0 && (
              <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-[9px] font-mono font-bold animate-pulse">
                {activeRecordings.length} rec
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                const nextMode = !isTaggingMode;
                setIsTaggingMode(nextMode);
                if (!nextMode) setActiveRecordings([]);
              }}
              className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all cursor-pointer shadow-sm active:scale-95 ${
                isTaggingMode
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-[#222] hover:bg-[#333] text-gray-200 hover:text-white border border-[#333]'
              }`}
            >
              {isTaggingMode ? 'Stop Tagging' : 'Start Tagging'}
            </button>
          </div>
        </div>

        {/* Labels & Qualifiers Section (Expandable/Collapsible if user needs it) */}
        <div className="border-b border-[#222] bg-[#111115] shrink-0">
          <div className="px-3 py-1.5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowCodingPaneLabels(!showCodingPaneLabels)}
              className="flex items-center gap-1.5 text-left text-gray-300 hover:text-white cursor-pointer select-none group"
              title={showCodingPaneLabels ? 'Collapse Labels Section' : 'Expand Labels Section'}
            >
              <Tag className="w-3.5 h-3.5 text-[#c6ff1f] group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-200">
                Labels & Qualifiers
              </span>
              <span className="px-1.5 py-0.2 bg-[#202026] text-gray-400 rounded text-[8.5px] font-mono font-bold">
                {labels.length}
              </span>
              {attachedCount > 0 && (
                <span className="px-1.5 py-0.2 bg-[#c6ff1f]/15 text-[#c6ff1f] border border-[#c6ff1f]/30 rounded text-[8.5px] font-bold">
                  {attachedCount} attached
                </span>
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${
                  showCodingPaneLabels ? 'rotate-180' : ''
                }`}
              />
            </button>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setLabelsEnabled(!labelsEnabled)}
                className={`text-[8.5px] font-bold uppercase px-2 py-0.5 rounded transition-all cursor-pointer ${
                  labelsEnabled
                    ? 'bg-[#c6ff1f]/15 text-[#c6ff1f] border border-[#c6ff1f]/40 shadow-xs'
                    : 'bg-[#18181c] text-gray-500 border border-[#2a2a32] hover:text-gray-400'
                }`}
                title="Toggle Label Mode (Allow attaching labels to recorded events)"
              >
                {labelsEnabled ? 'Labels ON' : 'Labels OFF'}
              </button>
            </div>
          </div>

          {showCodingPaneLabels && (
            <div className="px-3 pt-1 pb-2 bg-[#0e0e12] border-t border-[#1a1a20] max-h-48 overflow-y-auto custom-scrollbar">
              {labels.length === 0 ? (
                <div className="py-2.5 text-center text-[10px] text-gray-500 italic">
                  No labels in this template. Labels created in the sidebar appear here as live qualifiers.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {(() => {
                    const handledLabelIds = new Set<string>();
                    const groupsWithLabels = labelGroups
                      .map(g => ({
                        group: g,
                        labels: labels.filter(l => l.groupId === g.id),
                      }))
                      .filter(g => g.labels.length > 0);

                    groupsWithLabels.forEach(g => g.labels.forEach(l => handledLabelIds.add(l.id)));
                    const ungrouped = labels.filter(l => !handledLabelIds.has(l.id));

                    return (
                      <>
                        {groupsWithLabels.map(({ group, labels: grpLabels }) => (
                          <div key={group.id} className="flex flex-col gap-1">
                            <div className="text-[8.5px] font-extrabold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400/80" />
                              <span>{group.name}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {grpLabels.map(l => renderLabelButton(l))}
                            </div>
                          </div>
                        ))}

                        {ungrouped.length > 0 && (
                          <div className="flex flex-col gap-1">
                            {groupsWithLabels.length > 0 && (
                              <div className="text-[8.5px] font-extrabold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                                <span>General</span>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-1.5">
                              {ungrouped.map(l => renderLabelButton(l))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Interactive Tags Grid */}
        <div className="flex-1 overflow-y-auto p-2.5 custom-scrollbar">
          <div
            className="grid gap-1.5"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(95px, 1fr))',
            }}
          >
            {tags.map(tag => {
              const isActive = isTaggingMode && activeRecordings.some(r => r.tagId === tag.id);
              const currentRec = activeRecordings.find(r => r.tagId === tag.id);
              const count = tagEvents.filter(e => e.tagId === tag.id).length;
              const isFiltered = filterTagId === tag.id;
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleTagClick(tag.id)}
                  className={`relative min-h-[44px] py-1.5 px-2 pl-3 rounded-lg border flex items-center justify-between gap-1 transition-all overflow-hidden group text-left cursor-pointer active:scale-95 ${
                    isTaggingMode
                      ? isActive
                        ? 'border-transparent bg-gray-800 scale-95 ring-2 ring-white shadow-lg'
                        : 'border-[#333] bg-[#161618] hover:bg-[#222]'
                      : isFiltered
                      ? 'border-transparent bg-[#222] ring-2 ring-white shadow-md'
                      : 'border-[#2d2d35] bg-[#151518] hover:bg-[#202025]'
                  }`}
                  style={{
                    borderColor: isActive || isFiltered ? tag.color : undefined,
                    boxShadow: isActive ? `0 0 12px ${fadeColor(tag.color, 0.25)}` : undefined,
                  }}
                  title={`${tag.name}${tag.shortcut ? ` [Key: ${tag.shortcut}]` : ''} • Click to ${
                    isTaggingMode ? 'record event' : 'filter events'
                  }`}
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 w-[4px]"
                    style={{ backgroundColor: tag.color }}
                  />
                  <div className="flex-1 min-w-0 pr-0.5 flex flex-col justify-center">
                    <span className="font-semibold text-gray-200 text-xs truncate">{tag.name}</span>
                    {isActive && currentRec?.labelIds && currentRec.labelIds.length > 0 && (
                      <span className="text-[8px] text-[#c6ff1f] font-mono truncate">
                        +{currentRec.labelIds.length} label${currentRec.labelIds.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-0.5">
                    {tag.shortcut && (
                      <div
                        className="flex items-center justify-center min-w-[16px] h-[16px] bg-[#2a2a2a] group-hover:bg-[#383838] rounded text-[8.5px] font-bold text-gray-400 group-hover:text-white border border-[#444] px-1 font-mono shadow-xs"
                        title={`Hotkey: ${tag.shortcut}`}
                      >
                        {tag.shortcut}
                      </div>
                    )}
                    {!isTaggingMode && (
                      <span className="text-[9px] text-gray-500 font-mono font-medium px-0.5">{count}</span>
                    )}
                  </div>
                  {isActive && (
                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  )}
                  {isTaggingMode && tag.leadLagEnabled && (
                    <div className="absolute bottom-0.5 right-0.5 opacity-60">
                      <Zap className="w-2.5 h-2.5 text-yellow-500 fill-yellow-500" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pinned Footer */}
        <div className="p-2 border-t border-[#222] bg-[#0d0d10] flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-1.5 text-gray-400">
            <span className="font-medium text-gray-400 text-[11px]">Logged Events:</span>
            <span className="font-mono font-bold text-[#c6ff1f] text-[11px]">{tagEvents.length}</span>
          </div>
          <button
            type="button"
            onClick={exportEventsToCSV}
            className="px-2 py-0.5 bg-[#1a1a22] hover:bg-[#252530] text-gray-300 hover:text-white rounded text-[9.5px] font-bold flex items-center gap-1 transition-colors border border-white/5 cursor-pointer"
            title="Export CSV of logged events"
          >
            <Download className="w-3 h-3 text-emerald-400" />
            <span>CSV</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Floating Draggable & Resizable Timer Entity */}
      <AnimatePresence>
        {isTimerPoppedOut && !externalTimerContainer && (
          <motion.div
            drag
            dragControls={timerDragControls}
            dragListener={false}
            dragMomentum={false}
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 15 }}
            className="fixed z-[300] bg-[#101014]/95 backdrop-blur-xl border border-[#c6ff1f]/40 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden resize min-w-[240px] min-h-[125px] max-w-[calc(100vw-24px)] max-h-[90vh]"
            style={{
              left: timerWidgetPos.x,
              top: timerWidgetPos.y,
              width: timerWidgetPos.w,
              height: timerWidgetPos.h,
            }}
          >
            {/* Window Title & Drag Handle Header */}
            <div
              onPointerDown={e => timerDragControls.start(e)}
              className="h-8 bg-[#16161b] border-b border-[#25252d] flex items-center justify-between px-2.5 cursor-grab active:cursor-grabbing select-none shrink-0"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <GripHorizontal className="w-3.5 h-3.5 text-[#c6ff1f] shrink-0" />
                <span className="text-[11px] font-bold text-gray-200 truncate">Match Timer</span>
                <span className="text-[9px] bg-[#c6ff1f]/15 text-[#c6ff1f] border border-[#c6ff1f]/30 px-1 py-0.2 rounded font-mono uppercase font-bold">
                  Floating
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => openExternalWindow('timer')}
                  className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors cursor-pointer"
                  title="Open in Standalone Browser OS Window"
                >
                  <Maximize2 className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsTimerPoppedOut(false)}
                  className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
                  title="Dock Timer back to Workspace"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Window Body */}
            <div className="flex-1 overflow-hidden p-2 flex flex-col justify-center bg-[#0d0d10]">
              {renderTimerWidgetContent()}
            </div>

            {/* Resize handle visual cue */}
            <div className="absolute bottom-1 right-1 w-2.5 h-2.5 border-r border-b border-[#c6ff1f]/50 pointer-events-none rounded-br" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Draggable & Resizable Coding Pad Entity */}
      <AnimatePresence>
        {isPadPoppedOut && !externalPadContainer && (
          <motion.div
            drag
            dragControls={padDragControls}
            dragListener={false}
            dragMomentum={false}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed z-[300] bg-[#121215]/95 backdrop-blur-xl border border-indigo-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden resize min-w-[280px] sm:min-w-[360px] min-h-[300px] max-w-[calc(100vw-24px)] max-h-[88vh]"
            style={{
              left: padWidgetPos.x,
              top: padWidgetPos.y,
              width: padWidgetPos.w,
              height: padWidgetPos.h,
            }}
          >
            {/* Window Title & Drag Handle Header */}
            <div
              onPointerDown={e => padDragControls.start(e)}
              className="h-10 bg-[#18181c] border-b border-[#2d2d35] flex items-center justify-between px-3 cursor-grab active:cursor-grabbing select-none shrink-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <GripHorizontal className="w-4 h-4 text-indigo-400 shrink-0" />
                <div className="flex items-center bg-[#101014] border border-[#2d2d38] rounded-lg p-0.5 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setPoppedOutCodingMode('panel')}
                    className={`px-2 py-0.5 rounded text-[9.5px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer ${
                      poppedOutCodingMode === 'panel'
                        ? 'bg-[#c6ff1f] text-black shadow-xs font-black'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    title="Switch to Normal Coding Panel (Clean tags grid & hotkeys)"
                  >
                    <Tag className="w-3 h-3" />
                    <span>Coding Panel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPoppedOutCodingMode('pad')}
                    className={`px-2 py-0.5 rounded text-[9.5px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer ${
                      poppedOutCodingMode === 'pad'
                        ? 'bg-[#c6ff1f] text-black shadow-xs font-black'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    title="Switch to Interactive Advanced Coding Pad"
                  >
                    <Layers className="w-3 h-3" />
                    <span>Advanced Pad</span>
                  </button>
                </div>
                <span className="text-[10px] bg-[#c6ff1f]/10 text-[#c6ff1f] border border-[#c6ff1f]/20 px-1.5 py-0.5 rounded font-mono uppercase font-bold hidden sm:inline-block">
                  Floating
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => openExternalWindow('pad')}
                  className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors cursor-pointer"
                  title="Open in Standalone Browser OS Window"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsPadPoppedOut(false)}
                  className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
                  title="Dock Coding Pad back to Workspace"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Window Body */}
            <div className="flex-1 overflow-hidden flex flex-col bg-[#0d0d10]">
              {poppedOutCodingMode === 'panel' ? (
                renderCodingPanelContent()
              ) : (
                <div className="flex-1 overflow-hidden flex flex-col p-2">
                  <AdvancedCodingPad
                    tags={tags}
                    labels={labels}
                    labelGroups={labelGroups}
                    setTags={setTags}
                    setLabels={setLabels}
                    setLabelGroups={setLabelGroups}
                    items={advancedPadItems}
                    setItems={setAdvancedPadItems}
                    connectors={connectors}
                    setConnectors={setConnectors}
                    isTaggingMode={isTaggingMode}
                    setIsTaggingMode={setIsTaggingMode}
                    activeRecording={activeRecording}
                    activeRecordings={activeRecordings}
                    onTagClick={tagId => handleTagClick(tagId, { ignoreLeadLag: !isPadQuickTagEnabled })}
                    onLabelClick={handleLabelClick}
                    onAddTag={tag => setTags(prev => [...prev, tag])}
                    onAddLabel={label => setLabels(prev => [...prev, label])}
                    onExit={() => setIsPadPoppedOut(false)}
                    showNotification={showNotification}
                    hideCodeFile={true}
                    hideTagSettings={true}
                    isQuickTagEnabled={isPadQuickTagEnabled}
                    onToggleQuickTag={handleTogglePadQuickTag}
                    onEditTag={() => {}}
                    onEditLabel={labelId => {
                      const label = labels.find(l => l.id === labelId);
                      if (label) {
                        setEditingLabelId(labelId);
                        setTempLabel({
                          name: label.name,
                          shortcut: label.shortcut,
                          exclusive: label.exclusive,
                        });
                      }
                    }}
                  />
                </div>
              )}
            </div>

            {/* Resize handle visual cue */}
            <div className="absolute bottom-1 right-1 w-3 h-3 border-r-2 border-b-2 border-indigo-400/50 pointer-events-none rounded-br" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Portals for External OS Browser Popouts */}
      {externalTimerContainer &&
        createPortal(
          <div className="flex-1 flex flex-col p-4 bg-[#0e0e11] text-white min-h-screen">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <span className="text-sm font-bold text-[#c6ff1f] uppercase tracking-wider flex items-center gap-2">
                ⏰ Standalone Match Timer
              </span>
              <button
                onClick={() => {
                  if (timerExternalWindow) timerExternalWindow.close();
                  setTimerExternalWindow(null);
                  setExternalTimerContainer(null);
                }}
                className="px-3 py-1 bg-red-600/80 hover:bg-red-600 rounded text-xs text-white font-bold"
              >
                Close & Return
              </button>
            </div>
            {renderTimerWidgetContent()}
          </div>,
          externalTimerContainer
        )}

      {externalPadContainer &&
        createPortal(
          <div className="flex-1 flex flex-col p-2 bg-[#0e0e11] text-white h-screen">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2 px-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#c6ff1f] uppercase tracking-wider flex items-center gap-2">
                  🏷️ Standalone Coding Entity
                </span>
                <div className="flex items-center bg-[#101014] border border-[#2d2d38] rounded-lg p-0.5 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setPoppedOutCodingMode('panel')}
                    className={`px-2 py-0.5 rounded text-[9.5px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer ${
                      poppedOutCodingMode === 'panel'
                        ? 'bg-[#c6ff1f] text-black shadow-xs font-black'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    title="Switch to Normal Coding Panel"
                  >
                    <Tag className="w-3 h-3" />
                    <span>Coding Panel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPoppedOutCodingMode('pad')}
                    className={`px-2 py-0.5 rounded text-[9.5px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer ${
                      poppedOutCodingMode === 'pad'
                        ? 'bg-[#c6ff1f] text-black shadow-xs font-black'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    title="Switch to Interactive Advanced Coding Pad"
                  >
                    <Layers className="w-3 h-3" />
                    <span>Advanced Pad</span>
                  </button>
                </div>
              </div>
              <button
                onClick={() => {
                  if (padExternalWindow) padExternalWindow.close();
                  setPadExternalWindow(null);
                  setExternalPadContainer(null);
                }}
                className="px-2.5 py-1 bg-red-600/80 hover:bg-red-600 rounded text-xs text-white font-bold cursor-pointer"
              >
                Close & Return
              </button>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col">
              {poppedOutCodingMode === 'panel' ? (
                renderCodingPanelContent()
              ) : (
                <AdvancedCodingPad
                  tags={tags}
                  labels={labels}
                  labelGroups={labelGroups}
                  setTags={setTags}
                  setLabels={setLabels}
                  setLabelGroups={setLabelGroups}
                  items={advancedPadItems}
                  setItems={setAdvancedPadItems}
                  connectors={connectors}
                  setConnectors={setConnectors}
                  isTaggingMode={isTaggingMode}
                  setIsTaggingMode={setIsTaggingMode}
                  activeRecording={activeRecording}
                  activeRecordings={activeRecordings}
                  onTagClick={tagId => handleTagClick(tagId, { ignoreLeadLag: !isPadQuickTagEnabled })}
                  onLabelClick={handleLabelClick}
                  onAddTag={tag => setTags(prev => [...prev, tag])}
                  onAddLabel={label => setLabels(prev => [...prev, label])}
                  onExit={() => {}}
                  showNotification={showNotification}
                  hideCodeFile={true}
                  hideTagSettings={true}
                  isQuickTagEnabled={isPadQuickTagEnabled}
                  onToggleQuickTag={handleTogglePadQuickTag}
                  onEditTag={() => {}}
                  onEditLabel={labelId => {
                    const label = labels.find(l => l.id === labelId);
                    if (label) {
                      setEditingLabelId(labelId);
                      setTempLabel({
                        name: label.name,
                        shortcut: label.shortcut,
                        exclusive: label.exclusive,
                      });
                    }
                  }}
                />
              )}
            </div>
          </div>,
          externalPadContainer
        )}
    </>
  );
};
