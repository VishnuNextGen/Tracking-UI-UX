import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, X, Check, Trash2, Play, Sparkles,
  CheckCheck, Settings, Info, AlertCircle, MoreVertical,
  ArrowLeft, Heart, Star, BookOpen, RefreshCw
} from 'lucide-react';
import {
  getNotifications,
  getTutorials,
  getYouTubeThumbnail,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearAllNotifications,
  resetNotificationsToDefault,
  requestBrowserPushPermission,
  getBrowserPushPermissionStatus,
  triggerNativeNotification,
  sendPushNotification,
} from '../../utils/tutorialsAndNotificationsStore';
import type { PushNotification, Tutorial } from '../../types/tutorials';

interface NotificationBellProps {
  onOpenTutorial?: (tutorialId: string) => void;
  onNavigateToTab?: (tab: string) => void;
  onOpenAdmin?: () => void;
  className?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  onOpenTutorial,
  onNavigateToTab,
  onOpenAdmin,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<PushNotification[]>([]);
  const [tutorialsMap, setTutorialsMap] = useState<Record<string, Tutorial>>({});
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [pushStatus, setPushStatus] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default');
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<PushNotification | null>(null);
  const [pushFeedback, setPushFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);

  const reloadData = () => {
    const list = getNotifications();
    setNotifications(list);
    setPushStatus(getBrowserPushPermissionStatus());

    const tuts = getTutorials();
    const map: Record<string, Tutorial> = {};
    tuts.forEach(t => {
      map[t.id] = t;
    });
    setTutorialsMap(map);
  };

  useEffect(() => {
    reloadData();

    const handleUpdate = () => {
      reloadData();
    };

    window.addEventListener('tacstem_notifications_updated', handleUpdate);
    window.addEventListener('tacstem_tutorials_updated', handleUpdate);
    return () => {
      window.removeEventListener('tacstem_notifications_updated', handleUpdate);
      window.removeEventListener('tacstem_tutorials_updated', handleUpdate);
    };
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveMenuId(null);
        setSelectedNotification(null);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    return true;
  });

  const handleToggle = () => {
    setIsOpen(prev => {
      if (prev) setSelectedNotification(null);
      return !prev;
    });
    setActiveMenuId(null);
  };

  const handleMarkAsRead = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    markNotificationRead(id);
    reloadData();
    setActiveMenuId(null);
  };

  const handleMarkAllRead = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    markAllNotificationsRead();
    reloadData();
  };

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    deleteNotification(id);
    if (selectedNotification?.id === id) {
      setSelectedNotification(null);
    }
    reloadData();
    setActiveMenuId(null);
  };

  const handleClearAll = () => {
    clearAllNotifications();
    setSelectedNotification(null);
    reloadData();
  };

  const handleRestoreDefaults = () => {
    resetNotificationsToDefault();
    setSelectedNotification(null);
    reloadData();
  };

  const handleEnablePush = async () => {
    setIsRequestingPermission(true);
    setPushFeedback(null);
    try {
      const res = await requestBrowserPushPermission();
      setPushStatus(res);

      if (res === 'granted') {
        const sent = await triggerNativeNotification(
          'Push Notifications Enabled!',
          'You will now receive tactical video alerts and analysis updates from Tacstem.',
          '/pwa-192x192.png'
        );
        setPushFeedback({
          type: 'success',
          message: sent
            ? 'Desktop push notifications are now active!'
            : 'Push permission granted! In-app and desktop alerts active.',
        });
      } else if (res === 'denied') {
        setPushFeedback({
          type: 'error',
          message: 'Notifications are blocked in your browser. Click the lock/tune icon in your address bar to allow them.',
        });
      } else {
        setPushFeedback({
          type: 'info',
          message: 'Notification prompt was dismissed. You can enable them anytime.',
        });
      }
    } catch (e: any) {
      console.warn('handleEnablePush error:', e);
      setPushFeedback({
        type: 'error',
        message: 'Could not trigger browser prompt in preview iframe. In-app alerts remain active!',
      });
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handleSendTestNotification = async () => {
    await sendPushNotification({
      title: 'Watch Before You Start: Basic Tutorial (Recommended)',
      message: 'New to Tacstem? Watch this essential basic walkthrough first to get up and running in minutes.',
      category: 'tutorial',
      targetAudience: 'all',
      priority: 'high',
      linkType: 'tutorial',
      link: 'tut-basic',
      sentBy: 'Tacstem Academy',
    });
    reloadData();
    setPushFeedback({
      type: 'success',
      message: 'Test notification added! Check below.',
    });
  };

  const handleNotificationClick = (notif: PushNotification) => {
    if (!notif.read) {
      markNotificationRead(notif.id);
      reloadData();
    }

    const isFounderLetter = notif.id === 'notif-founder-letter' || notif.sentBy === 'Founder Letter';
    const hasActionLink =
      (notif.linkType === 'tutorial' && notif.link) ||
      (notif.linkType === 'tab' && notif.link) ||
      (notif.linkType === 'url' && notif.link);

    // Open full reading view inside dropdown for Founder Letter or notifications without an external/app target
    if (isFounderLetter || !hasActionLink) {
      setSelectedNotification({ ...notif, read: true });
      return;
    }

    if (notif.linkType === 'tutorial' && notif.link && onOpenTutorial) {
      setIsOpen(false);
      onOpenTutorial(notif.link);
    } else if (notif.linkType === 'tab' && notif.link && onNavigateToTab) {
      setIsOpen(false);
      onNavigateToTab(notif.link);
    } else if (notif.linkType === 'url' && notif.link) {
      const a = document.createElement('a');
      a.href = notif.link;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const formatRelativeTime = (timestamp: number): string => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) {
      const hours = Math.floor(diff / 3600);
      return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    }
    if (diff < 604800) {
      const days = Math.floor(diff / 86400);
      return days === 1 ? '1 day ago' : `${days} days ago`;
    }
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div ref={panelRef} className={`relative shrink-0 ${className}`}>
      {/* YouTube Style Bell Icon Button */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label={`Notifications (${unreadCount} unread)`}
        title={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
        className={`relative p-2 rounded-full transition-colors cursor-pointer flex items-center justify-center ${
          isOpen
            ? 'bg-white/15 text-white'
            : 'text-white/80 hover:text-white hover:bg-white/10 active:bg-white/15'
        }`}
      >
        <Bell className="w-5 h-5" />

        {/* Unread Counter Badge (YouTube Style Red Pill/Circle) */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-[#cc0000] text-white font-bold text-[10px] rounded-full flex items-center justify-center shadow-md ring-2 ring-[#0f0f0f]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown (Solid, Crisp, No Glassmorphism) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 w-[360px] sm:w-[480px] max-h-[85vh] bg-[#212121] text-[#f1f1f1] border border-[#383838] rounded-2xl shadow-2xl shadow-black/90 flex flex-col z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#323232] flex items-center justify-between shrink-0 bg-[#212121]">
              <div className="flex items-center gap-2 min-w-0">
                {selectedNotification ? (
                  <button
                    type="button"
                    onClick={() => setSelectedNotification(null)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#3ea6ff] hover:text-white transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>All notifications</span>
                  </button>
                ) : (
                  <>
                    <h3 className="text-base font-medium text-[#f1f1f1] tracking-normal">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="text-[11px] font-semibold text-[#3ea6ff] bg-[#3ea6ff]/15 px-2 py-0.5 rounded-full">
                        {unreadCount} unread
                      </span>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-1">
                {!selectedNotification && unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    title="Mark all as read"
                    className="p-2 rounded-full text-white/70 hover:text-white hover:bg-[#383838] transition-colors cursor-pointer"
                  >
                    <CheckCheck className="w-4 h-4 text-[#3ea6ff]" />
                  </button>
                )}
                {onOpenAdmin && (
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onOpenAdmin();
                    }}
                    title="Notification Settings & Broadcast"
                    className="p-2 rounded-full text-white/70 hover:text-white hover:bg-[#383838] transition-colors cursor-pointer"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setSelectedNotification(null);
                  }}
                  title="Close"
                  className="p-2 rounded-full text-white/70 hover:text-white hover:bg-[#383838] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {selectedNotification ? (
              /* --- Full Notification / Founder Letter Detail View --- */
              <div className="flex-1 overflow-y-auto p-5 space-y-4 max-h-[500px] scrollbar-thin bg-[#1d1d20]">
                <div className="flex items-start gap-3 pb-3 border-b border-white/10">
                  <div className="w-10 h-10 rounded-xl bg-[#c6ff1f]/15 border border-[#c6ff1f]/30 text-[#c6ff1f] flex items-center justify-center shrink-0">
                    {selectedNotification.id === 'notif-founder-letter' || selectedNotification.sentBy === 'Founder Letter' ? (
                      <Heart className="w-5 h-5 fill-current" />
                    ) : (
                      <Bell className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {(selectedNotification.id === 'notif-founder-letter' || selectedNotification.sentBy === 'Founder Letter') && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#c6ff1f]/15 text-[#c6ff1f] border border-[#c6ff1f]/30">
                          Important · Founder Letter
                        </span>
                      )}
                      {selectedNotification.priority === 'high' && selectedNotification.id !== 'notif-founder-letter' && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-400/15 text-amber-300 border border-amber-400/30">
                          Important
                        </span>
                      )}
                    </div>
                    <h4 className="text-base font-bold text-white leading-snug">
                      {selectedNotification.title}
                    </h4>
                    <div className="text-[11px] text-[#888888] mt-1 flex items-center gap-1.5">
                      <span>{formatRelativeTime(selectedNotification.timestamp)}</span>
                      {selectedNotification.sentBy && (
                        <>
                          <span>•</span>
                          <span>{selectedNotification.sentBy}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-[13px] text-[#e6e6e6] leading-relaxed whitespace-pre-wrap select-text">
                  {selectedNotification.message}
                </div>

                {/* Quick CTA inside Founder Letter to watch Basic Tutorial or explore Academy */}
                <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSelectedNotification(null)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-white/80 hover:text-white transition-colors cursor-pointer"
                  >
                    ← Back to list
                  </button>

                  {onOpenTutorial && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        setSelectedNotification(null);
                        onOpenTutorial('tut-basic');
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-[#c6ff1f] hover:bg-[#d4ff4d] text-black font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Watch Basic Tutorial</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Turn On Push Notifications Banner */}
                {pushStatus !== 'granted' ? (
                  <div className="p-3.5 bg-[#181818] border-b border-[#303030] flex flex-col gap-2 shrink-0">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#3ea6ff]/15 text-[#3ea6ff] flex items-center justify-center shrink-0 mt-0.5">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white">Turn on notifications</p>
                        <p className="text-[11px] text-[#aaaaaa] mt-0.5 leading-relaxed">
                          Get real-time alerts in your browser when new tactical masterclasses and analysis updates are released.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleEnablePush}
                        disabled={isRequestingPermission}
                        className="px-3.5 py-1.5 text-xs font-semibold bg-[#3ea6ff] hover:bg-[#65b8ff] active:bg-[#2b96f5] text-black rounded-full transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isRequestingPermission ? 'Requesting...' : 'Turn On'}
                      </button>
                      <button
                        type="button"
                        onClick={handleSendTestNotification}
                        className="px-3 py-1.5 text-xs font-medium text-[#f1f1f1] hover:bg-[#303030] rounded-full transition-colors cursor-pointer"
                      >
                        Send Test Alert
                      </button>
                    </div>

                    {pushFeedback && (
                      <div
                        className={`mt-1 text-[11px] p-2 rounded-lg flex items-start gap-1.5 ${
                          pushFeedback.type === 'success'
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                            : pushFeedback.type === 'error'
                            ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                            : 'bg-blue-950/80 text-blue-300 border border-blue-800'
                        }`}
                      >
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span className="leading-snug">{pushFeedback.message}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="px-4 py-2 bg-[#181818] border-b border-[#303030] flex items-center justify-between text-xs text-[#aaaaaa] shrink-0">
                    <span className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                      <Check className="w-3.5 h-3.5" />
                      <span>Desktop push active</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleSendTestNotification}
                      className="text-[11px] text-[#3ea6ff] hover:underline cursor-pointer"
                    >
                      Send Test Alert
                    </button>
                  </div>
                )}

                {/* Filter Bar */}
                <div className="px-4 py-2 border-b border-[#323232] flex items-center justify-between gap-2 shrink-0 bg-[#212121]">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFilter('all')}
                      className={`px-3 py-1 text-xs rounded-full transition-colors cursor-pointer ${
                        filter === 'all'
                          ? 'bg-white text-black font-semibold'
                          : 'bg-[#2b2b2b] text-[#f1f1f1] hover:bg-[#383838] font-medium'
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilter('unread')}
                      className={`px-3 py-1 text-xs rounded-full transition-colors cursor-pointer flex items-center gap-1.5 ${
                        filter === 'unread'
                          ? 'bg-white text-black font-semibold'
                          : 'bg-[#2b2b2b] text-[#f1f1f1] hover:bg-[#383838] font-medium'
                      }`}
                    >
                      <span>Unread</span>
                      {unreadCount > 0 && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${filter === 'unread' ? 'bg-black/20 text-black' : 'bg-[#3ea6ff] text-black'}`}>
                          {unreadCount}
                        </span>
                      )}
                    </button>
                  </div>

                  {notifications.length > 0 ? (
                    <button
                      onClick={handleClearAll}
                      className="text-xs text-[#aaaaaa] hover:text-[#ff4e45] transition-colors flex items-center gap-1 cursor-pointer py-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleRestoreDefaults}
                      className="text-xs text-[#3ea6ff] hover:text-white transition-colors flex items-center gap-1 cursor-pointer py-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Restore Welcome</span>
                    </button>
                  )}
                </div>

                {/* Notification List */}
                <div className="flex-1 overflow-y-auto divide-y divide-[#2d2d2d] max-h-[440px] scrollbar-thin bg-[#212121]">
                  {filteredNotifications.length === 0 ? (
                    <div className="py-12 px-6 text-center flex flex-col items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-[#2a2a2a] flex items-center justify-center text-white/30 mb-3">
                        <Bell className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-medium text-[#f1f1f1]">Your notifications live here</h4>
                      <p className="text-xs text-[#aaaaaa] mt-1 max-w-xs leading-relaxed">
                        {filter === 'unread'
                          ? 'You have caught up with all tactical notifications.'
                          : 'Tutorial alerts, founder announcements, and masterclass drops will appear here.'}
                      </p>
                      {notifications.length === 0 && (
                        <button
                          type="button"
                          onClick={handleRestoreDefaults}
                          className="mt-3 px-3 py-1.5 rounded-lg bg-[#2f2f2f] hover:bg-[#3a3a3a] text-xs font-semibold text-[#c6ff1f] transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Restore Welcome Notifications</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    filteredNotifications.map(item => {
                      const linkedTutorial = item.linkType === 'tutorial' && item.link ? tutorialsMap[item.link] : null;
                      const isMenuOpen = activeMenuId === item.id;
                      const isFounderLetter = item.id === 'notif-founder-letter' || item.sentBy === 'Founder Letter';
                      const isBasicTutorial = item.id === 'notif-basic-tutorial' || item.link === 'tut-basic';
                      const isAcademyWelcome = item.id === 'notif-welcome';

                      return (
                        <div
                          key={item.id}
                          onClick={() => handleNotificationClick(item)}
                          className={`px-4 py-3.5 transition-colors cursor-pointer group relative flex items-start gap-3 ${
                            item.read ? 'bg-[#212121] hover:bg-[#2c2c2c]' : 'bg-[#252528] hover:bg-[#2c2c2e]'
                          }`}
                        >
                          {/* Left: Category Avatar */}
                          <div className="shrink-0 pt-0.5">
                            {isFounderLetter ? (
                              <div className="w-9 h-9 rounded-full bg-[#c6ff1f]/20 text-[#c6ff1f] border border-[#c6ff1f]/30 flex items-center justify-center">
                                <Heart className="w-4 h-4 fill-current" />
                              </div>
                            ) : isAcademyWelcome ? (
                              <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                                <BookOpen className="w-4 h-4" />
                              </div>
                            ) : item.category === 'tutorial' ? (
                              <div className="w-9 h-9 rounded-full bg-[#cc0000]/20 text-[#ff4e45] flex items-center justify-center">
                                <Play className="w-4 h-4 fill-current ml-0.5" />
                              </div>
                            ) : item.category === 'feature' ? (
                              <div className="w-9 h-9 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                                <Sparkles className="w-4 h-4" />
                              </div>
                            ) : item.category === 'alert' ? (
                              <div className="w-9 h-9 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
                                <AlertCircle className="w-4 h-4" />
                              </div>
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-[#3ea6ff]/20 text-[#3ea6ff] flex items-center justify-center">
                                <Bell className="w-4 h-4" />
                              </div>
                            )}
                          </div>

                          {/* Middle: Badges, Title, Description, Timestamp */}
                          <div className="flex-1 min-w-0 pr-1">
                            {(isFounderLetter || isBasicTutorial) && (
                              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                {isFounderLetter && (
                                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#c6ff1f]/15 text-[#c6ff1f] border border-[#c6ff1f]/30">
                                    Important · Founder Letter
                                  </span>
                                )}
                                {isBasicTutorial && (
                                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                                    <Star className="w-2.5 h-2.5 fill-current" />
                                    <span>Watch Before Start</span>
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="text-[13px] font-semibold leading-snug text-[#f1f1f1] group-hover:text-white line-clamp-2">
                              {item.title}
                            </div>

                            <p className={`text-xs text-[#b5b5b5] mt-1 leading-relaxed ${isFounderLetter ? 'line-clamp-3 whitespace-pre-line' : 'line-clamp-2'}`}>
                              {item.message}
                            </p>

                            {isFounderLetter && (
                              <span className="inline-block text-[11px] font-semibold text-[#c6ff1f] mt-1 group-hover:underline">
                                Read full founder letter →
                              </span>
                            )}

                            {isBasicTutorial && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#c6ff1f] mt-1 group-hover:underline">
                                <Play className="w-3 h-3 fill-current" />
                                <span>Watch recommended tutorial →</span>
                              </span>
                            )}

                            <div className="text-[11px] text-[#888888] mt-1.5 flex items-center gap-1.5">
                              <span>{formatRelativeTime(item.timestamp)}</span>
                              {item.sentBy && (
                                <>
                                  <span>•</span>
                                  <span>{item.sentBy}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Right: YouTube Video Thumbnail (if linked to a video tutorial) */}
                          {linkedTutorial && linkedTutorial.youtubeId && (
                            <div className="relative w-[82px] h-[48px] rounded-lg bg-black/60 overflow-hidden shrink-0 border border-white/15 group-hover:border-[#c6ff1f]/50 transition-all mt-0.5">
                              <img
                                src={getYouTubeThumbnail(linkedTutorial.youtubeId)}
                                alt={linkedTutorial.title}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                <div className="w-5 h-5 rounded-full bg-[#c6ff1f] flex items-center justify-center text-black shadow">
                                  <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                                </div>
                              </div>
                              {linkedTutorial.duration && (
                                <span className="absolute bottom-0.5 right-0.5 text-[9px] font-bold bg-black/80 text-white px-1 py-0.2 rounded">
                                  {linkedTutorial.duration}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Unread Dot */}
                          {!item.read && (
                            <span className="w-2 h-2 rounded-full bg-[#3ea6ff] shrink-0 self-center" />
                          )}

                          {/* Kebab / Quick Actions */}
                          <div className="relative shrink-0 self-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(isMenuOpen ? null : item.id);
                              }}
                              className="p-1.5 rounded-full text-[#aaaaaa] hover:text-white hover:bg-[#383838] transition-colors opacity-0 group-hover:opacity-100"
                              title="Options"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {/* Dropdown Menu */}
                            {isMenuOpen && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-full mt-1 w-36 bg-[#282828] border border-[#3f3f3f] rounded-xl shadow-xl py-1 z-30"
                              >
                                {!item.read && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleMarkAsRead(item.id, e)}
                                    className="w-full px-3 py-1.5 text-xs text-[#f1f1f1] hover:bg-[#383838] flex items-center gap-2 text-left"
                                  >
                                    <Check className="w-3.5 h-3.5 text-[#3ea6ff]" />
                                    <span>Mark as read</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => handleDelete(item.id, e)}
                                  className="w-full px-3 py-1.5 text-xs text-[#ff4e45] hover:bg-[#383838] flex items-center gap-2 text-left"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Hide notification</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {/* Footer with Video Academy link */}
            <div className="px-4 py-2.5 bg-[#1a1a1a] border-t border-[#303030] flex items-center justify-between text-xs text-[#aaaaaa] shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (onNavigateToTab) {
                    setIsOpen(false);
                    setSelectedNotification(null);
                    onNavigateToTab('tutorials');
                  }
                }}
                className="text-[11px] hover:text-white transition-colors cursor-pointer"
              >
                Tacstem Sports Video Academy →
              </button>
              {onOpenAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setSelectedNotification(null);
                    onOpenAdmin();
                  }}
                  className="text-[11px] text-[#3ea6ff] hover:underline cursor-pointer font-medium"
                >
                  Admin Broadcast →
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
