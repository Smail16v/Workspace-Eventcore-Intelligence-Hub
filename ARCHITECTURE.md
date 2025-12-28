# Eventcore Workspace Architecture

## Overview
The Eventcore Workspace is a React-based Single Page Application (SPA) designed to manage event intelligence projects. It acts as a dashboard for configuring event metadata (Venues, Promoters, Dates) and associating raw datasets (CSV schemas and responses).

The application enforces strict **Role-Based Access Control (RBAC)**, allowing Administrators to manage user permissions and restricting Guests to specific project views.

## Technology Stack
- **Frontend Framework**: React 19 (via ESM imports)
- **Styling**: Tailwind CSS (CDN loaded) + Lucide React (Icons)
- **Backend / Data**: Firebase v12 (Firestore for database, Auth for identity)
- **AI Integration**: Google Gemini API (`@google/genai` SDK)

## Global Configuration
The application relies on global variables injected into the `window` object by the hosting environment for configuration:
- `window.__firebase_config`: JSON string containing Firebase initialization keys.
- `window.__initial_auth_token`: Optional custom token for seamless authentication.
- `window.__app_id`: The specific workspace identifier.

## Key Services

### 1. Firebase Service (`services/firebase.ts`)
- **Authentication**: Handles Login, Registration, and Password Reset.
- **User Management**: 
  - `ensureUserProfileExists`: Auto-heals profiles on login.
  - `fetchAllUsers` & `updateUserAccess`: Admin-only functions to list users and modify permissions.
- **Data Access**: 
  - Subscribes to `projects` collection with dynamic queries based on user's `accessLevel`.
- **Storage**: Manages CSV and Image uploads to Firebase Storage.

### 2. Gemini AI Service (`services/geminiService.ts`)
- **Model**: Uses `gemini-2.5-flash-preview-09-2025`.
- **Functionality**: `analyzeEventContext(textOrUrl)`
    - Parses URLs or event names to extract metadata (Venue, Dates, Promoter).
    - Uses Google Search Grounding for up-to-date information.
    - Returns structured JSON for form auto-filling.

## Data Model (Firestore)

### Projects (`/projects/{projectId}`)
Core entity representing an event hub.
```typescript
interface Project {
  id: string;
  name: string;      // "US Open"
  venue: string;     // "Arthur Ashe Stadium"
  location: string;  // "New York, NY"
  country: string;   // "USA"
  year: string;      // "2025"
  dates: string;     // "AUG 26 - SEP 08"
  logoUrl: string;   // Image URL
  ownerId: string;   // Creator UID
  // ... plus artifact metadata
}
```

### Users (`/users/{userId}`)
Identity profile controlling access.
```typescript
interface UserProfile {
  uid: string;
  email: string;
  accessLevel: 'all' | string[]; // 'all' = Admin, Array = Project IDs
}
```

## Component Hierarchy

1.  **`App.tsx` (Root Controller)**
    -   **Auth & Routing**: Determines if the user is logged in and verified.
    -   **Data Sync**: Fetches projects based on RBAC rules (Admin gets all, Guest gets assigned).
    -   **Layout**: Manages the main Grid/List view and search state.

2.  **`UserManagementModal.tsx` (Admin Only)**
    -   Allows Admins to search all registered users.
    -   Toggles "Admin" status.
    -   Assigns specific project access to Guests.

3.  **`ProjectModal.tsx` (Editor)**
    -   Handles creation/editing of projects.
    -   Integrates **Qualtrics Import** and **Gemini AI Auto-fill**.
    -   Manages file uploads for Schema and Response datasets.

4.  **`ProjectDashboard.tsx` (Detail View)**
    -   Read-only or Edit view of a specific event hub.

## Security Model
- **Firestore Rules**: Strictly enforce that users can only read projects listed in their `accessLevel` array, unless they have `accessLevel: 'all'`.
- **UI Logic**: The interface hides "New Project" and "Manage Users" buttons for non-admins.