import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
    getAuth,
    onAuthStateChanged,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    addDoc,
    collection,
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
    where
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import SecuritySystem from './security-system.js';

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
let realTimeListeners = [];
let charts = {};
let securitySystem = null;

// DOM elements
const adminNameEl = document.getElementById('adminName');
const logoutBtn = document.getElementById('logoutBtn');
const navTabs = document.querySelectorAll('.nav-tab');
const adminPages = document.querySelectorAll('.admin-page');

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Admin dashboard loading...');
  
  // Check authentication
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = './index.html';
      return;
    }
    
    // Verify admin role
    const isAdmin = await checkAdminRole(user.uid);
    if (!isAdmin) {
      await signOut(auth);
      window.location.href = './index.html';
      return;
    }
    
    currentUser = user;
    
    // Initialize security system
    securitySystem = new SecuritySystem(db, auth);
    
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
    
    // Setup navigation
    setupNavigation();
    
    // Load overview data
    await loadOverviewData();
    
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
      adminNameEl.textContent = adminData.name || currentUser.email;
    } else {
      adminNameEl.textContent = currentUser.email;
    }
  } catch (error) {
    console.error('Error loading admin info:', error);
    adminNameEl.textContent = 'Admin';
  }
}

// Setup navigation
function setupNavigation() {
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const page = tab.dataset.page;
      switchPage(page);
    });
  });
  
  logoutBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
      window.location.href = './index.html';
    } catch (error) {
      console.error('Logout error:', error);
    }
  });
}

// Switch page
window.switchPage = function(page) {
  // Update nav tabs
  navTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.page === page);
  });
  
  // Update pages
  adminPages.forEach(pageEl => {
    pageEl.classList.toggle('active', pageEl.id === `${page}-page`);
  });
  
  // Load page-specific data
  switch (page) {
    case 'overview':
      loadOverviewData();
      break;
    case 'moderation':
      loadModerationData();
      break;
    case 'security':
      loadSecurityData();
      break;
    case 'analytics':
      loadAnalyticsData();
      break;
    case 'users':
      loadUsersData();
      break;
  }
};

// Setup real-time listeners for actual app data
function setupRealTimeListeners() {
  // Listen to reports for real-time moderation updates
  const reportsQuery = query(
    collection(db, 'reports'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );
  
  const unsubscribeReports = onSnapshot(reportsQuery, (snapshot) => {
    const pendingCount = snapshot.size;
    document.getElementById('pendingReports').textContent = pendingCount;
    
    // Count critical reports
    let criticalCount = 0;
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.priority === 'critical') {
        criticalCount++;
      }
    });
    
    if (criticalCount > 0) {
      document.getElementById('reportsChange').textContent = `${criticalCount} Critical`;
      document.getElementById('reportsChange').classList.add('urgent');
    } else if (pendingCount > 0) {
      document.getElementById('reportsChange').textContent = 'Need Review';
      document.getElementById('reportsChange').classList.add('urgent');
    } else {
      document.getElementById('reportsChange').textContent = 'All Clear';
      document.getElementById('reportsChange').classList.remove('urgent');
    }
  });
  
  realTimeListeners.push(unsubscribeReports);
  
  // Listen to new users from actual users collection
  const usersQuery = query(
    collection(db, 'users'),
    orderBy('joinedAt', 'desc'),
    limit(100)
  );
  
  const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
    const totalUsers = snapshot.size;
    document.getElementById('totalUsers').textContent = totalUsers;
    
    // Count today's new users
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = Timestamp.fromDate(today);
    
    let todayCount = 0;
    snapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.joinedAt && userData.joinedAt >= todayTimestamp) {
        todayCount++;
      }
    });
    
    document.getElementById('usersChange').textContent = `+${todayCount} today`;
  });
  
  realTimeListeners.push(unsubscribeUsers);
  
  // Listen to active chat sessions
  const sessionsQuery = query(
    collection(db, 'pair_sessions'),
    where('status', '==', 'active')
  );
  
  const unsubscribeSessions = onSnapshot(sessionsQuery, (snapshot) => {
    const activeSessions = snapshot.size;
    console.log(`🔗 Active chat sessions: ${activeSessions}`);
  });
  
  realTimeListeners.push(unsubscribeSessions);
}

// Load overview data
async function loadOverviewData() {
  try {
    console.log('📊 Loading overview data...');
    
    // Load users count from the actual users collection
    const usersSnapshot = await getDocs(collection(db, 'users'));
    document.getElementById('totalUsers').textContent = usersSnapshot.size;
    
    // Load stories count from the actual stories collection
    const storiesSnapshot = await getDocs(collection(db, 'stories'));
    document.getElementById('totalStories').textContent = storiesSnapshot.size;
    
    // Load chats count (both regular chats and pair sessions)
    const chatsSnapshot = await getDocs(collection(db, 'chats'));
    const sessionsSnapshot = await getDocs(collection(db, 'pair_sessions'));
    const totalChats = chatsSnapshot.size + sessionsSnapshot.size;
    document.getElementById('totalChats').textContent = totalChats;
    
    // Load questions count from actual questions collection
    const questionsSnapshot = await getDocs(collection(db, 'questions'));
    const questionsCount = questionsSnapshot.size;
    
    // Load responses count
    const responsesSnapshot = await getDocs(collection(db, 'responses'));
    const responsesCount = responsesSnapshot.size;
    
    // Load recent activity from actual app data
    await loadRecentActivity();
    
    // Load JLios economy data
    await loadJLiosStats();
    
  } catch (error) {
    console.error('Error loading overview data:', error);
  }
}

// Load JLios economy statistics
async function loadJLiosStats() {
  try {
    // Load JLios balances
    const balancesSnapshot = await getDocs(collection(db, 'jliosBalances'));
    let totalJLiosInCirculation = 0;
    balancesSnapshot.forEach(doc => {
      const data = doc.data();
      totalJLiosInCirculation += data.balance || 0;
    });
    
    // Load recent transactions
    const transactionsQuery = query(
      collection(db, 'jliosTransactions'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    const transactionsSnapshot = await getDocs(transactionsQuery);
    
    let todayEarned = 0;
    let todaySpent = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    transactionsSnapshot.forEach(doc => {
      const data = doc.data();
      const transactionDate = data.createdAt?.toDate();
      
      if (transactionDate && transactionDate >= today) {
        if (data.type === 'earn') {
          todayEarned += data.amount || 0;
        } else if (data.type === 'spend') {
          todaySpent += data.amount || 0;
        }
      }
    });
    
    console.log(`💰 JLios Stats: ${totalJLiosInCirculation} total, +${todayEarned} earned today, -${todaySpent} spent today`);
    
  } catch (error) {
    console.error('Error loading JLios stats:', error);
  }
}

// Load recent activity from actual app collections
async function loadRecentActivity() {
  try {
    const activities = [];
    
    // Get recent reports from actual reports collection
    const reportsQuery = query(
      collection(db, 'reports'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const reportsSnapshot = await getDocs(reportsQuery);
    
    reportsSnapshot.forEach(doc => {
      const data = doc.data();
      activities.push({
        type: 'report',
        icon: '🚨',
        title: `New ${data.reason || 'content'} report`,
        description: `Reported by user in ${data.category || 'general'} category`,
        time: formatTimeAgo(safeTimestampToDate(data.createdAt)),
        timestamp: safeTimestampToDate(data.createdAt) || new Date(),
        priority: data.priority || 'medium'
      });
    });
    
    // Get recent user registrations from actual users collection
    const usersQuery = query(
      collection(db, 'users'),
      orderBy('joinedAt', 'desc'),
      limit(5)
    );
    const usersSnapshot = await getDocs(usersQuery);
    
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      activities.push({
        type: 'user',
        icon: '👤',
        title: 'New user registered',
        description: `@${data.username || 'unknown'} joined from ${data.country || 'unknown location'}`,
        time: formatTimeAgo(data.joinedAt?.toDate()),
        timestamp: data.joinedAt?.toDate() || new Date()
      });
    });
    
    // Get recent stories from actual stories collection
    const storiesQuery = query(
      collection(db, 'stories'),
      orderBy('createdAt', 'desc'),
      limit(3)
    );
    const storiesSnapshot = await getDocs(storiesQuery);
    
    storiesSnapshot.forEach(doc => {
      const data = doc.data();
      activities.push({
        type: 'story',
        icon: '📖',
        title: 'New story posted',
        description: `Anonymous story with ${data.replyCount || 0} replies`,
        time: formatTimeAgo(data.createdAt?.toDate()),
        timestamp: data.createdAt?.toDate() || new Date()
      });
    });
    
    // Get recent questions from actual questions collection
    const questionsQuery = query(
      collection(db, 'questions'),
      orderBy('createdAt', 'desc'),
      limit(3)
    );
    const questionsSnapshot = await getDocs(questionsQuery);
    
    questionsSnapshot.forEach(doc => {
      const data = doc.data();
      activities.push({
        type: 'question',
        icon: '❓',
        title: 'New question submitted',
        description: `Question sent to user`,
        time: formatTimeAgo(data.createdAt?.toDate()),
        timestamp: data.createdAt?.toDate() || new Date()
      });
    });
    
    // Sort by timestamp and display
    activities.sort((a, b) => b.timestamp - a.timestamp);
    displayActivities(activities.slice(0, 10));
    
  } catch (error) {
    console.error('Error loading recent activity:', error);
  }
}

// Display activities
function displayActivities(activities) {
  const activityList = document.getElementById('recentActivity');
  
  if (activities.length === 0) {
    activityList.innerHTML = '<div class="activity-item loading">No recent activity</div>';
    return;
  }
  
  activityList.innerHTML = activities.map(activity => `
    <div class="activity-item">
      <div class="activity-icon">${activity.icon}</div>
      <div class="activity-content">
        <h4>${activity.title}</h4>
        <p>${activity.description}</p>
      </div>
      <div class="activity-time">${activity.time}</div>
    </div>
  `).join('');
}

// Load moderation data
async function loadModerationData() {
  console.log('🛡️ Loading moderation data...');
  
  try {
    const reportsQuery = query(
      collection(db, 'reports'),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(reportsQuery);
    const reports = [];
    
    snapshot.forEach(doc => {
      reports.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    displayReports(reports);
    
  } catch (error) {
    console.error('Error loading moderation data:', error);
    document.getElementById('reportsList').innerHTML = 
      '<div class="loading-placeholder">Error loading reports</div>';
  }
}

// Display reports with actual app report structure
function displayReports(reports) {
  const reportsList = document.getElementById('reportsList');
  
  if (reports.length === 0) {
    reportsList.innerHTML = '<div class="loading-placeholder">No reports found</div>';
    return;
  }
  
  reportsList.innerHTML = reports.map(report => {
    const priorityIcon = {
      low: '🔵',
      medium: '🟡', 
      high: '🟠',
      critical: '🔴'
    }[report.priority] || '🟡';
    
    const categoryIcon = {
      message: '💬',
      user_behavior: '👤',
      voice_note: '🎤',
      general: '📋'
    }[report.category] || '📋';
    
    return `
      <div class="report-item" onclick="openReportModal('${report.id}')">
        <div class="item-header">
          <div class="item-title">
            ${priorityIcon} ${categoryIcon} ${report.reason?.replace('_', ' ') || 'General'} Report
          </div>
          <div class="item-status status-${report.status || 'pending'}">
            ${(report.status || 'pending').toUpperCase()}
          </div>
        </div>
        <div class="item-content">
          <p><strong>Category:</strong> ${report.category || 'general'}</p>
          <p><strong>Priority:</strong> ${report.priority || 'medium'}</p>
          <p><strong>Reported User:</strong> ${report.reportedUserId || 'Unknown'}</p>
          <p><strong>Reporter:</strong> ${report.reporterId || 'Anonymous'}</p>
          <p><strong>Time:</strong> ${formatTimeAgo(report.createdAt?.toDate())}</p>
          ${report.description ? `<p><strong>Details:</strong> ${report.description}</p>` : ''}
          ${report.evidence?.messageText ? `<p><strong>Message:</strong> "${report.evidence.messageText}"</p>` : ''}
          ${report.sessionId ? `<p><strong>Session ID:</strong> ${report.sessionId}</p>` : ''}
          ${report.chatId ? `<p><strong>Chat ID:</strong> ${report.chatId}</p>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Open report modal
window.openReportModal = async function(reportId) {
  try {
    const reportDoc = await getDoc(doc(db, 'reports', reportId));
    if (!reportDoc.exists()) return;
    
    const reportData = { id: reportId, ...reportDoc.data() };
    
    // Get reported user info
    let reportedUserInfo = 'Unknown User';
    if (reportData.reportedUserId) {
      try {
        const userDoc = await getDoc(doc(db, 'users', reportData.reportedUserId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          reportedUserInfo = `@${userData.username || 'unknown'} (${userData.country || 'Unknown location'})`;
        }
      } catch (error) {
        console.error('Error loading user info:', error);
      }
    }
    
    const modalBody = document.getElementById('reportModalBody');
    modalBody.innerHTML = `
      <div class="report-details">
        <div class="detail-section">
          <h4>Report Information</h4>
          <p><strong>Report ID:</strong> ${reportData.id}</p>
          <p><strong>Type:</strong> ${reportData.reason || 'General'}</p>
          <p><strong>Status:</strong> <span class="status-${reportData.status || 'pending'}">${(reportData.status || 'pending').toUpperCase()}</span></p>
          <p><strong>Reported:</strong> ${formatTimeAgo(reportData.createdAt?.toDate())}</p>
        </div>
        
        <div class="detail-section">
          <h4>Users Involved</h4>
          <p><strong>Reported User:</strong> ${reportedUserInfo}</p>
          <p><strong>Reporter:</strong> ${reportData.reporterId || 'Anonymous'}</p>
        </div>
        
        ${reportData.description ? `
          <div class="detail-section">
            <h4>Report Details</h4>
            <p>${reportData.description}</p>
          </div>
        ` : ''}
        
        ${reportData.chatId || reportData.sessionId ? `
          <div class="detail-section">
            <h4>Context</h4>
            <p><strong>Chat/Session ID:</strong> ${reportData.chatId || reportData.sessionId}</p>
          </div>
        ` : ''}
        
        ${reportData.status === 'pending' ? `
          <div class="detail-section">
            <h4>Actions</h4>
            <div style="display: flex; gap: 10px; margin-top: 10px;">
              <button class="action-btn" style="background: var(--secondary-color); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;" onclick="resolveReport('${reportData.id}', 'resolved')">
                ✅ Resolve Report
              </button>
              <button class="action-btn" style="background: var(--danger-color); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;" onclick="banUser('${reportData.reportedUserId}', '${reportData.id}')">
                🚫 Ban User
              </button>
              <button class="action-btn" style="background: var(--warning-color); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;" onclick="warnUser('${reportData.reportedUserId}', '${reportData.id}')">
                ⚠️ Warn User
              </button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
    
    document.getElementById('reportModal').classList.add('active');
    
  } catch (error) {
    console.error('Error opening report modal:', error);
  }
};

// Resolve report
window.resolveReport = async function(reportId, status) {
  try {
    await updateDoc(doc(db, 'reports', reportId), {
      status: status,
      resolvedAt: serverTimestamp(),
      resolvedBy: currentUser.uid
    });
    
    closeModal('reportModal');
    loadModerationData(); // Refresh the reports list
    
    console.log(`Report ${reportId} marked as ${status}`);
  } catch (error) {
    console.error('Error resolving report:', error);
  }
};

// Ban user
window.banUser = async function(userId, reportId) {
  if (!confirm('Are you sure you want to ban this user? This action cannot be undone.')) {
    return;
  }
  
  try {
    // Update user status
    await updateDoc(doc(db, 'users', userId), {
      banned: true,
      bannedAt: serverTimestamp(),
      bannedBy: currentUser.uid,
      bannedReason: `Report: ${reportId}`
    });
    
    // Resolve the report
    await resolveReport(reportId, 'resolved');
    
    console.log(`User ${userId} has been banned`);
  } catch (error) {
    console.error('Error banning user:', error);
  }
};

// Warn user
window.warnUser = async function(userId, reportId) {
  try {
    // Add warning to user record
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const warnings = userData.warnings || [];
      warnings.push({
        date: serverTimestamp(),
        reason: `Report: ${reportId}`,
        adminId: currentUser.uid
      });
      
      await updateDoc(userRef, { warnings });
    }
    
    // Resolve the report
    await resolveReport(reportId, 'resolved');
    
    console.log(`Warning issued to user ${userId}`);
  } catch (error) {
    console.error('Error warning user:', error);
  }
};

// Load analytics data
async function loadAnalyticsData() {
  console.log('📈 Loading analytics data...');
  
  try {
    // User growth chart
    await createUserGrowthChart();
    
    // Activity chart
    await createActivityChart();
    
    // Feature usage chart
    await createFeatureChart();
    
    // Economy chart
    await createEconomyChart();
    
  } catch (error) {
    console.error('Error loading analytics data:', error);
  }
}

// Helper function to safely convert timestamps
function safeTimestampToDate(timestamp) {
  if (!timestamp) return null;
  
  // Handle Firestore Timestamp objects
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  
  // Handle JavaScript Date objects
  if (timestamp instanceof Date) {
    return timestamp;
  }
  
  // Handle timestamp numbers (milliseconds)
  if (typeof timestamp === 'number') {
    return new Date(timestamp);
  }
  
  // Handle ISO string dates
  if (typeof timestamp === 'string') {
    return new Date(timestamp);
  }
  
  // Handle objects with seconds/nanoseconds (Firestore timestamp format)
  if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
    return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
  }
  
  return null;
}

// Create user growth chart
async function createUserGrowthChart() {
  const ctx = document.getElementById('userGrowthChart');
  if (!ctx) return;
  
  try {
    // Get users data
    const usersSnapshot = await getDocs(
      query(collection(db, 'users'), orderBy('createdAt', 'asc'))
    );
    
    // Process data for last 30 days
    const last30Days = getLast30Days();
    const growthData = last30Days.map(date => {
      const count = Array.from(usersSnapshot.docs).filter(doc => {
        const userData = doc.data();
        const userDate = safeTimestampToDate(userData.createdAt);
        return userDate && isSameDay(userDate, date);
      }).length;
      return count;
    });
    
    // Cumulative growth
    const cumulativeData = [];
    let total = 0;
    growthData.forEach(count => {
      total += count;
      cumulativeData.push(total);
    });
    
    if (charts.userGrowth) {
      charts.userGrowth.destroy();
    }
    
    charts.userGrowth = new Chart(ctx, {
      type: 'line',
      data: {
        labels: last30Days.map(date => formatDate(date)),
        datasets: [{
          label: 'Total Users',
          data: cumulativeData,
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Error creating user growth chart:', error);
  }
}

// Create activity chart
async function createActivityChart() {
  const ctx = document.getElementById('activityChart');
  if (!ctx) return;
  
  try {
    // Get activity data from multiple collections
    const [storiesSnapshot, chatsSnapshot, questionsSnapshot] = await Promise.all([
      getDocs(collection(db, 'stories')),
      getDocs(collection(db, 'chats')),
      getDocs(collection(db, 'questions'))
    ]);
    
    const last7Days = getLast7Days();
    const storiesData = countByDay(storiesSnapshot, last7Days);
    const chatsData = countByDay(chatsSnapshot, last7Days);
    const questionsData = countByDay(questionsSnapshot, last7Days);
    
    if (charts.activity) {
      charts.activity.destroy();
    }
    
    charts.activity = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: last7Days.map(date => formatDate(date, 'short')),
        datasets: [
          {
            label: 'Stories',
            data: storiesData,
            backgroundColor: '#10B981'
          },
          {
            label: 'Chats',
            data: chatsData,
            backgroundColor: '#3B82F6'
          },
          {
            label: 'Questions',
            data: questionsData,
            backgroundColor: '#F59E0B'
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          x: {
            stacked: true
          },
          y: {
            stacked: true,
            beginAtZero: true
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Error creating activity chart:', error);
  }
}

// Create feature chart
async function createFeatureChart() {
  const ctx = document.getElementById('featureChart');
  if (!ctx) return;
  
  try {
    // Get feature usage data
    const [usersSnapshot, storiesSnapshot, chatsSnapshot, achievementsSnapshot] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'stories')),
      getDocs(collection(db, 'chats')),
      getDocs(collection(db, 'user_achievements'))
    ]);
    
    if (charts.feature) {
      charts.feature.destroy();
    }
    
    charts.feature = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Stories', 'Chats', 'Achievements', 'Users'],
        datasets: [{
          data: [
            storiesSnapshot.size,
            chatsSnapshot.size,
            achievementsSnapshot.size,
            usersSnapshot.size
          ],
          backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444']
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Error creating feature chart:', error);
  }
}

// Create economy chart
async function createEconomyChart() {
  const ctx = document.getElementById('economyChart');
  if (!ctx) return;
  
  try {
    // Get JLios transactions
    const transactionsSnapshot = await getDocs(
      query(collection(db, 'jliosTransactions'), orderBy('createdAt', 'desc'), limit(100))
    );
    
    const earnedData = [];
    const spentData = [];
    const last7Days = getLast7Days();
    
    last7Days.forEach(date => {
      let earned = 0;
      let spent = 0;
      
      transactionsSnapshot.forEach(doc => {
        const data = doc.data();
        const transactionDate = safeTimestampToDate(data.createdAt);
        
        if (transactionDate && isSameDay(transactionDate, date)) {
          if (data.type === 'earn') {
            earned += data.amount || 0;
          } else if (data.type === 'spend') {
            spent += data.amount || 0;
          }
        }
      });
      
      earnedData.push(earned);
      spentData.push(spent);
    });
    
    if (charts.economy) {
      charts.economy.destroy();
    }
    
    charts.economy = new Chart(ctx, {
      type: 'line',
      data: {
        labels: last7Days.map(date => formatDate(date, 'short')),
        datasets: [
          {
            label: 'JLios Earned',
            data: earnedData,
            borderColor: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.4
          },
          {
            label: 'JLios Spent',
            data: spentData,
            borderColor: '#EF4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Error creating economy chart:', error);
  }
}

// Load users data from actual users collection
async function loadUsersData() {
  console.log('👥 Loading users data...');
  
  try {
    const usersQuery = query(
      collection(db, 'users'),
      orderBy('joinedAt', 'desc'),
      limit(100)
    );
    
    const snapshot = await getDocs(usersQuery);
    const users = [];
    
    snapshot.forEach(doc => {
      users.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    displayUsers(users);
    
  } catch (error) {
    console.error('Error loading users data:', error);
    document.getElementById('usersList').innerHTML = 
      '<div class="loading-placeholder">Error loading users</div>';
  }
}

// Display users with actual app user structure
function displayUsers(users) {
  const usersList = document.getElementById('usersList');
  
  if (users.length === 0) {
    usersList.innerHTML = '<div class="loading-placeholder">No users found</div>';
    return;
  }
  
  usersList.innerHTML = users.map(user => {
    const verificationIcon = user.isVerified ? '✅' : '';
    const acceptingQuestions = user.isAcceptingQuestions ? '🟢' : '🔴';
    
    return `
      <div class="user-item" onclick="openUserModal('${user.id}')">
        <div class="item-header">
          <div class="item-title">
            ${verificationIcon} @${user.username || 'unknown'}
          </div>
          <div class="item-status status-${user.banned ? 'banned' : 'active'}">
            ${user.banned ? 'BANNED' : 'ACTIVE'}
          </div>
        </div>
        <div class="item-content">
          <p><strong>Display Name:</strong> ${user.displayName || 'Not set'}</p>
          <p><strong>Email:</strong> ${user.email || 'Not provided'}</p>
          <p><strong>Questions:</strong> ${acceptingQuestions} ${user.isAcceptingQuestions ? 'Accepting' : 'Not accepting'}</p>
          <p><strong>Q&A Stats:</strong> ${user.totalQuestionsReceived || 0} received, ${user.totalQuestionsAnswered || 0} answered</p>
          <p><strong>Joined:</strong> ${formatTimeAgo(user.joinedAt?.toDate())}</p>
          <p><strong>Last Active:</strong> ${formatTimeAgo(user.lastActiveAt?.toDate())}</p>
          <p><strong>Warnings:</strong> ${user.warnings?.length || 0}</p>
        </div>
      </div>
    `;
  }).join('');
}

// Open user modal
window.openUserModal = async function(userId) {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return;
    
    const userData = { id: userId, ...userDoc.data() };
    
    const modalBody = document.getElementById('userModalBody');
    modalBody.innerHTML = `
      <div class="user-details">
        <div class="detail-section">
          <h4>User Information</h4>
          <p><strong>Username:</strong> @${userData.username || 'unknown'}</p>
          <p><strong>Display Name:</strong> ${userData.displayName || 'Not set'}</p>
          <p><strong>User ID:</strong> ${userData.id}</p>
          <p><strong>Country:</strong> ${userData.countryName || userData.country || 'Unknown'}</p>
          <p><strong>Age:</strong> ${userData.age || 'Unknown'}</p>
          <p><strong>Joined:</strong> ${formatTimeAgo(userData.createdAt?.toDate())}</p>
          <p><strong>Status:</strong> <span class="status-${userData.banned ? 'banned' : 'active'}">${userData.banned ? 'BANNED' : 'ACTIVE'}</span></p>
        </div>
        
        ${userData.warnings && userData.warnings.length > 0 ? `
          <div class="detail-section">
            <h4>Warnings (${userData.warnings.length})</h4>
            ${userData.warnings.map(warning => `
              <p style="margin-bottom: 8px; padding: 8px; background: #FEF3C7; border-radius: 4px;">
                <strong>Date:</strong> ${formatTimeAgo(warning.date?.toDate())}<br>
                <strong>Reason:</strong> ${warning.reason || 'No reason provided'}
              </p>
            `).join('')}
          </div>
        ` : ''}
        
        <div class="detail-section">
          <h4>Actions</h4>
          <div style="display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap;">
            ${!userData.banned ? `
              <button class="action-btn" style="background: var(--danger-color); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;" onclick="banUserFromModal('${userData.id}')">
                🚫 Ban User
              </button>
              <button class="action-btn" style="background: var(--warning-color); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;" onclick="warnUserFromModal('${userData.id}')">
                ⚠️ Add Warning
              </button>
            ` : `
              <button class="action-btn" style="background: var(--secondary-color); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;" onclick="unbanUser('${userData.id}')">
                ✅ Unban User
              </button>
            `}
            <button class="action-btn" style="background: var(--primary-color); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;" onclick="viewUserActivity('${userData.id}')">
              📊 View Activity
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('userModal').classList.add('active');
    
  } catch (error) {
    console.error('Error opening user modal:', error);
  }
};

// Ban user from modal
window.banUserFromModal = async function(userId) {
  if (!confirm('Are you sure you want to ban this user?')) {
    return;
  }
  
  try {
    await updateDoc(doc(db, 'users', userId), {
      banned: true,
      bannedAt: serverTimestamp(),
      bannedBy: currentUser.uid,
      bannedReason: 'Manual admin action'
    });
    
    closeModal('userModal');
    loadUsersData(); // Refresh the users list
    
    console.log(`User ${userId} has been banned`);
  } catch (error) {
    console.error('Error banning user:', error);
  }
};

// Unban user
window.unbanUser = async function(userId) {
  if (!confirm('Are you sure you want to unban this user?')) {
    return;
  }
  
  try {
    await updateDoc(doc(db, 'users', userId), {
      banned: false,
      unbannedAt: serverTimestamp(),
      unbannedBy: currentUser.uid
    });
    
    closeModal('userModal');
    loadUsersData(); // Refresh the users list
    
    console.log(`User ${userId} has been unbanned`);
  } catch (error) {
    console.error('Error unbanning user:', error);
  }
};

// Warn user from modal
window.warnUserFromModal = async function(userId) {
  const reason = prompt('Enter warning reason:');
  if (!reason) return;
  
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const warnings = userData.warnings || [];
      warnings.push({
        date: serverTimestamp(),
        reason: reason,
        adminId: currentUser.uid
      });
      
      await updateDoc(userRef, { warnings });
    }
    
    closeModal('userModal');
    loadUsersData(); // Refresh the users list
    
    console.log(`Warning issued to user ${userId}`);
  } catch (error) {
    console.error('Error warning user:', error);
  }
};

// View user activity
window.viewUserActivity = function(userId) {
  // This could open a new modal or redirect to a detailed activity page
  alert(`User activity view for ${userId} - Feature coming soon!`);
};

// Close modal
window.closeModal = function(modalId) {
  document.getElementById(modalId).classList.remove('active');
};

// Utility functions
function formatTimeAgo(date) {
  if (!date) return 'Unknown';
  
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatDate(date, format = 'short') {
  if (format === 'short') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString();
}

function getLast30Days() {
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    days.push(date);
  }
  return days;
}

function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    days.push(date);
  }
  return days;
}

function isSameDay(date1, date2) {
  return date1.toDateString() === date2.toDateString();
}

function countByDay(snapshot, days) {
  return days.map(date => {
    return Array.from(snapshot.docs).filter(doc => {
      const data = doc.data();
      const itemDate = safeTimestampToDate(data.createdAt);
      return itemDate && isSameDay(itemDate, date);
    }).length;
  });
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  realTimeListeners.forEach(unsubscribe => unsubscribe());
});

console.log('📊 Admin dashboard loaded successfully!');

// Enhanced moderation system for JLio app
const ModerationSystem = {
  // Automated content flagging
  async flagSuspiciousContent() {
    try {
      console.log('🔍 Running automated content scan...');
      
      // Check recent stories for inappropriate content
      const recentStories = await getDocs(query(
        collection(db, 'stories'),
        orderBy('createdAt', 'desc'),
        limit(50)
      ));
      
      const suspiciousPatterns = [
        /\b(hate|kill|die|stupid|idiot)\b/i,
        /\b(sex|porn|nude|naked)\b/i,
        /\b(drugs|cocaine|weed|marijuana)\b/i,
        /\b(scam|fraud|money|cash|pay)\b/i
      ];
      
      let flaggedCount = 0;
      
      for (const doc of recentStories.docs) {
        const story = doc.data();
        const content = story.text || '';
        
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(content)) {
            // Create automated report
            await this.createAutomatedReport({
              contentId: doc.id,
              contentType: 'story',
              reason: 'automated_flagging',
              category: 'general',
              description: `Automated system flagged content for suspicious patterns`,
              priority: 'medium',
              evidence: {
                contentText: content,
                flaggedPattern: pattern.toString()
              }
            });
            flaggedCount++;
            break;
          }
        }
      }
      
      console.log(`🚨 Flagged ${flaggedCount} suspicious content items`);
      return flaggedCount;
      
    } catch (error) {
      console.error('Error in automated content flagging:', error);
      return 0;
    }
  },
  
  // Create automated report
  async createAutomatedReport(reportData) {
    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: 'system',
        reportedUserId: reportData.reportedUserId || 'unknown',
        reason: reportData.reason,
        category: reportData.category,
        description: reportData.description,
        status: 'pending',
        priority: reportData.priority || 'medium',
        evidence: reportData.evidence || {},
        moderatorNotes: 'Generated by automated moderation system',
        createdAt: serverTimestamp(),
        automated: true
      });
      
    } catch (error) {
      console.error('Error creating automated report:', error);
    }
  },
  
  // Bulk user actions
  async bulkUserAction(userIds, action, reason) {
    try {
      console.log(`🔨 Performing bulk ${action} on ${userIds.length} users`);
      
      const promises = userIds.map(async (userId) => {
        const userRef = doc(db, 'users', userId);
        const updates = {};
        
        switch (action) {
          case 'ban':
            updates.banned = true;
            updates.bannedAt = serverTimestamp();
            updates.bannedReason = reason;
            break;
          case 'warn':
            const userDoc = await getDoc(userRef);
            const userData = userDoc.data();
            const warnings = userData.warnings || [];
            warnings.push({
              date: serverTimestamp(),
              reason: reason,
              adminId: currentUser.uid
            });
            updates.warnings = warnings;
            break;
          case 'unban':
            updates.banned = false;
            updates.unbannedAt = serverTimestamp();
            updates.unbannedReason = reason;
            break;
        }
        
        await updateDoc(userRef, updates);
        
        // Log action
        await this.logModerationAction({
          action: action,
          targetUserId: userId,
          reason: reason,
          adminId: currentUser.uid
        });
      });
      
      await Promise.all(promises);
      console.log(`✅ Bulk ${action} completed`);
      
    } catch (error) {
      console.error(`Error in bulk ${action}:`, error);
    }
  },
  
  // Log moderation actions for audit trail
  async logModerationAction(actionData) {
    try {
      await addDoc(collection(db, 'adminAuditLogs'), {
        ...actionData,
        timestamp: serverTimestamp(),
        adminEmail: currentUser.email
      });
    } catch (error) {
      console.error('Error logging moderation action:', error);
    }
  },
  
  // Analyze user behavior patterns
  async analyzeUserBehavior(userId) {
    try {
      console.log(`🔍 Analyzing behavior for user: ${userId}`);
      
      // Get user's stories
      const userStories = await getDocs(query(
        collection(db, 'stories'),
        where('authorId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(20)
      ));
      
      // Get user's questions
      const userQuestions = await getDocs(query(
        collection(db, 'questions'),
        where('senderId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(20)
      ));
      
      // Get reports about this user
      const reportsAboutUser = await getDocs(query(
        collection(db, 'reports'),
        where('reportedUserId', '==', userId)
      ));
      
      // Calculate risk score
      let riskScore = 0;
      const reportCount = reportsAboutUser.size;
      const storyCount = userStories.size;
      const questionCount = userQuestions.size;
      
      // Risk factors
      if (reportCount > 3) riskScore += 30;
      if (reportCount > 1) riskScore += 15;
      if (storyCount > 10 && questionCount === 0) riskScore += 10; // Only posting stories, not engaging
      
      // Check for spam patterns
      const recentActivity = [];
      userStories.forEach(doc => recentActivity.push(doc.data()));
      userQuestions.forEach(doc => recentActivity.push(doc.data()));
      
      if (recentActivity.length > 10) {
        const avgTimeBetween = this.calculateAverageTimeBetween(recentActivity);
        if (avgTimeBetween < 60000) riskScore += 25; // Less than 1 minute between posts
      }
      
      return {
        userId,
        riskScore,
        reportCount,
        storyCount,
        questionCount,
        riskLevel: riskScore > 50 ? 'high' : riskScore > 25 ? 'medium' : 'low',
        recommendations: this.generateRecommendations(riskScore, reportCount)
      };
      
    } catch (error) {
      console.error('Error analyzing user behavior:', error);
      return null;
    }
  },
  
  calculateAverageTimeBetween(activities) {
    if (activities.length < 2) return 0;
    
    const times = activities.map(a => a.createdAt?.toDate()?.getTime()).filter(Boolean);
    times.sort((a, b) => b - a); // Most recent first
    
    let totalDiff = 0;
    for (let i = 0; i < times.length - 1; i++) {
      totalDiff += times[i] - times[i + 1];
    }
    
    return totalDiff / (times.length - 1);
  },
  
  generateRecommendations(riskScore, reportCount) {
    const recommendations = [];
    
    if (riskScore > 50) {
      recommendations.push('Consider temporary ban');
      recommendations.push('Review all recent content');
    } else if (riskScore > 25) {
      recommendations.push('Issue warning');
      recommendations.push('Monitor closely');
    }
    
    if (reportCount > 5) {
      recommendations.push('Review user interaction patterns');
    }
    
    return recommendations;
  }
};

// Add to global scope for dashboard access
window.ModerationSystem = ModerationSystem;

// Security page functions
window.loadSecurityData = function() {
    if (!securitySystem) return;
    
    loadSecurityStats();
    loadSecurityAlerts();
    updateThreatPatterns();
}

window.loadSecurityStats = function() {
    // Get security stats from security system
    const alerts = securitySystem.securityAlerts || [];
    const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
    const quarantinedUsers = securitySystem.quarantinedUsers || new Set();
    const resolvedToday = alerts.filter(alert => 
        alert.resolved && isToday(alert.resolvedAt)
    );
    
    // Update security stats display
    updateElementText('totalAlerts', alerts.length);
    updateElementText('criticalAlerts', criticalAlerts.length);
    updateElementText('quarantinedUsers', quarantinedUsers.size);
    updateElementText('resolvedToday', resolvedToday.length);
}

window.loadSecurityAlerts = function() {
    if (!securitySystem || !securitySystem.securityAlerts) return;
    
    const alertsContainer = document.getElementById('securityAlerts');
    if (!alertsContainer) return;
    
    const alerts = securitySystem.securityAlerts
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10); // Show latest 10 alerts
    
    if (alerts.length === 0) {
        alertsContainer.innerHTML = '<div class="loading-placeholder">No security alerts</div>';
        return;
    }
    
    alertsContainer.innerHTML = alerts.map(alert => `
        <div class="alert-item ${alert.severity}">
            <div class="alert-content">
                <strong>${alert.type}</strong>
                <p>${alert.message}</p>
                <div class="alert-details">
                    User: ${alert.userId || 'Unknown'} | 
                    Risk Score: ${alert.riskScore || 'N/A'}
                </div>
            </div>
            <span class="alert-time">${formatTimestamp(alert.timestamp)}</span>
        </div>
    `).join('');
}

window.runSecurityScan = function() {
    if (!securitySystem) {
        alert('Security system not initialized');
        return;
    }
    
    const scanBtn = event.target;
    scanBtn.disabled = true;
    scanBtn.textContent = '🔄 Scanning...';
    
    // Run comprehensive security scan
    securitySystem.runComprehensiveScan()
        .then(() => {
            loadSecurityData();
            scanBtn.textContent = '✅ Scan Complete';
            setTimeout(() => {
                scanBtn.disabled = false;
                scanBtn.textContent = '🔍 Run Security Scan';
            }, 2000);
        })
        .catch(error => {
            console.error('Security scan failed:', error);
            scanBtn.textContent = '❌ Scan Failed';
            setTimeout(() => {
                scanBtn.disabled = false;
                scanBtn.textContent = '🔍 Run Security Scan';
            }, 2000);
        });
}

window.exportSecurityReport = function() {
    if (!securitySystem) return;
    
    const report = securitySystem.generateSecurityReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], {
        type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

window.updateSecurityRules = function() {
    if (!securitySystem) return;
    
    const confirmed = confirm('Update security rules with latest threat patterns?');
    if (!confirmed) return;
    
    securitySystem.updateSecurityRules()
        .then(() => {
            alert('Security rules updated successfully');
            loadSecurityData();
        })
        .catch(error => {
            console.error('Failed to update security rules:', error);
            alert('Failed to update security rules');
        });
}

window.bulkQuarantine = function() {
    if (!securitySystem) return;
    
    const confirmed = confirm('Quarantine all high-risk users? This action cannot be undone.');
    if (!confirmed) return;
    
    securitySystem.bulkQuarantineHighRiskUsers()
        .then(count => {
            alert(`${count} high-risk users have been quarantined`);
            loadSecurityData();
        })
        .catch(error => {
            console.error('Bulk quarantine failed:', error);
            alert('Bulk quarantine operation failed');
        });
}

window.updateThreatPatterns = function() {
    const patternsContainer = document.getElementById('threatPatterns');
    if (!patternsContainer || !securitySystem) return;
    
    const patterns = securitySystem.getThreatPatternStats();
    
    patternsContainer.innerHTML = Object.entries(patterns).map(([type, count]) => `
        <div class="pattern-item">
            <span class="pattern-type">${type}</span>
            <span class="pattern-count">${count} detected today</span>
        </div>
    `).join('');
}

window.generateSecurityReport = function() {
    if (!securitySystem) return;
    
    const report = securitySystem.generateComprehensiveReport();
    console.log('Security Report Generated:', report);
    alert('Security report generated. Check console for details.');
}

window.reviewAuditLog = function() {
    // This would open a detailed audit log view
    alert('Audit log review feature - would open detailed audit interface');
}

// Helper function to update element text safely
function updateElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    }
}

function isToday(timestamp) {
    const today = new Date();
    const date = new Date(timestamp);
    return date.toDateString() === today.toDateString();
}

function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
}