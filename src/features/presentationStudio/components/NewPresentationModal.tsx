import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Presentation,
  Sparkles,
  LayoutTemplate,
  FilePlus2,
  Loader2,
  AlertCircle,
  Globe,
  ImagePlus,
  Trash2,
} from 'lucide-react';
import {
  PRESENTATION_TEMPLATES,
  SLIDE_THEMES,
  uid,
} from '../constants/themesAndLayouts';
import type { PresentationProject, ThemeId } from '../types/presentation';
import { createPresentation, savePresentation } from '../storage/presentationRepository';
import { generatePresentationDeckWithAI } from '../engine/aiDesignAssistant';
import {
  fileToReferenceImage,
  getGeminiAIPreferences,
  type GeminiReasoningDepth,
  type GroundingSource,
  type ReferenceImagePayload,
} from '../engine/geminiClient';

interface NewPresentationModalProps {
  isOpen: boolean;
  initialMode?: 'blank' | 'templates' | 'ai';
  onClose: () => void;
  onCreated: (project: PresentationProject) => void;
  onOpenAISettings: () => void;
}

export const NewPresentationModal: React.FC<NewPresentationModalProps> = ({
  isOpen,
  initialMode = 'blank',
  onClose,
  onCreated,
}) => {
  const [mode, setMode] = useState<'blank' | 'templates' | 'ai'>(initialMode);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('match-tactical-review');

  // Gemini AI generation fields
  const [aiTopic, setAiTopic] = useState('');
  const [aiAudience, setAiAudience] = useState('Coaching staff and first-team players');
  const [aiSlideCount, setAiSlideCount] = useState(6);
  const [aiThemeId, setAiThemeId] = useState<ThemeId>('dark-professional');
  const [aiFootballFocus, setAiFootballFocus] = useState(true);
  const [reasoningDepth, setReasoningDepth] = useState<GeminiReasoningDepth>('high');
  const [useSearchGrounding, setUseSearchGrounding] = useState(false);
  const [referenceImages, setReferenceImages] = useState<ReferenceImagePayload[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [liveSources, setLiveSources] = useState<GroundingSource[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setAiError(null);
      setProgressMsg(null);
      setLiveSources([]);
      const prefs = getGeminiAIPreferences();
      setReasoningDepth(prefs.reasoningDepth);
      setUseSearchGrounding(prefs.defaultSearchGrounding);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleAttachImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const encoded = await Promise.all(
        Array.from(files)
          .slice(0, Math.max(0, 3 - referenceImages.length))
          .map((f) => fileToReferenceImage(f))
      );
      setReferenceImages((prev) => [...prev, ...encoded].slice(0, 3));
    } catch (err: any) {
      setAiError(err?.message || 'Failed to read attached reference image.');
    }
  };

  const handleCreateBlankOrTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const tplId = mode === 'blank' ? 'blank' : selectedTemplateId;
    const created = await createPresentation({
      templateId: tplId,
      title: title.trim() || undefined,
      description: description.trim() || undefined,
    });
    onCreated(created);
    setTitle('');
    setDescription('');
    onClose();
  };

  const handleGenerateWithAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiTopic.trim()) return;
    setIsGenerating(true);
    setAiError(null);
    setLiveSources([]);
    setProgressMsg('Connecting to Gemini slide architect...');

    try {
      const deck = await generatePresentationDeckWithAI(
        {
          topic: aiTopic.trim(),
          audience: aiAudience.trim(),
          slideCount: aiSlideCount,
          themeId: aiThemeId,
          footballFocus: aiFootballFocus,
          reasoningDepth,
          useSearchGrounding,
          referenceImages,
        },
        (progress) => {
          if (progress.message) setProgressMsg(progress.message);
          if (progress.sources && progress.sources.length > 0) {
            setLiveSources(progress.sources);
          }
        }
      );

      const slides = [...deck.slides];
      if (deck.sources && deck.sources.length > 0 && slides[0]) {
        const citationBlock =
          '\n\nSources:\n' + deck.sources.map((s) => `• ${s.title}: ${s.uri}`).join('\n');
        slides[0] = {
          ...slides[0],
          speakerNotes: (slides[0].speakerNotes || '') + citationBlock,
        };
      }

      const now = Date.now();
      const newProject: PresentationProject = {
        id: uid('pres'),
        title: deck.title,
        description: deck.description,
        themeId: deck.themeId,
        sections: [{ id: 'sec_main', title: 'Main Deck' }],
        slides,
        createdAt: now,
        updatedAt: now,
        favourite: false,
        aspectRatio: '16:9',
      };
      const saved = await savePresentation(newProject);
      onCreated(saved);
      setAiTopic('');
      setReferenceImages([]);
      setProgressMsg(null);
      onClose();
    } catch (err: any) {
      setAiError(err?.message || 'Failed to generate presentation.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[125] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#12141b] border border-white/15 rounded-2xl shadow-2xl max-w-2xl w-full p-6 text-left flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#c6ff1f]/10 border border-[#c6ff1f]/25 flex items-center justify-center text-[#c6ff1f]">
              <Presentation className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                Create New Presentation
              </h2>
              <p className="text-xs text-white/50 mt-0.5">
                Start blank, pick a template, or architect a full editable deck with Gemini AI
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-3 gap-2 my-4 bg-white/[0.03] p-1 rounded-xl border border-white/10">
          <button
            type="button"
            onClick={() => setMode('blank')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === 'blank' ? 'bg-[#c6ff1f] text-black' : 'text-white/65 hover:text-white'
            }`}
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            <span>Blank Deck</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('templates')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === 'templates' ? 'bg-[#c6ff1f] text-black' : 'text-white/65 hover:text-white'
            }`}
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
            <span>Templates</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('ai')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === 'ai' ? 'bg-[#c6ff1f] text-black' : 'text-white/65 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gemini AI</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4 pb-2">
          {mode !== 'ai' ? (
            <form id="create-pres-form" onSubmit={handleCreateBlankOrTemplate} className="space-y-4">
              {mode === 'templates' && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/75 block">
                    Choose a Starting Template
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {PRESENTATION_TEMPLATES.map((tpl) => {
                      const active = selectedTemplateId === tpl.id;
                      const th = SLIDE_THEMES[tpl.themeId];
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => setSelectedTemplateId(tpl.id)}
                          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                            active
                              ? 'bg-[#c6ff1f]/10 border-[#c6ff1f]/50'
                              : 'bg-white/[0.025] border-white/10 hover:border-white/25'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-xs font-bold text-white">{tpl.name}</span>
                            <span
                              className="w-4 h-4 rounded border border-white/20 shrink-0"
                              style={{ backgroundColor: th.accentColor }}
                            />
                          </div>
                          <p className="text-[11px] text-white/50 leading-relaxed">
                            {tpl.description}
                          </p>
                          <div className="mt-2 text-[10px] font-mono text-white/40">
                            {tpl.category} · {th.name}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-white/75 block mb-1.5">
                  Presentation Title
                </label>
                <input
                  type="text"
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    mode === 'blank'
                      ? 'e.g. Matchday 18 Pre-Match Briefing'
                      : 'Leave blank to use template name'
                  }
                  className="w-full bg-white/[0.04] border border-white/15 focus:border-[#c6ff1f] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-white/75 block mb-1.5">
                  Description <span className="text-white/35 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Match context, opponent notes, or session objectives..."
                  className="w-full bg-white/[0.04] border border-white/15 focus:border-[#c6ff1f] rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none resize-none"
                />
              </div>
            </form>
          ) : (
            <form id="ai-deck-form" onSubmit={handleGenerateWithAI} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-white/75 block mb-1.5">
                  Prompt, Tactical Brief, or Reference URLs <span className="text-[#c6ff1f]">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="e.g. Breaking down a 5-3-2 low block using wide rotations, half-space underlaps, and quick switches of play (paste URLs too if desired)"
                  className="w-full bg-white/[0.04] border border-white/15 focus:border-[#c6ff1f] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none resize-none"
                />
              </div>

              {/* Multimodal Image Attachment */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-white/75">
                    Reference Images <span className="text-white/40 font-normal">(optional · pitch photos, charts, sketches)</span>
                  </label>
                  <button
                    type="button"
                    disabled={referenceImages.length >= 3 || isGenerating}
                    onClick={() => imageInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] disabled:opacity-40 border border-white/10 text-[11px] font-medium text-white cursor-pointer"
                  >
                    <ImagePlus className="w-3.5 h-3.5 text-[#c6ff1f]" />
                    <span>Attach Image ({referenceImages.length}/3)</span>
                  </button>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleAttachImages(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </div>
                {referenceImages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {referenceImages.map((img, i) => (
                      <div
                        key={i}
                        className="relative group w-20 h-14 rounded-lg overflow-hidden border border-white/15 bg-black"
                      >
                        <img
                          src={`data:${img.mimeType};base64,${img.data}`}
                          alt={img.name || 'Reference'}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setReferenceImages((prev) => prev.filter((_, idx) => idx !== i))
                          }
                          className="absolute top-1 right-1 p-1 rounded bg-black/75 text-white/80 hover:text-red-400 cursor-pointer"
                          title="Remove reference image"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-white/75 block mb-1.5">
                    Target Audience
                  </label>
                  <input
                    type="text"
                    value={aiAudience}
                    onChange={(e) => setAiAudience(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/15 focus:border-[#c6ff1f] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-white/75 block mb-1.5">
                    Slide Count
                  </label>
                  <select
                    value={aiSlideCount}
                    onChange={(e) => setAiSlideCount(Number(e.target.value))}
                    className="w-full bg-[#181b24] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    {[4, 5, 6, 8, 10].map((n) => (
                      <option key={n} value={n}>
                        {n} slides
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-white/75 block mb-1.5">
                    Visual Theme
                  </label>
                  <select
                    value={aiThemeId}
                    onChange={(e) => setAiThemeId(e.target.value as ThemeId)}
                    className="w-full bg-[#181b24] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    {Object.values(SLIDE_THEMES).map((th) => (
                      <option key={th.id} value={th.id}>
                        {th.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-white/75 block mb-1.5">
                    Gemini Reasoning Depth
                  </label>
                  <select
                    value={reasoningDepth}
                    onChange={(e) => setReasoningDepth(e.target.value as GeminiReasoningDepth)}
                    className="w-full bg-[#181b24] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="low">Fast (Low Thinking)</option>
                    <option value="medium">Balanced (Medium)</option>
                    <option value="high">Smart Architect (High)</option>
                    <option value="xhigh">Maximum Depth (XHIGH)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                <label className="inline-flex items-center gap-2 text-xs text-white/80 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aiFootballFocus}
                    onChange={(e) => setAiFootballFocus(e.target.checked)}
                    className="accent-[#c6ff1f]"
                  />
                  <span>Football tactical focus (metrics & video playlist slots)</span>
                </label>

                <label className="inline-flex items-center gap-2 text-xs text-white/80 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useSearchGrounding}
                    onChange={(e) => setUseSearchGrounding(e.target.checked)}
                    className="accent-[#c6ff1f]"
                  />
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Ground with Google Search</span>
                </label>
              </div>

              {isGenerating && progressMsg && (
                <div className="p-3 rounded-xl bg-[#c6ff1f]/10 border border-[#c6ff1f]/30 text-xs text-[#dfff80] space-y-1.5">
                  <div className="flex items-center gap-2 font-medium">
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span>{progressMsg}</span>
                  </div>
                  {liveSources.length > 0 && (
                    <div className="text-[10px] text-white/65 truncate">
                      Sources: {liveSources.map((s) => s.title).join(' · ')}
                    </div>
                  )}
                </div>
              )}

              {aiError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{aiError}</span>
                </div>
              )}
            </form>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white/75 text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
          {mode !== 'ai' ? (
            <button
              type="submit"
              form="create-pres-form"
              className="btn-glow px-5 py-2 rounded-xl text-black text-xs font-bold cursor-pointer"
            >
              Create Presentation
            </button>
          ) : (
            <button
              type="submit"
              form="ai-deck-form"
              disabled={isGenerating || !aiTopic.trim()}
              className="btn-glow px-5 py-2 rounded-xl text-black text-xs font-bold flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Architecting Slides...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Deck with Gemini</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
