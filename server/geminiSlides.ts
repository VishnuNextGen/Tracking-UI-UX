import { GoogleGenAI, ThinkingLevel, Type, type Schema } from '@google/genai';

export const GEMINI_SLIDES_MODEL = 'gemini-4-hydrogen';

export type GeminiReasoningDepth = 'low' | 'medium' | 'high' | 'xhigh';

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface ReferenceImageInput {
  mimeType: string;
  data: string; // base64 without data: prefix
}

export class GeminiHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'GeminiHttpError';
    this.status = status;
  }
}

let cachedClient: GoogleGenAI | null = null;
let cachedKey = '';

function getGeminiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new GeminiHttpError(
      503,
      'Gemini AI is not initialized yet. Verify GEMINI_API_KEY is configured in Settings > Secrets.'
    );
  }
  if (!cachedClient || cachedKey !== apiKey) {
    cachedKey = apiKey;
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedClient;
}

export function isGeminiConfigured(): boolean {
  return Boolean((process.env.GEMINI_API_KEY || '').trim());
}

function resolveThinkingLevel(depth?: GeminiReasoningDepth): ThinkingLevel {
  switch (depth) {
    case 'low':
      return ThinkingLevel.LOW;
    case 'medium':
      return ThinkingLevel.MEDIUM;
    case 'xhigh':
      return ThinkingLevel.XHIGH;
    case 'high':
    default:
      return ThinkingLevel.HIGH;
  }
}

function mapGeminiError(err: any): GeminiHttpError {
  if (err instanceof GeminiHttpError) return err;
  const status = Number(err?.status || err?.code || 500);
  const rawMessage = String(err?.message || 'Gemini request failed.');

  if (status === 403 || rawMessage.includes('PERMISSION_DENIED') || rawMessage.includes('API_KEY_INVALID')) {
    return new GeminiHttpError(
      403,
      'Gemini API key permission error or invalid key. Check your key in Settings > Secrets.'
    );
  }
  if (status === 429 || rawMessage.includes('RESOURCE_EXHAUSTED')) {
    return new GeminiHttpError(
      429,
      'Gemini rate limit or quota reached. Wait a moment or check your billing quota in Settings > Secrets.'
    );
  }
  if (status === 404 || rawMessage.includes('NOT_FOUND')) {
    return new GeminiHttpError(
      404,
      `Configured Gemini model (${GEMINI_SLIDES_MODEL}) was unavailable. Retry shortly.`
    );
  }
  return new GeminiHttpError(status >= 400 && status < 600 ? status : 500, rawMessage);
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastErr: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const mapped = mapGeminiError(err);
      const retryable = mapped.status === 429 || mapped.status === 503 || mapped.status === 500;
      if (!retryable || attempt === maxRetries) {
        throw mapped;
      }
      const delay = 600 * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw mapGeminiError(lastErr);
}

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s"'<>()]+/gi) || [];
  return Array.from(new Set(matches)).slice(0, 10);
}

const SLIDE_LAYOUT_ENUM = [
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
];

const THEME_ID_ENUM = [
  'minimal',
  'editorial',
  'modern-corporate',
  'dark-professional',
  'educational',
  'contemporary',
  'bold-typography',
];

const ELEMENT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    type: {
      type: Type.STRING,
      enum: [
        'text',
        'shape',
        'icon',
        'chart',
        'table',
        'svg-diagram',
        'video-playlist',
        'player-card',
        'match-comparison',
      ],
    },
    x: { type: Type.NUMBER, description: 'Horizontal position inside 0..1920' },
    y: { type: Type.NUMBER, description: 'Vertical position inside 0..1080' },
    width: { type: Type.NUMBER, description: 'Element width in pixels (1920px canvas)' },
    height: { type: Type.NUMBER, description: 'Element height in pixels (1080px canvas)' },
    opacity: { type: Type.NUMBER },
    role: {
      type: Type.STRING,
      enum: ['heading', 'subheading', 'body', 'quote', 'stat-value', 'stat-label', 'kicker'],
    },
    content: { type: Type.STRING },
    fontSize: { type: Type.NUMBER },
    fontWeight: { type: Type.INTEGER },
    italic: { type: Type.BOOLEAN },
    textAlign: { type: Type.STRING, enum: ['left', 'center', 'right'] },
    lineHeight: { type: Type.NUMBER },
    color: { type: Type.STRING },
    backgroundColor: { type: Type.STRING },
    shapeKind: { type: Type.STRING, enum: ['rectangle', 'circle', 'line', 'arrow', 'triangle', 'callout'] },
    fillColor: { type: Type.STRING },
    strokeColor: { type: Type.STRING },
    strokeWidth: { type: Type.NUMBER },
    borderRadius: { type: Type.NUMBER },
    iconName: { type: Type.STRING },
    chartKind: { type: Type.STRING, enum: ['bar', 'horizontal-bar', 'line', 'donut'] },
    title: { type: Type.STRING },
    data: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          value: { type: Type.NUMBER },
          secondaryValue: { type: Type.NUMBER },
        },
        required: ['label', 'value'],
      },
    },
    headers: { type: Type.ARRAY, items: { type: Type.STRING } },
    rows: {
      type: Type.ARRAY,
      items: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    diagramStyle: { type: Type.STRING, enum: ['flow', 'cycle', 'hierarchy'] },
    nodes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          label: { type: Type.STRING },
          sublabel: { type: Type.STRING },
          x: { type: Type.NUMBER },
          y: { type: Type.NUMBER },
        },
        required: ['id', 'label', 'x', 'y'],
      },
    },
    edges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          from: { type: Type.STRING },
          to: { type: Type.STRING },
          label: { type: Type.STRING },
          dashed: { type: Type.BOOLEAN },
        },
        required: ['from', 'to'],
      },
    },
    playerName: { type: Type.STRING },
    jerseyNumber: { type: Type.STRING },
    position: { type: Type.STRING },
    teamName: { type: Type.STRING },
    stats: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          value: { type: Type.STRING },
        },
        required: ['label', 'value'],
      },
    },
    homeTeam: { type: Type.STRING },
    awayTeam: { type: Type.STRING },
    homeScore: { type: Type.STRING },
    awayScore: { type: Type.STRING },
    metrics: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          homeValue: { type: Type.NUMBER },
          awayValue: { type: Type.NUMBER },
          unit: { type: Type.STRING },
        },
        required: ['label', 'homeValue', 'awayValue'],
      },
    },
  },
  required: ['type', 'x', 'y', 'width', 'height'],
};

const SLIDE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    layout: { type: Type.STRING, enum: SLIDE_LAYOUT_ENUM },
    speakerNotes: { type: Type.STRING },
    rationale: { type: Type.STRING },
    elements: { type: Type.ARRAY, items: ELEMENT_SCHEMA },
  },
  required: ['title', 'layout', 'elements'],
};

const DECK_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    themeId: { type: Type.STRING, enum: THEME_ID_ENUM },
    slides: { type: Type.ARRAY, items: SLIDE_SCHEMA },
  },
  required: ['title', 'description', 'themeId', 'slides'],
};

const SLIDE_ALTERNATIVES_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    alternatives: { type: Type.ARRAY, items: SLIDE_SCHEMA },
  },
  required: ['summary', 'alternatives'],
};

const TEXT_REWRITE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    rewrittenText: { type: Type.STRING },
    rationale: { type: Type.STRING },
  },
  required: ['rewrittenText'],
};

const DECK_AUDIT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    suggestedThemeId: { type: Type.STRING, enum: THEME_ID_ENUM },
    findings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          slideIndex: { type: Type.INTEGER },
          severity: { type: Type.STRING, enum: ['info', 'warning'] },
          title: { type: Type.STRING },
          recommendation: { type: Type.STRING },
        },
        required: ['severity', 'title', 'recommendation'],
      },
    },
    suggestedSlides: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          purpose: { type: Type.STRING },
          layout: { type: Type.STRING, enum: SLIDE_LAYOUT_ENUM },
        },
        required: ['title', 'purpose', 'layout'],
      },
    },
  },
  required: ['summary', 'findings'],
};

const SINGLE_ELEMENT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    rationale: { type: Type.STRING },
    element: ELEMENT_SCHEMA,
  },
  required: ['element'],
};

const CANVAS_ARCHITECTURE_GUIDE = `
Canvas coordinate space is strictly 1920x1080 (16:9).
Design discipline:
1. Respect safe margins: x >= 80, y >= 70, x + width <= 1840, y + height <= 1010.
2. Layer ordering matters: place background card "shape" rectangles BEFORE the "text" / "chart" / "icon" elements that sit inside them so text always renders clearly on top.
3. Never overlap headings, body text, or charts. Keep generous whitespace and concise slide copy (bullets <= 14 words each, crisp headings 44-76px).
4. Vary layouts across slides — combine typography cards, editable charts, comparison tables, SVG flow diagrams, video-playlist clip reel slots (with descriptive title for coach clip imports), player profile cards, and match comparison scorecards where helpful.
5. Keep font weights valid (400, 500, 600, 700, 800) and color contrast crisp against slide background and card surface colors.
`;

function buildMultimodalContents(text: string, referenceImages?: ReferenceImageInput[]) {
  if (!referenceImages || referenceImages.length === 0) {
    return text;
  }
  const parts: any[] = referenceImages
    .filter((img) => img?.data && img?.mimeType)
    .slice(0, 4)
    .map((img) => ({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data,
      },
    }));
  parts.push({ text });
  return { parts };
}

/**
 * Optional Stage 1 research step using Gemini Google Search & URL Context tools.
 * Separated from strict responseSchema JSON synthesis to ensure reliable schema adherence + citations.
 */
async function gatherGroundedContext(params: {
  topicOrPrompt: string;
  useSearchGrounding?: boolean;
  referenceImages?: ReferenceImageInput[];
}): Promise<{ researchNotes: string; sources: GroundingSource[] }> {
  const urls = extractUrls(params.topicOrPrompt);
  if (!params.useSearchGrounding && urls.length === 0) {
    return { researchNotes: '', sources: [] };
  }

  const ai = getGeminiClient();
  const tools: any[] = [];
  if (params.useSearchGrounding) tools.push({ googleSearch: {} });
  if (urls.length > 0) tools.push({ urlContext: {} });

  const researchPrompt = `Research accurate, current, concise facts, tactical context, statistics, and key points for creating a high-impact presentation on:
"${params.topicOrPrompt}"
Summarize the concrete numbers, comparisons, entities, and talking points concisely so a slide designer can turn them into charts, tables, video reel briefs, and crisp slide copy.`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_SLIDES_MODEL,
      contents: buildMultimodalContents(researchPrompt, params.referenceImages),
      config: {
        tools,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    })
  );

  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const seen = new Set<string>();
  const sources: GroundingSource[] = [];
  for (const chunk of chunks) {
    const uri = chunk?.web?.uri;
    if (typeof uri === 'string' && !seen.has(uri)) {
      seen.add(uri);
      sources.push({
        uri,
        title: chunk?.web?.title || uri,
      });
    }
  }

  return {
    researchNotes: (response.text || '').trim(),
    sources,
  };
}

export async function generatePresentationDeckWithGemini(
  params: {
    topic: string;
    audience?: string;
    slideCount?: number;
    themeId: string;
    themePalette: {
      backgroundColor: string;
      surfaceColor: string;
      surfaceBorderColor: string;
      textColor: string;
      mutedTextColor: string;
      accentColor: string;
      secondaryColor: string;
    };
    footballFocus?: boolean;
    reasoningDepth?: GeminiReasoningDepth;
    useSearchGrounding?: boolean;
    referenceImages?: ReferenceImageInput[];
  },
  onProgress?: (event: { phase: string; message: string; sources?: GroundingSource[] }) => void
): Promise<{ rawJson: string; sources: GroundingSource[] }> {
  const ai = getGeminiClient();
  const count = Math.max(3, Math.min(12, params.slideCount || 6));

  let researchNotes = '';
  let sources: GroundingSource[] = [];
  const hasUrls = extractUrls(params.topic).length > 0;

  if (params.useSearchGrounding || hasUrls) {
    onProgress?.({
      phase: 'researching',
      message: hasUrls
        ? 'Reading linked URLs & grounding live data with Gemini...'
        : 'Grounding statistics & context with Google Search...',
    });
    try {
      const grounded = await gatherGroundedContext({
        topicOrPrompt: params.topic,
        useSearchGrounding: params.useSearchGrounding,
        referenceImages: params.referenceImages,
      });
      researchNotes = grounded.researchNotes;
      sources = grounded.sources;
      if (sources.length > 0) {
        onProgress?.({
          phase: 'researching',
          message: `Verified ${sources.length} web source${sources.length > 1 ? 's' : ''}. Architecting slide layouts...`,
          sources,
        });
      }
    } catch {
      onProgress?.({
        phase: 'researching',
        message: 'Live web grounding quota unavailable — synthesizing directly with Gemini...',
      });
    }
  }

  onProgress?.({
    phase: 'architecting',
    message: `Designing ${count} structured 16:9 slides with Gemini (${params.reasoningDepth || 'high'} reasoning)...`,
  });

  const systemInstruction = `You are a senior presentation architect, visual designer, and football tactical analyst inside Tacstem Presentation Studio.
Design an editable ${count}-slide deck with varied layouts (title, statistics, comparison, diagram/process, data-viz, conclusion).
${CANVAS_ARCHITECTURE_GUIDE}
Use theme "${params.themeId}" with palette:
backgroundColor="${params.themePalette.backgroundColor}", surfaceColor="${params.themePalette.surfaceColor}", strokeColor="${params.themePalette.surfaceBorderColor}", textColor="${params.themePalette.textColor}", mutedTextColor="${params.themePalette.mutedTextColor}", accentColor="${params.themePalette.accentColor}", secondaryColor="${params.themePalette.secondaryColor}".
Return strictly valid JSON adhering to the response schema.`;

  const userPrompt = `Create a ${count}-slide presentation for:
Topic & Brief: "${params.topic}"
Target Audience: ${params.audience || 'Coaching staff, analysts, and decision-makers'}
ThemeId: "${params.themeId}"
${
  params.footballFocus
    ? 'Domain Focus: Football tactical analysis — include at least one video-playlist clip reel slot (type: "video-playlist", with a clear coaching title) so the analyst can import match clips, alongside tactical metrics, charts, player cards, or match comparisons.'
    : 'Domain Focus: General / executive — choose data charts, structured comparison cards, SVG diagrams, and crisp layouts suited to the topic.'
}
${params.referenceImages && params.referenceImages.length > 0 ? 'Analyze the attached image(s) carefully and translate their visual structure, formations, stats, or notes into native editable slide elements.' : ''}
${researchNotes ? `\nVerified Grounded Research & Context:\n${researchNotes}` : ''}`;

  const responseStream = await withRetry(() =>
    ai.models.generateContentStream({
      model: GEMINI_SLIDES_MODEL,
      contents: buildMultimodalContents(userPrompt, params.referenceImages),
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: resolveThinkingLevel(params.reasoningDepth || 'high') },
        responseMimeType: 'application/json',
        responseSchema: DECK_RESPONSE_SCHEMA,
      },
    })
  );

  let fullText = '';
  let lastNotice = Date.now();
  for await (const chunk of responseStream) {
    if (chunk.text) {
      fullText += chunk.text;
    }
    const now = Date.now();
    if (now - lastNotice > 900) {
      lastNotice = now;
      const slideMatches = fullText.match(/"speakerNotes"|"elements"/g)?.length || 0;
      onProgress?.({
        phase: 'streaming',
        message:
          slideMatches > 0
            ? `Streaming editable slide components (${Math.min(count, slideMatches)}/${count})...`
            : 'Composing visual hierarchy & structured layout...',
      });
    }
  }

  return { rawJson: fullText.trim(), sources };
}

export async function redesignSlideWithGemini(params: {
  presentationContext: string;
  currentSlide: string;
  instruction: string;
  themePalette: {
    backgroundColor: string;
    surfaceColor: string;
    surfaceBorderColor: string;
    textColor: string;
    mutedTextColor: string;
    accentColor: string;
    secondaryColor: string;
  };
  reasoningDepth?: GeminiReasoningDepth;
  useSearchGrounding?: boolean;
  referenceImages?: ReferenceImageInput[];
}): Promise<{ rawJson: string; sources: GroundingSource[] }> {
  const ai = getGeminiClient();

  let researchNotes = '';
  let sources: GroundingSource[] = [];
  if (params.useSearchGrounding || extractUrls(params.instruction).length > 0) {
    try {
      const grounded = await gatherGroundedContext({
        topicOrPrompt: params.instruction,
        useSearchGrounding: params.useSearchGrounding,
        referenceImages: params.referenceImages,
      });
      researchNotes = grounded.researchNotes;
      sources = grounded.sources;
    } catch {
      // Fall back cleanly to direct Gemini slide redesign if web grounding quota is unavailable
    }
  }

  const systemInstruction = `You are a senior presentation designer inside Tacstem Presentation Studio.
Redesign the current slide according to the user's instruction while preserving all meaningful facts and intent.
${CANVAS_ARCHITECTURE_GUIDE}
Theme palette: background="${params.themePalette.backgroundColor}", surface="${params.themePalette.surfaceColor}", border="${params.themePalette.surfaceBorderColor}", text="${params.themePalette.textColor}", muted="${params.themePalette.mutedTextColor}", accent="${params.themePalette.accentColor}", secondary="${params.themePalette.secondaryColor}".
Provide a concise 1-2 sentence "rationale" explaining why the new visual composition works better.`;

  const userPrompt = `Presentation context: ${params.presentationContext}
Current slide JSON: ${params.currentSlide}
Instruction: ${params.instruction}
${researchNotes ? `\nGrounded Web Context:\n${researchNotes}` : ''}`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_SLIDES_MODEL,
      contents: buildMultimodalContents(userPrompt, params.referenceImages),
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: resolveThinkingLevel(params.reasoningDepth || 'high') },
        responseMimeType: 'application/json',
        responseSchema: SLIDE_SCHEMA,
      },
    })
  );

  return { rawJson: (response.text || '').trim(), sources };
}

export async function generateSlideAlternativesWithGemini(params: {
  currentSlide: string;
  themePalette: {
    backgroundColor: string;
    surfaceColor: string;
    surfaceBorderColor: string;
    textColor: string;
    mutedTextColor: string;
    accentColor: string;
    secondaryColor: string;
  };
  reasoningDepth?: GeminiReasoningDepth;
}): Promise<string> {
  const ai = getGeminiClient();

  const systemInstruction = `You are a senior presentation architect.
Reimagine the given slide as 3 genuinely distinct, production-grade 16:9 visual layout alternatives (for example: Option 1 split visual/diagram, Option 2 comparison grid or stats cards, Option 3 structured process/timeline or table).
${CANVAS_ARCHITECTURE_GUIDE}
Theme palette: background="${params.themePalette.backgroundColor}", surface="${params.themePalette.surfaceColor}", border="${params.themePalette.surfaceBorderColor}", text="${params.themePalette.textColor}", accent="${params.themePalette.accentColor}", secondary="${params.themePalette.secondaryColor}".`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_SLIDES_MODEL,
      contents: `Generate 3 distinct layout alternatives for this slide:\n${params.currentSlide}`,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: resolveThinkingLevel(params.reasoningDepth || 'high') },
        responseMimeType: 'application/json',
        responseSchema: SLIDE_ALTERNATIVES_SCHEMA,
      },
    })
  );

  return (response.text || '').trim();
}

export async function rewriteTextElementWithGemini(params: {
  deckTitle: string;
  slideTitle: string;
  elementText: string;
  actionInstruction: string;
  customInstruction?: string;
}): Promise<string> {
  const ai = getGeminiClient();

  const systemInstruction = `You are an editorial presentation writer and football tactical analyst.
Improve the selected slide text according to the requested action while keeping it scannable and impactful on a 16:9 slide.`;

  const userPrompt = `Deck title: "${params.deckTitle}" | Slide: "${params.slideTitle}"
Requested editorial action: ${params.actionInstruction}
${params.customInstruction ? `Additional user note: ${params.customInstruction}` : ''}
Original text:
"""
${params.elementText}
"""`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_SLIDES_MODEL,
      contents: userPrompt,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: TEXT_REWRITE_SCHEMA,
      },
    })
  );

  return (response.text || '').trim();
}

export async function auditPresentationWithGemini(params: {
  presentationContext: string;
  instruction?: string;
  reasoningDepth?: GeminiReasoningDepth;
}): Promise<string> {
  const ai = getGeminiClient();

  const systemInstruction = `You are a presentation architect auditing a slide deck for narrative flow, overcrowded slides, repetition, visual hierarchy, and theme fit.
Identify concrete improvements, recommend the best themeId if another fits better, and propose 2-3 high-value additional slides to strengthen the deck.`;

  const userPrompt = `Presentation summary: ${params.presentationContext}
Request: ${params.instruction || 'Audit narrative flow, identify overcrowded slides, suggest visual improvements, and recommend additional slides + theme.'}`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_SLIDES_MODEL,
      contents: userPrompt,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: resolveThinkingLevel(params.reasoningDepth || 'high') },
        responseMimeType: 'application/json',
        responseSchema: DECK_AUDIT_SCHEMA,
      },
    })
  );

  return (response.text || '').trim();
}

export async function generateSingleElementWithGemini(params: {
  slideContext: string;
  instruction: string;
  themePalette: {
    backgroundColor: string;
    surfaceColor: string;
    surfaceBorderColor: string;
    textColor: string;
    mutedTextColor: string;
    accentColor: string;
    secondaryColor: string;
  };
  reasoningDepth?: GeminiReasoningDepth;
  referenceImages?: ReferenceImageInput[];
}): Promise<string> {
  const ai = getGeminiClient();

  const systemInstruction = `You are a presentation component designer inside Tacstem Presentation Studio.
Create ONE clean, self-contained editable slide element (e.g., video-playlist slot, chart, table, svg-diagram, player-card, match-comparison, or text card) positioned thoughtfully inside 1920x1080 based on the user's request and existing slide elements so it doesn't collide unnecessarily.
Theme palette: surface="${params.themePalette.surfaceColor}", border="${params.themePalette.surfaceBorderColor}", text="${params.themePalette.textColor}", accent="${params.themePalette.accentColor}", secondary="${params.themePalette.secondaryColor}".`;

  const userPrompt = `Current slide layout & elements: ${params.slideContext}
Build this element: ${params.instruction}`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_SLIDES_MODEL,
      contents: buildMultimodalContents(userPrompt, params.referenceImages),
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: resolveThinkingLevel(params.reasoningDepth || 'medium') },
        responseMimeType: 'application/json',
        responseSchema: SINGLE_ELEMENT_SCHEMA,
      },
    })
  );

  return (response.text || '').trim();
}
