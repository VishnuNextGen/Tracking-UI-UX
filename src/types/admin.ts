import type { UserPersona } from './user';

export interface PlatformSettings {
  id: 'global';
  freeMaxVideoProjects: number;
  freeMaxBoardProjects: number;
  freeAllowBatches: boolean;
  allowInstantFreeUpgrade: boolean;
  announcementEnabled: boolean;
  announcementText: string;
  announcementLink: string;
  academyTitle: string;
  academySubtitle: string;
  supportContactAddress: string;
  founderLinkedInUrl: string;
  updatedBy?: string;
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  id: 'global',
  freeMaxVideoProjects: 1,
  freeMaxBoardProjects: 1,
  freeAllowBatches: false,
  allowInstantFreeUpgrade: false,
  announcementEnabled: false,
  announcementText: '',
  announcementLink: '',
  academyTitle: 'Tacstem Sports Video Academy',
  academySubtitle:
    'Curated tactical workflows, live match coding guides, and telestration masterclasses.',
  supportContactAddress: 'pvvishnupscaspirant@gmail.com',
  founderLinkedInUrl: 'https://www.linkedin.com/in/vishnu-perikamana/',
};

export type UpgradeRequestStatus = 'pending' | 'approved' | 'declined';

export interface UpgradeRequestRecord {
  userId: string;
  displayName: string;
  email: string;
  personas: UserPersona[];
  organization: string;
  message: string;
  status: UpgradeRequestStatus;
  reviewedBy: string;
  adminNote: string;
  createdAtMs: number;
}
