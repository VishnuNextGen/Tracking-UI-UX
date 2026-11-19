import React, { useState } from 'react';
import {
  Film,
  LayoutGrid,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Check,
  Lock,
} from 'lucide-react';
import { Logo, Wordmark } from './Logo';
import { PWAInstallButton } from './Shared/PWAInstallButton';
import { FounderConnectButton } from './Shared/FounderConnectButton';
import { signInWithGooglePopup, type FirebaseUser } from '../firebase';

interface LoginScreenProps {
  onAuthenticated?: (fbUser: FirebaseUser) => void;
  onGuestLogin?: () => void;
}

const GoogleMark: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v2.98h3.88c2.27-2.09 3.54-5.17 3.54-8.8z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-2.98c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.31c-.24-.72-.38-1.49-.38-2.31s.14-1.59.38-2.31V6.6H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.4l3.99-3.09z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.6l3.99 3.09c.95-2.85 3.6-4.94 6.72-4.94z"
    />
  </svg>
);

function formatAuthError(err: any): string {
  const code = String(err?.code || '');
  if (code === 'auth/popup-closed-by-user') {
    return 'Google sign-in window was closed before completing authentication. Click below to try again.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Your browser blocked the Google sign-in popup. Please allow popups for this site and try again.';
  }
  if (code === 'auth/cancelled-popup-request') {
    return 'A sign-in popup is already open. Please complete sign-in in that window.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'This preview domain is not yet authorized in Firebase Authentication > Settings > Authorized domains.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network connection error while reaching Google Authentication. Check your connection and retry.';
  }
  return err?.message || 'Unable to sign in with Google right now. Please try again.';
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onAuthenticated, onGuestLogin }) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setIsSigningIn(true);
    try {
      const fbUser = await signInWithGooglePopup();
      if (onAuthenticated) {
        onAuthenticated(fbUser);
      }
    } catch (err: any) {
      setErrorMsg(formatAuthError(err));
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#08090c] text-[#f3f5f8] flex flex-col relative overflow-x-hidden selection:bg-[#c6ff1f] selection:text-black">
      {/* Subtle architectural tactical pitch wireframe backdrop */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-[0.045]">
        <svg
          className="w-full h-full text-white"
          viewBox="0 0 1440 900"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
        >
          <rect x="90" y="70" width="1260" height="760" stroke="currentColor" strokeWidth="1.5" />
          <line x1="720" y1="70" x2="720" y2="830" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="720" cy="450" r="115" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="720" cy="450" r="4" fill="currentColor" />
          <rect x="90" y="250" width="190" height="400" stroke="currentColor" strokeWidth="1.5" />
          <rect x="90" y="350" width="70" height="200" stroke="currentColor" strokeWidth="1.5" />
          <rect x="1160" y="250" width="190" height="400" stroke="currentColor" strokeWidth="1.5" />
          <rect x="1280" y="350" width="70" height="200" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>

      {/* Subtle directional lime ambient wash */}
      <div
        className="pointer-events-none fixed -top-44 left-1/4 w-[560px] h-[360px] rounded-full blur-[130px] opacity-15"
        style={{ background: 'radial-gradient(circle, #c6ff1f 0%, transparent 70%)' }}
      />

      {/* Top Navigation Bar */}
      <header className="relative z-10 w-full max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 py-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Logo className="w-8 h-8 shrink-0" />
          <Wordmark className="scale-[0.72] origin-left -ml-2" />
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          <a
            href="https://www.tacstem.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/65 hover:text-white hover:bg-white/[0.04] border border-transparent hover:border-white/10 transition-colors"
          >
            <span>tacstem.com</span>
            <ExternalLink className="w-3 h-3 text-white/40" />
          </a>
          <FounderConnectButton variant="compact" />
          <PWAInstallButton />
        </div>
      </header>

      {/* Main Split Viewport */}
      <main className="relative z-10 flex-1 w-full max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 py-6 lg:py-10 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-[1.12fr_0.88fr] gap-10 lg:gap-16 items-center">
          {/* Left Column: Product Identity & Local-First Capabilities */}
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-xs font-mono uppercase tracking-[0.18em] text-[#c6ff1f]">
                FOOTBALL VIDEO ANALYSIS &amp; TACTICAL STUDIO
              </p>
              <h1
                className="text-3xl sm:text-4xl lg:text-[46px] font-extrabold tracking-tight text-white leading-[1.1]"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                Code matches faster.
                <br />
                <span className="text-white/60">Own every frame locally.</span>
              </h1>
              <p className="text-sm sm:text-base text-white/65 max-w-xl leading-relaxed">
                Tacstem combines live and post-match event coding, multi-game batch playlists, animated 2D/3D pitch boards, and hardware-accelerated telestration video export in one workspace.
              </p>
            </div>

            {/* Clean Architectural Capability Ledger */}
            <div className="border-t border-white/10 divide-y divide-white/10 max-w-xl">
              <div className="py-4 flex items-start gap-4">
                <span className="font-mono text-xs text-[#c6ff1f] pt-0.5 tabular-nums">01</span>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Film className="w-4 h-4 text-[#c6ff1f]" />
                    <span>Match Coding, Spotlights &amp; MP4 Rendering</span>
                  </div>
                  <p className="text-xs text-white/55 leading-relaxed">
                    Build custom hotkey matrices, freeze-frame tactical overlays, player trails, and export clean broadcast clips.
                  </p>
                </div>
              </div>

              <div className="py-4 flex items-start gap-4">
                <span className="font-mono text-xs text-[#c6ff1f] pt-0.5 tabular-nums">02</span>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <LayoutGrid className="w-4 h-4 text-[#c6ff1f]" />
                    <span>Animated Tactical Pitch Board &amp; Video Academy</span>
                  </div>
                  <p className="text-xs text-white/55 leading-relaxed">
                    Design multi-slide pressing structures, passing sequences, and study curated workflows in the Tacstem Academy.
                  </p>
                </div>
              </div>

              <div className="py-4 flex items-start gap-4">
                <span className="font-mono text-xs text-[#c6ff1f] pt-0.5 tabular-nums">03</span>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <ShieldCheck className="w-4 h-4 text-[#c6ff1f]" />
                    <span>100% Browser-Only Storage &amp; Portable File Backup</span>
                  </div>
                  <p className="text-xs text-white/55 leading-relaxed">
                    We do not store your videos, tags, or telestrations on any server — everything lives locally in your browser. Export your workspace to a local file anytime so you never lose data across browser resets or future app updates.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Google Authentication Card (No Guest Login) */}
          <div className="w-full max-w-md mx-auto lg:ml-auto lg:mr-0">
            <div className="bg-[#111319] border border-white/10 rounded-2xl p-7 sm:p-9 shadow-2xl">
              <div className="space-y-2 mb-7">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-white/50">
                  <Lock className="w-3.5 h-3.5 text-[#c6ff1f]" />
                  <span>Verified Account Access</span>
                </div>
                <h2
                  className="text-2xl font-bold text-white tracking-tight"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  Sign in to your workspace
                </h2>
                <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
                  Sign in with Google to launch Tacstem. New accounts automatically start on the Free plan.
                </p>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-200 leading-relaxed"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="w-full py-3.5 px-5 rounded-xl bg-white hover:bg-[#f4f6f9] active:scale-[0.99] disabled:opacity-60 text-[#0c0d10] font-semibold text-sm flex items-center justify-center gap-3 transition-all shadow-lg cursor-pointer"
              >
                {isSigningIn ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/25 border-t-black rounded-full animate-spin" />
                    <span>Connecting with Google...</span>
                  </>
                ) : (
                  <>
                    <GoogleMark className="w-5 h-5 shrink-0" />
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              {onGuestLogin && (
                <button
                  type="button"
                  onClick={onGuestLogin}
                  disabled={isSigningIn}
                  className="mt-3 w-full py-3 px-5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/15 hover:border-[#c6ff1f]/40 text-white/90 hover:text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span>Continue as Guest (Local Only)</span>
                </button>
              )}

              {/* Free Account Inclusion Summary */}
              <div className="mt-7 pt-6 border-t border-white/10 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
                  Included with every new Free account
                </p>
                <ul className="space-y-2 text-xs text-white/75">
                  <li className="flex items-center gap-2.5">
                    <Check className="w-3.5 h-3.5 text-[#c6ff1f] shrink-0" />
                    <span>1 active match video or live coding workspace</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-3.5 h-3.5 text-[#c6ff1f] shrink-0" />
                    <span>1 animated tactical pitch board</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-3.5 h-3.5 text-[#c6ff1f] shrink-0" />
                    <span>Full Tacstem Video Academy &amp; live feature alerts</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-3.5 h-3.5 text-[#c6ff1f] shrink-0" />
                    <span>Universal local data Export &amp; Import across app updates</span>
                  </li>
                </ul>
              </div>
            </div>

            <p className="mt-4 text-center text-[11px] text-amber-200/70 leading-relaxed">
              Note: We do not store your projects on servers — data lives only in your browser and may be cleared during browser resets or app updates. Remember to export backups regularly!
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};
