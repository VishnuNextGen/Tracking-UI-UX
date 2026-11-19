import React from 'react';
import { X } from 'lucide-react';
import type { Label } from '../../../types';

export interface WorkspaceEditLabelModalProps {
  isOpen: boolean;
  editingLabelId: string | null;
  tempLabel: Partial<Label>;
  setTempLabel: React.Dispatch<React.SetStateAction<Partial<Label>>>;
  setEditingLabelId: (id: string | null) => void;
  labels: Label[];
  setLabels: React.Dispatch<React.SetStateAction<Label[]>>;
  showNotification: (message: string, color?: string) => void;
}

export const WorkspaceEditLabelModal = ({
  isOpen,
  editingLabelId,
  tempLabel,
  setTempLabel,
  setEditingLabelId,
  labels,
  setLabels,
  showNotification,
}: WorkspaceEditLabelModalProps) => {
  if (!isOpen || !editingLabelId) return null;

  const handleSave = () => {
    const raw = (tempLabel.name || '').trim();
    const names = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (names.length > 1) {
      const current = labels.find((l) => l.id === editingLabelId);
      const now = Date.now();
      const additional: Label[] = names.slice(1).map((n, i) => ({
        id: `label-${now}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        name: n,
        groupId: current?.groupId,
      }));
      setLabels((prev) =>
        prev
          .map((l) =>
            l.id === editingLabelId ? ({ ...l, ...tempLabel, name: names[0] } as Label) : l
          )
          .concat(additional)
      );
      showNotification(`Added ${names.length} labels: ${names.join(', ')}`, '#c6ff1f');
    } else if (names.length === 1) {
      setLabels((prev) =>
        prev.map((l) =>
          l.id === editingLabelId ? ({ ...l, ...tempLabel, name: names[0] } as Label) : l
        )
      );
    }
    setEditingLabelId(null);
    setTempLabel({});
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50">
      <div className="bg-[#161616] border border-[#c6ff1f] rounded-xl p-4 w-64 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-bold text-sm">Edit Label</h3>
          <button
            onClick={() => {
              setEditingLabelId(null);
              setTempLabel({});
            }}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-gray-400 block">Name</label>
              <span className="text-[10px] text-gray-500">Separate with commas (,)</span>
            </div>
            <input
              autoFocus
              type="text"
              value={tempLabel.name || ''}
              onChange={(e) => setTempLabel({ ...tempLabel, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSave();
                }
              }}
              className="w-full bg-[#111] border border-[#444] rounded px-2 py-1 text-xs text-white focus:border-[#c6ff1f] outline-none"
              placeholder="e.g. Pass, Shot, Goal, Foul"
            />
          </div>
          <button
            onClick={handleSave}
            className="w-full py-1.5 bg-[#c6ff1f] hover:bg-[#b0e61c] text-black text-xs font-bold rounded mt-2"
          >
            Save Label(s)
          </button>
        </div>
      </div>
    </div>
  );
};
