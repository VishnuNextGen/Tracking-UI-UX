import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type React from 'react';
import type {
  ActiveRecording,
  AdvancedPadItem,
  CodeFile,
  Label,
  LabelEvent,
  LabelGroup,
  Playlist,
  Project,
  ProjectData,
  SmartConnector,
  Tag as TagData,
  TagEvent,
} from '../../../types';
import {
  STORAGE_KEY_ACTIVE_CODE_FILE,
  generateDefaultPadItems,
  loadAllCodeFiles,
  saveAllCodeFiles,
} from '../../../utils/codeFiles';
import { getClipEventId } from '../../../utils/playlistUtils';
import { isValidEvent } from '../Workspace.utils';
import {
  downloadEventsCSV,
  downloadLabelsJSON,
  downloadUnifiedSetupJSON,
  parseImportedEventsCSV,
  parseUnifiedCodingJSON,
} from '../io/codingIoUtils';
import type { ContextMenuState, CsvImportState, EditEventModalState } from '../Workspace.types';

export function useTaggingAndCoding(params: {
  project: Project;
  isLive: boolean;
  currentTime: number;
  duration: number;
  liveClockBridgeRef: React.MutableRefObject<{
    matchPeriod: string | null;
    getMatchTimeSec: () => number;
  } | null>;
  latestProjectDataRef: React.MutableRefObject<ProjectData>;
  playlists: Playlist[];
  setPlaylists: React.Dispatch<React.SetStateAction<Playlist[]>>;
  syncPlaylistsToStorage: (nextPlaylists: Playlist[]) => void;
  showNotification: (
    message: string,
    color: string,
    onUndo?: () => void,
    action?: { label: string; onClick: () => void }
  ) => void;
}) {
  const {
    project,
    isLive,
    currentTime,
    duration,
    liveClockBridgeRef,
    latestProjectDataRef,
    playlists,
    setPlaylists,
    syncPlaylistsToStorage,
    showNotification,
  } = params;

  const [labelsEnabled, setLabelsEnabled] = useState(false);
  const [isAdvancedCodingMode, setIsAdvancedCodingMode] = useState(false);
  const [advancedPadItems, setAdvancedPadItems] = useState<AdvancedPadItem[]>(
    project.data.advancedPadItems || []
  );
  const [connectors, setConnectors] = useState<SmartConnector[]>(project.data.connectors || []);
  const [isPadQuickTagEnabled, setIsPadQuickTagEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('advanced_pad_quick_tag_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [labelGroups, setLabelGroups] = useState<LabelGroup[]>(project.data.labelGroups || []);
  const [labels, setLabels] = useState<Label[]>(project.data.labels || []);
  const [labelEvents, _setLabelEvents] = useState<LabelEvent[]>(project.data.labelEvents || []);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [tempLabel, setTempLabel] = useState<Partial<Label>>({});
  const [tempGroup, setTempGroup] = useState<Partial<LabelGroup>>({});
  const [draggedGroup, setDraggedGroup] = useState<string | null>(null);
  const [draggedLabel, setDraggedLabel] = useState<string | null>(null);
  const [isLabelsSelectMode, setIsLabelsSelectMode] = useState(false);
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(new Set());
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [labelDeleteConfirmation, setLabelDeleteConfirmation] = useState(false);

  const [showNormalTemplateModal, setShowNormalTemplateModal] = useState(false);
  const [currentCodeFileName, setCurrentCodeFileName] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_ACTIVE_CODE_FILE) || 'Standard Match Analysis';
    } catch (e) {
      return 'Standard Match Analysis';
    }
  });
  const [showCodeFilesModal, setShowCodeFilesModal] = useState(false);
  const [showCodeFileSaveModal, setShowCodeFileSaveModal] = useState(false);

  const currentNormalTemplateName = currentCodeFileName;
  const setCurrentNormalTemplateName = setCurrentCodeFileName;
  const unifiedFileInputRef = useRef<HTMLInputElement>(null);

  const setLabelEvents = useCallback((action: React.SetStateAction<LabelEvent[]>) => {
    _setLabelEvents((prev) => {
      const next = typeof action === 'function' ? (action as any)(prev) : action;
      return next;
    });
  }, []);

  const [labelsActiveTargetTab, setLabelsActiveTargetTab] = useState<string>('all');

  const [tags, setTags] = useState<TagData[]>(project.data.tags);
  const [tagEvents, _setTagEvents] = useState<TagEvent[]>(project.data.tagEvents);
  const tagEventsHistoryRef = useRef<TagEvent[][]>([project.data.tagEvents]);
  const tagEventsHistoryIndexRef = useRef(0);
  const [canUndoEvents, setCanUndoEvents] = useState(false);
  const [canRedoEvents, setCanRedoEvents] = useState(false);

  const resetTagEventsForProjectSwitch = useCallback((initialEvents: TagEvent[]) => {
    _setTagEvents(initialEvents);
    tagEventsHistoryRef.current = [initialEvents];
    tagEventsHistoryIndexRef.current = 0;
    setCanUndoEvents(false);
    setCanRedoEvents(false);
  }, []);

  const setTagEvents = useCallback((action: React.SetStateAction<TagEvent[]>) => {
    _setTagEvents((prev) => {
      const next = typeof action === 'function' ? (action as any)(prev) : action;
      const history = tagEventsHistoryRef.current;
      const index = tagEventsHistoryIndexRef.current;
      const newHistory = history.slice(0, index + 1);
      newHistory.push(next);
      if (newHistory.length > 50) newHistory.shift();
      tagEventsHistoryRef.current = newHistory;
      tagEventsHistoryIndexRef.current = newHistory.length - 1;
      queueMicrotask(() => {
        setCanUndoEvents(tagEventsHistoryIndexRef.current > 0);
        setCanRedoEvents(tagEventsHistoryIndexRef.current < tagEventsHistoryRef.current.length - 1);
      });
      return next;
    });
  }, []);

  const handleUndoEvents = useCallback(() => {
    if (tagEventsHistoryIndexRef.current > 0) {
      tagEventsHistoryIndexRef.current -= 1;
      _setTagEvents(tagEventsHistoryRef.current[tagEventsHistoryIndexRef.current]);
      setCanUndoEvents(tagEventsHistoryIndexRef.current > 0);
      setCanRedoEvents(tagEventsHistoryIndexRef.current < tagEventsHistoryRef.current.length - 1);
    }
  }, []);

  const handleRedoEvents = useCallback(() => {
    if (tagEventsHistoryIndexRef.current < tagEventsHistoryRef.current.length - 1) {
      tagEventsHistoryIndexRef.current += 1;
      _setTagEvents(tagEventsHistoryRef.current[tagEventsHistoryIndexRef.current]);
      setCanUndoEvents(tagEventsHistoryIndexRef.current > 0);
      setCanRedoEvents(tagEventsHistoryIndexRef.current < tagEventsHistoryRef.current.length - 1);
    }
  }, []);

  const [isTaggingMode, setIsTaggingMode] = useState(false);
  const [activeRecordings, setActiveRecordings] = useState<ActiveRecording[]>([]);
  const activeRecording =
    activeRecordings.length > 0 ? activeRecordings[activeRecordings.length - 1] : null;
  const setActiveRecording = useCallback(
    (val: ActiveRecording | null | ((prev: ActiveRecording | null) => ActiveRecording | null)) => {
      setActiveRecordings((prev) => {
        const current = prev.length > 0 ? prev[prev.length - 1] : null;
        const next = typeof val === 'function' ? val(current) : val;
        if (!next) return [];
        return [next];
      });
    },
    []
  );

  const handleTogglePadQuickTag = useCallback(() => {
    setIsPadQuickTagEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('advanced_pad_quick_tag_enabled', String(next));
      } catch (_) {}
      showNotification(
        next
          ? 'Quick Tag enabled for Coding Pad (lead/lag buffers active)'
          : 'Quick Tag disabled for Coding Pad (tags record with manual start/stop)',
        next ? '#c6ff1f' : '#f59e0b'
      );
      return next;
    });
  }, [showNotification]);

  const [filterTagId, setFilterTagId] = useState<string | null>(null);
  const [filterLabelId, setFilterLabelId] = useState<string | null>(null);
  const [tagSettingsOpen, setTagSettingsOpen] = useState(false);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [selectedEventLogs, setSelectedEventLogs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (activeRecordings.length > 1) {
      if (labelsActiveTargetTab !== 'all' && !activeRecordings.some((r) => r.tagId === labelsActiveTargetTab)) {
        setLabelsActiveTargetTab('all');
      }
    } else if (activeRecordings.length === 0 && selectedEventIds.size > 1) {
      if (labelsActiveTargetTab !== 'all' && !selectedEventIds.has(labelsActiveTargetTab)) {
        setLabelsActiveTargetTab('all');
      }
    } else {
      if (labelsActiveTargetTab !== 'all') {
        setLabelsActiveTargetTab('all');
      }
    }
  }, [activeRecordings, selectedEventIds, labelsActiveTargetTab]);

  const [playbarEventId, setPlaybarEventId] = useState<string | null>(null);
  const [isMultiSelectAction, setIsMultiSelectAction] = useState(false);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [tempTag, setTempTag] = useState<Partial<TagData>>({});
  const [csvImportState, setCsvImportState] = useState<CsvImportState | null>(null);

  const [eventSortMode, setEventSortMode] = useState<'recent' | 'timing'>('recent');
  const [isEventsEditMode, setIsEventsEditMode] = useState(false);
  const [bulkDeleteConfirmation, setBulkDeleteConfirmation] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [editEventModal, setEditEventModal] = useState<EditEventModalState | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
  const [tagDeleteConfirmation, setTagDeleteConfirmation] = useState<string | null>(null);
  const [workspaceAlert, setWorkspaceAlert] = useState<string | null>(null);
  const [confirmUnsavedModal, setConfirmUnsavedModal] = useState<boolean>(false);
  const [lastTagActionTimestamp, setLastTagActionTimestamp] = useState<number>(0);

  const exportLabelsToJSON = useCallback(() => {
    downloadLabelsJSON(labels, labelGroups, project.name);
  }, [labels, labelGroups, project.name]);

  const exportUnifiedSetupToJSON = useCallback(() => {
    downloadUnifiedSetupJSON({
      tags,
      labels,
      labelGroups,
      currentNormalTemplateName,
      projectName: project.name,
    });
    showNotification('Exported complete coding setup (Tags + Labels JSON)!', '#c6ff1f');
  }, [tags, labels, labelGroups, currentNormalTemplateName, project.name, showNotification]);

  const handleApplyCodeFile = useCallback(
    (file: CodeFile, clearEvents: boolean) => {
      if (clearEvents) {
        setTagEvents([]);
        setLabelEvents([]);
        setActiveRecordings([]);
        setSelectedEventIds(new Set());
        setSelectedEventLogs(new Set());
      }

      setTags(file.tags || []);
      setLabels(file.labels || []);
      setLabelGroups(file.labelGroups || []);
      setCurrentCodeFileName(file.name);
      try {
        localStorage.setItem(STORAGE_KEY_ACTIVE_CODE_FILE, file.name);
      } catch (e) {}

      let padItemsToSet = file.items;
      if (!padItemsToSet || padItemsToSet.length === 0) {
        padItemsToSet = generateDefaultPadItems(file.tags || [], file.labels || [], file.labelGroups || []);
      }
      setAdvancedPadItems(padItemsToSet);

      if (file.connectors) {
        setConnectors(file.connectors);
      }
    },
    [setTagEvents, setLabelEvents]
  );

  const handleCreateBlankCodeFile = useCallback(
    (clearEvents: boolean) => {
      if (clearEvents) {
        setTagEvents([]);
        setLabelEvents([]);
        setActiveRecordings([]);
        setSelectedEventIds(new Set());
        setSelectedEventLogs(new Set());
      }

      setTags([]);
      setLabels([]);
      setLabelGroups([]);
      setAdvancedPadItems([]);
      setConnectors([]);
      setCurrentCodeFileName('Untitled Blank File');
      try {
        localStorage.setItem(STORAGE_KEY_ACTIVE_CODE_FILE, 'Untitled Blank File');
      } catch (e) {}
    },
    [setTagEvents, setLabelEvents]
  );

  const handleSaveCodeFile = useCallback(
    (name: string, isOverwrite: boolean) => {
      const allFiles = loadAllCodeFiles();
      const existingIndex = allFiles.findIndex((f) => f.name.toLowerCase() === name.toLowerCase());

      const updatedFile: CodeFile = {
        id: isOverwrite && existingIndex !== -1 ? allFiles[existingIndex].id : 'custom-' + Date.now(),
        name: name,
        description:
          isOverwrite && existingIndex !== -1 && allFiles[existingIndex].description
            ? allFiles[existingIndex].description
            : 'Custom football coding file',
        createdAt:
          isOverwrite && existingIndex !== -1 && allFiles[existingIndex].createdAt
            ? allFiles[existingIndex].createdAt
            : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isBuiltIn: false,
        tags: tags,
        labels: labels,
        labelGroups: labelGroups || [],
        items: advancedPadItems || [],
        connectors: connectors || [],
      };

      let newFilesList: CodeFile[];
      if (existingIndex !== -1 && isOverwrite) {
        newFilesList = [...allFiles];
        newFilesList[existingIndex] = updatedFile;
      } else {
        newFilesList = [updatedFile, ...allFiles.filter((f) => f.name.toLowerCase() !== name.toLowerCase())];
      }

      saveAllCodeFiles(newFilesList);
      setCurrentCodeFileName(name);
      try {
        localStorage.setItem(STORAGE_KEY_ACTIVE_CODE_FILE, name);
      } catch (e) {}
      showNotification(
        'Saved Code File: "' + name + '" (Tags, Labels & Pad Layout synchronized)',
        '#c6ff1f'
      );
    },
    [tags, labels, labelGroups, advancedPadItems, connectors, showNotification]
  );

  const handleApplyNormalTemplate = useCallback(
    (
      template: {
        tags: TagData[];
        labels: Label[];
        labelGroups: LabelGroup[];
        name: string;
      },
      mode: 'replace' | 'merge'
    ) => {
      if (mode === 'replace') {
        setTags(template.tags);
        setLabels(template.labels);
        setLabelGroups(template.labelGroups || []);
        setCurrentNormalTemplateName(template.name);

        let nextX = 50;
        let nextY = 50;
        const newItems: AdvancedPadItem[] = [];

        template.tags.forEach((t) => {
          newItems.push({
            id: t.id,
            type: 'tag',
            x: nextX,
            y: nextY,
            width: 120,
            height: 40,
            zIndex: 10,
          });
          nextX += 135;
          if (nextX > 750) {
            nextX = 50;
            nextY += 55;
          }
        });

        nextX = 50;
        nextY += 70;

        template.labels.forEach((l) => {
          newItems.push({
            id: l.id,
            type: 'label',
            x: nextX,
            y: nextY,
            width: 120,
            height: 44,
            zIndex: 10,
          });
          nextX += 135;
          if (nextX > 750) {
            nextX = 50;
            nextY += 55;
          }
        });

        setAdvancedPadItems(newItems);
      } else {
        setTags((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          const existingNames = new Set(prev.map((t) => t.name.toLowerCase()));
          const toAdd = template.tags.filter(
            (t) => !existingIds.has(t.id) && !existingNames.has(t.name.toLowerCase())
          );
          return [...prev, ...toAdd];
        });

        setLabels((prev) => {
          const existingIds = new Set(prev.map((l) => l.id));
          const existingNames = new Set(prev.map((l) => l.name.toLowerCase()));
          const toAdd = template.labels.filter(
            (l) => !existingIds.has(l.id) && !existingNames.has(l.name.toLowerCase())
          );
          return [...prev, ...toAdd];
        });

        setLabelGroups((prev) => {
          const existingIds = new Set(prev.map((g) => g.id));
          const existingNames = new Set(prev.map((g) => g.name.toLowerCase()));
          const toAdd = (template.labelGroups || []).filter(
            (g) => !existingIds.has(g.id) && !existingNames.has(g.name.toLowerCase())
          );
          return [...prev, ...toAdd];
        });

        setCurrentNormalTemplateName((prev) => (prev ? `${prev} + ${template.name}` : template.name));
      }
    },
    [setCurrentNormalTemplateName]
  );

  const handleUnifiedFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const { parsedTags, parsedLabels, parsedGroups, tplName } = parseUnifiedCodingJSON(text, file.name);

          if (parsedTags.length === 0 && parsedLabels.length === 0) {
            showNotification('No tags or labels found in file.', '#ef4444');
            return;
          }

          handleApplyNormalTemplate(
            {
              tags: parsedTags.length > 0 ? parsedTags : tags,
              labels: parsedLabels.length > 0 ? parsedLabels : labels,
              labelGroups: parsedGroups.length > 0 ? parsedGroups : labelGroups,
              name: tplName,
            },
            'replace'
          );

          showNotification(
            `Applied coding setup "${tplName}" (${parsedTags.length} tags, ${parsedLabels.length} labels)!`,
            '#c6ff1f'
          );
        } catch (err) {
          showNotification('Error parsing JSON file. Check file syntax.', '#ef4444');
        }
      };
      reader.readAsText(file);
      if (unifiedFileInputRef.current) unifiedFileInputRef.current.value = '';
    },
    [handleApplyNormalTemplate, tags, labels, labelGroups, showNotification]
  );

  const importLabelsFromJSON = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const data = JSON.parse(text);

          let labelCount = 0;
          let tagCount = 0;

          if (data.labels && Array.isArray(data.labels)) {
            setLabels((prev) => {
              const existingIds = new Set(prev.map((l) => l.id));
              const newLabels = data.labels.filter((l: any) => !existingIds.has(l.id));
              labelCount = newLabels.length;
              return [...prev, ...newLabels];
            });
          }

          if (data.labelGroups && Array.isArray(data.labelGroups)) {
            setLabelGroups((prev) => {
              const existingIds = new Set(prev.map((g) => g.id));
              const newGroups = data.labelGroups.filter((g: any) => !existingIds.has(g.id));
              return [...prev, ...newGroups];
            });
          }

          if (data.tags && Array.isArray(data.tags)) {
            setTags((prev) => {
              const existingIds = new Set(prev.map((t) => t.id));
              const newTags = data.tags.filter((t: any) => !existingIds.has(t.id));
              tagCount = newTags.length;
              return [...prev, ...newTags];
            });
          }

          if (tagCount > 0 && labelCount > 0) {
            showNotification(`Imported ${labelCount} labels and ${tagCount} tags successfully.`, '#c6ff1f');
          } else if (labelCount > 0) {
            showNotification('Labels imported successfully.', '#c6ff1f');
          } else {
            showNotification('Imported coding items from file.', '#c6ff1f');
          }
        } catch (err) {
          showNotification('Failed to parse JSON file.', '#ef4444');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [showNotification]);

  const handleBulkDeleteLabels = () => {
    if (selectedLabelIds.size > 0 || selectedGroupIds.size > 0) {
      setLabelDeleteConfirmation(true);
    }
  };

  const confirmBulkDeleteLabels = () => {
    setLabelGroups((prev) => prev.filter((g) => !selectedGroupIds.has(g.id)));
    setLabels((prev) =>
      prev
        .filter((l) => !selectedLabelIds.has(l.id))
        .map((l) => {
          if (l.groupId && selectedGroupIds.has(l.groupId)) {
            return { ...l, groupId: undefined };
          }
          return l;
        })
    );
    setSelectedLabelIds(new Set());
    setSelectedGroupIds(new Set());
    setLabelDeleteConfirmation(false);
    setIsLabelsSelectMode(false);
    showNotification('Labels deleted successfully.', '#c6ff1f');
  };

  const exportEventsToCSV = useCallback(() => {
    if (tagEvents.length === 0) {
      showNotification('No events to export.', '#ef4444');
      return;
    }

    const currentPeriodSyncs = latestProjectDataRef.current?.periodSyncs || project.data.periodSyncs || [];
    downloadEventsCSV({
      tagEvents,
      tags,
      labels,
      periodSyncs: currentPeriodSyncs,
      projectName: project.name,
      isLive,
    });
  }, [tagEvents, tags, labels, project, isLive, latestProjectDataRef, showNotification]);

  const importEventsFromCSV = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.tsv,.txt';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (!text) return;

        const parsed = parseImportedEventsCSV({ text, tags, labels, tagEvents });
        if ('errorMessage' in parsed) {
          showNotification(parsed.errorMessage, '#ef4444');
          return;
        }

        setCsvImportState({
          isOpen: true,
          events: parsed.events,
          newTags: parsed.newTags,
          newLabels: parsed.newLabels,
          errors: parsed.errors,
        });
      };
      reader.readAsText(file);
    };
    input.click();
  }, [tags, labels, tagEvents, showNotification]);

  const executeConnectors = (
    sourceId: string,
    currentActiveRecs: ActiveRecording[],
    newEvents: TagEvent[],
    createdEventId: string | null,
    isActivation: boolean,
    options?: { ignoreLeadLag?: boolean }
  ) => {
    const nextActiveRecs = currentActiveRecs.map((r) => ({
      ...r,
      labelIds: r.labelIds ? [...r.labelIds] : [],
    }));
    const additionalEvents: TagEvent[] = [];
    const newlySelectedEventIds = new Set<string>();
    let playbarEvtId: string | null = null;
    let notification: string | null = null;

    const sourceConnectors = connectors.filter((c) => c.sourceId === sourceId && c.enabled);
    const targetConnectors = connectors.filter((c) => c.targetId === sourceId && c.enabled);

    const liveMatchNow = isLive
      ? (liveClockBridgeRef.current?.getMatchTimeSec() ?? currentTime)
      : undefined;
    const activeLivePeriod = isLive ? liveClockBridgeRef.current?.matchPeriod || '1st-half' : undefined;

    if (isActivation) {
      for (const conn of sourceConnectors) {
        const targetIsTag = tags.some((t) => t.id === conn.targetId);
        const targetIsLabel = labels.some((l) => l.id === conn.targetId);

        if (conn.type === 'exclusive') {
          if (targetIsTag) {
            const recIdx = nextActiveRecs.findIndex((r) => r.tagId === conn.targetId);
            if (recIdx >= 0) {
              const targetRec = nextActiveRecs[recIdx];
              let start = targetRec.startTime;
              let end = currentTime;
              if (start > end) {
                [start, end] = [end, start];
              }
              if (isValidEvent(start, end)) {
                let mStart = targetRec.matchStartTime;
                let mEnd = liveMatchNow;
                if (mStart !== undefined && mEnd !== undefined && mStart > mEnd) [mStart, mEnd] = [mEnd, mStart];
                additionalEvents.push({
                  id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                  tagId: targetRec.tagId,
                  startTime: start,
                  endTime: end,
                  labelIds: targetRec.labelIds,
                  periodId: targetRec.periodId || activeLivePeriod,
                  matchStart: mStart,
                  matchEnd: mEnd,
                });
              }
              nextActiveRecs.splice(recIdx, 1);
            }
          } else if (targetIsLabel) {
            nextActiveRecs.forEach((r) => {
              if (r.labelIds?.includes(conn.targetId)) {
                r.labelIds = r.labelIds.filter((id) => id !== conn.targetId);
              }
            });
          }
        } else if (conn.type === 'trigger') {
          if (targetIsTag) {
            const targetTag = tags.find((t) => t.id === conn.targetId);
            if (targetTag) {
              const targetShouldLeadLag = !options?.ignoreLeadLag && Boolean(targetTag.leadLagEnabled);
              if (targetShouldLeadLag) {
                const pre = targetTag.preTime ?? 10;
                const post = targetTag.postTime ?? 10;
                const start = Math.max(0, currentTime - pre);
                const end = Math.min(duration, currentTime + post);
                if (isValidEvent(start, end)) {
                  const evId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
                  additionalEvents.push({
                    id: evId,
                    tagId: targetTag.id,
                    startTime: start,
                    endTime: end,
                    notes: '',
                    periodId: activeLivePeriod,
                    matchStart: liveMatchNow !== undefined ? Math.max(0, liveMatchNow - pre) : undefined,
                    matchEnd: liveMatchNow !== undefined ? liveMatchNow + post : undefined,
                  });
                  notification = `Triggered: ${targetTag.name}`;
                }
              } else {
                if (!nextActiveRecs.some((r) => r.tagId === targetTag.id)) {
                  nextActiveRecs.push({
                    tagId: targetTag.id,
                    startTime: currentTime,
                    labelIds: [],
                    matchStartTime: liveMatchNow,
                    periodId: activeLivePeriod,
                  });
                  notification = `Triggered: ${targetTag.name}`;
                }
              }
            }
          }
        } else if (conn.type === 'assign') {
          if (targetIsLabel) {
            if (createdEventId) {
              const targetEv =
                newEvents.find((e) => e.id === createdEventId) ||
                additionalEvents.find((e) => e.id === createdEventId);
              if (targetEv) {
                targetEv.labelIds = [...(targetEv.labelIds || []), conn.targetId];
              }
            } else {
              const matchingRec = nextActiveRecs.find((r) => r.tagId === sourceId);
              if (matchingRec) {
                if (!matchingRec.labelIds) matchingRec.labelIds = [];
                if (!matchingRec.labelIds.includes(conn.targetId)) {
                  matchingRec.labelIds.push(conn.targetId);
                }
              } else {
                nextActiveRecs.forEach((r) => {
                  if (!r.labelIds) r.labelIds = [];
                  if (!r.labelIds.includes(conn.targetId)) {
                    r.labelIds.push(conn.targetId);
                  }
                });
              }
            }
          }
        }
      }

      for (const conn of targetConnectors) {
        const sourceIsTag = tags.some((t) => t.id === conn.sourceId);
        const sourceIsLabel = labels.some((l) => l.id === conn.sourceId);

        if (conn.type === 'exclusive' || conn.type === 'defuse') {
          if (sourceIsTag) {
            const recIdx = nextActiveRecs.findIndex((r) => r.tagId === conn.sourceId);
            if (recIdx >= 0) {
              const sourceRec = nextActiveRecs[recIdx];
              if (conn.type === 'exclusive') {
                let start = sourceRec.startTime;
                let end = currentTime;
                if (start > end) {
                  [start, end] = [end, start];
                }
                if (isValidEvent(start, end)) {
                  let mStart = sourceRec.matchStartTime;
                  let mEnd = liveMatchNow;
                  if (mStart !== undefined && mEnd !== undefined && mStart > mEnd)
                    [mStart, mEnd] = [mEnd, mStart];
                  additionalEvents.push({
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    tagId: sourceRec.tagId,
                    startTime: start,
                    endTime: end,
                    labelIds: sourceRec.labelIds,
                    periodId: sourceRec.periodId || activeLivePeriod,
                    matchStart: mStart,
                    matchEnd: mEnd,
                  });
                }
              }
              nextActiveRecs.splice(recIdx, 1);
            }
          } else if (sourceIsLabel) {
            nextActiveRecs.forEach((r) => {
              if (r.labelIds?.includes(conn.sourceId)) {
                r.labelIds = r.labelIds.filter((id) => id !== conn.sourceId);
              }
            });
          }
        }
      }
    } else {
      for (const conn of sourceConnectors) {
        const targetIsTag = tags.some((t) => t.id === conn.targetId);
        if (conn.type === 'trigger') {
          if (targetIsTag) {
            const recIdx = nextActiveRecs.findIndex((r) => r.tagId === conn.targetId);
            if (recIdx >= 0) {
              const targetRec = nextActiveRecs[recIdx];
              let start = targetRec.startTime;
              let end = currentTime;
              if (start > end) {
                [start, end] = [end, start];
              }
              if (isValidEvent(start, end)) {
                let mStart = targetRec.matchStartTime;
                let mEnd = liveMatchNow;
                if (mStart !== undefined && mEnd !== undefined && mStart > mEnd) [mStart, mEnd] = [mEnd, mStart];
                additionalEvents.push({
                  id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                  tagId: targetRec.tagId,
                  startTime: start,
                  endTime: end,
                  labelIds: targetRec.labelIds,
                  periodId: targetRec.periodId || activeLivePeriod,
                  matchStart: mStart,
                  matchEnd: mEnd,
                });
              }
              nextActiveRecs.splice(recIdx, 1);
            }
          }
        }
      }
    }

    return { nextActiveRecs, additionalEvents, newlySelectedEventIds, playbarEvtId, notification };
  };

  const handleLabelClick = (labelId: string, explicitTargetTab?: string) => {
    const currentTargetTab = explicitTargetTab !== undefined ? explicitTargetTab : labelsActiveTargetTab;
    if (isTaggingMode) {
      const assignConn = connectors.find(
        (c) => c.targetId === labelId && c.type === 'assign' && c.enabled
      );
      if (assignConn && tags.some((t) => t.id === assignConn.sourceId)) {
        const tagId = assignConn.sourceId;
        const isCurrentlyRecordingTag = activeRecordings.some((r) => r.tagId === tagId);

        if (isCurrentlyRecordingTag) {
          const existingRecIndex = activeRecordings.findIndex((r) => r.tagId === tagId);
          if (existingRecIndex >= 0) {
            const existingRec = activeRecordings[existingRecIndex];
            let start = existingRec.startTime;
            let end = currentTime;
            if (start > end) {
              [start, end] = [end, start];
            }

            if (isValidEvent(start, end)) {
              const newEventId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
              const liveMatchNow = isLive
                ? (liveClockBridgeRef.current?.getMatchTimeSec() ?? currentTime)
                : undefined;
              let mStart = existingRec.matchStartTime;
              let mEnd = liveMatchNow;
              if (mStart !== undefined && mEnd !== undefined && mStart > mEnd) {
                [mStart, mEnd] = [mEnd, mStart];
              }
              const newEvent: TagEvent = {
                id: newEventId,
                tagId: tagId,
                startTime: start,
                endTime: end,
                labelIds: existingRec.labelIds || [],
                periodId:
                  existingRec.periodId ||
                  (isLive ? liveClockBridgeRef.current?.matchPeriod || '1st-half' : undefined),
                matchStart: mStart,
                matchEnd: mEnd,
              };
              setTagEvents((prev) => [...prev, newEvent]);
              showNotification(
                `Saved: ${tags.find((t) => t.id === tagId)?.name || 'Event'} with attached Qualifiers`,
                '#c6ff1f'
              );
            } else {
              showNotification('Invalid event duration', '#ef4444');
            }

            setActiveRecordings((prev) => prev.filter((_, idx) => idx !== existingRecIndex));
            return;
          }
        } else {
          const targetTag = tags.find((t) => t.id === tagId);
          if (targetTag) {
            const liveMatchNow = isLive
              ? (liveClockBridgeRef.current?.getMatchTimeSec() ?? currentTime)
              : undefined;
            const newActiveRecs: ActiveRecording[] = [
              ...activeRecordings,
              {
                tagId: tagId,
                startTime: currentTime,
                labelIds: [labelId],
                matchStartTime: liveMatchNow,
                periodId: isLive ? liveClockBridgeRef.current?.matchPeriod || '1st-half' : undefined,
              },
            ];
            setActiveRecordings(newActiveRecs);
            return;
          }
        }
      }

      let newActiveRecs = activeRecordings.map((r) => ({
        ...r,
        labelIds: r.labelIds ? [...r.labelIds] : [],
      }));
      const newEventsToUpdate = new Map<string, TagEvent>();
      let isActivation = false;
      let createdEventId: string | null = null;

      if (newActiveRecs.length > 0) {
        if (currentTargetTab && currentTargetTab !== 'all') {
          const targetRec = newActiveRecs.find((r) => r.tagId === currentTargetTab);
          if (targetRec) {
            if (!targetRec.labelIds) targetRec.labelIds = [];
            if (targetRec.labelIds.includes(labelId)) {
              targetRec.labelIds = targetRec.labelIds.filter((l) => l !== labelId);
              isActivation = false;
            } else {
              targetRec.labelIds.push(labelId);
              isActivation = true;
            }
            const targetTag = tags.find((t) => t.id === currentTargetTab);
            const labelObj = labels.find((l) => l.id === labelId);
            showNotification(
              `${isActivation ? '+' : '−'} ${labelObj?.name || 'Label'} · ${targetTag?.name || 'Tag'}`,
              isActivation ? '#c6ff1f' : '#ef4444'
            );
          }
        } else {
          const allHaveLabel = newActiveRecs.every((r) => r.labelIds?.includes(labelId));
          if (allHaveLabel) {
            newActiveRecs.forEach((r) => {
              r.labelIds = r.labelIds?.filter((l) => l !== labelId);
            });
            isActivation = false;
          } else {
            newActiveRecs.forEach((r) => {
              if (!r.labelIds) r.labelIds = [];
              if (!r.labelIds.includes(labelId)) {
                r.labelIds.push(labelId);
              }
            });
            isActivation = true;
          }
          const labelObj = labels.find((l) => l.id === labelId);
          showNotification(
            `${isActivation ? '+' : '−'} ${labelObj?.name || 'Label'}`,
            isActivation ? '#c6ff1f' : '#ef4444'
          );
        }
      } else if (selectedEventIds.size > 0) {
        if (currentTargetTab && currentTargetTab !== 'all' && selectedEventIds.has(currentTargetTab)) {
          const evt = tagEvents.find((e) => e.id === currentTargetTab);
          if (evt) {
            const updatedEvt = { ...evt, labelIds: evt.labelIds ? [...evt.labelIds] : [] };
            if (updatedEvt.labelIds.includes(labelId)) {
              updatedEvt.labelIds = updatedEvt.labelIds.filter((l) => l !== labelId);
              isActivation = false;
            } else {
              updatedEvt.labelIds.push(labelId);
              isActivation = true;
            }
            newEventsToUpdate.set(evt.id, updatedEvt);
            const evtTag = tags.find((t) => t.id === evt.tagId);
            const labelObj = labels.find((l) => l.id === labelId);
            showNotification(
              `${isActivation ? '+' : '−'} ${labelObj?.name || 'Label'} · ${evtTag?.name || 'Event'}`,
              isActivation ? '#c6ff1f' : '#ef4444'
            );
          }
        } else {
          let anyAdded = false;
          tagEvents.forEach((evt) => {
            if (selectedEventIds.has(evt.id)) {
              const updatedEvt = { ...evt, labelIds: evt.labelIds ? [...evt.labelIds] : [] };
              if (updatedEvt.labelIds.includes(labelId)) {
                updatedEvt.labelIds = updatedEvt.labelIds.filter((l) => l !== labelId);
              } else {
                updatedEvt.labelIds.push(labelId);
                anyAdded = true;
              }
              newEventsToUpdate.set(evt.id, updatedEvt);
            }
          });
          isActivation = anyAdded;
        }
        if (selectedEventIds.size === 1) {
          createdEventId = Array.from(selectedEventIds)[0];
        }
      } else {
        showNotification('No active recording or selected event to label', '#ef4444');
        return;
      }

      let additionalNewEvents: TagEvent[] = [];
      const res = executeConnectors(
        labelId,
        newActiveRecs,
        Array.from(newEventsToUpdate.values()),
        createdEventId,
        isActivation
      );
      newActiveRecs = res.nextActiveRecs;
      additionalNewEvents = res.additionalEvents;

      if (res.notification) {
        showNotification(res.notification, '#c6ff1f');
      }

      setActiveRecordings(newActiveRecs);
      if (newEventsToUpdate.size > 0 || additionalNewEvents.length > 0) {
        setTagEvents((prev) => {
          const next = prev.map((evt) => (newEventsToUpdate.has(evt.id) ? newEventsToUpdate.get(evt.id)! : evt));
          return [...next, ...additionalNewEvents];
        });
      }
    } else {
      setFilterLabelId((current) => (current === labelId ? null : labelId));
    }
  };

  const handleTagClick = (tagId: string, options?: { ignoreLeadLag?: boolean }) => {
    const tag = tags.find((t) => t.id === tagId);
    if (!tag) return;

    if (isLive) {
      setLastTagActionTimestamp(Date.now());
    }

    if (isTaggingMode) {
      let newEvents: TagEvent[] = [];
      const currentActiveRecs = activeRecordings.map((r) => ({
        ...r,
        labelIds: r.labelIds ? [...r.labelIds] : [],
      }));
      let createdEventId: string | null = null;
      const newlySelectedEventIds = new Set<string>();
      let playbarEvtId: string | null = null;
      let notification: { text: string; color: string } | null = null;
      let isActivation = false;

      const useLeadLag = !options?.ignoreLeadLag && Boolean(tag.leadLagEnabled);
      const currentLiveMatchSec = isLive
        ? (liveClockBridgeRef.current?.getMatchTimeSec() ?? currentTime)
        : undefined;
      const activeLivePeriod = isLive ? liveClockBridgeRef.current?.matchPeriod || '1st-half' : undefined;

      if (useLeadLag) {
        const pre = tag.preTime ?? 10;
        const post = tag.postTime ?? 10;
        const start = Math.max(0, currentTime - pre);
        const end = Math.min(duration, currentTime + post);

        if (isValidEvent(start, end)) {
          createdEventId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
          const mStart =
            isLive && currentLiveMatchSec !== undefined ? Math.max(0, currentLiveMatchSec - pre) : undefined;
          const mEnd = isLive && currentLiveMatchSec !== undefined ? currentLiveMatchSec + post : undefined;
          newEvents.push({
            id: createdEventId,
            tagId: tagId,
            startTime: start,
            endTime: end,
            notes: '',
            periodId: activeLivePeriod,
            matchStart: mStart,
            matchEnd: mEnd,
          });
          notification = { text: `Saved: ${tag.name}`, color: tag.color || '#fff' };
          isActivation = true;
        } else {
          showNotification('Invalid event duration', '#ef4444');
          return;
        }
      } else {
        const existingRecIndex = currentActiveRecs.findIndex((r) => r.tagId === tagId);

        if (existingRecIndex >= 0) {
          const existingRec = currentActiveRecs[existingRecIndex];
          let start = existingRec.startTime;
          let end = currentTime;
          if (start > end) {
            [start, end] = [end, start];
          }

          if (!isValidEvent(start, end)) {
            showNotification('Invalid event duration', '#ef4444');
          } else {
            const newEventId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
            let mStart = existingRec.matchStartTime;
            let mEnd = currentLiveMatchSec;
            if (mStart !== undefined && mEnd !== undefined && mStart > mEnd) {
              [mStart, mEnd] = [mEnd, mStart];
            }
            newEvents.push({
              id: newEventId,
              tagId: tagId,
              startTime: start,
              endTime: end,
              labelIds: existingRec.labelIds || [],
              periodId: existingRec.periodId || activeLivePeriod,
              matchStart: mStart,
              matchEnd: mEnd,
            });
            notification = { text: `Saved: ${tag.name}`, color: tag.color || '#fff' };
          }
          currentActiveRecs.splice(existingRecIndex, 1);
          isActivation = false;
        } else {
          currentActiveRecs.push({
            tagId,
            startTime: currentTime,
            labelIds: [],
            matchStartTime: currentLiveMatchSec,
            periodId: activeLivePeriod,
          });
          isActivation = true;
        }
      }

      let finalActiveRecs = currentActiveRecs;
      const res = executeConnectors(tagId, currentActiveRecs, newEvents, createdEventId, isActivation, options);
      finalActiveRecs = res.nextActiveRecs;
      newEvents = [...newEvents, ...res.additionalEvents];
      for (const id of res.newlySelectedEventIds) newlySelectedEventIds.add(id);
      if (res.playbarEvtId) playbarEvtId = res.playbarEvtId;
      if (res.notification) notification = { text: res.notification, color: '#c6ff1f' };

      if (newEvents.length > 0) {
        setTagEvents((prev) => [...prev, ...newEvents]);
      }
      setActiveRecordings(finalActiveRecs);
      if (newlySelectedEventIds.size > 0) {
        setSelectedEventIds(newlySelectedEventIds);
      } else if (newEvents.length > 0 && !createdEventId && finalActiveRecs.length === 0) {
        setSelectedEventIds(new Set());
      }
      if (playbarEvtId !== null) {
        setPlaybarEventId(playbarEvtId);
      } else if (finalActiveRecs.length === 0) {
        setPlaybarEventId(null);
      }
      if (notification) {
        showNotification(notification.text, notification.color);
      }
    } else {
      setFilterTagId((current) => (current === tagId ? null : tagId));
    }
  };

  const cancelRecording = useCallback(() => {
    setActiveRecordings([]);
  }, []);

  const timelineLanes = useMemo(() => {
    let allEvents = [...tagEvents];

    if (isTaggingMode && activeRecordings.length > 0) {
      activeRecordings.forEach((rec) => {
        const recTag = tags.find((t) => t.id === rec.tagId);
        allEvents.push({
          id: `RECORDING_PSEUDO_${rec.tagId}`,
          tagId: rec.tagId,
          startTime: Math.min(rec.startTime, currentTime),
          endTime: Math.max(rec.startTime, currentTime),
          notes: `Recording ${recTag?.name || 'Event'}...`,
        });
      });
    }

    if (filterTagId) {
      allEvents = allEvents.filter((e) => e.tagId === filterTagId);
    }
    if (filterLabelId) {
      allEvents = allEvents.filter((e) => e.labelIds && e.labelIds.includes(filterLabelId));
    }

    allEvents.sort((a, b) => a.startTime - b.startTime);

    const lanes: TagEvent[][] = [];

    allEvents.forEach((event) => {
      let placed = false;
      for (let i = 0; i < lanes.length; i++) {
        const lane = lanes[i];
        const lastEvent = lane[lane.length - 1];
        if (event.startTime >= lastEvent.endTime + 0.05) {
          lane.push(event);
          placed = true;
          break;
        }
      }
      if (!placed) {
        lanes.push([event]);
      }
    });
    return lanes;
  }, [tagEvents, tags, activeRecordings, currentTime, isTaggingMode, filterTagId, filterLabelId]);

  const getFilteredEvents = useCallback(() => {
    let events = [...tagEvents];
    if (filterTagId) {
      events = events.filter((e) => e.tagId === filterTagId);
    }
    if (filterLabelId) {
      events = events.filter((e) => e.labelIds && e.labelIds.includes(filterLabelId));
    }
    return events.sort((a, b) => a.startTime - b.startTime);
  }, [tagEvents, filterTagId, filterLabelId]);

  const getDisplayEvents = useCallback(() => {
    let events = [...tagEvents];
    if (filterTagId) {
      events = events.filter((e) => e.tagId === filterTagId);
    }
    if (filterLabelId) {
      events = events.filter((e) => e.labelIds && e.labelIds.includes(filterLabelId));
    }
    if (eventSortMode === 'recent') {
      return events.reverse();
    }
    return events.sort((a, b) => a.startTime - b.startTime);
  }, [tagEvents, filterTagId, filterLabelId, eventSortMode]);

  const handleEventContextMenu = (e: React.MouseEvent, eventId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const menuHeight = 80;
    const windowHeight = window.innerHeight;
    let y = e.clientY;
    if (y + menuHeight > windowHeight) {
      y = windowHeight - menuHeight - 10;
    }
    setContextMenu({ x: e.clientX, y: y, eventId });
  };

  const handleEditEvent = () => {
    if (!contextMenu) return;
    const evt = tagEvents.find((e) => e.id === contextMenu.eventId);
    if (evt) {
      setEditEventModal({
        isOpen: true,
        eventId: evt.id,
        startTime: evt.startTime,
        endTime: evt.endTime,
        notes: evt.notes || '',
      });
    }
    setContextMenu(null);
  };

  const requestCloseEditEventModal = () => {
    if (!editEventModal) return;
    const originalEvent = tagEvents.find((e) => e.id === editEventModal.eventId);
    if (
      originalEvent &&
      (originalEvent.notes !== editEventModal.notes ||
        originalEvent.startTime !== editEventModal.startTime ||
        originalEvent.endTime !== editEventModal.endTime)
    ) {
      setConfirmUnsavedModal(true);
    } else {
      setEditEventModal(null);
    }
  };

  const saveEditedEvent = () => {
    if (!editEventModal) return;
    let start = editEventModal.startTime;
    let end = editEventModal.endTime;
    if (start > end) {
      const temp = start;
      start = end;
      end = temp;
    }
    if (!isValidEvent(start, end)) {
      showNotification('Invalid event duration', '#ef4444');
      return;
    }

    setTagEvents((prev) =>
      prev.map((e) => {
        if (e.id === editEventModal.eventId) {
          return {
            ...e,
            startTime: start,
            endTime: end,
            notes: editEventModal.notes,
          };
        }
        return e;
      })
    );
    setEditEventModal(null);
    setConfirmUnsavedModal(false);
  };

  const deleteTag = (tagId: string) => {
    setTagDeleteConfirmation(tagId);
  };

  const confirmDeleteTag = () => {
    if (tagDeleteConfirmation) {
      const tagId = tagDeleteConfirmation;
      setTags((prev) => prev.filter((t) => t.id !== tagId));
      setTagEvents((prev) => prev.filter((e) => e.tagId !== tagId));
      const deletedEventIds = tagEvents.filter((e) => e.tagId === tagId).map((e) => e.id);
      if (deletedEventIds.length > 0) {
        const nextPlaylists = playlists.map((p) => ({
          ...p,
          events: p.events.filter((item) => !deletedEventIds.includes(getClipEventId(item))),
        }));
        setPlaylists(nextPlaylists);
        syncPlaylistsToStorage(nextPlaylists);
      }
      setTagDeleteConfirmation(null);
    }
  };

  const handleDeleteEventRequest = () => {
    if (contextMenu) {
      setDeleteConfirmation(contextMenu.eventId);
      setContextMenu(null);
    } else if (editEventModal) {
      setDeleteConfirmation(editEventModal.eventId);
      setEditEventModal(null);
    }
  };

  const deleteEventsByIds = useCallback(
    (eventIdsToDelete: string[]) => {
      if (!eventIdsToDelete || eventIdsToDelete.length === 0) return;
      const deleteSet = new Set(eventIdsToDelete);
      setTagEvents((prev) => prev.filter((e) => !deleteSet.has(e.id)));
      const nextPlaylists = playlists.map((p) => ({
        ...p,
        events: p.events.filter((item) => !deleteSet.has(getClipEventId(item))),
      }));
      setPlaylists(nextPlaylists);
      syncPlaylistsToStorage(nextPlaylists);
      setSelectedEventIds((prev) => {
        const next = new Set(prev);
        eventIdsToDelete.forEach((id) => next.delete(id));
        return next;
      });
      setSelectedEventLogs((prev) => {
        const next = new Set(prev);
        eventIdsToDelete.forEach((id) => next.delete(id));
        return next;
      });
      setPlaybarEventId((currentId) => (currentId && deleteSet.has(currentId) ? null : currentId));
    },
    [setTagEvents, playlists, setPlaylists, syncPlaylistsToStorage]
  );

  const confirmDeleteEvent = () => {
    if (deleteConfirmation) {
      deleteEventsByIds([deleteConfirmation]);
      setDeleteConfirmation(null);
    }
  };

  const handleEventUpdate = (start: number, end: number) => {
    if (selectedEventIds.size !== 1) return;
    const eventId = Array.from(selectedEventIds)[0];
    setTagEvents((prev) =>
      prev.map((e) => {
        if (e.id === eventId) return { ...e, startTime: start, endTime: end };
        return e;
      })
    );
  };

  return {
    labelsEnabled,
    setLabelsEnabled,
    isAdvancedCodingMode,
    setIsAdvancedCodingMode,
    advancedPadItems,
    setAdvancedPadItems,
    connectors,
    setConnectors,
    isPadQuickTagEnabled,
    setIsPadQuickTagEnabled,
    labelGroups,
    setLabelGroups,
    labels,
    setLabels,
    labelEvents,
    setLabelEvents,
    editingLabelId,
    setEditingLabelId,
    editingGroupId,
    setEditingGroupId,
    tempLabel,
    setTempLabel,
    tempGroup,
    setTempGroup,
    draggedGroup,
    setDraggedGroup,
    draggedLabel,
    setDraggedLabel,
    isLabelsSelectMode,
    setIsLabelsSelectMode,
    selectedLabelIds,
    setSelectedLabelIds,
    selectedGroupIds,
    setSelectedGroupIds,
    labelDeleteConfirmation,
    setLabelDeleteConfirmation,
    showNormalTemplateModal,
    setShowNormalTemplateModal,
    currentCodeFileName,
    setCurrentCodeFileName,
    currentNormalTemplateName,
    setCurrentNormalTemplateName,
    showCodeFilesModal,
    setShowCodeFilesModal,
    showCodeFileSaveModal,
    setShowCodeFileSaveModal,
    unifiedFileInputRef,
    labelsActiveTargetTab,
    setLabelsActiveTargetTab,
    tags,
    setTags,
    tagEvents,
    setTagEvents,
    resetTagEventsForProjectSwitch,
    canUndoEvents,
    canRedoEvents,
    handleUndoEvents,
    handleRedoEvents,
    isTaggingMode,
    setIsTaggingMode,
    activeRecordings,
    setActiveRecordings,
    activeRecording,
    setActiveRecording,
    handleTogglePadQuickTag,
    filterTagId,
    setFilterTagId,
    filterLabelId,
    setFilterLabelId,
    tagSettingsOpen,
    setTagSettingsOpen,
    selectedEventIds,
    setSelectedEventIds,
    selectedEventLogs,
    setSelectedEventLogs,
    playbarEventId,
    setPlaybarEventId,
    isMultiSelectAction,
    setIsMultiSelectAction,
    editingTagId,
    setEditingTagId,
    tempTag,
    setTempTag,
    csvImportState,
    setCsvImportState,
    eventSortMode,
    setEventSortMode,
    isEventsEditMode,
    setIsEventsEditMode,
    bulkDeleteConfirmation,
    setBulkDeleteConfirmation,
    contextMenu,
    setContextMenu,
    editEventModal,
    setEditEventModal,
    deleteConfirmation,
    setDeleteConfirmation,
    tagDeleteConfirmation,
    setTagDeleteConfirmation,
    workspaceAlert,
    setWorkspaceAlert,
    confirmUnsavedModal,
    setConfirmUnsavedModal,
    lastTagActionTimestamp,
    exportLabelsToJSON,
    exportUnifiedSetupToJSON,
    handleApplyCodeFile,
    handleCreateBlankCodeFile,
    handleSaveCodeFile,
    handleApplyNormalTemplate,
    handleUnifiedFileSelect,
    importLabelsFromJSON,
    handleBulkDeleteLabels,
    confirmBulkDeleteLabels,
    exportEventsToCSV,
    importEventsFromCSV,
    handleLabelClick,
    handleTagClick,
    cancelRecording,
    timelineLanes,
    getFilteredEvents,
    getDisplayEvents,
    handleEventContextMenu,
    handleEditEvent,
    requestCloseEditEventModal,
    saveEditedEvent,
    deleteTag,
    confirmDeleteTag,
    handleDeleteEventRequest,
    deleteEventsByIds,
    confirmDeleteEvent,
    handleEventUpdate,
  };
}
