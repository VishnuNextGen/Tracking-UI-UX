import React, { useState, useEffect } from 'react';
import { Download, Upload } from 'lucide-react';
import { getBackupMeta, type BackupMetaState } from '../../utils/folderBackup';

interface FolderBackupButtonProps {
  onClick: () => void;
  className?: string;
}

export const FolderBackupButton: React.FC<FolderBackupButtonProps> = ({
  onClick,
  className = '',
}) => {
  const [meta, setMeta] = useState<BackupMetaState>(() => getBackupMeta());

  useEffect(() => {
    const syncMeta = () => setMeta(getBackupMeta());
    syncMeta();
    window.addEventListener('tacstem_backup_meta_changed', syncMeta);
    return () => {
      window.removeEventListener('tacstem_backup_meta_changed', syncMeta);
    };
  }, []);

  const hasExportedRecently = Boolean(meta.lastExportTime) && !meta.hasUnsavedChangesSinceExport;
  const needsBackupReminder = meta.hasUnsavedChangesSinceExport || !meta.lastExportTime;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer shrink-0 ${
        hasExportedRecently
          ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
          : 'bg-amber-400/10 hover:bg-amber-400/20 border-amber-400/35 text-amber-200 hover:text-white'
      } ${className}`}
      title={
        hasExportedRecently
          ? `Last exported: ${meta.lastExportFormatted} — Click to Export or Import workspace file`
          : 'Data is stored only in your browser! Click to Export or Import your full data file'
      }
    >
      <div className="flex items-center -space-x-0.5 shrink-0">
        <Download
          className={`w-3.5 h-3.5 ${
            hasExportedRecently ? 'text-emerald-400' : 'text-amber-300'
          }`}
        />
        <Upload
          className={`w-3 h-3 hidden xl:block ml-0.5 ${
            hasExportedRecently ? 'text-emerald-400/80' : 'text-amber-300/80'
          }`}
        />
      </div>
      <span className="hidden md:inline whitespace-nowrap">Export / Import Data</span>
      <span className="md:hidden whitespace-nowrap">Backup</span>
      {needsBackupReminder ? (
        <span
          className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0"
          title="Unbacked browser data — click to export local backup file"
        />
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
      )}
    </button>
  );
};
