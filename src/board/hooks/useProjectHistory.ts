import { useState, useEffect, useRef, useCallback } from 'react';
import { produce } from 'immer';
import { z } from 'zod';
import { Project } from '../types';
import { INITIAL_PROJECT } from '../constants';
import { db } from '../db';

const projectSchema = z.object({
  teams: z.object({
    HOME: z.any(),
    AWAY: z.any(),
    NEUTRAL: z.any()
  }),
  slides: z.array(z.any()).min(1),
  currentSlideId: z.string()
}).passthrough();

const countProjectContentScore = (proj?: Project | null): number => {
  if (!proj || !Array.isArray(proj.slides)) return 0;
  let score = proj.slides.length;
  for (const s of proj.slides) {
    if (!s) continue;
    score += Object.keys(s.positions || {}).length * 10;
    score += (s.drawings || []).length * 10;
  }
  return score;
};

export const useProjectHistory = (
  isPlaying: boolean, 
  isRecording: boolean,
  projectId?: string,
  initialProjectData?: Project,
  onSave?: (updatedProject: Project) => void
) => {
  const [historyState, setHistoryState] = useState(() => ({ 
    list: [initialProjectData || INITIAL_PROJECT], 
    index: 0 
  }));
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const targetId = projectId || 'current_project';
  const history = historyState.list;
  const historyIndex = historyState.index;
  const baseProject = history[historyIndex];

  const latestProjectRef = useRef<Project>(baseProject);
  const targetIdRef = useRef<string>(targetId);
  const onSaveRef = useRef(onSave);
  const isDbLoadedRef = useRef(false);
  const dirtyRef = useRef(false);
  const lastLoadedTargetRef = useRef<string | null>(null);

  latestProjectRef.current = baseProject;
  targetIdRef.current = targetId;
  onSaveRef.current = onSave;
  isDbLoadedRef.current = isDbLoaded;

  const persistSnapshot = useCallback((id: string, proj: Project) => {
    if (!proj) return;
    const stamped: Project = {
      ...proj,
      lastSavedAt: Date.now(),
    };
    dirtyRef.current = false;
    db.projects.put({ id, data: stamped }).then(() => {
      setSaveError(null);
      if (onSaveRef.current) {
        onSaveRef.current(stamped);
      }
    }).catch(err => {
      console.error("Failed to save project to IndexedDB:", err);
      setSaveError("⚠️ Local save failed. Your browser storage may be full. Please export your project to avoid losing changes.");
    });
  }, []);

  const flushSave = useCallback(() => {
    if (!isDbLoadedRef.current || !latestProjectRef.current) return;
    persistSnapshot(targetIdRef.current, latestProjectRef.current);
  }, [persistSnapshot]);

  // Load from DB on mount or projectId change
  useEffect(() => {
    let isCancelled = false;
    setIsDbLoaded(false);
    dirtyRef.current = false;
    const loadProject = async () => {
      try {
        const saved = await db.projects.get(targetId);
        if (isCancelled) return;
        const savedParsed = saved?.data ? projectSchema.safeParse(saved.data) : null;
        const savedProj = savedParsed?.success ? (savedParsed.data as unknown as Project) : null;

        if (savedProj && initialProjectData) {
          const savedTs = savedProj.lastSavedAt || 0;
          const initTs = initialProjectData.lastSavedAt || 0;
          const useInitial =
            initTs > savedTs ||
            (initTs === 0 &&
              savedTs === 0 &&
              countProjectContentScore(initialProjectData) > countProjectContentScore(savedProj));
          const chosen = useInitial ? initialProjectData : savedProj;
          setHistoryState({ list: [chosen], index: 0 });
          if (useInitial) {
            await db.projects.put({ id: targetId, data: chosen });
          }
        } else if (savedProj) {
          setHistoryState({ list: [savedProj], index: 0 });
        } else if (initialProjectData) {
          setHistoryState({ list: [initialProjectData], index: 0 });
          await db.projects.put({ id: targetId, data: initialProjectData });
        }
      } catch (err) {
        console.error("Failed to load project from IndexedDB:", err);
      } finally {
        if (!isCancelled) {
          lastLoadedTargetRef.current = targetId;
          setIsDbLoaded(true);
        }
      }
    };
    loadProject();
    return () => {
      isCancelled = true;
    };
  }, [targetId]);

  // Save to DB on change with short debounce; flush immediately if user starts playing or unmounts
  useEffect(() => {
    if (!isDbLoaded || lastLoadedTargetRef.current !== targetId) return;
    const currentProject = history[historyIndex];
    if (!currentProject) return;

    if (isRecording) return;

    // If user hit Play right after editing, flush dirty edits immediately instead of skipping
    if (isPlaying) {
      if (dirtyRef.current) {
        persistSnapshot(targetId, currentProject);
      }
      return;
    }

    const delayMs = dirtyRef.current ? 300 : 800;
    const timer = setTimeout(() => {
      persistSnapshot(targetId, currentProject);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [history, historyIndex, isDbLoaded, isPlaying, isRecording, targetId, persistSnapshot]);

  // Flush any pending unsaved changes when leaving Tactical Board / unmounting
  useEffect(() => {
    return () => {
      if (isDbLoadedRef.current && dirtyRef.current && latestProjectRef.current) {
        persistSnapshot(targetIdRef.current, latestProjectRef.current);
      }
    };
  }, [targetId, persistSnapshot]);

  const handleUndo = () => {
    dirtyRef.current = true;
    setHistoryState(prev => ({ ...prev, index: prev.index > 0 ? prev.index - 1 : prev.index }));
  };

  const handleRedo = () => {
    dirtyRef.current = true;
    setHistoryState(prev => ({ ...prev, index: prev.index < prev.list.length - 1 ? prev.index + 1 : prev.index }));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history.length]);

  const updateProject = (fn: (p: Project) => void, replaceHistory = false) => {
    dirtyRef.current = true;
    setHistoryState(prev => {
      const currentProject = prev.list[prev.index];
      const next = produce(currentProject, draft => { 
        fn(draft); 
        // Ensure sequential naming for all slides
        draft.slides.forEach((slide, idx) => {
          slide.name = `Slide ${idx + 1}`;
        });
      });
      
      if (replaceHistory) {
        const newHistory = [...prev.list];
        newHistory[prev.index] = next;
        return { list: newHistory, index: prev.index };
      } else {
        const newHistory = prev.list.slice(0, prev.index + 1);
        newHistory.push(next);
        return { list: newHistory, index: newHistory.length - 1 };
      }
    });
  };

  return {
    historyState,
    setHistoryState,
    baseProject,
    isDbLoaded,
    saveError,
    handleUndo,
    handleRedo,
    updateProject,
    flushSave
  };
};
