import type { Label, LabelGroup, PeriodSync, Tag as TagData, TagEvent } from '../../../types';
import { formatTime } from '../../../utils/math';
import { getCanonicalPeriod } from '../../../utils/periodSyncUtils';
import { parseCSV, parseTimeString } from '../Workspace.utils';

export function downloadLabelsJSON(labels: Label[], labelGroups: LabelGroup[], projectName: string): void {
  const data = { labels, labelGroups };
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `labels_${projectName.replace(/\s+/g, '_')}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadUnifiedSetupJSON(params: {
  tags: TagData[];
  labels: Label[];
  labelGroups: LabelGroup[];
  currentNormalTemplateName: string | null;
  projectName: string;
}): void {
  const { tags, labels, labelGroups, currentNormalTemplateName, projectName } = params;
  const exportPayload = {
    app: 'TacStem Football Analysis',
    format: 'TacStem Normal Coding Template',
    version: '3.0',
    exportedAt: new Date().toISOString(),
    name: currentNormalTemplateName || projectName || 'Match Coding Template',
    description: 'TacStem Unified tags, labels, and groups coding template for football video analysis.',
    tags: tags,
    labels: labels,
    labelGroups: labelGroups || [],
  };

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute('href', dataStr);
  const safeName = (currentNormalTemplateName || projectName || 'coding-template')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  downloadAnchorNode.setAttribute('download', `${safeName}-setup.json`);
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

export function parseUnifiedCodingJSON(text: string, fallbackFileName: string): {
  parsedTags: TagData[];
  parsedLabels: Label[];
  parsedGroups: LabelGroup[];
  tplName: string;
} {
  const data = JSON.parse(text);

  let parsedTags: TagData[] = [];
  let parsedLabels: Label[] = [];
  let parsedGroups: LabelGroup[] = [];
  let tplName = fallbackFileName.replace(/\.[^/.]+$/, '');

  if (Array.isArray(data)) {
    parsedTags = data.map((t: any, idx: number) => ({
      id: String(t.id || `tag-${Date.now()}-${idx}`),
      name: String(t.name || t.tag_name || t.label || `Tag ${idx + 1}`),
      color: String(t.color || '#c6ff1f'),
      shortcut: String(t.shortcut || t.hotkey || ''),
      leadLagEnabled: Boolean(t.leadLagEnabled),
      preTime: typeof t.preTime === 'number' ? t.preTime : 10,
      postTime: typeof t.postTime === 'number' ? t.postTime : 10,
    }));
  } else if (typeof data === 'object' && data !== null) {
    if (data.name) tplName = data.name;

    if (Array.isArray(data.tags)) {
      parsedTags = data.tags.map((t: any, idx: number) => ({
        id: String(t.id || `tag-${Date.now()}-${idx}`),
        name: String(t.name || t.tag_name || t.label || `Tag ${idx + 1}`),
        color: String(t.color || '#c6ff1f'),
        shortcut: String(t.shortcut || t.hotkey || ''),
        leadLagEnabled: Boolean(t.leadLagEnabled),
        preTime: typeof t.preTime === 'number' ? t.preTime : 10,
        postTime: typeof t.postTime === 'number' ? t.postTime : 10,
      }));
    } else if (Array.isArray(data.items)) {
      parsedTags = data.items
        .filter((it: any) => it.type === 'tag')
        .map((it: any, idx: number) => ({
          id: String(it.id || `tag-${Date.now()}-${idx}`),
          name: String(it.content || it.name || `Tag ${idx + 1}`),
          color: String(it.color || '#c6ff1f'),
          shortcut: String(it.shortcut || ''),
        }));
    }

    if (Array.isArray(data.labels)) {
      parsedLabels = data.labels.map((l: any, idx: number) => ({
        id: String(l.id || `lbl-${Date.now()}-${idx}`),
        name: String(l.name || `Label ${idx + 1}`),
        groupId: l.groupId ? String(l.groupId) : undefined,
        shortcut: l.shortcut ? String(l.shortcut) : undefined,
      }));
    } else if (Array.isArray(data.items)) {
      parsedLabels = data.items
        .filter((it: any) => it.type === 'label')
        .map((it: any, idx: number) => ({
          id: String(it.id || `lbl-${Date.now()}-${idx}`),
          name: String(it.content || it.name || `Label ${idx + 1}`),
          groupId: it.groupId ? String(it.groupId) : undefined,
          shortcut: it.shortcut ? String(it.shortcut) : undefined,
        }));
    }

    if (Array.isArray(data.labelGroups)) {
      parsedGroups = data.labelGroups.map((g: any, idx: number) => ({
        id: String(g.id || `grp-${Date.now()}-${idx}`),
        name: String(g.name || `Group ${idx + 1}`),
      }));
    }
  }

  return { parsedTags, parsedLabels, parsedGroups, tplName };
}

export function downloadEventsCSV(params: {
  tagEvents: TagEvent[];
  tags: TagData[];
  labels: Label[];
  periodSyncs: PeriodSync[];
  projectName: string;
  isLive: boolean;
}): void {
  const { tagEvents, tags, labels, periodSyncs, projectName, isLive } = params;
  const rows: (string | number)[][] = [];
  rows.push([
    'Event ID',
    'Tag ID',
    'Tag Name',
    'Color',
    'Shortcut',
    'Lead/Lag Enabled',
    'Pre Time',
    'Post Time',
    'Start Time',
    'End Time',
    'Duration',
    'Notes',
    'Labels',
    'Total Tag Count',
    'Period',
    'Game Time Start',
    'Game Time End',
  ]);

  const tagCounts = new Map<string, number>();
  tagEvents.forEach((e) => {
    tagCounts.set(e.tagId, (tagCounts.get(e.tagId) || 0) + 1);
  });

  const sortedSyncs = [...periodSyncs].sort((a, b) => a.videoTimeSeconds - b.videoTimeSeconds);

  tagEvents.forEach((e) => {
    const t = tags.find((x) => x.id === e.tagId);
    const labelNames = (e.labelIds || [])
      .map((id) => labels.find((l) => l.id === id)?.name)
      .filter(Boolean)
      .join(',');

    let periodName = '';
    let gameTimeStart = '';
    let gameTimeEnd = '';

    const explicitSync = e.periodId ? sortedSyncs.find((s) => s.id === e.periodId) : undefined;
    const currentSyncIdx = sortedSyncs.findLastIndex((s) => e.startTime >= s.videoTimeSeconds);
    const sync = explicitSync || (currentSyncIdx !== -1 ? sortedSyncs[currentSyncIdx] : undefined);

    if (sync && !sync.needsVideoSync && !isLive) {
      const pInfo = getCanonicalPeriod(sync.id);
      const offset = pInfo?.matchStartOffset ?? 0;
      periodName = sync.name;
      gameTimeStart = formatTime(offset + Math.max(0, e.startTime - sync.videoTimeSeconds));
      gameTimeEnd = formatTime(offset + Math.max(0, e.endTime - sync.videoTimeSeconds));
    } else if (e.periodId || e.matchStart !== undefined) {
      const pInfo = getCanonicalPeriod(e.periodId || '1st-half');
      periodName = pInfo?.name || e.periodId || '';
      if (e.matchStart !== undefined) gameTimeStart = formatTime(e.matchStart);
      if (e.matchEnd !== undefined) gameTimeEnd = formatTime(e.matchEnd);
    }

    rows.push([
      e.id,
      e.tagId,
      `"${(t?.name || 'Unknown').replace(/"/g, '""')}"`,
      t?.color || '#ffffff',
      `"${(t?.shortcut || '').replace(/"/g, '""')}"`,
      t?.leadLagEnabled ? 'true' : 'false',
      t?.preTime || 0,
      t?.postTime || 0,
      e.startTime.toFixed(3),
      e.endTime.toFixed(3),
      (e.endTime - e.startTime).toFixed(3),
      `"${(e.notes || '').replace(/"/g, '""')}"`,
      `"${labelNames.replace(/"/g, '""')}"`,
      tagCounts.get(e.tagId) || 0,
      `"${periodName.replace(/"/g, '""')}"`,
      gameTimeStart,
      gameTimeEnd,
    ]);
  });

  const csvContent = rows.map((e) => e.join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `events_${projectName.replace(/\s+/g, '_')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export type CsvImportParseResult =
  | { ok: false; errorMessage: string }
  | {
      ok: true;
      events: TagEvent[];
      newTags: TagData[];
      newLabels: Label[];
      errors: string[];
    };

export function parseImportedEventsCSV(params: {
  text: string;
  tags: TagData[];
  labels: Label[];
  tagEvents: TagEvent[];
}): CsvImportParseResult {
  const { text, tags, labels, tagEvents } = params;
  const rows = parseCSV(text);
  const errors: string[] = [];
  if (rows.length <= 1) {
    return { ok: false, errorMessage: 'CSV is empty or missing data.' };
  }

  const header = rows[0].map((s) => s.trim());
  const normalizeHeader = (h: string) => (h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const findColumnIndex = (possibleNames: string[]) => {
    const normalizedTargets = possibleNames.map(normalizeHeader);
    return header.findIndex((h) => {
      const norm = normalizeHeader(h);
      return normalizedTargets.includes(norm);
    });
  };

  const eventIdIdx = findColumnIndex(['Event ID', 'EventID', 'Event Id', 'ID']);
  const tagIdIdx = findColumnIndex(['Tag ID', 'TagID', 'Tag Id']);
  const nameIdx = findColumnIndex(['Tag Name', 'TagName', 'Tag', 'Tag Title', 'Event Name', 'Event', 'Name']);
  const colorIdx = findColumnIndex(['Color', 'Tag Color', 'Colour']);
  const shortcutIdx = findColumnIndex(['Shortcut', 'Key', 'Hotkey']);
  const leadLagIdx = findColumnIndex([
    'Lead/Lag Enabled',
    'LeadLag Enabled',
    'Lead Lag Enabled',
    'Lead/Lag',
    'Lead Lag',
  ]);
  const preTimeIdx = findColumnIndex(['Pre Time', 'PreTime', 'Lead Time', 'Pre-Time', 'Pre', 'Lead']);
  const postTimeIdx = findColumnIndex(['Post Time', 'PostTime', 'Lag Time', 'Post-Time', 'Post', 'Lag']);
  const startIdx = findColumnIndex([
    'Start Time',
    'Start Time (Video)',
    'Start Time (sec)',
    'Start Time (s)',
    'Start (Video)',
    'Start (sec)',
    'Start (s)',
    'StartTime',
    'Start',
    'Timecode Start',
  ]);
  const endIdx = findColumnIndex([
    'End Time',
    'End Time (Video)',
    'End Time (sec)',
    'End Time (s)',
    'End (Video)',
    'End (sec)',
    'End (s)',
    'EndTime',
    'End',
    'Timecode End',
  ]);
  const durationIdx = findColumnIndex(['Duration', 'Duration (sec)', 'Duration (s)']);
  const notesIdx = findColumnIndex(['Notes', 'Note', 'Description', 'Comments', 'Comment']);
  const labelsIdx = findColumnIndex(['Labels', 'Label', 'Tags/Labels']);

  if (nameIdx === -1 || startIdx === -1 || (endIdx === -1 && durationIdx === -1)) {
    return { ok: false, errorMessage: "CSV must contain 'Tag Name', 'Start Time', and 'End Time'." };
  }

  const parsedEvents: TagEvent[] = [];
  const newlyDiscoveredTags: TagData[] = [];
  const newlyDiscoveredLabels: Label[] = [];
  const existingEventIds = new Set(tagEvents.map((ev) => ev.id));
  const usedEventIds = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || row.every((c) => !c || !c.trim())) continue;

    const tagName = row[nameIdx]?.trim();
    if (!tagName) {
      errors.push(`Row ${i + 1}: Missing Tag Name.`);
      continue;
    }

    const rawStartTime = row[startIdx]?.trim();
    const rawEndTime = endIdx !== -1 ? row[endIdx]?.trim() : '';
    const rawDuration = durationIdx !== -1 ? row[durationIdx]?.trim() : '';

    let startTime = parseTimeString(rawStartTime);
    let endTime = parseTimeString(rawEndTime);

    if (isNaN(endTime) && !isNaN(startTime) && rawDuration) {
      const dur = parseTimeString(rawDuration);
      if (!isNaN(dur) && dur > 0) {
        endTime = startTime + dur;
      }
    }

    if (isNaN(startTime) || isNaN(endTime)) {
      errors.push(`Row ${i + 1}: Invalid start or end time ("${rawStartTime || ''}", "${rawEndTime || ''}").`);
      continue;
    }

    if (endTime < startTime) {
      const tmp = startTime;
      startTime = endTime;
      endTime = tmp;
    }

    if (startTime < 0) startTime = 0;
    if (endTime <= startTime) {
      endTime = startTime + 3;
    }

    const tagIdCandidate = tagIdIdx !== -1 ? row[tagIdIdx]?.trim() : '';
    let tag =
      (tagIdCandidate ? tags.find((t) => t.id === tagIdCandidate) : null) ||
      tags.find((t) => t.name.toLowerCase() === tagName.toLowerCase()) ||
      newlyDiscoveredTags.find(
        (t) => (tagIdCandidate && t.id === tagIdCandidate) || t.name.toLowerCase() === tagName.toLowerCase()
      );

    if (!tag) {
      const randColor =
        colorIdx !== -1 && row[colorIdx]?.trim()
          ? row[colorIdx].trim()
          : `#${Math.floor(Math.random() * 16777215)
              .toString(16)
              .padStart(6, '0')}`;
      const shortcutKey = shortcutIdx !== -1 ? row[shortcutIdx]?.trim() : '';
      const isLeadLag = leadLagIdx !== -1 && row[leadLagIdx]?.trim().toLowerCase() === 'true';
      const preTime = preTimeIdx !== -1 ? parseFloat(row[preTimeIdx].replace(',', '.')) || 0 : 0;
      const postTime = postTimeIdx !== -1 ? parseFloat(row[postTimeIdx].replace(',', '.')) || 0 : 0;
      const targetTagId =
        tagIdCandidate &&
        !tags.some((t) => t.id === tagIdCandidate) &&
        !newlyDiscoveredTags.some((t) => t.id === tagIdCandidate)
          ? tagIdCandidate
          : `tag-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      tag = {
        id: targetTagId,
        name: tagName,
        color: randColor,
        shortcut: shortcutKey,
        leadLagEnabled: isLeadLag,
        preTime,
        postTime,
      };
      newlyDiscoveredTags.push(tag);
    }

    const notes = notesIdx !== -1 ? row[notesIdx]?.trim() : '';
    const rawEventId = eventIdIdx !== -1 ? row[eventIdIdx]?.trim() : '';
    let importedEventId = rawEventId;
    if (!importedEventId || existingEventIds.has(importedEventId) || usedEventIds.has(importedEventId)) {
      importedEventId = `evt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }
    usedEventIds.add(importedEventId);

    const eventLabelIds: string[] = [];
    if (labelsIdx !== -1 && row[labelsIdx]?.trim()) {
      const lNames = row[labelsIdx]
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const lName of lNames) {
        let label =
          labels.find((l) => l.name.toLowerCase() === lName.toLowerCase()) ||
          newlyDiscoveredLabels.find((l) => l.name.toLowerCase() === lName.toLowerCase());
        if (!label) {
          label = {
            id: `label-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            name: lName,
          };
          newlyDiscoveredLabels.push(label);
        }
        eventLabelIds.push(label.id);
      }
    }

    parsedEvents.push({
      id: importedEventId,
      tagId: tag.id,
      startTime,
      endTime,
      notes,
      labelIds: eventLabelIds.length > 0 ? eventLabelIds : undefined,
    });
  }

  if (parsedEvents.length === 0) {
    return { ok: false, errorMessage: 'No valid events found in CSV.' };
  }

  return {
    ok: true,
    events: parsedEvents,
    newTags: newlyDiscoveredTags,
    newLabels: newlyDiscoveredLabels,
    errors,
  };
}
