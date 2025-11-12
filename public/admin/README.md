# JLio Admin Dashboard

A comprehensive web-based administration interface for managing the JLio mobile app, built with vanilla JavaScript and Firebase integration.

## 🌟 Features

### 🔐 Authentication & Security
- Firebase Authentication with role-based access control
- Admin-only access with secure role verification
- Session management and automatic logout
- Secure Firestore security rules

### 📊 Real-Time Dashboard
- **Overview Page**: Live statistics, recent activity feed, system health monitoring
- **Moderation Tools**: Content review, user reports management, ban/warn systems
- **Analytics**: User growth charts, activity metrics, feature usage analytics, economy tracking
- **User Management**: User profiles, moderation actions, activity monitoring

### 🛡️ Moderation Features
- Real-time report queue with pending/resolved status
- Detailed report investigation with user context
- One-click user actions (ban, warn, resolve reports)
- User profile management with warning history
- Content moderation with automated flagging

### 📈 Analytics & Insights
- User growth tracking (daily/monthly trends)
- Activity heatmaps (stories, chats, questions)
- Feature usage distribution
- JLios economy monitoring (earned vs spent)
- Real-time engagement metrics

## 🚀 Installation & Setup

### Prerequisites
- Firebase project with Firestore and Authentication enabled
- Node.js (for setup scripts)
- Firebase CLI (for deploying security rules)

### 1. Deploy Security Rules
```bash
firebase deploy --only firestore:rules
```

### 2. Create Admin User

#### Option A: Web-Based Setup (Recommended)
1. Open `public/admin/setup.html` in your browser
2. Follow the guided setup process:
   - Connect to Firebase
   - Create admin account
   - Verify security rules deployment
   - Access dashboard

#### Option B: Manual Setup
1. Go to Firebase Console > Authentication
2. Create a new user or note existing user's UID
3. Go to Firestore Database
4. Create collection: `admins`
5. Create document with your user UID as the document ID
6. Add the following data:
```json
{
  "email": "your-admin@email.com",
  "name": "Admin Name",
  "role": "admin",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "permissions": {
    "moderation": true,
    "analytics": true,
    "userManagement": true,
    "systemSettings": true
  }
}
```

#### Option C: Automated Setup (Advanced)
```bash
# Install dependencies
npm install firebase-admin

# Download service account key from Firebase Console
# Save as 'service-account-key.json' in project root

# Run setup script
node setup-admin.js
```

### 3. Access Dashboard
1. Open `public/admin/index.html` in your browser
2. Login with your admin credentials
3. Access the full dashboard interface

## 📁 File Structure

```
public/
├── admin/
│   ├── index.html          # Admin login page
│   └── dashboard.html      # Main admin dashboard
└── assets/
    └── admin/
        ├── admin.css       # Dashboard styling
        ├── auth.js         # Authentication logic
        └── dashboard.js    # Main dashboard functionality
```

## 🔧 Configuration

### Firebase Configuration
Update the Firebase config in both `auth.js` and `dashboard.js`:

```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

### Admin Permissions
Customize admin permissions in the `admins` collection:

```javascript
{
  "permissions": {
    "moderation": true,      // Access to moderation tools
    "analytics": true,       // View analytics dashboard
    "userManagement": true,  // Manage users (ban/warn)
    "systemSettings": true   // System configuration access
  }
}
```

## 📊 Dashboard Pages

### Overview Page
- **Live Stats**: Total users, stories, chats, pending reports
- **Real-Time Updates**: WebSocket-based live data updates
- **Recent Activity**: Timeline of user actions and system events
- **System Health**: Database status, performance metrics

### Moderation Page
- **Report Queue**: Pending reports requiring review
- **User Actions**: Ban, warn, or clear users
- **Content Review**: Investigate reported content
- **Moderation History**: Track all moderation actions

### Analytics Page
- **User Growth**: Daily/monthly user registration trends
- **Activity Metrics**: Stories, chats, questions created
- **Feature Usage**: Most popular app features
- **Economy Tracking**: JLios earned vs spent analytics

### Users Page
- **User Directory**: Searchable list of all users
- **User Profiles**: Detailed user information and activity
- **Bulk Actions**: Mass moderation tools
- **Export Data**: User data export functionality

## 🔐 Security Model

### Authentication Flow
1. User logs in through `admin/index.html`
2. Firebase Auth validates credentials
3. System checks `admins` collection for role verification
4. Dashboard loads with appropriate permissions

### Firestore Security Rules
- Admin collections are protected by role-based access
- Users can only access their own data
- Reports are readable only by admins
- Audit logging for all admin actions

### Data Protection
- No sensitive data stored in client-side code
- All admin actions are logged for audit trails
- Automatic session timeout for security
- Role-based feature access control

## 🎨 Customization

### Styling
Modify `public/assets/admin/admin.css` to customize:
- Color scheme and branding
- Layout and spacing
- Mobile responsiveness
- Dark/light theme support

### Functionality
Extend `public/assets/admin/dashboard.js` to add:
- Custom analytics metrics
- Additional moderation tools
- Integration with external services
- Advanced user management features

## 📱 Mobile Responsiveness

The admin dashboard is fully responsive and works on:
- Desktop computers (optimal experience)
- Tablets (iPad, Android tablets)
- Mobile phones (simplified layout)
- Different screen orientations

## 🚨 Troubleshooting

### Common Issues

**Login fails with "Not authorized"**
- Verify user exists in `admins` collection
- Check that `role` field equals "admin"
- Ensure Firestore security rules are deployed

**Dashboard shows "Loading..." forever**
- Check browser console for JavaScript errors
- Verify Firebase configuration is correct
- Ensure user has proper admin permissions

**Charts not loading**
- Verify Chart.js CDN is accessible
- Check that analytics data exists in Firestore
- Ensure user has analytics permissions

**Real-time updates not working**
- Check Firestore connection status
- Verify WebSocket connectivity
- Ensure security rules allow admin access

### Debug Mode
Enable debug logging by adding to browser console:
```javascript
localStorage.setItem('debugMode', 'true');
```

## 🔄 Updates & Maintenance

### Backing Up Admin Data
```bash
# Export admin configurations
firebase firestore:export gs://your-bucket/admin-backup

# Export security rules
firebase firestore:rules get > firestore-rules-backup.txt
```

### Updating Dashboard
1. Test changes in development environment
2. Deploy security rule updates first
3. Update dashboard files
4. Verify all functionality works
5. Monitor for any issues post-deployment

## 📞 Support

### Getting Help
- Check browser console for error messages
- Review Firestore security rules for access issues
- Verify Firebase project configuration
- Test with a fresh admin user account

### Reporting Issues
Include the following information:
- Browser and version
- Error messages from console
- Steps to reproduce the issue
- Firebase project configuration (without sensitive data)

## 🎯 Roadmap

### Planned Features
- [ ] Advanced search and filtering
- [ ] Automated moderation rules
- [ ] Email notification system
- [ ] Data export/import tools
- [ ] Multi-language support
- [ ] Advanced analytics dashboards
- [ ] Integration with external monitoring tools

### Performance Optimizations
- [ ] Lazy loading for large datasets
- [ ] Caching layer for frequently accessed data
- [ ] Pagination for user lists
- [ ] Optimized real-time listeners

---

**Created for JLio App** - A comprehensive admin solution for modern social applications.