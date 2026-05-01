import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  count,
  getCountFromServer
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBgu6wGpsomoC9r44QC0aBWqUFjwk8yRZI",
  authDomain: "jlio-de9c4.firebaseapp.com",
  projectId: "jlio-de9c4",
  storageBucket: "jlio-de9c4.firebasestorage.app",
  messagingSenderId: "620411268963",
  appId: "1:620411268963:web:7038fb998374ea5c3f6d56"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global state
let currentUser = null;
let analyticsData = {
  users: 0,
  stories: 0,
  gists: 0,
  questions: 0,
  responses: 0,
  pairs: 0,
  reports: 0,
  activeToday: 0,
  messagestoday: 0
};

let charts = {};
let realTimeListeners = [];

// DOM references
const adminNameEl = document.getElementById('adminName');
const adminEmailEl = document.getElementById('adminEmail');
const logoutBtn = document.getElementById('logoutBtn');
const navItems = document.querySelectorAll('.nav-item');
const adminPages = document.querySelectorAll('.admin-page');
const pageTitle = document.getElementById('pageTitle');
const pageDescription = document.getElementById('pageDescription');
const refreshBtn = document.getElementById('refreshBtn');
const timeRangeSelect = document.getElementById('timeRange');

// Page descriptions
const pageDescriptions = {
  overview: { title: 'Dashboard Overview', desc: 'Real-time analytics and app management' },
  analytics: { title: 'Advanced Analytics', desc: 'Detailed metrics and user engagement' },
  users: { title: 'User Management', desc: 'View and manage user accounts' },
  content: { title: 'Content Management', desc: 'Monitor and moderate user content' },
  moderation: { title: 'Moderation Queue', desc: 'Review flagged content and reports' },
  messaging: { title: 'Messaging Analytics', desc: 'Track messages and conversations' },
  reports: { title: 'User Reports', desc: 'Manage user reports and issues' },
  system: { title: 'System Settings', desc: 'Admin tools and system information' }
};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Admin dashboard v2 loading...');

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = './index.html';
      return;
    }

    const isAdmin = await checkAdminRole(user.uid);
    if (!isAdmin) {
      await signOut(auth);
      window.location.href = './index.html';
      return;
    }

    currentUser = user;
    await initializeDashboard();
  });
});

// Check admin role
async function checkAdminRole(uid) {
  try {
    const adminDoc = await getDoc(doc(db, 'admins', uid));
    return adminDoc.exists() && adminDoc.data().role === 'admin';
  } catch (error) {
    console.error('Error checking admin role:', error);
    return false;
  }
}

// Initialize dashboard
async function initializeDashboard() {
  try {
    console.log('🔧 Initializing dashboard...');

    // Load admin info
    await loadAdminInfo();

    // Setup event listeners
    setupEventListeners();

    // Load initial data
    await loadAllAnalytics();
    await loadOverviewData();
    await initializeCharts();

    // Setup real-time listeners
    setupRealTimeListeners();

    console.log('✅ Dashboard initialized successfully');
  } catch (error) {
    console.error('❌ Dashboard initialization failed:', error);
  }
}

// Load admin info
async function loadAdminInfo() {
  try {
    const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
    if (adminDoc.exists()) {
      const adminData = adminDoc.data();
      adminNameEl.textContent = adminData.name || 'Admin';
    } else {
      adminNameEl.textContent = 'Admin';
    }
    adminEmailEl.textContent = currentUser.email || 'admin@jlio.app';
  } catch (error) {
    console.error('Error loading admin info:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Navigation
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      switchPage(page);
    });
  });

  // Logout
  logoutBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
      window.location.href = './index.html';
    } catch (error) {
      console.error('Logout error:', error);
    }
  });

  // Refresh
  refreshBtn.addEventListener('click', () => {
    loadAllAnalytics();
  });

  // Time range
  timeRangeSelect.addEventListener('change', () => {
    loadAllAnalytics();
  });
}

// Switch page
function switchPage(pageName) {
  // Update navigation
  navItems.forEach(item => item.classList.remove('active'));
  document.querySelector(`[data-page="${pageName}"]`).classList.add('active');

  // Update pages
  adminPages.forEach(page => page.classList.remove('active'));
  document.getElementById(`${pageName}-page`).classList.add('active');

  // Update header
  const pageInfo = pageDescriptions[pageName] || { title: pageName, desc: '' };
  pageTitle.textContent = pageInfo.title;
  pageDescription.textContent = pageInfo.desc;

  // Load page-specific data
  loadPageData(pageName);
}

// Load page-specific data
async function loadPageData(pageName) {
  switch(pageName) {
    case 'overview':
      await loadOverviewData();
      break;
    case 'analytics':
      await loadAnalyticsPage();
      break;
    case 'users':
      await loadUsersPage();
      break;
    case 'content':
      await loadContentPage();
      break;
    case 'moderation':
      await loadModerationPage();
      break;
    case 'messaging':
      await loadMessagingPage();
      break;
    case 'reports':
      await loadReportsPage();
      break;
    case 'system':
      await loadSystemPage();
      break;
  }
}

// Load all analytics
async function loadAllAnalytics() {
  try {
    const timeRange = timeRangeSelect.value;
    const now = new Date();
    let startDate = new Date();

    if (timeRange === '24h') startDate.setDate(now.getDate() - 1);
    else if (timeRange === '7d') startDate.setDate(now.getDate() - 7);
    else if (timeRange === '30d') startDate.setDate(now.getDate() - 30);
    else if (timeRange === '90d') startDate.setDate(now.getDate() - 90);
    else startDate = new Date(0); // All time

    // Get counts from each collection
    const userCount = await getCollectionCount('users');
    const storyCount = await getCollectionCount('stories');
    const gistCount = await getCollectionCount('gists');
    const questionCount = await getCollectionCount('questions');
    const responseCount = await getCollectionCount('responses');
    const pairCount = await getCollectionCount('pairs');
    const reportCount = await getCollectionCount('user_blocks', where('isReport', '==', true));

    analyticsData = {
      users: userCount,
      stories: storyCount,
      gists: gistCount,
      questions: questionCount,
      responses: responseCount,
      pairs: pairCount,
      reports: reportCount,
      activeToday: await getActiveUsersToday(),
      messagesToday: await getMessagestoday()
    };

    console.log('📊 Analytics loaded:', analyticsData);
  } catch (error) {
    console.error('Error loading analytics:', error);
  }
}

// Get collection count
async function getCollectionCount(collectionName, whereClause = null) {
  try {
    let q = query(collection(db, collectionName), limit(1));
    
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error(`Error getting count for ${collectionName}:`, error);
    return 0;
  }
}

// Get active users today
async function getActiveUsersToday() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, 'analytics_events'),
      where('timestamp', '>=', Timestamp.fromDate(today))
    );

    const snapshot = await getDocs(q);
    const userIds = new Set();
    snapshot.forEach(doc => {
      if (doc.data().userId) userIds.add(doc.data().userId);
    });

    return userIds.size;
  } catch (error) {
    console.error('Error getting active users:', error);
    return 0;
  }
}

// Get messages today
async function getMessagestoday() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const q = query(
      collectionGroup(db, 'pair_sessions'),
      where('createdAt', '>=', Timestamp.fromDate(today))
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('Error getting messages:', error);
    return 0;
  }
}

// Load overview data
async function loadOverviewData() {
  try {
    // Update metric cards
    document.getElementById('metricTotalUsers').textContent = analyticsData.users.toLocaleString();
    document.getElementById('metricUsersChange').textContent = `+${analyticsData.activeToday} today`;

    const totalContent = analyticsData.stories + analyticsData.gists + analyticsData.questions;
    document.getElementById('metricTotalContent').textContent = totalContent.toLocaleString();

    document.getElementById('metricActivePairs').textContent = analyticsData.pairs.toLocaleString();
    document.getElementById('metricPendingReports').textContent = analyticsData.reports.toLocaleString();

    // Load recent activity
    await loadRecentActivity();

    // Initialize/update charts
    initializeCharts();
  } catch (error) {
    console.error('Error loading overview data:', error);
  }
}

// Load recent activity
async function loadRecentActivity() {
  try {
    const activityFeed = document.getElementById('activityFeed');
    
    const q = query(
      collection(db, 'analytics_events'),
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      activityFeed.innerHTML = '<div class="activity-placeholder">No recent activity</div>';
      return;
    }

    const activities = snapshot.docs.map(doc => {
      const data = doc.data();
      const time = new Date(data.timestamp?.toDate?.() || Date.now());
      const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      return `
        <div class="activity-item">
          <span>${data.eventType || 'Activity'} - ${data.userId || 'User'}</span>
          <span class="activity-time">${timeStr}</span>
        </div>
      `;
    });

    activityFeed.innerHTML = activities.join('');
  } catch (error) {
    console.error('Error loading activity:', error);
  }
}

// Initialize charts
function initializeCharts() {
  const ctx1 = document.getElementById('userGrowthChart')?.getContext('2d');
  const ctx2 = document.getElementById('contentDistributionChart')?.getContext('2d');
  const ctx3 = document.getElementById('engagementChart')?.getContext('2d');

  if (ctx1) {
    if (charts.userGrowth) charts.userGrowth.destroy();
    charts.userGrowth = new Chart(ctx1, {
      type: 'line',
      data: {
        labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
        datasets: [{
          label: 'New Users',
          data: [12, 19, 3, 5, 2, 3, 8],
          borderColor: '#FAB12F',
          backgroundColor: 'rgba(250, 177, 47, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }
        }
      }
    });
  }

  if (ctx2) {
    if (charts.contentDist) charts.contentDist.destroy();
    charts.contentDist = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: ['Stories', 'Gists', 'Questions'],
        datasets: [{
          data: [analyticsData.stories, analyticsData.gists, analyticsData.questions],
          backgroundColor: ['#FAB12F', '#3b82f6', '#10b981']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  if (ctx3) {
    if (charts.engagement) charts.engagement.destroy();
    charts.engagement = new Chart(ctx3, {
      type: 'bar',
      data: {
        labels: ['Stories', 'Gists', 'Questions', 'Responses'],
        datasets: [{
          label: 'Engagement',
          data: [65, 59, 80, 81],
          backgroundColor: '#FAB12F'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }
}

// Load analytics page
async function loadAnalyticsPage() {
  try {
    document.getElementById('statDAU').textContent = analyticsData.activeToday;
    document.getElementById('statMAU').textContent = analyticsData.users;
    document.getElementById('statTotalStories').textContent = analyticsData.stories;
    document.getElementById('statTotalGists').textContent = analyticsData.gists;
    document.getElementById('statTotalQuestions').textContent = analyticsData.questions;
    document.getElementById('statTotalPairs').textContent = analyticsData.pairs;
  } catch (error) {
    console.error('Error loading analytics page:', error);
  }
}

// Load users page
async function loadUsersPage() {
  try {
    const tableBody = document.getElementById('usersTableBody');
    
    const q = query(
      collection(db, 'users'),
      limit(20)
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      tableBody.innerHTML = '<tr><td colspan="7">No users found</td></tr>';
      return;
    }

    const rows = snapshot.docs.map(doc => {
      const data = doc.data();
      const joinDate = new Date(data.createdAt?.toDate?.() || Date.now());
      const lastActive = new Date(data.lastActive?.toDate?.() || Date.now());
      
      return `
        <tr>
          <td>${doc.id.substring(0, 8)}...</td>
          <td>${data.email || 'N/A'}</td>
          <td>${joinDate.toLocaleDateString()}</td>
          <td>${lastActive.toLocaleDateString()}</td>
          <td>${data.contentCount || 0}</td>
          <td><span class="status-good">Active</span></td>
          <td><button class="action-btn secondary">View</button></td>
        </tr>
      `;
    });

    tableBody.innerHTML = rows.join('');
  } catch (error) {
    console.error('Error loading users:', error);
    document.getElementById('usersTableBody').innerHTML = '<tr><td colspan="7">Error loading users</td></tr>';
  }
}

// Load content page
async function loadContentPage() {
  try {
    const contentGrid = document.getElementById('contentGrid');
    
    const storiesQ = query(collection(db, 'stories'), limit(12));
    const snapshot = await getDocs(storiesQ);
    
    if (snapshot.empty) {
      contentGrid.innerHTML = '<div class="content-placeholder">No content found</div>';
      return;
    }

    const items = snapshot.docs.map(doc => {
      const data = doc.data();
      return `
        <div class="content-item">
          <h4>Story</h4>
          <p>${(data.content || 'No content').substring(0, 100)}...</p>
          <div style="margin-top: 8px; font-size: 12px; color: #666;">
            Replies: ${data.replyCount || 0} | Reactions: ${data.reactions ? Object.values(data.reactions).reduce((a,b) => a+b, 0) : 0}
          </div>
        </div>
      `;
    });

    contentGrid.innerHTML = items.join('');
  } catch (error) {
    console.error('Error loading content:', error);
  }
}

// Load moderation page
async function loadModerationPage() {
  try {
    const queue = document.getElementById('moderationQueue');
    
    // Get flagged content from user_blocks where flagged = true
    const q = query(
      collection(db, 'user_blocks'),
      where('flagged', '==', true)
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      queue.innerHTML = '<div class="queue-placeholder">No flagged content</div>';
      return;
    }

    const items = snapshot.docs.map(doc => {
      const data = doc.data();
      return `
        <div class="moderation-item">
          <div>
            <strong>Reported by:</strong> ${data.reporterId || 'Anonymous'}<br>
            <strong>Reason:</strong> ${data.reason || 'No reason provided'}<br>
            <small>Reported: ${new Date(data.reportedAt?.toDate?.() || Date.now()).toLocaleString()}</small>
          </div>
          <div>
            <button class="action-btn secondary">Review</button>
            <button class="action-btn danger">Remove</button>
          </div>
        </div>
      `;
    });

    queue.innerHTML = items.join('');
  } catch (error) {
    console.error('Error loading moderation:', error);
  }
}

// Load messaging page
async function loadMessagingPage() {
  try {
    document.getElementById('msgStatTotal').textContent = analyticsData.messagesToday;
    document.getElementById('msgStatActive').textContent = analyticsData.pairs;
  } catch (error) {
    console.error('Error loading messaging:', error);
  }
}

// Load reports page
async function loadReportsPage() {
  try {
    const reportsList = document.getElementById('reportsList');
    
    const q = query(collection(db, 'user_blocks'));
    const snapshot = await getDocs(q);
    
    const pending = snapshot.docs.filter(d => !d.data().resolved).length;
    const resolved = snapshot.docs.filter(d => d.data().resolved).length;

    document.getElementById('reportTotal').textContent = snapshot.size;
    document.getElementById('reportPending').textContent = pending;
    document.getElementById('reportResolved').textContent = resolved;

    if (snapshot.empty) {
      reportsList.innerHTML = '<div class="placeholder">No reports</div>';
      return;
    }

    const items = snapshot.docs.slice(0, 10).map(doc => {
      const data = doc.data();
      return `
        <div class="report-item">
          <div>
            <strong>${data.reason || 'General Report'}</strong><br>
            <small>${data.reporterId || 'Anonymous'}</small><br>
            <small>${new Date(data.reportedAt?.toDate?.() || Date.now()).toLocaleString()}</small>
          </div>
          <button class="action-btn secondary">${data.resolved ? 'Resolved' : 'Review'}</button>
        </div>
      `;
    });

    reportsList.innerHTML = items.join('');
  } catch (error) {
    console.error('Error loading reports:', error);
  }
}

// Load system page
async function loadSystemPage() {
  try {
    // System page is mostly static
    const opsLog = document.getElementById('operationsLog');
    opsLog.innerHTML = `<div class="operation-item">Admin dashboard initialized - ${new Date().toLocaleTimeString()}</div>`;
  } catch (error) {
    console.error('Error loading system:', error);
  }
}

// Setup real-time listeners
function setupRealTimeListeners() {
  try {
    // Listen to analytics events
    const analyticsQ = query(
      collection(db, 'analytics_events'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubAnalytics = onSnapshot(analyticsQ, (snapshot) => {
      console.log('📊 Real-time analytics update:', snapshot.size);
      if (document.querySelector('.admin-page.active')?.id === 'overview-page') {
        loadRecentActivity();
      }
    });

    realTimeListeners.push(unsubAnalytics);

    // Listen to pair sessions
    const pairsQ = query(
      collection(db, 'pairs'),
      limit(100)
    );

    const unsubPairs = onSnapshot(pairsQ, (snapshot) => {
      console.log('💬 Real-time pairs update:', snapshot.size);
      analyticsData.pairs = snapshot.size;
    });

    realTimeListeners.push(unsubPairs);
  } catch (error) {
    console.error('Error setting up real-time listeners:', error);
  }
}

// Export functions for global access
window.dashboardAPI = {
  loadAllAnalytics,
  switchPage,
  logout: () => signOut(auth)
};

console.log('✅ Dashboard API loaded');
