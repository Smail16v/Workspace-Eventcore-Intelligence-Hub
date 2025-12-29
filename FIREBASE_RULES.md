
# Firebase Security Rules

**IMPORTANT: You must publish these rules in your Firebase Console to fix the "Missing or insufficient permissions" error.**

To resolve the permission errors, copy the following rules into your Firebase Console > Firestore Database > Rules tab.

## Firestore Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper to safely get the current user's profile data
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    // Helper to check if the current user exists and is an Admin
    function isAdmin() {
      return request.auth != null && 
             exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
             getUserData().get('accessLevel', '') == 'all';
    }

    // --- User Profiles ---
    // Collection: /users
    // Document: {userId} (Matches Auth UID)
    match /users/{userId} {
      // Users can read/write their own profile.
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Allow Admins to read and update ANY user profile
      allow read, update: if isAdmin();
    }

    // --- Projects ---
    // Collection: /projects (Root Level)
    // Document: {projectId} AND all subcollections
    match /projects/{projectId}/{document=**} {
      // Allow if Admin OR if projectId is in their allowed list
      allow read, write: if request.auth != null && (
        isAdmin() || 
        (exists(/databases/$(database)/documents/users/$(request.auth.uid)) && 
         projectId in getUserData().get('accessLevel', []))
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

## CORS Configuration (Critical for "Failed to fetch")

If you see "Failed to fetch" errors when loading project data, you must configure CORS on your storage bucket.

1. Create a file named `cors.json` on your computer:
```json
[
  {
    "origin": ["*"],
    "method": ["GET"],
    "maxAgeSeconds": 3600
  }
]
```

2. Install `gsutil` (part of Google Cloud SDK) or use the Google Cloud Console Cloud Shell.

3. Run the following command:
```bash
gsutil cors set cors.json gs://eventcore-intelligence-hub.firebasestorage.app
```
