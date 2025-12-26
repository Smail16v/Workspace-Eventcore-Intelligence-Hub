# Firebase Security Rules

To resolve the `[code=permission-denied]` errors and ensure user data privacy, copy the following rules into your Firebase Console > Firestore Database > Rules tab.

## Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // --- Helper Functions ---

    // Check if the user is currently signed in
    function isAuthenticated() {
      return request.auth != null;
    }

    // Check if the user accessing the data is the owner of the document
    // (Matches the Auth UID with the document ID)
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // --- User Profiles ---
    // Collection: /users
    // Document: {userId} (Matches Auth UID)
    match /users/{userId} {
      // STRICT PRIVACY:
      // Users can only read and write their own profile document.
      // This allows the app to fetch the profile on login and update it via the Profile Modal.
      allow read, write: if isOwner(userId);
    }

    // --- Projects (Artifacts) ---
    // Collection: /artifacts/{appId}/public/data/projects
    // Document: {projectId}
    match /artifacts/{appId}/public/data/projects/{projectId} {
      
      // READ: Allow any authenticated user to view the project list.
      // This is necessary for the workspace dashboard to load the list of projects.
      allow read: if isAuthenticated();

      // CREATE: Allow authenticated users to create projects.
      // We enforce that the 'ownerId' field in the new document matches their own UID.
      allow create: if isAuthenticated() 
                    && request.resource.data.ownerId == request.auth.uid;

      // UPDATE: Allow only the project owner (or admins) to edit the project.
      allow update: if isAuthenticated() 
                    && (resource.data.ownerId == request.auth.uid || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');

      // DELETE: Allow only the project owner (or admins) to delete the project.
      allow delete: if isAuthenticated() 
                    && (resource.data.ownerId == request.auth.uid || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
    }
  }
}
```

## Explanation

1.  **Users Collection (`/users/{userId}`)**:
    *   **Issue**: The previous "Permission denied" error during login occurred because the app tries to `getDoc` or `setDoc` on the user's profile, but no rule allowed it.
    *   **Fix**: The `isOwner(userId)` check ensures that `user_abc` can only access `/users/user_abc`.

2.  **Projects Collection**:
    *   **Issue**: The dashboard tries to load *all* projects via `onSnapshot`, which failed because default Firestore rules often block listing collections.
    *   **Fix**: `allow read: if isAuthenticated()` grants access to the workspace data for any logged-in user.
    *   **Security**: Write operations (Create/Update/Delete) are restricted. You cannot overwrite someone else's project unless you are the `ownerId` or an `admin`.

## Troubleshooting

If you still see "Missing or insufficient permissions":
1.  **Wait**: Rules can take up to a minute to propagate after publishing.
2.  **Check Auth**: Ensure the user is successfully logged in. If `request.auth` is null (e.g., during a race condition on load), the rules will reject the request.
3.  **Indexes**: If you perform complex filtering (e.g., sorting by date *and* filtering by owner), Firestore might require a composite index. Check the "Indexes" tab in the Firebase Console for alerts.
