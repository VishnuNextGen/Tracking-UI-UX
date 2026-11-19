import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Snowflake, ListPlus, Play, Pause, Scissors, Check, FileText, SkipBack, SkipForward, CornerDownRight } from 'lucide-react';
import { Tag as TagData, TagEvent, FreezeFrame, Label } from '../types';
import { formatTime } from '../utils/math';
import { fadeColor } from '../utils/colors';

export const EventPlaybar = ({ 
    event, 
    tag, 
    labels = [],
    videoDuration,
    currentTime, 
    freezeFrames = [],
    isPlaying = false,
    onTogglePlay,
    onPrevEvent,
    onNextEvent,
    hasPrevEvent = false,
    hasNextEvent = false,
    eventIndex,
    totalEvents,
    onUpdate, 
    videoRef,
    onClose,
    onDelete,
    onAddToPlaylist,
    onInsertAfterActiveClip,
    activeClipPositionLabel,
    onOpenNoteModal,
    activePlaylistName,
    className,
    onScrubStart,
    onScrubMove,
    onScrubEnd
}: { 
    event?: TagEvent; 
    tag?: TagData; 
    labels?: Label[];
    videoDuration: number;
    currentTime: number; 
    freezeFrames?: FreezeFrame[];
    isPlaying?: boolean;
    onTogglePlay?: () => void;
    onPrevEvent?: () => void;
    onNextEvent?: () => void;
    hasPrevEvent?: boolean;
    hasNextEvent?: boolean;
    eventIndex?: number;
    totalEvents?: number;
    onUpdate: (start: number, end: number) => void;
    videoRef: React.RefObject<HTMLVideoElement>;
    onClose: () => void;
    onDelete?: () => void;
    onAddToPlaylist?: (force?: boolean) => void;
    onInsertAfterActiveClip?: (force?: boolean) => void;
    activeClipPositionLabel?: string;
    onOpenNoteModal?: () => void;
    activePlaylistName?: string;
    className?: string;
    onScrubStart?: () => void;
    onScrubMove?: (time: number) => void;
    onScrubEnd?: () => void;
}) => {
    const [dragging, setDragging] = useState<'start' | 'end' | null>(null);
    const [draggingPlayhead, setDraggingPlayhead] = useState(false);
    const [tempStart, setTempStart] = useState(event?.startTime ?? 0);
    const [tempEnd, setTempEnd] = useState(event?.endTime ?? 0);
    const [viewWindow, setViewWindow] = useState<{start: number, end: number}>({ start: 0, end: 0 });

    useEffect(() => {
        if (!event) return;
        if (!dragging) {
            setTempStart(event.startTime);
            setTempEnd(event.endTime);
            const padding = 4; 
            const newStart = Math.max(0, event.startTime - padding);
            const newEnd = videoDuration > 0 ? Math.min(videoDuration, event.endTime + padding) : event.endTime + padding;
            setViewWindow({ start: newStart, end: newEnd });
        }
    }, [event?.id, event?.startTime, event?.endTime, videoDuration, dragging]);

    const tempStartRef = useRef(tempStart);
    const tempEndRef = useRef(tempEnd);
    tempStartRef.current = tempStart;
    tempEndRef.current = tempEnd;

    // Playhead dragging strictly clamped to [tempStart, tempEnd]
    const seekPlayheadAtClientX = useCallback((clientX: number) => {
        const container = document.getElementById('event-trimmer-track');
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const offsetX = clientX - rect.left;
        const pct = Math.max(0, Math.min(1, offsetX / rect.width));
        const windowDuration = viewWindow.end - viewWindow.start;
        const rawTime = viewWindow.start + (pct * windowDuration);
        const clamped = Math.max(tempStartRef.current, Math.min(tempEndRef.current, rawTime));
        if (onScrubMove) {
            onScrubMove(clamped);
        } else if (videoRef.current) {
            videoRef.current.currentTime = clamped;
        }
    }, [viewWindow, videoRef, onScrubMove]);

    const seekPlayheadRef = useRef(seekPlayheadAtClientX);
    seekPlayheadRef.current = seekPlayheadAtClientX;

    const handlePlayheadMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        onScrubStart?.();
        setDraggingPlayhead(true);
        seekPlayheadRef.current(e.clientX);

        const onMouseMove = (moveEvent: MouseEvent) => {
            if ((moveEvent.buttons & 1) === 0) {
                cleanup();
                return;
            }
            seekPlayheadRef.current(moveEvent.clientX);
        };

        const onMouseUp = () => {
            cleanup();
        };

        const cleanup = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            setDraggingPlayhead(false);
            onScrubEnd?.();
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }, [onScrubStart, onScrubEnd]);

    const handleDragStart = useCallback((type: 'start' | 'end', e: React.MouseEvent) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        onScrubStart?.();
        setDragging(type);

        const onMouseMove = (moveEvent: MouseEvent) => {
            if ((moveEvent.buttons & 1) === 0) {
                cleanup();
                return;
            }
            const container = document.getElementById('event-trimmer-track');
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const offsetX = moveEvent.clientX - rect.left;
            const pct = Math.max(0, Math.min(1, offsetX / rect.width));
            const windowDuration = viewWindow.end - viewWindow.start;
            const newTime = viewWindow.start + (pct * windowDuration);
            
            if (type === 'start') {
                const clamped = Math.min(newTime, tempEndRef.current - 0.2); 
                const safe = Math.max(0, clamped);
                setTempStart(safe);
                tempStartRef.current = safe;
                // Only gently clamp playhead if current video time is strictly behind new start boundary
                if (videoRef.current && videoRef.current.currentTime < safe) {
                    videoRef.current.currentTime = safe;
                    onScrubMove?.(safe);
                }
            } else {
                const clamped = Math.max(newTime, tempStartRef.current + 0.2);
                const safe = videoDuration > 0 ? Math.min(videoDuration, clamped) : clamped;
                setTempEnd(safe);
                tempEndRef.current = safe;
                // Only gently clamp playhead if current video time is strictly ahead of new end boundary
                if (videoRef.current && videoRef.current.currentTime > safe) {
                    videoRef.current.currentTime = safe;
                    onScrubMove?.(safe);
                }
            }
        };

        const onMouseUp = () => {
            cleanup();
        };

        const cleanup = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            setDragging(null);
            onUpdate(tempStartRef.current, tempEndRef.current);
            onScrubEnd?.();
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }, [viewWindow, videoDuration, videoRef, onScrubMove, onUpdate, onScrubStart, onScrubEnd]);

    const handleNudge = (type: 'start' | 'end', delta: number) => {
        if (type === 'start') {
            const newS = Math.max(0, Math.min(tempStart + delta, tempEnd - 0.2));
            setTempStart(newS);
            onUpdate(newS, tempEnd);
            if (videoRef.current && videoRef.current.currentTime < newS) {
                if (onScrubMove) onScrubMove(newS);
                else videoRef.current.currentTime = newS;
            }
        } else {
            const rawE = tempEnd + delta;
            const newE = Math.max(tempStart + 0.2, videoDuration > 0 ? Math.min(videoDuration, rawE) : rawE);
            setTempEnd(newE);
            onUpdate(tempStart, newE);
            if (videoRef.current && videoRef.current.currentTime > newE) {
                if (onScrubMove) onScrubMove(newE);
                else videoRef.current.currentTime = newE;
            }
        }
    };

    if (!event) return null;

    const windowDuration = Math.max(0.01, viewWindow.end - viewWindow.start);
    const startPct = ((tempStart - viewWindow.start) / windowDuration) * 100;
    const durationPct = ((tempEnd - tempStart) / windowDuration) * 100;

    const safeStartPct = Math.max(0, Math.min(100, startPct));
    const safeWidthPct = Math.max(0, Math.min(100 - safeStartPct, durationPct));

    const clampedCurrentTime = Math.max(tempStart, Math.min(tempEnd, currentTime));
    const playheadPct = ((clampedCurrentTime - viewWindow.start) / windowDuration) * 100;
    const showPlayhead = playheadPct >= 0 && playheadPct <= 100;

    const hasNote = Boolean(event.notes && event.notes.trim().length > 0);
    const resolvedLabels = event.labelIds
        ? event.labelIds.map(id => labels.find(l => l.id === id)?.name).filter(Boolean)
        : [];

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            className={`relative w-full z-50 flex flex-col bg-[#0a0a0a] select-none overflow-visible ${className || 'h-[113px]'}`}
        >
            {/* Row 1: Single-Row Trimmer Controls Bar (h-12 = 48px, matching WorkspaceBottomBar) */}
            <div className="h-12 px-3 border-b border-[#222] bg-[#111] flex items-center justify-between flex-nowrap gap-2.5 min-w-0 shrink-0 overflow-x-auto no-scrollbar">
                {/* Left: Trim Icon, Color Swatch, Event Title, Labels & Position */}
                <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                    <Scissors className="w-3.5 h-3.5 text-[#60a5fa] shrink-0" />

                    <span 
                        className="w-2.5 h-2.5 rounded-full ring-2 ring-white/15 shrink-0" 
                        style={{ backgroundColor: tag?.color || '#3b82f6' }} 
                    />

                    <span
                        className="text-[13px] font-bold text-white tracking-tight truncate min-w-0"
                        title={`${tag?.name || 'Event'}${resolvedLabels.length > 0 ? ` (${resolvedLabels.join(', ')})` : ''}`}
                    >
                        {tag?.name || 'Event'}
                        {resolvedLabels.length > 0 && (
                            <span className="text-[#c6ff1f] font-medium text-xs ml-1.5">
                                ({resolvedLabels.join(', ')})
                            </span>
                        )}
                    </span>

                    {typeof eventIndex === 'number' && typeof totalEvents === 'number' && totalEvents > 0 && (
                        <span className="hidden md:inline-flex items-center gap-1.5 text-xs font-mono tabular-nums text-gray-400 shrink-0">
                            <span aria-hidden="true" className="text-gray-600">·</span>
                            <span>{eventIndex + 1}/{totalEvents}</span>
                        </span>
                    )}
                </div>

                {/* Center: Previous Tag / Play-Pause / Next Tag Controls (matched to Playbar sizing) */}
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                    {onPrevEvent && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onPrevEvent();
                            }}
                            disabled={!hasPrevEvent}
                            className="h-8 w-8 rounded-full flex items-center justify-center text-white hover:bg-[#222] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                            title={hasPrevEvent ? "Previous Tagged Event" : "No other tagged events"}
                        >
                            <SkipBack className="w-4 h-4" />
                        </button>
                    )}

                    {onTogglePlay && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onTogglePlay();
                            }}
                            className="h-8 w-8 bg-[#c6ff1f] hover:bg-[#b5ee15] text-black rounded-full transition-all active:scale-95 flex items-center justify-center shadow-[0_0_10px_rgba(198,255,31,0.3)] shrink-0 mx-0.5 cursor-pointer"
                            title={isPlaying ? "Pause Event (Space)" : "Play Event (Space)"}
                        >
                            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                        </button>
                    )}

                    {onNextEvent && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onNextEvent();
                            }}
                            disabled={!hasNextEvent}
                            className="h-8 w-8 rounded-full flex items-center justify-center text-white hover:bg-[#222] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                            title={hasNextEvent ? "Next Tagged Event" : "No other tagged events"}
                        >
                            <SkipForward className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Right: Unified IN / DUR / OUT Timecode Bar & Actions */}
                <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
                    <div className="flex items-center gap-1.5 bg-[#18191e] px-2.5 h-8 rounded-lg border border-white/10 text-xs font-mono tabular-nums shrink-0">
                        <span className="text-[10px] font-sans font-semibold text-gray-400">IN</span>
                        <span className="text-white font-bold">{formatTime(tempStart)}</span>
                        <div className="hidden lg:flex items-center gap-0.5 ml-0.5">
                            <button
                                type="button"
                                onClick={() => handleNudge('start', -0.2)}
                                className="h-5 w-5 flex items-center justify-center bg-[#242730] hover:bg-[#303440] rounded text-xs font-bold text-gray-200 hover:text-white transition-colors cursor-pointer"
                                title="Expand start -0.2s"
                            >
                                −
                            </button>
                            <button
                                type="button"
                                onClick={() => handleNudge('start', 0.2)}
                                className="h-5 w-5 flex items-center justify-center bg-[#242730] hover:bg-[#303440] rounded text-xs font-bold text-gray-200 hover:text-white transition-colors cursor-pointer"
                                title="Trim start +0.2s"
                            >
                                +
                            </button>
                        </div>

                        <span className="w-[1px] h-4 bg-white/10 mx-0.5 hidden sm:block" />

                        <span className="hidden sm:inline text-[#c6ff1f] font-bold" title="Clip Duration">
                            {formatTime(tempEnd - tempStart)}
                        </span>

                        <span className="w-[1px] h-4 bg-white/10 mx-0.5" />

                        <span className="text-[10px] font-sans font-semibold text-gray-400">OUT</span>
                        <span className="text-white font-bold">{formatTime(tempEnd)}</span>
                        <div className="hidden lg:flex items-center gap-0.5 ml-0.5">
                            <button
                                type="button"
                                onClick={() => handleNudge('end', -0.2)}
                                className="h-5 w-5 flex items-center justify-center bg-[#242730] hover:bg-[#303440] rounded text-xs font-bold text-gray-200 hover:text-white transition-colors cursor-pointer"
                                title="Trim end -0.2s"
                            >
                                −
                            </button>
                            <button
                                type="button"
                                onClick={() => handleNudge('end', 0.2)}
                                className="h-5 w-5 flex items-center justify-center bg-[#242730] hover:bg-[#303440] rounded text-xs font-bold text-gray-200 hover:text-white transition-colors cursor-pointer"
                                title="Expand end +0.2s"
                            >
                                +
                            </button>
                        </div>
                    </div>

                    <div className="w-[1px] h-5 bg-white/10 mx-0.5 hidden sm:block shrink-0" />

                    {onOpenNoteModal && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpenNoteModal();
                            }}
                            className={`flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold border transition-colors shrink-0 cursor-pointer ${
                                hasNote
                                    ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-400/45'
                                    : 'bg-[#181a20] hover:bg-[#23262f] text-gray-200 hover:text-white border-white/10'
                            }`}
                            title={hasNote ? `Edit Note: "${event.notes}"` : 'Add Event Note'}
                        >
                            <FileText className="w-3.5 h-3.5 shrink-0" />
                            <span className="hidden md:inline">Note</span>
                        </button>
                    )}

                    {onInsertAfterActiveClip && activeClipPositionLabel && (
                        <button
                            type="button"
                            onClick={(e) => onInsertAfterActiveClip(e.shiftKey)}
                            className="flex items-center gap-1 h-8 px-2.5 bg-[#181a20] hover:bg-[#c6ff1f]/20 text-[#c6ff1f] rounded-lg text-xs font-semibold border border-[#c6ff1f]/35 transition-colors shrink-0 cursor-pointer"
                            title={`Insert right after ${activeClipPositionLabel} in ${activePlaylistName ? `"${activePlaylistName}"` : 'playlist'} • Hold Shift for duplicates`}
                        >
                            <CornerDownRight className="w-3.5 h-3.5 shrink-0" />
                            <span>After {activeClipPositionLabel}</span>
                        </button>
                    )}

                    {onAddToPlaylist && (
                        <button 
                            type="button"
                            onClick={(e) => onAddToPlaylist(e.shiftKey)}
                            className="flex items-center gap-1.5 h-8 px-2.5 bg-[#c6ff1f]/15 hover:bg-[#c6ff1f] text-[#c6ff1f] hover:text-black rounded-lg text-xs font-bold border border-[#c6ff1f]/40 transition-colors shrink-0 cursor-pointer"
                            title={`Append clip to end of playlist ${activePlaylistName ? `"${activePlaylistName}"` : ''} (Ctrl+S)`}
                        >
                            <ListPlus className="w-3.5 h-3.5 shrink-0" />
                            <span className="hidden xl:inline">{onInsertAfterActiveClip && activeClipPositionLabel ? '+ End' : 'Playlist'}</span>
                        </button>
                    )}

                    {onDelete && (
                        <button 
                            type="button"
                            onClick={onDelete} 
                            className="h-8 w-8 flex items-center justify-center hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-400 transition-colors shrink-0 cursor-pointer" 
                            title="Delete Event"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}

                    <button 
                        type="button"
                        onClick={onClose} 
                        className="flex items-center gap-1.5 h-8 px-3 bg-[#1f2229] hover:bg-[#2a2e37] text-white rounded-lg text-xs font-semibold border border-white/15 transition-colors shrink-0 cursor-pointer" 
                        title="Done Trimming"
                    >
                        <Check className="w-3.5 h-3.5 text-[#c6ff1f] shrink-0" />
                        <span>Done</span>
                    </button>
                </div>
            </div>

            {/* Row 2: Trimmer Timeline Track Zone (matches standard 64px timeline track zone) */}
            <div className="flex-1 min-h-0 w-full px-4 py-2 bg-[#0a0a0a] flex items-center">
                <div 
                    id="event-trimmer-track"
                    className="relative h-full min-h-[44px] max-h-12 w-full bg-[#111318] rounded-xl border border-white/10 shadow-inner overflow-hidden cursor-crosshair select-none"
                >
                    {/* Visual Grid/Ticks */}
                    <div className="absolute inset-0 flex justify-between items-center px-1.5 opacity-15 pointer-events-none">
                         {[...Array(50)].map((_, i) => (
                             <div key={i} className={`w-[1px] ${i % 5 === 0 ? 'h-4 bg-white' : 'h-2 bg-gray-500'}`} />
                         ))}
                    </div>

                    {/* The Event Region */}
                    <div 
                        className="absolute top-0 bottom-0 h-full group z-20 cursor-pointer"
                        style={{ 
                            left: `${safeStartPct}%`, 
                            width: `${safeWidthPct}%`,
                            backgroundColor: fadeColor(tag?.color || '#3b82f6', 0.25),
                            borderLeft: `2px solid ${tag?.color || '#3b82f6'}`,
                            borderRight: `2px solid ${tag?.color || '#3b82f6'}`
                        }}
                        onMouseDown={handlePlayheadMouseDown}
                    >   
                        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                        
                        {/* Left Handle (IN Point) */}
                        <div 
                            onMouseDown={(e) => handleDragStart('start', e)}
                            className="absolute left-0 top-0 bottom-0 w-8 -ml-4 cursor-ew-resize flex items-center justify-center group/handle pointer-events-auto transition-colors z-50"
                            title="Drag to trim IN point"
                        >
                            <div className="w-3.5 h-8 bg-[#1f2127] rounded-md border border-[#c6ff1f] shadow-[0_0_8px_rgba(0,0,0,0.8)] flex items-center justify-center group-hover/handle:scale-110 group-hover/handle:bg-[#2a2c34] transition-all">
                                <div className="w-[1.5px] h-4 bg-[#c6ff1f] rounded-full" />
                            </div>
                        </div>

                        {/* Right Handle (OUT Point) */}
                        <div 
                            onMouseDown={(e) => handleDragStart('end', e)}
                            className="absolute right-0 top-0 bottom-0 w-8 -mr-4 cursor-ew-resize flex items-center justify-center group/handle pointer-events-auto transition-colors z-50"
                            title="Drag to trim OUT point"
                        >
                            <div className="w-3.5 h-8 bg-[#1f2127] rounded-md border border-[#c6ff1f] shadow-[0_0_8px_rgba(0,0,0,0.8)] flex items-center justify-center group-hover/handle:scale-110 group-hover/handle:bg-[#2a2c34] transition-all">
                                <div className="w-[1.5px] h-4 bg-[#c6ff1f] rounded-full" />
                            </div>
                        </div>
                        
                        {/* Center Clip Title */}
                        <div className="w-full h-full flex items-center justify-center pointer-events-none px-5 overflow-hidden">
                             <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white tracking-wide truncate bg-[#090a0d]/80 px-2.5 py-0.5 rounded-md border border-white/15 shadow-sm max-w-full">
                                <span className="truncate">{tag?.name || 'Event'} · {formatTime(tempEnd - tempStart)}</span>
                                {hasNote && (
                                    <FileText className="w-3 h-3 text-amber-300 shrink-0" />
                                )}
                             </span>
                        </div>
                    </div>

                    {/* Freeze Frames */}
                    <div className="absolute top-0 bottom-0 left-0 w-full pointer-events-none z-30">
                        {freezeFrames.filter(ff => ff.timestamp >= viewWindow.start && ff.timestamp <= viewWindow.end).map(ff => {
                            const ffPct = ((ff.timestamp - viewWindow.start) / windowDuration) * 100;
                            return (
                                <div key={ff.id} style={{ left: `${ffPct}%` }} className="absolute top-0 bottom-0 w-[2px] bg-[#c6ff1f] shadow-[0_0_8px_rgba(198,255,31,0.8)]">
                                    <div className="absolute -top-1 left-1/2 -translate-x-1/2">
                                        <Snowflake className="w-3 h-3 text-[#a0d600] fill-[#c6ff1f] drop-shadow-md" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Draggable Playhead (Video Point Indicator) */}
                    {showPlayhead && (
                        <div 
                            className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-40 shadow-[0_0_12px_rgba(239,68,68,0.9)] cursor-ew-resize group/playhead"
                            style={{ left: `${playheadPct}%` }}
                        >
                            <div 
                                onMouseDown={handlePlayheadMouseDown}
                                className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-xl cursor-grab active:cursor-grabbing group-hover/playhead:scale-125 transition-transform pointer-events-auto"
                                title="Drag video playhead"
                            />
                            <div 
                                onMouseDown={handlePlayheadMouseDown}
                                className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-3.5 h-8 bg-red-500 rounded-full shadow-md border border-red-300 cursor-grab active:cursor-grabbing hover:scale-110 transition-transform pointer-events-auto flex items-center justify-center" 
                            >
                                <div className="w-[1px] h-3.5 bg-white/80 rounded-full" />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};
