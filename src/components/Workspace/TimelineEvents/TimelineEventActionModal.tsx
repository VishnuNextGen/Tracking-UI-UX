import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeftRight, FileText, Trash2, ListPlus, Folder, 
  ChevronRight, StickyNote, X, Clock, Sparkles, Tag as TagIcon
} from 'lucide-react';
import { Tag as TagData, TagEvent, Playlist, Label } from '../../../types';
import { formatTime } from '../../../utils/math';
import { TimelineContextMenuState } from './types';
import { EventReassignModal } from './EventReassignModal';
import { EventNoteModal } from './EventNoteModal';
import { EventDeleteModal } from './EventDeleteModal';
import { PlaylistSubMenu } from './PlaylistSubMenu';

interface TimelineEventActionModalProps {
  contextMenu: TimelineContextMenuState | null;
  setContextMenu: (state: TimelineContextMenuState | null) => void;
  tagEvents: TagEvent[];
  setTagEvents: React.Dispatch<React.SetStateAction<TagEvent[]>>;
  tags: TagData[];
  labels?: Label[];
  playlists?: Playlist[];
  activePlaylistId?: string;
  activeClipIndex?: number;
  onAddToPlaylist?: (
    eventIds: string[],
    playlistId?: string,
    forceAllowDuplicates?: boolean,
    insertAtIndex?: number
  ) => void;
  currentTime?: number;
  showNotification: (message: string, color?: string, onUndo?: () => void) => void;
  onDeleteEvents?: (eventIds: string[]) => void;
  activeSidebarTab?: 'tags' | 'events' | 'notes' | 'playlist';
  setActiveSidebarTab?: (tab: 'tags' | 'events' | 'notes' | 'playlist') => void;
  setNotesSubTab?: (tab: 'timeline' | 'general') => void;
  onSaveEventNote?: (eventId: string, noteText: string) => void;
}

export const TimelineEventActionModal: React.FC<TimelineEventActionModalProps> = ({
  contextMenu,
  setContextMenu,
  tagEvents,
  setTagEvents,
  tags,
  labels = [],
  playlists = [],
  activePlaylistId,
  activeClipIndex,
  onAddToPlaylist,
  currentTime = 0,
  showNotification,
  onDeleteEvents,
  setActiveSidebarTab,
  setNotesSubTab,
  onSaveEventNote,
}) => {
  const [activeSubModal, setActiveSubModal] = useState<'reassign' | 'note' | 'delete' | null>(null);
  const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false);
  const [isPlaylistPinned, setIsPlaylistPinned] = useState(false);
  const playlistHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handlePlaylistMouseEnter = () => {
    if (menuPosition.isMobile) return;
    if (playlistHoverTimeoutRef.current) {
      clearTimeout(playlistHoverTimeoutRef.current);
      playlistHoverTimeoutRef.current = null;
    }
    setShowPlaylistSubmenu(true);
  };

  const handlePlaylistMouseLeave = () => {
    if (menuPosition.isMobile) return;
    if (isPlaylistPinned) return; // Keep open if pinned by click!
    playlistHoverTimeoutRef.current = setTimeout(() => {
      setShowPlaylistSubmenu(false);
    }, 280);
  };

  // Active target event
  const currentEvent = useMemo(() => {
    if (!contextMenu) return null;
    return tagEvents.find((e) => e.id === contextMenu.eventId) || null;
  }, [contextMenu, tagEvents]);

  // Current tag
  const currentTag = useMemo(() => {
    if (!currentEvent) return null;
    return tags.find((t) => t.id === currentEvent.tagId) || null;
  }, [currentEvent, tags]);

  // Viewport-aware menu positioning
  const menuPosition = useMemo(() => {
    if (!contextMenu) return { x: 0, y: 0, isMobile: false, openSubMenuLeft: false, openSubMenuUp: false };
    
    const isMobile = window.innerWidth < 640;
    if (isMobile) {
      return { x: 0, y: 0, isMobile: true, openSubMenuLeft: false, openSubMenuUp: false };
    }

    const estimatedWidth = 240;
    const estimatedHeight = 230;
    const padding = 12;

    let posX = contextMenu.x;
    let posY = contextMenu.y;

    // Boundary check right
    if (posX + estimatedWidth > window.innerWidth - padding) {
      posX = Math.max(padding, window.innerWidth - estimatedWidth - padding);
    }

    // Boundary check bottom - flip upwards if near bottom
    const isFlippedUp = posY + estimatedHeight > window.innerHeight - padding;
    if (isFlippedUp) {
      posY = Math.max(padding, posY - estimatedHeight - 8);
    }

    // Check if sub-menu to the right would overflow right edge (sub-menu width ~220px)
    const openSubMenuLeft = posX + estimatedWidth + 230 > window.innerWidth;
    const openSubMenuUp = isFlippedUp || posY + 240 > window.innerHeight;

    return { x: posX, y: posY, isMobile: false, openSubMenuLeft, openSubMenuUp };
  }, [contextMenu]);

  // Close context menu handler
  const handleClose = () => {
    if (playlistHoverTimeoutRef.current) {
      clearTimeout(playlistHoverTimeoutRef.current);
      playlistHoverTimeoutRef.current = null;
    }
    setContextMenu(null);
    setShowPlaylistSubmenu(false);
    setIsPlaylistPinned(false);
  };

  // Reassign tags handler
  const handleConfirmReassign = (eventId: string, newTagIds: string[]) => {
    if (!newTagIds || newTagIds.length === 0) return;
    const targetEvent = tagEvents.find((e) => e.id === eventId);
    if (!targetEvent) return;

    const previousEvents = [...tagEvents];
    const primaryTagId = newTagIds[0];
    const additionalEvents: TagEvent[] = newTagIds.slice(1).map((tagId) => ({
      ...targetEvent,
      id: crypto.randomUUID(),
      tagId: tagId,
    }));

    setTagEvents((prev) => {
      return prev
        .map((e) => (e.id === eventId ? { ...e, tagId: primaryTagId } : e))
        .concat(additionalEvents);
    });

    const primaryTagName = tags.find((t) => t.id === primaryTagId)?.name || 'new tag';
    const message =
      newTagIds.length === 1
        ? `Event reassigned to "${primaryTagName}"`
        : `Event reassigned & added to ${newTagIds.length} tags`;

    showNotification(message, '#c6ff1f', () => {
      setTagEvents(previousEvents);
    });

    handleClose();
  };

  // Note save & sync handler
  const handleSaveNote = (eventId: string, noteText: string) => {
    if (onSaveEventNote) {
      onSaveEventNote(eventId, noteText);
      handleClose();
      return;
    }

    const previousEvents = [...tagEvents];

    setTagEvents((prev) =>
      prev.map((e) => {
        if (e.id === eventId) {
          return { ...e, notes: noteText };
        }
        return e;
      })
    );

    // Sync with right panel notes tab
    if (setActiveSidebarTab) {
      setActiveSidebarTab('notes');
    }
    if (setNotesSubTab) {
      setNotesSubTab('timeline');
    }

    showNotification(
      noteText ? 'Note saved and synced with Notes tab' : 'Note cleared',
      '#c6ff1f',
      () => {
        setTagEvents(previousEvents);
      }
    );

    handleClose();
  };

  // Event delete handler
  const handleConfirmDelete = () => {
    if (!currentEvent) return;
    const eventId = currentEvent.id;
    const previousEvents = [...tagEvents];

    if (onDeleteEvents) {
      onDeleteEvents([eventId]);
    } else {
      setTagEvents((prev) => prev.filter((e) => e.id !== eventId));
    }

    showNotification('Event deleted from timeline', '#ef4444', () => {
      setTagEvents(previousEvents);
    });

    handleClose();
  };

  if (!contextMenu || !currentEvent) return null;

  const duration = Math.max(0, currentEvent.endTime - currentEvent.startTime);
  const hasNote = Boolean(currentEvent.notes && currentEvent.notes.trim().length > 0);

  return (
    <>
      {/* Backdrop for click outside */}
      <div 
        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[1px]" 
        onClick={handleClose} 
      />

      {/* Main Compact Action Menu */}
      <div
        ref={menuRef}
        style={
          menuPosition.isMobile
            ? undefined
            : { left: menuPosition.x, top: menuPosition.y }
        }
        className={
          menuPosition.isMobile
            ? 'fixed inset-x-4 bottom-6 z-[110] bg-[#141721] border border-[#2b3345] rounded-2xl shadow-2xl p-2.5 max-w-sm mx-auto flex flex-col gap-1 text-white animate-in slide-in-from-bottom-4 duration-150'
            : 'fixed z-[110] bg-[#141721]/95 backdrop-blur-xl border border-[#272f40] rounded-xl shadow-2xl py-1.5 px-1.5 w-[235px] text-white flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100 select-none'
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Event Info Header */}
        <div className="px-2.5 py-2 border-b border-[#202736] mb-1">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: currentTag?.color || '#3b82f6' }}
              />
              <span className="text-xs font-bold text-white truncate tracking-wide">
                {currentTag?.name || 'Tagged Event'}
              </span>
            </div>
            <span className="font-mono text-[10px] text-gray-400 shrink-0">
              {duration.toFixed(1)}s
            </span>
          </div>

          <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono mt-1">
            <span>
              {formatTime(currentEvent.startTime)} – {formatTime(currentEvent.endTime)}
            </span>
            {hasNote && (
              <span className="flex items-center gap-1 text-[#c6ff1f] font-sans text-[10px]">
                <StickyNote className="w-2.5 h-2.5" /> Note
              </span>
            )}
          </div>

          {/* Quick note snippet if exists */}
          {hasNote && (
            <p className="mt-1 text-[11px] text-gray-300 italic truncate bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
              "{currentEvent.notes}"
            </p>
          )}
        </div>

        {menuPosition.isMobile && showPlaylistSubmenu ? (
          <PlaylistSubMenu
            isOpen={true}
            playlists={playlists}
            activePlaylistId={activePlaylistId}
            activeClipIndex={activeClipIndex}
            onSelectPlaylist={(plId) => {
              onAddToPlaylist?.([currentEvent.id], plId);
              handleClose();
            }}
            onInsertAtPlaylist={(plId, insertAtIdx) => {
              onAddToPlaylist?.([currentEvent.id], plId, false, insertAtIdx);
              handleClose();
            }}
            isMobile={true}
            openToLeft={false}
            openUpwards={false}
            onBack={() => setShowPlaylistSubmenu(false)}
          />
        ) : (
          <>
            {/* Action 1: Reassign Tag */}
            <button
              type="button"
              onClick={() => setActiveSubModal('reassign')}
              className="w-full text-left px-2.5 py-2 text-xs rounded-lg text-gray-200 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1 rounded bg-[#c6ff1f]/10 text-[#c6ff1f] group-hover:bg-[#c6ff1f]/20 transition-colors shrink-0">
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <div className="font-semibold text-white leading-tight">Reassign Tag</div>
                  <div className="text-[10px] text-gray-400 truncate">Change or multi-assign tags</div>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-300 shrink-0 ml-1" />
            </button>

            {/* Action 2: Add Note / Edit Note */}
            <button
              type="button"
              onClick={() => setActiveSubModal('note')}
              className="w-full text-left px-2.5 py-2 text-xs rounded-lg text-gray-200 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1 rounded bg-sky-500/10 text-sky-400 group-hover:bg-sky-500/20 transition-colors shrink-0">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <div className="font-semibold text-white leading-tight">
                    {hasNote ? 'Edit Note' : 'Add Note'}
                  </div>
                  <div className="text-[10px] text-gray-400 truncate">
                    Syncs with Right Panel Notes
                  </div>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-300 shrink-0 ml-1" />
            </button>

            {/* Action 3: Add to Playlist (Side Sub-Component) */}
            {onAddToPlaylist && (
              <div 
                className="relative"
                onMouseEnter={handlePlaylistMouseEnter}
                onMouseLeave={handlePlaylistMouseLeave}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (playlists && playlists.length > 1) {
                      if (playlistHoverTimeoutRef.current) {
                        clearTimeout(playlistHoverTimeoutRef.current);
                        playlistHoverTimeoutRef.current = null;
                      }
                      setIsPlaylistPinned((prev) => !prev);
                      setShowPlaylistSubmenu((prev) => !prev);
                    } else if (playlists && playlists.length === 1) {
                      onAddToPlaylist([currentEvent.id], playlists[0].id);
                      showNotification(`Added to "${playlists[0].name}"`, '#c6ff1f');
                      handleClose();
                    } else {
                      onAddToPlaylist([currentEvent.id], activePlaylistId);
                      showNotification('Added to active playlist', '#c6ff1f');
                      handleClose();
                    }
                  }}
                  className={`w-full text-left px-2.5 py-2 text-xs rounded-lg transition-colors flex items-center justify-between group ${
                    showPlaylistSubmenu ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1 rounded bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 transition-colors shrink-0">
                      <ListPlus className="w-3.5 h-3.5" />
                    </div>
                    <div className="truncate">
                      <div className="font-medium text-gray-200 leading-tight">
                        Add to Playlist
                      </div>
                      <div className="text-[10px] text-gray-400 truncate">
                        {playlists?.find((p) => p.id === activePlaylistId)?.name || 'Active playlist'}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-300 shrink-0 ml-1" />
                </button>

                {/* Desktop Side Sub-Component (Flies out to the right or left) */}
                {!menuPosition.isMobile && (
                  <PlaylistSubMenu
                    isOpen={showPlaylistSubmenu && Boolean(playlists && playlists.length > 0)}
                    playlists={playlists}
                    activePlaylistId={activePlaylistId}
                    activeClipIndex={activeClipIndex}
                    onSelectPlaylist={(plId) => {
                      onAddToPlaylist([currentEvent.id], plId);
                      handleClose();
                    }}
                    onInsertAtPlaylist={(plId, insertAtIdx) => {
                      onAddToPlaylist([currentEvent.id], plId, false, insertAtIdx);
                      handleClose();
                    }}
                    isMobile={false}
                    openToLeft={menuPosition.openSubMenuLeft}
                    openUpwards={menuPosition.openSubMenuUp}
                    onMouseEnter={handlePlaylistMouseEnter}
                    onMouseLeave={handlePlaylistMouseLeave}
                  />
                )}
              </div>
            )}

            <div className="border-t border-[#202736] my-1" />

            {/* Action 4: Delete Event */}
            <button
              type="button"
              onClick={() => setActiveSubModal('delete')}
              className="w-full text-left px-2.5 py-2 text-xs rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/15 transition-colors flex items-center gap-2.5 group"
            >
              <div className="p-1 rounded bg-red-500/10 text-red-400 group-hover:bg-red-500/25 transition-colors shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </div>
              <div className="truncate">
                <div className="font-semibold text-red-400 group-hover:text-red-300 leading-tight">
                  Delete
                </div>
                <div className="text-[10px] text-red-400/70 truncate">
                  Remove event from timeline
                </div>
              </div>
            </button>
          </>
        )}
      </div>

      {/* Sub-Modal: Reassign Tags */}
      {activeSubModal === 'reassign' && currentEvent && (
        <EventReassignModal
          isOpen={true}
          onClose={() => {
            setActiveSubModal(null);
            handleClose();
          }}
          event={currentEvent}
          currentTag={currentTag}
          allTags={tags}
          onConfirmReassign={handleConfirmReassign}
        />
      )}

      {/* Sub-Modal: Add / Edit Note */}
      {activeSubModal === 'note' && currentEvent && (
        <EventNoteModal
          isOpen={true}
          onClose={() => {
            setActiveSubModal(null);
            handleClose();
          }}
          event={currentEvent}
          tag={currentTag}
          currentTime={currentTime}
          onSaveNote={handleSaveNote}
        />
      )}

      {/* Sub-Modal: Delete Confirmation */}
      {activeSubModal === 'delete' && currentEvent && (
        <EventDeleteModal
          isOpen={true}
          onClose={() => {
            setActiveSubModal(null);
            handleClose();
          }}
          event={currentEvent}
          tag={currentTag}
          onConfirmDelete={handleConfirmDelete}
        />
      )}
    </>
  );
};
