import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  PresentationProject,
  Slide,
  SlideElement,
  SlideLayoutType,
  ThemeId,
} from '../types/presentation';
import {
  SLIDE_THEMES,
  createSlideFromLayout,
  uid,
} from '../constants/themesAndLayouts';
import { savePresentation } from '../storage/presentationRepository';
import {
  alignElements,
  applyThemeToPresentation,
  createNewElement,
  reorderElementLayer,
  switchSlideLayoutPreservingContent,
  type ElementFactoryType,
} from './elementOperations';

const MAX_HISTORY = 45;

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export function useSlideEditor(
  initialPresentation: PresentationProject,
  onPersisted?: (updated: PresentationProject) => void
) {
  const [presentation, setPresentation] = useState<PresentationProject>(initialPresentation);
  const [activeSlideId, setActiveSlideId] = useState<string>(
    initialPresentation.slides[0]?.id || ''
  );
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<SlideElement[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  // Undo/Redo history stacks
  const pastRef = useRef<PresentationProject[]>([]);
  const futureRef = useRef<PresentationProject[]>([]);
  const [historyMeta, setHistoryMeta] = useState({ canUndo: false, canRedo: false });

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPresRef = useRef(presentation);
  latestPresRef.current = presentation;

  const syncHistoryMeta = () => {
    setHistoryMeta({
      canUndo: pastRef.current.length > 0,
      canRedo: futureRef.current.length > 0,
    });
  };

  // Auto-save debounced to IndexedDB
  const scheduleSave = useCallback(
    (next: PresentationProject) => {
      setSaveStatus('saving');
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          const saved = await savePresentation(next);
          setSaveStatus('saved');
          onPersisted?.(saved);
        } catch (err) {
          console.error('[PresentationEditor] Save error:', err);
          setSaveStatus('error');
        }
      }, 400);
    },
    [onPersisted]
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        savePresentation(latestPresRef.current).catch(() => {});
      }
    };
  }, []);

  const commitChange = useCallback(
    (updater: (prev: PresentationProject) => PresentationProject, recordHistory = true) => {
      setPresentation((prev) => {
        const next = updater(prev);
        if (next === prev) return prev;
        if (recordHistory) {
          pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), prev];
          futureRef.current = [];
          syncHistoryMeta();
        }
        const stamped = { ...next, updatedAt: Date.now() };
        scheduleSave(stamped);
        return stamped;
      });
    },
    [scheduleSave]
  );

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    const previous = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [latestPresRef.current, ...futureRef.current.slice(0, MAX_HISTORY - 1)];
    setPresentation(previous);
    setSelectedElementIds([]);
    setEditingTextId(null);
    syncHistoryMeta();
    scheduleSave(previous);
  }, [scheduleSave]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), latestPresRef.current];
    setPresentation(next);
    setSelectedElementIds([]);
    setEditingTextId(null);
    syncHistoryMeta();
    scheduleSave(next);
  }, [scheduleSave]);

  const activeSlide =
    presentation.slides.find((s) => s.id === activeSlideId) || presentation.slides[0];

  const theme = SLIDE_THEMES[presentation.themeId] || SLIDE_THEMES['dark-professional'];

  const updateActiveSlide = useCallback(
    (updater: (slide: Slide) => Slide, recordHistory = true) => {
      commitChange(
        (prev) => ({
          ...prev,
          slides: prev.slides.map((s) => (s.id === activeSlide?.id ? updater(s) : s)),
        }),
        recordHistory
      );
    },
    [activeSlide?.id, commitChange]
  );

  const updateElement = useCallback(
    (elementId: string, patch: Partial<SlideElement>, recordHistory = true) => {
      updateActiveSlide(
        (slide) => ({
          ...slide,
          elements: slide.elements.map((el) =>
            el.id === elementId ? ({ ...el, ...patch } as SlideElement) : el
          ),
        }),
        recordHistory
      );
    },
    [updateActiveSlide]
  );

  const updateMultipleElements = useCallback(
    (patches: Record<string, Partial<SlideElement>>, recordHistory = true) => {
      updateActiveSlide(
        (slide) => ({
          ...slide,
          elements: slide.elements.map((el) =>
            patches[el.id] ? ({ ...el, ...patches[el.id] } as SlideElement) : el
          ),
        }),
        recordHistory
      );
    },
    [updateActiveSlide]
  );

  const addElement = useCallback(
    (kind: ElementFactoryType) => {
      if (!activeSlide) return;
      const maxZ = activeSlide.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
      const newEl = createNewElement(kind, theme, maxZ);
      updateActiveSlide((slide) => ({
        ...slide,
        elements: [...slide.elements, newEl],
      }));
      setSelectedElementIds([newEl.id]);
    },
    [activeSlide, theme, updateActiveSlide]
  );

  const addCustomElement = useCallback(
    (element: SlideElement) => {
      updateActiveSlide((slide) => ({
        ...slide,
        elements: [...slide.elements, element],
      }));
      setSelectedElementIds([element.id]);
    },
    [updateActiveSlide]
  );

  const deleteSelectedElements = useCallback(() => {
    if (!activeSlide || selectedElementIds.length === 0) return;
    const unlockedSelected = new Set(
      activeSlide.elements
        .filter((e) => selectedElementIds.includes(e.id) && !e.locked)
        .map((e) => e.id)
    );
    if (unlockedSelected.size === 0) return;
    updateActiveSlide((slide) => ({
      ...slide,
      elements: slide.elements.filter((e) => !unlockedSelected.has(e.id)),
    }));
    setSelectedElementIds([]);
    setEditingTextId(null);
  }, [activeSlide, selectedElementIds, updateActiveSlide]);

  const duplicateSelectedElements = useCallback(() => {
    if (!activeSlide || selectedElementIds.length === 0) return;
    let maxZ = activeSlide.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
    const clones = activeSlide.elements
      .filter((e) => selectedElementIds.includes(e.id))
      .map((el) => ({
        ...JSON.parse(JSON.stringify(el)),
        id: uid('el'),
        x: Math.min(1820, el.x + 32),
        y: Math.min(1000, el.y + 32),
        zIndex: ++maxZ,
        locked: false,
      }));
    if (clones.length === 0) return;
    updateActiveSlide((slide) => ({
      ...slide,
      elements: [...slide.elements, ...clones],
    }));
    setSelectedElementIds(clones.map((c) => c.id));
  }, [activeSlide, selectedElementIds, updateActiveSlide]);

  const copySelectedElements = useCallback(() => {
    if (!activeSlide || selectedElementIds.length === 0) return;
    const toCopy = activeSlide.elements.filter((e) => selectedElementIds.includes(e.id));
    if (toCopy.length > 0) {
      setClipboard(JSON.parse(JSON.stringify(toCopy)));
    }
  }, [activeSlide, selectedElementIds]);

  const pasteClipboardElements = useCallback(() => {
    if (!activeSlide || clipboard.length === 0) return;
    let maxZ = activeSlide.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
    const pasted = clipboard.map((el) => ({
      ...JSON.parse(JSON.stringify(el)),
      id: uid('el'),
      x: Math.min(1820, el.x + 40),
      y: Math.min(1000, el.y + 40),
      zIndex: ++maxZ,
      locked: false,
    }));
    updateActiveSlide((slide) => ({
      ...slide,
      elements: [...slide.elements, ...pasted],
    }));
    setSelectedElementIds(pasted.map((p) => p.id));
  }, [activeSlide, clipboard, updateActiveSlide]);

  const alignSelected = useCallback(
    (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
      if (selectedElementIds.length === 0) return;
      updateActiveSlide((slide) => ({
        ...slide,
        elements: alignElements(slide.elements, selectedElementIds, alignment),
      }));
    },
    [selectedElementIds, updateActiveSlide]
  );

  const reorderLayer = useCallback(
    (elementId: string, direction: 'front' | 'back' | 'forward' | 'backward') => {
      updateActiveSlide((slide) => ({
        ...slide,
        elements: reorderElementLayer(slide.elements, elementId, direction),
      }));
    },
    [updateActiveSlide]
  );

  const toggleGroupSelected = useCallback(() => {
    if (!activeSlide || selectedElementIds.length < 2) return;
    const selected = activeSlide.elements.filter((e) => selectedElementIds.includes(e.id));
    const allSameGroup =
      selected[0]?.groupId && selected.every((e) => e.groupId === selected[0].groupId);
    const nextGroupId = allSameGroup ? undefined : uid('grp');
    updateActiveSlide((slide) => ({
      ...slide,
      elements: slide.elements.map((e) =>
        selectedElementIds.includes(e.id) ? { ...e, groupId: nextGroupId } : e
      ),
    }));
  }, [activeSlide, selectedElementIds, updateActiveSlide]);

  // Slide-level operations
  const addSlide = useCallback(
    (layout: SlideLayoutType = 'two-column', afterSlideId?: string) => {
      const newSlide = createSlideFromLayout(layout, theme, {
        title: `Slide ${presentation.slides.length + 1}`,
      });
      commitChange((prev) => {
        const idx = afterSlideId ? prev.slides.findIndex((s) => s.id === afterSlideId) : prev.slides.length - 1;
        const insertAt = idx >= 0 ? idx + 1 : prev.slides.length;
        const nextSlides = [...prev.slides];
        nextSlides.splice(insertAt, 0, newSlide);
        return { ...prev, slides: nextSlides };
      });
      setActiveSlideId(newSlide.id);
      setSelectedElementIds([]);
    },
    [commitChange, presentation.slides.length, theme]
  );

  const insertPreparedSlide = useCallback(
    (preparedSlide: Slide, afterSlideId?: string) => {
      commitChange((prev) => {
        const idx = afterSlideId ? prev.slides.findIndex((s) => s.id === afterSlideId) : prev.slides.length - 1;
        const insertAt = idx >= 0 ? idx + 1 : prev.slides.length;
        const nextSlides = [...prev.slides];
        nextSlides.splice(insertAt, 0, preparedSlide);
        return { ...prev, slides: nextSlides };
      });
      setActiveSlideId(preparedSlide.id);
      setSelectedElementIds([]);
    },
    [commitChange]
  );

  const replaceActiveSlide = useCallback(
    (nextSlide: Slide) => {
      if (!activeSlide) return;
      const preservedIdSlide: Slide = {
        ...nextSlide,
        id: activeSlide.id,
        sectionId: activeSlide.sectionId,
      };
      commitChange((prev) => ({
        ...prev,
        slides: prev.slides.map((s) => (s.id === activeSlide.id ? preservedIdSlide : s)),
      }));
      setSelectedElementIds([]);
    },
    [activeSlide, commitChange]
  );

  const duplicateSlide = useCallback(
    (slideId: string) => {
      const source = presentation.slides.find((s) => s.id === slideId);
      if (!source) return;
      const cloned: Slide = {
        ...JSON.parse(JSON.stringify(source)),
        id: uid('slide'),
        title: `${source.title} (Copy)`,
        elements: source.elements.map((el) => ({
          ...JSON.parse(JSON.stringify(el)),
          id: uid('el'),
        })),
      };
      commitChange((prev) => {
        const idx = prev.slides.findIndex((s) => s.id === slideId);
        const nextSlides = [...prev.slides];
        nextSlides.splice(idx + 1, 0, cloned);
        return { ...prev, slides: nextSlides };
      });
      setActiveSlideId(cloned.id);
      setSelectedElementIds([]);
    },
    [commitChange, presentation.slides]
  );

  const deleteSlide = useCallback(
    (slideId: string) => {
      if (presentation.slides.length <= 1) return;
      const idx = presentation.slides.findIndex((s) => s.id === slideId);
      const fallback = presentation.slides[idx - 1] || presentation.slides[idx + 1];
      commitChange((prev) => ({
        ...prev,
        slides: prev.slides.filter((s) => s.id !== slideId),
      }));
      if (activeSlideId === slideId && fallback) {
        setActiveSlideId(fallback.id);
      }
      setSelectedElementIds([]);
    },
    [activeSlideId, commitChange, presentation.slides]
  );

  const reorderSlides = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
      commitChange((prev) => {
        const next = [...prev.slides];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return { ...prev, slides: next };
      });
    },
    [commitChange]
  );

  const switchActiveSlideLayout = useCallback(
    (nextLayout: SlideLayoutType) => {
      updateActiveSlide((slide) => switchSlideLayoutPreservingContent(slide, nextLayout, theme));
      setSelectedElementIds([]);
    },
    [theme, updateActiveSlide]
  );

  const changeTheme = useCallback(
    (themeId: ThemeId) => {
      commitChange((prev) => applyThemeToPresentation(prev, themeId));
    },
    [commitChange]
  );

  const addSection = useCallback(
    (title: string) => {
      const secId = uid('sec');
      commitChange((prev) => ({
        ...prev,
        sections: [...(prev.sections || []), { id: secId, title: title.trim() || 'New Section' }],
      }));
      return secId;
    },
    [commitChange]
  );

  const selectElements = useCallback(
    (ids: string[], additive = false) => {
      if (!activeSlide) return;
      // Expand group selection cleanly
      const expanded = new Set<string>(additive ? selectedElementIds : []);
      ids.forEach((id) => {
        const el = activeSlide.elements.find((e) => e.id === id);
        if (el?.groupId) {
          activeSlide.elements
            .filter((g) => g.groupId === el.groupId)
            .forEach((g) => expanded.add(g.id));
        } else {
          expanded.add(id);
        }
      });
      setSelectedElementIds(Array.from(expanded));
    },
    [activeSlide, selectedElementIds]
  );

  return {
    presentation,
    activeSlide,
    activeSlideId: activeSlide?.id || '',
    setActiveSlideId: (id: string) => {
      setActiveSlideId(id);
      setSelectedElementIds([]);
      setEditingTextId(null);
    },
    theme,
    selectedElementIds,
    setSelectedElementIds,
    selectElements,
    editingTextId,
    setEditingTextId,
    saveStatus,
    canUndo: historyMeta.canUndo,
    canRedo: historyMeta.canRedo,
    hasClipboard: clipboard.length > 0,
    undo,
    redo,
    commitChange,
    updateActiveSlide,
    updateElement,
    updateMultipleElements,
    addElement,
    addCustomElement,
    deleteSelectedElements,
    duplicateSelectedElements,
    copySelectedElements,
    pasteClipboardElements,
    alignSelected,
    reorderLayer,
    toggleGroupSelected,
    addSlide,
    insertPreparedSlide,
    replaceActiveSlide,
    duplicateSlide,
    deleteSlide,
    reorderSlides,
    switchActiveSlideLayout,
    changeTheme,
    addSection,
  };
}
