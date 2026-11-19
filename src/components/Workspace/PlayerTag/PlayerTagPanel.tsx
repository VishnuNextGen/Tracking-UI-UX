import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Tag,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  ArrowLeftRight,
  Upload,
  GripVertical,
  RotateCcw,
  Sparkles,
  HardDrive
} from 'lucide-react';
import type { PlayerTagSettings, PlayerTagItem } from '../../../types';
import { getContrastColor } from '../../../utils/colors';
import {
  savePlayerTagSettings,
  DEFAULT_PLAYER_TAG_SETTINGS,
  sanitizePlayerTagSettings
} from './playerTagUtils';

export interface PlayerTagPanelProps {
  settings: PlayerTagSettings;
  onChange: React.Dispatch<React.SetStateAction<PlayerTagSettings>> | ((settings: PlayerTagSettings) => void);
  colors: Array<{ id: number; value: string }>;
  activeColorId: number;
  onSelectColorId: (id: number) => void;
  telestrationColors?: { home: string; away: string; neutral: string };
  activeTelestrationSlot?: 'home' | 'away' | 'neutral' | null;
  onSelectSlot?: (slot: 'home' | 'away' | 'neutral') => void;
  onUpdateColor?: (slot: 'home' | 'away' | 'neutral', color: string) => void;
}

export const PlayerTagPanel: React.FC<PlayerTagPanelProps> = ({
  settings: rawSettings,
  onChange,
  colors,
  activeColorId,
  onSelectColorId,
  telestrationColors,
  activeTelestrationSlot,
  onSelectSlot,
  onUpdateColor,
}) => {
  const settings = useMemo(() => sanitizePlayerTagSettings(rawSettings), [rawSettings]);

  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNumber, setEditNumber] = useState('');
  const [editName, setEditName] = useState('');
  const [editingTeamName, setEditingTeamName] = useState<'A' | 'B' | null>(null);
  const [teamNameInput, setTeamNameInput] = useState('');
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const numberInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const activeTeamKey = settings.activeTeam === 'A' ? 'teamA' : 'teamB';
  const otherTeamKey = settings.activeTeam === 'A' ? 'teamB' : 'teamA';
  const activeTeamData = settings[activeTeamKey];
  const otherTeamData = settings[otherTeamKey];

  const activeTeamColor = settings.activeTeam === 'A'
    ? (telestrationColors?.home || colors.find(c => c.id === settings.teamA.colorId)?.value || '#ef4444')
    : (telestrationColors?.away || colors.find(c => c.id === settings.teamB.colorId)?.value || '#3b82f6');

  const otherTeamColor = settings.activeTeam === 'A'
    ? (telestrationColors?.away || colors.find(c => c.id === settings.teamB.colorId)?.value || '#3b82f6')
    : (telestrationColors?.home || colors.find(c => c.id === settings.teamA.colorId)?.value || '#ef4444');


  const activePlayer = activeTeamData.names.find(n => n.id === settings.activeId) ||
    activeTeamData.names[0] ||
    null;

  const updateSettings = useCallback((updater: (prev: PlayerTagSettings) => PlayerTagSettings) => {
    if (typeof onChange === 'function') {
      try {
        (onChange as any)((prev: any) => {
          const current = (prev && typeof prev === 'object') ? sanitizePlayerTagSettings(prev) : settings;
          return sanitizePlayerTagSettings(updater(current));
        });
      } catch {
        const next = sanitizePlayerTagSettings(updater(settings));
        (onChange as any)(next);
      }
    }
  }, [onChange, settings]);

  // Switch between Home and Away teams
  const switchTeam = (target: 'A' | 'B') => {
    const targetKey = target === 'A' ? 'teamA' : 'teamB';
    const targetTeam = settings[targetKey];
    onSelectColorId(targetTeam.colorId);
    if (onSelectSlot) {
      onSelectSlot(target === 'A' ? 'home' : 'away');
    }

    updateSettings(prev => {
      const prevTargetTeam = prev[targetKey];
      const nextActiveId = prevTargetTeam.names[0]?.id || null;
      return {
        ...prev,
        activeTeam: target,
        activeId: nextActiveId,
      };
    });
  };

  // Quick swap toggle (Home <-> Away)
  const toggleTeam = () => {
    switchTeam(settings.activeTeam === 'A' ? 'B' : 'A');
  };

  // Add single player - persists immediately to local storage
  const handleAddPlayer = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedName = newName.trim();
    if (!trimmedName) return;

    const newId = `p-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const newPlayer: PlayerTagItem = {
      id: newId,
      text: trimmedName,
      name: trimmedName,
      number: newNumber.trim() || undefined,
    };

    updateSettings(prev => ({
      ...prev,
      [activeTeamKey]: {
        ...prev[activeTeamKey],
        names: [...prev[activeTeamKey].names, newPlayer],
      },
      activeId: newId,
    }));

    setNewNumber('');
    setNewName('');
    numberInputRef.current?.focus();
  };

  // Smart Parser for Bulk Lineups - persists immediately to local storage
  const handleBulkImport = () => {
    if (!bulkInput.trim()) return;

    const tokens = bulkInput
      .split(/[\r\n;,]+/)
      .map(t => t.trim())
      .filter(Boolean);

    const parsedPlayers: PlayerTagItem[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      let num = '';
      let pName = token;

      const prefixMatch = token.match(/^(?:#?\[?(\d{1,3})\]?[\.\-\:\s]\s*)(.*)$/);
      if (prefixMatch) {
        num = prefixMatch[1];
        pName = prefixMatch[2].trim();
      } else {
        const suffixMatch = token.match(/^(.*?)[\s\-\:\#]+(\d{1,3})$/);
        if (suffixMatch) {
          pName = suffixMatch[1].trim();
          num = suffixMatch[2];
        }
      }

      if (pName) {
        parsedPlayers.push({
          id: `p-${Date.now().toString(36)}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          text: pName,
          name: pName,
          number: num || undefined,
        });
      }
    }

    if (parsedPlayers.length > 0) {
      updateSettings(prev => ({
        ...prev,
        [activeTeamKey]: {
          ...prev[activeTeamKey],
          names: [...prev[activeTeamKey].names, ...parsedPlayers],
        },
        activeId: parsedPlayers[0]?.id || prev.activeId,
      }));
      setBulkInput('');
      setShowBulkImport(false);
    }
  };

  // Inline edit player
  const startEditPlayer = (player: PlayerTagItem) => {
    setEditingId(player.id);
    setEditNumber(player.number || '');
    setEditName(player.name || player.text || '');
  };

  const saveEditPlayer = () => {
    if (!editingId) return;
    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditingId(null);
      return;
    }

    updateSettings(prev => {
      const updatedNames = prev[activeTeamKey].names.map(p => {
        if (p.id === editingId) {
          return {
            ...p,
            name: trimmedName,
            text: trimmedName,
            number: editNumber.trim() || undefined,
          };
        }
        return p;
      });
      return {
        ...prev,
        [activeTeamKey]: {
          ...prev[activeTeamKey],
          names: updatedNames,
        },
      };
    });
    setEditingId(null);
  };

  // Delete single player
  const deletePlayer = (id: string) => {
    updateSettings(prev => {
      const newNames = prev[activeTeamKey].names.filter(n => n.id !== id);
      const nextActive = prev.activeId === id ? (newNames[0]?.id || null) : prev.activeId;
      return {
        ...prev,
        [activeTeamKey]: {
          ...prev[activeTeamKey],
          names: newNames,
        },
        activeId: nextActive,
      };
    });
  };

  // Clear current team roster
  const clearCurrentRoster = () => {
    updateSettings(prev => ({
      ...prev,
      [activeTeamKey]: {
        ...prev[activeTeamKey],
        names: [],
      },
      activeId: null,
    }));
    setShowConfirmClear(false);
  };

  // Reset to default lineups
  const resetToDefaults = () => {
    updateSettings(() => DEFAULT_PLAYER_TAG_SETTINGS);
  };

  // Team Name Editing
  const startEditTeamName = (team: 'A' | 'B') => {
    setEditingTeamName(team);
    setTeamNameInput(team === 'A' ? settings.teamA.name : settings.teamB.name);
  };

  const saveTeamName = () => {
    if (!editingTeamName) return;
    const trimmed = teamNameInput.trim();
    if (trimmed) {
      const key = editingTeamName === 'A' ? 'teamA' : 'teamB';
      updateSettings(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          name: trimmed,
        },
      }));
    }
    setEditingTeamName(null);
  };

  // Drag and Drop reordering
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ id, team: activeTeamKey }));
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    try {
      const raw = e.dataTransfer.getData('text/plain');
      const data = JSON.parse(raw);
      if (data.team !== activeTeamKey) return;
      updateSettings(prev => {
        const names = [...prev[activeTeamKey].names];
        const srcIdx = names.findIndex(p => p.id === data.id);
        if (srcIdx < 0 || targetIdx < 0 || srcIdx === targetIdx) return prev;
        const [moved] = names.splice(srcIdx, 1);
        names.splice(targetIdx, 0, moved);
        return {
          ...prev,
          [activeTeamKey]: {
            ...prev[activeTeamKey],
            names,
          },
        };
      });
    } catch {}
  };

  // Set team color
  const setTeamColor = (colorId: number) => {
    updateSettings(prev => ({
      ...prev,
      [activeTeamKey]: {
        ...prev[activeTeamKey],
        colorId,
      },
    }));
    onSelectColorId(colorId);
  };

  const isUppercase = settings.uppercase !== false;
  const showNumber = settings.showNumber !== false;
  const tagSize = Math.max(1, Math.min(30, typeof settings.size === 'number' ? settings.size : 11));

  return (
    <div className="flex flex-col h-full space-y-1.5 animate-in fade-in duration-150 text-gray-200 select-none pb-1">
      {/* 1. COMPACT MASTER HEADER & TEAM SWITCHER */}
      <div className="shrink-0 space-y-1">
        {/* Title bar with micro broadcast preview - fixated area without layout shifts */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="p-0.5 rounded bg-indigo-500/10 text-indigo-400">
              <Tag className="w-3 h-3" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-tight text-white">
              Player Tag
            </span>
          </div>

          {/* Micro Broadcast Tag Preview */}
          <div
            className="flex items-center rounded overflow-hidden shadow border border-black/40 text-[9px] max-w-[120px]"
            style={{ backgroundColor: activeTeamColor }}
            title={`Active Tag: ${activePlayer?.number ? '#' + activePlayer.number + ' ' : ''}${activePlayer?.name || activePlayer?.text || ''}`}
          >
            {showNumber && (
              <span
                className="px-1 py-0.2 font-black font-mono shrink-0 bg-black/25"
                style={{
                  color: getContrastColor(activeTeamColor),
                }}
              >
                {activePlayer?.number || '#'}
              </span>
            )}
            <span
              className="px-1.5 py-0.2 font-bold truncate text-[8.5px]"
              style={{
                color: getContrastColor(activeTeamColor),
              }}
            >
              {activePlayer
                ? isUppercase
                  ? (activePlayer.name || activePlayer.text).toUpperCase()
                  : activePlayer.name || activePlayer.text
                : 'PLAYER'}
            </span>
          </div>
        </div>

        {/* SMART FRICTIONLESS TEAM TOGGLE */}
        <div className="flex items-center gap-1 p-0.5 bg-[#121316] rounded-lg border border-[#24262c]">
          {/* HOME TAB */}
          <div className="flex-1 flex items-center min-w-0">
            {editingTeamName === 'A' ? (
              <div className="flex items-center gap-1 flex-1 px-1 py-0.5 bg-[#20222a] rounded">
                <input
                  type="text"
                  value={teamNameInput}
                  onChange={e => setTeamNameInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveTeamName();
                    if (e.key === 'Escape') setEditingTeamName(null);
                  }}
                  autoFocus
                  className="w-full bg-black/40 border border-[#c6ff1f] rounded px-1 text-[9px] text-white outline-none"
                />
                <button onClick={saveTeamName} className="text-[#c6ff1f]">
                  <Check className="w-2.5 h-2.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => switchTeam('A')}
                className={`flex-1 flex items-center justify-between px-2 py-1 rounded transition-all text-left ${
                  settings.activeTeam === 'A'
                    ? 'bg-[#20222a] text-white shadow-sm border border-[#3b3f4c]'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#18191e]'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm cursor-pointer hover:scale-125 transition-transform"
                    style={{
                      backgroundColor: telestrationColors?.home || colors.find(c => c.id === settings.teamA.colorId)?.value || '#ef4444',
                    }}
                    title="Home team color (click to select, double-click to pick custom color)"
                    onClick={(e) => {
                      e.stopPropagation();
                      switchTeam('A');
                      onSelectSlot?.('home');
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      const input = document.createElement('input');
                      input.type = 'color';
                      input.value = telestrationColors?.home || '#ef4444';
                      input.onchange = (ev) => {
                        const newColor = (ev.target as HTMLInputElement).value;
                        onUpdateColor?.('home', newColor);
                      };
                      input.click();
                    }}
                  />
                  <span
                    className="text-[9.5px] font-black truncate hover:underline"
                    title="Click team name to select, double-click to rename"
                    onDoubleClick={e => {
                      e.stopPropagation();
                      startEditTeamName('A');
                    }}
                  >
                    {settings.teamA.name || 'HOME'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className={`text-[8.5px] font-mono font-bold px-1 rounded ${
                      settings.activeTeam === 'A' ? 'bg-white/10 text-white' : 'text-gray-500'
                    }`}
                  >
                    {settings.teamA.names.length}
                  </span>
                </div>
              </button>
            )}
          </div>

          {/* SWAP BUTTON */}
          <button
            onClick={toggleTeam}
            title="Swap Home/Away Team"
            className="p-1 text-gray-400 hover:text-white hover:bg-[#20222a] rounded transition-all active:scale-90 shrink-0"
          >
            <ArrowLeftRight className="w-3 h-3 text-[#c6ff1f]" />
          </button>

          {/* AWAY TAB */}
          <div className="flex-1 flex items-center min-w-0">
            {editingTeamName === 'B' ? (
              <div className="flex items-center gap-1 flex-1 px-1 py-0.5 bg-[#20222a] rounded">
                <input
                  type="text"
                  value={teamNameInput}
                  onChange={e => setTeamNameInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveTeamName();
                    if (e.key === 'Escape') setEditingTeamName(null);
                  }}
                  autoFocus
                  className="w-full bg-black/40 border border-[#c6ff1f] rounded px-1 text-[9px] text-white outline-none"
                />
                <button onClick={saveTeamName} className="text-[#c6ff1f]">
                  <Check className="w-2.5 h-2.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => switchTeam('B')}
                className={`flex-1 flex items-center justify-between px-2 py-1 rounded transition-all text-left ${
                  settings.activeTeam === 'B'
                    ? 'bg-[#20222a] text-white shadow-sm border border-[#3b3f4c]'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#18191e]'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm cursor-pointer hover:scale-125 transition-transform"
                    style={{
                      backgroundColor: telestrationColors?.away || colors.find(c => c.id === settings.teamB.colorId)?.value || '#3b82f6',
                    }}
                    title="Away team color (click to select, double-click to pick custom color)"
                    onClick={(e) => {
                      e.stopPropagation();
                      switchTeam('B');
                      onSelectSlot?.('away');
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      const input = document.createElement('input');
                      input.type = 'color';
                      input.value = telestrationColors?.away || '#3b82f6';
                      input.onchange = (ev) => {
                        const newColor = (ev.target as HTMLInputElement).value;
                        onUpdateColor?.('away', newColor);
                      };
                      input.click();
                    }}
                  />
                  <span
                    className="text-[9.5px] font-black truncate hover:underline"
                    title="Click team name to select, double-click to rename"
                    onDoubleClick={e => {
                      e.stopPropagation();
                      startEditTeamName('B');
                    }}
                  >
                    {settings.teamB.name || 'AWAY'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className={`text-[8.5px] font-mono font-bold px-1 rounded ${
                      settings.activeTeam === 'B' ? 'bg-white/10 text-white' : 'text-gray-500'
                    }`}
                  >
                    {settings.teamB.names.length}
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. DEDICATED FULL ROW: PLAYER TAG SIZE SLIDER (supports 0.5 decimal steps like 10.5, default 11px) */}
      <div className="shrink-0 bg-[#0e1014] p-1.5 px-2 rounded-md border border-[#202228] space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[8.5px] font-bold text-gray-400 uppercase tracking-wider">
            Tag Size
          </span>
          <span className="text-[9px] font-mono font-bold text-[#c6ff1f] bg-[#16181f] px-1.5 py-0.5 rounded border border-[#282a34]">
            {tagSize}px
          </span>
        </div>
        <input
          type="range"
          min={4}
          max={30}
          step={0.5}
          value={tagSize}
          onChange={e => {
            const val = parseFloat(e.target.value);
            updateSettings(prev => ({ ...prev, size: val }));
          }}
          className="w-full h-1.5 bg-[#262830] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#c6ff1f] hover:[&::-webkit-slider-thumb]:scale-110 transition-all"
          title={`Tag scale: ${tagSize}px (supports 0.5 steps like 10.5px)`}
        />
      </div>

      {/* 4. BROADCAST OPTIONS & ROSTER UTILITIES */}
      <div className="shrink-0 flex items-center justify-between gap-1 bg-[#0e1014] p-1 px-1.5 rounded-md border border-[#202228]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              updateSettings(prev => ({ ...prev, showNumber: prev.showNumber === false ? true : false }))
            }
            className={`px-2 py-0.5 rounded text-[8px] font-black transition-all ${
              showNumber
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                : 'text-gray-500 hover:text-gray-300'
            }`}
            title="Toggle Jersey Number"
          >
            # Number
          </button>
          <button
            type="button"
            onClick={() =>
              updateSettings(prev => ({ ...prev, uppercase: prev.uppercase === false ? true : false }))
            }
            className={`px-2 py-0.5 rounded text-[8px] font-black transition-all ${
              isUppercase
                ? 'bg-[#c6ff1f]/15 text-[#c6ff1f] border border-[#c6ff1f]/30'
                : 'text-gray-500 hover:text-gray-300'
            }`}
            title="Toggle Uppercase Broadcast Naming"
          >
            AA Uppercase
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0 pl-1 border-l border-[#242630]">
          <button
            type="button"
            onClick={() => {
              if (activeTeamData.names.length > 0) {
                setShowConfirmClear(true);
              }
            }}
            className="p-1 rounded text-gray-500 hover:text-red-400 transition-colors"
            title="Clear active team roster"
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
          <button
            type="button"
            onClick={resetToDefaults}
            className="p-1 rounded text-gray-500 hover:text-indigo-400 transition-colors"
            title="Reset rosters to default lineups"
          >
            <RotateCcw className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>

      {/* Confirmation to Clear Roster */}
      {showConfirmClear && (
        <div className="shrink-0 p-1.5 bg-red-950/40 border border-red-700/50 rounded-md flex items-center justify-between text-[8px] text-red-200">
          <span>Clear all players from {activeTeamData.name}?</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowConfirmClear(false)}
              className="px-1.5 py-0.5 bg-black/40 hover:bg-black/60 rounded text-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={clearCurrentRoster}
              className="px-1.5 py-0.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* 4. ULTRA COMPACT QUICK ADD ROW */}
      <form onSubmit={handleAddPlayer} className="shrink-0 flex items-center gap-1">
        <input
          ref={numberInputRef}
          type="text"
          value={newNumber}
          onChange={e => setNewNumber(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              nameInputRef.current?.focus();
            }
          }}
          placeholder="#"
          maxLength={3}
          className="w-7 bg-[#12141a] border border-[#2a2d36] rounded px-0.5 py-0.5 text-[9.5px] font-black text-center text-[#c6ff1f] placeholder-gray-600 focus:outline-none focus:border-[#c6ff1f] font-mono shrink-0"
          title="Jersey Number"
        />
        <input
          ref={nameInputRef}
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Add player..."
          className="flex-1 min-w-0 bg-[#12141a] border border-[#2a2d36] rounded px-1.5 py-0.5 text-[9.5px] font-medium text-white placeholder-gray-600 focus:outline-none focus:border-[#c6ff1f] truncate"
        />
        <button
          type="submit"
          disabled={!newName.trim()}
          className="px-1.5 py-0.5 bg-[#c6ff1f] hover:bg-[#b0e616] text-black font-black text-[9px] rounded flex items-center justify-center shrink-0 transition-all disabled:opacity-30 disabled:pointer-events-none"
          title="Add Player (persists to local storage)"
        >
          <Plus className="w-3 h-3 stroke-[3]" />
        </button>
        <button
          type="button"
          onClick={() => setShowBulkImport(!showBulkImport)}
          className={`p-1 rounded transition-colors shrink-0 ${
            showBulkImport ? 'text-[#c6ff1f] bg-black/40' : 'text-gray-500 hover:text-gray-300'
          }`}
          title="Bulk Squad Paste"
        >
          <Upload className="w-2.5 h-2.5" />
        </button>
      </form>

      {/* Collapsible Bulk Lineup Import Drawer */}
      {showBulkImport && (
        <div className="shrink-0 p-1.5 bg-[#12141a] rounded-lg border border-[#2a2d36] space-y-1 animate-in fade-in duration-100 shadow-xl">
          <textarea
            rows={2}
            value={bulkInput}
            onChange={e => setBulkInput(e.target.value)}
            placeholder="Paste 11 players e.g. 10 Messi, 7 De Paul, 23 Martinez"
            className="w-full bg-[#0a0c10] border border-[#262832] rounded p-1 text-[9px] text-white placeholder-gray-600 font-mono resize-none focus:outline-none focus:border-[#c6ff1f]"
          />
          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={() => setShowBulkImport(false)}
              className="px-1.5 py-0.2 text-[8px] text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleBulkImport}
              className="px-2 py-0.2 bg-[#c6ff1f] text-black font-bold text-[8px] rounded"
            >
              Import
            </button>
          </div>
        </div>
      )}

      {/* 5. 11-PLAYER LINEUP (FITS 11 PLAYERS WITHOUT SCROLLING!) */}
      <div className="flex-1 min-h-0 flex flex-col space-y-[2px] overflow-y-auto pr-0.5 custom-scrollbar">
        {activeTeamData.names.map((player, idx) => {
          const isSelected = settings.activeId === player.id;
          const isEditing = editingId === player.id;

          return (
            <div
              key={player.id}
              draggable={!isEditing}
              onDragStart={e => handleDragStart(e, player.id)}
              onDragOver={e => e.preventDefault()}
              onDrop={e => handleDrop(e, idx)}
              onClick={() => {
                if (!isEditing) {
                  updateSettings(prev => ({ ...prev, activeId: player.id }));
                  onSelectColorId(activeTeamData.colorId);
                }
              }}
              className={`h-[22px] flex items-center justify-between px-1 rounded transition-all cursor-pointer group ${
                isSelected
                  ? 'bg-[#181a22] border border-[#c6ff1f]/60 shadow-sm'
                  : 'bg-[#101115] hover:bg-[#161820] border border-[#1f2128]'
              }`}
            >
              {isEditing ? (
                // Inline Edit Mode
                <div
                  className="flex items-center gap-1 flex-1 min-w-0"
                  onClick={e => e.stopPropagation()}
                >
                  <input
                    type="text"
                    value={editNumber}
                    onChange={e => setEditNumber(e.target.value)}
                    placeholder="#"
                    maxLength={3}
                    className="w-6 bg-[#0a0c10] border border-[#c6ff1f] rounded px-0.5 text-[8.5px] font-mono font-bold text-center text-[#c6ff1f] outline-none"
                  />
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveEditPlayer();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    autoFocus
                    className="flex-1 min-w-0 bg-[#0a0c10] border border-[#c6ff1f] rounded px-1 text-[8.5px] font-semibold text-white outline-none"
                  />
                  <button
                    onClick={saveEditPlayer}
                    className="text-[#c6ff1f] hover:text-white"
                    title="Save"
                  >
                    <Check className="w-2.5 h-2.5" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-gray-400 hover:text-white"
                    title="Cancel"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ) : (
                // Compact Broadcast Roster Row
                <>
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <GripVertical className="w-2 h-2 text-gray-600 opacity-0 group-hover:opacity-100 cursor-grab shrink-0 -ml-0.5" />

                    {/* Jersey Number Badge */}
                    <div
                      className="w-4 h-3.5 rounded font-black text-[8px] flex items-center justify-center shrink-0 tracking-tight"
                      style={{
                        backgroundColor: activeTeamColor,
                        color: getContrastColor(activeTeamColor),
                      }}
                      title={player.number ? `Jersey #${player.number}` : 'No number'}
                    >
                      {player.number || '—'}
                    </div>

                    {/* Player Name */}
                    <span
                      className={`text-[9px] font-bold truncate tracking-wide leading-none ${
                        isSelected ? 'text-white' : 'text-gray-300'
                      }`}
                    >
                      {isUppercase
                        ? (player.name || player.text).toUpperCase()
                        : player.name || player.text}
                    </span>
                  </div>

                  {/* Actions & Active Indicator */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#c6ff1f] shadow-[0_0_5px_#c6ff1f]" />
                    )}

                    <button
                      onClick={e => {
                        e.stopPropagation();
                        startEditPlayer(player);
                      }}
                      className="p-0.5 text-gray-500 hover:text-white rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Edit"
                    >
                      <Edit2 className="w-2 h-2" />
                    </button>

                    <button
                      onClick={e => {
                        e.stopPropagation();
                        deletePlayer(player.id);
                      }}
                      className="p-0.5 text-gray-500 hover:text-red-400 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete"
                    >
                      <Trash2 className="w-2 h-2" />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {activeTeamData.names.length === 0 && (
          <div className="p-3 text-center border border-dashed border-[#262832] rounded-lg">
            <p className="text-[8.5px] text-gray-400">Empty roster</p>
            <p className="text-[7.5px] text-gray-600 mt-1">Use the input above or bulk paste to add players</p>
          </div>
        )}
      </div>

      {/* 6. SUBTLE BOTTOM STATUS STRIP */}
      <div className="shrink-0 flex items-center justify-between text-[7.5px] text-gray-500 px-0.5 pt-0.5 border-t border-[#1a1c22]">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80"></span>
          <span>Saved to storage</span>
        </div>
        <span>Click player to select & stamp</span>
      </div>
    </div>
  );
};
