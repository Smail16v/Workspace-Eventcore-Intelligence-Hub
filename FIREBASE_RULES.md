# Firebase Security Rules

**IMPORTANT: You must publish these rules in your Firebase Console to fix the "Missing or insufficient permissions" error.**

To resolve the permission errors, copy the following rules into your Firebase Console > Firestore Database > Rules tab.

## Firestore Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper to get the current user's profile
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    // --- User Profiles ---
    // Collection: /users
    // Document: {userId} (Matches Auth UID)
    match /users/{userId} {
      // Users can read/write their own profile.
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // --- Projects ---
    // Collection: /projects (Root Level)
    // Document: {projectId} AND all subcollections
    match /projects/{projectId}/{document=**} {
      // Allow if Admin ('all') OR if projectId is in their allowed list
      allow read, write: if request.auth != null && (
        getUserData().accessLevel == 'all' || 
        projectId in getUserData().accessLevel
      );
    }
  }
}
```

## Storage Rules

Go to the **Storage** tab in Firebase Console > Rules and paste this:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Allow authenticated users to upload and delete project CSVs
    match /project_CSVs/{allPaths=**} {
      allow read, write: if request.auth != null;
    }

    // Allow authenticated users to upload project assets (logos, etc)
    match /project_assets/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Explanation

1.  **RBAC Logic**: The `getUserData()` function fetches the requestor's profile from the `users` collection.
2.  **Access Verification**: 
    *   If `userData.accessLevel == 'all'`, the user has full access (Admin).
    *   If `userData.accessLevel` is an array, the rule checks if `projectId` exists inside that array (`projectId in userData.accessLevel`).
3.  **Strict Enforcement**: Even if a Guest tries to access a project via direct ID, these rules will block the read/write if the ID is not in their allow-list.

## Troubleshooting

1.  **Permission Denied?** Ensure your user document in Firestore has the correct `accessLevel` field. For admins, set it to the string `"all"`.
2.  **Quota Issues**: Using `get()` in rules costs 1 read operation per rule evaluation. This is standard for metadata-driven permissions.