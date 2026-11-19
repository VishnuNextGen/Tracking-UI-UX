import type { Slide, SlideElement, SlideTheme } from '../types/presentation';
import {
  SLIDE_THEMES,
  uid,
} from '../constants/themesAndLayouts';
import {
  AISlideSchema,
  AIDeckResponseSchema,
  AISlideAlternativesSchema,
  AITextRewriteSchema,
  AIPresentationAuditSchema,
  AISingleElementSchema,
} from './slideValidator';
import { z } from 'zod';

export function extractJsonFromModelOutput(raw: string): any {
  const trimmed = raw.trim();
  // 1. Direct JSON
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }
  // 2. Markdown code block ```json ... ```
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // continue
    }
  }
  // 3. First { ... } or [ ... ]
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const slice = trimmed.slice(firstBrace, lastBrace + 1);
    return JSON.parse(slice);
  }
  throw new Error('Could not extract valid JSON structure from AI response.');
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
}

function normalizeFontWeight(
  rawWeight: number | undefined,
  fallback: 300 | 400 | 500 | 600 | 700 | 800
): 300 | 400 | 500 | 600 | 700 | 800 {
  if (!rawWeight || !Number.isFinite(rawWeight)) return fallback;
  const choices: Array<300 | 400 | 500 | 600 | 700 | 800> = [300, 400, 500, 600, 700, 800];
  return choices.reduce((best, cur) =>
    Math.abs(cur - rawWeight) < Math.abs(best - rawWeight) ? cur : best
  );
}

export function hydrateAIElement(
  raw: z.infer<typeof AISlideSchema>['elements'][number],
  theme: SlideTheme,
  zIndex: number
): SlideElement {
  const x = clamp(raw.x, 0, 1880);
  const y = clamp(raw.y, 0, 1050);
  const width = clamp(raw.width, 24, 1920 - x);
  const height = clamp(raw.height, 12, 1080 - y);

  switch (raw.type) {
    case 'text':
      return {
        id: uid('txt'),
        type: 'text',
        x,
        y,
        width,
        height,
        zIndex,
        rotation: raw.rotation || 0,
        opacity: raw.opacity ?? 1,
        role: raw.role || 'body',
        content: raw.content || 'Text content',
        fontFamily:
          raw.role === 'heading' || raw.role === 'subheading' || raw.role === 'quote'
            ? theme.headingFont
            : raw.role === 'kicker' || raw.role === 'stat-value'
            ? theme.monoFont
            : theme.bodyFont,
        fontSize: raw.fontSize || (raw.role === 'heading' ? 56 : raw.role === 'subheading' ? 32 : 24),
        fontWeight: normalizeFontWeight(raw.fontWeight, raw.role === 'heading' ? 700 : 400),
        italic: raw.italic || false,
        textAlign: raw.textAlign || 'left',
        lineHeight: raw.lineHeight || 1.35,
        letterSpacing: raw.role === 'kicker' ? 0.1 : 0,
        color:
          raw.color ||
          (raw.role === 'kicker' || raw.role === 'stat-value' ? theme.accentColor : theme.textColor),
        backgroundColor: raw.backgroundColor,
      };

    case 'shape':
      return {
        id: uid('shp'),
        type: 'shape',
        shapeKind: raw.shapeKind || 'rectangle',
        x,
        y,
        width,
        height,
        zIndex,
        rotation: raw.rotation || 0,
        opacity: raw.opacity ?? 1,
        fillColor: raw.fillColor || theme.surfaceColor,
        strokeColor: raw.strokeColor || theme.surfaceBorderColor,
        strokeWidth: raw.strokeWidth ?? 2,
        borderRadius: raw.borderRadius ?? 18,
        arrowEnd: raw.shapeKind === 'arrow' ? true : undefined,
      };

    case 'icon':
      return {
        id: uid('icn'),
        type: 'icon',
        x,
        y,
        width,
        height,
        zIndex,
        iconName: raw.iconName || 'Target',
        color: raw.color || theme.accentColor,
        backgroundColor: raw.backgroundColor || theme.surfaceColor,
        borderRadius: raw.borderRadius ?? 16,
        padding: 16,
      };

    case 'chart':
      return {
        id: uid('cht'),
        type: 'chart',
        chartKind: raw.chartKind || 'bar',
        x,
        y,
        width,
        height,
        zIndex,
        title: raw.title || 'Performance Metrics',
        data:
          raw.data && raw.data.length > 0
            ? raw.data
            : [
                { label: 'Zone A', value: 45 },
                { label: 'Zone B', value: 72 },
                { label: 'Zone C', value: 58 },
              ],
        textColor: theme.textColor,
        accentColor: theme.accentColor,
        secondaryColor: theme.secondaryColor,
        backgroundColor: theme.surfaceColor,
        borderColor: theme.surfaceBorderColor,
        showGrid: true,
        showValues: true,
      };

    case 'table':
      return {
        id: uid('tbl'),
        type: 'table',
        x,
        y,
        width,
        height,
        zIndex,
        headers: raw.headers && raw.headers.length > 0 ? raw.headers : ['Metric', 'Value', 'Target'],
        rows:
          raw.rows && raw.rows.length > 0
            ? raw.rows
            : [
                ['PPDA', '8.4', '< 9.5'],
                ['Field Tilt', '61%', '> 55%'],
              ],
        headerBg: theme.accentColor,
        headerColor: theme.accentContrastColor,
        cellBg: theme.surfaceColor,
        cellColor: theme.textColor,
        borderColor: theme.surfaceBorderColor,
        fontSize: 22,
      };

    case 'svg-diagram':
      return {
        id: uid('diag'),
        type: 'svg-diagram',
        x,
        y,
        width,
        height,
        zIndex,
        title: raw.title || 'Tactical Flow',
        diagramStyle: raw.diagramStyle || 'flow',
        nodes:
          raw.nodes && raw.nodes.length > 0
            ? raw.nodes
            : [
                { id: 'n1', label: 'Trigger', x: 20, y: 50 },
                { id: 'n2', label: 'Press', x: 50, y: 50 },
                { id: 'n3', label: 'Transition', x: 80, y: 50 },
              ],
        edges: raw.edges || [
          { from: 'n1', to: 'n2' },
          { from: 'n2', to: 'n3' },
        ],
        accentColor: theme.accentColor,
        textColor: theme.textColor,
        surfaceColor: theme.surfaceColor,
      };

    case 'video-playlist':
      return {
        id: uid('vpl'),
        type: 'video-playlist',
        x,
        y,
        width,
        height,
        zIndex,
        title: raw.title || 'Match Video Playlist',
        clips: [],
        loop: true,
        muted: false,
        showOverlayHud: true,
        showClipStrip: true,
        accentColor: theme.accentColor,
        backgroundColor: theme.surfaceColor,
        borderRadius: raw.borderRadius ?? 20,
      };

    case 'player-card':
      return {
        id: uid('pcard'),
        type: 'player-card',
        x,
        y,
        width,
        height,
        zIndex,
        playerName: raw.playerName || 'Player Profile',
        jerseyNumber: raw.jerseyNumber || '10',
        position: raw.position || 'CAM',
        teamName: raw.teamName || 'First Team',
        accentColor: theme.accentColor,
        backgroundColor: theme.surfaceColor,
        textColor: theme.textColor,
        stats: raw.stats || [
          { label: 'xG/90', value: '0.42' },
          { label: 'Prog. Passes', value: '8.4' },
        ],
      };

    case 'match-comparison':
      return {
        id: uid('mcmp'),
        type: 'match-comparison',
        x,
        y,
        width,
        height,
        zIndex,
        title: raw.title || 'Match Comparison',
        homeTeam: raw.homeTeam || 'Home',
        awayTeam: raw.awayTeam || 'Away',
        homeScore: raw.homeScore || '2',
        awayScore: raw.awayScore || '1',
        homeColor: theme.accentColor,
        awayColor: theme.secondaryColor,
        backgroundColor: theme.surfaceColor,
        textColor: theme.textColor,
        metrics: raw.metrics || [
          { label: 'Possession', homeValue: 58, awayValue: 42, unit: '%' },
          { label: 'Shots on Target', homeValue: 7, awayValue: 3 },
        ],
      };
  }
}

export function hydrateAISlide(
  raw: z.infer<typeof AISlideSchema>,
  theme: SlideTheme
): { slide: Slide; rationale?: string } {
  const slide: Slide = {
    id: uid('slide'),
    title: raw.title || 'AI Proposed Slide',
    layout: raw.layout || 'two-column',
    background: { type: 'solid', color: theme.backgroundColor },
    transition: 'fade',
    speakerNotes: raw.speakerNotes || '',
    elements: raw.elements.map((el, idx) => hydrateAIElement(el, theme, idx + 1)),
  };
  return { slide, rationale: raw.rationale };
}

export function parseAIDeckResponse(rawOutput: string) {
  const json = extractJsonFromModelOutput(rawOutput);
  const parsed = AIDeckResponseSchema.parse(json);
  const theme = SLIDE_THEMES[parsed.themeId || 'dark-professional'] || SLIDE_THEMES['dark-professional'];
  return {
    title: parsed.title,
    description: parsed.description || '',
    themeId: theme.id,
    slides: parsed.slides.map((s) => hydrateAISlide(s, theme).slide),
  };
}

export function parseAISlideRedesign(rawOutput: string, theme: SlideTheme) {
  const json = extractJsonFromModelOutput(rawOutput);
  const parsed = AISlideSchema.parse(json);
  return hydrateAISlide(parsed, theme);
}

export function parseAISlideAlternatives(rawOutput: string, theme: SlideTheme) {
  const json = extractJsonFromModelOutput(rawOutput);
  const parsed = AISlideAlternativesSchema.parse(json);
  return {
    summary: parsed.summary || 'Three alternative slide layouts generated.',
    alternatives: parsed.alternatives.map((s) => hydrateAISlide(s, theme)),
  };
}

export function parseAITextRewrite(rawOutput: string) {
  const json = extractJsonFromModelOutput(rawOutput);
  return AITextRewriteSchema.parse(json);
}

export function parseAIPresentationAudit(rawOutput: string) {
  const json = extractJsonFromModelOutput(rawOutput);
  return AIPresentationAuditSchema.parse(json);
}

export function parseAISingleElementResponse(
  rawOutput: string,
  theme: SlideTheme,
  zIndex: number
): { element: SlideElement; rationale?: string } {
  const json = extractJsonFromModelOutput(rawOutput);
  const parsed = AISingleElementSchema.parse(json);
  return {
    element: hydrateAIElement(parsed.element, theme, zIndex),
    rationale: parsed.rationale,
  };
}
