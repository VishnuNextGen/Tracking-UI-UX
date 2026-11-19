import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, Plus, Check } from 'lucide-react';
import { Tag as TagData, TagEvent, Label } from '../../types';
import { formatTime } from '../../utils/math';

interface PlaylistInsertEventPopoverProps {
  insertAtIndex: number;
  tagEvents: TagEvent[];
  tags: TagData[];
  labels: Label[];
  existingEventIds: Set<string>;
  onInsertEvents: (eventIds: string[], forceDuplicates: boolean) => void;
  onClose: () => void;
}

export const PlaylistInsertEventPopover: React.FC<PlaylistInsertEventPopoverProps> = ({
  insertAtIndex,
  tagEvents,
  tags,
  labels,
  existingEventIds,
  onInsertEvents,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sortedFilteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...tagEvents]
      .sort((a, b) => a.startTime - b.startTime)
      .filter((evt) => {
        if (selectedTagFilter && evt.tagId !== selectedTagFilter) return false;
        if (!q) return true;
        const tag = tags.find((t) => t.id === evt.tagId);
        const tagName = (tag?.name || '').toLowerCase();
        const labelText = (evt.labelIds || [])
          .map((id) => labels.find((l) => l.id === id)?.name || '')
          .join(' ')
          .toLowerCase();
        const noteText = (evt.notes || '').toLowerCase();
        const timeStr = `${formatTime(evt.startTime)} ${formatTime(evt.endTime)}`;
        return (
          tagName.includes(q) ||
          labelText.includes(q) ||
          noteText.includes(q) ||
          timeStr.includes(q)
        );
      });
  }, [tagEvents, tags, labels, query, selectedTagFilter]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="bg-[#14161c] border border-[#c6ff1f]/40 rounded-lg shadow-2xl p-2 flex flex-col gap-1.5 text-white select-none">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-1 border-b border-white/10">
        <span className="text-[10.5px] font-bold text-[#c6ff1f] truncate">
          Insert Event at Position #{insertAtIndex + 1}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-0.5 text-gray-400 hover:text-white rounded hover:bg-white/10 cursor-pointer"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search & Tag Filter */}
      <div className="flex items-center gap-1">
        <div className="relative flex-1 min-w-0">
          <Search className="w-3 h-3 text-gray-500 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
              } else if (e.key === 'Enter' && selectedIds.size > 0) {
                e.preventDefault();
                onInsertEvents(Array.from(selectedIds), true);
                onClose();
              }
            }}
            placeholder="Search tag, label, time…"
            className="w-full bg-[#0b0c10] border border-[#2a2e39] focus:border-[#c6ff1f] rounded pl-6 pr-2 py-1 text-[10.5px] text-white placeholder-gray-500 outline-none"
          />
        </div>
        <select
          value={selectedTagFilter}
          onChange={(e) => setSelectedTagFilter(e.target.value)}
          className="bg-[#0b0c10] border border-[#2a2e39] rounded px-1.5 py-1 text-[10px] text-gray-300 outline-none max-w-[90px]"
        >
          <option value="">All Tags</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Event List */}
      <div className="max-h-44 overflow-y-auto custom-scrollbar space-y-0.5 pr-0.5">
        {sortedFilteredEvents.length === 0 ? (
          <div className="py-4 text-center text-[10.5px] text-gray-500">
            No matching logged events found.
          </div>
        ) : (
          sortedFilteredEvents.map((evt) => {
            const tag = tags.find((t) => t.id === evt.tagId);
            const isChecked = selectedIds.has(evt.id);
            const alreadyInPlaylist = existingEventIds.has(evt.id);
            const evtLabels = (evt.labelIds || [])
              .map((id) => labels.find((l) => l.id === id)?.name)
              .filter(Boolean);

            return (
              <div
                key={evt.id}
                onClick={() => toggleSelect(evt.id)}
                className={`flex items-center justify-between gap-1.5 px-2 py-1 rounded cursor-pointer transition-colors text-[10.5px] border ${
                  isChecked
                    ? 'bg-[#c6ff1f]/15 border-[#c6ff1f]/50 text-white'
                    : 'bg-[#0e1015] hover:bg-[#1a1d26] border-transparent text-gray-300'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <div
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0 ${
                      isChecked
                        ? 'bg-[#c6ff1f] border-[#c6ff1f] text-black'
                        : 'border-gray-600 bg-transparent'
                    }`}
                  >
                    {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: tag?.color || '#3b82f6' }}
                  />
                  <span className="font-semibold text-white truncate">
                    {tag?.name || 'Event'}
                  </span>
                  {evtLabels.length > 0 && (
                    <span className="text-[#c6ff1f]/90 text-[9.5px] truncate">
                      · {evtLabels.join(', ')}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0 font-mono tabular-nums text-[9.5px] text-gray-400">
                  {alreadyInPlaylist && (
                    <span className="text-[8.5px] text-gray-500 font-sans" title="Already in playlist">
                      In list
                    </span>
                  )}
                  <span>{formatTime(evt.startTime)}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onInsertEvents([evt.id], true);
                      onClose();
                    }}
                    className="px-1.5 py-0.5 rounded bg-[#232733] hover:bg-[#c6ff1f] text-gray-200 hover:text-black font-sans font-bold text-[9px] transition-colors cursor-pointer"
                    title={`Immediately insert at #${insertAtIndex + 1}`}
                  >
                    + Insert
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Multi-Insert Footer */}
      {selectedIds.size > 0 && (
        <div className="pt-1 border-t border-white/10 flex items-center justify-between gap-2">
          <span className="text-[10px] text-gray-400">
            {selectedIds.size} selected
          </span>
          <button
            type="button"
            onClick={() => {
              onInsertEvents(Array.from(selectedIds), true);
              onClose();
            }}
            className="px-2.5 py-1 rounded bg-[#c6ff1f] hover:bg-[#b5ef15] text-black font-bold text-[10px] flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3 stroke-[2.5]" />
            <span>
              Insert {selectedIds.size} at #{insertAtIndex + 1}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
