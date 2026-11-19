import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, Trash2, X, Minus, Plus, Eye, EyeOff } from 'lucide-react';
import {
  CREATOR_FONT_OPTIONS,
  type CreatorWatermarkConfig,
  type CreatorWatermarkFontId,
  type CreatorWatermarkImageShape,
  downscaleImageFileToDataUrl,
  getCreatorWatermarkConfig,
  hasActiveCreatorWatermark,
  saveCreatorWatermarkConfig,
} from '../../utils/creatorWatermarkStore';

interface CreatorWatermarkTopBarButtonProps {
  variant?: 'workspace' | 'board';
}

const COLOR_SWATCHES = [
  { label: 'White Bold', hex: '#ffffff' },
  { label: 'Black Bold', hex: '#000000' },
  { label: 'Tacstem Volt', hex: '#c6ff1f' },
  { label: 'Broadcast Sky', hex: '#38bdf8' },
  { label: 'Amber Gold', hex: '#fbbf24' },
  { label: 'Signal Coral', hex: '#f43f5e' },
];

export const CreatorWatermarkTopBarButton: React.FC<CreatorWatermarkTopBarButtonProps> = ({
  variant = 'workspace',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<CreatorWatermarkConfig>(() => getCreatorWatermarkConfig());
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 42, left: 200 });

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const sync = () => setConfig(getCreatorWatermarkConfig());
    window.addEventListener('tacstem_creator_watermark_updated', sync);
    window.addEventListener('tacstem_user_plan_updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('tacstem_creator_watermark_updated', sync);
      window.removeEventListener('tacstem_user_plan_updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const updateConfig = useCallback((updates: Partial<CreatorWatermarkConfig>) => {
    const next = saveCreatorWatermarkConfig(updates);
    setConfig(next);
  }, []);

  const updatePopoverCoords = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn || typeof window === 'undefined') return;
    const rect = btn.getBoundingClientRect();
    const popoverW = 276;
    const clampedLeft = Math.max(10, Math.min(window.innerWidth - popoverW - 10, rect.right - popoverW / 2));
    const top = Math.max(8, rect.bottom + 6);
    setCoords({ top, left: clampedLeft });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePopoverCoords();
    const focusTimer = window.setTimeout(() => {
      textInputRef.current?.focus();
    }, 30);

    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (
        target &&
        !popoverRef.current?.contains(target) &&
        !buttonRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    window.addEventListener('mousedown', handleOutside);
    window.addEventListener('resize', updatePopoverCoords);
    window.addEventListener('scroll', updatePopoverCoords, true);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('resize', updatePopoverCoords);
      window.removeEventListener('scroll', updatePopoverCoords, true);
    };
  }, [isOpen, updatePopoverCoords]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await downscaleImageFileToDataUrl(file, 256);
      updateConfig({ imageDataUrl: dataUrl, enabled: true });
    } catch (err) {
      console.warn('Creator watermark image upload failed:', err);
    }
  };

  const isActive = hasActiveCreatorWatermark(config);

  const buttonClasses =
    variant === 'board'
      ? `relative w-8 h-8 rounded-lg flex items-center justify-center text-xs font-extrabold border transition-all cursor-pointer shrink-0 ${
          isOpen
            ? 'bg-[#c0fa4a] text-[#080b12] border-[#c0fa4a]'
            : isActive
              ? 'bg-[#1a233a] text-[#c0fa4a] border-[#c0fa4a]/50 hover:bg-[#263351]'
              : 'bg-[#1a233a] text-slate-300 hover:text-white border-[#263351] hover:bg-[#263351]'
        }`
      : `relative w-6 h-6 rounded flex items-center justify-center text-[11.5px] font-extrabold border transition-all cursor-pointer shrink-0 ${
          isOpen
            ? 'bg-[#c6ff1f] text-black border-[#c6ff1f]'
            : isActive
              ? 'bg-[#1a1a1f] text-[#c6ff1f] border-[#c6ff1f]/45 hover:bg-[#24242b]'
              : 'bg-[#1a1a1a] text-gray-300 hover:text-white border-[#333] hover:border-white/30 hover:bg-[#222]'
        }`;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        title={
          isActive
            ? `Customize your watermark (${config.text || 'Image active'})`
            : 'Add your custom @name / watermark (left-bottom)'
        }
        className={buttonClasses}
      >
        <span>@</span>
        {isActive && !isOpen && (
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#c6ff1f]" />
        )}
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 9999,
            }}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
            className="w-[276px] max-h-[calc(100vh-56px)] overflow-y-auto bg-[#121318]/98 backdrop-blur-xl border border-[#2a2d37] rounded-xl shadow-[0_18px_50px_rgba(0,0,0,0.8)] p-3 text-white select-none animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/10">
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-[#c6ff1f]/15 text-[#c6ff1f] border border-[#c6ff1f]/30 flex items-center justify-center text-[10px] font-extrabold">
                  @
                </span>
                <div>
                  <div className="text-xs font-bold tracking-tight text-white leading-none">
                    Your Watermark
                  </div>
                  <div className="text-[9.5px] text-gray-400 mt-0.5 leading-none">
                    Left-bottom of video & exports
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => updateConfig({ enabled: !config.enabled })}
                  title={config.enabled ? 'Hide watermark' : 'Show watermark'}
                  className={`p-1 rounded transition-colors cursor-pointer ${
                    config.enabled
                      ? 'text-[#c6ff1f] bg-[#c6ff1f]/10 hover:bg-[#c6ff1f]/20'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                  }`}
                >
                  {config.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {/* Name / Watermark Text Input */}
              <div>
                <div className="flex items-center justify-between text-[10px] text-gray-400 font-medium mb-1">
                  <span>Watermark / Name</span>
                  {config.text && (
                    <button
                      type="button"
                      onClick={() => updateConfig({ text: '' })}
                      className="text-[10px] text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <input
                  ref={textInputRef}
                  type="text"
                  value={config.text}
                  placeholder="@yourname or Brand Name"
                  onChange={e => updateConfig({ text: e.target.value, enabled: true })}
                  onKeyDown={e => {
                    e.stopPropagation();
                    if (e.key === 'Enter' || e.key === 'Escape') {
                      setIsOpen(false);
                    }
                  }}
                  className="select-text w-full bg-[#1a1c24] border border-[#2d303c] focus:border-[#c6ff1f] rounded-lg px-2.5 py-1.5 text-xs font-bold text-white placeholder:text-gray-500 outline-none transition-colors"
                />
              </div>

              {/* Bold Text Color: White / Black Presets + Swatches + Custom Picker */}
              <div>
                <div className="text-[10px] text-gray-400 font-medium mb-1">
                  Bold Text Color
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => updateConfig({ color: '#ffffff', enabled: true })}
                    className={`px-2 py-1 rounded-md text-[10px] font-extrabold border transition-all cursor-pointer ${
                      config.color.toLowerCase() === '#ffffff'
                        ? 'bg-white text-black border-[#c6ff1f] ring-1 ring-[#c6ff1f]'
                        : 'bg-white/90 text-black border-white/20 hover:bg-white'
                    }`}
                  >
                    White
                  </button>
                  <button
                    type="button"
                    onClick={() => updateConfig({ color: '#000000', enabled: true })}
                    className={`px-2 py-1 rounded-md text-[10px] font-extrabold border transition-all cursor-pointer ${
                      config.color.toLowerCase() === '#000000'
                        ? 'bg-black text-white border-[#c6ff1f] ring-1 ring-[#c6ff1f]'
                        : 'bg-[#090a0d] text-white border-white/25 hover:border-white/50'
                    }`}
                  >
                    Black
                  </button>

                  <div className="flex items-center gap-1 ml-auto">
                    {COLOR_SWATCHES.slice(2).map(s => (
                      <button
                        key={s.hex}
                        type="button"
                        title={s.label}
                        onClick={() => updateConfig({ color: s.hex, enabled: true })}
                        style={{ backgroundColor: s.hex }}
                        className={`w-4 h-4 rounded-full border transition-transform cursor-pointer hover:scale-110 ${
                          config.color.toLowerCase() === s.hex
                            ? 'border-white scale-110 ring-1 ring-white'
                            : 'border-black/40'
                        }`}
                      />
                    ))}
                    <label
                      title="Custom Color"
                      className="relative w-5 h-5 rounded-full overflow-hidden border border-white/25 cursor-pointer shrink-0 flex items-center justify-center bg-gradient-to-tr from-pink-500 via-amber-400 to-cyan-400"
                    >
                      <input
                        type="color"
                        value={config.color || '#ffffff'}
                        onChange={e => updateConfig({ color: e.target.value, enabled: true })}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Size Up / Down */}
              <div>
                <div className="flex items-center justify-between text-[10px] text-gray-400 font-medium mb-1">
                  <span>Size</span>
                  <button
                    type="button"
                    onClick={() => updateConfig({ sizeScale: 1 })}
                    title="Reset to 100%"
                    className="font-mono text-[10px] text-[#c6ff1f] hover:underline cursor-pointer"
                  >
                    {Math.round((config.sizeScale || 1) * 100)}%
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      updateConfig({
                        sizeScale: Math.round(((config.sizeScale || 1) - 0.1) * 100) / 100,
                      })
                    }
                    className="w-6 h-6 rounded-md bg-[#1a1c24] hover:bg-[#252834] border border-[#2d303c] flex items-center justify-center text-gray-300 hover:text-white cursor-pointer"
                    title="Size down"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="range"
                    min="0.6"
                    max="2.2"
                    step="0.05"
                    value={config.sizeScale || 1}
                    onChange={e => updateConfig({ sizeScale: parseFloat(e.target.value) })}
                    className="flex-1 accent-[#c6ff1f] h-1.5 bg-[#1f222c] rounded-lg cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateConfig({
                        sizeScale: Math.round(((config.sizeScale || 1) + 0.1) * 100) / 100,
                      })
                    }
                    className="w-6 h-6 rounded-md bg-[#1a1c24] hover:bg-[#252834] border border-[#2d303c] flex items-center justify-center text-gray-300 hover:text-white cursor-pointer"
                    title="Size up"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Font Selector */}
              <div>
                <div className="text-[10px] text-gray-400 font-medium mb-1">Font</div>
                <div className="grid grid-cols-3 gap-1">
                  {CREATOR_FONT_OPTIONS.map(font => {
                    const active = config.fontId === font.id;
                    return (
                      <button
                        key={font.id}
                        type="button"
                        onClick={() =>
                          updateConfig({ fontId: font.id as CreatorWatermarkFontId, enabled: true })
                        }
                        style={{ fontFamily: font.fontFamily }}
                        className={`creator-wm-custom-font px-1.5 py-1 rounded-md text-[11px] font-bold truncate border transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#c6ff1f]/15 text-[#c6ff1f] border-[#c6ff1f]/60'
                            : 'bg-[#1a1c24] text-gray-300 border-[#2d303c] hover:border-white/25 hover:text-white'
                        }`}
                      >
                        {font.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Nearby Image / Logo */}
              <div className="pt-1 border-t border-white/10">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />

                {!config.imageDataUrl ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-1.5 px-2.5 rounded-lg bg-[#1a1c24] hover:bg-[#232632] border border-dashed border-[#363a48] hover:border-[#c6ff1f]/60 text-[11px] font-semibold text-gray-300 hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ImagePlus className="w-3.5 h-3.5 text-[#c6ff1f]" />
                    <span>Add Nearby Image / Logo</span>
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 bg-[#1a1c24] border border-[#2d303c] rounded-lg p-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={config.imageDataUrl}
                          alt="Watermark icon"
                          className={`w-7 h-7 bg-black/40 shrink-0 ${
                            config.imageShape === 'circle'
                              ? 'rounded-full object-cover'
                              : config.imageShape === 'rounded'
                                ? 'rounded-md object-contain'
                                : 'object-contain'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[10px] font-semibold text-[#c6ff1f] hover:underline truncate cursor-pointer"
                        >
                          Change image
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateConfig({ imageDataUrl: null })}
                        title="Remove image"
                        className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-1 text-[10px]">
                      <div className="flex items-center bg-[#1a1c24] border border-[#2d303c] rounded-md p-0.5">
                        {(['left', 'right'] as const).map(pos => (
                          <button
                            key={pos}
                            type="button"
                            onClick={() => updateConfig({ imagePosition: pos })}
                            className={`px-1.5 py-0.5 rounded capitalize font-semibold cursor-pointer ${
                              (config.imagePosition || 'left') === pos
                                ? 'bg-[#c6ff1f] text-black'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            {pos}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center bg-[#1a1c24] border border-[#2d303c] rounded-md p-0.5">
                        {(
                          [
                            { id: 'original', label: 'Orig' },
                            { id: 'rounded', label: 'Round' },
                            { id: 'circle', label: 'Circle' },
                          ] as { id: CreatorWatermarkImageShape; label: string }[]
                        ).map(sh => (
                          <button
                            key={sh.id}
                            type="button"
                            onClick={() => updateConfig({ imageShape: sh.id })}
                            className={`px-1.5 py-0.5 rounded font-semibold cursor-pointer ${
                              (config.imageShape || 'original') === sh.id
                                ? 'bg-[#c6ff1f] text-black'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            {sh.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
