# Firebase Security Rules

**IMPORTANT: You must publish these rules in your Firebase Console to fix the "Missing or insufficient permissions" error.**

To resolve the permission errors, copy the following rules into your Firebase Console > Firestore Database > Rules tab.

## Firestore Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // --- User Profiles ---
    // Collection: /users
    // Document: {userId} (Matches Auth UID)
    match /users/{userId} {
      // Users can only read and write their own profile document.
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // --- Projects ---
    // Collection: /projects (Root Level)
    // Document: {projectId} AND all subcollections (schema, responses)
    match /projects/{projectId}/{document=**} {
      // All authenticated users have full read/write access to projects and their subcollections.
      allow read, write: if request.auth != null;
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

1.  **Users Collection (`/users/{userId}`)**:
    *   **Strict Ownership**: The rule `request.auth.uid == userId` ensures a user can only access the document that matches their User ID. This applies to creation, reading, and updating.

2.  **Projects Collection (`/projects/{projectId}/{document=**}`)**:
    *   **Recursive Access**: The `{document=**}` wildcard matches the project document *and* any document deeply nested within it (like `/projects/123/schema/abc` or `/projects/123/responses/xyz`).
    *   **Open Access**: `allow read, write: if request.auth != null;` grants full access to any logged-in user, facilitating a collaborative workspace at the root level and for all dataset uploads.

3.  **Storage (`/project_CSVs` & `/project_assets`)**:
    *   Authenticated users can read and write files to the `project_CSVs` and `project_assets` folders, enabling file synchronization and logo uploads.
    *   Updated to match `{allPaths=**}` recursively under these folders to prevent path mismatch issues.

## Troubleshooting

If you still see "Missing or insufficient permissions":
1.  **Check Path**: Verify your database actually has a `projects` collection at the root (refresh the Data tab).
2.  **Wait**: Rules can take up to a minute to propagate after publishing.
3.  **Logout/Login**: Sometimes the auth token needs to refresh.
4.  **Check Console**: Ensure you pasted the rules exactly as above into the Firebase Console.