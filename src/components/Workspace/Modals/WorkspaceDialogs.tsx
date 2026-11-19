import React, { type MutableRefObject } from 'react';
import type {
  Project,
  Tag,
  TagEvent,
  Playlist,
  Label,
  LabelGroup,
  AdvancedPadItem,
  SmartConnector,
  CodeFile,
} from '../../../types';
import type { WorkspaceBatchModeProps, ExportModalState } from '../Workspace.types';
import { ConfirmOverlay } from '../../Shared/SharedUI';
import { WorkspaceModals } from './WorkspaceModals';
import { WorkspaceEditLabelModal } from './WorkspaceEditLabelModal';
import { CodeFilesModal } from '../CodeFiles/CodeFilesModal';
import { CodeFileSaveModal } from '../CodeFiles/CodeFileSaveModal';
import { BatchVideoRelinker } from '../../Batches/BatchVideoRelinker';
import { CustomizePlaylistsModal } from '../Presentation';
import { ExportVideoModal } from '../VideoExport/ExportVideoModal';
import { LivePeriodConfirmModal } from '../LiveCoding';
import { EventNoteModal } from '../TimelineEvents';
import { loadAllCodeFiles } from '../../../utils/codeFiles';

export interface WorkspaceDialogsProps {
  project: Project;
  batchMode?: WorkspaceBatchModeProps;
  currentTime: number;
  showNotification: (message: string, color?: string, onUndo?: () => void) => void;

  // Tag settings & events modal
  tagSettingsOpen: boolean;
  setTagSettingsOpen: (open: boolean) => void;
  tags: Tag[];
  setTags: React.Dispatch<React.SetStateAction<Tag[]>>;
  editingTagId: string | null;
  setEditingTagId: (id: string | null) => void;
  tempTag: Partial<Tag>;
  setTempTag: React.Dispatch<React.SetStateAction<Partial<Tag>>>;
  deleteTag: (tagId: string) => void;
  tagDeleteConfirmation: string | null;
  setTagDeleteConfirmation: (id: string | null) => void;
  confirmDeleteTag: () => void;

  // Context menu & CSV
  contextMenu: any;
  setContextMenu: (menu: any) => void;
  csvImportState: any;
  setCsvImportState: (state: any) => void;

  // Labels & Label Groups
  labels: Label[];
  setLabels: React.Dispatch<React.SetStateAction<Label[]>>;
  labelGroups: LabelGroup[];
  setLabelGroups: React.Dispatch<React.SetStateAction<LabelGroup[]>>;
  editingLabelId: string | null;
  setEditingLabelId: (id: string | null) => void;
  tempLabel: Partial<Label>;
  setTempLabel: React.Dispatch<React.SetStateAction<Partial<Label>>>;
  isAdvancedCodingMode: boolean;
  labelDeleteConfirmation: boolean;
  setLabelDeleteConfirmation: (confirm: boolean) => void;
  confirmBulkDeleteLabels: () => void;

  // Templates & Code Files
  showNormalTemplateModal: boolean;
  setShowNormalTemplateModal: (show: boolean) => void;
  showCodeFilesModal: boolean;
  setShowCodeFilesModal: (show: boolean) => void;
  showCodeFileSaveModal: boolean;
  setShowCodeFileSaveModal: (show: boolean) => void;
  currentCodeFileName: string;
  advancedPadItems: AdvancedPadItem[];
  connectors: SmartConnector[];
  handleApplyCodeFile: (file: CodeFile, clearEvents: boolean) => void;
  handleCreateBlankCodeFile: (clearEvents: boolean) => void;
  handleSaveCodeFile: (name: string, isOverwrite: boolean) => void;
  exportUnifiedSetupToJSON: () => void;

  // Playlists
  playlists: Playlist[];
  activePlaylistId: string;
  playlistPlaybarIndex?: number;
  playlistModal: any;
  setPlaylistModal: any;
  savePlaylist: (name: string) => void;
  playlistDeleteId: string | null;
  setPlaylistDeleteId: (id: string | null) => void;
  confirmDeletePlaylist: () => void;
  addEventsToPlaylist: (
    eventIds: string[],
    targetPlaylistId?: string,
    force?: boolean,
    insertAtIndex?: number
  ) => void;

  // Presentation Customize Modal
  showPresentationCustomizeModal: boolean;
  setShowPresentationCustomizeModal: (show: boolean) => void;
  presentationConfig: any;
  setPresentationConfig: (config: any) => void;
  handleEnterPresentationMode: (startImmediately?: boolean) => void;
  handleCreateDefaultPlaylist: () => void;

  // Event editing & deletion
  editEventModal: any;
  setEditEventModal: (modal: any) => void;
  requestCloseEditEventModal: () => void;
  saveEditedEvent: (event: any) => void;
  handleDeleteEventRequest: (event: any) => void;
  deleteConfirmation: any;
  setDeleteConfirmation: (conf: any) => void;
  confirmDeleteEvent: () => void;
  deleteEventsByIds: (ids: string[]) => void;
  tagEvents: TagEvent[];
  setTagEvents: React.Dispatch<React.SetStateAction<TagEvent[]>>;

  // Sidebar Tabs & Notes
  activeSidebarTab: 'tags' | 'events' | 'notes' | 'playlist';
  setActiveSidebarTab: (tab: 'tags' | 'events' | 'notes' | 'playlist') => void;
  notesSubTab: 'timeline' | 'general';
  setNotesSubTab: (tab: 'timeline' | 'general') => void;
  noteModalTarget?: { eventId: string; projectId?: string } | null;
  setNoteModalTarget?: (target: { eventId: string; projectId?: string } | null) => void;
  onSaveEventNote?: (eventId: string, noteText: string, projectId?: string) => void;
  allBatchTagEvents?: TagEvent[];
  allBatchTags?: Tag[];

  // Markers
  markerModal: any;
  setMarkerModal: (modal: any) => void;
  saveMarker: (marker: any) => void;
  deleteMarker: (id: string) => void;

  // Close Confirmation & Workspace Alert
  showCloseConfirm: boolean;
  setShowCloseConfirm: (show: boolean) => void;
  confirmClose: () => void;
  workspaceAlert: any;
  setWorkspaceAlert: (alert: any) => void;
  confirmUnsavedModal: boolean;
  setConfirmUnsavedModal: (modal: boolean) => void;
  fileInputRef: MutableRefObject<HTMLInputElement | null>;

  // Relinker Modal
  showBatchRelinkerModal: boolean;
  setShowBatchRelinkerModal: (show: boolean) => void;

  // Export Video Modal
  exportModalState: ExportModalState;
  setExportModalState: React.Dispatch<React.SetStateAction<ExportModalState>>;
  startRecordExport: (playlistId: string, options?: any) => void;

  // Live Period Confirm
  liveClock: any;
}

export const WorkspaceDialogs = ({
  project,
  batchMode,
  currentTime,
  showNotification,
  tagSettingsOpen,
  setTagSettingsOpen,
  tags,
  setTags,
  editingTagId,
  setEditingTagId,
  tempTag,
  setTempTag,
  deleteTag,
  tagDeleteConfirmation,
  setTagDeleteConfirmation,
  confirmDeleteTag,
  contextMenu,
  setContextMenu,
  csvImportState,
  setCsvImportState,
  labels,
  setLabels,
  labelGroups,
  setLabelGroups,
  editingLabelId,
  setEditingLabelId,
  tempLabel,
  setTempLabel,
  isAdvancedCodingMode,
  labelDeleteConfirmation,
  setLabelDeleteConfirmation,
  confirmBulkDeleteLabels,
  showNormalTemplateModal,
  setShowNormalTemplateModal,
  showCodeFilesModal,
  setShowCodeFilesModal,
  showCodeFileSaveModal,
  setShowCodeFileSaveModal,
  currentCodeFileName,
  advancedPadItems,
  connectors,
  handleApplyCodeFile,
  handleCreateBlankCodeFile,
  handleSaveCodeFile,
  exportUnifiedSetupToJSON,
  playlists,
  activePlaylistId,
  playlistPlaybarIndex,
  playlistModal,
  setPlaylistModal,
  savePlaylist,
  playlistDeleteId,
  setPlaylistDeleteId,
  confirmDeletePlaylist,
  addEventsToPlaylist,
  showPresentationCustomizeModal,
  setShowPresentationCustomizeModal,
  presentationConfig,
  setPresentationConfig,
  handleEnterPresentationMode,
  handleCreateDefaultPlaylist,
  editEventModal,
  setEditEventModal,
  requestCloseEditEventModal,
  saveEditedEvent,
  handleDeleteEventRequest,
  deleteConfirmation,
  setDeleteConfirmation,
  confirmDeleteEvent,
  deleteEventsByIds,
  tagEvents,
  setTagEvents,
  activeSidebarTab,
  setActiveSidebarTab,
  notesSubTab,
  setNotesSubTab,
  noteModalTarget,
  setNoteModalTarget,
  onSaveEventNote,
  allBatchTagEvents,
  allBatchTags,
  markerModal,
  setMarkerModal,
  saveMarker,
  deleteMarker,
  showCloseConfirm,
  setShowCloseConfirm,
  confirmClose,
  workspaceAlert,
  setWorkspaceAlert,
  confirmUnsavedModal,
  setConfirmUnsavedModal,
  fileInputRef,
  showBatchRelinkerModal,
  setShowBatchRelinkerModal,
  exportModalState,
  setExportModalState,
  startRecordExport,
  liveClock,
}: WorkspaceDialogsProps) => {
  return (
    <>
      {labelDeleteConfirmation && (
        <ConfirmOverlay
          title="Delete Selected"
          message="Are you sure you want to delete the selected labels and groups? This action cannot be undone."
          onConfirm={confirmBulkDeleteLabels}
          onCancel={() => setLabelDeleteConfirmation(false)}
        />
      )}

      {isAdvancedCodingMode && (
        <WorkspaceEditLabelModal
          isOpen={Boolean(editingLabelId)}
          editingLabelId={editingLabelId}
          tempLabel={tempLabel}
          setTempLabel={setTempLabel}
          setEditingLabelId={setEditingLabelId}
          labels={labels}
          setLabels={setLabels}
          showNotification={showNotification}
        />
      )}

      <WorkspaceModals
        tagSettingsOpen={tagSettingsOpen}
        setTagSettingsOpen={setTagSettingsOpen}
        tags={tags}
        setTags={setTags}
        editingTagId={editingTagId}
        setEditingTagId={setEditingTagId}
        tempTag={tempTag}
        setTempTag={setTempTag}
        deleteTag={deleteTag}
        contextMenu={contextMenu}
        setContextMenu={setContextMenu}
        csvImportState={csvImportState}
        setCsvImportState={setCsvImportState}
        labels={labels}
        setLabels={setLabels}
        labelGroups={labelGroups}
        setLabelGroups={setLabelGroups}
        onOpenTemplateManager={() => {
          setTagSettingsOpen(false);
          setShowNormalTemplateModal(true);
        }}
        exportUnifiedSetupToJSON={exportUnifiedSetupToJSON}
        showNotification={showNotification}
        setTagEvents={setTagEvents}
        tagEvents={tagEvents}
        playlists={playlists}
        activePlaylistId={activePlaylistId}
        playlistPlaybarIndex={playlistPlaybarIndex}
        onAddToPlaylist={(ids: string[], plId?: string, force?: boolean, insertAtIndex?: number) =>
          addEventsToPlaylist(ids, plId, force, insertAtIndex)
        }
        playlistModal={playlistModal}
        setPlaylistModal={setPlaylistModal}
        savePlaylist={savePlaylist}
        playlistDeleteId={playlistDeleteId}
        setPlaylistDeleteId={setPlaylistDeleteId}
        confirmDeletePlaylist={confirmDeletePlaylist}
        editEventModal={editEventModal}
        setEditEventModal={setEditEventModal}
        currentTime={currentTime}
        requestCloseEditEventModal={requestCloseEditEventModal}
        saveEditedEvent={saveEditedEvent}
        handleDeleteEventRequest={handleDeleteEventRequest}
        deleteConfirmation={deleteConfirmation}
        setDeleteConfirmation={setDeleteConfirmation}
        confirmDeleteEvent={confirmDeleteEvent}
        deleteEventsByIds={deleteEventsByIds}
        activeSidebarTab={activeSidebarTab}
        setActiveSidebarTab={setActiveSidebarTab}
        notesSubTab={notesSubTab}
        setNotesSubTab={setNotesSubTab}
        onSaveEventNote={onSaveEventNote}
        tagDeleteConfirmation={tagDeleteConfirmation}
        setTagDeleteConfirmation={setTagDeleteConfirmation}
        confirmDeleteTag={confirmDeleteTag}
        workspaceAlert={workspaceAlert}
        setWorkspaceAlert={setWorkspaceAlert}
        markerModal={markerModal}
        setMarkerModal={setMarkerModal}
        saveMarker={saveMarker}
        deleteMarker={deleteMarker}
        showCloseConfirm={showCloseConfirm}
        setShowCloseConfirm={setShowCloseConfirm}
        confirmClose={confirmClose}
        confirmUnsavedModal={confirmUnsavedModal}
        setConfirmUnsavedModal={setConfirmUnsavedModal}
        fileInputRef={fileInputRef}
      />

      {noteModalTarget && (() => {
        const searchEvents = allBatchTagEvents || tagEvents;
        const searchTags = allBatchTags || tags;
        const targetEvt =
          (noteModalTarget.projectId && batchMode?.allBatchProjects
            ? batchMode.allBatchProjects
                .find((p) => p.id === noteModalTarget.projectId)
                ?.data?.tagEvents?.find((e) => e.id === noteModalTarget.eventId)
            : undefined) ||
          tagEvents.find((e) => e.id === noteModalTarget.eventId) ||
          searchEvents.find((e) => e.id === noteModalTarget.eventId) ||
          null;
        const targetTag = targetEvt
          ? tags.find((t) => t.id === targetEvt.tagId) ||
            searchTags.find((t) => t.id === targetEvt.tagId) ||
            null
          : null;

        return (
          <EventNoteModal
            isOpen={Boolean(targetEvt)}
            onClose={() => setNoteModalTarget?.(null)}
            event={targetEvt}
            tag={targetTag}
            currentTime={currentTime}
            onSaveNote={(eventId, noteText) => {
              onSaveEventNote?.(eventId, noteText, noteModalTarget.projectId);
            }}
          />
        );
      })()}

      <CodeFilesModal
        isOpen={showCodeFilesModal || showNormalTemplateModal}
        onClose={() => {
          setShowCodeFilesModal(false);
          setShowNormalTemplateModal(false);
        }}
        currentFileName={currentCodeFileName}
        existingEventsCount={tagEvents.length}
        currentTags={tags}
        currentLabels={labels}
        currentLabelGroups={labelGroups}
        currentPadItems={advancedPadItems}
        currentConnectors={connectors}
        onApplyCodeFile={handleApplyCodeFile}
        onCreateBlankFile={handleCreateBlankCodeFile}
        showNotification={showNotification}
      />

      <CodeFileSaveModal
        isOpen={showCodeFileSaveModal}
        onClose={() => setShowCodeFileSaveModal(false)}
        currentFileName={currentCodeFileName}
        existingFiles={loadAllCodeFiles()}
        tagsCount={tags.length}
        labelsCount={labels.length}
        padItemsCount={advancedPadItems.length}
        onConfirmSave={handleSaveCodeFile}
      />

      {showBatchRelinkerModal && batchMode && (
        <BatchVideoRelinker
          batch={batchMode.batch}
          projects={batchMode.allBatchProjects}
          activeProjectId={project.id}
          projectBlobs={batchMode.projectBlobs}
          onSelectProject={(pId) => {
            batchMode.onSelectProject(pId);
            setShowBatchRelinkerModal(false);
          }}
          onRelinkSingle={async (proj, file, handle) => {
            if (batchMode.onRelinkSingleVideo) {
              await batchMode.onRelinkSingleVideo(proj, file, handle);
            } else {
              batchMode.onReloadVideo(proj);
            }
          }}
          onRelinkBatch={async (mappings) => {
            if (batchMode.onBatchRelinkVideos) {
              await batchMode.onBatchRelinkVideos(mappings);
            }
          }}
          onClose={() => setShowBatchRelinkerModal(false)}
          isInline={false}
        />
      )}

      {showPresentationCustomizeModal && (
        <CustomizePlaylistsModal
          playlists={playlists}
          config={presentationConfig}
          onSaveConfig={(newConfig, startImmediately) => {
            setPresentationConfig(newConfig);
            try {
              localStorage.setItem(
                `tacstem_presentation_config_${project.id}`,
                JSON.stringify(newConfig)
              );
            } catch (e) {}
            setShowPresentationCustomizeModal(false);
            if (startImmediately) {
              handleEnterPresentationMode(true);
            }
          }}
          onClose={() => setShowPresentationCustomizeModal(false)}
          tagEvents={tagEvents}
          tags={tags}
          allBatchProjects={batchMode?.allBatchProjects}
          onCreateDefaultPlaylist={handleCreateDefaultPlaylist}
        />
      )}

      <ExportVideoModal
        isOpen={exportModalState.isOpen}
        isPreparing={exportModalState.isPreparing}
        onClose={() => setExportModalState((prev) => ({ ...prev, isOpen: false, isPreparing: false }))}
        title={exportModalState.title}
        clips={exportModalState.clips}
        defaultWithFreezeFrames={exportModalState.defaultWithFreezeFrames}
        defaultMaskSettings={exportModalState.defaultMaskSettings}
        missingProjectNames={exportModalState.missingProjectNames}
        initError={exportModalState.initError}
        onRecordExport={(options) => {
          const targetPlaylistId = exportModalState.playlistId || activePlaylistId;
          setExportModalState((prev) => ({ ...prev, isOpen: false }));
          startRecordExport(targetPlaylistId, {
            withFreezeFrames: options?.withFreezeFrames ?? exportModalState.defaultWithFreezeFrames,
            customFileName: options?.fileName || exportModalState.title,
          });
        }}
        onFallbackToScreenRecord={() => {
          const targetPlaylistId = exportModalState.playlistId || activePlaylistId;
          setExportModalState((prev) => ({ ...prev, isOpen: false }));
          startRecordExport(targetPlaylistId, {
            withFreezeFrames: exportModalState.defaultWithFreezeFrames,
            customFileName: exportModalState.title,
          });
        }}
      />

      <LivePeriodConfirmModal
        pendingPeriod={liveClock.pendingNextPeriod}
        onConfirm={liveClock.confirmNextPeriod}
        onCancel={liveClock.cancelNextPeriod}
      />
    </>
  );
};
