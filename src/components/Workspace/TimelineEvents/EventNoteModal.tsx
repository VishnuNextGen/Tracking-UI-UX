import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, X, Check, Clock, Trash2, ArrowRight, Sparkles, MessageSquare } from 'lucide-react';
import { Tag as TagData, TagEvent } from '../../../types';
import { formatTime } from '../../../utils/math';

interface EventNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: TagEvent | null;
  tag: TagData | null;
  currentTime?: number;
  onSaveNote: (eventId: string, noteText: string) => void;
}

export const EventNoteModal: React.FC<EventNoteModalProps> = ({
  isOpen,
  onClose,
  event,
  tag,
  currentTime = 0,
  onSaveNote,
}) => {
  const [noteText, setNoteText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && event) {
      setNoteText(event.notes || '');
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
        }
      }, 50);
    }
  }, [isOpen, event]);

  if (!isOpen || !event) return null;

  const handleInsertCurrentTime = () => {
    const timeStr = `[@${formatTime(currentTime)}] `;
    if (!textareaRef.current) {
      setNoteText((prev) => prev + timeStr);
      return;
    }
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const updated = noteText.substring(0, start) + timeStr + noteText.substring(end);
    setNoteText(updated);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + timeStr.length, start + timeStr.length);
      }
    }, 0);
  };

  const handleSave = () => {
    onSaveNote(event.id, noteText.trim());
    onClose();
  };

  const handleClear = () => {
    setNoteText('');
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const duration = Math.max(0, event.endTime - event.startTime);
  const isEditing = Boolean(event.notes && event.notes.trim().length > 0);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.15 }}
          className="bg-[#141721] border border-[#2b3345] rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col text-white"
        >
          {/* Header */}
          <div className="p-4 border-b border-[#202736] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide">
                  {isEditing ? 'Edit Event Note' : 'Add Event Note'}
                </h3>
                <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: tag?.color || '#3b82f6' }}
                  />
                  <span className="text-gray-300 font-medium">{tag?.name || 'Event'}</span>
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

          {/* Body */}
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-400 font-medium">Tactical Notes & Observations</span>
              <button
                type="button"
                onClick={handleInsertCurrentTime}
                className="flex items-center gap-1 text-[11px] text-[#c6ff1f] hover:text-[#d7ff4f] transition-colors font-mono"
                title="Insert current playhead timestamp"
              >
                <Clock className="w-3 h-3" />
                <span>+ @{formatTime(currentTime)}</span>
              </button>
            </div>

            <textarea
              ref={textareaRef}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="e.g. Sharp diagonal run creating space between CB and LB; good initial pressure..."
              rows={4}
              className="w-full bg-[#0b0d13] border border-[#232b3c] focus:border-[#c6ff1f] rounded-lg p-3 text-xs text-gray-100 placeholder-gray-500 focus:outline-none resize-none leading-relaxed transition-colors custom-scrollbar"
            />

            {/* Sync status indicator */}
            <div className="flex items-center justify-between text-[11px] px-1 text-gray-400">
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Syncs with Right Panel Notes Tab
              </span>
              <span className="font-mono text-gray-500 text-[10px]">
                {noteText.length} chars
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="p-3.5 bg-[#0e1118] border-t border-[#202736] flex items-center justify-between gap-2">
            {noteText.trim() && isEditing ? (
              <button
                type="button"
                onClick={handleClear}
                className="px-2.5 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-1.5 text-xs font-semibold bg-[#c6ff1f] hover:bg-[#d6ff4d] text-black rounded-lg transition-all shadow-md shadow-[#c6ff1f]/20 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Save & Sync</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
