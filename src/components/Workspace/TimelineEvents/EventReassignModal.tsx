import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeftRight, X, Check, Search, AlertTriangle, 
  ArrowRight, Layers, Tag as TagIcon, CheckSquare, Square, ChevronLeft
} from 'lucide-react';
import { Tag as TagData, TagEvent } from '../../../types';
import { formatTime } from '../../../utils/math';

interface EventReassignModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: TagEvent | null;
  currentTag: TagData | null;
  allTags: TagData[];
  onConfirmReassign: (eventId: string, newTagIds: string[]) => void;
}

export const EventReassignModal: React.FC<EventReassignModalProps> = ({
  isOpen,
  onClose,
  event,
  currentTag,
  allTags,
  onConfirmReassign,
}) => {
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Initialize selection when opening
  useEffect(() => {
    if (isOpen && event) {
      setSelectedTagIds(new Set([event.tagId]));
      setSearchQuery('');
      setShowConfirmation(false);
    }
  }, [isOpen, event]);

  const filteredTags = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return allTags;
    return allTags.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.shortcut && t.shortcut.toLowerCase().includes(q))
    );
  }, [allTags, searchQuery]);

  const selectedTagsList = useMemo(() => {
    return allTags.filter((t) => selectedTagIds.has(t.id));
  }, [allTags, selectedTagIds]);

  // Determine if there are actual changes compared to current event.tagId
  const hasChanges = useMemo(() => {
    if (!event) return false;
    if (selectedTagIds.size !== 1) return true;
    return !selectedTagIds.has(event.tagId);
  }, [selectedTagIds, event]);

  // Generate change explanation for confirmation popup
  const changeSummary = useMemo(() => {
    if (!event) {
      return {
        type: 'move',
        headline: '',
        originalTags: [],
        newTags: [],
        bullets: [],
      };
    }
    const originalTagName = currentTag?.name || 'Current Tag';
    const originalTagColor = currentTag?.color || '#3b82f6';
    const isOriginalKept = selectedTagIds.has(event.tagId);
    const newTags = selectedTagsList.filter((t) => t.id !== event.tagId);

    if (selectedTagIds.size === 1) {
      const targetTag = selectedTagsList[0];
      return {
        type: 'move',
        headline: `Move event from "${originalTagName}" to "${targetTag?.name || 'New Tag'}"`,
        originalTags: [{ name: originalTagName, color: originalTagColor }],
        newTags: targetTag ? [{ name: targetTag.name, color: targetTag.color }] : [],
        bullets: [
          `Event category will change from "${originalTagName}" to "${targetTag?.name}".`,
          `Timing (${formatTime(event.startTime)} – ${formatTime(event.endTime)}), notes, and labels will be preserved.`,
          `Original "${originalTagName}" event will be replaced.`,
        ],
      };
    }

    if (isOriginalKept) {
      return {
        type: 'multi-keep',
        headline: `Keep in "${originalTagName}" and add to ${newTags.length} additional tag${newTags.length > 1 ? 's' : ''}`,
        originalTags: [{ name: originalTagName, color: originalTagColor }],
        newTags: selectedTagsList.map((t) => ({ name: t.name, color: t.color })),
        bullets: [
          `Original event remains active in "${originalTagName}".`,
          `${newTags.length} new matching event${newTags.length > 1 ? 's' : ''} will be created for: ${newTags.map((t) => `"${t.name}"`).join(', ')}.`,
          `All events share the same timing (${formatTime(event.startTime)} – ${formatTime(event.endTime)}), notes, and labels.`,
        ],
      };
    }

    return {
      type: 'multi-replace',
      headline: `Replace "${originalTagName}" with ${selectedTagsList.length} tags: ${selectedTagsList.map((t) => `"${t.name}"`).join(', ')}`,
      originalTags: [{ name: originalTagName, color: originalTagColor }],
      newTags: selectedTagsList.map((t) => ({ name: t.name, color: t.color })),
      bullets: [
        `Event will be removed from "${originalTagName}".`,
        `Assigned to ${selectedTagsList.length} tags: ${selectedTagsList.map((t) => `"${t.name}"`).join(', ')}.`,
        `All events share the same timing (${formatTime(event.startTime)} – ${formatTime(event.endTime)}), notes, and labels.`,
      ],
    };
  }, [currentTag, selectedTagIds, selectedTagsList, event]);

  if (!isOpen || !event) return null;

  const toggleTagSelection = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        // Don't allow unselecting all tags (must keep at least 1)
        if (next.size > 1) {
          next.delete(tagId);
        }
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  const handleSelectOnly = (tagId: string) => {
    setSelectedTagIds(new Set([tagId]));
  };

  const duration = Math.max(0, event.endTime - event.startTime);

  const handleApplyChanges = () => {
    onConfirmReassign(event.id, Array.from(selectedTagIds));
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.15 }}
          className="bg-[#141721] border border-[#2b3345] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col text-white"
        >
          {/* Header */}
          <div className="p-4 border-b border-[#202736] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-[#c6ff1f]/15 border border-[#c6ff1f]/30 text-[#c6ff1f]">
                <ArrowLeftRight className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide">
                  {showConfirmation ? 'Confirm Tag Reassignment' : 'Reassign Event Tag'}
                </h3>
                <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: currentTag?.color || '#3b82f6' }}
                  />
                  <span className="text-gray-300 font-medium">
                    Current: {currentTag?.name || 'Event'}
                  </span>
                  <span>•</span>
                  <span className="font-mono text-gray-400">
                    {formatTime(event.startTime)} – {formatTime(event.endTime)} ({duration.toFixed(1)}s)
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!showConfirmation ? (
            /* STEP 1: TAG SELECTION */
            <>
              {/* Instructions & Search */}
              <div className="p-4 pb-2 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>
                    Select target tag(s). Multiple tags will create synced events.
                  </span>
                  <span className="font-mono text-[11px] text-[#c6ff1f]">
                    {selectedTagIds.size} selected
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tags by name or hotkey..."
                    className="w-full bg-[#0b0d13] border border-[#232b3c] focus:border-[#c6ff1f] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Tag List */}
              <div className="px-4 py-2 flex-1 max-h-[260px] overflow-y-auto custom-scrollbar space-y-1.5">
                {filteredTags.map((tag) => {
                  const isSelected = selectedTagIds.has(tag.id);
                  const isCurrent = tag.id === event.tagId;

                  return (
                    <div
                      key={tag.id}
                      onClick={() => toggleTagSelection(tag.id)}
                      className={`group flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#181d2a] border-[#c6ff1f]/60 shadow-sm'
                          : 'bg-[#0d1017] border-[#1d2332] hover:border-[#2f384d] hover:bg-[#121621]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-3 h-3 rounded-full shrink-0 shadow-inner"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-xs font-medium text-white truncate">
                          {tag.name}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300 font-mono">
                            Current
                          </span>
                        )}
                        {tag.shortcut && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#202736] text-gray-400 font-mono">
                            {tag.shortcut.toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Quick switch button if user wants only this tag */}
                        {!isSelected && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectOnly(tag.id);
                            }}
                            className="text-[10px] text-gray-400 hover:text-[#c6ff1f] px-1.5 py-0.5 rounded hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Select Only
                          </button>
                        )}
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                            isSelected
                              ? 'bg-[#c6ff1f] border-[#c6ff1f] text-black'
                              : 'border-gray-600 bg-transparent'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredTags.length === 0 && (
                  <div className="text-center py-6 text-gray-500 text-xs">
                    No tags found matching "{searchQuery}".
                  </div>
                )}
              </div>

              {/* Selection preview chips */}
              <div className="px-4 py-2 border-t border-[#1d2332] bg-[#0c0e14] flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5">
                  <span className="text-[10px] text-gray-400 uppercase font-bold shrink-0">
                    Target:
                  </span>
                  {selectedTagsList.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-[#1a2130] border border-[#2b354c] text-white shrink-0"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span>{tag.name}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="p-3.5 bg-[#0e1118] border-t border-[#202736] flex items-center justify-between">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={selectedTagIds.size === 0 || !hasChanges}
                  onClick={() => setShowConfirmation(true)}
                  className="px-4 py-1.5 text-xs font-semibold bg-[#c6ff1f] hover:bg-[#d6ff4d] disabled:opacity-40 disabled:hover:bg-[#c6ff1f] text-black rounded-lg transition-all shadow-md shadow-[#c6ff1f]/20 flex items-center gap-1.5"
                >
                  <span>Review & Reassign</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : (
            /* STEP 2: CONFIRMATION POPUP (EXPLICIT CHANGE DETAILS) */
            <>
              <div className="p-5 flex flex-col gap-4">
                <div className="p-3 bg-[#0c0e14] border border-[#242c3d] rounded-xl flex flex-col gap-3">
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#c6ff1f]" />
                    <span>{changeSummary.headline}</span>
                  </div>

                  {/* Visual before -> after comparison */}
                  <div className="grid grid-cols-2 gap-3 pt-1 border-t border-white/5 text-xs">
                    <div className="bg-[#141822] p-2.5 rounded-lg border border-white/5">
                      <div className="text-[10px] text-gray-400 uppercase font-semibold mb-1">
                        Original Tag
                      </div>
                      <div className="flex items-center gap-1.5 font-medium text-gray-200">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: currentTag?.color || '#3b82f6' }}
                        />
                        <span>{currentTag?.name}</span>
                      </div>
                    </div>

                    <div className="bg-[#141822] p-2.5 rounded-lg border border-[#c6ff1f]/30">
                      <div className="text-[10px] text-[#c6ff1f] uppercase font-semibold mb-1">
                        New Tag(s) ({selectedTagsList.length})
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {selectedTagsList.map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-white/10 text-white"
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: tag.color }}
                            />
                            <span>{tag.name}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detailed bullet list of what will change */}
                <div className="space-y-1.5">
                  <div className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">
                    Summary of Changes
                  </div>
                  <div className="bg-[#0b0d13] border border-[#1f2636] rounded-lg p-3 text-xs text-gray-300 space-y-2">
                    {changeSummary.bullets.map((b, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-[#c6ff1f] font-bold">•</span>
                        <span className="leading-relaxed">{b}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {event.notes && (
                  <div className="text-[11px] text-gray-400 bg-white/5 p-2 rounded-lg flex items-center gap-2">
                    <span className="text-gray-300 font-medium">Note preserved:</span>
                    <span className="italic truncate text-gray-400">"{event.notes}"</span>
                  </div>
                )}
              </div>

              {/* Confirmation Footer */}
              <div className="p-3.5 bg-[#0e1118] border-t border-[#202736] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowConfirmation(false)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back to Selection</span>
                </button>
                <button
                  type="button"
                  onClick={handleApplyChanges}
                  className="px-4 py-1.5 text-xs font-bold bg-[#c6ff1f] hover:bg-[#d6ff4d] text-black rounded-lg transition-all shadow-lg shadow-[#c6ff1f]/30 flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Confirm & Apply Changes</span>
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
