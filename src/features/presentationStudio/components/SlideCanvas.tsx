import React, { useEffect, useRef, useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Copy,
  Trash2,
  Lock,
  Unlock,
  RotateCw,
} from 'lucide-react';
import type { Slide, SlideElement } from '../types/presentation';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants/themesAndLayouts';
import { SlideElementContent } from '../renderer/SlideRenderer';

interface SlideCanvasProps {
  slide: Slide;
  selectedElementIds: string[];
  editingTextId: string | null;
  onSelectElements: (ids: string[], additive?: boolean) => void;
  onStartTextEdit: (id: string) => void;
  onStopTextEdit: () => void;
  onUpdateElement: (id: string, patch: Partial<SlideElement>, recordHistory?: boolean) => void;
  onUpdateMultipleElements: (patches: Record<string, Partial<SlideElement>>, recordHistory?: boolean) => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onOpenPlaylistImporter?: (elementId: string) => void;
  onOpenBoardImporter?: (elementId: string) => void;
}

type HandleDir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export const SlideCanvas: React.FC<SlideCanvasProps> = ({
  slide,
  selectedElementIds,
  editingTextId,
  onSelectElements,
  onStartTextEdit,
  onStopTextEdit,
  onUpdateElement,
  onUpdateMultipleElements,
  onDuplicateSelected,
  onDeleteSelected,
  onOpenPlaylistImporter,
  onOpenBoardImporter,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(0.5);
  const [zoomMultiplier, setZoomMultiplier] = useState(1);
  const [snapGuides, setSnapGuides] = useState<{ x: boolean; y: boolean }>({ x: false, y: false });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      const availW = Math.max(320, rect.width - 72);
      const availH = Math.max(200, rect.height - 88);
      const s = Math.min(availW / CANVAS_WIDTH, availH / CANVAS_HEIGHT);
      setFitScale(Math.max(0.15, Math.min(1.2, s)));
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = fitScale * zoomMultiplier;

  const bgStyle: React.CSSProperties =
    slide.background.type === 'gradient' && slide.background.gradientTo
      ? {
          background: `linear-gradient(${slide.background.gradientAngle ?? 135}deg, ${slide.background.color}, ${slide.background.gradientTo})`,
        }
      : {
          backgroundColor: slide.background.color,
        };

  const sortedElements = [...(slide.elements || [])]
    .filter((e) => e.visible !== false)
    .sort((a, b) => a.zIndex - b.zIndex);

  const startDragMove = (e: React.MouseEvent, el: SlideElement) => {
    if (editingTextId === el.id) return;
    e.stopPropagation();

    const additive = e.shiftKey;
    const alreadySelected = selectedElementIds.includes(el.id);
    const activeIds = alreadySelected
      ? selectedElementIds
      : additive
      ? [...selectedElementIds, el.id]
      : [el.id];

    if (!alreadySelected || additive) {
      onSelectElements([el.id], additive);
    }

    if (el.locked) return;

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const initialPositions = new Map<string, { x: number; y: number; w: number; h: number }>();
    slide.elements.forEach((item) => {
      if (activeIds.includes(item.id) && !item.locked) {
        initialPositions.set(item.id, {
          x: item.x,
          y: item.y,
          w: item.width,
          h: item.height,
        });
      }
    });

    let moved = false;

    const onMouseMove = (moveEvt: MouseEvent) => {
      const dx = (moveEvt.clientX - startMouseX) / scale;
      const dy = (moveEvt.clientY - startMouseY) / scale;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
      if (!moved) return;

      let snapDx = dx;
      let snapDy = dy;
      let snappedX = false;
      let snappedY = false;

      const primaryInit = initialPositions.get(el.id);
      if (primaryInit && initialPositions.size === 1) {
        const nextCenterX = primaryInit.x + dx + primaryInit.w / 2;
        const nextCenterY = primaryInit.y + dy + primaryInit.h / 2;
        if (Math.abs(nextCenterX - CANVAS_WIDTH / 2) < 14) {
          snapDx = CANVAS_WIDTH / 2 - primaryInit.w / 2 - primaryInit.x;
          snappedX = true;
        }
        if (Math.abs(nextCenterY - CANVAS_HEIGHT / 2) < 14) {
          snapDy = CANVAS_HEIGHT / 2 - primaryInit.h / 2 - primaryInit.y;
          snappedY = true;
        }
      }

      setSnapGuides({ x: snappedX, y: snappedY });

      const patches: Record<string, Partial<SlideElement>> = {};
      initialPositions.forEach((init, id) => {
        patches[id] = {
          x: Math.round(init.x + snapDx),
          y: Math.round(init.y + snapDy),
        };
      });
      onUpdateMultipleElements(patches, false);
    };

    const onMouseUp = (upEvt: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setSnapGuides({ x: false, y: false });
      if (moved) {
        const dx = (upEvt.clientX - startMouseX) / scale;
        const dy = (upEvt.clientY - startMouseY) / scale;
        const patches: Record<string, Partial<SlideElement>> = {};
        initialPositions.forEach((init, id) => {
          let nextX = Math.round(init.x + dx);
          let nextY = Math.round(init.y + dy);
          if (initialPositions.size === 1) {
            if (Math.abs(nextX + init.w / 2 - CANVAS_WIDTH / 2) < 14) {
              nextX = Math.round(CANVAS_WIDTH / 2 - init.w / 2);
            }
            if (Math.abs(nextY + init.h / 2 - CANVAS_HEIGHT / 2) < 14) {
              nextY = Math.round(CANVAS_HEIGHT / 2 - init.h / 2);
            }
          }
          patches[id] = { x: nextX, y: nextY };
        });
        onUpdateMultipleElements(patches, true);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const startResize = (e: React.MouseEvent, el: SlideElement, dir: HandleDir) => {
    e.stopPropagation();
    if (el.locked) return;

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const init = { x: el.x, y: el.y, w: el.width, h: el.height };

    const computeRect = (clientX: number, clientY: number) => {
      const dx = (clientX - startMouseX) / scale;
      const dy = (clientY - startMouseY) / scale;
      let x = init.x;
      let y = init.y;
      let width = init.w;
      let height = init.h;

      if (dir.includes('e')) width = Math.max(24, init.w + dx);
      if (dir.includes('s')) height = Math.max(16, init.h + dy);
      if (dir.includes('w')) {
        const nextW = Math.max(24, init.w - dx);
        x = init.x + (init.w - nextW);
        width = nextW;
      }
      if (dir.includes('n')) {
        const nextH = Math.max(16, init.h - dy);
        y = init.y + (init.h - nextH);
        height = nextH;
      }
      return {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
      };
    };

    const onMouseMove = (moveEvt: MouseEvent) => {
      onUpdateElement(el.id, computeRect(moveEvt.clientX, moveEvt.clientY), false);
    };

    const onMouseUp = (upEvt: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      onUpdateElement(el.id, computeRect(upEvt.clientX, upEvt.clientY), true);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const startRotate = (e: React.MouseEvent, el: SlideElement, boxEl: HTMLDivElement | null) => {
    e.stopPropagation();
    if (el.locked || !boxEl) return;
    const rect = boxEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const getAngle = (clientX: number, clientY: number) => {
      const rad = Math.atan2(clientY - cy, clientX - cx);
      let deg = Math.round((rad * 180) / Math.PI + 90);
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      return deg;
    };

    const onMouseMove = (moveEvt: MouseEvent) => {
      onUpdateElement(el.id, { rotation: getAngle(moveEvt.clientX, moveEvt.clientY) }, false);
    };
    const onMouseUp = (upEvt: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      onUpdateElement(el.id, { rotation: getAngle(upEvt.clientX, upEvt.clientY) }, true);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const singleSelected =
    selectedElementIds.length === 1
      ? slide.elements.find((e) => e.id === selectedElementIds[0])
      : undefined;

  return (
    <div
      ref={containerRef}
      onClick={() => {
        onSelectElements([], false);
        onStopTextEdit();
      }}
      className="flex-1 min-w-0 h-full bg-[#090b10] relative overflow-auto flex flex-col items-center justify-center p-6"
    >
      {/* Floating quick action pill when an element is selected */}
      {selectedElementIds.length > 0 && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#151822]/95 border border-white/15 shadow-2xl backdrop-blur-md text-xs"
        >
          <span className="text-[11px] font-mono text-white/60 px-1.5">
            {selectedElementIds.length} selected
          </span>
          <div className="h-3.5 w-px bg-white/10" />
          <button
            type="button"
            onClick={onDuplicateSelected}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/75 hover:text-white cursor-pointer"
            title="Duplicate (Ctrl/Cmd + D)"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          {singleSelected && (
            <button
              type="button"
              onClick={() => onUpdateElement(singleSelected.id, { locked: !singleSelected.locked })}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/75 hover:text-white cursor-pointer"
              title={singleSelected.locked ? 'Unlock element' : 'Lock element'}
            >
              {singleSelected.locked ? (
                <Unlock className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Lock className="w-3.5 h-3.5" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onDeleteSelected}
            className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/75 hover:text-red-400 cursor-pointer"
            title="Delete (Backspace / Delete)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 16:9 Scaled Stage */}
      <div
        className="relative shadow-2xl rounded-lg overflow-hidden ring-1 ring-white/15 shrink-0"
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
          {/* Alignment Snap Guides */}
          {snapGuides.x && (
            <div className="absolute inset-y-0 left-1/2 w-[2px] bg-[#c6ff1f]/80 pointer-events-none z-[999]" />
          )}
          {snapGuides.y && (
            <div className="absolute inset-x-0 top-1/2 h-[2px] bg-[#c6ff1f]/80 pointer-events-none z-[999]" />
          )}

          {sortedElements.map((el) => {
            const isSelected = selectedElementIds.includes(el.id);
            const isEditingText = editingTextId === el.id;

            return (
              <InteractiveElementBox
                key={el.id}
                element={el}
                scale={scale}
                isSelected={isSelected}
                isSingleSelected={isSelected && selectedElementIds.length === 1}
                isEditingText={isEditingText}
                onMouseDown={(e) => startDragMove(e, el)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (el.type === 'text' && !el.locked) {
                    onStartTextEdit(el.id);
                  }
                }}
                onResizeStart={(e, dir) => startResize(e, el, dir)}
                onRotateStart={(e, box) => startRotate(e, el, box)}
                onTextChange={(txt) => onUpdateElement(el.id, { content: txt }, true)}
                onStopTextEdit={onStopTextEdit}
                onOpenPlaylistImporter={onOpenPlaylistImporter}
                onOpenBoardImporter={onOpenBoardImporter}
              />
            );
          })}
        </div>
      </div>

      {/* Bottom Zoom Controls */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-3 right-4 z-30 flex items-center gap-1 px-2 py-1 rounded-xl bg-[#151822]/90 border border-white/10 text-xs text-white/75 backdrop-blur-md"
      >
        <button
          type="button"
          onClick={() => setZoomMultiplier((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))))}
          className="p-1 rounded hover:bg-white/10 cursor-pointer"
          title="Zoom out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="font-mono text-[11px] px-1.5 tabular-nums min-w-[46px] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setZoomMultiplier((z) => Math.min(2, Number((z + 0.15).toFixed(2))))}
          className="p-1 rounded hover:bg-white/10 cursor-pointer"
          title="Zoom in"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setZoomMultiplier(1)}
          className="p-1 rounded hover:bg-white/10 cursor-pointer"
          title="Fit to screen"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

const HANDLE_POSITIONS: Array<{ dir: HandleDir; style: React.CSSProperties; cursor: string }> = [
  { dir: 'nw', style: { top: -6, left: -6 }, cursor: 'nwse-resize' },
  { dir: 'n', style: { top: -6, left: '50%', transform: 'translateX(-50%)' }, cursor: 'ns-resize' },
  { dir: 'ne', style: { top: -6, right: -6 }, cursor: 'nesw-resize' },
  { dir: 'e', style: { top: '50%', right: -6, transform: 'translateY(-50%)' }, cursor: 'ew-resize' },
  { dir: 'se', style: { bottom: -6, right: -6 }, cursor: 'nwse-resize' },
  { dir: 's', style: { bottom: -6, left: '50%', transform: 'translateX(-50%)' }, cursor: 'ns-resize' },
  { dir: 'sw', style: { bottom: -6, left: -6 }, cursor: 'nesw-resize' },
  { dir: 'w', style: { top: '50%', left: -6, transform: 'translateY(-50%)' }, cursor: 'ew-resize' },
];

const InteractiveElementBox: React.FC<{
  element: SlideElement;
  scale: number;
  isSelected: boolean;
  isSingleSelected: boolean;
  isEditingText: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, dir: HandleDir) => void;
  onRotateStart: (e: React.MouseEvent, boxEl: HTMLDivElement | null) => void;
  onTextChange: (nextText: string) => void;
  onStopTextEdit: () => void;
  onOpenPlaylistImporter?: (elementId: string) => void;
  onOpenBoardImporter?: (elementId: string) => void;
}> = ({
  element,
  scale,
  isSelected,
  isSingleSelected,
  isEditingText,
  onMouseDown,
  onDoubleClick,
  onResizeStart,
  onRotateStart,
  onTextChange,
  onStopTextEdit,
  onOpenPlaylistImporter,
  onOpenBoardImporter,
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const handleScale = 1 / Math.max(0.25, scale);

  return (
    <div
      ref={boxRef}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
        opacity: element.opacity ?? 1,
        zIndex: element.zIndex,
        cursor: element.locked ? 'not-allowed' : isEditingText ? 'text' : 'move',
      }}
      className={`group/el ${
        isSelected
          ? `outline outline-[3px] ${element.locked ? 'outline-amber-400' : 'outline-[#c6ff1f]'}`
          : 'hover:outline hover:outline-2 hover:outline-white/35'
      }`}
    >
      <SlideElementContent
        element={element}
        interactive={true}
        isEditingText={isEditingText}
        onTextChange={onTextChange}
        onStopTextEdit={onStopTextEdit}
        onOpenPlaylistImporter={onOpenPlaylistImporter}
        onOpenBoardImporter={onOpenBoardImporter}
      />

      {isSingleSelected && !element.locked && !isEditingText && (
        <>
          {HANDLE_POSITIONS.map((h) => (
            <div
              key={h.dir}
              onMouseDown={(e) => onResizeStart(e, h.dir)}
              style={{
                position: 'absolute',
                width: 12 * handleScale,
                height: 12 * handleScale,
                cursor: h.cursor,
                ...h.style,
              }}
              className="bg-white border-2 border-[#090b10] rounded-sm shadow z-50"
            />
          ))}

          {/* Rotation Handle */}
          <div
            onMouseDown={(e) => onRotateStart(e, boxRef.current)}
            style={{
              position: 'absolute',
              top: -38 * handleScale,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 24 * handleScale,
              height: 24 * handleScale,
            }}
            className="rounded-full bg-[#c6ff1f] text-black flex items-center justify-center shadow cursor-grab z-50"
            title="Drag to rotate"
          >
            <RotateCw style={{ width: 13 * handleScale, height: 13 * handleScale }} />
          </div>
        </>
      )}
    </div>
  );
};
