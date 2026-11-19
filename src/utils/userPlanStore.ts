import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  Timestamp,
  getCountFromServer,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  db,
  auth,
  isBootstrappedAdminEmail,
  handleFirestoreError,
  OperationType,
  type FirebaseUser,
} from '../firebase';
import {
  UserProfile,
  UserPlan,
  UserPersona,
  WatermarkTier,
  PLAN_CONFIGS,
  normalizeUserPersonas,
} from '../types/user';
import {
  PlatformSettings,
  DEFAULT_PLATFORM_SETTINGS,
  UpgradeRequestRecord,
  UpgradeRequestStatus,
} from '../types/admin';

const USERS_STORAGE_KEY = 'tacstem_users_v3_auth';
const CURRENT_USER_ID_KEY = 'tacstem_current_user_id_v2';
const GUEST_SESSION_KEY = 'tacstem_guest_session_v1';
const ONBOARDING_PREFIX = 'tacstem_onboarding_completed_';
const PLATFORM_SETTINGS_STORAGE_KEY = 'tacstem_platform_settings_v1';
const ADMIN_ENTITLEMENTS_CURSOR_KEY = 'tacstem_admin_entitlements_cursor_ms_v1';

let activeEntitlementUnsub: Unsubscribe | null = null;
let activeAdminUsersUnsub: Unsubscribe | null = null;
let activeSettingsUnsub: Unsubscribe | null = null;

function getAdminEntitlementsCursorMs(): number {
  try {
    const raw = Number(localStorage.getItem(ADMIN_ENTITLEMENTS_CURSOR_KEY));
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  } catch {
    return 0;
  }
}

function saveAdminEntitlementsCursorMs(tsMs: number): void {
  try {
    localStorage.setItem(ADMIN_ENTITLEMENTS_CURSOR_KEY, String(tsMs));
  } catch {
    // ignore
  }
}

function sanitizeDisplayName(name?: string | null, email?: string | null): string {
  const candidate = (name || email?.split('@')[0] || 'Tacstem User').trim();
  return (candidate || 'Tacstem User').slice(0, 120);
}

function sanitizeEmail(email?: string | null): string {
  const candidate = (email || 'user@tacstem.app').trim().toLowerCase();
  return candidate.includes('@') ? candidate.slice(0, 254) : 'user@tacstem.app';
}

function ensureNonEmptyPersonas(personas?: UserPersona[]): UserPersona[] {
  const normalized = normalizeUserPersonas(personas);
  return normalized.length > 0 ? normalized.slice(0, 5) : ['analyst'];
}

/**
 * Determine if a user profile holds Admin privileges (entitled to watermark-free clean exports).
 * Explicit boolean `user.isAdmin` takes precedence so admins can toggle it off locally to simulate Pro/Free exports.
 */
export function isUserAdmin(user?: UserProfile | null): boolean {
  if (!user) return false;
  if (typeof user.isAdmin === 'boolean') {
    return user.isAdmin;
  }
  return isBootstrappedAdminEmail(user.email);
}

/**
 * Check if current Firebase Auth session belongs to an administrator (bootstrapped or promoted)
 */
export function isCurrentAuthBootstrappedAdmin(): boolean {
  const fbUser = auth.currentUser;
  if (!fbUser) return false;
  if (fbUser.emailVerified && isBootstrappedAdminEmail(fbUser.email)) return true;
  return isUserAdmin(getCurrentUser());
}

/**
 * Resolve export/recording watermark tier for a given user:
 * - Admin: 'none' (clean master export, zero watermark)
 * - Pro: 'pro' (sleek bottom-right broadcast signature)
 * - Free: 'free' (full-video low-opacity protective watermark)
 */
export function resolveWatermarkTier(user?: UserProfile | null): WatermarkTier {
  if (isUserAdmin(user)) return 'none';
  if (user?.plan === 'pro') return 'pro';
  return 'free';
}

export function getCurrentWatermarkTier(): WatermarkTier {
  try {
    return resolveWatermarkTier(getCurrentUser());
  } catch {
    return 'free';
  }
}

function mapDocToUserProfile(id: string, data: any): UserProfile {
  const normalized = normalizeUserPersonas(data.personas);
  const email = sanitizeEmail(data.email);
  const previousPlan =
    data.previousPlan === 'free' || data.previousPlan === 'pro' ? data.previousPlan : undefined;
  return {
    id,
    displayName: sanitizeDisplayName(data.displayName, email),
    email,
    avatarUrl: typeof data.photoURL === 'string' && data.photoURL ? data.photoURL : undefined,
    personas: normalized.length > 0 ? normalized : ['analyst'],
    onboarded: Boolean(data.onboarded),
    plan: data.plan === 'pro' ? 'pro' : 'free',
    isAdmin:
      typeof data.isAdmin === 'boolean'
        ? data.isAdmin
        : isBootstrappedAdminEmail(email),
    createdAt: Number(data.createdAtMs) || Date.now(),
    planUpdatedAt: Number(data.planUpdatedAtMs) || Date.now(),
    previousPlan,
    demotedAt: Number(data.demotedAtMs) > 0 ? Number(data.demotedAtMs) : undefined,
    notes: typeof data.notes === 'string' ? data.notes : '',
  };
}

function saveUsersToStorage(users: UserProfile[]) {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Error saving users cache:', e);
  }
}

function upsertLocalUserCache(profile: UserProfile): UserProfile[] {
  const list = getAllUsers();
  const idx = list.findIndex((u) => u.id === profile.id);
  const next = idx >= 0 ? list.map((u, i) => (i === idx ? profile : u)) : [profile, ...list];
  saveUsersToStorage(next);
  return next;
}

/**
 * Load cached authenticated users (real accounts synced from Firestore)
 */
export function getAllUsers(): UserProfile[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((u: any) => {
          const normalized = normalizeUserPersonas(u.personas);
          return {
            ...u,
            isAdmin:
              typeof u.isAdmin === 'boolean'
                ? u.isAdmin
                : isBootstrappedAdminEmail(u.email),
            personas: normalized.length > 0 ? normalized : ['analyst'],
          };
        });
      }
    }
  } catch {
    // ignore
  }
  return [];
}

const FALLBACK_SIGNED_OUT_PROFILE: UserProfile = {
  id: 'unauthenticated',
  displayName: 'Sign In Required',
  email: '',
  personas: ['analyst'],
  onboarded: false,
  plan: 'free',
  isAdmin: false,
  createdAt: Date.now(),
  planUpdatedAt: Date.now(),
};

/**
 * Get the currently active authenticated user profile synchronously
 */
export function getCurrentUser(): UserProfile {
  const users = getAllUsers();
  try {
    const currentId = auth.currentUser?.uid || localStorage.getItem(CURRENT_USER_ID_KEY);
    if (currentId) {
      const found = users.find((u) => u.id === currentId);
      if (found) return found;
    }
  } catch {
    // ignore
  }
  if (auth.currentUser) {
    const bootstrapAdmin = Boolean(
      auth.currentUser.emailVerified && isBootstrappedAdminEmail(auth.currentUser.email)
    );
    return {
      id: auth.currentUser.uid,
      displayName: sanitizeDisplayName(auth.currentUser.displayName, auth.currentUser.email),
      email: sanitizeEmail(auth.currentUser.email),
      avatarUrl: auth.currentUser.photoURL || undefined,
      personas: ['analyst'],
      onboarded: bootstrapAdmin,
      plan: bootstrapAdmin ? 'pro' : 'free',
      isAdmin: bootstrapAdmin,
      createdAt: Date.now(),
      planUpdatedAt: Date.now(),
    };
  }
  return FALLBACK_SIGNED_OUT_PROFILE;
}

export function isGuestSessionActive(): boolean {
  try {
    return localStorage.getItem(GUEST_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}

export function activateGuestUserSession(): UserProfile {
  const existing = getAllUsers().find((u) => u.id === 'guest');
  const now = Date.now();
  const guestProfile: UserProfile = existing
    ? {
        ...existing,
        plan: 'pro',
        isAdmin: false,
      }
    : {
        id: 'guest',
        displayName: 'Guest Analyst',
        email: 'guest@local.tacstem',
        personas: ['analyst'],
        onboarded: true,
        plan: 'pro',
        isAdmin: false,
        createdAt: now,
        planUpdatedAt: now,
        notes: 'Local browser-only guest workspace',
      };

  try {
    localStorage.setItem(GUEST_SESSION_KEY, 'true');
    localStorage.setItem(CURRENT_USER_ID_KEY, 'guest');
    localStorage.setItem(`${ONBOARDING_PREFIX}guest`, 'true');
  } catch {
    // ignore
  }
  upsertLocalUserCache(guestProfile);
  dispatchPlanEvent(guestProfile);
  return guestProfile;
}

/**
 * Synchronize Firebase Google Auth user with Firestore `/user_entitlements/{uid}`
 * New non-admin users ALWAYS start on the 'free' plan.
 */
export async function syncAuthenticatedFirebaseUser(
  fbUser: FirebaseUser,
  onRealtimeChange?: (profile: UserProfile) => void
): Promise<UserProfile> {
  if (activeEntitlementUnsub) {
    activeEntitlementUnsub();
    activeEntitlementUnsub = null;
  }

  const uid = fbUser.uid;
  const email = sanitizeEmail(fbUser.email);
  const displayName = sanitizeDisplayName(fbUser.displayName, email);
  const photoURL = (fbUser.photoURL || '').slice(0, 1024);
  const bootstrapAdmin = Boolean(fbUser.emailVerified && isBootstrappedAdminEmail(email));

  const entitlementPath = `user_entitlements/${uid}`;
  const entitlementRef = doc(db, 'user_entitlements', uid);

  let initialProfile: UserProfile;

  try {
    const snap = await getDoc(entitlementRef);
    if (!snap.exists()) {
      const now = Date.now();
      const defaultPlan: UserPlan = bootstrapAdmin ? 'pro' : 'free';
      const defaultIsAdmin = bootstrapAdmin;
      const createPayload = {
        userId: uid,
        displayName,
        email,
        photoURL,
        personas: ['analyst'] as UserPersona[],
        onboarded: bootstrapAdmin,
        plan: defaultPlan,
        isAdmin: defaultIsAdmin,
        previousPlan: 'none',
        demotedAtMs: 0,
        notes: bootstrapAdmin ? 'Founder / Bootstrapped Admin account' : '',
        createdAtMs: now,
        planUpdatedAtMs: now,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      try {
        await setDoc(entitlementRef, createPayload);
        initialProfile = {
          id: uid,
          displayName,
          email,
          avatarUrl: photoURL || undefined,
          personas: ['analyst'],
          onboarded: bootstrapAdmin,
          plan: defaultPlan,
          isAdmin: defaultIsAdmin,
          createdAt: now,
          planUpdatedAt: now,
          notes: createPayload.notes,
        };
      } catch (err) {
        const retrySnap = await getDoc(entitlementRef).catch(() => null);
        if (retrySnap && retrySnap.exists()) {
          const retryData = retrySnap.data();
          initialProfile = mapDocToUserProfile(uid, {
            ...retryData,
            photoURL: retryData.photoURL || photoURL,
            isAdmin: Boolean(retryData.isAdmin || bootstrapAdmin),
          });
        } else {
          handleFirestoreError(err, OperationType.CREATE, entitlementPath);
        }
      }
    } else {
      const rawData = snap.data();
      // Also check if user has an explicit /admins/{uid} document if not already marked admin
      let adminDocExists = false;
      if (!rawData.isAdmin && !bootstrapAdmin) {
        try {
          const adminSnap = await getDoc(doc(db, 'admins', uid));
          adminDocExists = adminSnap.exists();
        } catch {
          adminDocExists = false;
        }
      }

      // If this account is a bootstrapped admin (e.g., techguruinkerala@gmail.com or tacstem@gmail.com)
      // and had an earlier Free/non-admin entitlement doc, elevate it in Firestore automatically
      const shouldAutoElevateAdminDoc =
        bootstrapAdmin &&
        (!rawData.isAdmin ||
          (rawData.plan !== 'pro' && (!rawData.previousPlan || rawData.previousPlan === 'none')));

      const effectivePlan: UserPlan = shouldAutoElevateAdminDoc
        ? 'pro'
        : rawData.plan === 'pro'
        ? 'pro'
        : 'free';
      const effectiveIsAdmin = Boolean(rawData.isAdmin || bootstrapAdmin || adminDocExists);

      initialProfile = mapDocToUserProfile(uid, {
        ...rawData,
        photoURL: rawData.photoURL || photoURL,
        plan: effectivePlan,
        isAdmin: effectiveIsAdmin,
      });

      if (shouldAutoElevateAdminDoc) {
        const now = Date.now();
        await updateDoc(entitlementRef, {
          isAdmin: true,
          plan: 'pro',
          onboarded: true,
          photoURL: photoURL || rawData.photoURL || '',
          notes: rawData.notes || 'Bootstrapped Admin account',
          planUpdatedAtMs: now,
          updatedAt: serverTimestamp(),
        }).catch(() => {});
        initialProfile = {
          ...initialProfile,
          isAdmin: true,
          plan: 'pro',
          onboarded: true,
          planUpdatedAt: now,
        };
      } else if (photoURL && rawData.photoURL !== photoURL) {
        // Keep Google avatar fresh if changed
        updateDoc(entitlementRef, {
          photoURL,
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, entitlementPath);
  }

  try {
    localStorage.setItem(CURRENT_USER_ID_KEY, uid);
    if (initialProfile.onboarded) {
      localStorage.setItem(`${ONBOARDING_PREFIX}${uid}`, 'true');
    }
  } catch {
    // ignore
  }

  upsertLocalUserCache(initialProfile);
  dispatchPlanEvent(initialProfile);

  // Attach real-time listener so live Admin promotions/demotions take effect immediately
  let isFirstSnapshot = true;
  activeEntitlementUnsub = onSnapshot(
    entitlementRef,
    (docSnap) => {
      if (!docSnap.exists()) return;
      const updatedProfile = mapDocToUserProfile(uid, docSnap.data());
      upsertLocalUserCache(updatedProfile);
      if (updatedProfile.onboarded) {
        try {
          localStorage.setItem(`${ONBOARDING_PREFIX}${uid}`, 'true');
        } catch {
          // ignore
        }
      }
      if (isFirstSnapshot) {
        isFirstSnapshot = false;
        if (
          updatedProfile.plan === initialProfile.plan &&
          updatedProfile.isAdmin === initialProfile.isAdmin &&
          updatedProfile.displayName === initialProfile.displayName
        ) {
          return;
        }
      }
      dispatchPlanEvent(updatedProfile);
      if (onRealtimeChange) {
        onRealtimeChange(updatedProfile);
      }
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.GET, entitlementPath);
      } catch {
        // Logged via handleFirestoreError
      }
    }
  );

  return initialProfile;
}

export function clearAuthenticatedUserSession(): void {
  if (activeEntitlementUnsub) {
    activeEntitlementUnsub();
    activeEntitlementUnsub = null;
  }
  if (activeAdminUsersUnsub) {
    activeAdminUsersUnsub();
    activeAdminUsersUnsub = null;
  }
  if (activeSettingsUnsub) {
    activeSettingsUnsub();
    activeSettingsUnsub = null;
  }
  try {
    localStorage.removeItem(CURRENT_USER_ID_KEY);
    localStorage.removeItem(GUEST_SESSION_KEY);
    localStorage.removeItem('tacstemGuest');
  } catch {
    // ignore
  }
}

/**
 * Incremental Delta Sync for `/user_entitlements` (Admin Console only):
 * - First run (or `forceFull === true`): fetches all user entitlement docs once and stores sync cursor.
 * - Subsequent opens / Refresh clicks: queries ONLY `where('updatedAt', '>', cursor)` so 0-10 changed
 *   users are read instead of re-reading all 1,000+ user documents!
 */
export async function syncAdminUserEntitlements(forceFull = false): Promise<UserProfile[]> {
  if (!auth.currentUser || !isCurrentAuthBootstrappedAdmin()) {
    return getAllUsers();
  }

  try {
    const cachedList = getAllUsers();
    const hasCachedUsers = cachedList.length > 0;
    const lastCursorMs = forceFull || !hasCachedUsers ? 0 : getAdminEntitlementsCursorMs();
    const syncStartedMs = Date.now();

    const colRef = collection(db, 'user_entitlements');
    const snap =
      lastCursorMs > 60_000
        ? await getDocs(
            query(colRef, where('updatedAt', '>', Timestamp.fromMillis(lastCursorMs - 60_000)))
          )
        : await getDocs(colRef);

    const byId = new Map<string, UserProfile>();
    if (lastCursorMs > 60_000) {
      for (const u of cachedList) {
        if (u?.id) byId.set(u.id, u);
      }
    }

    snap.forEach((docSnap) => {
      byId.set(docSnap.id, mapDocToUserProfile(docSnap.id, docSnap.data()));
    });

    const merged = Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt);
    saveUsersToStorage(merged);
    saveAdminEntitlementsCursorMs(syncStartedMs);
    return merged;
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.LIST, 'user_entitlements');
    } catch {
      return getAllUsers();
    }
  }
}

/**
 * Lightweight count aggregation for Admin header badges (`getCountFromServer` costs 1 read per 1,000 index entries!)
 */
export async function fetchAdminHeaderCounts(): Promise<{
  totalUsersCount: number;
  pendingUpgradesCount: number;
}> {
  const fallbackUsers = getAllUsers().length;
  if (!auth.currentUser || !isCurrentAuthBootstrappedAdmin()) {
    return { totalUsersCount: fallbackUsers, pendingUpgradesCount: 0 };
  }

  try {
    const [usersCountSnap, pendingCountSnap] = await Promise.all([
      getCountFromServer(collection(db, 'user_entitlements')),
      getCountFromServer(
        query(collection(db, 'upgrade_requests'), where('status', '==', 'pending'))
      ),
    ]);
    return {
      totalUsersCount: Math.max(fallbackUsers, usersCountSnap.data().count || 0),
      pendingUpgradesCount: pendingCountSnap.data().count || 0,
    };
  } catch {
    return { totalUsersCount: fallbackUsers, pendingUpgradesCount: 0 };
  }
}

/**
 * Quota-safe Admin entitlements subscription wrapper:
 * Performs a single incremental delta sync on mount instead of holding an unbounded full-collection listener.
 */
export function subscribeAdminUserEntitlements(
  onUsersUpdated: (users: UserProfile[]) => void
): Unsubscribe {
  if (!isCurrentAuthBootstrappedAdmin()) {
    const current = getAllUsers();
    onUsersUpdated(current);
    return () => {};
  }

  let cancelled = false;
  syncAdminUserEntitlements(false)
    .then((merged) => {
      if (!cancelled) onUsersUpdated(merged);
    })
    .catch(() => {
      if (!cancelled) onUsersUpdated(getAllUsers());
    });

  return () => {
    cancelled = true;
  };
}

/**
 * Check if the current user has completed quick onboarding
 */
export function hasCompletedOnboarding(userId?: string): boolean {
  try {
    const targetId = userId || auth.currentUser?.uid || localStorage.getItem(CURRENT_USER_ID_KEY);
    if (!targetId || targetId === 'unauthenticated') return true;
    const current = getCurrentUser();
    if (current.id === targetId && current.onboarded) return true;
    return localStorage.getItem(`${ONBOARDING_PREFIX}${targetId}`) === 'true';
  } catch {
    return true;
  }
}

/**
 * Mark onboarding complete and persist name & personas to Firestore `/user_entitlements/{uid}`
 */
export function completeUserOnboarding(payload: {
  displayName?: string;
  personas?: UserPersona[];
}): UserProfile {
  const current = getCurrentUser();
  const displayName = sanitizeDisplayName(payload.displayName, current.email);
  const personas = ensureNonEmptyPersonas(payload.personas ?? current.personas);

  const updatedUser: UserProfile = {
    ...current,
    displayName,
    personas,
    onboarded: true,
  };

  upsertLocalUserCache(updatedUser);
  try {
    localStorage.setItem(`${ONBOARDING_PREFIX}${updatedUser.id}`, 'true');
  } catch {
    // ignore
  }

  if (auth.currentUser && auth.currentUser.uid === updatedUser.id) {
    const path = `user_entitlements/${updatedUser.id}`;
    updateDoc(doc(db, 'user_entitlements', updatedUser.id), {
      displayName,
      personas,
      onboarded: true,
      updatedAt: serverTimestamp(),
    }).catch((err) => {
      try {
        handleFirestoreError(err, OperationType.UPDATE, path);
      } catch {
        // Logged
      }
    });
  }

  dispatchPlanEvent(updatedUser);
  return updatedUser;
}

export function skipUserOnboarding(): void {
  const current = getCurrentUser();
  try {
    if (current.id && current.id !== 'unauthenticated') {
      localStorage.setItem(`${ONBOARDING_PREFIX}${current.id}`, 'true');
    }
  } catch {
    // ignore
  }
  if (auth.currentUser && auth.currentUser.uid === current.id) {
    updateDoc(doc(db, 'user_entitlements', current.id), {
      onboarded: true,
      updatedAt: serverTimestamp(),
    }).catch(() => {});
  }
}

export function setCurrentUser(userId: string): UserProfile {
  const users = getAllUsers();
  const target = users.find((u) => u.id === userId);
  if (!target) throw new Error(`User with ID ${userId} not found`);

  try {
    localStorage.setItem(CURRENT_USER_ID_KEY, target.id);
  } catch {
    // ignore
  }

  dispatchPlanEvent(target);
  return target;
}

/**
 * Admin or authorized upgrade action: update a user's plan in Firestore & local cache
 */
export function updateUserPlan(
  userId: string,
  newPlan: UserPlan,
  adminNote?: string
): UserProfile {
  const users = getAllUsers();
  const existing = users.find((u) => u.id === userId) || getCurrentUser();
  const isDemotion = existing.plan === 'pro' && newPlan === 'free';
  const now = Date.now();
  const nextPreviousPlan = existing.plan;
  const nextDemotedAt = isDemotion ? now : existing.demotedAt || 0;
  const nextNotes = (adminNote !== undefined ? adminNote : existing.notes || '').slice(0, 1000);

  const updated: UserProfile = {
    ...existing,
    id: userId,
    plan: newPlan,
    planUpdatedAt: now,
    previousPlan: nextPreviousPlan,
    demotedAt: nextDemotedAt > 0 ? nextDemotedAt : undefined,
    notes: nextNotes,
  };

  upsertLocalUserCache(updated);
  if (getCurrentUser().id === userId) {
    dispatchPlanEvent(updated);
  }

  if (auth.currentUser) {
    const path = `user_entitlements/${userId}`;
    const isSelfNonAdmin =
      auth.currentUser.uid === userId && !isUserAdmin(getCurrentUser()) && !isCurrentAuthBootstrappedAdmin();

    const updatePayload: Record<string, any> = isSelfNonAdmin
      ? {
          plan: newPlan,
          previousPlan: nextPreviousPlan,
          planUpdatedAtMs: now,
          notes: nextNotes,
          updatedAt: serverTimestamp(),
        }
      : {
          plan: newPlan,
          previousPlan: nextPreviousPlan,
          demotedAtMs: nextDemotedAt,
          planUpdatedAtMs: now,
          notes: nextNotes,
          updatedAt: serverTimestamp(),
        };

    updateDoc(doc(db, 'user_entitlements', userId), updatePayload).catch((err) => {
      try {
        handleFirestoreError(err, OperationType.UPDATE, path);
      } catch {
        // Logged
      }
    });
  }

  return updated;
}

/**
 * Grant or revoke Admin privileges in Firestore (`/user_entitlements/{uid}` + `/admins/{uid}`)
 */
export function setUserAdminStatus(userId: string, makeAdmin: boolean): UserProfile {
  const users = getAllUsers();
  const existing = users.find((u) => u.id === userId) || getCurrentUser();

  const updated: UserProfile = {
    ...existing,
    id: userId,
    isAdmin: makeAdmin,
  };

  upsertLocalUserCache(updated);
  if (getCurrentUser().id === userId) {
    dispatchPlanEvent(updated);
  }

  if (auth.currentUser && (isCurrentAuthBootstrappedAdmin() || isUserAdmin(getCurrentUser()))) {
    const entRef = doc(db, 'user_entitlements', userId);
    const adminRoleRef = doc(db, 'admins', userId);

    (async () => {
      try {
        const batch = writeBatch(db);
        batch.update(entRef, {
          isAdmin: makeAdmin,
          updatedAt: serverTimestamp(),
        });
        if (makeAdmin) {
          const adminSnap = await getDoc(adminRoleRef);
          if (adminSnap.exists()) {
            batch.update(adminRoleRef, {
              email: sanitizeEmail(updated.email),
              grantedBy: auth.currentUser!.uid,
              updatedAt: serverTimestamp(),
            });
          } else {
            batch.set(adminRoleRef, {
              userId,
              email: sanitizeEmail(updated.email),
              grantedBy: auth.currentUser!.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } else {
          batch.delete(adminRoleRef);
        }
        await batch.commit();
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.WRITE, `admins/${userId}`);
        } catch {
          // Logged
        }
      }
    })();
  }

  return updated;
}

/**
 * Admin: Create or edit a user entitlement record in Firestore
 */
export function saveUserProfile(
  user: Partial<UserProfile> & { displayName: string; email: string }
): UserProfile {
  const users = getAllUsers();
  const existing = user.id ? users.find((u) => u.id === user.id) : undefined;
  const now = Date.now();
  const cleanEmail = sanitizeEmail(user.email);
  const cleanName = sanitizeDisplayName(user.displayName, cleanEmail);
  const cleanPersonas = ensureNonEmptyPersonas(user.personas ?? existing?.personas);

  if (existing) {
    const planChanged = user.plan && user.plan !== existing.plan;
    const isDemotion = planChanged && existing.plan === 'pro' && user.plan === 'free';
    const nextPlan: UserPlan = user.plan || existing.plan;
    const nextAdmin =
      typeof user.isAdmin === 'boolean' ? user.isAdmin : Boolean(existing.isAdmin);
    const nextPrevPlan = planChanged ? existing.plan : existing.previousPlan;
    const nextDemotedAt = isDemotion ? now : existing.demotedAt || 0;
    const nextPlanUpdatedAt = planChanged ? now : existing.planUpdatedAt;
    const nextNotes = (user.notes !== undefined ? user.notes : existing.notes || '').slice(0, 1000);

    const updated: UserProfile = {
      ...existing,
      displayName: cleanName,
      email: cleanEmail,
      personas: cleanPersonas,
      plan: nextPlan,
      isAdmin: nextAdmin,
      previousPlan: nextPrevPlan,
      demotedAt: nextDemotedAt > 0 ? nextDemotedAt : undefined,
      planUpdatedAt: nextPlanUpdatedAt,
      notes: nextNotes,
    };

    upsertLocalUserCache(updated);
    if (getCurrentUser().id === updated.id) {
      dispatchPlanEvent(updated);
    }

    if (auth.currentUser) {
      const entRef = doc(db, 'user_entitlements', updated.id);
      updateDoc(entRef, {
        displayName: cleanName,
        personas: cleanPersonas,
        plan: nextPlan,
        isAdmin: nextAdmin,
        previousPlan: nextPrevPlan || 'none',
        demotedAtMs: nextDemotedAt,
        notes: nextNotes,
        planUpdatedAtMs: nextPlanUpdatedAt,
        updatedAt: serverTimestamp(),
      }).catch((err) => {
        try {
          handleFirestoreError(err, OperationType.UPDATE, `user_entitlements/${updated.id}`);
        } catch {
          // Logged
        }
      });

      if (nextAdmin !== Boolean(existing.isAdmin)) {
        setUserAdminStatus(updated.id, nextAdmin);
      }
    }

    return updated;
  }

  const generatedId =
    user.id || 'user_' + now.toString(36) + '_' + Math.random().toString(36).substring(2, 7);
  const nextAdmin =
    typeof user.isAdmin === 'boolean' ? user.isAdmin : isBootstrappedAdminEmail(cleanEmail);
  const nextPlan: UserPlan = user.plan || 'free';
  const nextNotes = (user.notes || 'Pre-provisioned via Admin Console').slice(0, 1000);

  const created: UserProfile = {
    id: generatedId,
    displayName: cleanName,
    email: cleanEmail,
    personas: cleanPersonas,
    onboarded: true,
    plan: nextPlan,
    isAdmin: nextAdmin,
    createdAt: now,
    planUpdatedAt: now,
    notes: nextNotes,
  };

  upsertLocalUserCache(created);

  if (auth.currentUser) {
    setDoc(doc(db, 'user_entitlements', generatedId), {
      userId: generatedId,
      displayName: cleanName,
      email: cleanEmail,
      photoURL: '',
      personas: cleanPersonas,
      onboarded: true,
      plan: nextPlan,
      isAdmin: nextAdmin,
      previousPlan: 'none',
      demotedAtMs: 0,
      notes: nextNotes,
      createdAtMs: now,
      planUpdatedAtMs: now,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).catch((err) => {
      try {
        handleFirestoreError(err, OperationType.CREATE, `user_entitlements/${generatedId}`);
      } catch {
        // Logged
      }
    });

    if (nextAdmin) {
      setUserAdminStatus(generatedId, true);
    }
  }

  return created;
}

export function deleteUserProfile(userId: string): boolean {
  const users = getAllUsers();
  const filtered = users.filter((u) => u.id !== userId);
  saveUsersToStorage(filtered);

  if (auth.currentUser) {
    deleteDoc(doc(db, 'user_entitlements', userId)).catch((err) => {
      try {
        handleFirestoreError(err, OperationType.DELETE, `user_entitlements/${userId}`);
      } catch {
        // Logged
      }
    });
    deleteDoc(doc(db, 'admins', userId)).catch(() => {});
    deleteDoc(doc(db, 'user_stats', userId)).catch(() => {});
    deleteDoc(doc(db, 'upgrade_requests', userId)).catch(() => {});
  }

  return filtered.length !== users.length;
}

// =========================================================================
// UPGRADE REQUESTS WORKFLOW (Free User -> Admin Promotion Queue)
// =========================================================================

export async function submitProUpgradeRequest(payload: {
  organization?: string;
  message: string;
}): Promise<UpgradeRequestRecord> {
  const fbUser = auth.currentUser;
  if (!fbUser) {
    throw new Error('Please sign in with Google first.');
  }

  const current = getCurrentUser();
  const uid = fbUser.uid;
  const reqPath = `upgrade_requests/${uid}`;
  const reqRef = doc(db, 'upgrade_requests', uid);
  const now = Date.now();

  const cleanOrg = (payload.organization || '').trim().slice(0, 160);
  const cleanMsg =
    (payload.message || 'Requesting Pro plan upgrade for match analysis.').trim().slice(0, 1000) ||
    'Requesting Pro plan upgrade for match analysis.';
  const cleanPersonas = ensureNonEmptyPersonas(current.personas);
  const cleanName = sanitizeDisplayName(current.displayName, fbUser.email);
  const cleanEmail = sanitizeEmail(fbUser.email);

  try {
    const existingSnap = await getDoc(reqRef);
    if (existingSnap.exists()) {
      await updateDoc(reqRef, {
        displayName: cleanName,
        personas: cleanPersonas,
        organization: cleanOrg,
        message: cleanMsg,
        status: 'pending',
        reviewedBy: '',
        adminNote: '',
        createdAtMs: now,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(reqRef, {
        userId: uid,
        displayName: cleanName,
        email: cleanEmail,
        personas: cleanPersonas,
        organization: cleanOrg,
        message: cleanMsg,
        status: 'pending',
        reviewedBy: '',
        adminNote: '',
        createdAtMs: now,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, reqPath);
  }

  return {
    userId: uid,
    displayName: cleanName,
    email: cleanEmail,
    personas: cleanPersonas,
    organization: cleanOrg,
    message: cleanMsg,
    status: 'pending',
    reviewedBy: '',
    adminNote: '',
    createdAtMs: now,
  };
}

export function subscribeMyUpgradeRequest(
  userId: string,
  onChange: (req: UpgradeRequestRecord | null) => void
): Unsubscribe {
  if (!userId || userId === 'unauthenticated') {
    onChange(null);
    return () => {};
  }
  const reqRef = doc(db, 'upgrade_requests', userId);
  return onSnapshot(
    reqRef,
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      const d = snap.data();
      onChange({
        userId: snap.id,
        displayName: String(d.displayName || 'User'),
        email: String(d.email || ''),
        personas: normalizeUserPersonas(d.personas),
        organization: String(d.organization || ''),
        message: String(d.message || ''),
        status: (d.status as UpgradeRequestStatus) || 'pending',
        reviewedBy: String(d.reviewedBy || ''),
        adminNote: String(d.adminNote || ''),
        createdAtMs: Number(d.createdAtMs) || Date.now(),
      });
    },
    () => onChange(null)
  );
}

/**
 * Fetch ONLY pending Pro upgrade requests (`where('status', '==', 'pending')`)
 * so historical approved/declined requests are never re-downloaded on every Admin open!
 */
export async function fetchPendingUpgradeRequests(): Promise<UpgradeRequestRecord[]> {
  if (!auth.currentUser || !isCurrentAuthBootstrappedAdmin()) {
    return [];
  }
  try {
    const snap = await getDocs(
      query(collection(db, 'upgrade_requests'), where('status', '==', 'pending'))
    );
    const list: UpgradeRequestRecord[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      list.push({
        userId: docSnap.id,
        displayName: String(d.displayName || 'User'),
        email: String(d.email || ''),
        personas: normalizeUserPersonas(d.personas),
        organization: String(d.organization || ''),
        message: String(d.message || ''),
        status: (d.status as UpgradeRequestStatus) || 'pending',
        reviewedBy: String(d.reviewedBy || ''),
        adminNote: String(d.adminNote || ''),
        createdAtMs: Number(d.createdAtMs) || Date.now(),
      });
    });
    list.sort((a, b) => b.createdAtMs - a.createdAtMs);
    return list;
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.LIST, 'upgrade_requests');
    } catch {
      return [];
    }
  }
}

export function subscribeAllUpgradeRequests(
  onUpdate: (requests: UpgradeRequestRecord[]) => void
): Unsubscribe {
  if (!isCurrentAuthBootstrappedAdmin()) {
    onUpdate([]);
    return () => {};
  }
  let cancelled = false;
  fetchPendingUpgradeRequests()
    .then((list) => {
      if (!cancelled) onUpdate(list);
    })
    .catch(() => {
      if (!cancelled) onUpdate([]);
    });
  return () => {
    cancelled = true;
  };
}

export async function adminResolveUpgradeRequest(
  req: UpgradeRequestRecord,
  decision: 'approved' | 'declined',
  adminNote = ''
): Promise<void> {
  if (!auth.currentUser) return;
  const reviewer = auth.currentUser.email || auth.currentUser.uid;
  const reqRef = doc(db, 'upgrade_requests', req.userId);
  const entRef = doc(db, 'user_entitlements', req.userId);
  const now = Date.now();

  try {
    const batch = writeBatch(db);
    batch.update(reqRef, {
      status: decision,
      reviewedBy: reviewer.slice(0, 254),
      adminNote: adminNote.trim().slice(0, 500),
      updatedAt: serverTimestamp(),
    });

    if (decision === 'approved') {
      const entSnap = await getDoc(entRef);
      const promoNote = (
        adminNote.trim() || 'Approved Pro upgrade request via Admin Console'
      ).slice(0, 1000);
      if (entSnap.exists()) {
        batch.update(entRef, {
          plan: 'pro',
          previousPlan: entSnap.data().plan === 'pro' ? 'pro' : 'free',
          planUpdatedAtMs: now,
          notes: promoNote,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(entRef, {
          userId: req.userId,
          displayName: sanitizeDisplayName(req.displayName, req.email),
          email: sanitizeEmail(req.email),
          photoURL: '',
          personas: ensureNonEmptyPersonas(req.personas),
          onboarded: true,
          plan: 'pro',
          isAdmin: false,
          previousPlan: 'free',
          demotedAtMs: 0,
          notes: promoNote,
          createdAtMs: now,
          planUpdatedAtMs: now,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `upgrade_requests/${req.userId}`);
  }
}

// =========================================================================
// GLOBAL PLATFORM SETTINGS (/app_settings/global)
// =========================================================================

export function getPlatformSettings(): PlatformSettings {
  try {
    const raw = localStorage.getItem(PLATFORM_SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_PLATFORM_SETTINGS,
        ...parsed,
        id: 'global',
      };
    }
  } catch {
    // ignore
  }
  return DEFAULT_PLATFORM_SETTINGS;
}

function savePlatformSettingsCache(settings: PlatformSettings): void {
  try {
    localStorage.setItem(PLATFORM_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(
      new CustomEvent('tacstem_platform_settings_updated', { detail: settings })
    );
  } catch {
    // ignore
  }
}

export function initPlatformSettingsSync(): Unsubscribe {
  if (activeSettingsUnsub) {
    activeSettingsUnsub();
    activeSettingsUnsub = null;
  }
  if (!auth.currentUser) {
    return () => {};
  }

  const ref = doc(db, 'app_settings', 'global');
  activeSettingsUnsub = onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        // Seed default global settings if current user is bootstrapped admin
        if (isCurrentAuthBootstrappedAdmin()) {
          setDoc(ref, {
            ...DEFAULT_PLATFORM_SETTINGS,
            visibility: 'public',
            updatedBy: auth.currentUser!.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
        return;
      }
      const d = snap.data();
      const merged: PlatformSettings = {
        id: 'global',
        freeMaxVideoProjects: Math.max(1, Number(d.freeMaxVideoProjects) || 1),
        freeMaxBoardProjects: Math.max(1, Number(d.freeMaxBoardProjects) || 1),
        freeAllowBatches: Boolean(d.freeAllowBatches),
        allowInstantFreeUpgrade: Boolean(d.allowInstantFreeUpgrade),
        announcementEnabled: Boolean(d.announcementEnabled),
        announcementText: String(d.announcementText || ''),
        announcementLink: String(d.announcementLink || ''),
        academyTitle: String(d.academyTitle || DEFAULT_PLATFORM_SETTINGS.academyTitle),
        academySubtitle: String(d.academySubtitle || DEFAULT_PLATFORM_SETTINGS.academySubtitle),
        supportContactAddress: String(
          d.supportContactAddress || DEFAULT_PLATFORM_SETTINGS.supportContactAddress
        ),
        founderLinkedInUrl: String(
          d.founderLinkedInUrl || DEFAULT_PLATFORM_SETTINGS.founderLinkedInUrl
        ),
        updatedBy: String(d.updatedBy || ''),
      };
      savePlatformSettingsCache(merged);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.GET, 'app_settings/global');
      } catch {
        // Logged
      }
    }
  );

  return activeSettingsUnsub;
}

export async function adminSavePlatformSettings(
  next: Omit<PlatformSettings, 'id'>
): Promise<PlatformSettings> {
  if (!auth.currentUser) {
    throw new Error('Authentication required');
  }
  const ref = doc(db, 'app_settings', 'global');
  const clean: PlatformSettings = {
    id: 'global',
    freeMaxVideoProjects: Math.min(50, Math.max(1, Math.round(next.freeMaxVideoProjects || 1))),
    freeMaxBoardProjects: Math.min(50, Math.max(1, Math.round(next.freeMaxBoardProjects || 1))),
    freeAllowBatches: Boolean(next.freeAllowBatches),
    allowInstantFreeUpgrade: Boolean(next.allowInstantFreeUpgrade),
    announcementEnabled: Boolean(next.announcementEnabled),
    announcementText: (next.announcementText || '').trim().slice(0, 300),
    announcementLink: (next.announcementLink || '').trim().slice(0, 300),
    academyTitle:
      (next.academyTitle || DEFAULT_PLATFORM_SETTINGS.academyTitle).trim().slice(0, 120) ||
      DEFAULT_PLATFORM_SETTINGS.academyTitle,
    academySubtitle: (next.academySubtitle || '').trim().slice(0, 300),
    supportContactAddress: (next.supportContactAddress || '').trim().slice(0, 254),
    founderLinkedInUrl: (next.founderLinkedInUrl || '').trim().slice(0, 300),
    updatedBy: auth.currentUser.uid,
  };

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        freeMaxVideoProjects: clean.freeMaxVideoProjects,
        freeMaxBoardProjects: clean.freeMaxBoardProjects,
        freeAllowBatches: clean.freeAllowBatches,
        allowInstantFreeUpgrade: clean.allowInstantFreeUpgrade,
        announcementEnabled: clean.announcementEnabled,
        announcementText: clean.announcementText,
        announcementLink: clean.announcementLink,
        academyTitle: clean.academyTitle,
        academySubtitle: clean.academySubtitle,
        supportContactAddress: clean.supportContactAddress,
        founderLinkedInUrl: clean.founderLinkedInUrl,
        updatedBy: auth.currentUser.uid,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ...clean,
        visibility: 'public',
        updatedBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'app_settings/global');
  }

  savePlatformSettingsCache(clean);
  return clean;
}

function dispatchPlanEvent(user: UserProfile) {
  const settings = getPlatformSettings();
  const dynamicLimits =
    user.plan === 'pro'
      ? PLAN_CONFIGS.pro
      : {
          ...PLAN_CONFIGS.free,
          maxVideoProjects: settings.freeMaxVideoProjects,
          maxBoardProjects: settings.freeMaxBoardProjects,
          canCreateBatches: settings.freeAllowBatches,
        };
  try {
    window.dispatchEvent(
      new CustomEvent('tacstem_user_plan_updated', {
        detail: {
          user,
          plan: user.plan,
          limits: dynamicLimits,
        },
      })
    );
  } catch {
    // ignore
  }
}

export function canCreateVideoProject(currentCount: number, plan: UserPlan): {
  allowed: boolean;
  reason?: string;
  isGrandfathered?: boolean;
} {
  if (plan === 'pro') {
    return { allowed: true };
  }

  const max = getPlatformSettings().freeMaxVideoProjects || PLAN_CONFIGS.free.maxVideoProjects;
  if (currentCount < max) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Free account limit reached (${currentCount}/${max} video project${max > 1 ? 's' : ''}). Delete an existing project to create a new one, or request a Pro upgrade.`,
    isGrandfathered: currentCount > max,
  };
}

export function canCreateBoardProject(currentCount: number, plan: UserPlan): {
  allowed: boolean;
  reason?: string;
  isGrandfathered?: boolean;
} {
  if (plan === 'pro') {
    return { allowed: true };
  }

  const max = getPlatformSettings().freeMaxBoardProjects || PLAN_CONFIGS.free.maxBoardProjects;
  if (currentCount < max) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Free account limit reached (${currentCount}/${max} tactical board${max > 1 ? 's' : ''}). Delete an existing board to create a new one, or request a Pro upgrade.`,
    isGrandfathered: currentCount > max,
  };
}

export function canCreateBatches(plan: UserPlan): {
  allowed: boolean;
  reason?: string;
} {
  if (plan === 'pro' || getPlatformSettings().freeAllowBatches) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason:
      'Multi-game Batches is a Pro feature. Request a complimentary Pro upgrade or upgrade your account to unlock cross-match batch playlists.',
  };
}
