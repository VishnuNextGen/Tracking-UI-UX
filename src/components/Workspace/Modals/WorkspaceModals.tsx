import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Code, X, Plus, Trash2, Edit2, Hexagon, AlertTriangle, Check, Zap, FileUp, FileDown, Trash, ListPlus, Folder, FolderOpen, Download, Upload, Sparkles, Layers } from 'lucide-react';
import { Tag as TagData, TagEvent, Playlist, TimelineMarker, Label, LabelGroup } from '../../../types';
import { getRandomDistinctColor, getMultipleDistinctRandomColors } from '../../../utils/colors';
import { TimelineEventActionModal } from '../TimelineEvents';

export const WorkspaceModals = (props: any) => {
    const {
        tagSettingsOpen,
        setTagSettingsOpen,
        tags,
        setTags,
        editingTagId,
        setEditingTagId,
        tempTag,
        setTempTag,
        deleteTag,
        contextMenu,
        setContextMenu,
        csvImportState,
        setCsvImportState,
        labels,
        setLabels,
        labelGroups,
        setLabelGroups,
        onOpenTemplateManager,
        exportUnifiedSetupToJSON,
        showNotification,
        setTagEvents,
        tagEvents,
        playlists,
        activePlaylistId,
        onAddToPlaylist,
        playlistModal,
        setPlaylistModal,
        savePlaylist,
        playlistDeleteId,
        setPlaylistDeleteId,
        confirmDeletePlaylist,
        editEventModal,
        setEditEventModal,
        currentTime,
        requestCloseEditEventModal,
        saveEditedEvent,
        handleDeleteEventRequest,
        handleEditEvent,
        deleteConfirmation,
        setDeleteConfirmation,
        confirmDeleteEvent,
        tagDeleteConfirmation,
        setTagDeleteConfirmation,
        confirmDeleteTag,
        workspaceAlert,
        setWorkspaceAlert,
        markerModal,
        setMarkerModal,
        saveMarker,
        deleteMarker,
        showCloseConfirm,
        setShowCloseConfirm,
        confirmClose,
        confirmUnsavedModal,
        setConfirmUnsavedModal,
        fileInputRef
    } = props;

    const [bulkAddOpen, setBulkAddOpen] = useState(false);
    const [bulkTagsInput, setBulkTagsInput] = useState('');
    const bulkInputRef = useRef<HTMLInputElement>(null);
    const activeEditingNameRef = useRef<HTMLInputElement | null>(null);
    const autoSelectedTagIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!tagSettingsOpen) {
            setBulkAddOpen(false);
            setBulkTagsInput('');
            setEditingTagId(null);
            setTempTag({});
            autoSelectedTagIdRef.current = null;
        }
    }, [tagSettingsOpen]);

    useEffect(() => {
        if (!editingTagId) {
            autoSelectedTagIdRef.current = null;
        }
    }, [editingTagId]);

    const handleSaveTag = (tag: TagData) => {
        const rawName = tempTag.name !== undefined ? tempTag.name : tag.name;
        const finalName = (rawName || '').trim() || tag.name || 'New Tag';
        const rawShortcut = tempTag.shortcut !== undefined ? tempTag.shortcut : (tag.shortcut || '');
        const newShortcut = (rawShortcut || '').trim().toUpperCase();

        // Hotkey is optional - only validate uniqueness if user specified a non-empty hotkey
        if (newShortcut) {
            const isDuplicate = tags.some((t: TagData) => t.id !== tag.id && t.shortcut && t.shortcut.trim().toUpperCase() === newShortcut);
            if (isDuplicate) {
                setWorkspaceAlert(`Hotkey "${newShortcut}" is already in use by another tag.`);
                return;
            }
        }

        setTags((prev: TagData[]) => prev.map((t: TagData) => t.id === tag.id ? {
            ...t,
            ...tempTag,
            name: finalName,
            shortcut: newShortcut
        } as TagData : t));
        setEditingTagId(null);
        setTempTag({});
    };

    const handleAddNewCode = () => {
        // If another tag is currently open in edit mode, auto-save it first
        if (editingTagId) {
            const currentTag = tags.find((t: TagData) => t.id === editingTagId);
            if (currentTag) {
                const rawName = tempTag.name !== undefined ? tempTag.name : currentTag.name;
                const finalName = (rawName || '').trim() || currentTag.name || 'New Tag';
                const rawShortcut = tempTag.shortcut !== undefined ? tempTag.shortcut : (currentTag.shortcut || '');
                const newShortcut = (rawShortcut || '').trim().toUpperCase();
                setTags((prev: TagData[]) => prev.map((t: TagData) => t.id === currentTag.id ? {
                    ...t,
                    ...tempTag,
                    name: finalName,
                    shortcut: newShortcut
                } as TagData : t));
            }
        }

        const newId = Date.now().toString();
        const existingColors = tags.map((t: TagData) => t.color);
        const randomColor = getRandomDistinctColor(existingColors);
        const newTag: TagData = {
            id: newId,
            name: 'New Tag',
            color: randomColor,
            shortcut: '', // Empty hotkey - not compulsory, no '?'
            leadLagEnabled: false,
            preTime: 10,
            postTime: 10
        };

        setTags((prev: TagData[]) => [...prev, newTag]);
        setEditingTagId(newId);
        setTempTag({
            name: 'New Tag',
            color: randomColor,
            shortcut: '',
            leadLagEnabled: false,
            preTime: 10,
            postTime: 10
        });
    };

    const handleConfirmBulkAdd = () => {
        const rawNames = bulkTagsInput
            .split(/[,;\n]+/)
            .map(s => s.trim())
            .filter(s => s.length > 0);

        if (rawNames.length === 0) return;

        // Preserve unique tag names entered
        const uniqueNames: string[] = [];
        for (const n of rawNames) {
            if (!uniqueNames.includes(n)) {
                uniqueNames.push(n);
            }
        }

        const existingColors = tags.map((t: TagData) => t.color);
        const distinctColors = getMultipleDistinctRandomColors(uniqueNames.length, existingColors);

        const newTagsToAdd: TagData[] = uniqueNames.map((name, idx) => ({
            id: `tag-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            name: name,
            color: distinctColors[idx],
            shortcut: '', // Empty hotkey for each tag
            leadLagEnabled: false,
            preTime: 10,
            postTime: 10
        }));

        setTags((prev: TagData[]) => [...prev, ...newTagsToAdd]);
        setBulkTagsInput('');
        setBulkAddOpen(false);
        if (showNotification) {
            showNotification(`Added ${newTagsToAdd.length} tags with unique random colors!`, '#c6ff1f');
        }
    };

    const parsedBulkTags = bulkTagsInput
        .split(/[,;\n]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
    
    return (
        <>
       <AnimatePresence>
         {tagSettingsOpen && (
             <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                 <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[#1a1a1a] border border-[#333] rounded-xl w-[700px] shadow-2xl flex flex-col max-h-[85vh]">
                     <div className="p-2 border-b border-[#333] flex items-center justify-between">
                         <div className="flex items-center gap-4 custom-scrollbar">
                             <Code className="w-5 h-5 text-[#c6ff1f]" />
                             <h3 className="font-semibold text-white">Code Window</h3>
                         </div>
                         <button onClick={() => setTagSettingsOpen(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                     </div>
                     <div className="p-2 bg-[#111] border-b border-[#333] grid grid-cols-12 gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                         <div className="col-span-1 text-center">Color</div>
                         <div className="col-span-3">Name</div>
                         <div className="col-span-1 text-center">Hotkey</div>
                         <div className="col-span-5 text-center">Lead / Lag (Quick Code)</div>
                         <div className="col-span-2 text-right">Actions</div>
                     </div>
                     <div className="overflow-y-auto flex-1 p-2 space-y-1">
                         {tags.map((tag: TagData) => {
                             const isEditing = editingTagId === tag.id;
                             return (
                                 <div key={tag.id} className={`grid grid-cols-12 gap-2 items-center p-3 rounded-lg border transition-colors ${isEditing ? 'bg-[#1e1e1e] border-[#c6ff1f]/50' : 'bg-[#161616] border-[#333] hover:border-gray-600'}`}>
                                     {isEditing ? (
                                         <>
                                             <div className="col-span-1 flex justify-center">
                                                <input type="color" value={tempTag.color || tag.color} onChange={e => setTempTag({...tempTag, color: e.target.value})} className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0" title="Choose Tag Color" />
                                             </div>
                                             <div className="col-span-3">
                                                <input
                                                    ref={(el) => {
                                                        if (el && isEditing) {
                                                            activeEditingNameRef.current = el;
                                                            if (autoSelectedTagIdRef.current !== tag.id) {
                                                                autoSelectedTagIdRef.current = tag.id;
                                                                setTimeout(() => {
                                                                    if (el) {
                                                                        el.focus();
                                                                        el.select();
                                                                    }
                                                                }, 20);
                                                            }
                                                        }
                                                    }}
                                                    type="text"
                                                    value={tempTag.name !== undefined ? tempTag.name : tag.name}
                                                    onChange={e => setTempTag({...tempTag, name: e.target.value})}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleSaveTag(tag);
                                                        } else if (e.key === 'Escape') {
                                                            e.preventDefault();
                                                            setEditingTagId(null);
                                                            setTempTag({});
                                                            autoSelectedTagIdRef.current = null;
                                                        }
                                                    }}
                                                    className="w-full bg-[#111] border border-[#444] focus:border-[#c6ff1f] rounded px-2 py-1 text-sm text-white outline-none"
                                                    placeholder="Tag Name"
                                                />
                                             </div>
                                             <div className="col-span-1 flex justify-center">
                                                <input
                                                    type="text"
                                                    maxLength={1}
                                                    value={tempTag.shortcut !== undefined ? tempTag.shortcut : (tag.shortcut || '')}
                                                    onChange={e => setTempTag({...tempTag, shortcut: e.target.value.toUpperCase()})}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleSaveTag(tag);
                                                        } else if (e.key === 'Escape') {
                                                            e.preventDefault();
                                                            setEditingTagId(null);
                                                            setTempTag({});
                                                        }
                                                    }}
                                                    placeholder="-"
                                                    title="Hotkey (optional)"
                                                    className="w-8 text-center bg-[#111] border border-[#444] rounded px-1 py-1 text-sm text-white focus:border-[#c6ff1f] outline-none font-mono"
                                                />
                                             </div>
                                             <div className="col-span-5 flex items-center justify-center gap-4 custom-scrollbar">
                                                 <label className="flex items-center gap-2 cursor-pointer">
                                                     <input type="checkbox" checked={tempTag.leadLagEnabled ?? tag.leadLagEnabled} onChange={(e) => setTempTag({...tempTag, leadLagEnabled: e.target.checked})} className="rounded bg-[#333] border-gray-600 text-[#c6ff1f] focus:ring-0" />
                                                     <span className="text-xs text-gray-300">Quick</span>
                                                 </label>
                                                 {(tempTag.leadLagEnabled ?? tag.leadLagEnabled) && (
                                                     <div className="flex items-center gap-4 custom-scrollbar">
                                                         <div className="flex items-center gap-1 bg-[#111] border border-[#333] rounded px-2 py-0.5">
                                                             <span className="text-[10px] text-gray-500">Pre</span>
                                                             <input
                                                                type="number"
                                                                min="0"
                                                                max="60"
                                                                value={tempTag.preTime ?? tag.preTime ?? 10}
                                                                onChange={(e) => setTempTag({...tempTag, preTime: parseInt(e.target.value) || 0})}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        handleSaveTag(tag);
                                                                    }
                                                                }}
                                                                className="w-8 bg-transparent text-right text-xs text-white outline-none font-mono"
                                                             />
                                                             <span className="text-[10px] text-gray-500">s</span>
                                                         </div>
                                                         <div className="flex items-center gap-1 bg-[#111] border border-[#333] rounded px-2 py-0.5">
                                                             <span className="text-[10px] text-gray-500">Post</span>
                                                             <input
                                                                type="number"
                                                                min="0"
                                                                max="60"
                                                                value={tempTag.postTime ?? tag.postTime ?? 10}
                                                                onChange={(e) => setTempTag({...tempTag, postTime: parseInt(e.target.value) || 0})}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        handleSaveTag(tag);
                                                                    }
                                                                }}
                                                                className="w-8 bg-transparent text-right text-xs text-white outline-none font-mono"
                                                             />
                                                             <span className="text-[10px] text-gray-500">s</span>
                                                         </div>
                                                     </div>
                                                 )}
                                             </div>
                                             <div className="col-span-2 flex justify-end gap-1">
                                                <button
                                                    onClick={() => handleSaveTag(tag)}
                                                    className="p-1.5 bg-green-600 hover:bg-green-500 text-black rounded transition-colors"
                                                    title="Save (Press Enter)"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => { setEditingTagId(null); setTempTag({}); }}
                                                    className="p-1.5 bg-[#333] hover:bg-[#444] text-white rounded transition-colors"
                                                    title="Cancel (Press Esc)"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                             </div>
                                         </>
                                     ) : (
                                         <>
                                             <div className="col-span-1 flex justify-center">
                                                 <div className="w-5 h-5 rounded-full border border-white/20 shadow-sm" style={{backgroundColor: tag.color}} />
                                             </div>
                                             <div className="col-span-3 font-medium text-sm text-gray-200 truncate">{tag.name}</div>
                                             <div className="col-span-1 flex justify-center">
                                                 <span
                                                    className="w-6 h-6 flex items-center justify-center text-xs font-mono font-bold bg-[#222] border border-[#333] rounded text-gray-400"
                                                    title={tag.shortcut ? `Hotkey: ${tag.shortcut}` : 'No hotkey assigned'}
                                                 >
                                                    {tag.shortcut || <span className="text-gray-600 font-normal text-[10px]">-</span>}
                                                 </span>
                                             </div>
                                             <div className="col-span-5 flex justify-center">
                                                 {tag.leadLagEnabled ? (
                                                     <div className="flex items-center gap-2 px-2 py-1 bg-[#c6ff1f]/20 border border-[#c6ff1f]/30 rounded text-[#c6ff1f]">
                                                         <Zap className="w-3 h-3 fill-[#c6ff1f]/50" />
                                                         <span className="text-xs font-mono">-{tag.preTime || 10}s / +{tag.postTime || 10}s</span>
                                                     </div>
                                                 ) : (
                                                     <span className="text-xs text-gray-600 font-medium px-2 py-1 rounded bg-[#222]">Manual Mode</span>
                                                 )}
                                             </div>
                                             <div className="col-span-2 flex justify-end gap-1">
                                                 <button
                                                    onClick={() => {
                                                        setEditingTagId(tag.id);
                                                        setTempTag({
                                                            name: tag.name,
                                                            color: tag.color,
                                                            shortcut: tag.shortcut || '',
                                                            leadLagEnabled: tag.leadLagEnabled,
                                                            preTime: tag.preTime,
                                                            postTime: tag.postTime
                                                        });
                                                    }}
                                                    className="p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded"
                                                    title="Edit Tag"
                                                 >
                                                    <Edit2 className="w-4 h-4" />
                                                 </button>
                                                 <button
                                                    onClick={() => deleteTag(tag.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded"
                                                    title="Delete Tag"
                                                 >
                                                    <Trash2 className="w-4 h-4" />
                                                 </button>
                                             </div>
                                         </>
                                     )}
                                 </div>
                             );
                         })}
                     </div>

                     {/* Bulk Add Tags Inline Panel */}
                     {bulkAddOpen && (
                         <div className="p-3 bg-[#131318] border-t border-[#2a2a38] space-y-2 animate-fadeIn">
                             <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-2">
                                     <div className="w-6 h-6 rounded bg-[#c6ff1f]/10 border border-[#c6ff1f]/30 flex items-center justify-center text-[#c6ff1f]">
                                         <ListPlus className="w-3.5 h-3.5" />
                                     </div>
                                     <div>
                                         <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                                             Bulk Add Tags
                                         </h4>
                                         <p className="text-[10px] text-gray-400">
                                             Enter tag names separated by commas (e.g. <span className="text-[#c6ff1f] font-mono">shot, pass, goal, corner, tackle</span>)
                                         </p>
                                     </div>
                                 </div>
                                 <button
                                     onClick={() => { setBulkAddOpen(false); setBulkTagsInput(''); }}
                                     className="p-1 text-gray-400 hover:text-white hover:bg-[#202028] rounded cursor-pointer"
                                     title="Close"
                                 >
                                     <X className="w-3.5 h-3.5" />
                                 </button>
                             </div>

                             <div className="flex gap-2">
                                 <div className="flex-1 relative">
                                     <input
                                         ref={bulkInputRef}
                                         type="text"
                                         value={bulkTagsInput}
                                         onChange={e => setBulkTagsInput(e.target.value)}
                                         onKeyDown={e => {
                                             if (e.key === 'Enter') {
                                                 e.preventDefault();
                                                 handleConfirmBulkAdd();
                                             } else if (e.key === 'Escape') {
                                                 setBulkAddOpen(false);
                                             }
                                         }}
                                         placeholder="shot, pass, cross, corner, foul, tackle, duel..."
                                         className="w-full bg-[#0c0c10] border border-[#333] focus:border-[#c6ff1f] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 outline-none transition-colors"
                                         autoFocus
                                     />
                                 </div>
                                 <button
                                     onClick={handleConfirmBulkAdd}
                                     disabled={parsedBulkTags.length === 0}
                                     className="px-4 py-2 bg-[#c6ff1f] hover:bg-[#b0e817] disabled:bg-[#222] disabled:text-gray-600 disabled:cursor-not-allowed text-black font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
                                     title="Add all tags with unique random colors"
                                 >
                                     <Plus className="w-3.5 h-3.5" />
                                     <span>Add All {parsedBulkTags.length > 0 ? `(${parsedBulkTags.length})` : ''}</span>
                                 </button>
                             </div>

                             {parsedBulkTags.length > 0 && (
                                 <div className="flex flex-wrap items-center gap-1 pt-1">
                                     <span className="text-[10px] text-gray-400">Preview ({parsedBulkTags.length}):</span>
                                     {parsedBulkTags.map((name, i) => (
                                         <span
                                             key={i}
                                             className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e1e28] text-gray-200 border border-[#2e2e3e] flex items-center gap-1"
                                         >
                                             <span className="w-1.5 h-1.5 rounded-full bg-[#c6ff1f]" />
                                             {name}
                                         </span>
                                     ))}
                                 </div>
                             )}
                         </div>
                     )}

                     {/* Action Bar */}
                     <div className="p-2 border-t border-[#333] bg-[#111] flex gap-3 items-center">
                         <button
                             onClick={handleAddNewCode}
                             className="flex-1 py-2.5 border border-dashed border-[#444] rounded-lg text-gray-400 hover:text-white hover:border-[#c6ff1f] hover:bg-[#a0d600]/5 flex items-center justify-center gap-2 text-xs font-semibold transition-all cursor-pointer"
                             title="Add a new tag (Name auto-selected, press Enter to confirm)"
                         >
                             <Plus className="w-4 h-4 text-[#c6ff1f]" />
                             <span>Add New Code</span>
                         </button>
                         <div className="flex items-center gap-1 pl-3 border-l border-[#333]">
                             <input 
                                 type="file" 
                                 ref={fileInputRef}
                                 accept=".json"
                                 className="hidden"
                                 onChange={(e) => {
                                     const fileReader = new FileReader();
                                     if (e.target.files && e.target.files.length > 0) {
                                         fileReader.readAsText(e.target.files[0], "UTF-8");
                                         fileReader.onload = (event) => {
                                             try {
                                                 if (event.target?.result) {
                                                     const parsed = JSON.parse(event.target.result as string);
                                                     let rawTags: any[] = [];
                                                     let rawLabels: any[] = [];
                                                     let rawGroups: any[] = [];

                                                     if (Array.isArray(parsed)) {
                                                         rawTags = parsed;
                                                     } else if (parsed && typeof parsed === 'object') {
                                                         if (Array.isArray(parsed.tags)) {
                                                             rawTags = parsed.tags;
                                                         } else if (Array.isArray(parsed.items)) {
                                                             rawTags = parsed.items.filter((it: any) => it.type === 'tag').map((it: any, idx: number) => ({
                                                                 id: it.id || `tag-${Date.now()}-${idx}`,
                                                                 name: it.content || it.name || `Tag ${idx + 1}`,
                                                                 color: it.color || '#c6ff1f',
                                                                 shortcut: it.shortcut || ''
                                                             }));
                                                         }

                                                         if (Array.isArray(parsed.labels)) {
                                                             rawLabels = parsed.labels;
                                                         } else if (Array.isArray(parsed.items)) {
                                                             rawLabels = parsed.items.filter((it: any) => it.type === 'label').map((it: any, idx: number) => ({
                                                                 id: it.id || `lbl-${Date.now()}-${idx}`,
                                                                 name: it.content || it.name || `Label ${idx + 1}`,
                                                                 groupId: it.groupId,
                                                                 shortcut: it.shortcut
                                                             }));
                                                         }

                                                         if (Array.isArray(parsed.labelGroups)) {
                                                             rawGroups = parsed.labelGroups;
                                                         }
                                                     }

                                                     let tagCount = 0;
                                                     let labelCount = 0;

                                                     if (rawTags.length > 0) {
                                                         const normalized = rawTags.map((t: any, idx: number) => ({
                                                             id: String(t.id || `tag-${Date.now()}-${idx}`),
                                                             name: String(t.name || t.tag_name || t.label || `Tag ${idx + 1}`),
                                                             color: String(t.color || '#c6ff1f'),
                                                             shortcut: String(t.shortcut || t.hotkey || ''),
                                                             leadLagEnabled: Boolean(t.leadLagEnabled),
                                                             preTime: typeof t.preTime === 'number' ? t.preTime : 10,
                                                             postTime: typeof t.postTime === 'number' ? t.postTime : 10
                                                         }));
                                                         setTags(normalized);
                                                         tagCount = normalized.length;
                                                     }

                                                     if (rawLabels.length > 0 && setLabels) {
                                                         const normalizedLabels = rawLabels.map((l: any, idx: number) => ({
                                                             id: String(l.id || `lbl-${Date.now()}-${idx}`),
                                                             name: String(l.name || `Label ${idx + 1}`),
                                                             groupId: l.groupId ? String(l.groupId) : undefined,
                                                             shortcut: l.shortcut ? String(l.shortcut) : undefined
                                                         }));
                                                         setLabels(normalizedLabels);
                                                         labelCount = normalizedLabels.length;
                                                     }

                                                     if (rawGroups.length > 0 && setLabelGroups) {
                                                         const normalizedGroups = rawGroups.map((g: any, idx: number) => ({
                                                             id: String(g.id || `grp-${Date.now()}-${idx}`),
                                                             name: String(g.name || `Group ${idx + 1}`)
                                                         }));
                                                         setLabelGroups(normalizedGroups);
                                                     }

                                                     if (tagCount > 0 && labelCount > 0) {
                                                         if (showNotification) showNotification(`Imported all-in-one setup: ${tagCount} tags and ${labelCount} labels!`, '#c6ff1f');
                                                     } else if (tagCount > 0) {
                                                         if (showNotification) showNotification(`Imported ${tagCount} tags successfully!`, '#c6ff1f');
                                                     } else if (labelCount > 0) {
                                                         if (showNotification) showNotification(`Imported ${labelCount} labels successfully!`, '#c6ff1f');
                                                     } else {
                                                         setWorkspaceAlert("Invalid JSON: Could not find tags or labels in the file.");
                                                     }
                                                 }
                                             } catch (error) {
                                                 setWorkspaceAlert("Error parsing JSON file. Please verify valid JSON syntax.");
                                             }
                                             // Reset input so same file can be selected again if needed
                                             if (fileInputRef.current) fileInputRef.current.value = '';
                                         };
                                     }
                                 }}
                             />
                             {onOpenTemplateManager && (
                                 <button 
                                     onClick={onOpenTemplateManager}
                                     className="py-2 px-3 bg-[#c6ff1f]/10 hover:bg-[#c6ff1f]/20 border border-[#c6ff1f]/30 hover:border-[#c6ff1f]/60 rounded-lg text-[#c6ff1f] font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                                     title="Open All-in-One Coding Templates (Tags + Labels)"
                                 >
                                     <FolderOpen className="w-4 h-4" />
                                     <span>Coding Templates</span>
                                 </button>
                             )}

                             {/* Bulk Entering Icon: near export and import icons */}
                             <button
                                 onClick={() => {
                                     setBulkAddOpen(prev => !prev);
                                     setTimeout(() => {
                                         bulkInputRef.current?.focus();
                                     }, 50);
                                 }}
                                 className={`p-2.5 rounded-lg transition-colors border cursor-pointer ${
                                     bulkAddOpen
                                         ? 'bg-[#c6ff1f] text-black border-[#c6ff1f] shadow-sm'
                                         : 'bg-[#222] hover:bg-[#333] text-gray-300 hover:text-[#c6ff1f] border-[#333]'
                                 }`}
                                 title="Bulk Add Tags (Comma-separated: shot, pass, etc.)"
                             >
                                 <ListPlus className="w-4 h-4" />
                             </button>

                             {exportUnifiedSetupToJSON && (
                                 <button 
                                     onClick={exportUnifiedSetupToJSON}
                                     className="p-2.5 bg-[#222] hover:bg-[#333] rounded-lg text-[#c6ff1f] hover:text-white transition-colors border border-[#333] cursor-pointer" 
                                     title="Export All-in-One Setup (Tags + Labels JSON)"
                                 >
                                     <Download className="w-4 h-4" />
                                 </button>
                             )}
                             <button 
                                 onClick={() => fileInputRef.current?.click()} 
                                 className="p-2.5 bg-[#222] hover:bg-[#333] rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer" 
                                 title="Import Setup / Tags (JSON)"
                             >
                                 <FileUp className="w-4 h-4" />
                             </button>
                             <button 
                                 onClick={() => {
                                     const exportPayload = {
                                         app: "TacStem Football Analysis",
                                         version: "3.0",
                                         exportedAt: new Date().toISOString(),
                                         tags: tags
                                     };
                                     const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
                                     const downloadAnchorNode = document.createElement('a');
                                     downloadAnchorNode.setAttribute("href", dataStr);
                                     downloadAnchorNode.setAttribute("download", "tacstem_tags.json");
                                     document.body.appendChild(downloadAnchorNode);
                                     downloadAnchorNode.click();
                                     downloadAnchorNode.remove();
                                 }} 
                                 className="p-2.5 bg-[#222] hover:bg-[#333] rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer" 
                                 title="Export Tags Only (JSON)"
                             >
                                 <FileDown className="w-4 h-4" />
                             </button>
                         </div>
                     </div>
                 </motion.div>
             </div>
         )}
       </AnimatePresence>

       <AnimatePresence>
        {csvImportState && csvImportState.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 overflow-y-auto pt-10 pb-10">
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#111] border border-[#222] rounded-xl p-4 shadow-2xl max-w-2xl w-full">
                    <h2 className="text-xl font-bold text-white mb-4">Confirm CSV Import</h2>
                    
                    <div className="space-y-4">
                        <div className="p-2 bg-[#1a1a1a] rounded-lg border border-[#333]">
                           <h3 className="text-sm font-semibold text-gray-300 mb-2">Summary</h3>
                           <ul className="text-sm text-gray-400 space-y-1">
                               <li>Found <span className="font-bold text-white">{csvImportState.events.length}</span> events.</li>
                               {csvImportState.newTags.length > 0 && (
                                  <li><span className="font-bold text-yellow-500">{csvImportState.newTags.length}</span> new tags will be created.</li>
                               )}
                               {csvImportState.newLabels && csvImportState.newLabels.length > 0 && (
                                  <li><span className="font-bold text-[#c6ff1f]">{csvImportState.newLabels.length}</span> new labels will be created.</li>
                               )}
                           </ul>
                        </div>

                        {csvImportState.errors.length > 0 && (
                            <div className="p-2 bg-red-900/20 border border-red-900/50 rounded-lg">
                                <h3 className="text-sm font-semibold text-red-500 mb-2">Warnings / Errors</h3>
                                <div className="max-h-32 overflow-y-auto text-xs text-red-400 space-y-1 pr-2">
                                    {csvImportState.errors.map((err: any, i: any) => <div key={i}>{err}</div>)}
                                </div>
                            </div>
                        )}

                        {csvImportState.newTags.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-gray-300 mb-2">New Tags Preview</h3>
                                <div className="max-h-48 overflow-y-auto bg-[#1a1a1a] rounded-lg border border-[#333] p-2 space-y-2">
                                    {csvImportState.newTags.map((t: any) => (
                                        <div key={t.id} className="flex items-center gap-3 bg-[#222] p-2 rounded">
                                            <div className="w-4 h-4 rounded-full" style={{backgroundColor: t.color}}></div>
                                            <span className="text-sm text-white font-medium">{t.name}</span>
                                            {t.shortcut && <span className="text-[10px] bg-[#333] px-1.5 py-0.5 rounded text-gray-400">{t.shortcut}</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#333]">
                        <button onClick={() => setCsvImportState(null)} className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-[#222] rounded transition-colors">Cancel</button>
                        <button onClick={() => {
                            if (csvImportState.newTags.length > 0) {
                                setTags((prev: any) => [...prev, ...csvImportState.newTags]);
                            }
                            if (csvImportState.newLabels && csvImportState.newLabels.length > 0) {
                                setLabels((prev: any) => [...prev, ...csvImportState.newLabels]);
                            }
                            setTagEvents((prev: any) => [...prev, ...csvImportState.events]);
                            showNotification(`Imported ${csvImportState.events.length} events successfully.`, '#22c55e');
                            setCsvImportState(null);
                        }} className="px-4 py-2 text-sm font-bold bg-[#c6ff1f] hover:bg-[#a0d600] text-black rounded transition-colors">Proceed Import</button>
                    </div>
                </motion.div>
            </div>
        )}
       </AnimatePresence>

       <AnimatePresence>
        {playlistModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                 <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-[#1a1a1a] border border-[#333] p-4 rounded-xl w-80 shadow-2xl flex flex-col gap-4 custom-scrollbar">
                    <div className="flex items-center justify-between pb-2 border-b border-[#333]"><h4 className="text-sm font-semibold text-white">{playlistModal.mode === 'create' ? 'Create Playlist' : 'Rename Playlist'}</h4><button onClick={() => setPlaylistModal(null)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button></div>
                    <div className="space-y-1"><label className="text-[10px] text-gray-400 uppercase font-semibold">Name</label><input type="text" autoFocus placeholder="Playlist Name..." value={playlistModal.tempName} onChange={(e) => setPlaylistModal({...playlistModal, tempName: e.target.value})} onKeyDown={(e) => e.key === 'Enter' && savePlaylist()} className="w-full bg-[#111] border border-[#333] rounded px-2 py-2 text-sm text-white focus:outline-none focus:border-[#c6ff1f]" /></div>
                    <div className="flex gap-2 pt-2"><button onClick={savePlaylist} className="flex-1 py-2 bg-[#c6ff1f] hover:bg-[#a0d600] text-black rounded text-xs font-medium transition-colors">Save</button></div>
                 </motion.div>
            </div>
        )}
       </AnimatePresence>

        <AnimatePresence>
            {playlistDeleteId && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[#1a1a1a] border border-[#333] p-4 rounded-xl w-80 shadow-2xl text-center">
                        <div className="flex justify-center mb-4 text-red-500"><AlertTriangle className="w-8 h-8" /></div>
                        <h3 className="font-semibold text-white mb-2">Delete Playlist?</h3>
                        <div className="flex gap-3 justify-center"><button onClick={() => setPlaylistDeleteId(null)} className="px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#222] rounded-lg">Cancel</button><button onClick={confirmDeletePlaylist} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium">Delete</button></div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

       {/* Compact Responsive Timeline Event Action Menu & Modals */}
       <TimelineEventActionModal
           contextMenu={contextMenu}
           setContextMenu={setContextMenu}
           tagEvents={tagEvents}
           setTagEvents={setTagEvents}
           tags={tags}
           labels={labels}
           playlists={playlists}
           activePlaylistId={activePlaylistId}
           activeClipIndex={props.playlistPlaybarIndex}
           onAddToPlaylist={onAddToPlaylist}
           currentTime={currentTime}
           showNotification={showNotification}
           onSaveEventNote={props.onSaveEventNote}
           onDeleteEvents={props.deleteEventsByIds || ((ids: string[]) => {
               const deleteSet = new Set(ids);
               setTagEvents((prev: any) => prev.filter((e: any) => !deleteSet.has(e.id)));
           })}
           activeSidebarTab={props.activeSidebarTab}
           setActiveSidebarTab={props.setActiveSidebarTab}
           setNotesSubTab={props.setNotesSubTab}
       />


       <AnimatePresence>
            {tagDeleteConfirmation && (
                 <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                     <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-[#1a1a1a] border border-[#333] p-5 rounded-xl w-80 shadow-2xl flex flex-col gap-4 custom-scrollbar">
                         <div className="flex items-center gap-3 text-red-500"><AlertTriangle className="w-6 h-6" /><h3 className="font-semibold text-white">Delete Tag?</h3></div>
                         <p className="text-gray-400 text-sm">Delete this tag? This will remove all associated events and remove them from playlists.</p>
                         <div className="flex gap-3 justify-end mt-2">
                             <button onClick={() => setTagDeleteConfirmation(null)} className="px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#222] rounded-lg">Cancel</button>
                             <button onClick={confirmDeleteTag} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium">Delete</button>
                         </div>
                     </motion.div>
                 </div>
             )}
       </AnimatePresence>

       <AnimatePresence>
            {workspaceAlert && (
                 <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[100] bg-red-900 border border-red-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-start gap-3 max-w-md">
                     <AlertTriangle className="w-6 h-6 shrink-0 text-red-400" />
                     <div>
                         <h3 className="font-bold text-sm">Notice</h3>
                         <p className="text-sm text-red-200 mt-1">{workspaceAlert}</p>
                     </div>
                     <button onClick={() => setWorkspaceAlert(null)} className="ml-auto text-red-400 hover:text-white mt-0.5">
                         <X className="w-5 h-5" />
                     </button>
                 </div>
             )}
       </AnimatePresence>

       <AnimatePresence>
        {markerModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                 <div className="absolute inset-0 pointer-events-auto" onMouseDown={() => setMarkerModal(null)} />
                 <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-[#1a1a1a] border border-[#333] p-4 rounded-xl w-96 shadow-2xl pointer-events-auto flex flex-col gap-4">
                    <div className="flex items-center justify-between pb-2 border-b border-[#333]">
                        <h4 className="text-sm font-semibold text-white">{markerModal.mode === 'create' ? 'Add Timeline Note' : 'Edit Timeline Note'}</h4>
                        <button onClick={() => setMarkerModal(null)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] text-gray-400 uppercase font-semibold">Note Text</label>
                        <textarea 
                            autoFocus 
                            placeholder="Write your insights here..." 
                            value={markerModal.tempLabel} 
                            onChange={(e) => setMarkerModal({...markerModal, tempLabel: e.target.value})} 
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    saveMarker();
                                }
                            }} 
                            className="w-full h-24 bg-[#111] border border-[#333] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c6ff1f] resize-none custom-scrollbar" 
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] text-gray-400 uppercase font-semibold">Color</label>
                        <div className="flex items-center gap-3">
                            {['#ef4444', '#eab308', '#3b82f6', '#22c55e', '#a855f7'].map(c => (
                                <button key={c} onClick={() => setMarkerModal({...markerModal, tempColor: c})} className={`w-8 h-8 rounded-full border-2 transition-transform ${markerModal.tempColor === c ? 'border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.3)]' : 'border-transparent ring-1 ring-white/10 hover:scale-105'}`} style={{ backgroundColor: c }} />
                            ))}
                            <div className="w-[1px] h-6 bg-[#333] mx-1" />
                            <div className="relative group/picker w-8 h-8 rounded-full overflow-hidden border-2 transition-transform hover:scale-105" style={{ backgroundColor: markerModal.tempColor, borderColor: !['#ef4444', '#eab308', '#3b82f6', '#22c55e', '#a855f7'].includes(markerModal.tempColor) ? 'white' : 'transparent' }}>
                                <input 
                                    type="color" 
                                    value={markerModal.tempColor} 
                                    onChange={(e) => setMarkerModal({...markerModal, tempColor: e.target.value})} 
                                    className="absolute -inset-4 w-[200%] h-[200%] cursor-pointer opacity-0" 
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-[#333]">
                        {markerModal.mode === 'edit' && (
                            <button onClick={deleteMarker} className="px-4 py-2 bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded-lg text-sm font-medium transition-colors">Delete</button>
                        )}
                        <div className="flex-1" />
                        <button onClick={() => setMarkerModal(null)} className="px-4 py-2 bg-[#222] hover:bg-[#333] text-gray-300 rounded-lg text-sm font-medium transition-colors">Cancel</button>
                        <button onClick={saveMarker} className="px-6 py-2 bg-[#c6ff1f] hover:bg-[#a0d600] text-black rounded-lg text-sm font-medium transition-colors">Save</button>
                    </div>
                 </motion.div>
            </div>
        )}
       </AnimatePresence>



       <AnimatePresence>
        {showCloseConfirm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[#1a1a1a] border border-[#333] p-4 rounded-xl w-80 shadow-2xl">
                <div className="flex items-center gap-3 text-amber-500 mb-4"><AlertTriangle className="w-6 h-6" /><h3 className="font-semibold text-white">End Session?</h3></div>
                <p className="text-gray-400 text-sm mb-3">Return to project selection? Unsaved changes are automatically saved to local session.</p>
                <div className="flex gap-3 justify-end"><button onClick={() => setShowCloseConfirm(false)} className="px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#222] rounded-lg">Cancel</button><button onClick={confirmClose} className="px-4 py-2 text-sm bg-[#c6ff1f] hover:bg-[#c6ff1f] text-black rounded-lg font-medium">Exit Project</button></div>
             </motion.div>
          </div>
        )}
       </AnimatePresence>
       <AnimatePresence>
             {confirmUnsavedModal && (
                 <div className="fixed inset-0 z-[1200] bg-black/60 flex items-center justify-center backdrop-blur-sm">
                     <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-[#1a1a1a] p-4 rounded-xl max-w-sm w-full border border-[#333] shadow-2xl">
                         <h3 className="text-lg font-bold text-white mb-2">Unsaved Changes</h3>
                         <p className="text-sm text-gray-400 mb-3">You have unsaved changes to this event.</p>
                         <div className="flex gap-2 justify-end">
                             <button onClick={() => setConfirmUnsavedModal(false)} className="px-4 py-2 bg-[#333] hover:bg-[#444] rounded text-white text-sm">Cancel</button>
                             <button onClick={() => { setConfirmUnsavedModal(false); setEditEventModal(null); }} className="px-4 py-2 bg-red-600/20 text-red-500 hover:bg-red-600/30 rounded text-sm">Discard</button>
                             <button onClick={() => { saveEditedEvent(); }} className="px-4 py-2 bg-[#c6ff1f] hover:bg-[#a0d600] rounded text-black text-sm">Save</button>
                         </div>
                     </motion.div>
                 </div>
             )}
       </AnimatePresence>
        </>
    );
};
