import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Download, Monitor, X, ExternalLink, HelpCircle, Check, Smartphone } from 'lucide-react';

export interface PWAInstallButtonProps {
  className?: string;
  variant?: 'navbar' | 'compact' | 'board' | 'workspace' | 'login';
  showGuideTrigger?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'navbar',
  showGuideTrigger = true,
}) => {
  const { isInstallable, isInstalled, isIOS, isIframe, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  // If already running as an installed PWA (standalone window), don't show the install button
  if (isInstalled && !justInstalled) {
    return null;
  }

  const handleInstallClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 1. If native beforeinstallprompt is ready and supported, trigger it directly!
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') {
        setJustInstalled(true);
        setTimeout(() => setJustInstalled(false), 5000);
      } else if (outcome === 'unavailable') {
        // Native prompt could not be triggered (e.g. security policy / iframe), show the guide
        setShowGuide(true);
      }
    } else {
      // 2. If browser doesn't support programmatic prompt (iOS Safari, Firefox, iframe preview), show current popup guide
      setShowGuide(true);
    }
  };

  const handleOpenDirect = () => {
    try {
      window.open(window.location.href, '_blank');
    } catch {
      // fallback
    }
  };

  // Render variant styles
  const renderButtonContent = () => {
    if (justInstalled) {
      return (
        <span className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
          <Check className="w-3.5 h-3.5" />
          <span>App Installed!</span>
        </span>
      );
    }

    if (variant === 'compact' || variant === 'workspace') {
      return (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleInstallClick}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all border cursor-pointer ${
              isInstallable
                ? 'bg-[#c6ff1f]/15 hover:bg-[#c6ff1f]/25 border-[#c6ff1f]/40 text-[#c6ff1f] hover:text-white shadow-xs'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-300 hover:text-white'
            } ${className}`}
            title="Install Tacstem application directly to your desktop or device"
          >
            <Download className="w-3.5 h-3.5 text-[#c6ff1f]" />
            <span className="hidden sm:inline">Install App</span>
          </button>
          {showGuideTrigger && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowGuide(true);
              }}
              className="p-1 text-gray-400 hover:text-[#c6ff1f] transition-colors rounded hover:bg-white/5"
              title="How to install / instructions"
              aria-label="Installation guide"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      );
    }

    if (variant === 'board') {
      return (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleInstallClick}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
              isInstallable
                ? 'bg-[#c0fa4a]/15 hover:bg-[#c0fa4a]/25 border-[#c0fa4a]/30 text-[#c0fa4a] hover:text-white'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white'
            } ${className}`}
            title="Install Tacstem application"
          >
            <Download className="w-3.5 h-3.5 text-[#c0fa4a]" />
            <span className="hidden sm:inline">Install App</span>
          </button>
          {showGuideTrigger && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowGuide(true);
              }}
              className="p-1 text-slate-400 hover:text-[#c0fa4a] transition-colors rounded hover:bg-white/5"
              title="How to install / instructions"
              aria-label="Installation guide"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      );
    }

    if (variant === 'login') {
      return (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleInstallClick}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all border cursor-pointer ${
              isInstallable
                ? 'bg-[#c6ff1f]/20 hover:bg-[#c6ff1f]/30 border-[#c6ff1f]/40 text-[#c6ff1f] hover:text-white shadow-[0_0_15px_rgba(198,255,31,0.15)]'
                : 'bg-white/10 hover:bg-white/15 border-white/15 text-white'
            } ${className}`}
            title="Install Tacstem application directly to your desktop or device"
          >
            <Download className="w-4 h-4 text-[#c6ff1f]" />
            <span>Install Tacstem</span>
          </button>
          {showGuideTrigger && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowGuide(true);
              }}
              className="p-2 text-gray-400 hover:text-white transition-colors rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
              title="Installation Guide"
              aria-label="Installation guide"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      );
    }

    // Default 'navbar'
    return (
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={handleInstallClick}
          className={`flex items-center gap-1.5 rounded-lg bg-[#c6ff1f]/15 hover:bg-[#c6ff1f]/25 border border-[#c6ff1f]/30 text-[#c6ff1f] hover:text-white px-2 sm:px-2.5 py-1.5 text-xs font-semibold transition-all shadow-sm cursor-pointer whitespace-nowrap shrink-0 ${className}`}
          title={isInstallable ? "Click to trigger native app installation" : "Install Tacstem as a desktop or mobile application (PWA)"}
        >
          <Download className="w-3.5 h-3.5 text-[#c6ff1f] shrink-0" />
          <span className="hidden sm:inline">Install App</span>
        </button>
        {showGuideTrigger && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowGuide(true);
            }}
            className="hidden sm:inline-flex p-1 text-white/40 hover:text-white transition-colors rounded hover:bg-white/5 shrink-0"
            title="Installation Guide & Instructions"
            aria-label="Installation guide"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      {renderButtonContent()}

      {/* Instructional pop-up box (kept elsewhere as fallback and accessible via guide trigger) */}
      {showGuide && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#141418] p-6 shadow-2xl border border-white/10 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#c6ff1f]/15 border border-[#c6ff1f]/30 flex items-center justify-center text-[#c6ff1f]">
                  <Monitor className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Install Tacstem</h3>
                  <p className="text-[11px] text-gray-400">Offline & Fast Local Video Editing</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* If in an embedded iframe preview, inform user and provide direct tab button */}
            {isIframe && (
              <div className="mb-4 p-3 rounded-xl bg-[#c6ff1f]/10 border border-[#c6ff1f]/20 text-xs text-gray-200 space-y-2">
                <p className="font-semibold text-white flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-[#c6ff1f]" />
                  Preview Environment Detected
                </p>
                <p className="text-[11px] text-gray-300 leading-relaxed">
                  Web browsers block direct 1-click install popups inside embedded preview windows. Open Tacstem directly in a browser tab to enable direct install:
                </p>
                <button
                  type="button"
                  onClick={handleOpenDirect}
                  className="w-full mt-1.5 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[#c6ff1f] hover:bg-[#b0e817] text-black font-bold text-xs transition-colors cursor-pointer shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Direct Tab & Install</span>
                </button>
              </div>
            )}

            {isIOS ? (
              <div className="space-y-3 text-xs text-gray-300">
                <p className="font-semibold text-white flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-[#c6ff1f]" />
                  <span>To install on iPhone or iPad:</span>
                </p>
                <div className="bg-[#1c1c22] p-3 rounded-xl border border-white/5 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#c6ff1f] text-black font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <span>
                      Tap the <strong className="text-white">Share button</strong> (square with arrow) at the bottom of Safari.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#c6ff1f] text-black font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <span>
                      Scroll down and tap <strong className="text-white">"Add to Home Screen"</strong>.
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-gray-300">
                <p className="text-xs text-gray-300 leading-relaxed">
                  Installing Tacstem gives you full desktop standalone mode, instant file loading, and offline access without browser tabs!
                </p>
                <div className="bg-[#1c1c22] p-3.5 rounded-xl border border-white/5 space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#c6ff1f] text-black font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <strong className="text-white block">From Address Bar:</strong>
                      <span className="text-gray-400">
                        Look for the install icon <strong className="text-[#c6ff1f]">(⊕ or desktop screen with arrow)</strong> on the right side of the address bar.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#c6ff1f] text-black font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <strong className="text-white block">From Browser Menu:</strong>
                      <span className="text-gray-400">
                        Click browser menu <strong className="text-white">(⋮ or ⋯)</strong> &rarr; Select <strong className="text-white">"Install Tacstem"</strong> or <strong className="text-white">"Save and share" &rarr; "Install app"</strong>.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="w-full rounded-xl bg-[#c6ff1f] hover:bg-[#b0e817] py-2 text-xs font-bold text-black transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
