import { useState, useCallback } from 'react';
import { useDragControls } from 'framer-motion';

export function useWorkspacePopouts(params: {
  showNotification: (
    message: string,
    color: string,
    onUndo?: () => void,
    action?: { label: string; onClick: () => void }
  ) => void;
}) {
  const { showNotification } = params;

  const [poppedOutCodingMode, setPoppedOutCodingMode] = useState<'panel' | 'pad'>('panel');
  const [showCodingPaneLabels, setShowCodingPaneLabels] = useState(true);

  const [isTimerPoppedOut, setIsTimerPoppedOut] = useState(false);
  const [isPadPoppedOut, setIsPadPoppedOut] = useState(false);

  const timerDragControls = useDragControls();
  const padDragControls = useDragControls();

  const [timerWidgetPos] = useState({ x: 20, y: 52, w: 260, h: 140 });
  const [padWidgetPos] = useState({ x: 300, y: 52, w: 500, h: 500 });

  const [timerExternalWindow, setTimerExternalWindow] = useState<Window | null>(null);
  const [padExternalWindow, setPadExternalWindow] = useState<Window | null>(null);
  const [externalTimerContainer, setExternalTimerContainer] = useState<HTMLElement | null>(null);
  const [externalPadContainer, setExternalPadContainer] = useState<HTMLElement | null>(null);

  const openExternalWindow = useCallback(
    (type: 'timer' | 'pad') => {
      const width = type === 'timer' ? 440 : 680;
      const height = type === 'timer' ? 320 : 640;
      const left = Math.max(0, window.screen.width - width - 60);
      const top = 80;

      try {
        const win = window.open(
          'about:blank',
          `Popout_${type}_${Date.now()}`,
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no`
        );

        if (win) {
          win.document.title = type === 'timer' ? 'Live Match Timer' : 'Tactical Tagging Pad';
          win.document.body.style.margin = '0';
          win.document.body.style.backgroundColor = '#0e0e11';
          win.document.body.style.color = '#ffffff';
          win.document.body.style.fontFamily = 'system-ui, -apple-system, sans-serif';
          win.document.body.style.overflow = 'auto';

          const rootDiv = win.document.createElement('div');
          rootDiv.id = 'popout-window-root';
          rootDiv.style.minHeight = '100vh';
          rootDiv.style.display = 'flex';
          rootDiv.style.flexDirection = 'column';
          win.document.body.appendChild(rootDiv);

          // Copy styles to popup window
          Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).forEach((s) => {
            rootDiv.appendChild(s.cloneNode(true));
          });

          win.addEventListener('beforeunload', () => {
            if (type === 'timer') {
              setTimerExternalWindow(null);
              setExternalTimerContainer(null);
            } else {
              setPadExternalWindow(null);
              setExternalPadContainer(null);
            }
          });

          if (type === 'timer') {
            setTimerExternalWindow(win);
            setExternalTimerContainer(rootDiv);
            setIsTimerPoppedOut(false);
          } else {
            setPadExternalWindow(win);
            setExternalPadContainer(rootDiv);
            setIsPadPoppedOut(false);
          }
          showNotification(
            `Popped out ${type === 'timer' ? 'Timer' : 'Coding Pad'} to separate browser window!`,
            '#c6ff1f'
          );
          return;
        }
      } catch (e) {
        console.log('Browser window.open unavailable or blocked, falling back to floating widget overlay:', e);
      }

      // Fallback if popup blocked by iframe policy
      if (type === 'timer') {
        setIsTimerPoppedOut(true);
        showNotification('Timer popped out as draggable, resizable floating window near video!', '#c6ff1f');
      } else {
        setIsPadPoppedOut(true);
        showNotification('Coding Pad popped out as draggable, resizable floating window near video!', '#c6ff1f');
      }
    },
    [showNotification]
  );

  return {
    poppedOutCodingMode,
    setPoppedOutCodingMode,
    showCodingPaneLabels,
    setShowCodingPaneLabels,
    isTimerPoppedOut,
    setIsTimerPoppedOut,
    isPadPoppedOut,
    setIsPadPoppedOut,
    timerDragControls,
    padDragControls,
    timerWidgetPos,
    padWidgetPos,
    timerExternalWindow,
    setTimerExternalWindow,
    padExternalWindow,
    setPadExternalWindow,
    externalTimerContainer,
    setExternalTimerContainer,
    externalPadContainer,
    setExternalPadContainer,
    openExternalWindow,
  };
}
