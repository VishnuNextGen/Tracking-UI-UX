import React from 'react';
import type { Slide, SlideElement, TextSlideElement } from '../types/presentation';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants/themesAndLayouts';
import { VideoPlaylistElementRenderer } from './elements/VideoPlaylistElementRenderer';
import { TacticalBoardElementRenderer } from './elements/TacticalBoardElementRenderer';
import { ChartElementRenderer } from './elements/ChartElementRenderer';
import {
  ImageElementRenderer,
  ShapeElementRenderer,
  IconElementRenderer,
  TableElementRenderer,
  SvgDiagramElementRenderer,
  PlayerCardElementRenderer,
  MatchComparisonElementRenderer,
} from './elements/StructuredElementsRenderer';

interface SlideRendererProps {
  slide: Slide;
  scale?: number;
  className?: string;
  interactive?: boolean;
  editingElementId?: string | null;
  onTextChange?: (elementId: string, nextText: string) => void;
  onStopTextEdit?: () => void;
  onOpenPlaylistImporter?: (elementId: string) => void;
  onOpenBoardImporter?: (elementId: string) => void;
}

export const SlideElementContent: React.FC<{
  element: SlideElement;
  interactive?: boolean;
  isEditingText?: boolean;
  onTextChange?: (nextText: string) => void;
  onStopTextEdit?: () => void;
  onOpenPlaylistImporter?: (elementId: string) => void;
  onOpenBoardImporter?: (elementId: string) => void;
}> = ({
  element,
  interactive = false,
  isEditingText,
  onTextChange,
  onStopTextEdit,
  onOpenPlaylistImporter,
  onOpenBoardImporter,
}) => {
  if (element.type === 'text') {
    const el = element as TextSlideElement;
    const justify =
      el.verticalAlign === 'middle'
        ? 'center'
        : el.verticalAlign === 'bottom'
        ? 'flex-end'
        : 'flex-start';

    if (isEditingText && onTextChange) {
      return (
        <textarea
          autoFocus
          value={el.content}
          onChange={(e) => onTextChange(e.target.value)}
          onBlur={onStopTextEdit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              onStopTextEdit?.();
            }
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full h-full resize-none bg-transparent outline-none focus:ring-2 focus:ring-[#c6ff1f]/60 rounded"
          style={{
            fontFamily: el.fontFamily,
            fontSize: el.fontSize,
            fontWeight: el.fontWeight,
            fontStyle: el.italic ? 'italic' : 'normal',
            textDecoration: el.underline ? 'underline' : 'none',
            textAlign: el.textAlign,
            lineHeight: el.lineHeight,
            letterSpacing: `${el.letterSpacing}em`,
            color: el.color,
            backgroundColor: el.backgroundColor || 'transparent',
            padding: el.padding ?? 4,
            borderRadius: el.borderRadius ?? 0,
          }}
        />
      );
    }

    return (
      <div
        className="w-full h-full flex flex-col whitespace-pre-wrap break-words overflow-hidden"
        style={{
          justifyContent: justify,
          fontFamily: el.fontFamily,
          fontSize: el.fontSize,
          fontWeight: el.fontWeight,
          fontStyle: el.italic ? 'italic' : 'normal',
          textDecoration: el.underline ? 'underline' : 'none',
          textAlign: el.textAlign,
          lineHeight: el.lineHeight,
          letterSpacing: `${el.letterSpacing}em`,
          color: el.color,
          backgroundColor: el.backgroundColor || 'transparent',
          padding: el.padding ?? 4,
          borderRadius: el.borderRadius ?? 0,
          border:
            el.borderWidth && el.borderWidth > 0
              ? `${el.borderWidth}px solid ${el.borderColor || 'transparent'}`
              : undefined,
        }}
      >
        {el.content}
      </div>
    );
  }

  switch (element.type) {
    case 'image':
      return <ImageElementRenderer element={element} />;
    case 'shape':
      return <ShapeElementRenderer element={element} />;
    case 'icon':
      return <IconElementRenderer element={element} />;
    case 'chart':
      return <ChartElementRenderer element={element} />;
    case 'table':
      return <TableElementRenderer element={element} />;
    case 'svg-diagram':
      return <SvgDiagramElementRenderer element={element} />;
    case 'video-playlist':
      return (
        <VideoPlaylistElementRenderer
          element={element}
          interactive={interactive}
          onOpenImporter={onOpenPlaylistImporter}
        />
      );
    case 'tactical-board':
      return (
        <TacticalBoardElementRenderer
          element={element}
          interactive={interactive}
          onOpenBoardImporter={onOpenBoardImporter}
        />
      );
    case 'player-card':
      return <PlayerCardElementRenderer element={element} />;
    case 'match-comparison':
      return <MatchComparisonElementRenderer element={element} />;
    default:
      return null;
  }
};

export const SlideRenderer: React.FC<SlideRendererProps> = ({
  slide,
  scale = 1,
  className = '',
  interactive = false,
  editingElementId,
  onTextChange,
  onStopTextEdit,
  onOpenPlaylistImporter,
  onOpenBoardImporter,
}) => {
  const bgStyle: React.CSSProperties =
    slide.background.type === 'gradient' && slide.background.gradientTo
      ? {
          background: `linear-gradient(${slide.background.gradientAngle ?? 135}deg, ${slide.background.color}, ${slide.background.gradientTo})`,
        }
      : {
          backgroundColor: slide.background.color,
        };

  const sortedElements = [...(slide.elements || [])]
    .filter((el) => el.visible !== false)
    .sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      className={`relative overflow-hidden select-none ${className}`}
      style={{
        width: CANVAS_WIDTH * scale,
        height: CANVAS_HEIGHT * scale,
      }}
    >
      <div
        className="origin-top-left relative"
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          transform: `scale(${scale})`,
          ...bgStyle,
        }}
      >
        {sortedElements.map((el) => (
          <div
            key={el.id}
            style={{
              position: 'absolute',
              left: el.x,
              top: el.y,
              width: el.width,
              height: el.height,
              transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
              opacity: el.opacity ?? 1,
              zIndex: el.zIndex,
            }}
          >
            <SlideElementContent
              element={el}
              interactive={interactive}
              isEditingText={editingElementId === el.id}
              onTextChange={onTextChange ? (val) => onTextChange(el.id, val) : undefined}
              onStopTextEdit={onStopTextEdit}
              onOpenPlaylistImporter={onOpenPlaylistImporter}
              onOpenBoardImporter={onOpenBoardImporter}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
