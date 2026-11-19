import { z } from 'zod';

export const AISlideLayoutSchema = z.enum([
  'title',
  'section-divider',
  'text-image',
  'two-column',
  'three-column',
  'comparison',
  'statistics',
  'timeline',
  'process',
  'quote',
  'full-image',
  'conclusion',
  'diagram',
  'data-viz',
]);

export const AIThemeIdSchema = z.enum([
  'minimal',
  'editorial',
  'modern-corporate',
  'dark-professional',
  'educational',
  'contemporary',
  'bold-typography',
]);

export const AIElementSchema = z.object({
  type: z.enum([
    'text',
    'shape',
    'icon',
    'chart',
    'table',
    'svg-diagram',
    'video-playlist',
    'player-card',
    'match-comparison',
  ]),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
  rotation: z.number().optional(),
  opacity: z.number().min(0).max(1).optional(),
  role: z.enum(['heading', 'subheading', 'body', 'quote', 'stat-value', 'stat-label', 'kicker']).optional(),
  content: z.string().optional(),
  fontSize: z.number().min(8).max(240).optional(),
  fontWeight: z.number().optional(),
  italic: z.boolean().optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  lineHeight: z.number().min(0.8).max(3).optional(),
  color: z.string().optional(),
  backgroundColor: z.string().optional(),
  shapeKind: z.enum(['rectangle', 'circle', 'line', 'arrow', 'triangle', 'callout']).optional(),
  fillColor: z.string().optional(),
  strokeColor: z.string().optional(),
  strokeWidth: z.number().min(0).max(30).optional(),
  borderRadius: z.number().min(0).max(200).optional(),
  iconName: z.string().optional(),
  chartKind: z.enum(['bar', 'horizontal-bar', 'line', 'donut']).optional(),
  title: z.string().optional(),
  data: z
    .array(
      z.object({
        label: z.string(),
        value: z.number(),
        secondaryValue: z.number().optional(),
      })
    )
    .optional(),
  headers: z.array(z.string()).optional(),
  rows: z.array(z.array(z.string())).optional(),
  diagramStyle: z.enum(['flow', 'cycle', 'hierarchy']).optional(),
  nodes: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        sublabel: z.string().optional(),
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
      })
    )
    .optional(),
  edges: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        label: z.string().optional(),
        dashed: z.boolean().optional(),
      })
    )
    .optional(),
  playerName: z.string().optional(),
  jerseyNumber: z.string().optional(),
  position: z.string().optional(),
  teamName: z.string().optional(),
  stats: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  homeTeam: z.string().optional(),
  awayTeam: z.string().optional(),
  homeScore: z.string().optional(),
  awayScore: z.string().optional(),
  metrics: z
    .array(
      z.object({
        label: z.string(),
        homeValue: z.number(),
        awayValue: z.number(),
        unit: z.string().optional(),
      })
    )
    .optional(),
});

export const AISlideSchema = z.object({
  title: z.string().min(1),
  layout: AISlideLayoutSchema.optional().default('two-column'),
  speakerNotes: z.string().optional(),
  rationale: z.string().optional(),
  elements: z.array(AIElementSchema).min(1),
});

export const AIDeckResponseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  themeId: AIThemeIdSchema.optional(),
  slides: z.array(AISlideSchema).min(1),
});

export const AISlideAlternativesSchema = z.object({
  summary: z.string().optional(),
  alternatives: z.array(AISlideSchema).min(1).max(4),
});

export const AITextRewriteSchema = z.object({
  rewrittenText: z.string().min(1),
  rationale: z.string().optional(),
});

export const AIPresentationAuditSchema = z.object({
  summary: z.string(),
  suggestedThemeId: AIThemeIdSchema.optional(),
  findings: z.array(
    z.object({
      slideIndex: z.number().optional(),
      severity: z.enum(['info', 'warning']),
      title: z.string(),
      recommendation: z.string(),
    })
  ),
  suggestedSlides: z
    .array(
      z.object({
        title: z.string(),
        purpose: z.string(),
        layout: AISlideLayoutSchema,
      })
    )
    .optional(),
});

export const AISingleElementSchema = z.object({
  rationale: z.string().optional(),
  element: AIElementSchema,
});
