import React, { useRef, useState } from 'react';
import {
  ArrowLeft,
  Undo2,
  Redo2,
  Type,
  Heading1,
  Image as ImageIcon,
  Square,
  Circle,
  Minus,
  MoveUpRight,
  BarChart3,
  Table2,
  GitBranch,
  Sparkles,
  Play,
  SlidersHorizontal,
  LayoutTemplate,
  Palette,
  Check,
  Loader2,
  Plus,
  UserCheck,
  Scale,
  Smile,
  ListVideo,
  Clapperboard,
} from 'lucide-react';
import type { SlideLayoutType, ThemeId } from '../types/presentation';
import { SLIDE_LAYOUTS, SLIDE_THEMES } from '../constants/themesAndLayouts';
import type { ElementFactoryType } from '../editor/elementOperations';
import type { SaveStatus } from '../editor/useSlideEditor';

interface ToolbarProps {
  title: string;
  themeId: ThemeId;
  activeLayout: SlideLayoutType;
  canUndo: boolean;
  canRedo: boolean;
  saveStatus: SaveStatus;
  isAIPanelOpen: boolean;
  onBackToDashboard: () => void;
  onTitleChange: (nextTitle: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onAddElement: (kind: ElementFactoryType) => void;
  onUploadImage: (file: File) => void;
  onOpenPlaylistImporter: () => void;
  onOpenBoardImporter: () => void;
  onSwitchLayout: (layout: SlideLayoutType) => void;
  onChangeTheme: (themeId: ThemeId) => void;
  onToggleAIPanel: () => void;
  onOpenAISettings: () => void;
  onPresent: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  title,
  themeId,
  activeLayout,
  canUndo,
  canRedo,
  saveStatus,
  isAIPanelOpen,
  onBackToDashboard,
  onTitleChange,
  onUndo,
  onRedo,
  onAddElement,
  onUploadImage,
  onOpenPlaylistImporter,
  onOpenBoardImporter,
  onSwitchLayout,
  onChangeTheme,
  onToggleAIPanel,
  onOpenAISettings,
  onPresent,
}) => {
  const [openMenu, setOpenMenu] = useState<'elements' | 'layout' | 'theme' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleMenu = (m: 'elements' | 'layout' | 'theme') => {
    setOpenMenu((prev) => (prev === m ? null : m));
  };

  return (
    <header className="h-14 shrink-0 bg-[#11131a] border-b border-white/[0.08] px-3 sm:px-4 flex items-center justify-between gap-3 relative z-40">
      {/* Left: Back + Title + Save Status */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onBackToDashboard}
          className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] border border-white/10 text-white/75 hover:text-white transition-colors cursor-pointer shrink-0"
          title="Back to Presentation Library"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="bg-transparent hover:bg-white/[0.04] focus:bg-white/[0.07] border border-transparent focus:border-[#c6ff1f]/50 rounded-lg px-2.5 py-1 text-sm font-bold text-white focus:outline-none min-w-[140px] max-w-[260px] truncate"
          title="Rename presentation"
        />

        <span className="hidden lg:inline-flex items-center gap-1.5 text-[11px] text-white/45 shrink-0">
          {saveStatus === 'saving' ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin text-[#c6ff1f]" />
              <span>Saving locally...</span>
            </>
          ) : saveStatus === 'error' ? (
            <span className="text-red-400">Save error</span>
          ) : (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span>Saved to browser</span>
            </>
          )}
        </span>
      </div>

      {/* Center: Undo/Redo + Add Elements + Layout + Theme */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] disabled:opacity-30 text-white/80 border border-white/10 cursor-pointer disabled:cursor-default"
          title="Undo (Ctrl/Cmd + Z)"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] disabled:opacity-30 text-white/80 border border-white/10 cursor-pointer disabled:cursor-default"
          title="Redo (Ctrl/Cmd + Shift + Z)"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="h-5 w-px bg-white/10 mx-1 hidden sm:block" />

        {/* Quick Insert Buttons */}
        <button
          type="button"
          onClick={() => onAddElement('heading')}
          className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 text-xs font-medium text-white/85 cursor-pointer"
          title="Add Heading"
        >
          <Heading1 className="w-3.5 h-3.5 text-[#c6ff1f]" />
          <span>Heading</span>
        </button>
        <button
          type="button"
          onClick={() => onAddElement('text')}
          className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 text-xs font-medium text-white/85 cursor-pointer"
          title="Add Text Box"
        >
          <Type className="w-3.5 h-3.5 text-[#c6ff1f]" />
          <span>Text</span>
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 text-xs font-medium text-white/85 cursor-pointer"
          title="Upload Local Image"
        >
          <ImageIcon className="w-3.5 h-3.5 text-[#c6ff1f]" />
          <span>Image</span>
        </button>
        <button
          type="button"
          onClick={onOpenPlaylistImporter}
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 text-xs font-medium text-white/85 cursor-pointer"
          title="Import Video Playlists from Analysis Projects"
        >
          <ListVideo className="w-3.5 h-3.5 text-[#c6ff1f]" />
          <span>Import Playlist</span>
        </button>
        <button
          type="button"
          onClick={onOpenBoardImporter}
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 text-xs font-medium text-white/85 cursor-pointer"
          title="Import Tactical Board Slides as Looping Video or All-Slides Player"
        >
          <Clapperboard className="w-3.5 h-3.5 text-[#c6ff1f]" />
          <span>Import Board</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              onUploadImage(e.target.files[0]);
              e.target.value = '';
            }
          }}
        />

        {/* All Elements Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('elements')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
              openMenu === 'elements'
                ? 'bg-[#c6ff1f] text-black border-[#c6ff1f]'
                : 'bg-white/[0.04] hover:bg-white/[0.09] border-white/10 text-white/85'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Insert</span>
          </button>

          {openMenu === 'elements' && (
            <div className="absolute left-0 top-full mt-2 w-72 bg-[#161923] border border-white/15 rounded-xl shadow-2xl p-2 z-50 grid grid-cols-2 gap-1">
              {(
                [
                  { id: 'heading', label: 'Heading', icon: Heading1 },
                  { id: 'subheading', label: 'Subheading', icon: Type },
                  { id: 'text', label: 'Text Box', icon: Type },
                  { id: 'rectangle', label: 'Rectangle', icon: Square },
                  { id: 'circle', label: 'Circle', icon: Circle },
                  { id: 'line', label: 'Line', icon: Minus },
                  { id: 'arrow', label: 'Arrow', icon: MoveUpRight },
                  { id: 'icon', label: 'Icon', icon: Smile },
                  { id: 'chart', label: 'Chart', icon: BarChart3 },
                  { id: 'table', label: 'Table', icon: Table2 },
                  { id: 'svg-diagram', label: 'Flow Diagram', icon: GitBranch },
                  { id: 'player-card', label: 'Player Card', icon: UserCheck },
                  { id: 'match-comparison', label: 'Match Stats', icon: Scale },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onAddElement(item.id);
                      setOpenMenu(null);
                    }}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/[0.07] text-xs text-white/85 text-left cursor-pointer"
                  >
                    <Icon className="w-3.5 h-3.5 text-[#c6ff1f] shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setOpenMenu(null);
                  onOpenPlaylistImporter();
                }}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/[0.07] text-xs text-white/85 text-left cursor-pointer"
              >
                <ListVideo className="w-3.5 h-3.5 text-[#c6ff1f] shrink-0" />
                <span className="truncate">Video Playlist</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenMenu(null);
                  onOpenBoardImporter();
                }}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/[0.07] text-xs text-white/85 text-left cursor-pointer"
              >
                <Clapperboard className="w-3.5 h-3.5 text-[#c6ff1f] shrink-0" />
                <span className="truncate">Tactical Board</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenMenu(null);
                  fileInputRef.current?.click();
                }}
                className="col-span-2 flex items-center justify-center gap-2 px-2.5 py-2 mt-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-white cursor-pointer"
              >
                <ImageIcon className="w-3.5 h-3.5 text-[#c6ff1f]" />
                <span>Upload Local Image</span>
              </button>
            </div>
          )}
        </div>

        {/* Layout Switcher */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('layout')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${
              openMenu === 'layout'
                ? 'bg-white/15 border-white/25 text-white'
                : 'bg-white/[0.04] hover:bg-white/[0.09] border-white/10 text-white/80'
            }`}
            title="Switch slide layout while keeping content"
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Layout</span>
          </button>

          {openMenu === 'layout' && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-[#161923] border border-white/15 rounded-xl shadow-2xl py-1.5 z-50 max-h-80 overflow-y-auto">
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Switch Layout (Preserves Content)
              </div>
              {SLIDE_LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    onSwitchLayout(l.id);
                    setOpenMenu(null);
                  }}
                  className={`w-full px-3 py-1.5 text-left flex items-center justify-between text-xs hover:bg-white/[0.06] cursor-pointer ${
                    activeLayout === l.id ? 'text-[#c6ff1f] font-semibold' : 'text-white/80'
                  }`}
                >
                  <span>{l.label}</span>
                  {activeLayout === l.id && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme Switcher */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('theme')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${
              openMenu === 'theme'
                ? 'bg-white/15 border-white/25 text-white'
                : 'bg-white/[0.04] hover:bg-white/[0.09] border-white/10 text-white/80'
            }`}
            title="Presentation design theme"
          >
            <Palette className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Theme</span>
          </button>

          {openMenu === 'theme' && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-[#161923] border border-white/15 rounded-xl shadow-2xl py-1.5 z-50">
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Deck Theme
              </div>
              {Object.values(SLIDE_THEMES).map((th) => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => {
                    onChangeTheme(th.id);
                    setOpenMenu(null);
                  }}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 text-xs hover:bg-white/[0.06] cursor-pointer ${
                    themeId === th.id ? 'text-[#c6ff1f] font-semibold' : 'text-white/85'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-4 h-4 rounded border border-white/20 shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${th.backgroundColor} 55%, ${th.accentColor} 55%)`,
                      }}
                    />
                    <span className="truncate">{th.name}</span>
                  </div>
                  {themeId === th.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: AI Assistant + AI Settings + Present */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onOpenAISettings}
          className="p-2 rounded-xl border text-xs bg-white/[0.04] hover:bg-white/[0.09] border-white/10 text-white/75 cursor-pointer"
          title="Gemini Slide Engine Preferences"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToggleAIPanel}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
            isAIPanelOpen
              ? 'bg-[#c6ff1f]/20 border-[#c6ff1f]/50 text-[#c6ff1f]'
              : 'bg-white/[0.04] hover:bg-white/[0.09] border-white/10 text-white/85'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">AI Assistant</span>
        </button>

        <button
          type="button"
          onClick={onPresent}
          className="btn-glow inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-black text-xs font-bold cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Present</span>
        </button>
      </div>
    </header>
  );
};
