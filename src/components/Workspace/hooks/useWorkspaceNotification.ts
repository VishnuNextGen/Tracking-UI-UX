import { useState, useCallback } from 'react';
import type { EventNotificationState } from '../Workspace.types';

export function useWorkspaceNotification() {
  const [eventNotification, setEventNotification] = useState<EventNotificationState | null>(null);

  const showNotification = useCallback(
    (
      message: string,
      color: string,
      onUndo?: () => void,
      action?: { label: string; onClick: () => void }
    ) => {
      const id = Date.now();
      setEventNotification({ message, color, id, onUndo, action });

      const timeout = onUndo || action ? 4500 : 1300;
      setTimeout(() => {
        setEventNotification((prev) => (prev?.id === id ? null : prev));
      }, timeout);
    },
    []
  );

  return {
    eventNotification,
    setEventNotification,
    showNotification,
  };
}
