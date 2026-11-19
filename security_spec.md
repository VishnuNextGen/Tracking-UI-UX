# Tacstem Firestore Security Specification

## 1. Architecture Boundary
All user workspace media, match videos, tactical board projects, event timelines, and telestration drawings remain 100% local in IndexedDB/OPFS (`TacstemVideosDB`). Firestore stores strictly the cross-user Admin & Platform Control Plane:
1. `/admins/{userId}` — Dynamically promoted admin role markers.
2. `/user_entitlements/{userId}` — Plan entitlement (`free` | `pro`), admin flag, and onboarding persona metadata.
3. `/user_stats/{userId}` — Metadata-only numeric telemetry counts for the Admin Analytics Console.
4. `/upgrade_requests/{userId}` — Pro upgrade requests submitted by Free users for Admin review.
5. `/notifications/{notificationId}` — Broadcast push notifications delivered to authenticated users.
6. `/tutorials/{tutorialId}` — Video Academy tutorial catalog curated by Admins.
7. `/tutorial_folders/{folderId}` — Video Academy curriculum folders curated by Admins.
8. `/app_settings/{settingId}` — Global platform quotas, announcement banner, and upgrade policy (`settingId == 'global'`).

## 2. Core Data Invariants
- **Default Deny**: `match /{document=**} { allow read, write: if false; }` is the first block.
- **No Unauthenticated Access**: Every operation requires `request.auth != null`; Guest login is disabled.
- **Verified Identity**: All non-admin user writes and bootstrapped admin email checks enforce `request.auth.token.email_verified == true`.
- **New Users = Free Users**: Regular users creating `/user_entitlements/{uid}` MUST set `plan == 'free'`, `isAdmin == false`, `previousPlan == 'none'`, `demotedAtMs == 0`, `notes == ''`, and `email == request.auth.token.email`.
- **No Self-Promotion**: Regular users updating `/user_entitlements/{uid}` cannot mutate `plan`, `isAdmin`, `email`, `notes`, or `createdAt` (unless `/app_settings/global.allowInstantFreeUpgrade == true` is explicitly enabled by an Admin, in which case only `free -> pro` transition with `isAdmin` unchanged is permitted).
- **PII Isolation**: Collections storing `email` (`admins`, `user_entitlements`, `user_stats`, `upgrade_requests`) restrict `get` to `isOwner(userId) || isAdmin()` and `list` to `isBootstrappedAdmin() || existing().userId == request.auth.uid`.
- **Zero `get()`/`exists()` in `allow list`**: Every `allow list` rule evaluates only `request.auth` claims and `resource.data` (`existing()`).
- **Server Timestamps**: Every `create` requires `createdAt == request.time && updatedAt == request.time`; every `update` requires `createdAt == existing().createdAt && updatedAt == request.time`.

## 3. "Dirty Dozen" Attack Payloads Blocked
1. **Self-Privilege Escalation on Create**: Regular user creates `/user_entitlements/{uid}` with `{ plan: 'pro', isAdmin: true }` -> Blocked (`incoming().plan == 'free' && incoming().isAdmin == false`).
2. **Self-Promotion on Update**: Regular user updates `/user_entitlements/{uid}` changing `plan` to `'pro'` when `allowInstantFreeUpgrade == false` -> Blocked (`affectedKeys()` & `allowInstantFreeUpgrade` check).
3. **Self-Admin Grant**: Regular user writes `/admins/{uid}` -> Blocked (`isAdmin()` required).
4. **PII Harvesting via List**: Authenticated user lists `/user_entitlements` or `/user_stats` without `where('userId', '==', uid)` -> Blocked (`existing().userId == request.auth.uid` fails on other users' docs).
5. **Cross-User Stats Tampering**: User A writes `/user_stats/userB` -> Blocked (`isOwner(userId)` check).
6. **Unverified Email Spoofing**: Token with `email: 'techguruinkerala@gmail.com'` and `email_verified: false` attempts admin write -> Blocked (`request.auth.token.email_verified == true`).
7. **Timestamp Backdating**: Client passes forged past/future `Timestamp` on `create` or `update` -> Blocked (`== request.time`).
8. **Immutable Ownership Mutation**: Update mutates `userId` or `createdAt` -> Blocked (`incoming().userId == existing().userId && incoming().createdAt == existing().createdAt`).
9. **Schema Pollution (`extra` fields)**: Client injects `{ secretFlag: true }` into `/upgrade_requests/{uid}` -> Blocked (`data.keys().hasOnly(...)` on both `create` and `update`).
10. **Storage Exhaustion**: Client sends 50,000-char `message` or 500-item `projects` map -> Blocked (strict `.size()` upper bounds on all strings, lists, and maps).
11. **Self-Approving Upgrade Request**: Free user creates or updates `/upgrade_requests/{uid}` with `status: 'approved'` -> Blocked (`incoming().status == 'pending'`).
12. **Unauthorized Broadcast / Academy Tampering**: Regular user creates/deletes `/notifications/{id}` or `/tutorials/{id}` -> Blocked (`isAdmin()` required).
