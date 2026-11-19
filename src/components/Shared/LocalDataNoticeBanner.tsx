import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  Upload,
  HardDrive,
  ChevronDown,
  ShieldAlert,
  Maximize2,
  SlidersHorizontal,
} from 'lucide-react';
import {
  getBackupMeta,
  exportUserDataToFile,
  type BackupMetaState,
} from '../../utils/folderBackup';

interface LocalDataNoticeBannerProps {
  projectsCount: number;
  boardsCount: number;
  batchesCount: number;
  onOpenBackupModal: (initialTab?: 'export' | 'import' | 'faq') => void;
  onShowToast?: (msg: string) => void;
}

export const LocalDataNoticeBanner: React.FC<LocalDataNoticeBannerProps> = ({
  projectsCount,
  boardsCount,
  batchesCount,
  onOpenBackupModal,
  onShowToast,
}) => {
  const [meta, setMeta] = useState<BackupMetaState>(() => getBackupMeta());
  const [isExpanded, setIsExpanded] = useState(false);
  const [isQuickExporting, setIsQuickExporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncMeta = () => setMeta(getBackupMeta());
    window.addEventListener('tacstem_backup_meta_changed', syncMeta);
    return () => window.removeEventListener('tacstem_backup_meta_changed', syncMeta);
  }, []);

  useEffect(() => {
    if (!isExpanded) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExpanded]);

  const handleQuickExport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsQuickExporting(true);
    const res = await exportUserDataToFile();
    setIsQuickExporting(false);
    if (res.success) {
      setMeta(getBackupMeta());
      onShowToast?.(`Backup file downloaded (${res.fileName})!`);
    } else if (res.error) {
      onShowToast?.(`Export failed: ${res.error}`);
    }
  };

  const totalItems = projectsCount + boardsCount + batchesCount;
  const needsBackup = (meta.hasUnsavedChangesSinceExport || !meta.lastExportTime) && totalItems > 0;

  return (
    <aside
      ref={containerRef}
      aria-label="Local browser data notice"
      className="fixed bottom-5 left-4 sm:bottom-6 sm:left-6 z-40 pointer-events-auto select-none"
    >
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          <motion.button
            key="collapsed-data-pill"
            type="button"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            onClick={() => setIsExpanded(true)}
            className="glass px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full text-xs font-semibold text-white/90 hover:text-white hover:border-amber-400/50 transition-all flex items-center gap-2 shadow-xl hover:shadow-amber-500/15 cursor-pointer group"
            title="Click to expand local browser storage & data backup notice"
          >
            <span className="relative w-4 h-4 rounded-[4px] bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <ShieldAlert className="w-2.5 h-2.5" />
              {needsBackup && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              )}
            </span>
            <span className="hidden sm:inline">Browser-Only Data</span>
            <span className="sm:hidden">Data Notice</span>
            <Maximize2 className="w-3 h-3 text-amber-400/90 group-hover:text-[#c6ff1f] transition-colors shrink-0" />
          </motion.button>
        ) : (
          <motion.div
            key="expanded-data-card"
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 360, damping: 26 }}
            className="w-[calc(100vw-2rem)] sm:w-96 rounded-2xl bg-[#141418]/95 border border-amber-400/30 p-4 backdrop-blur-xl shadow-2xl shadow-black/70 text-white"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-400/15 border border-amber-400/35 flex items-center justify-center text-amber-300 shrink-0">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="text-xs font-bold text-white tracking-tight">
                      Stored Only in Your Browser
                    </h4>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-300 border border-amber-400/30">
                      Important
                    </span>
                  </div>
                  <p className="text-[10px] text-white/45 truncate">
                    No cloud servers • Local device storage
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="p-1 rounded-lg text-white/45 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                title="Collapse notice"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            <p className="mt-2.5 text-[11px] leading-relaxed text-white/75">
              We <strong className="text-white font-semibold">do not store your data on any server</strong> — all projects, tags, coding pads, and telestrations stay only in this browser. Data <strong className="text-amber-300 font-semibold">may be lost in the next app update</strong> or if browser data is cleared. Please export a local backup file regularly and import it anytime after an update.
            </p>

            <div className="mt-2.5 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 flex items-center justify-between gap-2 text-[10px] text-white/55">
              <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
                <HardDrive className="w-3 h-3 text-amber-400/80 shrink-0" />
                {meta.lastExportFormatted ? (
                  <span className="truncate">
                    Last backup: <strong className="text-emerald-300 font-medium">{meta.lastExportFormatted}</strong>
                    {meta.hasUnsavedChangesSinceExport && (
                      <span className="text-amber-300 font-semibold"> • Unsaved changes</span>
                    )}
                  </span>
                ) : (
                  <span className="text-amber-300/90 font-medium truncate">
                    No backup file exported yet
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsExpanded(false);
                  onOpenBackupModal('faq');
                }}
                className="text-white/50 hover:text-white underline shrink-0 cursor-pointer"
                title="Open full Export & Import Workspace modal"
              >
                Details
              </button>
            </div>

            <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center gap-2">
              <button
                type="button"
                onClick={handleQuickExport}
                disabled={isQuickExporting}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#c6ff1f] hover:bg-[#d4ff4d] text-black font-bold text-[11px] shadow-md shadow-[#c6ff1f]/15 transition-all cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{isQuickExporting ? 'Exporting...' : 'Export Backup'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsExpanded(false);
                  onOpenBackupModal('import');
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-white font-semibold text-[11px] transition-all cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#c6ff1f]" />
                <span>Import</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsExpanded(false);
                  onOpenBackupModal('export');
                }}
                className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.12] border border-white/10 text-white/65 hover:text-white transition-colors cursor-pointer"
                title="Open Export & Import Options"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
};
