import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Sparkles,
  Megaphone,
  GraduationCap,
  Save,
  RotateCcw,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  DEFAULT_PLATFORM_SETTINGS,
  type PlatformSettings,
} from '../../types/admin';
import {
  getPlatformSettings,
  adminSavePlatformSettings,
} from '../../utils/userPlanStore';

export const AdminSettingsView: React.FC = () => {
  const [form, setForm] = useState<PlatformSettings>(() => getPlatformSettings());
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    const sync = () => setForm(getPlatformSettings());
    window.addEventListener('tacstem_platform_settings_updated', sync);
    return () => window.removeEventListener('tacstem_platform_settings_updated', sync);
  }, []);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);
    try {
      const saved = await adminSavePlatformSettings({
        freeMaxVideoProjects: form.freeMaxVideoProjects,
        freeMaxBoardProjects: form.freeMaxBoardProjects,
        freeAllowBatches: form.freeAllowBatches,
        allowInstantFreeUpgrade: form.allowInstantFreeUpgrade,
        announcementEnabled: form.announcementEnabled,
        announcementText: form.announcementText,
        announcementLink: form.announcementLink,
        academyTitle: form.academyTitle,
        academySubtitle: form.academySubtitle,
        supportContactAddress: form.supportContactAddress,
        founderLinkedInUrl: form.founderLinkedInUrl,
      });
      setForm(saved);
      showFeedback('success', 'Platform settings saved to Firestore and synced live across all users.');
    } catch (err: any) {
      showFeedback('error', err?.message || 'Failed to save platform settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    setIsSaving(true);
    try {
      const saved = await adminSavePlatformSettings(DEFAULT_PLATFORM_SETTINGS);
      setForm(saved);
      showFeedback('success', 'Platform settings restored to defaults.');
    } catch (err: any) {
      showFeedback('error', err?.message || 'Failed to reset platform settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/35 text-emerald-200'
              : 'bg-red-950/60 border-red-500/35 text-red-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Free Tier Quotas */}
        <section className="bg-[#121318] border border-white/10 rounded-2xl p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-[#c6ff1f]/10 text-[#c6ff1f] border border-[#c6ff1f]/25">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Free Account Quotas</h3>
              <p className="text-xs text-white/55 mt-0.5">
                Configure local workspace limits enforced for all Free-tier Google accounts.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1.5">
                Max Video / Live Projects
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={form.freeMaxVideoProjects}
                onChange={(e) =>
                  setForm({
                    ...form,
                    freeMaxVideoProjects: Math.max(1, Math.min(50, Number(e.target.value) || 1)),
                  })
                }
                className="w-full bg-black/40 border border-white/10 focus:border-[#c6ff1f] rounded-xl px-3.5 py-2 text-sm text-white font-mono tabular-nums focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/70 mb-1.5">
                Max Tactical Pitch Boards
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={form.freeMaxBoardProjects}
                onChange={(e) =>
                  setForm({
                    ...form,
                    freeMaxBoardProjects: Math.max(1, Math.min(50, Number(e.target.value) || 1)),
                  })
                }
                className="w-full bg-black/40 border border-white/10 focus:border-[#c6ff1f] rounded-xl px-3.5 py-2 text-sm text-white font-mono tabular-nums focus:outline-none"
              />
            </div>
          </div>

          <label className="flex items-start justify-between gap-4 pt-3 border-t border-white/10 cursor-pointer">
            <div>
              <div className="text-xs font-semibold text-white">
                Allow Multi-Game Batches on Free Plan
              </div>
              <p className="text-[11px] text-white/50 mt-0.5">
                When disabled, multi-match batch playlists require a Pro promotion.
              </p>
            </div>
            <input
              type="checkbox"
              checked={form.freeAllowBatches}
              onChange={(e) => setForm({ ...form, freeAllowBatches: e.target.checked })}
              className="mt-1 h-4 w-4 accent-[#c6ff1f] rounded cursor-pointer"
            />
          </label>
        </section>

        {/* 2. Pro Promotion & Upgrade Flow */}
        <section className="bg-[#121318] border border-white/10 rounded-2xl p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Upgrade &amp; Promotion Policy</h3>
              <p className="text-xs text-white/55 mt-0.5">
                Control whether Free users require Admin approval or can self-claim community Pro.
              </p>
            </div>
          </div>

          <label className="flex items-start justify-between gap-4 p-3.5 rounded-xl bg-white/[0.03] border border-white/10 cursor-pointer">
            <div>
              <div className="text-xs font-semibold text-white">
                Allow Instant Self-Claim Pro Upgrade
              </div>
              <p className="text-[11px] text-white/55 mt-0.5 leading-relaxed">
                Enforced directly by Firestore Security Rules. Keep OFF so Free users submit Upgrade Requests for your review in the Users &amp; Promotions tab.
              </p>
            </div>
            <input
              type="checkbox"
              checked={form.allowInstantFreeUpgrade}
              onChange={(e) => setForm({ ...form, allowInstantFreeUpgrade: e.target.checked })}
              className="mt-1 h-4 w-4 accent-[#c6ff1f] rounded cursor-pointer"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">
                Founder Contact Address
              </label>
              <input
                type="email"
                value={form.supportContactAddress}
                onChange={(e) => setForm({ ...form, supportContactAddress: e.target.value })}
                placeholder="pvvishnupscaspirant@gmail.com"
                className="w-full bg-black/40 border border-white/10 focus:border-[#c6ff1f] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">
                Founder LinkedIn URL
              </label>
              <input
                type="url"
                value={form.founderLinkedInUrl}
                onChange={(e) => setForm({ ...form, founderLinkedInUrl: e.target.value })}
                placeholder="https://www.linkedin.com/in/..."
                className="w-full bg-black/40 border border-white/10 focus:border-[#c6ff1f] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* 3. Global Dashboard Banner */}
        <section className="bg-[#121318] border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/25">
                <Megaphone className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Dashboard Announcement Banner</h3>
                <p className="text-xs text-white/55 mt-0.5">
                  Pin an important notice or release note across the top of all user dashboards.
                </p>
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-white/80 cursor-pointer">
              <input
                type="checkbox"
                checked={form.announcementEnabled}
                onChange={(e) => setForm({ ...form, announcementEnabled: e.target.checked })}
                className="h-4 w-4 accent-[#c6ff1f] rounded cursor-pointer"
              />
              <span>Active</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">
              Banner Text (max 300 chars)
            </label>
            <input
              type="text"
              maxLength={300}
              value={form.announcementText}
              onChange={(e) => setForm({ ...form, announcementText: e.target.value })}
              placeholder="e.g. New 3D Pitch Animation keyframes & Academy masterclasses are now live!"
              className="w-full bg-black/40 border border-white/10 focus:border-[#c6ff1f] rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">
              Optional Action Link or URL
            </label>
            <input
              type="text"
              maxLength={300}
              value={form.announcementLink}
              onChange={(e) => setForm({ ...form, announcementLink: e.target.value })}
              placeholder="e.g. tutorials or https://www.tacstem.com"
              className="w-full bg-black/40 border border-white/10 focus:border-[#c6ff1f] rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none"
            />
          </div>
        </section>

        {/* 4. Academy Header Branding */}
        <section className="bg-[#121318] border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/25">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Academy Branding</h3>
              <p className="text-xs text-white/55 mt-0.5">
                Customize the Video Academy header title and subtitle displayed to users.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">Academy Title</label>
            <input
              type="text"
              maxLength={120}
              required
              value={form.academyTitle}
              onChange={(e) => setForm({ ...form, academyTitle: e.target.value })}
              className="w-full bg-black/40 border border-white/10 focus:border-[#c6ff1f] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">
              Academy Subtitle
            </label>
            <input
              type="text"
              maxLength={300}
              value={form.academySubtitle}
              onChange={(e) => setForm({ ...form, academySubtitle: e.target.value })}
              className="w-full bg-black/40 border border-white/10 focus:border-[#c6ff1f] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
            />
          </div>
        </section>
      </div>

      {/* Footer Save Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={handleResetDefaults}
          disabled={isSaving}
          className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/75 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Settings to Defaults</span>
        </button>

        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2.5 rounded-xl bg-[#c6ff1f] hover:bg-[#d4ff4d] disabled:opacity-50 text-black font-bold text-xs flex items-center gap-2 shadow-lg shadow-[#c6ff1f]/20 transition-all cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving to Firestore...' : 'Save Platform Settings'}</span>
        </button>
      </div>
    </form>
  );
};
