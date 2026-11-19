import type {
  PresentationProject,
  Slide,
  SlideElement,
  SlideLayoutType,
  ThemeId,
} from '../types/presentation';
import { SLIDE_THEMES } from '../constants/themesAndLayouts';
import {
  callGeminiSlidesApi,
  getGeminiAIPreferences,
  streamGeminiDeckGeneration,
  type GeminiReasoningDepth,
  type GroundingSource,
  type ReferenceImagePayload,
} from './geminiClient';
import {
  parseAIDeckResponse,
  parseAISlideRedesign,
  parseAISlideAlternatives,
  parseAITextRewrite,
  parseAIPresentationAudit,
  parseAISingleElementResponse,
} from './slideParser';

function summarizePresentationContext(presentation: PresentationProject, currentSlideId: string): string {
  return JSON.stringify({
    title: presentation.title,
    description: presentation.description,
    themeId: presentation.themeId,
    totalSlides: presentation.slides.length,
    slidesSummary: presentation.slides.map((s, idx) => ({
      index: idx + 1,
      isCurrent: s.id === currentSlideId,
      title: s.title,
      layout: s.layout,
      elementCount: s.elements.length,
      textSnippets: s.elements
        .filter((e): e is Extract<SlideElement, { type: 'text' }> => e.type === 'text')
        .map((e) => e.content.slice(0, 120)),
    })),
  });
}

function summarizeSlide(slide: Slide): string {
  return JSON.stringify({
    title: slide.title,
    layout: slide.layout,
    speakerNotes: slide.speakerNotes,
    elements: slide.elements.map((el) => {
      if (el.type === 'text') {
        return {
          id: el.id,
          type: el.type,
          role: el.role,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          content: el.content,
        };
      }
      if (el.type === 'video-playlist') {
        return {
          id: el.id,
          type: el.type,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          title: el.title,
          clipCount: el.clips.length,
        };
      }
      if (el.type === 'tactical-board') {
        return {
          id: el.id,
          type: el.type,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          title: el.title,
          boardProjectName: el.boardProjectName,
          importMode: el.importMode,
        };
      }
      if (el.type === 'chart') {
        return { id: el.id, type: el.type, chartKind: el.chartKind, title: el.title, data: el.data };
      }
      if (el.type === 'table') {
        return { id: el.id, type: el.type, headers: el.headers, rows: el.rows };
      }
      return { id: el.id, type: el.type, x: el.x, y: el.y, width: el.width, height: el.height };
    }),
  });
}

function toThemePalette(themeId: ThemeId) {
  const th = SLIDE_THEMES[themeId] || SLIDE_THEMES['dark-professional'];
  return {
    backgroundColor: th.backgroundColor,
    surfaceColor: th.surfaceColor,
    surfaceBorderColor: th.surfaceBorderColor,
    textColor: th.textColor,
    mutedTextColor: th.mutedTextColor,
    accentColor: th.accentColor,
    secondaryColor: th.secondaryColor,
  };
}

export async function generatePresentationDeckWithAI(
  params: {
    topic: string;
    audience?: string;
    slideCount?: number;
    themeId?: ThemeId;
    footballFocus?: boolean;
    reasoningDepth?: GeminiReasoningDepth;
    useSearchGrounding?: boolean;
    referenceImages?: ReferenceImagePayload[];
  },
  onProgress?: (event: { phase: string; message: string; sources?: GroundingSource[] }) => void
): Promise<{
  title: string;
  description: string;
  themeId: ThemeId;
  slides: Slide[];
  sources: GroundingSource[];
}> {
  const prefs = getGeminiAIPreferences();
  const preferredTheme = params.themeId || 'dark-professional';

  const result = await streamGeminiDeckGeneration(
    {
      topic: params.topic,
      audience: params.audience,
      slideCount: params.slideCount,
      themeId: preferredTheme,
      themePalette: toThemePalette(preferredTheme),
      footballFocus: params.footballFocus,
      reasoningDepth: params.reasoningDepth || prefs.reasoningDepth,
      useSearchGrounding: params.useSearchGrounding ?? prefs.defaultSearchGrounding,
      referenceImages: params.referenceImages?.map((img) => ({
        mimeType: img.mimeType,
        data: img.data,
      })),
    },
    onProgress
  );

  const deck = parseAIDeckResponse(result.rawJson);
  return {
    ...deck,
    sources: result.sources || [],
  };
}

export async function redesignSlideWithAI(params: {
  presentation: PresentationProject;
  slide: Slide;
  instruction: string;
  reasoningDepth?: GeminiReasoningDepth;
  useSearchGrounding?: boolean;
  referenceImages?: ReferenceImagePayload[];
}): Promise<{ slide: Slide; rationale?: string; sources: GroundingSource[] }> {
  const prefs = getGeminiAIPreferences();
  const theme = SLIDE_THEMES[params.presentation.themeId] || SLIDE_THEMES['dark-professional'];

  const res = await callGeminiSlidesApi<{ rawJson: string; sources?: GroundingSource[] }>(
    'redesign',
    {
      presentationContext: summarizePresentationContext(params.presentation, params.slide.id),
      currentSlide: summarizeSlide(params.slide),
      instruction: params.instruction,
      themePalette: toThemePalette(theme.id),
      reasoningDepth: params.reasoningDepth || prefs.reasoningDepth,
      useSearchGrounding: params.useSearchGrounding ?? prefs.defaultSearchGrounding,
      referenceImages: params.referenceImages?.map((img) => ({
        mimeType: img.mimeType,
        data: img.data,
      })),
    }
  );

  const hydrated = parseAISlideRedesign(res.rawJson, theme);
  return {
    ...hydrated,
    sources: res.sources || [],
  };
}

export async function generateSlideAlternativesWithAI(params: {
  presentation: PresentationProject;
  slide: Slide;
  reasoningDepth?: GeminiReasoningDepth;
}): Promise<{ summary: string; alternatives: Array<{ slide: Slide; rationale?: string }> }> {
  const prefs = getGeminiAIPreferences();
  const theme = SLIDE_THEMES[params.presentation.themeId] || SLIDE_THEMES['dark-professional'];

  const res = await callGeminiSlidesApi<{ rawJson: string }>('alternatives', {
    currentSlide: summarizeSlide(params.slide),
    themePalette: toThemePalette(theme.id),
    reasoningDepth: params.reasoningDepth || prefs.reasoningDepth,
  });

  return parseAISlideAlternatives(res.rawJson, theme);
}

export async function rewriteTextElementWithAI(params: {
  presentation: PresentationProject;
  slide: Slide;
  elementText: string;
  action:
    | 'rewrite'
    | 'shorten'
    | 'expand'
    | 'simplify'
    | 'better-heading'
    | 'coaching-tone'
    | 'executive-tone'
    | 'custom';
  customInstruction?: string;
}): Promise<{ rewrittenText: string; rationale?: string }> {
  const actionDesc: Record<typeof params.action, string> = {
    rewrite: 'Rewrite for clarity, impact, and concise slide readability.',
    shorten: 'Shorten significantly while preserving the core insight.',
    expand: 'Expand with clear tactical or analytical detail suitable for this slide.',
    simplify: 'Simplify into crisp, plain-language bullets or phrasing.',
    'better-heading': 'Write a sharper, memorable slide heading.',
    'coaching-tone': 'Adapt into direct, actionable football coaching language.',
    'executive-tone': 'Adapt into crisp executive / sporting director briefing language.',
    custom: params.customInstruction || 'Improve this text.',
  };

  const res = await callGeminiSlidesApi<{ rawJson: string }>('rewrite', {
    deckTitle: params.presentation.title,
    slideTitle: params.slide.title,
    elementText: params.elementText,
    actionInstruction: actionDesc[params.action],
    customInstruction: params.customInstruction,
  });

  return parseAITextRewrite(res.rawJson);
}

export async function auditPresentationWithAI(params: {
  presentation: PresentationProject;
  instruction?: string;
  reasoningDepth?: GeminiReasoningDepth;
}): Promise<{
  summary: string;
  suggestedThemeId?: ThemeId;
  findings: Array<{ slideIndex?: number; severity: 'info' | 'warning'; title: string; recommendation: string }>;
  suggestedSlides?: Array<{ title: string; purpose: string; layout: SlideLayoutType }>;
}> {
  const prefs = getGeminiAIPreferences();
  const currentSlideId = params.presentation.slides[0]?.id || '';

  const res = await callGeminiSlidesApi<{ rawJson: string }>('audit', {
    presentationContext: summarizePresentationContext(params.presentation, currentSlideId),
    instruction: params.instruction,
    reasoningDepth: params.reasoningDepth || prefs.reasoningDepth,
  });

  return parseAIPresentationAudit(res.rawJson);
}

export async function generateSingleElementWithAI(params: {
  presentation: PresentationProject;
  slide: Slide;
  instruction: string;
  reasoningDepth?: GeminiReasoningDepth;
  referenceImages?: ReferenceImagePayload[];
}): Promise<{ element: SlideElement; rationale?: string }> {
  const prefs = getGeminiAIPreferences();
  const theme = SLIDE_THEMES[params.presentation.themeId] || SLIDE_THEMES['dark-professional'];
  const maxZ = params.slide.elements.reduce((m, e) => Math.max(m, e.zIndex), 1);

  const res = await callGeminiSlidesApi<{ rawJson: string }>('generate-element', {
    slideContext: summarizeSlide(params.slide),
    instruction: params.instruction,
    themePalette: toThemePalette(theme.id),
    reasoningDepth: params.reasoningDepth || prefs.reasoningDepth,
    referenceImages: params.referenceImages?.map((img) => ({
      mimeType: img.mimeType,
      data: img.data,
    })),
  });

  return parseAISingleElementResponse(res.rawJson, theme, maxZ + 1);
}
