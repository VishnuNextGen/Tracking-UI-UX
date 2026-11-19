import React from 'react';
import { motion } from 'framer-motion';
import { Folder, ChevronLeft, Check, ListPlus, CornerDownRight } from 'lucide-react';
import { Playlist } from '../../../types';

interface PlaylistSubMenuProps {
  isOpen: boolean;
  playlists: Playlist[];
  activePlaylistId?: string;
  activeClipIndex?: number;
  onSelectPlaylist: (playlistId: string) => void;
  onInsertAtPlaylist?: (playlistId: string, insertAtIndex: number) => void;
  isMobile: boolean;
  openToLeft: boolean;
  openUpwards: boolean;
  onBack?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const PlaylistSubMenu: React.FC<PlaylistSubMenuProps> = ({
  isOpen,
  playlists,
  activePlaylistId,
  activeClipIndex,
  onSelectPlaylist,
  onInsertAtPlaylist,
  isMobile,
  openToLeft,
  openUpwards,
  onBack,
  onMouseEnter,
  onMouseLeave,
}) => {
  if (!isOpen) return null;

  const renderRow = (pl: Playlist, mobileView: boolean) => {
    const isActive = pl.id === activePlaylistId;
    const count = pl.events?.length || 0;
    const safeIdx =
      isActive && typeof activeClipIndex === 'number' && count > 0
        ? Math.max(0, Math.min(count - 1, activeClipIndex))
        : -1;
    const showInsertAfterActive =
      Boolean(onInsertAtPlaylist) && isActive && safeIdx >= 0 && safeIdx < count - 1;
    const showInsertAtTop = Boolean(onInsertAtPlaylist) && count > 0 && !showInsertAfterActive;

    return (
      <div
        key={pl.id}
        className={`w-full rounded-lg transition-colors flex items-center justify-between gap-1 group ${
          mobileView ? 'px-2.5 py-2' : 'px-2 py-1.5'
        } ${
          isActive
            ? 'bg-purple-500/15 text-purple-200 border border-purple-500/30'
            : 'text-gray-300 hover:text-white hover:bg-white/10'
        }`}
      >
        <button
          type="button"
          onClick={() => onSelectPlaylist(pl.id)}
          className="flex items-center gap-2 min-w-0 flex-1 text-left text-xs cursor-pointer"
          title={`Append to end of "${pl.name}"`}
        >
          <Folder
            className={`w-3.5 h-3.5 shrink-0 ${
              isActive ? 'text-purple-400' : 'text-gray-400 group-hover:text-purple-400'
            }`}
          />
          <span className="truncate">{pl.name}</span>
          <span className="text-[10px] text-gray-400 font-mono tabular-nums shrink-0">({count})</span>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          {showInsertAfterActive && onInsertAtPlaylist && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onInsertAtPlaylist(pl.id, safeIdx + 1);
              }}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#c6ff1f]/15 hover:bg-[#c6ff1f] text-[#c6ff1f] hover:text-black border border-[#c6ff1f]/35 text-[10px] font-mono font-bold transition-colors cursor-pointer"
              title={`Insert right after clip #${safeIdx + 1} in "${pl.name}"`}
            >
              <CornerDownRight className="w-2.5 h-2.5" />
              <span>After #{safeIdx + 1}</span>
            </button>
          )}
          {showInsertAtTop && onInsertAtPlaylist && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onInsertAtPlaylist(pl.id, 0);
              }}
              className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded bg-white/10 hover:bg-[#c6ff1f] text-gray-300 hover:text-black text-[9.5px] font-mono font-semibold transition-all cursor-pointer"
              title={`Insert at #1 (top) of "${pl.name}"`}
            >
              + #1
            </button>
          )}
          {isActive && !showInsertAfterActive && mobileView && (
            <Check className="w-3.5 h-3.5 text-purple-400" />
          )}
        </div>
      </div>
    );
  };

  if (isMobile) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.15 }}
        className="flex flex-col gap-1.5 p-1 w-full"
      >
        <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-[#202736]">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-xs text-gray-300 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <span className="text-[11px] font-semibold text-purple-400">Select Playlist</span>
        </div>

        <div className="max-h-[180px] overflow-y-auto custom-scrollbar space-y-1">
          {playlists.map((pl) => renderRow(pl, true))}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, x: openToLeft ? 6 : -6 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95, x: openToLeft ? 6 : -6 }}
      transition={{ duration: 0.12 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`absolute z-[130] bg-[#141721]/98 backdrop-blur-xl border border-[#272f40] rounded-xl shadow-2xl p-1.5 min-w-[220px] max-w-[265px] max-h-[250px] overflow-y-auto custom-scrollbar text-white flex flex-col gap-0.5 ${
        openToLeft ? 'right-full mr-2 before:-right-3' : 'left-full ml-2 before:-left-3'
      } ${openUpwards ? 'bottom-0' : 'top-0'} before:absolute before:inset-y-0 before:w-3 before:content-['']`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-2 py-1 text-[10px] uppercase font-semibold text-gray-400 tracking-wider flex items-center justify-between border-b border-[#202736] mb-0.5">
        <span className="flex items-center gap-1 text-purple-400">
          <ListPlus className="w-3 h-3" /> Playlists
        </span>
        <span className="font-mono text-gray-500">{playlists.length}</span>
      </div>

      <div className="space-y-0.5">
        {playlists.map((pl) => renderRow(pl, false))}
      </div>
    </motion.div>
  );
};
