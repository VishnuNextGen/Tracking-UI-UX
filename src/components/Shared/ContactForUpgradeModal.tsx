import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Mail,
  ExternalLink,
  X,
  Check,
  Copy,
  Zap,
  CheckCircle2,
  Send,
  Clock,
  AlertCircle,
} from 'lucide-react';
import type { UserProfile } from '../../types/user';
import type { UpgradeRequestRecord } from '../../types/admin';
import { FOUNDER_LINKEDIN_URL, LinkedInIcon } from './FounderConnectButton';
import {
  updateUserPlan,
  submitProUpgradeRequest,
  subscribeMyUpgradeRequest,
  getPlatformSettings,
} from '../../utils/userPlanStore';

export const FOUNDER_EMAIL = 'pvvishnupscaspirant@gmail.com';

interface ContactForUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserProfile | null;
  onUpgraded?: () => void;
}

export const ContactForUpgradeModal: React.FC<ContactForUpgradeModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpgraded,
}) => {
  const [copied, setCopied] = useState(false);
  const [organization, setOrganization] = useState('');
  const [requestNote, setRequestNote] = useState(
    'Coaching & match video analysis — requesting complimentary Pro plan access.'
  );
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [existingRequest, setExistingRequest] = useState<UpgradeRequestRecord | null>(null);

  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);
  const [settings, setSettings] = useState(() => getPlatformSettings());

  useEffect(() => {
    if (!isOpen) return;
    setSettings(getPlatformSettings());
    const onSettingsChange = () => setSettings(getPlatformSettings());
    window.addEventListener('tacstem_platform_settings_updated', onSettingsChange);
    return () => window.removeEventListener('tacstem_platform_settings_updated', onSettingsChange);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !currentUser?.id || currentUser.id === 'unauthenticated') return;
    const unsub = subscribeMyUpgradeRequest(currentUser.id, (req) => {
      setExistingRequest(req);
      if (req?.organization) setOrganization(req.organization);
      if (req?.message) setRequestNote(req.message);
    });
    return () => unsub();
  }, [isOpen, currentUser?.id]);

  if (!isOpen) return null;

  const contactEmail = settings.supportContactAddress || FOUNDER_EMAIL;
  const linkedInUrl = settings.founderLinkedInUrl || FOUNDER_LINKEDIN_URL;

  const defaultMsg = `Hi Vishnu! I'm using Tacstem for football analysis and would love to request a complimentary Pro upgrade for my account (${currentUser?.email || 'my account'}). Thank you!`;

  const mailtoUrl = `mailto:${contactEmail}?subject=${encodeURIComponent(
    'Tacstem Pro Upgrade Request'
  )}&body=${encodeURIComponent(
    `Hi Vishnu,\n\nI'm using Tacstem and would love to request a Pro plan upgrade for my account.\n\nName: ${currentUser?.displayName || 'User'}\nEmail: ${currentUser?.email || ''}\nClub / Role: ${organization || 'Football Analysis'}\n\nThank you!`
  )}`;

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(defaultMsg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleSendUpgradeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestNote.trim()) return;
    setSubmitError(null);
    setIsSubmittingRequest(true);
    try {
      const saved = await submitProUpgradeRequest({
        organization: organization.trim(),
        message: requestNote.trim(),
      });
      setExistingRequest(saved);
    } catch (err: any) {
      setSubmitError(err?.message || 'Could not submit upgrade request. Please try again.');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleInstantUpgrade = () => {
    if (!currentUser?.id || !settings.allowInstantFreeUpgrade) return;
    setIsUpgrading(true);
    setTimeout(() => {
      try {
        updateUserPlan(currentUser.id, 'pro', 'Claimed community Pro upgrade');
        setUpgradeSuccess(true);
        if (onUpgraded) {
          onUpgraded();
        }
        setTimeout(() => {
          onClose();
        }, 1200);
      } catch (e) {
        console.error(e);
      } finally {
        setIsUpgrading(false);
      }
    }, 300);
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.18 }}
          className="bg-[#121318] border border-white/15 rounded-2xl shadow-2xl max-w-lg w-full p-6 text-left relative overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#c6ff1f]" />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-3.5 mb-4">
            <div className="p-2.5 rounded-xl shrink-0 bg-[#c6ff1f]/15 text-[#c6ff1f] border border-[#c6ff1f]/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#c6ff1f]">
                Pro Account Upgrade
              </span>
              <h2 className="text-lg font-bold text-white mt-0.5">
                Request Pro Workspace Access
              </h2>
            </div>
          </div>

          {/* Perks */}
          <div className="p-3 bg-white/[0.03] border border-white/10 rounded-xl mb-4 grid grid-cols-2 gap-2 text-xs text-white/85">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#c6ff1f] shrink-0" />
              <span>Unlimited Match Projects</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#c6ff1f] shrink-0" />
              <span>Multi-Game Batches</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#c6ff1f] shrink-0" />
              <span>Unlimited Tactical Boards</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#c6ff1f] shrink-0" />
              <span>Pro Broadcast Exports</span>
            </div>
          </div>

          {/* In-App Admin Queue Request Form */}
          {existingRequest?.status === 'pending' ? (
            <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-400/30 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <Clock className="w-4 h-4 shrink-0" />
                <span>Upgrade Request Pending Admin Review</span>
              </div>
              <p className="text-xs text-white/70 leading-relaxed">
                Your request for <span className="text-white font-medium">{currentUser?.email}</span> has been sent to the Admin Console. Your plan will automatically switch to Pro in real time once approved.
              </p>
            </div>
          ) : existingRequest?.status === 'approved' ? (
            <div className="mb-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-300 font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Your Pro upgrade has been approved! Unlimited workspaces are unlocked.</span>
            </div>
          ) : (
            <form onSubmit={handleSendUpgradeRequest} className="space-y-3 mb-4">
              {existingRequest?.status === 'declined' && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-200">
                  Previous request note: {existingRequest.adminNote || 'Declined by administrator.'} You may submit an updated request below.
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium text-white/60 mb-1">
                  Club, Academy, or Role (optional)
                </label>
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  maxLength={160}
                  placeholder="e.g. U19 Head Analyst / Coaching Staff"
                  className="w-full bg-black/40 border border-white/10 focus:border-[#c6ff1f]/60 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-white/60 mb-1">
                  How are you using Tacstem?
                </label>
                <textarea
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  maxLength={1000}
                  rows={2}
                  required
                  className="w-full bg-black/40 border border-white/10 focus:border-[#c6ff1f]/60 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none resize-none"
                />
              </div>

              {submitError && (
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-red-200">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingRequest}
                className="w-full py-2.5 px-4 rounded-xl bg-[#c6ff1f] hover:bg-[#d4ff4d] disabled:opacity-50 text-black font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {isSubmittingRequest ? 'Sending Request...' : 'Send Pro Upgrade Request to Admin'}
                </span>
              </button>
            </form>
          )}

          {/* Direct Founder Contact Channels */}
          <div className="space-y-2 pt-3 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-white/50">
                Or message founder Vishnu P V directly:
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[11px] text-white/60 hover:text-white inline-flex items-center gap-1 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-[#c6ff1f]" />
                    <span className="text-[#c6ff1f]">Copied note</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy note</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <a
                href={linkedInUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-[#0A66C2]/15 hover:bg-[#0A66C2]/25 border border-sky-400/30 text-sky-300 hover:text-white text-xs font-semibold flex items-center justify-between gap-2 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <LinkedInIcon className="w-4 h-4 text-[#38bdf8] shrink-0" />
                  <span>Chat on LinkedIn</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-sky-400/60 shrink-0" />
              </a>

              <a
                href={mailtoUrl}
                className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/90 hover:text-white text-xs font-semibold flex items-center justify-between gap-2 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Email Founder</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-white/40 shrink-0" />
              </a>
            </div>
          </div>

          {/* Optional Instant Self-Claim ONLY when enabled by Admin in Platform Settings */}
          {settings.allowInstantFreeUpgrade && (
            <div className="mt-4 pt-3 border-t border-white/10">
              {upgradeSuccess ? (
                <div className="p-2.5 rounded-xl bg-[#c6ff1f]/15 border border-[#c6ff1f]/40 flex items-center justify-center gap-2 text-xs font-bold text-[#c6ff1f]">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Community Pro Upgrade Activated!</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleInstantUpgrade}
                  disabled={isUpgrading}
                  className="w-full py-2 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-[#c6ff1f]/40 text-[#c6ff1f] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>
                    {isUpgrading ? 'Activating...' : 'Claim Instant Community Pro Offer'}
                  </span>
                </button>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
