import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Sparkles,
  Trash2,
  ArrowRight,
  X,
  Film,
  LayoutGrid,
  Layers,
  ExternalLink,
} from 'lucide-react';
import type { Project, BoardProject } from '../../types';
import type { UserProfile } from '../../types/user';
import { isUserAdmin, getPlatformSettings } from '../../utils/userPlanStore';
import { FounderConnectButton } from './FounderConnectButton';

interface PlanLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'project' | 'board' | 'batch';
  user: UserProfile;
  currentProjects?: Project[];
  currentBoards?: BoardProject[];
  onDeleteProject?: (id: string) => void;
  onDeleteBoard?: (id: string) => void;
  onOpenAdminConsole?: () => void;
  onRequestUpgrade?: () => void;
}

export const PlanLimitModal: React.FC<PlanLimitModalProps> = ({
  isOpen,
  onClose,
  type,
  user,
  currentProjects = [],
  currentBoards = [],
  onDeleteProject,
  onDeleteBoard,
  onOpenAdminConsole,
  onRequestUpgrade,
}) => {
  if (!isOpen) return null;

  const settings = getPlatformSettings();
  const isBatch = type === 'batch';
  const isBoard = type === 'board';
  const isVideo = type === 'project';

  const limitCount = isBoard ? settings.freeMaxBoardProjects : settings.freeMaxVideoProjects;
  const count = isBoard ? currentBoards.length : isVideo ? currentProjects.length : 0;
  const isDemotedWithMultiple = count > limitCount;
  const userIsAdmin = isUserAdmin(user);

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-[#121217] border border-white/15 rounded-2xl shadow-2xl max-w-lg w-full p-6 text-left relative overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#c6ff1f]" />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="flex items-start gap-3.5 mb-5">
            <div
              className={`p-2.5 rounded-xl shrink-0 ${
                isBatch
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                  : 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
              }`}
            >
              {isBatch ? (
                <Layers className="w-6 h-6" />
              ) : isBoard ? (
                <LayoutGrid className="w-6 h-6" />
              ) : (
                <Film className="w-6 h-6" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400">
                  Free Account Quota
                </span>
                {isDemotedWithMultiple && (
                  <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Liberal Policy Active
                  </span>
                )}
              </div>
              <h2 className="text-xl font-extrabold text-white">
                {isBatch
                  ? 'Multi-Match Batches is a Pro Feature'
                  : isBoard
                  ? `Free Plan: ${limitCount} Tactical Board Limit`
                  : `Free Plan: ${limitCount} Video Project Limit`}
              </h2>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-3.5 text-xs text-white/70 leading-relaxed mb-5">
            {isBatch ? (
              <p>
                The <span className="text-white font-semibold">Free Account</span> includes{' '}
                <span className="text-[#c6ff1f] font-semibold">
                  {settings.freeMaxVideoProjects} match workspace{settings.freeMaxVideoProjects > 1 ? 's' : ''}
                </span>{' '}
                and{' '}
                <span className="text-[#c6ff1f] font-semibold">
                  {settings.freeMaxBoardProjects} tactical board{settings.freeMaxBoardProjects > 1 ? 's' : ''}
                </span>
                . Aggregating multiple games into cross-match batches requires a{' '}
                <span className="text-white font-semibold">Pro Account</span>.
              </p>
            ) : (
              <p>
                Free accounts can maintain up to{' '}
                <span className="text-[#c6ff1f] font-bold">
                  {limitCount} {isBoard ? 'tactical board' : 'video project'}
                  {limitCount > 1 ? 's' : ''}
                </span>{' '}
                at a time. Delete an existing item below to free a slot, or request a Pro upgrade for unlimited workspaces.
              </p>
            )}

            <div className="bg-[#181820] border border-white/10 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 text-white font-bold text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Zero Data Loss Guarantee</span>
              </div>
              <p className="text-[11px] text-white/60 leading-relaxed">
                If an account moves from Pro to Free, all existing local projects remain 100% playable and editable. Only new creation is paused until count is below {limitCount}.
              </p>
            </div>
          </div>

          {/* Existing Items Quick-Delete list */}
          {!isBatch && count > 0 && (
            <div className="mb-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-white/50 px-1 tabular-nums">
                <span>
                  Existing {isBoard ? 'Boards' : 'Projects'} ({count}):
                </span>
                <span>Delete to free slot</span>
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                {isVideo &&
                  currentProjects.map((p) => (
                    <div
                      key={p.id}
                      className="p-2.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 rounded-xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1 truncate">
                        <div className="font-semibold text-white truncate">{p.name}</div>
                        <div className="text-[10px] text-white/40 truncate">
                          {p.fileName || 'No video file'} •{' '}
                          {new Date(p.lastModified).toLocaleDateString()}
                        </div>
                      </div>
                      {onDeleteProject && (
                        <button
                          type="button"
                          onClick={() => onDeleteProject(p.id)}
                          className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-semibold flex items-center gap-1 border border-red-500/20 transition-colors shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  ))}

                {isBoard &&
                  currentBoards.map((b) => (
                    <div
                      key={b.id}
                      className="p-2.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 rounded-xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1 truncate">
                        <div className="font-semibold text-white truncate">{b.name}</div>
                        <div className="text-[10px] text-white/40 truncate">
                          {b.slideCount || 1} slide(s) •{' '}
                          {new Date(b.lastModified).toLocaleDateString()}
                        </div>
                      </div>
                      {onDeleteBoard && (
                        <button
                          type="button"
                          onClick={() => onDeleteBoard(b.id)}
                          className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-semibold flex items-center gap-1 border border-red-500/20 transition-colors shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Direct Founder Contact Row */}
          <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-[#0A66C2]/10 border border-sky-400/20 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-white/75 text-[11px]">
              Need Pro access for your coaching or analysis workflow?
            </span>
            <FounderConnectButton variant="compact" />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/10">
            {userIsAdmin && onOpenAdminConsole ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAdminConsole();
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>Admin Console</span>
                <ExternalLink className="w-3.5 h-3.5 text-white/40" />
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-transparent text-white/60 hover:text-white text-xs font-medium transition-colors cursor-pointer"
              >
                Dismiss
              </button>

              {onRequestUpgrade && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRequestUpgrade();
                  }}
                  className="btn-glow px-4 py-2.5 rounded-xl text-xs font-bold text-black flex items-center justify-center gap-1.5 shadow-lg shadow-[#c6ff1f]/20 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Request Pro Upgrade</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
