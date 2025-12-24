Firebase Cloud Functions for JLIO admin actions

Setup & deploy

1. Install dependencies:

```bash
cd functions
npm install
```

2. Initialize Firebase (if not already) and deploy functions:

```bash
# from project root
npx firebase login
npx firebase init functions
npx firebase deploy --only functions
```

Notes
- The functions use the Admin SDK and expect an `admins` collection in Firestore with admin docs (field `role: 'admin'`) to verify callers.
- `adminDisableUser` disables the Firebase Auth user and updates `users/{uid}`.
- `adminRewardJLios` runs a transaction to update balances and create a transaction record.
