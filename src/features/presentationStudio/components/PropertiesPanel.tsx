import React from 'react';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  ChevronsUp,
  ChevronUp,
  ChevronDown,
  ChevronsDown,
  Lock,
  Unlock,
  Group,
  Plus,
  Trash2,
  FolderPlus,
  ArrowUp,
  ArrowDown,
  Clapperboard,
} from 'lucide-react';
import type {
  Slide,
  SlideElement,
  SlideLayoutType,
  SlideTransitionType,
  ThemeId,
  TextSlideElement,
  ImageSlideElement,
  ShapeSlideElement,
  IconSlideElement,
  ChartSlideElement,
  TableSlideElement,
  VideoPlaylistSlideElement,
  TacticalBoardSlideElement,
  PlayerCardSlideElement,
  MatchComparisonSlideElement,
} from '../types/presentation';
import { formatReelTime } from '../storage/playlistVideoResolver';
import {
  FONT_OPTIONS,
  SLIDE_LAYOUTS,
  SLIDE_THEMES,
  uid,
} from '../constants/themesAndLayouts';
import { ICON_REGISTRY } from '../renderer/elements/StructuredElementsRenderer';

interface PropertiesPanelProps {
  slide: Slide;
  themeId: ThemeId;
  selectedElements: SlideElement[];
  onUpdateSlide: (updater: (slide: Slide) => Slide) => void;
  onSwitchLayout: (layout: SlideLayoutType) => void;
  onChangeTheme: (themeId: ThemeId) => void;
  onUpdateElement: (id: string, patch: Partial<SlideElement>) => void;
  onAlignSelected: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onReorderLayer: (id: string, dir: 'front' | 'back' | 'forward' | 'backward') => void;
  onToggleGroup: () => void;
  onUploadReplacementImage: (elementId: string, file: File) => void;
  onOpenPlaylistImporter: (elementId: string) => void;
  onOpenBoardImporter: (elementId: string) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  slide,
  themeId,
  selectedElements,
  onUpdateSlide,
  onSwitchLayout,
  onChangeTheme,
  onUpdateElement,
  onAlignSelected,
  onReorderLayer,
  onToggleGroup,
  onUploadReplacementImage,
  onOpenPlaylistImporter,
  onOpenBoardImporter,
}) => {
  const el = selectedElements.length === 1 ? selectedElements[0] : null;

  return (
    <aside className="w-72 xl:w-80 shrink-0 bg-[#0f1117] border-l border-white/[0.08] flex flex-col h-full overflow-y-auto scrollbar-panel select-none">
      <div className="p-3 border-b border-white/[0.08] flex items-center justify-between">
        <span className="text-xs font-semibold text-white/80">
          {el
            ? `Element · ${el.type.replace('-', ' ')}`
            : selectedElements.length > 1
            ? `${selectedElements.length} Elements Selected`
            : 'Slide Properties'}
        </span>
      </div>

      <div className="p-3.5 space-y-5 text-xs">
        {/* Multi-select tools */}
        {selectedElements.length > 1 && (
          <div className="space-y-3">
            <div>
              <span className="text-[11px] font-semibold text-white/50 block mb-2">
                Align Selection
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(['left', 'center', 'right', 'top', 'middle', 'bottom'] as const).map((al) => (
                  <button
                    key={al}
                    type="button"
                    onClick={() => onAlignSelected(al)}
                    className="px-2 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] border border-white/10 text-[11px] capitalize text-white/80 cursor-pointer"
                  >
                    {al}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={onToggleGroup}
              className="w-full py-2 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Group className="w-3.5 h-3.5 text-[#c6ff1f]" />
              <span>Group / Ungroup Elements</span>
            </button>
          </div>
        )}

        {/* No element selected -> Slide Properties */}
        {selectedElements.length === 0 && (
          <>
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-white/55 block">Slide Title</label>
              <input
                type="text"
                value={slide.title}
                onChange={(e) =>
                  onUpdateSlide((s) => ({ ...s, title: e.target.value }))
                }
                className="w-full bg-white/[0.04] border border-white/15 focus:border-[#c6ff1f] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-white/55 block">Slide Layout</label>
              <select
                value={slide.layout}
                onChange={(e) => onSwitchLayout(e.target.value as SlideLayoutType)}
                className="w-full bg-[#171a23] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
              >
                {SLIDE_LAYOUTS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-white/55 block">Deck Theme</label>
              <select
                value={themeId}
                onChange={(e) => onChangeTheme(e.target.value as ThemeId)}
                className="w-full bg-[#171a23] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
              >
                {Object.values(SLIDE_THEMES).map((th) => (
                  <option key={th.id} value={th.id}>
                    {th.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 pt-2 border-t border-white/[0.07]">
              <label className="text-[11px] font-semibold text-white/55 block">Background</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSlide((s) => ({
                      ...s,
                      background: { ...s.background, type: 'solid' },
                    }))
                  }
                  className={`py-1.5 rounded-lg border text-xs cursor-pointer ${
                    slide.background.type === 'solid'
                      ? 'bg-[#c6ff1f]/15 border-[#c6ff1f]/40 text-[#c6ff1f]'
                      : 'bg-white/[0.03] border-white/10 text-white/70'
                  }`}
                >
                  Solid
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSlide((s) => ({
                      ...s,
                      background: {
                        ...s.background,
                        type: 'gradient',
                        gradientTo: s.background.gradientTo || '#1a2234',
                        gradientAngle: s.background.gradientAngle ?? 135,
                      },
                    }))
                  }
                  className={`py-1.5 rounded-lg border text-xs cursor-pointer ${
                    slide.background.type === 'gradient'
                      ? 'bg-[#c6ff1f]/15 border-[#c6ff1f]/40 text-[#c6ff1f]'
                      : 'bg-white/[0.03] border-white/10 text-white/70'
                  }`}
                >
                  Gradient
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={slide.background.color}
                  onChange={(e) =>
                    onUpdateSlide((s) => ({
                      ...s,
                      background: { ...s.background, color: e.target.value },
                    }))
                  }
                  className="w-8 h-8 rounded bg-transparent border border-white/20 cursor-pointer"
                />
                <input
                  type="text"
                  value={slide.background.color}
                  onChange={(e) =>
                    onUpdateSlide((s) => ({
                      ...s,
                      background: { ...s.background, color: e.target.value },
                    }))
                  }
                  className="flex-1 bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1 font-mono text-xs text-white"
                />
              </div>
              {slide.background.type === 'gradient' && (
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={slide.background.gradientTo || '#1a2234'}
                    onChange={(e) =>
                      onUpdateSlide((s) => ({
                        ...s,
                        background: { ...s.background, gradientTo: e.target.value },
                      }))
                    }
                    className="w-8 h-8 rounded bg-transparent border border-white/20 cursor-pointer"
                  />
                  <input
                    type="number"
                    value={slide.background.gradientAngle ?? 135}
                    onChange={(e) =>
                      onUpdateSlide((s) => ({
                        ...s,
                        background: { ...s.background, gradientAngle: Number(e.target.value) },
                      }))
                    }
                    className="flex-1 bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1 font-mono text-xs text-white"
                    title="Gradient angle (degrees)"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t border-white/[0.07]">
              <label className="text-[11px] font-semibold text-white/55 block">
                Presentation Transition
              </label>
              <select
                value={slide.transition}
                onChange={(e) =>
                  onUpdateSlide((s) => ({
                    ...s,
                    transition: e.target.value as SlideTransitionType,
                  }))
                }
                className="w-full bg-[#171a23] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="none">None</option>
                <option value="fade">Fade</option>
                <option value="slide">Slide</option>
                <option value="zoom">Zoom</option>
              </select>
            </div>

            <div className="space-y-2 pt-2 border-t border-white/[0.07]">
              <label className="text-[11px] font-semibold text-white/55 block">
                Speaker Notes
              </label>
              <textarea
                rows={4}
                value={slide.speakerNotes || ''}
                onChange={(e) =>
                  onUpdateSlide((s) => ({ ...s, speakerNotes: e.target.value }))
                }
                placeholder="Talking points for presenting..."
                className="w-full bg-white/[0.04] border border-white/10 focus:border-[#c6ff1f] rounded-lg px-2.5 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none resize-none"
              />
            </div>
          </>
        )}

        {/* Single Element Selected */}
        {el && (
          <>
            {/* Common Position, Size, Rotation, Opacity, Layer, Align */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-white/55">
                  Position &amp; Dimensions
                </span>
                <button
                  type="button"
                  onClick={() => onUpdateElement(el.id, { locked: !el.locked })}
                  className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 cursor-pointer ${
                    el.locked
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-white/[0.05] text-white/60 hover:text-white'
                  }`}
                >
                  {el.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  <span>{el.locked ? 'Locked' : 'Lock'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono tabular-nums">
                {(
                  [
                    { label: 'X', key: 'x', val: el.x },
                    { label: 'Y', key: 'y', val: el.y },
                    { label: 'W', key: 'width', val: el.width },
                    { label: 'H', key: 'height', val: el.height },
                  ] as const
                ).map((dim) => (
                  <label
                    key={dim.key}
                    className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1"
                  >
                    <span className="text-white/40 text-[10px] w-4">{dim.label}</span>
                    <input
                      type="number"
                      value={Math.round(dim.val)}
                      onChange={(e) =>
                        onUpdateElement(el.id, { [dim.key]: Number(e.target.value) })
                      }
                      className="w-full bg-transparent text-xs text-white focus:outline-none"
                    />
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono tabular-nums">
                <label className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1">
                  <span className="text-white/40 text-[10px]">Rot</span>
                  <input
                    type="number"
                    value={Math.round(el.rotation || 0)}
                    onChange={(e) =>
                      onUpdateElement(el.id, { rotation: Number(e.target.value) })
                    }
                    className="w-full bg-transparent text-xs text-white focus:outline-none"
                  />
                </label>
                <label className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1">
                  <span className="text-white/40 text-[10px]">Opac</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={Math.round((el.opacity ?? 1) * 100)}
                    onChange={(e) =>
                      onUpdateElement(el.id, {
                        opacity: Math.max(0, Math.min(1, Number(e.target.value) / 100)),
                      })
                    }
                    className="w-full bg-transparent text-xs text-white focus:outline-none"
                  />
                </label>
              </div>

              {/* Alignment & Layering */}
              <div className="grid grid-cols-6 gap-1">
                {(
                  [
                    { dir: 'left', label: 'L' },
                    { dir: 'center', label: 'C' },
                    { dir: 'right', label: 'R' },
                    { dir: 'top', label: 'T' },
                    { dir: 'middle', label: 'M' },
                    { dir: 'bottom', label: 'B' },
                  ] as const
                ).map((a) => (
                  <button
                    key={a.dir}
                    type="button"
                    onClick={() => onAlignSelected(a.dir)}
                    className="py-1 rounded bg-white/[0.04] hover:bg-white/[0.1] border border-white/10 text-[10px] font-mono text-white/75 cursor-pointer"
                    title={`Align ${a.dir}`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-4 gap-1">
                <button
                  type="button"
                  onClick={() => onReorderLayer(el.id, 'back')}
                  className="py-1 rounded bg-white/[0.04] hover:bg-white/[0.1] border border-white/10 flex items-center justify-center text-white/75 cursor-pointer"
                  title="Send to Back"
                >
                  <ChevronsDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onReorderLayer(el.id, 'backward')}
                  className="py-1 rounded bg-white/[0.04] hover:bg-white/[0.1] border border-white/10 flex items-center justify-center text-white/75 cursor-pointer"
                  title="Send Backward"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onReorderLayer(el.id, 'forward')}
                  className="py-1 rounded bg-white/[0.04] hover:bg-white/[0.1] border border-white/10 flex items-center justify-center text-white/75 cursor-pointer"
                  title="Bring Forward"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onReorderLayer(el.id, 'front')}
                  className="py-1 rounded bg-white/[0.04] hover:bg-white/[0.1] border border-white/10 flex items-center justify-center text-white/75 cursor-pointer"
                  title="Bring to Front"
                >
                  <ChevronsUp className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* TEXT PROPERTIES */}
            {el.type === 'text' && (
              <TextPropertiesSection
                el={el as TextSlideElement}
                onChange={(patch) => onUpdateElement(el.id, patch)}
              />
            )}

            {/* IMAGE PROPERTIES */}
            {el.type === 'image' && (
              <ImagePropertiesSection
                el={el as ImageSlideElement}
                onChange={(patch) => onUpdateElement(el.id, patch)}
                onUploadFile={(f) => onUploadReplacementImage(el.id, f)}
              />
            )}

            {/* SHAPE PROPERTIES */}
            {el.type === 'shape' && (
              <ShapePropertiesSection
                el={el as ShapeSlideElement}
                onChange={(patch) => onUpdateElement(el.id, patch)}
              />
            )}

            {/* ICON PROPERTIES */}
            {el.type === 'icon' && (
              <IconPropertiesSection
                el={el as IconSlideElement}
                onChange={(patch) => onUpdateElement(el.id, patch)}
              />
            )}

            {/* CHART PROPERTIES */}
            {el.type === 'chart' && (
              <ChartPropertiesSection
                el={el as ChartSlideElement}
                onChange={(patch) => onUpdateElement(el.id, patch)}
              />
            )}

            {/* TABLE PROPERTIES */}
            {el.type === 'table' && (
              <TablePropertiesSection
                el={el as TableSlideElement}
                onChange={(patch) => onUpdateElement(el.id, patch)}
              />
            )}

            {/* VIDEO PLAYLIST PROPERTIES */}
            {el.type === 'video-playlist' && (
              <VideoPlaylistPropertiesSection
                el={el as VideoPlaylistSlideElement}
                onChange={(patch) => onUpdateElement(el.id, patch)}
                onOpenImporter={() => onOpenPlaylistImporter(el.id)}
              />
            )}

            {/* TACTICAL BOARD PLAYER PROPERTIES */}
            {el.type === 'tactical-board' && (
              <TacticalBoardPropertiesSection
                el={el as TacticalBoardSlideElement}
                onChange={(patch) => onUpdateElement(el.id, patch)}
                onOpenBoardImporter={() => onOpenBoardImporter(el.id)}
              />
            )}

            {/* PLAYER CARD PROPERTIES */}
            {el.type === 'player-card' && (
              <PlayerCardPropertiesSection
                el={el as PlayerCardSlideElement}
                onChange={(patch) => onUpdateElement(el.id, patch)}
              />
            )}

            {/* MATCH COMPARISON PROPERTIES */}
            {el.type === 'match-comparison' && (
              <MatchComparisonPropertiesSection
                el={el as MatchComparisonSlideElement}
                onChange={(patch) => onUpdateElement(el.id, patch)}
              />
            )}
          </>
        )}
      </div>
    </aside>
  );
};

const TextPropertiesSection: React.FC<{
  el: TextSlideElement;
  onChange: (patch: Partial<TextSlideElement>) => void;
}> = ({ el, onChange }) => (
  <div className="space-y-3 pt-3 border-t border-white/[0.08]">
    <span className="text-[11px] font-semibold text-white/55 block">Typography &amp; Box</span>

    <textarea
      rows={3}
      value={el.content}
      onChange={(e) => onChange({ content: e.target.value })}
      className="w-full bg-white/[0.04] border border-white/10 focus:border-[#c6ff1f] rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none resize-y"
    />

    <select
      value={el.fontFamily}
      onChange={(e) => onChange({ fontFamily: e.target.value })}
      className="w-full bg-[#171a23] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white"
    >
      {FONT_OPTIONS.map((f) => (
        <option key={f.value} value={f.value}>
          {f.label}
        </option>
      ))}
    </select>

    <div className="grid grid-cols-2 gap-2">
      <label className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1">
        <span className="text-white/40 text-[10px]">Size</span>
        <input
          type="number"
          min={12}
          max={180}
          value={el.fontSize}
          onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
          className="w-full bg-transparent text-xs text-white font-mono focus:outline-none"
        />
      </label>
      <select
        value={el.fontWeight}
        onChange={(e) => onChange({ fontWeight: Number(e.target.value) as any })}
        className="bg-[#171a23] border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
      >
        <option value={300}>Light 300</option>
        <option value={400}>Regular 400</option>
        <option value={500}>Medium 500</option>
        <option value={600}>SemiBold 600</option>
        <option value={700}>Bold 700</option>
        <option value={800}>ExtraBold 800</option>
      </select>
    </div>

    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange({ fontWeight: el.fontWeight >= 700 ? 400 : 700 })}
        className={`p-1.5 rounded-lg border cursor-pointer ${
          el.fontWeight >= 700
            ? 'bg-[#c6ff1f]/20 border-[#c6ff1f]/40 text-[#c6ff1f]'
            : 'bg-white/[0.04] border-white/10 text-white/70'
        }`}
      >
        <Bold className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onChange({ italic: !el.italic })}
        className={`p-1.5 rounded-lg border cursor-pointer ${
          el.italic
            ? 'bg-[#c6ff1f]/20 border-[#c6ff1f]/40 text-[#c6ff1f]'
            : 'bg-white/[0.04] border-white/10 text-white/70'
        }`}
      >
        <Italic className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onChange({ underline: !el.underline })}
        className={`p-1.5 rounded-lg border cursor-pointer ${
          el.underline
            ? 'bg-[#c6ff1f]/20 border-[#c6ff1f]/40 text-[#c6ff1f]'
            : 'bg-white/[0.04] border-white/10 text-white/70'
        }`}
      >
        <Underline className="w-3.5 h-3.5" />
      </button>
      <div className="h-4 w-px bg-white/10 mx-1" />
      {(['left', 'center', 'right'] as const).map((al) => {
        const Icon = al === 'left' ? AlignLeft : al === 'center' ? AlignCenter : AlignRight;
        return (
          <button
            key={al}
            type="button"
            onClick={() => onChange({ textAlign: al })}
            className={`p-1.5 rounded-lg border cursor-pointer ${
              el.textAlign === al
                ? 'bg-[#c6ff1f]/20 border-[#c6ff1f]/40 text-[#c6ff1f]'
                : 'bg-white/[0.04] border-white/10 text-white/70'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        );
      })}
    </div>

    <div className="grid grid-cols-2 gap-2 font-mono">
      <label className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1">
        <span className="text-white/40 text-[10px]">LineH</span>
        <input
          type="number"
          step={0.05}
          min={0.8}
          max={2.5}
          value={el.lineHeight}
          onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
          className="w-full bg-transparent text-xs text-white focus:outline-none"
        />
      </label>
      <label className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1">
        <span className="text-white/40 text-[10px]">Track</span>
        <input
          type="number"
          step={0.01}
          min={-0.05}
          max={0.4}
          value={el.letterSpacing}
          onChange={(e) => onChange({ letterSpacing: Number(e.target.value) })}
          className="w-full bg-transparent text-xs text-white focus:outline-none"
        />
      </label>
    </div>

    <div className="grid grid-cols-2 gap-2">
      <label className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1">
        <input
          type="color"
          value={el.color}
          onChange={(e) => onChange({ color: e.target.value })}
          className="w-5 h-5 bg-transparent cursor-pointer"
        />
        <span className="text-[11px] text-white/75">Text</span>
      </label>
      <label className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1">
        <input
          type="color"
          value={el.backgroundColor || '#000000'}
          onChange={(e) => onChange({ backgroundColor: e.target.value })}
          className="w-5 h-5 bg-transparent cursor-pointer"
        />
        <span className="text-[11px] text-white/75">Fill</span>
      </label>
    </div>
  </div>
);

const ImagePropertiesSection: React.FC<{
  el: ImageSlideElement;
  onChange: (patch: Partial<ImageSlideElement>) => void;
  onUploadFile: (file: File) => void;
}> = ({ el, onChange, onUploadFile }) => (
  <div className="space-y-3 pt-3 border-t border-white/[0.08]">
    <span className="text-[11px] font-semibold text-white/55 block">Image &amp; Crop</span>

    <label className="w-full py-2 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-white flex items-center justify-center cursor-pointer">
      <span>Replace Local Image</span>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            onUploadFile(e.target.files[0]);
            e.target.value = '';
          }
        }}
      />
    </label>

    <div className="grid grid-cols-3 gap-1.5">
      {(['cover', 'contain', 'fill'] as const).map((fit) => (
        <button
          key={fit}
          type="button"
          onClick={() => onChange({ objectFit: fit })}
          className={`py-1.5 rounded-lg border text-[11px] capitalize cursor-pointer ${
            el.objectFit === fit
              ? 'bg-[#c6ff1f]/15 border-[#c6ff1f]/40 text-[#c6ff1f]'
              : 'bg-white/[0.03] border-white/10 text-white/70'
          }`}
        >
          {fit}
        </button>
      ))}
    </div>

    <div className="grid grid-cols-2 gap-2">
      <label className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1">
        <span className="text-white/40 text-[10px]">Radius</span>
        <input
          type="number"
          min={0}
          max={200}
          value={el.borderRadius ?? 16}
          onChange={(e) => onChange({ borderRadius: Number(e.target.value) })}
          className="w-full bg-transparent text-xs text-white font-mono focus:outline-none"
        />
      </label>
      <label className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1">
        <span className="text-white/40 text-[10px]">Border</span>
        <input
          type="number"
          min={0}
          max={24}
          value={el.borderWidth ?? 0}
          onChange={(e) => onChange({ borderWidth: Number(e.target.value) })}
          className="w-full bg-transparent text-xs text-white font-mono focus:outline-none"
        />
      </label>
    </div>

    <div className="space-y-1.5">
      <span className="text-[11px] text-white/50 block">Crop Zoom (100% = full)</span>
      <input
        type="range"
        min={40}
        max={100}
        value={Math.round((el.crop?.w ?? 1) * 100)}
        onChange={(e) => {
          const frac = Number(e.target.value) / 100;
          const offset = (1 - frac) / 2;
          onChange({ crop: { x: offset, y: offset, w: frac, h: frac } });
        }}
        className="w-full accent-[#c6ff1f]"
      />
    </div>
  </div>
);

const ShapePropertiesSection: React.FC<{
  el: ShapeSlideElement;
  onChange: (patch: Partial<ShapeSlideElement>) => void;
}> = ({ el, onChange }) => (
  <div className="space-y-3 pt-3 border-t border-white/[0.08]">
    <span className="text-[11px] font-semibold text-white/55 block">Shape Styling</span>
    <div className="grid grid-cols-2 gap-2">
      <label className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1">
        <input
          type="color"
          value={el.fillColor === 'transparent' ? '#151923' : el.fillColor}
          onChange={(e) => onChange({ fillColor: e.target.value })}
          className="w-5 h-5 bg-transparent cursor-pointer"
        />
        <span className="text-[11px] text-white/75">Fill</span>
      </label>
      <label className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1">
        <input
          type="color"
          value={el.strokeColor === 'transparent' ? '#c6ff1f' : el.strokeColor}
          onChange={(e) => onChange({ strokeColor: e.target.value })}
          className="w-5 h-5 bg-transparent cursor-pointer"
        />
        <span className="text-[11px] text-white/75">Stroke</span>
      </label>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <label className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1">
        <span className="text-white/40 text-[10px]">StrokeW</span>
        <input
          type="number"
          min={0}
          max={24}
          value={el.strokeWidth}
          onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })}
          className="w-full bg-transparent text-xs text-white font-mono focus:outline-none"
        />
      </label>
      <label className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1">
        <span className="text-white/40 text-[10px]">Radius</span>
        <input
          type="number"
          min={0}
          max={200}
          value={el.borderRadius ?? 16}
          onChange={(e) => onChange({ borderRadius: Number(e.target.value) })}
          className="w-full bg-transparent text-xs text-white font-mono focus:outline-none"
        />
      </label>
    </div>
    <label className="inline-flex items-center gap-2 text-xs text-white/75 cursor-pointer">
      <input
        type="checkbox"
        checked={Boolean(el.strokeDashed)}
        onChange={(e) => onChange({ strokeDashed: e.target.checked })}
        className="accent-[#c6ff1f]"
      />
      <span>Dashed stroke</span>
    </label>
  </div>
);

const IconPropertiesSection: React.FC<{
  el: IconSlideElement;
  onChange: (patch: Partial<IconSlideElement>) => void;
}> = ({ el, onChange }) => (
  <div className="space-y-3 pt-3 border-t border-white/[0.08]">
    <span className="text-[11px] font-semibold text-white/55 block">Icon Symbol</span>
    <div className="grid grid-cols-4 gap-1.5">
      {Object.keys(ICON_REGISTRY).map((name) => {
        const Comp = ICON_REGISTRY[name];
        return (
          <button
            key={name}
            type="button"
            onClick={() => onChange({ iconName: name })}
            className={`p-2 rounded-lg border flex items-center justify-center cursor-pointer ${
              el.iconName === name
                ? 'bg-[#c6ff1f]/20 border-[#c6ff1f]/50 text-[#c6ff1f]'
                : 'bg-white/[0.03] border-white/10 text-white/70 hover:text-white'
            }`}
            title={name}
          >
            <Comp className="w-4 h-4" />
          </button>
        );
      })}
    </div>
    <label className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1">
      <input
        type="color"
        value={el.color}
        onChange={(e) => onChange({ color: e.target.value })}
        className="w-5 h-5 bg-transparent cursor-pointer"
      />
      <span className="text-[11px] text-white/75">Icon Color</span>
    </label>
  </div>
);

const ChartPropertiesSection: React.FC<{
  el: ChartSlideElement;
  onChange: (patch: Partial<ChartSlideElement>) => void;
}> = ({ el, onChange }) => (
  <div className="space-y-3 pt-3 border-t border-white/[0.08]">
    <span className="text-[11px] font-semibold text-white/55 block">Chart Configuration</span>
    <input
      type="text"
      value={el.title || ''}
      onChange={(e) => onChange({ title: e.target.value })}
      placeholder="Chart title"
      className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
    />
    <select
      value={el.chartKind}
      onChange={(e) => onChange({ chartKind: e.target.value as any })}
      className="w-full bg-[#171a23] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white"
    >
      <option value="bar">Bar Chart</option>
      <option value="horizontal-bar">Horizontal Bar</option>
      <option value="line">Line Chart</option>
      <option value="donut">Donut Chart</option>
    </select>
    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
      {el.data.map((d, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_56px_24px] gap-1 items-center">
          <input
            type="text"
            value={d.label}
            onChange={(e) => {
              const next = el.data.map((item, i) =>
                i === idx ? { ...item, label: e.target.value } : item
              );
              onChange({ data: next });
            }}
            className="bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-[11px] text-white"
          />
          <input
            type="number"
            value={d.value}
            onChange={(e) => {
              const next = el.data.map((item, i) =>
                i === idx ? { ...item, value: Number(e.target.value) } : item
              );
              onChange({ data: next });
            }}
            className="bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white"
          />
          <button
            type="button"
            onClick={() => onChange({ data: el.data.filter((_, i) => i !== idx) })}
            className="p-1 text-white/40 hover:text-red-400 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
    <button
      type="button"
      onClick={() =>
        onChange({ data: [...el.data, { label: `Item ${el.data.length + 1}`, value: 50 }] })
      }
      className="w-full py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-[11px] font-semibold text-white flex items-center justify-center gap-1 cursor-pointer"
    >
      <Plus className="w-3 h-3" /> Add Data Point
    </button>
  </div>
);

const TablePropertiesSection: React.FC<{
  el: TableSlideElement;
  onChange: (patch: Partial<TableSlideElement>) => void;
}> = ({ el, onChange }) => (
  <div className="space-y-3 pt-3 border-t border-white/[0.08]">
    <span className="text-[11px] font-semibold text-white/55 block">Table Data</span>
    <div className="space-y-1.5">
      <span className="text-[10px] text-white/40">Headers (comma-separated)</span>
      <input
        type="text"
        value={el.headers.join(', ')}
        onChange={(e) =>
          onChange({ headers: e.target.value.split(',').map((s) => s.trim()) })
        }
        className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
      />
    </div>
    <div className="space-y-1.5">
      <span className="text-[10px] text-white/40">Rows (one per line, comma-separated)</span>
      <textarea
        rows={4}
        value={el.rows.map((r) => r.join(', ')).join('\n')}
        onChange={(e) =>
          onChange({
            rows: e.target.value
              .split('\n')
              .map((line) => line.split(',').map((cell) => cell.trim())),
          })
        }
        className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
      />
    </div>
  </div>
);

const VideoPlaylistPropertiesSection: React.FC<{
  el: VideoPlaylistSlideElement;
  onChange: (patch: Partial<VideoPlaylistSlideElement>) => void;
  onOpenImporter: () => void;
}> = ({ el, onChange, onOpenImporter }) => {
  const clips = el.clips || [];

  const moveClip = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= clips.length) return;
    const next = [...clips];
    const [removed] = next.splice(index, 1);
    next.splice(target, 0, removed);
    onChange({ clips: next });
  };

  return (
    <div className="space-y-3 pt-3 border-t border-white/[0.08]">
      <span className="text-[11px] font-semibold text-white/55 block">
        Video Playlist Reel
      </span>

      <input
        type="text"
        value={el.title || ''}
        onChange={(e) => onChange({ title: e.target.value })}
        placeholder="Playlist Reel Title"
        className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
      />

      <button
        type="button"
        onClick={onOpenImporter}
        className="w-full py-2 px-3 rounded-xl bg-[#c6ff1f]/15 hover:bg-[#c6ff1f]/25 border border-[#c6ff1f]/40 text-xs font-semibold text-[#c6ff1f] flex items-center justify-center gap-2 cursor-pointer"
      >
        <FolderPlus className="w-3.5 h-3.5" />
        <span>Import Playlists from Projects</span>
      </button>

      <div className="space-y-1.5 pt-1">
        <label className="flex items-center gap-2 text-xs text-white/75 cursor-pointer">
          <input
            type="checkbox"
            checked={el.loop !== false}
            onChange={(e) => onChange({ loop: e.target.checked })}
            className="accent-[#c6ff1f]"
          />
          <span>Loop continuous playlist</span>
        </label>
        <label className="flex items-center gap-2 text-xs text-white/75 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(el.muted)}
            onChange={(e) => onChange({ muted: e.target.checked })}
            className="accent-[#c6ff1f]"
          />
          <span>Mute video audio</span>
        </label>
        <label className="flex items-center gap-2 text-xs text-white/75 cursor-pointer">
          <input
            type="checkbox"
            checked={el.showOverlayHud !== false}
            onChange={(e) => onChange({ showOverlayHud: e.target.checked })}
            className="accent-[#c6ff1f]"
          />
          <span>Show match &amp; tag HUD overlay</span>
        </label>
        <label className="flex items-center gap-2 text-xs text-white/75 cursor-pointer">
          <input
            type="checkbox"
            checked={el.showClipStrip !== false}
            onChange={(e) => onChange({ showClipStrip: e.target.checked })}
            className="accent-[#c6ff1f]"
          />
          <span>Show clip queue strip</span>
        </label>
      </div>

      <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
        <div className="flex items-center justify-between text-[11px] text-white/50">
          <span>Imported Clips ({clips.length})</span>
          {clips.length > 0 && (
            <button
              type="button"
              onClick={() => onChange({ clips: [] })}
              className="text-red-400/80 hover:text-red-300 cursor-pointer"
            >
              Clear All
            </button>
          )}
        </div>

        <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
          {clips.map((c, idx) => (
            <div
              key={c.id}
              className="p-2 rounded-lg bg-white/[0.03] border border-white/10 flex items-center justify-between gap-1.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: c.tagColor || '#c6ff1f' }}
                  />
                  <span className="text-[11px] font-semibold text-white truncate">
                    {idx + 1}. {c.tagName}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-white/45 truncate mt-0.5">
                  {c.projectName} · {formatReelTime(c.startTime)}–{formatReelTime(c.endTime)}
                </div>
              </div>

              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => moveClip(idx, -1)}
                  className="p-1 rounded hover:bg-white/10 disabled:opacity-25 text-white/65 cursor-pointer"
                  title="Move clip earlier"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  disabled={idx === clips.length - 1}
                  onClick={() => moveClip(idx, 1)}
                  className="p-1 rounded hover:bg-white/10 disabled:opacity-25 text-white/65 cursor-pointer"
                  title="Move clip later"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ clips: clips.filter((_, i) => i !== idx) })}
                  className="p-1 rounded hover:bg-red-500/20 text-white/50 hover:text-red-400 cursor-pointer"
                  title="Remove clip"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TacticalBoardPropertiesSection: React.FC<{
  el: TacticalBoardSlideElement;
  onChange: (patch: Partial<TacticalBoardSlideElement>) => void;
  onOpenBoardImporter: () => void;
}> = ({ el, onChange, onOpenBoardImporter }) => (
  <div className="space-y-3 pt-3 border-t border-white/[0.08]">
    <span className="text-[11px] font-semibold text-white/55 block">
      Tactical Board Video Player
    </span>

    <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/10 space-y-1">
      <div className="text-[11px] font-semibold text-white truncate">
        {el.boardProjectName || 'Tactical Board'}
      </div>
      <div className="text-[10px] font-mono text-white/55">
        {el.importMode === 'single-slide'
          ? `Slide ${(el.slideIndex ?? 0) + 1}${el.slideName ? ` (${el.slideName})` : ''} · ${
              el.hasAnimations ? 'Looping Video' : 'Static Frame'
            }`
          : 'Play-All-Slides Video Player'}
      </div>
      <div className="text-[10px] text-white/40 flex items-center gap-1 pt-0.5">
        <Lock className="w-3 h-3 shrink-0" />
        <span>Read-only on slides (edit inside Tactical Board)</span>
      </div>
    </div>

    <input
      type="text"
      value={el.title || ''}
      onChange={(e) => onChange({ title: e.target.value })}
      placeholder="Player Title"
      className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
    />

    <button
      type="button"
      onClick={onOpenBoardImporter}
      className="w-full py-2 px-3 rounded-xl bg-[#c6ff1f]/15 hover:bg-[#c6ff1f]/25 border border-[#c6ff1f]/40 text-xs font-semibold text-[#c6ff1f] flex items-center justify-center gap-2 cursor-pointer"
    >
      <Clapperboard className="w-3.5 h-3.5" />
      <span>Change Board Project / Slide</span>
    </button>

    <div className="space-y-1.5 pt-1">
      {(el.importMode === 'all-slides' || el.hasAnimations) && (
        <>
          <label className="flex items-center gap-2 text-xs text-white/75 cursor-pointer">
            <input
              type="checkbox"
              checked={el.loop !== false}
              onChange={(e) => onChange({ loop: e.target.checked })}
              className="accent-[#c6ff1f]"
            />
            <span>Loop playback continuously</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-white/75 cursor-pointer">
            <input
              type="checkbox"
              checked={el.importMode === 'all-slides' ? el.autoPlay !== false : Boolean(el.autoPlay)}
              onChange={(e) => onChange({ autoPlay: e.target.checked })}
              className="accent-[#c6ff1f]"
            />
            <span>Auto-play when slide opens</span>
          </label>
        </>
      )}
      <label className="flex items-center gap-2 text-xs text-white/75 cursor-pointer">
        <input
          type="checkbox"
          checked={el.showOverlayHud !== false}
          onChange={(e) => onChange({ showOverlayHud: e.target.checked })}
          className="accent-[#c6ff1f]"
        />
        <span>Show board &amp; slide HUD overlay</span>
      </label>
      {el.importMode === 'all-slides' && (
        <label className="flex items-center gap-2 text-xs text-white/75 cursor-pointer">
          <input
            type="checkbox"
            checked={el.showSlideStrip !== false}
            onChange={(e) => onChange({ showSlideStrip: e.target.checked })}
            className="accent-[#c6ff1f]"
          />
          <span>Show slide selector strip</span>
        </label>
      )}
    </div>
  </div>
);

const PlayerCardPropertiesSection: React.FC<{
  el: PlayerCardSlideElement;
  onChange: (patch: Partial<PlayerCardSlideElement>) => void;
}> = ({ el, onChange }) => (
  <div className="space-y-2.5 pt-3 border-t border-white/[0.08]">
    <span className="text-[11px] font-semibold text-white/55 block">Player Profile</span>
    <input
      type="text"
      value={el.playerName}
      onChange={(e) => onChange({ playerName: e.target.value })}
      placeholder="Player Name"
      className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
    />
    <div className="grid grid-cols-3 gap-1.5">
      <input
        type="text"
        value={el.jerseyNumber}
        onChange={(e) => onChange({ jerseyNumber: e.target.value })}
        placeholder="#"
        className="bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1 text-xs font-mono text-white"
      />
      <input
        type="text"
        value={el.position}
        onChange={(e) => onChange({ position: e.target.value })}
        placeholder="Pos"
        className="bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
      />
      <input
        type="text"
        value={el.teamName}
        onChange={(e) => onChange({ teamName: e.target.value })}
        placeholder="Team"
        className="bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
      />
    </div>
  </div>
);

const MatchComparisonPropertiesSection: React.FC<{
  el: MatchComparisonSlideElement;
  onChange: (patch: Partial<MatchComparisonSlideElement>) => void;
}> = ({ el, onChange }) => (
  <div className="space-y-2.5 pt-3 border-t border-white/[0.08]">
    <span className="text-[11px] font-semibold text-white/55 block">Match Scoreline</span>
    <div className="grid grid-cols-[1fr_44px_44px_1fr] gap-1.5">
      <input
        type="text"
        value={el.homeTeam}
        onChange={(e) => onChange({ homeTeam: e.target.value })}
        className="bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-xs text-white"
      />
      <input
        type="text"
        value={el.homeScore || '0'}
        onChange={(e) => onChange({ homeScore: e.target.value })}
        className="bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-xs font-mono text-center text-white"
      />
      <input
        type="text"
        value={el.awayScore || '0'}
        onChange={(e) => onChange({ awayScore: e.target.value })}
        className="bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-xs font-mono text-center text-white"
      />
      <input
        type="text"
        value={el.awayTeam}
        onChange={(e) => onChange({ awayTeam: e.target.value })}
        className="bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-xs text-white"
      />
    </div>
  </div>
);
