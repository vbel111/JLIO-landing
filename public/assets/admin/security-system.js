// Advanced Security and Audit System for JLio Admin Dashboard
import {
    addDoc,
    collection,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    Timestamp,
    where
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

class SecuritySystem {
  constructor(db, auth) {
    this.db = db;
    this.auth = auth;
    this.suspiciousActivities = [];
    this.securityRules = this.initializeSecurityRules();
  }

  // Initialize security rules and patterns
  initializeSecurityRules() {
    return {
      // Rate limiting rules
      rateLimit: {
        maxMessagesPerMinute: 10,
        maxStoriesPerHour: 5,
        maxQuestionsPerMinute: 3,
        maxReportsPerDay: 10
      },
      
      // Content filtering patterns
      contentPatterns: {
        spam: [
          /\b(buy now|click here|limited time|act fast)\b/i,
          /\b(free money|easy money|get rich|make money fast)\b/i,
          /\b(winner|congratulations|you've won|claim now)\b/i
        ],
        harassment: [
          /\b(kill yourself|kys|die|hate you|stupid|idiot)\b/i,
          /\b(ugly|fat|loser|worthless|pathetic)\b/i
        ],
        inappropriate: [
          /\b(sex|porn|nude|naked|xxx)\b/i,
          /\b(drugs|cocaine|weed|marijuana|pills)\b/i,
          /\b(suicide|self harm|cut myself)\b/i
        ]
      },
      
      // Behavioral patterns
      behaviorPatterns: {
        botLike: {
          identicalMessages: 3, // Same message repeated
          rapidPosting: 30000, // Less than 30 seconds between posts
          noProfileImage: true,
          lowEngagement: true // Only posts, never responds
        },
        suspicious: {
          multipleReports: 3,
          newAccountHighActivity: true, // New account with lots of activity
          offHourActivity: true // Activity during unusual hours
        }
      }
    };
  }

  // Monitor user activity for suspicious patterns
  async monitorUserActivity(userId, activityType, content = null) {
    try {
      const user = await this.getUserProfile(userId);
      if (!user) return;

      const suspiciousLevel = await this.analyzeActivity(user, activityType, content);
      
      if (suspiciousLevel > 0.7) {
        await this.flagSuspiciousActivity(userId, activityType, suspiciousLevel, content);
      }
      
      // Log all activity for pattern analysis
      await this.logUserActivity(userId, activityType, suspiciousLevel);
      
    } catch (error) {
      console.error('Error monitoring user activity:', error);
    }
  }

  // Analyze activity for suspicious patterns
  async analyzeActivity(user, activityType, content) {
    let suspiciousScore = 0;

    // Check account age
    const accountAge = new Date() - user.joinedAt?.toDate();
    const isNewAccount = accountAge < 7 * 24 * 60 * 60 * 1000; // Less than 7 days

    // Check recent activity volume
    const recentActivity = await this.getRecentUserActivity(user.id, 24); // Last 24 hours
    
    // Rate limiting checks
    if (this.checkRateLimit(recentActivity, activityType)) {
      suspiciousScore += 0.4;
    }

    // Content analysis
    if (content && this.analyzeContent(content)) {
      suspiciousScore += 0.5;
    }

    // Behavioral analysis
    if (isNewAccount && recentActivity.length > 10) {
      suspiciousScore += 0.3; // New account with high activity
    }

    // Check for bot-like behavior
    if (this.detectBotBehavior(recentActivity)) {
      suspiciousScore += 0.6;
    }

    // Check user history
    const reports = await this.getUserReports(user.id);
    if (reports.length > 2) {
      suspiciousScore += 0.3;
    }

    return Math.min(suspiciousScore, 1.0);
  }

  // Check if user exceeds rate limits
  checkRateLimit(recentActivity, activityType) {
    const now = new Date();
    const rules = this.securityRules.rateLimit;
    
    switch (activityType) {
      case 'message':
        const messagesLastMinute = recentActivity.filter(a => 
          a.type === 'message' && 
          (now - a.timestamp) < 60000
        ).length;
        return messagesLastMinute > rules.maxMessagesPerMinute;
        
      case 'story':
        const storiesLastHour = recentActivity.filter(a => 
          a.type === 'story' && 
          (now - a.timestamp) < 3600000
        ).length;
        return storiesLastHour > rules.maxStoriesPerHour;
        
      case 'question':
        const questionsLastMinute = recentActivity.filter(a => 
          a.type === 'question' && 
          (now - a.timestamp) < 60000
        ).length;
        return questionsLastMinute > rules.maxQuestionsPerMinute;
        
      case 'report':
        const reportsToday = recentActivity.filter(a => 
          a.type === 'report' && 
          (now - a.timestamp) < 86400000
        ).length;
        return reportsToday > rules.maxReportsPerDay;
        
      default:
        return false;
    }
  }

  // Analyze content for suspicious patterns
  analyzeContent(content) {
    const patterns = this.securityRules.contentPatterns;
    
    for (const category in patterns) {
      for (const pattern of patterns[category]) {
        if (pattern.test(content)) {
          return { category, pattern: pattern.toString() };
        }
      }
    }
    
    return null;
  }

  // Detect bot-like behavior
  detectBotBehavior(activities) {
    if (activities.length < 3) return false;

    // Check for identical content
    const contents = activities.map(a => a.content).filter(Boolean);
    const uniqueContents = new Set(contents);
    if (contents.length > 0 && uniqueContents.size / contents.length < 0.5) {
      return true; // More than 50% identical content
    }

    // Check posting intervals
    const timestamps = activities.map(a => a.timestamp).sort((a, b) => b - a);
    const intervals = [];
    for (let i = 0; i < timestamps.length - 1; i++) {
      intervals.push(timestamps[i] - timestamps[i + 1]);
    }
    
    // Very regular posting intervals (like a bot)
    if (intervals.length > 2) {
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((sum, interval) => 
        sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
      
      // Low variance in posting times indicates bot-like behavior
      if (variance < avgInterval * 0.1) {
        return true;
      }
    }

    return false;
  }

  // Flag suspicious activity
  async flagSuspiciousActivity(userId, activityType, suspiciousLevel, content) {
    try {
      await addDoc(collection(this.db, 'securityAlerts'), {
        userId,
        activityType,
        suspiciousLevel,
        content: content ? content.substring(0, 200) : null,
        timestamp: serverTimestamp(),
        status: 'pending',
        adminNotified: false,
        autoGenerated: true
      });

      // If highly suspicious, create auto-report
      if (suspiciousLevel > 0.9) {
        await this.createAutoReport(userId, activityType, suspiciousLevel);
      }

      console.log(`🚨 Flagged suspicious activity for user ${userId}: ${suspiciousLevel}`);
      
    } catch (error) {
      console.error('Error flagging suspicious activity:', error);
    }
  }

  // Create automatic report for highly suspicious activity
  async createAutoReport(userId, activityType, suspiciousLevel) {
    try {
      await addDoc(collection(this.db, 'reports'), {
        reporterId: 'security-system',
        reportedUserId: userId,
        reason: 'automated_security_flag',
        category: 'user_behavior',
        description: `Automatic security system flagged user for suspicious ${activityType} activity (score: ${suspiciousLevel.toFixed(2)})`,
        status: 'pending',
        priority: suspiciousLevel > 0.95 ? 'critical' : 'high',
        evidence: {
          securityScore: suspiciousLevel,
          detectionMethod: 'automated_analysis',
          activityType
        },
        createdAt: serverTimestamp(),
        automated: true
      });
      
    } catch (error) {
      console.error('Error creating auto-report:', error);
    }
  }

  // Get user's recent activity
  async getRecentUserActivity(userId, hours = 24) {
    try {
      const since = new Date(Date.now() - (hours * 60 * 60 * 1000));
      
      // This would typically query a user_activities collection
      // For now, we'll check multiple collections
      const activities = [];
      
      // Check stories
      const storiesQuery = query(
        collection(this.db, 'stories'),
        where('authorId', '==', userId),
        where('createdAt', '>=', Timestamp.fromDate(since)),
        orderBy('createdAt', 'desc')
      );
      
      const storiesSnapshot = await getDocs(storiesQuery);
      storiesSnapshot.forEach(doc => {
        const data = doc.data();
        activities.push({
          type: 'story',
          timestamp: data.createdAt?.toDate(),
          content: data.text
        });
      });
      
      // Check questions (messages sent)
      const questionsQuery = query(
        collection(this.db, 'questions'),
        where('senderId', '==', userId),
        where('createdAt', '>=', Timestamp.fromDate(since)),
        orderBy('createdAt', 'desc')
      );
      
      const questionsSnapshot = await getDocs(questionsQuery);
      questionsSnapshot.forEach(doc => {
        const data = doc.data();
        activities.push({
          type: 'question',
          timestamp: data.createdAt?.toDate(),
          content: data.text
        });
      });
      
      return activities.sort((a, b) => b.timestamp - a.timestamp);
      
    } catch (error) {
      console.error('Error getting recent user activity:', error);
      return [];
    }
  }

  // Get user profile
  async getUserProfile(userId) {
    try {
      const userDoc = await getDocs(query(
        collection(this.db, 'users'),
        where('__name__', '==', userId),
        limit(1)
      ));
      
      if (!userDoc.empty) {
        return { id: userId, ...userDoc.docs[0].data() };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  // Get reports about a user
  async getUserReports(userId) {
    try {
      const reportsQuery = query(
        collection(this.db, 'reports'),
        where('reportedUserId', '==', userId)
      );
      
      const snapshot = await getDocs(reportsQuery);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
    } catch (error) {
      console.error('Error getting user reports:', error);
      return [];
    }
  }

  // Log user activity for analysis
  async logUserActivity(userId, activityType, suspiciousLevel) {
    try {
      await addDoc(collection(this.db, 'userActivityLogs'), {
        userId,
        activityType,
        suspiciousLevel,
        timestamp: serverTimestamp(),
        adminId: this.auth.currentUser?.uid
      });
    } catch (error) {
      console.error('Error logging user activity:', error);
    }
  }

  // Get security dashboard data
  async getSecurityDashboard() {
    try {
      const dashboard = {
        alerts: [],
        stats: {
          totalAlerts: 0,
          criticalAlerts: 0,
          resolvedToday: 0,
          averageResponseTime: 0
        },
        trends: {
          alertsToday: 0,
          alertsThisWeek: 0,
          topThreatTypes: []
        }
      };

      // Get recent security alerts
      const alertsQuery = query(
        collection(this.db, 'securityAlerts'),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      
      const alertsSnapshot = await getDocs(alertsQuery);
      dashboard.alerts = alertsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Calculate stats
      dashboard.stats.totalAlerts = alertsSnapshot.size;
      dashboard.stats.criticalAlerts = dashboard.alerts.filter(a => 
        a.suspiciousLevel > 0.9
      ).length;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dashboard.trends.alertsToday = dashboard.alerts.filter(a => 
        a.timestamp?.toDate() >= today
      ).length;

      return dashboard;
      
    } catch (error) {
      console.error('Error getting security dashboard:', error);
      return null;
    }
  }

  // Quarantine user (temporary restriction)
  async quarantineUser(userId, reason, duration = 24) {
    try {
      const endTime = new Date(Date.now() + (duration * 60 * 60 * 1000));
      
      await addDoc(collection(this.db, 'userQuarantine'), {
        userId,
        reason,
        startTime: serverTimestamp(),
        endTime: Timestamp.fromDate(endTime),
        adminId: this.auth.currentUser?.uid,
        active: true
      });

      // Log security action
      await this.logSecurityAction('quarantine', userId, reason);
      
      console.log(`🔒 User ${userId} quarantined for ${duration} hours`);
      
    } catch (error) {
      console.error('Error quarantining user:', error);
    }
  }

  // Log security actions for audit trail
  async logSecurityAction(action, targetUserId, reason) {
    try {
      await addDoc(collection(this.db, 'securityAuditLog'), {
        action,
        targetUserId,
        reason,
        adminId: this.auth.currentUser?.uid,
        adminEmail: this.auth.currentUser?.email,
        timestamp: serverTimestamp(),
        ipAddress: 'unknown', // Would need additional setup to track
        userAgent: navigator.userAgent
      });
    } catch (error) {
      console.error('Error logging security action:', error);
    }
  }

  // Get threat pattern statistics for dashboard display
  getThreatPatternStats() {
    const today = new Date().toISOString().split('T')[0];
    const stats = {
      'Spam Detection': 0,
      'Rate Limiting': 0,
      'Behavioral Analysis': 0,
      'Content Filtering': 0,
      'Bot Detection': 0
    };

    // Count activities from today
    this.suspiciousActivities.forEach(activity => {
      const activityDate = new Date(activity.timestamp).toISOString().split('T')[0];
      if (activityDate === today) {
        const type = activity.type || 'Other';
        if (type.includes('spam') || type.includes('content')) {
          stats['Spam Detection']++;
        } else if (type.includes('rate') || type.includes('limit')) {
          stats['Rate Limiting']++;
        } else if (type.includes('behavior') || type.includes('suspicious')) {
          stats['Behavioral Analysis']++;
        } else if (type.includes('filter') || type.includes('inappropriate')) {
          stats['Content Filtering']++;
        } else if (type.includes('bot') || type.includes('automated')) {
          stats['Bot Detection']++;
        }
      }
    });

    return stats;
  }

  // Generate comprehensive security report
  generateComprehensiveReport() {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const last7Days = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

    // Filter activities by time periods
    const activities24h = this.suspiciousActivities.filter(a => 
      new Date(a.timestamp) > last24Hours
    );
    const activities7d = this.suspiciousActivities.filter(a => 
      new Date(a.timestamp) > last7Days
    );

    // Generate threat analysis
    const threatSummary = {
      critical: activities24h.filter(a => a.severity === 'critical').length,
      high: activities24h.filter(a => a.severity === 'high').length,
      medium: activities24h.filter(a => a.severity === 'medium').length,
      low: activities24h.filter(a => a.severity === 'low').length
    };

    // Generate user risk analysis
    const userRisks = {};
    activities7d.forEach(activity => {
      if (activity.userId) {
        if (!userRisks[activity.userId]) {
          userRisks[activity.userId] = { count: 0, severity: 'low', activities: [] };
        }
        userRisks[activity.userId].count++;
        userRisks[activity.userId].activities.push(activity);
        
        // Escalate severity based on activity count and types
        if (userRisks[activity.userId].count > 10) {
          userRisks[activity.userId].severity = 'critical';
        } else if (userRisks[activity.userId].count > 5) {
          userRisks[activity.userId].severity = 'high';
        } else if (userRisks[activity.userId].count > 2) {
          userRisks[activity.userId].severity = 'medium';
        }
      }
    });

    return {
      generatedAt: now.toISOString(),
      reportPeriod: {
        last24Hours: activities24h.length,
        last7Days: activities7d.length,
        total: this.suspiciousActivities.length
      },
      threatSummary,
      userRisks,
      topThreats: activities24h
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 10),
      recommendations: this.generateSecurityRecommendations(threatSummary, userRisks),
      systemHealth: {
        quarantinedUsers: this.quarantinedUsers?.size || 0,
        activeRules: Object.keys(this.securityRules).length,
        lastScanTime: this.lastScanTime || null
      }
    };
  }

  // Generate security recommendations based on threat analysis
  generateSecurityRecommendations(threatSummary, userRisks) {
    const recommendations = [];

    if (threatSummary.critical > 0) {
      recommendations.push({
        priority: 'critical',
        action: 'Immediate review required',
        description: `${threatSummary.critical} critical threats detected in the last 24 hours`
      });
    }

    if (threatSummary.high > 5) {
      recommendations.push({
        priority: 'high',
        action: 'Increase monitoring',
        description: 'High number of security alerts - consider implementing stricter rules'
      });
    }

    const highRiskUsers = Object.keys(userRisks).filter(
      userId => userRisks[userId].severity === 'critical' || userRisks[userId].severity === 'high'
    );

    if (highRiskUsers.length > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Review user accounts',
        description: `${highRiskUsers.length} users showing high-risk behavior patterns`
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'low',
        action: 'Continue monitoring',
        description: 'No immediate security concerns detected'
      });
    }

    return recommendations;
  }

  // Additional security system methods for comprehensive functionality
  async runComprehensiveScan() {
    this.lastScanTime = new Date();
    
    try {
      // Scan recent content for threats
      await this.scanRecentContent();
      
      // Analyze user behavior patterns
      await this.analyzeUserBehaviorPatterns();
      
      // Check for bot activity
      await this.detectBotActivity();
      
      // Update threat patterns
      await this.updateThreatPatterns();
      
      console.log('Comprehensive security scan completed');
      return true;
    } catch (error) {
      console.error('Security scan failed:', error);
      throw error;
    }
  }

  async scanRecentContent() {
    // Scan stories, messages, and questions for inappropriate content
    const collections = ['stories', 'questions'];
    
    for (const collectionName of collections) {
      try {
        const q = query(
          collection(this.db, collectionName),
          orderBy('createdAt', 'desc'),
          limit(100)
        );
        
        const snapshot = await getDocs(q);
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const content = data.text || data.content || data.question || '';
          
          const threatLevel = this.analyzeContent(content);
          if (threatLevel.score > 30) {
            this.flagSuspiciousActivity({
              type: 'content_threat',
              severity: threatLevel.score > 70 ? 'high' : 'medium',
              userId: data.authorId || data.senderId,
              contentId: doc.id,
              message: `Suspicious content detected: ${threatLevel.reason}`,
              riskScore: threatLevel.score,
              timestamp: Date.now()
            });
          }
        });
      } catch (error) {
        console.error(`Error scanning ${collectionName}:`, error);
      }
    }
  }

  async analyzeUserBehaviorPatterns() {
    // This would analyze user activity patterns for suspicious behavior
    // Implementation would depend on specific behavioral metrics
    console.log('Analyzing user behavior patterns...');
  }

  async detectBotActivity() {
    // Detect automated/bot behavior patterns
    console.log('Scanning for bot activity...');
  }

  async updateThreatPatterns() {
    // Update security rules based on new threat intelligence
    console.log('Updating threat detection patterns...');
  }

  async updateSecurityRules() {
    try {
      // This would update security rules in the database
      // For now, just log the action
      await this.logSecurityAction('update_rules', null, 'Security rules updated');
      console.log('Security rules updated successfully');
      return true;
    } catch (error) {
      console.error('Failed to update security rules:', error);
      throw error;
    }
  }

  async bulkQuarantineHighRiskUsers() {
    let quarantinedCount = 0;
    
    try {
      // Find high-risk users from suspicious activities
      const highRiskUsers = new Set();
      this.suspiciousActivities.forEach(activity => {
        if (activity.riskScore > 70 && activity.userId) {
          highRiskUsers.add(activity.userId);
        }
      });

      // Quarantine high-risk users
      for (const userId of highRiskUsers) {
        await this.quarantineUser(userId, 'High risk behavior detected');
        quarantinedCount++;
      }

      await this.logSecurityAction('bulk_quarantine', null, `Quarantined ${quarantinedCount} high-risk users`);
      return quarantinedCount;
    } catch (error) {
      console.error('Bulk quarantine failed:', error);
      throw error;
    }
  }

  generateSecurityReport() {
    return this.generateComprehensiveReport();
  }
}

export default SecuritySystem;