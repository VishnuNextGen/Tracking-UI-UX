import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, getDocs, query, where } from 'firebase/firestore';

const PROJECT_ID = 'demo-tacstem-rules-test';

export async function runSecurityRulesSuite() {
  const rules = readFileSync('firestore.rules', 'utf8');
  const testEnv: RulesTestEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules },
  });

  try {
    // 1. Unauthenticated guest must be denied everywhere
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(unauthDb, 'tutorials', 'tut-basic')));
    await assertFails(getDoc(doc(unauthDb, 'user_entitlements', 'anon')));

    // 2. Regular verified user can create ONLY a free, non-admin entitlement for themselves
    const aliceCtx = testEnv.authenticatedContext('alice_uid', {
      email: 'alice@example.com',
      email_verified: true,
    });
    const aliceDb = aliceCtx.firestore();

    // Attack: Alice tries to self-assign 'pro' on sign-up -> FAILS
    await assertFails(
      setDoc(doc(aliceDb, 'user_entitlements', 'alice_uid'), {
        userId: 'alice_uid',
        displayName: 'Alice Analyst',
        email: 'alice@example.com',
        photoURL: '',
        personas: ['analyst'],
        onboarded: false,
        plan: 'pro',
        isAdmin: false,
        previousPlan: 'none',
        demotedAtMs: 0,
        notes: '',
        createdAtMs: Date.now(),
        planUpdatedAtMs: Date.now(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Valid Free user bootstrap -> SUCCEEDS
    await assertSucceeds(
      setDoc(doc(aliceDb, 'user_entitlements', 'alice_uid'), {
        userId: 'alice_uid',
        displayName: 'Alice Analyst',
        email: 'alice@example.com',
        photoURL: '',
        personas: ['analyst'],
        onboarded: false,
        plan: 'free',
        isAdmin: false,
        previousPlan: 'none',
        demotedAtMs: 0,
        notes: '',
        createdAtMs: Date.now(),
        planUpdatedAtMs: Date.now(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Attack: Alice tries to self-promote via updateDoc -> FAILS
    await assertFails(
      updateDoc(doc(aliceDb, 'user_entitlements', 'alice_uid'), {
        plan: 'pro',
        updatedAt: serverTimestamp(),
      })
    );

    // Valid onboarding persona update by Alice -> SUCCEEDS
    await assertSucceeds(
      updateDoc(doc(aliceDb, 'user_entitlements', 'alice_uid'), {
        displayName: 'Alice Head Analyst',
        personas: ['analyst', 'coach'],
        onboarded: true,
        updatedAt: serverTimestamp(),
      })
    );

    // 3. Bootstrapped Admin (verified email) can promote Alice & broadcast notifications
    const adminCtx = testEnv.authenticatedContext('admin_uid', {
      email: 'techguruinkerala@gmail.com',
      email_verified: true,
    });
    const adminDb = adminCtx.firestore();

    await assertSucceeds(
      updateDoc(doc(adminDb, 'user_entitlements', 'alice_uid'), {
        plan: 'pro',
        previousPlan: 'free',
        planUpdatedAtMs: Date.now(),
        notes: 'Promoted by Admin',
        updatedAt: serverTimestamp(),
      })
    );

    // Attack: Unverified spoofed admin email -> FAILS
    const spoofAdminDb = testEnv
      .authenticatedContext('spoof_uid', {
        email: 'techguruinkerala@gmail.com',
        email_verified: false,
      })
      .firestore();
    await assertFails(
      updateDoc(doc(spoofAdminDb, 'user_entitlements', 'alice_uid'), {
        plan: 'free',
        updatedAt: serverTimestamp(),
      })
    );

    // Attack: Bob tries to read Alice's PII entitlement or list all entitlements -> FAILS
    const bobDb = testEnv
      .authenticatedContext('bob_uid', {
        email: 'bob@example.com',
        email_verified: true,
      })
      .firestore();
    await assertFails(getDoc(doc(bobDb, 'user_entitlements', 'alice_uid')));
    await assertFails(getDocs(collection(bobDb, 'user_entitlements')));

    // Admin listing all entitlements -> SUCCEEDS
    await assertSucceeds(getDocs(collection(adminDb, 'user_entitlements')));

    // Admin creates public notification -> SUCCEEDS, Alice queries public notifications -> SUCCEEDS
    await assertSucceeds(
      setDoc(doc(adminDb, 'notifications', 'notif_1'), {
        id: 'notif_1',
        title: 'New Tactical Board Update',
        message: 'Check out curved passing corridors.',
        category: 'feature',
        targetAudience: 'all',
        priority: 'high',
        linkType: 'tab',
        link: 'board',
        sentBy: 'Tacstem Admin',
        authorId: 'admin_uid',
        visibility: 'public',
        timestampMs: Date.now(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    await assertSucceeds(
      getDocs(query(collection(aliceDb, 'notifications'), where('visibility', '==', 'public')))
    );
  } finally {
    await testEnv.cleanup();
  }
}
