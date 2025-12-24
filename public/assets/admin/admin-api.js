import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js';

// Duplicate firebaseConfig (match dashboard.js)
const firebaseConfig = {
  apiKey: "AIzaSyBgu6wGpsomoC9r44QC0aBWqUFjwk8yRZI",
  authDomain: "jlio-de9c4.firebaseapp.com",
  projectId: "jlio-de9c4",
  storageBucket: "jlio-de9c4.firebasestorage.app",
  messagingSenderId: "620411268963",
  appId: "1:620411268963:web:7038fb998374ea5c3f6d56"
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

// Helper to call cloud functions with unified error handling
async function callFn(name, payload) {
  try {
    const fn = httpsCallable(functions, name);
    const res = await fn(payload);
    return res.data;
  } catch (err) {
    console.error(`Function ${name} error:`, err);
    throw err;
  }
}

// Admin actions
export async function adminDisableUser(userId, reason = 'Manual admin action') {
  return callFn('adminDisableUser', { userId, reason });
}

export async function adminUnbanUser(userId, reason = 'Manual admin action') {
  return callFn('adminUnbanUser', { userId, reason });
}

export async function adminDeleteStory(storyId) {
  return callFn('adminDeleteStory', { storyId });
}

export async function adminRewardJLios(userId, amount, reason = 'Admin reward') {
  return callFn('adminRewardJLios', { userId, amount, reason });
}

// Preserve originals (if present) so we can call them as fallback
const _orig = {
  banUserFromModal: window.banUserFromModal,
  unbanUser: window.unbanUser,
  banUser: window.banUser,
  warnUserFromModal: window.warnUserFromModal,
  resolveReport: window.resolveReport,
  closeModal: window.closeModal,
  loadUsersData: window.loadUsersData
};

// Override client-side modal actions (fallback to safe confirmations)
window.banUserFromModal = async function(userId) {
  if (!confirm('Are you sure you want to ban this user?')) return;
  try {
    await adminDisableUser(userId, 'Banned from admin dashboard');
    alert('User has been banned (Auth disabled + user record updated).');
    if (typeof _orig.loadUsersData === 'function') _orig.loadUsersData();
    if (typeof _orig.closeModal === 'function') _orig.closeModal('userModal');
  } catch (err) {
    alert('Failed to ban user. See console for details.');
  }
};

window.unbanUser = async function(userId) {
  if (!confirm('Are you sure you want to unban this user?')) return;
  try {
    await adminUnbanUser(userId, 'Unbanned by admin');
    alert('User has been unbanned.');
    if (typeof _orig.loadUsersData === 'function') _orig.loadUsersData();
    if (typeof _orig.closeModal === 'function') _orig.closeModal('userModal');
  } catch (err) {
    alert('Failed to unban user. See console for details.');
  }
};

window.banUser = async function(userId, reportId) {
  if (!confirm('Ban this user and resolve report?')) return;
  try {
    await adminDisableUser(userId, `Report: ${reportId}`);
    if (typeof _orig.resolveReport === 'function') await _orig.resolveReport(reportId, 'resolved');
    alert('User banned and report resolved.');
  } catch (err) {
    alert('Failed to ban user. See console for details.');
  }
};

window.warnUserFromModal = async function(userId) {
  const reason = prompt('Enter warning reason:');
  if (!reason) return;
  try {
    // Log warning server-side for audit
    await callFn('adminLogWarning', { userId, reason });
    // Fallback: call original client function if present to update warnings array
    if (typeof _orig.warnUserFromModal === 'function') {
      try { _orig.warnUserFromModal(userId); } catch (e) { /* ignore */ }
    }
    alert('Warning recorded.');
    if (typeof _orig.loadUsersData === 'function') _orig.loadUsersData();
    if (typeof _orig.closeModal === 'function') _orig.closeModal('userModal');
  } catch (err) {
    console.error('Warning log failed:', err);
    alert('Failed to record warning. See console for details.');
  }
};

// Expose API helpers globally for ad-hoc calls
window.adminApi = {
  disableUser: adminDisableUser,
  unbanUser: adminUnbanUser,
  deleteStory: adminDeleteStory,
  rewardJLios: adminRewardJLios
};

console.log('🔌 Admin API wrappers loaded');
