import { Tag as TagData, TagEvent, Playlist, Label } from '../../../types';

export interface TimelineContextMenuState {
  x: number;
  y: number;
  eventId: string;
}

export interface TimelineEventActionModalProps {
  contextMenu: TimelineContextMenuState | null;
  setContextMenu: (state: TimelineContextMenuState | null) => void;
  tagEvents: TagEvent[];
  setTagEvents: React.Dispatch<React.SetStateAction<TagEvent[]>>;
  tags: TagData[];
  labels?: Label[];
  playlists?: Playlist[];
  activePlaylistId?: string;
  onAddToPlaylist?: (eventIds: string[], playlistId?: string, forceAllowDuplicates?: boolean) => void;
  currentTime?: number;
  showNotification: (message: string, color?: string, onUndo?: () => void) => void;
  onSyncNotesToPanel?: (eventId: string, noteText: string) => void;
  onDeleteEvents?: (eventIds: string[]) => void;
  activeSidebarTab?: 'tags' | 'events' | 'notes' | 'playlist';
  setActiveSidebarTab?: (tab: 'tags' | 'events' | 'notes' | 'playlist') => void;
  setNotesSubTab?: (tab: 'timeline' | 'general') => void;
}
