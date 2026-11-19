import React, { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { ActiveRecording, Tag as TagData, Label } from '../../types';

interface Props {
  activeRecordings: ActiveRecording[];
  tags: TagData[];
  labels?: Label[];
  currentTime: number;
  duration: number;
  onStopAndSave: (tagId: string) => void;
  onCancel: (tagId: string) => void;
  activeTargetTabId?: string;
  onSelectTargetTab?: (tagId: string) => void;
  offsetTop?: boolean;
}

const MAX_ROWS_PER_COLUMN = 4;

export const ActiveRecordingsBar: React.FC<Props> = ({
  activeRecordings,
  tags,
  labels = [],
  currentTime,
  onStopAndSave,
  onCancel,
  activeTargetTabId,
  onSelectTargetTab,
  offsetTop = false,
}) => {
  const [, setTick] = useState(0);

  // Live timer tick every 500ms so elapsed time counters update smoothly
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  if (!activeRecordings || activeRecordings.length === 0) {
    return null;
  }

  const formatElapsed = (startTime: number) => {
    const elapsedSec = Math.max(0, Math.floor(Math.abs(currentTime - startTime)));
    const m = Math.floor(elapsedSec / 60).toString().padStart(2, '0');
    const s = (elapsedSec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const totalActive = activeRecordings.length;

  // Split into columns of at most MAX_ROWS_PER_COLUMN so excess items form a second column
  const columns: ActiveRecording[][] = [];
  for (let i = 0; i < activeRecordings.length; i += MAX_ROWS_PER_COLUMN) {
    columns.push(activeRecordings.slice(i, i + MAX_ROWS_PER_COLUMN));
  }

  return (
    <div
      className={`absolute ${
        offsetTop ? 'top-9' : 'top-2'
      } right-2 z-[60] flex flex-row-reverse items-start gap-1 pointer-events-none select-none max-w-[92%]`}
    >
      {columns.map((col, colIdx) => (
        <div key={colIdx} className="flex flex-col items-end gap-1 min-w-0">
          {col.map(rec => {
            const tag = tags.find(t => t.id === rec.tagId);
            const tagName = tag?.name || 'Event';
            const tagColor = tag?.color || '#ef4444';
            const elapsed = formatElapsed(rec.startTime);
            const isTargeted = totalActive > 1 && activeTargetTabId === rec.tagId;
            const attachedLabels = (rec.labelIds || [])
              .map(id => labels.find(l => l.id === id))
              .filter((l): l is Label => Boolean(l));
            const labelSummary = attachedLabels.map(l => l.name).join(', ');

            return (
              <div
                key={rec.tagId}
                onClick={() => onSelectTargetTab?.(rec.tagId)}
                className={`pointer-events-auto h-[22px] flex items-center gap-1 rounded px-1.5 backdrop-blur-sm transition-colors text-[10.5px] cursor-pointer border shadow-sm ${
                  isTargeted
                    ? 'bg-black/85 border-[#c6ff1f]/70 text-white'
                    : 'bg-black/65 hover:bg-black/85 border-white/10 text-gray-100'
                }`}
                title={
                  attachedLabels.length > 0
                    ? `${tagName} (${elapsed}) • Labels: ${labelSummary}`
                    : `${tagName} (${elapsed}) • Click tag again or ✓ to save`
                }
              >
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span
                    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={{ backgroundColor: tagColor }}
                  />
                  <span
                    className="relative inline-flex rounded-full h-1.5 w-1.5"
                    style={{ backgroundColor: tagColor }}
                  />
                </span>

                <span className="font-medium max-w-[80px] sm:max-w-[100px] truncate leading-none">
                  {tagName}
                </span>

                <span className="font-mono tabular-nums text-[9.5px] text-gray-300 leading-none">
                  {elapsed}
                </span>

                {attachedLabels.length > 0 && (
                  <span className="font-mono tabular-nums text-[9.5px] text-[#c6ff1f] leading-none">
                    +{attachedLabels.length}
                  </span>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStopAndSave(rec.tagId);
                  }}
                  className="p-0.5 rounded text-emerald-400 hover:text-white hover:bg-emerald-600/80 transition-colors cursor-pointer"
                  title={`Save "${tagName}"`}
                >
                  <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel(rec.tagId);
                  }}
                  className="p-0.5 rounded text-gray-400 hover:text-red-300 hover:bg-red-500/30 transition-colors cursor-pointer"
                  title={`Cancel "${tagName}"`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
