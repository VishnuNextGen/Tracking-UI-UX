export type UserPlan = 'free' | 'pro';
export type UserPersona = 'analyst' | 'coach' | 'content_creator';

export interface UserPersonaOption {
  id: UserPersona;
  label: string;
}

export const USER_PERSONA_OPTIONS: UserPersonaOption[] = [
  { id: 'analyst', label: 'Analyst' },
  { id: 'coach', label: 'Coach' },
  { id: 'content_creator', label: 'Content Creator' },
];

export function normalizeUserPersonas(input?: unknown): UserPersona[] {
  const valid = new Set<UserPersona>(['analyst', 'coach', 'content_creator']);
  if (Array.isArray(input)) {
    const filtered = input.filter((p): p is UserPersona => typeof p === 'string' && valid.has(p as UserPersona));
    return Array.from(new Set(filtered));
  }
  if (typeof input === 'string' && valid.has(input as UserPersona)) {
    return [input as UserPersona];
  }
  return [];
}

export function formatUserPersonas(personas?: UserPersona[] | UserPersona): string {
  const list = normalizeUserPersonas(personas);
  if (list.length === 0) return '';
  return list
    .map((p) => {
      switch (p) {
        case 'analyst':
          return 'Analyst';
        case 'coach':
          return 'Coach';
        case 'content_creator':
          return 'Content Creator';
      }
    })
    .join(', ');
}

export type WatermarkTier = 'none' | 'pro' | 'free';

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  personas?: UserPersona[];
  onboarded?: boolean;
  plan: UserPlan;
  isAdmin?: boolean;
  createdAt: number;
  planUpdatedAt: number;
  previousPlan?: UserPlan;
  demotedAt?: number;
  notes?: string;
  avatarUrl?: string;
  isCurrent?: boolean;
}

export interface PlanPolicyInfo {
  maxVideoProjects: number;
  maxBoardProjects: number;
  canCreateBatches: boolean;
  name: string;
  tagline: string;
  badgeText: string;
}

export const PLAN_CONFIGS: Record<UserPlan, PlanPolicyInfo> = {
  free: {
    maxVideoProjects: 1,
    maxBoardProjects: 1,
    canCreateBatches: false,
    name: 'Free Account',
    tagline: 'Single match analysis & single tactical pitch board',
    badgeText: 'FREE',
  },
  pro: {
    maxVideoProjects: Infinity,
    maxBoardProjects: Infinity,
    canCreateBatches: true,
    name: 'Pro Account',
    tagline: 'Unlimited video projects, multi-game batches & tactical boards',
    badgeText: '✦ PRO',
  },
};
