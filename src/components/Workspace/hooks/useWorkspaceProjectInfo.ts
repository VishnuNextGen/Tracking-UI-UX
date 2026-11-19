import { useState, useEffect } from 'react';
import type { Project } from '../../../types';
import type { ExportModalState } from '../Workspace.types';

export interface UseWorkspaceProjectInfoProps {
  project: Project;
  onUpdateMetadata?: (name: string, description: string) => void;
  showNotification?: (message: string, color?: string) => void;
}

export function useWorkspaceProjectInfo({
  project,
  onUpdateMetadata,
  showNotification,
}: UseWorkspaceProjectInfoProps) {
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoForm, setInfoForm] = useState({
    name: project.name || '',
    description: project.description || '',
  });
  const [showBatchRelinkerModal, setShowBatchRelinkerModal] = useState(false);
  const [exportModalState, setExportModalState] = useState<ExportModalState>({
    isOpen: false,
    title: '',
    clips: [],
    defaultWithFreezeFrames: true,
  });

  useEffect(() => {
    setInfoForm({
      name: project.name || '',
      description: project.description || '',
    });
  }, [project.name, project.description]);

  const handleSaveInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateMetadata) {
      onUpdateMetadata(infoForm.name, infoForm.description);
      showNotification?.('Project info updated successfully', '#c6ff1f');
    }
    setShowInfoModal(false);
  };

  return {
    showInfoModal,
    setShowInfoModal,
    infoForm,
    setInfoForm,
    showBatchRelinkerModal,
    setShowBatchRelinkerModal,
    exportModalState,
    setExportModalState,
    handleSaveInfo,
  };
}
