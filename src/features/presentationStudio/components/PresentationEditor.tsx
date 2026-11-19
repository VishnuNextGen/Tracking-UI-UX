import React, { useEffect, useState } from 'react';
import type {
  ImportedPlaylistClip,
  PresentationProject,
  TacticalBoardSlideElement,
  VideoPlaylistSlideElement,
} from '../types/presentation';
import { useSlideEditor } from '../editor/useSlideEditor';
import { Toolbar } from './Toolbar';
import { SlideNavigator } from './SlideNavigator';
import { SlideCanvas } from './SlideCanvas';
import { PropertiesPanel } from './PropertiesPanel';
import { AIChatPanel } from './AIChatPanel';
import { AISettingsModal } from './AISettingsModal';
import { ImportPlaylistsModal } from './ImportPlaylistsModal';
import {
  ImportTacticalBoardModal,
  type TacticalBoardImportSelection,
} from './ImportTacticalBoardModal';
import { PresentationMode } from './PresentationMode';
import { saveImageAsset } from '../storage/presentationRepository';
import { SLIDE_THEMES, uid } from '../constants/themesAndLayouts';

interface PresentationEditorProps {
  initialPresentation: PresentationProject;
  initialPresentMode?: boolean;
  onBackToDashboard: () => void;
  onPersisted?: (updated: PresentationProject) => void;
}

export const PresentationEditor: React.FC<PresentationEditorProps> = ({
  initialPresentation,
  initialPresentMode = false,
  onBackToDashboard,
  onPersisted,
}) => {
  const editor = useSlideEditor(initialPresentation, onPersisted);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [isAISettingsOpen, setIsAISettingsOpen] = useState(false);
  const [isPlaylistImporterOpen, setIsPlaylistImporterOpen] = useState(false);
  const [importerTargetElementId, setImporterTargetElementId] = useState<string | null>(null);
  const [isBoardImporterOpen, setIsBoardImporterOpen] = useState(false);
  const [boardImporterTargetElementId, setBoardImporterTargetElementId] = useState<string | null>(null);
  const [isPresenting, setIsPresenting] = useState(initialPresentMode);

  // Global keyboard shortcuts for editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPresenting || isAISettingsOpen || isPlaylistImporterOpen || isBoardImporterOpen) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        editor.undo();
      } else if ((mod && e.key.toLowerCase() === 'z' && e.shiftKey) || (mod && e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        editor.redo();
      } else if (mod && e.key.toLowerCase() === 'c') {
        if (editor.selectedElementIds.length > 0) {
          e.preventDefault();
          editor.copySelectedElements();
        }
      } else if (mod && e.key.toLowerCase() === 'v') {
        if (editor.hasClipboard) {
          e.preventDefault();
          editor.pasteClipboardElements();
        }
      } else if (mod && e.key.toLowerCase() === 'd') {
        if (editor.selectedElementIds.length > 0) {
          e.preventDefault();
          editor.duplicateSelectedElements();
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (editor.selectedElementIds.length > 0) {
          e.preventDefault();
          editor.deleteSelectedElements();
        }
      } else if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) &&
        editor.selectedElementIds.length > 0 &&
        editor.activeSlide
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 15 : 3;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        const patches: Record<string, any> = {};
        editor.activeSlide.elements.forEach((el) => {
          if (editor.selectedElementIds.includes(el.id) && !el.locked) {
            patches[el.id] = { x: el.x + dx, y: el.y + dy };
          }
        });
        if (Object.keys(patches).length > 0) {
          editor.updateMultipleElements(patches, true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editor, isPresenting, isAISettingsOpen, isPlaylistImporterOpen, isBoardImporterOpen]);

  const handleUploadNewImage = async (file: File) => {
    if (!editor.activeSlide) return;
    const asset = await saveImageAsset(editor.presentation.id, file);
    const maxZ = editor.activeSlide.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
    const ratio = asset.width && asset.height ? asset.width / asset.height : 16 / 9;
    const w = 720;
    const h = Math.max(160, Math.min(800, Math.round(w / ratio)));
    editor.addCustomElement({
      id: uid('img'),
      type: 'image',
      assetId: asset.id,
      alt: file.name,
      x: Math.round((1920 - w) / 2),
      y: Math.round((1080 - h) / 2),
      width: w,
      height: h,
      zIndex: maxZ + 1,
      objectFit: 'cover',
      borderRadius: 16,
    });
  };

  const handleUploadReplacementImage = async (elementId: string, file: File) => {
    const asset = await saveImageAsset(editor.presentation.id, file);
    editor.updateElement(elementId, { assetId: asset.id, src: undefined, alt: file.name });
  };

  const handleOpenPlaylistImporter = (targetElementId?: string | null) => {
    setImporterTargetElementId(targetElementId || null);
    setIsPlaylistImporterOpen(true);
  };

  const handleConfirmPlaylistImport = (params: {
    targetElementId?: string | null;
    title: string;
    clips: ImportedPlaylistClip[];
  }) => {
    if (!editor.activeSlide) return;
    if (params.targetElementId) {
      const existingEl = editor.activeSlide.elements.find(
        (e): e is VideoPlaylistSlideElement =>
          e.id === params.targetElementId && e.type === 'video-playlist'
      );
      if (existingEl) {
        editor.updateElement(existingEl.id, {
          title: params.title || existingEl.title,
          clips: [...(existingEl.clips || []), ...params.clips],
        });
        return;
      }
    }

    const theme =
      SLIDE_THEMES[editor.presentation.themeId] || SLIDE_THEMES['dark-professional'];
    const maxZ = editor.activeSlide.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
    editor.addCustomElement({
      id: uid('vpl'),
      type: 'video-playlist',
      x: 260,
      y: 160,
      width: 1400,
      height: 780,
      zIndex: maxZ + 1,
      title: params.title,
      clips: params.clips,
      loop: true,
      muted: false,
      showOverlayHud: true,
      showClipStrip: true,
      accentColor: theme.accentColor,
      backgroundColor: theme.surfaceColor,
      borderRadius: 20,
    });
  };

  const handleOpenBoardImporter = (targetElementId?: string | null) => {
    setBoardImporterTargetElementId(targetElementId || null);
    setIsBoardImporterOpen(true);
  };

  const handleConfirmBoardImport = (selection: TacticalBoardImportSelection) => {
    if (!editor.activeSlide) return;
    if (selection.targetElementId) {
      const existingEl = editor.activeSlide.elements.find(
        (e): e is TacticalBoardSlideElement =>
          e.id === selection.targetElementId && e.type === 'tactical-board'
      );
      if (existingEl) {
        editor.updateElement(existingEl.id, {
          title: selection.title,
          boardProjectId: selection.boardProjectId,
          boardProjectName: selection.boardProjectName,
          pitchTemplate: selection.pitchTemplate,
          boardData: selection.boardData,
          importMode: selection.importMode,
          slideIndex: selection.slideIndex,
          slideName: selection.slideName,
          hasAnimations: selection.hasAnimations,
          loop: selection.loop,
          autoPlay: selection.autoPlay,
        });
        return;
      }
    }

    const theme =
      SLIDE_THEMES[editor.presentation.themeId] || SLIDE_THEMES['dark-professional'];
    const maxZ = editor.activeSlide.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
    editor.addCustomElement({
      id: uid('tbd'),
      type: 'tactical-board',
      x: 260,
      y: 160,
      width: 1400,
      height: 780,
      zIndex: maxZ + 1,
      title: selection.title,
      boardProjectId: selection.boardProjectId,
      boardProjectName: selection.boardProjectName,
      pitchTemplate: selection.pitchTemplate,
      boardData: selection.boardData,
      importMode: selection.importMode,
      slideIndex: selection.slideIndex,
      slideName: selection.slideName,
      hasAnimations: selection.hasAnimations,
      loop: selection.loop,
      autoPlay: selection.autoPlay,
      showOverlayHud: true,
      showSlideStrip: true,
      accentColor: theme.accentColor,
      backgroundColor: theme.surfaceColor,
      borderRadius: 20,
    });
  };

  if (!editor.activeSlide) return null;

  const selectedElements = editor.activeSlide.elements.filter((e) =>
    editor.selectedElementIds.includes(e.id)
  );
  const activeSlideIndex = Math.max(
    0,
    editor.presentation.slides.findIndex((s) => s.id === editor.activeSlideId)
  );
  const targetPlaylistElement = importerTargetElementId
    ? editor.activeSlide.elements.find(
        (e): e is VideoPlaylistSlideElement =>
          e.id === importerTargetElementId && e.type === 'video-playlist'
      )
    : undefined;
  const targetBoardElement = boardImporterTargetElementId
    ? editor.activeSlide.elements.find(
        (e): e is TacticalBoardSlideElement =>
          e.id === boardImporterTargetElementId && e.type === 'tactical-board'
      )
    : undefined;

  return (
    <div className="w-screen h-screen bg-[#0a0c11] text-white flex flex-col overflow-hidden">
      <Toolbar
        title={editor.presentation.title}
        themeId={editor.presentation.themeId}
        activeLayout={editor.activeSlide.layout}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        saveStatus={editor.saveStatus}
        isAIPanelOpen={isAIPanelOpen}
        onBackToDashboard={onBackToDashboard}
        onTitleChange={(nextTitle) =>
          editor.commitChange((prev) => ({ ...prev, title: nextTitle }))
        }
        onUndo={editor.undo}
        onRedo={editor.redo}
        onAddElement={editor.addElement}
        onUploadImage={handleUploadNewImage}
        onOpenPlaylistImporter={() => handleOpenPlaylistImporter(null)}
        onOpenBoardImporter={() => handleOpenBoardImporter(null)}
        onSwitchLayout={editor.switchActiveSlideLayout}
        onChangeTheme={editor.changeTheme}
        onToggleAIPanel={() => setIsAIPanelOpen((v) => !v)}
        onOpenAISettings={() => setIsAISettingsOpen(true)}
        onPresent={() => setIsPresenting(true)}
      />

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <SlideNavigator
          slides={editor.presentation.slides}
          sections={editor.presentation.sections}
          activeSlideId={editor.activeSlideId}
          onSelectSlide={editor.setActiveSlideId}
          onAddSlide={editor.addSlide}
          onDuplicateSlide={editor.duplicateSlide}
          onDeleteSlide={editor.deleteSlide}
          onReorderSlides={editor.reorderSlides}
          onAssignSection={(slideId, sectionId) =>
            editor.commitChange((prev) => ({
              ...prev,
              slides: prev.slides.map((s) =>
                s.id === slideId ? { ...s, sectionId: sectionId || undefined } : s
              ),
            }))
          }
          onAddSection={(title) => {
            const id = editor.addSection(title);
            editor.updateActiveSlide((s) => ({ ...s, sectionId: id }));
          }}
        />

        <SlideCanvas
          slide={editor.activeSlide}
          selectedElementIds={editor.selectedElementIds}
          editingTextId={editor.editingTextId}
          onSelectElements={editor.selectElements}
          onStartTextEdit={(id) => editor.setEditingTextId(id)}
          onStopTextEdit={() => editor.setEditingTextId(null)}
          onUpdateElement={editor.updateElement}
          onUpdateMultipleElements={editor.updateMultipleElements}
          onDuplicateSelected={editor.duplicateSelectedElements}
          onDeleteSelected={editor.deleteSelectedElements}
          onOpenPlaylistImporter={(elId) => handleOpenPlaylistImporter(elId)}
          onOpenBoardImporter={(elId) => handleOpenBoardImporter(elId)}
        />

        {isAIPanelOpen ? (
          <AIChatPanel
            presentation={editor.presentation}
            activeSlide={editor.activeSlide}
            selectedElements={selectedElements}
            onClose={() => setIsAIPanelOpen(false)}
            onOpenAISettings={() => setIsAISettingsOpen(true)}
            onApplyProposedSlide={editor.replaceActiveSlide}
            onInsertSuggestedSlide={(s) =>
              editor.insertPreparedSlide(s, editor.activeSlideId)
            }
            onInsertGeneratedElement={(el) => editor.addCustomElement(el)}
            onUpdateElementText={(id, text) =>
              editor.updateElement(id, { content: text })
            }
            onChangeTheme={editor.changeTheme}
          />
        ) : (
          <PropertiesPanel
            slide={editor.activeSlide}
            themeId={editor.presentation.themeId}
            selectedElements={selectedElements}
            onUpdateSlide={(updater) => editor.updateActiveSlide(updater)}
            onSwitchLayout={editor.switchActiveSlideLayout}
            onChangeTheme={editor.changeTheme}
            onUpdateElement={(id, patch) => editor.updateElement(id, patch)}
            onAlignSelected={editor.alignSelected}
            onReorderLayer={editor.reorderLayer}
            onToggleGroup={editor.toggleGroupSelected}
            onUploadReplacementImage={handleUploadReplacementImage}
            onOpenPlaylistImporter={(elId) => handleOpenPlaylistImporter(elId)}
            onOpenBoardImporter={(elId) => handleOpenBoardImporter(elId)}
          />
        )}
      </div>

      <AISettingsModal
        isOpen={isAISettingsOpen}
        onClose={() => setIsAISettingsOpen(false)}
      />

      <ImportPlaylistsModal
        isOpen={isPlaylistImporterOpen}
        targetElementId={importerTargetElementId}
        initialTitle={targetPlaylistElement?.title}
        onClose={() => {
          setIsPlaylistImporterOpen(false);
          setImporterTargetElementId(null);
        }}
        onConfirmImport={handleConfirmPlaylistImport}
      />

      <ImportTacticalBoardModal
        isOpen={isBoardImporterOpen}
        targetElementId={boardImporterTargetElementId}
        initialTitle={targetBoardElement?.title}
        initialBoardProjectId={targetBoardElement?.boardProjectId}
        initialImportMode={targetBoardElement?.importMode}
        initialSlideIndex={targetBoardElement?.slideIndex}
        onClose={() => {
          setIsBoardImporterOpen(false);
          setBoardImporterTargetElementId(null);
        }}
        onConfirmImport={handleConfirmBoardImport}
      />

      {isPresenting && (
        <PresentationMode
          presentation={editor.presentation}
          initialSlideIndex={activeSlideIndex}
          onExit={() => setIsPresenting(false)}
        />
      )}
    </div>
  );
};
