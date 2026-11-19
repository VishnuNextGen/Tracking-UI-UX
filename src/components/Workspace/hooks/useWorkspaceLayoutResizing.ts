import { useState, useEffect, useCallback, type MutableRefObject } from 'react';

export interface UseWorkspaceLayoutResizingProps {
  isResizingAnimPanel: boolean;
  setIsResizingAnimPanel: React.Dispatch<React.SetStateAction<boolean>>;
  setAnimationPanelWidth: React.Dispatch<React.SetStateAction<number>>;
  sidebarRef: MutableRefObject<HTMLDivElement | null>;
}

export const useWorkspaceLayoutResizing = ({
  isResizingAnimPanel,
  setIsResizingAnimPanel,
  setAnimationPanelWidth,
  sidebarRef,
}: UseWorkspaceLayoutResizingProps) => {
  const [labelsPanelWidth, setLabelsPanelWidth] = useState<number>(260);
  const [isResizingLabelsPanel, setIsResizingLabelsPanel] = useState<boolean>(false);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [eventSectionHeight, setEventSectionHeight] = useState(40);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingSection, setIsResizingSection] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingAnimPanel) {
        const newWidth = document.body.clientWidth - e.clientX;
        setAnimationPanelWidth(Math.max(280, Math.min(newWidth, document.body.clientWidth * 0.85)));
      }
      if (isResizingLabelsPanel) {
        setLabelsPanelWidth((prev) => {
          const newWidth = prev - e.movementX;
          return Math.max(200, Math.min(newWidth, document.body.clientWidth * 0.5));
        });
      }
    };
    const handleMouseUp = () => {
      setIsResizingAnimPanel(false);
      setIsResizingLabelsPanel(false);
    };
    if (isResizingAnimPanel || isResizingLabelsPanel) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingAnimPanel, isResizingLabelsPanel, setAnimationPanelWidth, setIsResizingAnimPanel]);

  const handleSidebarResize = useCallback(
    (e: MouseEvent) => {
      if (isResizingSidebar) {
        const newWidth = document.body.clientWidth - e.clientX;
        setSidebarWidth(Math.max(250, Math.min(600, newWidth)));
      }
    },
    [isResizingSidebar]
  );

  const handleSectionResize = useCallback(
    (e: MouseEvent) => {
      if (isResizingSection && sidebarRef.current) {
        const sidebarRect = sidebarRef.current.getBoundingClientRect();
        const relativeY = e.clientY - sidebarRect.top;
        const percentage = (relativeY / sidebarRect.height) * 100;
        setEventSectionHeight(Math.max(10, Math.min(90, percentage)));
      }
    },
    [isResizingSection, sidebarRef]
  );

  useEffect(() => {
    const handleSidebarUp = () => setIsResizingSidebar(false);
    const handleSectionUp = () => setIsResizingSection(false);
    if (isResizingSidebar) {
      window.addEventListener('mousemove', handleSidebarResize);
      window.addEventListener('mouseup', handleSidebarUp);
    }
    if (isResizingSection) {
      window.addEventListener('mousemove', handleSectionResize);
      window.addEventListener('mouseup', handleSectionUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleSidebarResize);
      window.removeEventListener('mouseup', handleSidebarUp);
      window.removeEventListener('mousemove', handleSectionResize);
      window.removeEventListener('mouseup', handleSectionUp);
    };
  }, [isResizingSidebar, isResizingSection, handleSidebarResize, handleSectionResize]);

  return {
    labelsPanelWidth,
    setLabelsPanelWidth,
    isResizingLabelsPanel,
    setIsResizingLabelsPanel,
    sidebarWidth,
    setSidebarWidth,
    eventSectionHeight,
    setEventSectionHeight,
    isResizingSidebar,
    setIsResizingSidebar,
    isResizingSection,
    setIsResizingSection,
  };
};
