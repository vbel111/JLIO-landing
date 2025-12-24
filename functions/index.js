const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

async function verifyAdmin(uid) {
  if (!uid) return false;
  try {
    const doc = await db.collection('admins').doc(uid).get();
    return doc.exists && doc.data().role === 'admin';
  } catch (err) {
    console.error('verifyAdmin error:', err);
    return false;
  }
}

exports.adminDisableUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  const callerUid = context.auth.uid;
  const allowed = await verifyAdmin(callerUid);
  if (!allowed) throw new functions.https.HttpsError('permission-denied', 'Admin privileges required');

  const { userId, reason } = data || {};
  if (!userId) throw new functions.https.HttpsError('invalid-argument', 'userId is required');

  try {
    // Disable Firebase Auth user
    await admin.auth().updateUser(userId, { disabled: true });
    // Revoke tokens
    await admin.auth().revokeRefreshTokens(userId);

    // Update users doc
    await db.collection('users').doc(userId).set({
      banned: true,
      bannedAt: admin.firestore.FieldValue.serverTimestamp(),
      bannedBy: callerUid,
      bannedReason: reason || 'Admin action'
    }, { merge: true });

    // Audit log
    await db.collection('adminAuditLogs').add({
      action: 'disableUser',
      targetUserId: userId,
      reason: reason || null,
      adminId: callerUid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      adminEmail: context.auth.token.email || null
    });

    return { success: true };
  } catch (err) {
    console.error('adminDisableUser failed:', err);
    throw new functions.https.HttpsError('internal', 'Failed to disable user');
  }
});

exports.adminUnbanUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  const callerUid = context.auth.uid;
  const allowed = await verifyAdmin(callerUid);
  if (!allowed) throw new functions.https.HttpsError('permission-denied', 'Admin privileges required');

  const { userId, reason } = data || {};
  if (!userId) throw new functions.https.HttpsError('invalid-argument', 'userId is required');

  try {
    await admin.auth().updateUser(userId, { disabled: false });

    await db.collection('users').doc(userId).set({
      banned: false,
      unbannedAt: admin.firestore.FieldValue.serverTimestamp(),
      unbannedBy: callerUid,
      unbannedReason: reason || 'Admin action'
    }, { merge: true });

    await db.collection('adminAuditLogs').add({
      action: 'unbanUser',
      targetUserId: userId,
      reason: reason || null,
      adminId: callerUid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      adminEmail: context.auth.token.email || null
    });

    return { success: true };
  } catch (err) {
    console.error('adminUnbanUser failed:', err);
    throw new functions.https.HttpsError('internal', 'Failed to unban user');
  }
});

exports.adminDeleteStory = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  const callerUid = context.auth.uid;
  const allowed = await verifyAdmin(callerUid);
  if (!allowed) throw new functions.https.HttpsError('permission-denied', 'Admin privileges required');

  const { storyId } = data || {};
  if (!storyId) throw new functions.https.HttpsError('invalid-argument', 'storyId is required');

  try {
    const storyRef = db.collection('stories').doc(storyId);
    const storySnap = await storyRef.get();
    if (!storySnap.exists) return { success: false, message: 'Story not found' };

    // Delete replies/comments associated with the story (best-effort)
    const repliesQuery = await db.collection('replies').where('storyId', '==', storyId).get();
    const batch = db.batch();
    repliesQuery.forEach(doc => batch.delete(doc.ref));

    batch.delete(storyRef);
    await batch.commit();

    await db.collection('adminAuditLogs').add({
      action: 'deleteStory',
      targetStoryId: storyId,
      adminId: callerUid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      adminEmail: context.auth.token.email || null
    });

    return { success: true };
  } catch (err) {
    console.error('adminDeleteStory failed:', err);
    throw new functions.https.HttpsError('internal', 'Failed to delete story');
  }
});

exports.adminRewardJLios = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  const callerUid = context.auth.uid;
  const allowed = await verifyAdmin(callerUid);
  if (!allowed) throw new functions.https.HttpsError('permission-denied', 'Admin privileges required');

  const { userId, amount, reason } = data || {};
  const numericAmount = Number(amount || 0);
  if (!userId || isNaN(numericAmount) || numericAmount <= 0) throw new functions.https.HttpsError('invalid-argument', 'userId and positive amount are required');

  try {
    const balanceRef = db.collection('jliosBalances').doc(userId);
    const txRef = db.collection('jliosTransactions').doc();

    await db.runTransaction(async (tx) => {
      const balDoc = await tx.get(balanceRef);
      const current = (balDoc.exists && (balDoc.data().balance || 0)) || 0;
      const updated = current + numericAmount;
      tx.set(balanceRef, { balance: updated }, { merge: true });
      tx.set(txRef, {
        userId,
        amount: numericAmount,
        type: 'earn',
        reason: reason || 'admin_reward',
        adminId: callerUid,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await db.collection('adminAuditLogs').add({
      action: 'rewardJLios',
      targetUserId: userId,
      amount: numericAmount,
      reason: reason || null,
      adminId: callerUid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      adminEmail: context.auth.token.email || null
    });

    return { success: true };
  } catch (err) {
    console.error('adminRewardJLios failed:', err);
    throw new functions.https.HttpsError('internal', 'Failed to reward JLios');
  }
});

// Lightweight audit logger for warnings
exports.adminLogWarning = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  const callerUid = context.auth.uid;
  const allowed = await verifyAdmin(callerUid);
  if (!allowed) throw new functions.https.HttpsError('permission-denied', 'Admin privileges required');

  const { userId, reason } = data || {};
  if (!userId || !reason) throw new functions.https.HttpsError('invalid-argument', 'userId and reason required');

  try {
    await db.collection('adminAuditLogs').add({
      action: 'warnUser',
      targetUserId: userId,
      reason,
      adminId: callerUid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      adminEmail: context.auth.token.email || null
    });
    return { success: true };
  } catch (err) {
    console.error('adminLogWarning failed:', err);
    throw new functions.https.HttpsError('internal', 'Failed to log warning');
  }
});
