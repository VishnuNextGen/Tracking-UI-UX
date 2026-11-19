import React from 'react';
import { motion } from 'framer-motion';
import { Film, X, Video, Check } from 'lucide-react';
import type { Project } from '../../../types';
import { formatTime } from '../../../utils/math';

export interface ProjectInfoModalProps {
  project: Project;
  duration: number;
  infoForm: { name: string; description: string };
  setInfoForm: React.Dispatch<React.SetStateAction<{ name: string; description: string }>>;
  onClose: () => void;
  onUpdateMetadata: (name: string, description: string) => void;
}

export const ProjectInfoModal: React.FC<ProjectInfoModalProps> = ({
  project,
  duration,
  infoForm,
  setInfoForm,
  onClose,
  onUpdateMetadata,
}) => {
  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#141416] border border-[#2e2e33] rounded-2xl p-6 max-w-lg w-full shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#e4ff7a] to-[#c6ff1f]" />
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#c6ff1f]/10 border border-[#c6ff1f]/20 flex items-center justify-center text-[#c6ff1f]">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">Project Details</h2>
              <p className="text-xs text-gray-400">View or update project metadata & tactical notes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Project Name</label>
            <input
              type="text"
              value={infoForm.name}
              onChange={e => setInfoForm({ ...infoForm, name: e.target.value })}
              className="w-full bg-[#0d0d0f] border border-[#2e2e33] rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-[#c6ff1f] focus:outline-none transition-colors"
              placeholder="Enter project name..."
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Description & Match Notes</label>
            <textarea
              value={infoForm.description}
              onChange={e => setInfoForm({ ...infoForm, description: e.target.value })}
              className="w-full bg-[#0d0d0f] border border-[#2e2e33] rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-[#c6ff1f] focus:outline-none transition-colors h-24 resize-none"
              placeholder="Add tactical context, team notes, or match information..."
            />
          </div>

          <div className="bg-[#1b1b1e] border border-white/5 rounded-xl p-3 flex items-center justify-between text-xs text-gray-400">
            <span className="flex items-center gap-1.5 truncate mr-2">
              <Video className="w-3.5 h-3.5 text-[#c6ff1f] shrink-0" />
              <span className="truncate">{project.fileName === 'live' ? 'Live Stream Session' : (project.fileName || 'Video Source')}</span>
            </span>
            <span className="shrink-0 font-mono text-gray-300">
              {duration > 0 ? `${formatTime(duration)}` : 'Stream Active'}
            </span>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#222] hover:bg-[#2c2c31] text-gray-300 rounded-xl text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const trimmedName = infoForm.name.trim() || 'Untitled Project';
                onUpdateMetadata(trimmedName, infoForm.description);
                onClose();
              }}
              className="px-5 py-2 bg-[#c6ff1f] hover:bg-[#b0e817] text-black font-semibold rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-[#c6ff1f]/10"
            >
              <Check className="w-3.5 h-3.5" /> Save Changes
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
