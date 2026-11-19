import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  Upload,
  RefreshCw,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  X,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Layers,
  Film,
  LayoutGrid,
  FileJson,
  Activity,
  Hexagon,
  Snowflake,
  Code2,
} from 'lucide-react';
import {
  getBackupMeta,
  gatherCurrentAppData,
  exportUserDataToFile,
  parseAndValidateBackupFile,
  importBackupBundle,
  PORTABLE_BACKUP_VERSION,
  type BackupMetaState,
  type BackupScanResult,
  type BackupBundle,
} from '../../utils/folderBackup';

interface FolderBackupModalProps {
  isOpen: boolean;
  initialTab?: 'export' | 'import' | 'faq';
  onClose: () => void;
  onDataRestored?: () => void;
  onShowToast?: (msg: string) => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const FolderBackupModal: React.FC<FolderBackupModalProps> = ({
  isOpen,
  initialTab = 'export',
  onClose,
  onDataRestored,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'faq'>(initialTab);
  const [meta, setMeta] = useState<BackupMetaState>(() => getBackupMeta());
  const [livePreview, setLivePreview] = useState<BackupBundle | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);

  // Export states
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportStep, setExportStep] = useState<string>('');

  // Import states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [isScanningFile, setIsScanningFile] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<BackupScanResult | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importStep, setImportStep] = useState<string>('');

  // FAQ accordion
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setMeta(getBackupMeta());
      setIsLoadingPreview(true);
      gatherCurrentAppData()
        .then((bundle) => {
          setLivePreview(bundle);
        })
        .catch(() => {})
        .finally(() => setIsLoadingPreview(false));
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    const syncMeta = () => setMeta(getBackupMeta());
    window.addEventListener('tacstem_backup_meta_changed', syncMeta);
    return () => window.removeEventListener('tacstem_backup_meta_changed', syncMeta);
  }, []);

  const handleExportDownload = async () => {
    setIsExporting(true);
    setExportStep('Preparing complete data bundle...');
    const res = await exportUserDataToFile((step) => setExportStep(step));
    setIsExporting(false);
    setExportStep('');

    if (res.success && res.bundle) {
      setLivePreview(res.bundle);
      setMeta(getBackupMeta());
      onShowToast?.(`Backup exported to "${res.fileName}"`);
    } else {
      onShowToast?.(`Export failed: ${res.error}`);
    }
  };

  const handleFileChosen = async (file: File | null | undefined) => {
    if (!file) return;
    setIsScanningFile(true);
    setScanResult(null);
    const result = await parseAndValidateBackupFile(file);
    setScanResult(result);
    setIsScanningFile(false);
  };

  const handleExecuteImport = async () => {
    if (!scanResult?.hasValidBackup || !scanResult.bundle) return;

    setIsImporting(true);
    setImportStep('Starting data import...');

    const res = await importBackupBundle(scanResult.bundle, restoreMode, (step) => {
      setImportStep(step);
    });

    setIsImporting(false);
    setImportStep('');

    if (res.success) {
      onShowToast?.(
        `Imported ${res.restoredProjectsCount} match projects, ${res.restoredBoardsCount} tactical boards & ${res.restoredBatchesCount} batches!`
      );
      onDataRestored?.();
      onClose();
    } else {
      onShowToast?.(`Import failed: ${res.error}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.16 }}
        className="bg-[#121217] border border-white/15 rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-start justify-between gap-4 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#c6ff1f]/10 border border-[#c6ff1f]/30 flex items-center justify-center text-[#c6ff1f] shrink-0">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                  Export & Import Workspace Data
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#c6ff1f] bg-[#c6ff1f]/10 px-2 py-0.5 rounded-md border border-[#c6ff1f]/20">
                  Portable v{PORTABLE_BACKUP_VERSION}.0
                </span>
              </div>
              <p className="text-xs text-white/55 mt-0.5">
                Download all your projects, tagging, telestrations &amp; boards to a local file — and import into any future app update.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Persistent Data Wipe Notice Banner inside Modal */}
        <div className="mx-4 sm:mx-6 mt-4 rounded-xl bg-amber-500/[0.08] border border-amber-400/30 p-3 flex items-start gap-2.5 text-xs">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-white/80 leading-relaxed text-[11px]">
            <strong className="text-amber-300 font-semibold">Browser-Only Storage Notice:</strong> We do not store your analysis data on any cloud server — everything is saved locally inside your browser.{' '}
            <strong className="text-white">Your data may be wiped if browser data is cleared or when migrating to a new app update/URL.</strong>{' '}
            Always keep a recent exported backup file on your device!
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-white/10 bg-white/[0.01] px-4 sm:px-6 pt-3 gap-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'export'
                ? 'border-[#c6ff1f] text-[#c6ff1f]'
                : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export to File</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'import'
                ? 'border-[#c6ff1f] text-[#c6ff1f]'
                : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import from File</span>
            {scanResult?.hasValidBackup && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#c6ff1f]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('faq')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'faq'
                ? 'border-[#c6ff1f] text-[#c6ff1f]'
                : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Compatibility &amp; Info</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {activeTab === 'export' && (
            <div className="space-y-4">
              {/* Live Summary of What Will Be Exported */}
              <div className="bg-white/[0.025] border border-white/10 rounded-xl p-4 space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                      Complete Workspace Snapshot
                    </span>
                    <h3 className="text-sm font-bold text-white mt-0.5">
                      Everything included in your portable backup file
                    </h3>
                  </div>
                  {isLoadingPreview && (
                    <RefreshCw className="w-4 h-4 text-[#c6ff1f] animate-spin shrink-0" />
                  )}
                </div>

                {/* Counts Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="bg-black/30 border border-white/[0.06] rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-xs text-white/55">
                      <Film className="w-3.5 h-3.5 text-[#c6ff1f]" />
                      <span>Match Projects</span>
                    </div>
                    <div className="text-lg font-bold text-white mt-1 font-mono">
                      {livePreview ? livePreview.counts.projects : '—'}
                    </div>
                  </div>

                  <div className="bg-black/30 border border-white/[0.06] rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-xs text-white/55">
                      <Activity className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Tagged Events</span>
                    </div>
                    <div className="text-lg font-bold text-white mt-1 font-mono">
                      {livePreview ? livePreview.counts.totalTagEvents : '—'}
                    </div>
                  </div>

                  <div className="bg-black/30 border border-white/[0.06] rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-xs text-white/55">
                      <Hexagon className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Telestrations</span>
                    </div>
                    <div className="text-lg font-bold text-white mt-1 font-mono">
                      {livePreview ? livePreview.counts.totalTelestrationShapes : '—'}
                    </div>
                  </div>

                  <div className="bg-black/30 border border-white/[0.06] rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-xs text-white/55">
                      <Snowflake className="w-3.5 h-3.5 text-sky-300" />
                      <span>Freeze Frames</span>
                    </div>
                    <div className="text-lg font-bold text-white mt-1 font-mono">
                      {livePreview ? livePreview.counts.totalFreezeFrames : '—'}
                    </div>
                  </div>

                  <div className="bg-black/30 border border-white/[0.06] rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-xs text-white/55">
                      <LayoutGrid className="w-3.5 h-3.5 text-[#c6ff1f]" />
                      <span>Tactical Boards</span>
                    </div>
                    <div className="text-lg font-bold text-white mt-1 font-mono">
                      {livePreview ? livePreview.counts.boardProjects : '—'}
                    </div>
                  </div>

                  <div className="bg-black/30 border border-white/[0.06] rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-xs text-white/55">
                      <Layers className="w-3.5 h-3.5 text-amber-300" />
                      <span>Batches &amp; Pads</span>
                    </div>
                    <div className="text-lg font-bold text-white mt-1 font-mono">
                      {livePreview
                        ? `${livePreview.counts.batches} / ${livePreview.counts.codeFiles}`
                        : '—'}
                    </div>
                  </div>
                </div>

                {/* Detailed checklist */}
                <div className="pt-2 border-t border-white/[0.06] grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-white/65">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>All match tags, labels, notes &amp; period syncs</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>All telestration drawings, player moves &amp; steps</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Playlists, clips &amp; multi-game batch analytics</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Tactical boards, slides, formations &amp; animations</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Advanced coding pads &amp; smart connectors</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Creator watermark, team colors &amp; player rosters</span>
                  </div>
                </div>
              </div>

              {/* Last export status */}
              <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-white/65">
                  <HardDrive className="w-4 h-4 text-[#c6ff1f] shrink-0" />
                  {meta.lastExportFormatted ? (
                    <span>
                      Last exported file:{' '}
                      <strong className="text-white">{meta.lastExportFormatted}</strong>
                      {meta.hasUnsavedChangesSinceExport && (
                        <span className="ml-2 text-amber-300 font-semibold">
                          (Changes made since last export)
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-amber-300 font-medium">
                      You haven&apos;t exported a local backup file yet.
                    </span>
                  )}
                </div>
              </div>

              {/* Primary Export Action */}
              <button
                type="button"
                onClick={handleExportDownload}
                disabled={isExporting}
                className="w-full py-3.5 px-5 bg-[#c6ff1f] hover:bg-[#d4ff4d] text-black font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-[#c6ff1f]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-black" />
                    <span>{exportStep || 'Generating backup file...'}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 stroke-[2.5]" />
                    <span>Download Full Workspace Backup (.tacstem.json)</span>
                  </>
                )}
              </button>

              <div className="bg-emerald-500/[0.05] border border-emerald-500/20 rounded-xl p-3 text-[11px] text-white/65 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong className="text-white font-semibold">Future-Compatible Format:</strong>{' '}
                  Uses versioned schema <code className="text-emerald-300 bg-black/40 px-1 py-0.5 rounded">v{PORTABLE_BACKUP_VERSION}.0</code> so you can import this exact file into updated versions of the app, another browser, or a new computer without losing any tags or telestrations. (Note: Large raw match video files stay on your hard drive and can be re-linked in 1 click after import).
                </p>
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="space-y-4">
              {/* Drag & Drop / File Picker Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFileChosen(f);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                  isDragOver
                    ? 'border-[#c6ff1f] bg-[#c6ff1f]/10'
                    : 'border-white/15 hover:border-[#c6ff1f]/50 bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.tacstem.json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileChosen(f);
                    e.target.value = '';
                  }}
                />
                <div className="w-11 h-11 rounded-xl bg-[#c6ff1f]/10 border border-[#c6ff1f]/30 flex items-center justify-center text-[#c6ff1f] mx-auto mb-2.5">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-xs sm:text-sm font-bold text-white">
                  Click to choose backup file or drag &amp; drop here
                </p>
                <p className="text-[11px] text-white/45 mt-1">
                  Supports Full Workspace Backups (<code className="text-white/70">.tacstem.json</code>), Legacy Backups, Tactical Board JSONs &amp; Code Files
                </p>
              </div>

              {/* Scanning state */}
              {isScanningFile && (
                <div className="p-6 text-center space-y-2 bg-white/[0.02] border border-white/10 rounded-xl">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#c6ff1f] mx-auto" />
                  <p className="text-xs text-white/70">Validating backup file &amp; schema compatibility...</p>
                </div>
              )}

              {/* Validation Error */}
              {!isScanningFile && scanResult && !scanResult.hasValidBackup && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-xs">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-white">Invalid Backup File</div>
                    <p className="text-red-200/90 mt-0.5">{scanResult.errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Validated File Summary & Import Controls */}
              {!isScanningFile && scanResult?.hasValidBackup && (
                <div className="space-y-3.5">
                  <div className="bg-white/[0.025] border border-white/10 rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-white/[0.06]">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                          Verified Compatible Backup
                        </span>
                        <h4 className="text-sm font-bold text-white truncate mt-0.5" title={scanResult.fileName}>
                          {scanResult.fileName || 'Tacstem Backup'}
                        </h4>
                        <p className="text-[11px] text-white/45 mt-0.5">
                          Exported: {scanResult.formattedDate} • {formatBytes(scanResult.fileSizeBytes)}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/60 shrink-0">
                        Schema v{scanResult.version || 1}
                      </span>
                    </div>

                    {/* Discovered contents breakdown */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="bg-black/30 border border-white/5 rounded-lg p-2.5">
                        <Film className="w-3.5 h-3.5 text-[#c6ff1f] mx-auto mb-1" />
                        <div className="text-sm font-bold text-white font-mono">
                          {scanResult.projectsCount}
                        </div>
                        <div className="text-[10px] text-white/45">Matches</div>
                      </div>
                      <div className="bg-black/30 border border-white/5 rounded-lg p-2.5">
                        <Activity className="w-3.5 h-3.5 text-emerald-400 mx-auto mb-1" />
                        <div className="text-sm font-bold text-white font-mono">
                          {scanResult.totalTagEventsCount} / {scanResult.totalShapesCount}
                        </div>
                        <div className="text-[10px] text-white/45">Tags / Drawings</div>
                      </div>
                      <div className="bg-black/30 border border-white/5 rounded-lg p-2.5">
                        <LayoutGrid className="w-3.5 h-3.5 text-cyan-400 mx-auto mb-1" />
                        <div className="text-sm font-bold text-white font-mono">
                          {scanResult.boardProjectsCount}
                        </div>
                        <div className="text-[10px] text-white/45">Tactical Boards</div>
                      </div>
                      <div className="bg-black/30 border border-white/5 rounded-lg p-2.5">
                        <Code2 className="w-3.5 h-3.5 text-amber-300 mx-auto mb-1" />
                        <div className="text-sm font-bold text-white font-mono">
                          {scanResult.batchesCount} / {scanResult.codeFilesCount}
                        </div>
                        <div className="text-[10px] text-white/45">Batches / Pads</div>
                      </div>
                    </div>

                    {/* Preview list of projects */}
                    {scanResult.projectsList.length > 0 && (
                      <div className="pt-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-white/40 mb-1.5 block">
                          Match Projects in File:
                        </span>
                        <div className="max-h-32 overflow-y-auto space-y-1 pr-1 text-xs">
                          {scanResult.projectsList.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between bg-black/30 px-2.5 py-1.5 rounded border border-white/5 text-white/85"
                            >
                              <span className="truncate font-medium">{p.name}</span>
                              <span className="text-[10px] text-white/45 shrink-0 ml-2 font-mono">
                                {p.tagEventsCount} tags · {p.shapesCount} shapes
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Import Mode */}
                  <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3.5 space-y-2">
                    <label className="text-xs font-semibold text-white block">
                      Import Mode:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <label
                        onClick={() => setRestoreMode('merge')}
                        className={`p-2.5 rounded-lg border cursor-pointer flex items-start gap-2.5 transition-all ${
                          restoreMode === 'merge'
                            ? 'bg-[#c6ff1f]/10 border-[#c6ff1f]/40 text-white'
                            : 'bg-white/[0.02] border-white/5 text-white/60 hover:text-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name="restoreMode"
                          checked={restoreMode === 'merge'}
                          onChange={() => setRestoreMode('merge')}
                          className="mt-0.5 accent-[#c6ff1f]"
                        />
                        <div>
                          <div className="font-bold text-white">Safe Merge (Recommended)</div>
                          <p className="text-[11px] text-white/50 leading-tight mt-0.5">
                            Imports all projects &amp; updates matching IDs while keeping your other existing items.
                          </p>
                        </div>
                      </label>

                      <label
                        onClick={() => setRestoreMode('replace')}
                        className={`p-2.5 rounded-lg border cursor-pointer flex items-start gap-2.5 transition-all ${
                          restoreMode === 'replace'
                            ? 'bg-amber-400/10 border-amber-400/40 text-white'
                            : 'bg-white/[0.02] border-white/5 text-white/60 hover:text-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name="restoreMode"
                          checked={restoreMode === 'replace'}
                          onChange={() => setRestoreMode('replace')}
                          className="mt-0.5 accent-amber-400"
                        />
                        <div>
                          <div className="font-bold text-white">Clean Replace</div>
                          <p className="text-[11px] text-white/50 leading-tight mt-0.5">
                            Replaces current browser workspace completely with this backup file.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Confirm Import Button */}
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    disabled={isImporting}
                    className="w-full py-3.5 bg-[#c6ff1f] hover:bg-[#d4ff4d] text-black font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-[#c6ff1f]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isImporting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-black" />
                        <span>{importStep || 'Importing data...'}</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 stroke-[2.5]" />
                        <span>Import All Data into Workspace Now</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'faq' && (
            <div className="space-y-2.5 text-xs">
              {[
                {
                  q: 'Why do I need to export my data regularly?',
                  a: 'Tacstem is a privacy-first local workspace — we do NOT upload or store your match projects, tags, or telestrations on external servers. Everything lives inside your browser storage. Clearing browser history/cache, switching computers, or moving to an updated app deployment/URL can wipe browser storage. Exporting saves a permanent file on your computer.',
                },
                {
                  q: 'Will my exported file work when the app is updated in the future?',
                  a: 'Yes! The exported .tacstem.json file uses a versioned, forward- and backward-compatible schema. When you open an updated version of the app (even on a brand-new URL or domain), click "Export / Import Data" → "Import from File", select your saved file, and all projects, tags, coding pads, telestrations, freeze frames, batches, and tactical boards will be restored and bound to your account automatically.',
                },
                {
                  q: 'Are player-move cutouts, freeze-frame steps, and drawings preserved?',
                  a: 'Yes. All telestration vectors, freeze-frame timestamps, step animations, and player-move sprite cutouts are encoded directly inside the portable backup file so they render identically after import.',
                },
                {
                  q: 'What about the raw MP4/MOV match video files?',
                  a: 'Because match videos are often several gigabytes, your raw video file stays safely on your computer hard drive rather than bloating the JSON backup. After importing your backup into an updated app, click "Relink" on the project and pick the same video file from your computer — all tags, timestamps, playlists, and telestrations immediately sync up.',
                },
              ].map((item, idx) => {
                const isExpanded = expandedFaq === idx;
                return (
                  <div
                    key={idx}
                    className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                      className="w-full text-left p-3.5 flex items-center justify-between gap-3 text-white font-semibold hover:bg-white/[0.02] cursor-pointer"
                    >
                      <span>{item.q}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-[#c6ff1f] shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-white/40 shrink-0" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="p-3.5 pt-2 text-white/70 text-[11px] leading-relaxed border-t border-white/5 bg-black/20">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-xs text-white/50">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#c6ff1f]" />
            <span>100% Local Browser Storage · Universal JSON Export/Import</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-lg transition-colors cursor-pointer text-xs"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
};
