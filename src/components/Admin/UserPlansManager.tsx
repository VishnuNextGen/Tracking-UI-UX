import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  ShieldCheck,
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Search,
  User,
  Clock,
  Download,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import {
  getAllUsers,
  getCurrentUser,
  updateUserPlan,
  isUserAdmin,
  resolveWatermarkTier,
  saveUserProfile,
  deleteUserProfile,
  syncAdminUserEntitlements,
  fetchPendingUpgradeRequests,
  adminResolveUpgradeRequest,
} from '../../utils/userPlanStore';
import { isBootstrappedAdminEmail } from '../../firebase';
import { removeLocalCachedUserStats } from '../../utils/telemetryStore';
import {
  USER_PERSONA_OPTIONS,
  formatUserPersonas,
  type UserProfile,
  type UserPlan,
  type UserPersona,
} from '../../types/user';
import type { UpgradeRequestRecord } from '../../types/admin';
import { WatermarkPreviewCard } from '../Shared/WatermarkPreviewCard';

interface UserPlansManagerProps {
  onPlanChanged?: (user: UserProfile) => void;
  videoProjectsCount?: number;
  boardProjectsCount?: number;
}

export const UserPlansManager: React.FC<UserPlansManagerProps> = ({
  onPlanChanged,
}) => {
  const [users, setUsers] = useState<UserProfile[]>(() => getAllUsers());
  const [currentUser, setCurrentUserState] = useState<UserProfile>(() => getCurrentUser());
  const [upgradeRequests, setUpgradeRequests] = useState<UpgradeRequestRecord[]>([]);
  const [resolvingReqId, setResolvingReqId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlan, setFilterPlan] = useState<'all' | 'free' | 'pro' | 'admin'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal for Pre-Provision / Edit User Entitlement
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPlan, setFormPlan] = useState<UserPlan>('free');
  const [formPersonas, setFormPersonas] = useState<UserPersona[]>(['analyst']);
  const [formNotes, setFormNotes] = useState('');

  // In-app confirmation modals (zero window.confirm)
  const [demoteConfirmUser, setDemoteConfirmUser] = useState<UserProfile | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserProfile | null>(null);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const loadEntitlementsAndRequests = async (forceFull = false) => {
    setIsSyncing(true);
    try {
      const [syncedUsers, pendingReqs] = await Promise.all([
        syncAdminUserEntitlements(forceFull),
        fetchPendingUpgradeRequests(),
      ]);
      setUsers(syncedUsers);
      setUpgradeRequests(pendingReqs);
      setCurrentUserState(getCurrentUser());
      window.dispatchEvent(new CustomEvent('tacstem_admin_counts_changed'));
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    setCurrentUserState(getCurrentUser());
    loadEntitlementsAndRequests(false).catch(() => {});
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleTogglePlan = (user: UserProfile) => {
    if (user.plan === 'pro') {
      setDemoteConfirmUser(user);
    } else {
      const updated = updateUserPlan(user.id, 'pro', 'Promoted to Pro plan via Admin Console');
      setUsers(getAllUsers());
      showToast(`Promoted "${user.displayName}" to PRO Account.`);
      if (onPlanChanged && getCurrentUser().id === updated.id) {
        onPlanChanged(updated);
      }
    }
  };

  const handleConfirmDemote = () => {
    if (!demoteConfirmUser) return;
    const updated = updateUserPlan(
      demoteConfirmUser.id,
      'free',
      'Demoted to Free Account by Admin. Liberal policy active: existing local projects remain accessible.'
    );
    setDemoteConfirmUser(null);
    setUsers(getAllUsers());
    showToast(`Changed "${updated.displayName}" to FREE Account (zero data loss policy active).`);
    if (onPlanChanged && getCurrentUser().id === updated.id) {
      onPlanChanged(updated);
    }
  };

  const handleResolveRequest = async (
    req: UpgradeRequestRecord,
    decision: 'approved' | 'declined'
  ) => {
    setResolvingReqId(req.userId);
    try {
      await adminResolveUpgradeRequest(
        req,
        decision,
        decision === 'approved'
          ? 'Approved via Admin Console Upgrade Queue'
          : 'Declined via Admin Console'
      );
      setUpgradeRequests((prev) => prev.filter((item) => item.userId !== req.userId));
      const refreshedUsers = await syncAdminUserEntitlements(false);
      setUsers(refreshedUsers);
      window.dispatchEvent(new CustomEvent('tacstem_admin_counts_changed'));
      showToast(
        decision === 'approved'
          ? `Approved & promoted "${req.displayName}" to PRO Account!`
          : `Declined upgrade request from "${req.displayName}".`
      );
    } catch (err: any) {
      showToast(err?.message || 'Failed to resolve upgrade request.');
    } finally {
      setResolvingReqId(null);
    }
  };

  const openNewUserModal = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormPlan('free');
    setFormPersonas(['analyst']);
    setFormNotes('');
    setIsModalOpen(true);
  };

  const openEditUserModal = (u: UserProfile) => {
    setEditingUser(u);
    setFormName(u.displayName);
    setFormEmail(u.email);
    setFormPlan(u.plan);
    setFormPersonas(u.personas && u.personas.length > 0 ? u.personas : ['analyst']);
    setFormNotes(u.notes || '');
    setIsModalOpen(true);
  };

  const toggleFormPersona = (p: UserPersona) => {
    setFormPersonas((prev) => {
      if (prev.includes(p)) {
        const next = prev.filter((x) => x !== p);
        return next.length > 0 ? next : [p];
      }
      return [...prev, p];
    });
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) return;

    const email = formEmail.trim();
    // Admin privilege is strictly restricted to verified system root admins
    const isRootAdmin = isBootstrappedAdminEmail(email) || (editingUser ? isUserAdmin(editingUser) : false);

    const saved = saveUserProfile({
      id: editingUser ? editingUser.id : undefined,
      displayName: formName.trim(),
      email,
      personas: formPersonas,
      plan: formPlan,
      isAdmin: isRootAdmin,
      notes: formNotes.trim(),
    });

    setIsModalOpen(false);
    setUsers(getAllUsers());
    showToast(
      editingUser
        ? `Updated entitlement for "${saved.displayName}".`
        : `Created entitlement for "${saved.displayName}" (${saved.plan.toUpperCase()}).`
    );
    if (onPlanChanged && getCurrentUser().id === saved.id) {
      onPlanChanged(saved);
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmUser) return;
    const deletedId = deleteConfirmUser.id;
    const deletedName = deleteConfirmUser.displayName;
    deleteUserProfile(deletedId);
    removeLocalCachedUserStats(deletedId);
    setDeleteConfirmUser(null);
    setUsers(getAllUsers());
    window.dispatchEvent(new CustomEvent('tacstem_admin_counts_changed'));
    showToast(`Removed entitlement record for "${deletedName}".`);
  };

  const handleExportUsersCsv = () => {
    const headers = ['User ID', 'Display Name', 'Email', 'Plan', 'Admin', 'Personas', 'Created', 'Notes'];
    const escapeCell = (val: string) =>
      val.includes(',') || val.includes('"') || val.includes('\n')
        ? `"${val.replace(/"/g, '""')}"`
        : val;
    const rows = users.map((u) =>
      [
        u.id,
        u.displayName,
        u.email,
        u.plan.toUpperCase(),
        isUserAdmin(u) ? 'YES' : 'NO',
        formatUserPersonas(u.personas),
        new Date(u.createdAt).toISOString(),
        u.notes || '',
      ]
        .map((x) => escapeCell(String(x)))
        .join(',')
    );
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tacstem-users-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const pendingRequests = useMemo(
    () => upgradeRequests.filter((r) => r.status === 'pending'),
    [upgradeRequests]
  );

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const personaLabel = formatUserPersonas(u.personas).toLowerCase();
      const matchesSearch =
        !q ||
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        personaLabel.includes(q) ||
        (u.notes && u.notes.toLowerCase().includes(q));

      const matchesPlan =
        filterPlan === 'all'
          ? true
          : filterPlan === 'admin'
          ? isUserAdmin(u)
          : u.plan === filterPlan;

      return matchesSearch && matchesPlan;
    });
  }, [users, searchQuery, filterPlan]);

  const freeCount = users.filter((u) => u.plan === 'free').length;
  const proCount = users.filter((u) => u.plan === 'pro').length;
  const adminCount = users.filter((u) => isUserAdmin(u)).length;

  return (
    <div className="space-y-6">
      {/* Feedback Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3.5 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-xl"
          >
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-emerald-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-[#121318] border border-white/10 rounded-xl p-4">
          <div className="text-[11px] text-white/50 font-medium">Authenticated Users</div>
          <div className="text-2xl font-extrabold text-white mt-1 font-mono tabular-nums">
            {users.length}
          </div>
          <div className="text-[11px] text-white/40 mt-0.5">Google Auth accounts</div>
        </div>

        <div className="bg-[#121318] border border-white/10 rounded-xl p-4">
          <div className="text-[11px] text-white/50 font-medium">Pro Accounts</div>
          <div className="text-2xl font-extrabold text-[#c6ff1f] mt-1 font-mono tabular-nums">
            {proCount}
          </div>
          <div className="text-[11px] text-white/40 mt-0.5">Unlimited workspaces</div>
        </div>

        <div className="bg-[#121318] border border-white/10 rounded-xl p-4">
          <div className="text-[11px] text-white/50 font-medium">Free Starter Accounts</div>
          <div className="text-2xl font-extrabold text-amber-300 mt-1 font-mono tabular-nums">
            {freeCount}
          </div>
          <div className="text-[11px] text-white/40 mt-0.5">Default tier on sign-in</div>
        </div>

        <div className="bg-[#121318] border border-white/10 rounded-xl p-4">
          <div className="text-[11px] text-white/50 font-medium">Pending Upgrade Requests</div>
          <div className="text-2xl font-extrabold text-emerald-400 mt-1 font-mono tabular-nums">
            {pendingRequests.length}
          </div>
          <div className="text-[11px] text-white/40 mt-0.5">{adminCount} Admin(s) active</div>
        </div>
      </div>

      {/* Live Pending Pro Upgrade Requests Queue */}
      {pendingRequests.length > 0 && (
        <div className="bg-[#121318] border border-[#c6ff1f]/35 rounded-2xl p-5 space-y-3.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#c6ff1f]" />
              <h3 className="text-sm font-bold text-white">
                Pending Pro Upgrade Requests ({pendingRequests.length})
              </h3>
            </div>
            <span className="text-[11px] text-white/50">
              1-click approval promotes user in real time
            </span>
          </div>

          <div className="divide-y divide-white/10">
            {pendingRequests.map((req) => (
              <div
                key={req.userId}
                className="py-3 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white">{req.displayName}</span>
                    <span className="text-xs text-white/50 font-mono">{req.email}</span>
                    {req.organization && (
                      <span className="text-[11px] text-[#c6ff1f] bg-[#c6ff1f]/10 px-2 py-0.5 rounded">
                        {req.organization}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/75 leading-relaxed">{req.message}</p>
                  <div className="text-[10px] text-white/40 font-mono tabular-nums">
                    Requested {new Date(req.createdAtMs).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={resolvingReqId === req.userId}
                    onClick={() => handleResolveRequest(req, 'declined')}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-red-500/15 border border-white/10 hover:border-red-500/30 text-white/70 hover:text-red-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Decline</span>
                  </button>
                  <button
                    type="button"
                    disabled={resolvingReqId === req.userId}
                    onClick={() => handleResolveRequest(req, 'approved')}
                    className="px-3.5 py-1.5 rounded-lg bg-[#c6ff1f] hover:bg-[#d4ff4d] text-black text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve &amp; Promote to Pro</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search, Filter & Actions Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, email, persona, notes..."
              className="w-full bg-[#121318] border border-white/10 focus:border-[#c6ff1f] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-white/35 focus:outline-none"
            />
          </div>

          <div className="flex items-center bg-[#121318] border border-white/10 rounded-xl p-1 gap-0.5">
            {(['all', 'pro', 'free', 'admin'] as const).map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => setFilterPlan(tier)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                  filterPlan === tier
                    ? 'bg-[#c6ff1f] text-black'
                    : 'text-white/55 hover:text-white'
                }`}
              >
                {tier}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadEntitlementsAndRequests(false)}
            disabled={isSyncing}
            title="Fetch latest changed accounts & pending upgrade requests (delta sync)"
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/80 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#c6ff1f]' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportUsersCsv}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/80 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={openNewUserModal}
            className="px-3.5 py-2 rounded-xl bg-[#c6ff1f] hover:bg-[#d4ff4d] text-black text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Entitlement</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-[#121318] border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-semibold uppercase tracking-wider text-white/45">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Personas</th>
                <th className="py-3 px-4">Plan &amp; Export Tier</th>
                <th className="py-3 px-4">Joined</th>
                <th className="py-3 px-4 text-right">Promotions &amp; Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06] text-xs">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-white/45">
                    No matching Google-authenticated accounts found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const uIsAdmin = isUserAdmin(u);
                  const wmTier = resolveWatermarkTier(u);
                  const isMe = currentUser.id === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden shrink-0">
                            {u.avatarUrl ? (
                              <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-4 h-4 text-[#c6ff1f]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 font-semibold text-white">
                              <span className="truncate">{u.displayName}</span>
                              {isMe && (
                                <span className="text-[10px] font-mono text-[#c6ff1f]">(You)</span>
                              )}
                            </div>
                            <div className="text-[11px] text-white/45 font-mono truncate">
                              {u.email}
                            </div>
                            {u.notes && (
                              <div className="text-[11px] text-white/40 truncate max-w-xs mt-0.5">
                                {u.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-white/75">
                        {formatUserPersonas(u.personas) || 'Analyst'}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[11px] font-bold uppercase ${
                                u.plan === 'pro' ? 'text-[#c6ff1f]' : 'text-amber-300'
                              }`}
                            >
                              {u.plan === 'pro' ? 'PRO PLAN' : 'FREE PLAN'}
                            </span>
                            {uIsAdmin && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                Admin
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-white/40 font-mono">
                            Watermark: {wmTier === 'none' ? 'Clean Master' : wmTier.toUpperCase()}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-white/50 font-mono tabular-nums whitespace-nowrap">
                        {new Date(u.createdAt).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleTogglePlan(u)}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                              u.plan === 'free'
                                ? 'bg-[#c6ff1f] hover:bg-[#d4ff4d] text-black'
                                : 'bg-white/5 hover:bg-amber-500/15 border border-white/10 text-white/80 hover:text-amber-300'
                            }`}
                          >
                            {u.plan === 'free' ? 'Promote to Pro' : 'Set Free'}
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditUserModal(u)}
                            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            title="Edit entitlement & notes"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {!isMe && (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmUser(u)}
                              className="p-1.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                              title="Remove user entitlement"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Watermark Tier Visual Reference */}
      <WatermarkPreviewCard tier={resolveWatermarkTier(currentUser)} />

      {/* Demotion Confirmation Modal */}
      {demoteConfirmUser && (
        <div
          className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDemoteConfirmUser(null)}
        >
          <div
            className="bg-[#121318] border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 text-amber-400 font-bold text-sm">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>Move {demoteConfirmUser.displayName} to Free Plan?</span>
            </div>
            <p className="text-xs text-white/70 leading-relaxed">
              Under Tacstem's Liberal Demotion Policy, none of {demoteConfirmUser.displayName}'s local match projects or tactical boards will be deleted. Only new project creation is paused while over the Free quota.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDemoteConfirmUser(null)}
                className="px-4 py-2 rounded-xl text-xs text-white/60 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDemote}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs cursor-pointer"
              >
                Confirm Free Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Entitlement Confirmation Modal */}
      {deleteConfirmUser && (
        <div
          className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDeleteConfirmUser(null)}
        >
          <div
            className="bg-[#121318] border border-red-500/30 rounded-2xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-white">
              Remove entitlement record for "{deleteConfirmUser.displayName}"?
            </h3>
            <p className="text-xs text-white/65 leading-relaxed">
              This removes their Firestore entitlement and admin grant. If they sign in with Google again later, a fresh Free-plan account record will be created.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                className="px-4 py-2 rounded-xl text-xs text-white/60 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-xs cursor-pointer"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Entitlement Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setIsModalOpen(false)}
        >
          <form
            onSubmit={handleSaveUser}
            className="bg-[#121318] border border-white/15 rounded-2xl max-w-md w-full max-h-[90dvh] overflow-y-auto my-auto p-6 space-y-4 scrollbar-glass"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingUser ? 'Edit User Entitlement' : 'Add User Entitlement'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-white/40 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-white/65 mb-1">Display Name</label>
              <input
                type="text"
                required
                maxLength={120}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full bg-black/40 border border-white/10 focus:border-[#c6ff1f] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-white/65 mb-1">Google Email</label>
              <input
                type="email"
                required
                disabled={Boolean(editingUser)}
                maxLength={254}
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                className="w-full bg-black/40 border border-white/10 disabled:opacity-50 focus:border-[#c6ff1f] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-white/65 mb-1.5">Personas</label>
              <div className="flex flex-wrap gap-2">
                {USER_PERSONA_OPTIONS.map((opt) => {
                  const selected = formPersonas.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleFormPersona(opt.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        selected
                          ? 'bg-[#c6ff1f]/15 border-[#c6ff1f]/40 text-[#c6ff1f]'
                          : 'bg-white/5 border-white/10 text-white/60'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/65 mb-1">Account Plan</label>
                <select
                  value={formPlan}
                  onChange={(e) => setFormPlan(e.target.value as UserPlan)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="free" className="bg-[#121318]">
                    Free Plan
                  </option>
                  <option value="pro" className="bg-[#121318]">
                    Pro Plan
                  </option>
                </select>
              </div>

              <div className="flex flex-col justify-end pb-1">
                <span className="text-[11px] text-white/50 mb-1">Administrative Role</span>
                {isBootstrappedAdminEmail(formEmail) || (editingUser && isUserAdmin(editingUser)) ? (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Root Administrator</span>
                  </div>
                ) : (
                  <div className="text-[11px] text-white/45 flex items-center gap-1">
                    <span>Standard User (Admin protected)</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs text-white/65 mb-1">Admin Notes</label>
              <textarea
                rows={2}
                maxLength={1000}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Club, cohort, scholarship reason..."
                className="w-full bg-black/40 border border-white/10 focus:border-[#c6ff1f] rounded-xl px-3 py-2 text-xs text-white focus:outline-none resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-white/60 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#c6ff1f] hover:bg-[#d4ff4d] text-black font-bold text-xs cursor-pointer"
              >
                Save Entitlement
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
