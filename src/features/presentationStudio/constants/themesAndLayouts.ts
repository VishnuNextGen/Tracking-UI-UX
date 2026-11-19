import type {
  SlideTheme,
  ThemeId,
  SlideLayoutType,
  Slide,
  SlideElement,
  PresentationProject,
} from '../types/presentation';

export const CANVAS_WIDTH = 1920;
export const CANVAS_HEIGHT = 1080;

export const SLIDE_THEMES: Record<ThemeId, SlideTheme> = {
  'dark-professional': {
    id: 'dark-professional',
    name: 'Dark Professional',
    description: 'High-contrast broadcast slate with lime tactical accents.',
    backgroundColor: '#0c0e14',
    surfaceColor: '#151923',
    surfaceBorderColor: '#262d3d',
    textColor: '#f8fafc',
    mutedTextColor: '#94a3b8',
    accentColor: '#c6ff1f',
    accentContrastColor: '#090b10',
    secondaryColor: '#38bdf8',
    headingFont: "'Outfit', sans-serif",
    bodyFont: "'IBM Plex Sans', sans-serif",
    monoFont: "'JetBrains Mono', monospace",
    chartPalette: ['#c6ff1f', '#38bdf8', '#f59e0b', '#fb7185', '#a78bfa'],
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Crisp gallery white with architectural charcoal typography.',
    backgroundColor: '#fafafa',
    surfaceColor: '#ffffff',
    surfaceBorderColor: '#e2e8f0',
    textColor: '#0f172a',
    mutedTextColor: '#64748b',
    accentColor: '#0f172a',
    accentContrastColor: '#ffffff',
    secondaryColor: '#0284c7',
    headingFont: "'Outfit', sans-serif",
    bodyFont: "'IBM Plex Sans', sans-serif",
    monoFont: "'JetBrains Mono', monospace",
    chartPalette: ['#0f172a', '#0284c7', '#16a34a', '#d97706', '#64748b'],
  },
  editorial: {
    id: 'editorial',
    name: 'Editorial',
    description: 'Warm paper canvas paired with serif display headlines.',
    backgroundColor: '#f5f2eb',
    surfaceColor: '#ebe6dc',
    surfaceBorderColor: '#d6cfc2',
    textColor: '#1c1917',
    mutedTextColor: '#57534e',
    accentColor: '#9f1239',
    accentContrastColor: '#ffffff',
    secondaryColor: '#1e3a5f',
    headingFont: "'Playfair Display', serif",
    bodyFont: "'IBM Plex Sans', sans-serif",
    monoFont: "'JetBrains Mono', monospace",
    chartPalette: ['#9f1239', '#1e3a5f', '#b45309', '#15803d', '#57534e'],
  },
  'modern-corporate': {
    id: 'modern-corporate',
    name: 'Modern Corporate',
    description: 'Clean executive navy and cool slate structure.',
    backgroundColor: '#f8fafc',
    surfaceColor: '#ffffff',
    surfaceBorderColor: '#cbd5e1',
    textColor: '#0f172a',
    mutedTextColor: '#475569',
    accentColor: '#1d4ed8',
    accentContrastColor: '#ffffff',
    secondaryColor: '#0f766e',
    headingFont: "'Outfit', sans-serif",
    bodyFont: "'IBM Plex Sans', sans-serif",
    monoFont: "'JetBrains Mono', monospace",
    chartPalette: ['#1d4ed8', '#0f766e', '#0369a1', '#b45309', '#475569'],
  },
  educational: {
    id: 'educational',
    name: 'Educational',
    description: 'Clear coaching board contrast designed for squad briefings.',
    backgroundColor: '#0f1d18',
    surfaceColor: '#162922',
    surfaceBorderColor: '#27463a',
    textColor: '#f1f5f9',
    mutedTextColor: '#94a3b8',
    accentColor: '#34d399',
    accentContrastColor: '#052e16',
    secondaryColor: '#fbbf24',
    headingFont: "'Outfit', sans-serif",
    bodyFont: "'IBM Plex Sans', sans-serif",
    monoFont: "'JetBrains Mono', monospace",
    chartPalette: ['#34d399', '#fbbf24', '#60a5fa', '#f87171', '#a78bfa'],
  },
  contemporary: {
    id: 'contemporary',
    name: 'Contemporary',
    description: 'Deep graphite and electric cyan analytical styling.',
    backgroundColor: '#111318',
    surfaceColor: '#1a1e26',
    surfaceBorderColor: '#2d3340',
    textColor: '#f3f4f6',
    mutedTextColor: '#9ca3af',
    accentColor: '#06b6d4',
    accentContrastColor: '#083344',
    secondaryColor: '#f59e0b',
    headingFont: "'Outfit', sans-serif",
    bodyFont: "'IBM Plex Sans', sans-serif",
    monoFont: "'JetBrains Mono', monospace",
    chartPalette: ['#06b6d4', '#f59e0b', '#10b981', '#f43f5e', '#818cf8'],
  },
  'bold-typography': {
    id: 'bold-typography',
    name: 'Bold Typography',
    description: 'High-impact condensed matchday poster headers.',
    backgroundColor: '#09090b',
    surfaceColor: '#18181b',
    surfaceBorderColor: '#27272a',
    textColor: '#fafafa',
    mutedTextColor: '#a1a1aa',
    accentColor: '#facc15',
    accentContrastColor: '#09090b',
    secondaryColor: '#ef4444',
    headingFont: "'Bebas Neue', sans-serif",
    bodyFont: "'IBM Plex Sans', sans-serif",
    monoFont: "'JetBrains Mono', monospace",
    chartPalette: ['#facc15', '#ef4444', '#22c55e', '#38bdf8', '#a1a1aa'],
  },
};

export interface LayoutDefinition {
  id: SlideLayoutType;
  label: string;
  description: string;
  category: 'Core' | 'Structure' | 'Data & Tactical';
}

export const SLIDE_LAYOUTS: LayoutDefinition[] = [
  { id: 'title', label: 'Title Slide', description: 'Opening headline, subtitle & metadata', category: 'Core' },
  { id: 'section-divider', label: 'Section Divider', description: 'Chapter transition with bold index', category: 'Core' },
  { id: 'text-image', label: 'Text & Visual', description: 'Narrative column beside media or video playlist', category: 'Core' },
  { id: 'two-column', label: 'Two Column', description: 'Balanced side-by-side analysis blocks', category: 'Structure' },
  { id: 'three-column', label: 'Three Column', description: 'Three structured tactical pillars', category: 'Structure' },
  { id: 'comparison', label: 'Comparison', description: 'Side-by-side contrast with dividers', category: 'Structure' },
  { id: 'statistics', label: 'Statistics', description: 'Three bold KPI callouts with context', category: 'Data & Tactical' },
  { id: 'timeline', label: 'Timeline', description: 'Chronological match phases or milestones', category: 'Structure' },
  { id: 'process', label: 'Process', description: 'Step-by-step build-up or pressing flow', category: 'Structure' },
  { id: 'quote', label: 'Quote', description: 'Focused coaching principle or statement', category: 'Core' },
  { id: 'full-image', label: 'Full Visual', description: 'Edge-to-edge media or playlist stage with caption', category: 'Core' },
  { id: 'conclusion', label: 'Conclusion', description: 'Key takeaways and next match actions', category: 'Core' },
  { id: 'diagram', label: 'Tactical Diagram', description: 'Structured SVG node and phase diagram', category: 'Data & Tactical' },
  { id: 'data-viz', label: 'Data Visualisation', description: 'Chart and supporting analytical notes', category: 'Data & Tactical' },
];

export const FONT_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Outfit (Display)', value: "'Outfit', sans-serif" },
  { label: 'IBM Plex Sans', value: "'IBM Plex Sans', sans-serif" },
  { label: 'Playfair Display (Serif)', value: "'Playfair Display', serif" },
  { label: 'Bebas Neue (Condensed)', value: "'Bebas Neue', sans-serif" },
  { label: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
];

export function uid(prefix = 'el'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createSlideFromLayout(
  layout: SlideLayoutType,
  theme: SlideTheme,
  overrides?: {
    title?: string;
    kicker?: string;
    heading?: string;
    subheading?: string;
    body?: string;
    bullets?: string[];
    existingElements?: SlideElement[];
  }
): Slide {
  const existingTexts = (overrides?.existingElements || []).filter(
    (el): el is Extract<SlideElement, { type: 'text' }> => el.type === 'text'
  );
  const existingVisual = (overrides?.existingElements || []).find(
    (el) =>
      el.type === 'image' ||
      el.type === 'video-playlist' ||
      el.type === 'tactical-board' ||
      el.type === 'chart' ||
      el.type === 'svg-diagram'
  );

  const kickerText =
    overrides?.kicker ||
    existingTexts.find((t) => t.role === 'kicker')?.content ||
    'TACTICAL BRIEFING';
  const headingText =
    overrides?.heading ||
    existingTexts.find((t) => t.role === 'heading')?.content ||
    'Slide Headline';
  const subheadingText =
    overrides?.subheading ||
    existingTexts.find((t) => t.role === 'subheading')?.content ||
    'Supporting tactical context and key coaching objective.';
  const bodyBlocks = existingTexts.filter(
    (t) => t.role !== 'kicker' && t.role !== 'heading' && t.role !== 'subheading'
  );
  const primaryBody =
    overrides?.body ||
    bodyBlocks[0]?.content ||
    '• Identify pressing triggers in midfield zones\n• Exploit weak-side half-spaces on transition\n• Maintain compact rest-defense shape';

  const elements: SlideElement[] = [];
  let z = 1;

  const pushText = (
    partial: Partial<Extract<SlideElement, { type: 'text' }>> & {
      x: number;
      y: number;
      width: number;
      height: number;
      content: string;
    }
  ) => {
    elements.push({
      id: uid('txt'),
      type: 'text',
      fontFamily: partial.role === 'heading' ? theme.headingFont : theme.bodyFont,
      fontSize: 28,
      fontWeight: 400,
      textAlign: 'left',
      lineHeight: 1.35,
      letterSpacing: 0,
      color: theme.textColor,
      zIndex: z++,
      ...partial,
    });
  };

  const pushCard = (x: number, y: number, width: number, height: number, fill?: string) => {
    elements.push({
      id: uid('shp'),
      type: 'shape',
      shapeKind: 'rectangle',
      x,
      y,
      width,
      height,
      fillColor: fill || theme.surfaceColor,
      strokeColor: theme.surfaceBorderColor,
      strokeWidth: 2,
      borderRadius: 20,
      zIndex: z++,
    });
  };

  switch (layout) {
    case 'title': {
      elements.push({
        id: uid('shp'),
        type: 'shape',
        shapeKind: 'rectangle',
        x: 120,
        y: 260,
        width: 100,
        height: 8,
        fillColor: theme.accentColor,
        strokeColor: 'transparent',
        strokeWidth: 0,
        borderRadius: 4,
        zIndex: z++,
      });
      pushText({
        role: 'kicker',
        x: 120,
        y: 295,
        width: 1400,
        height: 48,
        content: kickerText,
        fontFamily: theme.monoFont,
        fontSize: 22,
        fontWeight: 600,
        letterSpacing: 0.12,
        color: theme.accentColor,
      });
      pushText({
        role: 'heading',
        x: 120,
        y: 365,
        width: 1580,
        height: 220,
        content: headingText === 'Slide Headline' ? 'Match Analysis & Tactical Plan' : headingText,
        fontFamily: theme.headingFont,
        fontSize: 96,
        fontWeight: 800,
        lineHeight: 1.05,
        letterSpacing: -0.02,
      });
      pushText({
        role: 'subheading',
        x: 120,
        y: 620,
        width: 1260,
        height: 120,
        content: subheadingText,
        fontSize: 34,
        color: theme.mutedTextColor,
        lineHeight: 1.4,
      });
      pushText({
        role: 'body',
        x: 120,
        y: 890,
        width: 1200,
        height: 60,
        content: 'Prepared in Tacstem Presentation Studio',
        fontFamily: theme.monoFont,
        fontSize: 20,
        color: theme.mutedTextColor,
      });
      break;
    }

    case 'section-divider': {
      pushCard(120, 320, 180, 72, theme.accentColor);
      pushText({
        role: 'kicker',
        x: 120,
        y: 334,
        width: 180,
        height: 48,
        content: 'PHASE 01',
        fontFamily: theme.monoFont,
        fontSize: 24,
        fontWeight: 700,
        textAlign: 'center',
        color: theme.accentContrastColor,
      });
      pushText({
        role: 'heading',
        x: 120,
        y: 430,
        width: 1620,
        height: 180,
        content: headingText,
        fontFamily: theme.headingFont,
        fontSize: 88,
        fontWeight: 800,
        lineHeight: 1.08,
      });
      pushText({
        role: 'subheading',
        x: 120,
        y: 630,
        width: 1320,
        height: 110,
        content: subheadingText,
        fontSize: 32,
        color: theme.mutedTextColor,
      });
      break;
    }

    case 'text-image': {
      pushText({
        role: 'kicker',
        x: 100,
        y: 80,
        width: 780,
        height: 40,
        content: kickerText,
        fontFamily: theme.monoFont,
        fontSize: 18,
        fontWeight: 600,
        letterSpacing: 0.1,
        color: theme.accentColor,
      });
      pushText({
        role: 'heading',
        x: 100,
        y: 130,
        width: 780,
        height: 140,
        content: headingText,
        fontFamily: theme.headingFont,
        fontSize: 58,
        fontWeight: 700,
        lineHeight: 1.12,
      });
      pushText({
        role: 'subheading',
        x: 100,
        y: 285,
        width: 760,
        height: 90,
        content: subheadingText,
        fontSize: 26,
        color: theme.mutedTextColor,
      });
      pushText({
        role: 'body',
        x: 100,
        y: 410,
        width: 760,
        height: 520,
        content: primaryBody,
        fontSize: 28,
        lineHeight: 1.55,
      });
      if (existingVisual) {
        elements.push({
          ...existingVisual,
          x: 920,
          y: 140,
          width: 900,
          height: 800,
          zIndex: z++,
        });
      } else {
        elements.push({
          id: uid('vpl'),
          type: 'video-playlist',
          x: 920,
          y: 160,
          width: 900,
          height: 760,
          zIndex: z++,
          title: 'Match Video Playlist',
          clips: [],
          loop: true,
          muted: false,
          showOverlayHud: true,
          showClipStrip: true,
          accentColor: theme.accentColor,
          backgroundColor: theme.surfaceColor,
          borderRadius: 20,
        });
      }
      break;
    }

    case 'two-column': {
      pushText({
        role: 'kicker',
        x: 100,
        y: 80,
        width: 1720,
        height: 36,
        content: kickerText,
        fontFamily: theme.monoFont,
        fontSize: 18,
        fontWeight: 600,
        color: theme.accentColor,
      });
      pushText({
        role: 'heading',
        x: 100,
        y: 128,
        width: 1720,
        height: 100,
        content: headingText,
        fontFamily: theme.headingFont,
        fontSize: 58,
        fontWeight: 700,
      });
      pushCard(100, 260, 830, 700);
      pushText({
        role: 'subheading',
        x: 145,
        y: 305,
        width: 740,
        height: 60,
        content: '01. In-Possession Structure',
        fontFamily: theme.headingFont,
        fontSize: 34,
        fontWeight: 700,
        color: theme.accentColor,
      });
      pushText({
        role: 'body',
        x: 145,
        y: 390,
        width: 740,
        height: 520,
        content: primaryBody,
        fontSize: 26,
        lineHeight: 1.55,
      });
      pushCard(990, 260, 830, 700);
      pushText({
        role: 'subheading',
        x: 1035,
        y: 305,
        width: 740,
        height: 60,
        content: '02. Out-of-Possession Triggers',
        fontFamily: theme.headingFont,
        fontSize: 34,
        fontWeight: 700,
        color: theme.secondaryColor,
      });
      pushText({
        role: 'body',
        x: 1035,
        y: 390,
        width: 740,
        height: 520,
        content:
          bodyBlocks[1]?.content ||
          '• Screen central passing lanes on back-pass\n• Force build-up toward touchline traps\n• Immediate counter-press for 5 seconds on turnover',
        fontSize: 26,
        lineHeight: 1.55,
      });
      break;
    }

    case 'three-column': {
      pushText({
        role: 'heading',
        x: 100,
        y: 90,
        width: 1720,
        height: 100,
        content: headingText,
        fontFamily: theme.headingFont,
        fontSize: 56,
        fontWeight: 700,
      });
      const cols = [
        { title: '01. Build-Up', body: primaryBody, color: theme.accentColor },
        { title: '02. Progression', body: bodyBlocks[1]?.content || '• Third-man combinations\n• Half-space rotations\n• Overloads out wide', color: theme.secondaryColor },
        { title: '03. Finishing', body: bodyBlocks[2]?.content || '• Cut-back zone occupation\n• Late edge-of-box arrivals\n• Rest-defense 3+2 cover', color: theme.accentColor },
      ];
      cols.forEach((col, i) => {
        const cx = 100 + i * 585;
        pushCard(cx, 240, 545, 720);
        pushText({
          role: 'subheading',
          x: cx + 40,
          y: 290,
          width: 465,
          height: 60,
          content: col.title,
          fontFamily: theme.headingFont,
          fontSize: 32,
          fontWeight: 700,
          color: col.color,
        });
        pushText({
          role: 'body',
          x: cx + 40,
          y: 375,
          width: 465,
          height: 530,
          content: col.body,
          fontSize: 24,
          lineHeight: 1.55,
        });
      });
      break;
    }

    case 'comparison': {
      pushText({
        role: 'heading',
        x: 100,
        y: 80,
        width: 1720,
        height: 95,
        content: headingText,
        fontFamily: theme.headingFont,
        fontSize: 56,
        fontWeight: 700,
      });
      pushCard(100, 220, 820, 760);
      pushText({
        role: 'subheading',
        x: 140,
        y: 260,
        width: 740,
        height: 60,
        content: 'Option A · High Press (4-3-3)',
        fontFamily: theme.headingFont,
        fontSize: 32,
        fontWeight: 700,
        color: theme.accentColor,
      });
      pushText({
        role: 'body',
        x: 140,
        y: 345,
        width: 740,
        height: 580,
        content: primaryBody,
        fontSize: 25,
        lineHeight: 1.55,
      });
      pushCard(1000, 220, 820, 760);
      pushText({
        role: 'subheading',
        x: 1040,
        y: 260,
        width: 740,
        height: 60,
        content: 'Option B · Mid-Block (4-4-2)',
        fontFamily: theme.headingFont,
        fontSize: 32,
        fontWeight: 700,
        color: theme.secondaryColor,
      });
      pushText({
        role: 'body',
        x: 1040,
        y: 345,
        width: 740,
        height: 580,
        content:
          bodyBlocks[1]?.content ||
          '• Protects central progression lanes\n• Conserves energy across 90 minutes\n• Invites wide traps before counter-attacking',
        fontSize: 25,
        lineHeight: 1.55,
      });
      break;
    }

    case 'statistics': {
      pushText({
        role: 'kicker',
        x: 100,
        y: 85,
        width: 1720,
        height: 40,
        content: kickerText,
        fontFamily: theme.monoFont,
        fontSize: 18,
        fontWeight: 600,
        color: theme.accentColor,
      });
      pushText({
        role: 'heading',
        x: 100,
        y: 135,
        width: 1720,
        height: 100,
        content: headingText,
        fontFamily: theme.headingFont,
        fontSize: 58,
        fontWeight: 700,
      });
      const stats = [
        { val: '2.48', label: 'Expected Goals (xG)', sub: '+0.94 above season baseline across final 3 matches' },
        { val: '64%', label: 'Final-Third Regains', sub: 'Counter-press recoveries within 6 seconds of loss' },
        { val: '18', label: 'Line-Breaking Passes', sub: 'Completed into central pockets & half-spaces' },
      ];
      stats.forEach((st, i) => {
        const sx = 100 + i * 585;
        pushCard(sx, 290, 545, 580);
        pushText({
          role: 'stat-value',
          x: sx + 44,
          y: 350,
          width: 455,
          height: 140,
          content: st.val,
          fontFamily: theme.monoFont,
          fontSize: 104,
          fontWeight: 800,
          color: i === 1 ? theme.secondaryColor : theme.accentColor,
        });
        pushText({
          role: 'stat-label',
          x: sx + 44,
          y: 520,
          width: 455,
          height: 70,
          content: st.label,
          fontFamily: theme.headingFont,
          fontSize: 32,
          fontWeight: 700,
        });
        pushText({
          role: 'body',
          x: sx + 44,
          y: 610,
          width: 455,
          height: 200,
          content: st.sub,
          fontSize: 23,
          color: theme.mutedTextColor,
          lineHeight: 1.45,
        });
      });
      break;
    }

    case 'timeline': {
      pushText({
        role: 'heading',
        x: 100,
        y: 85,
        width: 1720,
        height: 100,
        content: headingText,
        fontFamily: theme.headingFont,
        fontSize: 56,
        fontWeight: 700,
      });
      elements.push({
        id: uid('shp'),
        type: 'shape',
        shapeKind: 'line',
        x: 140,
        y: 360,
        width: 1640,
        height: 6,
        fillColor: theme.accentColor,
        strokeColor: theme.accentColor,
        strokeWidth: 6,
        zIndex: z++,
      });
      const milestones = [
        { time: "0' – 15'", title: 'High Tempo Start', desc: 'Aggressive pressing on goal kicks to pin back four.' },
        { time: "15' – 45'", title: 'Control & Switches', desc: 'Overload left flank to isolate right winger 1v1.' },
        { time: "46' – 70'", title: 'Half-Time Adjustment', desc: 'Drop #6 between center-backs vs 2-striker press.' },
        { time: "70' – 90'", title: 'Game Management', desc: 'Fresh legs on wings & compact 4-4-2 mid-block.' },
      ];
      milestones.forEach((m, i) => {
        const mx = 110 + i * 435;
        elements.push({
          id: uid('shp'),
          type: 'shape',
          shapeKind: 'circle',
          x: mx + 150,
          y: 336,
          width: 52,
          height: 52,
          fillColor: theme.accentColor,
          strokeColor: theme.backgroundColor,
          strokeWidth: 6,
          zIndex: z++,
        });
        pushCard(mx, 430, 405, 500);
        pushText({
          role: 'kicker',
          x: mx + 28,
          y: 465,
          width: 349,
          height: 44,
          content: m.time,
          fontFamily: theme.monoFont,
          fontSize: 22,
          fontWeight: 700,
          color: theme.accentColor,
        });
        pushText({
          role: 'subheading',
          x: mx + 28,
          y: 520,
          width: 349,
          height: 75,
          content: m.title,
          fontFamily: theme.headingFont,
          fontSize: 28,
          fontWeight: 700,
        });
        pushText({
          role: 'body',
          x: mx + 28,
          y: 615,
          width: 349,
          height: 260,
          content: m.desc,
          fontSize: 22,
          color: theme.mutedTextColor,
        });
      });
      break;
    }

    case 'process': {
      pushText({
        role: 'heading',
        x: 100,
        y: 85,
        width: 1720,
        height: 100,
        content: headingText,
        fontFamily: theme.headingFont,
        fontSize: 56,
        fontWeight: 700,
      });
      const steps = [
        { num: 'STEP 01', title: 'Attract Press', body: 'Center-backs split wide inside box to draw first pressing line.' },
        { num: 'STEP 02', title: 'Bounce Central', body: 'Pivot receives on half-turn or sets back to advancing #8.' },
        { num: 'STEP 03', title: 'Attack Depth', body: 'Vertical ball behind high line as opposite winger sprints diagonally.' },
      ];
      steps.forEach((s, i) => {
        const sx = 100 + i * 595;
        pushCard(sx, 280, 520, 620);
        pushText({
          role: 'kicker',
          x: sx + 36,
          y: 325,
          width: 448,
          height: 40,
          content: s.num,
          fontFamily: theme.monoFont,
          fontSize: 20,
          fontWeight: 700,
          color: theme.accentColor,
        });
        pushText({
          role: 'subheading',
          x: sx + 36,
          y: 385,
          width: 448,
          height: 80,
          content: s.title,
          fontFamily: theme.headingFont,
          fontSize: 36,
          fontWeight: 700,
        });
        pushText({
          role: 'body',
          x: sx + 36,
          y: 495,
          width: 448,
          height: 350,
          content: s.body,
          fontSize: 25,
          color: theme.mutedTextColor,
          lineHeight: 1.5,
        });
        if (i < 2) {
          elements.push({
            id: uid('shp'),
            type: 'shape',
            shapeKind: 'arrow',
            x: sx + 530,
            y: 575,
            width: 55,
            height: 30,
            fillColor: theme.accentColor,
            strokeColor: theme.accentColor,
            strokeWidth: 5,
            arrowEnd: true,
            zIndex: z++,
          });
        }
      });
      break;
    }

    case 'quote': {
      pushCard(140, 180, 1640, 720);
      pushText({
        role: 'kicker',
        x: 220,
        y: 250,
        width: 1480,
        height: 45,
        content: kickerText,
        fontFamily: theme.monoFont,
        fontSize: 20,
        fontWeight: 600,
        color: theme.accentColor,
      });
      pushText({
        role: 'quote',
        x: 220,
        y: 330,
        width: 1480,
        height: 360,
        content:
          headingText === 'Slide Headline'
            ? '“Space is created not by where the ball goes, but by the synchronized timing of the players who are not receiving it.”'
            : headingText,
        fontFamily: theme.headingFont,
        fontSize: 58,
        fontWeight: 600,
        italic: true,
        lineHeight: 1.3,
      });
      pushText({
        role: 'subheading',
        x: 220,
        y: 740,
        width: 1480,
        height: 60,
        content: subheadingText,
        fontSize: 26,
        color: theme.mutedTextColor,
      });
      break;
    }

    case 'full-image': {
      if (existingVisual) {
        elements.push({
          ...existingVisual,
          x: 60,
          y: 60,
          width: 1800,
          height: 820,
          zIndex: z++,
        });
      } else {
        elements.push({
          id: uid('vpl'),
          type: 'video-playlist',
          x: 60,
          y: 60,
          width: 1800,
          height: 820,
          zIndex: z++,
          title: 'Full Video Playlist Reel',
          clips: [],
          loop: true,
          muted: false,
          showOverlayHud: true,
          showClipStrip: true,
          accentColor: theme.accentColor,
          backgroundColor: theme.surfaceColor,
          borderRadius: 20,
        });
      }
      pushCard(60, 900, 1800, 120);
      pushText({
        role: 'heading',
        x: 100,
        y: 924,
        width: 1000,
        height: 70,
        content: headingText,
        fontFamily: theme.headingFont,
        fontSize: 38,
        fontWeight: 700,
      });
      pushText({
        role: 'subheading',
        x: 1120,
        y: 932,
        width: 700,
        height: 60,
        content: subheadingText,
        fontSize: 22,
        textAlign: 'right',
        color: theme.mutedTextColor,
      });
      break;
    }

    case 'conclusion': {
      pushText({
        role: 'kicker',
        x: 120,
        y: 120,
        width: 1680,
        height: 45,
        content: 'SUMMARY & NEXT ACTIONS',
        fontFamily: theme.monoFont,
        fontSize: 20,
        fontWeight: 700,
        color: theme.accentColor,
      });
      pushText({
        role: 'heading',
        x: 120,
        y: 180,
        width: 1680,
        height: 120,
        content: headingText === 'Slide Headline' ? 'Key Matchday Takeaways' : headingText,
        fontFamily: theme.headingFont,
        fontSize: 66,
        fontWeight: 800,
      });
      pushCard(120, 340, 1680, 560);
      pushText({
        role: 'body',
        x: 180,
        y: 400,
        width: 1560,
        height: 440,
        content:
          overrides?.body ||
          '01. Lock down central progression by screening the opposition #6.\n02. Attack weak-side half-space immediately upon ball recovery.\n03. Rehearse attacking corner near-post flick routines on Friday MD-1.',
        fontSize: 32,
        lineHeight: 1.75,
      });
      break;
    }

    case 'diagram': {
      pushText({
        role: 'heading',
        x: 100,
        y: 75,
        width: 1720,
        height: 90,
        content: headingText === 'Slide Headline' ? 'Tactical Phase Diagram' : headingText,
        fontFamily: theme.headingFont,
        fontSize: 52,
        fontWeight: 700,
      });
      elements.push({
        id: uid('diag'),
        type: 'svg-diagram',
        x: 100,
        y: 200,
        width: 1720,
        height: 780,
        zIndex: z++,
        diagramStyle: 'flow',
        title: 'Transition Decision Tree',
        accentColor: theme.accentColor,
        textColor: theme.textColor,
        surfaceColor: theme.surfaceColor,
        nodes: [
          { id: 'n1', label: 'Ball Recovery', sublabel: 'Middle Third', x: 15, y: 50, color: theme.accentColor },
          { id: 'n2', label: 'Vertical Outlet', sublabel: 'Space Behind?', x: 45, y: 28, color: theme.secondaryColor },
          { id: 'n3', label: 'Secure Possession', sublabel: 'Switch Flank', x: 45, y: 74, color: theme.surfaceColor },
          { id: 'n4', label: 'Final-Third Entry', sublabel: 'Half-Space Run', x: 80, y: 50, color: theme.accentColor },
        ],
        edges: [
          { from: 'n1', to: 'n2', label: 'Press Open' },
          { from: 'n1', to: 'n3', label: 'Press Compact', dashed: true },
          { from: 'n2', to: 'n4', label: '3rd Man' },
          { from: 'n3', to: 'n4', label: 'Isolate 1v1' },
        ],
      });
      break;
    }

    case 'data-viz': {
      pushText({
        role: 'kicker',
        x: 100,
        y: 80,
        width: 1720,
        height: 36,
        content: kickerText,
        fontFamily: theme.monoFont,
        fontSize: 18,
        fontWeight: 600,
        color: theme.accentColor,
      });
      pushText({
        role: 'heading',
        x: 100,
        y: 128,
        width: 1720,
        height: 95,
        content: headingText === 'Slide Headline' ? 'Expected Threat & Zone Output' : headingText,
        fontFamily: theme.headingFont,
        fontSize: 54,
        fontWeight: 700,
      });
      elements.push({
        id: uid('cht'),
        type: 'chart',
        chartKind: 'bar',
        x: 100,
        y: 260,
        width: 1120,
        height: 700,
        zIndex: z++,
        title: 'xT Contribution by Zone (90 mins)',
        primaryLabel: 'Us',
        secondaryLabel: 'Opponent',
        textColor: theme.textColor,
        accentColor: theme.accentColor,
        secondaryColor: theme.secondaryColor,
        backgroundColor: theme.surfaceColor,
        borderColor: theme.surfaceBorderColor,
        showGrid: true,
        showValues: true,
        data: [
          { label: 'Left Wing', value: 42, secondaryValue: 28 },
          { label: 'Left Half-Space', value: 68, secondaryValue: 31 },
          { label: 'Zone 14', value: 54, secondaryValue: 46 },
          { label: 'Right Half-Space', value: 74, secondaryValue: 24 },
          { label: 'Right Wing', value: 39, secondaryValue: 35 },
        ],
      });
      pushCard(1260, 260, 560, 700);
      pushText({
        role: 'subheading',
        x: 1300,
        y: 305,
        width: 480,
        height: 60,
        content: 'Analytical Summary',
        fontFamily: theme.headingFont,
        fontSize: 32,
        fontWeight: 700,
        color: theme.accentColor,
      });
      pushText({
        role: 'body',
        x: 1300,
        y: 390,
        width: 480,
        height: 520,
        content: primaryBody,
        fontSize: 24,
        lineHeight: 1.55,
      });
      break;
    }
  }

  return {
    id: uid('slide'),
    title: overrides?.title || headingText || 'Untitled Slide',
    layout,
    background: { type: 'solid', color: theme.backgroundColor },
    transition: 'fade',
    speakerNotes: '',
    elements,
  };
}

export interface PresentationTemplateMeta {
  id: string;
  name: string;
  description: string;
  themeId: ThemeId;
  category: 'Football' | 'General';
  buildSlides: () => Slide[];
}

export const PRESENTATION_TEMPLATES: PresentationTemplateMeta[] = [
  {
    id: 'blank',
    name: 'Blank Presentation',
    description: 'Clean 16:9 dark canvas ready for manual element design.',
    themeId: 'dark-professional',
    category: 'General',
    buildSlides: () => {
      const theme = SLIDE_THEMES['dark-professional'];
      return [createSlideFromLayout('title', theme, { title: 'Title Slide' })];
    },
  },
  {
    id: 'match-tactical-review',
    name: 'Match Tactical Review',
    description: 'Post-match breakdown with video playlist slots, stats, and takeaways.',
    themeId: 'dark-professional',
    category: 'Football',
    buildSlides: () => {
      const theme = SLIDE_THEMES['dark-professional'];
      return [
        createSlideFromLayout('title', theme, {
          title: 'Matchday Briefing',
          kicker: 'POST-MATCH TACTICAL ANALYSIS',
          heading: 'Midfield Control & Pressing Traps',
          subheading: 'How our 4-3-3 out-of-possession structure disrupted central progression.',
        }),
        createSlideFromLayout('text-image', theme, {
          title: 'Build-Up vs High Press',
          kicker: 'PHASE 01 · IN POSSESSION',
          heading: 'Creating Numerical Superiority in Zone 14',
          subheading: 'Inverted full-back movement unlocked central progression.',
          body: '• Left-back stepped inside alongside #6 to form 3-2 rest shape\n• Opponent midfielders forced into 2v3 dilemma\n• Direct diagonal switches isolated our right winger 1v1',
        }),
        createSlideFromLayout('statistics', theme, {
          title: 'Key Match Metrics',
          kicker: 'PERFORMANCE KPI SNAPSHOT',
          heading: 'Territorial Dominance & Recovery Speed',
        }),
        createSlideFromLayout('data-viz', theme, {
          title: 'Zone Threat Output',
          kicker: 'DATA VISUALISATION',
          heading: 'Half-Space Threat Generation',
          body: '• Right half-space generated 74% more expected threat than opponent\n• Zone 14 entries increased 2.1x after minute 35 tactical shift',
        }),
        createSlideFromLayout('conclusion', theme, {
          title: 'Training Focus',
          heading: 'Next Session Objectives',
        }),
      ];
    },
  },
  {
    id: 'opposition-scouting',
    name: 'Opposition Scouting Report',
    description: 'Structured scouting deck with timeline, comparison, and tactical flow diagram.',
    themeId: 'contemporary',
    category: 'Football',
    buildSlides: () => {
      const theme = SLIDE_THEMES['contemporary'];
      return [
        createSlideFromLayout('title', theme, {
          title: 'Scouting Dossier',
          kicker: 'OPPOSITION ANALYSIS',
          heading: 'Neutralizing Their Left-Side Overload',
          subheading: 'Tactical blueprint for Saturday away fixture.',
        }),
        createSlideFromLayout('comparison', theme, {
          title: 'Pressing Options',
          heading: 'Pressing Strategy Alternatives',
        }),
        createSlideFromLayout('diagram', theme, {
          title: 'Transition Triggers',
          heading: 'Counter-Attack Decision Model',
        }),
        createSlideFromLayout('timeline', theme, {
          title: '90-Minute Game Plan',
          heading: 'Match Phase Adjustments',
        }),
      ];
    },
  },
  {
    id: 'coaching-workshop',
    name: 'Coaching Methodology',
    description: 'Editorial style framework for club philosophy and training blocks.',
    themeId: 'editorial',
    category: 'General',
    buildSlides: () => {
      const theme = SLIDE_THEMES['editorial'];
      return [
        createSlideFromLayout('title', theme, {
          title: 'Game Model',
          kicker: 'CLUB METHODOLOGY',
          heading: 'Principles of Positional Play',
          subheading: 'Shared tactical language across academy and first-team groups.',
        }),
        createSlideFromLayout('three-column', theme, {
          title: 'Three Pillars',
          heading: 'Core Moments of the Game',
        }),
        createSlideFromLayout('quote', theme, {
          title: 'Guiding Principle',
          kicker: 'COACHING PHILOSOPHY',
          subheading: 'Positional Play Principle #1',
        }),
      ];
    },
  },
];

export function createPresentationFromTemplate(
  templateId: string,
  title?: string,
  description?: string
): PresentationProject {
  const tpl = PRESENTATION_TEMPLATES.find((t) => t.id === templateId) || PRESENTATION_TEMPLATES[0];
  const slides = tpl.buildSlides();
  const now = Date.now();
  return {
    id: uid('pres'),
    title: title?.trim() || (tpl.id === 'blank' ? 'Untitled Presentation' : tpl.name),
    description: description?.trim() || tpl.description,
    themeId: tpl.themeId,
    sections: [{ id: 'sec_main', title: 'Main Deck' }],
    slides,
    createdAt: now,
    updatedAt: now,
    favourite: false,
    aspectRatio: '16:9',
  };
}
