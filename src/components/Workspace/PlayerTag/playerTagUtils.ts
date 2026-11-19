import type { PlayerTagSettings, PlayerTagItem, PlayerTagTeam } from '../../../types';
import { safeSetLocalStorage } from '../Workspace.utils';

export const PLAYER_TAG_STORAGE_KEY = 'tacstem_player_tag_settings';
export const LEGACY_PLAYER_TAG_STORAGE_KEY = 'playerTagSettings';
export const BACKUP_PLAYER_TAG_STORAGE_KEY = 'tacstem_player_tags';

export const DEFAULT_PLAYER_TAG_SETTINGS: PlayerTagSettings = {
  teamA: {
    name: 'Home',
    colorId: 5,
    names: [
      { id: 'h1', number: '31', text: 'Ederson', name: 'Ederson' },
      { id: 'h2', number: '2', text: 'Walker', name: 'Walker' },
      { id: 'h3', number: '3', text: 'Dias', name: 'Dias' },
      { id: 'h4', number: '25', text: 'Akanji', name: 'Akanji' },
      { id: 'h5', number: '24', text: 'Gvardiol', name: 'Gvardiol' },
      { id: 'h6', number: '16', text: 'Rodri', name: 'Rodri' },
      { id: 'h7', number: '17', text: 'De Bruyne', name: 'De Bruyne' },
      { id: 'h8', number: '8', text: 'Kovacic', name: 'Kovacic' },
      { id: 'h9', number: '20', text: 'Bernardo', name: 'Bernardo' },
      { id: 'h10', number: '9', text: 'Haaland', name: 'Haaland' },
      { id: 'h11', number: '47', text: 'Foden', name: 'Foden' },
    ],
    bulkText: '',
  },
  teamB: {
    name: 'Away',
    colorId: 3,
    names: [
      { id: 'a1', number: '22', text: 'Raya', name: 'Raya' },
      { id: 'a2', number: '4', text: 'White', name: 'White' },
      { id: 'a3', number: '2', text: 'Saliba', name: 'Saliba' },
      { id: 'a4', number: '6', text: 'Gabriel', name: 'Gabriel' },
      { id: 'a5', number: '12', text: 'Timber', name: 'Timber' },
      { id: 'a6', number: '41', text: 'Rice', name: 'Rice' },
      { id: 'a7', number: '8', text: 'Odegaard', name: 'Odegaard' },
      { id: 'a8', number: '23', text: 'Merino', name: 'Merino' },
      { id: 'a9', number: '7', text: 'Saka', name: 'Saka' },
      { id: 'a10', number: '29', text: 'Havertz', name: 'Havertz' },
      { id: 'a11', number: '11', text: 'Martinelli', name: 'Martinelli' },
    ],
    bulkText: '',
  },
  activeTeam: 'A',
  activeId: 'h7',
  size: 11,
  uppercase: true,
  showNumber: true,
};

/**
 * Normalizes an array of player items, handling legacy structures or string values.
 */
export const sanitizePlayerList = (items: any[]): PlayerTagItem[] => {
  if (!Array.isArray(items)) return [];
  return items
    .filter(item => Boolean(item))
    .map((item, index) => {
      if (typeof item === 'string') {
        const trimmed = item.trim();
        return {
          id: `player-${index}-${Date.now().toString(36)}`,
          text: trimmed,
          name: trimmed,
        };
      }
      const pName = (item.name || item.text || '').trim();
      const pText = (item.text || item.name || '').trim();
      const pNum = item.number !== undefined && item.number !== null ? String(item.number).trim() : undefined;
      return {
        id: item.id ? String(item.id) : `p-${index}-${Date.now().toString(36)}`,
        text: pText || pName || 'Player',
        name: pName || pText || 'Player',
        number: pNum && pNum.length > 0 ? pNum : undefined,
      };
    })
    .filter(item => item.name.length > 0);
};

/**
 * Validates and merges loaded settings with defaults to guarantee robust schema.
 */
export const sanitizePlayerTagSettings = (data: any): PlayerTagSettings => {
  if (!data || typeof data !== 'object') {
    return DEFAULT_PLAYER_TAG_SETTINGS;
  }

  const teamA: PlayerTagTeam = {
    name: typeof data.teamA?.name === 'string' && data.teamA.name.trim() ? data.teamA.name.trim() : DEFAULT_PLAYER_TAG_SETTINGS.teamA.name,
    colorId: typeof data.teamA?.colorId === 'number' ? data.teamA.colorId : DEFAULT_PLAYER_TAG_SETTINGS.teamA.colorId,
    names: Array.isArray(data.teamA?.names) ? sanitizePlayerList(data.teamA.names) : DEFAULT_PLAYER_TAG_SETTINGS.teamA.names,
    bulkText: typeof data.teamA?.bulkText === 'string' ? data.teamA.bulkText : '',
  };

  const teamB: PlayerTagTeam = {
    name: typeof data.teamB?.name === 'string' && data.teamB.name.trim() ? data.teamB.name.trim() : DEFAULT_PLAYER_TAG_SETTINGS.teamB.name,
    colorId: typeof data.teamB?.colorId === 'number' ? data.teamB.colorId : DEFAULT_PLAYER_TAG_SETTINGS.teamB.colorId,
    names: Array.isArray(data.teamB?.names) ? sanitizePlayerList(data.teamB.names) : DEFAULT_PLAYER_TAG_SETTINGS.teamB.names,
    bulkText: typeof data.teamB?.bulkText === 'string' ? data.teamB.bulkText : '',
  };

  const activeTeam: 'A' | 'B' = data.activeTeam === 'B' ? 'B' : 'A';
  const activeTeamData = activeTeam === 'A' ? teamA : teamB;

  let activeId: string | null = data.activeId || null;
  const allNames = [...teamA.names, ...teamB.names];
  if (activeId && !allNames.some(p => p.id === activeId)) {
    activeId = activeTeamData.names[0]?.id || allNames[0]?.id || null;
  } else if (!activeId && activeTeamData.names.length > 0) {
    activeId = activeTeamData.names[0].id;
  }

  const size = typeof data.size === 'number' && data.size >= 1 && data.size <= 50 ? data.size : 11;
  const uppercase = data.uppercase !== false;
  const showNumber = data.showNumber !== false;

  return {
    teamA,
    teamB,
    activeTeam,
    activeId,
    size,
    uppercase,
    showNumber,
  };
};

/**
 * Loads player tag settings from localStorage with fallback keys and optional initial project data.
 */
export const loadPlayerTagSettings = (fallbackFromProject?: PlayerTagSettings): PlayerTagSettings => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return fallbackFromProject ? sanitizePlayerTagSettings(fallbackFromProject) : DEFAULT_PLAYER_TAG_SETTINGS;
  }

  try {
    const keys = [
      PLAYER_TAG_STORAGE_KEY,
      LEGACY_PLAYER_TAG_STORAGE_KEY,
      BACKUP_PLAYER_TAG_STORAGE_KEY,
    ];

    for (const key of keys) {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          return sanitizePlayerTagSettings(parsed);
        }
      }
    }
  } catch (err) {
    console.error('Failed to load player tag settings from localStorage:', err);
  }

  if (fallbackFromProject) {
    return sanitizePlayerTagSettings(fallbackFromProject);
  }

  return DEFAULT_PLAYER_TAG_SETTINGS;
};

/**
 * Saves player tag settings to localStorage and dispatches change notification.
 */
export const savePlayerTagSettings = (settings: PlayerTagSettings): boolean => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false;
  }

  try {
    const sanitized = sanitizePlayerTagSettings(settings);
    const serialized = JSON.stringify(sanitized);

    const prev = localStorage.getItem(PLAYER_TAG_STORAGE_KEY);
    if (prev === serialized) {
      return true;
    }

    safeSetLocalStorage(PLAYER_TAG_STORAGE_KEY, serialized);

    // Also mirror to legacy and backup keys for complete compatibility
    try {
      localStorage.setItem(LEGACY_PLAYER_TAG_STORAGE_KEY, serialized);
      localStorage.setItem(BACKUP_PLAYER_TAG_STORAGE_KEY, serialized);
    } catch (_) {}

    // Dispatch custom event so any other component or listener updates
    try {
      window.dispatchEvent(new CustomEvent('tacstem_player_tags_changed', { detail: sanitized }));
    } catch (_) {}

    return true;
  } catch (err) {
    console.error('Failed to save player tag settings to localStorage:', err);
    return false;
  }
};
