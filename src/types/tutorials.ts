export interface Tutorial {
  id: string;
  title: string;
  description: string;
  youtubeUrl: string;
  youtubeId: string;
  folderId: string;
  folderName: string;
  duration: string; // e.g. "08:45"
  recommended: boolean;
  tags: string[];
  createdAt: number;
  lastModified?: number;
  author?: string;
}

export interface TutorialFolder {
  id: string;
  name: string;
  description: string;
  iconName?: string;
  order: number;
}

export type NotificationCategory = 'announcement' | 'tutorial' | 'feature' | 'update' | 'alert';
export type NotificationAudience = 'all' | 'analysts' | 'coaches' | 'content_creators';

export interface PushNotification {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  category: NotificationCategory;
  targetAudience: NotificationAudience;
  priority: 'normal' | 'high';
  linkType?: 'tutorial' | 'url' | 'tab' | 'none';
  link?: string; // Tutorial ID, URL, or Tab name
  sentBy?: string;
}
