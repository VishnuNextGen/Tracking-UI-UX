import React, { useRef, useState } from 'react';
import {
  Sparkles,
  X,
  SlidersHorizontal,
  Loader2,
  Check,
  AlertCircle,
  Wand2,
  LayoutGrid,
  PlusCircle,
  Globe,
  ImagePlus,
  Trash2,
  ExternalLink,
  Layers,
} from 'lucide-react';
import type {
  PresentationProject,
  Slide,
  SlideElement,
  SlideLayoutType,
  TextSlideElement,
  ThemeId,
} from '../types/presentation';
import { SLIDE_THEMES, createSlideFromLayout } from '../constants/themesAndLayouts';
import {
  fileToReferenceImage,
  getGeminiAIPreferences,
  type GroundingSource,
  type ReferenceImagePayload,
} from '../engine/geminiClient';
import {
  auditPresentationWithAI,
  generateSingleElementWithAI,
  generateSlideAlternativesWithAI,
  redesignSlideWithAI,
  rewriteTextElementWithAI,
} from '../engine/aiDesignAssistant';
import { SlideRenderer } from '../renderer/SlideRenderer';

interface AIChatPanelProps {
  presentation: PresentationProject;
  activeSlide: Slide;
  selectedElements: SlideElement[];
  onClose: () => void;
  onOpenAISettings: () => void;
  onApplyProposedSlide: (nextSlide: Slide) => void;
  onInsertSuggestedSlide: (slide: Slide) => void;
  onInsertGeneratedElement: (element: SlideElement) => void;
  onUpdateElementText: (elementId: string, text: string) => void;
  onChangeTheme: (themeId: ThemeId) => void;
}

type ProposalState =
  | {
      kind: 'redesign';
      proposedSlide: Slide;
      rationale?: string;
      sources?: GroundingSource[];
    }
  | {
      kind: 'alternatives';
      summary: string;
      alternatives: Array<{ slide: Slide; rationale?: string }>;
    }
  | {
      kind: 'element-create';
      element: SlideElement;
      rationale?: string;
    }
  | {
      kind: 'text-rewrite';
      elementId: string;
      originalText: string;
      rewrittenText: string;
      rationale?: string;
    }
  | {
      kind: 'deck-audit';
      summary: string;
      suggestedThemeId?: ThemeId;
      findings: Array<{ slideIndex?: number; severity: 'info' | 'warning'; title: string; recommendation: string }>;
      suggestedSlides?: Array<{ title: string; purpose: string; layout: SlideLayoutType }>;
    };

export const AIChatPanel: React.FC<AIChatPanelProps> = ({
  presentation,
  activeSlide,
  selectedElements,
  onClose,
  onOpenAISettings,
  onApplyProposedSlide,
  onInsertSuggestedSlide,
  onInsertGeneratedElement,
  onUpdateElementText,
  onChangeTheme,
}) => {
  const selectedTextEl =
    selectedElements.length === 1 && selectedElements[0].type === 'text'
      ? (selectedElements[0] as TextSlideElement)
      : null;

  const [scope, setScope] = useState<'element' | 'slide' | 'deck'>(
    selectedTextEl ? 'element' : 'slide'
  );
  const [prompt, setPrompt] = useState('');
  const [useSearchGrounding, setUseSearchGrounding] = useState(
    () => getGeminiAIPreferences().defaultSearchGrounding
  );
  const [referenceImages, setReferenceImages] = useState<ReferenceImagePayload[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ProposalState | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleAttachImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const encoded = await Promise.all(
        Array.from(files)
          .slice(0, Math.max(0, 2 - referenceImages.length))
          .map((f) => fileToReferenceImage(f))
      );
      setReferenceImages((prev) => [...prev, ...encoded].slice(0, 2));
    } catch (err: any) {
      setError(err?.message || 'Failed to read attached image.');
    }
  };

  const runSlideRedesign = async (instruction: string) => {
    setIsLoading(true);
    setError(null);
    setProposal(null);
    try {
      const res = await redesignSlideWithAI({
        presentation,
        slide: activeSlide,
        instruction,
        useSearchGrounding,
        referenceImages,
      });
      setProposal({
        kind: 'redesign',
        proposedSlide: res.slide,
        rationale: res.rationale,
        sources: res.sources,
      });
    } catch (err: any) {
      setError(err?.message || 'Gemini slide redesign failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const runThreeAlternatives = async () => {
    setIsLoading(true);
    setError(null);
    setProposal(null);
    try {
      const res = await generateSlideAlternativesWithAI({
        presentation,
        slide: activeSlide,
      });
      setProposal({
        kind: 'alternatives',
        summary: res.summary,
        alternatives: res.alternatives,
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to generate layout alternatives.');
    } finally {
      setIsLoading(false);
    }
  };

  const runGenerateElement = async (instruction: string) => {
    setIsLoading(true);
    setError(null);
    setProposal(null);
    try {
      const res = await generateSingleElementWithAI({
        presentation,
        slide: activeSlide,
        instruction,
        referenceImages,
      });
      setProposal({
        kind: 'element-create',
        element: res.element,
        rationale: res.rationale,
      });
    } catch (err: any) {
      setError(err?.message || 'Gemini element builder failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const runTextAction = async (
    action: 'rewrite' | 'shorten' | 'expand' | 'simplify' | 'better-heading' | 'coaching-tone' | 'custom',
    customInstruction?: string
  ) => {
    if (!selectedTextEl) return;
    setIsLoading(true);
    setError(null);
    setProposal(null);
    try {
      const res = await rewriteTextElementWithAI({
        presentation,
        slide: activeSlide,
        elementText: selectedTextEl.content,
        action,
        customInstruction,
      });
      setProposal({
        kind: 'text-rewrite',
        elementId: selectedTextEl.id,
        originalText: selectedTextEl.content,
        rewrittenText: res.rewrittenText,
        rationale: res.rationale,
      });
    } catch (err: any) {
      setError(err?.message || 'Text assistance failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const runDeckAudit = async (instruction?: string) => {
    setIsLoading(true);
    setError(null);
    setProposal(null);
    try {
      const res = await auditPresentationWithAI({ presentation, instruction });
      setProposal({ kind: 'deck-audit', ...res });
    } catch (err: any) {
      setError(err?.message || 'Deck audit failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    if (scope === 'element') {
      if (selectedTextEl) {
        runTextAction('custom', prompt.trim());
      } else {
        runGenerateElement(prompt.trim());
      }
    } else if (scope === 'deck') {
      runDeckAudit(prompt.trim());
    } else {
      runSlideRedesign(prompt.trim());
    }
  };

  return (
    <aside className="w-80 xl:w-96 shrink-0 bg-[#101219] border-l border-white/[0.08] flex flex-col h-full select-none">
      <div className="p-3 border-b border-white/[0.08] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#c6ff1f]" />
          <span className="text-xs font-bold text-white">Gemini Slide Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenAISettings}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/55 hover:text-white cursor-pointer"
            title="Gemini Reasoning & Grounding Preferences"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/55 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scope Tabs */}
      <div className="p-2 border-b border-white/[0.06] grid grid-cols-3 gap-1">
        {(
          [
            { id: 'element', label: selectedTextEl ? 'Text Edit' : 'Add Element' },
            { id: 'slide', label: 'Current Slide' },
            { id: 'deck', label: 'Full Deck' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setScope(t.id)}
            className={`py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
              scope === t.id
                ? 'bg-[#c6ff1f] text-black'
                : 'bg-white/[0.04] text-white/65 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 scrollbar-panel">
        {/* Contextual Quick Actions */}
        {scope === 'element' && (
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-white/50 block">
              {selectedTextEl
                ? `Selected Text: "${selectedTextEl.content.slice(0, 42)}${selectedTextEl.content.length > 42 ? '...' : ''}"`
                : 'Generate a custom element with Gemini, or select text to rewrite:'}
            </span>
            {selectedTextEl ? (
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'rewrite', label: 'Rewrite' },
                    { id: 'shorten', label: 'Shorten' },
                    { id: 'expand', label: 'Expand' },
                    { id: 'simplify', label: 'Simplify' },
                    { id: 'better-heading', label: 'Better Heading' },
                    { id: 'coaching-tone', label: 'Coaching Tone' },
                  ] as const
                ).map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    disabled={isLoading}
                    onClick={() => runTextAction(act.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] disabled:opacity-40 border border-white/10 text-[11px] text-white/85 cursor-pointer"
                  >
                    {act.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Video playlist clip reel slot for high-press traps',
                  'Donut chart of attacking zone entries',
                  'Player scouting KPI profile card',
                  '4-step transition workflow SVG diagram',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={isLoading}
                    onClick={() => runGenerateElement(preset)}
                    className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] disabled:opacity-40 border border-white/10 text-[11px] text-white/85 text-left cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {scope === 'slide' && (
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-white/50 block">
              Slide Design Proposals (Preview before applying)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Make this slide more professional',
                'Reduce text and improve readability',
                'Convert bullets into a comparison',
                'Create a process diagram',
                'Change to a minimalist design',
                'Improve visual hierarchy',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={isLoading}
                  onClick={() => runSlideRedesign(preset)}
                  className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] disabled:opacity-40 border border-white/10 text-[11px] text-white/85 text-left cursor-pointer"
                >
                  {preset}
                </button>
              ))}
              <button
                type="button"
                disabled={isLoading}
                onClick={runThreeAlternatives}
                className="w-full py-2 px-3 rounded-xl bg-[#c6ff1f]/10 hover:bg-[#c6ff1f]/20 disabled:opacity-40 border border-[#c6ff1f]/30 text-xs font-semibold text-[#c6ff1f] flex items-center justify-center gap-2 cursor-pointer mt-1"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Give Me 3 Layout Alternatives</span>
              </button>
            </div>
          </div>
        )}

        {scope === 'deck' && (
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-white/50 block">
              Presentation-Level Intelligence
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={isLoading}
                onClick={() =>
                  runDeckAudit('Identify overcrowded or repetitive slides and improve narrative flow')
                }
                className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] disabled:opacity-40 border border-white/10 text-[11px] text-white/85 cursor-pointer"
              >
                Audit Flow &amp; Overcrowding
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={() =>
                  runDeckAudit('Suggest 2-3 additional tactical slides and the best visual theme')
                }
                className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] disabled:opacity-40 border border-white/10 text-[11px] text-white/85 cursor-pointer"
              >
                Suggest Additional Slides &amp; Theme
              </button>
            </div>
          </div>
        )}

        {/* Loading / Error */}
        {isLoading && (
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex items-center gap-3 text-xs text-white/80">
            <Loader2 className="w-4 h-4 animate-spin text-[#c6ff1f] shrink-0" />
            <span>Designing structured proposal with Gemini...</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Proposal Preview / Apply / Reject */}
        {proposal?.kind === 'redesign' && (
          <div className="p-3 rounded-xl bg-white/[0.03] border border-[#c6ff1f]/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#c6ff1f] uppercase tracking-wider">
                Proposed Slide Redesign
              </span>
              <span className="text-[10px] font-mono text-white/50">
                {proposal.proposedSlide.layout}
              </span>
            </div>
            <div className="w-full aspect-video rounded-lg overflow-hidden border border-white/15 bg-black flex items-center justify-center pointer-events-none">
              <SlideRenderer slide={proposal.proposedSlide} scale={0.145} />
            </div>
            {proposal.rationale && (
              <p className="text-[11px] text-white/70 leading-relaxed">{proposal.rationale}</p>
            )}
            {proposal.sources && proposal.sources.length > 0 && (
              <div className="pt-2 border-t border-white/10 space-y-1">
                <span className="text-[10px] font-semibold text-white/45 uppercase tracking-wider block">
                  Web Grounding Sources
                </span>
                {proposal.sources.map((src, i) => (
                  <a
                    key={i}
                    href={src.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[11px] text-[#c6ff1f]/85 hover:text-[#c6ff1f] truncate"
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    <span className="truncate">{src.title}</span>
                  </a>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onApplyProposedSlide(proposal.proposedSlide);
                  setProposal(null);
                }}
                className="flex-1 py-1.5 rounded-lg bg-[#c6ff1f] hover:bg-[#d4ff4d] text-black font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" /> Apply Redesign
              </button>
              <button
                type="button"
                onClick={() => setProposal(null)}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/80 text-xs cursor-pointer"
              >
                Reject
              </button>
            </div>
          </div>
        )}

        {proposal?.kind === 'element-create' && (
          <div className="p-3 rounded-xl bg-white/[0.03] border border-[#c6ff1f]/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#c6ff1f] uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Generated Element
              </span>
              <span className="text-[10px] font-mono text-white/50">
                {proposal.element.type}
              </span>
            </div>
            {proposal.rationale && (
              <p className="text-[11px] text-white/70 leading-relaxed">{proposal.rationale}</p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onInsertGeneratedElement(proposal.element);
                  setProposal(null);
                }}
                className="flex-1 py-1.5 rounded-lg bg-[#c6ff1f] hover:bg-[#d4ff4d] text-black font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Insert onto Slide
              </button>
              <button
                type="button"
                onClick={() => setProposal(null)}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/80 text-xs cursor-pointer"
              >
                Reject
              </button>
            </div>
          </div>
        )}

        {proposal?.kind === 'alternatives' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#c6ff1f] uppercase tracking-wider">
                3 Layout Alternatives
              </span>
              <button
                type="button"
                onClick={() => setProposal(null)}
                className="text-[11px] text-white/50 hover:text-white cursor-pointer"
              >
                Dismiss
              </button>
            </div>
            {proposal.alternatives.map((alt, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-white/[0.03] border border-white/15 space-y-2"
              >
                <div className="flex items-center justify-between text-[11px] text-white/80 font-semibold">
                  <span>
                    Option {idx + 1}: {alt.slide.layout}
                  </span>
                </div>
                <div className="w-full aspect-video rounded-lg overflow-hidden border border-white/10 bg-black flex items-center justify-center pointer-events-none">
                  <SlideRenderer slide={alt.slide} scale={0.14} />
                </div>
                {alt.rationale && (
                  <p className="text-[11px] text-white/60 leading-relaxed">{alt.rationale}</p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onApplyProposedSlide(alt.slide);
                    setProposal(null);
                  }}
                  className="w-full py-1.5 rounded-lg bg-[#c6ff1f] hover:bg-[#d4ff4d] text-black font-bold text-xs cursor-pointer"
                >
                  Apply Option {idx + 1}
                </button>
              </div>
            ))}
          </div>
        )}

        {proposal?.kind === 'text-rewrite' && (
          <div className="p-3 rounded-xl bg-white/[0.03] border border-[#c6ff1f]/40 space-y-3">
            <span className="text-[11px] font-bold text-[#c6ff1f] uppercase tracking-wider block">
              Suggested Text Revision
            </span>
            <div className="p-2.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white whitespace-pre-wrap leading-relaxed select-text">
              {proposal.rewrittenText}
            </div>
            {proposal.rationale && (
              <p className="text-[11px] text-white/65">{proposal.rationale}</p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onUpdateElementText(proposal.elementId, proposal.rewrittenText);
                  setProposal(null);
                }}
                className="flex-1 py-1.5 rounded-lg bg-[#c6ff1f] text-black font-bold text-xs cursor-pointer"
              >
                Apply Text
              </button>
              <button
                type="button"
                onClick={() => setProposal(null)}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-white/80 text-xs cursor-pointer"
              >
                Reject
              </button>
            </div>
          </div>
        )}

        {proposal?.kind === 'deck-audit' && (
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/15 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#c6ff1f] uppercase tracking-wider">
                Presentation Audit
              </span>
              <button
                type="button"
                onClick={() => setProposal(null)}
                className="text-[11px] text-white/50 hover:text-white cursor-pointer"
              >
                Close
              </button>
            </div>
            <p className="text-xs text-white/80 leading-relaxed">{proposal.summary}</p>

            {proposal.suggestedThemeId && proposal.suggestedThemeId !== presentation.themeId && (
              <button
                type="button"
                onClick={() => onChangeTheme(proposal.suggestedThemeId!)}
                className="w-full py-1.5 px-3 rounded-lg bg-[#c6ff1f]/15 hover:bg-[#c6ff1f]/25 border border-[#c6ff1f]/35 text-[#c6ff1f] text-xs font-semibold cursor-pointer"
              >
                Apply Suggested Theme: {SLIDE_THEMES[proposal.suggestedThemeId]?.name}
              </button>
            )}

            <div className="space-y-2">
              {proposal.findings.map((f, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg bg-black/30 border border-white/10 text-[11px] space-y-1"
                >
                  <div className="font-semibold text-white">
                    {f.slideIndex ? `Slide ${f.slideIndex} · ` : ''}
                    {f.title}
                  </div>
                  <p className="text-white/65 leading-relaxed">{f.recommendation}</p>
                </div>
              ))}
            </div>

            {proposal.suggestedSlides && proposal.suggestedSlides.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-white/10">
                <span className="text-[11px] font-semibold text-white/60 block">
                  Suggested Slides to Add
                </span>
                {proposal.suggestedSlides.map((s, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-lg bg-black/30 border border-white/10 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{s.title}</div>
                      <div className="text-[10px] text-white/50 truncate">{s.purpose}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const th =
                          SLIDE_THEMES[presentation.themeId] || SLIDE_THEMES['dark-professional'];
                        const built = createSlideFromLayout(s.layout, th, {
                          title: s.title,
                          heading: s.title,
                          subheading: s.purpose,
                        });
                        onInsertSuggestedSlide(built);
                      }}
                      className="p-1.5 rounded-lg bg-[#c6ff1f] text-black shrink-0 cursor-pointer"
                      title="Insert slide into deck"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom Prompt Form with Multimodal Reference Image & Search Grounding */}
      <form
        onSubmit={handleSubmitPrompt}
        className="p-3 border-t border-white/[0.08] bg-[#0b0d12] space-y-2"
      >
        {referenceImages.length > 0 && (
          <div className="flex items-center gap-1.5">
            {referenceImages.map((img, i) => (
              <div
                key={i}
                className="relative w-14 h-10 rounded-md overflow-hidden border border-white/15 bg-black"
              >
                <img
                  src={`data:${img.mimeType};base64,${img.data}`}
                  alt={img.name || 'Ref'}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() =>
                    setReferenceImages((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/80 text-white hover:text-red-400 cursor-pointer"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          rows={2}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            scope === 'element'
              ? selectedTextEl
                ? 'Ask Gemini to rewrite or adjust selected text...'
                : 'Describe a chart, tactical pitch, table, or diagram to create...'
              : scope === 'deck'
              ? 'Ask Gemini to review deck flow, audience, or structure...'
              : 'e.g. Redesign this slide to explain a high defensive line...'
          }
          className="w-full bg-white/[0.04] border border-white/15 focus:border-[#c6ff1f] rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/35 focus:outline-none resize-none"
        />

        <div className="flex items-center justify-between gap-2 text-[11px] text-white/65">
          <div className="flex items-center gap-2">
            {scope !== 'deck' && (
              <>
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={referenceImages.length >= 2 || isLoading}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.09] disabled:opacity-40 border border-white/10 text-white/75 cursor-pointer"
                  title="Attach a reference image for Gemini to analyze"
                >
                  <ImagePlus className="w-3 h-3 text-[#c6ff1f]" />
                  <span>Image</span>
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
              </>
            )}

            {scope === 'slide' && (
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useSearchGrounding}
                  onChange={(e) => setUseSearchGrounding(e.target.checked)}
                  className="accent-[#c6ff1f]"
                />
                <Globe className="w-3 h-3 text-emerald-400" />
                <span>Search</span>
              </label>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !prompt.trim()}
          className="w-full py-2 rounded-xl bg-[#c6ff1f] hover:bg-[#d4ff4d] disabled:opacity-40 text-black font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Wand2 className="w-3.5 h-3.5" />
          <span>Generate Proposal</span>
        </button>
      </form>
    </aside>
  );
};
