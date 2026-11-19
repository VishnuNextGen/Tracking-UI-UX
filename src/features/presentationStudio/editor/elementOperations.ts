import type {
  Slide,
  SlideElement,
  SlideLayoutType,
  SlideTheme,
  ThemeId,
  PresentationProject,
} from '../types/presentation';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  SLIDE_THEMES,
  createSlideFromLayout,
  uid,
} from '../constants/themesAndLayouts';

export type ElementFactoryType =
  | 'heading'
  | 'subheading'
  | 'text'
  | 'rectangle'
  | 'circle'
  | 'line'
  | 'arrow'
  | 'icon'
  | 'chart'
  | 'table'
  | 'svg-diagram'
  | 'video-playlist'
  | 'player-card'
  | 'match-comparison';

export function createNewElement(kind: ElementFactoryType, theme: SlideTheme, maxZ: number): SlideElement {
  const zIndex = maxZ + 1;

  switch (kind) {
    case 'heading':
      return {
        id: uid('txt'),
        type: 'text',
        role: 'heading',
        content: 'New Section Heading',
        x: 160,
        y: 160,
        width: 1100,
        height: 110,
        zIndex,
        fontFamily: theme.headingFont,
        fontSize: 64,
        fontWeight: 700,
        textAlign: 'left',
        lineHeight: 1.15,
        letterSpacing: -0.01,
        color: theme.textColor,
      };
    case 'subheading':
      return {
        id: uid('txt'),
        type: 'text',
        role: 'subheading',
        content: 'Supporting tactical subtitle or context line',
        x: 160,
        y: 280,
        width: 980,
        height: 75,
        zIndex,
        fontFamily: theme.bodyFont,
        fontSize: 32,
        fontWeight: 500,
        textAlign: 'left',
        lineHeight: 1.35,
        letterSpacing: 0,
        color: theme.mutedTextColor,
      };
    case 'text':
      return {
        id: uid('txt'),
        type: 'text',
        role: 'body',
        content: '• Key tactical observation\n• Supporting detail or coaching cue',
        x: 200,
        y: 380,
        width: 760,
        height: 220,
        zIndex,
        fontFamily: theme.bodyFont,
        fontSize: 28,
        fontWeight: 400,
        textAlign: 'left',
        lineHeight: 1.5,
        letterSpacing: 0,
        color: theme.textColor,
      };
    case 'rectangle':
      return {
        id: uid('shp'),
        type: 'shape',
        shapeKind: 'rectangle',
        x: 660,
        y: 360,
        width: 600,
        height: 360,
        zIndex,
        fillColor: theme.surfaceColor,
        strokeColor: theme.accentColor,
        strokeWidth: 3,
        borderRadius: 20,
      };
    case 'circle':
      return {
        id: uid('shp'),
        type: 'shape',
        shapeKind: 'circle',
        x: 780,
        y: 360,
        width: 340,
        height: 340,
        zIndex,
        fillColor: theme.surfaceColor,
        strokeColor: theme.accentColor,
        strokeWidth: 4,
      };
    case 'line':
      return {
        id: uid('shp'),
        type: 'shape',
        shapeKind: 'line',
        x: 560,
        y: 520,
        width: 800,
        height: 24,
        zIndex,
        fillColor: theme.accentColor,
        strokeColor: theme.accentColor,
        strokeWidth: 6,
      };
    case 'arrow':
      return {
        id: uid('shp'),
        type: 'shape',
        shapeKind: 'arrow',
        x: 560,
        y: 510,
        width: 520,
        height: 36,
        zIndex,
        fillColor: theme.accentColor,
        strokeColor: theme.accentColor,
        strokeWidth: 6,
        arrowEnd: true,
      };
    case 'icon':
      return {
        id: uid('icn'),
        type: 'icon',
        iconName: 'Target',
        x: 880,
        y: 440,
        width: 120,
        height: 120,
        zIndex,
        color: theme.accentColor,
        backgroundColor: theme.surfaceColor,
        borderRadius: 24,
        padding: 20,
      };
    case 'chart':
      return {
        id: uid('cht'),
        type: 'chart',
        chartKind: 'bar',
        x: 420,
        y: 240,
        width: 1080,
        height: 600,
        zIndex,
        title: 'Expected Threat by Half-Space',
        primaryLabel: 'Our Team',
        secondaryLabel: 'Opponent',
        textColor: theme.textColor,
        accentColor: theme.accentColor,
        secondaryColor: theme.secondaryColor,
        backgroundColor: theme.surfaceColor,
        borderColor: theme.surfaceBorderColor,
        showGrid: true,
        showValues: true,
        data: [
          { label: '0-15m', value: 24, secondaryValue: 18 },
          { label: '15-30m', value: 46, secondaryValue: 22 },
          { label: '30-45m', value: 58, secondaryValue: 31 },
          { label: '45-60m', value: 64, secondaryValue: 27 },
          { label: '60-90m', value: 72, secondaryValue: 34 },
        ],
      };
    case 'table':
      return {
        id: uid('tbl'),
        type: 'table',
        x: 340,
        y: 260,
        width: 1240,
        height: 520,
        zIndex,
        headers: ['Phase', 'Primary Trigger', 'Target Zone', 'Success Rate'],
        rows: [
          ['High Press', 'Back-pass to LCB', 'Touchline Trap', '68%'],
          ['Mid-Block', 'Pivot receives facing own goal', 'Zone 14 Screen', '74%'],
          ['Transition', 'Ball recovery in middle third', 'Weak Half-Space', '59%'],
        ],
        headerBg: theme.accentColor,
        headerColor: theme.accentContrastColor,
        cellBg: theme.surfaceColor,
        altCellBg: theme.backgroundColor,
        cellColor: theme.textColor,
        borderColor: theme.surfaceBorderColor,
        fontSize: 22,
      };
    case 'svg-diagram':
      return {
        id: uid('diag'),
        type: 'svg-diagram',
        x: 240,
        y: 220,
        width: 1440,
        height: 640,
        zIndex,
        title: 'Pressing Trigger Flow',
        diagramStyle: 'flow',
        accentColor: theme.accentColor,
        textColor: theme.textColor,
        surfaceColor: theme.surfaceColor,
        nodes: [
          { id: 'n1', label: 'Ball to Full-Back', sublabel: 'Press Trigger', x: 18, y: 50 },
          { id: 'n2', label: 'Winger Curves Run', sublabel: 'Block Inside Lane', x: 50, y: 28 },
          { id: 'n3', label: 'Near #8 Steps Up', sublabel: 'Lock Touchline', x: 50, y: 74 },
          { id: 'n4', label: 'Win Possession', sublabel: 'Counter to #9', x: 82, y: 50 },
        ],
        edges: [
          { from: 'n1', to: 'n2', label: 'Jump' },
          { from: 'n1', to: 'n3', label: 'Support', dashed: true },
          { from: 'n2', to: 'n4' },
          { from: 'n3', to: 'n4' },
        ],
      };
    case 'video-playlist':
      return {
        id: uid('vpl'),
        type: 'video-playlist',
        x: 360,
        y: 160,
        width: 1200,
        height: 760,
        zIndex,
        title: 'Match Video Playlist',
        clips: [],
        loop: true,
        muted: false,
        showOverlayHud: true,
        showClipStrip: true,
        accentColor: theme.accentColor,
        backgroundColor: theme.surfaceColor,
        borderRadius: 20,
      };
    case 'player-card':
      return {
        id: uid('pcard'),
        type: 'player-card',
        x: 560,
        y: 300,
        width: 800,
        height: 440,
        zIndex,
        playerName: 'Midfield Playmaker',
        jerseyNumber: '8',
        position: 'CM',
        teamName: 'First Team',
        subtitle: 'Progressive Ball Carrier & Press Leader',
        accentColor: theme.accentColor,
        backgroundColor: theme.surfaceColor,
        textColor: theme.textColor,
        stats: [
          { label: 'Prog. Passes/90', value: '9.4' },
          { label: 'xA / 90', value: '0.34' },
          { label: 'Recoveries', value: '8.2' },
        ],
      };
    case 'match-comparison':
      return {
        id: uid('mcmp'),
        type: 'match-comparison',
        x: 460,
        y: 260,
        width: 1000,
        height: 540,
        zIndex,
        title: 'Post-Match Team Comparison',
        homeTeam: 'Home FC',
        awayTeam: 'Away United',
        homeScore: '3',
        awayScore: '1',
        homeColor: theme.accentColor,
        awayColor: theme.secondaryColor,
        backgroundColor: theme.surfaceColor,
        textColor: theme.textColor,
        metrics: [
          { label: 'Possession', homeValue: 61, awayValue: 39, unit: '%' },
          { label: 'Expected Goals (xG)', homeValue: 2.6, awayValue: 0.9 },
          { label: 'Final-Third Entries', homeValue: 54, awayValue: 28 },
          { label: 'PPDA (Lower = Stronger Press)', homeValue: 7.4, awayValue: 14.2 },
        ],
      };
  }
}

export function alignElements(
  elements: SlideElement[],
  selectedIds: string[],
  alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
): SlideElement[] {
  const selected = elements.filter((e) => selectedIds.includes(e.id) && !e.locked);
  if (selected.length === 0) return elements;

  const isSingle = selected.length === 1;
  const minX = isSingle ? 0 : Math.min(...selected.map((e) => e.x));
  const maxX = isSingle ? CANVAS_WIDTH : Math.max(...selected.map((e) => e.x + e.width));
  const minY = isSingle ? 0 : Math.min(...selected.map((e) => e.y));
  const maxY = isSingle ? CANVAS_HEIGHT : Math.max(...selected.map((e) => e.y + e.height));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return elements.map((el) => {
    if (!selectedIds.includes(el.id) || el.locked) return el;
    switch (alignment) {
      case 'left':
        return { ...el, x: isSingle ? 80 : minX };
      case 'center':
        return { ...el, x: Math.round(centerX - el.width / 2) };
      case 'right':
        return { ...el, x: isSingle ? CANVAS_WIDTH - 80 - el.width : maxX - el.width };
      case 'top':
        return { ...el, y: isSingle ? 80 : minY };
      case 'middle':
        return { ...el, y: Math.round(centerY - el.height / 2) };
      case 'bottom':
        return { ...el, y: isSingle ? CANVAS_HEIGHT - 80 - el.height : maxY - el.height };
    }
  });
}

export function reorderElementLayer(
  elements: SlideElement[],
  targetId: string,
  direction: 'front' | 'back' | 'forward' | 'backward'
): SlideElement[] {
  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  const idx = sorted.findIndex((e) => e.id === targetId);
  if (idx < 0) return elements;

  const item = sorted[idx];
  const next = [...sorted];
  next.splice(idx, 1);

  if (direction === 'front') {
    next.push(item);
  } else if (direction === 'back') {
    next.unshift(item);
  } else if (direction === 'forward') {
    next.splice(Math.min(next.length, idx + 1), 0, item);
  } else if (direction === 'backward') {
    next.splice(Math.max(0, idx - 1), 0, item);
  }

  return next.map((el, i) => ({ ...el, zIndex: i + 1 }));
}

export function applyThemeToPresentation(
  presentation: PresentationProject,
  newThemeId: ThemeId
): PresentationProject {
  const prevTheme = SLIDE_THEMES[presentation.themeId] || SLIDE_THEMES['dark-professional'];
  const nextTheme = SLIDE_THEMES[newThemeId] || SLIDE_THEMES['dark-professional'];

  return {
    ...presentation,
    themeId: newThemeId,
    slides: presentation.slides.map((slide) => ({
      ...slide,
      background:
        slide.background.color.toLowerCase() === prevTheme.backgroundColor.toLowerCase()
          ? { ...slide.background, color: nextTheme.backgroundColor }
          : slide.background,
      elements: slide.elements.map((el) => {
        if (el.type === 'text') {
          let nextColor = el.color;
          if (el.role === 'kicker' || el.role === 'stat-value') {
            nextColor = nextTheme.accentColor;
          } else if (el.role === 'subheading' && el.color.toLowerCase() === prevTheme.mutedTextColor.toLowerCase()) {
            nextColor = nextTheme.mutedTextColor;
          } else if (el.color.toLowerCase() === prevTheme.textColor.toLowerCase()) {
            nextColor = nextTheme.textColor;
          } else if (el.color.toLowerCase() === prevTheme.accentColor.toLowerCase()) {
            nextColor = nextTheme.accentColor;
          } else if (el.color.toLowerCase() === prevTheme.secondaryColor.toLowerCase()) {
            nextColor = nextTheme.secondaryColor;
          }
          const nextFont =
            el.role === 'heading' || el.role === 'subheading' || el.role === 'quote'
              ? nextTheme.headingFont
              : el.role === 'kicker' || el.role === 'stat-value'
              ? nextTheme.monoFont
              : nextTheme.bodyFont;
          return { ...el, color: nextColor, fontFamily: nextFont };
        }
        if (el.type === 'shape') {
          return {
            ...el,
            fillColor:
              el.fillColor.toLowerCase() === prevTheme.surfaceColor.toLowerCase()
                ? nextTheme.surfaceColor
                : el.fillColor.toLowerCase() === prevTheme.accentColor.toLowerCase()
                ? nextTheme.accentColor
                : el.fillColor,
            strokeColor:
              el.strokeColor.toLowerCase() === prevTheme.surfaceBorderColor.toLowerCase()
                ? nextTheme.surfaceBorderColor
                : el.strokeColor.toLowerCase() === prevTheme.accentColor.toLowerCase()
                ? nextTheme.accentColor
                : el.strokeColor,
          };
        }
        if (el.type === 'chart') {
          return {
            ...el,
            textColor: nextTheme.textColor,
            accentColor: nextTheme.accentColor,
            secondaryColor: nextTheme.secondaryColor,
            backgroundColor: nextTheme.surfaceColor,
            borderColor: nextTheme.surfaceBorderColor,
          };
        }
        if (el.type === 'table') {
          return {
            ...el,
            headerBg: nextTheme.accentColor,
            headerColor: nextTheme.accentContrastColor,
            cellBg: nextTheme.surfaceColor,
            cellColor: nextTheme.textColor,
            borderColor: nextTheme.surfaceBorderColor,
          };
        }
        if (el.type === 'svg-diagram') {
          return {
            ...el,
            accentColor: nextTheme.accentColor,
            textColor: nextTheme.textColor,
            surfaceColor: nextTheme.surfaceColor,
          };
        }
        if (el.type === 'player-card' || el.type === 'match-comparison') {
          return {
            ...el,
            backgroundColor: nextTheme.surfaceColor,
            textColor: nextTheme.textColor,
          };
        }
        if (el.type === 'video-playlist' || el.type === 'tactical-board') {
          return {
            ...el,
            accentColor: nextTheme.accentColor,
            backgroundColor: nextTheme.surfaceColor,
          };
        }
        return el;
      }),
    })),
  };
}

export function switchSlideLayoutPreservingContent(
  slide: Slide,
  nextLayout: SlideLayoutType,
  theme: SlideTheme
): Slide {
  const rebuilt = createSlideFromLayout(nextLayout, theme, {
    title: slide.title,
    existingElements: slide.elements,
  });
  return {
    ...slide,
    layout: nextLayout,
    elements: rebuilt.elements,
  };
}
