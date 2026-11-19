import { useEffect, useState, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const promptSubscribers = new Set<(prompt: BeforeInstallPromptEvent | null) => void>();
const installSubscribers = new Set<(installed: boolean) => void>();

function notifyPromptSubscribers(prompt: BeforeInstallPromptEvent | null) {
  globalDeferredPrompt = prompt;
  promptSubscribers.forEach((cb) => {
    try {
      cb(prompt);
    } catch (e) {
      console.warn('Error in prompt subscriber:', e);
    }
  });
}

function notifyInstallSubscribers(installed: boolean) {
  installSubscribers.forEach((cb) => {
    try {
      cb(installed);
    } catch (e) {
      console.warn('Error in install subscriber:', e);
    }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the default mini-infobar so our custom in-app buttons can control the prompt
    e.preventDefault();
    notifyPromptSubscribers(e as BeforeInstallPromptEvent);
  });

  window.addEventListener('appinstalled', () => {
    notifyPromptSubscribers(null);
    notifyInstallSubscribers(true);
  });
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => globalDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
      (window.navigator as unknown as { standalone?: boolean })?.standalone === true
    );
  });
  const [isIOS, setIsIOS] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator?.userAgent?.toLowerCase() || '';
    return /iphone|ipad|ipod/.test(ua);
  });
  const [isIframe, setIsIframe] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect standalone mode
    const checkStandalone = () => {
      const standalone =
        (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
        (window.navigator as unknown as { standalone?: boolean })?.standalone === true;
      setIsInstalled(standalone);
    };

    checkStandalone();

    // Subscribe to shared prompt and installed states
    const onPromptChange = (p: BeforeInstallPromptEvent | null) => {
      setDeferredPrompt(p);
    };
    const onInstalledChange = (inst: boolean) => {
      setIsInstalled(inst);
    };

    promptSubscribers.add(onPromptChange);
    installSubscribers.add(onInstalledChange);

    return () => {
      promptSubscribers.delete(onPromptChange);
      installSubscribers.delete(onInstalledChange);
    };
  }, []);

  const install = useCallback(async (): Promise<InstallOutcome> => {
    const promptToUse = deferredPrompt || globalDeferredPrompt;
    if (!promptToUse) {
      return 'unavailable';
    }

    try {
      // Trigger the native browser install confirmation dialog directly on screen
      await promptToUse.prompt();
      const choice = await promptToUse.userChoice;
      if (choice && choice.outcome === 'accepted') {
        notifyPromptSubscribers(null);
        notifyInstallSubscribers(true);
        return 'accepted';
      }
      return 'dismissed';
    } catch (err) {
      console.warn('Failed to invoke native install prompt:', err);
      return 'unavailable';
    }
  }, [deferredPrompt]);

  return {
    isInstallable: !!(deferredPrompt || globalDeferredPrompt),
    isInstalled,
    isIOS,
    isIframe,
    install,
  };
}
