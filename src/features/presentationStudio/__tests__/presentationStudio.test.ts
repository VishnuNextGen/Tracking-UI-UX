import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  PRESENTATION_TEMPLATES,
  SLIDE_LAYOUTS,
  SLIDE_THEMES,
  createSlideFromLayout,
} from '../constants/themesAndLayouts';
import {
  alignElements,
  applyThemeToPresentation,
  createNewElement,
  reorderElementLayer,
  switchSlideLayoutPreservingContent,
} from '../editor/elementOperations';
import {
  extractJsonFromModelOutput,
  parseAIDeckResponse,
  parseAISlideAlternatives,
  parseAITextRewrite,
  parseAISingleElementResponse,
} from '../engine/slideParser';
import {
  extractClipsFromPlaylist,
  formatReelTime,
} from '../storage/playlistVideoResolver';
import {
  buildBoardPlaybackTimeline,
  detectBoardSlideHasAnimations,
  getPreferredPreviewSlideIndex,
  normalizeBoardProjectData,
  resolveSlideCoinSettings,
} from '../storage/boardProjectResolver';
import { drawBoardToCanvas, drawStaticBackgroundToCanvas } from '../../../board/canvasRenderer';
import { PitchTemplate, PitchView, TeamSide, ToolType, type Project as TacticalProject } from '../../../board/types';
import type { PresentationProject } from '../types/presentation';
import type { Project } from '../../../types';

test('all slide themes and starting templates produce valid 16:9 structured slides', () => {
  assert.equal(Object.keys(SLIDE_THEMES).length, 7);
  assert.equal(PRESENTATION_TEMPLATES.length, 4);
  assert.equal(SLIDE_LAYOUTS.length, 14);

  const theme = SLIDE_THEMES['dark-professional'];
  for (const layoutMeta of SLIDE_LAYOUTS) {
    const slide = createSlideFromLayout(layoutMeta.id, theme);
    assert.ok(slide.id.startsWith('slide_'));
    assert.equal(slide.layout, layoutMeta.id);
    assert.ok(slide.elements.length > 0, `Layout ${layoutMeta.id} should contain elements`);
    for (const el of slide.elements) {
      assert.ok(el.x >= 0 && el.x < CANVAS_WIDTH);
      assert.ok(el.y >= 0 && el.y < CANVAS_HEIGHT);
      assert.ok(el.width > 0 && el.height > 0);
    }
  }
});

test('element operations align, reorder layers, switch theme, and switch layout cleanly', () => {
  const darkTheme = SLIDE_THEMES['dark-professional'];
  const minimalTheme = SLIDE_THEMES.minimal;

  const slide = createSlideFromLayout('two-column', darkTheme);
  const newPlaylist = createNewElement('video-playlist', darkTheme, 10);
  const newChart = createNewElement('chart', darkTheme, 11);
  assert.equal(newPlaylist.type, 'video-playlist');
  assert.equal(newChart.type, 'chart');

  const elements = [...slide.elements, newPlaylist, newChart];
  const centerAligned = alignElements(elements, [newPlaylist.id], 'center');
  const alignedPlaylist = centerAligned.find((e) => e.id === newPlaylist.id)!;
  assert.equal(Math.round(alignedPlaylist.x + alignedPlaylist.width / 2), CANVAS_WIDTH / 2);

  const broughtFront = reorderElementLayer(elements, slide.elements[0].id, 'front');
  const maxZ = Math.max(...broughtFront.map((e) => e.zIndex));
  assert.equal(broughtFront.find((e) => e.id === slide.elements[0].id)!.zIndex, maxZ);

  const mockProject: PresentationProject = {
    id: 'pres_test',
    title: 'Pressing Trap Review',
    description: 'Unit test deck',
    themeId: 'dark-professional',
    sections: [{ id: 'sec_1', title: 'Main' }],
    slides: [slide],
    createdAt: 1,
    updatedAt: 1,
    favourite: false,
    aspectRatio: '16:9',
  };

  const rethemed = applyThemeToPresentation(mockProject, 'minimal');
  assert.equal(rethemed.themeId, 'minimal');
  assert.equal(rethemed.slides[0].background.color, minimalTheme.backgroundColor);

  const relayout = switchSlideLayoutPreservingContent(slide, 'comparison', darkTheme);
  assert.equal(relayout.layout, 'comparison');
  assert.ok(relayout.elements.length >= 3);
});

test('AI slideParser extracts fenced JSON, validates via Zod, and clamps coordinates inside 1920x1080', () => {
  const fencedDeck = [
    'Here is your deck:',
    '```json',
    JSON.stringify({
      title: 'High Press Triggers',
      description: 'Tactical briefing',
      themeId: 'editorial',
      slides: [
        {
          title: 'Trigger Zones',
          layout: 'text-image',
          speakerNotes: 'Focus on touchline trap',
          elements: [
            {
              type: 'text',
              role: 'heading',
              x: -50,
              y: 40,
              width: 2400,
              height: 120,
              content: 'Touchline Pressing Trap',
            },
            {
              type: 'video-playlist',
              x: 980,
              y: 220,
              width: 820,
              height: 540,
              title: 'Pressing Trap Video Reel',
            },
          ],
        },
      ],
    }),
    '```',
  ].join('\n');

  const deck = parseAIDeckResponse(fencedDeck);
  assert.equal(deck.title, 'High Press Triggers');
  assert.equal(deck.themeId, 'editorial');
  assert.equal(deck.slides.length, 1);

  const firstEl = deck.slides[0].elements[0];
  assert.equal(firstEl.x, 0);
  assert.ok(firstEl.x + firstEl.width <= CANVAS_WIDTH);
  assert.equal(deck.slides[0].elements[1].type, 'video-playlist');

  const rewrite = parseAITextRewrite(
    JSON.stringify({ rewrittenText: 'Trigger on backward pass', rationale: 'More concise' })
  );
  assert.equal(rewrite.rewrittenText, 'Trigger on backward pass');

  const alt = parseAISlideAlternatives(
    JSON.stringify({
      summary: 'Two options',
      alternatives: [
        {
          title: 'Option A',
          layout: 'statistics',
          elements: [{ type: 'text', role: 'heading', x: 100, y: 100, width: 600, height: 80, content: 'KPIs' }],
        },
      ],
    }),
    SLIDE_THEMES['dark-professional']
  );
  assert.equal(alt.alternatives.length, 1);

  const generatedEl = parseAISingleElementResponse(
    JSON.stringify({
      rationale: 'Added a donut chart of chance quality',
      element: {
        type: 'chart',
        chartKind: 'donut',
        x: 200,
        y: 250,
        width: 500,
        height: 450,
        title: 'xG Zones',
        data: [{ label: 'Central', value: 64 }],
      },
    }),
    SLIDE_THEMES['dark-professional'],
    8
  );
  assert.equal(generatedEl.element.type, 'chart');
  assert.equal(generatedEl.element.zIndex, 8);

  assert.throws(() => extractJsonFromModelOutput('not valid json at all'));
});

test('extractClipsFromPlaylist resolves clips from multiple analysis projects into unified sequence', () => {
  const projA = {
    id: 'proj_a',
    name: 'Match 1 vs Arsenal',
    createdAt: 1,
    updatedAt: 1,
    data: {
      tags: [{ id: 'tag_press', name: 'High Press', color: '#22c55e', hotkey: '1' }],
      tagEvents: [
        { id: 'ev_1', tagId: 'tag_press', startTime: 12.5, endTime: 22.5, notes: 'Wing trap' },
      ],
      playlists: [],
    },
  } as unknown as Project;

  const projB = {
    id: 'proj_b',
    name: 'Match 2 vs Chelsea',
    createdAt: 2,
    updatedAt: 2,
    data: {
      tags: [{ id: 'tag_trans', name: 'Transition', color: '#38bdf8', hotkey: '2' }],
      tagEvents: [
        { id: 'ev_2', tagId: 'tag_trans', startTime: 40, endTime: 55, notes: 'Central regain' },
      ],
      playlists: [],
    },
  } as unknown as Project;

  const clips = extractClipsFromPlaylist({
    playlist: {
      id: 'pl_multi',
      name: 'Pressing & Regains',
      events: [
        { instanceId: 'inst_1', eventId: 'ev_1', projectId: 'proj_a' },
        { instanceId: 'inst_2', eventId: 'ev_2', projectId: 'proj_b' },
      ],
    },
    allProjects: [projA, projB],
  });

  assert.equal(clips.length, 2);
  assert.equal(clips[0].projectId, 'proj_a');
  assert.equal(clips[0].tagName, 'High Press');
  assert.equal(clips[1].projectId, 'proj_b');
  assert.equal(clips[1].tagName, 'Transition');
  assert.equal(formatReelTime(65), '01:05');
});

test('tactical board resolver detects animated vs static slides, builds timelines, and preserves on relayout', () => {
  const boardProj: TacticalProject = {
    teams: {
      [TeamSide.HOME]: { id: TeamSide.HOME, name: 'Home', color: '#ef4444', players: [] },
      [TeamSide.AWAY]: { id: TeamSide.AWAY, name: 'Away', color: '#3b82f6', players: [] },
      [TeamSide.NEUTRAL]: { id: TeamSide.NEUTRAL, name: 'Neutral', color: '#eab308', players: [] },
    },
    slides: [
      {
        id: 's1',
        name: 'Setup',
        duration: 4,
        positions: { p1: { x: 100, y: 200 } },
        drawings: [],
        transitionSpeed: 1,
      },
      {
        id: 's2',
        name: 'Pressing Trap',
        duration: 3,
        positions: { p1: { x: 260, y: 180 } },
        drawings: [],
        transitionSpeed: 1.5,
      },
      {
        id: 's3',
        name: 'Hold Shape',
        duration: 5,
        positions: { p1: { x: 260, y: 180 } },
        drawings: [],
        transitionSpeed: 1,
      },
    ],
    currentSlideId: 's1',
    selectedSlideIds: ['s1'],
    pitchView: PitchView.HORIZONTAL,
    pitchWidth: 800,
    pitchHeight: 450,
  };

  assert.equal(detectBoardSlideHasAnimations(boardProj.slides, 0), false);
  assert.equal(detectBoardSlideHasAnimations(boardProj.slides, 1), true);
  assert.equal(detectBoardSlideHasAnimations(boardProj.slides, 2), false);

  const singleStaticTimeline = buildBoardPlaybackTimeline(boardProj, 'single-slide', 0);
  assert.equal(singleStaticTimeline.hasAnyAnimation, false);
  assert.equal(singleStaticTimeline.totalDurationMs, 0);

  const singleAnimatedTimeline = buildBoardPlaybackTimeline(boardProj, 'single-slide', 1);
  assert.equal(singleAnimatedTimeline.hasAnyAnimation, true);
  assert.equal(singleAnimatedTimeline.segments.length, 1);
  assert.ok(singleAnimatedTimeline.totalDurationMs > 1500);

  const allSlidesTimeline = buildBoardPlaybackTimeline(boardProj, 'all-slides');
  assert.equal(allSlidesTimeline.segments.length, 3);
  assert.equal(allSlidesTimeline.hasAnyAnimation, true);
  assert.ok(allSlidesTimeline.totalDurationMs >= 12000);

  const darkTheme = SLIDE_THEMES['dark-professional'];
  const baseSlide = createSlideFromLayout('full-image', darkTheme);
  const deck: PresentationProject = {
    id: 'pres_tb',
    title: 'Deck',
    description: '',
    themeId: 'dark-professional',
    sections: [{ id: 'sec_1', title: 'Main' }],
    slides: [
      {
        ...baseSlide,
        elements: [
          {
            id: 'tbd_1',
            type: 'tactical-board',
            x: 100,
            y: 100,
            width: 1200,
            height: 680,
            zIndex: 1,
            title: 'Board Reel',
            boardProjectId: 'bp_1',
            boardProjectName: 'Pressing Plan',
            pitchTemplate: 'theme-fresh',
            boardData: boardProj,
            importMode: 'all-slides',
            loop: true,
            accentColor: darkTheme.accentColor,
            backgroundColor: darkTheme.surfaceColor,
          },
        ],
      },
    ],
    createdAt: 1,
    updatedAt: 1,
    aspectRatio: '16:9',
  };

  const rethemed = applyThemeToPresentation(deck, 'minimal');
  assert.equal(rethemed.slides[0].elements[0].type, 'tactical-board');
  if (rethemed.slides[0].elements[0].type === 'tactical-board') {
    assert.equal(rethemed.slides[0].elements[0].accentColor, SLIDE_THEMES.minimal.accentColor);
  }

  const switched = switchSlideLayoutPreservingContent(deck.slides[0], 'full-image', darkTheme);
  assert.ok(switched.elements.some((el) => el.type === 'tactical-board'));
});

test('normalizeBoardProjectData handles blank slide 1, partial slides, coinSettings inheritance, and renders cleanly on canvas', () => {
  const partialRaw = {
    name: 'Transition Drill',
    pitchView: 'FULL',
    pitchTemplate: PitchTemplate.THEME_NIGHT,
    backgroundImage: 'data:image/png;base64,iVBORw0KGgo=',
    teams: {
      HOME: {
        id: TeamSide.HOME,
        name: 'Home',
        color: '#ef4444',
        players: [{ id: 'p_h1', number: '9', name: 'Striker', role: 'MAIN', isOnField: true }],
      },
      AWAY: { id: TeamSide.AWAY, name: 'Away', color: '#3b82f6', players: [] },
    },
    slides: [
      {
        id: 's_blank',
        name: 'Slide 1',
        duration: 3,
        positions: {},
        drawings: [],
        coinSettings: {
          showName: true,
          showNumber: true,
          showPositionLabel: false,
          shape: 'tactic',
          orientation: 'normal',
          globalScale: 1.1,
          globalTextScale: 1,
          globalNamePos: 'bottom',
          trails: { enabled: true, style: 'dashed', color: '#fbbf24', opacity: 0.7 },
          motionPaths: { enabled: true, color: '#ef4444' },
        },
      },
      {
        id: 's_action',
        name: 'Slide 2',
        duration: 4,
        positions: { p_h1: { x: 420, y: 260 } },
        drawings: [
          {
            id: 'arr_1',
            type: ToolType.ARROW,
            points: [{ x: 420, y: 260 }, { x: 640, y: 220 }],
            color: '#c6ff1f',
          },
        ],
      },
    ],
  };

  const normalized = normalizeBoardProjectData(partialRaw);
  assert.ok(normalized);
  assert.equal(normalized.pitchView, PitchView.HORIZONTAL);
  assert.equal(normalized.pitchTemplate, PitchTemplate.THEME_NIGHT);
  assert.equal(normalized.backgroundImage, 'data:image/png;base64,iVBORw0KGgo=');
  assert.ok(normalized.teams[TeamSide.NEUTRAL]);
  // Slide 2 should inherit Slide 1's coinSettings cleanly
  assert.equal(normalized.slides[1].coinSettings?.shape, 'tactic');
  // Slide 1 is blank, so preferred preview index picks Slide 2 (index 1)
  assert.equal(getPreferredPreviewSlideIndex(normalized), 1);

  const timeline = buildBoardPlaybackTimeline(normalized, 'all-slides');
  assert.equal(timeline.segments.length, 2);
  assert.ok(timeline.segments[1].transitionDurationMs > 0);
  assert.equal(timeline.segments[1].holdDurationMs, 4000);

  // Mock CanvasRenderingContext2D to verify static background + multi-slide rendering run cleanly
  const ops: string[] = [];
  const gradientMock = { addColorStop: () => {} };
  const mockCtx = {
    canvas: { width: 1000, height: 650 },
    save: () => ops.push('save'),
    restore: () => ops.push('restore'),
    scale: () => {},
    translate: () => {},
    rotate: () => {},
    transform: () => {},
    setTransform: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    bezierCurveTo: () => {},
    arc: () => {},
    arcTo: () => {},
    ellipse: () => {},
    rect: () => {},
    roundRect: () => {},
    clip: () => {},
    fill: () => ops.push('fill'),
    stroke: () => ops.push('stroke'),
    fillRect: () => ops.push('fillRect'),
    strokeRect: () => {},
    clearRect: () => {},
    fillText: () => ops.push('fillText'),
    strokeText: () => {},
    measureText: (txt: string) => ({ width: (txt?.length || 1) * 7 }),
    drawImage: () => ops.push('drawImage'),
    setLineDash: () => {},
    getLineDash: () => [],
    createLinearGradient: () => gradientMock,
    createRadialGradient: () => gradientMock,
    createPattern: () => null,
    globalAlpha: 1,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    font: '12px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    shadowColor: 'transparent',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  } as unknown as CanvasRenderingContext2D;

  drawStaticBackgroundToCanvas(mockCtx, normalized, null, PitchTemplate.THEME_NIGHT, 1000, 650, 1);
  assert.ok(ops.includes('fillRect'));
  assert.ok(ops.includes('fill'));

  ops.length = 0;
  const seg2 = timeline.segments[1];
  const coin = resolveSlideCoinSettings(seg2.slide, normalized.slides[0].coinSettings);
  drawBoardToCanvas(
    mockCtx,
    normalized,
    seg2.slide,
    seg2.previousSlide,
    1,
    coin,
    null,
    PitchTemplate.THEME_NIGHT,
    1000,
    650,
    1
  );
  assert.ok(ops.includes('fillText')); // Player number / name rendered
  assert.ok(ops.includes('stroke')); // Pitch markings and tactical arrow rendered
});

