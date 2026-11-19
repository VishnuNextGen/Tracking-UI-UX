import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Send,
  Plus,
  Edit2,
  Trash2,
  Video,
  GraduationCap,
  FolderPlus,
  Check,
  X,
  ExternalLink,
  Star,
  RefreshCw,
  Folder,
  Clock,
  AlertTriangle,
  ShieldCheck,
  ArrowLeft,
  Users,
  BarChart3,
  Settings,
} from 'lucide-react';
import {
  getTutorials,
  saveTutorial,
  deleteTutorial,
  getTutorialFolders,
  saveTutorialFolder,
  deleteTutorialFolder,
  getAdminBroadcastNotifications,
  sendPushNotification,
  adminDeleteBroadcastNotification,
  adminClearAllBroadcastNotifications,
  adminResetBroadcastNotifications,
  FOUNDER_LETTER_BODY,
  extractYouTubeId,
  getYouTubeThumbnail,
  requestBrowserPushPermission,
  getBrowserPushPermissionStatus,
  refreshAcademyCurriculumFromCloud,
} from '../../utils/tutorialsAndNotificationsStore';
import { UserPlansManager } from './UserPlansManager';
import { UserAnalyticsView } from './UserAnalyticsView';
import { AdminSettingsView } from './AdminSettingsView';
import {
  getAllUsers,
  fetchAdminHeaderCounts,
} from '../../utils/userPlanStore';
import type { UserProfile } from '../../types/user';
import type {
  Tutorial,
  TutorialFolder,
  PushNotification,
  NotificationCategory,
  NotificationAudience,
} from '../../types/tutorials';

type AdminTabId =
  | 'users'
  | 'analytics'
  | 'notifications'
  | 'tutorials'
  | 'folders'
  | 'settings';

interface AdminPageProps {
  onBackToHome: () => void;
  onNavigateToTutorials: () => void;
  videoProjectsCount?: number;
  boardProjectsCount?: number;
  onPlanChanged?: (user: UserProfile) => void;
  initialTab?: AdminTabId;
}

export const AdminPage: React.FC<AdminPageProps> = ({
  onBackToHome,
  onNavigateToTutorials,
  videoProjectsCount = 0,
  boardProjectsCount = 0,
  onPlanChanged,
  initialTab = 'users',
}) => {
  const [activeTab, setActiveTab] = useState<AdminTabId>(initialTab);
  const [userListCount, setUserListCount] = useState<number>(() => getAllUsers().length);
  const [pendingUpgradeCount, setPendingUpgradeCount] = useState<number>(0);

  // Notifications state
  const [notifications, setNotifications] = useState<PushNotification[]>([]);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifCategory, setNotifCategory] = useState<NotificationCategory>('announcement');
  const [notifAudience, setNotifAudience] = useState<NotificationAudience>('all');
  const [notifPriority, setNotifPriority] = useState<'normal' | 'high'>('normal');
  const [notifLinkType, setNotifLinkType] = useState<'none' | 'tutorial' | 'url' | 'tab'>('none');
  const [notifLink, setNotifLink] = useState('');
  const [isSendingNotif, setIsSendingNotif] = useState(false);

  // Tutorials & Folders state
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [folders, setFolders] = useState<TutorialFolder[]>([]);
  const [editingTutorial, setEditingTutorial] = useState<Tutorial | null>(null);
  const [isTutorialModalOpen, setIsTutorialModalOpen] = useState(false);

  const [tutTitle, setTutTitle] = useState('');
  const [tutUrl, setTutUrl] = useState('');
  const [tutFolderId, setTutFolderId] = useState('');
  const [tutDescription, setTutDescription] = useState('');
  const [tutDuration, setTutDuration] = useState('08:00');
  const [tutRecommended, setTutRecommended] = useState(false);
  const [tutTags, setTutTags] = useState('');
  const [tutAuthor, setTutAuthor] = useState('Tacstem Academy');
  const [tutFormError, setTutFormError] = useState<string | null>(null);

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<TutorialFolder | null>(null);
  const [folderName, setFolderName] = useState('');
  const [folderDesc, setFolderDesc] = useState('');
  const [folderOrder, setFolderOrder] = useState<number>(1);

  // Push status & feedback banners
  const [pushStatus, setPushStatus] = useState<'granted' | 'denied' | 'default' | 'unsupported'>(
    'default'
  );
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const reloadAll = () => {
    setNotifications(getAdminBroadcastNotifications());
    const tuts = getTutorials();
    const flds = getTutorialFolders();
    setTutorials(tuts);
    setFolders(flds);
    setPushStatus(getBrowserPushPermissionStatus());
    if (flds.length > 0 && !tutFolderId) {
      setTutFolderId(flds[0].id);
    }
  };

  const refreshHeaderBadges = async () => {
    const counts = await fetchAdminHeaderCounts();
    setUserListCount(counts.totalUsersCount);
    setPendingUpgradeCount(counts.pendingUpgradesCount);
  };

  useEffect(() => {
    reloadAll();
    refreshHeaderBadges().catch(() => {});
    refreshAcademyCurriculumFromCloud(true).catch(() => {});

    const onNotifChange = () => setNotifications(getAdminBroadcastNotifications());
    const onTutChange = () => {
      setTutorials(getTutorials());
      setFolders(getTutorialFolders());
    };
    const onAdminBadgesRefresh = () => {
      setUserListCount(getAllUsers().length);
      refreshHeaderBadges().catch(() => {});
    };

    window.addEventListener('tacstem_notifications_updated', onNotifChange);
    window.addEventListener('tacstem_tutorials_updated', onTutChange);
    window.addEventListener('tacstem_admin_counts_changed', onAdminBadgesRefresh);
    return () => {
      window.removeEventListener('tacstem_notifications_updated', onNotifChange);
      window.removeEventListener('tacstem_tutorials_updated', onTutChange);
      window.removeEventListener('tacstem_admin_counts_changed', onAdminBadgesRefresh);
    };
  }, []);

  // --- Push Notification Handlers ---

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifMessage.trim()) return;

    setIsSendingNotif(true);
    try {
      await sendPushNotification({
        title: notifTitle.trim(),
        message: notifMessage.trim(),
        category: notifCategory,
        targetAudience: notifAudience,
        priority: notifPriority,
        linkType: notifLinkType,
        link: notifLink.trim(),
        sentBy: 'Tacstem Admin',
      });

      setNotifTitle('');
      setNotifMessage('');
      setNotifLink('');
      setNotifLinkType('none');
      setNotifications(getAdminBroadcastNotifications());
      showToast('Broadcast sent live to all connected users via Firestore!');
    } catch (err: any) {
      showToast(err?.message || 'Failed to send broadcast notification.');
    } finally {
      setIsSendingNotif(false);
    }
  };

  const handleApplyPreset = (preset: {
    title: string;
    message: string;
    category: NotificationCategory;
    priority: 'normal' | 'high';
    linkType: 'tutorial' | 'tab' | 'url' | 'none';
    link: string;
  }) => {
    setNotifTitle(preset.title);
    setNotifMessage(preset.message);
    setNotifCategory(preset.category);
    setNotifPriority(preset.priority);
    setNotifLinkType(preset.linkType);
    setNotifLink(preset.link);
    setActiveTab('notifications');
  };

  const handleDeleteNotif = async (id: string) => {
    await adminDeleteBroadcastNotification(id);
    setNotifications(getAdminBroadcastNotifications());
    showToast('Deleted broadcast notification from Firestore.');
  };

  const handleRequestPushPermission = async () => {
    try {
      const res = await requestBrowserPushPermission();
      setPushStatus(res);
      if (res === 'granted') {
        showToast('Desktop browser push notifications enabled!');
      } else if (res === 'denied') {
        showToast('Browser notifications are blocked in site permissions.');
      }
    } catch {
      // ignore
    }
  };

  // --- Tutorials Handlers ---

  const openNewTutorialModal = () => {
    setEditingTutorial(null);
    setTutTitle('');
    setTutUrl('');
    setTutFolderId(folders[0]?.id || 'folder-getting-started');
    setTutDescription('');
    setTutDuration('08:00');
    setTutRecommended(false);
    setTutTags('Tactics, Analysis');
    setTutAuthor('Tacstem Academy');
    setTutFormError(null);
    setIsTutorialModalOpen(true);
  };

  const openEditTutorialModal = (tut: Tutorial) => {
    setEditingTutorial(tut);
    setTutTitle(tut.title);
    setTutUrl(tut.youtubeUrl);
    setTutFolderId(tut.folderId);
    setTutDescription(tut.description);
    setTutDuration(tut.duration);
    setTutRecommended(tut.recommended);
    setTutTags(tut.tags.join(', '));
    setTutAuthor(tut.author || 'Tacstem Academy');
    setTutFormError(null);
    setIsTutorialModalOpen(true);
  };

  const handleSaveTutorial = (e: React.FormEvent) => {
    e.preventDefault();
    const ytId = extractYouTubeId(tutUrl);
    if (!ytId) {
      setTutFormError(
        'Please enter a valid 11-character YouTube URL or ID (e.g. https://youtu.be/qJv3rzUGbNE).'
      );
      return;
    }

    const folderObj = folders.find((f) => f.id === tutFolderId);
    const tagsArr = tutTags
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 15);

    const payload: Tutorial = {
      id: editingTutorial ? editingTutorial.id : 'tut-' + Date.now(),
      title: tutTitle.trim(),
      description: tutDescription.trim(),
      youtubeUrl: tutUrl.trim(),
      youtubeId: ytId,
      folderId: tutFolderId || 'folder-getting-started',
      folderName: folderObj?.name || 'Getting Started & Workspace',
      duration: tutDuration.trim() || '08:00',
      recommended: tutRecommended,
      tags: tagsArr,
      createdAt: editingTutorial ? editingTutorial.createdAt : Date.now(),
      author: tutAuthor.trim() || 'Tacstem Academy',
    };

    const updated = saveTutorial(payload);
    setTutorials(updated);
    setIsTutorialModalOpen(false);
    showToast(
      editingTutorial
        ? `Updated Academy tutorial "${payload.title}".`
        : `Published "${payload.title}" to Video Academy.`
    );
  };

  const handleBroadcastTutorialAlert = (tut: Tutorial) => {
    handleApplyPreset({
      title: `New Academy Lesson: ${tut.title}`,
      message: tut.description || `Watch "${tut.title}" now in the Tacstem Video Academy.`,
      category: 'tutorial',
      priority: 'high',
      linkType: 'tutorial',
      link: tut.id,
    });
  };

  // --- Folder Handlers ---

  const openNewFolderModal = () => {
    setEditingFolder(null);
    setFolderName('');
    setFolderDesc('');
    setFolderOrder(folders.length + 1);
    setIsFolderModalOpen(true);
  };

  const openEditFolderModal = (f: TutorialFolder) => {
    setEditingFolder(f);
    setFolderName(f.name);
    setFolderDesc(f.description);
    setFolderOrder(f.order);
    setIsFolderModalOpen(true);
  };

  const handleSaveFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    const payload: TutorialFolder = {
      id: editingFolder ? editingFolder.id : 'folder-' + Date.now(),
      name: folderName.trim(),
      description: folderDesc.trim(),
      iconName: editingFolder?.iconName || 'Folder',
      order: Math.max(1, Number(folderOrder) || folders.length + 1),
    };
    const updated = saveTutorialFolder(payload);
    setFolders(updated);
    setIsFolderModalOpen(false);
    showToast(
      editingFolder ? `Updated folder "${payload.name}".` : `Created folder "${payload.name}".`
    );
  };

  const navItems: {
    id: AdminTabId;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
  }[] = [
    { id: 'users', label: 'Users & Promotions', icon: Users, badge: pendingUpgradeCount || userListCount },
    { id: 'analytics', label: 'Usage & Stats', icon: BarChart3 },
    { id: 'notifications', label: 'Push Broadcasts', icon: Bell, badge: notifications.length },
    { id: 'tutorials', label: 'Video Academy', icon: Video, badge: tutorials.length },
    { id: 'folders', label: 'Academy Folders', icon: Folder, badge: folders.length },
    { id: 'settings', label: 'Platform Settings', icon: Settings },
  ];

  return (
    <div className="h-screen h-[100dvh] w-full bg-[#090a0d] text-white flex flex-col overflow-hidden">
      {/* Top Header */}
      <header className="shrink-0 z-30 bg-[#0d0e13]/95 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToHome}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/75 hover:text-white transition-colors cursor-pointer"
              title="Back to Workspace Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#c6ff1f]" />
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
                  Tacstem Admin Console
                </h1>
              </div>
              <p className="text-[11px] text-white/45">
                Live Firestore Control Plane · User Promotions, Push Notifications, Analytics &amp; Academy
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onNavigateToTutorials}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/80 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <GraduationCap className="w-3.5 h-3.5 text-[#c6ff1f]" />
              <span>Preview Academy</span>
              <ExternalLink className="w-3 h-3 text-white/40" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {navItems.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            const hasAlert = tab.id === 'users' && pendingUpgradeCount > 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                  active
                    ? 'bg-[#c6ff1f] text-black font-bold shadow-sm'
                    : 'bg-white/[0.03] hover:bg-white/[0.07] text-white/65 hover:text-white border border-white/[0.06]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded tabular-nums ${
                      hasAlert && !active
                        ? 'bg-amber-400 text-black font-bold'
                        : active
                        ? 'bg-black/20 text-black'
                        : 'bg-white/10 text-white/60'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Scrollable Main Content Container */}
      <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden scrollbar-glass">
        <main className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-6 pb-24">
        <AnimatePresence>
          {toastMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-5 p-3.5 bg-[#151c12] border border-[#c6ff1f]/40 rounded-xl text-xs font-semibold text-[#c6ff1f] flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>{toastMsg}</span>
              </div>
              <button onClick={() => setToastMsg(null)} className="text-white/50 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* TAB 1: USERS & PROMOTIONS */}
        {activeTab === 'users' && (
          <UserPlansManager
            onPlanChanged={onPlanChanged}
            videoProjectsCount={videoProjectsCount}
            boardProjectsCount={boardProjectsCount}
          />
        )}

        {/* TAB 2: USAGE & PROJECT STATS */}
        {activeTab === 'analytics' && <UserAnalyticsView />}

        {/* TAB 3: PUSH NOTIFICATIONS BROADCASTER */}
        {activeTab === 'notifications' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-6 items-start">
            {/* Left: Composer */}
            <form
              onSubmit={handleSendNotification}
              className="bg-[#121318] border border-white/10 rounded-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-white">Broadcast Push Notification</h2>
                  <p className="text-xs text-white/50 mt-0.5">
                    Delivered instantaneously via Firestore to connected users + desktop push.
                  </p>
                </div>
                {pushStatus !== 'granted' && pushStatus !== 'unsupported' && (
                  <button
                    type="button"
                    onClick={handleRequestPushPermission}
                    className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold text-[#c6ff1f] cursor-pointer"
                  >
                    Enable Local Push
                  </button>
                )}
              </div>

              {/* Quick Templates */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    handleApplyPreset({
                      title: 'Watch Before You Start: Basic Tutorial',
                      message:
                        'Master match importing, fast tagging hotkeys, and telestration video export in 6 minutes.',
                      category: 'tutorial',
                      priority: 'high',
                      linkType: 'tutorial',
                      link: tutorials[0]?.id || 'tut-basic',
                    })
                  }
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-white/75 cursor-pointer"
                >
                  + Basic Tutorial Alert
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleApplyPreset({
                      title: 'Welcome to Tacstem!',
                      message: FOUNDER_LETTER_BODY,
                      category: 'announcement',
                      priority: 'high',
                      linkType: 'none',
                      link: '',
                    })
                  }
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-white/75 cursor-pointer"
                >
                  + Founder Letter
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">Title</label>
                <input
                  type="text"
                  required
                  maxLength={160}
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  placeholder="e.g. New Tactical Pitch Animation Tools Released"
                  className="w-full bg-black/40 border border-white/10 focus:border-[#c6ff1f] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">Message</label>
                <textarea
                  required
                  rows={4}
                  maxLength={2500}
                  value={notifMessage}
                  onChange={(e) => setNotifMessage(e.target.value)}
                  placeholder="Write your announcement, release notes, or coaching tip..."
                  className="w-full bg-black/40 border border-white/10 focus:border-[#c6ff1f] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none resize-y"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-white/60 mb-1">Category</label>
                  <select
                    value={notifCategory}
                    onChange={(e) => setNotifCategory(e.target.value as NotificationCategory)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="announcement" className="bg-[#121318]">Announcement</option>
                    <option value="tutorial" className="bg-[#121318]">Tutorial</option>
                    <option value="feature" className="bg-[#121318]">New Feature</option>
                    <option value="update" className="bg-[#121318]">Platform Update</option>
                    <option value="alert" className="bg-[#121318]">Important Alert</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-white/60 mb-1">Target Audience</label>
                  <select
                    value={notifAudience}
                    onChange={(e) => setNotifAudience(e.target.value as NotificationAudience)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="all" className="bg-[#121318]">All Users</option>
                    <option value="analysts" className="bg-[#121318]">Analysts Only</option>
                    <option value="coaches" className="bg-[#121318]">Coaches Only</option>
                    <option value="content_creators" className="bg-[#121318]">Content Creators</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-white/60 mb-1">Priority</label>
                  <select
                    value={notifPriority}
                    onChange={(e) => setNotifPriority(e.target.value as 'normal' | 'high')}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="normal" className="bg-[#121318]">Normal</option>
                    <option value="high" className="bg-[#121318]">High Priority</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-white/60 mb-1">Deep Link Action</label>
                  <select
                    value={notifLinkType}
                    onChange={(e) => {
                      const nextType = e.target.value as 'none' | 'tutorial' | 'url' | 'tab';
                      setNotifLinkType(nextType);
                      if (nextType === 'tutorial' && tutorials[0]) setNotifLink(tutorials[0].id);
                      else if (nextType === 'tab') setNotifLink('tutorials');
                      else setNotifLink('');
                    }}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="none" className="bg-[#121318]">None</option>
                    <option value="tutorial" className="bg-[#121318]">Open Academy Video</option>
                    <option value="tab" className="bg-[#121318]">Navigate to App View</option>
                    <option value="url" className="bg-[#121318]">External URL</option>
                  </select>
                </div>

                {notifLinkType === 'tutorial' && (
                  <div>
                    <label className="block text-[11px] text-white/60 mb-1">Select Tutorial</label>
                    <select
                      value={notifLink}
                      onChange={(e) => setNotifLink(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      {tutorials.map((t) => (
                        <option key={t.id} value={t.id} className="bg-[#121318]">
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {notifLinkType === 'tab' && (
                  <div>
                    <label className="block text-[11px] text-white/60 mb-1">Target Tab</label>
                    <select
                      value={notifLink}
                      onChange={(e) => setNotifLink(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      <option value="tutorials" className="bg-[#121318]">Video Academy</option>
                      <option value="games" className="bg-[#121318]">Games Dashboard</option>
                      <option value="board" className="bg-[#121318]">Tactical Board</option>
                      <option value="batches" className="bg-[#121318]">Batches</option>
                    </select>
                  </div>
                )}

                {notifLinkType === 'url' && (
                  <div>
                    <label className="block text-[11px] text-white/60 mb-1">Destination URL</label>
                    <input
                      type="url"
                      value={notifLink}
                      onChange={(e) => setNotifLink(e.target.value)}
                      placeholder="https://www.tacstem.com"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSendingNotif}
                className="w-full py-2.5 px-4 rounded-xl bg-[#c6ff1f] hover:bg-[#d4ff4d] disabled:opacity-50 text-black font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSendingNotif ? 'Broadcasting...' : 'Broadcast Live Notification'}</span>
              </button>
            </form>

            {/* Right: Broadcast History */}
            <div className="bg-[#121318] border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h2 className="text-base font-bold text-white">
                    Active Firestore Broadcasts ({notifications.length})
                  </h2>
                  <p className="text-xs text-white/50">
                    Visible in users' Notification Bell according to audience filter.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmAction({
                        title: 'Restore Default Welcome Broadcasts?',
                        message:
                          'This re-publishes the default Welcome & Founder Letter notifications to Firestore.',
                        confirmLabel: 'Restore Defaults',
                        onConfirm: async () => {
                          await adminResetBroadcastNotifications();
                          setNotifications(getAdminBroadcastNotifications());
                          showToast('Default broadcasts restored in Firestore.');
                        },
                      })
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/75 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Seed Defaults</span>
                  </button>

                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmAction({
                          title: 'Delete All Broadcast Notifications?',
                          message:
                            'This permanently deletes all broadcast records from Firestore for all users.',
                          confirmLabel: 'Delete All',
                          onConfirm: async () => {
                            await adminClearAllBroadcastNotifications();
                            setNotifications([]);
                            showToast('Cleared all broadcast notifications.');
                          },
                        })
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-xs text-red-300 cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              <div className="divide-y divide-white/10 max-h-[540px] overflow-y-auto pr-1">
                {notifications.length === 0 ? (
                  <p className="py-10 text-center text-xs text-white/45">
                    No active broadcasts in Firestore.
                  </p>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="py-3.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white">{n.title}</span>
                          <span className="text-[10px] font-mono uppercase text-[#c6ff1f]">
                            {n.category}
                          </span>
                          <span className="text-[10px] text-white/45 font-mono">
                            → {n.targetAudience}
                          </span>
                        </div>
                        <p className="text-xs text-white/65 line-clamp-2 whitespace-pre-line">
                          {n.message}
                        </p>
                        <div className="text-[10px] text-white/40 font-mono tabular-nums">
                          {new Date(n.timestamp).toLocaleString()} · {n.sentBy || 'Admin'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteNotif(n.id)}
                        className="p-1.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 shrink-0 cursor-pointer"
                        title="Delete from Firestore"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: VIDEO ACADEMY TUTORIALS */}
        {activeTab === 'tutorials' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white">
                  Video Academy Catalog ({tutorials.length})
                </h2>
                <p className="text-xs text-white/50">
                  Manage YouTube tutorials synced in real time across every user's Academy page.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openNewTutorialModal}
                  className="px-4 py-2 rounded-xl bg-[#c6ff1f] hover:bg-[#d4ff4d] text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add YouTube Tutorial</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tutorials.map((tut) => (
                <div
                  key={tut.id}
                  className="bg-[#121318] border border-white/10 rounded-2xl overflow-hidden flex flex-col"
                >
                  <div className="relative aspect-video bg-black">
                    <img
                      src={getYouTubeThumbnail(tut.youtubeId)}
                      alt={tut.title}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white tabular-nums">
                      {tut.duration}
                    </span>
                    {tut.recommended && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[#c6ff1f] text-black text-[10px] font-bold flex items-center gap-1">
                        <Star className="w-2.5 h-2.5 fill-black" /> Featured
                      </span>
                    )}
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <div className="text-[10px] font-mono uppercase text-[#c6ff1f]">
                        {tut.folderName}
                      </div>
                      <h3 className="text-sm font-bold text-white line-clamp-2">{tut.title}</h3>
                      <p className="text-xs text-white/55 line-clamp-2">{tut.description}</p>
                    </div>

                    <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleBroadcastTutorialAlert(tut)}
                        className="text-[11px] font-semibold text-[#c6ff1f] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Bell className="w-3 h-3" />
                        <span>Push Alert</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditTutorialModal(tut)}
                          className="p-1.5 rounded-lg text-white/55 hover:text-white hover:bg-white/10 cursor-pointer"
                          title="Edit tutorial"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmAction({
                              title: `Delete "${tut.title}"?`,
                              message:
                                'This removes the tutorial from the Video Academy for all users.',
                              confirmLabel: 'Delete Tutorial',
                              onConfirm: () => {
                                setTutorials(deleteTutorial(tut.id));
                                showToast(`Deleted tutorial "${tut.title}".`);
                              },
                            })
                          }
                          className="p-1.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                          title="Delete tutorial"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: CURRICULUM FOLDERS */}
        {activeTab === 'folders' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white">
                  Academy Curriculum Folders ({folders.length})
                </h2>
                <p className="text-xs text-white/50">
                  Organize tutorials into structured learning modules.
                </p>
              </div>
              <button
                type="button"
                onClick={openNewFolderModal}
                className="px-4 py-2 rounded-xl bg-[#c6ff1f] hover:bg-[#d4ff4d] text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <FolderPlus className="w-4 h-4" />
                <span>New Folder</span>
              </button>
            </div>

            <div className="bg-[#121318] border border-white/10 rounded-2xl divide-y divide-white/10">
              {folders.map((f) => {
                const count = tutorials.filter((t) => t.folderId === f.id).length;
                return (
                  <div
                    key={f.id}
                    className="p-4 flex items-center justify-between gap-4 hover:bg-white/[0.02]"
                  >
                    <div className="flex items-start gap-3">
                      <span className="font-mono text-xs text-[#c6ff1f] pt-0.5 tabular-nums">
                        #{f.order}
                      </span>
                      <div>
                        <div className="text-sm font-bold text-white">{f.name}</div>
                        <p className="text-xs text-white/55 mt-0.5">{f.description}</p>
                        <div className="text-[11px] text-white/40 font-mono mt-1 tabular-nums">
                          {count} video{count === 1 ? '' : 's'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditFolderModal(f)}
                        className="p-2 rounded-lg text-white/55 hover:text-white hover:bg-white/10 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmAction({
                            title: `Delete folder "${f.name}"?`,
                            message: 'Existing videos in this folder will remain in the catalog.',
                            confirmLabel: 'Delete Folder',
                            onConfirm: () => {
                              setFolders(deleteTutorialFolder(f.id));
                              showToast(`Deleted folder "${f.name}".`);
                            },
                          })
                        }
                        className="p-2 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 6: PLATFORM SETTINGS */}
        {activeTab === 'settings' && <AdminSettingsView />}
        </main>
      </div>

      {/* Tutorial Add/Edit Modal */}
      {isTutorialModalOpen && (
        <div
          className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setIsTutorialModalOpen(false)}
        >
          <form
            onSubmit={handleSaveTutorial}
            className="bg-[#121318] border border-white/15 rounded-2xl max-w-lg w-full max-h-[90dvh] overflow-y-auto my-auto p-6 space-y-3.5 scrollbar-glass"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingTutorial ? 'Edit Academy Tutorial' : 'Add YouTube Tutorial'}
              </h3>
              <button
                type="button"
                onClick={() => setIsTutorialModalOpen(false)}
                className="text-white/40 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {tutFormError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-red-200">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{tutFormError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs text-white/65 mb-1">Tutorial Title</label>
              <input
                type="text"
                required
                maxLength={200}
                value={tutTitle}
                onChange={(e) => setTutTitle(e.target.value)}
                className="w-full bg-black/40 border border-white/10 focus:border-[#c6ff1f] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-white/65 mb-1">YouTube Video URL or ID</label>
              <input
                type="text"
                required
                maxLength={500}
                value={tutUrl}
                onChange={(e) => setTutUrl(e.target.value)}
                placeholder="https://youtu.be/qJv3rzUGbNE"
                className="w-full bg-black/40 border border-white/10 focus:border-[#c6ff1f] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/65 mb-1">Folder</label>
                <select
                  value={tutFolderId}
                  onChange={(e) => setTutFolderId(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  {folders.map((f) => (
                    <option key={f.id} value={f.id} className="bg-[#121318]">
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/65 mb-1">Duration (MM:SS)</label>
                <input
                  type="text"
                  maxLength={20}
                  value={tutDuration}
                  onChange={(e) => setTutDuration(e.target.value)}
                  placeholder="08:45"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-white/65 mb-1">Description</label>
              <textarea
                rows={3}
                maxLength={2000}
                value={tutDescription}
                onChange={(e) => setTutDescription(e.target.value)}
                className="w-full bg-black/40 border border-white/10 focus:border-[#c6ff1f] rounded-xl px-3 py-2 text-xs text-white focus:outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/65 mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={tutTags}
                  onChange={(e) => setTutTags(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-white/65 mb-1">Author</label>
                <input
                  type="text"
                  maxLength={100}
                  value={tutAuthor}
                  onChange={(e) => setTutAuthor(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-white/85 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={tutRecommended}
                onChange={(e) => setTutRecommended(e.target.checked)}
                className="h-4 w-4 accent-[#c6ff1f] rounded"
              />
              <span>Pin as Featured / Recommended Tutorial</span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsTutorialModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-white/60 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#c6ff1f] hover:bg-[#d4ff4d] text-black font-bold text-xs cursor-pointer"
              >
                Save Tutorial
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Folder Add/Edit Modal */}
      {isFolderModalOpen && (
        <div
          className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setIsFolderModalOpen(false)}
        >
          <form
            onSubmit={handleSaveFolder}
            className="bg-[#121318] border border-white/15 rounded-2xl max-w-md w-full max-h-[90dvh] overflow-y-auto my-auto p-6 space-y-4 scrollbar-glass"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingFolder ? 'Edit Academy Folder' : 'New Academy Folder'}
              </h3>
              <button
                type="button"
                onClick={() => setIsFolderModalOpen(false)}
                className="text-white/40 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-white/65 mb-1">Folder Name</label>
              <input
                type="text"
                required
                maxLength={120}
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                className="w-full bg-black/40 border border-white/10 focus:border-[#c6ff1f] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-white/65 mb-1">Description</label>
              <textarea
                rows={2}
                maxLength={500}
                value={folderDesc}
                onChange={(e) => setFolderDesc(e.target.value)}
                className="w-full bg-black/40 border border-white/10 focus:border-[#c6ff1f] rounded-xl px-3 py-2 text-xs text-white focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-xs text-white/65 mb-1">Display Order</label>
              <input
                type="number"
                min={1}
                max={1000}
                value={folderOrder}
                onChange={(e) => setFolderOrder(Number(e.target.value) || 1)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsFolderModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-white/60 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#c6ff1f] hover:bg-[#d4ff4d] text-black font-bold text-xs cursor-pointer"
              >
                Save Folder
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Generic In-App Confirm Modal */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-[160] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setConfirmAction(null)}
        >
          <div
            className="bg-[#121318] border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-white">{confirmAction.title}</h3>
            <p className="text-xs text-white/65 leading-relaxed">{confirmAction.message}</p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 rounded-xl text-xs text-white/60 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const fn = confirmAction.onConfirm;
                  setConfirmAction(null);
                  await fn();
                }}
                className="px-4 py-2 rounded-xl bg-[#c6ff1f] hover:bg-[#d4ff4d] text-black font-bold text-xs cursor-pointer"
              >
                {confirmAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
