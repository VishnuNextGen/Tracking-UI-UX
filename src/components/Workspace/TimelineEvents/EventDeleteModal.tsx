import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Tag as TagData, TagEvent } from '../../../types';
import { formatTime } from '../../../utils/math';

interface EventDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: TagEvent | null;
  tag: TagData | null;
  onConfirmDelete: () => void;
}

export const EventDeleteModal: React.FC<EventDeleteModalProps> = ({
  isOpen,
  onClose,
  event,
  tag,
  onConfirmDelete,
}) => {
  if (!isOpen || !event) return null;

  const duration = Math.max(0, event.endTime - event.startTime);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.15 }}
          className="bg-[#141721] border border-[#2b3345] rounded-xl w-full max-w-sm shadow-2xl overflow-hidden p-5 flex flex-col gap-4 text-white"
        >
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white tracking-wide">Delete Timeline Event</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Are you sure you want to remove this event? This will also remove it from any playlists.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Event Summary Preview */}
          <div className="bg-[#0b0d13] border border-[#202736] rounded-lg p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: tag?.color || '#3b82f6' }}
              />
              <span className="font-semibold text-white truncate">
                {tag?.name || 'Tagged Event'}
              </span>
            </div>
            <div className="text-gray-400 font-mono text-[11px] shrink-0">
              {formatTime(event.startTime)} – {formatTime(event.endTime)} ({duration.toFixed(1)}s)
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirmDelete();
                onClose();
              }}
              className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all shadow-lg shadow-red-950/50 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Event</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
